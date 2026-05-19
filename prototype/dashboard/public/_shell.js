// _shell.js — Fintech Minimal shell: topbar, sidebar, live clock.
//
// Mounts shell chrome (topbar + sidebar) on every page via initShell().
// Active nav item detected by URL match.
//
// Author: Atlas (Platform Engineering Lead) — Fintech Minimal rebuild
// under brief:atlas:intranet-rebuild-fintech-minimal-design-all-doma:2026-05-19.

(() => {
  // ── Nav structure ─────────────────────────────────────────────
  const NAV = [
    {
      group: "Executive",
      pages: [
        { label: "Home", href: "/home.html" },
        { label: "Decisions", href: "/decisions" },
        { label: "Escalations", href: "/escalations.html" },
      ],
    },
    {
      group: "Finance",
      pages: [
        { label: "Finance", href: "/finance.html" },
        { label: "General Ledger", href: "/gl" },
        { label: "Trade Booking", href: "/trade-book.html" },
        { label: "Product Control", href: "/product-control.html" },
      ],
    },
    {
      group: "Risk",
      pages: [{ label: "Risk", href: "/risk.html" }],
    },
    {
      group: "Markets",
      pages: [
        { label: "FX Desk", href: "/markets/fx/desk.html" },
        { label: "FX Risk", href: "/markets/fx/risk.html" },
        { label: "FX Simulator", href: "/fx-sim" },
        { label: "KYC Onboarding", href: "/kyc-onboarding" },
        { label: "KYC Clients", href: "/kyc-clients" },
      ],
    },
    {
      group: "Compliance",
      pages: [
        { label: "Compliance", href: "/compliance.html" },
        { label: "Obligations", href: "/obligations.html" },
        { label: "Forward Obligations", href: "/forward-obligations.html" },
        { label: "Policies", href: "/policies.html" },
        { label: "Regulatory", href: "/regulatory.html" },
        { label: "Regulation Reader", href: "/regulation-reader.html" },
      ],
    },
    {
      group: "Operations",
      pages: [
        { label: "Operations", href: "/ops.html" },
        { label: "Procedures", href: "/procedures.html" },
      ],
    },
    {
      group: "Audit",
      pages: [{ label: "Audit", href: "/audit.html" }],
    },
    {
      group: "Governance",
      pages: [
        { label: "Decisions Register", href: "/decisions" },
        { label: "Party Registry", href: "/party.html" },
        { label: "Party Graph", href: "/graph.html" },
        { label: "Briefs", href: "/briefs" },
        { label: "Documents", href: "/documents" },
        { label: "RMS Registers", href: "/rms.html" },
      ],
    },
    {
      group: "Platform",
      pages: [
        { label: "Events", href: "/events.html" },
        { label: "Health", href: "/health.html" },
        { label: "AgentOps", href: "/agentops.html" },
        { label: "Agents", href: "/agents.html" },
        { label: "Fleet", href: "/fleet.html" },
        { label: "Activity", href: "/activity.html" },
        { label: "Architecture", href: "/architecture.html" },
        { label: "Performance", href: "/performance.html" },
        { label: "Taxonomy", href: "/taxonomy.html" },
        { label: "Roadmap", href: "/roadmap.html" },
      ],
    },
  ];

  function isActive(href) {
    const p = window.location.pathname;
    // Normalise: strip trailing slash for comparison
    if (href === p) return true;
    if (p === "/" && href === "/home.html") return true;
    return false;
  }

  function buildSidebar() {
    const parts = [];
    for (const { group, pages } of NAV) {
      parts.push(`<div class="sidebar-group">`);
      parts.push(`<span class="sidebar-group-label">${group}</span>`);
      for (const { label, href } of pages) {
        const cls = isActive(href) ? " active" : "";
        parts.push(`<a class="sidebar-link${cls}" href="${href}">${label}</a>`);
      }
      parts.push("</div>");
    }
    return parts.join("");
  }

  // ── Clock ─────────────────────────────────────────────────────
  function updateClock(el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString("en-ZA", { hour12: false });
  }

  // ── initShell ─────────────────────────────────────────────────
  // Called by each page: initShell({ title: "Page Title" })
  window.initShell = function initShell({ title } = {}) {
    // Topbar
    const topbar = document.createElement("div");
    topbar.className = "topbar";
    topbar.innerHTML = `
      <a class="topbar-brand" href="/home.html">Scrooge Bank</a>
      <span class="topbar-title">${title || document.title || ""}</span>
      <div class="topbar-right">
        <span class="topbar-clock" id="sc-clock"></span>
        <span class="dev-badge">DEV</span>
      </div>`;
    document.body.insertBefore(topbar, document.body.firstChild);

    // Sidebar
    const sidebar = document.createElement("nav");
    sidebar.className = "sidebar";
    sidebar.setAttribute("aria-label", "Main navigation");
    sidebar.innerHTML = buildSidebar();
    document.body.insertBefore(sidebar, topbar.nextSibling);

    // Live clock
    const clockEl = document.getElementById("sc-clock");
    if (clockEl) {
      updateClock(clockEl);
      setInterval(() => updateClock(clockEl), 1000);
    }
  };

  // Legacy: keep bankShell for pages that reference it
  window.bankShell = window.bankShell || {
    user: { id: "marc@tgv.co.za", name: "Marc", role: "CEO" },
  };
})();
