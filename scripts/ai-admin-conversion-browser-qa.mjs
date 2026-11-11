import {chromium} from "playwright";
import assert from "node:assert/strict";
const base=process.env.PREVIEW_URL || "https://6af4540ad9fee5cd23bbd03d--mzansi-digital-ventures.netlify.app";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const client="visitor@example.test",id="1234567890abcdef12345678",documentId="abcdef1234567890abcdef12";
const profile={_id:client,email:client,name:"Example Visitor",businessName:"Mascot Shop",phone:"",
 projectStatus:"lead",priority:"normal",lastLeadSource:"ai_advisor",followUpDate:"",notes:""};
const lead={_id:id,source:"ai_advisor",email:client,name:"Example Visitor",projectType:"Booking website/system",
 aiBrief:{title:"Mascot sales and rental platform",description:"I sell and rent mascot costumes.",
   features:["Mascot catalogue with Buy and Rent","Rental calendar and availability","Admin dashboard"]},
 createdAt:"2026-11-11T10:00:00Z",message:"Reviewed mascot project brief.",status:"new",emailStatus:"sent"};
let draftCount=0,updates=[],errors=[];
const doc={_id:documentId,clientId:client,clientName:"Example Visitor",
 kind:"quotation",number:"Q-2026-00421",status:"draft",revision:1,createdAt:"2026-11-11T10:00:00Z",
 items:[{description:"Mascot catalogue with Buy and Rent",quantity:1,unitPriceCents:0,lineCents:0},
        {description:"Rental booking calendar",quantity:1,unitPriceCents:0,lineCents:0}],
 taxRateBp:0,notes:"AI assisted draft",totalCents:0,subtotalCents:0,validUntil:"",dueDate:""};
async function setup(page){
 page.on("pageerror",e=>errors.push(e.message));
 page.setDefaultTimeout(14000);
 await page.route("**/api/health",r=>r.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
 await page.route("**/api/admin/**",async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname.replace("/api/admin","");
   let body={};
   if(path==="/auth/me")body={authenticated:true,role:"admin"};
   else if(path.startsWith("/crm/clients/")&&req.method()==="GET")
     body={profile,enquiries:[lead],documents:[],activity:[]};
   else if(path==="/crm/clients")body={items:[profile],total:1,page:1,limit:25};
   else if(path==="/crm/follow-ups")body={items:[]};
   else if(path==="/crm/metrics")body={clients:1,dueFollowUps:0};
   else if(path==="/ai/leads/"+id+"/quotation-draft"){
     draftCount++;
     body={document:doc,existing:draftCount>1,message:"Quotation draft ready"};
   }else if(path==="/documents/"+documentId){
     if(req.method()==="PATCH"){
       updates.push(req.postDataJSON());
       body={document:{...doc,...updates.at(-1),revision:2,totalCents:250000},
         message:"Draft updated"};
     }else body={document:doc};
   }else if(path==="/documents")body={items:[doc]};
   else if(path==="/ai/analytics")body={
     periodDays:30,totals:{opened:42,idea_submitted:29,brief_reviewed:13,
       lead_submitted:7,quotation_drafted:4,quotation_sent:3,converted:2},
     rates:{ideasPerOpen:69,leadsPerIdea:24.1,leadsPerReview:53.8,quotesPerLead:57.1},
     daily:[]
   };
   else if(path==="/stats")body={enquiries:1,newEnquiries:1,requestedMeetings:0,converted:0};
   else if(path==="/enquiries")body={items:[lead],total:1,page:1,limit:25};
   else if(path==="/meetings")body={items:[]};
   else if(path==="/email/config")body={configured:true,missing:[],sandboxSender:false};
   else if(path==="/email/deliveries")body={items:[],summary:[]};
   else if(path==="/operations/health")body={status:"ok",database:"connected",
     resendConfigured:true,cloudinaryConfigured:true,webhookConfigured:true,retryWorkerConfigured:true};
   else if(path==="/crm/activity")body={items:[]};
   else body={};
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
 });
}
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:"reduce"});
 const page=await ctx.newPage();await setup(page);
 await page.goto(base+"/admin/crm/?source=ai_advisor",{waitUntil:"domcontentloaded",timeout:90000});
 await page.locator("#crmRows [data-client]").first().waitFor({state:"visible",timeout:18000});
 await page.locator("#crmLeadSource").selectOption("ai_advisor");
 await page.locator("#crmFilters button[type='submit']").click();
 assert.match(await page.locator("#crmRows").innerText(),/Example Visitor/);
 await page.locator("#crmRows [data-client]").first().click();
 await page.locator("#clientDialog").waitFor({state:"visible"});
 const quote=page.locator("[data-ai-quote-id]");
 await quote.waitFor({state:"visible"});
 assert.match(await quote.innerText(),/Create quotation draft from AI brief/);
 await quote.click();
 await page.waitForURL(/\/admin\/documents\/\?client=/,{timeout:15000});
 assert.equal(draftCount,1,"new quotation draft must be created exactly once");
 await page.locator('#docCreate').waitFor({state:"visible"});
 await page.waitForFunction(()=>document.getElementById("docCreate")?.textContent==="Save draft changes",{timeout:15000});
 assert.equal(await page.locator("#docClient").inputValue(),client);
 assert.equal(await page.locator("[data-line-description]").count(),2);
 assert.equal(await page.locator("#docKind").inputValue(),"quotation");
 await page.locator("[data-line-price]").first().fill("2500.00");
 await page.locator("#docCreate").click();
 await page.waitForFunction(()=>document.getElementById("docCreate")?.textContent==="Create draft document");
 assert.equal(updates.length,1);
 assert.equal(updates[0].items[0].unitPriceCents,250000);
 assert.equal(updates[0].items[1].unitPriceCents,0);
 assert.equal(updates[0].kind,"quotation");
 assert.equal(await page.locator("#docCancelEdit").isVisible(),false);
 console.log("PASS CRM AND QUOTATION DRAFT",JSON.stringify({draftCount,updates:updates.length,priceCents:updates[0].items[0].unitPriceCents}));
 await ctx.close();

 const ctx2=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 const dashboard=await ctx2.newPage();await setup(dashboard);
 await dashboard.goto(base+"/admin/dashboard/",{waitUntil:"domcontentloaded",timeout:90000});
 await dashboard.locator("#dashboard").waitFor({state:"visible",timeout:16000});
 await dashboard.waitForFunction(()=>document.querySelectorAll("#aiConversionKpis article").length>=7,{timeout:14000});
 assert.match(await dashboard.locator("#aiConversionKpis").innerText(),/42/);
 assert.match(await dashboard.locator("#aiConversionKpis").innerText(),/Leads submitted/);
 assert.match(await dashboard.locator("#aiConversionRates").innerText(),/53.8%/);
 await dashboard.locator("#sourceFilter").selectOption("ai_advisor");
 await dashboard.locator("#searchButton").click();
 assert.match(await dashboard.locator("#enquiryRows").innerText(),/AI Consultant/);
 await dashboard.locator("#enquiryRows [data-id]").first().click();
 await dashboard.locator("#leadDialog").waitFor({state:"visible"});
 assert.equal(await dashboard.locator("#leadAiActions").isVisible(),true);
 assert.match(await dashboard.locator("#leadAiDraft").innerText(),/Create prefilled quotation/);
 console.log("PASS ADMIN ANALYTICS",JSON.stringify({mobile:390,sourceFilter:true,metrics:7,aiLeadActions:true}));
 await ctx2.close();
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
