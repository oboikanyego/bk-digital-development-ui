import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.PREVIEW_URL || "https://6af41b13a43f243b510d0fd4--mzansi-digital-ventures.netlify.app";
const browser = await chromium.launch({ headless:true, args:["--no-sandbox","--disable-dev-shm-usage"] });
const issues=[];
await mkdir("qa-screenshots",{recursive:true});
for (const width of [1440,768,390,320]) {
  const context = await browser.newContext({ viewport:{width,height:900}, reducedMotion:"reduce", deviceScaleFactor:1 });
  const page = await context.newPage();
  page.on("pageerror",e=>issues.push(width+": "+e.message));
  await page.route("**/api/health",route=>route.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
  const response=await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(response.status(),200);
  await page.locator(".studio-hero h1").waitFor({state:"visible"});
  await page.waitForTimeout(1700);
  const state=await page.evaluate(()=>{
    const el=selector=>document.querySelector(selector);
    const rect=selector=>{const r=el(selector)?.getBoundingClientRect();return r?{width:Math.round(r.width),height:Math.round(r.height),left:Math.round(r.left),right:Math.round(r.right)}:null};
    const images=[...document.querySelectorAll(".home-showcase img")].map(img=>({src:img.getAttribute("src"),naturalWidth:img.naturalWidth,complete:img.complete}));
    return {overflow:document.documentElement.scrollWidth-innerWidth,
      bodyOverflow:document.body.scrollWidth-innerWidth,
      heroTitle:el(".studio-hero h1")?.textContent,
      hero:rect(".studio-hero .hero-grid"),heroCta:rect(".studio-hero .btn-primary"),
      imageStage:rect(".home-product-preview"),images,
      cssLoaded:getComputedStyle(el(".home-hero")).backgroundImage.includes("gradient"),
      services:document.querySelectorAll(".offering-card").length,
      projects:document.querySelectorAll(".case-card").length,
      footerCta:!!el(".home-final-cta a[href='/contact/']")
    };
  });
  console.log("VIEWPORT",width,JSON.stringify(state));
  assert.ok(state.cssLoaded,"hero gradient not applied");
  assert.equal(state.services,3);
  assert.ok(state.projects>0,"CMS project content or HTML fallback missing");
  assert.ok(state.images.every(x=>x.naturalWidth>0&&x.complete),"real portfolio screenshots failed to load");
  assert.ok(state.overflow<=2,"horizontal page overflow at "+width+"px: "+state.overflow);
  assert.ok(state.bodyOverflow<=2,"body overflow at "+width+"px: "+state.bodyOverflow);
  assert.ok(state.heroCta?.width>100&&state.heroCta.height>=40);
  assert.ok(state.footerCta,"final quote CTA missing");
  if(width<=768){
    const menu=page.locator(".nav-toggle");
    assert.equal(await menu.getAttribute("aria-label"),"Open navigation");
    await menu.click();
    assert.equal(await menu.getAttribute("aria-expanded"),"true");
    assert.equal(await page.locator("#primaryNav").isVisible(),true);
    await page.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"),"false");
  }
  if(width===1440||width===390){
    const label=width===1440?"desktop":"mobile";
    await page.screenshot({path:"qa-screenshots/home-"+label+".png",fullPage:true,animations:"disabled"});
    const a11y=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
    const serious=a11y.violations.filter(v=>v.impact==="serious"||v.impact==="critical");
    console.log("ACCESSIBILITY",label,JSON.stringify(a11y.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary?.slice(0,200)})).slice(0,8)}))));
    assert.equal(serious.length,0,"serious accessibility issues on "+label);
  }
  await context.close();
}
await browser.close();
assert.deepEqual(issues,[],"unhandled browser errors");
console.log("PASS responsive IT homepage browser QA at 1440, 768, 390 and 320px, including a11y and CMS projects");
