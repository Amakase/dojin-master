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
    const { Canvas, Rect, FabricImage, FabricText, Group } = await import("fabric")
    this.fabricClasses = { Canvas, Rect, FabricImage, FabricText, Group }
    this.isDrawing = false
    this.selectedBoothSpace = null  // tracks which sidebar item the admin has selected
    this._onMouseDown = null        // stored handler refs so cancelDrawing() can remove them
    this._onMouseMove = null
    this._onMouseUp = null

    this.canvas = new Canvas(this.element.querySelector("canvas"), {
      selection: true
    })

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
    const { Rect, FabricText, Group } = this.fabricClasses

    this.canvas.isDrawingMode = false
    this.canvas.defaultCursor = "crosshair"
    this.canvas.hoverCursor = "crosshair"

    let startX, startY, drawingRect

    // Track mouse-down position to define the rect's origin
    this._onMouseDown = (opt) => {
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

      // Build a labeled Group: a rect + a small text label in its top-left corner
      const label = new FabricText(boothSpace, {
        fontSize: 10,
        fill: "white",
        left: 2,
        top: 2,
        selectable: false,
        evented: false
      })

      const finalRect = new Rect({
        left: 0,
        top: 0,
        width: drawingRect.width,
        height: drawingRect.height,
        fill: "rgba(255,200,0,0.3)",
        stroke: "gold",
        strokeWidth: 1
      })

      const group = new Group([finalRect, label], {
        left: drawingRect.left,
        top: drawingRect.top
      })
      // Store booth_space on the group so it can be serialized on save
      group.boothSpace = boothSpace

      this.canvas.add(group)
      this.canvas.setActiveObject(group)
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
    // Green dot = placed, gold highlight = currently selected for drawing, gray = unplaced.
    list.innerHTML = this.boothSpacesValue.map(space => {
      const isPlaced = placed.has(space)
      const isSelected = this.selectedBoothSpace === space
      let classes = "me-sidebar__space"
      if (isSelected) classes += " me-sidebar__space--selected"
      else if (isPlaced) classes += " me-sidebar__space--placed"
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
    const { Rect, FabricText, Group } = this.fabricClasses

    // Convert each saved percentage-based coordinate back to canvas pixels and draw it
    this.coordsValue.forEach(coord => {
      const rect = new Rect({
        left: 0,
        top: 0,
        width: (coord.width / 100) * this.canvas.width,
        height: (coord.height / 100) * this.canvas.height,
        fill: "rgba(255,200,0,0.3)",
        stroke: "gold",
        strokeWidth: 1
      })

      const label = new FabricText(coord.booth_space, {
        fontSize: 10,
        fill: "white",
        left: 2,
        top: 2,
        selectable: false,
        evented: false
      })

      const group = new Group([rect, label], {
        left: (coord.x / 100) * this.canvas.width,
        top: (coord.y / 100) * this.canvas.height
      })
      group.boothSpace = coord.booth_space

      this.canvas.add(group)
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
