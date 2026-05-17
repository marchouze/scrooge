// risk.js — Risk Watch department view.
//
// Pulls /api/state for rasMetrics, stressTestResults, limitUtilisations,
// findings (AuditFinding events), and open decisions.
// Shows traffic-light indicators per RAS cluster B1–B5.
// Falls back gracefully when fields absent (build-phase placeholder).
//
// Author: Atlas (Core banking platform architect) — under CEO directive
// 2026-05-12 (intranet scaffold).
// Improved: Noa (Intranet Product Owner & UI Architect) — 2026-05-12.

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
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No open risk decisions. <a href="/decisions.html" style="color:var(--accent-ink)">View all decisions →</a></p>`;
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
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No risk-tagged decisions open. <a href="/decisions.html" style="color:var(--accent-ink)">View all decisions →</a></p>`;
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
<p style="margin-top:var(--space-3);font-size:var(--type-small)"><a href="/decisions.html" style="color:var(--accent-ink)">View all open decisions →</a></p>`;
  }

  function setMetric(id, text, dataTone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "–";
    if (dataTone) el.setAttribute("data-tone", dataTone);
  }

  function renderFindingsSummary(findings) {
    if (!Array.isArray(findings) || !findings.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No findings in event store. Vera Wave-4 recon pipelines emit AuditFinding events; typed AuditFinding event is Wave-4 work.</p>`;
    }
    // Show the most recent 10 findings sorted by asOf descending
    const sorted = findings.slice().sort((a, b) => (a.asOf < b.asOf ? 1 : -1));
    const recent = sorted.slice(0, 10);
    const rows = recent
      .map((f) => {
        const sev = (f.severity || "").toLowerCase();
        const sevStatus =
          sev === "critical" || sev === "high"
            ? "flagged"
            : sev === "medium"
              ? "pending"
              : "unknown";
        const when = f.asOf ? `${new Date(f.asOf).toISOString().slice(0, 10)}` : "–";
        return `<tr>
  <td><code style="font-size:var(--type-caption)">${f.id || "–"}</code></td>
  <td style="max-width:280px">${f.description || "–"}</td>
  <td><span class="status-badge" data-status="${sevStatus}">${f.severity || "–"}</span></td>
  <td style="font-size:var(--type-caption);color:var(--neutral-stone)">${f.source || "–"}</td>
  <td style="font-size:var(--type-caption);white-space:nowrap">${when}</td>
</tr>`;
      })
      .join("");
    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Recent audit findings">
    <thead><tr><th>ID</th><th>Description</th><th>Severity</th><th>Source</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  Showing ${recent.length} of ${findings.length} findings.
  <a href="/audit.html" style="color:var(--accent-ink)">Full view at Audit &amp; Recon →</a>
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
      for (const id of [
        "risk-ras-body",
        "risk-stress-body",
        "risk-limits-body",
        "risk-decisions-body",
        "risk-findings-body",
      ]) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errMsg;
      }
      return;
    }

    if (window.bankShell?.render?.asOf) {
      window.bankShell.render.asOf(state.asOf);
    }

    // --- Summary metrics -------------------------------------------
    const findings = Array.isArray(state.findings) ? state.findings : [];
    const openDecisionsCount = state.decisionsOpen?.length ?? 0;
    const resolvedCount = state.decisionsResolved?.length ?? 0;

    // Count findings by severity
    let findingsHigh = 0;
    let findingsMedium = 0;
    for (const f of findings) {
      const sev = (f.severity || "").toLowerCase();
      if (sev === "critical" || sev === "high") findingsHigh++;
      else if (sev === "medium") findingsMedium++;
    }
    setMetric(
      "risk-findings-high",
      String(findingsHigh || "–"),
      findingsHigh > 0 ? "error" : "muted",
    );
    setMetric(
      "risk-findings-medium",
      String(findingsMedium || "–"),
      findingsMedium > 0 ? "warn" : "muted",
    );
    setMetric(
      "risk-findings-total",
      String(findings.length || "–"),
      findings.length > 0 ? "warn" : "muted",
    );
    setMetric(
      "risk-open-decisions",
      String(openDecisionsCount),
      openDecisionsCount > 0 ? "warn" : "success",
    );
    setMetric("risk-resolved-decisions", String(resolvedCount), "muted");

    // --- RAS clusters ---------------------------------------------
    document.getElementById("risk-ras-body").innerHTML = renderRasClusters(state.rasMetrics);

    // --- Stress-test results -------------------------------------
    document.getElementById("risk-stress-body").innerHTML = renderKvTable(
      state.stressTestResults,
      "Stress-test results",
    );

    // --- Limit utilisations --------------------------------------
    document.getElementById("risk-limits-body").innerHTML = renderKvTable(
      state.limitUtilisations,
      "Limit utilisations",
    );

    // --- Open risk decisions ------------------------------------
    const allDecisions = [...(state.decisionsOpen || []), ...(state.decisionsResolved || [])];
    document.getElementById("risk-decisions-body").innerHTML = renderDecisions(allDecisions);

    // --- Findings table (from AuditFinding events) ---------------
    const findingsEl = document.getElementById("risk-findings-body");
    if (findingsEl) findingsEl.innerHTML = renderFindingsSummary(findings);

    // --- Slice 5 tiles -------------------------------------------
    await loadSlice5(state);
  }

  // -------------------------------------------------------------------------
  // Slice 5 — RAS Utilisation tile
  // -------------------------------------------------------------------------

  function fmtZar(amount) {
    if (typeof amount !== "number") return "–";
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function fmtPct(ratio) {
    if (typeof ratio !== "number") return "–";
    return `${(ratio * 100).toFixed(1)} %`;
  }

  function ragTone(ragStatus) {
    if (ragStatus === "red") return "error";
    if (ragStatus === "amber") return "warn";
    return "success";
  }

  function renderRasUtilisation(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No RAS limit schedule published yet.</p>`;
    }
    const barRows = rows
      .map((row) => {
        const pct = typeof row.utilisationPct === "number" ? row.utilisationPct : 0;
        const barPct = Math.min(pct * 100, 100).toFixed(1);
        const tone = ragTone(row.ragStatus);
        const barColor =
          tone === "error"
            ? "var(--semantic-error)"
            : tone === "warn"
              ? "var(--semantic-warn, #f59e0b)"
              : "var(--semantic-success, #22c55e)";
        return `<div style="padding:var(--space-3) var(--space-4);border-bottom:var(--border-subtle);display:grid;grid-template-columns:3rem 1fr 10rem 5rem 3.5rem;gap:var(--space-3);align-items:center">
  <strong style="font-family:var(--font-mono);font-size:var(--type-small)">${row.cluster}</strong>
  <div>
    <div style="font-size:var(--type-small);margin-bottom:var(--space-1)">${row.limitName || "–"}</div>
    <div style="background:var(--neutral-subtlest);border-radius:var(--radius-sm);height:8px;overflow:hidden">
      <div style="background:${barColor};width:${barPct}%;height:100%;transition:width 0.4s ease"></div>
    </div>
  </div>
  <span style="font-size:var(--type-caption);color:var(--neutral-stone);font-family:var(--font-mono);text-align:right">${fmtZar(row.currentExposure)} / ${fmtZar(row.limitValue)}</span>
  <span style="font-size:var(--type-caption);font-family:var(--font-mono);text-align:right">${fmtPct(pct)}</span>
  <span class="tl-dot" data-tone="${tone}" title="${row.ragStatus}" style="margin:0 auto"></span>
</div>`;
      })
      .join("");
    return `<div style="background:#fff;border:var(--border-subtle);border-radius:var(--radius-lg);overflow:hidden">${barRows}</div>`;
  }

  // -------------------------------------------------------------------------
  // Slice 5 — Rejection Feed tile
  // -------------------------------------------------------------------------

  function renderRejectionFeed(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No rejections in the last 24 hours.</p>`;
    }
    const displayRows = rows.slice(0, 50);
    const tableRows = displayRows
      .map((r) => {
        const time = r.timestamp
          ? new Date(r.timestamp).toISOString().replace("T", " ").slice(0, 19)
          : "–";
        const notional = typeof r.notional === "number" ? fmtZar(r.notional) : "–";
        const util =
          typeof r.utilisationAtRejection === "number" ? fmtPct(r.utilisationAtRejection) : "–";
        return `<tr>
  <td style="font-size:var(--type-caption);white-space:nowrap;font-family:var(--font-mono)">${time}</td>
  <td><code style="font-size:var(--type-caption)">${r.instrumentId || "–"}</code></td>
  <td style="font-family:var(--font-mono);text-align:right">${notional}</td>
  <td><code style="font-size:var(--type-caption)">${r.limitCode || "–"}</code></td>
  <td style="font-family:var(--font-mono);text-align:right">${util}</td>
</tr>`;
      })
      .join("");
    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Order rejections last 24 h">
    <thead><tr><th>Time</th><th>Instrument</th><th>Notional</th><th>Limit breached</th><th>Util. at rejection</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>${rows.length > 50 ? `<p style="margin-top:var(--space-2);font-size:var(--type-caption);color:var(--neutral-stone)">Showing 50 of ${rows.length} rejections.</p>` : ""}`;
  }

  // -------------------------------------------------------------------------
  // Slice 5 — Correspondent Routing tile
  // -------------------------------------------------------------------------

  function renderCorrespondentRouting(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No routing data available.</p>`;
    }
    const tableRows = rows
      .map((r) => {
        const clsCell = r.clsEligible
          ? `<span style="color:var(--semantic-success, #22c55e)">Yes</span>`
          : `<span style="color:var(--neutral-stone)">No</span>`;
        const herstattTone =
          r.herstattRisk === "high" ? "error" : r.herstattRisk === "managed" ? "warn" : "success";
        const herstattCell = `<span class="status-badge" data-status="${herstattTone === "error" ? "flagged" : herstattTone === "warn" ? "pending" : "met"}">${r.herstattRisk || "–"}</span>`;
        const bilateralFlag = r.flagBilateral
          ? ` <span title="Non-CLS fallback applies" style="color:var(--semantic-warn, #f59e0b)">⚠</span>`
          : "";
        const scheme = r.flagBilateral ? `${r.scheme || "–"}${bilateralFlag}` : r.scheme || "–";
        // Amber background for non-CLS pairs
        const rowStyle =
          (!r.clsEligible && r.currency !== "ZAR") || r.flagBilateral
            ? "background:var(--semantic-warn-subtle, #fef3c7)"
            : "";
        return `<tr${rowStyle ? ` style="${rowStyle}"` : ""}>
  <td><strong style="font-family:var(--font-mono)">${r.currency}</strong></td>
  <td>${r.correspondentBank || "–"}</td>
  <td><code style="font-size:var(--type-caption)">${scheme}</code></td>
  <td>${clsCell}</td>
  <td>${herstattCell}</td>
</tr>`;
      })
      .join("");
    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Correspondent routing table">
    <thead><tr><th>Currency</th><th>Correspondent</th><th>Scheme</th><th>CLS eligible</th><th>Herstatt risk</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>`;
  }

  // -------------------------------------------------------------------------
  // Load function — extended for Slice 5
  // -------------------------------------------------------------------------

  async function loadSlice5(state) {
    // Tile 1 — RAS Utilisation from /api/state → limitUtilisations
    const rasUtilEl = document.getElementById("risk-ras-utilisation-body");
    if (rasUtilEl) {
      rasUtilEl.innerHTML = renderRasUtilisation(state?.limitUtilisations);
    }

    // Tile 2 — Rejection Feed from /api/rejections
    const rejectEl = document.getElementById("risk-rejections-body");
    if (rejectEl) {
      try {
        const resp = await fetch("/api/rejections", { headers: { Accept: "application/json" } });
        const data = resp.ok ? await resp.json() : null;
        rejectEl.innerHTML = renderRejectionFeed(data?.rows);
      } catch {
        rejectEl.innerHTML = `<p style="color:var(--neutral-stone);font-size:var(--type-small)">Could not load /api/rejections.</p>`;
      }
    }

    // Tile 3 — Correspondent Routing from /api/correspondent-routing
    const corrEl = document.getElementById("risk-correspondent-body");
    if (corrEl) {
      try {
        const resp = await fetch("/api/correspondent-routing", {
          headers: { Accept: "application/json" },
        });
        const data = resp.ok ? await resp.json() : null;
        corrEl.innerHTML = renderCorrespondentRouting(data?.rows);
      } catch {
        corrEl.innerHTML = `<p style="color:var(--neutral-stone);font-size:var(--type-small)">Could not load /api/correspondent-routing.</p>`;
      }
    }
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
