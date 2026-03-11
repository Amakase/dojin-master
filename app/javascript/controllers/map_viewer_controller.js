import { Controller } from "@hotwired/stimulus"

// Read-only map viewer: scroll/pinch to zoom, drag/swipe to pan, dblclick or
// button to reset. No Fabric.js — pure CSS transform on the content target.
//
// Two nested elements do the work:
//   - Viewport div (data-controller): fixed size, clips content with overflow:hidden.
//   - Content div (target="content"): the layer we actually move and scale.
//     Everything in the map lives inside it.
//
// All interaction boils down to updating three numbers — scale, tx, ty —
// and writing them to the content div's CSS transform in _applyTransform().
//
// HTML structure expected:
//   <div data-controller="map-viewer">            ← viewport (overflow:hidden)
//     <div data-map-viewer-target="content">      ← transformed layer
//       …image + SVG overlay…
//     </div>
//     <button data-action="click->map-viewer#reset">Reset zoom</button>
//   </div>

export default class extends Controller {
  // Stimulus automatically finds the element with data-map-viewer-target="content"
  // and exposes it as this.contentTarget.
  static targets = ["content"]

  connect() {
    // The three numbers that fully describe the current view.
    // scale=1 means 100% (original size). tx/ty are pixel offsets from the origin.
    this.scale = 1
    this.tx = 0
    this.ty = 0

    // Flag that's true only while the user is actively dragging the map.
    // _lastX/_lastY remember where the cursor was on the previous mousemove
    // so we can compute how far it traveled (the delta) each frame.
    this._panning = false
    this._lastX = 0
    this._lastY = 0

    // Pinch-to-zoom state (mobile). _lastPinchDist is the distance between
    // the two fingers on the previous frame — comparing it to the current
    // distance gives us the zoom ratio. _lastPinchMid tracks the midpoint
    // between fingers so simultaneous pan+zoom works (like native Maps).
    this._pinching = false
    this._lastPinchDist = 0
    this._lastPinchMidX = 0
    this._lastPinchMidY = 0

    // .bind(this) locks `this` to the controller instance inside each handler.
    // Without it, `this` inside the handler would refer to the DOM element
    // that fired the event, not our controller, so this.scale etc. would be undefined.
    //
    // We save each bound version because removeEventListener requires the exact
    // same function reference that was passed to addEventListener. Binding inline
    // creates a new function object every time, which can't be matched for removal.
    this._onWheel      = this._handleWheel.bind(this)
    this._onMouseDown  = this._handleMouseDown.bind(this)
    this._onMouseMove  = this._handleMouseMove.bind(this)
    this._onMouseUp    = this._handleMouseUp.bind(this)
    this._onDblClick   = this._handleDblClick.bind(this)
    this._onTouchStart = this._handleTouchStart.bind(this)
    this._onTouchMove  = this._handleTouchMove.bind(this)
    this._onTouchEnd   = this._handleTouchEnd.bind(this)

    const el = this.element

    // { passive: false } is required on wheel and touchmove so we can call
    // e.preventDefault() inside them. Browsers default these to passive (they
    // won't wait for JS before scrolling the page), which makes preventDefault
    // a no-op. We need to opt out so the page doesn't scroll while the user
    // is panning/zooming the map.
    el.addEventListener("wheel",      this._onWheel,      { passive: false })
    el.addEventListener("mousedown",  this._onMouseDown)
    el.addEventListener("mousemove",  this._onMouseMove)
    el.addEventListener("mouseup",    this._onMouseUp)
    // mouseleave cancels panning when the cursor exits the viewport, otherwise
    // the map "sticks" to the cursor if you drag outside the div boundary.
    el.addEventListener("mouseleave", this._onMouseUp)
    el.addEventListener("dblclick",   this._onDblClick)
    el.addEventListener("touchstart", this._onTouchStart, { passive: false })
    el.addEventListener("touchmove",  this._onTouchMove,  { passive: false })
    el.addEventListener("touchend",   this._onTouchEnd)
  }

  // Stimulus calls this when the element leaves the page (e.g. Turbo navigation).
  // Removing every listener we added prevents memory leaks and duplicate handlers
  // if the user navigates back and forth.
  disconnect() {
    const el = this.element
    el.removeEventListener("wheel",      this._onWheel)
    el.removeEventListener("mousedown",  this._onMouseDown)
    el.removeEventListener("mousemove",  this._onMouseMove)
    el.removeEventListener("mouseup",    this._onMouseUp)
    el.removeEventListener("mouseleave", this._onMouseUp)
    el.removeEventListener("dblclick",   this._onDblClick)
    el.removeEventListener("touchstart", this._onTouchStart)
    el.removeEventListener("touchmove",  this._onTouchMove)
    el.removeEventListener("touchend",   this._onTouchEnd)
  }

  // Public action — wired to the "Reset zoom" button and dblclick
  reset() {
    this.scale = 1
    this.tx = 0
    this.ty = 0
    this._applyTransform()
  }

  // ── Mouse wheel / trackpad pinch ────────────────────────────────────────────

  _handleWheel(e) {
    e.preventDefault()

    // getBoundingClientRect() gives us the viewport div's position on screen.
    // Subtracting rect.left/top converts the cursor position from window-relative
    // to viewport-relative, which is the coordinate space our transform uses.
    const rect = this.element.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    // 0.999 ** deltaY gives smooth exponential scaling:
    // large wheel deltas produce a bigger jump; trackpad micro-deltas are barely
    // noticeable per event but add up smoothly. Math.min/max clamps zoom to 30%–800%.
    const newScale = Math.min(Math.max(this.scale * (0.999 ** e.deltaY), 0.3), 8)
    const f = newScale / this.scale

    // Zoom toward cursor: we want the map pixel currently under the cursor to
    // stay under the cursor after the scale changes. Solving for the new tx:
    //   screen_x = tx + content_x * scale
    //   The content pixel under cx is: content_x = (cx - tx) / scale
    //   After zoom we want: cx = tx' + content_x * newScale
    //   Substituting and simplifying: tx' = cx - (cx - tx) * f
    this.tx = cx - (cx - this.tx) * f
    this.ty = cy - (cy - this.ty) * f
    this.scale = newScale

    this._applyTransform()
  }

  // ── Mouse drag pan ──────────────────────────────────────────────────────────

  _handleMouseDown(e) {
    if (e.button !== 0) return  // only left-click drags the map
    // .closest("button") walks up the DOM tree from the clicked element —
    // if the user clicked the reset button (or anything inside it), bail out.
    if (e.target.closest("button")) return
    e.preventDefault()  // prevents text selection and image-drag while panning
    this._panning = true
    this._lastX = e.clientX
    this._lastY = e.clientY
    this.element.classList.add("is-panning")  // triggers a "grabbing hand" cursor via CSS
  }

  _handleMouseMove(e) {
    if (!this._panning) return  // fires on every mouse move, so guard is essential
    this.tx += e.clientX - this._lastX
    this.ty += e.clientY - this._lastY
    this._lastX = e.clientX
    this._lastY = e.clientY
    this._applyTransform()
  }

  _handleMouseUp() {
    if (!this._panning) return
    this._panning = false
    this.element.classList.remove("is-panning")
  }

  _handleDblClick(e) {
    if (e.target.closest("button")) return
    this.reset()
  }

  // ── Touch: single-finger pan + two-finger pinch-to-zoom ────────────────────

  _handleTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault()  // stop native browser pinch-to-zoom from interfering
      this._pinching = true
      this._panning  = false  // cancel any single-finger pan in progress
      const [t1, t2] = e.touches
      // Math.hypot(dx, dy) = √(dx²+dy²) — straight-line distance between fingers.
      this._lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      this._lastPinchMidX = (t1.clientX + t2.clientX) / 2
      this._lastPinchMidY = (t1.clientY + t2.clientY) / 2
    } else if (e.touches.length === 1 && !this._pinching) {
      this._panning = true
      this._lastX = e.touches[0].clientX
      this._lastY = e.touches[0].clientY
    }
  }

  _handleTouchMove(e) {
    if (e.touches.length === 2 && this._pinching) {
      e.preventDefault()
      const [t1, t2] = e.touches
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const midX = (t1.clientX + t2.clientX) / 2
      const midY = (t1.clientY + t2.clientY) / 2

      const rect = this.element.getBoundingClientRect()
      const cx = midX - rect.left
      const cy = midY - rect.top

      // Scale proportional to how much finger distance changed (same clamp as wheel).
      const newScale = Math.min(Math.max(this.scale * (dist / this._lastPinchDist), 0.3), 8)
      const f = newScale / this.scale

      // Zoom toward the pinch midpoint (same math as _handleWheel), then add
      // a translation for any movement of the midpoint itself. This lets the
      // user pan and zoom simultaneously with two fingers.
      this.tx = cx - (cx - this.tx) * f + (midX - this._lastPinchMidX)
      this.ty = cy - (cy - this.ty) * f + (midY - this._lastPinchMidY)
      this.scale = newScale

      this._lastPinchDist = dist
      this._lastPinchMidX = midX
      this._lastPinchMidY = midY

      this._applyTransform()
    } else if (e.touches.length === 1 && this._panning) {
      e.preventDefault()
      this.tx += e.touches[0].clientX - this._lastX
      this.ty += e.touches[0].clientY - this._lastY
      this._lastX = e.touches[0].clientX
      this._lastY = e.touches[0].clientY
      this._applyTransform()
    }
  }

  _handleTouchEnd(e) {
    // e.touches contains REMAINING fingers (not the one just lifted).
    if (e.touches.length < 2) this._pinching = false
    if (e.touches.length === 0) this._panning = false
  }

  // ── Transform application ───────────────────────────────────────────────────

  _applyTransform() {
    // The only place we write to the DOM. Every handler just updates scale/tx/ty
    // and calls this. Order matters in CSS transform chains — translate comes first
    // in the string but is applied last, keeping tx/ty in screen pixels (unaffected
    // by zoom) rather than in the content's scaled coordinate space.
    this.contentTarget.style.transform =
      `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`
  }
}
