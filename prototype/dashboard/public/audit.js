// audit.js — Audit & Recon department view.
//
// Pulls /api/state and /api/substrate-gaps. Renders:
//   - Finding counts by severity (P1/P2/P3) from state.findings array
//     (AuditFinding events) — also checks state.auditFindings for legacy shape.
//   - Open findings table with source, description, severity, and date.
//   - Recon pipeline status from state.reconPipelines.
//   - Substrate gaps table from /api/substrate-gaps.
//
// Falls back gracefully when fields absent (build-phase placeholder —
// typed AuditFinding event is Wave-4 work).
//
// Author: Atlas (Core banking platform architect) — under CEO directive
// 2026-05-12 (intranet scaffold).
// Improved: Noa (Intranet Product Owner & UI Architect) — 2026-05-12.

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

  function renderFindingsTable(findings) {
    if (!findings.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No AuditFinding events in the event store. Vera Wave-4 recon pipelines and Mira citation gate emit these events; typed AuditFinding event registry is Wave-4 work.</p>`;
    }
    const sorted = findings.slice().sort((a, b) => (a.asOf < b.asOf ? 1 : -1));
    const rows = sorted
      .slice(0, 25)
      .map((f) => {
        const sev = (f.severity || "").toLowerCase();
        const sevStatus =
          sev === "critical" || sev === "high"
            ? "flagged"
            : sev === "medium"
              ? "pending"
              : "unknown";
        const when = f.asOf ? `${new Date(f.asOf).toISOString().slice(0, 10)}` : "–";
        const principle = f.principle
          ? `<br><span style="font-size:var(--type-caption);color:var(--neutral-stone)">P${f.principle}</span>`
          : "";
        return `<tr>
  <td><code style="font-size:var(--type-caption)">${f.id || "–"}</code></td>
  <td style="max-width:300px">${f.description || "–"}${principle}</td>
  <td><span class="status-badge" data-status="${sevStatus}">${f.severity || "–"}</span></td>
  <td style="font-size:var(--type-caption);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.source || "–"}</td>
  <td style="font-size:var(--type-caption);white-space:nowrap">${when}</td>
</tr>`;
      })
      .join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Open audit findings">
    <thead><tr><th>ID</th><th>Description</th><th>Severity</th><th>Source</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  Showing ${Math.min(sorted.length, 25)} of ${findings.length} findings, most recent first.
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
    // Prefer the typed state.findings array (AuditFinding events, derive.ts).
    // Fall back to state.auditFindings object shape for legacy compatibility.
    const findingsArr = Array.isArray(state?.findings) ? state.findings : [];

    let p1 = 0;
    let p2 = 0;
    let p3 = 0;

    if (findingsArr.length > 0) {
      // P1 = Critical, P2 = High, P3 = Medium / Low / Advisory.
      // Matches the HTML tile labels (audit-p1 "P1 — Critical", audit-p2 "P2 — High").
      for (const f of findingsArr) {
        const sev = (f.severity || "").toLowerCase();
        if (sev === "critical") p1++;
        else if (sev === "high") p2++;
        else p3++;
      }
    } else {
      // Legacy fallback: state.auditFindings keyed object.
      const legacyFindings = state?.auditFindings ?? {};
      p1 = legacyFindings.p1 ?? legacyFindings.P1 ?? legacyFindings.critical ?? 0;
      p2 = legacyFindings.p2 ?? legacyFindings.P2 ?? legacyFindings.high ?? 0;
      p3 = legacyFindings.p3 ?? legacyFindings.P3 ?? legacyFindings.advisory ?? 0;
    }

    const total = p1 + p2 + p3;
    const gapCount = substrateGaps?.gaps?.length ?? 0;
    const openDecisions = state?.decisionsOpen?.length ?? 0;

    setMetric("audit-p1", String(p1 || "–"), p1 > 0 ? "error" : "muted");
    setMetric("audit-p2", String(p2 || "–"), p2 > 0 ? "warn" : "muted");
    setMetric("audit-p3", String(p3 || "–"), p3 > 0 ? "warn" : "muted");
    setMetric("audit-total", String(total || "–"), total > 0 ? "warn" : "muted");
    setMetric("audit-gaps", String(gapCount), gapCount > 0 ? "warn" : "muted");
    setMetric(
      "audit-open-decisions",
      String(openDecisions),
      openDecisions > 0 ? "warn" : "success",
    );

    const asOf = state?.asOf;
    const tickStr = asOf ? `${new Date(asOf).toISOString().slice(0, 16).replace("T", " ")}Z` : "–";
    setMetric("audit-last-tick", tickStr, "muted");

    // --- Open findings table -------------------------------------
    const findingsTableEl = document.getElementById("audit-findings-body");
    if (findingsTableEl) findingsTableEl.innerHTML = renderFindingsTable(findingsArr);

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
