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
  if (window.MDVService) await window.MDVService.ensureReady();
  const response = await fetch("/api/admin" + path, {
    ...options,
    credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json", ...options.headers }
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) {
    location.replace("/admin/login/");
    throw new Error("Session expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(result.message || "Unable to load information.");
  return result;
}
async function refreshEmailConfig() {
  const banner = byId("emailAlertStatus");
  try {
    const result = await call("/email/config");
    banner.hidden = false;
    banner.dataset.configured = String(result.configured);
    if (result.configured) {
      banner.textContent = result.sandboxSender
        ? "Email sending uses Resend's test-only onboarding address. Messages may reach your account inbox, but customer acknowledgements to other addresses need a verified business domain."
        : "Email notifications are configured. Delivery status is confirmed through signed Resend webhooks.";
      if (result.sandboxSender) banner.dataset.configured = "false";
    } else {
      banner.textContent = "Email notifications are not configured on Render. Missing: " +
        (result.missing || []).join(", ") + ". Saved enquiries can be retried after these settings are fixed.";
    }
  } catch (error) {
    banner.hidden = false;
    banner.dataset.configured = "false";
    banner.textContent = "Could not check the email notification configuration: " + error.message;
  }
}
async function refreshStats() {
  const [data,crm]=await Promise.all([call("/stats"),call("/crm/metrics")]);
  byId("statAll").textContent=data.enquiries??0;
  byId("statNew").textContent=data.newEnquiries??0;
  byId("statMeetings").textContent=data.requestedMeetings??0;
  byId("statConverted").textContent=data.converted??0;
  byId("statClients").textContent=crm.clients??0;
  byId("statFollowUps").textContent=crm.dueFollowUps??0;
}
const emailKindLabel = k => ({
 enquiry_notification:"Admin enquiry alert",
 customer_acknowledgement:"Customer acknowledgement",
 meeting_request_notification:"Meeting request"
}[k]||k);
async function loadEmailDeliveries(){
  const response=await call("/email/deliveries");
  const summary=response.summary||[],items=response.items||[];
  const statuses=["queued","retrying","sent","delivered","bounced","failed","suppressed","needs_review"];
  const totals=Object.fromEntries(statuses.map(status=>[status,summary.filter(x=>x.status===status).reduce((n,x)=>n+x.count,0)]));
  byId("deliveryMetrics").innerHTML=statuses.map(status=>
    "<div class='delivery-metric'><span>"+escapeText(status.replace("_"," "))+
    "</span><strong>"+totals[status]+"</strong></div>"
  ).join("");
  byId("deliveryRows").innerHTML=items.length ? items.slice(0,30).map(item=>
    "<tr><td>"+escapeText(emailKindLabel(item.kind))+"</td><td><span class='email-pill "+
    escapeText(item.status)+"'>"+escapeText(item.status.replace("_"," "))+
    "</span></td><td>"+escapeText(item.attempts??0)+"</td><td>"+escapeText(formatDate(item.updatedAt))+
    "</td><td>"+escapeText(item.lastError||item.providerId||"—")+"</td></tr>"
  ).join(""):"<tr><td colspan='5'>No email notifications have been queued yet.</td></tr>";
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
    "</span></td><td><span class='email-pill " + escapeText(item.emailStatus || "pending") + "'>" +
    escapeText(item.emailStatus || "pending") +
    "</span></td><td><button class='row-action' data-id='" + escapeText(item._id) + "'>View & edit</button></td></tr>"
  ).join("") : "<tr><td colspan='6'>No enquiries match your filters yet.</td></tr>";
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
    ["Meeting date", lead.meetingDate], ["Meeting time", lead.meetingTime],
    ["Meeting review needed", lead.meetingNeedsReview ? "Yes — check the enquiry details" : "No"],
    ["Email notification", lead.emailStatus], ["Project details", lead.message]
  ];
  byId("leadDetails").innerHTML = fields.map(([name, value]) =>
    "<div" + (name === "Project details" ? " class='wide'" : "") + "><dt>" +
    escapeText(name) + "</dt><dd>" + escapeText(value || "—") + "</dd></div>"
  ).join("");
  const notices=lead.notifications||[];
  byId("leadNotifications").innerHTML=notices.length?
    '<h3>Related notifications</h3>'+notices.map(item=>
      '<div><strong>'+escapeText(emailKindLabel(item.kind))+'</strong><span class="email-pill '+
      escapeText(item.status)+'">'+escapeText(item.status.replace("_"," "))+
      '</span><small>'+escapeText(item.attempts||0)+' attempt(s)'+
      (item.lastError?' · '+escapeText(item.lastError):'')+'</small></div>'
    ).join(""):'<p>No notification jobs associated with this enquiry yet.</p>';
  byId("leadStatus").value = lead.status || "new";
  byId("leadNotes").value = lead.internalNotes || "";
  byId("retryEmail").hidden = !["pending", "failed"].includes(lead.emailStatus || "pending");
  byId("retryEmail").disabled = false;

  byId("leadDialog").showModal();
}
async function refreshAll() {
  await Promise.all([refreshStats(), loadEnquiries(), loadMeetings(), refreshEmailConfig(), loadEmailDeliveries()]);
  message("Information updated.");
}
byId("retryEmail").addEventListener("click", async () => {
  if (!currentLeadId) return;
  const button=byId("retryEmail");
  button.disabled=true;
  button.textContent="Sending notification…";
  try {
    const result=await call("/enquiries/" + encodeURIComponent(currentLeadId) + "/email/retry", {
      method:"POST",body:"{}"
    });
    byId("leadDialog").close();
    await Promise.all([loadEnquiries(),refreshEmailConfig()]);
    message(result.message || "Notification accepted by Resend.");
  } catch (error) {
    message(error.message,true);
    const status=byId("retryEmailStatus");
    status.textContent=error.message;
  } finally {
    button.disabled=false;
    button.textContent="Retry email notification";
  }
});
byId("logout").addEventListener("click", async () => {
  const button = byId("logout");
  button.disabled = true;
  try {
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
  } finally {
    location.replace("/admin/login/");
  }
});
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

async function initializeDashboard() {
  try {
    const user = await call("/auth/me");
    if (!user.authenticated) throw new Error("Access denied.");
    byId("dashboard").hidden = false;
    await refreshAll();
  } catch (error) {
    message(error.message || "Unable to load the dashboard.", true);
  }
}
initializeDashboard();
