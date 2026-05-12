// finance.js — Capital & Liquidity department view.
//
// Pulls from /api/state for capitalPositions, liquidityMetrics,
// and balanceSheet fields. Shows sensible placeholders when fields
// are absent (build-phase: BA-325 / BA-700 pipeline not yet live).
//
// Author: Atlas (Core banking platform architect) — under CEO directive
// 2026-05-12 (intranet scaffold).

(() => {
  function fmt(v, suffix) {
    if (v === null || v === undefined || v === "") return "–";
    if (typeof v === "number") {
      if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}bn${suffix || ""}`;
      if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}m${suffix || ""}`;
      return v.toLocaleString() + (suffix || "");
    }
    return String(v) + (suffix || "");
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
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">awaiting data</p>`;
    }
    const entries = Object.entries(obj);
    if (!entries.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">awaiting data</p>`;
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

  async function load() {
    const state = window.bankShell
      ? await window.bankShell.fetch.state()
      : await fetch("/api/state", { headers: { Accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

    if (!state) {
      document.getElementById("finance-cap-body").innerHTML =
        `<p style="color:var(--semantic-error);font-size:var(--type-small)">Failed to load /api/state</p>`;
      document.getElementById("finance-liq-body").innerHTML =
        `<p style="color:var(--semantic-error);font-size:var(--type-small)">Failed to load /api/state</p>`;
      return;
    }

    if (window.bankShell?.render?.asOf) {
      window.bankShell.render.asOf(state.asOf);
    }

    // --- Key metrics --------------------------------------------------
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

    // --- Capital positions table --------------------------------------
    document.getElementById("finance-cap-body").innerHTML = renderKvTable(
      state.capitalPositions,
      "Capital positions",
    );

    // --- Liquidity metrics table -------------------------------------
    document.getElementById("finance-liq-body").innerHTML = renderKvTable(
      state.liquidityMetrics,
      "Liquidity metrics",
    );
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
