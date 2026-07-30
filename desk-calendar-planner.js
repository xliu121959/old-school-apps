const PLANNER_STORAGE_KEY = "desk-calendar-planner-v1";
const AUTH_STORAGE_KEY = "typewriter-notes-auth-v1";
const PLANNER_STATE_ENDPOINT = "/api/state?app=desk-calendar-planner";
const PREMIUM_THEMES = new Set(["night", "executive"]);

function track(eventName, parameters = {}) {
  window.OldSchoolAnalytics?.track(eventName, parameters);
}

const plannerState = loadPlannerState();
const authState = {
  session: loadSession(),
  profile: null,
};
let taskBeingEdited = null;
let eventBeingEdited = null;
let saveTimer = null;
let cloudSaveTimer = null;
let toastTimer = null;
let stickyHistoryCaptured = false;

const elements = {
  todayButton: document.querySelector("#todayButton"),
  newTaskButton: document.querySelector("#newTaskButton"),
  newEventButton: document.querySelector("#newEventButton"),
  inlineTaskButton: document.querySelector("#inlineTaskButton"),
  inlineEventButton: document.querySelector("#inlineEventButton"),
  themeSelect: document.querySelector("#themeSelect"),
  exportButton: document.querySelector("#exportButton"),
  historyButton: document.querySelector("#historyButton"),
  viewButtons: document.querySelectorAll("[data-view]"),
  settingsButton: document.querySelector("#settingsButton"),
  upgradeButton: document.querySelector("#upgradeButton"),
  inspectorUpgradeButton: document.querySelector("#inspectorUpgradeButton"),
  accountButton: document.querySelector("#accountButton"),
  previousMonthButton: document.querySelector("#previousMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  miniMonthTitle: document.querySelector("#miniMonthTitle"),
  miniCalendar: document.querySelector("#miniCalendar"),
  taskSearch: document.querySelector("#taskSearch"),
  sectionButtons: document.querySelectorAll("[data-section]"),
  selectedTaskCount: document.querySelector("#selectedTaskCount"),
  weekTaskCount: document.querySelector("#weekTaskCount"),
  openTaskCount: document.querySelector("#openTaskCount"),
  priorityTaskCount: document.querySelector("#priorityTaskCount"),
  weekStrip: document.querySelector("#weekStrip"),
  dayView: document.querySelector("#dayView"),
  weekView: document.querySelector("#weekView"),
  pageMonth: document.querySelector("#pageMonth"),
  pageDay: document.querySelector("#pageDay"),
  pageWeekday: document.querySelector("#pageWeekday"),
  pageDateTitle: document.querySelector("#pageDateTitle"),
  pageSummary: document.querySelector("#pageSummary"),
  taskProgressText: document.querySelector("#taskProgressText"),
  taskList: document.querySelector("#taskList"),
  eventCountText: document.querySelector("#eventCountText"),
  eventTimeline: document.querySelector("#eventTimeline"),
  stickyNote: document.querySelector("#stickyNote"),
  weekTitle: document.querySelector("#weekTitle"),
  weekSummary: document.querySelector("#weekSummary"),
  weekColumns: document.querySelector("#weekColumns"),
  detailDate: document.querySelector("#detailDate"),
  detailTasks: document.querySelector("#detailTasks"),
  detailEvents: document.querySelector("#detailEvents"),
  tagList: document.querySelector("#tagList"),
  prioritySummary: document.querySelector("#prioritySummary"),
  reminderList: document.querySelector("#reminderList"),
  carryTasksToggle: document.querySelector("#carryTasksToggle"),
  statusDate: document.querySelector("#statusDate"),
  statusTasks: document.querySelector("#statusTasks"),
  statusCompleted: document.querySelector("#statusCompleted"),
  cloudState: document.querySelector("#cloudState"),
  saveState: document.querySelector("#saveState"),
  passSummary: document.querySelector("#passSummary"),
  passSummaryText: document.querySelector("#passSummaryText"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  taskDialogTitle: document.querySelector("#taskDialogTitle"),
  taskTitleInput: document.querySelector("#taskTitleInput"),
  taskTagsInput: document.querySelector("#taskTagsInput"),
  taskPriorityInput: document.querySelector("#taskPriorityInput"),
  eventDialog: document.querySelector("#eventDialog"),
  eventForm: document.querySelector("#eventForm"),
  eventDialogTitle: document.querySelector("#eventDialogTitle"),
  eventTimeInput: document.querySelector("#eventTimeInput"),
  eventTitleInput: document.querySelector("#eventTitleInput"),
  eventReminderInput: document.querySelector("#eventReminderInput"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsForm: document.querySelector("#settingsForm"),
  weekStartSelect: document.querySelector("#weekStartSelect"),
  showCompletedToggle: document.querySelector("#showCompletedToggle"),
  confirmDeleteToggle: document.querySelector("#confirmDeleteToggle"),
  authDialog: document.querySelector("#authDialog"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authMessage: document.querySelector("#authMessage"),
  socialLoginButtons: document.querySelectorAll(".social-login"),
  signUpButton: document.querySelector("#signUpButton"),
  closeAuthButton: document.querySelector("#closeAuthButton"),
  accountDialog: document.querySelector("#accountDialog"),
  accountEmail: document.querySelector("#accountEmail"),
  accountPlan: document.querySelector("#accountPlan"),
  accountMessage: document.querySelector("#accountMessage"),
  accountUpgradeButton: document.querySelector("#accountUpgradeButton"),
  billingButton: document.querySelector("#billingButton"),
  signOutButton: document.querySelector("#signOutButton"),
  closeAccountButton: document.querySelector("#closeAccountButton"),
  upgradeDialog: document.querySelector("#upgradeDialog"),
  upgradeMessage: document.querySelector("#upgradeMessage"),
  checkoutButton: document.querySelector("#checkoutButton"),
  closeUpgradeButton: document.querySelector("#closeUpgradeButton"),
  exportDialog: document.querySelector("#exportDialog"),
  closeExportButton: document.querySelector("#closeExportButton"),
  exportOptions: document.querySelectorAll("[data-export]"),
  historyDialog: document.querySelector("#historyDialog"),
  historyList: document.querySelector("#historyList"),
  closeHistoryButton: document.querySelector("#closeHistoryButton"),
  toast: document.querySelector("#toast"),
};

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date) {
  const start = new Date(date);
  const weekStart = Number(plannerState.preferences.weekStart);
  const difference = (start.getDay() - weekStart + 7) % 7;
  start.setDate(start.getDate() - difference);
  start.setHours(0, 0, 0, 0);
  return start;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedPlannerState() {
  const today = new Date();
  const todayKey = localDateKey(today);
  const tomorrowKey = localDateKey(addDays(today, 1));
  const fridayOffset = (5 - today.getDay() + 7) % 7 || 7;
  const fridayKey = localDateKey(addDays(today, fridayOffset));
  const weekStartDate = startOfWeekForSeed(today, 1);
  const tuesdayKey = localDateKey(addDays(weekStartDate, 1));
  const thursdayKey = localDateKey(addDays(weekStartDate, 3));

  return {
    selectedDate: todayKey,
    visibleMonth: todayKey.slice(0, 7),
    view: "day",
    theme: "classic",
    filter: "selected",
    query: "",
    preferences: {
      weekStart: 1,
      showCompleted: true,
      confirmDelete: false,
      carryTasks: false,
    },
    history: [],
    clientUpdatedAt: Date.now(),
    days: {
      [todayKey]: {
        tasks: [
          { id: "sample-rent", title: "Pay rent", completed: false, priority: true, tags: ["home", "finance"] },
          { id: "sample-update", title: "Draft weekly update", completed: false, priority: false, tags: ["work"] },
          { id: "sample-insurance", title: "Call insurance office", completed: true, priority: false, tags: ["calls"] },
          { id: "sample-receipts", title: "Review receipts", completed: false, priority: false, tags: ["finance"] },
        ],
        events: [
          { id: "sample-gym", time: "18:30", title: "Gym", reminder: "30" },
          { id: "sample-coffee", time: "10:30", title: "Coffee with Maya", reminder: "10" },
        ],
        note: "Keep Friday afternoon open",
      },
      [tomorrowKey]: {
        tasks: [
          { id: "sample-agenda", title: "Prepare meeting agenda", completed: false, priority: false, tags: ["work"] },
        ],
        events: [],
        note: "",
      },
      [tuesdayKey]: {
        tasks: [
          { id: "sample-library", title: "Return library books", completed: false, priority: false, tags: ["errands"] },
        ],
        events: [],
        note: "",
      },
      [thursdayKey]: {
        tasks: [],
        events: [
          { id: "sample-dentist", time: "14:00", title: "Dentist appointment", reminder: "60" },
        ],
        note: "",
      },
      [fridayKey]: {
        tasks: [
          { id: "sample-week", title: "Close out the week", completed: false, priority: true, tags: ["work"] },
        ],
        events: [],
        note: "Keep Friday afternoon open",
      },
    },
  };
}

function startOfWeekForSeed(date, weekStart) {
  const start = new Date(date);
  const difference = (start.getDay() - weekStart + 7) % 7;
  start.setDate(start.getDate() - difference);
  return start;
}

function loadPlannerState() {
  try {
    const stored = JSON.parse(localStorage.getItem(PLANNER_STORAGE_KEY) || "null");
    if (stored?.days && stored?.preferences) return normalizePlannerState(stored);
  } catch {
    // A malformed local value should not prevent the planner from opening.
  }
  return seedPlannerState();
}

function normalizePlannerState(value) {
  const fallback = seedPlannerState();
  return {
    ...fallback,
    ...value,
    preferences: {
      ...fallback.preferences,
      ...(value.preferences || {}),
    },
    days: value.days && typeof value.days === "object" ? value.days : fallback.days,
    history: Array.isArray(value.history) ? value.history.slice(0, 20) : [],
    clientUpdatedAt: Number(value.clientUpdatedAt) || 0,
  };
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function ensureDay(key) {
  if (!plannerState.days[key]) {
    plannerState.days[key] = { tasks: [], events: [], note: "" };
  }
  return plannerState.days[key];
}

function isPro() {
  return authState.profile?.plan === "pro"
    && ["active", "trialing"].includes(authState.profile?.subscriptionStatus);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2600);
}

function openUpgradeDialog(message = "") {
  elements.upgradeMessage.textContent = message;
  elements.upgradeDialog.showModal();
}

function requirePass(message) {
  if (isPro()) return true;
  openUpgradeDialog(message);
  return false;
}

function historySnapshot(label) {
  return {
    id: createId("history"),
    label,
    savedAt: new Date().toISOString(),
    selectedDate: plannerState.selectedDate,
    view: plannerState.view,
    theme: plannerState.theme,
    preferences: structuredClone(plannerState.preferences),
    days: structuredClone(plannerState.days),
  };
}

function recordHistory(label) {
  if (!isPro()) return;
  plannerState.history.unshift(historySnapshot(label));
  plannerState.history = plannerState.history.slice(0, 20);
}

function scheduleSave() {
  elements.saveState.textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    plannerState.clientUpdatedAt = Date.now();
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(plannerState));
    elements.saveState.textContent = "Saved locally";
    scheduleCloudSave();
  }, 180);
}

function scheduleCloudSave() {
  if (!isPro() || !authState.session?.access_token) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(saveCloudState, 900);
}

async function apiRequest(path, options = {}, retry = true) {
  if (authState.session && authState.session.expires_at * 1000 < Date.now() + 60000) {
    await refreshSession();
  }
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (authState.session?.access_token) {
    headers.Authorization = `Bearer ${authState.session.access_token}`;
  }
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && retry && authState.session?.refresh_token) {
    await refreshSession();
    return apiRequest(path, options, false);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
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

async function saveCloudState() {
  if (!isPro() || !authState.session?.access_token) return;
  elements.cloudState.textContent = "Cloud saving...";
  try {
    await apiRequest(PLANNER_STATE_ENDPOINT, {
      method: "PUT",
      body: JSON.stringify({ state: plannerState }),
    });
    elements.cloudState.textContent = "Cloud / Pass";
  } catch (error) {
    elements.cloudState.textContent = "Cloud error";
    showToast(error.message);
  }
}

async function syncCloudState() {
  if (!isPro() || !authState.session?.access_token) return;
  elements.cloudState.textContent = "Cloud syncing...";
  const cloud = await apiRequest(PLANNER_STATE_ENDPOINT);
  if (cloud.state && Number(cloud.state.clientUpdatedAt || 0) > Number(plannerState.clientUpdatedAt || 0)) {
    Object.assign(plannerState, normalizePlannerState(cloud.state));
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(plannerState));
    render();
    showToast("Cloud planner restored.");
  } else {
    await saveCloudState();
  }
}

function renderAccountState() {
  const signedIn = Boolean(authState.session?.access_token);
  const pro = isPro();
  elements.accountButton.textContent = signedIn ? "Account" : "Sign In";
  elements.upgradeButton.hidden = pro;
  elements.inspectorUpgradeButton.hidden = pro;
  elements.accountEmail.textContent = authState.profile?.email || authState.session?.user?.email || "";
  elements.accountPlan.textContent = pro ? "Apps Pass" : "Free";
  elements.accountUpgradeButton.hidden = pro;
  elements.billingButton.hidden = !authState.profile?.canManageBilling;
  elements.passSummaryText.textContent = pro
    ? "Apps Pass active. Cloud sync and premium desk tools are available."
    : "Local planning is free. Upgrade for cloud sync and advanced desk tools.";
  elements.cloudState.textContent = pro && signedIn ? "Cloud / Pass" : "Local only";
  elements.historyButton.classList.toggle("unlocked", pro);
}

async function loadAccount() {
  if (!authState.session?.access_token) return;
  authState.profile = await apiRequest("/api/account");
  render();
}

async function finishSignIn(session) {
  setSession(session);
  elements.authDialog.close();
  await loadAccount();
  if (isPro()) await syncCloudState();
  track("login_completed", { app: "desk-calendar-planner" });
  renderAccountState();
  showToast(isPro() ? "Signed in. Cloud planner is on." : "Signed in. Local planning remains free.");
}

async function submitAuth(action) {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  const security = window.OldSchoolAuthSecurity;
  elements.authMessage.textContent = action === "signup" ? "Creating account..." : "Signing in...";
  try {
    let captchaToken = security?.token("plannerAuthCaptcha") || "";
    if (action === "signup" && security) {
      const challenge = await security.ensure("plannerAuthCaptcha", "signup");
      captchaToken = challenge.token;
      if (challenge.enabled && !captchaToken) {
        elements.authMessage.textContent = "Complete the security check, then select Create Account again.";
        return;
      }
    }
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email, password, captchaToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.code === "captcha_required" && security) {
        await security.ensure("plannerAuthCaptcha", "login");
      }
      if (captchaToken) security?.reset("plannerAuthCaptcha");
      throw new Error(data.error || "Authentication failed");
    }
    if (captchaToken) security?.reset("plannerAuthCaptcha");
    if (!data.access_token) {
      elements.authMessage.textContent = data.message || "If this email is eligible, confirmation instructions were sent.";
      return;
    }
    elements.authMessage.textContent = "";
    await finishSignIn(data);
  } catch (error) {
    track("auth_failed", { app: "desk-calendar-planner", method: "email", action });
    elements.authMessage.textContent = error.message;
  }
}

async function startOAuth(provider) {
  track("login_started", { app: "desk-calendar-planner", method: provider });
  elements.authMessage.textContent = `Opening ${provider === "google" ? "Google" : "Facebook"}...`;
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "oauth", provider, returnTo: "/desk-calendar-planner.html" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Social sign-in is unavailable");
    window.location.assign(data.url);
  } catch (error) {
    elements.authMessage.textContent = error.message;
  }
}

function signOut(showMessage = true) {
  authState.session = null;
  authState.profile = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  elements.accountDialog.close();
  renderAccountState();
  render();
  if (showMessage) showToast("Signed out. Local planning remains available.");
}

async function startCheckout() {
  track("checkout_started", { app: "desk-calendar-planner" });
  if (!authState.session?.access_token) {
    elements.upgradeDialog.close();
    elements.authDialog.showModal();
    elements.authMessage.textContent = "Create an account or sign in before upgrading.";
    return;
  }
  elements.checkoutButton.disabled = true;
  elements.upgradeMessage.textContent = "Opening secure checkout...";
  try {
    const data = await apiRequest("/api/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({ returnTo: "/desk-calendar-planner.html" }),
    });
    window.location.href = data.url;
  } catch (error) {
    elements.upgradeMessage.textContent = error.message;
    elements.checkoutButton.disabled = false;
  }
}

async function openBillingPortal() {
  elements.accountMessage.textContent = "Opening billing...";
  try {
    const data = await apiRequest("/api/create-portal-session", {
      method: "POST",
      body: JSON.stringify({ returnTo: "/desk-calendar-planner.html" }),
    });
    window.location.href = data.url;
  } catch (error) {
    elements.accountMessage.textContent = error.message;
  }
}

async function refreshPassAfterCheckout(attempt = 0) {
  try {
    await loadAccount();
    if (isPro()) {
      await syncCloudState();
      showToast("Apps Pass active. Premium planner tools are unlocked.");
      history.replaceState({}, "", window.location.pathname);
      return;
    }
  } catch {
    // Stripe webhooks can take a moment; retry before reporting a problem.
  }
  if (attempt < 4) {
    window.setTimeout(() => refreshPassAfterCheckout(attempt + 1), 1400);
  } else {
    showToast("Payment received. Refresh shortly if premium access is still activating.");
  }
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatTime(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return formatDate(date, { hour: "numeric", minute: "2-digit" });
}

function getWeekDates() {
  const start = startOfWeek(dateFromKey(plannerState.selectedDate));
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function dayMatchesQuery(day) {
  const query = plannerState.query.trim().toLowerCase();
  if (!query) return true;
  return day.tasks.some((task) => {
    const searchable = `${task.title} ${task.tags.join(" ")}`.toLowerCase();
    return searchable.includes(query);
  }) || day.events.some((event) => event.title.toLowerCase().includes(query));
}

function taskMatches(task) {
  const query = plannerState.query.trim().toLowerCase();
  if (query && !`${task.title} ${task.tags.join(" ")}`.toLowerCase().includes(query)) return false;
  if (!plannerState.preferences.showCompleted && task.completed) return false;
  if (plannerState.filter === "open" && task.completed) return false;
  if (plannerState.filter === "priority" && !task.priority) return false;
  return true;
}

function allTasks() {
  return Object.entries(plannerState.days).flatMap(([date, day]) => day.tasks.map((task) => ({ ...task, date })));
}

function renderMiniCalendar() {
  const [year, month] = plannerState.visibleMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const weekStart = Number(plannerState.preferences.weekStart);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const gridStart = addDays(first, -offset);
  const dayNames = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startOfWeekForSeed(new Date(2024, 0, 7), weekStart), index);
    return formatDate(date, { weekday: "narrow" });
  });
  const todayKey = localDateKey(new Date());

  elements.miniMonthTitle.textContent = formatDate(first, { month: "long", year: "numeric" });
  const headings = dayNames.map((name) => `<th scope="col">${name}</th>`).join("");
  const rows = Array.from({ length: 6 }, (_, row) => {
    const cells = Array.from({ length: 7 }, (_, column) => {
      const date = addDays(gridStart, row * 7 + column);
      const key = localDateKey(date);
      const classes = [
        date.getMonth() !== first.getMonth() ? "outside" : "",
        key === todayKey ? "today" : "",
        key === plannerState.selectedDate ? "selected" : "",
      ].filter(Boolean).join(" ");
      return `<td><button class="${classes}" data-date="${key}" type="button">${date.getDate()}</button></td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  elements.miniCalendar.innerHTML = `<table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderWeekStrip() {
  const todayKey = localDateKey(new Date());
  elements.weekStrip.innerHTML = getWeekDates().map((date) => {
    const key = localDateKey(date);
    const day = ensureDay(key);
    const count = day.tasks.filter((task) => !task.completed).length;
    const classes = [key === plannerState.selectedDate ? "selected" : "", key === todayKey ? "today" : ""]
      .filter(Boolean)
      .join(" ");
    return `
      <button class="week-day ${classes}" data-date="${key}" type="button">
        <span>${formatDate(date, { weekday: "short" })}</span>
        <strong>${date.getDate()}</strong>
        <small>${count} open</small>
      </button>
    `;
  }).join("");
}

function taskMarkup(task) {
  const tags = task.tags.map((tag) => `<span class="paper-tag">${escapeHtml(tag)}</span>`).join("");
  return `
    <article class="task-item ${task.completed ? "completed" : ""} ${task.priority ? "high" : ""}" data-task-id="${task.id}">
      <input class="task-toggle" type="checkbox" ${task.completed ? "checked" : ""} aria-label="Complete ${escapeHtml(task.title)}" />
      <div class="task-copy">
        <button class="task-title-button" data-action="edit-task" type="button">${escapeHtml(task.title)}</button>
        <div class="task-meta">
          ${task.priority ? '<span class="priority-stamp">HIGH</span>' : ""}
          ${tags}
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-button" data-action="priority-task" type="button" title="Toggle high priority">!</button>
        <button class="icon-button" data-action="delete-task" type="button" title="Delete task">X</button>
      </div>
    </article>
  `;
}

function eventMarkup(event) {
  const reminder = event.reminder !== "none"
    ? (isPro() ? `${event.reminder} min reminder` : "Reminder - Pass")
    : "No reminder";
  return `
    <article class="event-item" data-event-id="${event.id}">
      <time class="event-time">${formatTime(event.time)}</time>
      <div class="event-copy">
        <button class="event-title-button" data-action="edit-event" type="button">${escapeHtml(event.title)}</button>
        <small>${reminder}</small>
      </div>
      <div class="item-actions">
        <button class="icon-button" data-action="delete-event" type="button" title="Delete event">X</button>
      </div>
    </article>
  `;
}

function renderDayView() {
  const selected = dateFromKey(plannerState.selectedDate);
  const day = ensureDay(plannerState.selectedDate);
  const tasks = day.tasks.filter(taskMatches);
  const events = day.events
    .filter((event) => !plannerState.query || event.title.toLowerCase().includes(plannerState.query.toLowerCase()))
    .sort((a, b) => a.time.localeCompare(b.time));
  const completed = day.tasks.filter((task) => task.completed).length;

  elements.pageMonth.textContent = formatDate(selected, { month: "short" });
  elements.pageDay.textContent = selected.getDate();
  elements.pageWeekday.textContent = formatDate(selected, { weekday: "long" });
  elements.pageDateTitle.textContent = formatDate(selected, { month: "long", day: "numeric", year: "numeric" });
  elements.pageSummary.textContent = `${day.tasks.length} tasks and ${day.events.length} appointments filed`;
  elements.taskProgressText.textContent = `${completed} of ${day.tasks.length} complete`;
  elements.eventCountText.textContent = `${day.events.length} scheduled`;
  elements.taskList.innerHTML = tasks.length ? tasks.map(taskMarkup).join("") : '<p class="empty-state">No matching tasks on this page.</p>';
  elements.eventTimeline.innerHTML = events.length ? events.map(eventMarkup).join("") : '<p class="empty-state">The appointment book is clear.</p>';
  elements.stickyNote.value = day.note || "";
}

function renderWeekView() {
  const dates = getWeekDates();
  const first = dates[0];
  const last = dates[6];
  const todayKey = localDateKey(new Date());
  const weekTasks = dates.flatMap((date) => ensureDay(localDateKey(date)).tasks);
  const completed = weekTasks.filter((task) => task.completed).length;

  elements.weekTitle.textContent = `${formatDate(first, { month: "short", day: "numeric" })} - ${formatDate(last, { month: "short", day: "numeric", year: "numeric" })}`;
  elements.weekSummary.textContent = `${weekTasks.length} tasks / ${completed} completed`;
  elements.weekColumns.innerHTML = dates.map((date) => {
    const key = localDateKey(date);
    const day = ensureDay(key);
    const taskCards = day.tasks.filter(taskMatches).map((task) => `
      <div class="week-card ${task.completed ? "completed" : ""} ${task.priority ? "high" : ""}">
        ${escapeHtml(task.title)}
      </div>
    `).join("");
    const eventCards = day.events
      .filter((event) => !plannerState.query || event.title.toLowerCase().includes(plannerState.query.toLowerCase()))
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((event) => `<div class="week-card event">${formatTime(event.time)}<br>${escapeHtml(event.title)}</div>`)
      .join("");
    return `
      <section class="week-column ${key === todayKey ? "today" : ""}">
        <button class="week-column-heading" data-date="${key}" type="button">
          <strong>${formatDate(date, { weekday: "short" })} ${date.getDate()}</strong>
          <span>${day.tasks.length} tasks</span>
        </button>
        ${taskCards}${eventCards}
      </section>
    `;
  }).join("");
}

function renderInspector() {
  const selected = dateFromKey(plannerState.selectedDate);
  const day = ensureDay(plannerState.selectedDate);
  const tags = [...new Set(day.tasks.flatMap((task) => task.tags))];
  const highPriority = day.tasks.filter((task) => task.priority && !task.completed).length;
  const reminders = day.events.filter((event) => event.reminder !== "none").sort((a, b) => a.time.localeCompare(b.time));

  elements.detailDate.textContent = formatDate(selected, { month: "short", day: "numeric", year: "numeric" });
  elements.detailTasks.textContent = `${day.tasks.filter((task) => !task.completed).length} open`;
  elements.detailEvents.textContent = String(day.events.length);
  elements.tagList.innerHTML = tags.length
    ? tags.map((tag) => `<span class="inspector-tag">${escapeHtml(tag)}</span>`).join("")
    : "<span>No tags filed</span>";
  elements.prioritySummary.textContent = highPriority ? `${highPriority} high priority` : "No red stamps";
  elements.reminderList.innerHTML = !isPro()
    ? '<p class="empty-state">Event reminders unlock with Apps Pass.</p>'
    : reminders.length
    ? reminders.map((event) => `
      <div class="reminder-item">
        <strong>${formatTime(event.time)} - ${escapeHtml(event.title)}</strong>
        <span>${event.reminder} minutes before</span>
      </div>
    `).join("")
    : '<p class="empty-state">No reminders.</p>';
}

function renderCounts() {
  const tasks = allTasks();
  const selectedTasks = ensureDay(plannerState.selectedDate).tasks;
  const weekKeys = new Set(getWeekDates().map(localDateKey));
  const weekTasks = tasks.filter((task) => weekKeys.has(task.date));
  const open = tasks.filter((task) => !task.completed);
  const high = open.filter((task) => task.priority);
  const completed = selectedTasks.filter((task) => task.completed).length;

  elements.selectedTaskCount.textContent = selectedTasks.length;
  elements.weekTaskCount.textContent = weekTasks.length;
  elements.openTaskCount.textContent = open.length;
  elements.priorityTaskCount.textContent = high.length;
  elements.statusTasks.textContent = `${selectedTasks.length} tasks`;
  elements.statusCompleted.textContent = `${completed} completed`;
}

function renderViewState() {
  const isDay = plannerState.view === "day";
  elements.dayView.hidden = !isDay;
  elements.weekView.hidden = isDay;
  elements.viewButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === plannerState.view));
}

function render() {
  const planKnown = !authState.session?.access_token || Boolean(authState.profile);
  if (planKnown && !isPro() && PREMIUM_THEMES.has(plannerState.theme)) {
    plannerState.theme = "classic";
  }
  const selected = dateFromKey(plannerState.selectedDate);
  plannerState.visibleMonth = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}`;
  document.body.dataset.theme = plannerState.theme;
  elements.themeSelect.value = plannerState.theme;
  elements.statusDate.textContent = formatDate(selected, { weekday: "short", month: "short", day: "numeric" });
  elements.carryTasksToggle.checked = isPro() && plannerState.preferences.carryTasks;
  elements.weekStartSelect.value = String(plannerState.preferences.weekStart);
  elements.showCompletedToggle.checked = plannerState.preferences.showCompleted;
  elements.confirmDeleteToggle.checked = plannerState.preferences.confirmDelete;

  renderMiniCalendar();
  renderWeekStrip();
  renderDayView();
  renderWeekView();
  renderInspector();
  renderCounts();
  renderViewState();
  renderAccountState();
}

function carryOpenTasks(fromKey, toKey) {
  if (!isPro() || !plannerState.preferences.carryTasks) return;
  const fromDate = dateFromKey(fromKey);
  if (localDateKey(addDays(fromDate, 1)) !== toKey) return;
  const sourceTasks = ensureDay(fromKey).tasks.filter((task) => !task.completed);
  const target = ensureDay(toKey);
  const additions = sourceTasks.filter((task) => !target.tasks.some((entry) => entry.carriedFrom === task.id));
  if (!additions.length) return;
  recordHistory("Before carrying open tasks");
  target.tasks.push(...additions.map((task) => ({
    ...structuredClone(task),
    id: createId("task"),
    carriedFrom: task.id,
  })));
  showToast(`${additions.length} open ${additions.length === 1 ? "task" : "tasks"} carried forward.`);
}

function selectDate(key) {
  const previousDate = plannerState.selectedDate;
  carryOpenTasks(previousDate, key);
  plannerState.selectedDate = key;
  stickyHistoryCaptured = false;
  ensureDay(key);
  render();
  scheduleSave();
}

function renderHistory() {
  elements.historyList.innerHTML = plannerState.history.length
    ? plannerState.history.map((entry) => `
      <article class="history-entry">
        <div>
          <strong>${escapeHtml(entry.label)}</strong>
          <span>${formatDate(new Date(entry.savedAt), { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
        <button class="office-button" data-history-id="${entry.id}" type="button">Restore</button>
      </article>
    `).join("")
    : '<p class="empty-state">No premium snapshots yet. Changes will appear here as you plan.</p>';
}

function restoreHistory(id) {
  if (!requirePass("Planner history is included with the Apps Pass.")) return;
  const entry = plannerState.history.find((item) => item.id === id);
  if (!entry) return;
  const preservedHistory = [...plannerState.history];
  Object.assign(plannerState, normalizePlannerState({
    ...plannerState,
    selectedDate: entry.selectedDate,
    view: entry.view,
    theme: entry.theme,
    preferences: structuredClone(entry.preferences),
    days: structuredClone(entry.days),
    history: preservedHistory,
    clientUpdatedAt: Date.now(),
  }));
  elements.historyDialog.close();
  render();
  scheduleSave();
  showToast("Planner snapshot restored.");
}

function selectedDayExportText() {
  const date = dateFromKey(plannerState.selectedDate);
  const day = ensureDay(plannerState.selectedDate);
  const taskLines = day.tasks.length
    ? day.tasks.map((task) => `${task.completed ? "[x]" : "[ ]"}${task.priority ? " [HIGH]" : ""} ${task.title}`).join("\n")
    : "(No tasks)";
  const eventLines = day.events.length
    ? [...day.events].sort((a, b) => a.time.localeCompare(b.time)).map((event) => `${formatTime(event.time)} - ${event.title}`).join("\n")
    : "(No appointments)";
  return [
    `Desk Calendar Planner - ${formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
    "",
    "THINGS TO DO",
    taskLines,
    "",
    "APPOINTMENTS",
    eventLines,
    "",
    "QUICK NOTE",
    day.note || "(No note)",
  ].join("\n");
}

function downloadTextExport() {
  const blob = new Blob([selectedDayExportText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `desk-planner-${plannerState.selectedDate}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Downloaded text planner.");
}

function openPdfExport() {
  if (!requirePass("PDF export is included with the Apps Pass.")) return;
  const date = dateFromKey(plannerState.selectedDate);
  const day = ensureDay(plannerState.selectedDate);
  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) {
    showToast("Allow popups to export PDF.");
    return;
  }
  const tasks = day.tasks.map((task) => `
    <li class="${task.completed ? "done" : ""}">
      ${task.priority ? '<b class="priority">HIGH</b>' : ""}
      ${escapeHtml(task.title)}
    </li>
  `).join("") || "<li>No tasks</li>";
  const events = [...day.events].sort((a, b) => a.time.localeCompare(b.time)).map((event) => `
    <li><b>${formatTime(event.time)}</b> ${escapeHtml(event.title)}</li>
  `).join("") || "<li>No appointments</li>";
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Desk Planner ${plannerState.selectedDate}</title>
        <style>
          body { margin: 48px; color: #222; background: #fffdf0; font: 16px/1.5 Georgia, serif; }
          header { padding-bottom: 18px; border-bottom: 3px solid #a21d24; }
          h1 { margin: 0; font-size: 30px; }
          h2 { margin-top: 28px; border-bottom: 1px solid #888; font-size: 18px; }
          li { margin: 9px 0; }
          .done { color: #777; text-decoration: line-through; }
          .priority { margin-right: 7px; padding: 2px 5px; color: #a21d24; border: 2px solid #a21d24; font: 11px Arial; }
          .note { min-height: 110px; padding: 18px; background: #fff09a; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <header>
          <h1>${escapeHtml(formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}</h1>
          <p>Desk Calendar Planner</p>
        </header>
        <h2>Things To Do</h2>
        <ul>${tasks}</ul>
        <h2>Appointments</h2>
        <ul>${events}</ul>
        <h2>Quick Note</h2>
        <div class="note">${escapeHtml(day.note || "")}</div>
        <script>window.onload = () => window.print();<\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
  showToast("Opened print dialog for PDF.");
}

function openTaskDialog(task = null) {
  taskBeingEdited = task?.id || null;
  elements.taskDialogTitle.textContent = task ? "Edit Task" : "New Task";
  elements.taskTitleInput.value = task?.title || "";
  elements.taskTagsInput.value = task?.tags.join(", ") || "";
  elements.taskPriorityInput.checked = Boolean(task?.priority);
  elements.taskDialog.showModal();
  window.setTimeout(() => elements.taskTitleInput.focus(), 0);
}

function openEventDialog(event = null) {
  eventBeingEdited = event?.id || null;
  elements.eventDialogTitle.textContent = event ? "Edit Event" : "New Event";
  elements.eventTimeInput.value = event?.time || "09:00";
  elements.eventTitleInput.value = event?.title || "";
  elements.eventReminderInput.value = event?.reminder || "none";
  elements.eventDialog.showModal();
  window.setTimeout(() => elements.eventTitleInput.focus(), 0);
}

function shouldDelete(label) {
  return !plannerState.preferences.confirmDelete || window.confirm(`Delete ${label}?`);
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

elements.todayButton.addEventListener("click", () => selectDate(localDateKey(new Date())));
elements.newTaskButton.addEventListener("click", () => { track("task_create_started", { app: "desk-calendar-planner" }); openTaskDialog(); });
elements.inlineTaskButton.addEventListener("click", () => openTaskDialog());
elements.newEventButton.addEventListener("click", () => { track("event_create_started", { app: "desk-calendar-planner" }); openEventDialog(); });
elements.inlineEventButton.addEventListener("click", () => openEventDialog());

elements.themeSelect.addEventListener("change", () => {
  const nextTheme = elements.themeSelect.value;
  if (PREMIUM_THEMES.has(nextTheme) && !requirePass(`${elements.themeSelect.options[elements.themeSelect.selectedIndex].text.replace(" - Pass", "")} is included with the Apps Pass.`)) {
    elements.themeSelect.value = plannerState.theme;
    return;
  }
  recordHistory(`Before changing theme to ${elements.themeSelect.options[elements.themeSelect.selectedIndex].text.replace(" - Pass", "")}`);
  plannerState.theme = nextTheme;
  render();
  scheduleSave();
  track("theme_changed", { app: "desk-calendar-planner", theme: plannerState.theme });
});

elements.viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    plannerState.view = button.dataset.view;
    renderViewState();
    scheduleSave();
  });
});

elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());

elements.previousMonthButton.addEventListener("click", () => {
  const [year, month] = plannerState.visibleMonth.split("-").map(Number);
  const previous = new Date(year, month - 2, 1);
  plannerState.visibleMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  renderMiniCalendar();
});

elements.nextMonthButton.addEventListener("click", () => {
  const [year, month] = plannerState.visibleMonth.split("-").map(Number);
  const next = new Date(year, month, 1);
  plannerState.visibleMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  renderMiniCalendar();
});

elements.miniCalendar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (button) selectDate(button.dataset.date);
});

elements.weekStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (button) selectDate(button.dataset.date);
});

elements.weekColumns.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  plannerState.view = "day";
  selectDate(button.dataset.date);
});

elements.taskSearch.addEventListener("input", () => {
  plannerState.query = elements.taskSearch.value;
  renderDayView();
  renderWeekView();
});

elements.sectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    plannerState.filter = button.dataset.section;
    if (plannerState.filter === "week") plannerState.view = "week";
    if (plannerState.filter === "selected") plannerState.view = "day";
    elements.sectionButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
    scheduleSave();
  });
});

elements.taskList.addEventListener("change", (event) => {
  const item = event.target.closest("[data-task-id]");
  if (!item || !event.target.classList.contains("task-toggle")) return;
  const task = ensureDay(plannerState.selectedDate).tasks.find((entry) => entry.id === item.dataset.taskId);
  if (!task) return;
  recordHistory(`Before ${event.target.checked ? "completing" : "reopening"} ${task.title}`);
  task.completed = event.target.checked;
  track("task_completed_changed", { app: "desk-calendar-planner", completed: task.completed });
  render();
  scheduleSave();
});

elements.taskList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-task-id]");
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!item || !action) return;
  const day = ensureDay(plannerState.selectedDate);
  const task = day.tasks.find((entry) => entry.id === item.dataset.taskId);
  if (!task) return;

  if (action === "edit-task") openTaskDialog(task);
  if (action === "priority-task") {
    recordHistory(`Before changing priority for ${task.title}`);
    task.priority = !task.priority;
    render();
    scheduleSave();
  }
  if (action === "delete-task" && shouldDelete(`"${task.title}"`)) {
    recordHistory(`Before deleting ${task.title}`);
    day.tasks = day.tasks.filter((entry) => entry.id !== task.id);
    render();
    scheduleSave();
  }
});

elements.eventTimeline.addEventListener("click", (event) => {
  const item = event.target.closest("[data-event-id]");
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!item || !action) return;
  const day = ensureDay(plannerState.selectedDate);
  const calendarEvent = day.events.find((entry) => entry.id === item.dataset.eventId);
  if (!calendarEvent) return;

  if (action === "edit-event") openEventDialog(calendarEvent);
  if (action === "delete-event" && shouldDelete(`"${calendarEvent.title}"`)) {
    recordHistory(`Before deleting ${calendarEvent.title}`);
    day.events = day.events.filter((entry) => entry.id !== calendarEvent.id);
    render();
    scheduleSave();
  }
});

elements.stickyNote.addEventListener("input", () => {
  if (!stickyHistoryCaptured) {
    recordHistory("Before editing the daily sticky note");
    stickyHistoryCaptured = true;
  }
  ensureDay(plannerState.selectedDate).note = elements.stickyNote.value;
  scheduleSave();
});

elements.carryTasksToggle.addEventListener("change", () => {
  if (elements.carryTasksToggle.checked && !requirePass("Recurring task carry-forward is included with the Apps Pass.")) {
    elements.carryTasksToggle.checked = false;
    return;
  }
  recordHistory("Before changing recurring task settings");
  plannerState.preferences.carryTasks = elements.carryTasksToggle.checked;
  scheduleSave();
});

elements.taskForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!elements.taskForm.reportValidity()) return;
  const day = ensureDay(plannerState.selectedDate);
  const tags = elements.taskTagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 6);
  const existing = day.tasks.find((task) => task.id === taskBeingEdited);
  recordHistory(existing ? `Before editing ${existing.title}` : "Before adding a task");

  if (existing) {
    existing.title = elements.taskTitleInput.value.trim();
    existing.tags = tags;
    existing.priority = elements.taskPriorityInput.checked;
  } else {
    day.tasks.push({
      id: createId("task"),
      title: elements.taskTitleInput.value.trim(),
      completed: false,
      priority: elements.taskPriorityInput.checked,
      tags,
    });
    track("task_created", { app: "desk-calendar-planner" });
  }
  elements.taskDialog.close();
  render();
  scheduleSave();
});

elements.eventForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!elements.eventForm.reportValidity()) return;
  const day = ensureDay(plannerState.selectedDate);
  const existing = day.events.find((calendarEvent) => calendarEvent.id === eventBeingEdited);
  if (elements.eventReminderInput.value !== "none" && !requirePass("Event reminders are included with the Apps Pass.")) return;
  recordHistory(existing ? `Before editing ${existing.title}` : "Before adding an appointment");

  if (existing) {
    existing.time = elements.eventTimeInput.value;
    existing.title = elements.eventTitleInput.value.trim();
    existing.reminder = elements.eventReminderInput.value;
  } else {
    day.events.push({
      id: createId("event"),
      time: elements.eventTimeInput.value,
      title: elements.eventTitleInput.value.trim(),
      reminder: elements.eventReminderInput.value,
    });
    track("event_created", { app: "desk-calendar-planner" });
  }
  elements.eventDialog.close();
  render();
  scheduleSave();
});

elements.settingsForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  recordHistory("Before changing planner preferences");
  plannerState.preferences.weekStart = Number(elements.weekStartSelect.value);
  plannerState.preferences.showCompleted = elements.showCompletedToggle.checked;
  plannerState.preferences.confirmDelete = elements.confirmDeleteToggle.checked;
  render();
  scheduleSave();
});

elements.exportButton.addEventListener("click", () => elements.exportDialog.showModal());
elements.closeExportButton.addEventListener("click", () => elements.exportDialog.close());
elements.exportOptions.forEach((button) => {
  button.addEventListener("click", () => {
    elements.exportDialog.close();
    if (button.dataset.export === "text") downloadTextExport();
    if (button.dataset.export === "pdf") openPdfExport();
    track("export_requested", { app: "desk-calendar-planner", format: button.dataset.export });
  });
});

elements.historyButton.addEventListener("click", () => {
  if (!requirePass("Restorable planner history is included with the Apps Pass.")) return;
  renderHistory();
  elements.historyDialog.showModal();
});
elements.closeHistoryButton.addEventListener("click", () => elements.historyDialog.close());
elements.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-id]");
  if (button) restoreHistory(button.dataset.historyId);
});

elements.accountButton.addEventListener("click", () => {
  if (authState.session?.access_token) {
    renderAccountState();
    elements.accountDialog.showModal();
  } else {
    elements.authMessage.textContent = "";
    elements.authDialog.showModal();
  }
});
elements.upgradeButton.addEventListener("click", () => openUpgradeDialog());
elements.inspectorUpgradeButton.addEventListener("click", () => openUpgradeDialog());
elements.accountUpgradeButton.addEventListener("click", () => {
  elements.accountDialog.close();
  openUpgradeDialog();
});
elements.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth("login");
});
elements.signUpButton.addEventListener("click", () => submitAuth("signup"));
elements.socialLoginButtons.forEach((button) => {
  button.addEventListener("click", () => startOAuth(button.dataset.provider));
});
elements.signOutButton.addEventListener("click", () => signOut());
elements.checkoutButton.addEventListener("click", startCheckout);
elements.billingButton.addEventListener("click", openBillingPortal);
elements.closeAuthButton.addEventListener("click", () => elements.authDialog.close());
elements.closeAccountButton.addEventListener("click", () => elements.accountDialog.close());
elements.closeUpgradeButton.addEventListener("click", () => elements.upgradeDialog.close());

readOAuthCallback();
render();
localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(plannerState));

if (authState.session?.access_token) {
  loadAccount()
    .then(() => {
      if (isPro()) return syncCloudState();
      elements.cloudState.textContent = "Local only";
      return null;
    })
    .catch((error) => {
      elements.cloudState.textContent = "Cloud error";
      showToast(error.message);
    });
}

const checkoutResult = new URLSearchParams(window.location.search).get("checkout");
if (checkoutResult === "success") {
  showToast("Payment received. Activating your Apps Pass...");
  window.setTimeout(() => refreshPassAfterCheckout(), 1000);
}
