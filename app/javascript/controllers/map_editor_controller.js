import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  // Data passed from the view via data-map-editor-*-value attributes
  static values = {
    coords: Array,       // existing saved coordinates (percentages)
    boothSpaces: Array,  // all booth_spaces for this event (from Booth records)
    saveUrl: String,     // PATCH endpoint for saving coordinates
    imageUrl: String     // URL of the floor plan image
  }

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
    this.isDrawing = false
    this.selectedBoothSpace = null
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
