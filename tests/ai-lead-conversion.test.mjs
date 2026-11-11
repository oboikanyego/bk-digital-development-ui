import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {check} from "node:module";
const read=file=>readFileSync("public/"+file,"utf8");
test("AI brief review assets present on every advisor surface",()=>{
  for(const page of ["index.html","about/index.html","services/index.html","portfolio/index.html","pricing/index.html","process/index.html","contact/index.html","ai-advisor/index.html"]){
    const html=read(page);
    assert.match(html,/\/ai-advisor\.js/,page);
    assert.match(html,/\/ai-lead-wizard\.js/,page);
    assert.match(html,/\/ai-lead-wizard\.css/,page);
  }
});
test("submission requires explicit consent and uses the existing API with a stable idempotency key",()=>{
  const js=read("ai-lead-wizard.js");
  for(const snippet of ["crypto.randomUUID()","submissionId,consent:true","shareTranscript","captureBrief()","captureContact()","/api/ai/leads","result.saved","Review your AI project brief","Select at least one feature"])
    assert.ok(js.includes(snippet),snippet);
  assert.match(js,/transcript\.filter/);
  assert.match(js,/\.slice\(-12\)/);
  assert.match(js,/if\(!response\.ok \|\| !result\.saved\)/);
  assert.doesNotMatch(js,/GROQ_API_KEY|localStorage/);
});
test("chat keeps conversation context and tracks privacy-safe AI conversion events",()=>{
  const js=read("ai-advisor.js");
  assert.match(js,/data-ai-review/);
  assert.match(js,/mdv-ai-project-brief/);
  assert.match(js,/projectAnswers/);
  assert.match(js,/track\("idea_submitted"\)/);
  assert.match(js,/event:"opened"/);
  assert.match(read("ai-lead-wizard.js"),/tracker\("brief_reviewed"\)/);
});
test("CRM source filter, AI details and quote draft editing use existing protected endpoints",()=>{
  const crm=read("admin/crm/index.html");
  const docs=read("admin/documents/index.html");
  const dashboard=read("admin/dashboard/index.html");
  const js=read("business-console.js");
  assert.match(crm,/crmSource/);
  assert.match(crm,/AI project briefs/);
  assert.match(js,/source=\$\("crmSource"\)\.value/);
  assert.match(js,/\/quotation-draft/);
  assert.match(js,/\/admin\/documents\/\?edit=/);
  assert.match(docs,/id="docEditForm"/);
  assert.match(js,/\/documents\/"\+encodeURIComponent\(editingDocument\._id\)/);
  assert.match(dashboard,/id="aiFunnelMetrics"/);
  assert.match(read("admin.js"),/\/ai\/analytics\?days=30/);
  assert.match(read("admin.js"),/source=byId\("sourceFilter"\)\.value/);
});
test("legacy contact forms and independent CRM enquiries remain intact",()=>{
  assert.match(read("contact/index.html"),/contactForm/);
  assert.match(read("admin/crm/index.html"),/clientForm/);
  assert.match(read("admin/documents/index.html"),/documentForm/);
});
