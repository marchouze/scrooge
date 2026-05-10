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

function renderOwnerInboxRow(i) {
  const group = ownerInboxGroupOf(i);
  const isDecision = group === "decision-open" || group === "decision-resolved";
  const isResolved = group === "decision-resolved";
  const classes = ["oi-row", isDecision ? "oi-decision" : "", isResolved ? "oi-resolved" : ""]
    .filter(Boolean)
    .join(" ");
  const titleHtml = `<b>${esc(ownerInboxDisplayTitle(i))}</b>`;
  const actionHtml =
    group === "decision-open" && i.decisionId
      ? `<div class="oi-action"><button class="btn-primary" data-brief-open="${esc(i.decisionId)}">Review →</button></div>`
      : "";
  return `
    <div class="${classes}">
      <span class="oi-date">${esc(i.date)}</span>
      <div class="oi-body">
        <div class="oi-title">${titleHtml}</div>
        ${i.author ? `<div class="oi-meta">${esc(i.author)}</div>` : ""}
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
  // Render each non-empty group with a section heading. Order is fixed by
  // OI_GROUP_ORDER so a stale cache that did not pre-sort still renders right.
  const orderedGroups = Object.keys(groups).sort((a, b) => OI_GROUP_ORDER[a] - OI_GROUP_ORDER[b]);
  const sections = [];
  for (const g of orderedGroups) {
    const arr = groups[g];
    if (!arr.length) continue;
    sections.push(
      `<div class="oi-group-head" data-group="${esc(g)}">${esc(OI_GROUP_LABEL[g])} <span class="oi-group-count">${arr.length}</span></div>`,
    );
    for (const i of arr) sections.push(renderOwnerInboxRow(i));
  }
  list.innerHTML = sections.join("");
  for (const btn of $$(".oi-row .oi-action button")) {
    btn.addEventListener("click", () => openBrief(btn.dataset.briefOpen));
  }
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
        ${r.comment ? `<br><span class="muted">“${esc(r.comment)}”</span>` : ""}
      </div>
      <span class="when">${esc(formatDate(r.actionedAt))}</span>
    </div>
  `,
    )
    .join("");
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

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#modal").hidden) closeModal();
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
