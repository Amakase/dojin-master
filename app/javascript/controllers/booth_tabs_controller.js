import { Controller } from "@hotwired/stimulus"

// Persists the active tab across page visits using sessionStorage.
export default class extends Controller {
  connect() {
    const saved = sessionStorage.getItem("booth-active-tab")
    if (saved) {
      const tab = this.element.querySelector(`[data-bs-target="${saved}"]`)
      if (tab) bootstrap.Tab.getOrCreateInstance(tab).show()
    }

    this._saveTab = (e) => {
      sessionStorage.setItem("booth-active-tab", e.target.dataset.bsTarget)
    }
    this.element.addEventListener("shown.bs.tab", this._saveTab)
  }

  disconnect() {
    this.element.removeEventListener("shown.bs.tab", this._saveTab)
  }
}
