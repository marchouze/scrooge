// performance.js — Agent Performance dashboard page.
//
// Fetches /api/performance and renders:
//   - KPI summary bar (5 cards)
//   - Fleet table with expandable per-agent detail
//   - Period / tier / trend / search filters
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  // ---------------------------------------------------------------------------
  // Agent role lookup — joins agentId against fleet metadata
  // ---------------------------------------------------------------------------
  const roleCache = new Map(); // agentId → role label

  async function loadFleetRoles() {
    try {
      const res = await fetch("/api/fleet");
      if (!res.ok) return;
      const data = await res.json();
      const fleet = Array.isArray(data.fleet) ? data.fleet : [];
      for (const agent of fleet) {
        if (agent.agentId && agent.position) {
          roleCache.set(agent.agentId, agent.position);
        }
      }
    } catch {
      // best-effort; table shows agentId if role unavailable
    }
  }

  function agentRole(agentId) {
    return roleCache.get(agentId) ?? "—";
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------
  function pct(score) {
    if (typeof score !== "number") return "—";
    return `${Math.round(score * 100)}%`;
  }

  function tierBadge(tier) {
    const map = {
      exceeds: ["tier-exceeds", "Exceeds"],
      meets: ["tier-meets", "Meets"],
      "needs-improvement": ["tier-needs-improvement", "Needs improvement"],
      unsatisfactory: ["tier-unsatisfactory", "Unsatisfactory"],
      // Neutral grey — agent not yet dispatched by autonomous scheduler; not a failure.
      "substrate-limited": ["tier-substrate-limited", "Substrate limited"],
    };
    const [cls, label] = map[tier] ?? ["tier-meets", tier ?? "—"];
    return `<span class="tier-badge ${cls}">${label}</span>`;
  }

  /** Resolve the display tier for an agent — prefer displayTier (new field) over latestTier. */
  function resolveDisplayTier(agent) {
    return agent.displayTier ?? agent.latestTier;
  }

  function trendArrow(trend) {
    switch (trend) {
      case "improving":
        return `<span class="trend-arrow trend-improving" title="Improving">↑</span>`;
      case "declining":
        return `<span class="trend-arrow trend-declining" title="Declining">↓</span>`;
      case "stable":
        return `<span class="trend-arrow trend-stable" title="Stable">→</span>`;
      case "insufficient-data":
        return `<span class="trend-arrow trend-insufficient" title="Insufficient data">—</span>`;
      default:
        return `<span class="trend-arrow trend-insufficient">—</span>`;
    }
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    return iso.slice(0, 10);
  }

  // ---------------------------------------------------------------------------
  // Period filter helper
  // ---------------------------------------------------------------------------
  function agentMatchesPeriod(agent, period) {
    if (!period) return true; // "most recent" — no filter
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const last7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    switch (period) {
      case "today":
        return agent.latestPeriod === today;
      case "yesterday":
        return agent.latestPeriod === yesterday;
      case "last7":
        return agent.latestPeriod >= last7;
      default:
        return true;
    }
  }

  // ---------------------------------------------------------------------------
  // Expanded detail panel
  // ---------------------------------------------------------------------------
  function buildDetailHtml(agent) {
    const scores = agent.latestScores ?? {};
    const narrative = agent.latestNarrative ?? {};
    const strengths = Array.isArray(narrative.strengths) ? narrative.strengths : [];
    const improvements = Array.isArray(narrative.areasForImprovement)
      ? narrative.areasForImprovement
      : [];
    const feedbackSummary = narrative.feedbackSummary ?? "";
    const feedbackPath = agent.lastFeedbackPath;

    const scoreGrid = `
      <div class="perf-score-grid">
        <div class="perf-score-item">
          <div class="perf-score-val">${pct(scores.overall)}</div>
          <div class="perf-score-lbl">Overall</div>
        </div>
        <div class="perf-score-item">
          <div class="perf-score-val">${pct(scores.delivery)}</div>
          <div class="perf-score-lbl">Delivery</div>
        </div>
        <div class="perf-score-item">
          <div class="perf-score-val">${pct(scores.quality)}</div>
          <div class="perf-score-lbl">Quality</div>
        </div>
        <div class="perf-score-item">
          <div class="perf-score-val">${pct(scores.strategic)}</div>
          <div class="perf-score-lbl">Strategic</div>
        </div>
      </div>`;

    const strengthsHtml =
      strengths.length > 0
        ? `<ul>${strengths.map((s) => `<li>${escHtml(s)}</li>`).join("")}</ul>`
        : `<p style="color:var(--neutral-stone);font-style:italic">None recorded</p>`;

    const improvementsHtml =
      improvements.length > 0
        ? `<ul>${improvements.map((s) => `<li>${escHtml(s)}</li>`).join("")}</ul>`
        : `<p style="color:var(--neutral-stone);font-style:italic">None recorded</p>`;

    const feedbackHtml = feedbackPath
      ? `<p>${escHtml(feedbackSummary)}</p><p style="margin-top:6px"><a class="perf-feedback-link" href="${escHtml(feedbackPath)}">${escHtml(feedbackPath)}</a></p>`
      : `<p>${feedbackSummary ? escHtml(feedbackSummary) : '<em style="color:var(--neutral-stone)">No feedback file recorded</em>'}</p>`;

    return `<div class="perf-detail">
      <div class="perf-detail-section" style="grid-column:1/-1">
        <h4>Score breakdown</h4>
        ${scoreGrid}
      </div>
      <div class="perf-detail-section">
        <h4>Strengths</h4>
        ${strengthsHtml}
      </div>
      <div class="perf-detail-section">
        <h4>Areas for improvement</h4>
        ${improvementsHtml}
      </div>
      <div class="perf-detail-section" style="grid-column:1/-1">
        <h4>Feedback summary</h4>
        ${feedbackHtml}
      </div>
    </div>`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------------------------
  // Table rendering
  // ---------------------------------------------------------------------------
  let expandedAgentId = null;
  let currentAgents = [];

  function renderTable(agents) {
    currentAgents = agents;
    const tbody = document.getElementById("perfTableBody");
    if (!tbody) return;

    document.getElementById("filterCount").textContent =
      `${agents.length} agent${agents.length !== 1 ? "s" : ""}`;

    if (agents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9">
        <div class="perf-empty">
          <strong>No agents match the current filter</strong>
          Adjust the period, tier, or trend filters above.
        </div>
      </td></tr>`;
      return;
    }

    const rows = [];
    for (const agent of agents) {
      const agentId = agent.agentId;
      const isExpanded = expandedAgentId === agentId;

      rows.push(`<tr class="data-row" data-agent-id="${escHtml(agentId)}">
        <td><code style="font-size:11px">${escHtml(agentId)}</code></td>
        <td style="font-size:12px">${escHtml(agentRole(agentId))}</td>
        <td style="font-weight:600">${pct(agent.latestOverallScore)}</td>
        <td>${pct(agent.latestScores?.delivery)}</td>
        <td>${pct(agent.latestScores?.quality)}</td>
        <td>${pct(agent.latestScores?.strategic)}</td>
        <td>${tierBadge(resolveDisplayTier(agent))}</td>
        <td>${trendArrow(agent.trend)}</td>
        <td style="font-size:11.5px;color:var(--neutral-stone)">${fmtDate(agent.latestPeriod)}</td>
      </tr>`);

      if (isExpanded) {
        rows.push(`<tr class="expanded-row" data-expanded-for="${escHtml(agentId)}">
          <td colspan="9">${buildDetailHtml(agent)}</td>
        </tr>`);
      }
    }

    tbody.innerHTML = rows.join("");

    // Attach click handlers for expand/collapse
    for (const row of tbody.querySelectorAll("tr.data-row")) {
      row.addEventListener("click", () => {
        const id = row.dataset.agentId;
        expandedAgentId = expandedAgentId === id ? null : id;
        renderTable(currentAgents);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // KPI summary bar
  // ---------------------------------------------------------------------------
  function renderSummary(data) {
    const container = document.getElementById("perfSummary");
    if (!container) return;

    const avgPct = data.fleetSize > 0 ? pct(data.avgOverallScore) : "—";
    const tc = data.tierCounts ?? {};
    const improving = Array.isArray(data.allAgents)
      ? data.allAgents.filter((a) => a.trend === "improving").length
      : 0;
    // attentionNeeded excludes substrate-limited agents (server-side filtered).
    const attention = Array.isArray(data.attentionNeeded) ? data.attentionNeeded.length : 0;

    container.innerHTML = `
      <div class="perf-card">
        <div class="perf-card-num">${data.fleetSize ?? 0}</div>
        <div class="perf-card-lbl">Fleet size</div>
        <div class="perf-card-sub">${data.evaluatedToday ?? 0} evaluated today</div>
      </div>
      <div class="perf-card">
        <div class="perf-card-num">${avgPct}</div>
        <div class="perf-card-lbl">Avg overall score</div>
        <div class="perf-card-sub">Fleet average</div>
      </div>
      <div class="perf-card">
        <div class="perf-card-lbl" style="margin-bottom:6px">Tier distribution</div>
        <div class="perf-tier-chips">
          <span class="tier-chip tier-exceeds">${tc.exceeds ?? 0} exceeds</span>
          <span class="tier-chip tier-meets">${tc.meets ?? 0} meets</span>
          <span class="tier-chip tier-needs-improvement">${tc.needsImprovement ?? 0} improvement</span>
          <span class="tier-chip tier-unsatisfactory">${tc.unsatisfactory ?? 0} unsat.</span>
          <span class="tier-chip tier-substrate-limited">${tc.substrateLimited ?? 0} substrate-limited</span>
        </div>
      </div>
      <div class="perf-card">
        <div class="perf-card-num" style="color:#2e6b34">${improving}</div>
        <div class="perf-card-lbl">Improving</div>
        <div class="perf-card-sub">trend ↑ vs prior eval</div>
      </div>
      <div class="perf-card">
        <div class="perf-card-num" style="color:${attention > 0 ? "#8b2018" : "inherit"}">${attention}</div>
        <div class="perf-card-lbl">Need attention</div>
        <div class="perf-card-sub">needs-improvement or unsat.</div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Filter logic
  // ---------------------------------------------------------------------------
  let allAgents = [];

  function applyFilters() {
    const period = document.getElementById("filterPeriod")?.value ?? "";
    const tier = document.getElementById("filterTier")?.value ?? "";
    const trend = document.getElementById("filterTrend")?.value ?? "";
    const search = (document.getElementById("filterSearch")?.value ?? "").toLowerCase().trim();

    const filtered = allAgents.filter((agent) => {
      if (!agentMatchesPeriod(agent, period)) return false;
      if (tier && resolveDisplayTier(agent) !== tier) return false;
      if (trend && agent.trend !== trend) return false;
      if (search) {
        const role = agentRole(agent.agentId).toLowerCase();
        const id = agent.agentId.toLowerCase();
        if (!id.includes(search) && !role.includes(search)) return false;
      }
      return true;
    });

    renderTable(filtered);
  }

  // ---------------------------------------------------------------------------
  // Main fetch + render
  // ---------------------------------------------------------------------------
  async function fetchAndRender() {
    const liveDot = document.getElementById("liveDot");
    const lastUp = document.getElementById("lastUpdated");
    const perfSub = document.getElementById("perfSub");
    const banner = document.getElementById("failureBanner");

    try {
      await loadFleetRoles();
      const res = await fetch("/api/performance");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (liveDot) liveDot.classList.add("live");
      if (lastUp) lastUp.textContent = `as of ${(data.asOf ?? "").slice(11, 19)} UTC`;
      if (perfSub)
        perfSub.textContent = `${data.fleetSize ?? 0} agents · ${data.evaluatedToday ?? 0} evaluated today`;
      if (banner) banner.hidden = true;

      allAgents = Array.isArray(data.allAgents) ? data.allAgents : [];

      renderSummary(data);

      // Empty state
      if (allAgents.length === 0) {
        const tbody = document.getElementById("perfTableBody");
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="9">
            <div class="perf-empty">
              <strong>No evaluations yet</strong>
              Emit <code>AgentPerformanceEvaluated</code> events to populate this register.
            </div>
          </td></tr>`;
        }
        document.getElementById("filterCount").textContent = "0 agents";
        return;
      }

      applyFilters();
    } catch (err) {
      if (liveDot) liveDot.classList.remove("live");
      if (lastUp) lastUp.textContent = "error";
      if (banner) {
        banner.hidden = false;
        banner.textContent = `Failed to load performance data: ${err.message}`;
      }
      console.error("[performance]", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Wire up filters + boot
  // ---------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    fetchAndRender();

    for (const id of ["filterPeriod", "filterTier", "filterTrend"]) {
      document.getElementById(id)?.addEventListener("change", applyFilters);
    }
    document.getElementById("filterSearch")?.addEventListener("input", applyFilters);

    // Auto-refresh every 30s
    setInterval(fetchAndRender, 30_000);
  });
})();
