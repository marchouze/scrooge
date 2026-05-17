// finance.js — Capital & Liquidity department view.
//
// Pulls from /api/state for capitalPositions, liquidityMetrics,
// and balanceSheet fields. Shows sensible placeholders when fields
// are absent (build-phase: BA-325 / BA-700 pipeline not yet live).
//
// Also surfaces the CEO-approved capital plan figures
// (R150m trading book, ~R125m ILAAP, R5m CapEx) and the open
// decisions count from state.decisionsOpen.
//
// Author: Atlas (Core banking platform architect) — under CEO directive
// 2026-05-12 (intranet scaffold).
// Improved: Noa (Intranet Product Owner & UI Architect) — 2026-05-12.

(() => {
  // CEO-approved capital plan (D-CAPITAL-TIME-SHAPE, approved 2026-05-12).
  // These are standing inputs until the ICAAP is filed; not live API data.
  const CAPITAL_PLAN = {
    tradingBook: 150_000_000,
    ilaapBuffer: 125_000_000,
    capEx: 5_000_000,
    totalTarget: 300_000_000,
    source: "CEO directive 2026-05-12 (capital-time-shape approval)",
  };

  function fmt(v, suffix) {
    if (v === null || v === undefined || v === "") return "–";
    if (typeof v === "number") {
      if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}bn${suffix || ""}`;
      if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}m${suffix || ""}`;
      return v.toLocaleString() + (suffix || "");
    }
    return String(v) + (suffix || "");
  }

  function fmtR(v) {
    if (v === null || v === undefined) return "–";
    if (Math.abs(v) >= 1e6) return `R${(v / 1e6).toFixed(0)}m`;
    return `R${v.toLocaleString()}`;
  }

  function pct(v) {
    if (v === null || v === undefined || v === "") return "–";
    const n = typeof v === "number" ? v : Number.parseFloat(v);
    if (Number.isNaN(n)) return String(v);
    return `${n.toFixed(1)}%`;
  }

  function tone(v, minGreen, minAmber) {
    if (v === null || v === undefined || v === "") return "muted";
    const n = typeof v === "number" ? v : Number.parseFloat(v);
    if (Number.isNaN(n)) return "muted";
    if (n >= minGreen) return "success";
    if (n >= minAmber) return "warn";
    return "error";
  }

  function setMetric(id, text, dataTone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (dataTone) el.setAttribute("data-tone", dataTone);
  }

  function renderKvTable(obj, caption) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">Build-phase — awaiting BA-325 / BA-700 derivation pipeline (Camille + Bea, M-phase).</p>`;
    }
    const entries = Object.entries(obj);
    if (!entries.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">Build-phase — awaiting BA-325 / BA-700 derivation pipeline (Camille + Bea, M-phase).</p>`;
    }
    const rows = entries
      .map(([k, v]) => {
        const display = v === null || v === undefined ? "–" : String(v);
        return `<tr><td><code>${k}</code></td><td>${display}</td></tr>`;
      })
      .join("");
    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="${caption}">
    <thead><tr><th>Field</th><th>Value</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
  }

  function renderCapitalPlan() {
    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="CEO-approved capital plan">
    <thead>
      <tr>
        <th>Allocation</th>
        <th>Amount (ZAR)</th>
        <th>Purpose</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Trading-book capital</td>
        <td>${fmtR(CAPITAL_PLAN.tradingBook)}</td>
        <td>Primary capital backing at go-live; RWA sizing input (Standardised Approach)</td>
        <td><span class="status-badge" data-status="met">CEO-approved</span></td>
      </tr>
      <tr>
        <td>Liquidity buffer / ILAAP</td>
        <td>~${fmtR(CAPITAL_PLAN.ilaapBuffer)}</td>
        <td>LCR 30-day stress horizon; ILAAP sizing (Helena / Camille confirmation pending)</td>
        <td><span class="status-badge" data-status="pending">Working estimate</span></td>
      </tr>
      <tr>
        <td>Build-phase CapEx</td>
        <td>${fmtR(CAPITAL_PLAN.capEx)}</td>
        <td>Substrate, platform, and regulatory-programme spend (pre-licence)</td>
        <td><span class="status-badge" data-status="met">CEO-approved</span></td>
      </tr>
      <tr>
        <td><strong>Total shareholder capital target</strong></td>
        <td><strong>${fmtR(CAPITAL_PLAN.totalTarget)}</strong></td>
        <td>Committed at licence-day; real capital raised at that gate</td>
        <td><span class="status-badge" data-status="pending">Licence-day</span></td>
      </tr>
    </tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-caption);color:var(--neutral-stone)">
  Source: ${CAPITAL_PLAN.source}. Real capital is a licence-day item; these figures are CEO-approved working inputs for the ICAAP/ILAAP and design book.
</p>`;
  }

  function renderOpenDecisions(decisions) {
    const financeDecisions = (decisions || []).filter((d) => {
      const id = (d.id || "").toUpperCase();
      const title = (d.title || "").toLowerCase();
      return (
        id.includes("CAPITAL") ||
        id.includes("FINANCE") ||
        id.includes("CAMILLE") ||
        id.includes("CFO") ||
        id.includes("CAPEX") ||
        id.includes("ILAAP") ||
        id.includes("ICAAP") ||
        title.includes("capital") ||
        title.includes("finance") ||
        title.includes("liquidity") ||
        title.includes("cfr") ||
        title.includes("budget") ||
        title.includes("capex") ||
        title.includes("ilaap") ||
        title.includes("icaap")
      );
    });
    if (!financeDecisions.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No open finance-tagged decisions. <a href="/decisions.html" style="color:var(--accent-ink)">View all decisions →</a></p>`;
    }
    const rows = financeDecisions
      .map((d) => {
        const id = d.id || "–";
        const title = d.title || "–";
        const category = d.category || "–";
        return `<tr>
  <td><code style="font-size:var(--type-caption)">${id}</code></td>
  <td>${title}</td>
  <td><span class="status-badge" data-status="pending">${category}</span></td>
</tr>`;
      })
      .join("");
    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Finance-related open decisions">
    <thead><tr><th>ID</th><th>Title</th><th>Category</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  <a href="/decisions.html" style="color:var(--accent-ink)">View all open decisions →</a>
</p>`;
  }

  async function load() {
    const state = window.bankShell
      ? await window.bankShell.fetch.state()
      : await fetch("/api/state", { headers: { Accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

    if (!state) {
      const errMsg = `<p style="color:var(--semantic-error);font-size:var(--type-small)">Failed to load /api/state</p>`;
      for (const id of ["finance-cap-body", "finance-liq-body", "finance-decisions-body"]) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errMsg;
      }
      return;
    }

    if (window.bankShell?.render?.asOf) {
      window.bankShell.render.asOf(state.asOf);
    }

    // --- Summary metrics -------------------------------------------
    const m = state.bank?.metrics || {};
    const openDecisionsCount = state.decisionsOpen?.length ?? 0;
    const resolvedCount = state.decisionsResolved?.length ?? 0;
    const policiesCount = m.policies ?? 0;
    const obligationsCount = m.obligations ?? 0;

    setMetric(
      "fm-open-decisions",
      String(openDecisionsCount),
      openDecisionsCount > 0 ? "warn" : "success",
    );
    setMetric("fm-resolved-decisions", String(resolvedCount), "muted");
    setMetric("fm-policies", String(policiesCount), policiesCount > 0 ? "default" : "muted");
    setMetric(
      "fm-obligations",
      String(obligationsCount),
      obligationsCount > 0 ? "default" : "muted",
    );

    // --- Live capital metrics (pipeline not yet live) --------------
    const cap = state.capitalPositions || {};
    const liq = state.liquidityMetrics || {};
    const bs = state.balanceSheet || {};

    const tier1 = cap.tier1Capital ?? cap.tier1 ?? null;
    const cet1Pct = cap.cet1Ratio ?? cap.cet1 ?? null;
    const lcr = liq.lcr ?? liq.LCR ?? null;
    const nsfr = liq.nsfr ?? liq.NSFR ?? null;
    const assets = bs.totalAssets ?? state.bank?.metrics?.totalAssets ?? null;
    const liabs = bs.totalLiabilities ?? null;

    setMetric("fm-tier1", fmt(tier1, " ZAR"), tier1 !== null ? "success" : "muted");
    setMetric("fm-cet1", pct(cet1Pct), tone(cet1Pct, 8, 4.5));
    setMetric("fm-lcr", pct(lcr), tone(lcr, 110, 100));
    setMetric("fm-nsfr", pct(nsfr), tone(nsfr, 110, 100));
    setMetric("fm-assets", fmt(assets, " ZAR"), assets !== null ? "default" : "muted");
    setMetric("fm-liabilities", fmt(liabs, " ZAR"), liabs !== null ? "default" : "muted");

    // --- Capital plan (CEO-approved static figures) ---------------
    const capPlanEl = document.getElementById("finance-cap-plan-body");
    if (capPlanEl) capPlanEl.innerHTML = renderCapitalPlan();

    // --- Live capital positions table (pipeline-dependent) --------
    document.getElementById("finance-cap-body").innerHTML = renderKvTable(
      state.capitalPositions,
      "Capital positions",
    );

    // --- Liquidity metrics table ----------------------------------
    document.getElementById("finance-liq-body").innerHTML = renderKvTable(
      state.liquidityMetrics,
      "Liquidity metrics",
    );

    // --- Finance-related open decisions --------------------------
    const decisionsEl = document.getElementById("finance-decisions-body");
    if (decisionsEl) {
      decisionsEl.innerHTML = renderOpenDecisions(state.decisionsOpen);
    }
  }

  window.bankFinance = { load };

  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(load, 30_000);
  } else {
    setInterval(() => load().catch((e) => console.warn("[finance] refresh failed", e)), 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
