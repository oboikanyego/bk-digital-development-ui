import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync("public/"+path,"utf8");

test("admin sign-in is discoverable from all public pages",()=>{
 for(const path of ["index.html","services/index.html","portfolio/index.html","about/index.html","pricing/index.html","process/index.html","contact/index.html"]){
  const html=read(path);
  assert.match(html,/<a class="admin-access" href="\/admin\/login\/"/);
  assert.match(html,/class="mobile-admin-access" href="\/admin\/login\/"/);
  assert.match(html,/class="footer-admin-access" href="\/admin\/login\/"/);
  assert.match(html,/\/site-view\.js/);
 }
 const dash=read("admin/dashboard/index.html");
 assert.match(dash,/href="\/admin\/content\/"/);
 const login=read("admin/login/index.html");
 assert.match(login,/id="loginForm"/);
});

test("visual site editor uses safe structured fields and Cloudinary uploads",()=>{
 const html=read("admin/content/index.html"),js=read("admin/content.js");
 for(const group of ["company","home","about","services","projects","pricing","visibility"]){
  assert.match(html,new RegExp('data-panel="'+group+'"'));
 }
 assert.match(html,/id="publishSite"/);
 assert.match(html,/id="projectEditor"/);
 assert.match(js,/\/media\/sign/);
 assert.match(js,/api\.cloudinary\.com/);
 assert.match(js,/site\.projects\.push/);
 assert.match(js,/site\.pricing\.push/);
 assert.match(js,/site\.services\.push/);
 assert.match(js,/revision/);
 assert.doesNotMatch(html,/input.+type="hidden".+json/i);
 assert.match(read("content-editor.css"),/@media\(max-width:760px\)/);
});

test("public content hydrates MongoDB and retains static offline fallback",()=>{
 const js=read("site-view.js");
 assert.match(js,/fetch\("\/api\/site"/);
 assert.match(js,/updatePortfolio\(site\)/);
 assert.match(js,/updatePricing\(site\)/);
 assert.match(js,/updateServices\(site\)/);
 assert.match(js,/updateHome\(site\)/);
 assert.match(js,/applyVisibility\(site\.sections/);
 assert.match(js,/Using the published static content/);
 assert.doesNotMatch(js,/localStorage/);
});
