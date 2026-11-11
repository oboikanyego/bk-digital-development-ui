import {chromium} from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const base=process.env.PREVIEW_URL || "https://6af452f291e46f47ab8c7cb1--mzansi-digital-ventures.netlify.app";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
await mkdir("qa-screenshots",{recursive:true});
const errors=[];
const idea="I sell mascots and rent them out for weekend events. I want a website to accept orders and rental bookings.";
const solution={
  category:"commerce-rentals",title:"Online store + rental booking platform",
  projectType:"Booking website/system",
  features:["Mascot catalogue with Buy or Rent options","Rental booking calendar","Prevent double bookings","Admin dashboard"],
  question:"Do customers rent for single days, weekends or both?"
};
try {
 for(const view of [{width:1440,height:900},{width:440,height:956},{width:320,height:640}]){
  const context=await browser.newContext({viewport:view,reducedMotion:"reduce"});
  const page=await context.newPage();
  page.setDefaultTimeout(13000);
  page.on("pageerror",error=>errors.push(view.width+": "+error.message));
  const events=[],leads=[];
  await page.route("**/api/health",route=>route.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
  await page.route("**/api/site",route=>route.fulfill({status:503,contentType:"application/json",body:'{"message":"CMS temporary unavailable"}'}));
  await page.route("**/api/ai/status",route=>route.fulfill({status:200,contentType:"application/json",body:'{"enabled":true,"aiAvailable":true}'}));
  await page.route("**/api/ai/events",route=>{
    events.push(route.request().postDataJSON().event);
    return route.fulfill({status:202,contentType:"application/json",body:'{"ok":true}'});
  });
  await page.route("**/api/ai/advice",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    mode:"ai",reply:"Your customers should be able to buy mascots and book rental dates. Start with an online catalogue and rental availability.",solution
  })}));
  await page.route("**/api/ai/leads",route=>{
    leads.push(route.request().postDataJSON());
    return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({
      id:"1234567890abcdef12345678",saved:true,notification:"sent",customerNotification:"queued"
    })});
  });
  const response=await page.goto(base+"/ai-advisor/",{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(response.status(),200,"AI landing must load");
  const form=page.locator(".ai-input-form");
  await form.locator("textarea").fill(idea);
  await form.getByRole("button",{name:/Get free advice/}).click();
  await page.locator("[data-ai-brief]").waitFor({state:"visible"});
  await page.locator("[data-ai-brief]").click();
  const dialog=page.locator(".mdv-brief-dialog");
  await dialog.waitFor({state:"visible"});
  assert.equal(await dialog.locator('[data-stage="0"]').isVisible(),true);
  assert.match(await dialog.locator('input[name="title"]').inputValue(),/rental booking/i);
  assert.equal(await dialog.locator(".mdv-brief-feature").count(),4);
  // Customer edits the AI's suggested scope before submission.
  await dialog.locator('input[name="title"]').fill("Mascot sales and rentals website");
  await dialog.locator('input[name="newFeature"]').fill("Event venue delivery management");
  await dialog.locator("[data-add-feature]").click();
  assert.equal(await dialog.locator(".mdv-brief-feature").count(),5);
  await dialog.locator('[name="budget"]').selectOption("R5,000 – R15,000");
  await dialog.locator("[data-next]").click();
  await dialog.locator('[data-stage="1"]:visible').waitFor();
  await dialog.locator('input[name="name"]').fill("Example Visitor");
  await dialog.locator('input[name="email"]').fill("visitor@example.test");
  await dialog.locator("[data-next]").click();
  assert.match(await dialog.locator(".mdv-brief-feedback").innerText(),/consent/i);
  assert.equal(await dialog.locator('[data-stage="1"]').isVisible(),true);
  await dialog.locator('input[name="consent"]').check();
  await dialog.locator("[data-next]").click();
  await dialog.locator('[data-stage="2"]:visible').waitFor();
  assert.match(await dialog.locator(".mdv-brief-review").innerText(),/Event venue delivery management/);
  assert.match(await dialog.locator(".mdv-brief-review").innerText(),/visitor@example.test/);
  // Core geometry: full wizard inside viewport, content scrolls but footer stays.
  const geometry=await dialog.evaluate(el=>{
    const a=el.getBoundingClientRect(),body=el.querySelector(".mdv-brief-main").getBoundingClientRect(),
      footer=el.querySelector(".mdv-brief-footer").getBoundingClientRect();
    return {left:a.left,right:a.right,top:a.top,bottom:a.bottom,
      footer:footer.top,bodyBottom:body.bottom,outerScroll:el.scrollHeight-el.clientHeight};
  });
  assert.ok(geometry.left>=-1&&geometry.right<=view.width+1,"horizontal wizard fit");
  assert.ok(geometry.top>=-1&&geometry.bottom<=view.height+1,"vertical wizard fit");
  assert.ok(geometry.outerScroll<=2,"dialog itself must not scroll");
  assert.ok(geometry.footer>=geometry.bodyBottom-2,"footer is after content");
  await page.screenshot({path:"qa-screenshots/ai-lead-review-"+view.width+".png",animations:"disabled"});
  if(view.width!==320){
    const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
    const serious=audit.violations.filter(v=>v.impact==="serious"||v.impact==="critical");
    console.log("A11Y",view.width,JSON.stringify(serious.map(x=>({id:x.id,targets:x.nodes.slice(0,3).map(n=>n.target)}))));
    assert.equal(serious.length,0,"no serious accessibility issue");
  }
  await dialog.locator("[data-next]").click();
  await dialog.locator('[data-stage="3"]:visible').waitFor();
  assert.equal(leads.length,1);
  const payload=leads[0];
  assert.equal(payload.consent,true);
  assert.equal(payload.shareTranscript,false);
  assert.deepEqual(payload.transcript,[]);
  assert.equal(payload.brief.title,"Mascot sales and rentals website");
  assert.equal(payload.brief.budget,"R5,000 – R15,000");
  assert.ok(payload.brief.features.includes("Event venue delivery management"));
  assert.equal(payload.contact.email,"visitor@example.test");
  assert.match(await dialog.innerText(),/Project brief received!/);
  assert.ok(events.includes("idea_submitted")&&events.includes("brief_reviewed"));
  await page.screenshot({path:"qa-screenshots/ai-lead-success-"+view.width+".png",animations:"disabled"});
  await dialog.locator("[data-next]").click();
  assert.equal(await dialog.isVisible(),false);
  console.log("PASS AI BRIEF",JSON.stringify({width:view.width,consentChecked:true,submissions:1,events,geometry}));
  await context.close();
 }
 assert.deepEqual(errors,[]);
} finally {await browser.close();}
