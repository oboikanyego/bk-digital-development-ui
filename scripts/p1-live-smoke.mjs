import assert from "node:assert/strict";

const ui=process.env.SMOKE_UI_URL||"https://6af347f633b3b4f9489635e6--mzansi-digital-ventures.netlify.app";
const backend=process.env.SMOKE_API_URL||"https://bk-digital-development-api.onrender.com";
const get=async(url,{method="GET"}={})=>{
 const response=await fetch(url,{method,redirect:"manual",signal:AbortSignal.timeout(85000)});
 const type=response.headers.get("content-type")||"";
 return {response,status:response.status,type,url};
};
let checks=0;
const ready=await get(backend+"/ready");
console.log("Render readiness:",ready.status);
assert.equal(ready.status,200,"The production MongoDB backend must report ready");
const doc=await ready.response.json();
assert.equal(doc.database,"connected");
checks++;
for(const path of ["/admin/crm/clients","/admin/documents",
 "/admin/documents/507f1f77bcf86cd799439011/pdf",
 "/admin/crm/metrics","/admin/operations/health"]){
 const result=await get(backend+path);
 assert.equal(result.status,401,path+": anonymous access must be denied");
 checks++;
}
for(const path of ["/","/admin/crm/","/admin/documents/","/admin/site-settings/"]){
 const result=await get(ui+path);
 assert.equal(result.status,200,"Frontend URL "+path+" must load");
 assert.match(result.type,/text\/html/i);
 checks++;
}
const site=await get(ui+"/api/site");
console.log("Public site MongoDB data:",site.status);
assert.equal(site.status,200);
const body=await site.response.json();
assert.ok(body.site?.siteConfig?.navigation,"Published site config must contain MongoDB-managed navigation");
assert.ok(body.site?.siteConfig?.seo?.home?.title,"Published site config must contain SEO");
checks++;
const adminProxy=await get(ui+"/api/admin/crm/clients");
assert.equal(adminProxy.status,401,"Netlify must preserve admin authorization checks");
checks++;
const jsonPDF=await get(ui+"/api/admin/documents/507f1f77bcf86cd799439011/pdf");
assert.equal(jsonPDF.status,401,"Netlify must block unauthorized PDF downloads");
checks++;
console.log("PASSED",checks,"non-destructive production readiness and authentication checks.");
