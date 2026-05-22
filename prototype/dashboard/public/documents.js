// dashboard/public/documents.js
//
// Document register — filterable list with in-page drill-down.
// Mirrors the policies.html navigation pattern: list → detail via hash routing.
//
// Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
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

  function fmtDate(iso) {
    if (!iso) return "—";
    return String(iso).slice(0, 10);
  }

  function hashShort(h) {
    if (typeof h !== "string") return "";
    const colon = h.indexOf(":");
    if (colon === -1) return `${h.slice(0, 14)}…`;
    return `${h.slice(0, colon + 1)}${h.slice(colon + 1, colon + 13)}…`;
  }

  function rowTitle(r) {
    return r.metadata?.title || r.recordId || hashShort(r.documentHash);
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
    return `<span class="status-badge" data-tone="${tone}">${esc(classification || "—")}</span>`;
  }

  function registeredBadge(registered) {
    return registered
      ? `<span class="status-badge" data-tone="ok">RecordFiled</span>`
      : `<span class="status-badge" data-tone="muted">cited only</span>`;
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

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

  async function fetchDocBody(hash) {
    if (!hash) return "";
    try {
      const r = await fetch(`/api/rms/document-content?hash=${encodeURIComponent(hash)}`);
      if (!r.ok) return `(document not resolvable — HTTP ${r.status})`;
      return await r.text();
    } catch (err) {
      return `(document fetch error: ${esc(String(err))})`;
    }
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
        const hay = [
          r.documentHash ?? "",
          r.recordId ?? "",
          r.metadata?.path ?? "",
          r.metadata?.title ?? "",
          r.metadata?.author ?? "",
          r.metadata?.category ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }

  // ------------------------------------------------------------------
  // URL / filter sync
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

  function writeFilterUrl() {
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
  // List render
  // ------------------------------------------------------------------

  function render() {
    const rows = registerData.rows ?? [];
    const sorted = [...rows].sort((a, b) => {
      const aT = a.metadata?.date || a.firstSeenAt || "";
      const bT = b.metadata?.date || b.firstSeenAt || "";
      if (aT === bT) return 0;
      return aT < bT ? 1 : -1;
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
          <th>Title</th>
          <th>Category</th>
          <th>Author</th>
          <th>Date</th>
          <th>Classification</th>
          <th>Register</th>
          <th>Filed</th>
        </tr>
      </thead>`;

    const body = visible
      .map((r) => {
        const title = rowTitle(r);
        const category = r.metadata?.category || "—";
        const author = r.metadata?.author || "—";
        const date = fmtDate(r.metadata?.date) || fmtDate(r.firstSeenAt) || "—";
        return `<tr
          data-hash="${esc(r.documentHash)}"
          style="cursor:pointer;"
          tabindex="0"
          role="button"
          aria-label="Open document ${esc(title)}"
        >
          <td>
            <span class="pol-name" style="font-weight:500">${esc(title)}</span>
            ${r.metadata?.path ? `<div class="muted small" style="font-size:11px;margin-top:2px;font-family:var(--font-mono,monospace)">${esc(r.metadata.path)}</div>` : ""}
          </td>
          <td class="muted small">${esc(category)}</td>
          <td class="muted small">${esc(author)}</td>
          <td class="muted small">${esc(date)}</td>
          <td>${classBadge(r.classification ?? "")}</td>
          <td>${r.registerKey ? `<code class="small">${esc(r.registerKey)}</code>` : '<span class="muted small">(unregistered)</span>'}</td>
          <td>${registeredBadge(r.registered)}</td>
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
      tr.addEventListener("click", () => navigateTo(tr.getAttribute("data-hash")));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateTo(tr.getAttribute("data-hash"));
        }
      });
    }
  }

  // ------------------------------------------------------------------
  // Navigation — list <-> detail
  // ------------------------------------------------------------------

  function showList() {
    $("doc-list").classList.remove("hidden");
    $("doc-detail").classList.remove("visible");
    document.title = "Documents — Scrooge Bank";
  }

  async function showDetail(row) {
    $("doc-list").classList.add("hidden");
    $("doc-detail").classList.add("visible");

    const title = rowTitle(row);
    document.title = `${title} — Documents — Scrooge Bank`;

    $("doc-bc-name").textContent = title;
    const eyebrowParts = [...new Set([row.metadata?.category, row.registerKey].filter(Boolean))];
    $("doc-d-eyebrow").textContent = eyebrowParts.join(" · ").toUpperCase() || "DOCUMENT";
    $("doc-d-title").textContent = title;

    $("doc-d-pills").innerHTML = [
      classBadge(row.classification ?? ""),
      registeredBadge(row.registered),
      row.supersededBy ? `<span class="status-badge" data-tone="warn">superseded</span>` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const metaItems = [
      ["Hash", `<code>${esc(row.documentHash)}</code>`],
      ["Record ID", row.recordId ? `<code>${esc(row.recordId)}</code>` : "—"],
      ["Register", row.registerKey ? `<code>${esc(row.registerKey)}</code>` : "(unregistered)"],
      ["Author", esc(row.metadata?.author || "—")],
      ["Date", esc(fmtDate(row.metadata?.date) || "—")],
      ["Category", esc(row.metadata?.category || "—")],
      ["First seen", esc(fmtTs(row.firstSeenAt))],
      [
        "Cited by",
        `${Array.isArray(row.referencedByEventIds) ? row.referencedByEventIds.length : 0} events`,
      ],
    ];
    $("doc-d-meta").innerHTML = metaItems
      .map(
        ([label, val]) =>
          `<div class="doc-meta-item">
            <span class="doc-meta-label">${esc(label)}</span>
            <span class="doc-meta-value">${val}</span>
          </div>`,
      )
      .join("");

    $("doc-d-body").innerHTML = `<p class="muted">Loading…</p>`;

    window.scrollTo(0, 0);

    const body = await fetchDocBody(row.documentHash);
    const size = new TextEncoder().encode(body).length;
    $("doc-d-body").innerHTML = `
      <div class="muted small" style="margin-bottom:var(--space-2);">${esc(size)} bytes · hash: <code style="font-size:11px">${esc(row.documentHash)}</code></div>
      <pre class="doc-body-pre">${esc(body)}</pre>`;

    const retention = row.retention;
    $("doc-d-retention").innerHTML = retention
      ? `<dl class="doc-kv">
          <dt>Citation</dt><dd><code>${esc(retention.citationRef)}</code></dd>
          <dt>Minimum years</dt><dd>${esc(String(retention.minimumYears))}</dd>
          <dt>Archival tier</dt><dd>${esc(retention.archivalTier)}</dd>
        </dl>`
      : `<p class="muted small">No <code>RecordFiled</code> event for this hash — falls under <code>agent-internal</code> default (Banks Act §60 5y).</p>`;

    $("doc-d-supersession").innerHTML = `
      <dt>Supersedes</dt>
      <dd>${row.supersedes ? `<code>${esc(row.supersedes)}</code>` : "—"}</dd>
      <dt>Superseded by</dt>
      <dd>${row.supersededBy ? `<code>${esc(row.supersededBy)}</code>` : "—"}</dd>`;

    const eventIds = Array.isArray(row.referencedByEventIds) ? row.referencedByEventIds : [];
    $("doc-d-events").innerHTML = eventIds.length
      ? eventIds.map((id) => `<li><code>${esc(id)}</code></li>`).join("")
      : `<li class="muted small" style="list-style:none;padding:var(--space-2) 0;">No citing events recorded.</li>`;
    $("doc-d-events-section").querySelector("h3").textContent =
      `Citing events (${eventIds.length})`;
  }

  function navigateTo(hash, push = true) {
    const row = (registerData.rows ?? []).find((r) => r.documentHash === hash);
    if (!row) return;
    if (push) history.pushState({ docHash: hash }, "", `#${encodeURIComponent(hash)}`);
    showDetail(row);
  }

  function navigateBack(push = true) {
    if (push) history.pushState({}, "", location.pathname + (location.search || ""));
    showList();
    render();
  }

  // ------------------------------------------------------------------
  // Filter wiring
  // ------------------------------------------------------------------

  function wireFilters() {
    for (const el of document.querySelectorAll('input[name="classFilter"]')) {
      el.addEventListener("change", () => {
        if (el.checked) {
          currentClassification = el.value;
          writeFilterUrl();
          render();
        }
      });
    }
    for (const el of document.querySelectorAll('input[name="registeredFilter"]')) {
      el.addEventListener("change", () => {
        if (el.checked) {
          currentRegistered = el.value;
          writeFilterUrl();
          render();
        }
      });
    }
    $("registerFilter").addEventListener("change", (e) => {
      currentRegister = e.target.value;
      writeFilterUrl();
      render();
    });
    $("searchInput").addEventListener("input", (e) => {
      currentSearch = e.target.value;
      writeFilterUrl();
      render();
    });

    $("doc-bc-back").addEventListener("click", (e) => {
      e.preventDefault();
      navigateBack();
    });

    window.addEventListener("popstate", () => {
      const hash = decodeURIComponent(location.hash.slice(1));
      if (hash) navigateTo(hash, false);
      else navigateBack(false);
    });
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  async function load() {
    try {
      registerData = await fetchDocuments();
      const lu = $("lastUpdated");
      if (lu) lu.textContent = `as of ${fmtTs(registerData.asOf ?? "")}`;

      render();

      const initHash = decodeURIComponent(location.hash.slice(1));
      if (initHash) navigateTo(initHash, false);
    } catch (err) {
      $("documentsContent").innerHTML =
        `<p class="muted" style="color:var(--danger,#c33);">Failed to load documents: ${esc(String(err))}</p>`;
    }
  }

  function init() {
    readUrl();
    wireFilters();
    load();
    setInterval(load, 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
