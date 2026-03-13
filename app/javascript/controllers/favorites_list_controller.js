import { Controller } from "@hotwired/stimulus"

// Sorts favorite cards in-place after any turbo stream update (priority or visited change).
// Mirrors the server-side order: visited ASC, priority ASC, name_reading ASC.
// When a route is active (route-order:updated), cards are sorted by route path order first.
export default class extends Controller {
  static targets = ["card"]

  connect() {
    history.scrollRestoration = "manual"
    window.scrollTo(0, 0)
    this._routeOrder = null

    this.streamHandler = (event) => {
      const originalRender = event.detail.render
      event.detail.render = (streamElement) => {
        originalRender(streamElement)

        // If a visited-check is pending, suppress the immediate sort —
        // it will run after the dim delay instead.
        if (this.visitedPendingCard) return

        this.sort()

        // If an uncheck just happened, scroll the card into view after sorting.
        if (this.scrollToCard) {
          const card = this.scrollToCard
          this.scrollToCard = null
          requestAnimationFrame(() => {
            card.scrollIntoView({ behavior: "smooth", block: "center" })
            setTimeout(() => {
              card.classList.add("favorite-card--spotlight")
              card.addEventListener("animationend", () => {
                card.classList.remove("favorite-card--spotlight")
              }, { once: true })
            }, 1500)
          })
        }
      }
    }
    document.addEventListener("turbo:before-stream-render", this.streamHandler)

    this._routeOrderHandler = (e) => {
      this._routeOrder = e.detail.boothSpaces.length > 0 ? e.detail.boothSpaces : null
      this.sort()
    }
    this._routeOrderClearedHandler = () => {
      this._routeOrder = null
      this.sort()
    }
    document.addEventListener("route-order:updated", this._routeOrderHandler)
    document.addEventListener("route-order:cleared", this._routeOrderClearedHandler)
  }

  disconnect() {
    history.scrollRestoration = "auto"
    document.removeEventListener("turbo:before-stream-render", this.streamHandler)
    document.removeEventListener("route-order:updated", this._routeOrderHandler)
    document.removeEventListener("route-order:cleared", this._routeOrderClearedHandler)
  }

  visitedChanged(event) {
    const checkbox = event.currentTarget
    const card = checkbox.closest("[data-favorites-list-target='card']")

    checkbox.closest("form").requestSubmit()

    if (checkbox.checked) {
      // Dim the card and delay moving it to the bottom
      card.classList.add("favorite-card--visited-pending")
      this.visitedPendingCard = card

      setTimeout(() => {
        card.classList.remove("favorite-card--visited-pending")
        this.visitedPendingCard = null
        this.sort()
      }, 1500)
    } else {
      // Uncheck: sort immediately (via turbo stream handler) then scroll to card
      this.scrollToCard = card
    }
  }

  sort() {
    const seen = new Set()
    const cards = [...this.element.querySelectorAll("[data-favorites-list-target='card']")]
      .filter(card => {
        if (seen.has(card.id)) { card.remove(); return false }
        seen.add(card.id)
        return true
      })

    if (this._routeOrder) {
      const routeIndex = new Map(this._routeOrder.map((bs, i) => [bs, i]))
      cards.sort((a, b) => {
        const ai = routeIndex.get(a.dataset.boothSpace) ?? Infinity
        const bi = routeIndex.get(b.dataset.boothSpace) ?? Infinity
        if (ai !== bi) return ai - bi
        return this.#normalCompare(a, b)
      })
    } else {
      cards.sort((a, b) => this.#normalCompare(a, b))
    }

    const sentinel = this.element.querySelector("#favorites_load_more")
    const hasMore = sentinel && sentinel.children.length > 0

    cards.forEach(card => {
      // While more pages are pending, hide visited cards so they don't appear
      // ahead of unvisited favorites that haven't loaded yet.
      const isVisited = card.querySelector("input[id^='visited_favorite_']")?.checked
      card.classList.toggle("favorite-card--deferred", hasMore && isVisited)
      this.element.appendChild(card)
    })

    if (sentinel) this.element.appendChild(sentinel)
  }

  #normalCompare(a, b) {
    const aVisited = a.querySelector("input[id^='visited_favorite_']")?.checked ? 1 : 0
    const bVisited = b.querySelector("input[id^='visited_favorite_']")?.checked ? 1 : 0
    if (aVisited !== bVisited) return aVisited - bVisited

    const aPriority = this.#getPriority(a)
    const bPriority = this.#getPriority(b)
    if (aPriority !== bPriority) return aPriority - bPriority

    const aName = a.dataset.nameReading || ""
    const bName = b.dataset.nameReading || ""
    return aName.localeCompare(bName, "ja")
  }

  #getPriority(card) {
    const btn = card.querySelector(".fav-btn")
    if (!btn) return 999
    const match = btn.className.match(/priority-btn-(\d+)/)
    return match ? parseInt(match[1]) : 999
  }
}
