// dashboard/public/forward-obligations.js
//
// Forward Obligations Register page — surfaces concrete dated future
// obligations: regulatory filings (BA325, BA700, BA610), trade settlements
// (FX T+2), corporate-statutory deliverables (annual financial statements,
// POPIA report), and ad-hoc items.
//
// Data from GET /api/forward-obligations (wired in server.ts).
//
// Per CLAUDE.md Principle 1: every datum is derived from
// /api/forward-obligations. No hand-authored content; on event-log update
// the projection flows through here at the next dashboard refresh tick.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION · TRADING-MANDATE-V1 (PR #256) ·
// P1-EVENTS-ARE-TRUTH · ORG-MK-10
//
// Author: Anya (Data / analytics engineer, engineering)

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

// ---------------------------------------------------------------------------
// Chip renderers
// ---------------------------------------------------------------------------

function statusChip(status) {
  const cls = `fo-status fo-status-${esc(status)}`;
  return `<span class="${cls}">${esc(status)}</span>`;
}

function kindChip(kind) {
  const cls = `fo-kind fo-kind-${esc(kind)}`;
  // Humanise for display
  const label = kind.replace(/-/g, " ");
  return `<span class="${cls}">${esc(label)}</span>`;
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------

function renderSummary(summary) {
  const overdueClass = (summary.overdue ?? 0) > 0 ? " fo-card-red" : "";
  const todayClass = (summary.dueToday ?? 0) > 0 ? " fo-card-amber" : "";

  $("foSummary").innerHTML = `
    <div class="fo-card">
      <div class="fo-card-num">${summary.total ?? 0}</div>
      <div class="fo-card-lbl">Total</div>
      <div class="fo-card-sub">all statuses</div>
    </div>
    <div class="fo-card">
      <div class="fo-card-num">${summary.pending ?? 0}</div>
      <div class="fo-card-lbl">Pending</div>
      <div class="fo-card-sub">due in future</div>
    </div>
    <div class="fo-card${overdueClass}">
      <div class="fo-card-num">${summary.overdue ?? 0}</div>
      <div class="fo-card-lbl">Overdue</div>
      <div class="fo-card-sub">past due date</div>
    </div>
    <div class="fo-card${todayClass}">
      <div class="fo-card-num">${summary.dueToday ?? 0}</div>
      <div class="fo-card-lbl">Due today</div>
      <div class="fo-card-sub">due this calendar day</div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function renderTable(obligations) {
  const total = obligations.length;
  const empty = $("foEmptyState");
  const wrap = $("foTableWrap");
  const sub = $("foTableSub");

  if (total === 0) {
    empty.hidden = false;
    wrap.hidden = true;
    sub.textContent = "";
    return;
  }

  empty.hidden = true;
  wrap.hidden = false;
  sub.textContent = `${total} obligation${total === 1 ? "" : "s"} · sorted by due date ascending`;

  // Already sorted server-side by dueDate ASC; render in that order.
  const body = $("foBody");
  body.innerHTML = obligations
    .map(
      (o) => `
    <tr>
      <td><strong>${esc(fmtDate(o.dueDate))}</strong></td>
      <td>${esc(o.description)}${o.tradeRef ? `<br><span class="muted" style="font-size:11px;">Trade ref: <code>${esc(o.tradeRef)}</code></span>` : ""}</td>
      <td>${kindChip(o.kind)}</td>
      <td>${o.recurrence ? `<code>${esc(o.recurrence)}</code>` : '<span class="muted">one-off</span>'}</td>
      <td><code>${esc(o.responsibleAgent)}</code></td>
      <td>${statusChip(o.status)}</td>
    </tr>`,
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Load + refresh
// ---------------------------------------------------------------------------

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  const asOf = $("foAsOf");

  try {
    const r = await fetch("/api/forward-obligations", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const view = await r.json();

    renderSummary(view.summary ?? {});
    renderTable(view.obligations ?? []);

    live.classList.remove("bad");
    live.classList.add("ok");
    const ts = fmtDate(view.asOf);
    stamp.textContent = `Updated ${ts}`;
    asOf.textContent = `as of ${ts}`;
  } catch (e) {
    live.classList.remove("ok");
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

load();
setInterval(load, 60_000);
