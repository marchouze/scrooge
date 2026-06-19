// dashboard/public/markets/fx/risk.js — FX risk view (Slice 5).
//
// READ PATH — V2 where a V2 panel exists (FU5; D-FX-OTC-CLOSURE-BACKLOG,
//   D-BANK-WIDE-V2-MIGRATION):
//   /api/v2/markets/fx/headroom        → B3 FX net-open-position RAG (FIL-sourced)
//   /api/v2/markets/fx/rejections      → V2-native gateway rejection feed
//
// RESIDUAL — V1 (NO V2 equivalent; honestly retained, not dropped):
//   /api/markets/fx/risk               → correspondent routing status. There is
//     no V2 correspondent-routing panel on the `/api/v2/markets/fx/*` surface;
//     the V2 risk view is net-open-position / capital-charge only. Per the
//     Engineering Charter honesty command, the legacy route + its `buildRiskView`
//     module are KEPT for this panel and tracked as the FU5 residual until a V2
//     correspondent-routing source lands.
//
// Each V2 panel carries an explicit dataState + reason; the page renders honest
//   empty / absent states (never a silent zero) and surfaces seats by Title only
//   (the V2 DTOs are name-free; feedback_no_agent_names_in_ui).
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
//            D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19)

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

  // Minor-unit (functional ccy) → major-unit number for display. The V2 headroom
  // DTO carries figures in MINOR units; the table renders major units.
  function minorToMajor(minor) {
    return typeof minor === "number" && Number.isFinite(minor) ? minor / 100 : null;
  }

  async function loadHeadroom() {
    try {
      // V2 read (FU5): FIL-sourced RAS B3 (FX) limit-utilisation.
      const res = await fetch("/api/v2/markets/fx/headroom", {
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

  // V2 headroom DTO is a SINGLE B3 (FX net-open-position) row + panel meta.
  // Only the B3 FX cluster is V2-fed (FIL-sourced); other RAS clusters stay V1.
  function renderHeadroom(data) {
    const tbody = document.querySelector("[data-fx-headroom-tbody]");
    if (!tbody) return;
    const b3 = data?.b3;
    if (!b3 || data.dataState !== "live") {
      const reason = data?.reason ?? "No FX net-open-position headroom data available.";
      tbody.innerHTML = `<tr><td colspan="7" class="fx-cp-empty">${escapeHtml(reason)}</td></tr>`;
      return;
    }
    const ragClass =
      b3.ragStatus === "red"
        ? "fx-rag-red"
        : b3.ragStatus === "amber"
          ? "fx-rag-amber"
          : "fx-rag-green";
    tbody.innerHTML = [
      "<tr>",
      `<td><strong>${escapeHtml(b3.cluster ?? "B3")}</strong></td>`,
      `<td>${escapeHtml(b3.limitName ?? "—")}</td>`,
      `<td>${escapeHtml(fmtNum(minorToMajor(b3.currentExposureFunctionalMinor)))}</td>`,
      `<td>${escapeHtml(fmtNum(minorToMajor(b3.limitValueFunctionalMinor)))}</td>`,
      `<td>${escapeHtml(fmtPct(b3.utilisationPct))}</td>`,
      `<td><span class="${ragClass}">${escapeHtml(b3.ragStatus ?? "—")}</span></td>`,
      `<td>${escapeHtml(b3.currency ?? "—")}</td>`,
      "</tr>",
    ].join("");
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
      // V2 read (FU5): V2-native gateway rejection feed from the V2 control-plane
      // store. DTO: { rows:[{orderId,rejectingCheck,rejectionReason,timestamp,…}],
      // count, dataState, reason, substrateGap }. Honest empty on the clean build
      // store (no V2 emitter ships yet — see substrateGap).
      const res = await fetch("/api/v2/markets/fx/rejections", {
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
    const rejections = data?.rows ?? [];
    if (rejections.length === 0) {
      // Honest absent state — the V2 panel states WHY (build-phase clean store,
      // no V2 emitter yet) rather than implying zero real rejections occurred.
      tbody.innerHTML = `<tr><td colspan="4" class="fx-cp-empty">${escapeHtml(data?.reason || "No rejections recorded.")}</td></tr>`;
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
      // RESIDUAL — V1 (no V2 equivalent): correspondent routing status. The
      // `/api/markets/fx/risk` route + buildRiskView are retained for this panel
      // (FU5 residual; D-FX-OTC-CLOSURE-BACKLOG). Reads correspondentStatus only.
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
