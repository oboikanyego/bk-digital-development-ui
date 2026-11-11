/*
 * Shared Render wake-up and mutation loader for every public and admin page.
 * Keep marketing content usable during cold starts. Never replay a POST after
 * a failure: a request might have been persisted before its response was lost.
 */
(() => {
  "use strict";
  const IDLE_AFTER_MS = 15 * 60 * 1000;
  const CHECK_TIMEOUT_MS = 22 * 1000;
  const RETRY_DELAYS = [0, 1400, 2600, 4200];
  const SESSION_KEY = "mdvLastServiceWake";
  const originalFetch = (typeof window.fetch === "function" ? window.fetch : fetch).bind(window);
  const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
  // The first visit or navigation always performs a fresh health check, even
  // when a previous page saved a recent timestamp in sessionStorage.
  let lastReady = 0;
  let lastActivityAt = Date.now();
  let hiddenAt = null;
  let lastActivityCheck = 0;
  let inFlight = null;
  let notice = null;
  let messageNode = null;
  let retryButton = null;
  let revealTimer = null;
  let dismissTimer = null;
  let overlay = null;
  let overlayHeading = null;
  let overlayMessage = null;
  let overlayTimer = null;
  let pendingMutations = 0;

  function installStyles() {
    if (!document.head || document.getElementById?.("mdv-service-loader-css")) return;
    const link = document.createElement("link");
    link.id = "mdv-service-loader-css";
    link.rel = "stylesheet";
    link.href = "/service-loader.css";
    document.head.appendChild(link);
  }

  function ensureNotice() {
    if (notice) return;
    const node = document.createElement("div");
    node.className = "service-connection";
    node.hidden = true;
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.innerHTML =
      '<span class="service-indicator" aria-hidden="true"></span>' +
      '<span class="service-message"></span>' +
      '<button type="button" class="service-retry" hidden>Retry</button>';
    document.body.appendChild(node);
    notice = node;
    messageNode = node.querySelector(".service-message");
    retryButton = node.querySelector(".service-retry");
    retryButton.addEventListener("click", () => { void wake({ force: true }); });
  }

  function display(state, text) {
    ensureNotice();
    clearTimeout(dismissTimer);
    notice.dataset.status = state;
    messageNode.textContent = text;
    retryButton.hidden = state !== "offline";
    // A submitting user already sees the larger request loader.
    notice.hidden = pendingMutations > 0 && state !== "offline";
  }

  function dismissSoon() {
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => { if (notice) notice.hidden = true; }, 2800);
  }

  function ensureOverlay() {
    if (overlay) return;
    const node = document.createElement("div");
    node.className = "mdv-request-overlay";
    node.hidden = true;
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-atomic", "true");
    node.innerHTML =
      '<div class="mdv-request-card">' +
      '<div class="mdv-request-mark" aria-hidden="true"><span class="mdv-request-spinner"></span><span class="mdv-request-logo">M</span></div>' +
      '<p class="mdv-request-kicker">MZANSI DIGITAL VENTURES</p>' +
      '<h2 class="mdv-request-title">Processing your request</h2>' +
      '<p class="mdv-request-description">Connecting securely…</p>' +
      '<div class="mdv-request-progress" aria-hidden="true"><span></span></div>' +
      '<p class="mdv-request-note">Please keep this page open. Your request will only be submitted once.</p>' +
      '</div>';
    document.body.appendChild(node);
    overlay = node;
    overlayHeading = node.querySelector(".mdv-request-title");
    overlayMessage = node.querySelector(".mdv-request-description");
  }

  function requestTitle(path) {
    if (path === "/api/contact") return "Sending your enquiry";
    if (path === "/api/admin/auth/login") return "Signing you in";
    if (path === "/api/admin/auth/logout") return "Signing you out";
    if (path.includes("/documents")) return "Saving your document";
    if (path.includes("/email")) return "Updating email settings";
    return "Saving your changes";
  }

  function showMutation(path) {
    pendingMutations++;
    if (pendingMutations !== 1) return;
    ensureOverlay();
    overlayHeading.textContent = requestTitle(path);
    overlayMessage.textContent = "Checking our secure service…";
    clearTimeout(overlayTimer);
    // Avoid flashing a blocking screen for very fast requests.
    overlayTimer = setTimeout(() => {
      if (pendingMutations > 0) overlay.hidden = false;
    }, 180);
  }

  function mutationStage(text) {
    if (overlayMessage) overlayMessage.textContent = text;
  }

  function hideMutation() {
    pendingMutations = Math.max(0, pendingMutations - 1);
    if (pendingMutations) return;
    clearTimeout(overlayTimer);
    if (overlay) overlay.hidden = true;
  }

  async function checkHealth() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      const response = await originalFetch("/api/health", {
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
    notice.hidden = true;
    if (isOffline()) {
      display("offline", "You are offline. Reconnect to continue.");
      return false;
    }
    revealTimer = setTimeout(() => {
      display("waking", "Starting our secure service… This can take a little longer on the first visit.");
    }, 850);
    inFlight = (async () => {
      for (let i = 0; i < RETRY_DELAYS.length; i++) {
        if (RETRY_DELAYS[i]) {
          mutationStage("The service is still waking up. Your request has not been sent yet.");
          await delay(RETRY_DELAYS[i]);
        }
        try {
          await checkHealth();
          lastReady = Date.now();
          try { sessionStorage.setItem(SESSION_KEY, String(lastReady)); } catch { /* optional */ }
          clearTimeout(revealTimer);
          if (notice && !notice.hidden) {
            display("ready", "Service connected. You can continue.");
            dismissSoon();
          }
          return true;
        } catch {
          if (i === RETRY_DELAYS.length - 1) {
            clearTimeout(revealTimer);
            display("offline", "Our service is taking longer to connect. Please retry.");
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
    if (!ready) throw new Error("Our service is not ready. Please try again in a moment.");
    return true;
  }

  // Intercept only our own backend mutations. Never touch uploads to external
  // services, GET requests, or requests sent to unrelated hosts.
  function isBackendMutation(input, init) {
    try {
      const raw = typeof input === "string" ? input : input?.url || String(input);
      const base = window.location?.href || "https://mzansi-digital-ventures.netlify.app/";
      const url = new URL(raw, base);
      const currentOrigin = window.location?.origin || new URL(base).origin;
      const method = String(init?.method || input?.method || "GET").toUpperCase();
      return url.origin === currentOrigin &&
        url.pathname.startsWith("/api/") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method)
        ? url.pathname : null;
    } catch { return null; }
  }

  window.fetch = function mdvTrackedFetch(input, init) {
    const path = isBackendMutation(input, init);
    if (!path) return originalFetch(input, init);
    return (async () => {
      showMutation(path);
      try {
        // Wake first; the mutation itself is dispatched exactly once.
        await ensureReady();
        mutationStage("Submitting securely…");
        return await originalFetch(input, init);
      } finally {
        hideMutation();
      }
    })();
  };

  function refreshAfterInactivity() {
    if (document.visibilityState === "hidden") return;
    const wasAway = hiddenAt !== null && Date.now() - hiddenAt >= IDLE_AFTER_MS;
    hiddenAt = null;
    if (wasAway || !lastReady || Date.now() - lastReady >= IDLE_AFTER_MS)
      void wake({ force: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else refreshAfterInactivity();
  });
  window.addEventListener("focus", refreshAfterInactivity);
  window.addEventListener("pageshow", event => {
    if (event.persisted) refreshAfterInactivity();
  });
  window.addEventListener("online", () => {
    if (!inFlight && (!lastReady || Date.now() - lastReady >= IDLE_AFTER_MS)) void wake({ force: true });
  });

  function activity() {
    if (document.visibilityState === "hidden") return;
    const now = Date.now();
    const idleLongEnough = now - lastActivityAt >= IDLE_AFTER_MS;
    lastActivityAt = now;
    if (now - lastActivityCheck < 2500 && !idleLongEnough) return;
    lastActivityCheck = now;
    // User resumed after 15 minutes of inactivity, or Render may have slept
    // because no backend traffic occurred despite page interactions.
    if (idleLongEnough || !lastReady || now - lastReady >= IDLE_AFTER_MS)
      void wake({ force: true });
  }
  document.addEventListener("pointerdown", activity, { passive: true });
  document.addEventListener("keydown", activity);
  window.MDVService = {
    wake, ensureReady,
    isReady: () => Boolean(lastReady && Date.now() - lastReady < IDLE_AFTER_MS),
    isWaking: () => Boolean(inFlight),
    isSubmitting: () => pendingMutations > 0
  };

  installStyles();
  // Start waking Render on each initial page view without blocking content.
  void wake();
})();
