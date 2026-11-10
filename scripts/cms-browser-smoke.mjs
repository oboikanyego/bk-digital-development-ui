import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.CMS_BASE_URL || "https://mzansi-digital-ventures.netlify.app";
const fixture = {
  revision:1,
  company:{name:"Mzansi Digital Ventures (Pty) Ltd",shortName:"Mzansi Digital Ventures",email:"info@example.com",whatsapp:"27790000000",location:"Gauteng, South Africa",logoUrl:"/brand-mark.svg",accentColor:"#087d9f"},
  home:{eyebrow:"DEVELOPMENT STUDIO",heading:"Test dynamic homepage",highlight:"from MongoDB",description:"A clear business description.",buttonText:"Contact the team"},
  about:{heading:"About",highlight:"the studio",intro:"A software studio serving South Africa.",missionHeading:"Our mission",missionHighlight:"is practical software",missionDescription:"We build useful applications."},
  sections:{services:true,portfolio:true,pricing:true,process:true,about:true,contact:true},
  services:[{id:"web",title:"Website development",category:"Websites",description:"Professional websites.",visible:true}],
  pricing:[{id:"starter",group:"web",name:"Starter Website",heading:"Starter pages",price:"R1000",features:["Responsive design"],visible:true}],
  projects:[{id:"kasidrop",name:"KasiDrop",category:"E-commerce",description:"Local online shopping",problem:"Product discovery",approach:"Responsive checkout",imageUrl:"/images/projects/kasidrop-live.webp",mobileImageUrl:"/images/projects/mobile/kasidrop-live.webp",liveUrl:"https://kasi-drop.netlify.app/",caseStudyUrl:"",stack:["Angular","Node.js"],featured:true,homeFeatured:true,visible:true}]
};
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const events=[];
async function createPage(mobile=false) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:1});
  page.on("pageerror",error=>events.push(error.message));
  await page.route("**/api/health",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"ok"})}));
  await page.route("**/api/site",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({site:fixture})}));
  await page.route("**/api/admin/site",async route=>{
    if(route.request().method()==="GET"){
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({site:fixture})});
    }
    const content=route.request().postDataJSON();
    assert.equal(content.revision,1);
    assert.equal(content.site.projects.length,2,"New project was added in editor");
    assert.equal(content.site.projects[1].name,"New demo project");
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({site:{...content.site,revision:2}})});
  });
  await page.route("**/api/admin/media/sign",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    cloudName:"demo",apiKey:"testkey",folder:"mzansi-digital-ventures/website",timestamp:1760000000,unique_filename:true,signature:"testsignature"
  })}));
  await page.route("https://api.cloudinary.com/v1_1/demo/image/upload",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    secure_url:"https://res.cloudinary.com/demo/image/upload/v1/new-logo.png"
  })}));
  return page;
}
try {
  const desktop=await createPage();
  const response=await desktop.goto(base+"/",{waitUntil:"domcontentloaded",timeout:70000});
  assert.equal(response.status(),200);
  await desktop.waitForTimeout(1000);
  await desktop.getByRole("heading",{level:1,name:/Test dynamic homepage/}).waitFor({timeout:20000});
  assert.equal(await desktop.locator(".admin-access").isVisible(),true);
  console.log("PASS: desktop admin sign-in and dynamic homepage");
  await desktop.goto(base+"/admin/content/",{waitUntil:"domcontentloaded",timeout:70000});
  await desktop.getByRole("button",{name:/Publish changes/}).waitFor();
  await desktop.locator(".cms-tab[data-tab='projects']").click();
  await desktop.locator("[data-add='projects']").click();
  await desktop.locator('input[data-group="projects"][data-index="1"][data-field="name"]').fill("New demo project");
  await desktop.getByRole("button",{name:/Publish changes/}).click();
  await desktop.getByText("Website published.",{exact:false}).waitFor({timeout:15000});
  assert.equal(await desktop.locator("#editState").innerText(),"All changes published");
  console.log("PASS: visual editor project addition and MongoDB publish request");
  await desktop.close();
  const mobile=await createPage(true);
  await mobile.goto(base+"/",{waitUntil:"domcontentloaded",timeout:70000});
  await mobile.locator(".nav-toggle").click();
  assert.equal(await mobile.locator(".mobile-admin-access").isVisible(),true);
  await mobile.goto(base+"/admin/content/",{waitUntil:"domcontentloaded",timeout:70000});
  await mobile.locator(".cms-tab[data-tab='company']").waitFor();
  assert.equal(await mobile.locator("#logoUpload").count(),1);
  console.log("PASS: mobile sign-in navigation and responsive editor");
  await mobile.close();
  assert.deepEqual(events,[],"No runtime JavaScript errors");
  console.log("All CMS integration browser tests passed.");
} finally {await browser.close();}
