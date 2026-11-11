import {chromium} from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const url=process.env.PREVIEW_URL || "https://6af42d5881959ddb11b7864d--mzansi-digital-ventures.netlify.app";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
await mkdir("qa-screenshots",{recursive:true});
const violations=[];
async function contextAt(width){
  const ctx=await browser.newContext({viewport:{width,height:width===440?956:850},reducedMotion:"reduce"});
  const page=await ctx.newPage();
  page.on("pageerror",e=>violations.push({width,message:e.message}));
  await page.route("**/api/health",route=>route.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
  await page.route("**/api/site",route=>route.fulfill({status:503,contentType:"application/json",body:'{"message":"CMS temporarily offline"}'}));
  await page.route("**/api/admin/**",route=>route.fulfill({status:200,contentType:"application/json",body:'{"email":"qa@example.test","role":"admin","items":[],"clients":[],"data":[],"templates":[]}'}));
  return {ctx,page};
}
function triggerFor(page,selector){
  return page.locator(selector).locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," mdv-select-field ")]').locator(".mdv-select-trigger");
}
async function clickOption(page,value) {
  const dialog=page.locator(".mdv-select-dialog");
  await dialog.getByRole("option",{name:value,exact:true}).click();
}
try {
  for(const width of [1440,440,320]){
    const {ctx,page}=await contextAt(width);
    const response=await page.goto(url+"/contact/",{waitUntil:"domcontentloaded",timeout:90000});
    assert.equal(response.status(),200);
    await page.waitForFunction(()=>window.MDVSelects?.covered()===3,{timeout:12000});
    // Exclude Project Type because it already has its own richer selector.
    assert.equal(await page.locator("#projectTypeNative").evaluate(el=>el.classList.contains("mdv-select-native")),false);
    assert.equal(await page.locator("#projectTypeTrigger").isVisible(),true);
    const budget=triggerFor(page,'select[name="budget"]');
    assert.equal(await budget.count(),1);
    assert.equal(await budget.isVisible(),true);
    await budget.click();
    const dialog=page.locator(".mdv-select-dialog");
    assert.equal(await dialog.isVisible(),true);
    const bounds=await dialog.boundingBox();
    assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,"popover/sheet must fit viewport "+width+": "+JSON.stringify(bounds));
    assert.equal(await dialog.getAttribute("aria-modal"),"true");
    if(width===440||width===320) {
      const dimension=await dialog.evaluate(el=>({height:el.getBoundingClientRect().height,visible:window.innerHeight,scrollHeight:el.querySelector(".mdv-select-options").scrollHeight,clientHeight:el.querySelector(".mdv-select-options").clientHeight}));
      assert.ok(dimension.height<=dimension.visible+1);
      assert.ok(dimension.scrollHeight>=dimension.clientHeight,"options list must fit its content");
      const scrollMode=await dialog.locator(".mdv-select-options").evaluate(el=>getComputedStyle(el).overflowY);
      assert.equal(scrollMode,"auto","long option lists should have internal scrolling");
    }
    await dialog.locator('input[type="search"]').fill("5,000");
    const candidates=await dialog.getByRole("option").count();
    assert.ok(candidates>=1,"filtered budget option remains");
    await clickOption(page,"R2,500 – R5,000");
    assert.equal(await page.locator('select[name="budget"]').inputValue(),"R2,500 – R5,000");
    assert.equal(await dialog.isVisible(),false);
    assert.equal(await budget.getAttribute("aria-expanded"),"false");
    // Contact-method onchange must still reveal meeting details.
    await triggerFor(page,'select[name="contactMethod"]').click();
    await clickOption(page,"Meeting request");
    assert.equal(await page.locator("#meetingPreferences").isVisible(),true);
    assert.equal(await page.locator('select[name="contactMethod"]').inputValue(),"Meeting request");
    await triggerFor(page,'select[name="contactMethod"]').click();
    await clickOption(page,"Email");
    assert.equal(await page.locator("#meetingPreferences").isVisible(),false);

    await triggerFor(page,'select[name="timeline"]').click();
    await clickOption(page,"2–4 weeks");
    assert.equal(await page.locator('select[name="timeline"]').inputValue(),"2–4 weeks");
    const formData=await page.evaluate(()=>Object.fromEntries(new FormData(document.querySelector("#contactForm")).entries()));
    assert.equal(formData.budget,"R2,500 – R5,000");
    assert.equal(formData.contactMethod,"Email");
    assert.equal(formData.timeline,"2–4 weeks");

    if(width!==320){
      await budget.click();
      const report=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
      const serious=report.violations.filter(v=>["serious","critical"].includes(v.impact));
      console.log("A11Y",width,JSON.stringify(serious.map(v=>({id:v.id,description:v.description,nodes:v.nodes.slice(0,6).map(n=>({target:n.target,summary:n.failureSummary?.slice(0,200)}))}))));
      assert.equal(serious.length,0,"accessibility violations on "+width);
      await page.keyboard.press("Escape");
      assert.equal(await dialog.isVisible(),false);
    }
    // Browser's native select must remain available with JS disabled.
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=1,"horizontal page overflow "+overflow);
    await page.screenshot({path:"qa-screenshots/dropdown-contact-"+width+".png",fullPage:true,animations:"disabled"});
    console.log("PUBLIC SELECTS",JSON.stringify({width,count:3,fit:true,events:true,formData:true,overflow}));
    await ctx.close();
  }
  // Dynamically added and repopulated options must enhance; nested admin dialogs
  // must display their picker on top of the existing modal.
  {
    const {ctx,page}=await contextAt(440);
    await page.goto(url+"/contact/",{waitUntil:"domcontentloaded",timeout:90000});
    await page.waitForFunction(()=>window.MDVSelects?.covered()>=3);
    await page.evaluate(()=>{
      const modal=document.createElement("dialog");
      modal.id="qaAdminModal";
      modal.innerHTML='<form><label>CRM status<select id="qaDynamicStatus" required><option value="">Select status</option><option value="lead">Lead</option><option value="active">Active</option></select></label></form>';
      document.body.appendChild(modal);
      modal.showModal();
      window.__qaChangeCount=0;
      document.getElementById("qaDynamicStatus").addEventListener("change",()=>window.__qaChangeCount++);
    });
    const dynamic=triggerFor(page,"#qaDynamicStatus");
    await dynamic.waitFor({state:"visible",timeout:10000});
    await dynamic.click();
    assert.equal(await page.locator(".mdv-select-dialog").isVisible(),true);
    await clickOption(page,"Active");
    assert.equal(await page.locator("#qaDynamicStatus").inputValue(),"active");
    assert.equal(await page.evaluate(()=>window.__qaChangeCount),1);
    assert.equal(await page.locator("#qaAdminModal").evaluate(el=>el.open),true,"parent admin dialog must stay open");
    await page.locator("#qaDynamicStatus").evaluate(select=>{
      select.innerHTML='<option value="closed">Closed</option><option value="done">Done</option>';
    });
    await page.waitForFunction(()=>document.querySelector("#qaDynamicStatus")?.nextElementSibling?.textContent?.includes("Closed")||document.querySelector("#qaDynamicStatus")?.closest(".mdv-select-field")?.querySelector(".mdv-select-trigger")?.textContent?.includes("Closed"));
    await dynamic.click();
    await clickOption(page,"Done");
    assert.equal(await page.locator("#qaDynamicStatus").inputValue(),"done");
    assert.equal(await page.evaluate(()=>window.__qaChangeCount),2);
    console.log("DYNAMIC + NESTED ADMIN DIALOG PASS");
    await ctx.close();
  }
  {
    const {ctx,page}=await contextAt(1440);
    await page.goto(url+"/admin/dashboard/",{waitUntil:"domcontentloaded",timeout:90000});
    const status=triggerFor(page,"#statusFilter");
    await status.waitFor({state:"visible",timeout:10000});
    await status.click();
    await clickOption(page,"Quoted");
    assert.equal(await page.locator("#statusFilter").inputValue(),"quoted");
    console.log("ADMIN DASHBOARD FILTER PASS");
    await ctx.close();
  }
  {
    const ctx=await browser.newContext({javaScriptEnabled:false,viewport:{width:440,height:956}});
    const page=await ctx.newPage();
    await page.goto(url+"/contact/",{waitUntil:"domcontentloaded",timeout:90000});
    assert.equal(await page.locator('select[name="budget"]').isVisible(),true);
    console.log("NATIVE SELECT FALLBACK PASS");
    await ctx.close();
  }
  assert.deepEqual(violations.filter(e=>e.width===440||e.width===320||e.width===1440),[]);
} finally {
  await browser.close();
}
