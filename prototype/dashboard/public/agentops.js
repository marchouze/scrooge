// agentops.js — AgentOps department view.
//
// Primary persona: Sade (HR systems engineer / AgentOps, engineering).
// Renders:
//   - Fleet health summary metrics (total / active / idle / handlers / gaps)
//   - Agent roster table from state.agents (name, role, type, workstream, last-activity)
//   - Active workstreams from state.inFlight (active === true)
//   - Substrate gaps from /api/substrate-gaps
//
// Data sources:
//   /api/state   → state.agents (persona roster), state.inFlight (workstreams)
//   /api/fleet   → handler-level fleet status (registered triggers)
//   /api/substrate-gaps → Atlas substrate gap inventory
//
// Author: Noa (Intranet Product Owner & UI Architect) — 2026-05-12.

(() => {
  function setMetric(id, text, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "–";
    if (tone) el.setAttribute("data-tone", tone);
  }

  function fmtDate(iso) {
    if (!iso) return "–";
    try {
      return new Date(iso).toISOString().slice(0, 10);
    } catch {
      return String(iso);
    }
  }

  function fmtDateTime(iso) {
    if (!iso) return "–";
    try {
      return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + "Z";
    } catch {
      return String(iso);
    }
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Derive a compact build-phase-status note from the agent's data.
  // Falls back gracefully when fields are absent.
  function buildPhaseNote(agent) {
    // Check for paused/deferred indicators in mandate text.
    const mandate = (agent.mandate || "").toLowerCase();
    if (mandate.includes("paused") || mandate.includes("licence-day")) return "build-phase limited";
    if (mandate.includes("activates at licence-day")) return "licence-day";
    return null;
  }

  function renderRosterTable(agents, inFlight) {
    if (!Array.isArray(agents) || !agents.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No agent data in <code>/api/state → agents</code>. The fleet rolls up from <code>Team/_team-roster.json</code> on server boot.</p>`;
    }

    // Build a lookup: agent name → active workstream(s)
    const activeByAgent = new Map();
    for (const w of (inFlight || [])) {
      if (w.active) {
        const owner = w.owner || "";
        if (!activeByAgent.has(owner)) activeByAgent.set(owner, []);
        activeByAgent.get(owner).push(w);
      }
    }

    const rows = agents
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .map((agent) => {
        const name = escHtml(agent.name || "–");
        const role = escHtml(agent.role || "–");
        const type = agent.type || "–";
        const typeBadge = type === "Governance"
          ? `<span class="status-badge" data-status="active">Gov</span>`
          : `<span class="status-badge" data-status="pending">Eng</span>`;

        const agentWorkstreams = activeByAgent.get(agent.name) || [];
        const workstreamCell = agentWorkstreams.length
          ? agentWorkstreams.map((w) => `<span style="font-size:var(--type-caption);color:var(--accent-ink)">${escHtml(w.what || w.id || "active")}</span>`).join("<br>")
          : `<span style="color:var(--neutral-stone);font-size:var(--type-caption)">idle</span>`;

        const lastActivity = agent.lastActivityAt
          ? `<span style="font-family:var(--font-mono);font-size:var(--type-caption)">${fmtDate(agent.lastActivityAt)}</span>`
          : `<span style="color:var(--neutral-stone);font-size:var(--type-caption)">–</span>`;

        const note = buildPhaseNote(agent);
        const noteCell = note
          ? `<span class="status-badge" data-status="unknown" style="font-size:var(--type-caption)">${escHtml(note)}</span>`
          : "";

        return `<tr>
  <td><strong>${name}</strong>${noteCell ? `<br>${noteCell}` : ""}</td>
  <td style="font-size:var(--type-caption);max-width:220px">${role}</td>
  <td>${typeBadge}</td>
  <td style="max-width:200px">${workstreamCell}</td>
  <td>${lastActivity}</td>
</tr>`;
      })
      .join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Agent roster">
    <thead><tr><th>Agent</th><th>Role</th><th>Type</th><th>Active workstream</th><th>Last activity</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  ${agents.length} agents from <code>Team/_team-roster.json</code>.
  Handler-trigger view at <a href="/fleet.html" style="color:var(--accent-ink)">fleet.html →</a>
</p>`;
  }

  function renderWorkstreamsTable(inFlight) {
    const active = (inFlight || []).filter((w) => w.active === true);
    if (!active.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No active workstreams. Workstreams become active after a <code>WorkstreamStarted</code> event.</p>`;
    }

    const rows = active.map((w) => {
      const id = escHtml(w.id || "–");
      const what = escHtml(w.what || "–");
      const owner = escHtml(w.owner || "–");
      const started = fmtDate(w.startedAt);
      const due = escHtml(w.due || "–");
      return `<tr>
  <td><code style="font-size:var(--type-caption)">${id}</code></td>
  <td style="max-width:280px">${what}</td>
  <td style="font-size:var(--type-caption)">${owner}</td>
  <td style="font-family:var(--font-mono);font-size:var(--type-caption);white-space:nowrap">${started}</td>
  <td style="font-size:var(--type-caption);white-space:nowrap">${due}</td>
</tr>`;
    }).join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Active workstreams">
    <thead><tr><th>ID</th><th>Workstream</th><th>Owner</th><th>Started</th><th>Due</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  ${active.length} active workstream${active.length !== 1 ? "s" : ""}.
</p>`;
  }

  function renderSubstrateGapsTable(substrateGaps) {
    const gaps = substrateGaps?.gaps;
    if (!Array.isArray(gaps) || !gaps.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No substrate gaps found in <code>/api/substrate-gaps</code>. <a href="/health.html" style="color:var(--accent-ink)">Health view →</a></p>`;
    }

    const rows = gaps.slice(0, 30).map((g) => {
      const id = escHtml(g.id ?? "–");
      const title = escHtml(g.title ?? g.description ?? "–");
      const severity = escHtml(g.severity ?? g.priority ?? "–");
      const owner = escHtml(g.owner ?? "–");
      const sevLower = String(g.severity ?? g.priority ?? "").toLowerCase();
      const sevStatus = sevLower.startsWith("p1") || sevLower === "critical" || sevLower === "high"
        ? "flagged"
        : sevLower.startsWith("p2") || sevLower === "medium"
          ? "pending"
          : "unknown";
      return `<tr>
  <td><code style="font-size:var(--type-caption)">${id}</code></td>
  <td style="max-width:320px">${title}</td>
  <td><span class="status-badge" data-status="${sevStatus}">${severity}</span></td>
  <td style="font-size:var(--type-caption)">${owner}</td>
</tr>`;
    }).join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Substrate gaps">
    <thead><tr><th>ID</th><th>Description</th><th>Priority</th><th>Owner</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  Showing ${Math.min(gaps.length, 30)} of ${gaps.length} gaps.
  <a href="/health.html" style="color:var(--accent-ink)">Full substrate view →</a>
</p>`;
  }

  async function load() {
    const [state, fleet, substrateGaps] = await Promise.all([
      window.bankShell
        ? window.bankShell.fetch.state()
        : fetch("/api/state", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
      window.bankShell
        ? window.bankShell.fetch.fleet()
        : fetch("/api/fleet", { headers: { Accept: "application/json" } })
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

    const agents = Array.isArray(state?.agents) ? state.agents : [];
    const inFlight = Array.isArray(state?.inFlight) ? state.inFlight : [];
    const fleetHandlers = Array.isArray(fleet?.fleet) ? fleet.fleet : [];
    const activeWorkstreams = inFlight.filter((w) => w.active === true);
    const gapCount = substrateGaps?.gaps?.length ?? 0;

    // Active agents = agents that have at least one active workstream.
    const activeAgentNames = new Set(activeWorkstreams.map((w) => w.owner).filter(Boolean));
    const activeAgentCount = agents.filter((a) => activeAgentNames.has(a.name)).length;
    const idleCount = agents.length - activeAgentCount;

    // Fleet health metrics
    setMetric("agentops-total", String(agents.length || "–"), agents.length > 0 ? "default" : "muted");
    setMetric("agentops-active", String(activeAgentCount), activeAgentCount > 0 ? "success" : "muted");
    setMetric("agentops-idle", String(idleCount), idleCount === agents.length ? "muted" : "default");
    setMetric("agentops-handlers", String(fleetHandlers.length || "–"), fleetHandlers.length > 0 ? "default" : "muted");
    setMetric("agentops-gaps", String(gapCount), gapCount > 0 ? "warn" : "muted");

    // Roster table
    const rosterEl = document.getElementById("agentops-roster-body");
    if (rosterEl) rosterEl.innerHTML = renderRosterTable(agents, inFlight);

    // Active workstreams table
    const workstreamsEl = document.getElementById("agentops-workstreams-body");
    if (workstreamsEl) workstreamsEl.innerHTML = renderWorkstreamsTable(inFlight);

    // Substrate gaps table
    const substrateEl = document.getElementById("agentops-substrate-body");
    if (substrateEl) substrateEl.innerHTML = renderSubstrateGapsTable(substrateGaps);
  }

  window.bankAgentOps = { load };

  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(load, 30_000);
  } else {
    setInterval(() => load().catch((e) => console.warn("[agentops] refresh failed", e)), 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
