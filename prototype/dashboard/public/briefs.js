// dashboard/public/briefs.js
//
// Briefs / dispatches register page — Phase 2 Block A.
//
// Fetches /api/rms/briefs-dispatches and renders a filterable table with a
// drawer for the full directive markdown + run lifecycle timeline.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09);
//            D-RMS-PHASE-2-4-AUTHORSHIP (Owen + Atlas, 2026-05-16).
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  const $ = (id) => document.getElementById(id);

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtTs(iso) {
    if (!iso || typeof iso !== "string") return "—";
    return iso.replace("T", " ").replace(/\.\d+Z$/, "Z");
  }

  function renderAgent(a) {
    if (!a || typeof a !== "object" || typeof a.name !== "string") return "—";
    return a.position
      ? `${esc(a.name)} <span class="muted small">(${esc(a.position)})</span>`
      : esc(a.name);
  }

  function statusBadge(status) {
    const tone =
      status === "delivered"
        ? "ok"
        : status === "in-flight"
          ? "info"
          : status === "blocked" || status === "superseded"
            ? "warn"
            : "muted";
    return `<span class="status-badge" data-tone="${tone}">${esc(status)}</span>`;
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  /** @type {{ asOf?: string, rows: any[] }} */
  let registerData = { rows: [] };
  let currentStatus = "all";
  let currentAgent = "";
  let currentWorkstream = "";
  let currentSearch = "";

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------

  async function fetchBriefs() {
    const r = await fetch("/api/rms/briefs-dispatches");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return { asOf: data.asOf, rows: Array.isArray(data.rows) ? data.rows : [] };
  }

  // ------------------------------------------------------------------
  // Filters
  // ------------------------------------------------------------------

  function populateFilterOptions(rows) {
    const agents = new Map();
    const workstreams = new Set();
    for (const r of rows) {
      const name = r.issuedTo?.name;
      if (typeof name === "string" && name.length > 0) {
        agents.set(name, r.issuedTo?.position ?? "");
      }
      if (typeof r.workstreamId === "string" && r.workstreamId.length > 0) {
        workstreams.add(r.workstreamId);
      }
    }
    const af = $("agentFilter");
    const prevA = af.value;
    af.innerHTML = '<option value="">All agents</option>';
    for (const [name, position] of [...agents.entries()].sort()) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = position ? `${name} — ${position}` : name;
      af.appendChild(opt);
    }
    af.value = prevA;

    const wf = $("workstreamFilter");
    const prevW = wf.value;
    wf.innerHTML = '<option value="">All workstreams</option>';
    for (const ws of [...workstreams].sort()) {
      const opt = document.createElement("option");
      opt.value = ws;
      opt.textContent = ws;
      wf.appendChild(opt);
    }
    wf.value = prevW;
  }

  function applyFilters(rows) {
    return rows.filter((r) => {
      if (currentStatus !== "all" && r.status !== currentStatus) return false;
      if (currentAgent && r.issuedTo?.name !== currentAgent) return false;
      if (currentWorkstream && r.workstreamId !== currentWorkstream) return false;
      if (currentSearch) {
        const needle = currentSearch.toLowerCase();
        const hay = `${r.briefId ?? ""} ${r.title ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }

  // ------------------------------------------------------------------
  // URL <-> filter sync
  // ------------------------------------------------------------------

  function readUrl() {
    const p = new URLSearchParams(window.location.search);
    currentStatus = p.get("status") || "all";
    currentAgent = p.get("agent") || "";
    currentWorkstream = p.get("workstream") || "";
    currentSearch = p.get("q") || "";
    const r = document.querySelector(`input[name="statusFilter"][value="${currentStatus}"]`);
    if (r) r.checked = true;
    $("searchInput").value = currentSearch;
  }

  function writeUrl() {
    const p = new URLSearchParams();
    if (currentStatus !== "all") p.set("status", currentStatus);
    if (currentAgent) p.set("agent", currentAgent);
    if (currentWorkstream) p.set("workstream", currentWorkstream);
    if (currentSearch) p.set("q", currentSearch);
    const qs = p.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", next);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  function render() {
    const rows = registerData.rows ?? [];
    populateFilterOptions(rows);

    // Sort newest issuedAt first.
    const sorted = [...rows].sort((a, b) => {
      const aA = a.issuedAt ?? "";
      const bA = b.issuedAt ?? "";
      if (aA === bA) return 0;
      return aA < bA ? 1 : -1;
    });
    const visible = applyFilters(sorted);

    const content = $("briefsContent");
    if (visible.length === 0) {
      content.innerHTML = `<p class="muted" style="padding:var(--space-4) 0;">No briefs match the current filters. ${rows.length} total in the register.</p>`;
      return;
    }

    const head = `
      <thead>
        <tr>
          <th>Brief id</th>
          <th>Title</th>
          <th>Issued to</th>
          <th>Issued by</th>
          <th>Workstream</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Issued at</th>
          <th>Expected</th>
          <th>Run id</th>
        </tr>
      </thead>`;

    const body = visible
      .map((r) => {
        const expected = Array.isArray(r.expectedOutputs) ? r.expectedOutputs.length : 0;
        const href = `/briefs/${encodeURIComponent(r.briefId)}`;
        return `<tr data-href="${esc(href)}" style="cursor:pointer;" tabindex="0" role="link" aria-label="Open brief ${esc(r.briefId)}">
          <td><a href="${esc(href)}"><code>${esc(r.briefId)}</code></a></td>
          <td>${esc(r.title)}</td>
          <td>${renderAgent(r.issuedTo)}</td>
          <td>${renderAgent(r.issuedBy)}</td>
          <td>${r.workstreamId ? `<code>${esc(r.workstreamId)}</code>` : "—"}</td>
          <td>${esc(r.priority ?? "")}</td>
          <td>${statusBadge(r.status ?? "")}</td>
          <td class="muted small">${esc(fmtTs(r.issuedAt))}</td>
          <td class="muted small">${expected} expected</td>
          <td>${r.runId ? `<code>${esc(r.runId)}</code>` : "—"}</td>
        </tr>`;
      })
      .join("");

    content.innerHTML = `
      <p class="muted small" style="margin:0 0 var(--space-2);">${visible.length} of ${rows.length} brief${rows.length === 1 ? "" : "s"} shown.</p>
      <div class="table-wrap" style="overflow-x:auto;">
        <table class="rms-table" style="width:100%;border-collapse:collapse;">
          ${head}
          <tbody>${body}</tbody>
        </table>
      </div>`;

    // Wire row navigation — clicking a row (or Enter/Space on it) opens the
    // brief drill-down on its own page. The brief-id cell is also a plain
    // anchor so middle-click / cmd-click opens in a new tab.
    for (const tr of content.querySelectorAll("tr[data-href]")) {
      const href = tr.getAttribute("data-href");
      tr.addEventListener("click", (e) => {
        // Let real clicks on the inner anchor (incl. modifier-clicks) behave
        // natively; only synthesise navigation for clicks elsewhere in the row.
        if (e.target.closest("a")) return;
        window.location.href = href;
      });
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = href;
        }
      });
    }
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  async function refresh() {
    try {
      registerData = await fetchBriefs();
      const lu = $("lastUpdated");
      if (lu) lu.textContent = `as of ${fmtTs(registerData.asOf ?? "")}`;
      render();
    } catch (err) {
      $("briefsContent").innerHTML =
        `<p class="muted" style="color:var(--danger,#c33);">Failed to load briefs: ${esc(String(err))}</p>`;
    }
  }

  function wireFilters() {
    for (const el of document.querySelectorAll('input[name="statusFilter"]')) {
      el.addEventListener("change", () => {
        if (el.checked) {
          currentStatus = el.value;
          writeUrl();
          render();
        }
      });
    }
    $("agentFilter").addEventListener("change", (e) => {
      currentAgent = e.target.value;
      writeUrl();
      render();
    });
    $("workstreamFilter").addEventListener("change", (e) => {
      currentWorkstream = e.target.value;
      writeUrl();
      render();
    });
    $("searchInput").addEventListener("input", (e) => {
      currentSearch = e.target.value;
      writeUrl();
      render();
    });
  }

  function init() {
    readUrl();
    wireFilters();
    refresh();
    // Periodic refresh — 30s.
    setInterval(refresh, 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
