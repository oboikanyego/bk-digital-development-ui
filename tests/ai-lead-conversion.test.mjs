import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync("public/"+path,"utf8");

test("AI consultant launches the consented project brief wizard from all public pages",()=>{
 for(const path of ["index.html","ai-advisor/index.html","about/index.html","services/index.html",
   "portfolio/index.html","pricing/index.html","process/index.html","contact/index.html"]){
   const html=read(path);
   assert.match(html,/\/ai-lead-flow\.js/,"missing wizard on "+path);
   assert.match(html,/\/ai-lead-flow\.css/,"missing styles on "+path);
   assert.ok(html.indexOf("/ai-lead-flow.js")<html.indexOf("/ai-advisor.js"));
 }
 const advisor=read("ai-advisor.js");
 assert.match(advisor,/data-ai-brief/);
 assert.match(advisor,/MDVAiLeadFlow\?\.open/);
 assert.match(advisor,/projectAnswers:\[\.\.\.projectAnswers\]/);
 assert.match(advisor,/history:\[\.\.\.history\]/);
 assert.match(advisor,/MDVAiLeadFlow\?\.track\("opened"\)/);
 assert.match(advisor,/MDVAiLeadFlow\?\.track\("idea_submitted"\)/);
});

test("wizard explicitly reviews AI brief and collects consent before CRM submission",()=>{
 const script=read("ai-lead-flow.js");
 assert.match(script,/\/api\/ai\/leads/);
 assert.match(script,/submissionId,brief:data\(\),consent:/);
 assert.match(script,/name="consent" type="checkbox"/);
 assert.match(script,/name="shareTranscript" type="checkbox"/);
 assert.match(script,/shareTranscript:field\("shareTranscript"\)\.checked/);
 assert.match(script,/transcript:field\("shareTranscript"\)\.checked\?chat:\[\]/);
 assert.match(script,/Select|Choose|confirm consent|consent to share this enquiry/i);
 assert.match(script,/\.textContent=feature/);
 assert.match(script,/data-stage="0"/);
 assert.match(script,/data-stage="1"/);
 assert.match(script,/data-stage="2"/);
 assert.match(script,/data-stage="3"/);
 assert.match(script,/brief_reviewed/);
 assert.match(script,/result\.saved/);
});

test("admin CRM, dashboard and documents expose AI lead conversion tools",()=>{
 const crm=read("admin/crm/index.html");
 assert.match(crm,/id="crmLeadSource"/);
 assert.match(crm,/AI Consultant/);
 const dash=read("admin/dashboard/index.html");
 assert.match(dash,/id="sourceFilter"/);
 assert.match(dash,/id="aiConversionKpis"/);
 assert.match(dash,/id="leadAiDraft"/);
 assert.match(dash,/\/ai-admin\.js/);
 const biz=read("business-console.js");
 assert.match(biz,/\/ai\/leads\//);
 assert.match(biz,/\/quotation-draft/);
 assert.match(biz,/\/documents\/"\+encodeURIComponent\(editId\)/);
 assert.match(biz,/method:"PATCH"/);
 assert.match(biz,/Edit prices \/ scope/);
 const analytics=read("ai-admin.js");
 assert.match(analytics,/\/api\/admin\/ai\/analytics/);
 assert.match(analytics,/leadsPerIdea/);
 assert.match(analytics,/quotesPerLead/);
});
