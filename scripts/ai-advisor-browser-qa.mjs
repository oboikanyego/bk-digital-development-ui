import {chromium} from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const base=process.env.PREVIEW_URL || "https://6af438d5616c943581fdba2f--mzansi-digital-ventures.netlify.app";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
await mkdir("qa-screenshots",{recursive:true});
const errors=[];
try {
  for(const width of [1440,440,320]){
    const ctx=await browser.newContext({viewport:{width,height:width===440?956:850},reducedMotion:"reduce",deviceScaleFactor:1});
    const page=await ctx.newPage();
    let requests=0;
    page.on("pageerror",e=>errors.push(width+": "+e.message));
    await page.route("**/api/health",r=>r.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
    await page.route("**/api/site",r=>r.fulfill({status:503,contentType:"application/json",body:'{"message":"offline fallback"}'}));
    await page.route("**/api/ai/status",r=>r.fulfill({status:200,contentType:"application/json",body:'{"enabled":true,"provider":"Groq","aiAvailable":true,"guidedAvailable":true,"dailyLimit":5}'}));
    await page.route("**/api/ai/advice",async r=>{
      requests++;
      const payload=r.request().postDataJSON();
      assert.ok(payload.message.length>=15&&payload.message.length<=1200);
      await new Promise(resolve=>setTimeout(resolve,280));
      await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        mode:"ai",reply:"A booking website is a great fit. Start with availability, online bookings and reminders. What services do you offer?",
        solution:{category:"bookings",title:"Online booking platform",projectType:"Booking website/system",
          features:["Online booking calendar","Customer reminders","Staff schedules"],steps:["Map booking rules","Prototype","Launch"]},
        notice:"AI guidance is informational and not a fixed quotation."
      })});
    });
    const response=await page.goto(base+"/ai-advisor/",{waitUntil:"domcontentloaded",timeout:90000});
    assert.equal(response.status(),200);
    const form=page.locator(".ai-input-form");
    await form.waitFor({state:"visible",timeout:12000});
    assert.equal(await page.locator("[data-ai-status]").innerText(),"AI READY");
    assert.equal(await page.locator(".ai-suggestion").count(),4);
    await page.locator(".ai-suggestion").first().click();
    assert.match(await form.locator("textarea").inputValue(),/salon/);
    await form.getByRole("button",{name:/Get free advice/}).click();
    await page.locator(".ai-result:not([hidden])").waitFor({state:"visible",timeout:10000});
    assert.equal(requests,1);
    assert.match(await page.locator(".ai-result").innerText(),/Online booking platform/);
    assert.equal(await page.locator(".ai-conversation .ai-bubble").count(),3);
    if(width!==320){
      const report=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
      const serious=report.violations.filter(v=>v.impact==="serious"||v.impact==="critical");
      console.log("A11Y",width,JSON.stringify(report.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.slice(0,3).map(n=>n.target)}))));
      assert.equal(serious.length,0,"serious a11y issue");
    }
    const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(horizontal<=2,"horizontal overflow: "+horizontal+" at "+width);
    await page.screenshot({path:"qa-screenshots/ai-advisor-"+width+".png",fullPage:true,animations:"disabled"});
    await page.locator("[data-ai-quote]").click();
    await page.waitForURL(/\/contact\/\?from=ai-advisor/);
    assert.match(await page.locator('textarea[name="message"]').inputValue(),/AI advisor project brief/);
    assert.equal(await page.locator('select[name="projectType"]').inputValue(),"Booking website/system");
    console.log("ADVISOR PAGE",JSON.stringify({width,requests,overflow:horizontal,quotePrefilled:true}));
    await ctx.close();
  }
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  const page=await ctx.newPage();
  await page.route("**/api/health",r=>r.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
  await page.route("**/api/site",r=>r.fulfill({status:503,contentType:"application/json",body:"{}"}));
  await page.route("**/api/ai/status",r=>r.fulfill({status:200,contentType:"application/json",body:'{"enabled":true,"aiAvailable":false,"guidedAvailable":true}'}));
  await page.route("**/api/ai/advice",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({mode:"guided",reply:"Start with an online store.",solution:{title:"Online store and payments",projectType:"Online store",features:["Product catalogue","Checkout"]},notice:"Guided mode"})}));
  await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:90000});
  const launcher=page.getByRole("button",{name:/Ask Mzansi AI Consultant/});
  await launcher.waitFor({state:"visible"});
  await launcher.click();
  const dialog=page.getByRole("dialog",{name:"Mzansi AI Consultant"});
  assert.equal(await dialog.isVisible(),true);
  await dialog.locator(".ai-suggestion").nth(1).click();
  await dialog.getByRole("button",{name:/Get free advice/}).click();
  await dialog.locator(".ai-result:not([hidden])").waitFor();
  assert.match(await dialog.innerText(),/Online store and payments/);
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(),false);
  console.log("FLOATING ASSISTANT PASS");
  await ctx.close();
  assert.deepEqual(errors,[]);
} finally {
  await browser.close();
}
