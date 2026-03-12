import { Controller } from "@hotwired/stimulus"

// Renders a suggested walking route on the floor plan SVG overlay.
//
// Mounted on a wrapper div in favorites/_map.html.erb.
// The SVG's <g data-route-viewer-target="routeLayer"> lives inside
// shared/_event_map.html.erb and is a descendant of this controller's element,
// so Stimulus finds it as a target automatically.
//
// Route algorithm: nearest-neighbor within priority tiers + A* obstacle avoidance.
//   - Load the floor plan image into a hidden canvas, downsample to 300×300.
//   - Threshold pixels: cell is impassable if avg RGB < 80 (black walls).
//   - Dilate impassable cells by 1 grid cell for a safety margin.
//   - Run A* for each consecutive stop pair; disconnected areas → separate segments.
//   - Apply string-pulling (Bresenham line-of-sight) to smooth jagged paths.
//
// Memory: all A* buffers (gScore, cameFrom, heap arrays) are allocated ONCE at
// grid-build time and reused across all A* calls. The heap uses parallel typed
// arrays so zero JS objects are created during pathfinding.
//
// Dynamic updates: hooks into turbo:before-stream-render (same pattern as
// favorites_list_controller) so the route redraws when a booth is marked visited.

const GRID_SIZE = 300
const SEGMENT_COLORS = [
  'rgba(255,80,80,0.9)',
  'rgba(255,180,0,0.9)',
  'rgba(0,160,255,0.9)',
  'rgba(80,200,80,0.9)',
]

export default class extends Controller {
  // coords:     { "A1": { cx: 25.0, cy: 30.0 }, ... }  — center of each booth rect
  // priorities: { "A1": 1, "B2": 2, ... }              — only booths with a priority
  // imageUrl:   URL of the floor plan PNG for pixel analysis
  static values = { coords: Object, priorities: Object, imageUrl: String, walls: Array }
  static targets = ["routeLayer", "generateBtn", "toggleBtn", "coordDisplay"]

  connect() {
    this._generated = false
    this._visible = false
    this._grid = null

    // Coordinate readout: hover over the floor plan to see x/y for defining wall_rects.
    this._coordHandler = (e) => {
      if (!this.hasCoordDisplayTarget) return
      const svg = this.element.querySelector('svg')
      if (!svg) return
      const r = svg.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width * 100).toFixed(1)
      const y = ((e.clientY - r.top)  / r.height * 100).toFixed(1)
      this.coordDisplayTarget.style.display = 'block'
      this.coordDisplayTarget.textContent = `x: ${x}, y: ${y}`
    }
    this.element.addEventListener('mousemove', this._coordHandler)

    this._streamHandler = (event) => {
      const originalRender = event.detail.render
      event.detail.render = (streamElement) => {
        originalRender(streamElement)
        if (this._generated) this._redraw()
      }
    }
    document.addEventListener("turbo:before-stream-render", this._streamHandler)
  }

  disconnect() {
    document.removeEventListener("turbo:before-stream-render", this._streamHandler)
    this.element.removeEventListener('mousemove', this._coordHandler)
  }

  // Wired to the "Suggest Route" button.
  generate() {
    if (this._grid) {
      this._doGenerate()
      return
    }

    this.generateBtnTarget.textContent = "Generating…"
    this.generateBtnTarget.disabled = true

    this._buildGrid().then(() => {
      this.generateBtnTarget.disabled = false
      this._doGenerate()
    })
  }

  _doGenerate() {
    this._generated = true
    this._visible = true
    this._redraw()
    this.routeLayerTarget.style.display = ""
    this.generateBtnTarget.textContent = "Regenerate Route"
    this.toggleBtnTarget.classList.remove("d-none")
    this.toggleBtnTarget.textContent = "Hide Route"
  }

  // Wired to the "Hide/Show Route" button.
  toggle() {
    this._visible = !this._visible
    this.routeLayerTarget.style.display = this._visible ? "" : "none"
    this.toggleBtnTarget.textContent = this._visible ? "Hide Route" : "Show Route"
  }

  // ── Grid Building ──────────────────────────────────────────────────────────

  _buildGrid() {
    // If wall rectangles have been manually defined, use them directly —
    // no image analysis needed. Each rect is { x, y, w, h } in 0–100 space.
    if (this.wallsValue.length > 0) {
      const W = GRID_SIZE, H = GRID_SIZE
      const grid = new Uint8Array(W * H).fill(1)
      for (const { x, y, w, h } of this.wallsValue) {
        const gx0 = Math.max(0, Math.floor(x / 100 * W))
        const gy0 = Math.max(0, Math.floor(y / 100 * H))
        const gx1 = Math.min(W, Math.ceil((x + w) / 100 * W))
        const gy1 = Math.min(H, Math.ceil((y + h) / 100 * H))
        for (let gy = gy0; gy < gy1; gy++)
          for (let gx = gx0; gx < gx1; gx++)
            grid[gy * W + gx] = 0
      }
      this._initGrid(grid)
      return Promise.resolve()
    }

    // Fallback: pixel-analyse the floor plan image.
    return new Promise((resolve) => {
      const imageUrl = this.imageUrlValue
      if (!imageUrl) {
        this._initGrid(new Uint8Array(GRID_SIZE * GRID_SIZE).fill(1))
        resolve()
        return
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = GRID_SIZE; canvas.height = GRID_SIZE
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE)
          const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE)
          const raw = new Uint8Array(GRID_SIZE * GRID_SIZE)
          for (let i = 0; i < raw.length; i++) {
            const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
            raw[i] = (r + g + b >= 240) ? 1 : 0
          }
          this._initGrid(this._dilate(raw, 1))
        } catch (_e) {
          this._initGrid(new Uint8Array(GRID_SIZE * GRID_SIZE).fill(1))
        }
        resolve()
      }
      img.onerror = () => {
        this._initGrid(new Uint8Array(GRID_SIZE * GRID_SIZE).fill(1))
        resolve()
      }
      img.src = imageUrl
    })
  }

  // Returns which hardcoded region a stop belongs to, used to split segments
  // across physically disconnected areas of the venue.
  //   0 = bottom half (第一展示場), 1 = top-left (第二展示場 1階), 2 = top-right (第二展示場 2階)
  _getRegion(cx, cy) {
    if (cy > 50) return 0
    return cx <= 50 ? 1 : 2
  }

  // Store the grid and pre-allocate all A* buffers once so no per-call allocation occurs.
  _initGrid(grid) {
    this._grid = grid
    const N = GRID_SIZE * GRID_SIZE
    // gScore and cameFrom are reset via fill() at the start of each A* call.
    this._gScore   = new Float32Array(N).fill(Infinity)
    this._cameFrom = new Int32Array(N).fill(-1)
    // Heap: parallel typed arrays — heapSize is reset to 0 per call.
    // Worst case capacity: each cell pushed multiple times; N*4 is generous.
    this._heapPri = new Float32Array(N * 4)
    this._heapVal = new Int32Array(N * 4)
  }

  // Expands impassable cells outward by `radius` to create a safety margin.
  _dilate(raw, radius) {
    const W = GRID_SIZE, H = GRID_SIZE
    const out = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let passable = true
        outer: for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              if (!raw[ny * W + nx]) { passable = false; break outer }
            }
          }
        }
        out[y * W + x] = passable ? 1 : 0
      }
    }
    return out
  }

  // ── Route Logic ────────────────────────────────────────────────────────────

  _redraw() {
    const visited = this._getVisitedBoothSpaces()
    const stops = this._computeRoute(visited)
    const segments = this._computePaths(stops)
    this._renderSegments(segments)
    if (!this._visible) this.routeLayerTarget.style.display = "none"
  }

  // Returns a Set of booth_space strings whose visited checkbox is checked.
  _getVisitedBoothSpaces() {
    const visited = new Set()
    document.querySelectorAll("[data-favorites-list-target='card']").forEach(card => {
      const checkbox = card.querySelector("input[id^='visited_favorite_']")
      if (checkbox?.checked) visited.add(card.dataset.boothSpace)
    })
    return visited
  }

  // Nearest-neighbor ordered by (region, priority) so all stops from the same
  // region are always consecutive — no inter-region interleaving regardless of
  // how many priority tiers exist. Returns an ordered array of stops,
  // each { boothSpace, cx, cy }.
  _computeRoute(visitedBoothSpaces) {
    // Build: region → priority → [stops]
    const regionTiers = {}
    for (const [boothSpace, priority] of Object.entries(this.prioritiesValue)) {
      if (!this.coordsValue[boothSpace]) continue
      if (visitedBoothSpaces.has(boothSpace)) continue
      const stop = { boothSpace, ...this.coordsValue[boothSpace] }
      const r = this._getRegion(stop.cx, stop.cy)
      regionTiers[r] ??= {}
      regionTiers[r][priority] ??= []
      regionTiers[r][priority].push(stop)
    }

    const orderedStops = []
    let currentPos = null

    // Outer loop: regions in order → guarantees no inter-region interleaving.
    for (const region of Object.keys(regionTiers).sort((a, b) => a - b)) {
      const tiers = regionTiers[region]
      for (const priority of Object.keys(tiers).sort((a, b) => a - b)) {
        const remaining = [...tiers[priority]]
        while (remaining.length > 0) {
          if (!currentPos) {
            orderedStops.push(remaining.shift())
          } else {
            let nearestIdx = 0
            let nearestDist = Infinity
            remaining.forEach(({ cx, cy }, i) => {
              const d = Math.hypot(cx - currentPos.cx, cy - currentPos.cy)
              if (d < nearestDist) { nearestDist = d; nearestIdx = i }
            })
            orderedStops.push(remaining.splice(nearestIdx, 1)[0])
          }
          currentPos = orderedStops.at(-1)
        }
      }
    }

    return orderedStops
  }

  // Runs A* for each consecutive stop pair. Disconnected areas start new segments.
  _computePaths(orderedStops) {
    if (orderedStops.length < 2) return []

    const segments = []
    let currentStops = [orderedStops[0]]
    let currentPolyline = [{ x: orderedStops[0].cx, y: orderedStops[0].cy }]

    for (let i = 0; i < orderedStops.length - 1; i++) {
      const from = orderedStops[i]
      const to = orderedStops[i + 1]

      const sameRegion = this._getRegion(from.cx, from.cy) === this._getRegion(to.cx, to.cy)

      if (sameRegion) {
        const sx = Math.round(from.cx / 100 * (GRID_SIZE - 1))
        const sy = Math.round(from.cy / 100 * (GRID_SIZE - 1))
        const ex = Math.round(to.cx / 100 * (GRID_SIZE - 1))
        const ey = Math.round(to.cy / 100 * (GRID_SIZE - 1))
        const gridPath = this._astar(sx, sy, ex, ey)
        if (gridPath) {
          const simplified = this._pullString(gridPath)
          simplified.slice(1).forEach(p => {
            currentPolyline.push({ x: p.x / (GRID_SIZE - 1) * 100, y: p.y / (GRID_SIZE - 1) * 100 })
          })
        } else {
          currentPolyline.push({ x: to.cx, y: to.cy })
        }
        currentStops.push(to)
      } else {
        // Unreachable — finalize current segment, start a new one
        if (currentStops.length >= 2) {
          segments.push({ stops: currentStops, polyline: currentPolyline })
        }
        currentStops = [to]
        currentPolyline = [{ x: to.cx, y: to.cy }]
      }
    }

    if (currentStops.length >= 2) {
      segments.push({ stops: currentStops, polyline: currentPolyline })
    }

    return segments
  }

  // ── A* Pathfinding ─────────────────────────────────────────────────────────
  //
  // Uses pre-allocated typed arrays (no per-call allocation):
  //   _gScore / _cameFrom  — reset via fill() at start of each call
  //   _heapPri / _heapVal  — parallel float/int arrays; heapSize reset to 0
  //
  // The inline heap avoids creating any JS objects during pathfinding.

  _astar(sx, sy, ex, ey) {
    const W = GRID_SIZE, H = GRID_SIZE
    const grid     = this._grid
    const gScore   = this._gScore
    const cameFrom = this._cameFrom
    const heapPri  = this._heapPri
    const heapVal  = this._heapVal

    // Reset buffers (fills pre-allocated typed arrays — no allocation)
    gScore.fill(Infinity)
    cameFrom.fill(-1)

    // Snap start/end to nearest passable cell
    ;[sx, sy] = this._nearestPassable(sx, sy)
    ;[ex, ey] = this._nearestPassable(ex, ey)
    if (sx === -1 || ex === -1) return null

    const startIdx = sy * W + sx
    const endIdx   = ey * W + ex
    if (startIdx === endIdx) return [{ x: sx, y: sy }]

    gScore[startIdx] = 0

    // Inline min-heap using typed arrays — push start node
    let heapSize = 0
    heapPri[heapSize] = 0; heapVal[heapSize] = startIdx; heapSize++

    const SQRT2 = Math.SQRT2
    // Direction table: dx, dy, cost (cardinals first, then diagonals)
    const DX   = [ 1, -1,  0,  0,  1, -1,  1, -1]
    const DY   = [ 0,  0,  1, -1,  1,  1, -1, -1]
    const COST = [ 1,  1,  1,  1, SQRT2, SQRT2, SQRT2, SQRT2]

    while (heapSize > 0) {
      // Pop minimum (swap root with last, sift down)
      const idx = heapVal[0]
      heapSize--
      if (heapSize > 0) {
        heapPri[0] = heapPri[heapSize]
        heapVal[0] = heapVal[heapSize]
        let i = 0
        while (true) {
          const l = 2 * i + 1, r = l + 1
          let s = i
          if (l < heapSize && heapPri[l] < heapPri[s]) s = l
          if (r < heapSize && heapPri[r] < heapPri[s]) s = r
          if (s === i) break
          let tp = heapPri[s]; heapPri[s] = heapPri[i]; heapPri[i] = tp
          let tv = heapVal[s]; heapVal[s] = heapVal[i]; heapVal[i] = tv
          i = s
        }
      }

      if (idx === endIdx) return this._reconstructPath(cameFrom, idx, W)

      const x = idx % W, y = (idx / W) | 0
      const g = gScore[idx]

      for (let d = 0; d < 8; d++) {
        const dx = DX[d], dy = DY[d]
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue
        if (!grid[ny * W + nx]) continue
        // Diagonal: skip if either adjacent cardinal is impassable (no corner-cutting)
        if (d >= 4 && (!grid[y * W + (x + dx)] || !grid[(y + dy) * W + x])) continue

        const nIdx = ny * W + nx
        const ng = g + COST[d]
        if (ng < gScore[nIdx]) {
          gScore[nIdx] = ng
          cameFrom[nIdx] = idx
          // Octile-distance heuristic (admissible, consistent)
          const adx = ex > nx ? ex - nx : nx - ex
          const ady = ey > ny ? ey - ny : ny - ey
          const h = (adx > ady ? adx : ady) + (SQRT2 - 1) * (adx < ady ? adx : ady)
          // Push to heap — bubble up
          let i = heapSize
          heapPri[i] = ng + h; heapVal[i] = nIdx; heapSize++
          while (i > 0) {
            const p = (i - 1) >> 1
            if (heapPri[p] <= heapPri[i]) break
            let tp = heapPri[p]; heapPri[p] = heapPri[i]; heapPri[i] = tp
            let tv = heapVal[p]; heapVal[p] = heapVal[i]; heapVal[i] = tv
            i = p
          }
        }
      }
    }

    return null
  }

  _reconstructPath(cameFrom, endIdx, W) {
    const path = []
    let idx = endIdx
    while (idx !== -1) {
      path.push({ x: idx % W, y: (idx / W) | 0 })
      idx = cameFrom[idx]
    }
    return path.reverse()
  }

  // Spiral search for nearest passable cell within radius 20.
  _nearestPassable(x, y) {
    const W = GRID_SIZE, H = GRID_SIZE
    if (x >= 0 && x < W && y >= 0 && y < H && this._grid[y * W + x]) return [x, y]
    for (let r = 1; r <= 20; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < W && ny >= 0 && ny < H && this._grid[ny * W + nx]) return [nx, ny]
        }
      }
    }
    return [-1, -1]
  }

  // ── Path Smoothing ─────────────────────────────────────────────────────────

  // Greedy line-of-sight string pulling. Replaces jagged grid path with
  // clean straight-line segments through open corridors.
  _pullString(path) {
    if (path.length <= 2) return path
    const result = [path[0]]
    let anchor = 0
    while (anchor < path.length - 1) {
      let farthest = anchor + 1
      for (let i = anchor + 2; i < path.length; i++) {
        if (this._linePassable(path[anchor], path[i])) farthest = i
      }
      result.push(path[farthest])
      anchor = farthest
    }
    return result
  }

  // Bresenham line traversal — returns false if any cell along the line is impassable.
  _linePassable(a, b) {
    const W = GRID_SIZE
    let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx - dy

    while (true) {
      if (!this._grid[y0 * W + x0]) return false
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 > -dy) { err -= dy; x0 += sx }
      if (e2 < dx)  { err += dx; y0 += sy }
    }
    return true
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _renderSegments(segments) {
    const layer = this.routeLayerTarget
    while (layer.firstChild) layer.removeChild(layer.firstChild)

    const ns = "http://www.w3.org/2000/svg"

    segments.forEach((seg, segIdx) => {
      const color = SEGMENT_COLORS[segIdx % SEGMENT_COLORS.length]

      // Dashed polyline
      const polyline = document.createElementNS(ns, "polyline")
      polyline.setAttribute("points", seg.polyline.map(p => `${p.x},${p.y}`).join(" "))
      polyline.setAttribute("class", "route-line")
      polyline.style.stroke = color
      layer.appendChild(polyline)

      // Numbered waypoint markers (restart at 1 per segment)
      seg.stops.forEach((stop, i) => {
        const circle = document.createElementNS(ns, "circle")
        circle.setAttribute("cx", stop.cx)
        circle.setAttribute("cy", stop.cy)
        circle.setAttribute("r", "0.8")
        circle.setAttribute("class", "route-waypoint")
        circle.style.fill = color
        layer.appendChild(circle)

        const text = document.createElementNS(ns, "text")
        text.setAttribute("x", stop.cx)
        text.setAttribute("y", stop.cy)
        text.setAttribute("class", "route-waypoint-label")
        text.textContent = i + 1
        layer.appendChild(text)
      })
    })
  }
}
