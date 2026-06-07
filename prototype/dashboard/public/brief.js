// dashboard/public/brief.js
//
// Brief drill-down view — RMS Phase 2 Block A. Reads the briefId from the URL
// path (`/briefs/<encoded-id>`) and renders the directive markdown, expected
// outputs and the run lifecycle (AgentRunStarted → AgentRunCompleted) as a
// full page. Replaces the in-page drawer the briefs register used to open.
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

  function briefIdFromPath() {
    // /briefs/<encoded-id>
    const m = window.location.pathname.match(/^\/briefs\/(.+)$/);
    if (!m || !m[1]) return null;
    return decodeURIComponent(m[1]);
  }

  function renderBreadcrumbs(briefId, title) {
    const nav = $("briefBreadcrumbs");
    if (!nav) return;
    const leaf = title ? `${esc(briefId)} — ${esc(title)}` : esc(briefId ?? "(unknown)");
    nav.innerHTML = `
      <a href="/">Home</a>
      <span class="sep">›</span>
      <a href="/briefs">Briefs / dispatches</a>
      <span class="sep">›</span>
      <span class="leaf">${leaf}</span>`;
  }

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------

  async function fetchBrief(briefId) {
    const r = await fetch("/api/rms/briefs-dispatches", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return rows.find((x) => x.briefId === briefId) ?? null;
  }

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

  async function fetchAgentRuns(briefId) {
    try {
      const r = await fetch("/api/rms/agent-runs", { cache: "no-store" });
      if (!r.ok) return [];
      const data = await r.json();
      const rows = Array.isArray(data.rows) ? data.rows : [];
      return rows.filter((x) => x.briefId === briefId);
    } catch (_) {
      return [];
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  function renderNotFound(briefId) {
    renderBreadcrumbs(briefId ?? "(unknown)", null);
    $("briefContent").innerHTML = `
      <h1 class="brief-title">Brief not found</h1>
      <p class="muted">No matching record for <code>${esc(briefId ?? "(no id)")}</code> in the
      briefs / dispatches register. Browse the
      <a href="/briefs">Briefs / dispatches register</a>.</p>`;
  }

  function metaRow(row) {
    const bits = [
      `<code>${esc(row.briefId)}</code>`,
      statusBadge(row.status ?? ""),
      row.priority ? `<span class="pill">${esc(row.priority)}</span>` : "",
      row.workstreamId ? `workstream <code>${esc(row.workstreamId)}</code>` : "no workstream",
      `issued ${esc(fmtTs(row.issuedAt))}`,
    ].filter(Boolean);
    return `<div class="brief-meta-strip">${bits.join('<span class="sep">·</span>')}</div>`;
  }

  function renderRow(row, directive, runs) {
    const expectedHtml =
      Array.isArray(row.expectedOutputs) && row.expectedOutputs.length > 0
        ? `<ul style="margin:0;padding-left:var(--space-4);">${row.expectedOutputs
            .map((eo) => `<li><strong>${esc(eo.kind)}</strong> — ${esc(eo.description)}</li>`)
            .join("")}</ul>`
        : '<p class="muted">none declared</p>';

    const runsHtml =
      runs.length === 0
        ? '<p class="muted">No agent runs recorded yet — brief still in <code>issued</code> state.</p>'
        : `<ul class="runs-list">${runs
            .slice()
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
              return `<li>
                <div><code>${esc(r.runId)}</code> · ${esc(r.outcome ?? "in-flight")} · ${esc(r.substrate ?? "")}</div>
                <div class="muted small">started ${esc(fmtTs(r.startedAt))}${r.completedAt ? ` · completed ${esc(fmtTs(r.completedAt))}` : ""}</div>
                ${deliverables}
              </li>`;
            })
            .join("")}</ul>`;

    $("briefContent").innerHTML = `
      <h1 class="brief-title">${esc(row.title || row.briefId)}</h1>
      ${metaRow(row)}

      <section class="band">
        <h2>Dispatch</h2>
        <div class="drill-card">
          <div class="kv-grid">
            <div class="kv-label">Issued to</div><div>${renderAgent(row.issuedTo)}</div>
            <div class="kv-label">Issued by</div><div>${renderAgent(row.issuedBy)}</div>
            <div class="kv-label">Run id</div><div>${row.runId ? `<code>${esc(row.runId)}</code>` : "—"}</div>
          </div>
        </div>
      </section>

      <section class="band">
        <h2>Directive</h2>
        <div class="muted small" style="margin-bottom:var(--space-1);">document hash: <code>${esc(row.directiveDocumentHash ?? "—")}</code></div>
        <pre class="directive-pre">${esc(directive)}</pre>
      </section>

      <section class="band">
        <h2>Expected outputs</h2>
        <div class="drill-card">${expectedHtml}</div>
      </section>

      <section class="band">
        <h2>Run lifecycle</h2>
        <div class="drill-card">${runsHtml}</div>
      </section>`;
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  async function load() {
    const briefId = briefIdFromPath();
    if (!briefId) {
      renderNotFound(null);
      return;
    }
    try {
      const row = await fetchBrief(briefId);
      if (!row) {
        renderNotFound(briefId);
        return;
      }
      renderBreadcrumbs(row.briefId, row.title);
      const [directive, runs] = await Promise.all([
        fetchDoc(row.directiveDocumentHash),
        fetchAgentRuns(briefId),
      ]);
      renderRow(row, directive, runs);
    } catch (err) {
      $("briefContent").innerHTML =
        `<p class="muted" style="color:var(--color-danger,#c33);">Failed to load brief: ${esc(String(err))}</p>`;
    }
  }

  load();
  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(load, 30_000);
  } else {
    setInterval(load, 30_000);
  }
})();
