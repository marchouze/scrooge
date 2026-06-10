// _shell.js — Fintech Minimal shell: topbar, sidebar, live clock.
//
// Mounts shell chrome (topbar + sidebar) on every page via initShell().
// Active nav item detected by URL match.
//
// Author: Atlas (Platform Engineering Lead) — Fintech Minimal rebuild
// under brief:atlas:intranet-rebuild-fintech-minimal-design-all-doma:2026-05-19.

(() => {
  // ── Nav structure ─────────────────────────────────────────────
  // `owner` is the governance seat accountable for the group (domain alignment,
  // part D). Page-level domain(s) + owner come from PAGE_META below.
  const NAV = [
    {
      group: "Executive",
      owner: "CEO",
      pages: [
        { label: "Home", href: "/home.html" },
        { label: "Decisions", href: "/decisions" },
        { label: "Escalations", href: "/escalations.html" },
      ],
    },
    {
      group: "Finance",
      owner: "CFO / Treasurer",
      pages: [
        { label: "Finance", href: "/finance.html" },
        { label: "Treasury", href: "/treasury.html" },
        { label: "General Ledger", href: "/gl" },
        { label: "Product Control", href: "/product-control.html" },
        { label: "Constants", href: "/constants.html" },
      ],
    },
    {
      group: "Risk",
      owner: "CRO",
      pages: [
        { label: "Risk", href: "/risk.html" },
        { label: "Risk Register", href: "/risk-register.html" },
        { label: "Models", href: "/models.html" },
      ],
    },
    {
      group: "Markets",
      owner: "Head of Markets",
      pages: [
        { label: "Instruments", href: "/instruments" },
        { label: "Trade Booking", href: "/trade-book.html" },
        { label: "Bond Trading", href: "/bond-trading.html" },
        { label: "FX Desk", href: "/markets/fx/desk.html" },
        { label: "FX Risk", href: "/markets/fx/risk.html" },
        { label: "3rd-Party Simulators", href: "/sim-hub" },
        { label: "Market Data", href: "/market-data" },
        { label: "KYC Onboarding", href: "/kyc-onboarding" },
        { label: "KYC Clients", href: "/kyc-clients" },
      ],
    },
    {
      group: "Compliance",
      owner: "CCO",
      pages: [
        { label: "Compliance", href: "/compliance.html" },
        { label: "Obligations", href: "/obligations.html" },
        { label: "Bank Obligations (events)", href: "/bank-obligations.html" },
        { label: "Unadopted Obligations", href: "/unadopted-obligations.html" },
        { label: "Obligation Readers", href: "/obligation-readers.html" },
        { label: "Forward Obligations", href: "/forward-obligations.html" },
        { label: "Policies", href: "/policies.html" },
        { label: "Regulatory", href: "/regulatory.html" },
        { label: "Regulation Reader", href: "/regulation-reader.html" },
      ],
    },
    {
      group: "Operations",
      owner: "COO",
      pages: [
        { label: "Operations", href: "/ops.html" },
        { label: "Procedures", href: "/procedures.html" },
      ],
    },
    {
      group: "Audit",
      owner: "CAE",
      pages: [{ label: "Audit", href: "/audit.html" }],
    },
    {
      group: "Governance",
      owner: "CoSec",
      pages: [
        { label: "Decisions Register", href: "/decisions" },
        { label: "Products (NPA)", href: "/products" },
        { label: "Party Registry", href: "/party.html" },
        { label: "Party Graph", href: "/graph.html" },
        { label: "Briefs", href: "/briefs" },
        { label: "Documents", href: "/documents" },
        { label: "RMS Registers", href: "/rms.html" },
      ],
    },
    {
      group: "Platform",
      owner: "Platform Eng",
      pages: [
        { label: "Display", href: "/config.html#display" },
        { label: "Events", href: "/events.html" },
        { label: "Seeds", href: "/seeds.html" },
        { label: "Health", href: "/health.html" },
        { label: "Config", href: "/config.html" },
        { label: "AgentOps", href: "/agentops.html" },
        { label: "Agents", href: "/agents.html" },
        { label: "Fleet", href: "/fleet.html" },
        { label: "Activity", href: "/activity.html" },
        { label: "Autonomy", href: "/autonomy.html" },
        { label: "Architecture", href: "/architecture.html" },
        { label: "Performance", href: "/performance.html" },
        { label: "Taxonomy", href: "/taxonomy.html" },
        { label: "Roadmap", href: "/roadmap.html" },
      ],
    },
  ];

  // ── Domain alignment (part D) ─────────────────────────────────
  // page href → regulatory domain(s) (A–Q, per Regulations/_obligations-register.md)
  // and owning governance seat (per Team/_team-roster.json). Pages absent from
  // this map fall back to their nav group's owner with no domain tag. Inlined in
  // the shell (not a separate fetch) so the header badge renders synchronously.
  const PAGE_META = {
    "/finance.html": { domains: ["G", "A"], owner: "CFO" },
    "/treasury.html": { domains: ["A"], owner: "Treasurer" },
    "/gl": { domains: ["G"], owner: "CFO" },
    "/product-control.html": { domains: ["G", "J"], owner: "CFO" },
    "/risk.html": { domains: ["A"], owner: "CRO" },
    "/risk-register.html": { domains: ["A"], owner: "CRO" },
    "/models.html": { domains: ["A"], owner: "CRO" },
    "/compliance.html": { domains: ["B", "C"], owner: "CCO" },
    "/obligations.html": { domains: ["B", "C", "FX"], owner: "CCO" },
    "/bank-obligations.html": { domains: ["B", "C", "FX"], owner: "CCO" },
    "/regulatory.html": { domains: ["M"], owner: "CCO" },
    "/markets/fx/desk.html": { domains: ["J", "FX"], owner: "Head of Markets" },
    "/markets/fx/risk.html": { domains: ["J", "A"], owner: "Head of Markets" },
    "/bond-trading.html": { domains: ["J"], owner: "Head of Markets" },
    "/instruments": { domains: ["J"], owner: "Head of Markets" },
    "/kyc-onboarding": { domains: ["B"], owner: "CCO" },
    "/kyc-clients": { domains: ["B"], owner: "CCO" },
    "/procedures.html": { domains: ["F"], owner: "CoSec" },
    "/policies.html": { domains: ["F"], owner: "CoSec" },
    "/audit.html": { domains: ["F"], owner: "CAE" },
    "/party.html": { domains: ["F"], owner: "CoSec" },
  };

  // Resolve the domain/owner for the current page: explicit PAGE_META first,
  // else the nav group's owner (no domains).
  function pageMetaFor(pathname) {
    if (PAGE_META[pathname]) return PAGE_META[pathname];
    for (const { owner, pages } of NAV) {
      if (pages.some((p) => p.href.split("#")[0] === pathname)) return { domains: [], owner };
    }
    return null;
  }

  function isActive(href) {
    const p = window.location.pathname;
    // Normalise: strip trailing slash for comparison
    if (href === p) return true;
    if (p === "/" && href === "/home.html") return true;
    return false;
  }

  // ── Per-viewer shell prefs (localStorage) ─────────────────────
  // Sidebar ergonomics are per-viewer chrome, so they live client-side — unlike
  // the platform-wide display convention. Convention: hoz.* keys (matches app.js).
  const LS_COLLAPSED = "hoz.shell.sidebar-collapsed";
  const LS_NAV_EXPANDED = "hoz.shell.nav-expanded";

  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode / quota — non-fatal */
    }
  }

  // null ⇒ no stored preference ⇒ all groups collapsed by default (compressed
  // nav; CEO directive 2026-06-10). The active page's group still auto-opens.
  function getExpandedGroups() {
    const raw = lsGet(LS_NAV_EXPANDED);
    if (!raw) return null;
    try {
      return new Set(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  function isGroupExpanded(group, expandedSet) {
    if (!expandedSet) return false;
    return expandedSet.has(group);
  }

  function buildSidebar() {
    const expanded = getExpandedGroups();
    const parts = [];
    for (const { group, owner, pages } of NAV) {
      // Always show the group containing the active page, regardless of pref.
      const hasActive = pages.some((p) => isActive(p.href));
      const open = isGroupExpanded(group, expanded) || hasActive;
      parts.push(`<div class="sidebar-group${open ? "" : " collapsed"}" data-group="${group}">`);
      parts.push(
        `<button class="sidebar-group-header" data-group="${group}" aria-expanded="${open}">`,
      );
      parts.push(
        `<span class="sidebar-group-label">${group}${owner ? `<span class="sidebar-group-owner">${owner}</span>` : ""}</span>`,
      );
      parts.push('<span class="sidebar-group-chevron">▸</span>');
      parts.push("</button>");
      parts.push('<div class="sidebar-group-links">');
      for (const { label, href } of pages) {
        const cls = isActive(href) ? " active" : "";
        parts.push(`<a class="sidebar-link${cls}" href="${href}">${label}</a>`);
      }
      parts.push("</div>");
      parts.push("</div>");
    }
    return parts.join("");
  }

  // Wire group-header clicks to expand/collapse + persist the expanded set.
  function wireNavGroups(sidebar) {
    for (const header of sidebar.querySelectorAll(".sidebar-group-header")) {
      header.addEventListener("click", () => {
        const groupEl = header.closest(".sidebar-group");
        if (!groupEl) return;
        const nowCollapsed = groupEl.classList.toggle("collapsed");
        header.setAttribute("aria-expanded", String(!nowCollapsed));
        // Persist the full current expanded set (start from defaults = none).
        const set = getExpandedGroups() || new Set();
        const name = groupEl.dataset.group;
        if (nowCollapsed) set.delete(name);
        else set.add(name);
        lsSet(LS_NAV_EXPANDED, JSON.stringify([...set]));
      });
    }
  }

  // ── Clock ─────────────────────────────────────────────────────
  function updateClock(el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString("en-ZA", { hour12: false });
  }

  // ── initShell ─────────────────────────────────────────────────
  // Called by each page: initShell({ title: "Page Title" })
  window.initShell = function initShell({ title } = {}) {
    // Restore collapsed sidebar preference before first paint (avoids flash).
    if (lsGet(LS_COLLAPSED) === "1") document.body.classList.add("sidebar-collapsed");

    // Topbar
    const topbar = document.createElement("div");
    topbar.className = "topbar";
    topbar.innerHTML = `
      <button class="sidebar-toggle" id="sc-sidebar-toggle" aria-label="Toggle navigation" title="Toggle navigation">☰</button>
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
    wireNavGroups(sidebar);

    // Sidebar collapse toggle
    const toggle = document.getElementById("sc-sidebar-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const collapsed = document.body.classList.toggle("sidebar-collapsed");
        lsSet(LS_COLLAPSED, collapsed ? "1" : "0");
      });
    }

    // Domain / owner-seat badge for the current page (part D).
    injectDomainBadge();

    // Live clock
    const clockEl = document.getElementById("sc-clock");
    if (clockEl) {
      updateClock(clockEl);
      setInterval(() => updateClock(clockEl), 1000);
    }

    // Shared number/currency formatter, loaded globally so every page can use
    // SC.fmtMoney/fmtNumber/fmtPercent against the platform display convention.
    if (!document.getElementById("sc-format-script")) {
      const s = document.createElement("script");
      s.id = "sc-format-script";
      s.src = "/_format.js";
      document.body.appendChild(s);
    }

    // Publish the platform-wide display convention as window.BANK_DISPLAY so the
    // formatter (and any page that branches on it) reads one source of truth.
    // Async — formatters read at call-time and fall back to baked defaults until
    // this resolves, so there is no flash of wrongly-formatted numbers.
    loadDisplayConfig();

    // Cross-page data-failure surface (Trusted-Figures objective 4): loaded
    // globally so every page shows figures that are "value unavailable" rather
    // than a silent 0. Self-contained — injects its own banner + polls.
    if (!document.getElementById("sc-data-failure-banner-script")) {
      const s = document.createElement("script");
      s.id = "sc-data-failure-banner-script";
      s.src = "/_data-failure-banner.js";
      document.body.appendChild(s);
    }
  };

  // ── Display config ────────────────────────────────────────────
  function loadDisplayConfig() {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        const d = cfg?.display;
        if (!d) return;
        // ResolvedConfig wraps each key as { value, source }; unwrap to plain.
        window.BANK_DISPLAY = {
          decimals: d.decimals?.value,
          thousandsSeparator: d.thousandsSeparator?.value,
          negativeStyle: d.negativeStyle?.value,
          rightAlignNumbers: d.rightAlignNumbers?.value,
          currencyPosition: d.currencyPosition?.value,
          locale: d.locale?.value,
        };
        document.dispatchEvent(
          new CustomEvent("bank-display-ready", { detail: window.BANK_DISPLAY }),
        );
      })
      .catch(() => {
        /* formatter falls back to baked defaults */
      });
  }

  // ── Domain / owner badge ──────────────────────────────────────
  function injectDomainBadge() {
    const meta = pageMetaFor(window.location.pathname);
    if (!meta || !meta.owner) return;
    const main = document.querySelector("main.main-content") || document.getElementById("content");
    if (!main || main.querySelector(".page-domain-badge")) return;
    const bar = document.createElement("div");
    bar.className = "page-domain-badge";
    const domainPart = meta.domains.length
      ? `<span class="badge badge-info">Domain ${meta.domains.join(", ")}</span>`
      : "";
    bar.innerHTML = `${domainPart}<span class="badge badge-secondary">${meta.owner}</span>`;
    main.insertBefore(bar, main.firstChild);
  }

  // Legacy: keep bankShell for pages that reference it
  window.bankShell = window.bankShell || {
    user: { id: "marc@tgv.co.za", name: "Marc", role: "CEO" },
  };
})();
