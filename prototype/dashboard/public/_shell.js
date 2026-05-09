// _shell.js — shared shell behaviours for the bank UI v0.
//
// Identity stub: hardcoded `Marc · CEO` for v0. Real identity is a v1
// substrate item (Senna (Security engineer) zero-trust posture under
// Joint Standard 1 of 2024 + Iris (Information Officer, governance) for
// POPIA s.19 lawful-processing). The shell exposes
// `window.bankShell.user` so any consuming page can role-gate without
// re-reading config.
//
// Audit-log stub: every navigation click within the shell is recorded
// in-memory under `window.bankShell.audit` and console-logged with a
// `[shell:audit]` prefix. The full UiInteraction event-type + audit-
// trail UI is a v1 substrate item — see the completion note for the
// sequencing.
//
// Last-updated string: v0 fetches `/api/state` once at load and renders
// the `asOf`. Live refresh is the parallel `app.js` PR's concern; the
// shell does not subscribe to a refresh tick to avoid stepping on that
// surface. v1 retrofit unifies the two refresh mechanisms.
//
// Author: Atlas (Core banking platform architect) · under CEO directive
// 2026-05-09.

(() => {
  // ---------------- Identity stub ----------------------------
  // Single-actor placeholder. Same convention used by the existing
  // dashboard server (`actor = "marc@tgv.co.za"` in
  // `dashboard/server.ts` handleDecide) — not a new identity model.
  const identity = {
    id: "marc@tgv.co.za",
    name: "Marc",
    role: "CEO",
    // Capabilities array is the v1 hook point for role-gated tiles.
    // For v0 the CEO sees everything; non-CEO roles are not yet
    // wired.
    capabilities: ["*"],
    isStub: true,
  };

  // ---------------- Session id (audit-log correlation) -------
  const sessionId =
    window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // ---------------- Audit-log stub ---------------------------
  // In-memory buffer. Last 200 events kept; nothing posted server-side
  // until UiInteraction event-type lands (v1 substrate work).
  const auditBuffer = [];
  const AUDIT_MAX = 200;

  function auditLog(action, payload) {
    const event = {
      type: "UiInteraction.stub",
      action: action,
      user: identity.id,
      role: identity.role,
      route: window.location.pathname + window.location.search,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      payload: payload || {},
    };
    auditBuffer.push(event);
    if (auditBuffer.length > AUDIT_MAX) auditBuffer.shift();
    if (window.console && console.debug) {
      console.debug("[shell:audit]", action, event);
    }
  }

  // ---------------- Public API -------------------------------
  window.bankShell = {
    user: identity,
    sessionId: sessionId,
    audit: {
      log: auditLog,
      buffer: () => auditBuffer.slice(),
    },
    // Tiles read this to decide visibility. v0 returns true for
    // everything because identity.role === "CEO". v1 dispatches on
    // capabilities.
    canSee: (_tileId) => identity.role === "CEO",
  };

  // ---------------- Header rendering helpers -----------------

  function renderIdentity() {
    const target = document.querySelector("[data-shell-identity]");
    if (!target) return;
    target.innerHTML = `<span class="shell-identity-name">${identity.name}</span> <span class="shell-identity-role">· ${identity.role}</span> <span class="shell-identity-stub-badge" title="Real auth deferred to v1 (Senna / Iris)">stub</span>`;
    target.setAttribute(
      "aria-label",
      `Signed in as ${identity.name}, role ${identity.role} (stub)`,
    );
  }

  function renderAsOf(asOf) {
    const target = document.querySelector("[data-shell-asof]");
    if (!target) return;
    if (!asOf) {
      target.textContent = "no data";
      return;
    }
    try {
      const d = new Date(asOf);
      const iso = d.toISOString();
      target.textContent = `as of ${iso.slice(0, 16).replace("T", " ")}Z`;
      target.setAttribute("title", `State derived at ${iso}`);
    } catch (_e) {
      target.textContent = `as of ${String(asOf)}`;
    }
  }

  async function fetchState() {
    try {
      const res = await fetch("/api/state", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn("[shell] /api/state fetch failed", e);
      return null;
    }
  }

  async function fetchSubstrateGaps() {
    try {
      const res = await fetch("/api/substrate-gaps", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (_e) {
      return null;
    }
  }

  async function fetchObligations() {
    try {
      const res = await fetch("/api/obligations", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (_e) {
      return null;
    }
  }

  async function fetchFleet() {
    try {
      const res = await fetch("/api/fleet", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (_e) {
      return null;
    }
  }

  async function fetchEscalations() {
    try {
      const res = await fetch("/api/escalations", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (_e) {
      return null;
    }
  }

  // ---------------- Nav-click instrumentation ---------------
  function instrumentNav() {
    document.addEventListener("click", (ev) => {
      const a = ev.target?.closest?.("a[data-shell-nav]");
      if (!a) return;
      auditLog("shell.nav.click", {
        href: a.getAttribute("href") || "",
        tile: a.getAttribute("data-shell-nav") || "",
        label: (a.textContent || "").trim().slice(0, 80),
      });
    });
  }

  // ---------------- Manual refresh button -------------------
  // Header refresh button — re-runs the page-specific loader if one
  // has been registered. Pages register a loader via
  // `window.bankHome.loadTiles` (home) or any equivalent surface.
  function instrumentRefresh() {
    const btn = document.querySelector("[data-shell-refresh]");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      auditLog("shell.refresh.click", {});
      btn.disabled = true;
      btn.classList.add("is-busy");
      try {
        const loader =
          (window.bankHome && window.bankHome.loadTiles) ||
          (window.bankShell?.pageReload && window.bankShell.pageReload);
        if (typeof loader === "function") {
          await loader();
        }
      } finally {
        btn.disabled = false;
        btn.classList.remove("is-busy");
      }
    });
  }

  // Expose a handful of fetchers for home.js / future shell pages.
  window.bankShell.fetch = {
    state: fetchState,
    substrateGaps: fetchSubstrateGaps,
    obligations: fetchObligations,
    fleet: fetchFleet,
    escalations: fetchEscalations,
  };
  window.bankShell.render = {
    identity: renderIdentity,
    asOf: renderAsOf,
  };

  document.addEventListener("DOMContentLoaded", () => {
    renderIdentity();
    instrumentNav();
    instrumentRefresh();
    auditLog("shell.page.load", { title: document.title });
  });
})();
