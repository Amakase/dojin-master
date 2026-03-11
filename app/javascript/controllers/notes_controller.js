import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "input", "editBtn", "editor" ]

  connect() {
    this.saveTick = document.createElement("div")
    this.saveTick.textContent = "✓"
    this.saveTick.classList.add("save-tick")
  }

  autoResize(textarea) {
    textarea.style.height = "auto"
    textarea.style.height = textarea.scrollHeight + "px"
  }

  autoSaveType(event) {
    const input = event.currentTarget
    const form = input.closest("form")

    this.autoResize(input)
    this.timeOut && clearTimeout(this.timeOut);

    this.timeOut = setTimeout(() => {
      // console.log(form);
      form.requestSubmit();
      this.showTick(form)
    }, 1500);
  }

  openEditor() {
    this.editBtnTarget.classList.add("d-none")
    this.editorTarget.classList.remove("d-none")
    this.autoResize(this.inputTarget)
    this.inputTarget.focus()
  }

  closeEditor() {
    this.editorTarget.classList.add("d-none")
    this.editBtnTarget.classList.remove("d-none")
    this.updatePreview()
  }

  updatePreview() {
    const value = this.inputTarget.value.trim()
    const span = this.editBtnTarget.querySelector(".favorite-notes-preview, .favorite-notes-placeholder")
    if (!span) return

    if (value) {
      span.className = "favorite-notes-preview"
      span.textContent = value.length > 50 ? value.slice(0, 47) + "..." : value
    } else {
      span.className = "favorite-notes-placeholder"
      span.textContent = "Add notes..."
    }
  }

  autoSaveBlur(event) {
    const input = event.currentTarget
    const form = input.closest("form")

    if (this.timeOut) {
      // console.log(form);
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
