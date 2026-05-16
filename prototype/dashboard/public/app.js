// dashboard/public/app.js
//
// Front-end logic for the bank operations dashboard.
//   - Polls /api/state every 8s.
//   - Renders the dashboard from the returned state.
//   - Lets the CEO record decisions via a modal that POSTs /api/decide.

const POLL_MS = 8000;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

let lastState = null;
let activeDecisionId = null;

async function fetchState() {
  try {
    const r = await fetch("/api/state", { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const state = await r.json();
    lastState = state;
    render(state);
    setLive(true);
  } catch (e) {
    setLive(false);
    console.error("fetchState failed", e);
  }
}

function setLive(ok) {
  const dot = $("#liveDot");
  const last = $("#lastUpdated");
  if (!dot || !last) return;
  dot.classList.toggle("stale", !ok);
  if (!ok) {
    last.textContent = "lost connection — retrying";
    return;
  }
  const ts = new Date(lastState.asOf);
  last.textContent = `as of ${ts.toLocaleString("en-ZA", { hour12: false })} · live`;
}

function renderStrategyBanner(state) {
  const banner = $("#strategyBanner");
  if (!banner) return;
  const phase = state.bank?.operatingPosture ?? "—";
  const openCount = (state.decisionsOpen ?? []).length;
  const agentCount = (state.agents ?? []).length;
  banner.innerHTML = `<span class="banner-phase">Phase: ${esc(phase)}</span><span class="banner-sep"> · </span><span>${openCount} CEO decision${openCount === 1 ? "" : "s"} open</span><span class="banner-sep"> · </span><span>${agentCount} agent${agentCount === 1 ? "" : "s"} reporting</span>`;
}

function render(state) {
  renderStrategyBanner(state);
  renderHero(state);
  renderDecisionsOpen(state.decisionsOpen);
  renderOwnerInbox(state.ownerInboxFeed ?? []);
  renderDecisionsResolved(state.decisionsResolved);
  renderInFlight(state.inFlight);
  renderDirectReports(state.directReports);
  renderOpenSeats(state.openSeats);
  renderPrinciples(state.principles);
  renderPrototype(state.prototype);
  renderRisks(state.risks);
  renderFindings(state.findings ?? []);
  $("#decisionsSub").textContent =
    `${state.decisionsOpen.length} open · ${state.decisionsResolved.length} resolved`;
}

function renderFindings(findings) {
  const root = $("#findings");
  if (!root) return;
  root.innerHTML = "";
  const sub = $("#findingsSub");
  if (sub) sub.textContent = `${findings.length} open`;
  if (findings.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No open findings.";
    root.appendChild(li);
    return;
  }
  // Sort: critical → high → medium → low; then most-recent first.
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...findings].sort((a, b) => {
    const sa = sevOrder[a.severity] ?? 9;
    const sb = sevOrder[b.severity] ?? 9;
    if (sa !== sb) return sa - sb;
    return a.asOf < b.asOf ? 1 : -1;
  });
  for (const f of sorted) {
    const li = document.createElement("li");
    li.className = `finding finding-${f.severity}`;
    const head = document.createElement("div");
    head.className = "finding-head";
    const sevTag = document.createElement("span");
    sevTag.className = `finding-sev finding-sev-${f.severity}`;
    sevTag.textContent = f.severity.toUpperCase();
    head.appendChild(sevTag);
    if (f.principle) {
      const pTag = document.createElement("span");
      pTag.className = "finding-principle";
      pTag.textContent = f.principle;
      head.appendChild(pTag);
    }
    const dateTag = document.createElement("span");
    dateTag.className = "muted small";
    dateTag.textContent = f.asOf.slice(0, 10);
    head.appendChild(dateTag);
    li.appendChild(head);
    const body = document.createElement("div");
    body.className = "finding-body";
    body.textContent = f.description;
    li.appendChild(body);
    const meta = document.createElement("div");
    meta.className = "muted small";
    meta.textContent = `Source: ${f.source}`;
    li.appendChild(meta);
    root.appendChild(li);
  }
}

function renderHero(state) {
  const m = state.bank.metrics;
  const sf = state.bank.strategicFoundation;
  const tiles = [
    { num: m.principles, lbl: "Principles" },
    { num: m.policies, lbl: "Policies" },
    { num: m.obligations, lbl: "Obligations" },
    {
      num: m.proceduresPopulated,
      lbl: `Procedures (of ~${m.proceduresPlanned + m.proceduresPopulated})`,
    },
    { num: m.directReports, lbl: "Direct reports" },
    { num: m.openGovernanceSeats, lbl: "Open gov seats" },
  ];
  $("#hero").innerHTML = `
    <div class="eyebrow">${esc(state.bank.operatingPosture)}</div>
    <h1>${esc(state.bank.name)} — ${esc(sf.type)}</h1>
    <p class="lede">
      ${esc(sf.products.join(" · "))} · for ${esc(sf.clients.join(", "))} ·
      ${esc(sf.geography)} · ${esc(sf.capital)} · ${esc(sf.licence)}.
      Cloud target: ${esc(state.bank.cloudTarget)}.
    </p>
    <div class="tiles">
      ${tiles
        .map(
          (t) => `
        <div class="tile">
          <span class="num">${esc(t.num)}</span>
          <span class="lbl">${esc(t.lbl)}</span>
        </div>`,
        )
        .join("")}
    </div>
  `;
}

function renderDecisionsOpen(decisions) {
  if (!decisions.length) {
    $("#decisionsOpen").innerHTML =
      `<div class="muted" style="grid-column: 1 / -1; padding: 12px;">No open decisions.</div>`;
    return;
  }
  const commentsByDecision = lastState?.decisionComments ?? {};
  $("#decisionsOpen").innerHTML = decisions
    .map((d) => {
      const ccount = (commentsByDecision[d.id] ?? []).length;
      return `
    <div class="dcard cat-${esc(d.category)}">
      <div class="head">
        <span class="id">${esc(d.id)}</span>
        <h3>${esc(d.title)}</h3>
        <span class="cat-pill">${esc(d.category)}</span>
      </div>
      <div class="body">
        ${d.brief?.summary ? `<div class="summary-line">${esc(d.brief.summary)}</div>` : ""}
        <div class="row"><b>Owner</b>${esc(d.owner)}</div>
        <div class="row"><b>Timeline</b>${esc(d.brief?.timeline ?? d.trigger)}</div>
        <div class="row"><b>For CEO</b>${esc(d.decisionForCEO)}</div>
        ${
          d.recommendation?.stance
            ? `<div class="note"><b>Recommendation</b> ${esc(d.recommendation.stance)}${d.recommendation.reasoning ? ` ${esc(d.recommendation.reasoning)}` : ""}</div>`
            : d.note
              ? `<div class="note">${esc(d.note)}</div>`
              : ""
        }
        ${ccount > 0 ? `<div class="comment-badge">💬 ${ccount} comment${ccount === 1 ? "" : "s"}</div>` : ""}
      </div>
      <div class="review-btn">
        <button class="btn-primary" data-brief-open="${esc(d.id)}">Review brief →</button>
      </div>
    </div>
  `;
    })
    .join("");

  // Wire "Review brief" buttons
  for (const btn of $$(".dcard .review-btn button")) {
    btn.addEventListener("click", () => openBrief(btn.dataset.briefOpen));
  }
}

// ---------- Owner Inbox feed ----------
//
// Polish authored by Anya (Data / analytics engineer, engineering) on top of
// the grouping work done by Anya + Atlas (Core banking platform architect,
// engineering) on 2026-05-10. The feed must stay scannable as autonomous
// agent runs scale from "few items per day" to "dozens per scheduler tick"
// (S8 Tier 1 substrate). Polish moves: date sub-grouping (Today / Yesterday /
// Earlier this week / Older); author chip with role pulled from
// state.agents (single source — never hand-list reports); decision-id tag
// extracted from filename / displayTitle; "Show older" pagination per
// (group × bucket); inline-preview modal for informational items via
// /api/owner-inbox/:filename; density toggle persisted to localStorage.
//
// Constraints honoured:
//   • OwnerInboxItem shape unchanged (types.ts / derive.ts not touched
//     beyond the cap-relief default-arg bump at the call site).
//   • Decision-required `Review →` flow unchanged — still opens the
//     existing decision-brief modal.
//   • Vanilla JS only — no framework introduced.
//   • Author → role lookup goes through state.agents at render time;
//     agent name → role is NOT hardcoded in the JS.

// Group ordering matches `ownerInboxFeedSort` in derive.ts. Backstop only —
// the API already returns items pre-sorted; this is defence against a stale
// cache or future caller that does not honour the sort.
const OI_GROUP_ORDER = {
  "decision-open": 0,
  informational: 1,
  "decision-resolved": 2,
};
const OI_GROUP_LABEL = {
  "decision-open": "Decision required",
  informational: "Informational",
  "decision-resolved": "Decision · resolved",
};

// Date sub-buckets within each group. Order matters — most-recent first.
const OI_BUCKETS = ["today", "yesterday", "this-week", "older"];
const OI_BUCKET_LABEL = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "Earlier this week",
  older: "Older",
};

// Per-group × per-bucket initial cap. Items beyond this hide behind a
// "Show older" toggle. The page-level cap (200, set in derive.ts) is the
// outer bound; this just keeps the visible scroll area scannable.
const OI_BUCKET_VISIBLE = 8;

const OI_DENSITY_KEY = "hoz.owner-inbox.density";
const OI_EXPANDED_KEY = "hoz.owner-inbox.expanded"; // serialised set of "group/bucket"

function getOwnerInboxDensity() {
  try {
    const v = localStorage.getItem(OI_DENSITY_KEY);
    if (v === "compact" || v === "comfortable") return v;
  } catch {
    /* localStorage may be unavailable — fall through */
  }
  return "comfortable";
}
function setOwnerInboxDensity(d) {
  try {
    localStorage.setItem(OI_DENSITY_KEY, d);
  } catch {
    /* ignore */
  }
}
function getOwnerInboxExpanded() {
  try {
    const raw = localStorage.getItem(OI_EXPANDED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}
function setOwnerInboxExpanded(set) {
  try {
    localStorage.setItem(OI_EXPANDED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

function ownerInboxGroupOf(i) {
  // Backwards-compat: items from older caches may not carry `group`.
  if (i.group) return i.group;
  if (!i.decisionRequired) return "informational";
  return i.decisionStatus === "resolved" ? "decision-resolved" : "decision-open";
}

function ownerInboxDisplayTitle(i) {
  // Backwards-compat: items from older caches may not carry `displayTitle`.
  return i.displayTitle || i.title;
}

// Bucket an item by its YYYY-MM-DD date relative to the dashboard's asOf
// (treated as "today" anchor). Defensive against undefined dates.
function ownerInboxBucketOf(item, todayYmd, yesterdayYmd, weekStartYmd) {
  const d = item.date || "";
  if (d === todayYmd) return "today";
  if (d === yesterdayYmd) return "yesterday";
  if (d >= weekStartYmd && d < yesterdayYmd) return "this-week";
  return "older";
}

// Compute the YYYY-MM-DD anchors for today / yesterday / start-of-this-week
// (Monday) using the dashboard's asOf. Falls back to "now" if asOf is bad.
function ownerInboxDateAnchors(asOfIso) {
  const d = asOfIso ? new Date(asOfIso) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const ymd = (x) => x.toISOString().slice(0, 10);
  const today = new Date(safe);
  const yesterday = new Date(safe);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  // Start of week — Monday. JS getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat.
  const weekStart = new Date(safe);
  const dow = (weekStart.getUTCDay() + 6) % 7; // 0=Mon, ..., 6=Sun
  weekStart.setUTCDate(weekStart.getUTCDate() - dow);
  return { today: ymd(today), yesterday: ymd(yesterday), weekStart: ymd(weekStart) };
}

// Pull "D-FOO-BAR" / "W-FOO" / "M-FOO" tags out of an item. Already-
// derived `decisionId` from the API is the strongest signal; otherwise we
// scan the filename and the displayTitle for a single capitalised tag.
function ownerInboxTags(item) {
  const tags = [];
  if (item.decisionId) tags.push(item.decisionId);
  // Scan filename + displayTitle for D-/W-/M- ids the derivation didn't
  // surface (e.g. an informational record that references a decision).
  const haystack = `${item.filename || ""} ${item.title || ""} ${item.displayTitle || ""}`;
  const re = /\b([DWM]-[A-Z][A-Z0-9-]{2,})\b/g;
  const seen = new Set(tags);
  for (const m of haystack.matchAll(re)) {
    const id = m[1];
    if (!seen.has(id)) {
      tags.push(id);
      seen.add(id);
    }
  }
  return tags;
}

// Look up the agent role (e.g. "Internal audit engineer") for an author
// name from state.agents. The data layer is the single source — no
// hardcoded name → role table. Returns undefined if no match.
//
// Authoring convention varies: some files set `author: Linnea`; others
// `author: Linnea (Brand & design lead)`; still others `author: Mira +
// Zara` (joint authorship). Strip parenthetical role suffixes and split
// on `+` / `,` / `&` / `and` so any single name matched against the
// roster lights up the chip with the canonical role.
function ownerInboxAuthorName(author) {
  if (!author) return undefined;
  // Take everything up to the first parenthetical or separator.
  const stripped = author.replace(/\s*\([^)]*\)/g, "").trim();
  const first = stripped.split(/\s*(?:\+|,|&|\band\b)\s*/i)[0]?.trim();
  return first || undefined;
}
function ownerInboxAuthorDisplayName(author) {
  return ownerInboxAuthorName(author) || author;
}
function ownerInboxAuthorRole(author) {
  if (!author || !lastState?.agents?.length) return undefined;
  const primary = ownerInboxAuthorName(author);
  if (!primary) return undefined;
  const n = primary.toLowerCase();
  const hit = lastState.agents.find((a) => (a.name || "").toLowerCase() === n);
  return hit?.role;
}

function renderOwnerInboxRow(i, density) {
  const group = ownerInboxGroupOf(i);
  const isDecision = group === "decision-open" || group === "decision-resolved";
  const isResolved = group === "decision-resolved";
  const classes = [
    "oi-row",
    isDecision ? "oi-decision" : "",
    isResolved ? "oi-resolved" : "",
    !isDecision ? "oi-previewable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const tags = ownerInboxTags(i);
  const tagsHtml = tags.length
    ? `<span class="oi-tags">${tags.map((t) => `<span class="oi-tag">${esc(t)}</span>`).join("")}</span>`
    : "";
  const titleHtml = `<b>${esc(ownerInboxDisplayTitle(i))}</b>`;
  const role = ownerInboxAuthorRole(i.author);
  const authorDisplay = ownerInboxAuthorDisplayName(i.author);
  const authorChipHtml = i.author
    ? `<span class="oi-author-chip" title="${esc(i.author)}"><span class="oi-author-name">${esc(authorDisplay)}</span>${role ? `<span class="oi-author-role">${esc(role)}</span>` : ""}</span>`
    : "";
  const actionHtml =
    group === "decision-open" && i.decisionId
      ? `<div class="oi-action"><button class="btn-primary" data-brief-open="${esc(i.decisionId)}">Review →</button></div>`
      : !isDecision
        ? `<div class="oi-action"><button class="btn-ghost oi-preview-btn" data-oi-preview="${esc(i.filename)}" aria-label="Preview ${esc(i.filename)}">Preview</button></div>`
        : "";
  if (density === "compact") {
    return `
      <div class="${classes} oi-row-compact" data-oi-filename="${esc(i.filename)}">
        <span class="oi-date">${esc(i.date)}</span>
        <div class="oi-body">
          <div class="oi-title">${titleHtml}${tagsHtml}</div>
        </div>
        ${authorChipHtml}
        ${actionHtml}
      </div>
    `;
  }
  return `
    <div class="${classes}" data-oi-filename="${esc(i.filename)}">
      <span class="oi-date">${esc(i.date)}</span>
      <div class="oi-body">
        <div class="oi-title">${titleHtml}${tagsHtml}</div>
        ${authorChipHtml || i.summary ? `<div class="oi-meta-row">${authorChipHtml}</div>` : ""}
        ${i.summary ? `<div class="oi-summary">${esc(i.summary)}</div>` : ""}
        <div class="oi-path">${esc(i.path)}</div>
      </div>
      ${actionHtml}
    </div>
  `;
}

function renderOwnerInbox(items) {
  const sub = $("#ownerInboxSub");
  const list = $("#ownerInboxFeed");
  if (!list) return;
  const density = getOwnerInboxDensity();
  list.dataset.density = density;
  if (!items.length) {
    if (sub) sub.textContent = "";
    list.innerHTML = `<div class="muted" style="padding: 12px;">No deliverables yet.</div>`;
    return;
  }
  // Group items by `group`, preserving the API-provided order within each group.
  const groups = { "decision-open": [], informational: [], "decision-resolved": [] };
  for (const i of items) {
    const g = ownerInboxGroupOf(i);
    (groups[g] || groups.informational).push(i);
  }
  const openCount = groups["decision-open"].length;
  const resolvedCount = groups["decision-resolved"].length;
  if (sub) {
    const parts = [`${items.length} item${items.length === 1 ? "" : "s"}`];
    if (openCount > 0) parts.push(`${openCount} awaiting decision`);
    if (resolvedCount > 0) parts.push(`${resolvedCount} resolved`);
    sub.textContent = parts.join(" · ");
  }
  // Pre-compute date anchors once.
  const anchors = ownerInboxDateAnchors(lastState?.asOf);
  const expanded = getOwnerInboxExpanded();
  // Density toggle UI lives at the top of the list.
  const sections = [];
  sections.push(`
    <div class="oi-controls">
      <span class="oi-controls-label">Density</span>
      <div class="oi-density-toggle" role="group" aria-label="Density">
        <button type="button" class="oi-density-btn ${density === "comfortable" ? "active" : ""}" data-oi-density="comfortable">Comfortable</button>
        <button type="button" class="oi-density-btn ${density === "compact" ? "active" : ""}" data-oi-density="compact">Compact</button>
      </div>
    </div>
  `);
  // Render each non-empty group with a section heading. Within each group
  // sub-bucket by date (Today / Yesterday / Earlier this week / Older).
  const orderedGroups = Object.keys(groups).sort((a, b) => OI_GROUP_ORDER[a] - OI_GROUP_ORDER[b]);
  for (const g of orderedGroups) {
    const arr = groups[g];
    if (!arr.length) continue;
    sections.push(
      `<div class="oi-group-head" data-group="${esc(g)}">${esc(OI_GROUP_LABEL[g])} <span class="oi-group-count">${arr.length}</span></div>`,
    );
    // Bucket items.
    const buckets = { today: [], yesterday: [], "this-week": [], older: [] };
    for (const i of arr) {
      const b = ownerInboxBucketOf(i, anchors.today, anchors.yesterday, anchors.weekStart);
      buckets[b].push(i);
    }
    for (const b of OI_BUCKETS) {
      const bucketItems = buckets[b];
      if (!bucketItems.length) continue;
      const expansionKey = `${g}/${b}`;
      const isExpanded = expanded.has(expansionKey);
      const hidden = bucketItems.length > OI_BUCKET_VISIBLE && !isExpanded;
      const visible = hidden ? bucketItems.slice(0, OI_BUCKET_VISIBLE) : bucketItems;
      sections.push(
        `<div class="oi-bucket-head"><span>${esc(OI_BUCKET_LABEL[b])}</span><span class="oi-bucket-count">${bucketItems.length}</span></div>`,
      );
      for (const i of visible) sections.push(renderOwnerInboxRow(i, density));
      if (hidden) {
        const remaining = bucketItems.length - OI_BUCKET_VISIBLE;
        sections.push(
          `<button type="button" class="oi-show-older" data-oi-expand="${esc(expansionKey)}">Show ${remaining} older ${remaining === 1 ? "item" : "items"} →</button>`,
        );
      } else if (bucketItems.length > OI_BUCKET_VISIBLE && isExpanded) {
        sections.push(
          `<button type="button" class="oi-show-older oi-collapse" data-oi-collapse="${esc(expansionKey)}">Collapse ${bucketItems.length - OI_BUCKET_VISIBLE} older</button>`,
        );
      }
    }
  }
  list.innerHTML = sections.join("");
  // Decision-required: wire the existing brief modal.
  for (const btn of $$(".oi-row .oi-action button[data-brief-open]")) {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openBrief(btn.dataset.briefOpen);
    });
  }
  // Informational: row click + Preview button → inline-preview modal.
  for (const btn of $$(".oi-row .oi-preview-btn")) {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openOwnerInboxPreview(btn.dataset.oiPreview);
    });
  }
  for (const row of $$(".oi-row.oi-previewable")) {
    row.addEventListener("click", () => {
      const fn = row.dataset.oiFilename;
      if (fn) openOwnerInboxPreview(fn);
    });
  }
  // Density toggle.
  for (const btn of $$(".oi-density-btn")) {
    btn.addEventListener("click", () => {
      setOwnerInboxDensity(btn.dataset.oiDensity);
      renderOwnerInbox(lastState?.ownerInboxFeed ?? []);
    });
  }
  // Show-older pagination.
  for (const btn of $$(".oi-show-older[data-oi-expand]")) {
    btn.addEventListener("click", () => {
      const set = getOwnerInboxExpanded();
      set.add(btn.dataset.oiExpand);
      setOwnerInboxExpanded(set);
      renderOwnerInbox(lastState?.ownerInboxFeed ?? []);
    });
  }
  for (const btn of $$(".oi-show-older[data-oi-collapse]")) {
    btn.addEventListener("click", () => {
      const set = getOwnerInboxExpanded();
      set.delete(btn.dataset.oiCollapse);
      setOwnerInboxExpanded(set);
      renderOwnerInbox(lastState?.ownerInboxFeed ?? []);
    });
  }
}

// ---------- Owner Inbox inline-preview modal ----------
//
// Read-only render of the markdown body for an informational item. Decision-
// required items continue to use the existing decision-brief modal — this
// modal is additive, never replaces that flow. The markdown is rendered
// with a deliberately tiny formatter (headings / paragraphs / inline code /
// bold / italic / links) — no third-party dep, no exec'd HTML. Anything
// fancier escapes into the `<pre>` fallback at the bottom.

let ownerInboxPreviewActive = null;

async function openOwnerInboxPreview(filename) {
  if (!filename) return;
  ownerInboxPreviewActive = filename;
  const modal = $("#oiPreviewModal");
  const titleEl = $("#oiPreviewTitle");
  const bodyEl = $("#oiPreviewBody");
  const pathEl = $("#oiPreviewPath");
  if (!modal || !bodyEl) return;
  // Find the item in the current feed for chrome.
  const item = (lastState?.ownerInboxFeed ?? []).find((i) => i.filename === filename);
  if (titleEl) titleEl.textContent = item ? ownerInboxDisplayTitle(item) : filename;
  if (pathEl) pathEl.textContent = item?.path || `Owner Inbox/${filename}`;
  bodyEl.innerHTML = `<div class="muted" style="padding: 24px;">Loading…</div>`;
  modal.hidden = false;
  try {
    const r = await fetch(`/api/owner-inbox/${encodeURIComponent(filename)}`);
    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(`HTTP ${r.status}: ${errBody.slice(0, 240)}`);
    }
    const md = await r.text();
    // Guard against a stale-modal race: another preview was opened while
    // we waited for fetch.
    if (ownerInboxPreviewActive !== filename) return;
    bodyEl.innerHTML = renderMarkdownLite(md);
  } catch (err) {
    if (ownerInboxPreviewActive !== filename) return;
    bodyEl.innerHTML = `<div class="error" style="padding:14px;">Could not load preview: ${esc(err.message ?? err)}</div>`;
  }
}

function closeOwnerInboxPreview() {
  const modal = $("#oiPreviewModal");
  if (modal) modal.hidden = true;
  ownerInboxPreviewActive = null;
}

// Tiny markdown renderer — line-oriented, not a parser. Handles the
// shapes we see in /Owner Inbox/: H1/H2/H3, paragraphs, bullet lists,
// numbered lists, fenced code blocks, inline `code`, **bold**, _italic_,
// frontmatter strip, link `[text](url)`. Anything else stays escaped.
function renderMarkdownLite(md) {
  const src = String(md ?? "");
  // Strip YAML frontmatter if present.
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
  let listType = null; // "ul" | "ol"
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
    // Escape first, then re-introduce a *small* whitelist of inline tags.
    let s = esc(line);
    // Inline code `…` (do this before bold/italic so backtick contents
    // don't get reprocessed).
    s = s.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
    // Bold **…**
    s = s.replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${t}</strong>`);
    // Italic *…* (only when surrounded by non-word chars to avoid mangling).
    s = s.replace(/(^|\W)\*([^*]+)\*(\W|$)/g, (_m, a, t, b) => `${a}<em>${t}</em>${b}`);
    // Links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
      // href is already esc()'d; re-validate by allow-listing schemes.
      const safe = /^(https?:|\/|\.\.?\/)/i.test(href) ? href : "#";
      return `<a href="${safe}" target="_blank" rel="noopener">${text}</a>`;
    });
    return s;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    // Fenced code block.
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

function renderDecisionsResolved(resolved) {
  if (!resolved.length) {
    $("#decisionsResolved").innerHTML = `<div class="muted">No resolved decisions yet.</div>`;
    return;
  }
  // Most recent first (already sorted by registry but defensive)
  const sorted = [...resolved].sort((a, b) => (a.actionedAt < b.actionedAt ? 1 : -1));
  $("#decisionsResolved").innerHTML = sorted
    .slice(0, 12)
    .map(
      (r) => `
    <div class="resolved-row">
      <span class="id">${esc(r.id)}</span>
      <div class="body">
        <b>${esc(r.title)}</b> — ${esc(r.outcome)}
        ${r.comment ? `<br><span class="muted">"${esc(r.comment)}"</span>` : ""}
      </div>
      <span class="by muted">${esc(formatActor(r.actionedBy))}</span>
      <span class="when">${esc(formatDate(r.actionedAt))}</span>
    </div>
  `,
    )
    .join("");
}

function formatActor(actor) {
  if (!actor) return "";
  if (actor === "marc@tgv.co.za") return "Marc";
  const m = actor.match(/^agent:([^:]+)/);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1);
  const at = actor.indexOf("@");
  if (at > 0) return actor.slice(0, at);
  return actor;
}

function formatDate(iso) {
  if (!iso) return "";
  // Accept either YYYY-MM-DD or full ISO; render as short.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function renderInFlight(items) {
  const active = items.filter((i) => i.active);
  const idle = items.filter((i) => !i.active);

  const renderActive = (i) => `
    <li class="active">
      <span class="status-pill active" title="Currently being worked on">● Active</span>
      <span class="what">${esc(i.what)}</span>
      <span class="meta">
        ${esc(i.owner)} · ${esc(i.due)}${i.startedAt ? ` · started ${esc(i.startedAt)}` : ""}
        ${i.briefDoc ? ` · <span class="brief-ref">${esc(i.briefDoc)}</span>` : ""}
      </span>
    </li>
  `;

  const renderIdle = (i) => `
    <li class="idle">
      <span class="status-pill idle" title="Not yet started">○ Not started</span>
      <span class="what">${esc(i.what)}</span>
      <span class="meta">${esc(i.owner)} · ${esc(i.due)}</span>
      <button class="btn-start" data-start-id="${esc(i.id)}">Get started →</button>
    </li>
  `;

  $("#inFlight").innerHTML = [
    active.length
      ? `<li class="inflight-heading">Active threads (${active.length})</li>`
      : `<li class="inflight-heading muted">No active threads.</li>`,
    ...active.map(renderActive),
    idle.length ? `<li class="inflight-heading">Awaiting pickup (${idle.length})</li>` : "",
    ...idle.map(renderIdle),
  ].join("");

  for (const btn of $$(".inflight-list .btn-start")) {
    btn.addEventListener("click", () => startWorkstream(btn.dataset.startId, btn));
  }
}

async function startWorkstream(id, btn) {
  if (!id) return;
  if (btn) btn.disabled = true;
  try {
    const r = await fetch("/api/inflight/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await r.json();
    if (!r.ok || body.error) {
      throw new Error(body.error ?? `HTTP ${r.status}`);
    }
    toast(`Started: ${body.item?.what ?? id}`);
    fetchState();
  } catch (e) {
    toast(`Could not start: ${e.message}`, true);
    if (btn) btn.disabled = false;
  }
}

function renderDirectReports(people) {
  $("#directReports").innerHTML = `
    <tbody>
      ${people
        .map(
          (p) => `
        <tr>
          <td class="name">${esc(p.name)}</td>
          <td class="role">${esc(p.role)}</td>
          <td class="type">${esc(p.type)}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  `;
}

function renderOpenSeats(seats) {
  $("#openSeats").innerHTML = seats
    .map(
      (s) => `
    <li><b>${esc(s.role)}</b><span class="muted">${esc(s.status)}</span></li>
  `,
    )
    .join("");
}

function renderPrinciples(principles) {
  $("#principles").innerHTML = principles
    .map(
      (p) => `
    <li>
      <b>${esc(p.title)}</b>
      <span class="summary">${esc(p.summary)}</span>
    </li>
  `,
    )
    .join("");
}

function renderPrototype(p) {
  const cls = p.ciStatus === "green" ? "" : p.ciStatus === "amber" ? "amber" : "red";
  $("#prototype").innerHTML = `
    <div class="ci-line ${cls}">
      <strong>CI: ${esc(p.ciStatus)}</strong>
      <span class="muted"> · ${esc(p.tests)} tests passing</span>
    </div>
    <div class="modules">
      ${p.modules.map((m) => `<span class="module">${esc(m.name)} · ${esc(m.status)}</span>`).join("")}
    </div>
    <div style="font-size:12px; color:var(--text-muted); margin-top:10px;">
      Next foundation: ${p.next.map(esc).join(", ")}.
    </div>
  `;
}

function renderRisks(risks) {
  $("#risks").innerHTML = risks.map((r) => `<li>${esc(r)}</li>`).join("");
}

// ---------- Brief modal (review + decide) ----------

let briefIndex = 0;

function openBrief(decisionId) {
  const ds = lastState?.decisionsOpen ?? [];
  const idx = ds.findIndex((x) => x.id === decisionId);
  if (idx < 0) return;
  briefIndex = idx;
  renderBrief(ds[idx]);
  $("#briefModal").hidden = false;
}

function closeBrief() {
  $("#briefModal").hidden = true;
}

function navBrief(delta) {
  const ds = lastState?.decisionsOpen ?? [];
  if (!ds.length) return;
  briefIndex = (briefIndex + delta + ds.length) % ds.length;
  renderBrief(ds[briefIndex]);
  $("#briefBody").scrollTop = 0;
}

function renderBrief(d) {
  $("#briefId").textContent = d.id;
  $("#briefCat").textContent = d.category;
  $("#briefCat").className = `brief-cat cat-${d.category}`;
  $("#briefTitle").textContent = d.title;
  $("#briefOwner").textContent = d.owner;
  $("#briefTimeline").textContent = d.brief?.timeline ?? d.trigger;
  $("#briefDecisionPrompt").textContent = `Decision for CEO: ${d.decisionForCEO}`;

  const total = (lastState?.decisionsOpen ?? []).length;
  $("#briefPosition").textContent = `${briefIndex + 1} / ${total}`;

  $("#briefBody").innerHTML = renderBriefBody(d) + renderCommentsSection(d.id);
  // Wire the comment-post button (re-bound on every render).
  const postBtn = document.getElementById(`commentPost-${d.id}`);
  if (postBtn) postBtn.addEventListener("click", () => postComment(d.id));
}

function renderCommentsSection(decisionId) {
  const comments = lastState?.decisionComments?.[decisionId] ?? [];
  const items = comments
    .map((c) => {
      const dt = c.asOf.slice(0, 16).replace("T", " ");
      const actorBadge =
        c.actorType === "human" ? "human" : c.actorType === "service" ? "agent" : "system";
      return `
        <li class="comment comment-${actorBadge}">
          <div class="comment-head">
            <span class="comment-author">${esc(c.author)}</span>
            <span class="comment-actor">${esc(c.actorId)}</span>
            <span class="comment-time muted small">${esc(dt)}</span>
          </div>
          <div class="comment-body">${esc(c.body)}</div>
        </li>`;
    })
    .join("");

  return `
    <div class="brief-section comments-section">
      <h3>Comments <span class="muted small">(${comments.length})</span></h3>
      <ul class="comments-list">
        ${items || '<li class="muted small">No comments yet.</li>'}
      </ul>
      <div class="comment-compose">
        <textarea id="commentInput-${decisionId}" rows="2" placeholder="Add a comment — Markdown OK. Append-only audit; no edit/delete."></textarea>
        <button class="btn-primary" id="commentPost-${decisionId}">Post</button>
        <div class="muted small comment-error" id="commentError-${decisionId}" hidden></div>
      </div>
    </div>
  `;
}

async function postComment(decisionId) {
  const ta = document.getElementById(`commentInput-${decisionId}`);
  const err = document.getElementById(`commentError-${decisionId}`);
  const btn = document.getElementById(`commentPost-${decisionId}`);
  if (!ta) return;
  const body = ta.value.trim();
  if (!body) {
    if (err) {
      err.textContent = "Comment body is required.";
      err.hidden = false;
    }
    return;
  }
  if (err) err.hidden = true;
  if (btn) btn.disabled = true;
  try {
    const r = await fetch("/api/decisions/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId, body }),
    });
    const data = await r.json();
    if (!r.ok || data.error) {
      throw new Error(data.error ?? `HTTP ${r.status}`);
    }
    ta.value = "";
    await fetchState();
    // Re-render the modal in place (the brief is still open).
    const d = lastState?.decisionsOpen.find((x) => x.id === decisionId);
    if (d) renderBrief(d);
  } catch (e) {
    if (err) {
      err.textContent = e.message ?? "Failed to post comment.";
      err.hidden = false;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderBriefBody(d) {
  const b = d.brief;
  if (!b) {
    return `
      <div class="muted">No structured brief available for this decision yet. See the source documents:</div>
      <div class="brief-docs" style="margin-top:10px;">
        ${d.sourceDocs
          .map(
            (s) => `
          <div class="brief-doc"><div class="path">${esc(s)}</div></div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  const recoNorm = (b.recommendation?.stance ?? "").toLowerCase();
  const optionsHtml = b.options
    .map((opt) => {
      const isReco = optionMatchesRecommendation(opt.label, recoNorm);
      return `
        <div class="brief-option ${isReco ? "recommended" : ""}">
          <div class="label">
            ${esc(opt.label)}
            ${isReco ? `<span class="reco-pill">Recommended</span>` : ""}
          </div>
          <div class="description">${esc(opt.description)}</div>
          ${opt.consequence ? `<div class="consequence">→ ${esc(opt.consequence)}</div>` : ""}
        </div>`;
    })
    .join("");

  const depRow = (dep) => `
    <li>
      <span class="dep-id">${esc(dep.ref)}</span>
      <span>${esc(dep.title)}</span>
      <span class="dep-status ${esc(dep.status)}">${esc(dep.status)}</span>
    </li>`;

  return `
    <div class="brief-summary">${esc(b.summary)}</div>

    <div class="brief-section">
      <h3>Background</h3>
      <p>${esc(b.background)}</p>
    </div>

    <div class="brief-section">
      <h3>Options</h3>
      <div class="brief-options">${optionsHtml}</div>
    </div>

    <div class="brief-section">
      <h3>Recommendation</h3>
      <div class="brief-recommendation">
        <div class="stance">${esc(b.recommendation.stance)}</div>
        <p class="reasoning">${esc(b.recommendation.reasoning)}</p>
      </div>
    </div>

    <div class="brief-section">
      <h3>Dependencies</h3>
      <div class="brief-deps">
        <div>
          <h4>Gated on (must land before this)</h4>
          ${
            b.dependencies.gatedOn.length
              ? `<ul>${b.dependencies.gatedOn.map(depRow).join("")}</ul>`
              : `<div class="muted" style="font-size:12.5px;">None.</div>`
          }
        </div>
        <div>
          <h4>Gates (this unlocks)</h4>
          ${
            b.dependencies.gates.length
              ? `<ul>${b.dependencies.gates.map(depRow).join("")}</ul>`
              : `<div class="muted" style="font-size:12.5px;">None.</div>`
          }
        </div>
      </div>
    </div>

    <div class="brief-section">
      <h3>Stakeholders</h3>
      <ul class="brief-stakeholders">
        ${b.stakeholders
          .map(
            (s) => `
          <li>
            <span class="name">${esc(s.name)}</span><span class="role">— ${esc(s.role)}</span>
            ${s.position ? `<span class="position">${esc(s.position)}</span>` : ""}
          </li>`,
          )
          .join("")}
      </ul>
    </div>

    <div class="brief-section">
      <h3>Supporting documents</h3>
      <div class="brief-docs">
        ${b.supportingDocs
          .map(
            (doc) => `
          <div class="brief-doc">
            <div class="title">${esc(doc.title)}</div>
            <div class="summary">${esc(doc.summary)}</div>
            <div class="path">${esc(doc.path)}</div>
          </div>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function optionMatchesRecommendation(label, recoNorm) {
  if (!recoNorm || recoNorm.startsWith("tbd")) return false;
  const labelNorm = label.toLowerCase();
  // Heuristic: the recommendation stance contains key words from the option label.
  // Take the first three words of the option label and check inclusion.
  const tokens = labelNorm.split(/\W+/).filter((t) => t.length > 3);
  return tokens.length > 0 && tokens.some((t) => recoNorm.includes(t));
}

// ---------- Decision-action modal ----------

function openModal(decisionId, presetAction) {
  const d = lastState?.decisionsOpen.find((x) => x.id === decisionId);
  if (!d) return;
  activeDecisionId = decisionId;
  $("#modalTitle").textContent = `${d.id} — ${d.title}`;
  $("#modalMeta").innerHTML = `
    <b>Owner:</b> ${esc(d.owner)}<br>
    <b>For CEO:</b> ${esc(d.decisionForCEO)}
  `;
  $("#modalAction").value = presetAction ?? "approve";
  $("#modalOutcome").value = defaultOutcome(d, presetAction);
  $("#modalComment").value = "";
  if ($("#modalFollowOnRoutes")) $("#modalFollowOnRoutes").value = "";
  $("#modalError").hidden = true;
  $("#modal").hidden = false;
  $("#modalOutcome").focus();
}

function defaultOutcome(_d, action) {
  if (action === "approve") return "Approved as drafted.";
  if (action === "defer") return "Deferred — see comment.";
  if (action === "modify") return "Approved with modifications — see comment.";
  if (action === "request-revision") return "Revision requested — see comment.";
  return "";
}

function closeModal() {
  $("#modal").hidden = true;
  activeDecisionId = null;
}

async function submitModal() {
  if (!activeDecisionId) return;
  const action = $("#modalAction").value;
  const outcome = $("#modalOutcome").value.trim();
  const comment = $("#modalComment").value.trim();
  const followOnRaw = ($("#modalFollowOnRoutes")?.value ?? "").trim();
  const followOnRoutes = followOnRaw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  // Validate route format — must match agent:<name>:<trigger>.
  const routePattern = /^agent:[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/i;
  const badRoutes = followOnRoutes.filter((r) => !routePattern.test(r));
  if (badRoutes.length > 0) {
    showModalError(
      `Invalid follow-on route(s): ${badRoutes.join(", ")} — must match agent:<name>:<trigger>.`,
    );
    return;
  }
  if (!outcome) {
    showModalError("Outcome is required.");
    return;
  }
  $("#modalSubmit").disabled = true;
  try {
    const r = await fetch("/api/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionId: activeDecisionId,
        action,
        outcome,
        // D-DECISIONS-FRAMEWORK-REDESIGN Slice B — actor is required;
        // the dashboard identifies the CEO explicitly (no server-side
        // hard-coded fallback).
        actor: "marc@tgv.co.za",
        ...(comment ? { comment } : {}),
        ...(followOnRoutes.length > 0 ? { followOnRoutes } : {}),
      }),
    });
    const body = await r.json();
    if (!r.ok || body.error) {
      throw new Error(body.error ?? `HTTP ${r.status}`);
    }
    toast(`Recorded ${activeDecisionId}: ${action}`);
    closeModal();
    fetchState();
  } catch (e) {
    showModalError(e.message);
  } finally {
    $("#modalSubmit").disabled = false;
  }
}

function showModalError(msg) {
  const el = $("#modalError");
  el.textContent = msg;
  el.hidden = false;
}

function toast(msg, isError = false) {
  const t = document.createElement("div");
  t.className = `toast${isError ? " error" : ""}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ---------- Init ----------

document.addEventListener("DOMContentLoaded", () => {
  // Decision-action modal wiring
  $("#modalCancel").addEventListener("click", closeModal);
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalSubmit").addEventListener("click", submitModal);
  $("#modal").addEventListener("click", (e) => {
    if (e.target === $("#modal")) closeModal();
  });

  // Brief modal wiring
  $("#briefClose").addEventListener("click", closeBrief);
  $("#briefPrev").addEventListener("click", () => navBrief(-1));
  $("#briefNext").addEventListener("click", () => navBrief(1));
  $("#briefModal").addEventListener("click", (e) => {
    if (e.target === $("#briefModal")) closeBrief();
  });
  for (const btn of $$("[data-brief-action]")) {
    btn.addEventListener("click", () => {
      const action = btn.dataset.briefAction;
      const ds = lastState?.decisionsOpen ?? [];
      const d = ds[briefIndex];
      if (!d) return;
      closeBrief();
      openModal(d.id, action);
    });
  }

  // Owner Inbox preview modal wiring.
  const oiPreviewClose = $("#oiPreviewClose");
  if (oiPreviewClose) oiPreviewClose.addEventListener("click", closeOwnerInboxPreview);
  const oiPreviewModal = $("#oiPreviewModal");
  if (oiPreviewModal) {
    oiPreviewModal.addEventListener("click", (e) => {
      if (e.target === oiPreviewModal) closeOwnerInboxPreview();
    });
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#modal").hidden) closeModal();
      else if ($("#oiPreviewModal") && !$("#oiPreviewModal").hidden) closeOwnerInboxPreview();
      else if (!$("#briefModal").hidden) closeBrief();
      return;
    }
    if (!$("#briefModal").hidden && $("#modal").hidden) {
      if (e.key === "ArrowLeft") navBrief(-1);
      else if (e.key === "ArrowRight") navBrief(1);
    }
  });

  fetchState();
  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(fetchState, POLL_MS);
  } else {
    setInterval(fetchState, POLL_MS);
  }
});
