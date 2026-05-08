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
let allObligations = []; // computed from policies' linkedObligations + the obligation register-derived data we have
let obligationDetailById = {}; // populated via /api/state's obligations metadata, see hydrateObligations

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
    const an = parseInt(a, 10);
    const bn = parseInt(b, 10);
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
    sub.textContent = "0 of " + allPolicies.length;
    return;
  }
  sub.textContent = `${policies.length} of ${allPolicies.length}`;
  body.innerHTML = policies
    .map(
      (p) => `
    <tr class="pol-row" data-policy-id="${esc(p.id)}">
      <td class="col-name">
        ${p.mvp ? '<span class="pol-mvp" title="MVP — required for SARB licence application">★</span>' : ""}
        <span class="pol-name">${esc(p.name)}</span>
      </td>
      <td class="col-domain">${esc(p.domain)}</td>
      <td class="col-owner">${esc(p.owner)}</td>
      <td class="col-approval">${esc(p.approval)}</td>
      <td class="col-source">${sourceBadges(p.sources)}</td>
      <td class="col-bind">${bindBadges(p.binds)}</td>
      <td class="col-status"><span class="pol-status ${statusClass(p.status)}">${esc(p.status)}</span></td>
      <td class="col-obligs">${p.linkedObligations.length}</td>
    </tr>`,
    )
    .join("");
  for (const tr of document.querySelectorAll("#policiesBody .pol-row")) {
    tr.addEventListener("click", () => openDrill(tr.dataset.policyId));
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
    (byDomain[prefix] ??= []).push(o);
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
    await hydrateObligations();
    renderSummary(allPolicies);
    if (!$("filterDomain").options.length || $("filterDomain").options.length === 1) {
      populateDomainFilter(allPolicies);
    }
    refresh();
    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(state.asOf)}`;
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
load();
setInterval(load, 30_000);
