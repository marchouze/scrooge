// dashboard/public/markets/fx/risk.js — FX risk view (Slice 5).
//
// Fetches:
//   /api/markets/fx/headroom           → B-cluster RAG table
//   /api/markets/fx/rejections         → gateway rejection feed
//   /api/markets/fx/risk               → correspondent routing status
//
// Author: Kai (Trading systems engineer, engineering)
//         Helena (Chief Risk Officer, governance)
//         Tomas (Operations & payments engineer, engineering)
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)

(() => {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      c === "&"
        ? "&amp;"
        : c === "<"
          ? "&lt;"
          : c === ">"
            ? "&gt;"
            : c === '"'
              ? "&quot;"
              : "&#39;",
    );
  }

  // Route through the shared, config-driven formatter (fmtPct receives a ratio,
  // so scale to percent units first). Fallbacks cover pre-_format.js load.
  function fmtPct(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "—";
    return window.SC?.fmtPercent ? window.SC.fmtPercent(n * 100) : `${(n * 100).toFixed(1)}%`;
  }

  function fmtNum(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "—";
    return window.SC?.fmtNumber ? window.SC.fmtNumber(n) : n.toLocaleString();
  }

  // ---------------------------------------------------------------------------
  // Headroom
  // ---------------------------------------------------------------------------

  async function loadHeadroom() {
    try {
      const res = await fetch("/api/markets/fx/headroom", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      renderHeadroom(data);
    } catch (e) {
      console.warn("[fx-risk] headroom fetch failed", e);
      renderHeadroomError();
    }
  }

  function renderHeadroom(data) {
    const tbody = document.querySelector("[data-fx-headroom-tbody]");
    if (!tbody) return;
    const rows = data?.rows ?? [];
    if (rows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="fx-cp-empty">No headroom data available.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map((r) => {
        const ragClass =
          r.ragStatus === "red"
            ? "fx-rag-red"
            : r.ragStatus === "amber"
              ? "fx-rag-amber"
              : "fx-rag-green";
        return [
          "<tr>",
          `<td><strong>${escapeHtml(r.cluster)}</strong></td>`,
          `<td>${escapeHtml(r.limitName)}</td>`,
          `<td>${escapeHtml(fmtNum(r.currentExposure))}</td>`,
          `<td>${escapeHtml(fmtNum(r.limitValue))}</td>`,
          `<td>${escapeHtml(fmtPct(r.utilisationPct))}</td>`,
          `<td><span class="${ragClass}">${escapeHtml(r.ragStatus ?? "—")}</span></td>`,
          `<td>${escapeHtml(r.currency ?? "—")}</td>`,
          "</tr>",
        ].join("");
      })
      .join("");
  }

  function renderHeadroomError() {
    const tbody = document.querySelector("[data-fx-headroom-tbody]");
    if (!tbody) return;
    tbody.innerHTML =
      '<tr><td colspan="7" class="fx-cp-empty">Headroom endpoint unavailable.</td></tr>';
  }

  // ---------------------------------------------------------------------------
  // Rejections
  // ---------------------------------------------------------------------------

  async function loadRejections() {
    try {
      const res = await fetch("/api/markets/fx/rejections", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      renderRejections(data);
    } catch (e) {
      console.warn("[fx-risk] rejections fetch failed", e);
      const tbody = document.querySelector("[data-fx-rejections-tbody]");
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="4" class="fx-cp-empty">Rejections endpoint unavailable.</td></tr>';
      }
    }
  }

  function renderRejections(data) {
    const tbody = document.querySelector("[data-fx-rejections-tbody]");
    if (!tbody) return;
    const rejections = data?.rejections ?? [];
    if (rejections.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="fx-cp-empty">No rejections recorded.</td></tr>';
      return;
    }
    tbody.innerHTML = rejections
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.orderId)}</td><td>${escapeHtml(r.rejectingCheck)}</td><td>${escapeHtml(r.rejectionReason ?? "—")}</td><td>${escapeHtml(new Date(r.timestamp).toLocaleString())}</td></tr>`,
      )
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Correspondent routing
  // ---------------------------------------------------------------------------

  async function loadCorrespondent() {
    try {
      const res = await fetch("/api/markets/fx/risk", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      renderCorrespondent(data);
    } catch (e) {
      console.warn("[fx-risk] correspondent fetch failed", e);
    }
  }

  function renderCorrespondent(data) {
    const cs = data?.correspondentStatus ?? {};
    const primary = document.querySelector("[data-fx-corr-primary]");
    const backup = document.querySelector("[data-fx-corr-backup]");
    const switchEl = document.querySelector("[data-fx-corr-switch]");
    if (primary) primary.textContent = cs.primary ?? "—";
    if (backup) backup.textContent = cs.backup ?? "—";
    if (switchEl) switchEl.textContent = cs.switchTestActive ? "Active" : "Inactive";
  }

  // ---------------------------------------------------------------------------
  // Refresh all sections
  // ---------------------------------------------------------------------------

  async function refresh() {
    await Promise.all([loadHeadroom(), loadRejections(), loadCorrespondent()]);
    for (const el of document.querySelectorAll("[data-shell-asof]")) {
      el.textContent = new Date().toLocaleTimeString();
    }
    if (window.bankShell?.audit) {
      window.bankShell.audit.log("fx-risk.tiles.refreshed", {});
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function boot() {
    refresh();
    document.querySelector("[data-shell-refresh]")?.addEventListener("click", () => {
      refresh().catch((e) => console.warn("[fx-risk] manual refresh failed", e));
    });
    if (typeof window.registerPagePoll === "function") {
      window.registerPagePoll(refresh, 30_000);
    } else {
      setInterval(() => {
        refresh().catch((e) => console.warn("[fx-risk] auto-refresh failed", e));
      }, 30_000);
    }
  }

  window.bankFxRisk = { refresh };

  document.addEventListener("DOMContentLoaded", boot);
})();
