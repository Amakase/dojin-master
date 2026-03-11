import { Controller } from "@hotwired/stimulus"

// Read-only map viewer: scroll/pinch to zoom, drag/swipe to pan, dblclick or
// button to reset. No Fabric.js — pure CSS transform on the content target.
//
// HTML structure expected:
//   <div data-controller="map-viewer">            ← viewport (overflow:hidden)
//     <div data-map-viewer-target="content">      ← transformed layer
//       …image + SVG overlay…
//     </div>
//     <button data-action="click->map-viewer#reset">Reset zoom</button>
//   </div>
export default class extends Controller {
  static targets = ["content"]

  connect() {
    this.scale = 1
    this.tx = 0
    this.ty = 0

    this._panning = false
    this._lastX = 0
    this._lastY = 0

    // Two-finger pinch state
    this._pinching = false
    this._lastPinchDist = 0
    this._lastPinchMidX = 0
    this._lastPinchMidY = 0

    // Store bound refs so removeEventListener can match them exactly
    this._onWheel      = this._handleWheel.bind(this)
    this._onMouseDown  = this._handleMouseDown.bind(this)
    this._onMouseMove  = this._handleMouseMove.bind(this)
    this._onMouseUp    = this._handleMouseUp.bind(this)
    this._onDblClick   = this._handleDblClick.bind(this)
    this._onTouchStart = this._handleTouchStart.bind(this)
    this._onTouchMove  = this._handleTouchMove.bind(this)
    this._onTouchEnd   = this._handleTouchEnd.bind(this)

    const el = this.element
    el.addEventListener("wheel",      this._onWheel,      { passive: false })
    el.addEventListener("mousedown",  this._onMouseDown)
    el.addEventListener("mousemove",  this._onMouseMove)
    el.addEventListener("mouseup",    this._onMouseUp)
    el.addEventListener("mouseleave", this._onMouseUp)
    el.addEventListener("dblclick",   this._onDblClick)
    el.addEventListener("touchstart", this._onTouchStart, { passive: false })
    el.addEventListener("touchmove",  this._onTouchMove,  { passive: false })
    el.addEventListener("touchend",   this._onTouchEnd)
  }

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

    const rect = this.element.getBoundingClientRect()
    // Cursor position in viewport-local coordinates
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    // 0.999 ** deltaY gives smooth exponential scaling identical to the map editor.
    // Large wheel deltas zoom more; trackpad micro-deltas zoom smoothly.
    const newScale = Math.min(Math.max(this.scale * (0.999 ** e.deltaY), 0.3), 8)
    const f = newScale / this.scale

    // Zoom toward cursor: the element-space point under the cursor must remain
    // fixed after the transform changes. Solving for the new translate:
    //   cx = tx' + (cx - tx) / scale * newScale  →  tx' = cx - (cx - tx) * f
    this.tx = cx - (cx - this.tx) * f
    this.ty = cy - (cy - this.ty) * f
    this.scale = newScale

    this._applyTransform()
  }

  // ── Mouse drag pan ──────────────────────────────────────────────────────────

  _handleMouseDown(e) {
    if (e.button !== 0) return
    // Don't hijack clicks on the reset button or any other button inside the viewport
    if (e.target.closest("button")) return
    e.preventDefault()
    this._panning = true
    this._lastX = e.clientX
    this._lastY = e.clientY
    this.element.classList.add("is-panning")
  }

  _handleMouseMove(e) {
    if (!this._panning) return
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
      e.preventDefault()
      this._pinching = true
      this._panning  = false
      const [t1, t2] = e.touches
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

      const newScale = Math.min(Math.max(this.scale * (dist / this._lastPinchDist), 0.3), 8)
      const f = newScale / this.scale

      // Zoom toward the pinch midpoint, then also translate for any midpoint movement
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
    if (e.touches.length < 2) this._pinching = false
    if (e.touches.length === 0) this._panning = false
  }

  // ── Transform application ───────────────────────────────────────────────────

  _applyTransform() {
    this.contentTarget.style.transform =
      `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`
  }
}
