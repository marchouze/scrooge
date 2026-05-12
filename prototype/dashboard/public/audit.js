// audit.js — Audit & Recon department view.
//
// Pulls /api/state and /api/substrate-gaps. Renders:
//   - Finding counts by severity (P1/P2/P3) from state.auditFindings
//   - Recon pipeline status from state.reconPipelines
//   - Substrate gaps table from /api/substrate-gaps
//
// Falls back gracefully when fields absent (build-phase placeholder —
// typed AuditFinding event is Wave-4 work).
//
// Author: Atlas (Core banking platform architect) — under CEO directive
// 2026-05-12 (intranet scaffold).

(() => {
  // Known recon pipelines for display even when state doesn't enumerate them.
  const KNOWN_PIPELINES = [
    { id: "mandate-coverage", label: "Mandate coverage" },
    { id: "prose-duplication", label: "Prose duplication" },
    { id: "canonical-source", label: "Canonical source" },
    { id: "risk-taxonomy-coverage", label: "Risk taxonomy coverage" },
    { id: "agent-spec-integrity", label: "Agent spec integrity" },
    { id: "policy-obligation-trace", label: "Policy → obligation trace" },
  ];

  function setMetric(id, text, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "–";
    if (tone) el.setAttribute("data-tone", tone);
  }

  function pipelineTone(status) {
    if (!status) return "muted";
    const s = String(status).toLowerCase();
    if (s === "pass" || s === "ok" || s === "green") return "green";
    if (s === "warn" || s === "advisory" || s === "amber") return "amber";
    if (s === "fail" || s === "error" || s === "red") return "red";
    return "muted";
  }

  function renderReconPipelines(pipelines) {
    // pipelines may be an object (keyed by pipeline id) or null.
    const data =
      pipelines && typeof pipelines === "object" && !Array.isArray(pipelines) ? pipelines : {};

    const rows = KNOWN_PIPELINES.map((p) => {
      const entry = data[p.id] || data[p.id.replace(/-/g, "_")] || null;
      const status = entry?.status ?? entry?.result ?? null;
      const tone = pipelineTone(status);
      const lastRun = entry?.lastRun ?? entry?.asOf ?? null;
      const lastRunStr = lastRun
        ? `${new Date(lastRun).toISOString().slice(0, 16).replace("T", " ")}Z`
        : "–";
      const display = status ? String(status).toUpperCase() : "AWAITING DATA";

      return `<div class="tl-row">
  <span class="tl-dot" data-tone="${tone}" title="${tone}"></span>
  <span class="tl-label"><strong>${p.label}</strong></span>
  <span class="tl-value">${display}</span>
  <span style="font-size:var(--type-caption);color:var(--neutral-stone);font-family:var(--font-mono);margin-left:var(--space-2)">${lastRunStr}</span>
</div>`;
    }).join("");

    // Also show any pipelines in the data that aren't in KNOWN_PIPELINES.
    const knownIds = new Set(KNOWN_PIPELINES.map((p) => p.id));
    const extraRows = Object.entries(data)
      .filter(([k]) => !knownIds.has(k))
      .map(([k, entry]) => {
        const status = entry?.status ?? entry?.result ?? null;
        const tone = pipelineTone(status);
        const display = status ? String(status).toUpperCase() : "–";
        return `<div class="tl-row">
  <span class="tl-dot" data-tone="${tone}"></span>
  <span class="tl-label"><strong>${k}</strong></span>
  <span class="tl-value">${display}</span>
</div>`;
      })
      .join("");

    return `<div>${rows}${extraRows}</div>`;
  }

  function renderGapsTable(substrateGaps) {
    const gaps = substrateGaps?.gaps;
    if (!Array.isArray(gaps) || !gaps.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No gaps found in /api/substrate-gaps. <a href="/health.html#substrate-gaps" style="color:var(--accent-ink)">Health view →</a></p>`;
    }

    const rows = gaps
      .slice(0, 30)
      .map((g) => {
        const id = g.id ?? "–";
        const title = g.title ?? g.description ?? "–";
        const severity = g.severity ?? g.priority ?? "–";
        const owner = g.owner ?? "–";
        const sevClass = severity.toLowerCase().startsWith("p1")
          ? "flagged"
          : severity.toLowerCase().startsWith("p2")
            ? "pending"
            : "unknown";
        return `<tr>
  <td><code style="font-size:var(--type-caption)">${id}</code></td>
  <td style="max-width:300px">${title}</td>
  <td><span class="status-badge" data-status="${sevClass}">${severity}</span></td>
  <td style="font-size:var(--type-caption)">${owner}</td>
</tr>`;
      })
      .join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Substrate gaps">
    <thead><tr><th>ID</th><th>Gap</th><th>Severity</th><th>Owner</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  Showing ${Math.min(gaps.length, 30)} of ${gaps.length} gaps.
  <a href="/health.html#substrate-gaps" style="color:var(--accent-ink)">Full view at health.html →</a>
</p>`;
  }

  async function load() {
    const [state, substrateGaps] = await Promise.all([
      window.bankShell
        ? window.bankShell.fetch.state()
        : fetch("/api/state", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
      window.bankShell
        ? window.bankShell.fetch.substrateGaps()
        : fetch("/api/substrate-gaps", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
    ]);

    if (window.bankShell?.render?.asOf && state?.asOf) {
      window.bankShell.render.asOf(state.asOf);
    }

    // --- Finding counts -------------------------------------------
    const findings = state?.auditFindings ?? {};
    const p1 = findings.p1 ?? findings.P1 ?? findings.critical ?? 0;
    const p2 = findings.p2 ?? findings.P2 ?? findings.high ?? 0;
    const p3 = findings.p3 ?? findings.P3 ?? findings.advisory ?? 0;
    const total =
      (typeof p1 === "number" ? p1 : 0) +
      (typeof p2 === "number" ? p2 : 0) +
      (typeof p3 === "number" ? p3 : 0);
    const gapCount = substrateGaps?.gaps?.length ?? 0;

    setMetric("audit-p1", String(p1 || "–"), p1 > 0 ? "error" : "muted");
    setMetric("audit-p2", String(p2 || "–"), p2 > 0 ? "warn" : "muted");
    setMetric("audit-p3", String(p3 || "–"), p3 > 0 ? "warn" : "muted");
    setMetric("audit-total", String(total || "–"), total > 0 ? "warn" : "muted");
    setMetric("audit-gaps", String(gapCount), gapCount > 0 ? "warn" : "muted");

    const asOf = state?.asOf;
    const tickStr = asOf ? `${new Date(asOf).toISOString().slice(0, 16).replace("T", " ")}Z` : "–";
    setMetric("audit-last-tick", tickStr, "muted");

    // --- Recon pipelines -----------------------------------------
    document.getElementById("audit-recon-body").innerHTML = renderReconPipelines(
      state?.reconPipelines ?? null,
    );

    // --- Substrate gaps table ------------------------------------
    document.getElementById("audit-gaps-body").innerHTML = renderGapsTable(substrateGaps);
  }

  window.bankAudit = { load };

  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(load, 30_000);
  } else {
    setInterval(() => load().catch((e) => console.warn("[audit] refresh failed", e)), 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
