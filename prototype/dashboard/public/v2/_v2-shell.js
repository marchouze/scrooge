/**
 * _v2-shell.js — V2 dashboard shell: nav, provenance selector, errors badge.
 * Loaded on every V2 page. No external dependencies.
 */

const NAV = [
  {
    label: "Executive",
    icon: "◆",
    href: "/v2/index.html",
    items: [
      { label: "Home", href: "/v2/index.html" },
      { label: "Errors & Alerts", href: "/v2/errors.html" },
    ],
  },
  {
    label: "Finance",
    icon: "₣",
    href: "/v2/finance/index.html",
    items: [
      { label: "Overview", href: "/v2/finance/index.html" },
      { label: "Capital Adequacy", href: "/v2/finance/capital.html" },
      { label: "General Ledger", href: "/v2/finance/gl.html" },
      { label: "Daily P&L", href: "/v2/finance/pnl.html" },
      { label: "Regulatory Returns", href: "/v2/finance/returns.html" },
    ],
  },
  {
    label: "Treasury",
    icon: "⊕",
    href: "/v2/treasury/index.html",
    items: [
      { label: "Overview", href: "/v2/treasury/index.html" },
      { label: "ALM Positions", href: "/v2/treasury/alm.html" },
      { label: "LCR", href: "/v2/treasury/lcr.html" },
      { label: "NSFR", href: "/v2/treasury/nsfr.html" },
    ],
  },
  {
    label: "Markets",
    icon: "⟳",
    href: "/v2/markets/index.html",
    items: [
      { label: "Overview", href: "/v2/markets/index.html" },
      { label: "FIL Positions", href: "/v2/markets/positions.html" },
      { label: "FX Positions", href: "/v2/markets/fx.html" },
    ],
  },
  {
    label: "Risk",
    icon: "⚡",
    href: "/v2/risk/index.html",
    items: [
      { label: "Overview", href: "/v2/risk/index.html" },
      { label: "Market Risk", href: "/v2/risk/market.html" },
      { label: "Credit Risk", href: "/v2/risk/credit.html" },
      { label: "Operational Risk", href: "/v2/risk/operational.html" },
      { label: "Risk Appetite", href: "/v2/risk/appetite.html" },
      { label: "Model Validation", href: "/v2/risk/validation.html" },
    ],
  },
  {
    label: "Compliance",
    icon: "✓",
    href: "/v2/compliance/index.html",
    items: [
      { label: "Overview", href: "/v2/compliance/index.html" },
      { label: "Obligations", href: "/v2/compliance/obligations.html" },
      { label: "Applicability", href: "/v2/compliance/applicability.html" },
      { label: "Regulatory Filings", href: "/v2/compliance/returns.html" },
    ],
  },
  {
    label: "Audit",
    icon: "◎",
    href: "/v2/audit/index.html",
    items: [
      { label: "Overview", href: "/v2/audit/index.html" },
      { label: "Recon Gates", href: "/v2/audit/recon.html" },
      { label: "Findings", href: "/v2/audit/findings.html" },
    ],
  },
  {
    label: "Security",
    icon: "⊗",
    href: "/v2/security/index.html",
    items: [
      { label: "Overview", href: "/v2/security/index.html" },
      { label: "Posture Register", href: "/v2/security/posture.html" },
      { label: "Threat Model", href: "/v2/security/threats.html" },
    ],
  },
  {
    label: "Operations",
    icon: "⚙",
    href: "/v2/operations/index.html",
    items: [
      { label: "Overview", href: "/v2/operations/index.html" },
      { label: "Agent Fleet", href: "/v2/operations/agents.html" },
      { label: "Evaluations", href: "/v2/operations/evals.html" },
      { label: "Event Schemas", href: "/v2/operations/schemas.html" },
      { label: "Substrate", href: "/v2/operations/substrate.html" },
    ],
  },
  {
    label: "Governance",
    icon: "⊞",
    href: "/v2/governance/index.html",
    items: [
      { label: "Overview", href: "/v2/governance/index.html" },
      { label: "Decisions", href: "/v2/governance/decisions.html" },
      { label: "New Products (NPA)", href: "/v2/governance/npa.html" },
      { label: "Briefs", href: "/v2/governance/briefs.html" },
      { label: "Workstreams", href: "/v2/governance/workstreams.html" },
      { label: "Procedures", href: "/v2/governance/procedures.html" },
    ],
  },
  {
    label: "Data & Privacy",
    icon: "⊡",
    href: "/v2/data/index.html",
    items: [
      { label: "Overview", href: "/v2/data/index.html" },
      { label: "Data Register", href: "/v2/data/register.html" },
      { label: "DSARs", href: "/v2/data/dsars.html" },
    ],
  },
  {
    label: "Commercial",
    icon: "⊛",
    href: "/v2/commercial/index.html",
    items: [
      { label: "Overview", href: "/v2/commercial/index.html" },
      { label: "Subscribers", href: "/v2/commercial/subscribers.html" },
      { label: "Tiers", href: "/v2/commercial/tiers.html" },
    ],
  },
];

/* ── Sidebar rendering ──────────────────────────────────────── */

function renderSidebar() {
  const sidebar = document.getElementById("v2-sidebar");
  if (!sidebar) return;

  const currentPath = location.pathname;

  const html = NAV.map((section, i) => {
    const isActive = section.items.some((item) => item.href === currentPath);
    const isOpen = isActive;

    const items = section.items
      .map((item) => {
        const active = item.href === currentPath ? " active" : "";
        return `<a class="v2-nav-item${active}" href="${item.href}">${item.label}</a>`;
      })
      .join("");

    return `
      <div class="v2-nav-section${isOpen ? " open" : ""}" data-section="${i}">
        <button class="v2-nav-section-toggle${isActive ? " active" : ""}" aria-expanded="${isOpen}">
          <span class="v2-nav-section-icon">${section.icon}</span>
          <span class="v2-nav-section-label">${section.label}</span>
          <span class="v2-nav-chevron">›</span>
        </button>
        <div class="v2-nav-items">${items}</div>
      </div>`;
  }).join("");

  sidebar.innerHTML = html;

  /* toggle sections */
  for (const btn of sidebar.querySelectorAll(".v2-nav-section-toggle")) {
    btn.addEventListener("click", () => {
      const section = btn.closest(".v2-nav-section");
      const isOpen = section.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(isOpen));
    });
  }
}

/* ── Sidebar collapse toggle ────────────────────────────────── */

function initSidebarToggle() {
  const btn = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("v2-sidebar");
  const main = document.getElementById("v2-main");
  if (!btn || !sidebar) return;

  const COLLAPSED_KEY = "v2.sidebarCollapsed";
  const collapsed = localStorage.getItem(COLLAPSED_KEY) === "1";
  if (collapsed) {
    sidebar.classList.add("collapsed");
    if (main) main.style.marginLeft = "0";
  }

  btn.addEventListener("click", () => {
    const isCollapsed = sidebar.classList.toggle("collapsed");
    if (main) main.style.marginLeft = isCollapsed ? "0" : "240px";
    localStorage.setItem(COLLAPSED_KEY, isCollapsed ? "1" : "0");
  });
}

/* ── Provenance selector ────────────────────────────────────── */

function initProvenanceSelector() {
  const PROV_KEY = "v2.provenanceMode";
  const stored = localStorage.getItem(PROV_KEY) || "prod";

  const btns = document.querySelectorAll(".v2-prov-btn");
  for (const btn of btns) {
    if (btn.dataset.mode === stored) btn.classList.add("active");
    btn.addEventListener("click", () => {
      for (const b of btns) b.classList.remove("active");
      btn.classList.add("active");
      localStorage.setItem(PROV_KEY, btn.dataset.mode);
      document.dispatchEvent(
        new CustomEvent("v2:provenance-changed", {
          detail: { mode: btn.dataset.mode },
        }),
      );
    });
  }
}

/** Returns the current provenance mode ("prod" | "prod+sim"). */
// biome-ignore lint/correctness/noUnusedVariables: global API used by page scripts
function getProvenance() {
  return localStorage.getItem("v2.provenanceMode") || "prod";
}

/* ── Errors badge ────────────────────────────────────────────── */

function initErrorsBadge() {
  const badge = document.getElementById("errors-badge");
  const count = document.getElementById("errors-count");
  if (!badge || !count) return;

  /* Stub: will fetch /api/v2/errors-summary once that route exists. */
  fetch("/api/v2/errors-summary")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((data) => {
      const n = data && typeof data.total === "number" ? data.total : 0;
      count.textContent = String(n);
      if (n > 0) badge.classList.add("has-errors");
    })
    .catch(() => {
      count.textContent = "—";
    });
}

/* ── Init ────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  renderSidebar();
  initSidebarToggle();
  initProvenanceSelector();
  initErrorsBadge();
});
