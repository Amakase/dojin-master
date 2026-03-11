import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  // Data passed from the view via data-map-editor-*-value attributes
  static values = {
    coords: Array,       // existing saved coordinates (percentages)
    boothSpaces: Array,  // all booth_spaces for this event (from Booth records)
    saveUrl: String,     // PATCH endpoint for saving coordinates
    imageUrl: String     // URL of the floor plan image
  }

  // Stimulus targets used by the section placement panel
  static targets = ["sectionAnchor", "sectionRangeStart", "sectionRangeEnd",
                    "sectionStatus", "sectionDrawBtn"]

  async connect() {
    // Dynamically import Fabric.js only on this page — not bundled into every page
    const { Canvas, Rect, FabricImage, Point } = await import("fabric")
    this.fabricClasses = { Canvas, Rect, FabricImage, Point }
    this.isDrawing = false
    this.selectedBoothSpace = null        // sidebar draw-mode selection (gold highlight)
    this.canvasSelectedBoothSpace = null  // canvas click selection (blue highlight)
    this._onMouseDown = null              // stored handler refs so cancelDrawing() can remove them
    this._onMouseMove = null
    this._onMouseUp = null
    this._panning = false                 // true while alt+drag pan is active
    this._lastPanX = 0
    this._lastPanY = 0

    // Section placement state
    this.sectionPlacementDrawing = false  // true while drawing the section boundary rect
    this.sectionLayout = "side-by-side"   // default layout; toggled by setSectionLayout()

    this.canvas = new Canvas(this.element.querySelector("canvas"), {
      selection: true
    })

    // Set up zoom and pan before loading the image so handlers are ready immediately
    this.initZoomPan()
    // Sync sidebar highlight when admin clicks a rect on canvas
    this.initCanvasSelection()

    // Load floor plan first so canvas dimensions are set before rendering rects
    await this.loadBackgroundImage()
    this.renderExistingCoords()
    this.updateSidebar()
  }

  // Removes all canvas mouse handlers and resets drawing state cleanly
  cancelDrawing() {
    if (this._onMouseDown) this.canvas.off("mouse:down", this._onMouseDown)
    if (this._onMouseMove) this.canvas.off("mouse:move", this._onMouseMove)
    if (this._onMouseUp)   this.canvas.off("mouse:up",   this._onMouseUp)
    this._onMouseDown = null
    this._onMouseMove = null
    this._onMouseUp = null
    this.canvas.defaultCursor = "default"
    this.canvas.hoverCursor = "move"
    this.canvas.selection = true
    this.isDrawing = false
    this.selectedBoothSpace = null

    // Reset section placement draw mode if it was active
    if (this.sectionPlacementDrawing) {
      this.sectionPlacementDrawing = false
      this._resetSectionDrawBtn()
    }
  }

  // Registers permanent zoom and pan handlers on the canvas.
  // These coexist with draw mode — alt+drag always pans, mouse wheel always zooms.
  // Object positions (scene coordinates) are unaffected by the viewport transform,
  // so coordinate saving/loading remains correct at any zoom or pan level.
  initZoomPan() {
    const { Point } = this.fabricClasses

    // Mouse wheel and trackpad pinch-to-zoom → zoom toward the cursor position
    this.canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY
      let zoom = this.canvas.getZoom()
      // 0.999 ** delta gives smooth exponential scaling — large deltas zoom more,
      // small deltas zoom less, and the direction follows the scroll naturally
      zoom *= 0.999 ** delta
      zoom = Math.min(Math.max(zoom, 0.3), 20) // clamp: 0.3× min, 20× max
      this.canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoom)
      opt.e.preventDefault()
      opt.e.stopPropagation()
    })

    // Alt + mouse-down → begin panning
    this.canvas.on('mouse:down', (opt) => {
      if (!opt.e.altKey) return
      this._panning = true
      this._lastPanX = opt.e.clientX
      this._lastPanY = opt.e.clientY
      this.canvas.defaultCursor = 'grabbing'
      this.canvas.hoverCursor = 'grabbing'
      this.canvas.selection = false
    })

    // Translate the viewport while panning
    this.canvas.on('mouse:move', (opt) => {
      if (!this._panning) return
      const dx = opt.e.clientX - this._lastPanX
      const dy = opt.e.clientY - this._lastPanY
      this.canvas.relativePan(new Point(dx, dy))
      this._lastPanX = opt.e.clientX
      this._lastPanY = opt.e.clientY
    })

    // End pan and restore cursor to whatever mode is currently active
    this.canvas.on('mouse:up', () => {
      if (!this._panning) return
      this._panning = false
      this.canvas.selection = true
      this.canvas.defaultCursor = this.isDrawing ? 'crosshair' : 'default'
      this.canvas.hoverCursor = this.isDrawing ? 'crosshair' : 'move'
    })
  }

  // Resets zoom to 1:1 and clears any pan offset.
  // The six values are a 2D affine transform matrix: [scaleX, skewY, skewX, scaleY, panX, panY].
  // Identity (no zoom, no pan) is [1, 0, 0, 1, 0, 0].
  resetZoom() {
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  }

  // Registers canvas selection events to sync the sidebar when a rect is clicked.
  // Uses three Fabric.js events: created (new selection), updated (different rect selected),
  // cleared (click on empty canvas area).
  initCanvasSelection() {
    // Fabric passes the selected objects as an array even for single selections,
    // so we always read index [0] — we only ever select one rect at a time.
    this.canvas.on('selection:created', (opt) => this.onCanvasSelect(opt.selected[0]))
    this.canvas.on('selection:updated', (opt) => this.onCanvasSelect(opt.selected[0]))
    this.canvas.on('selection:cleared',  ()      => this.onCanvasDeselect())
  }

  // Highlights the sidebar item matching the selected canvas rect and scrolls it into view
  onCanvasSelect(obj) {
    // `boothSpace` is not a built-in Fabric property — we set it manually on each
    // Rect after creation (e.g. `rect.boothSpace = "一展 A-01a"`). Guard in case
    // a non-booth Fabric object (like the background image) is somehow selected.
    if (!obj?.boothSpace) return
    this.canvasSelectedBoothSpace = obj.boothSpace
    this.updateSidebar()
    this.scrollSidebarTo(obj.boothSpace)
  }

  // Clears the blue canvas-selection highlight in the sidebar
  onCanvasDeselect() {
    this.canvasSelectedBoothSpace = null
    this.updateSidebar()
  }

  // Scrolls the sidebar list so the item for `space` is visible
  scrollSidebarTo(space) {
    const list = this.element.querySelector("[data-map-editor-sidebar]")
    if (!list) return
    // CSS.escape() sanitizes the booth space string so special characters like
    // parentheses or Japanese text don't break the querySelector selector syntax.
    const item = list.querySelector(`li[data-space="${CSS.escape(space)}"]`)
    item?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }

  // Called when a sidebar item is clicked — selects that booth space and enters draw mode
  selectBoothSpace(space) {
    const previous = this.selectedBoothSpace

    // Always cancel any in-progress drawing before changing selection
    if (this.isDrawing || previous) this.cancelDrawing()

    // Clicking the same item that was already selected just cancels — don't re-select
    if (previous === space) { this.updateSidebar(); return }

    this.selectedBoothSpace = space
    this.updateSidebar()
    this.addRect()
  }

  async save() {
    // Serialize all labeled canvas objects to percentage-based coordinate objects
    const coords = this.canvas.getObjects().filter(obj => obj.boothSpace).map(obj => ({
      booth_space: obj.boothSpace,
      x: (obj.left / this.canvas.width) * 100,
      y: (obj.top / this.canvas.height) * 100,
      width: (obj.width * obj.scaleX / this.canvas.width) * 100,
      height: (obj.height * obj.scaleY / this.canvas.height) * 100
    }))

    // PATCH the full coordinate set — server replaces all existing records for this event
    const response = await fetch(this.saveUrlValue, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content
      },
      body: JSON.stringify({ coordinates: coords })
    })

    const status = this.element.querySelector("[data-map-editor-status]")
    if (response.ok) {
      if (status) {
        status.textContent = "Saved!"
        // Auto-clear the status message after 3 seconds
        setTimeout(() => { status.textContent = "" }, 3000)
      }
      this.updateSidebar()
    } else {
      if (status) status.textContent = "Save failed."
    }
  }

  deleteSelected() {
    // Remove whichever Fabric.js object is currently selected, then refresh sidebar
    const active = this.canvas.getActiveObject()
    if (!active) return
    this.canvas.remove(active)
    this.canvas.renderAll()
    this.updateSidebar()
  }

  addRect() {
    // Guard against stacking multiple listener sets if already in drawing mode
    if (this.isDrawing) return

    this.isDrawing = true
    const { Rect } = this.fabricClasses

    this.canvas.isDrawingMode = false
    this.canvas.defaultCursor = "crosshair"
    this.canvas.hoverCursor = "crosshair"

    let startX, startY, drawingRect

    // Track mouse-down position to define the rect's origin.
    // Alt is reserved for panning — skip draw if it's held.
    this._onMouseDown = (opt) => {
      if (opt.e.altKey) return
      // getScenePoint converts screen pixel coordinates to Fabric's "scene" space,
      // accounting for any zoom and pan. Using e.offsetX/Y directly would give wrong
      // positions when the canvas is zoomed in or panned.
      const pointer = this.canvas.getScenePoint(opt.e)
      startX = pointer.x
      startY = pointer.y

      drawingRect = new Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: "rgba(255,200,0,0.3)",
        stroke: "gold",
        strokeWidth: 1
      })
      this.canvas.add(drawingRect)
    }

    // Continuously resize the preview rect as the mouse moves
    this._onMouseMove = (opt) => {
      if (!drawingRect) return
      const pointer = this.canvas.getScenePoint(opt.e)
      drawingRect.set({
        width: Math.abs(pointer.x - startX),
        height: Math.abs(pointer.y - startY),
        left: Math.min(pointer.x, startX),
        top: Math.min(pointer.y, startY)
      })
      this.canvas.renderAll()
    }

    this._onMouseUp = () => {
      if (!drawingRect) return

      // Capture booth space before cancelDrawing() clears it
      const boothSpace = this.selectedBoothSpace || prompt("Enter booth_space label (e.g. 東01a):")

      // Clean up the temporary preview rect and all three event listeners
      this.canvas.remove(drawingRect)
      this.cancelDrawing()

      if (boothSpace === null) { drawingRect = null; return }

      // Plain Rect with boothSpace stored as a property — no visible text label
      const finalRect = new Rect({
        left: drawingRect.left,
        top: drawingRect.top,
        width: drawingRect.width,
        height: drawingRect.height,
        fill: "rgba(255,200,0,0.3)",
        stroke: "gold",
        strokeWidth: 1
      })
      // boothSpace is stored on the object so it can be serialized on save and
      // used to sync the sidebar highlight when the rect is selected
      finalRect.boothSpace = boothSpace

      this.canvas.add(finalRect)
      this.canvas.setActiveObject(finalRect)
      this.canvas.renderAll()
      drawingRect = null

      this.updateSidebar()
    }

    this.canvas.on("mouse:down", this._onMouseDown)
    this.canvas.on("mouse:move", this._onMouseMove)
    this.canvas.on("mouse:up", this._onMouseUp)
  }

  // ── Section Placement ─────────────────────────────────────────────────────
  // User draws a rectangle over the section area on the canvas.
  // The system then distributes all booths in the range uniformly within that
  // rectangle, using the anchor booth's position to detect numbering direction
  // and row orientation — no LLM call needed.

  // Toggles the active layout button and updates the stored layout preference.
  setSectionLayout(event) {
    this.sectionLayout = event.currentTarget.dataset.layout
    this.element.querySelectorAll("[data-layout]").forEach(btn => {
      btn.classList.toggle(
        "me-section-panel__layout-btn--active",
        btn.dataset.layout === this.sectionLayout
      )
    })
  }

  // Enters (or cancels) section boundary draw mode.
  // On mouse-up the drawn rectangle drives coordinate computation via _finalizeSectionDraw().
  drawSectionArea() {
    // Second click while drawing → cancel
    if (this.sectionPlacementDrawing) {
      this.cancelDrawing()
      this._setSectionStatus("")
      return
    }

    // Validate anchor input
    const anchorSpace = this.hasSectionAnchorTarget
      ? this.sectionAnchorTarget.value.trim()
      : ""
    if (!anchorSpace) {
      this._setSectionStatus("Enter an anchor booth space first.")
      return
    }

    const anchorObj = this.canvas.getObjects().find(o => o.boothSpace === anchorSpace)
    if (!anchorObj) {
      this._setSectionStatus(`Anchor "${anchorSpace}" not found on canvas.`)
      return
    }

    // Cancel any in-progress booth draw before entering section draw mode
    if (this.isDrawing) this.cancelDrawing()

    this.sectionPlacementDrawing = true
    this.isDrawing = true
    this.canvas.selection = false
    this.canvas.defaultCursor = "crosshair"
    this.canvas.hoverCursor = "crosshair"

    this._setSectionStatus("Draw a rectangle over the section area on the floor plan…")
    if (this.hasSectionDrawBtnTarget) {
      this.sectionDrawBtnTarget.innerHTML =
        '<i class="fa-solid fa-xmark btn-me-ai__icon"></i> Cancel'
    }

    const { Rect } = this.fabricClasses
    let startX, startY, tempRect

    this._onMouseDown = (opt) => {
      if (opt.e.altKey) return
      const pointer = this.canvas.getScenePoint(opt.e)
      startX = pointer.x
      startY = pointer.y
      // Distinct visual style: blue dashed outline so it's clearly not a booth rect
      tempRect = new Rect({
        left: startX,
        top: startY,
        width: 1,
        height: 1,
        fill: "rgba(30, 140, 255, 0.08)",
        stroke: "#4da6ff",
        strokeWidth: 2,
        strokeDashArray: [8, 5],
        selectable: false,
        evented: false
      })
      this.canvas.add(tempRect)
    }

    this._onMouseMove = (opt) => {
      if (!tempRect) return
      const pointer = this.canvas.getScenePoint(opt.e)
      tempRect.set({
        width: Math.abs(pointer.x - startX),
        height: Math.abs(pointer.y - startY),
        left: Math.min(pointer.x, startX),
        top: Math.min(pointer.y, startY)
      })
      this.canvas.renderAll()
    }

    this._onMouseUp = () => {
      if (!tempRect) return
      const boundary = tempRect
      tempRect = null

      // cancelDrawing resets isDrawing, removes listeners, resets the button label
      this.cancelDrawing()

      if (boundary.width < 5 || boundary.height < 5) {
        this.canvas.remove(boundary)
        this.canvas.renderAll()
        this._setSectionStatus("Area too small — try again.")
        return
      }

      this._finalizeSectionDraw(boundary, anchorObj)
    }

    this.canvas.on("mouse:down", this._onMouseDown)
    this.canvas.on("mouse:move", this._onMouseMove)
    this.canvas.on("mouse:up", this._onMouseUp)
  }

  // Called after the user finishes drawing the section boundary.
  // Computes booth coordinates and adds them to the canvas.
  _finalizeSectionDraw(boundaryRect, anchorObj) {
    const W = this.canvas.width
    const H = this.canvas.height

    // Convert boundary and anchor to percentage coordinates
    const sectionRect = {
      x:      (boundaryRect.left                              / W) * 100,
      y:      (boundaryRect.top                               / H) * 100,
      width:  (boundaryRect.width  * (boundaryRect.scaleX || 1) / W) * 100,
      height: (boundaryRect.height * (boundaryRect.scaleY || 1) / H) * 100
    }
    const anchor = {
      x:      (anchorObj.left                            / W) * 100,
      y:      (anchorObj.top                             / H) * 100,
      width:  (anchorObj.width  * (anchorObj.scaleX || 1) / W) * 100,
      height: (anchorObj.height * (anchorObj.scaleY || 1) / H) * 100
    }

    // Remove the boundary rect — it was only for visual feedback while drawing
    this.canvas.remove(boundaryRect)

    // Read range inputs
    const rangeStart = parseInt(this.hasSectionRangeStartTarget
      ? this.sectionRangeStartTarget.value : "1", 10) || 1
    const rangeEnd   = parseInt(this.hasSectionRangeEndTarget
      ? this.sectionRangeEndTarget.value   : rangeStart.toString(), 10) || rangeStart

    // Derive the section prefix from the anchor booth space (everything before the first "-")
    const sectionPrefix = anchorObj.boothSpace.split("-")[0]

    // Find booths in this section + range that are not yet placed on the canvas
    const alreadyPlaced = new Set(
      this.canvas.getObjects().filter(o => o.boothSpace).map(o => o.boothSpace)
    )
    const boothsToPlace = this.boothSpacesValue.filter(bs => {
      if (!bs.startsWith(sectionPrefix + "-")) return false
      const m = bs.match(/-(\d+)/)
      if (!m) return false
      const num = parseInt(m[1], 10)
      return num >= rangeStart && num <= rangeEnd && !alreadyPlaced.has(bs)
    })

    if (boothsToPlace.length === 0) {
      this._setSectionStatus("No unplaced booths found in that range.")
      this.canvas.renderAll()
      return
    }

    // Compute coordinates purely from geometry
    const coords = this.computeSectionCoords(sectionRect, anchor, boothsToPlace, this.sectionLayout)

    // Stamp each computed booth onto the canvas as a standard gold rect
    const { Rect } = this.fabricClasses
    for (const c of coords) {
      const rect = new Rect({
        left:   (c.x      / 100) * W,
        top:    (c.y      / 100) * H,
        width:  (c.width  / 100) * W,
        height: (c.height / 100) * H,
        fill:   "rgba(255,200,0,0.3)",
        stroke: "gold",
        strokeWidth: 1
      })
      rect.boothSpace = c.boothSpace
      this.canvas.add(rect)
    }

    this.canvas.renderAll()
    this.updateSidebar()
    this._setSectionStatus(`Placed ${coords.length} booth${coords.length !== 1 ? "s" : ""}. Save All to persist.`)
  }

  // Pure math: distributes boothsToPlace uniformly within sectionRect.
  // The anchor's position within the rectangle is used to detect:
  //   - number direction (LTR vs RTL based on anchor's x relative to rect midpoint)
  //   - row orientation for stacked (top vs bottom based on anchor's y)
  //   - a/b horizontal position for side-by-side (left vs right half of each pair column)
  computeSectionCoords(sectionRect, anchor, boothsToPlace, layout) {
    // Group booths by their numeric column index
    const byNum = new Map()
    for (const bs of boothsToPlace) {
      // Match the numeric part and everything after (row suffix: "a", "b", "ab", or "")
      const m = bs.match(/-(\d+)(.*)$/)
      if (!m) continue
      const num = parseInt(m[1], 10)
      const row = m[2].trim()  // "a", "b", "ab", or ""
      if (!byNum.has(num)) byNum.set(num, [])
      byNum.get(num).push({ boothSpace: bs, row })
    }

    const sortedNums = [...byNum.keys()].sort((a, b) => a - b)
    const N = sortedNums.length
    if (N === 0) return []

    // Detect horizontal direction: if the anchor's center is right of the section midpoint,
    // numbers increase going left (RTL, like あ which has 01 at the far right).
    const anchorMidX = anchor.x + anchor.width / 2
    const isRTL = anchorMidX > sectionRect.x + sectionRect.width / 2

    const results = []

    if (layout === "side-by-side") {
      // Each number occupies one "pair column" spanning the full section height.
      // Within each pair column the a and b booths sit side by side horizontally.
      const colWidth   = sectionRect.width / N
      const boothWidth = colWidth / 2
      const boothHeight = sectionRect.height

      // Is 'a' in the right half of its pair column?
      // Determine which column the anchor belongs to (it's the first booth in sortedNums).
      const anchorColStartX = isRTL
        ? sectionRect.x + (N - 1) * colWidth   // RTL: anchor's column is the rightmost
        : sectionRect.x                          // LTR: anchor's column is the leftmost
      const isARight = (anchor.x - anchorColStartX) > colWidth / 2

      sortedNums.forEach((num, stepIdx) => {
        // stepIdx = 0 is the anchor's number; stepIdx grows with num
        const colFromLeft = isRTL ? (N - 1 - stepIdx) : stepIdx
        const colStartX   = sectionRect.x + colFromLeft * colWidth

        for (const { boothSpace, row } of byNum.get(num)) {
          if (row === "ab") {
            // Combined booth spans the full pair column
            results.push({ boothSpace, x: colStartX, y: sectionRect.y, width: colWidth, height: boothHeight })
          } else if (row === "a" || row === "") {
            const x = isARight ? colStartX + boothWidth : colStartX
            results.push({ boothSpace, x, y: sectionRect.y, width: boothWidth, height: boothHeight })
          } else if (row === "b") {
            const x = isARight ? colStartX : colStartX + boothWidth
            results.push({ boothSpace, x, y: sectionRect.y, width: boothWidth, height: boothHeight })
          }
        }
      })
    } else {
      // Stacked: each number occupies one column; a and b stacked vertically within it.
      const colWidth  = sectionRect.width / N
      const rowHeight = sectionRect.height / 2

      // Is 'a' in the upper half of the section? (anchor is row 'a' of the first number)
      const anchorMidY = anchor.y + anchor.height / 2
      const isATop     = anchorMidY < sectionRect.y + sectionRect.height / 2
      const rowA_y = isATop ? sectionRect.y : sectionRect.y + rowHeight
      const rowB_y = isATop ? sectionRect.y + rowHeight : sectionRect.y

      sortedNums.forEach((num, stepIdx) => {
        const colFromLeft = isRTL ? (N - 1 - stepIdx) : stepIdx
        const colX        = sectionRect.x + colFromLeft * colWidth

        for (const { boothSpace, row } of byNum.get(num)) {
          if (row === "ab") {
            // Combined booth spans both rows
            results.push({ boothSpace, x: colX, y: sectionRect.y, width: colWidth, height: sectionRect.height })
          } else if (row === "a" || row === "") {
            results.push({ boothSpace, x: colX, y: rowA_y, width: colWidth, height: rowHeight })
          } else if (row === "b") {
            results.push({ boothSpace, x: colX, y: rowB_y, width: colWidth, height: rowHeight })
          }
        }
      })
    }

    return results
  }

  // ── Section panel helpers ─────────────────────────────────────────────────

  _setSectionStatus(msg) {
    if (this.hasSectionStatusTarget) this.sectionStatusTarget.textContent = msg
  }

  _resetSectionDrawBtn() {
    if (this.hasSectionDrawBtnTarget) {
      this.sectionDrawBtnTarget.innerHTML =
        '<i class="fa-solid fa-crosshairs btn-me-ai__icon"></i> Draw Section'
    }
  }

  // ── Sidebar and rendering ─────────────────────────────────────────────────

  updateSidebar() {
    // Collect all booth_spaces currently placed on the canvas
    const placed = new Set(
      this.canvas.getObjects().map(obj => obj.boothSpace).filter(Boolean)
    )

    const list = this.element.querySelector("[data-map-editor-sidebar]")
    if (!list) return

    // Rebuild the sidebar list with click handlers on each item.
    // Gold  (--selected)        = currently in draw-mode for this space
    // Blue  (--canvas-selected) = this rect is selected on the canvas
    // Green (--placed)          = mapped but not actively selected
    // Gray  (default)           = not yet placed
    // Modifiers are applied in order; --selected overrides everything because it's
    // checked first and returns early, preventing lower-priority classes from being added.
    list.innerHTML = this.boothSpacesValue.map(space => {
      const isPlaced   = placed.has(space)
      const isSelected = this.selectedBoothSpace === space
      const isCanvasSel = this.canvasSelectedBoothSpace === space

      let classes = "me-sidebar__space"
      if (isSelected) {
        classes += " me-sidebar__space--selected"
      } else {
        if (isPlaced)    classes += " me-sidebar__space--placed"
        if (isCanvasSel) classes += " me-sidebar__space--canvas-selected"
      }

      const icon = isPlaced ? "●" : "○"
      return `<li class="${classes}" data-space="${space}">${icon} ${space}</li>`
    }).join("")

    // Only attach click handlers to unplaced items — placed items are not interactive
    list.querySelectorAll("li[data-space]:not(.me-sidebar__space--placed)").forEach(li => {
      li.addEventListener("click", () => this.selectBoothSpace(li.dataset.space))
    })

    // Update the "Placed: X / Y" counter
    const counter = this.element.querySelector("[data-map-editor-counter]")
    if (counter) counter.textContent = `Placed: ${placed.size} / ${this.boothSpacesValue.length}`
  }

  renderExistingCoords() {
    const { Rect } = this.fabricClasses

    // Convert each saved percentage-based coordinate back to canvas pixels and draw it.
    // Plain Rect with boothSpace property — no text label rendered on the canvas.
    this.coordsValue.forEach(coord => {
      const rect = new Rect({
        left: (coord.x / 100) * this.canvas.width,
        top:  (coord.y / 100) * this.canvas.height,
        width: (coord.width  / 100) * this.canvas.width,
        height: (coord.height / 100) * this.canvas.height,
        fill: "rgba(255,200,0,0.3)",
        stroke: "gold",
        strokeWidth: 1
      })
      rect.boothSpace = coord.booth_space

      this.canvas.add(rect)
    })

    this.canvas.renderAll()
  }

  async loadBackgroundImage() {
    const { FabricImage } = this.fabricClasses
    const img = await FabricImage.fromURL(this.imageUrlValue)

    // Scale the canvas down to a max of 1000px wide, preserving aspect ratio.
    // All coordinate math uses canvas.width/height so percentages stay correct at any scale.
    const maxWidth = 1000
    const scale = img.width > maxWidth ? maxWidth / img.width : 1
    img.scaleX = scale
    img.scaleY = scale

    this.canvas.setWidth(img.width * scale)
    this.canvas.setHeight(img.height * scale)
    this.canvas.backgroundImage = img
    this.canvas.renderAll()
  }
}
