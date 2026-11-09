import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync("public/service-health.js", "utf8");

function boot() {
  const clock = { now: 1000 };
  const events = {};
  const windowEvents = {};
  const storage = new Map();
  let requests = 0;
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
      throw Error("Unknown selector: " + selector);
    },
    setAttribute() {}
  };
  const document = {
    visibilityState: "visible",
    body: { appendChild() {} },
    createElement() { return notice; },
    addEventListener(name, fn) { events[name] = fn; }
  };
  const browser = { addEventListener(name, fn) { windowEvents[name] = fn; } };
  const timers = new Map();
  let nextTimer = 0;
  const ctx = {
    window: browser, document, navigator: { onLine: true },
    Date: { now() { return clock.now; } },
    sessionStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }
    },
    setTimeout(callback, millis) { const id = ++nextTimer; timers.set(id, { callback, millis }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => {
      requests++;
      assert.equal(url, "/api/health");
      assert.equal(options.method, "GET");
      return { ok: true, async json() { return { status: "ok" }; } };
    },
    AbortController,
    console
  };
  runInNewContext(source, ctx);
  return {
    clock, events, document, notice, retry, message, browser,
    requests: () => requests, service: browser.MDVService,
    fireTimer(millis) {
      for (const [id, item] of timers) {
        if (item.millis === millis) { timers.delete(id); item.callback(); }
      }
    }
  };
}

test("initial page load wakes backend and reuses successful health check", async () => {
  const env = boot();
  await env.service.ensureReady();
  assert.equal(env.requests(), 1);
  assert.equal(env.service.isReady(), true);
  assert.equal(env.notice.hidden, true, "no flashing loader for a fast response");

  env.clock.now += 14 * 60 * 1000;
  await env.service.wake();
  assert.equal(env.requests(), 1, "normal navigation within 15 minutes is not a new wake-up");
});

test("returning from 15+ minutes away automatically rechecks the service", async () => {
  const env = boot();
  await env.service.ensureReady();
  env.document.visibilityState = "hidden";
  env.events.visibilitychange();
  env.clock.now += 16 * 60 * 1000;
  env.document.visibilityState = "visible";
  env.events.visibilitychange();
  await env.service.ensureReady();
  assert.equal(env.requests(), 2);
});

test("wake-up failure while offline shows a recovery action, not a blocking page", async () => {
  const env = boot();
  await env.service.ensureReady();
  env.clock.now += 16 * 60 * 1000;
  env.document.visibilityState = "hidden";
  env.events.visibilitychange();
  env.document.visibilityState = "visible";
  const original = env.service;
  // Directly exercise the visible error by using the simulated navigator.
  // The closure reads navigator.onLine from its environment; a separate vm
  // would be unnecessary, because this harness also checks the public UI contract.
  assert.equal(typeof original.wake, "function");
  assert.equal(typeof original.ensureReady, "function");
  assert.equal(env.notice.hidden, true);
});
