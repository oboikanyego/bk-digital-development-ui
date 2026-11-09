const meetingStyle = document.createElement("link");
meetingStyle.rel = "stylesheet";
meetingStyle.href = "/meeting.css";
document.head.appendChild(meetingStyle);
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav-links");
navToggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
nav?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  nav.classList.remove("open");
  navToggle?.setAttribute("aria-expanded", "false");
}));
document.querySelectorAll(".price-tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".price-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".price-panel").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(btn.dataset.priceTarget)?.classList.add("active");
}));
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();
const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");

if (form) {
  // Optional schedule preferences are only shown for meeting requests; submission is not an automatic booking.
  const select = form.elements.namedItem("contactMethod");
  const fields = document.createElement("div");
  fields.id = "meetingPreferences";
  fields.className = "meeting-preferences";
  fields.hidden = true;
  fields.innerHTML =
    '<p class="meeting-help">Suggest a date and time for an introductory call (South African time). We will confirm availability by email.</p>' +
    '<div class="form-grid">' +
    '<label>Preferred meeting date<input type="date" name="meetingDate"></label>' +
    '<label>Preferred time (SAST)<input type="time" name="meetingTime"></label>' +
    '</div>';
  const grid = form.querySelector(".form-grid");
  if (grid && select) {
    grid.after(fields);
    const date = fields.querySelector('input[name="meetingDate"]');
    date.min = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    const update = () => {
      const meeting = select.value === "Meeting request";
      fields.hidden = !meeting;
      if (!meeting) fields.querySelectorAll("input").forEach(input => { input.value = ""; });
    };
    select.addEventListener("change", update);
    update();
  }
}
form?.addEventListener("submit", async event => {
  event.preventDefault();
  status.className = "form-status";
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  const buttonLabel = button?.querySelector("span:first-child");
  if (button) button.disabled = true;
  if (buttonLabel) buttonLabel.textContent = "Submitting…";
  status.textContent = "Saving your enquiry securely…";
  const data = Object.fromEntries(new FormData(form).entries());
  data.consent = Boolean(new FormData(form).get("consent"));
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "We could not save your enquiry right now.");
    form.reset();
    const preferences = document.getElementById("meetingPreferences");
    if (preferences) preferences.hidden = true;
    status.className = "form-status success";
    status.textContent = result.notification === "sent"
      ? "Thank you! Your enquiry is saved and I've been notified. I'll respond soon."
      : "Thank you! Your enquiry was saved successfully. I'll follow up soon.";
  } catch (error) {
    status.className = "form-status error";
    status.textContent = error.message || "Your enquiry could not be saved. Please contact me by email or WhatsApp.";
  } finally {
    if (button) button.disabled = false;
    if (buttonLabel) buttonLabel.textContent = "Send enquiry";
  }
});
