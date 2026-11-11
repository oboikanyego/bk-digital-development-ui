import {chromium} from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const root=process.env.PREVIEW_URL||"https://6af461617efac61cdbabe965--mzansi-digital-ventures.netlify.app";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
await mkdir("qa-screenshots",{recursive:true});
const errors=[];
const aiReply={
 mode:"ai",
 reply:"For selling and renting mascots, I recommend a combined online store and rental booking platform. Customers can buy or rent, check available dates and ask for delivery. Do you rent by the day or weekend?",
 solution:{category:"commerce-rentals",title:"Online store + rental booking platform",projectType:"Booking website/system",
  features:["Mascot catalogue with Buy and Rent options","Rental availability calendar and double-booking prevention",
   "Payments and deposits","Admin dashboard for rentals and sales"],
  steps:["Confirm rental rules","Build an MVP"],question:"Do customers rent for individual days or weekends?"}
};
const leadId="abcdef0123456789abcdef01",docId="1234567890abcdef12345678";
const brief={
 title:"Mascot Sales & Rental Platform",
 description:"I sell mascots and rent them for parties and events, with day and weekend bookings.",
 summary:aiReply.reply,projectType:"Booking website/system",
 budget:"Not sure yet",timeline:"Flexible",notes:"",features:aiReply.solution.features,
 openQuestions:[aiReply.solution.question]
};
const client={
 _id:"qa@example.test",name:"QA Mascot Customer",email:"qa@example.test",
 businessName:"Mascot Magic",lastLeadSource:"ai_advisor",
 projectStatus:"lead",priority:"normal",phone:"",notes:"",followUpDate:null
};
const enquiry={_id:leadId,email:client.email,name:client.name,status:"new",source:"ai_advisor",
 projectType:brief.projectType,message:"AI project description",aiBrief:brief,createdAt:new Date().toISOString(),
 aiTranscriptConsent:false};
const doc={_id:docId,number:"Q-2026-0007",kind:"quotation",status:"draft",
 clientId:client.email,clientName:client.name,enquiryId:leadId,
 items:brief.features.map(description=>({description,quantity:1,unitPriceCents:0})),
 taxRateBp:0,notes:"AI-assisted quotation draft — REVIEW SCOPE AND PRICE BEFORE SENDING.",
 validUntil:"",dueDate:"",totalCents:0,revision:1};
function common(page){
 page.on("pageerror",e=>errors.push(e.message));
 return Promise.all([
  page.route("**/api/health",r=>r.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'})),
  page.route("**/api/site",r=>r.fulfill({status:503,contentType:"application/json",body:"{}"})),
  page.route("**/api/ai/status",r=>r.fulfill({status:200,contentType:"application/json",body:'{"aiAvailable":true,"enabled":true}'})),
  page.route("**/api/ai/advice",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(aiReply)}))
 ]);
}
try{
 for(const width of [1440,440,320]){
  const ctx=await browser.newContext({viewport:{width,height:width===440?956:width===320?700:900},reducedMotion:"reduce"});
  const page=await ctx.newPage();page.setDefaultTimeout(12000);
  let leadPosts=0,lastPayload=null;
  const events=[];
  await common(page);
  await page.route("**/api/ai/events",r=>{
    events.push(r.request().postDataJSON().event);
    return r.fulfill({status:202,contentType:"application/json",body:'{"ok":true}'});
  });
  await page.route("**/api/ai/leads",r=>{
    leadPosts++;lastPayload=r.request().postDataJSON();
    return r.fulfill({status:201,contentType:"application/json",body:JSON.stringify({
      id:leadId,saved:true,notification:"sent",customerNotification:"queued",
      message:"Your project brief has been received."
    })});
  });
  const response=await page.goto(root+"/ai-advisor/",{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>Boolean(window.MDVAILeadWizard));
  await page.locator(".ai-input-form textarea").fill("I sell mascots and rent mascot costumes for parties and events, and need a booking website.");
  await page.locator(".ai-input-form button[type=submit]").click();
  await page.locator(".ai-result:not([hidden])").waitFor();
  await page.locator("[data-ai-review]").click();
  const dialog=page.getByRole("dialog",{name:"Review and submit your AI project brief"});
  await dialog.waitFor({state:"visible"});
  assert.match(await dialog.locator(".aiw-title").innerText(),/Review your AI project brief/);
  assert.equal(leadPosts,0,"no CRM submission before consent");
  assert.equal(await dialog.locator('input[name=feature]:checked').count(),4);
  assert.equal(await dialog.locator('input[name=title]').inputValue(),brief.title);
  await dialog.locator('textarea[name=description]').fill("I sell mascot costumes and rent them for birthday parties and school events. Weekend rentals are essential.");
  await page.screenshot({path:"qa-screenshots/ai-brief-review-"+width+".png",animations:"disabled"});
  await dialog.getByRole("button",{name:/Continue to contact details/}).click();
  await dialog.locator('input[name=name]').fill(client.name);
  await dialog.locator('input[name=businessName]').fill(client.businessName);
  await dialog.locator('input[name=email]').fill(client.email);
  assert.equal(leadPosts,0,"still no CRM submission until consented");
  await dialog.locator('input[name=consent]').check();
  if(width===1440)await dialog.locator('input[name=shareTranscript]').check();
  await dialog.getByRole("button",{name:/Review submission/}).click();
  assert.match(await dialog.locator(".aiw-title").innerText(),/Ready to submit/);
  await page.screenshot({path:"qa-screenshots/ai-brief-confirm-"+width+".png",animations:"disabled"});
  const box=await dialog.boundingBox();
  assert.ok(box.x>=-1 && box.x+box.width<=width+1,"dialog must fit width");
  const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(horizontal<=2,"page overflow "+horizontal);
  if(width!==320){
    const report=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
    const serious=report.violations.filter(x=>["serious","critical"].includes(x.impact));
    console.log("A11Y",width,JSON.stringify(serious.map(x=>({id:x.id,targets:x.nodes.slice(0,4).map(n=>n.target)}))));
    assert.equal(serious.length,0);
  }
  await dialog.getByRole("button",{name:/Submit project brief/}).click();
  await dialog.getByText("Your project brief has been received").waitFor();
  assert.equal(leadPosts,1);
  assert.equal(lastPayload.consent,true);
  assert.equal(lastPayload.brief.projectType,"Booking website/system");
  assert.match(lastPayload.brief.description,/Weekend rentals are essential/);
  assert.equal(lastPayload.contact.email,client.email);
  assert.equal(lastPayload.shareTranscript,width===1440);
  assert.ok(lastPayload.submissionId.match(/^[0-9a-f-]{36}$/i));
  assert.equal(lastPayload.brief.features.length,4);
  if(width!==1440)assert.ok(!("transcript" in lastPayload),"no transcript without opt in");
  assert.ok(events.includes("opened")&&events.includes("idea_submitted")&&events.includes("brief_reviewed"));
  await dialog.getByRole("button",{name:"Close",exact:true}).click();
  console.log("PUBLIC WIZARD PASS",width,JSON.stringify({leadPosts,consent:true,transcript:width===1440,events}));
  await ctx.close();
 }
 // Desktop admin test with mocked authenticated API to avoid sending production data.
 {
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await ctx.newPage();page.setDefaultTimeout(12000);
  await common(page);
  await page.route("**/api/admin/**",async r=>{
    const uri=new URL(r.request().url()),p=uri.pathname,method=r.request().method();
    let payload={};
    if(p.includes("/crm/clients/") && method==="GET")payload={profile:client,enquiries:[enquiry],documents:[],activity:[]};
    else if(p.endsWith("/crm/clients"))payload={items:[client],total:1,page:1,limit:25};
    else if(p.endsWith("/crm/follow-ups"))payload={items:[]};
    else if(p.endsWith("/crm/metrics"))payload={clients:1,dueFollowUps:0};
    else if(p.endsWith("/auth/me"))payload={authenticated:true};
    else if(p.includes("/quotation-draft") && method==="POST")payload={document:doc,message:"Quotation draft created."};
    else if(p.endsWith("/documents") && method==="GET")payload={items:[doc]};
    else if(p.endsWith("/documents/"+docId) && method==="GET")payload={document:doc};
    else if(p.endsWith("/documents/"+docId) && method==="PATCH"){
      const updated=r.request().postDataJSON();
      assert.ok(updated.items.some(x=>x.unitPriceCents>0));
      payload={document:{...doc,...updated},message:"Draft updated."};
    }else payload={items:[],data:[],totals:{},summary:[]};
    await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload)});
  });
  await page.goto(root+"/admin/crm/?source=ai_advisor&client="+encodeURIComponent(client.email),{waitUntil:"domcontentloaded",timeout:90000});
  await page.locator("#crmRows [data-client]").waitFor();
  assert.equal(await page.locator("#crmSource").inputValue(),"ai_advisor");
  const clientDialog=page.locator("#clientDialog");
  await clientDialog.waitFor({state:"visible"});
  assert.match(await clientDialog.innerText(),/Mascot Sales & Rental Platform/);
  await clientDialog.getByText("View customer-reviewed AI brief").click();
  assert.match(await clientDialog.innerText(),/Rental availability calendar/);
  await clientDialog.getByRole("button",{name:/Prepare AI quotation draft/}).click();
  await page.waitForURL(/\/admin\/documents\/\?edit=/);
  const editDialog=page.locator("#docEditDialog");
  await editDialog.waitFor({state:"visible"});
  assert.equal(await editDialog.locator('input[data-edit-price]').count(),4);
  await editDialog.locator('input[data-edit-price]').first().fill("3500.00");
  await editDialog.getByRole("button",{name:"Save reviewed prices"}).click();
  await editDialog.waitFor({state:"hidden"});
  assert.match(await page.locator("#bizFeedback").innerText(),/Draft updated/);
  console.log("ADMIN CRM + QUOTE EDIT PASS");
  await ctx.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
