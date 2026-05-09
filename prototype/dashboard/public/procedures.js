// dashboard/public/procedures.js
//
// Procedures index page — surfaces every row of `Procedures/_index.md`
// grouped by domain (the H2 sections), enriched per-row with the
// frontmatter (id, policy-parent, last-reviewed, reconciliation-cadence)
// of the corresponding `Procedures/by-policy/<file>.md` when authored.
//
// Per CLAUDE.md Principle 1: every datum on this page is derived from
// /api/procedures (parsed live from Procedures/_index.md and the per-procedure
// files). No hand-authored content; on index update, Owen + domain leads'
// changes flow through here at the next dashboard refresh tick.
//
// Per Principle 6: this is one slice of the single citable graph
// (Reg → Policy → Procedure → System Capability). Orphan citations — index
// rows that link to a procedure file that does not exist on disk — surface
// on the Citation-integrity findings panel as "no orphans" findings.
//
// Author: Atlas (substrate seam: /api/procedures)

const $ = (id) => document.getElementById(id);

function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function statusClass(status) {
  switch (status) {
    case "POPULATED":
      return "proc-tag proc-tag-populated";
    case "STUB":
      return "proc-tag proc-tag-stub";
    case "DRAFT":
      return "proc-tag proc-tag-draft";
    case "PLANNED":
      return "proc-tag proc-tag-planned";
    default:
      return "proc-tag";
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let view = null; // raw /api/procedures response
let allRows = []; // flattened rows tagged with their domain

function flatten(view) {
  const rows = [];
  for (const g of view.groups ?? []) {
    for (const r of g.rows ?? []) {
      rows.push({ ...r, domain: g.domain });
    }
  }
  return rows;
}

function applyFilters() {
  const fDomain = $("filterDomain").value;
  const fStatus = $("filterStatus").value;
  const fAuthored = $("filterAuthored").value;
  const fSearch = $("filterSearch").value.trim().toLowerCase();

  return allRows.filter((r) => {
    if (fDomain && r.domain !== fDomain) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (fAuthored === "AUTHORED" && !r.procedureId && !r.procedureTitle && !r.policyParent) {
      // Authored = at least one frontmatter field present (i.e. file
      // exists with frontmatter). The view marks file-existence via
      // verifyHints absence + procedureFile presence; cheap check below
      // covers the common case.
      if (r.orphan || !r.procedureFile) return false;
      if (r.verifyHints && r.verifyHints.includes("NO-FRONTMATTER")) return false;
    }
    if (fAuthored === "AUTHORED") {
      // Stricter pass: must have a procedureFile and not be orphaned.
      if (!r.procedureFile || r.orphan) return false;
    }
    if (fAuthored === "UNAUTHORED" && r.procedureFile && !r.orphan) return false;
    if (fAuthored === "ORPHAN" && !r.orphan) return false;
    if (fSearch) {
      const hay = [
        r.procedureFile,
        r.procedureLabel,
        r.policy,
        r.owner,
        r.procedureId,
        r.procedureTitle,
        r.policyParent,
        r.domain,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(fSearch)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Renderers — top cards + status / domain histograms
// ---------------------------------------------------------------------------

function renderSummary() {
  if (!view) return;
  const total = view.count;
  const authored = view.authoredCount;
  const orphans = view.orphanCount;
  const populated = view.statusCounts?.POPULATED ?? 0;
  const stub = view.statusCounts?.STUB ?? 0;
  const planned = view.statusCounts?.PLANNED ?? 0;
  const draft = view.statusCounts?.DRAFT ?? 0;
  const domainCount = (view.groups ?? []).length;

  $("procSummarySub").textContent =
    `${total} procedure row${total === 1 ? "" : "s"} across ${domainCount} domain${domainCount === 1 ? "" : "s"}`;
  $("procSummary").innerHTML = `
    <div class="proc-card">
      <div class="proc-card-num">${total}</div>
      <div class="proc-card-lbl">Total rows</div>
      <div class="proc-card-sub">Owen-curated index</div>
    </div>
    <div class="proc-card">
      <div class="proc-card-num">${authored}</div>
      <div class="proc-card-lbl">Authored files</div>
      <div class="proc-card-sub">file under by-policy/ exists</div>
    </div>
    <div class="proc-card">
      <div class="proc-card-num">${populated}</div>
      <div class="proc-card-lbl">POPULATED</div>
    </div>
    <div class="proc-card">
      <div class="proc-card-num">${stub}</div>
      <div class="proc-card-lbl">STUB</div>
    </div>
    <div class="proc-card">
      <div class="proc-card-num">${draft}</div>
      <div class="proc-card-lbl">DRAFT</div>
    </div>
    <div class="proc-card">
      <div class="proc-card-num">${planned}</div>
      <div class="proc-card-lbl">PLANNED</div>
    </div>
    <div class="proc-card">
      <div class="proc-card-num">${orphans}</div>
      <div class="proc-card-lbl">Orphan citations</div>
      <div class="proc-card-sub">cited file missing on disk</div>
    </div>
  `;
}

function renderHistograms() {
  if (!view) return;
  const stat = $("procStatusList");
  const dom = $("procDomainList");

  const statusOrder = ["POPULATED", "DRAFT", "STUB", "PLANNED", "UNCLASSIFIED"];
  const statusSorted = Object.entries(view.statusCounts ?? {}).sort(
    (a, b) => statusOrder.indexOf(a[0]) - statusOrder.indexOf(b[0]),
  );
  stat.innerHTML = statusSorted
    .map(
      ([k, v]) => `<span class="proc-chip"><b>${esc(k)}</b><span class="muted">${v}</span></span>`,
    )
    .join("");

  const domSorted = (view.groups ?? [])
    .map((g) => [g.domain, g.rows.length])
    .sort((a, b) => b[1] - a[1]);
  dom.innerHTML = domSorted
    .map(
      ([k, v]) => `<span class="proc-chip"><b>${esc(k)}</b><span class="muted">${v}</span></span>`,
    )
    .join("");
}

function populateDomainFilter() {
  const sel = $("filterDomain");
  const domains = (view?.groups ?? []).map((g) => g.domain);
  for (const d of domains) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    sel.appendChild(opt);
  }
}

// ---------------------------------------------------------------------------
// Renderers — main grouped list
// ---------------------------------------------------------------------------

function renderProcedureCell(r) {
  if (!r.procedureFile) {
    // Descriptive cell only — render the raw label.
    return `<span class="muted">${esc(r.procedureLabel || "—")}</span>`;
  }
  if (r.orphan) {
    // Orphan: file cited but missing on disk. Don't link.
    return `
      <div class="proc-row-link">
        <span><code>${esc(r.procedureFile)}</code></span>
        <span class="proc-verify-flag">ORPHAN</span>
      </div>
      <div class="proc-row-meta">${esc(r.procedureLabel)}</div>
    `;
  }
  // Authored: link to the source markdown so reviewers can jump directly
  // to the procedure file in the repo's GitHub view (relative link to the
  // raw file works in dev; a substrate seam later swaps in a richer
  // viewer if we land one).
  const href = `/Procedures/by-policy/${encodeURIComponent(r.procedureFile)}`;
  const idChip = r.procedureId
    ? `<span class="proc-tag" style="margin-left:6px;">${esc(r.procedureId)}</span>`
    : "";
  const titleLine = r.procedureTitle
    ? `<div class="proc-row-meta">${esc(r.procedureTitle)}</div>`
    : "";
  return `
    <div class="proc-row-link">
      <a href="${esc(href)}"><code>${esc(r.procedureFile)}</code></a>
      ${idChip}
    </div>
    ${titleLine}
  `;
}

function renderRowMeta(r) {
  const parts = [];
  if (r.policyParent) parts.push(`<code>${esc(r.policyParent)}</code>`);
  if (r.lastReviewed) parts.push(`reviewed ${esc(r.lastReviewed)}`);
  if (r.reconciliationCadence) parts.push(esc(r.reconciliationCadence));
  if (parts.length === 0) return "";
  return `<div class="proc-row-meta">${parts.join(" · ")}</div>`;
}

function renderTable(rows) {
  const target = $("procDomainBlocks");
  const sub = $("procListSub");
  if (!rows.length) {
    target.innerHTML = `<p class="muted" style="padding:12px 0;">No procedures match the current filter.</p>`;
    sub.textContent = `0 of ${allRows.length}`;
    return;
  }
  sub.textContent = `${rows.length} of ${allRows.length}`;

  // Re-group filtered rows by domain (preserve view order).
  const order = (view?.groups ?? []).map((g) => g.domain);
  const byDomain = new Map();
  for (const r of rows) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, []);
    byDomain.get(r.domain).push(r);
  }
  const blocks = order
    .filter((d) => byDomain.has(d))
    .map((d) => {
      const list = byDomain.get(d);
      const body = list
        .map((r) => {
          const tagClass = statusClass(r.status);
          const verify =
            (r.verifyHints ?? []).length > 0
              ? (r.verifyHints ?? [])
                  .map((h) => `<span class="proc-verify-flag">${esc(h)}</span>`)
                  .join("")
              : "";
          const rowClass = r.orphan
            ? "proc-orphan-row"
            : (r.verifyHints ?? []).length > 0
              ? "proc-verify-row"
              : "";
          return `
          <tr class="${rowClass}">
            <td>
              ${renderProcedureCell(r)}
              ${renderRowMeta(r)}
            </td>
            <td>${esc(r.policy)}</td>
            <td>${esc(r.owner)}</td>
            <td>
              <span class="${tagClass}">${esc(r.status || "—")}</span>
              ${verify ? `<div style="margin-top:3px;">${verify}</div>` : ""}
            </td>
          </tr>`;
        })
        .join("");
      return `
      <div class="proc-domain-block">
        <div class="proc-domain-head">
          <h3>${esc(d)}</h3>
          <span class="proc-domain-count">${list.length} procedure${list.length === 1 ? "" : "s"}</span>
        </div>
        <div class="proc-table-wrap">
          <table class="proc-table">
            <thead>
              <tr>
                <th style="width: 22em;">Procedure</th>
                <th>Policy</th>
                <th style="width: 14em;">Owner</th>
                <th style="width: 10em;">Status</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join("");
  target.innerHTML = blocks;
}

// ---------------------------------------------------------------------------
// Renderers — citation-integrity findings panel
// ---------------------------------------------------------------------------

function renderFindings() {
  const findings = allRows.filter(
    (r) => r.orphan || (r.verifyHints && r.verifyHints.length > 0),
  );
  const summary = $("procFindingsSummary");
  const orphanCount = allRows.filter((r) => r.orphan).length;
  const noFm = allRows.filter((r) => (r.verifyHints ?? []).includes("NO-FRONTMATTER")).length;
  const noId = allRows.filter((r) => (r.verifyHints ?? []).includes("NO-ID")).length;
  const noPp = allRows.filter((r) => (r.verifyHints ?? []).includes("NO-POLICY-PARENT")).length;
  const noLr = allRows.filter((r) => (r.verifyHints ?? []).includes("NO-LAST-REVIEWED")).length;

  summary.innerHTML = `
    <b>${findings.length}</b> row${findings.length === 1 ? "" : "s"} with at least one citation-chain finding ·
    <b>${orphanCount}</b> ORPHAN-FILE-MISSING ·
    <b>${noFm}</b> NO-FRONTMATTER ·
    <b>${noId}</b> NO-ID ·
    <b>${noPp}</b> NO-POLICY-PARENT ·
    <b>${noLr}</b> NO-LAST-REVIEWED.
  `;

  const body = $("procFindingsBody");
  if (!findings.length) {
    body.innerHTML = `<tr><td colspan="4" class="muted" style="padding:18px;text-align:center;">No findings — every authored procedure has complete frontmatter and no orphan citations.</td></tr>`;
    return;
  }
  body.innerHTML = findings
    .map(
      (r) => `
    <tr class="${r.orphan ? "proc-orphan-row" : "proc-verify-row"}">
      <td><code>${esc(r.procedureFile || "—")}</code></td>
      <td>${esc(r.policy)}<div class="proc-row-meta">${esc(r.domain)}</div></td>
      <td>${esc(r.owner)}</td>
      <td>${(r.verifyHints ?? []).map((h) => `<span class="proc-verify-flag">${esc(h)}</span>`).join(" ")}</td>
    </tr>`,
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Refresh dispatch
// ---------------------------------------------------------------------------

function refresh() {
  const filtered = applyFilters();
  renderTable(filtered);
}

// ---------------------------------------------------------------------------
// Wiring — fetch /api/procedures
// ---------------------------------------------------------------------------

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  try {
    const r = await fetch("/api/procedures", { cache: "no-store" });
    if (!r.ok) throw new Error(`procedures HTTP ${r.status}`);
    view = await r.json();
    allRows = flatten(view);

    renderSummary();
    renderHistograms();
    if ($("filterDomain").options.length <= 1) {
      populateDomainFilter();
    }
    refresh();
    renderFindings();

    live.classList.remove("bad");
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(view.asOf)}`;
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

function wireFilters() {
  for (const id of ["filterDomain", "filterStatus", "filterAuthored"]) {
    $(id).addEventListener("change", refresh);
  }
  $("filterSearch").addEventListener("input", refresh);
}

wireFilters();
load();
setInterval(load, 30_000);
