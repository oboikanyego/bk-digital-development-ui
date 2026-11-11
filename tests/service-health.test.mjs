import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync("public/service-health.js", "utf8");

function boot({ healthHandler, mutationHandler } = {}) {
  const clock = { now: 1000 };
  const events = {};
  const windowEvents = {};
  const storage = new Map();
  const timers = new Map();
  const requests = [];
  let nextTimer = 0;
  const indicator = {};
  const message = { textContent: "" };
  const retry = {
    hidden: true,
    addEventListener(name, fn) { this[name] = fn; }
  };
  const notice = {
    hidden: true, dataset: {},
    querySelector(selector) {
      if (selector === ".service-indicator") return indicator;
      if (selector === ".service-message") return message;
      if (selector === ".service-retry") return retry;
      throw Error("Unexpected notice selector: " + selector);
    },
    setAttribute() {}
  };
  const heading = { textContent: "" };
  const description = { textContent: "" };
  const overlay = {
    hidden: true, dataset: {},
    querySelector(selector) {
      if (selector === ".mdv-request-title") return heading;
      if (selector === ".mdv-request-description") return description;
      throw Error("Unexpected overlay selector: " + selector);
    },
    setAttribute() {}
  };
  const styles = [];
  let divs = 0;
  const document = {
    visibilityState: "visible",
    head: { appendChild(link) { styles.push(link); } },
    body: { appendChild() {} },
    getElementById() { return null; },
    createElement(tag) {
      if (tag === "link") return {};
      if (tag === "div") return ++divs === 1 ? notice : overlay;
      throw Error("Unexpected HTML tag: " + tag);
    },
    addEventListener(name, fn) { events[name] = fn; }
  };
  const browser = {
    location: { href: "https://mzansi-digital-ventures.netlify.app/", origin: "https://mzansi-digital-ventures.netlify.app" },
    addEventListener(name, fn) { windowEvents[name] = fn; }
  };
  const nativeFetch = async (url, options={}) => {
    const path = String(url);
    const method = options.method || url?.method || "GET";
    requests.push({url:path,method});
    if (path === "/api/health") {
      assert.equal(method, "GET");
      if (healthHandler) return healthHandler({requests,clock});
      return { ok:true, async json() { return {status:"ok"}; } };
    }
    if (mutationHandler) return mutationHandler({url:path, options, requests});
    return { ok:true, status:200, async json() { return {saved:true}; } };
  };
  const ctx = {
    window: browser, document, navigator: { onLine:true },
    Date: { now() { return clock.now; } },
    sessionStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key,value) { storage.set(key,value); }
    },
    setTimeout(callback, millis) {
      const id=++nextTimer;
      timers.set(id,{callback,millis});
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    fetch:nativeFetch, URL, AbortController, console
  };
  runInNewContext(source,ctx);
  return {
    clock, events, windowEvents, document, notice, retry, message,
    overlay, heading, description, styles, browser, navigator:ctx.navigator,
    service:browser.MDVService, requests,
    healthRequests:()=>requests.filter(r=>r.url==="/api/health").length,
    mutations:()=>requests.filter(r=>r.method!=="GET"&&r.url!=="/api/health"),
    fireTimer(millis) {
      for(const [id,item] of timers) {
        if(item.millis===millis) { timers.delete(id); item.callback(); return true; }
      }
      return false;
    }
  };
}

test("first page view always wakes backend; a quick response avoids flashing a loader",async()=>{
  const env=boot();
  await env.service.ensureReady();
  assert.equal(env.healthRequests(),1);
  assert.equal(env.service.isReady(),true);
  assert.equal(env.notice.hidden,true);
  assert.equal(env.styles.length,1,"shared loader CSS should be installed");
  assert.equal(env.styles[0].href,"/service-loader.css");

  env.clock.now+=14*60*1000;
  await env.service.wake();
  assert.equal(env.healthRequests(),1,"the service remains ready for fifteen minutes");
});

test("the cold start indicator is visible if first health check is slow",async()=>{
  let complete;
  const env=boot({healthHandler:()=>new Promise(resolve=>{complete=resolve;})});
  assert.equal(env.fireTimer(850),true);
  assert.equal(env.notice.hidden,false);
  assert.equal(env.notice.dataset.status,"waking");
  assert.match(env.message.textContent,/first visit/i);
  complete({ok:true,async json(){return {status:"ok"};}});
  await env.service.ensureReady();
  assert.equal(env.notice.dataset.status,"ready");
  assert.equal(env.fireTimer(2800),true);
  assert.equal(env.notice.hidden,true);
});

test("returning after 15+ minutes or resuming a long idle tab rechecks Render",async()=>{
  const env=boot();
  await env.service.ensureReady();
  env.document.visibilityState="hidden";
  env.events.visibilitychange();
  env.clock.now+=16*60*1000;
  env.document.visibilityState="visible";
  env.events.visibilitychange();
  await env.service.ensureReady();
  assert.equal(env.healthRequests(),2);

  env.clock.now+=16*60*1000;
  env.events.pointerdown();
  await env.service.ensureReady();
  assert.equal(env.healthRequests(),3,"first interaction after long inactivity wakes the service");

  env.events.pointerdown();
  await env.service.ensureReady();
  assert.equal(env.healthRequests(),3,"frequent activity must not cause wakeup spam");
});

test("offline users receive a recoverable warning and never submit a mutation",async()=>{
  const env=boot();
  await env.service.ensureReady();
  env.navigator.onLine=false;
  assert.equal(await env.service.wake({force:true}),false);
  assert.equal(env.notice.hidden,false);
  assert.equal(env.notice.dataset.status,"offline");
  assert.equal(env.retry.hidden,false);
  assert.match(env.message.textContent,/offline/i);

  env.clock.now+=16*60*1000;
  await assert.rejects(()=>env.browser.fetch("/api/contact",{method:"POST",body:"{}"}),/not ready/i);
  assert.equal(env.mutations().length,0);
  assert.equal(env.service.isSubmitting(),false);
  assert.equal(env.overlay.hidden,true);

  env.navigator.onLine=true;
  assert.equal(await env.service.wake({force:true}),true);
  assert.equal(env.healthRequests(),2);
});

test("contact POST waits for Render, shows processing, sends once, then hides overlay",async()=>{
  let allowHealth,allowPost;
  const env=boot({
    healthHandler:()=>new Promise(resolve=>{allowHealth=resolve;}),
    mutationHandler:()=>new Promise(resolve=>{allowPost=resolve;})
  });
  const request=env.browser.fetch("/api/contact",{method:"POST",body:"{}"});
  await Promise.resolve();
  assert.equal(env.mutations().length,0,"no POST before health success");
  assert.equal(env.service.isSubmitting(),true);
  assert.equal(env.fireTimer(180),true);
  assert.equal(env.overlay.hidden,false);
  assert.equal(env.heading.textContent,"Sending your enquiry");
  allowHealth({ok:true,async json(){return {status:"ok"};}});
  await env.service.ensureReady();
  // Promise turn(s) for tracked fetch to dispatch the application request.
  for(let i=0;i<8&&env.mutations().length===0;i++)await Promise.resolve();
  assert.equal(env.mutations().length,1);
  assert.match(env.description.textContent,/Submitting securely/i);
  allowPost({ok:true,status:201});
  const result=await request;
  assert.equal(result.status,201);
  assert.equal(env.overlay.hidden,true);
  assert.equal(env.service.isSubmitting(),false);
  assert.equal(env.mutations().length,1);
});

test("a failed POST is never replayed automatically and closes the request overlay",async()=>{
  const env=boot({mutationHandler:async()=>{throw Error("Simulated network uncertainty");}});
  await env.service.ensureReady();
  await assert.rejects(
    ()=>env.browser.fetch("/api/admin/documents",{method:"POST",body:"{}"}),
    /Simulated network uncertainty/
  );
  assert.equal(env.mutations().length,1,"network ambiguity must never cause duplicate writes");
  assert.equal(env.overlay.hidden,true);
  assert.equal(env.service.isSubmitting(),false);
});

test("only same-origin backend mutations get the overlay; external uploads and GETs bypass it",async()=>{
  const env=boot();
  await env.service.ensureReady();
  await env.browser.fetch("/api/site");
  await env.browser.fetch("https://api.cloudinary.com/v1_1/example/image/upload",{method:"POST",body:"file"});
  assert.equal(env.mutations().length,1);
  assert.equal(env.mutations()[0].url,"https://api.cloudinary.com/v1_1/example/image/upload");
  assert.equal(env.overlay.hidden,true,"external POST must not show backend overlay");
  assert.equal(env.service.isSubmitting(),false);
  await env.browser.fetch("/api/admin/crm/clients/test",{method:"PATCH",body:"{}"});
  assert.equal(env.mutations().length,2);
  assert.equal(env.healthRequests(),1);
  assert.equal(env.service.isSubmitting(),false);
});
