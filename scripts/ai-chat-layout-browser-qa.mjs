import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const base=process.env.PREVIEW_URL || "https://6af43e86ffcad1c281e7749b--mzansi-digital-ventures.netlify.app";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
await mkdir("qa-screenshots",{recursive:true});
const errors=[];
function mock(page) {
  let posts=0;
  page.on("pageerror",e=>errors.push(e.message));
  return Promise.all([
    page.route("**/api/health",r=>r.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'})),
    page.route("**/api/site",r=>r.fulfill({status:503,contentType:"application/json",body:'{"message":"CMS in fallback mode"}'})),
    page.route("**/api/ai/status",r=>r.fulfill({status:200,contentType:"application/json",body:'{"enabled":true,"aiAvailable":false,"guidedAvailable":true}'})),
    page.route("**/api/ai/advice",async r=>{
      posts++;
      const payload=r.request().postDataJSON();
      assert.ok(payload.message.length>14);
      await new Promise(done=>setTimeout(done,95));
      await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        mode:"guided",
        reply:"For a South African mascot rental business, start with an easy-to-browse catalogue of products, a simple online booking and enquiry flow, a customer calendar and inventory management. Make it clear when each mascot is available. Build payments later once demand is validated. Ask customers which mascot, quantity, date, event location and preferred delivery method they need. This will help you assess a useful first version.",
        solution:{category:"commerce",title:"Online store and payments",projectType:"Online store",
          features:["Product catalogue and search","Shopping cart and checkout","Order and inventory management","Mobile-friendly storefront"]},
        notice:"Free guided recommendations are available."
      })});
    })
  ]).then(()=>({posts:()=>posts}));
}
try {
  for(const v of [
    {width:1715,height:900},
    {width:440,height:956},
    {width:390,height:844},
    {width:320,height:640},
    {width:900,height:520}
  ]) {
    const ctx=await browser.newContext({viewport:v,deviceScaleFactor:1,reducedMotion:"reduce"});
    const page=await ctx.newPage();
    page.setDefaultTimeout(12000);
    const spy=await mock(page);
    const response=await page.goto(base+"/contact/",{waitUntil:"domcontentloaded",timeout:90000});
    assert.equal(response.status(),200);
    await page.waitForFunction(()=>window.MDVService?.isReady(),{timeout:15000});
    const launcher=page.locator(".ai-advisor-launcher");
    assert.equal(await launcher.getAttribute("aria-label"),"Ask Mzansi AI Consultant");
    await launcher.click();
    const dialog=page.getByRole("dialog",{name:"Mzansi AI Consultant"});
    await dialog.waitFor({state:"visible"});
    await dialog.locator("[data-ai-status]").waitFor({state:"visible"});
    assert.equal(await launcher.getAttribute("aria-expanded"),"true");
    assert.equal(await page.evaluate(()=>document.body.classList.contains("ai-chat-modal-open")),true);
    const original=await page.evaluate(()=>document.scrollingElement.scrollTop);
    const getLayout=()=>page.evaluate(()=>{
      const dlg=document.querySelector(".ai-advisor-dialog");
      const header=dlg.querySelector(".ai-panel-header");
      const form=dlg.querySelector(".ai-input-form");
      const full=dlg.querySelector(".ai-widget-full");
      const chat=dlg.querySelector(".ai-chat-scroll");
      const content=dlg.querySelector(".ai-widget-content");
      const convo=dlg.querySelector(".ai-conversation");
      const b=el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,height:el.getBoundingClientRect().height});
      return {dialog:b(dlg),header:b(header),form:b(form),full:b(full),chat:b(chat),
        dialogScroll:dlg.scrollHeight-dlg.clientHeight,
        contentScroll:content.scrollHeight-content.clientHeight,
        formScroll:form.scrollHeight-form.clientHeight,
        chatOverflow:getComputedStyle(chat).overflowY,
        convoOverflow:getComputedStyle(convo).overflowY,
        contentOverflow:getComputedStyle(content).overflowY,
        chatScroll:chat.scrollHeight-chat.clientHeight,
        horizontal:document.documentElement.scrollWidth-innerWidth};
    });
    let layout=await getLayout();
    assert.ok(layout.dialog.left>=-1 && layout.dialog.right<=v.width+1,"dialog fits viewport");
    assert.ok(layout.dialog.top>=-1 && layout.dialog.bottom<=v.height+1,"dialog fits vertically");
    assert.ok(layout.dialogScroll<=2,"dialog must not scroll: "+JSON.stringify(layout));
    assert.ok(layout.contentScroll<=2,"widget content must not scroll: "+JSON.stringify(layout));
    assert.ok(layout.formScroll<=2,"composer must not scroll: "+JSON.stringify(layout));
    assert.equal(layout.chatOverflow,"auto","chat is the only scroll region");
    assert.equal(layout.convoOverflow,"visible");
    assert.equal(layout.contentOverflow,"hidden");
    assert.ok(layout.chat.top>=layout.header.bottom-2,"chat below header");
    assert.ok(layout.form.top>=layout.chat.bottom-2,"composer below chat");
    assert.ok(layout.form.bottom<=layout.full.top+2,"composer above footer");
    assert.ok(layout.horizontal<=2,"no horizontal overflow");
    assert.equal(await dialog.locator(".ai-widget-top").count(),0,"no duplicate header");
    assert.equal(await dialog.locator(".ai-suggestion").count(),4);
    await page.screenshot({path:"qa-screenshots/ai-chat-open-"+v.width+"x"+v.height+".png",animations:"disabled"});

    await dialog.locator(".ai-suggestion").nth(1).click();
    const form=dialog.locator(".ai-input-form");
    await form.getByRole("button",{name:/Get free advice/}).click();
    await dialog.locator(".ai-result:not([hidden])").waitFor({state:"visible",timeout:15000});
    assert.equal(spy.posts(),1);
    assert.equal(await dialog.locator(".ai-suggestions").isVisible(),false);
    assert.match(await dialog.locator(".ai-result").innerText(),/Online store and payments/);
    assert.equal(await dialog.locator(".ai-chat-scroll .ai-result").count(),1);
    assert.equal(await dialog.locator(".ai-conversation .ai-bubble").count(),3);
    await page.screenshot({path:"qa-screenshots/ai-chat-result-"+v.width+"x"+v.height+".png",animations:"disabled"});
    for(let i=0;i<5;i++){
      await form.locator("textarea").fill("I also want customers to book mascot rentals for upcoming events and manage their dates. Example "+i);
      await form.getByRole("button",{name:/Get free advice/}).click();
      await page.waitForFunction(n=>document.querySelectorAll(".ai-conversation .ai-bubble").length===n,5+2*i);
    }
    assert.equal(spy.posts(),6);
    layout=await getLayout();
    assert.ok(layout.chatScroll>20,"long conversations should scroll inside chat: "+JSON.stringify(layout));
    assert.ok(layout.dialogScroll<=2 && layout.contentScroll<=2,"only the chat area should scroll after long conversation");
    assert.ok(await form.getByRole("button",{name:/Get free advice/}).isVisible(),"send button stays visible");
    assert.ok(await dialog.getByRole("link",{name:/Open full AI playground/}).isVisible(),"footer link stays visible");
    const chat=dialog.locator(".ai-chat-scroll");
    await chat.evaluate(el=>{el.scrollTop=0});
    const center=await chat.boundingBox();
    await page.mouse.move(center.x+center.width/2,center.y+center.height/2);
    await page.mouse.wheel(0,360);
    await page.waitForTimeout(150);
    const actual=await chat.evaluate(el=>el.scrollTop);
    assert.ok(actual>0,"wheel scroll must move just chat content");
    assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),original,"body remains stationary while chat open");
    if(v.width===1715 || v.width===390){
      const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
      const serious=axe.violations.filter(x=>["serious","critical"].includes(x.impact));
      console.log("A11Y",v.width,JSON.stringify(serious.map(x=>({id:x.id,targets:x.nodes.slice(0,3).map(n=>n.target)}))));
      assert.equal(serious.length,0,"no serious modal accessibility issue");
    }
    await page.screenshot({path:"qa-screenshots/ai-chat-long-"+v.width+"x"+v.height+".png",animations:"disabled"});
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(),false);
    await page.waitForFunction(()=>document.querySelector(".ai-advisor-launcher")?.getAttribute("aria-expanded")==="false" && !document.body.classList.contains("ai-chat-modal-open"));
    assert.equal(await launcher.getAttribute("aria-expanded"),"false");
    assert.equal(await launcher.isVisible(),true);
    await launcher.click();
    assert.equal(await dialog.locator(".ai-conversation .ai-bubble").count(),13,"reopening preserves conversation");
    await dialog.locator(".ai-widget-close").click();
    console.log("PASS CHAT LAYOUT",JSON.stringify({viewport:v,requests:spy.posts(),singleScroll:true,bubbles:13,overflow:layout.horizontal}));
    await ctx.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
