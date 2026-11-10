import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(path,"utf8");
test("admin dashboard includes provider delivery analytics and per-enquiry notification trail",()=>{
 const html=read("public/admin/dashboard/index.html");
 const js=read("public/admin.js");
 for(const id of ["deliveryMetrics","deliveryRows","leadNotifications","deliveryOverviewTitle"]){
  assert.ok(html.includes('id="'+id+'"'));
 }
 assert.match(js,/\/email\/deliveries/);
 assert.match(js,/loadEmailDeliveries\(\)/);
 assert.match(js,/meeting_request_notification/);
 assert.match(js,/customer_acknowledgement/);
 assert.match(js,/email-pill/);
});
test("email template history supports preview, rollback and optimistic version concurrency",()=>{
 const html=read("public/admin/email-templates/index.html");
 const js=read("public/email-template-editor.js");
 assert.match(html,/id="templateHistory"/);
 assert.match(html,/Version history/);
 assert.match(js,/\/history/);
 assert.match(js,/\/rollback/);
 assert.match(js,/restoreRevision/);
 assert.match(js,/revision/);
 assert.match(html,/sandbox=""/);
});
test("Netlify scheduled worker protects its Render invocation with server-only token",()=>{
 const script=read("netlify/functions/email-worker.mjs");
 assert.match(script,/EMAIL_JOB_TOKEN/);
 assert.match(script,/x-email-job-token/);
 assert.match(script,/bk-digital-development-api\.onrender\.com\/internal\/email-jobs\/run/);
 assert.match(script,/schedule:"\*\/10 \* \* \* \*"/);
 assert.doesNotMatch(script,/console\.log\([^)]*token/);
});
