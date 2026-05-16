// dashboard/public/documents.js
//
// Document register page — RMS Phase 2 Block B.
//
// Fetches /api/rms/document and renders a filterable table with a drawer
// for full hash + rendered markdown preview + retention citation +
// supersession chain + the union of citing event_ids.
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

  function hashShort(h) {
    if (typeof h !== "string") return "";
    const colon = h.indexOf(":");
    if (colon === -1) return `${h.slice(0, 14)}…`;
    return `${h.slice(0, colon + 1)}${h.slice(colon + 1, colon + 13)}…`;
  }

  function classBadge(classification) {
    const tone =
      classification === "ceo-only"
        ? "warn"
        : classification === "governance-seat"
          ? "info"
          : classification === "public-disclosure"
            ? "ok"
            : "muted";
    return `<span class="status-badge" data-tone="${tone}">${esc(classification)}</span>`;
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  /** @type {{ asOf?: string, rows: any[] }} */
  let registerData = { rows: [] };
  let currentClassification = "all";
  let currentRegister = "";
  let currentRegistered = "all";
  let currentSearch = "";

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------

  async function fetchDocuments() {
    const r = await fetch("/api/rms/document");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return { asOf: data.asOf, rows: Array.isArray(data.rows) ? data.rows : [] };
  }

  // ------------------------------------------------------------------
  // Filters
  // ------------------------------------------------------------------

  function applyFilters(rows) {
    return rows.filter((r) => {
      if (currentClassification !== "all" && r.classification !== currentClassification)
        return false;
      if (currentRegister === "__unregistered__") {
        if (r.registered) return false;
      } else if (currentRegister && r.registerKey !== currentRegister) {
        return false;
      }
      if (currentRegistered === "registered" && !r.registered) return false;
      if (currentRegistered === "unregistered" && r.registered) return false;
      if (currentSearch) {
        const needle = currentSearch.toLowerCase();
        const hay =
          `${r.documentHash ?? ""} ${r.recordId ?? ""} ${r.metadata?.path ?? ""} ${r.metadata?.title ?? ""}`.toLowerCase();
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
    currentClassification = p.get("classification") || "all";
    currentRegister = p.get("register") || "";
    currentRegistered = p.get("registered") || "all";
    currentSearch = p.get("q") || "";
    const cls = document.querySelector(
      `input[name="classFilter"][value="${currentClassification}"]`,
    );
    if (cls) cls.checked = true;
    const reg = document.querySelector(
      `input[name="registeredFilter"][value="${currentRegistered}"]`,
    );
    if (reg) reg.checked = true;
    $("registerFilter").value = currentRegister;
    $("searchInput").value = currentSearch;
  }

  function writeUrl() {
    const p = new URLSearchParams();
    if (currentClassification !== "all") p.set("classification", currentClassification);
    if (currentRegister) p.set("register", currentRegister);
    if (currentRegistered !== "all") p.set("registered", currentRegistered);
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
    // Sort newest firstSeenAt first.
    const sorted = [...rows].sort((a, b) => {
      const aA = a.firstSeenAt ?? "";
      const bA = b.firstSeenAt ?? "";
      if (aA === bA) return 0;
      return aA < bA ? 1 : -1;
    });
    const visible = applyFilters(sorted);

    const content = $("documentsContent");
    if (visible.length === 0) {
      content.innerHTML = `<p class="muted" style="padding:var(--space-4) 0;">No documents match the current filters. ${rows.length} total in the register.</p>`;
      return;
    }

    const head = `
      <thead>
        <tr>
          <th>Hash</th>
          <th>Classification</th>
          <th>Register</th>
          <th>Record id</th>
          <th>First seen</th>
          <th>First by</th>
          <th>Cited by</th>
          <th>Superseded by</th>
        </tr>
      </thead>`;

    const body = visible
      .map((r) => {
        return `<tr data-hash="${esc(r.documentHash)}" style="cursor:pointer;" tabindex="0" role="button" aria-label="Open document ${esc(hashShort(r.documentHash))}">
          <td><code title="${esc(r.documentHash)}">${esc(hashShort(r.documentHash))}</code></td>
          <td>${classBadge(r.classification ?? "")}</td>
          <td>${r.registerKey ? `<code>${esc(r.registerKey)}</code>` : '<span class="muted small">(unregistered)</span>'}</td>
          <td>${r.recordId ? `<code class="small">${esc(r.recordId)}</code>` : "—"}</td>
          <td class="muted small">${esc(fmtTs(r.firstSeenAt))}</td>
          <td class="muted small"><code>${esc(r.firstReferencedByEventType ?? "")}</code></td>
          <td class="muted small">${Array.isArray(r.referencedByEventIds) ? r.referencedByEventIds.length : 0}</td>
          <td>${r.supersededBy ? `<code class="small">${esc(r.supersededBy)}</code>` : "—"}</td>
        </tr>`;
      })
      .join("");

    content.innerHTML = `
      <p class="muted small" style="margin:0 0 var(--space-2);">${visible.length} of ${rows.length} document${rows.length === 1 ? "" : "s"} shown.</p>
      <div class="table-wrap" style="overflow-x:auto;">
        <table class="rms-table" style="width:100%;border-collapse:collapse;">
          ${head}
          <tbody>${body}</tbody>
        </table>
      </div>`;

    for (const tr of content.querySelectorAll("tr[data-hash]")) {
      tr.addEventListener("click", () => openDrawer(tr.getAttribute("data-hash")));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDrawer(tr.getAttribute("data-hash"));
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

  async function openDrawer(hash) {
    if (!hash) return;
    const row = registerData.rows.find((r) => r.documentHash === hash);
    if (!row) return;

    const titleText = row.metadata?.title || row.recordId || hashShort(hash);
    $("drawerTitle").textContent = titleText;
    $("drawerMeta").innerHTML = `
      ${classBadge(row.classification ?? "")} ·
      ${row.registerKey ? `<code>${esc(row.registerKey)}</code>` : '<span class="muted">(unregistered)</span>'} ·
      first seen ${esc(fmtTs(row.firstSeenAt))}
    `;
    $("drawerBody").innerHTML = '<p class="muted">Loading document body…</p>';
    $("docDrawer").hidden = false;

    const body = await fetchDoc(hash);
    const size = new TextEncoder().encode(body).length;

    const retentionHtml = row.retention
      ? `<dl class="kv">
          <dt>Citation</dt><dd><code>${esc(row.retention.citationRef)}</code></dd>
          <dt>Minimum years</dt><dd>${esc(row.retention.minimumYears)}</dd>
          <dt>Tier</dt><dd>${esc(row.retention.archivalTier)}</dd>
        </dl>`
      : '<p class="muted small">No <code>RecordFiled</code> event has registered this hash yet — falls under <code>agent-internal</code> default retention (Banks Act §60 5y).</p>';

    const supersessionHtml = `
      <dl class="kv">
        <dt>Supersedes</dt><dd>${row.supersedes ? `<code>${esc(row.supersedes)}</code>` : "—"}</dd>
        <dt>Superseded by</dt><dd>${row.supersededBy ? `<code>${esc(row.supersededBy)}</code>` : "—"}</dd>
      </dl>`;

    const eventsList = Array.isArray(row.referencedByEventIds)
      ? row.referencedByEventIds
          .map((id) => `<li><code class="small">${esc(id)}</code></li>`)
          .join("")
      : "";

    const metadataHtml = row.metadata
      ? `<dl class="kv">
          <dt>Title</dt><dd>${esc(row.metadata.title)}</dd>
          <dt>Path</dt><dd><code class="small">${esc(row.metadata.path)}</code></dd>
          <dt>Category</dt><dd>${esc(row.metadata.category)}</dd>
          ${row.metadata.author ? `<dt>Author</dt><dd>${esc(row.metadata.author)}</dd>` : ""}
          ${row.metadata.date ? `<dt>Date</dt><dd>${esc(row.metadata.date)}</dd>` : ""}
        </dl>`
      : '<p class="muted small">No metadata on the <code>RecordFiled</code> envelope.</p>';

    const bodyHtml = `<pre style="white-space:pre-wrap;background:var(--surface-2,#f6f6f6);padding:var(--space-3);border-radius:4px;max-height:420px;overflow:auto;font-size:0.85rem;border:1px solid var(--border);">${esc(body)}</pre>`;

    $("drawerBody").innerHTML = `
      <section style="margin-bottom:var(--space-4);">
        <h3 style="margin:0 0 var(--space-2);font-size:0.95rem;">Document</h3>
        <div class="muted small" style="margin-bottom:var(--space-1);">hash: <code>${esc(hash)}</code> · ${esc(size)} bytes</div>
        ${bodyHtml}
      </section>
      <section style="margin-bottom:var(--space-4);">
        <h3 style="margin:0 0 var(--space-2);font-size:0.95rem;">Retention</h3>
        ${retentionHtml}
      </section>
      <section style="margin-bottom:var(--space-4);">
        <h3 style="margin:0 0 var(--space-2);font-size:0.95rem;">Supersession chain</h3>
        ${supersessionHtml}
      </section>
      <section style="margin-bottom:var(--space-4);">
        <h3 style="margin:0 0 var(--space-2);font-size:0.95rem;">Metadata</h3>
        ${metadataHtml}
      </section>
      <section>
        <h3 style="margin:0 0 var(--space-2);font-size:0.95rem;">Citing events (${Array.isArray(row.referencedByEventIds) ? row.referencedByEventIds.length : 0})</h3>
        <ul style="margin:0;padding-left:var(--space-4);max-height:200px;overflow:auto;">${eventsList}</ul>
      </section>
    `;
  }

  function closeDrawer() {
    $("docDrawer").hidden = true;
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  async function refresh() {
    try {
      registerData = await fetchDocuments();
      const lu = $("lastUpdated");
      if (lu) lu.textContent = `as of ${fmtTs(registerData.asOf ?? "")}`;
      render();
    } catch (err) {
      $("documentsContent").innerHTML =
        `<p class="muted" style="color:var(--danger,#c33);">Failed to load documents: ${esc(String(err))}</p>`;
    }
  }

  function wireFilters() {
    for (const el of document.querySelectorAll('input[name="classFilter"]')) {
      el.addEventListener("change", () => {
        if (el.checked) {
          currentClassification = el.value;
          writeUrl();
          render();
        }
      });
    }
    for (const el of document.querySelectorAll('input[name="registeredFilter"]')) {
      el.addEventListener("change", () => {
        if (el.checked) {
          currentRegistered = el.value;
          writeUrl();
          render();
        }
      });
    }
    $("registerFilter").addEventListener("change", (e) => {
      currentRegister = e.target.value;
      writeUrl();
      render();
    });
    $("searchInput").addEventListener("input", (e) => {
      currentSearch = e.target.value;
      writeUrl();
      render();
    });
    $("drawerClose").addEventListener("click", closeDrawer);
    $("docDrawer").addEventListener("click", (e) => {
      if (e.target === $("docDrawer")) closeDrawer();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("docDrawer").hidden) closeDrawer();
    });
  }

  function init() {
    readUrl();
    wireFilters();
    refresh();
    setInterval(refresh, 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
