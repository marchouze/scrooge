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
  const EXPECTED_OUTPUTS_DISPLAY = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr.map((o) => `[${o.kind}] ${o.description}`).join("; ");
  };

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
      {
        key: "metadata",
        label: "Title",
        format: (m) => (m?.title ? m.title : undefined),
      },
      {
        key: "metadata",
        label: "Category",
        format: (m) => (m?.category ? m.category : "—"),
      },
      {
        key: "metadata",
        label: "Path",
        format: (m) =>
          m?.path ? `<span style="color:#888;font-size:0.85em">${m.path}</span>` : "—",
        html: true,
      },
      { key: "classification", label: "Classification" },
      { key: "firstSeenAt", label: "Filed at", format: TS_DISPLAY },
      { key: "documentHash", label: "Hash", format: HASH_DISPLAY },
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
      { key: "scheduledFor", label: "Scheduled for", format: TS_DISPLAY },
      { key: "expectedOutputs", label: "Expected outputs", format: EXPECTED_OUTPUTS_DISPLAY },
      { key: "directiveDocumentHash", label: "Directive document", format: HASH_DISPLAY },
      { key: "supersedes", label: "Supersedes" },
      { key: "supersedingBriefId", label: "Superseded by" },
      { key: "supersessionReason", label: "Supersession reason" },
      { key: "issuedEventId", label: "Event id" },
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
            if (c.html) {
              const display = v === null || v === undefined ? "" : String(v);
              return `<td>${display}</td>`;
            }
            const display = v === null || v === undefined ? "" : escapeHtml(String(v));
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

    body.querySelectorAll("tr").forEach((tr, i) => {
      const row = rows[i];
      if (!row) return;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => openRmsDocPreview(row, register));
    });
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

  // ---------------- RMS entry preview modal -------------------
  //
  // Click-to-view for all registers. Shows a structured detail card for
  // every row type; fetches + renders markdown when a documentHash is present.
  // Authority: D-RMS-PHASE-1.

  let rmsDocPreviewActive = null;

  function rowTitle(row, register) {
    switch (register) {
      case "document":
        return row.metadata?.title || HASH_DISPLAY(row.documentHash) || "Document";
      case "correspondence":
        return row.metadata?.title || row.correspondenceId || "Correspondence";
      case "decisions":
        return row.title || row.decisionId || "Decision";
      case "agent-runs":
        return AGENT_DISPLAY(row.agent) || row.runId || "Agent run";
      case "feedback":
        return row.subjectKey || row.feedbackId || "Feedback";
      case "briefs-dispatches":
        return row.title || row.briefId || "Brief";
      case "workstreams":
        return row.title || row.workstreamId || "Workstream";
      default:
        return register;
    }
  }

  function rowMeta(row, register) {
    const parts = [];
    switch (register) {
      case "document":
        if (row.metadata?.category) parts.push(row.metadata.category);
        if (row.metadata?.path) parts.push(row.metadata.path);
        if (row.classification) parts.push(row.classification);
        break;
      case "correspondence":
        if (row.classification) parts.push(row.classification);
        if (row.correspondenceAt) parts.push(TS_DISPLAY(row.correspondenceAt));
        break;
      case "decisions":
        if (row.category) parts.push(row.category);
        if (row.status) parts.push(row.status);
        if (row.resolvedAt) parts.push(TS_DISPLAY(row.resolvedAt));
        break;
      case "agent-runs":
        if (row.outcome) parts.push(row.outcome);
        if (row.startedAt) parts.push(TS_DISPLAY(row.startedAt));
        break;
      case "feedback":
        if (row.channel) parts.push(row.channel);
        if (row.intakeAt) parts.push(TS_DISPLAY(row.intakeAt));
        break;
      case "briefs-dispatches":
        if (row.status) parts.push(row.status);
        if (row.issuedAt) parts.push(TS_DISPLAY(row.issuedAt));
        break;
      case "workstreams":
        if (row.status) parts.push(row.status);
        if (row.lastActivityAt) parts.push(TS_DISPLAY(row.lastActivityAt));
        break;
    }
    return parts.filter(Boolean).join(" · ");
  }

  function renderDetailCard(row, register) {
    const cols = COLUMNS[register] || [];
    const seenKeys = new Set();
    const rows = cols
      .filter((c) => {
        if (seenKeys.has(c.key + c.label)) return false;
        seenKeys.add(c.key + c.label);
        return true;
      })
      .map((c) => {
        const raw = row[c.key];
        const v = c.format ? c.format(raw) : raw;
        const display = v === null || v === undefined || v === "" ? "—" : String(v);
        return `<div class="rms-detail-row"><dt>${escapeHtml(c.label)}</dt><dd>${escapeHtml(display)}</dd></div>`;
      });
    return `<dl class="rms-detail-card">${rows.join("")}</dl>`;
  }

  async function openRmsDocPreview(row, register) {
    const hash = row.documentHash || row.directiveDocumentHash || row.documentHashes?.[0] || null;
    const token = (hash || register) + Math.random();

    const modal = $("rmsDocPreviewModal");
    const titleEl = $("rmsDocPreviewTitle");
    const metaEl = $("rmsDocPreviewMeta");
    const bodyEl = $("rmsDocPreviewBody");

    titleEl.textContent = rowTitle(row, register);
    metaEl.textContent = rowMeta(row, register);
    bodyEl.innerHTML = renderDetailCard(row, register);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    rmsDocPreviewActive = token;

    if (!hash) return;

    const separator = '<hr style="margin:1.5rem 0;opacity:.25;">';
    bodyEl.innerHTML += `${separator}<p class="muted" style="font-size:.85em">Loading document…</p>`;

    try {
      const res = await fetch(`/api/rms/document-content?hash=${encodeURIComponent(hash)}`);
      if (rmsDocPreviewActive !== token) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const md = await res.text();
      if (rmsDocPreviewActive !== token) return;
      bodyEl.innerHTML = renderDetailCard(row, register) + separator + renderMarkdownLite(md);
    } catch (e) {
      if (rmsDocPreviewActive !== token) return;
      bodyEl.innerHTML = `${renderDetailCard(row, register)}${separator}<p class="error-text">Could not load document: ${escapeHtml(String(e))}</p>`;
    }
  }

  function closeRmsDocPreview() {
    const modal = $("rmsDocPreviewModal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
    rmsDocPreviewActive = null;
  }

  // ---------------- renderMarkdownLite ------------------------
  //
  // Shared lightweight markdown renderer. Copied verbatim from policies.js.
  // No third-party dep; no exec'd HTML. Anything fancier falls back to <pre>.
  // TODO: extract to a shared module; see /api/markdown/:scope/:filename refactor.

  function renderMarkdownLite(md) {
    const src = String(md ?? "");
    let body = src;
    if (body.startsWith("---")) {
      const end = body.indexOf("\n---", 3);
      if (end !== -1) body = body.slice(end + 4);
    }
    const lines = body.split(/\r?\n/);
    const out = [];
    let inCode = false;
    let codeBuf = [];
    let inList = false;
    let listType = null;
    let inTable = false;
    let tableRows = [];
    const closeList = () => {
      if (inList) {
        out.push(listType === "ol" ? "</ol>" : "</ul>");
        inList = false;
        listType = null;
      }
    };
    const isTableSep = (r) => /^\|[\s\-:| ]+\|$/.test(r);
    const parseTableCells = (r) =>
      r
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
    const closeTable = () => {
      if (!inTable || tableRows.length === 0) {
        inTable = false;
        tableRows = [];
        return;
      }
      const sepIdx = tableRows.findIndex((r) => isTableSep(r));
      const headRows = sepIdx === -1 ? [] : tableRows.slice(0, sepIdx);
      const bodyRows = sepIdx === -1 ? tableRows : tableRows.slice(sepIdx + 1);
      let html = '<div class="md-table-wrap"><table>';
      if (headRows.length > 0) {
        html += "<thead>";
        for (const r of headRows)
          html += `<tr>${parseTableCells(r)
            .map((c) => `<th>${inlineFormat(c)}</th>`)
            .join("")}</tr>`;
        html += "</thead>";
      }
      if (bodyRows.length > 0) {
        html += "<tbody>";
        for (const r of bodyRows)
          html += `<tr>${parseTableCells(r)
            .map((c) => `<td>${inlineFormat(c)}</td>`)
            .join("")}</tr>`;
        html += "</tbody>";
      }
      html += "</table></div>";
      out.push(html);
      inTable = false;
      tableRows = [];
    };
    const inlineFormat = (line) => {
      let s = escapeHtml(line);
      s = s.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
      s = s.replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${t}</strong>`);
      s = s.replace(/(^|\W)\*([^*]+)\*(\W|$)/g, (_m, a, t, b) => `${a}<em>${t}</em>${b}`);
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
        const safe = /^(https?:|\/|\.\.?\/)/i.test(href) ? href : "#";
        return `<a href="${safe}" target="_blank" rel="noopener">${text}</a>`;
      });
      return s;
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (line.startsWith("```")) {
        if (inCode) {
          out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
          codeBuf = [];
          inCode = false;
        } else {
          closeList();
          closeTable();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }
      if (!line.trim()) {
        closeList();
        closeTable();
        continue;
      }
      const h1 = line.match(/^# (.+)$/);
      if (h1) {
        closeList();
        closeTable();
        out.push(`<h2>${inlineFormat(h1[1])}</h2>`);
        continue;
      }
      const h2 = line.match(/^## (.+)$/);
      if (h2) {
        closeList();
        closeTable();
        out.push(`<h3>${inlineFormat(h2[1])}</h3>`);
        continue;
      }
      const h3 = line.match(/^### (.+)$/);
      if (h3) {
        closeList();
        closeTable();
        out.push(`<h4>${inlineFormat(h3[1])}</h4>`);
        continue;
      }
      const ul = line.match(/^[-*]\s+(.+)$/);
      if (ul) {
        if (!inList || listType !== "ul") {
          closeList();
          closeTable();
          out.push("<ul>");
          inList = true;
          listType = "ul";
        }
        out.push(`<li>${inlineFormat(ul[1])}</li>`);
        continue;
      }
      const ol = line.match(/^\d+\.\s+(.+)$/);
      if (ol) {
        if (!inList || listType !== "ol") {
          closeList();
          closeTable();
          out.push("<ol>");
          inList = true;
          listType = "ol";
        }
        out.push(`<li>${inlineFormat(ol[1])}</li>`);
        continue;
      }
      if (line.startsWith("> ")) {
        closeList();
        closeTable();
        out.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`);
        continue;
      }
      if (line.startsWith("|")) {
        closeList();
        inTable = true;
        tableRows.push(line);
        continue;
      }
      closeList();
      closeTable();
      out.push(`<p>${inlineFormat(line)}</p>`);
    }
    if (inCode) {
      out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
    }
    closeList();
    closeTable();
    return out.join("\n");
  }

  // ---------------- Boot --------------------------------------

  function boot() {
    const btn = $("rmsRefreshBtn");
    if (btn) btn.addEventListener("click", () => loadAll());
    loadAll();
    // 30s polling — same cadence as the rest of the dashboard.
    setInterval(() => loadAll().catch((e) => console.warn("[rms] refresh failed", e)), 30_000);

    const closeBtn = $("rmsDocPreviewClose");
    if (closeBtn) closeBtn.addEventListener("click", closeRmsDocPreview);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeRmsDocPreview();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Expose for tests / manual triggering.
  window.bankRms = { loadAll };
})();
