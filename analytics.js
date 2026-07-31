(function () {
  const measurementId = "G-Y9KJ0W90MZ";
  if (window.__oldSchoolAnalyticsLoaded) return;
  window.__oldSchoolAnalyticsLoaded = true;

  const debugTraffic = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
    || window.location.hostname.endsWith(".vercel.app")
    || new URLSearchParams(window.location.search).get("analytics_debug") === "1";

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

  function track(name, parameters = {}) {
    if (!name || typeof window.gtag !== "function") return;
    window.gtag("event", name, {
      ...parameters,
      ...(debugTraffic ? { debug_mode: true } : {}),
    });
  }

  window.OldSchoolAnalytics = { track };

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
