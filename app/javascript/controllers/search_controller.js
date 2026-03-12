import { Controller } from "@hotwired/stimulus"
import { Turbo } from "@hotwired/turbo-rails"

export default class extends Controller {
  static targets = ["input", "form"]

  connect() {
    this._setTime = null
    this.abortController = null
    this.lastParams = null
  }

  disconnect() {
    clearTimeout(this._setTime)
    this.abortController?.abort()
  }

  search() {
    clearTimeout(this._setTime)
    this._setTime = setTimeout(() => this._doSearch(), 450)
  }

  prevent(event) {
    event.preventDefault()
    this._doSearch()
  }

  _doSearch() {
    const formData = new FormData(this.formTarget)
    const query = (formData.get("query") || "").toString().trim()

    if (query.length === 1) return

    const params = new URLSearchParams(formData).toString()
    if (this.lastParams === params) return

    this.lastParams = params

    const url = new URL(this.formTarget.action)
    url.search = params

    history.replaceState({}, "", url.toString())

    this.abortController?.abort()
    this.abortController = new AbortController()

    fetch(url.toString(), {
      headers: { Accept: "text/vnd.turbo-stream.html" },
      credentials: "same-origin",
      signal: this.abortController.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Search request failed with status ${response.status}`)

        return response.text()
      })
      .then(html => Turbo.renderStreamMessage(html))
      .catch((error) => {
        if (error.name === "AbortError") return

        // Keep the page responsive even if a transient request fails.
        console.error(error)
      })
  }
}
