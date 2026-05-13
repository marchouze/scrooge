// dashboard/public/obligations.js
//
// Obligations register page — surfaces every ORG-* obligation, the
// breakdown by source-instrument family / bind / status, the
// Principle-6 citation-chain map (Reg → Policy → Procedure → System
// Capability) as a Mermaid graph, and the citation-integrity findings
// (the "no orphans" rule made visible).
//
// Per CLAUDE.md Principle 1: every datum on this page is derived from
// /api/obligations (parsed live from Regulations/_obligations-register.md)
// or /api/state (for the policy-side cross-reference). No hand-authored
// content; on register update, Mira's curated changes flow through here
// at the next dashboard refresh tick.
//
// Per Principle 6: the citation map is a *single* graph from regulator to
// system capability. Where an obligation lacks a linked policy, the chain
// terminates at the obligation node and the row is flagged on the
// Citation-integrity findings panel. The page never invents citations.
//
// Author: Anya (data) · Atlas (substrate seam: /api/obligations)

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

function bindClass(bind) {
  if (!bind) return "";
  return "oblig-tag oblig-tag-bind";
}

function sourceClass(source) {
  if (!source) return "oblig-tag";
  return `oblig-tag oblig-tag-source-${source.toLowerCase()}`;
}

function statusClass(status) {
  const s = status.toLowerCase().replace(/[^a-z]/g, "");
  if (s.includes("inforce") || s === "inforce") return "oblig-tag status-in-force";
  if (s.includes("partial")) return "oblig-tag status-partial";
  if (s.includes("draft")) return "oblig-tag status-drafting";
  if (s.includes("planned")) return "oblig-tag status-planned";
  if (s.includes("notapplicable") || s.includes("nyet") || s.includes("prelicence"))
    return "oblig-tag status-not-applicable";
  if (s.includes("deferred") || s.includes("wave")) return "oblig-tag status-deferred";
  if (s.includes("superseded")) return "oblig-tag status-superseded";
  return "oblig-tag";
}

function urnDisplay(o) {
  // Show URN if it has content and isn't a placeholder; fall back to ID.
  const u = (o.urn || "").trim();
  return u && u !== "[TBD]" ? u : o.id;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let allObligations = []; // array of detail objects
let view = null; // raw /api/obligations response
let policiesByName = new Map(); // policy-name → policy object (for citation cross-ref)

function applyFilters() {
  const fFamily = $("filterFamily").value;
  const fBind = $("filterBind").value;
  const fStatus = $("filterStatus").value;
  const fChain = $("filterChain").value;
  const fSearch = $("filterSearch").value.trim().toLowerCase();

  return allObligations.filter((o) => {
    if (fFamily && o.family !== fFamily) return false;
    if (fBind) {
      const bindKey = o.bind || "UNCLASSIFIED";
      if (bindKey !== fBind) return false;
    }
    if (fStatus) {
      const statusKey = (o.status || "").toUpperCase();
      if (!statusKey.includes(fStatus.toUpperCase())) return false;
    }
    if (fChain === "COMPLETE" && (o.gaps?.length ?? 0) > 0) return false;
    if (fChain === "GAP" && (o.gaps?.length ?? 0) === 0) return false;
    if (fChain && fChain !== "COMPLETE" && fChain !== "GAP") {
      if (!(o.gaps ?? []).includes(fChain)) return false;
    }
    if (fSearch) {
      const hay = [o.id, o.citation, o.requirement, o.fulfilment, o.owner, o.family]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(fSearch)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Renderers — top cards + family / bind / status histograms
// ---------------------------------------------------------------------------

function renderSummary() {
  if (!view) return;
  const total = view.count;
  const withGap = allObligations.filter((o) => (o.gaps ?? []).length > 0).length;
  const noFul = allObligations.filter((o) => (o.gaps ?? []).includes("NO-FULFILMENT")).length;
  const familyCount = Object.keys(view.familyCounts ?? {}).length;
  const inForce = allObligations.filter((o) => /IN FORCE/i.test(o.status)).length;
  const partial = allObligations.filter((o) => /PARTIAL/i.test(o.status)).length;

  $("obligSummarySub").textContent =
    `${total} obligation${total === 1 ? "" : "s"} across ${familyCount} source-instrument famil${familyCount === 1 ? "y" : "ies"}`;
  $("obligSummary").innerHTML = `
    <div class="oblig-card">
      <div class="oblig-card-num">${total}</div>
      <div class="oblig-card-lbl">Total obligations</div>
      <div class="oblig-card-sub">Mira-curated · v1.3</div>
    </div>
    <div class="oblig-card">
      <div class="oblig-card-num">${familyCount}</div>
      <div class="oblig-card-lbl">Source families</div>
      <div class="oblig-card-sub">Banks Act · BCBS · FIC · FAIS · POPIA · …</div>
    </div>
    <div class="oblig-card">
      <div class="oblig-card-num">${inForce}</div>
      <div class="oblig-card-lbl">IN FORCE</div>
    </div>
    <div class="oblig-card">
      <div class="oblig-card-num">${partial}</div>
      <div class="oblig-card-lbl">PARTIAL</div>
    </div>
    <div class="oblig-card">
      <div class="oblig-card-num">${withGap}</div>
      <div class="oblig-card-lbl">Chain gap</div>
      <div class="oblig-card-sub">at least one finding</div>
    </div>
    <div class="oblig-card">
      <div class="oblig-card-num">${noFul}</div>
      <div class="oblig-card-lbl">No fulfilment policy</div>
      <div class="oblig-card-sub">register-level orphan</div>
    </div>
  `;
}

function renderHistograms() {
  if (!view) return;
  const fam = $("obligFamilyList");
  const bind = $("obligBindList");
  const stat = $("obligStatusList");

  const famSorted = Object.entries(view.familyCounts ?? {}).sort((a, b) => b[1] - a[1]);
  fam.innerHTML = famSorted
    .map(
      ([k, v]) => `<span class="oblig-chip"><b>${esc(k)}</b><span class="muted">${v}</span></span>`,
    )
    .join("");

  const bindOrder = ["CORPORATE", "LICENCE", "COMMENCEMENT", "CONDITIONAL", "UNCLASSIFIED"];
  const bindSorted = Object.entries(view.bindCounts ?? {}).sort(
    (a, b) => bindOrder.indexOf(a[0]) - bindOrder.indexOf(b[0]),
  );
  bind.innerHTML = bindSorted
    .map(
      ([k, v]) => `<span class="oblig-chip"><b>${esc(k)}</b><span class="muted">${v}</span></span>`,
    )
    .join("");

  const statSorted = Object.entries(view.statusCounts ?? {}).sort((a, b) => b[1] - a[1]);
  stat.innerHTML = statSorted
    .map(
      ([k, v]) => `<span class="oblig-chip"><b>${esc(k)}</b><span class="muted">${v}</span></span>`,
    )
    .join("");
}

function populateFamilyFilter() {
  const sel = $("filterFamily");
  const families = Array.from(new Set(allObligations.map((o) => o.family))).sort();
  for (const f of families) {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    sel.appendChild(opt);
  }
}

// ---------------------------------------------------------------------------
// Renderers — main filterable table
// ---------------------------------------------------------------------------

function renderTable(rows) {
  const body = $("obligBody");
  const sub = $("obligListSub");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6" style="padding:18px;text-align:center;color:var(--neutral-stone)">No obligations match the current filter.</td></tr>`;
    sub.textContent = `0 of ${allObligations.length}`;
    return;
  }
  sub.textContent = `${rows.length} of ${allObligations.length}`;
  body.innerHTML = rows
    .map((o) => {
      const gapClass = (o.gaps ?? []).length > 0 ? "oblig-gap-row" : "";
      const bindHtml = o.bind
        ? `<span class="oblig-tag oblig-tag-bind" style="white-space:nowrap">${esc(o.bind)}</span>`
        : '<span style="color:var(--neutral-stone);font-size:11px;">—</span>';
      const famHtml =
        o.family && o.family !== "OTHER"
          ? `<button class="oblig-reg-btn" data-family="${esc(o.family)}">${esc(o.family)}</button>`
          : '<span style="color:var(--neutral-stone);font-size:11px;">—</span>';
      const linkedHtml =
        (o.linkedPolicies ?? []).length === 0
          ? '<span style="color:var(--neutral-stone);font-size:11px;">—</span>'
          : (o.linkedPolicies ?? [])
              .map(
                (p) =>
                  `<a href="policies.html?policy=${encodeURIComponent(p)}" class="oblig-tag oblig-policy-link">${esc(p)}</a>`,
              )
              .join(" ");
      const statusHtml = o.status
        ? `<span class="${statusClass(o.status)}">${esc(o.status)}</span>`
        : '<span style="color:var(--neutral-stone)">—</span>';
      return `
      <tr class="${gapClass}">
        <td><button class="oblig-id-btn" data-id="${esc(o.id)}">${esc(urnDisplay(o))}</button></td>
        <td>${bindHtml}</td>
        <td>${famHtml}</td>
        <td>${esc(o.requirement)}</td>
        <td>${linkedHtml}</td>
        <td>${statusHtml}</td>
      </tr>`;
    })
    .join("");

  for (const btn of body.querySelectorAll(".oblig-id-btn")) {
    btn.addEventListener("click", () => openDrawer(btn.dataset.id));
  }
  for (const btn of body.querySelectorAll(".oblig-reg-btn")) {
    btn.addEventListener("click", () => drillToFamily(btn.dataset.family));
  }
}

// ---------------------------------------------------------------------------
// Renderers — citation-integrity findings panel
// ---------------------------------------------------------------------------

function renderFindings() {
  const findings = allObligations.filter((o) => (o.gaps ?? []).length > 0);
  const badge = $("obligFindingsBadge");
  if (badge) badge.textContent = findings.length ? `${findings.length} findings` : "none";
  const summary = $("obligFindingsSummary");
  const noFul = findings.filter((o) => o.gaps.includes("NO-FULFILMENT")).length;
  const noOwn = findings.filter((o) => o.gaps.includes("NO-OWNER")).length;
  const noFam = findings.filter((o) => o.gaps.includes("NO-FAMILY")).length;
  summary.innerHTML = `
    <b>${findings.length}</b> obligation${findings.length === 1 ? "" : "s"} with at least one chain gap ·
    <b>${noFul}</b> NO-FULFILMENT ·
    <b>${noOwn}</b> NO-OWNER ·
    <b>${noFam}</b> NO-FAMILY
  `;
  const body = $("obligFindingsBody");
  if (!findings.length) {
    body.innerHTML = `<tr><td colspan="4" style="padding:18px;text-align:center;color:var(--neutral-stone)">No findings — every obligation has a complete chain at the register layer.</td></tr>`;
    return;
  }
  body.innerHTML = findings
    .map(
      (o) => `
    <tr class="oblig-gap-row">
      <td><button class="oblig-id-btn" data-id="${esc(o.id)}">${esc(o.id)}</button></td>
      <td>${esc(o.citation)}</td>
      <td>${esc(o.requirement)}</td>
      <td>${o.gaps.map((g) => `<span class="oblig-gap-flag">${esc(g)}</span>`).join(" ")}</td>
    </tr>`,
    )
    .join("");

  for (const btn of body.querySelectorAll(".oblig-id-btn")) {
    btn.addEventListener("click", () => openDrawer(btn.dataset.id));
  }
}

// ---------------------------------------------------------------------------
// Mermaid citation map.
//
// We render a single `flowchart LR` with one subgraph per source-instrument
// family. Inside each family, we list its obligations (capped per family so
// the diagram stays readable) and fan each obligation out to its linked-
// policy node(s). Obligations without a fulfilment policy carry a dashed
// edge to a "GAP" sink so the no-orphans rule is visible at a glance.
//
// To keep v0 dense-but-renderable, we cap at OBLIG_PER_FAMILY obligations
// per subgraph and at FAMILY_CAP families overall. Families beyond the cap
// roll into an "OTHER families" subgraph that lists counts only.
// ---------------------------------------------------------------------------

const OBLIG_PER_FAMILY = 6;
const FAMILY_CAP = 8;

function nodeId(prefix, key) {
  // Strip everything but ASCII letters/digits to build a Mermaid-safe id.
  return `${prefix}_${String(key).replace(/[^a-zA-Z0-9]/g, "")}`;
}

function buildMermaid() {
  if (!view) return 'flowchart LR\n  empty["no data"]';
  // Group obligations by family.
  const byFamily = new Map();
  for (const o of allObligations) {
    if (!byFamily.has(o.family)) byFamily.set(o.family, []);
    byFamily.get(o.family).push(o);
  }
  const families = Array.from(byFamily.entries()).sort((a, b) => b[1].length - a[1].length);
  const top = families.slice(0, FAMILY_CAP);
  const tail = families.slice(FAMILY_CAP);

  const lines = [
    "flowchart LR",
    "  classDef family fill:#fff8e1,stroke:#caa83b,color:#5a4400",
    "  classDef oblig  fill:#e3f2fd,stroke:#2473b9,color:#1c4d80",
    "  classDef policy fill:#f1f8e9,stroke:#5b8a3a,color:#3d6024",
    "  classDef proc   fill:#fce4ec,stroke:#a23a6f,color:#7c2956",
    "  classDef cap    fill:#ede7f6,stroke:#5c4ba0,color:#3d316d",
    "  classDef gap    fill:#fbe9e7,stroke:#c0392b,color:#7d1e10,stroke-dasharray: 4 3",
  ];

  // Stable lanes for procedure / capability layer — these are the steady-state
  // sinks that any policy ultimately fans out to per Principle 6's upward
  // chain. v0 does not author per-policy procedure/capability mappings on
  // this page; the lanes are placeholders that the substrate-gap callout in
  // the Citation-integrity findings panel names explicitly.
  lines.push('  PROC["Procedures<br/>(Procedures/_index.md)"]:::proc');
  lines.push('  CAP["System capabilities<br/>(prototype/runtime/handlers-*)"]:::cap');

  // Track policy nodes once per page (a policy implements multiple obligations
  // so the same node should be reused).
  const policyNodes = new Set();
  const policyEdges = new Set();
  let gapNodeAdded = false;

  for (const [family, obligs] of top) {
    const famId = nodeId("F", family);
    lines.push(`  subgraph ${famId}["${esc(family)} (${obligs.length})"]`);
    lines.push("    direction TB");
    const slice = obligs.slice(0, OBLIG_PER_FAMILY);
    for (const o of slice) {
      const oid = nodeId("O", o.id);
      lines.push(`    ${oid}["${esc(o.id)}"]:::oblig`);
    }
    if (obligs.length > OBLIG_PER_FAMILY) {
      const moreId = `${famId}_more`;
      lines.push(`    ${moreId}["… +${obligs.length - OBLIG_PER_FAMILY} more"]:::oblig`);
    }
    lines.push("  end");

    // Fan obligations out to policies (or to GAP).
    for (const o of obligs.slice(0, OBLIG_PER_FAMILY)) {
      const oid = nodeId("O", o.id);
      if ((o.linkedPolicies ?? []).length === 0) {
        if (!gapNodeAdded) {
          lines.push('  GAP["⚠ no fulfilment policy"]:::gap');
          gapNodeAdded = true;
        }
        lines.push(`  ${oid} -.-> GAP`);
      } else {
        for (const p of o.linkedPolicies) {
          const pid = nodeId("P", p);
          if (!policyNodes.has(pid)) {
            policyNodes.add(pid);
            lines.push(`  ${pid}["${esc(p)}"]:::policy`);
          }
          const edgeKey = `${oid}->${pid}`;
          if (!policyEdges.has(edgeKey)) {
            policyEdges.add(edgeKey);
            lines.push(`  ${oid} --> ${pid}`);
          }
        }
      }
    }
  }

  // Tail — collapse remaining families into one bucket.
  if (tail.length > 0) {
    const tailCount = tail.reduce((acc, [, list]) => acc + list.length, 0);
    lines.push(
      `  TAIL["… +${tail.length} more famil${tail.length === 1 ? "y" : "ies"} (${tailCount} obligations)"]:::family`,
    );
  }

  // Wire all policy nodes into the procedure / capability lanes (single edge each).
  for (const pid of policyNodes) {
    lines.push(`  ${pid} --> PROC`);
  }
  lines.push("  PROC --> CAP");

  return lines.join("\n");
}

async function renderMermaid() {
  const target = $("obligMap");
  const code = buildMermaid();
  // Mermaid v10 idiom: render to SVG and inject.
  try {
    const id = `obligMap_${Date.now()}`;
    const { svg } = await window.mermaid.render(id, code);
    target.innerHTML = svg;
  } catch (err) {
    target.innerHTML = `<pre class="muted" style="font-size:11px;white-space:pre-wrap;">Mermaid render failed:\n${esc(err?.message ?? String(err))}\n\n--- source ---\n${esc(code)}</pre>`;
  }
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

function openDrawer(id) {
  const o = allObligations.find((x) => x.id === id);
  if (!o) return;

  $("drawerTitle").textContent = o.id;

  const chainHtml =
    (o.gaps ?? []).length === 0
      ? '<span class="oblig-tag status-in-force">COMPLETE</span>'
      : (o.gaps ?? []).map((g) => `<span class="oblig-gap-flag">${esc(g)}</span>`).join(" ");

  const linkedHtml =
    (o.linkedPolicies ?? []).length === 0
      ? '<span class="muted">—</span>'
      : (o.linkedPolicies ?? [])
          .map(
            (p) =>
              `<a href="policies.html?policy=${encodeURIComponent(p)}" class="oblig-tag oblig-policy-link">${esc(p)}</a>`,
          )
          .join(" ");

  function row(label, value) {
    return `<dt>${esc(label)}</dt><dd>${value}</dd>`;
  }
  function txt(value) {
    return value ? esc(value) : '<span class="muted">—</span>';
  }

  $("drawerBody").innerHTML = [
    row("ID", `<code>${esc(o.id)}</code>`),
    row(
      "URN",
      o.urn && o.urn !== "[TBD]"
        ? `<code>${esc(o.urn)}</code>`
        : '<span class="muted">[TBD]</span>',
    ),
    row("Citation", txt(o.citation)),
    row("Requirement", txt(o.requirement)),
    row("Fulfilment policy", linkedHtml),
    row("Owner", txt(o.owner)),
    row(
      "Status",
      o.status
        ? `<span class="${statusClass(o.status)}">${esc(o.status)}</span>`
        : '<span class="muted">—</span>',
    ),
    row(
      "Source family",
      o.family
        ? `<button class="oblig-reg-btn" data-family="${esc(o.family)}">${esc(o.family)}</button>`
        : '<span class="muted">—</span>',
    ),
    row(
      "Bind",
      o.bind
        ? `<span class="${bindClass(o.bind)}">${esc(o.bind)}</span>`
        : '<span class="muted">—</span>',
    ),
    row(
      "Source type",
      o.source
        ? `<span class="${sourceClass(o.source)}">${esc(o.source)}</span>`
        : '<span class="muted">—</span>',
    ),
    row(
      "Risk taxonomy",
      o.riskTaxonomy ? `<code>${esc(o.riskTaxonomy)}</code>` : '<span class="muted">—</span>',
    ),
    row("Citation chain", chainHtml),
  ].join("");

  $("drawerOverlay").classList.add("open");

  // Wire source-family drill-through: close drawer and filter table.
  const famBtn = $("drawerBody").querySelector(".oblig-reg-btn");
  if (famBtn) {
    famBtn.addEventListener("click", () => {
      closeDrawer();
      drillToFamily(famBtn.dataset.family);
    });
  }
}

function closeDrawer() {
  $("drawerOverlay").classList.remove("open");
}

// ---------------------------------------------------------------------------
// Regulation drill-down
// ---------------------------------------------------------------------------

function drillToFamily(family) {
  const sel = $("filterFamily");
  if (!sel) return;
  // Find or create the option for this family.
  let found = false;
  for (const opt of sel.options) {
    if (opt.value === family) {
      found = true;
      break;
    }
  }
  if (!found) {
    const opt = document.createElement("option");
    opt.value = family;
    opt.textContent = family;
    sel.appendChild(opt);
  }
  sel.value = family;
  refresh();
  // Scroll back to top of table.
  $("obligTable")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------------
// Refresh dispatch
// ---------------------------------------------------------------------------

function refresh() {
  const filtered = applyFilters();
  renderTable(filtered);
}

// ---------------------------------------------------------------------------
// Wiring — fetch /api/obligations + /api/state
// ---------------------------------------------------------------------------

async function load() {
  const stamp = $("lastUpdated");
  try {
    const [obR, stR] = await Promise.all([
      fetch("/api/obligations", { cache: "no-store" }),
      fetch("/api/state", { cache: "no-store" }),
    ]);
    if (!obR.ok) throw new Error(`obligations HTTP ${obR.status}`);
    view = await obR.json();
    allObligations = Object.values(view.byId ?? {});

    if (stR.ok) {
      const state = await stR.json();
      policiesByName = new Map();
      for (const p of state.policies ?? []) {
        policiesByName.set(p.name, p);
      }
    }

    renderSummary();
    renderHistograms();
    if ($("filterFamily").options.length <= 1) populateFamilyFilter();
    refresh();
    renderFindings();
    // Mermaid renders lazily when the panel is opened (see panelMap listener below).

    stamp.textContent = `Updated ${fmtDate(view.asOf)}`;
  } catch (e) {
    stamp.textContent = `Offline (${e.message})`;
  }
}

function wireFilters() {
  for (const id of ["filterFamily", "filterBind", "filterStatus", "filterChain"]) {
    $(id).addEventListener("change", refresh);
  }
  $("filterSearch").addEventListener("input", refresh);
  // Refresh button.
  const btn = $("refreshBtn");
  if (btn) btn.addEventListener("click", load);
  // Lazy Mermaid — render only when the map panel is first opened.
  let mermaidRendered = false;
  const mapPanel = $("panelMap");
  if (mapPanel) {
    mapPanel.addEventListener("toggle", async () => {
      if (mapPanel.open && !mermaidRendered) {
        mermaidRendered = true;
        await renderMermaid();
      }
    });
  }
}

// Mermaid initialisation — same pattern as architecture.html.
window.mermaid?.initialize({
  startOnLoad: false, // we render manually after fetch
  theme: "default",
  flowchart: { htmlLabels: true, curve: "linear" },
  themeVariables: {
    fontSize: "12px",
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  },
});

wireFilters();

// Drawer close wiring.
$("drawerClose").addEventListener("click", closeDrawer);
$("drawerOverlay").addEventListener("click", (e) => {
  if (e.target === $("drawerOverlay")) closeDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

load();
setInterval(load, 30_000);
