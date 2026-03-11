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
                    "sectionStatus", "sectionDrawBtn", "sectionSelect"]

  async connect() {
    // Fabric is imported dynamically so it's only bundled for pages that use this
    // controller — keeps the default JS payload lean for all other pages.
    const { Canvas, Rect, FabricImage, Point } = await import("fabric")
    this.fabricClasses = { Canvas, Rect, FabricImage, Point }
    this.isDrawing = false

    // Two separate "selected" concepts exist simultaneously:
    //   selectedBoothSpace      — gold highlight; set when admin clicks a sidebar item
    //                             to enter draw mode for that booth.
    //   canvasSelectedBoothSpace — blue highlight; set when admin clicks an existing
    //                             rect on the canvas (Fabric's native selection).
    // Both can be active at once (e.g. canvas-selecting one booth while drawing another
    // is not possible in practice, but the state variables are independent).
    this.selectedBoothSpace = null
    this.canvasSelectedBoothSpace = null

    // Handler refs are stored on the instance so cancelDrawing() can remove the exact
    // same function objects that were registered. canvas.off() requires a reference —
    // passing an anonymous function would never match what canvas.on() registered.
    this._onMouseDown = null
    this._onMouseMove = null
    this._onMouseUp = null

    this._panning = false   // true while alt+drag is active
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

  // Removes all canvas mouse handlers and resets drawing state cleanly.
  // Called both when the admin explicitly cancels (clicks the same sidebar item again)
  // and internally after a rect is committed — so it must be safe to call at any point.
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
      // Disable Fabric's rubber-band selection while panning so it doesn't
      // accidentally start selecting objects that are under the cursor.
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

  // Called when a sidebar item is clicked — selects that booth space and enters draw mode.
  // Clicking a selected item again acts as a toggle (deselects and cancels draw mode).
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
    // Serialize all labeled canvas objects to percentage-based coordinate objects.
    // Percentages are used so coordinates survive floor plan image rescaling —
    // if the image is swapped for a higher-resolution version the rects stay in place.
    const coords = this.canvas.getObjects().filter(obj => obj.boothSpace).map(obj => ({
      booth_space: obj.boothSpace,
      x: (obj.left / this.canvas.width) * 100,
      y: (obj.top / this.canvas.height) * 100,
      // obj.width/height are the unscaled dimensions; multiply by scale factors to get
      // the actual rendered size before converting to a percentage.
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

      // Temporary preview rect shown while dragging; replaced with the final rect on mouse-up.
      // We use a separate object so we can remove it cleanly without affecting any existing rects.
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
      // Math.min for left/top handles the case where the user drags up or left —
      // Fabric rects don't support negative width/height, so we normalize the origin.
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

      // Capture booth space before cancelDrawing() clears this.selectedBoothSpace.
      // Falls back to a prompt so the tool can also place ad-hoc labeled rects
      // without going through the sidebar.
      const boothSpace = this.selectedBoothSpace || prompt("Enter booth_space label (e.g. 東01a):")

      // Remove the temporary preview rect and deregister all three event listeners
      this.canvas.remove(drawingRect)
      this.cancelDrawing()

      if (boothSpace === null) { drawingRect = null; return }

      // Create the permanent rect with the same geometry as the preview rect.
      // We create a fresh object rather than mutating drawingRect so we can set
      // properties cleanly (boothSpace, selectability, etc.) from a known baseline.
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
  // The admin provides:
  //   • An anchor booth — one already-placed rect whose position we trust.
  //   • A numeric range — which booth numbers to fill (e.g. 1–30).
  //   • A layout — "side-by-side" (a/b booths beside each other) or "stacked" (a/b above each other).
  //
  // The admin then draws a rectangle over the section area on the floor plan.
  // The system distributes all booths in the range uniformly within that rectangle,
  // using the anchor's position relative to the drawn rect to auto-detect:
  //   • RTL vs LTR number direction
  //   • which half (a vs b) is on which side or row
  // No LLM call, no manual coordinate entry.

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
      this._setSectionStatus("Select a section and anchor booth first.")
      return
    }

    // The anchor must already be placed on the canvas so we can read its pixel position.
    // Its position is what tells us whether numbers run left-to-right or right-to-left.
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
        // Non-interactive so it doesn't interfere with the draw gesture
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

      // Reject tiny accidental clicks — require a meaningful area
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
  // Converts everything to percentages, looks up unplaced booths, delegates to
  // computeSectionCoords(), then stamps each result as a gold rect on the canvas.
  _finalizeSectionDraw(boundaryRect, anchorObj) {
    const W = this.canvas.width
    const H = this.canvas.height

    // Convert boundary and anchor to percentage coordinates so computeSectionCoords()
    // works in a normalized 0–100 space (matching how coords are saved to the DB).
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

    // Derive the section prefix from the anchor booth space (everything before the first "-").
    // e.g. anchor "あ-01a" → prefix "あ", so we only place booths in section "あ".
    const sectionPrefix = anchorObj.boothSpace.split("-")[0]

    // Only place booths that (a) belong to this section, (b) fall within the numeric range,
    // and (c) are not already placed — avoids overwriting manually positioned booths.
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
  //
  // Direction detection via anchor position:
  //   RTL (right-to-left) — anchor's center is right of the section midpoint.
  //     e.g. section "あ" where booth 01 is at the far right of the block.
  //   LTR (left-to-right) — anchor's center is left of the section midpoint.
  //
  // Layout "side-by-side":  each booth number gets a "pair column" spanning the full
  //   section height. Within each pair column the "a" and "b" variants sit beside each
  //   other horizontally. Which half is "a" is detected from the anchor's x within its column.
  //
  // Layout "stacked":  every booth gets its own full-width row — pure vertical stack.
  //   a and b are also stacked on top of each other (no side-by-side splitting).
  //   Numbers run top-to-bottom or bottom-to-top based on the anchor's y position.
  //
  // Booth space naming conventions handled:
  //   "あ-01a"  → num=1, row="a"
  //   "あ-01b"  → num=1, row="b"
  //   "あ-01ab" → num=1, row="ab" (combined booth, spans full column/row pair)
  //   "あ-01"   → num=1, row=""   (treated same as "a")
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

      // Determine which half of the pair column "a" occupies by comparing the anchor
      // rect's left edge to the midpoint of its own column.
      // anchorColStartX is where the anchor's column begins (in percentage coords).
      const anchorColStartX = isRTL
        ? sectionRect.x + (N - 1) * colWidth   // RTL: anchor's column is the rightmost
        : sectionRect.x                          // LTR: anchor's column is the leftmost
      const isARight = (anchor.x - anchorColStartX) > colWidth / 2

      sortedNums.forEach((num, stepIdx) => {
        // stepIdx = 0 is the anchor's number; stepIdx grows with num.
        // colFromLeft translates stepIdx to a physical column index counting from the left
        // edge of the section, accounting for RTL reversal.
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
            // b is always opposite to a within the pair column
            const x = isARight ? colStartX : colStartX + boothWidth
            results.push({ boothSpace, x, y: sectionRect.y, width: boothWidth, height: boothHeight })
          }
        }
      })
    } else {
      // Stacked: every booth gets its own full-width row — pure vertical stack.
      // No side-by-side splitting at all; a and b are also stacked on top of each other.
      // Numbers run top-to-bottom or bottom-to-top based on anchor y position.
      // Within each number: a (or "") always precedes b.
      // "ab" combined booths span double the slot height (they replace both a and b).

      const anchorMidY = anchor.y + anchor.height / 2
      const isBTT = anchorMidY > sectionRect.y + sectionRect.height / 2

      // Build a flat ordered list: numbers in direction order, a before b within each number
      const numsInOrder = isBTT ? [...sortedNums].reverse() : sortedNums
      const orderedBooths = []
      for (const num of numsInOrder) {
        const entries = byNum.get(num).slice().sort((x, y) => {
          // "a"/"" → 0, "b" → 1, "ab" → 2
          const rank = r => (r === "a" || r === "") ? 0 : r === "b" ? 1 : 2
          return rank(x.row) - rank(y.row)
        })
        orderedBooths.push(...entries)
      }

      // Each "ab" booth counts as 2 slots; a/b each count as 1
      const totalSlots = orderedBooths.reduce((sum, e) => sum + (e.row === "ab" ? 2 : 1), 0)
      const slotHeight = sectionRect.height / totalSlots

      let curY = sectionRect.y
      for (const { boothSpace, row } of orderedBooths) {
        const slots = row === "ab" ? 2 : 1
        results.push({
          boothSpace,
          x:      sectionRect.x,
          y:      curY,
          width:  sectionRect.width,
          height: slotHeight * slots
        })
        curY += slotHeight * slots
      }
    }

    return results
  }

  // ── Section panel helpers ─────────────────────────────────────────────────

  // Rebuilds the section prefix dropdown from currently placed booths.
  // Preserves the current section/anchor selections if they are still valid
  // (e.g. after a new booth is placed the dropdowns stay put).
  updateSectionDropdown() {
    if (!this.hasSectionSelectTarget) return

    const placed = this.canvas.getObjects().map(o => o.boothSpace).filter(Boolean)

    // Extract unique section prefixes — everything before the first "-"
    const sections = [...new Set(
      placed.map(bs => bs.split("-")[0]).filter(Boolean)
    )].sort()

    const sectionSel = this.sectionSelectTarget
    const prevSection = sectionSel.value
    const prevAnchor  = this.hasSectionAnchorTarget ? this.sectionAnchorTarget.value : ""

    sectionSel.innerHTML =
      '<option value="">Section…</option>' +
      sections.map(s =>
        `<option value="${s}"${s === prevSection ? " selected" : ""}>${s}</option>`
      ).join("")

    // Repopulate anchor dropdown for whatever section is currently selected,
    // preserving the anchor value if it's still in the new list.
    this._populateAnchorDropdown(sectionSel.value, placed, prevAnchor)
  }

  // Populates the anchor <select> with placed booths that belong to sectionPrefix.
  // preserveAnchor is re-selected if it still exists in the list.
  _populateAnchorDropdown(sectionPrefix, placed, preserveAnchor = "") {
    if (!this.hasSectionAnchorTarget) return
    const anchorSel = this.sectionAnchorTarget

    if (!sectionPrefix) {
      anchorSel.innerHTML = '<option value="">Anchor…</option>'
      return
    }

    const matches = placed
      .filter(bs => bs.startsWith(sectionPrefix + "-"))
      .sort()

    anchorSel.innerHTML =
      '<option value="">Anchor…</option>' +
      matches.map(bs =>
        `<option value="${bs}"${bs === preserveAnchor ? " selected" : ""}>${bs}</option>`
      ).join("")
  }

  // Triggered when the section dropdown changes — refreshes the anchor dropdown
  // and resets any previously chosen anchor (it belongs to the old section).
  onSectionChange() {
    if (!this.hasSectionSelectTarget) return
    const placed = this.canvas.getObjects().map(o => o.boothSpace).filter(Boolean)
    this._populateAnchorDropdown(this.sectionSelectTarget.value, placed, "")
  }

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
    // CSS modifier priority (highest to lowest):
    //   --selected        (gold)  = active draw-mode target; overrides everything
    //   --canvas-selected (blue)  = rect is selected on canvas
    //   --placed          (green) = mapped but not actively targeted
    //   (none)            (gray)  = not yet placed
    // --selected is checked first and short-circuits so lower-priority modifiers
    // are never added simultaneously.
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

    // Only attach click handlers to unplaced items — placed items are not interactive.
    // Clicking a placed rect on the canvas (via initCanvasSelection) is how the admin
    // selects it for deletion or inspection without re-entering draw mode.
    list.querySelectorAll("li[data-space]:not(.me-sidebar__space--placed)").forEach(li => {
      li.addEventListener("click", () => this.selectBoothSpace(li.dataset.space))
    })

    // Update the "Placed: X / Y" counter
    const counter = this.element.querySelector("[data-map-editor-counter]")
    if (counter) counter.textContent = `Placed: ${placed.size} / ${this.boothSpacesValue.length}`

    this.updateSectionDropdown()
  }

  renderExistingCoords() {
    const { Rect } = this.fabricClasses

    // Convert each saved percentage-based coordinate back to canvas pixels and draw it.
    // This is the inverse of the percentage conversion in save() — multiplying by
    // canvas.width/height converts the 0–100 range back to pixel positions.
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
    // The canvas element is resized to match so there's no blank padding and
    // percentage coordinate math stays correct (we always divide by canvas.width/height).
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
