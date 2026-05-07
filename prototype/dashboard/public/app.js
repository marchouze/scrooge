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

function render(state) {
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
  $("#decisionsSub").textContent =
    `${state.decisionsOpen.length} open · ${state.decisionsResolved.length} resolved`;
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
  $("#decisionsOpen").innerHTML = decisions
    .map(
      (d) => `
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
        ${d.note ? `<div class="note">${esc(d.note)}</div>` : ""}
      </div>
      <div class="review-btn">
        <button class="btn-primary" data-brief-open="${esc(d.id)}">Review brief →</button>
      </div>
    </div>
  `,
    )
    .join("");

  // Wire "Review brief" buttons
  for (const btn of $$(".dcard .review-btn button")) {
    btn.addEventListener("click", () => openBrief(btn.dataset.briefOpen));
  }
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
  const decisionCount = items.filter(
    (i) => i.decisionRequired && i.decisionStatus !== "resolved",
  ).length;
  if (sub) {
    sub.textContent =
      decisionCount > 0
        ? `${items.length} item${items.length === 1 ? "" : "s"} · ${decisionCount} awaiting decision`
        : `${items.length} item${items.length === 1 ? "" : "s"}`;
  }
  list.innerHTML = items
    .map(
      (i) => `
    <div class="oi-row${i.decisionRequired ? " oi-decision" : ""}${i.decisionStatus === "resolved" ? " oi-resolved" : ""}">
      <span class="oi-date">${esc(i.date)}</span>
      <div class="oi-body">
        <div class="oi-title">
          ${
            i.decisionRequired
              ? i.decisionStatus === "resolved"
                ? `<span class="oi-pill oi-pill-resolved">Decision · resolved</span>`
                : `<span class="oi-pill oi-pill-decision">Decision required</span>`
              : ""
          }
          <b>${esc(i.title)}</b>
        </div>
        ${i.author ? `<div class="oi-meta">${esc(i.author)}</div>` : ""}
        ${i.summary ? `<div class="oi-summary">${esc(i.summary)}</div>` : ""}
        <div class="oi-path">${esc(i.path)}</div>
      </div>
      ${
        i.decisionRequired && i.decisionStatus !== "resolved" && i.decisionId
          ? `<div class="oi-action"><button class="btn-primary" data-brief-open="${esc(i.decisionId)}">Review →</button></div>`
          : ""
      }
    </div>
  `,
    )
    .join("");
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

  $("#briefBody").innerHTML = renderBriefBody(d);
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
  setInterval(fetchState, POLL_MS);
});
