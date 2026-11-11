import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync("public/"+path,"utf8");

test("public AI advisor page is indexed, discoverable and uses shared design",()=>{
  const page=read("ai-advisor/index.html");
  assert.match(page,/id="aiAdvisorApp"/);
  assert.match(page,/Free AI Project Advisor/);
  assert.match(page,/canonical/);
  assert.match(page,/robots" content="index,follow"/);
  assert.match(page,/\/service-health\.js/);
  assert.match(page,/\/ai-advisor\.css/);
  assert.match(page,/\/ai-advisor\.js/);
  assert.match(read("sitemap.xml"),/\/ai-advisor\//);
});

test("floating AI entry point is available across public pages without affecting admin",()=>{
  for(const path of ["index.html","about/index.html","services/index.html","portfolio/index.html","pricing/index.html","process/index.html","contact/index.html"]){
    const html=read(path);
    assert.match(html,/\/ai-advisor\.js/,path);
    assert.match(html,/\/ai-advisor\.css/,path);
  }
  assert.match(read("ai-advisor.js"),/location\.pathname\.startsWith\("\/admin\/"\)/);
  assert.match(read("ai-advisor.js"),/aria-haspopup/);
  assert.match(read("ai-advisor.js"),/dialog\.showModal\(\)/);
});

test("AI advice uses API not client-side provider keys; no untrusted HTML rendering",()=>{
  const js=read("ai-advisor.js");
  assert.match(js,/fetch\("\/api\/ai\/advice"/);
  assert.match(js,/fetch\("\/api\/ai\/status"/);
  assert.match(js,/appendBubble\(container,"assistant",reply\)/);
  assert.match(js,/content\.textContent=text/);
  assert.match(js,/history:history\.length>4/);
  assert.match(js,/projectAnswers\.push\(message\)/);
  assert.match(js,/textarea\.minLength=2/);
  assert.match(js,/const minimum=history\.length\?2:15/);
  assert.match(js,/projectAnswers\[0\]/);
  assert.match(js,/Additional requirements discussed/);
  assert.doesNotMatch(js,/GROQ_API_KEY|api\.groq\.com/i);
  assert.match(js,/sessionStorage\.setItem\(QUOTE_KEY/);
});

test("AI contact brief is passed privately through session storage, not query string",()=>{
  const app=read("app.js");
  assert.match(app,/new URLSearchParams\(location\.search\)\.get\("from"\) === "ai-advisor"/);
  assert.match(app,/sessionStorage\.getItem\("mdv-ai-project-brief"\)/);
  assert.match(app,/message\.value = brief\.message/);
  assert.match(app,/projectType\.dispatchEvent\(new Event\("change"/);
  assert.match(app,/sessionStorage\.removeItem\("mdv-ai-project-brief"\)/);
});
