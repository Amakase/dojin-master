import { Controller } from "@hotwired/stimulus"

// Sorts favorite cards in-place after any turbo stream update (priority or visited change).
// Mirrors the server-side order: visited ASC, priority ASC, name_reading ASC.
export default class extends Controller {
  static targets = ["card"]

  connect() {
    history.scrollRestoration = "manual"
    window.scrollTo(0, 0)

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
          })
        }
      }
    }
    document.addEventListener("turbo:before-stream-render", this.streamHandler)
  }

  disconnect() {
    history.scrollRestoration = "auto"
    document.removeEventListener("turbo:before-stream-render", this.streamHandler)
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
    const cards = [...this.cardTargets]

    cards.sort((a, b) => {
      const aVisited = a.querySelector("input[id^='visited_favorite_']")?.checked ? 1 : 0
      const bVisited = b.querySelector("input[id^='visited_favorite_']")?.checked ? 1 : 0
      if (aVisited !== bVisited) return aVisited - bVisited

      const aPriority = this.#getPriority(a)
      const bPriority = this.#getPriority(b)
      if (aPriority !== bPriority) return aPriority - bPriority

      const aName = a.dataset.nameReading || ""
      const bName = b.dataset.nameReading || ""
      return aName.localeCompare(bName, "ja")
    })

    cards.forEach(card => this.element.appendChild(card))

    const sentinel = this.element.querySelector("#favorites_load_more")
    if (sentinel) this.element.appendChild(sentinel)
  }

  #getPriority(card) {
    const btn = card.querySelector(".fav-btn")
    if (!btn) return 999
    const match = btn.className.match(/priority-btn-(\d+)/)
    return match ? parseInt(match[1]) : 999
  }
}
