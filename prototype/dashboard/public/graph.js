// graph.js — Regulatory Knowledge Graph dashboard page
//
// Vanilla JS (no framework). Three panels:
//   1. Stats — node/edge counts by type, gap KPIs.
//   2. Gaps  — unimplemented obligations (Principle 2 violations).
//   3. Trace — search an ORG-* ID and render its full chain.
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------

  async function apiFetch(path) {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Stats panel
  // ---------------------------------------------------------------------------

  function renderStats(stats) {
    const body = document.getElementById("statsBody");
    if (!body) return;

    const {
      nodesByType,
      edgesByType,
      totalNodes,
      totalEdges,
      unimplementedCount,
      orphanProcedureCount,
    } = stats;

    const nodeRows = Object.entries(nodesByType)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `<tr><td>${t}</td><td class="num">${n}</td></tr>`)
      .join("");

    const edgeRows = Object.entries(edgesByType)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `<tr><td><code>${t}</code></td><td class="num">${n}</td></tr>`)
      .join("");

    const uClass = unimplementedCount > 0 ? " red" : "";
    const oClass = orphanProcedureCount > 0 ? " red" : "";

    body.innerHTML = `
      <div class="graph-kpi-row">
        <div class="graph-kpi">
          <div class="graph-kpi-num">${totalNodes.toLocaleString()}</div>
          <div class="graph-kpi-lbl">Total nodes</div>
        </div>
        <div class="graph-kpi">
          <div class="graph-kpi-num">${totalEdges.toLocaleString()}</div>
          <div class="graph-kpi-lbl">Total edges</div>
        </div>
        <div class="graph-kpi">
          <div class="graph-kpi-num${uClass}">${unimplementedCount}</div>
          <div class="graph-kpi-lbl">Unimplemented obligations</div>
        </div>
        <div class="graph-kpi">
          <div class="graph-kpi-num${oClass}">${orphanProcedureCount}</div>
          <div class="graph-kpi-lbl">Orphan procedures</div>
        </div>
      </div>
      <div class="graph-stats-grid">
        <div class="graph-stats-section">
          <h4>Nodes by type</h4>
          <table class="graph-table">
            <thead><tr><th>Type</th><th>Count</th></tr></thead>
            <tbody>${nodeRows || '<tr><td colspan="2" style="color:var(--neutral-stone);font-style:italic">none</td></tr>'}</tbody>
          </table>
        </div>
        <div class="graph-stats-section">
          <h4>Edges by type</h4>
          <table class="graph-table">
            <thead><tr><th>Type</th><th>Count</th></tr></thead>
            <tbody>${edgeRows || '<tr><td colspan="2" style="color:var(--neutral-stone);font-style:italic">none</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;

    const sub = document.getElementById("statsSub");
    if (sub) sub.textContent = `${totalNodes} nodes · ${totalEdges} edges`;
  }

  // ---------------------------------------------------------------------------
  // Gap panel (unimplemented obligations)
  // ---------------------------------------------------------------------------

  // Current gap filter state — default: direct + transposed
  let currentGapFilter = "direct,transposed";

  const APPLICABILITY_BADGE_LABELS = {
    direct: { label: "direct", cls: "badge-direct" },
    transposed: { label: "transposed", cls: "badge-transposed" },
    reference: { label: "reference", cls: "badge-reference" },
    monitored: { label: "monitored", cls: "badge-monitored" },
  };

  function applicabilityBadge(status) {
    if (!status) return "";
    const info = APPLICABILITY_BADGE_LABELS[status] || { label: status, cls: "badge-reference" };
    return `<span class="graph-applicability-badge ${info.cls}">${escHtml(info.label)}</span>`;
  }

  async function loadGaps(filter) {
    const list = document.getElementById("gapList");
    const summary = document.getElementById("gapSummary");
    if (!list) return;

    list.innerHTML = '<div class="graph-trace-empty" style="padding:10px 0;">Loading…</div>';
    if (summary) summary.textContent = "";

    try {
      const params = filter ? `?applicability=${encodeURIComponent(filter)}` : "";
      const gapData = await apiFetch(`/api/graph/unimplemented${params}`);
      renderGaps(gapData.nodes || []);
    } catch (e) {
      list.innerHTML = `<div class="graph-trace-empty" style="padding:10px 0;color:#c0392b;">${escHtml(e.message || String(e))}</div>`;
    }
  }

  function renderGaps(nodes) {
    const list = document.getElementById("gapList");
    const summary = document.getElementById("gapSummary");
    if (!list) return;

    if (nodes.length === 0) {
      if (summary) summary.textContent = "No gaps found — all obligations have a closing policy.";
      list.innerHTML =
        '<div class="graph-trace-empty" style="padding:10px 0;">No Principle 2 gaps detected.</div>';
      return;
    }

    if (summary) {
      summary.innerHTML = `<strong style="color:#c0392b">${nodes.length} obligation${nodes.length === 1 ? "" : "s"}</strong> with no fulfilling policy (CLOSES edge missing).`;
    }

    const items = nodes
      .map((node) => {
        const id = node.id.replace(/^OBL-/, "");
        const domain = node.metadata?.domain || node.metadata?.source_instrument || "";
        const label = node.label || "";
        const appStatus = node.metadata?.applicabilityStatus || "";
        return `
        <div class="graph-gap-row">
          <div class="graph-gap-row-head">
            <span class="graph-gap-id">${escHtml(id)}</span>
            ${appStatus ? applicabilityBadge(appStatus) : ""}
          </div>
          ${domain ? `<span class="graph-gap-domain">${escHtml(String(domain))}</span>` : ""}
          <span class="graph-gap-label">${escHtml(label)}</span>
        </div>`;
      })
      .join("");

    list.innerHTML = items;
  }

  function initGapFilter() {
    const btns = document.querySelectorAll("[data-gap-filter]");
    for (const btn of btns) {
      btn.addEventListener("click", async () => {
        const filter = btn.getAttribute("data-gap-filter") || "direct,transposed";
        currentGapFilter = filter;
        // Update active state
        for (const b of btns) b.classList.remove("is-active");
        btn.classList.add("is-active");
        await loadGaps(filter === "all" ? "" : filter);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Trace panel
  // ---------------------------------------------------------------------------

  function renderNodeList(nodes, emptyMsg) {
    if (!nodes || nodes.length === 0) {
      return `<span class="graph-trace-empty">${emptyMsg}</span>`;
    }
    return nodes
      .map((n) => {
        const rawId = n.id;
        // Strip type prefix for display
        const shortId = rawId.replace(/^(OBL|POL|PROC|PROV|RISK|ACT|REG|DOC|CTRL|THRESH)-/, "");
        return `
        <div class="graph-trace-node">
          <span class="graph-trace-node-id">${escHtml(rawId)}</span>
          <span class="graph-trace-node-label">${escHtml(n.label || shortId)}</span>
        </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Regulatory objectives (the "why" layer)
  // ---------------------------------------------------------------------------

  async function loadObjectives() {
    const list = document.getElementById("objectivesList");
    const summary = document.getElementById("objectivesSummary");
    const gapList = document.getElementById("objectiveGapList");
    const gapSummary = document.getElementById("objectiveGapSummary");
    if (!list) return;
    list.innerHTML = '<div class="graph-trace-empty" style="padding:10px 0;">Loading…</div>';
    try {
      const data = await apiFetch("/api/graph/objectives");
      renderObjectives(data.objectives || [], summary, list);
      renderObjectiveGaps(data.coverageGaps || [], gapSummary, gapList);
    } catch (e) {
      list.innerHTML = `<div class="graph-trace-empty" style="padding:10px 0;color:#c0392b;">${escHtml(e.message || String(e))}</div>`;
    }
  }

  function renderObjectives(objectives, summary, list) {
    if (!objectives.length) {
      if (summary) summary.innerHTML = "";
      list.innerHTML =
        '<div class="graph-trace-empty" style="padding:10px 0;">No regulatory objectives seeded yet.</div>';
      return;
    }
    if (summary) {
      summary.innerHTML = `<strong>${objectives.length}</strong> regulatory objective${objectives.length === 1 ? "" : "s"} — the purpose a requirement serves (SARB-PA pilot; other regulators pending backfill).`;
    }
    list.innerHTML = objectives
      .map((o) => {
        const md = o.objective.metadata || {};
        const level = md.objectiveLevel || "objective";
        const regs = (o.regulators || []).map((r) => escHtml(r.label || r.id)).join(", ") || "—";
        const pols = renderNodeList(o.alignedPolicies, "No aligned policy — coverage gap.");
        return `
        <div class="graph-trace-section" style="margin-bottom:14px;">
          <h5>${escHtml(o.objective.label)} <span style="font-weight:400;color:var(--text-secondary);">(${escHtml(level)})</span></h5>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">${escHtml(md.objectiveText || "")}</div>
          <div style="font-size:12px;margin-bottom:4px;"><strong>Pursued by:</strong> ${regs}</div>
          <div style="font-size:12px;margin-bottom:4px;"><strong>Serving requirements (SERVES):</strong> ${o.servingObligationCount}</div>
          <div style="font-size:12px;"><strong>Aligned policies (ALIGNS_TO):</strong></div>
          ${pols}
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">source: ${escHtml(md.sourceCitation || "—")}</div>
        </div>`;
      })
      .join("");
  }

  function renderObjectiveGaps(gaps, summary, list) {
    if (!list) return;
    if (!gaps.length) {
      if (summary)
        summary.innerHTML =
          '<strong style="color:#27ae60">No gaps</strong> — every objective has an aligned policy.';
      list.innerHTML = "";
      return;
    }
    if (summary) {
      summary.innerHTML = `<strong style="color:#c0392b">${gaps.length} objective${gaps.length === 1 ? "" : "s"}</strong> with no aligned policy (ALIGNS_TO edge missing).`;
    }
    list.innerHTML = gaps
      .map(
        (g) => `
        <div class="graph-trace-node">
          <span class="graph-trace-node-id">${escHtml(g.id)}</span>
          <span class="graph-trace-node-label">${escHtml(g.label || "")}</span>
        </div>`,
      )
      .join("");
  }

  function renderTrace(chain) {
    const el = document.getElementById("traceResult");
    if (!el) return;

    const {
      obligation,
      provisions,
      policies,
      procedures,
      riskCategories,
      activities,
      objectives,
      alignedPolicies,
    } = chain;

    // Strip OBL- prefix for readable display
    const oblId = obligation.id.replace(/^OBL-/, "");

    el.innerHTML = `
      <div class="graph-trace-chain">

        <div class="graph-trace-section">
          <h5>Obligation</h5>
          <div class="graph-trace-obligation">
            <div class="id">${escHtml(oblId)}</div>
            <div class="lbl">${escHtml(obligation.label)}</div>
          </div>
        </div>

        <div class="graph-trace-section">
          <h5>Provisions (EXPRESSES)</h5>
          ${renderNodeList(provisions, "No source provisions linked.")}
        </div>

        <div class="graph-trace-arrow">&#x25BC;</div>

        <div class="graph-trace-section">
          <h5>Policies (CLOSES)</h5>
          ${renderNodeList(policies, "No closing policy — Principle 2 gap.")}
        </div>

        <div class="graph-trace-arrow">&#x25BC;</div>

        <div class="graph-trace-section">
          <h5>Procedures (GOVERNS)</h5>
          ${renderNodeList(procedures, "No procedures linked to these policies.")}
        </div>

        <div class="graph-trace-section" style="margin-top:14px;">
          <h5>Risk categories (ADDRESSES)</h5>
          ${renderNodeList(riskCategories, "No risk categories linked.")}
        </div>

        <div class="graph-trace-section">
          <h5>Activities (APPLIES_TO_ACTIVITY)</h5>
          ${renderNodeList(activities, "No activities linked.")}
        </div>

        <div class="graph-trace-section" style="margin-top:14px;">
          <h5>Objectives served (SERVES) — the "why"</h5>
          ${renderNodeList(objectives, "No objective linked — the requirement's purpose is not yet recorded.")}
        </div>

        <div class="graph-trace-section">
          <h5>Policies aligned to those objectives (ALIGNS_TO)</h5>
          ${renderNodeList(alignedPolicies, "No policy aligned to the served objectives.")}
        </div>

      </div>
    `;
  }

  function renderTraceError(msg) {
    const el = document.getElementById("traceResult");
    if (el)
      el.innerHTML = `<div class="graph-empty" style="text-align:left;padding:10px 0;color:#c0392b;">${escHtml(msg)}</div>`;
  }

  // ---------------------------------------------------------------------------
  // Initialise trace search
  // ---------------------------------------------------------------------------

  function initTrace() {
    const input = document.getElementById("traceInput");
    const btn = document.getElementById("traceBtn");
    if (!input || !btn) return;

    async function doTrace() {
      const raw = input.value.trim();
      if (!raw) return;

      // Accept with or without "ORG-" prefix; strip it — the server adds OBL- prefix
      const id = raw.replace(/^OBL-/i, "");

      const result = document.getElementById("traceResult");
      if (result)
        result.innerHTML =
          '<div class="graph-empty" style="text-align:left;padding:8px 0;">Tracing…</div>';

      try {
        const chain = await apiFetch(`/api/graph/trace/${encodeURIComponent(id)}`);
        renderTrace(chain);
      } catch (e) {
        renderTraceError(e.message || String(e));
      }
    }

    btn.addEventListener("click", doTrace);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doTrace();
    });
  }

  // ---------------------------------------------------------------------------
  // Escape HTML
  // ---------------------------------------------------------------------------

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------------------------
  // Page load
  // ---------------------------------------------------------------------------

  async function load() {
    const loading = document.getElementById("graphLoading");
    const panels = document.getElementById("graphPanels");
    const empty = document.getElementById("graphEmpty");

    try {
      // Fetch stats first to decide which state to show
      const stats = await apiFetch("/api/graph/stats");

      if (loading) loading.style.display = "none";

      if (!stats.totalNodes || stats.totalNodes === 0) {
        // Graph not seeded
        if (empty) empty.style.display = "";
        return;
      }

      // Graph has data — show panels
      if (panels) panels.style.display = "";

      renderStats(stats);

      // Fetch unimplemented obligations for gap panel (default: direct+transposed)
      await loadGaps(currentGapFilter);

      // Fetch the regulatory-objective layer (the "why") + coverage gaps
      await loadObjectives();

      // Update last-updated header
      const lu = document.getElementById("lastUpdated");
      if (lu) {
        const now = new Date().toISOString();
        lu.textContent = `as of ${now.slice(0, 16).replace("T", " ")}Z`;
      }
    } catch (e) {
      if (loading) {
        loading.innerHTML = `<div class="graph-empty" style="color:#c0392b;">Failed to load graph data: ${escHtml(e.message || String(e))}</div>`;
      }
    }
  }

  function initRefresh() {
    const btn = document.getElementById("refreshBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.classList.add("is-busy");
      try {
        await load();
      } finally {
        btn.disabled = false;
        btn.classList.remove("is-busy");
      }
    });
    // Expose for _shell.js refresh instrumentation
    window.bankShell = window.bankShell || {};
    window.bankShell.pageReload = load;
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    initTrace();
    initRefresh();
    initGapFilter();
  });
})();
