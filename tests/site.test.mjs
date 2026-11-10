import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync("public/"+path,"utf8");
test("marketing content lives on separate pages",()=>{
 const pages=["services","portfolio","pricing","process","contact"];
 for(const p of pages)assert.match(read(p+"/index.html"),new RegExp('href="/'+p+'/"'));
 const home=read("index.html");
 assert.doesNotMatch(home,/id="contactForm"/);
 assert.doesNotMatch(home,/id="web-pricing"/);
 assert.match(read("pricing/index.html"),/id="web-pricing"/);
 assert.match(read("contact/index.html"),/id="contactForm"/);
});
test("sitemap excludes admin routes",()=>{
 const sitemap=read("sitemap.xml");
 assert.match(sitemap,/\/contact\/<\/loc>/);
 assert.doesNotMatch(sitemap,/\/admin\//);
});

test("Mzansi Digital Ventures branding is present on all public pages",()=>{
 for(const route of ["index.html","services/index.html","about/index.html","portfolio/index.html","pricing/index.html","process/index.html","contact/index.html","pricing-guide.html"]){
  const html=read(route);
  assert.match(html,/Mzansi Digital Ventures/);
  assert.doesNotMatch(html,/BK Digital Development/);
 }
 assert.match(read("index.html"),/class="product-preview"/);
 assert.match(read("services/index.html"),/Database/);
 assert.match(read("services/index.html"),/Hosting/);
 assert.match(read("sitemap.xml"),/\/about\//);
});

test("brand-domain migration updates public canonical links and sitemap",()=>{
 const pages=["index.html","services/index.html","about/index.html","portfolio/index.html","pricing/index.html","process/index.html","contact/index.html"];
 for(const path of pages){
  const html=read(path);
  assert.match(html,/https:\/\/mzansi-digital-ventures\.netlify\.app/);
  assert.doesNotMatch(html,/https:\/\/bk-digital-development\.netlify\.app/);
 }
 const sitemap=read("sitemap.xml");
 const robots=read("robots.txt");
 assert.match(sitemap,/https:\/\/mzansi-digital-ventures\.netlify\.app\//);
 assert.match(robots,/mzansi-digital-ventures\.netlify\.app\/sitemap.xml/);
 assert.doesNotMatch(sitemap,/bk-digital-development\.netlify\.app/);
});


test("a restrained, accessible software studio design replaces the previous hero",()=>{
  const home=read("index.html"),css=read("studio.css");
  assert.match(home,/Software that helps your business/);
  assert.match(home,/class="product-preview"/);
  assert.match(home,/Illustrative concept/);
  assert.match(home,/class="case-grid"/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(home,/floating-note|browser-card/);
});
test("every page warms the service without blocking the marketing content",()=>{
 const paths=["index.html","services/index.html","about/index.html","portfolio/index.html",
   "pricing/index.html","process/index.html","contact/index.html",
   "admin/login/index.html","admin/dashboard/index.html"];
 for(const path of paths){
   const html=read(path);
   assert.match(html,/\/service-health\.js/);
   assert.match(html,/\/studio(?:-admin)?\.css/);
 }
 const health=read("service-health.js");
 assert.match(health,/\/api\/health/);
 assert.match(health,/15 \* 60 \* 1000/);
 assert.match(health,/visibilitychange/);
 assert.match(health,/service-connection/);
 assert.doesNotMatch(health,/setInterval/);
});
test("the contact form uses a wakeup preflight but does not replay enquiries",()=>{
 const script=read("app.js");
 assert.match(script,/MDVService\.ensureReady/);
 assert.match(script,/submitting = true/);
 assert.match(script,/fetch\("\/api\/contact"/);
 assert.doesNotMatch(script,/fetch\("\/api\/contact"[\s\S]*?fetch\("\/api\/contact"/);
});

test("original portfolio case studies and real local screenshots are present",()=>{
 const portfolio=read("portfolio/index.html");
 const screenshots=[
   ["MzansiRent","/images/projects/mzansirent.webp"],
   ["DentaCare","/images/projects/dentacare.webp"],
   ["Freelance Services Platform","/images/projects/freelance-services-platform.webp"]
 ];
 for(const [name,path] of screenshots){
   assert.ok(portfolio.includes(name));
   assert.ok(portfolio.includes(path));
   const image=readFileSync("public"+path);
   assert.equal(image.toString("ascii",0,4),"RIFF");
   assert.equal(image.toString("ascii",8,12),"WEBP");
   assert.ok(image.length>15000);
 }
 for(const slug of ["mzansirent","dentacare","freelance-services-platform"]){
   assert.ok(portfolio.includes("oboikanyego-portfolio.netlify.app/projects/"+slug));
 }
 assert.match(portfolio,/Technical explorations/i);
 assert.match(portfolio,/Real-Time Chat System/);
 assert.match(portfolio,/Secure Authentication System/);
});

test("homepage also features authentic screenshot assets from the source portfolio",()=>{
 const home=read("index.html");
 assert.match(home,/images\/projects\/mzansirent\.webp/);
 assert.match(home,/images\/projects\/dentacare\.webp/);
 assert.match(home,/Explore the case study/);
});

test("KasiDrop, Mzansi Rent Lite and Genesis cards use real browser screenshots",()=>{
 const html=read("portfolio/index.html");
 const manifest=JSON.parse(read("images/projects/live-capture-manifest.json"));
 assert.equal(manifest.projects.length,3);
 for(const id of ["kasidrop","mzansi-rent-lite","genesis-kiddies-corner"]){
  assert.ok(html.includes("images/projects/"+id+"-live.webp"));
  assert.ok(html.includes("images/projects/mobile/"+id+"-live.webp"));
  for(const subdir of ["","mobile/"]){
   const screenshot=readFileSync("public/images/projects/"+subdir+id+"-live.webp");
   assert.equal(screenshot.toString("ascii",0,4),"RIFF");
   assert.equal(screenshot.toString("ascii",8,12),"WEBP");
   assert.ok(screenshot.length>10000);
  }
  const record=manifest.projects.find(p=>p.id===id);
  assert.equal(record?.desktop?.status,200);
  assert.ok(record?.desktop?.bodyTextLength>75);
 }
 assert.match(html,/genesis-kiddies-corner2\.netlify\.app/);
});

test("Royal Treats is included with a verified desktop and mobile browser capture",()=>{
 const html=read("portfolio/index.html");
 assert.match(html,/Royal Treats/);
 assert.match(html,/https:\/\/royal-treats\.netlify\.app\//);
 assert.match(html,/images\/projects\/royal-treats-live\.webp/);
 assert.match(html,/images\/projects\/mobile\/royal-treats-live\.webp/);
 const manifest=JSON.parse(read("images/projects/royal-treats-capture.json"));
 assert.equal(manifest.projects.length,1);
 assert.equal(manifest.projects[0].id,"royal-treats");
 for(const type of ["desktop","mobile"]){
   const result=manifest.projects[0][type];
   assert.equal(result.status,200);
   assert.ok(result.bodyTextLength>75);
   const image=readFileSync("public/images/projects/"+(type==="mobile"?"mobile/":"")+"royal-treats-live.webp");
   assert.equal(image.toString("ascii",0,4),"RIFF");
   assert.equal(image.toString("ascii",8,12),"WEBP");
   assert.ok(image.length>9000);
 }
});
