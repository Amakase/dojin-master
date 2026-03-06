import { Controller } from "@hotwired/stimulus"

// Retained as an empty shell so data-controller="booth-tabs" on the wrapper
// div does not raise a Stimulus registration error. Tab switching is handled
// natively by Bootstrap 5 via data-bs-toggle="pill". The default active tab
// is determined server-side in show.html.erb based on unread notifications.
export default class extends Controller {}
