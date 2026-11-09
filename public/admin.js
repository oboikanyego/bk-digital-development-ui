let adminKey = "";
let page = 1;
let total = 0;
let leadCache = [];
let currentLeadId = "";
const byId = id => document.getElementById(id);
const escapeText = value => String(value ?? "").replace(/[&<>"']/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]));
const formatDate = value => value ? new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }) : "Not set";
const message = (text, error = false) => {
  const el = byId("dashboardStatus");
  el.textContent = text;
  el.className = error ? "message error" : "message";
};
async function call(path, options = {}) {
  const response = await fetch("/api/admin" + path, {
    ...options,
    headers: { "content-type": "application/json", Authorization: "Bearer " + adminKey, ...options.headers }
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 503 && /Admin access/.test(result.message || "")) {
    lock();
    throw new Error(result.message || "Your admin session ended.");
  }
  if (!response.ok) throw new Error(result.message || "Unable to load information.");
  return result;
}
function lock() {
  adminKey = "";
  byId("accessKey").value = "";
  byId("dashboard").hidden = true;
  byId("loginPanel").hidden = false;
  byId("logout").hidden = true;
  if (byId("leadDialog").open) byId("leadDialog").close();
}
async function refreshStats() {
  const data = await call("/stats");
  byId("statAll").textContent = data.enquiries ?? 0;
  byId("statNew").textContent = data.newEnquiries ?? 0;
  byId("statMeetings").textContent = data.requestedMeetings ?? 0;
  byId("statConverted").textContent = data.converted ?? 0;
}
async function loadEnquiries() {
  const search = byId("search").value.trim();
  const status = byId("statusFilter").value;
  const query = new URLSearchParams({ page: String(page), search, status });
  const result = await call("/enquiries?" + query);
  leadCache = result.items || [];
  total = result.total || 0;
  const rows = byId("enquiryRows");
  rows.innerHTML = leadCache.length ? leadCache.map(item =>
    "<tr><td><span class='client-name'>" + escapeText(item.name) + "</span><span class='client-sub'>" + escapeText(item.businessName || item.email) +
    "</span></td><td>" + escapeText(item.projectType) + "</td><td>" + escapeText(formatDate(item.createdAt)) +
    "</td><td><span class='pill " + escapeText(item.status) + "'>" + escapeText(item.status) +
    "</span></td><td><button class='row-action' data-id='" + escapeText(item._id) + "'>View & edit</button></td></tr>"
  ).join("") : "<tr><td colspan='5'>No enquiries match your filters yet.</td></tr>";
  byId("pageInfo").textContent = total + " enquiries · Page " + page;
  byId("prevPage").disabled = page <= 1;
  byId("nextPage").disabled = page * 25 >= total;
  rows.querySelectorAll("[data-id]").forEach(btn => btn.addEventListener("click", () => showLead(btn.dataset.id)));
}
async function loadMeetings() {
  const result = await call("/meetings");
  const meetings = result.items || [];
  byId("meetingRows").innerHTML = meetings.length ? meetings.map(item =>
    "<tr><td><span class='client-name'>" + escapeText(item.name) + "</span><span class='client-sub'>" + escapeText(item.businessName || item.email) +
    "</span></td><td>" + escapeText(item.meetingDate || "Flexible") + " " + escapeText(item.meetingTime || "") +
    "</td><td><a href='mailto:" + encodeURIComponent(item.email || "") + "'>" + escapeText(item.email) +
    "</a></td><td><select class='meeting-status' data-id='" + escapeText(item._id) + "' aria-label='Meeting status'>" +
    ["requested", "confirmed", "completed", "cancelled"].map(status =>
      "<option value='" + status + "'" + (item.status === status ? " selected" : "") + ">" + status + "</option>"
    ).join("") + "</select></td></tr>"
  ).join("") : "<tr><td colspan='4'>No meeting requests yet.</td></tr>";
  byId("meetingRows").querySelectorAll("select").forEach(select => select.addEventListener("change", async () => {
    try {
      select.disabled = true;
      await call("/meetings/" + encodeURIComponent(select.dataset.id), { method: "PATCH", body: JSON.stringify({ status: select.value }) });
      await refreshStats();
      message("Meeting status updated.");
    } catch (error) {
      message(error.message, true);
      await loadMeetings().catch(() => {});
    } finally { select.disabled = false; }
  }));
}
function showLead(id) {
  const lead = leadCache.find(item => item._id === id);
  if (!lead) return;
  currentLeadId = id;
  byId("leadTitle").textContent = lead.name || "Enquiry";
  const fields = [
    ["Email", lead.email], ["Phone", lead.phone], ["Business", lead.businessName],
    ["Service", lead.projectType], ["Budget", lead.budget], ["Contact method", lead.contactMethod],
    ["Timeline", lead.timeline], ["Submitted", formatDate(lead.createdAt)],
    ["Email notification", lead.emailStatus], ["Project details", lead.message]
  ];
  byId("leadDetails").innerHTML = fields.map(([name, value]) =>
    "<div" + (name === "Project details" ? " class='wide'" : "") + "><dt>" +
    escapeText(name) + "</dt><dd>" + escapeText(value || "—") + "</dd></div>"
  ).join("");
  byId("leadStatus").value = lead.status || "new";
  byId("leadNotes").value = lead.internalNotes || "";
  byId("leadDialog").showModal();
}
async function refreshAll() {
  await Promise.all([refreshStats(), loadEnquiries(), loadMeetings()]);
  message("Information updated.");
}
byId("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  adminKey = byId("accessKey").value.trim();
  byId("loginError").textContent = "";
  try {
    await call("/stats");
    byId("loginPanel").hidden = true;
    byId("dashboard").hidden = false;
    byId("logout").hidden = false;
    byId("accessKey").value = "";
    await refreshAll();
  } catch (error) {
    byId("loginError").textContent = error.message;
  }
});
byId("logout").addEventListener("click", lock);
byId("refresh").addEventListener("click", () => refreshAll().catch(error => message(error.message, true)));
byId("searchButton").addEventListener("click", () => { page = 1; loadEnquiries().catch(error => message(error.message, true)); });
byId("search").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); byId("searchButton").click(); }
});
byId("statusFilter").addEventListener("change", () => byId("searchButton").click());
byId("prevPage").addEventListener("click", () => { page--; loadEnquiries().catch(error => message(error.message, true)); });
byId("nextPage").addEventListener("click", () => { page++; loadEnquiries().catch(error => message(error.message, true)); });
function setTab(meetings) {
  byId("enquiriesPanel").hidden = meetings;
  byId("meetingsPanel").hidden = !meetings;
  byId("tabMeetings").classList.toggle("active", meetings);
  byId("tabEnquiries").classList.toggle("active", !meetings);
  byId("tabMeetings").setAttribute("aria-selected", String(meetings));
  byId("tabEnquiries").setAttribute("aria-selected", String(!meetings));
}
byId("tabEnquiries").addEventListener("click", () => setTab(false));
byId("tabMeetings").addEventListener("click", () => setTab(true));
byId("closeDialog").addEventListener("click", () => byId("leadDialog").close());
byId("cancelDialog").addEventListener("click", () => byId("leadDialog").close());
byId("leadForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await call("/enquiries/" + encodeURIComponent(currentLeadId), {
      method: "PATCH",
      body: JSON.stringify({ status: byId("leadStatus").value, internalNotes: byId("leadNotes").value })
    });
    byId("leadDialog").close();
    await Promise.all([loadEnquiries(), refreshStats()]);
    message("Lead updated successfully.");
  } catch (error) {
    message(error.message, true);
  }
});
