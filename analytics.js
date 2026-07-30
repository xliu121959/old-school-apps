(function () {
  const measurementId = "G-Y9KJ0W90MZ";
  if (window.__oldSchoolAnalyticsLoaded) return;
  window.__oldSchoolAnalyticsLoaded = true;

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
  });

  function track(name, parameters = {}) {
    if (!name || typeof window.gtag !== "function") return;
    window.gtag("event", name, parameters);
  }

  window.OldSchoolAnalytics = { track };

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
