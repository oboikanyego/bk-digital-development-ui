import { chromium } from "playwright";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const preview=process.env.PREVIEW_URL||"https://6af471e0b2479f6db37fa609--mzansi-digital-ventures.netlify.app";
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_USE_SYSTEM_CHROME?"chrome":undefined,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const errors=[];
await mkdir("qa-screenshots",{recursive:true});
const answer={
 mode:"guided",
 reply:"For selling and renting mascots, start with a combined store and rental calendar. "+
  "Visitors should be able to browse mascot costumes, buy or rent them, check rental availability, "+
  "choose dates, organise delivery and communicate with your staff. ".repeat(5),
 solution:{title:"Online store + rental booking platform",category:"commerce-rentals",
  projectType:"Booking website/system",
  features:["Sale and rental catalogue","Booking availability","Payments and deposits","Admin dashboard"],
  question:"Do customers rent for days or weekends?"},
 notice:"You can ask another question or request a quote."
};
async function mock(page) {
  page.on("pageerror",err=>errors.push(err.message));
  await Promise.all([
    page.route("**/api/health",r=>r.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'})),
    page.route("**/api/site",r=>r.fulfill({status:503,contentType:"application/json",body:"{}"})),
    page.route("**/api/ai/status",r=>r.fulfill({status:200,contentType:"application/json",body:'{"enabled":true,"aiAvailable":false}'})),
    page.route("**/api/ai/events",r=>r.fulfill({status:202,contentType:"application/json",body:'{"ok":true}'})),
    page.route("**/api/ai/advice",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(answer)}))
  ]);
}
async function wheelOver(page,selector,viewport) {
  const loc=page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  const box=await loc.boundingBox();
  assert.ok(box?.width>0&&box?.height>0,"wheel target must be visible: "+selector);
  const y=Math.max(95,Math.min(viewport.height-25,Math.max(box.y+4,Math.min(box.y+box.height/2,viewport.height-30))));
  const x=Math.max(12,Math.min(viewport.width-12,box.x+Math.min(80,box.width/2)));
  await page.mouse.move(x,y);
  const before=await page.evaluate(()=>({
    page:window.scrollY,
    max:document.documentElement.scrollHeight-window.innerHeight,
    nested:document.querySelector("#aiAdvisorApp .ai-chat-scroll")?.scrollTop||0
  }));
  const delta=before.max-before.page>135?265:-265;
  await page.mouse.wheel(0,delta);
  await page.waitForTimeout(160);
  const after=await page.evaluate(()=>({
    page:window.scrollY,nested:document.querySelector("#aiAdvisorApp .ai-chat-scroll")?.scrollTop||0
  }));
  assert.ok(Math.abs(after.page-before.page)>40,
    "wheel over "+selector+" must scroll document, not get trapped: "+
      JSON.stringify({viewport,box,before,after,delta}));
  assert.equal(after.nested,0,"no independent full-page chat scrolling");
  console.log("PAGE_WHEEL_PASS",viewport.width,selector,JSON.stringify({before:before.page,after:after.page}));
}
try {
  for(const viewport of [
    {width:1715,height:900},
    {width:440,height:956},
    {width:320,height:700}
  ]){
    const context=await browser.newContext({viewport,reducedMotion:"reduce",deviceScaleFactor:1});
    const page=await context.newPage();
    page.setDefaultTimeout(12000);
    await mock(page);
    const response=await page.goto(preview+"/ai-advisor/",{waitUntil:"domcontentloaded",timeout:90000});
    assert.equal(response.status(),200);
    await page.locator("#aiAdvisorApp .ai-conversation").waitFor();
    const initial=await page.evaluate(()=>{
      const container=document.querySelector("#aiAdvisorApp .ai-chat-scroll");
      const panel=document.querySelector("#aiAdvisorApp.ai-advisor-panel");
      return {
        chatOverflow:getComputedStyle(container).overflowY,
        overscroll:getComputedStyle(container).overscrollBehaviorY,
        nestedDelta:container.scrollHeight-container.clientHeight,
        panelHeight:getComputedStyle(panel).height,
        docMax:document.documentElement.scrollHeight-window.innerHeight
      };
    });
    assert.equal(initial.chatOverflow,"visible","standalone conversation must not have a scrollbar");
    assert.equal(initial.overscroll,"auto","standalone must allow page wheel chaining");
    assert.ok(initial.nestedDelta<=2,"standalone chat fits full content height");
    assert.ok(initial.docMax>200,"the page should be long enough to scroll");
    await wheelOver(page,"#aiAdvisorApp .ai-suggestions",viewport);
    await wheelOver(page,"#aiAdvisorApp .ai-bubble-assistant",viewport);
    await page.locator("#aiAdvisorApp .ai-input-form textarea").fill(
      "I sell mascot costumes and rent them out for parties. I need a combined shop and booking website.");
    await page.locator("#aiAdvisorApp .ai-input-form button[type=submit]").click();
    await page.locator("#aiAdvisorApp .ai-result:not([hidden])").waitFor({state:"visible"});
    assert.equal(await page.locator("#aiAdvisorApp .ai-conversation .ai-bubble").count(),3);
    const longInput="I would like buyers and renters to be able to see available dates, compare mascots and request deliveries. ".repeat(7);
    await page.locator("#aiAdvisorApp .ai-input-form textarea").fill(longInput);
    const inputFit=await page.locator("#aiAdvisorApp .ai-input-form textarea").evaluate(el=>({
      yOverflow:getComputedStyle(el).overflowY,
      scrollGap:el.scrollHeight-el.clientHeight,
      height:el.clientHeight
    }));
    assert.equal(inputFit.yOverflow,"hidden","full page input must not trap scrolling");
    assert.ok(inputFit.scrollGap<=2,"long prompt must expand without inner scrolling");
    assert.ok(inputFit.height>105,"long prompt grows with content");
    await wheelOver(page,"#aiAdvisorApp .ai-bubble-user",viewport);
    await wheelOver(page,"#aiAdvisorApp .ai-result",viewport);
    await wheelOver(page,"#aiAdvisorApp .ai-input-form textarea",viewport);
    assert.ok(await page.locator("#aiAdvisorApp [data-ai-review]").isVisible(),
      "CRM project brief CTA remains visible");
    await page.screenshot({path:"qa-screenshots/ai-page-natural-scroll-"+viewport.width+".png",fullPage:true,animations:"disabled"});
    if(viewport.width===1715 || viewport.width===440) {
      const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
      const serious=axe.violations.filter(v=>["serious","critical"].includes(v.impact));
      console.log("A11Y",viewport.width,JSON.stringify(serious.map(v=>v.id)));
      assert.equal(serious.length,0);
    }
    await context.close();
  }
  // The small floating consultant deliberately retains its own ONE scrolling
  // message viewport and pins its composer above a non-scrolling page.
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  const page=await context.newPage();
  await mock(page);
  await page.goto(preview+"/contact/",{waitUntil:"domcontentloaded",timeout:90000});
  await page.locator(".ai-advisor-launcher").click();
  const dialog=page.getByRole("dialog",{name:"Mzansi AI Consultant"});
  await dialog.waitFor({state:"visible"});
  await dialog.locator(".ai-input-form textarea").fill("I sell and rent mascot outfits, and need a website for booking and purchases.");
  await dialog.locator(".ai-input-form button[type=submit]").click();
  await dialog.locator(".ai-result:not([hidden])").waitFor({state:"visible"});
  const chat=dialog.locator(".ai-chat-scroll");
  const state=await chat.evaluate(el=>({
    overflow:getComputedStyle(el).overflowY,
    total:el.scrollHeight-el.clientHeight
  }));
  assert.equal(state.overflow,"auto","floating modal still has internal chat scrolling");
  assert.ok(state.total>30,"floating modal can scroll long replies");
  await chat.evaluate(el=>{el.scrollTop=0});
  const bounds=await chat.boundingBox();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await page.mouse.wheel(0,280);
  await page.waitForTimeout(130);
  assert.ok((await chat.evaluate(el=>el.scrollTop))>20,"wheel scroll moves floating chat");
  assert.equal(await page.evaluate(()=>document.body.classList.contains("ai-chat-modal-open")),true);
  await page.keyboard.press("Escape");
  console.log("FLOATING_MODAL_SCROLL_PASS");
  await context.close();
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
