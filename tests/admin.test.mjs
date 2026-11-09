import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("sign-in and dashboard are separate pages",()=>{
 const signin=readFileSync("public/admin/login/index.html","utf8");
 const dashboard=readFileSync("public/admin/dashboard/index.html","utf8");
 assert.match(signin,/autocomplete="username"/);
 assert.match(signin,/autocomplete="current-password"/);
 assert.doesNotMatch(signin,/id="enquiryRows"/);
 assert.match(dashboard,/id="enquiryRows"/);
 assert.match(dashboard,/id="meetingRows"/);
 assert.doesNotMatch(dashboard,/id="loginForm"/);
});
test("session cookie is passed from Express through the proxy",()=>{
 const login=readFileSync("public/admin-login.js","utf8");
 const dash=readFileSync("public/admin.js","utf8");
 const proxy=readFileSync("netlify/functions/api-proxy.mjs","utf8");
 assert.match(login,/\/api\/admin\/auth\/login/);
 assert.match(dash,/\/auth\/me/);
 assert.doesNotMatch(dash,/adminKey/);
 assert.match(proxy,/Set-Cookie/);
});
