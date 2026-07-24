const AUTH_STORAGE_KEY = "typewriter-notes-auth-v1";

const apps = [
  {
    name: "Retro File Cabinet",
    tagline: "AI filing for every document drawer.",
    features: ["Smart drawers and folders", "OCR for scans and receipts", "AI tags and filing rules"],
    platform: "Mac",
    status: "Available",
    downloads: [
      { action: "Download for Windows - Pass", id: "retro-file-cabinet-windows", paid: true },
      { action: "Download for Mac - Pass", id: "retro-file-cabinet-mac", paid: true },
    ],
    icon: "cabinet",
  },
  {
    name: "Typewriter Notes",
    tagline: "Focused writing with a paper-and-ink feel.",
    features: ["Distraction-free writing", "Subtle paper texture", "Optional typewriter sounds"],
    platform: "Mac",
    status: "Available",
    downloads: [
      { action: "Open Web App", link: "typewriter-notes.html" },
      { action: "Download for Windows - Pass", id: "typewriter-notes-windows", paid: true },
      { action: "Download for Mac - Pass", id: "typewriter-notes-mac", paid: true },
    ],
    icon: "typewriter",
  },
  {
    name: "VHS Watchlist",
    tagline: "Track movies like a rental-store shelf.",
    features: ["Shelf-style collections", "Rental label ratings", "Watched and rewound lists"],
    platform: "Web",
    status: "Coming Soon",
    action: "Join Waitlist",
    link: "https://example.com/vhs-watchlist/waitlist",
    icon: "vhs",
  },
  {
    name: "Cassette Voice Notes",
    tagline: "Voice memos organized as tapes and labels.",
    features: ["Tape-based collections", "Rewind and clip markers", "Custom cassette labels"],
    platform: "iOS",
    status: "Coming Soon",
    action: "Join Waitlist",
    link: "https://example.com/cassette-voice-notes/waitlist",
    icon: "cassette",
  },
  {
    name: "Rolodex Contacts",
    tagline: "A tactile contact manager for real relationships.",
    features: ["Business-card records", "Follow-up reminders", "Fast alphabetical flipping"],
    platform: "Web",
    status: "Coming Soon",
    action: "Join Waitlist",
    link: "https://example.com/rolodex-contacts/waitlist",
    icon: "rolodex",
  },
  {
    name: "Desk Calendar Planner",
    tagline: "Plan the week on a clean paper desk pad.",
    features: ["Desk calendar layout", "Drag-to-reschedule tasks", "Monthly tear-off archive"],
    platform: "iOS",
    status: "Coming Soon",
    action: "Join Waitlist",
    link: "https://example.com/desk-calendar-planner/waitlist",
    icon: "calendar",
  },
];

const iconTemplates = {
  cabinet: `<span class="mini cabinet-icon"><span></span><span></span><span></span></span>`,
  typewriter: `<span class="mini typewriter-icon"><span></span><span></span><span></span></span>`,
  vhs: `<span class="mini vhs-icon"><span></span><span></span></span>`,
  cassette: `<span class="mini cassette-icon"><span></span><span></span><span></span></span>`,
  rolodex: `<span class="mini rolodex-icon"><span></span><span></span><span></span></span>`,
  calendar: `<span class="mini calendar-icon"><span></span><span></span><span></span></span>`,
};

const platformClasses = { Mac: "platform-mac", iOS: "platform-ios", Web: "platform-web" };
const statusClasses = { Available: "status-available", Beta: "status-beta", "Coming Soon": "status-soon" };
const authState = { session: loadSession(), profile: null };

const elements = {
  appGrid: document.querySelector("#app-grid"),
  accountButton: document.querySelector("#catalogAccountButton"),
  passButton: document.querySelector("#catalogPassButton"),
  authDialog: document.querySelector("#catalogAuthDialog"),
  authForm: document.querySelector("#catalogAuthForm"),
  authEmail: document.querySelector("#catalogAuthEmail"),
  authPassword: document.querySelector("#catalogAuthPassword"),
  authMessage: document.querySelector("#catalogAuthMessage"),
  signUpButton: document.querySelector("#catalogSignUpButton"),
  closeAuthButton: document.querySelector("#closeCatalogAuthButton"),
  accountDialog: document.querySelector("#catalogAccountDialog"),
  accountEmail: document.querySelector("#catalogAccountEmail"),
  accountPlan: document.querySelector("#catalogAccountPlan"),
  accountMessage: document.querySelector("#catalogAccountMessage"),
  accountUpgradeButton: document.querySelector("#catalogAccountUpgradeButton"),
  billingButton: document.querySelector("#catalogBillingButton"),
  signOutButton: document.querySelector("#catalogSignOutButton"),
  closeAccountButton: document.querySelector("#closeCatalogAccountButton"),
  upgradeDialog: document.querySelector("#catalogUpgradeDialog"),
  upgradeMessage: document.querySelector("#catalogUpgradeMessage"),
  checkoutButton: document.querySelector("#catalogCheckoutButton"),
  closeUpgradeButton: document.querySelector("#closeCatalogUpgradeButton"),
};

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function setSession(session) {
  authState.session = session;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function readOAuthCallback() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const error = params.get("error_description");
  if (error) {
    elements.authDialog.showModal();
    elements.authMessage.textContent = error;
    history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    return;
  }
  if (!accessToken) return;
  const expiresIn = Number(params.get("expires_in")) || 3600;
  setSession({
    access_token: accessToken,
    refresh_token: params.get("refresh_token"),
    token_type: params.get("token_type") || "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  });
  history.replaceState({}, "", window.location.pathname);
}

function renderAppCard(app) {
  const featureItems = app.features.map((feature) => `<li>${feature}</li>`).join("");
  const downloads = app.downloads || [{ action: app.action, link: app.link }];
  const downloadLinks = downloads.map((download) => {
    if (download.paid) {
      return `<button class="download-link paid-download" data-download-id="${download.id}" type="button">${download.action}</button>`;
    }
    const actionClass = download.action === "Open Web App" ? " web-app-link" : "";
    return `<a class="download-link${actionClass}" href="${download.link}">${download.action}</a>`;
  }).join("");

  return `
    <article class="app-card">
      <div class="app-card-top">
        ${iconTemplates[app.icon]}
        <div class="badges" aria-label="${app.name} metadata">
          <span class="badge ${platformClasses[app.platform]}">${app.platform}</span>
          <span class="badge ${statusClasses[app.status]}">${app.status}</span>
        </div>
      </div>
      <div class="app-card-copy">
        <h2>${app.name}</h2>
        <p>${app.tagline}</p>
        <ul>${featureItems}</ul>
      </div>
      <div class="download-actions">${downloadLinks}</div>
    </article>
  `;
}

function isPro() {
  return authState.profile?.plan === "pro";
}

function renderAccount() {
  const signedIn = Boolean(authState.session?.access_token);
  elements.accountButton.textContent = signedIn ? "Account" : "Sign In";
  elements.accountEmail.textContent = authState.profile?.email || "";
  elements.accountPlan.textContent = isPro() ? "Apps Pass" : "Free";
  elements.accountUpgradeButton.hidden = isPro();
  elements.billingButton.hidden = !authState.profile?.canManageBilling;
  document.body.classList.toggle("pass-active", isPro());
}

async function refreshSession() {
  if (!authState.session?.refresh_token) throw new Error("Sign in required");
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "refresh", refreshToken: authState.session.refresh_token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    signOut(false);
    throw new Error(data.error || "Your session expired");
  }
  setSession(data);
}

async function apiRequest(path, options = {}, retry = true) {
  if (authState.session && authState.session.expires_at * 1000 < Date.now() + 60000) {
    await refreshSession();
  }
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authState.session?.access_token) headers.Authorization = `Bearer ${authState.session.access_token}`;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && retry && authState.session?.refresh_token) {
    await refreshSession();
    return apiRequest(path, options, false);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadAccount() {
  if (!authState.session?.access_token) return;
  authState.profile = await apiRequest("/api/account");
  renderAccount();
}

async function submitAuth(action) {
  elements.authMessage.textContent = action === "signup" ? "Creating account..." : "Signing in...";
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        email: elements.authEmail.value.trim(),
        password: elements.authPassword.value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Authentication failed");
    if (!data.access_token) {
      elements.authMessage.textContent = "Check your email to confirm the account, then sign in.";
      return;
    }
    setSession(data);
    await loadAccount();
    elements.authDialog.close();
  } catch (error) {
    elements.authMessage.textContent = error.message;
  }
}

async function startOAuth(provider) {
  elements.authMessage.textContent = `Opening ${provider === "google" ? "Google" : "Facebook"}...`;
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "oauth", provider, returnTo: "/index.html" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Social sign-in is unavailable");
    window.location.assign(data.url);
  } catch (error) {
    elements.authMessage.textContent = error.message;
  }
}

function signOut(closeDialog = true) {
  authState.session = null;
  authState.profile = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  if (closeDialog) elements.accountDialog.close();
  renderAccount();
}

async function startCheckout() {
  if (!authState.session?.access_token) {
    elements.upgradeDialog.close();
    elements.authMessage.textContent = "Sign in before subscribing.";
    elements.authDialog.showModal();
    return;
  }
  elements.checkoutButton.disabled = true;
  elements.upgradeMessage.textContent = "Opening secure checkout...";
  try {
    const data = await apiRequest("/api/create-checkout-session", { method: "POST" });
    window.location.assign(data.url);
  } catch (error) {
    elements.upgradeMessage.textContent = error.message;
    elements.checkoutButton.disabled = false;
  }
}

async function openBilling() {
  elements.accountMessage.textContent = "Opening billing...";
  try {
    const data = await apiRequest("/api/create-portal-session", { method: "POST" });
    window.location.assign(data.url);
  } catch (error) {
    elements.accountMessage.textContent = error.message;
  }
}

async function requestDownload(id, button) {
  if (!authState.session?.access_token) {
    elements.authMessage.textContent = "Sign in and get the Apps Pass to download desktop apps.";
    elements.authDialog.showModal();
    return;
  }
  if (!isPro()) {
    elements.upgradeMessage.textContent = "Desktop downloads require an active Apps Pass.";
    elements.upgradeDialog.showModal();
    return;
  }
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing download...";
  try {
    const data = await apiRequest("/api/download", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    window.location.assign(data.url);
  } catch (error) {
    elements.upgradeMessage.textContent = error.message;
    elements.upgradeDialog.showModal();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

elements.appGrid.innerHTML = apps.map(renderAppCard).join("");
readOAuthCallback();
renderAccount();

document.addEventListener("click", (event) => {
  const downloadButton = event.target.closest("[data-download-id]");
  if (downloadButton) void requestDownload(downloadButton.dataset.downloadId, downloadButton);
});

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const target = document.querySelector(anchor.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

elements.accountButton.addEventListener("click", () => {
  if (authState.session?.access_token) {
    renderAccount();
    elements.accountDialog.showModal();
  } else {
    elements.authMessage.textContent = "";
    elements.authDialog.showModal();
  }
});
elements.passButton.addEventListener("click", () => elements.upgradeDialog.showModal());
elements.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitAuth("login");
});
elements.signUpButton.addEventListener("click", () => void submitAuth("signup"));
document.querySelectorAll(".social-login").forEach((button) => {
  button.addEventListener("click", () => void startOAuth(button.dataset.provider));
});
elements.signOutButton.addEventListener("click", () => signOut());
elements.accountUpgradeButton.addEventListener("click", () => {
  elements.accountDialog.close();
  elements.upgradeDialog.showModal();
});
elements.checkoutButton.addEventListener("click", startCheckout);
elements.billingButton.addEventListener("click", openBilling);
elements.closeAuthButton.addEventListener("click", () => elements.authDialog.close());
elements.closeAccountButton.addEventListener("click", () => elements.accountDialog.close());
elements.closeUpgradeButton.addEventListener("click", () => elements.upgradeDialog.close());

if (authState.session?.access_token) {
  loadAccount().catch(() => signOut(false));
}

const checkoutResult = new URLSearchParams(window.location.search).get("checkout");
if (checkoutResult === "success") {
  elements.upgradeMessage.textContent = "Payment received. Activating your Apps Pass...";
  elements.upgradeDialog.showModal();
  setTimeout(() => loadAccount().then(() => elements.upgradeDialog.close()).catch(() => {}), 1200);
}
