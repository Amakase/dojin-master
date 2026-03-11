import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "input", "editBtn", "editor" ]

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

  openEditor() {
    this.editBtnTarget.classList.add("d-none")
    this.editorTarget.classList.remove("d-none")
    this.inputTarget.focus()
  }

  closeEditor() {
    this.editorTarget.classList.add("d-none")
    this.editBtnTarget.classList.remove("d-none")
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

    this.closeEditor()
  }

  showTick(form) {
    form.appendChild(this.saveTick)

    this.saveTick.classList.add("visible")

    setTimeout(() => {
      this.saveTick.classList.remove("visible")
    }, 800)
  }
}
