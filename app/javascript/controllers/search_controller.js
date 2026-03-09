import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "form"]

  connect() {
    this._setTime = null
  }

  search() {
    clearTimeout(this._setTime)
    this._setTime = setTimeout(() => this._doSearch(), 300)
  }

  prevent(event) {
    event.preventDefault()
    this._doSearch()
  }

  _doSearch() {
    const url = new URL(this.formTarget.action)
    url.search = new URLSearchParams(new FormData(this.formTarget)).toString()

    history.replaceState({}, "", url.toString())

    fetch(url.toString(), {
      headers: { Accept: "text/vnd.turbo-stream.html" }
    })
      .then(r => r.text())
      .then(html => Turbo.renderStreamMessage(html))
  }
}
