const PLANNER_STORAGE_KEY = "desk-calendar-planner-v1";

const plannerState = loadPlannerState();
let taskBeingEdited = null;
let eventBeingEdited = null;
let saveTimer = null;

const elements = {
  todayButton: document.querySelector("#todayButton"),
  newTaskButton: document.querySelector("#newTaskButton"),
  newEventButton: document.querySelector("#newEventButton"),
  inlineTaskButton: document.querySelector("#inlineTaskButton"),
  inlineEventButton: document.querySelector("#inlineEventButton"),
  themeSelect: document.querySelector("#themeSelect"),
  viewButtons: document.querySelectorAll("[data-view]"),
  settingsButton: document.querySelector("#settingsButton"),
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
  saveState: document.querySelector("#saveState"),
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
    if (stored?.days && stored?.preferences) return stored;
  } catch {
    // A malformed local value should not prevent the planner from opening.
  }
  return seedPlannerState();
}

function ensureDay(key) {
  if (!plannerState.days[key]) {
    plannerState.days[key] = { tasks: [], events: [], note: "" };
  }
  return plannerState.days[key];
}

function scheduleSave() {
  elements.saveState.textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(plannerState));
    elements.saveState.textContent = "Saved locally";
  }, 180);
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
  const reminder = event.reminder !== "none" ? `${event.reminder} min reminder` : "No reminder";
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
  elements.reminderList.innerHTML = reminders.length
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
  const selected = dateFromKey(plannerState.selectedDate);
  plannerState.visibleMonth = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}`;
  document.body.dataset.theme = plannerState.theme;
  elements.themeSelect.value = plannerState.theme;
  elements.statusDate.textContent = formatDate(selected, { weekday: "short", month: "short", day: "numeric" });
  elements.carryTasksToggle.checked = plannerState.preferences.carryTasks;
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
}

function selectDate(key) {
  plannerState.selectedDate = key;
  ensureDay(key);
  render();
  scheduleSave();
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
elements.newTaskButton.addEventListener("click", () => openTaskDialog());
elements.inlineTaskButton.addEventListener("click", () => openTaskDialog());
elements.newEventButton.addEventListener("click", () => openEventDialog());
elements.inlineEventButton.addEventListener("click", () => openEventDialog());

elements.themeSelect.addEventListener("change", () => {
  plannerState.theme = elements.themeSelect.value;
  render();
  scheduleSave();
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
  task.completed = event.target.checked;
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
    task.priority = !task.priority;
    render();
    scheduleSave();
  }
  if (action === "delete-task" && shouldDelete(`"${task.title}"`)) {
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
    day.events = day.events.filter((entry) => entry.id !== calendarEvent.id);
    render();
    scheduleSave();
  }
});

elements.stickyNote.addEventListener("input", () => {
  ensureDay(plannerState.selectedDate).note = elements.stickyNote.value;
  scheduleSave();
});

elements.carryTasksToggle.addEventListener("change", () => {
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
  }
  elements.eventDialog.close();
  render();
  scheduleSave();
});

elements.settingsForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  plannerState.preferences.weekStart = Number(elements.weekStartSelect.value);
  plannerState.preferences.showCompleted = elements.showCompletedToggle.checked;
  plannerState.preferences.confirmDelete = elements.confirmDeleteToggle.checked;
  render();
  scheduleSave();
});

render();
scheduleSave();
