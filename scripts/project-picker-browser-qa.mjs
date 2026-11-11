import {chromium} from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const base=process.env.PREVIEW_URL || "https://6af42634250bdeb5ebc9dc99--mzansi-digital-ventures.netlify.app";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
await mkdir("qa-screenshots",{recursive:true});
const browserErrors=[];
const viewportCases=[{width:1440,height:900},{width:440,height:956},{width:320,height:720}];
try{
 for(const {width,height} of viewportCases){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:"reduce",deviceScaleFactor:1});
  const page=await context.newPage();
  let posted=0;
  let lastPayload=null;
  page.on("pageerror",e=>browserErrors.push(e.message));
  await page.route("**/api/health",r=>r.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
  await page.route("**/api/site",r=>r.fulfill({status:503,contentType:"application/json",body:'{"message":"CMS unavailable - offline fallback"}'}));
  await page.route("**/api/contact",async r=>{
    posted++;
    lastPayload=r.request().postDataJSON();
    await r.fulfill({status:201,contentType:"application/json",body:'{"saved":true,"notification":"sent"}'});
  });
  const loaded=await page.goto(base+"/contact/",{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(loaded.status(),200);
  const trigger=page.locator("#projectTypeTrigger");
  const panel=page.locator("#projectTypePanel");
  const native=page.locator("#projectTypeNative");
  await page.locator("#projectTypeField.is-enhanced").waitFor();
  assert.equal(await trigger.isVisible(),true);
  assert.equal(await native.getAttribute("name"),"projectType");
  assert.equal(await native.getAttribute("required"),"");
  assert.equal(await native.inputValue(),"");

  // Invalid submission must open picker instead of sending incomplete enquiry.
  await page.locator('#contactForm button[type="submit"]').click();
  assert.equal(await panel.isVisible(),true);
  assert.equal(await page.locator("#projectTypeError").isVisible(),true);
  assert.equal(posted,0);
  await page.keyboard.press("Escape");
  assert.equal(await panel.isVisible(),false);
  assert.equal(await trigger.getAttribute("aria-expanded"),"false");

  // Opening and searching choices should never trigger the OS-native select.
  await trigger.click();
  const bounds=await panel.boundingBox();
  assert.ok(bounds.left>=-1&&bounds.right<=width+1,"picker cannot overflow the "+width+"px viewport: "+JSON.stringify(bounds));
  const allOptions=page.locator("#projectTypeOptions [role='option']");
  assert.equal(await allOptions.count(),11);
  const isMobile=width<=700;
  assert.equal(await panel.getAttribute("aria-modal"),String(isMobile));
  if(isMobile){
    assert.equal(await page.locator("#projectTypeBackdrop").isVisible(),true);
    assert.equal(await page.evaluate(()=>document.body.classList.contains("project-picker-dialog-open")),true);
    const scrollState=await page.locator("#projectTypeOptions").evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
    assert.ok(scrollState.scroll>scrollState.client,"mobile project list should scroll inside sheet: "+JSON.stringify(scrollState));
  } else {
    assert.equal(await page.locator("#projectTypeBackdrop").isVisible(),false);
  }
  // Accessibility while the dialog is open.
  if(width!==320){
    const report=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
    const important=report.violations.filter(x=>["serious","critical"].includes(x.impact));
    console.log("A11Y",width,JSON.stringify(report.violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.slice(0,4).map(n=>({target:n.target,summary:n.failureSummary?.slice(0,250)}))}))));
    assert.equal(important.length,0,"serious accessibility issues while project picker is open");
  }
  await page.locator("#projectTypeSearch").fill("api");
  assert.equal(await page.locator("#projectTypeOptions [role='option']:visible").count(),1);
  await page.locator("#projectTypeSearch").press("Enter");
  assert.equal(await native.inputValue(),"Database or API integration");
  assert.equal(await panel.isVisible(),false);
  assert.match(await trigger.innerText(),/Database or API integration/);
  assert.equal(await page.locator("#projectTypeError").isVisible(),false);

  // Reopen, pick using keyboard navigation, and ensure unchanged API values.
  await trigger.click();
  await page.locator("#projectTypeSearch").fill("mobile");
  await page.locator("#projectTypeSearch").press("ArrowDown");
  assert.equal(await page.locator("#projectTypeOptions [role='option']:focus").count(),1);
  await page.keyboard.press("Enter");
  assert.equal(await native.inputValue(),"Mobile app");
  assert.equal(await trigger.getAttribute("aria-expanded"),"false");

  // Verify normal same-origin contact POST, no changes to enquiry payload or reset.
  await page.locator('[name="name"]').fill("Picker QA Test");
  await page.locator('[name="email"]').fill("picker-qa@example.test");
  await page.locator('[name="message"]').fill("Testing the mobile and desktop project picker without contacting the real backend.");
  await page.locator('[name="consent"]').check();
  await page.locator('#contactForm button[type="submit"]').click();
  await page.locator(".form-status.success").waitFor({timeout:20000});
  assert.equal(posted,1);
  assert.equal(lastPayload.projectType,"Mobile app");
  assert.equal(lastPayload.consent,true);
  await page.waitForFunction(()=>document.getElementById("projectTypeNative").value==="");
  assert.match(await trigger.innerText(),/Select a project type/);
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(horizontalOverflow<=2,"horizontal overflow at "+width+"px: "+horizontalOverflow);
  await page.screenshot({path:"qa-screenshots/contact-project-picker-"+width+".png",fullPage:true,animations:"disabled"});
  console.log("PASS PROJECT PICKER",JSON.stringify({width,options:11,validated:true,search:true,keyboard:true,posted,projectType:lastPayload.projectType,overflow:horizontalOverflow}));
  await context.close();
 }
 // Without JS native select must remain available as accessible fallback.
 const fallback=await browser.newContext({viewport:{width:440,height:956},javaScriptEnabled:false});
 const p=await fallback.newPage();
 await p.goto(base+"/contact/",{waitUntil:"domcontentloaded",timeout:90000});
 assert.equal(await p.locator("#projectTypeNative").isVisible(),true);
 assert.equal(await p.locator("#projectTypeTrigger").isVisible(),false);
 console.log("PASS NATIVE FALLBACK");
 await fallback.close();
 assert.deepEqual(browserErrors,[]);
} finally {await browser.close();}
