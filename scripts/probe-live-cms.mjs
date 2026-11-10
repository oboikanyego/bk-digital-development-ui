import assert from "node:assert/strict";
const root="https://bk-digital-development-api.onrender.com";
async function request(path) {
 const response=await fetch(root+path,{headers:{accept:"application/json"},signal:AbortSignal.timeout(95000)});
 const body=await response.json().catch(()=>({}));
 console.log(path+" "+JSON.stringify({status:response.status,service:body.service,dbConfigured:body.databaseConfigured,emailConfigured:body.emailConfigured,hasSite:Boolean(body.site),projects:body.site?.projects?.length,services:body.site?.services?.length,revision:body.site?.revision,message:body.message}));
 return {response,body};
}
const health=await request("/health");
assert.equal(health.response.status,200,"Render /health should respond.");
assert.equal(health.body.databaseConfigured,true,"MONGO_URI is missing from Render.");
const site=await request("/site");
assert.equal(site.response.status,200,"MongoDB content migration/read failed.");
assert.ok(site.body.site?.projects?.length>=7,"Initial project catalogue missing.");
assert.equal(site.body.site.company.name,"Mzansi Digital Ventures (Pty) Ltd");
assert.ok(site.body.site?.revision>=1);
console.log("SUCCESS: Live Render API reads persisted website content from MongoDB.");
