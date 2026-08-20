(function () {
  const measurementId = "G-Y9KJ0W90MZ";
  const metaPixelId = "1331118269183756";
  const redditPixelId = "a2_jjlfyseffvp2";
  const consentKey = "old-school-analytics-consent";
  if (window.__oldSchoolAnalyticsLoaded) return;
  window.__oldSchoolAnalyticsLoaded = true;

  const debugTraffic = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
    || window.location.hostname.endsWith(".vercel.app")
    || new URLSearchParams(window.location.search).get("analytics_debug") === "1";

  let analyticsReady = false;
  let metaPixelReady = false;
  let redditPixelReady = false;

  // These are the product-funnel events shared by GA4, Meta, and Reddit.
  // Other app events continue to go to GA4 only.
  const pixelEvents = new Set([
    "app_opened",
    "login_started",
    "login_completed",
    "signup_started",
    "signup_completed",
    "auth_failed",
    "checkout_started",
    "checkout_cancelled",
    "checkout_error",
    "purchase",
    "download_requested",
    "download_ready",
    "feedback_submitted",
    "search_used",
    "export_completed",
  ]);

  const metaStandardEvents = {
    app_opened: "ViewContent",
    signup_completed: "CompleteRegistration",
    checkout_started: "InitiateCheckout",
    purchase: "Purchase",
    feedback_submitted: "Lead",
    search_used: "Search",
  };

  const redditStandardEvents = {
    app_opened: "ViewContent",
    signup_completed: "Sign Up",
    purchase: "Purchase",
    feedback_submitted: "Lead",
    search_used: "Search",
  };

  function initializeMetaPixel() {
    if (metaPixelReady || typeof window.fbq === "function") return;
    metaPixelReady = true;
    window.fbq = function () {
      window.fbq.callMethod
        ? window.fbq.callMethod.apply(window.fbq, arguments)
        : window.fbq.queue.push(arguments);
    };
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    window.fbq.queue = [];

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
    window.fbq("init", metaPixelId);
    window.fbq("track", "PageView");
  }

  function initializeAnalytics() {
    if (analyticsReady) return;
    analyticsReady = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    if (!document.querySelector(`script[src*="gtag/js?id=${measurementId}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
    }
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      page_title: document.title,
      page_path: `${window.location.pathname}${window.location.search}`,
      ...(debugTraffic ? { debug_mode: true } : {}),
    });
    initializeMetaPixel();
    initializeRedditPixel();
  }

  function initializeRedditPixel() {
    if (redditPixelReady || typeof window.rdt === "function") return;
    redditPixelReady = true;
    window.rdt = function () {
      window.rdt.sendEvent
        ? window.rdt.sendEvent.apply(window.rdt, arguments)
        : window.rdt.callQueue.push(arguments);
    };
    window.rdt.callQueue = [];

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.redditstatic.com/ads/pixel.js";
    document.head.appendChild(script);
    window.rdt("init", redditPixelId);
    window.rdt("track", "PageVisit");
  }

  function track(name, parameters = {}) {
    if (!name || !analyticsReady || typeof window.gtag !== "function") return;
    const eventParameters = {
      ...parameters,
      ...(debugTraffic ? { debug_mode: true } : {}),
    };
    window.gtag("event", name, eventParameters);

    if (!pixelEvents.has(name)) return;

    if (typeof window.fbq === "function") {
      const metaEvent = metaStandardEvents[name];
      window.fbq(metaEvent ? "track" : "trackCustom", metaEvent || name, parameters);
    }

    if (typeof window.rdt === "function") {
      window.rdt("track", redditStandardEvents[name] || name, parameters);
    }
  }

  window.OldSchoolAnalytics = { track };

  function showConsentBanner() {
    const banner = document.createElement("aside");
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Analytics consent");
    banner.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:620px;margin:auto;padding:14px;background:#c0c0c0;color:#000;border:2px solid #fff;box-shadow:inset -2px -2px #404040,inset 2px 2px #dfdfdf,4px 4px rgba(0,0,0,.25);font:14px Arial,sans-serif";
    banner.innerHTML = `<strong>Analytics choice</strong><p style="margin:7px 0 12px">We use analytics to understand visits and improve Old School Apps. You can accept or decline optional analytics.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button data-consent="accept" type="button">Accept analytics</button><button data-consent="decline" type="button">Decline</button><a href="privacy.html" style="color:#000">Privacy Policy</a></div>`;
    banner.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-consent]")?.dataset.consent;
      if (!choice) return;
      localStorage.setItem(consentKey, choice === "accept" ? "granted" : "denied");
      banner.remove();
      if (choice === "accept") initializeAnalytics();
    });
    const mount = () => document.body?.appendChild(banner);
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
  }

  if (localStorage.getItem(consentKey) === "granted") initializeAnalytics();
  else if (!localStorage.getItem(consentKey)) showConsentBanner();

  window.addEventListener("error", () => track("javascript_error", {
    page_path: window.location.pathname,
  }));
  window.addEventListener("unhandledrejection", () => track("javascript_error", {
    page_path: window.location.pathname,
    error_type: "unhandled_rejection",
  }));

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-analytics-event]");
    if (!control) return;
    const parameters = {};
    for (const [key, value] of Object.entries(control.dataset)) {
      if (key.startsWith("analyticsParam")) {
        const parameterName = key.slice("analyticsParam".length).replace(/^[A-Z]/, (letter) => letter.toLowerCase());
        parameters[parameterName] = value;
      }
    }
    track(control.dataset.analyticsEvent, parameters);
  });
})();
