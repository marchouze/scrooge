// dashboard/public/policies.js
//
// Policies page. Reads /api/state, renders the policy library as a filterable
// table, and provides a per-policy drilldown overlay showing the obligations
// the policy fulfils, the policy's source mix (REGULATORY vs OBJECTIVE), and
// its bind state(s).
//
// Per CLAUDE.md Principle 6: policies implement (Regulation OR Bank Objective).
// The drilldown surfaces both sides — every linked obligation carries its own
// citation, source, and bind, so the policy's coverage is visible at a glance.
//
// Author: Anya (data) · Atlas (substrate)

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

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
    case "IN FORCE":
      return "pol-status-in-force";
    case "EXISTS":
      return "pol-status-exists";
    case "DRAFTING":
      return "pol-status-drafting";
    case "PLANNED":
      return "pol-status-planned";
    case "BOARD-RES":
      return "pol-status-board-res";
    default:
      return "pol-status-other";
  }
}

function sourceBadges(sources) {
  if (!sources?.length) return '<span class="muted" style="font-size:11.5px;">—</span>';
  return sources
    .map((s) => `<span class="pol-badge pol-source-${s.toLowerCase()}">${esc(s)}</span>`)
    .join(" ");
}

function bindBadges(binds) {
  if (!binds?.length) return '<span class="muted" style="font-size:11.5px;">—</span>';
  return binds
    .map((b) => `<span class="pol-badge pol-bind-${b.toLowerCase()}">${esc(b)}</span>`)
    .join(" ");
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let allPolicies = [];
let obligationDetailById = {}; // populated via /api/state's obligations metadata, see hydrateObligations
let allProcedures = null; // populated via /api/procedures, used in drilldown

function applyFilters() {
  const fDomain = $("filterDomain").value;
  const fStatus = $("filterStatus").value;
  const fSource = $("filterSource").value;
  const fBind = $("filterBind").value;
  const fMvp = $("filterMvp").checked;
  const fSearch = $("filterSearch").value.trim().toLowerCase();

  return allPolicies.filter((p) => {
    if (fDomain && p.domain !== fDomain) return false;
    if (fStatus && p.status !== fStatus) return false;
    if (fSource === "REGULATORY" && !(p.sources.length === 1 && p.sources[0] === "REGULATORY"))
      return false;
    if (fSource === "OBJECTIVE" && !(p.sources.length === 1 && p.sources[0] === "OBJECTIVE"))
      return false;
    if (
      fSource === "BOTH" &&
      !(p.sources.includes("REGULATORY") && p.sources.includes("OBJECTIVE"))
    )
      return false;
    if (fSource === "NONE" && p.sources.length !== 0) return false;
    if (fBind && !p.binds.includes(fBind)) return false;
    if (fMvp && !p.mvp) return false;
    if (fSearch) {
      const hay = [
        p.name,
        p.owner,
        p.citation,
        p.domain,
        p.statusRaw,
        ...(p.linkedObligations ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(fSearch)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderSummary(policies) {
  const total = policies.length;
  const mvp = policies.filter((p) => p.mvp).length;
  const inForce = policies.filter((p) => p.status === "IN FORCE" || p.status === "EXISTS").length;
  const drafting = policies.filter((p) => p.status === "DRAFTING").length;
  const planned = policies.filter((p) => p.status === "PLANNED").length;
  const objectiveOnly = policies.filter(
    (p) => p.sources.length === 1 && p.sources[0] === "OBJECTIVE",
  ).length;
  const both = policies.filter(
    (p) => p.sources.includes("REGULATORY") && p.sources.includes("OBJECTIVE"),
  ).length;

  $("policiesSummarySub").textContent =
    `${total} polic${total === 1 ? "y" : "ies"} across the library`;
  $("policiesSummary").innerHTML = `
    <div class="pol-summary-card">
      <div class="pol-summary-num">${total}</div>
      <div class="pol-summary-lbl">Total policies</div>
    </div>
    <div class="pol-summary-card pol-summary-card-mvp">
      <div class="pol-summary-num">${mvp}</div>
      <div class="pol-summary-lbl">★ MVP set</div>
      <div class="pol-summary-sublbl muted">SARB licence application</div>
    </div>
    <div class="pol-summary-card">
      <div class="pol-summary-num">${inForce}</div>
      <div class="pol-summary-lbl">IN FORCE / EXISTS</div>
    </div>
    <div class="pol-summary-card">
      <div class="pol-summary-num">${drafting}</div>
      <div class="pol-summary-lbl">DRAFTING</div>
    </div>
    <div class="pol-summary-card">
      <div class="pol-summary-num">${planned}</div>
      <div class="pol-summary-lbl">PLANNED</div>
    </div>
    <div class="pol-summary-card">
      <div class="pol-summary-num">${both}</div>
      <div class="pol-summary-lbl">REG + OBJ</div>
      <div class="pol-summary-sublbl muted">implements both</div>
    </div>
    <div class="pol-summary-card">
      <div class="pol-summary-num">${objectiveOnly}</div>
      <div class="pol-summary-lbl">OBJECTIVE only</div>
      <div class="pol-summary-sublbl muted">internal commitments</div>
    </div>
  `;
}

function populateDomainFilter(policies) {
  const sel = $("filterDomain");
  const domains = Array.from(new Set(policies.map((p) => p.domain))).sort((a, b) => {
    // Sort by leading number where present.
    const an = Number.parseInt(a, 10);
    const bn = Number.parseInt(b, 10);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
    return a.localeCompare(b);
  });
  for (const d of domains) {
    const opt = el("option", { value: d }, d);
    sel.appendChild(opt);
  }
}

function renderTable(policies) {
  const body = $("policiesBody");
  const sub = $("policiesListSub");
  if (!policies.length) {
    body.innerHTML = `<tr><td colspan="8" class="muted" style="padding:18px;text-align:center;">No policies match the current filter.</td></tr>`;
    sub.textContent = `0 of ${allPolicies.length}`;
    return;
  }
  sub.textContent = `${policies.length} of ${allPolicies.length}`;
  body.innerHTML = policies
    .map((p) => {
      // Primary source file for the per-row preview affordance — the
      // first entry of `sourceFiles[]` (the canonical policy register
      // itself, unless the row cites an explicit standalone document).
      // Cmd-click / middle-click on the policy-name anchor falls
      // through to /api/policy/:filename for normal navigation.
      const primary = (p.sourceFiles ?? [])[0] ?? null;
      const href = primary ? `/api/policy/${encodeURIComponent(primary)}` : "#";
      const multi = (p.sourceFiles ?? []).length > 1;
      const previewAttrs = primary
        ? ` href="${esc(href)}" class="pol-preview-link" data-policy-id="${esc(p.id)}"`
        : ` href="#" class="pol-preview-link pol-preview-link-disabled" data-policy-id="${esc(p.id)}" aria-disabled="true"`;
      const multiTag = multi
        ? `<span class="pol-badge" title="Policy cites multiple source files; pick from the modal" style="margin-left:6px;font-size:10.5px;">+${(p.sourceFiles ?? []).length - 1}</span>`
        : "";
      return `
    <tr class="pol-row" data-policy-id="${esc(p.id)}">
      <td class="col-name">
        ${p.mvp ? '<span class="pol-mvp" title="MVP — required for SARB licence application">★</span>' : ""}
        <a${previewAttrs}><span class="pol-name">${esc(p.name)}</span></a>${multiTag}
      </td>
      <td class="col-domain">${esc(p.domain)}</td>
      <td class="col-owner">${esc(p.owner)}</td>
      <td class="col-approval">${esc(p.approval)}</td>
      <td class="col-source">${sourceBadges(p.sources)}</td>
      <td class="col-bind">${bindBadges(p.binds)}</td>
      <td class="col-status"><span class="pol-status ${statusClass(p.status)}">${esc(p.status)}</span></td>
      <td class="col-obligs">${p.linkedObligations.length}</td>
    </tr>`;
    })
    .join("");
  // Row click → drilldown overlay (existing behaviour). The preview-link
  // anchor stops propagation so a primary-button click on the policy name
  // opens the markdown preview instead.
  for (const tr of document.querySelectorAll("#policiesBody .pol-row")) {
    tr.addEventListener("click", (e) => {
      // If the click was on (or inside) the preview link, let the
      // delegated preview handler take it — don't open the drilldown.
      if (e.target.closest("a.pol-preview-link")) return;
      openDrill(tr.dataset.policyId);
    });
  }
}

function refresh() {
  const filtered = applyFilters();
  renderTable(filtered);
}

// ---------------------------------------------------------------------------
// Drilldown
// ---------------------------------------------------------------------------

function openDrill(policyId) {
  const p = allPolicies.find((x) => x.id === policyId);
  if (!p) return;
  const drill = $("policyDrill");
  const body = $("policyDrillBody");

  const obligationsDetail = (p.linkedObligations ?? []).map((id) => {
    const o = obligationDetailById[id];
    return {
      id,
      requirement: o?.requirement ?? "(obligation requirement not in cache)",
      citation: o?.citation ?? "—",
      source: o?.source ?? "?",
      bind: o?.bind ?? "?",
      status: o?.status ?? "?",
      owner: o?.owner ?? "—",
    };
  });

  // Group obligations by domain prefix (ORG-PR / ORG-FC / etc.) for readability.
  const byDomain = {};
  for (const o of obligationsDetail) {
    const m = o.id.match(/^ORG-([A-Z]+(?:\([A-Z]+\))?)-/);
    const prefix = m ? `ORG-${m[1]}-*` : "Other";
    byDomain[prefix] ??= [];
    byDomain[prefix].push(o);
  }

  body.innerHTML = `
    <div class="pol-drill-head">
      <div class="pol-drill-eyebrow muted">${esc(p.domain)}${p.mvp ? ' · <span class="pol-mvp" title="MVP">★ MVP</span>' : ""}</div>
      <h2 id="policyDrillTitle" class="pol-drill-title">${esc(p.name)}</h2>
      <div class="pol-drill-pills">
        ${sourceBadges(p.sources)}
        ${bindBadges(p.binds)}
        <span class="pol-status ${statusClass(p.status)}">${esc(p.status)}</span>
      </div>
    </div>

    <div class="pol-drill-grid">
      <div class="pol-drill-meta">
        <div class="pol-meta-row"><b>Owner</b><span>${esc(p.owner)}</span></div>
        <div class="pol-meta-row"><b>Approval</b><span>${esc(p.approval)}</span></div>
        <div class="pol-meta-row"><b>Cadence</b><span>${esc(p.cadence)}</span></div>
        <div class="pol-meta-row"><b>Status (raw)</b><span>${esc(p.statusRaw)}</span></div>
        <div class="pol-meta-row"><b>Citation</b><span>${esc(p.citation)}</span></div>
        <div class="pol-meta-row"><b>Linked obligations</b><span>${p.linkedObligations.length}</span></div>
      </div>
    </div>

    <div class="pol-drill-section">
      <h3>Why this policy exists</h3>
      ${
        p.sources.length === 0
          ? '<p class="muted">No obligations in the register currently cite this policy as a fulfilment. Either the policy is auxiliary (e.g. a meta-policy referenced indirectly) or the register entry naming is misaligned — flag for Mira / Owen review.</p>'
          : `<p class="muted">This policy implements <strong>${p.linkedObligations.length}</strong> obligation${p.linkedObligations.length === 1 ? "" : "s"} across ${Object.keys(byDomain).length} register domain${Object.keys(byDomain).length === 1 ? "" : "s"}. Source mix: ${p.sources.join(" + ")}. Bind state${p.binds.length === 1 ? "" : "s"}: ${p.binds.join(" + ")}.</p>`
      }
    </div>

    <div class="pol-drill-section">
      <h3>Obligations fulfilled (Principle 6 upward chain)</h3>
      ${
        obligationsDetail.length === 0
          ? '<p class="muted">No linked obligations.</p>'
          : Object.entries(byDomain)
              .map(
                ([prefix, items]) => `
        <div class="pol-drill-domain">
          <div class="pol-drill-domain-head">${esc(prefix)} · ${items.length} obligation${items.length === 1 ? "" : "s"}</div>
          <table class="pol-drill-obligs">
            <thead>
              <tr>
                <th>ID</th>
                <th>Citation</th>
                <th>Requirement</th>
                <th>Source</th>
                <th>Bind</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (o) => `
                <tr>
                  <td><code>${esc(o.id)}</code></td>
                  <td class="pol-drill-cit">${esc(o.citation)}</td>
                  <td>${esc(o.requirement)}</td>
                  <td>${o.source !== "?" ? `<span class="pol-badge pol-source-${o.source.toLowerCase()}">${esc(o.source)}</span>` : '<span class="muted">?</span>'}</td>
                  <td>${o.bind !== "?" ? `<span class="pol-badge pol-bind-${o.bind.toLowerCase()}">${esc(o.bind)}</span>` : '<span class="muted">?</span>'}</td>
                  <td>${esc(o.status)}</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>`,
              )
              .join("")
      }
    </div>

    <div class="pol-drill-section">
      <h3>Linked procedures</h3>
      ${(() => {
        const linkedProcs = (allProcedures ?? []).filter(
          (r) =>
            r.policyParent?.trim().toLowerCase() === p.name?.trim().toLowerCase() &&
            r.procedureFile,
        );
        if (linkedProcs.length === 0) {
          return '<p class="muted">No procedures authored under this policy yet.</p>';
        }
        const rows = linkedProcs
          .map((r) => {
            const statusBadge = r.status
              ? `<span class="pol-proc-status pol-proc-status-${r.status.toLowerCase()}">${esc(r.status)}</span>`
              : "";
            const title = r.procedureTitle || r.procedureLabel || r.procedureFile;
            return `
              <div class="pol-proc-row">
                <a href="procedures.html?procedure=${encodeURIComponent(r.procedureFile)}" class="pol-proc-link">
                  <code>${esc(r.procedureFile)}</code>
                </a>
                ${statusBadge}
                ${title && title !== r.procedureFile ? `<div class="pol-proc-title">${esc(title)}</div>` : ""}
              </div>`;
          })
          .join("");
        return `<div class="pol-proc-list">${rows}</div>`;
      })()}
    </div>

    <div class="pol-drill-section">
      <h3>Provenance</h3>
      <p class="muted">
        Parsed from <code>Owner Inbox/2026-05-06_policy-register.md</code> §${esc((p.domain.match(/^\d+/) ?? [""])[0])}.
        Linked obligations cross-referenced against <code>Regulations/_obligations-register.md</code>.
        Source / bind classification per CLAUDE.md Principle 6 (<code>(Regulation OR Bank Objective) → Policy → Procedure → System Capability</code>).
      </p>
    </div>
  `;
  drill.removeAttribute("hidden");
  document.body.classList.add("pol-drill-open");
}

function closeDrill() {
  $("policyDrill").setAttribute("hidden", "");
  document.body.classList.remove("pol-drill-open");
}

// ---------------------------------------------------------------------------
// Inline-preview modal — mirrors the procedures-page preview modal. Streams
// /api/policy/:filename and renders with a tiny line-oriented markdown
// formatter (same shape as `renderMarkdownLite` in procedures.js). No
// third-party dep, no exec'd HTML. Anything fancier lands in the <pre>
// fallback. If a policy cites multiple source files, the modal head shows
// a small picker so the user can switch files without closing the overlay.
// TODO: extract; see /api/markdown/:scope/:filename refactor.
// ---------------------------------------------------------------------------

const POLICY_REGISTER_BASENAME = "2026-05-06_policy-register.md";

let policyPreviewActive = null;

// Returns the explicit source files for a policy (excluding the fallback register).
function explicitSourceFiles(p) {
  return (p.sourceFiles ?? []).filter((f) => f !== POLICY_REGISTER_BASENAME);
}

// Render a readable policy card from in-memory data — used when no
// dedicated markdown document exists for the policy.
function renderPolicyCard(p) {
  const obligs = p.linkedObligations ?? [];
  const rows = [
    ["Domain", esc(p.domain)],
    ["Owner", esc(p.owner || "—")],
    ["Approval", esc(p.approval || "—")],
    ["Cadence", esc(p.cadence || "—")],
    ["Citation", `<code>${esc(p.citation || "—")}</code>`],
    ["Status", esc(p.statusRaw || p.status || "—")],
    [
      "Sources",
      (p.sources ?? []).length
        ? (p.sources ?? [])
            .map((s) => `<span class="pol-badge pol-source-${s.toLowerCase()}">${esc(s)}</span>`)
            .join(" ")
        : "—",
    ],
    [
      "Bind",
      (p.binds ?? []).length
        ? (p.binds ?? [])
            .map((b) => `<span class="pol-badge pol-bind-${b.toLowerCase()}">${esc(b)}</span>`)
            .join(" ")
        : "—",
    ],
    ["MVP", p.mvp ? "★ Yes" : "No"],
    ["Obligations", obligs.length ? String(obligs.length) : "None linked"],
  ];
  const metaRows = rows
    .map(
      ([k, v]) =>
        `<tr><th style="width:110px;text-align:left;padding:5px 12px 5px 0;color:var(--text-muted);font-weight:500;white-space:nowrap;vertical-align:top;">${k}</th><td style="padding:5px 0;">${v}</td></tr>`,
    )
    .join("");
  let obliguBlock = "";
  if (obligs.length) {
    const items = obligs
      .map(
        (id) => `<li style="margin:2px 0;font-family:var(--mono);font-size:12px;">${esc(id)}</li>`,
      )
      .join("");
    obliguBlock = `<div style="margin-top:18px;"><strong style="font-size:12.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);">Linked obligations</strong><ul style="margin:6px 0 0 1.2em;padding:0;">${items}</ul></div>`;
  }
  return `<div style="padding:4px 0 12px;">
    <table style="border-collapse:collapse;width:100%;font-size:13.5px;">${metaRows}</table>
    ${obliguBlock}
    <p style="margin-top:20px;font-size:12px;color:var(--text-muted);">No standalone policy document on file. Full register: <a href="/api/policy/${encodeURIComponent(POLICY_REGISTER_BASENAME)}" target="_blank" rel="noopener">${esc(POLICY_REGISTER_BASENAME)}</a></p>
  </div>`;
}

async function openPolicyPreview(policyId, preferredFilename) {
  const p = allPolicies.find((x) => x.id === policyId);
  if (!p) return;

  const modal = $("policyPreviewModal");
  const titleEl = $("policyPreviewTitle");
  const bodyEl = $("policyPreviewBody");
  const pathEl = $("policyPreviewPath");
  const pickerEl = $("policyPreviewSourcePicker");
  if (!modal || !bodyEl) return;
  if (titleEl) titleEl.textContent = p.name;

  // Explicit files are those beyond the fallback register. If there are none,
  // skip the fetch and render the policy card directly from in-memory data.
  const explicit = explicitSourceFiles(p);
  if (explicit.length === 0 && !preferredFilename) {
    if (pathEl) pathEl.textContent = "Synthesised from policy register";
    if (pickerEl) {
      pickerEl.hidden = true;
      pickerEl.innerHTML = "";
    }
    bodyEl.innerHTML = renderPolicyCard(p);
    modal.hidden = false;
    return;
  }

  const sources = explicit.length ? explicit : (p.sourceFiles ?? []);
  const filename =
    preferredFilename && sources.includes(preferredFilename) ? preferredFilename : sources[0];
  if (!filename) return;
  policyPreviewActive = `${p.id}::${filename}`;

  if (pathEl) {
    pathEl.textContent = filename.startsWith("Policies/") ? filename : `Owner Inbox/${filename}`;
  }

  if (pickerEl) {
    if (sources.length > 1) {
      pickerEl.hidden = false;
      const links = sources
        .map(
          (f) =>
            `<a href="/api/policy/${encodeURIComponent(f)}" class="pol-preview-source-pick${f === filename ? " is-active" : ""}" data-source-file="${esc(f)}" data-policy-id="${esc(p.id)}"><code>${esc(f)}</code></a>`,
        )
        .join(" · ");
      pickerEl.innerHTML = `<span class="muted" style="margin-right:6px;">Source:</span>${links}`;
    } else {
      pickerEl.hidden = true;
      pickerEl.innerHTML = "";
    }
  }

  bodyEl.innerHTML = `<div class="muted" style="padding: 24px;">Loading…</div>`;
  modal.hidden = false;
  try {
    const r = await fetch(`/api/policy/${encodeURIComponent(filename)}`);
    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(`HTTP ${r.status}: ${errBody.slice(0, 240)}`);
    }
    const md = await r.text();
    if (policyPreviewActive !== `${p.id}::${filename}`) return;
    bodyEl.innerHTML = renderMarkdownLite(md);
  } catch (err) {
    if (policyPreviewActive !== `${p.id}::${filename}`) return;
    bodyEl.innerHTML = `<div class="error" style="padding:14px;">Could not load preview: ${esc(err.message ?? err)}</div>`;
  }
}

function closePolicyPreview() {
  const modal = $("policyPreviewModal");
  if (modal) modal.hidden = true;
  policyPreviewActive = null;
}

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
    let s = esc(line);
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
        out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
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
    out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  }
  closeList();
  closeTable();
  return out.join("\n");
}

function wirePreviewLinks() {
  // One delegated listener on the table body. Preserves middle-click /
  // cmd-click navigation (which doesn't fire `click` with default-prevented
  // semantics) while intercepting the primary click to open the modal.
  // Mirrors `wirePreviewLinks` in procedures.js.
  const target = $("policiesBody");
  if (target) {
    target.addEventListener("click", (e) => {
      const link = e.target.closest("a.pol-preview-link");
      if (!link) return;
      if (link.classList.contains("pol-preview-link-disabled")) {
        e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      e.preventDefault();
      e.stopPropagation();
      openPolicyPreview(link.dataset.policyId);
    });
  }
  // Source-picker links inside the modal head — same intercept rules.
  const picker = $("policyPreviewSourcePicker");
  if (picker) {
    picker.addEventListener("click", (e) => {
      const link = e.target.closest("a.pol-preview-source-pick");
      if (!link) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      e.preventDefault();
      openPolicyPreview(link.dataset.policyId, link.dataset.sourceFile);
    });
  }
}

function wirePreviewModal() {
  const closeBtn = $("policyPreviewClose");
  if (closeBtn) closeBtn.addEventListener("click", closePolicyPreview);
  const modal = $("policyPreviewModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closePolicyPreview();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = $("policyPreviewModal");
    if (m && !m.hidden) closePolicyPreview();
  });
}

// ---------------------------------------------------------------------------
// Obligation hydration — the /api/state response carries obligation IDs in
// each policy's linkedObligations array; we also need each obligation's
// citation / requirement / status text to populate the drilldown table.
// /api/obligations isn't a real endpoint yet — we fetch the register file
// directly via a one-off /api/state-side lookup map.
//
// Implementation: keep the obligationDetailById map populated from a manual
// re-parse of the register file the dashboard server already exposes via
// /Regulations/_obligations-register.md. Falls back to {} on failure.
// ---------------------------------------------------------------------------

async function hydrateObligations() {
  try {
    const r = await fetch("/api/obligations", { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    obligationDetailById = data.byId ?? {};
  } catch {
    // Drilldown still works; cells just show "?" for citation/requirement.
  }
}

async function loadProcedures() {
  try {
    const r = await fetch("/api/procedures", { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    // Flatten grouped structure into a single array of rows.
    const rows = [];
    for (const g of data.groups ?? []) {
      for (const row of g.rows ?? []) {
        rows.push(row);
      }
    }
    allProcedures = rows;
  } catch {
    // Drilldown still works; procedures section shows empty.
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  try {
    const [stateR] = await Promise.all([fetch("/api/state", { cache: "no-store" })]);
    if (!stateR.ok) throw new Error(`HTTP ${stateR.status}`);
    const state = await stateR.json();
    allPolicies = state.policies ?? [];
    await Promise.all([hydrateObligations(), loadProcedures()]);
    renderSummary(allPolicies);
    if (!$("filterDomain").options.length || $("filterDomain").options.length === 1) {
      populateDomainFilter(allPolicies);
    }
    refresh();
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(state.asOf)}`;

    // Auto-open drilldown from ?policy= query param (only on first load).
    const params = new URLSearchParams(location.search);
    const targetPolicy = params.get("policy");
    if (targetPolicy) {
      const match = allPolicies.find((p) => p.name === targetPolicy || p.id === targetPolicy);
      if (match) openDrill(match.id);
    }
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

function wireFilters() {
  for (const id of ["filterDomain", "filterStatus", "filterSource", "filterBind", "filterMvp"]) {
    $(id).addEventListener("change", refresh);
  }
  $("filterSearch").addEventListener("input", refresh);
}

function wireDrill() {
  for (const e of document.querySelectorAll("#policyDrill [data-close]")) {
    e.addEventListener("click", closeDrill);
  }
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeDrill();
  });
}

wireFilters();
wireDrill();
wirePreviewLinks();
wirePreviewModal();
load();
if (typeof window.registerPagePoll === "function") {
  window.registerPagePoll(load, 30_000);
} else {
  setInterval(load, 30_000);
}
