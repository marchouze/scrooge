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

  function hashShort(h) {
    if (typeof h !== "string") return "";
    const colon = h.indexOf(":");
    if (colon === -1) return `${h.slice(0, 14)}…`;
    return `${h.slice(0, colon + 1)}${h.slice(colon + 1, colon + 13)}…`;
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
        return `<tr data-brief-id="${esc(r.briefId)}" style="cursor:pointer;" tabindex="0" role="button" aria-label="Open brief ${esc(r.briefId)}">
          <td><code>${esc(r.briefId)}</code></td>
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

    // Wire row clicks.
    for (const tr of content.querySelectorAll("tr[data-brief-id]")) {
      tr.addEventListener("click", () => openDrawer(tr.getAttribute("data-brief-id")));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDrawer(tr.getAttribute("data-brief-id"));
        }
      });
    }
  }

  // ------------------------------------------------------------------
  // Detail drawer
  // ------------------------------------------------------------------

  async function fetchDoc(hash) {
    if (!hash) return "";
    try {
      const r = await fetch(`/api/rms/document-content?hash=${encodeURIComponent(hash)}`);
      if (!r.ok) return `(document not resolvable — HTTP ${r.status})`;
      return await r.text();
    } catch (err) {
      return `(document fetch error: ${esc(String(err))})`;
    }
  }

  async function fetchAgentRuns() {
    try {
      const r = await fetch("/api/rms/agent-runs");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data.rows) ? data.rows : [];
    } catch (_) {
      return [];
    }
  }

  async function openDrawer(briefId) {
    if (!briefId) return;
    const row = registerData.rows.find((r) => r.briefId === briefId);
    if (!row) return;

    $("drawerTitle").textContent = row.title || briefId;
    $("drawerMeta").innerHTML = `
      <code>${esc(briefId)}</code> ·
      ${esc(row.status ?? "")} ·
      ${row.workstreamId ? `workstream <code>${esc(row.workstreamId)}</code>` : "no workstream"} ·
      issued ${esc(fmtTs(row.issuedAt))}
    `;
    $("drawerBody").innerHTML = '<p class="muted">Loading directive + run timeline…</p>';
    $("briefDrawer").hidden = false;

    const [directive, allRuns] = await Promise.all([
      fetchDoc(row.directiveDocumentHash),
      fetchAgentRuns(),
    ]);
    const myRuns = allRuns.filter((r) => r.briefId === briefId);

    const expectedHtml =
      Array.isArray(row.expectedOutputs) && row.expectedOutputs.length > 0
        ? `<ul style="margin:var(--space-2) 0;padding-left:var(--space-4);">${row.expectedOutputs
            .map((eo) => `<li><strong>${esc(eo.kind)}</strong> — ${esc(eo.description)}</li>`)
            .join("")}</ul>`
        : '<p class="muted">none declared</p>';

    const runsHtml =
      myRuns.length === 0
        ? '<p class="muted">No agent runs recorded yet — brief still in <code>issued</code> state.</p>'
        : myRuns
            .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
            .map((r) => {
              const deliverables =
                Array.isArray(r.deliverableHashes) && r.deliverableHashes.length > 0
                  ? `<ul style="margin:var(--space-1) 0;padding-left:var(--space-4);">${r.deliverableHashes
                      .map(
                        (h) =>
                          `<li><a href="/api/rms/document-content?hash=${encodeURIComponent(h)}" target="_blank" rel="noopener"><code>${esc(hashShort(h))}</code></a></li>`,
                      )
                      .join("")}</ul>`
                  : '<p class="muted small" style="margin:var(--space-1) 0;">No deliverable hashes recorded.</p>';
              return `<li style="margin-bottom:var(--space-3);">
                <div><code>${esc(r.runId)}</code> · ${esc(r.outcome ?? "in-flight")} · ${esc(r.substrate ?? "")}</div>
                <div class="muted small">started ${esc(fmtTs(r.startedAt))}${r.completedAt ? ` · completed ${esc(fmtTs(r.completedAt))}` : ""}</div>
                ${deliverables}
              </li>`;
            })
            .join("");

    const directiveHtml = `<pre style="white-space:pre-wrap;background:var(--surface-2,#f6f6f6);padding:var(--space-3);border-radius:4px;max-height:360px;overflow:auto;font-size:0.85rem;border:1px solid var(--border);">${esc(directive)}</pre>`;

    $("drawerBody").innerHTML = `
      <section style="margin-bottom:var(--space-4);">
        <h3 style="margin:0 0 var(--space-2);font-size:0.95rem;">Directive</h3>
        <div class="muted small" style="margin-bottom:var(--space-1);">document hash: <code>${esc(row.directiveDocumentHash)}</code></div>
        ${directiveHtml}
      </section>
      <section style="margin-bottom:var(--space-4);">
        <h3 style="margin:0 0 var(--space-2);font-size:0.95rem;">Expected outputs</h3>
        ${expectedHtml}
      </section>
      <section>
        <h3 style="margin:0 0 var(--space-2);font-size:0.95rem;">Run lifecycle</h3>
        <ul style="margin:0;padding-left:var(--space-4);">${runsHtml}</ul>
      </section>
    `;
  }

  function closeDrawer() {
    $("briefDrawer").hidden = true;
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
    $("drawerClose").addEventListener("click", closeDrawer);
    $("briefDrawer").addEventListener("click", (e) => {
      if (e.target === $("briefDrawer")) closeDrawer();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("briefDrawer").hidden) closeDrawer();
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
