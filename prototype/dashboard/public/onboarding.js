// dashboard/public/onboarding.js
//
// Onboarding pipeline page — surfaces the 21-phase counterparty-onboarding
// lifecycle managed by Niko's orchestrator. Data from GET /api/onboarding
// (wired in server.ts, PR #272).
//
// Per CLAUDE.md Principle 1: every datum is derived from /api/onboarding.
// No hand-authored content; on event-log update the projection flows through
// here at the next dashboard refresh tick.
//
// Authority: D-PARTY-REGISTER · AML-CFT-POLICY-V1 · TRADING-MANDATE-V1 ·
// FIC-ACT-38-2001
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
// Phase ordering — canonical 21-phase sequence
// ---------------------------------------------------------------------------

const PHASE_ORDER = [
  "sounding",
  "prospect-registered",
  "fais-categorised",
  "cdd-initiated",
  "bo-resolved",
  "sanctions-cleared",
  "fatca-crs-classified",
  "popia-recorded",
  "eligibility-screened",
  "credit-assessed",
  "mandate-scoped",
  "documentation-drafted",
  "documentation-ready",
  "signatories-registered",
  "mandate-assigned",
  "accounts-setup",
  "activated",
  "monitoring",
  "kyc-refresh-due",
  "eligibility-revalidated",
  "offboarded",
];

function phaseClass(phase) {
  if (phase === "activated") return "ob-phase ob-phase-activated";
  if (phase === "offboarded") return "ob-phase ob-phase-offboarded";
  if (phase === "sounding") return "ob-phase ob-phase-sounding";
  return "ob-phase ob-phase-progress";
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderSummary(view) {
  const total = view.totalCounterparties ?? 0;
  const active = view.activeCounterparties ?? 0;
  const inProgress = view.inProgressCounterparties ?? 0;
  const offboarded = (view.counterparties ?? []).filter((c) => c.phase === "offboarded").length;

  $("obSummary").innerHTML = `
    <div class="ob-card">
      <div class="ob-card-num">${total}</div>
      <div class="ob-card-lbl">Total counterparties</div>
      <div class="ob-card-sub">all phases</div>
    </div>
    <div class="ob-card">
      <div class="ob-card-num">${active}</div>
      <div class="ob-card-lbl">Active</div>
      <div class="ob-card-sub">phase = activated</div>
    </div>
    <div class="ob-card">
      <div class="ob-card-num">${inProgress}</div>
      <div class="ob-card-lbl">In progress</div>
      <div class="ob-card-sub">not terminal, not sounding</div>
    </div>
    <div class="ob-card">
      <div class="ob-card-num">${offboarded}</div>
      <div class="ob-card-lbl">Offboarded</div>
      <div class="ob-card-sub">phase = offboarded</div>
    </div>
  `;
}

function renderFunnel(phaseCounts) {
  const body = $("obFunnelBody");
  const rows = PHASE_ORDER.map((phase, idx) => {
    const count = phaseCounts[phase] ?? 0;
    return { phase, idx: idx + 1, count };
  }).filter((r) => r.count > 0);

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="3" class="muted ob-funnel-zero" style="padding:14px;text-align:center;">No counterparties in any phase yet.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td class="muted" style="font-size:11px;">${r.idx}</td>
      <td><span class="${phaseClass(r.phase)}">${esc(r.phase)}</span></td>
      <td><strong>${r.count}</strong></td>
    </tr>`,
    )
    .join("");
}

function renderTable(counterparties) {
  const total = counterparties.length;
  const empty = $("obEmptyState");
  const wrap = $("obTableWrap");
  const sub = $("obTableSub");

  if (total === 0) {
    empty.hidden = false;
    wrap.hidden = true;
    sub.textContent = "";
    return;
  }

  empty.hidden = true;
  wrap.hidden = false;
  sub.textContent = `${total} counterpart${total === 1 ? "y" : "ies"} · sorted by last advanced (newest first)`;

  // Sort by lastAdvancedAt descending.
  const sorted = [...counterparties].sort((a, b) => {
    const ta = a.lastAdvancedAt ?? "";
    const tb = b.lastAdvancedAt ?? "";
    return tb.localeCompare(ta);
  });

  const body = $("obBody");
  body.innerHTML = sorted
    .map(
      (c) => `
    <tr>
      <td><code>${esc(c.counterpartyId)}</code></td>
      <td><span class="${phaseClass(c.phase)}">${esc(c.phase)}</span></td>
      <td><code>${esc(c.lastEventType)}</code></td>
      <td>${fmtDate(c.lastAdvancedAt)}</td>
      <td>${
        c.isTerminal
          ? '<span class="ob-badge ob-badge-yes">yes</span>'
          : '<span class="ob-badge ob-badge-no">no</span>'
      }</td>
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
  const asOf = $("obAsOf");

  try {
    const r = await fetch("/api/onboarding", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const view = await r.json();

    renderSummary(view);
    renderFunnel(view.phaseCounts ?? {});
    renderTable(view.counterparties ?? []);

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
setInterval(load, 30_000);
