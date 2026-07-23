const STORAGE_KEY = "typewriter-notes-prototype-state-v4";
const LEGACY_STORAGE_KEYS = ["typewriter-notes-prototype-state-v3"];

const starterNotes = [
  {
    id: "morning-pages",
    title: "Morning Pages",
    notebook: "Journal",
    date: "Jul 18, 2026",
    created: "Jul 10, 2026",
    modified: "Jul 18, 4:20 AM",
    tags: ["journal", "daily"],
    body:
      "The desk is quiet except for the keys. I want this to stay simple: one thought after another, no bright badges, no stream of notifications, just ink finding its place.\n\nToday I am collecting loose fragments before the day gets noisy. A grocery list can wait. The chapter can wait. The important thing is to keep the carriage moving.",
    history: [
      {
        label: "Opened with coffee",
        title: "Morning Pages",
        body:
          "The desk is quiet except for the keys. I want this to stay simple: one thought after another, just ink finding its place.",
        modified: "Jul 18, 3:12 AM",
      },
      {
        label: "Trimmed first paragraph",
        title: "Morning Pages",
        body:
          "The desk is quiet except for the keys. I want this to stay simple: one thought after another, no bright badges, no stream of notifications, just ink finding its place.",
        modified: "Jul 18, 3:48 AM",
      },
    ],
  },
  {
    id: "chapter-draft",
    title: "Chapter Draft",
    notebook: "Drafts",
    date: "Jul 17, 2026",
    created: "Jul 12, 2026",
    modified: "Jul 17, 9:10 PM",
    tags: ["fiction", "chapter"],
    body:
      "The room looked smaller after midnight. Every object had a job: the lamp held the corner, the keys waited under his fingers, and the page kept its own counsel.",
    history: [{ label: "Saved chapter card", title: "Chapter Draft", body: "The room looked smaller after midnight.", modified: "Jul 17, 8:15 PM" }],
  },
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    notebook: "Work",
    date: "Jul 16, 2026",
    created: "Jul 16, 2026",
    modified: "Jul 16, 2:34 PM",
    tags: ["meeting", "planning"],
    body:
      "- Review export flow\n- Keep editor centered on mobile\n- Make autosave visible but quiet\n- Test theme switching before shipping",
    history: [{ label: "Captured action items", title: "Meeting Notes", body: "- Review export flow\n- Keep editor centered on mobile", modified: "Jul 16, 2:18 PM" }],
  },
  {
    id: "essay-outline",
    title: "Essay Outline",
    notebook: "School",
    date: "Jul 13, 2026",
    created: "Jul 12, 2026",
    modified: "Jul 13, 7:05 PM",
    tags: ["essay", "outline"],
    body:
      "Thesis: old tools stay memorable because they make abstract work physical.\n\n1. Paper as constraint\n2. Keys as pace\n3. Margins as structure\n4. Revision as visible craft",
    history: [{ label: "Moved thesis up", title: "Essay Outline", body: "Thesis: old tools stay memorable because they make abstract work physical.", modified: "Jul 13, 6:41 PM" }],
  },
  {
    id: "ideas-to-revisit",
    title: "Ideas to Revisit",
    notebook: "Archive",
    date: "Jul 11, 2026",
    created: "Jul 9, 2026",
    modified: "Jul 11, 8:12 AM",
    tags: ["ideas", "later"],
    body:
      "- Correction tape animation\n- Index-card outline mode\n- Ribbon color per notebook\n- Focus mode with only current paragraph visible\n- Export bundle with TXT, MD, and PDF",
    history: [{ label: "Archived list", title: "Ideas to Revisit", body: "- Correction tape animation\n- Index-card outline mode\n- Ribbon color per notebook", modified: "Jul 11, 8:02 AM" }],
  },
];

const themeLabels = {
  classic: "Classic",
  dark: "Dark Classic",
};

const defaultAppearance = {
  fontSize: 20,
  fontFamily: "Courier New",
  inkColor: "#111111",
  paperColor: "#fffff0",
  lineColor: "#e2e7de",
};

const themeAppearanceDefaults = {
  classic: {
    inkColor: "#111111",
    paperColor: "#fffff0",
    lineColor: "#e2e7de",
  },
  dark: {
    inkColor: "#f0f0e6",
    paperColor: "#202018",
    lineColor: "#343429",
  },
};

const state = loadState();
const elements = {
  body: document.body,
  sidebar: document.querySelector("#sidebar"),
  folderList: document.querySelector("#folderList"),
  noteList: document.querySelector("#noteList"),
  notesTotal: document.querySelector("#notesTotal"),
  searchInput: document.querySelector("#searchInput"),
  noteTitle: document.querySelector("#noteTitle"),
  editor: document.querySelector("#editor"),
  wordCount: document.querySelector("#wordCount"),
  charCount: document.querySelector("#charCount"),
  savedState: document.querySelector("#savedState"),
  soundToggle: document.querySelector("#soundToggle"),
  soundState: document.querySelector("#soundState"),
  focusButton: document.querySelector("#focusButton"),
  themeSelect: document.querySelector("#themeSelect"),
  themeState: document.querySelector("#themeState"),
  newNoteButton: document.querySelector("#newNoteButton"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  inspectorExportButton: document.querySelector("#inspectorExportButton"),
  exportDialog: document.querySelector("#exportDialog"),
  notebookDialog: document.querySelector("#notebookDialog"),
  notebookDialogTitle: document.querySelector("#notebookDialogTitle"),
  notebookNameInput: document.querySelector("#notebookNameInput"),
  addNotebookButton: document.querySelector("#addNotebookButton"),
  renameNotebookButton: document.querySelector("#renameNotebookButton"),
  activeNotebookLabel: document.querySelector("#activeNotebookLabel"),
  modifiedLabel: document.querySelector("#modifiedLabel"),
  createdLabel: document.querySelector("#createdLabel"),
  dateModifiedLabel: document.querySelector("#dateModifiedLabel"),
  fontSizeControl: document.querySelector("#fontSizeControl"),
  fontSizeValue: document.querySelector("#fontSizeValue"),
  fontFamilyControl: document.querySelector("#fontFamilyControl"),
  inkColorControl: document.querySelector("#inkColorControl"),
  historyList: document.querySelector("#historyList"),
  saveVersionButton: document.querySelector("#saveVersionButton"),
  tagList: document.querySelector("#tagList"),
  toast: document.querySelector("#toast"),
};

let saveTimer;
let notebookDialogMode = "create";
let audioContext;

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        notes: normalizeNotes(parsed.notes || starterNotes),
        notebooks: normalizeNotebooks(parsed.notebooks, parsed.notes || starterNotes),
        theme: normalizeTheme(parsed.theme),
        appearance: {
          ...defaultAppearance,
          ...(parsed.appearance || {}),
        },
      };
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    notes: normalizeNotes(starterNotes),
    notebooks: ["Journal", "Drafts", "Work", "School", "Archive"],
    activeNoteId: starterNotes[0].id,
    activeNotebook: "All Notes",
    search: "",
    soundOn: false,
    focusMode: false,
    theme: "classic",
    appearance: { ...defaultAppearance },
    lastSaved: "Saved",
  };
}

function normalizeTheme(theme) {
  if (theme === "night" || theme === "terminal") return "dark";
  return themeLabels[theme] ? theme : "classic";
}

function normalizeNotes(notes) {
  return notes.map((note) => ({
    ...note,
    tags: note.tags || [],
    history: normalizeHistory(note.history, note),
  }));
}

function normalizeHistory(history = [], note) {
  return history.map((entry) => {
    if (typeof entry === "string") {
      return {
        label: entry,
        title: note.title,
        body: note.body,
        modified: note.modified || note.date || "Saved draft",
      };
    }
    return {
      label: entry.label || "Saved version",
      title: entry.title || note.title,
      body: entry.body || note.body || "",
      modified: entry.modified || note.modified || "Saved draft",
    };
  });
}

function normalizeNotebooks(notebooks, notes) {
  const names = new Set([...(notebooks || []), ...notes.map((note) => note.notebook).filter(Boolean)]);
  return Array.from(names);
}

function saveState(label = "Saved") {
  state.lastSaved = label;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  elements.savedState.textContent = label;
}

function getActiveNote() {
  return state.notes.find((note) => note.id === state.activeNoteId) || state.notes[0];
}

function getNotebooks() {
  const names = new Set([...(state.notebooks || []), ...state.notes.map((note) => note.notebook).filter(Boolean)]);
  return ["All Notes", ...Array.from(names)];
}

function countWords(text) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function formatDateNow() {
  return new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function folderCount(folder) {
  if (folder === "All Notes") return state.notes.length;
  return state.notes.filter((note) => note.notebook === folder).length;
}

function filterNotes() {
  const query = state.search.trim().toLowerCase();
  return state.notes.filter((note) => {
    const inNotebook = state.activeNotebook === "All Notes" || note.notebook === state.activeNotebook;
    const searchable = [note.title, note.body, note.notebook, note.tags.join(" ")].join(" ").toLowerCase();
    return inNotebook && (!query || searchable.includes(query));
  });
}

function renderFolders() {
  elements.folderList.innerHTML = getNotebooks()
    .map(
      (folder) => `
        <button class="folder-button ${folder === state.activeNotebook ? "active" : ""}" data-folder="${folder}" type="button">
          <span>${folder}</span>
          <span>${folderCount(folder)}</span>
        </button>
      `,
    )
    .join("");
}

function renderNoteList() {
  const notes = filterNotes();
  elements.notesTotal.textContent = notes.length;
  elements.noteList.innerHTML = notes.length
    ? notes
        .map((note) => {
          const words = countWords(note.body);
          const tags = note.tags.map((tag) => `<span>${tag}</span>`).join("");
          return `
            <button class="note-button ${note.id === state.activeNoteId ? "active" : ""}" data-note-id="${note.id}" type="button">
              <strong>${note.title}</strong>
              <span class="note-meta">${note.date} ${words} words</span>
              <span class="inline-tags">${tags}</span>
            </button>
          `;
        })
        .join("")
    : `<p>No matching drafts.</p>`;
}

function renderEditor() {
  const note = getActiveNote();
  elements.noteTitle.value = note.title;
  elements.editor.value = note.body;
  elements.activeNotebookLabel.textContent = note.notebook;
  elements.modifiedLabel.textContent = note.modified || "Today";
  elements.createdLabel.textContent = note.created || "Today";
  elements.dateModifiedLabel.textContent = note.modified || "Today";
  elements.historyList.innerHTML = note.history.length
    ? note.history
        .map(
          (item, index) => `
            <button class="history-button" data-history-index="${index}" type="button">
              <span class="history-row">
                <span>${item.label}</span>
                <small>${item.modified}</small>
              </span>
              <span class="restore-label">Restore</span>
            </button>
          `,
        )
        .join("")
    : "<span>No saved versions yet.</span>";
  elements.tagList.innerHTML = note.tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join("");
  updateStats();
}

function renderSettings() {
  elements.body.dataset.theme = state.theme;
  elements.body.classList.toggle("focus-mode", state.focusMode);
  applyAppearance();
  elements.soundToggle.checked = state.soundOn;
  elements.themeSelect.value = state.theme;
  elements.themeState.textContent = themeLabels[state.theme];
  elements.searchInput.value = state.search;
  elements.fontSizeControl.value = state.appearance.fontSize;
  elements.fontSizeValue.textContent = `${state.appearance.fontSize}px`;
  elements.fontFamilyControl.value = state.appearance.fontFamily || defaultAppearance.fontFamily;
  elements.inkColorControl.value = state.appearance.inkColor;
  elements.focusButton.textContent = state.focusMode ? "Exit Focus" : "Focus Mode";
  elements.soundState.textContent = state.soundOn ? "Sound on" : "Sound off";
  elements.savedState.textContent = state.lastSaved;
}

function render() {
  renderSettings();
  renderFolders();
  renderNoteList();
  renderEditor();
}

function updateStats() {
  const text = elements.editor.value;
  const wordCount = countWords(text);
  const charCount = text.length;
  elements.wordCount.textContent = `${wordCount} ${wordCount === 1 ? "word" : "words"}`;
  elements.charCount.textContent = `${charCount} ${charCount === 1 ? "character" : "characters"}`;
}

function applyAppearance() {
  const size = Number(state.appearance.fontSize) || defaultAppearance.fontSize;
  const lineStep = Math.round(size * 2.2);
  const topPadding = 59;
  const ruleOffset = topPadding;
  const fontFamily = state.appearance.fontFamily || defaultAppearance.fontFamily;
  const fontStack = fontFamily === "Arial" ? "Arial, Helvetica, sans-serif" : `"${fontFamily}", ${fontFamily === "Courier New" ? "Courier, monospace" : "serif"}`;
  elements.body.style.setProperty("--editor-font-size", `${size}px`);
  elements.body.style.setProperty("--editor-font-family", fontStack);
  elements.body.style.setProperty("--line-step", `${lineStep}px`);
  elements.body.style.setProperty("--editor-top-padding", `${topPadding}px`);
  elements.body.style.setProperty("--rule-offset", `${ruleOffset}px`);
  elements.body.style.setProperty("--ink", state.appearance.inkColor);
  elements.body.style.setProperty("--paper", state.appearance.paperColor);
  elements.body.style.setProperty("--paper-line", state.appearance.lineColor);
}

function scheduleSave() {
  elements.savedState.textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveState("Saved");
  }, 350);
}

function updateActiveNote(changes) {
  const note = getActiveNote();
  Object.assign(note, changes);
  note.date = "Today";
  note.modified = formatDateNow();
  updateStats();
  renderNoteList();
  elements.modifiedLabel.textContent = note.modified;
  elements.dateModifiedLabel.textContent = note.modified;
  scheduleSave();
}

function insertFormatting({ format, wrap }) {
  const editor = elements.editor;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const selection = value.slice(start, end);
  let nextValue;
  let cursor;

  if (wrap) {
    nextValue = `${value.slice(0, start)}${wrap}${selection || "text"}${wrap}${value.slice(end)}`;
    cursor = selection ? end + wrap.length * 2 : start + wrap.length;
  } else {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    nextValue = `${value.slice(0, lineStart)}${format}${value.slice(lineStart)}`;
    cursor = start + format.length;
  }

  editor.value = nextValue;
  editor.focus();
  editor.setSelectionRange(cursor, cursor);
  updateActiveNote({ body: nextValue });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  setTimeout(() => elements.toast.classList.remove("visible"), 2200);
}

function sanitizeFilename(name) {
  return (name || "Untitled Draft").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentNote(format) {
  const note = getActiveNote();
  const baseName = sanitizeFilename(note.title);

  if (format === "txt") {
    downloadFile(`${baseName}.txt`, note.body, "text/plain;charset=utf-8");
    showToast("Downloaded TXT export.");
    return;
  }

  if (format === "markdown") {
    downloadFile(`${baseName}.md`, `# ${note.title}\n\n${note.body}`, "text/markdown;charset=utf-8");
    showToast("Downloaded Markdown export.");
    return;
  }

  if (format === "pdf") {
    openPrintExport(note);
  }
}

function openPrintExport(note) {
  const printWindow = window.open("", "_blank", "width=820,height=900");
  if (!printWindow) {
    showToast("Allow popups to export PDF.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(note.title)}</title>
        <style>
          body { margin: 48px; color: #111; background: #fff; font: 16px/1.65 "Courier New", monospace; }
          h1 { font-size: 28px; line-height: 1.2; margin: 0 0 8px; }
          .meta { margin-bottom: 28px; color: #555; font: 13px Arial, sans-serif; }
          pre { white-space: pre-wrap; word-wrap: break-word; font: inherit; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(note.title)}</h1>
        <div class="meta">${escapeHtml(note.notebook)} / ${escapeHtml(note.modified || "Saved draft")}</div>
        <pre>${escapeHtml(note.body)}</pre>
        <script>window.onload = () => window.print();<\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
  showToast("Opened print dialog for PDF.");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function createNewNote() {
  const id = `draft-${Date.now()}`;
  const now = formatDateNow();
  const note = {
    id,
    title: "Untitled Draft",
    notebook: state.activeNotebook === "All Notes" ? "Journal" : state.activeNotebook,
    date: "Today",
    created: now,
    modified: now,
    tags: ["draft"],
    body: "",
    history: [],
  };
  state.notes.unshift(note);
  state.activeNoteId = id;
  state.search = "";
  saveState("Saved");
  render();
  elements.noteTitle.focus();
}

function openNotebookDialog(mode) {
  notebookDialogMode = mode;
  const isRename = mode === "rename";
  if (isRename && state.activeNotebook === "All Notes") {
    showToast("Select a notebook to rename.");
    return;
  }
  elements.notebookDialogTitle.textContent = isRename ? "Rename notebook" : "New notebook";
  elements.notebookNameInput.value = isRename ? state.activeNotebook : "";

  if (typeof elements.notebookDialog.showModal === "function") {
    elements.notebookDialog.showModal();
    elements.notebookNameInput.focus();
    elements.notebookNameInput.select();
  }
}

function saveNotebookFromDialog() {
  const name = elements.notebookNameInput.value.trim();
  if (!name) {
    showToast("Notebook name is required.");
    return;
  }

  state.notebooks = state.notebooks || [];
  const existing = getNotebooks().some((folder) => folder.toLowerCase() === name.toLowerCase());
  if (notebookDialogMode === "create") {
    if (!existing) state.notebooks.push(name);
    state.activeNotebook = name;
    showToast(existing ? "Notebook already exists." : "Notebook created.");
  } else {
    const oldName = state.activeNotebook;
    if (existing && oldName.toLowerCase() !== name.toLowerCase()) {
      showToast("Notebook name already exists.");
      return;
    }
    state.notebooks = state.notebooks.map((folder) => (folder === oldName ? name : folder));
    state.notes.forEach((note) => {
      if (note.notebook === oldName) note.notebook = name;
    });
    state.activeNotebook = name;
    showToast("Notebook renamed.");
  }

  saveState();
  render();
}

function saveVersion() {
  const note = getActiveNote();
  const now = formatDateNow();
  note.history.unshift({
    label: `Saved ${now}`,
    title: note.title,
    body: note.body,
    modified: now,
  });
  note.history = note.history.slice(0, 10);
  saveState("Version saved");
  renderEditor();
  showToast("Draft version saved.");
}

function restoreVersion(index) {
  const note = getActiveNote();
  const version = note.history[index];
  if (!version) return;
  const now = formatDateNow();
  note.history.unshift({
    label: `Before restore ${now}`,
    title: note.title,
    body: note.body,
    modified: note.modified || now,
  });
  note.title = version.title;
  note.body = version.body;
  note.modified = now;
  note.date = "Today";
  saveState("Restored");
  render();
  showToast("Draft version restored.");
}

function playTypewriterClick() {
  if (!state.soundOn) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext = audioContext || new AudioContext();
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(110, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.04);
}

async function importNotes(files) {
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) return;
  const now = formatDateNow();
  const importedNotes = await Promise.all(
    selectedFiles.map(async (file) => {
      const body = await file.text();
      const title = file.name.replace(/\.(txt|md|markdown)$/i, "") || "Imported Note";
      const extension = file.name.split(".").pop()?.toLowerCase() || "txt";
      return {
        id: `import-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        notebook: state.activeNotebook === "All Notes" ? "Imported" : state.activeNotebook,
        date: "Today",
        created: now,
        modified: now,
        tags: [extension === "txt" ? "text" : "markdown"],
        body,
        history: [],
      };
    }),
  );

  state.notebooks = normalizeNotebooks(state.notebooks || [], [...state.notes, ...importedNotes]);
  state.notes.unshift(...importedNotes);
  state.activeNoteId = importedNotes[0].id;
  state.activeNotebook = importedNotes[0].notebook;
  state.search = "";
  saveState("Imported");
  render();
  showToast(`Imported ${importedNotes.length} note${importedNotes.length === 1 ? "" : "s"}.`);
}

function openExportDialog() {
  if (typeof elements.exportDialog.showModal === "function") {
    elements.exportDialog.showModal();
  } else {
    showToast("Export options: TXT, Markdown, PDF");
  }
}

elements.folderList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-folder]");
  if (!button) return;
  state.activeNotebook = button.dataset.folder;
  renderFolders();
  renderNoteList();
  saveState();
});

elements.noteList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-note-id]");
  if (!button) return;
  state.activeNoteId = button.dataset.noteId;
  renderNoteList();
  renderEditor();
  saveState();
});

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderNoteList();
});

elements.noteTitle.addEventListener("input", (event) => {
  updateActiveNote({ title: event.target.value || "Untitled Draft" });
});

elements.editor.addEventListener("input", (event) => {
  if (state.soundOn) {
    playTypewriterClick();
    elements.soundState.textContent = "Key struck";
    setTimeout(() => {
      elements.soundState.textContent = "Sound on";
    }, 140);
  }
  updateActiveNote({ body: event.target.value });
});

document.querySelector(".command-bar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-format], [data-wrap]");
  if (!button) return;
  insertFormatting({ format: button.dataset.format, wrap: button.dataset.wrap });
});

elements.soundToggle.addEventListener("change", (event) => {
  state.soundOn = event.target.checked;
  elements.soundState.textContent = state.soundOn ? "Sound on" : "Sound off";
  saveState();
});

elements.focusButton.addEventListener("click", () => {
  state.focusMode = !state.focusMode;
  elements.body.classList.toggle("focus-mode", state.focusMode);
  elements.focusButton.textContent = state.focusMode ? "Exit Focus" : "Focus Mode";
  saveState(state.focusMode ? "Focus mode" : "Saved");
});

elements.themeSelect.addEventListener("change", (event) => {
  state.theme = event.target.value;
  state.appearance = {
    ...state.appearance,
    ...themeAppearanceDefaults[state.theme],
  };
  elements.body.dataset.theme = state.theme;
  elements.themeState.textContent = themeLabels[state.theme];
  renderSettings();
  saveState("Saved");
});

elements.fontSizeControl.addEventListener("input", (event) => {
  state.appearance.fontSize = Number(event.target.value) || defaultAppearance.fontSize;
  elements.fontSizeValue.textContent = `${state.appearance.fontSize}px`;
  applyAppearance();
  saveState();
});

elements.inkColorControl.addEventListener("input", (event) => {
  state.appearance.inkColor = event.target.value;
  applyAppearance();
  saveState();
});

elements.fontFamilyControl.addEventListener("change", (event) => {
  state.appearance.fontFamily = event.target.value;
  applyAppearance();
  saveState();
});

elements.newNoteButton.addEventListener("click", createNewNote);
elements.importButton.addEventListener("click", () => elements.importInput.click());
elements.importInput.addEventListener("change", async (event) => {
  await importNotes(event.target.files);
  event.target.value = "";
});
elements.exportButton.addEventListener("click", openExportDialog);
elements.inspectorExportButton.addEventListener("click", openExportDialog);
elements.addNotebookButton.addEventListener("click", () => openNotebookDialog("create"));
elements.renameNotebookButton.addEventListener("click", () => openNotebookDialog("rename"));
elements.saveVersionButton.addEventListener("click", saveVersion);

elements.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-index]");
  if (!button) return;
  restoreVersion(Number(button.dataset.historyIndex));
});

elements.exportDialog.addEventListener("close", () => {
  if (!elements.exportDialog.returnValue || elements.exportDialog.returnValue === "close") return;
  exportCurrentNote(elements.exportDialog.returnValue);
  elements.exportDialog.returnValue = "";
});

elements.notebookDialog.addEventListener("close", () => {
  if (elements.notebookDialog.returnValue === "save") {
    saveNotebookFromDialog();
  }
  elements.notebookDialog.returnValue = "";
});

render();
