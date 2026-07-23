const apps = [
  {
    name: "Retro File Cabinet",
    tagline: "AI filing for every document drawer.",
    features: ["Smart drawers and folders", "OCR for scans and receipts", "AI tags and filing rules"],
    platform: "Mac",
    status: "Available",
    downloads: [
      {
        action: "Download for Windows",
        link: "https://github.com/xliu121959/doc_organizer/releases/download/v0.1.0/Private.File.Organizer_0.1.0_x64-setup.exe",
      },
      {
        action: "Download for Mac",
        link: "https://github.com/xliu121959/doc_organizer/releases/download/v0.1.0/Private.File.Organizer_0.1.0_aarch64.dmg",
      },
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
      {
        action: "Open Web App",
        link: "typewriter-notes.html",
      },
      {
        action: "Download for Windows",
        link: "https://github.com/xliu121959/typewriter-notes-desktop/releases/download/v0.2.0/Typewriter.Notes.Setup-0.2.0.exe",
      },
      {
        action: "Download for Mac",
        link: "https://github.com/xliu121959/typewriter-notes-desktop/releases/download/v0.2.0/Typewriter.Notes-0.2.0.dmg",
      },
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
  cabinet: `
    <span class="mini cabinet-icon">
      <span></span><span></span><span></span>
    </span>
  `,
  typewriter: `
    <span class="mini typewriter-icon">
      <span></span><span></span><span></span>
    </span>
  `,
  vhs: `
    <span class="mini vhs-icon">
      <span></span><span></span>
    </span>
  `,
  cassette: `
    <span class="mini cassette-icon">
      <span></span><span></span><span></span>
    </span>
  `,
  rolodex: `
    <span class="mini rolodex-icon">
      <span></span><span></span><span></span>
    </span>
  `,
  calendar: `
    <span class="mini calendar-icon">
      <span></span><span></span><span></span>
    </span>
  `,
};

const platformClasses = {
  Mac: "platform-mac",
  iOS: "platform-ios",
  Web: "platform-web",
};

const statusClasses = {
  Available: "status-available",
  Beta: "status-beta",
  "Coming Soon": "status-soon",
};

const appGrid = document.querySelector("#app-grid");

function renderAppCard(app) {
  const featureItems = app.features.map((feature) => `<li>${feature}</li>`).join("");
  const downloads = app.downloads || [{ action: app.action, link: app.link }];
  const downloadLinks = downloads
    .map((download) => {
      const actionClass = download.action === "Open Web App" ? " web-app-link" : "";
      return `<a class="download-link${actionClass}" href="${download.link}">${download.action}</a>`;
    })
    .join("");

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

appGrid.innerHTML = apps.map(renderAppCard).join("");

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const target = document.querySelector(anchor.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
