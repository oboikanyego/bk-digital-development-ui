/* Accessible project selection: desktop searchable popover, mobile bottom sheet.
 * Native <select> remains the single source of truth for form validation and
 * FormData. Without JavaScript the browser's select remains fully functional. */
(() => {
  "use strict";
  const form = document.getElementById("contactForm");
  const field = document.getElementById("projectTypeField");
  const native = document.getElementById("projectTypeNative");
  const trigger = document.getElementById("projectTypeTrigger");
  const selected = document.getElementById("projectTypeSelected");
  const leading = field?.querySelector(".project-picker-leading");
  const panel = document.getElementById("projectTypePanel");
  const backdrop = document.getElementById("projectTypeBackdrop");
  const search = document.getElementById("projectTypeSearch");
  const options = document.getElementById("projectTypeOptions");
  const empty = document.getElementById("projectTypeEmpty");
  const close = document.getElementById("projectTypeClose");
  const label = document.getElementById("projectTypeLabel");
  const error = document.getElementById("projectTypeError");
  if (![form, field, native, trigger, selected, leading, panel, backdrop, search, options, empty, close, label, error].every(Boolean)) return;

  const details = {
    "Starter website": ["🌐", "A clean and affordable online presence"],
    "Business website": ["💻", "A professional site that builds trust"],
    "Booking website/system": ["📅", "Let customers book your services"],
    "Online store": ["🛒", "Sell your products and accept payments"],
    "Mobile app": ["📱", "Build for Android and iOS"],
    "Hosting and domain setup": ["☁", "Get your website online reliably"],
    "Website maintenance": ["🛠", "Keep your existing website running smoothly"],
    "Database or API integration": ["🔗", "Connect platforms, data and services"],
    "Custom business system": ["⚙", "Automate and manage your operations"],
    "Existing site improvements": ["✨", "Upgrade design, speed or functionality"],
    "Not sure yet": ["💡", "Tell us your idea and we'll guide you"]
  };
  const entries = [...native.options].filter(option => option.value).map(option => ({
    value: option.value,
    title: option.textContent.trim(),
    icon: details[option.value]?.[0] || "◇",
    description: details[option.value]?.[1] || "Let's discuss your project"
  }));
  if (!entries.length) return;
  const items = [];
  const mobile = () => window.matchMedia("(max-width: 700px)").matches;
  let isOpen = false;

  for (const entry of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-picker-option";
    button.setAttribute("role", "option");
    button.dataset.value = entry.value;
    button.setAttribute("aria-selected", "false");
    const icon = document.createElement("span");
    icon.className = "project-picker-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = entry.icon;
    const copy = document.createElement("span");
    copy.className = "project-picker-copy";
    const title = document.createElement("strong");
    title.textContent = entry.title;
    const description = document.createElement("small");
    description.textContent = entry.description;
    copy.append(title, description);
    const check = document.createElement("span");
    check.className = "project-picker-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    button.append(icon, copy, check);
    button.addEventListener("click", () => selectValue(entry.value));
    options.appendChild(button);
    items.push(button);
  }

  function sync() {
    const value = native.value;
    const match = entries.find(entry => entry.value === value);
    selected.textContent = match ? match.title : "Select a project type";
    selected.classList.toggle("project-picker-placeholder", !match);
    leading.textContent = match ? match.icon : "⌘";
    for (const button of items) button.setAttribute("aria-selected", String(button.dataset.value === value));
    if (value) {
      error.hidden = true;
      trigger.removeAttribute("aria-invalid");
    }
  }

  function visibleOptions() {
    return items.filter(item => !item.hidden);
  }

  function filterOptions() {
    const term = search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const button of items) {
      const entry = entries.find(entry => entry.value === button.dataset.value);
      const found = !term || (entry.title + " " + entry.description).toLocaleLowerCase().includes(term);
      button.hidden = !found;
      if (found) count++;
    }
    empty.hidden = count !== 0;
  }

  function openPicker() {
    if (isOpen) return;
    isOpen = true;
    search.value = "";
    filterOptions();
    const useSheet = mobile();
    panel.hidden = false;
    backdrop.hidden = !useSheet;
    panel.setAttribute("aria-modal", String(useSheet));
    document.body.classList.toggle("project-picker-dialog-open", useSheet);
    trigger.setAttribute("aria-expanded", "true");
    field.classList.add("is-open");
    search.focus({preventScroll: true});
  }

  function closePicker({returnFocus = true} = {}) {
    if (!isOpen) return;
    isOpen = false;
    panel.hidden = true;
    backdrop.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("project-picker-dialog-open");
    field.classList.remove("is-open");
    if (returnFocus) trigger.focus({preventScroll: true});
  }

  function selectValue(value) {
    native.value = value;
    native.dispatchEvent(new Event("input", {bubbles: true}));
    native.dispatchEvent(new Event("change", {bubbles: true}));
    sync();
    closePicker();
  }

  trigger.addEventListener("click", () => isOpen ? closePicker() : openPicker());
  label.addEventListener("click", event => {
    if (!field.classList.contains("is-enhanced")) return;
    event.preventDefault();
    openPicker();
  });
  close.addEventListener("click", () => closePicker());
  backdrop.addEventListener("click", () => closePicker());
  native.addEventListener("change", sync);
  search.addEventListener("input", filterOptions);
  search.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      visibleOptions()[0]?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault(); // Enter must never accidentally submit the enquiry form.
      const first = visibleOptions()[0];
      if (first) selectValue(first.dataset.value);
    }
  });
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
      return;
    }
    if (event.key === "Tab" && mobile()) {
      const focusable = [close, search, ...visibleOptions()];
      const current = focusable.indexOf(document.activeElement);
      if (event.shiftKey && current === 0) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && current === focusable.length - 1) {
        event.preventDefault();
        focusable[0].focus();
      }
    }
    if (event.target.getAttribute("role") !== "option") return;
    const visible = visibleOptions();
    const index = visible.indexOf(event.target);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 :
        (index + (event.key === "ArrowDown" ? 1 : -1) + visible.length) % visible.length;
      visible[next]?.focus();
    }
  });
  document.addEventListener("pointerdown", event => {
    if (isOpen && !mobile() && !field.contains(event.target)) closePicker({returnFocus: false});
  });
  document.addEventListener("keydown", event => {
    if (isOpen && event.key === "Escape") {
      event.preventDefault();
      closePicker();
    }
  });
  window.addEventListener("resize", () => {
    if (!isOpen) return;
    const useSheet = mobile();
    panel.setAttribute("aria-modal", String(useSheet));
    backdrop.hidden = !useSheet;
    document.body.classList.toggle("project-picker-dialog-open", useSheet);
  });

  // The existing form uses novalidate and reportValidity() inside app.js. This
  // capture listener runs first, opens our picker and keeps the POST untouched.
  form.addEventListener("submit", event => {
    if (native.value) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    error.hidden = false;
    trigger.setAttribute("aria-invalid", "true");
    openPicker();
  }, true);
  form.addEventListener("reset", () => {
    closePicker({returnFocus: false});
    Promise.resolve().then(sync);
  });

  // Progressive enhancement: native select is visible until the picker is
  // fully populated and wired. Its name/value/required status never changes.
  sync();
  trigger.hidden = false;
  field.classList.add("is-enhanced");
})();
