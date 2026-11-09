const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav-links");
function closeNavigation() {
  if (!navToggle || !nav) return;
  nav.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open navigation");
}
navToggle?.addEventListener("click", () => {
  const open = nav?.classList.toggle("open") || false;
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
});
nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", closeNavigation));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeNavigation();
});
document.addEventListener("pointerdown", event => {
  if (nav?.classList.contains("open") && !event.target.closest(".nav-wrap")) closeNavigation();
});

document.querySelectorAll(".price-tab").forEach(button => button.setAttribute("aria-pressed", String(button.classList.contains("active"))));
document.querySelectorAll(".price-tab").forEach(tab => tab.addEventListener("click", () => {
  document.querySelectorAll(".price-tab").forEach(button => {
    const active = button === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll(".price-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === tab.dataset.priceTarget);
  });
}));

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());

// Small, single-use entrance transitions for content below the fold. No moving
// content is hidden when JavaScript is disabled or reduced motion is requested.
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const targets = document.querySelectorAll(".offering-card,.case-card,.method-steps>div,.service-card,.work-card,.mission-grid article,.price-card");
  const observer = new IntersectionObserver((entries, observerInstance) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove("reveal-hidden");
      entry.target.classList.add("reveal-visible");
      observerInstance.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: "0px 0px -25px 0px" });
  targets.forEach(el => {
    if (el.getBoundingClientRect().top > window.innerHeight - 10) {
      el.classList.add("reveal-hidden");
      observer.observe(el);
    }
  });
}

const form = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");

function tomorrowInJohannesburg() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const component = type => parts.find(part => part.type === type).value;
  return component("year") + "-" + component("month") + "-" + component("day");
}
if (form) {
  const method = form.elements.namedItem("contactMethod");
  const preferences = document.createElement("div");
  preferences.id = "meetingPreferences";
  preferences.className = "meeting-preferences";
  preferences.hidden = true;
  preferences.innerHTML =
    '<p class="meeting-help">Suggest a suitable time for an introductory call (South African time). We will confirm availability by email.</p>' +
    '<div class="form-grid"><label>Preferred date<input type="date" name="meetingDate"></label>' +
    '<label>Preferred time (SAST)<input type="time" name="meetingTime"></label></div>';
  const grid = form.querySelector(".form-grid");
  if (grid && method) {
    grid.after(preferences);
    preferences.querySelector('input[name="meetingDate"]').min = tomorrowInJohannesburg();
    const updatePreferences = () => {
      const isMeeting = method.value === "Meeting request";
      preferences.hidden = !isMeeting;
      if (!isMeeting) preferences.querySelectorAll("input").forEach(input => { input.value = ""; });
    };
    method.addEventListener("change", updatePreferences);
    updatePreferences();
  }
}
let submitting = false;
form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  submitting = true;
  const button = form.querySelector('button[type="submit"]');
  const label = button?.querySelector("span:first-child");
  if (button) { button.disabled = true; button.classList.add("is-loading"); }
  if (label) label.textContent = "Connecting…";
  formStatus.className = "form-status";
  formStatus.textContent = "Checking our enquiry service…";
  try {
    if (window.MDVService) await window.MDVService.ensureReady();
    if (label) label.textContent = "Sending…";
    formStatus.textContent = "Submitting your enquiry securely…";
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = Boolean(new FormData(form).get("consent"));
    // Submissions are sent only once. Retrying POST requests can create duplicate leads.
    const response = await fetch("/api/contact", {
      method: "POST", headers: { "content-type": "application/json" },
      credentials: "same-origin", body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "We couldn't confirm your enquiry was saved. Please try again.");
    form.reset();
    const preferences = document.getElementById("meetingPreferences");
    if (preferences) preferences.hidden = true;
    formStatus.className = "form-status success";
    formStatus.textContent = result.notification === "sent"
      ? "Thank you. Your enquiry has been saved and our team has been notified."
      : "Thank you. Your enquiry has been saved. Our team will follow up.";
  } catch (error) {
    formStatus.className = "form-status error";
    formStatus.textContent = error.message || "We couldn't submit your enquiry right now. You can also reach us by email or WhatsApp.";
  } finally {
    submitting = false;
    if (button) { button.disabled = false; button.classList.remove("is-loading"); }
    if (label) label.textContent = "Send enquiry";
  }
});
