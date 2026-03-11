import { Controller } from "@hotwired/stimulus"

// Triggers a Turbo page reload when this controller connects.
// Used by the AI placement status partial: when the job broadcasts "done",
// the Turbo Stream replaces the status span with the "done" version which
// carries this controller — causing the map editor to reload and render
// all AI-placed rects onto the canvas before the admin can hit Save All.
export default class extends Controller {
  connect() {
    const key = `ai_reloaded_${window.location.pathname}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
    Turbo.visit(window.location.href, { action: "replace" })
  }
}
