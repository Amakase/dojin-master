import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "input" ]

  connect() {
    this.saveTick = document.createElement("div")
    this.saveTick.textContent = "✓"
    this.saveTick.classList.add("save-tick")
  }

  autoSaveType(event) {
    const input = event.currentTarget
    const form = input.closest("form")

    this.timeOut && clearTimeout(this.timeOut);

    this.timeOut = setTimeout(() => {
      console.log(form);
      form.requestSubmit();
      this.showTick(form)
    }, 1500);
  }

  autoSaveBlur(event) {
    const input = event.currentTarget
    const form = input.closest("form")

    if (this.timeOut) {
      console.log(form);
      clearTimeout(this.timeOut);
      form.requestSubmit();
      this.showTick(form);
    }
  }

  showTick(form) {
    form.appendChild(this.saveTick)

    this.saveTick.classList.add("visible")

    setTimeout(() => {
      this.saveTick.classList.remove("visible")
    }, 800)
  }
}
