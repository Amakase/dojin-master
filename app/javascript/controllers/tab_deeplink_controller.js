import { Controller } from "@hotwired/stimulus"
import { Tab } from "bootstrap"

// Activates a Bootstrap pill tab matching window.location.hash on page load/navigation.
// Attach data-controller="tab-deeplink" to <body> (application layout) so it runs on every page.
export default class extends Controller {
  connect() {
    this.activateFromHash()
  }

  activateFromHash() {
    const hash = window.location.hash
    if (!hash) return
    const btn = document.querySelector(`[data-bs-toggle="pill"][data-bs-target="${hash}"]`)
    if (!btn) return
    Tab.getOrCreateInstance(btn).show()
  }
}
