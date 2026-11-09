/*
 * Render wake-up manager. This is deliberately separate from marketing rendering:
 * pages stay usable while the API starts, and sensitive POST requests are never
 * automatically replayed (which could create duplicate enquiries).
 */
(() => {
  "use strict";
  const IDLE_AFTER_MS = 15 * 60 * 1000;
  const CHECK_TIMEOUT_MS = 22 * 1000;
  const RETRY_DELAYS = [0, 1400, 2600, 4200];
  const SESSION_KEY = "mdvLastServiceWake";
  const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
  let lastReady = 0;
  try { lastReady = Number(sessionStorage.getItem(SESSION_KEY)) || 0; } catch { /* Optional storage. */ }
  let inFlight = null;
  let hiddenAt = null;
  let statusElement = null;
  let statusMessage = null;
  let retryButton = null;
  let revealTimer = null;
  let dismissTimer = null;
  let lastActivityCheck = 0;

  function ensureNotice() {
    if (statusElement) return;
    const node = document.createElement("div");
    node.className = "service-connection";
    node.hidden = true;
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.innerHTML = '<span class="service-indicator" aria-hidden="true"></span>' +
      '<span class="service-message"></span>' +
      '<button type="button" class="service-retry" hidden>Retry</button>';
    document.body.appendChild(node);
    statusElement = node;
    statusMessage = node.querySelector(".service-message");
    retryButton = node.querySelector(".service-retry");
    retryButton.addEventListener("click", () => { void wake({ force: true }); });
  }
  function display(state, message) {
    ensureNotice();
    clearTimeout(dismissTimer);
    statusElement.hidden = false;
    statusElement.dataset.status = state;
    statusMessage.textContent = message;
    retryButton.hidden = state !== "offline";
  }
  function dismissSoon() {
    dismissTimer = setTimeout(() => {
      if (statusElement) statusElement.hidden = true;
    }, 3000);
  }
  async function checkHealth() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      const response = await fetch("/api/health", {
        method: "GET", cache: "no-store", credentials: "same-origin",
        signal: controller.signal
      });
      if (!response.ok) throw new Error("The service is still starting.");
      const payload = await response.json();
      if (payload?.status !== "ok") throw new Error("The service is not ready.");
      return true;
    } finally {
      clearTimeout(timer);
    }
  }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function wake({ force = false } = {}) {
    if (inFlight) return inFlight;
    if (!force && lastReady && Date.now() - lastReady < IDLE_AFTER_MS) return true;

    ensureNotice();
    clearTimeout(revealTimer);
    clearTimeout(dismissTimer);
    statusElement.hidden = true;
    if (isOffline()) {
      display("offline", "You're offline. Reconnect to send an enquiry.");
      return false;
    }
    // Don't flash a loading indicator if the service is already awake.
    revealTimer = setTimeout(() => display("waking", "Connecting to our enquiry service. You can keep browsing."), 1200);
    inFlight = (async () => {
      for (let i = 0; i < RETRY_DELAYS.length; i++) {
        if (RETRY_DELAYS[i]) await delay(RETRY_DELAYS[i]);
        try {
          await checkHealth();
          lastReady = Date.now();
          try { sessionStorage.setItem(SESSION_KEY, String(lastReady)); } catch { /* Optional storage. */ }
          clearTimeout(revealTimer);
          if (!statusElement.hidden) {
            display("ready", "Enquiry service is ready.");
            dismissSoon();
          }
          return true;
        } catch {
          if (i === RETRY_DELAYS.length - 1) {
            clearTimeout(revealTimer);
            display("offline", "Our enquiry service is taking longer to start. Please retry.");
          }
        }
      }
      return false;
    })();
    try { return await inFlight; }
    finally { inFlight = null; }
  }

  async function ensureReady({ force = false } = {}) {
    const ready = await wake({ force });
    if (!ready) throw new Error("Our enquiry service is not ready. Please retry in a moment.");
    return true;
  }

  function refreshAfterInactivity() {
    if (document.visibilityState === "hidden") return;
    const inactiveLongEnough = hiddenAt !== null && Date.now() - hiddenAt >= IDLE_AFTER_MS;
    if (inactiveLongEnough || !lastReady || Date.now() - lastReady >= IDLE_AFTER_MS) {
      hiddenAt = null;
      void wake({ force: true });
    } else {
      hiddenAt = null;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else refreshAfterInactivity();
  });
  window.addEventListener("focus", refreshAfterInactivity);
  window.addEventListener("pageshow", event => {
    if (event.persisted) refreshAfterInactivity();
  });
  const activity = () => {
    const now = Date.now();
    if (now - lastActivityCheck < 2500) return;
    lastActivityCheck = now;
    if (lastReady && now - lastReady >= IDLE_AFTER_MS) void wake({ force: true });
  };
  document.addEventListener("pointerdown", activity, { passive: true });
  document.addEventListener("keydown", activity);
  window.MDVService = { wake, ensureReady, isReady: () => Boolean(lastReady && Date.now() - lastReady < IDLE_AFTER_MS) };
  // Initial warm-up runs without blocking marketing content or navigation.
  void wake();
})();
