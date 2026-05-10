// rms.js — RMS register hub + per-register table view.
//
// RMS Phase 1 Slice 4 — dashboard register render (dual-render).
// Spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
// Authority: D-RMS-PHASE-1-SLICE-4 under standing D-RMS-PHASE-1.
//
// Reads `?register=<key>` from the URL to choose between the launcher
// (no query param — show all seven register tiles + counts) and the
// per-register table view (?register=<key> — show that register's rows
// in its row-helper sort order).
//
// Author: Anya (Data / analytics engineer, engineering)

(() => {
  // ---------------- Per-register column definitions ------------
  //
  // Each register's table renders a fixed set of columns derived from the
  // register's row shape (per spec §6 + Slice 3 typed projections at
  // `prototype/platform/rms-registers/`). Column order matches the spec's
  // "What good looks like" table in the Slice 4 decision record.
  //
  // Each column declares a `key` (used to read the field from the row)
  // and a `label` (header text). Optional `format` post-processes the
  // value into a display string; the renderer escapes the result.

  const HASH_DISPLAY = (h) => {
    if (typeof h !== "string" || h.length < 16) return h ?? "";
    // blake3:abcdef… → "blake3:abcdef…0123" (first 16 chars after prefix)
    const colonIdx = h.indexOf(":");
    if (colonIdx === -1) return `${h.slice(0, 12)}…`;
    return `${h.slice(0, colonIdx + 1)}${h.slice(colonIdx + 1, colonIdx + 13)}…`;
  };

  const AGENT_DISPLAY = (a) => {
    if (!a || typeof a !== "object") return "";
    // RmsAgentRef shape: { name, position }. FeedbackPayload.from shape:
    // { actor, identity, agent? }. Render whichever shape matches.
    if (typeof a.name === "string") {
      const position = a.position ?? "";
      return position ? `${a.name} (${position})` : a.name;
    }
    if (typeof a.actor === "string") {
      return a.identity ? `${a.actor} <${a.identity}>` : a.actor;
    }
    return "";
  };

  const ARRAY_LEN = (v) => (Array.isArray(v) ? String(v.length) : "0");
  const TS_DISPLAY = (v) =>
    typeof v === "string" ? v.replace("T", " ").replace(/\.\d+Z$/, "Z") : "";
  const RECOMMENDATION_STANCE = (r) => (r && typeof r === "object" ? (r.stance ?? "") : "");
  const RETENTION_POLICY = (r) => {
    if (!r || typeof r !== "object") return "";
    // RecordFiledPayload.retention shape: { citationRef, minimumYears, archivalTier }
    const parts = [];
    if (r.citationRef) parts.push(String(r.citationRef));
    if (r.minimumYears !== undefined && r.minimumYears !== null) parts.push(`${r.minimumYears}y`);
    if (r.archivalTier) parts.push(String(r.archivalTier));
    return parts.join(" · ");
  };
  const CLASSIFICATIONS_DISPLAY = (cs) => (Array.isArray(cs) ? cs.join(", ") : "");
  const ROUTED_TO_DISPLAY = (rt) => (Array.isArray(rt) ? rt.map(AGENT_DISPLAY).join("; ") : "");

  const COLUMNS = {
    decisions: [
      { key: "decisionId", label: "Decision id" },
      { key: "title", label: "Title" },
      { key: "category", label: "Category" },
      { key: "forActor", label: "For" },
      { key: "recommendation", label: "Recommendation", format: RECOMMENDATION_STANCE },
      { key: "status", label: "Status", isStatus: true },
      { key: "resolvedAt", label: "Resolved at", format: TS_DISPLAY },
      { key: "requestEventId", label: "Request event_id" },
    ],
    correspondence: [
      { key: "correspondenceId", label: "Correspondence id" },
      { key: "documentHash", label: "Document hash", format: HASH_DISPLAY },
      { key: "classification", label: "Classification" },
      { key: "retention", label: "Retention", format: RETENTION_POLICY },
      { key: "correspondenceAt", label: "At", format: TS_DISPLAY },
      { key: "supersedes", label: "Supersedes" },
      { key: "supersededBy", label: "Superseded by" },
    ],
    "agent-runs": [
      { key: "runId", label: "Run id" },
      { key: "agent", label: "Agent", format: AGENT_DISPLAY },
      { key: "briefId", label: "Brief id" },
      { key: "outcome", label: "Outcome", isStatus: true },
      { key: "startedAt", label: "Started at", format: TS_DISPLAY },
      { key: "completedAt", label: "Completed at", format: TS_DISPLAY },
      { key: "worktree", label: "Worktree" },
      { key: "briefSuperseded", label: "Brief superseded" },
    ],
    document: [
      { key: "documentHash", label: "Document hash", format: HASH_DISPLAY },
      { key: "recordId", label: "Record id" },
      { key: "classification", label: "Classification" },
      { key: "firstSeenAt", label: "First seen at", format: TS_DISPLAY },
      { key: "firstReferencedByEventType", label: "First ref event type" },
      { key: "registered", label: "Registered" },
      { key: "referencedByEventIds", label: "Refs", format: ARRAY_LEN },
    ],
    feedback: [
      { key: "feedbackId", label: "Feedback id" },
      { key: "from", label: "From", format: AGENT_DISPLAY },
      { key: "channel", label: "Channel" },
      { key: "subjectKey", label: "Subject" },
      { key: "classifications", label: "Classifications", format: CLASSIFICATIONS_DISPLAY },
      { key: "intakeAt", label: "Intake at", format: TS_DISPLAY },
      { key: "routedTo", label: "Routed to", format: ROUTED_TO_DISPLAY },
    ],
    "briefs-dispatches": [
      { key: "briefId", label: "Brief id" },
      { key: "issuedTo", label: "Issued to", format: AGENT_DISPLAY },
      { key: "issuedBy", label: "Issued by", format: AGENT_DISPLAY },
      { key: "title", label: "Title" },
      { key: "priority", label: "Priority" },
      { key: "workstreamId", label: "Workstream" },
      { key: "status", label: "Status", isStatus: true },
      { key: "runId", label: "Run id" },
      { key: "issuedAt", label: "Issued at", format: TS_DISPLAY },
    ],
    workstreams: [
      { key: "workstreamId", label: "Workstream id" },
      { key: "title", label: "Title" },
      { key: "briefIds", label: "Briefs", format: ARRAY_LEN },
      { key: "runIds", label: "Runs", format: ARRAY_LEN },
      { key: "decisionIds", label: "Decisions", format: ARRAY_LEN },
      { key: "documentHashes", label: "Documents", format: ARRAY_LEN },
      { key: "status", label: "Status", isStatus: true },
      { key: "firstActivityAt", label: "First activity", format: TS_DISPLAY },
      { key: "lastActivityAt", label: "Last activity", format: TS_DISPLAY },
    ],
  };

  // ---------------- Helpers ----------------------------------

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setError(message) {
    const el = $("rmsError");
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  function getRegisterFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("register");
    return r && Object.prototype.hasOwnProperty.call(COLUMNS, r) ? r : null;
  }

  // ---------------- Sidebar -----------------------------------

  function renderSidebar(catalogue, counts, activeKey) {
    const ul = $("rmsSidebar");
    if (!ul) return;
    ul.innerHTML = catalogue
      .map((c) => {
        const active = c.key === activeKey ? ' class="is-active" aria-current="page"' : "";
        const countKey = countKeyFor(c.key);
        const n =
          counts && Object.prototype.hasOwnProperty.call(counts, countKey) ? counts[countKey] : 0;
        return `<li${active}><a href="/rms.html?register=${encodeURIComponent(c.key)}">${escapeHtml(c.title)} <span class="rms-side-count">${n}</span></a></li>`;
      })
      .join("");
  }

  function countKeyFor(key) {
    // Counts in the catalogue use camelCase / collapsed keys, see rms-view.ts
    // RmsRegisterCounts. Map register key → counts key.
    switch (key) {
      case "agent-runs":
        return "agentRuns";
      case "briefs-dispatches":
        return "briefsDispatches";
      default:
        return key;
    }
  }

  // ---------------- Hub view ----------------------------------

  function renderHub(catalogue, counts) {
    $("rmsHubSection").hidden = false;
    $("rmsTableSection").hidden = true;
    const tiles = $("rmsHubTiles");
    if (!tiles) return;
    tiles.innerHTML = catalogue
      .map((c) => {
        const n = counts ? (counts[countKeyFor(c.key)] ?? 0) : 0;
        const tone = n > 0 ? "default" : "muted";
        const folds =
          c.folds && c.folds.length > 0
            ? `<div class="shell-tile-meta"><span class="shell-tile-meta-item"><span class="shell-tile-meta-dot" data-tone="muted"></span>folds: ${escapeHtml(c.folds.join(", "))}</span></div>`
            : "";
        const taxonomy =
          c.statusTaxonomy && c.statusTaxonomy.length > 0
            ? `<div class="rms-tile-taxonomy">status: ${escapeHtml(c.statusTaxonomy.join(" · "))}</div>`
            : "";
        return `<a class="shell-tile" href="/rms.html?register=${encodeURIComponent(c.key)}"><div class="shell-tile-head"><h3 class="shell-tile-title">${escapeHtml(c.title)}</h3><div class="shell-tile-count" data-tone="${tone}" aria-label="${n} rows in ${escapeHtml(c.title)}">${n}</div></div><p class="shell-tile-blurb">${escapeHtml(c.blurb)}</p>${folds}${taxonomy}</a>`;
      })
      .join("");
  }

  // ---------------- Per-register table view -------------------

  function renderTable(register, descriptor, payload) {
    $("rmsHubSection").hidden = true;
    $("rmsTableSection").hidden = false;

    const cols = COLUMNS[register] || [];
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    $("rmsTitle").textContent = descriptor ? descriptor.title : register;
    $("rmsLede").innerHTML = descriptor
      ? escapeHtml(descriptor.blurb)
      : `Rows for register <code>${escapeHtml(register)}</code>.`;

    $("rmsRowCount").textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
    if (descriptor?.statusTaxonomy && descriptor.statusTaxonomy.length > 0) {
      $("rmsStatusKey").textContent = `Status taxonomy: ${descriptor.statusTaxonomy.join(" · ")}`;
    } else {
      $("rmsStatusKey").textContent = "";
    }

    const head = $("rmsTableHead");
    head.innerHTML = cols.map((c) => `<th scope="col">${escapeHtml(c.label)}</th>`).join("");

    const body = $("rmsTableBody");
    if (rows.length === 0) {
      body.innerHTML = "";
      $("rmsEmpty").hidden = false;
      return;
    }
    $("rmsEmpty").hidden = true;

    body.innerHTML = rows
      .map((row) => {
        const cells = cols
          .map((c) => {
            const raw = row[c.key];
            const v = c.format ? c.format(raw) : raw;
            const display = v === null || v === undefined ? "" : escapeHtml(v);
            if (c.isStatus && v) {
              const cls = `rms-status rms-status-${escapeHtml(String(v).toLowerCase().replace(/\s+/g, "-"))}`;
              return `<td><span class="${cls}">${display}</span></td>`;
            }
            return `<td>${display}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
  }

  // ---------------- Loader ------------------------------------

  async function loadAll() {
    setError(null);
    const register = getRegisterFromUrl();
    try {
      const catalogue = await fetchJson("/api/rms");
      $("rmsAsOf").textContent = catalogue.asOf ? `as of ${TS_DISPLAY(catalogue.asOf)}` : "as of —";

      renderSidebar(catalogue.catalogue || [], catalogue.counts || {}, register);

      if (register === null) {
        renderHub(catalogue.catalogue || [], catalogue.counts || {});
        return;
      }

      const descriptor = (catalogue.catalogue || []).find((c) => c.key === register);
      const payload = await fetchJson(`/api/rms/${encodeURIComponent(register)}`);
      renderTable(register, descriptor, payload);
    } catch (e) {
      setError(`Failed to load register data: ${e.message}`);
      console.warn("[rms] load failed", e);
    }
  }

  // ---------------- Boot --------------------------------------

  function boot() {
    const btn = $("rmsRefreshBtn");
    if (btn) btn.addEventListener("click", () => loadAll());
    loadAll();
    // 30s polling — same cadence as the rest of the dashboard.
    setInterval(() => loadAll().catch((e) => console.warn("[rms] refresh failed", e)), 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Expose for tests / manual triggering.
  window.bankRms = { loadAll };
})();
