(function initializeAuthSecurity() {
  const widgets = new Map();
  let configPromise;
  let scriptPromise;

  async function getConfig() {
    if (!configPromise) {
      configPromise = fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "config" }),
      })
        .then((response) => response.json())
        .catch(() => ({ captchaEnabled: false, captchaSiteKey: "" }));
    }
    return configPromise;
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (!scriptPromise) {
      scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("Security check could not load."));
        document.head.appendChild(script);
      });
    }
    return scriptPromise;
  }

  async function ensure(containerId, action) {
    const config = await getConfig();
    if (!config.captchaEnabled) return { enabled: false, token: "" };
    const container = document.getElementById(containerId);
    if (!container) throw new Error("Security check container is missing.");
    container.hidden = false;
    await loadTurnstile();

    let entry = widgets.get(containerId);
    if (entry && entry.action !== action) {
      window.turnstile.remove(entry.widgetId);
      widgets.delete(containerId);
      container.replaceChildren();
      entry = null;
    }
    if (!entry) {
      const next = { action, token: "", widgetId: null };
      next.widgetId = window.turnstile.render(container, {
        sitekey: config.captchaSiteKey,
        action,
        size: "flexible",
        callback(token) {
          next.token = token;
        },
        "expired-callback"() {
          next.token = "";
        },
        "error-callback"() {
          next.token = "";
        },
      });
      widgets.set(containerId, next);
      entry = next;
    }
    return { enabled: true, token: entry.token };
  }

  function token(containerId) {
    return widgets.get(containerId)?.token || "";
  }

  function reset(containerId) {
    const entry = widgets.get(containerId);
    if (!entry) return;
    entry.token = "";
    window.turnstile?.reset(entry.widgetId);
  }

  window.OldSchoolAuthSecurity = {
    ensure,
    getConfig,
    reset,
    token,
  };
})();
