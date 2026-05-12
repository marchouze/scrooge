// risk.js — Risk Watch department view.
//
// Pulls /api/state for rasMetrics, stressTestResults, limitUtilisations.
// Shows traffic-light indicators per RAS cluster B1–B5.
// Falls back gracefully when fields absent (build-phase placeholder).
//
// Author: Atlas (Core banking platform architect) — under CEO directive
// 2026-05-12 (intranet scaffold).

(() => {
  // RAS cluster definitions — B1–B5 per Helena's framework.
  const RAS_CLUSTERS = [
    { id: "B1", label: "Capital adequacy" },
    { id: "B2", label: "Liquidity" },
    { id: "B3", label: "Market risk" },
    { id: "B4", label: "Credit risk" },
    { id: "B5", label: "Operational risk" },
  ];

  function statusTone(status) {
    if (!status) return "muted";
    const s = String(status).toLowerCase();
    if (s === "green" || s === "ok" || s === "within") return "green";
    if (s === "amber" || s === "warn" || s === "approaching") return "amber";
    if (s === "red" || s === "breach" || s === "exceeded") return "red";
    return "muted";
  }

  function renderRasClusters(rasMetrics) {
    const data = rasMetrics && typeof rasMetrics === "object" ? rasMetrics : {};

    const rows = RAS_CLUSTERS.map((cluster) => {
      const m = data[cluster.id] || data[cluster.id.toLowerCase()] || {};
      const status = m.status || m.rag || null;
      const dotTone = statusTone(status);
      const valueText =
        m.value !== undefined
          ? String(m.value)
          : status
            ? String(status).toUpperCase()
            : "awaiting data";
      const sub = m.limit ? `limit: ${m.limit}` : "";

      return `<div class="tl-row">
  <span class="tl-dot" data-tone="${dotTone}" title="${dotTone}"></span>
  <span class="tl-label"><strong>${cluster.id}</strong> — ${cluster.label}</span>
  <span class="tl-value">${valueText}</span>
  ${sub ? `<span style="font-size:var(--type-caption);color:var(--neutral-stone);font-family:var(--font-mono);margin-left:var(--space-2)">${sub}</span>` : ""}
</div>`;
    }).join("");

    return `<div>${rows}</div>`;
  }

  function renderKvTable(obj, caption) {
    if (!obj || typeof obj !== "object") {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">awaiting data</p>`;
    }
    const entries = Array.isArray(obj)
      ? obj.map((v, i) => [String(i + 1), v])
      : Object.entries(obj);
    if (!entries.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">awaiting data</p>`;
    }
    const rows = entries
      .map(([k, v]) => {
        const display =
          v === null || v === undefined
            ? "–"
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v);
        return `<tr><td><code>${k}</code></td><td>${display}</td></tr>`;
      })
      .join("");
    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="${caption}">
    <thead><tr><th>Key</th><th>Value</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
  }

  function renderDecisions(decisions) {
    if (!Array.isArray(decisions) || !decisions.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No open risk decisions. <a href="/index.html#decisionsOpen" style="color:var(--accent-ink)">View all decisions →</a></p>`;
    }
    const riskDecisions = decisions.filter((d) => {
      const id = (d.decisionId || d.id || "").toUpperCase();
      const title = (d.title || "").toLowerCase();
      return (
        id.includes("RISK") ||
        id.includes("RAS") ||
        id.includes("CAPITAL") ||
        title.includes("risk") ||
        title.includes("ras") ||
        title.includes("capital")
      );
    });
    if (!riskDecisions.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No risk-tagged decisions open. <a href="/index.html#decisionsOpen" style="color:var(--accent-ink)">View all decisions →</a></p>`;
    }
    const rows = riskDecisions
      .map((d) => {
        const id = d.decisionId || d.id || "–";
        const title = d.title || "–";
        const status = d.status || "open";
        return `<tr>
  <td><code>${id}</code></td>
  <td>${title}</td>
  <td><span class="status-badge" data-status="${status === "open" ? "pending" : "met"}">${status}</span></td>
</tr>`;
      })
      .join("");
    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Risk decisions">
    <thead><tr><th>ID</th><th>Title</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)"><a href="/index.html#decisionsOpen" style="color:var(--accent-ink)">View all open decisions →</a></p>`;
  }

  async function load() {
    const state = window.bankShell
      ? await window.bankShell.fetch.state()
      : await fetch("/api/state", { headers: { Accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

    if (!state) {
      const errMsg = `<p style="color:var(--semantic-error);font-size:var(--type-small)">Failed to load /api/state</p>`;
      for (const id of [
        "risk-ras-body",
        "risk-stress-body",
        "risk-limits-body",
        "risk-decisions-body",
      ]) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errMsg;
      }
      return;
    }

    if (window.bankShell?.render?.asOf) {
      window.bankShell.render.asOf(state.asOf);
    }

    document.getElementById("risk-ras-body").innerHTML = renderRasClusters(state.rasMetrics);

    document.getElementById("risk-stress-body").innerHTML = renderKvTable(
      state.stressTestResults,
      "Stress-test results",
    );

    document.getElementById("risk-limits-body").innerHTML = renderKvTable(
      state.limitUtilisations,
      "Limit utilisations",
    );

    const allDecisions = [...(state.decisionsOpen || []), ...(state.decisionsResolved || [])];
    document.getElementById("risk-decisions-body").innerHTML = renderDecisions(allDecisions);
  }

  window.bankRisk = { load };

  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(load, 30_000);
  } else {
    setInterval(() => load().catch((e) => console.warn("[risk] refresh failed", e)), 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
