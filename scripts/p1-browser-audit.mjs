import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";

const base=process.env.AUDIT_BASE_URL||
  "https://mzansi-digital-ventures.netlify.app";
const sampleEmail="example.qa@example.org";
const site={
 revision:3,
 company:{name:"Mzansi Digital Ventures (Pty) Ltd",shortName:"Mzansi Digital Ventures",
   email:"test@example.org",whatsapp:"",location:"Gauteng, South Africa",
   logoUrl:"/brand-mark.svg",accentColor:"#087d9f"},
 home:{eyebrow:"QA TEST HEADER",heading:"A reliable studio",highlight:"for business",
   description:"Professional applications and software.",buttonText:"Contact us"},
 about:{heading:"About",highlight:"our work",intro:"Building software.",
   missionHeading:"Our mission",missionHighlight:"is value",missionDescription:"Help businesses"},
 services:[{id:"web",title:"Web services",category:"Websites",description:"Professional websites",visible:true}],
 pricing:[{id:"web",group:"web",name:"Starter",heading:"Start here",price:"R1000",
   features:["Responsive design"],visible:true}],
 projects:[],
 sections:{services:true,portfolio:true,pricing:true,process:true,about:true,contact:true},
 siteConfig:{
  seo:Object.fromEntries(["home","services","portfolio","pricing","process","about","contact"].map(k=>
    [k,{title:"QA Page "+k,description:"A test description for "+k,robots:"index,follow",imageUrl:""}])),
  navigation:[{id:"contact",label:"Contact",href:"/contact/",visible:true}],
  footer:{description:"QA footer copy",contactHeading:"Talk to us",showEmail:true,
    links:[{id:"contact",label:"Contact",href:"/contact/",visible:true}]},
  testimonials:[{id:"test-a",name:"Test Customer",role:"QA",quote:"Verified placeholder for UI test",visible:true}],
  faqs:[{id:"test-q",question:"How does testing work?",answer:"With browser automation.",visible:true}],
  homepageSections:[{id:"test-section",heading:"QA testing section",
    description:"Rendered from the database mock.",ctaText:"Talk to us",href:"/contact/",visible:true}],
  design:{accentColor:"#087d9f",backgroundColor:"#ffffff",textColor:"#132f46",buttonRadius:8}
 }
};
const client={_id:sampleEmail,email:sampleEmail,name:"Browser QA Client",businessName:"QA Business",
  phone:"",notes:"",followUpDate:"",projectStatus:"lead",priority:"normal"};
const messages=[];
const a11yFindings=[];
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
async function pageFor(mobile=false){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:900},reducedMotion:"reduce"});
 const page=await context.newPage();
 page.on("pageerror",err=>messages.push(err.message));
 page.on("console",m=>{if(m.type()==="error")messages.push(m.text());});
 await page.route("**/api/health",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"ok"})}));
 await page.route("**/api/site",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({site})}));
 await page.route("**/api/admin/**",r=>{
  const u=new URL(r.request().url()),path=u.pathname.replace("/api/admin","");
  const method=r.request().method();let status=200,data={};
  if(path==="/site"){
    data=method==="GET"?{site}:{site:{...r.request().postDataJSON().site,revision:4}};
  }else if(path==="/crm/clients"){
    data={items:[client],total:1,page:1,limit:25};
  }else if(path==="/crm/follow-ups"){
    data={items:[]};
  }else if(path==="/crm/metrics"){
    data={clients:1,dueFollowUps:0};
  }else if(path.startsWith("/crm/clients/")){
    data=method==="PATCH"?{profile:client}:{profile:client,enquiries:[],documents:[],activity:[]};
  }else if(path==="/documents"){
    if(method==="POST"){
      const payload=r.request().postDataJSON();
      assert.equal(payload.clientId,sampleEmail);
      assert.equal(payload.items[0].unitPriceCents,12345);
      status=201;data={document:{_id:"507f1f77bcf86cd799439011",number:"Q-2026-00001",status:"draft"}};
    }else data={items:[]};
  }else if(path.endsWith("/pdf")){
    return r.fulfill({status:200,contentType:"application/pdf",
      body:Buffer.concat([Buffer.from("%PDF-1.4\n"),Buffer.alloc(2048,32)])});
  }else{
    status=404;data={message:"Test route not mocked"};
  }
  return r.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
 });
 return page;
}
async function axe(page,label){
 const report=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
 const severe=report.violations.filter(v=>["critical","serious"].includes(v.impact));
 console.log("ACCESSIBILITY",label,JSON.stringify({violations:report.violations.map(v=>({
  id:v.id,impact:v.impact,affected:v.nodes.length
 }))}));
 if(severe.length)console.log("ACCESSIBILITY DETAILS",label,JSON.stringify(severe.map(v=>({
  id:v.id,nodes:v.nodes.slice(0,14).map(n=>({
    target:n.target,summary:n.failureSummary?.slice(0,550),html:n.html?.slice(0,180)
  }))
 }))));
 // Continue auditing other screens so a single inherited issue does not hide others.
 a11yFindings.push({label,serious:severe.map(v=>({id:v.id,affected:v.nodes.length}))});
}
try{
 const desktop=await pageFor();
 let response=await desktop.goto(base+"/",{waitUntil:"domcontentloaded",timeout:85000});
 assert.equal(response.status(),200);
 await desktop.getByRole("heading",{name:"A reliable studio for business"}).waitFor();
 await desktop.getByText("How does testing work?").waitFor();
 assert.equal(await desktop.title(),"QA Page home");
 assert.ok((await desktop.locator(".cms-testimonial-grid blockquote").count())===1);
 assert.ok((await desktop.locator("#primaryNav a[href='/contact/']").count())===1);
 await axe(desktop,"desktop-public");
 console.log("PASS public SEO, safe CMS hydration, CTA, FAQ and testimonials");
 await desktop.goto(base+"/admin/crm/",{waitUntil:"domcontentloaded",timeout:85000});
 await desktop.getByRole("button",{name:"Open profile"}).waitFor();
 await desktop.getByRole("button",{name:"Open profile"}).first().click();
 await desktop.locator("#clientDialog").waitFor({state:"visible",timeout:10000});
 assert.equal(await desktop.locator("#clientDialog").isVisible(),true);
 await desktop.locator("#clientDialog").getByRole("button",{name:"Close"}).click();
 await axe(desktop,"desktop-crm");
 console.log("PASS client CRM profile and keyboard-accessible dialog");
 await desktop.goto(base+"/admin/documents/",{waitUntil:"domcontentloaded",timeout:85000});
 await desktop.waitForTimeout(1200);
 const docOptions=await desktop.locator("#docClient option").count();
 console.log("DOCUMENT LOAD DIAGNOSTICS",JSON.stringify({
   options:docOptions,feedback:await desktop.locator("#bizFeedback").innerText(),
   errors:messages.slice(-5)
 }));
 assert.ok(docOptions>=2,"Document builder must load the available CRM clients");
 await desktop.locator("#docClient").selectOption(sampleEmail);
 await desktop.locator("[data-line-description]").first().fill("Website development");
 await desktop.locator("[data-line-price]").first().fill("123.45");
 assert.match(await desktop.locator("#docTotal").innerText(),/123\.45/);
 await axe(desktop,"desktop-documents");
 await desktop.locator("#docCreate").click();
 await desktop.getByText("Q-2026-00001 created as a draft.").waitFor();
 console.log("PASS document builder creates expected cents payload");
 await desktop.goto(base+"/admin/site-settings/",{waitUntil:"domcontentloaded",timeout:85000});
 await desktop.locator("#seoTitle").waitFor();
 assert.equal(await desktop.locator("#seoTitle").inputValue(),"QA Page home");
 await desktop.locator("#seoTitle").fill("New QA SEO title");
 await desktop.locator("#settingsPublish").click();
 await desktop.getByText("Website settings published").waitFor();
 await axe(desktop,"desktop-website-settings");
 console.log("PASS website settings publish and version handling");
 await desktop.close();

 const mobile=await pageFor(true);
 await mobile.goto(base+"/",{waitUntil:"domcontentloaded",timeout:85000});
 await mobile.locator(".nav-toggle").click();
 assert.equal(await mobile.locator(".mobile-admin-access").isVisible(),true);
 await mobile.goto(base+"/admin/crm/",{waitUntil:"domcontentloaded",timeout:85000});
 await mobile.locator("#crmRows tr").first().waitFor();
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+8);
 assert.equal(overflow,false,"No unexpected mobile page-level horizontal scrolling");
 await axe(mobile,"mobile-crm");
 await mobile.goto(base+"/admin/documents/",{waitUntil:"domcontentloaded",timeout:85000});
 await mobile.locator("#docItems tr").first().waitFor();
 const bad=await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+8);
 assert.equal(bad,false,"Mobile document screen must keep horizontal tables contained");
 console.log("PASS mobile navigation, CRM and documents layout");
 await mobile.close();
 if(messages.length)console.log("BROWSER JS CONSOLE ERRORS",JSON.stringify(messages));
 assert.equal(messages.filter(s=>/Uncaught|TypeError|ReferenceError|SyntaxError/.test(s)).length,0);
 const failures=a11yFindings.filter(x=>x.serious.length>0);
 if(failures.length)console.log("WCAG AUDIT FINDINGS",JSON.stringify(failures));
 assert.equal(failures.length,0,"No serious or critical accessibility issues expected in deployed UI");
 console.log("P1 browser audit passed.");
}finally{await browser.close();}
