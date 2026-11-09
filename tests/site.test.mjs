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
 assert.match(read("index.html"),/brand-hero.svg/);
 assert.match(read("services/index.html"),/Database/);
 assert.match(read("services/index.html"),/Hosting/);
 assert.match(read("sitemap.xml"),/\/about\//);
});

test("brand-domain cutover includes canonical host and legacy redirects",()=>{
 const home=read("index.html"), sitemap=read("sitemap.xml");
 const config=readFileSync("netlify.toml","utf8");
 assert.match(home,/https:\/\/mzansi-digital-ventures\.netlify\.app\//);
 assert.match(sitemap,/https:\/\/mzansi-digital-ventures\.netlify\.app\//);
 assert.match(config,/from = "https:\/\/bk-digital-development\.netlify\.app\/\*"/);
 assert.match(config,/to = "https:\/\/mzansi-digital-ventures\.netlify\.app\/:splat"/);
});
