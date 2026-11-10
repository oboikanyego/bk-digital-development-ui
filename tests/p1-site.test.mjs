import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read=path=>readFileSync(path,"utf8");

test("CRM and billing admin pages exist and use authenticated same-origin API, including logout",()=>{
 for(const path of ["public/admin/crm/index.html","public/admin/documents/index.html"]){
  assert.ok(existsSync(path));
  const html=read(path);
  assert.match(html,/noindex,nofollow/);
  assert.match(html,/bizLogout/);
  assert.match(html,/service-health\.js/);
 }
 const script=read("public/business-console.js");
 assert.match(script,/\/api\/admin/);
 assert.match(script,/credentials:"same-origin"/);
 assert.match(script,/location\.assign\("\/admin\/login\/"\)/);
 assert.match(script,/\/crm\/clients/);
 assert.match(script,/\/crm\/follow-ups/);
 assert.match(script,/\/documents\/.*\/pdf/);
 assert.match(script,/\/documents\/.*\/status/);
 assert.match(script,/Record payment/);
 assert.match(script,/manual/);
});
test("client profile UI includes histories, follow-ups, status and activity timeline",()=>{
 const html=read("public/admin/crm/index.html");
 for(const id of ["crmRows","crmDueList","crmClientTotal","clientDialog",
   "clientEnquiries","clientDocuments","clientActivity","clientForm"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 for(const field of ["followUpDate","projectStatus","priority","notes"]){
  assert.match(html,new RegExp('name="'+field+'"'));
 }
});
test("billing form includes document line items, currency totals, due dates and PDF download",()=>{
 const html=read("public/admin/documents/index.html");
 for(const id of ["docKind","docClient","docDue","docValid","docTax","docItems",
   "docTotal","docRows","docCreate"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/manually/);
 assert.match(read("public/business-console.js"),/unitPriceCents/);
});
test("website settings CMS includes fields for SEO, navigation, footer, FAQs, testimonials and design",()=>{
 const html=read("public/admin/site-settings/index.html");
 const script=read("public/advanced-settings.js");
 for(const id of ["seoPage","seoTitle","seoDescription","seoRobots","seoImage",
  "navigationEditor","footerDescription","footerLinksEditor","testimonialsEditor",
  "faqsEditor","homepageSectionsEditor","designAccent","designBackground","designText","designRadius"]){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(script,/\/api\/admin/);
 assert.match(script,/siteConfig/);
 assert.match(script,/revision/);
 assert.match(script,/markDirty|setDirty/);
 assert.match(script,/confirm/);
});
test("public-site JS uses safe links, escapes dynamic content and preserves static fallback",()=>{
 const script=read("public/site-view.js");
 assert.match(script,/safePath/);
 assert.match(script,/textContent/);
 assert.match(script,/updateExtendedSettings/);
 assert.match(script,/cms-structured-data/);
 assert.match(script,/Using the published static content/);
 assert.match(script,/safeUrl/);
});
test("Netlify proxy preserves PDF binary bytes and correct MIME type",()=>{
 const script=read("netlify/functions/api-proxy.mjs");
 assert.match(script,/application\/pdf/);
 assert.match(script,/isBase64Encoded:binary/);
 assert.match(script,/arrayBuffer/);
 assert.match(script,/content-disposition/);
 assert.match(script,/cache-control/);
 assert.doesNotMatch(script,/eval\(/);
});
test("admin entry points link to CRM, documents and advanced CMS settings",()=>{
 const pages=[
 "public/admin/dashboard/index.html",
 "public/admin/content/index.html",
 "public/admin/email-templates/index.html"
 ];
 const bundle=pages.map(read).join("\n");
 for(const path of ["/admin/crm/","/admin/documents/","/admin/site-settings/"]){
  assert.match(bundle,new RegExp(path.replaceAll("/","\\/")));
 }
 assert.match(read("public/admin.js"),/statFollowUps/);
});
test("frontend build checks cover new admin routes and scripts",()=>{
 const source=read("scripts/build.mjs");
 for(const part of ["public/business-console.js","public/admin/crm/index.html",
   "public/admin/documents/index.html","public/admin/site-settings/index.html","public/advanced-settings.js"]){
  assert.ok(source.includes(part));
 }
});
