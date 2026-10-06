/*
  combo.js — a custom searchable dropdown ("combobox"), used everywhere the
  site needs a select-like field. Built from scratch instead of a native
  <select> because a native select's open list is styled by the browser,
  not by our CSS — this version is fully ours: colors, hover states, and
  type-to-filter all match the rest of the site.

  Usage:
    const combo = new SearchableSelect(document.getElementById("container"), {
      placeholder: "Select level",
      onChange: (value) => { ... }
    });
    combo.setOptions([{ value: "100", label: "100 Level" }, ...]);
    combo.getValue();       // currently selected value, or "" if none
    combo.disable("text");  // grey out with a placeholder message
    combo.enable();
*/

class SearchableSelect {
  constructor(container, { placeholder = "Select...", onChange = () => {} } = {}) {
    this.container = container;
    this.onChange = onChange;
    this.options = [];
    this.value = "";

    container.classList.add("combo");
    container.innerHTML = `
      <input type="text" class="combo-input" placeholder="${placeholder}" autocomplete="off" readonly>
      <span class="combo-arrow">
        <svg width="12" height="8" viewBox="0 0 14 9" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L7 7L13 1" stroke="#0D9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <div class="combo-list"></div>
    `;

    this.input = container.querySelector(".combo-input");
    this.list = container.querySelector(".combo-list");
    this.defaultPlaceholder = placeholder;

    // becomes typeable once options exist — see setOptions()
    this.input.addEventListener("focus", () => { if (!this.input.disabled) this.open(); });
    this.input.addEventListener("input", () => {
      this.value = "";
      this.renderList(this._filtered(this.input.value));
      this.open();
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { this.close(); this.input.blur(); }
    });

    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) this.close();
    });
  }

  _filtered(query) {
    const q = query.trim().toLowerCase();
    if (!q) return this.options;
    return this.options.filter(o => o.label.toLowerCase().includes(q));
  }

  setOptions(options) {
    this.options = options;
    this.value = "";
    this.input.value = "";
    this.input.readOnly = options.length === 0;
    this.input.placeholder = options.length === 0 ? "No options available" : this.defaultPlaceholder;
  }

  renderList(items) {
    if (items.length === 0) {
      this.list.innerHTML = `<div class="combo-empty">No matches</div>`;
      return;
    }
    this.list.innerHTML = items.map(o =>
      `<div class="combo-option" data-value="${String(o.value).replace(/"/g, "&quot;")}">${o.label}</div>`
    ).join("");
    this.list.querySelectorAll(".combo-option").forEach(el => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus so blur doesn't close before click registers
        this.select(el.dataset.value, el.textContent);
      });
    });
  }

  select(value, label) {
    this.value = value;
    this.input.value = label;
    this.close();
    this.onChange(value);
  }

  open() {
    if (this.options.length === 0) return;
    this.renderList(this._filtered(this.input.value));
    this.list.classList.add("open");
  }

  close() {
    this.list.classList.remove("open");
  }

  getValue() { return this.value; }

  reset() {
    this.value = "";
    this.input.value = "";
  }

  disable(message) {
    this.input.disabled = true;
    this.input.value = "";
    this.input.placeholder = message || "Not available";
    this.close();
  }

  enable() {
    this.input.disabled = false;
    this.input.placeholder = this.options.length === 0 ? "No options available" : this.defaultPlaceholder;
  }
}