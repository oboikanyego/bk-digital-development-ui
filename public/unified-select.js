/* Mzansi Digital Ventures reusable dropdown enhancement.
 * Native selects remain the source of truth (name, value, required,
 * validation, form serialization, disabled state and change handlers).
 * Progressive enhancement: when JS is blocked/late the original select works.
 * The richer Project Type picker already handles #projectTypeNative separately.
 */
(() => {
  "use strict";
  if (window.MDVSelects) return;

  const instances = new Map();
  const excluded = select =>
    !select || select.tagName !== "SELECT" || select.multiple ||
    Number(select.getAttribute("size") || 1) > 1 ||
    select.closest("#projectTypeField") || select.matches("[data-native-select]") ||
    select.closest(".mdv-select-dialog");

  let dialog, title, search, list, empty, closeButton, active = null, refreshQueued = false;

  function selectTitle(select) {
    const explicit = select.getAttribute("aria-label");
    if (explicit) return explicit.trim();
    const label = select.labels?.[0] || (select.id ? [...document.querySelectorAll("label[for]")].find(el => el.htmlFor === select.id) : null);
    if (label) {
      const clone = label.cloneNode(true);
      clone.querySelectorAll("select,input,textarea,button").forEach(node => node.remove());
      const value = clone.textContent.replace(/\s+/g, " ").replace(/\*/g, "").trim();
      if (value) return value;
    }
    return select.getAttribute("name") || select.id || "Choose an option";
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "mdv-select-dialog";
    dialog.setAttribute("aria-labelledby", "mdvSelectTitle");
    dialog.setAttribute("aria-modal", "true");
    dialog.innerHTML =
      '<div class="mdv-select-sheet">' +
      '<div class="mdv-select-grabber" aria-hidden="true"></div>' +
      '<div class="mdv-select-heading"><div><p class="mdv-select-kicker">CHOOSE AN OPTION</p><h2 id="mdvSelectTitle"></h2></div>' +
      '<button type="button" class="mdv-select-close" aria-label="Close selection">×</button></div>' +
      '<div class="mdv-select-search-row"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search available options" autocomplete="off" placeholder="Search options…"></div>' +
      '<div class="mdv-select-options" role="listbox" aria-label="Available choices"></div>' +
      '<p class="mdv-select-empty" hidden>No matching options found.</p>' +
      '<div class="mdv-select-footnote">Select an option to continue</div></div>';
    document.body.appendChild(dialog);
    title = dialog.querySelector("#mdvSelectTitle");
    search = dialog.querySelector('input[type="search"]');
    list = dialog.querySelector(".mdv-select-options");
    empty = dialog.querySelector(".mdv-select-empty");
    closeButton = dialog.querySelector(".mdv-select-close");
    closeButton.addEventListener("click", () => dismiss());
    dialog.addEventListener("cancel", event => { event.preventDefault(); dismiss(); });
    dialog.addEventListener("click", event => {
      // Native dialog sends backdrop clicks to the dialog itself.
      if (event.target === dialog) dismiss();
    });
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
      const buttons = [...list.querySelectorAll('button:not([hidden]):not([disabled])')];
      if (!buttons.length) return;
      if (event.target === search && event.key === "ArrowDown") {
        event.preventDefault();
        buttons[0].focus();
        return;
      }
      if (!list.contains(event.target)) return;
      const index = buttons.indexOf(event.target);
      if (index === -1) return;
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
        event.key === "ArrowDown" ? (index + 1) % buttons.length :
        event.key === "ArrowUp" ? (index + buttons.length - 1) % buttons.length : -1;
      if (next >= 0) { event.preventDefault(); buttons[next].focus(); }
    });
    search.addEventListener("input", filterOptions);
    search.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault(); // never submit the parent form
      const first = list.querySelector('button:not([hidden]):not([disabled])');
      if (first) first.click();
    });
  }

  function optionEntries(select) {
    return [...select.options].map((option, index) => ({
      index,
      value: option.value,
      text: option.textContent.trim() || "Untitled option",
      disabled: option.disabled || option.parentElement?.disabled || false,
      hidden: option.hidden
    })).filter(option => !option.hidden);
  }

  function sync(select) {
    const state = instances.get(select);
    if (!state || !select.isConnected) return;
    const option = select.selectedOptions?.[0];
    const label = option?.textContent.trim() || "Select an option";
    state.value.textContent = label;
    state.value.classList.toggle("is-placeholder", !select.value || !option);
    state.button.disabled = select.disabled || optionEntries(select).every(item => item.disabled);
    state.button.setAttribute("aria-label", selectTitle(select) + ": " + label);
    state.button.setAttribute("aria-required", select.required ? "true" : "false");
    state.button.setAttribute("aria-invalid", String(select.required && !select.value && state.invalid));
  }

  function buildOptions(select) {
    list.replaceChildren();
    const entries = optionEntries(select);
    for (const entry of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mdv-select-option";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(select.selectedIndex === entry.index));
      button.dataset.search = entry.text.toLocaleLowerCase();
      button.disabled = Boolean(entry.disabled);
      const copy = document.createElement("span");
      copy.className = "mdv-select-option-text";
      copy.textContent = entry.text;
      const mark = document.createElement("span");
      mark.className = "mdv-select-check";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = "✓";
      button.append(copy, mark);
      button.addEventListener("click", () => {
        if (button.disabled || !select.isConnected) return;
        const changed = select.selectedIndex !== entry.index;
        select.selectedIndex = entry.index;
        const state = instances.get(select);
        if (state) state.invalid = false;
        sync(select);
        dismiss();
        if (changed) {
          // Important: all CRM filters, pricing calculations, email template
          // switches, and CMS editors receive exactly the original events.
          select.dispatchEvent(new Event("input", {bubbles:true}));
          select.dispatchEvent(new Event("change", {bubbles:true}));
        }
      });
      list.appendChild(button);
    }
    empty.hidden = entries.length !== 0;
    search.parentElement.hidden = entries.length < 6;
  }

  function filterOptions() {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    list.querySelectorAll(".mdv-select-option").forEach(button => {
      const match = !query || button.dataset.search.includes(query);
      button.hidden = !match;
      if (match) count++;
    });
    empty.hidden = count !== 0;
  }

  function positionDialog(anchor) {
    const isMobile = matchMedia("(max-width: 700px)").matches;
    dialog.classList.toggle("is-mobile", isMobile);
    if (isMobile) {
      dialog.style.removeProperty("--mdv-select-top");
      dialog.style.removeProperty("--mdv-select-left");
      dialog.style.removeProperty("--mdv-select-width");
      return;
    }
    const r = anchor.getBoundingClientRect();
    const width = Math.min(440, Math.max(300, r.width + 100), innerWidth - 24);
    const left = Math.max(12, Math.min(r.left, innerWidth - width - 12));
    const availableBelow = innerHeight - r.bottom;
    const expectedHeight = Math.min(475, 200 + list.children.length * 52);
    const top = availableBelow >= expectedHeight + 14 ?
      r.bottom + 8 : Math.max(12, Math.min(r.top - expectedHeight - 8, innerHeight - expectedHeight - 12));
    dialog.style.setProperty("--mdv-select-left", left + "px");
    dialog.style.setProperty("--mdv-select-top", top + "px");
    dialog.style.setProperty("--mdv-select-width", width + "px");
  }

  function open(select) {
    const state = instances.get(select);
    if (!state || select.disabled || !select.isConnected) return;
    if (active) dismiss(false);
    ensureDialog();
    sync(select);
    active = select;
    title.textContent = selectTitle(select);
    search.value = "";
    buildOptions(select);
    filterOptions();
    positionDialog(state.button);
    state.button.setAttribute("aria-expanded", "true");
    dialog.showModal();
    // Search provides a consistent starting point on desktop and mobile.
    // For lists with fewer than six choices focus first available option.
    const target = search.parentElement.hidden ?
      list.querySelector('button:not([disabled]):not([hidden])') || closeButton : search;
    target.focus({preventScroll:true});
  }

  function dismiss(restoreFocus = true) {
    if (!active) return;
    const state = instances.get(active);
    if (state) state.button.setAttribute("aria-expanded", "false");
    const focus = state?.button;
    active = null;
    if (dialog.open) dialog.close();
    if (restoreFocus && focus?.isConnected && !focus.disabled) focus.focus({preventScroll:true});
  }

  function enhance(select) {
    if (excluded(select) || instances.has(select)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mdv-select-trigger";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    const value = document.createElement("span");
    value.className = "mdv-select-current";
    const arrow = document.createElement("span");
    arrow.className = "mdv-select-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "⌄";
    button.append(value, arrow);

    const label = select.closest("label");
    if (label && label.contains(select)) {
      // Keep the original <label><select> relationship intact. Put the
      // interactive trigger OUTSIDE that label to avoid nested controls.
      const wrapper = document.createElement("div");
      wrapper.className = "mdv-select-field";
      if (label.classList.contains("span-all")) wrapper.classList.add("span-all");
      label.before(wrapper);
      wrapper.appendChild(label);
      wrapper.appendChild(button);
      label.addEventListener("click", event => {
        if (event.target === select || select.disabled) return;
        event.preventDefault();
        open(select);
      });
    } else {
      select.after(button);
      const externalLabel = select.labels?.[0];
      externalLabel?.addEventListener("click", event => {
        if (select.disabled) return;
        event.preventDefault();
        open(select);
      });
    }
    const state = {button, value, invalid:false};
    instances.set(select,state);
    select.classList.add("mdv-select-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden","true");
    button.addEventListener("click", () => open(select));
    button.addEventListener("keydown", event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        open(select);
      }
    });
    select.addEventListener("input", () => sync(select));
    select.addEventListener("change", () => {state.invalid=false;sync(select);});
    select.addEventListener("invalid", event => {
      if (select.disabled || !select.required) return;
      event.preventDefault();
      state.invalid = true;
      sync(select);
      open(select);
    });
    select.form?.addEventListener("reset", () => {
      if (active === select) dismiss(false);
      setTimeout(() => {state.invalid=false;sync(select);},0);
    });
    sync(select);
  }

  function scan() {
    refreshQueued=false;
    document.querySelectorAll("select").forEach(select => {
      if (!excluded(select)) {
        if (!instances.has(select)) enhance(select);
        else sync(select);
      }
    });
    if (active && !active.isConnected) dismiss(false);
    for (const [select,state] of instances) {
      if (!select.isConnected) instances.delete(select);
      else if (!state.button.isConnected) instances.delete(select);
    }
  }

  function scheduleScan() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(scan);
  }

  function init() {
    ensureDialog();
    scan();
    // CMS and admin dashboards render new select elements after loading data;
    // option lists are also replaced when a customer/template is loaded.
    const observer = new MutationObserver(records => {
      const changed = records.some(record => {
        const target = record.target;
        if (target.nodeType === 1 && target.closest?.(".mdv-select-dialog")) return false;
        if (record.type === "attributes")
          return target.matches?.("select, option, optgroup");
        if (target.matches?.("select,option,optgroup")) return true;
        return [...record.addedNodes].some(node =>
          node.nodeType === 1 && (node.matches?.("select,option,optgroup") || node.querySelector?.("select")));
      });
      if (changed) scheduleScan();
    });
    observer.observe(document.body,{
      subtree:true,childList:true,attributes:true,
      attributeFilter:["disabled","selected","required","hidden"]
    });
    document.addEventListener("pointerdown", event => {
      const trigger = event.target.closest?.(".mdv-select-trigger");
      if (trigger) {
        const match = [...instances].find(([,state]) => state.button === trigger);
        if (match) sync(match[0]);
      }
    }, true);
    window.MDVSelects = {
      refresh: scan,
      covered: () => [...instances.keys()].filter(select => select.isConnected).length
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
