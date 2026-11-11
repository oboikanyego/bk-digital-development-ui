import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";

const root = process.env.PREVIEW_URL || "https://6af41f15bdd3b63f19b63854--mzansi-digital-ventures.netlify.app";
const browser = await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const pageErrors=[];
async function setup(width){
  const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:"reduce"});
  const page=await ctx.newPage();
  page.on("pageerror",err=>pageErrors.push(err.message));
  let healthCalls=0;
  let postCalls=0;
  await page.route("**/api/health",async route=>{
    healthCalls++;
    if(healthCalls===1) await new Promise(resolve=>setTimeout(resolve,1650));
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"ok"})});
  });
  await page.route("**/api/site",route=>route.fulfill({status:503,contentType:"application/json",body:"{}"}));
  await page.route("**/api/admin/auth/me",route=>route.fulfill({status:401,contentType:"application/json",body:"{}"}));
  await page.route("**/api/contact",async route=>{
    postCalls++;
    await new Promise(resolve=>setTimeout(resolve,1100));
    await route.fulfill({status:201,contentType:"application/json",body:'{"saved":true}'});
  });
  return {page,ctx,healthCalls:()=>healthCalls,postCalls:()=>postCalls};
}
try{
  for(const width of [1280,390]){
    const {page,ctx,healthCalls,postCalls}=await setup(width);
    const response=await page.goto(root+"/",{waitUntil:"domcontentloaded",timeout:85000});
    assert.equal(response.status(),200);
    const notice=page.locator(".service-connection");
    await notice.waitFor({state:"visible",timeout:10000});
    assert.match(await notice.innerText(),/Starting our secure service/i);
    await page.waitForFunction(()=>window.MDVService?.isReady(),{timeout:10000});
    const css=await page.locator('link[href="/service-loader.css"]').count();
    assert.equal(css,1);
    assert.equal(healthCalls(),1);
    const state=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-innerWidth,
      overlayPresent:!!document.querySelector(".mdv-request-overlay"),
      noticeRole:document.querySelector(".service-connection")?.getAttribute("role")
    }));
    assert.ok(state.overflow<=1,"horizontal overflow at "+width);
    assert.equal(state.noticeRole,"status");
    // After an idle period, a new interaction rechecks the backend exactly once.
    await page.evaluate(()=>{
      const actual=Date.now;
      Date.now=()=>actual()+16*60*1000;
      document.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));
      Date.now=actual;
    });
    await page.waitForFunction(()=>window.MDVService?.isReady());
    assert.equal(healthCalls(),2);
    // Run a fake backend POST with delayed response; do not create a real enquiry.
    await page.evaluate(()=>{
      window.__mdvQAPost=fetch("/api/contact",{method:"POST",headers:{"content-type":"application/json"},body:'{"qa":true}'});
    });
    const overlay=page.locator(".mdv-request-overlay");
    await overlay.waitFor({state:"visible",timeout:10000});
    assert.match(await overlay.innerText(),/Sending your enquiry/);
    assert.equal(await page.evaluate(()=>window.MDVService.isSubmitting()),true);
    const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
    const serious=axe.violations.filter(x=>["serious","critical"].includes(x.impact));
    console.log("A11Y",width,JSON.stringify(serious.map(x=>({id:x.id,nodes:x.nodes.map(y=>y.target)}))));
    assert.equal(serious.length,0,"serious accessibility violations during POST loading");
    const result=await page.evaluate(async()=>{const r=await window.__mdvQAPost;return r.status;});
    assert.equal(result,201);
    assert.equal(await overlay.isVisible(),false);
    assert.equal(postCalls(),1,"must submit a POST exactly once");
    console.log("PASS BROWSER",width,JSON.stringify({firstHealth:1,idleWakeHealth:healthCalls(),postCount:postCalls(),overlayReleased:true,overflow:state.overflow}));
    await ctx.close();
  }
  assert.deepEqual(pageErrors,[]);
} finally {await browser.close();}
