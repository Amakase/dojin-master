import { Controller } from "@hotwired/stimulus"
import { Turbo } from "@hotwired/turbo-rails"

export default class extends Controller {
  static values = {
    url: String,
  }

  connect() {
    if (!this.hasUrlValue) return

    this.loading = false
    this.observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        this.loadNextPage()
      },
      { rootMargin: "0px 0px 320px 0px" }
    )

    this.observer.observe(this.element)
  }

  disconnect() {
    this.observer?.disconnect()
  }

  async loadNextPage() {
    if (this.loading || !this.hasUrlValue) return

    this.loading = true
    this.observer?.disconnect()

    const response = await fetch(this.urlValue, {
      headers: {
        Accept: "text/vnd.turbo-stream.html, text/html, application/xhtml+xml",
      },
      credentials: "same-origin",
    })

    if (!response.ok) {
      this.loading = false
      this.observer?.observe(this.element)
      return
    }

    Turbo.renderStreamMessage(await response.text())
  }
}
