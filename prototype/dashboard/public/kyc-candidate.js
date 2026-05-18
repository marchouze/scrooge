// dashboard/public/kyc-candidate.js
//
// KYC Candidate detail page — /kyc-onboarding/:id
// Polls GET /api/kyc/candidates/:id every 5s.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001.
// Author: Atlas (Core banking platform architect, engineering)

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Derive candidateId from URL

const candidateId = decodeURIComponent(window.location.pathname.replace(/^\/kyc-onboarding\//, ""));

// ---------------------------------------------------------------------------
// PROC-FC-01 step definitions (ordered)

const PROC_STEPS = [
  { key: "candidate-registered",    label: "Registered" },
  { key: "identity-collected",      label: "Identity Collected" },
  { key: "identity-verified",       label: "Identity Verified" },
  { key: "sanctions-pep-screened",  label: "Sanctions/PEP Screened" },
  { key: "ubo-resolved",            label: "UBO Resolved" },
  { key: "risk-rated",              label: "Risk Rated" },
  { key: "edd-in-progress",         label: "EDD" },
  { key: "decision-pending",        label: "Decision" },
  { key: "accepted",                label: "Accepted" },
];

// ---------------------------------------------------------------------------
// State

let pendingDecision = null; // 'accept' | 'reject'
let candidateState = null;

// ---------------------------------------------------------------------------
// Utilities

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtTs(iso) {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ") + "Z";
}

function daysOpen(registeredAt) {
  if (!registeredAt) return "—";
  const ms = Date.now() - new Date(registeredAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000)).toString();
}

function showToast(msg, type = "error") {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = "toast"; }, 4000);
}

function statusBadge(status) {
  const map = {
    "in-progress": "badge-blue",
    referred: "badge-amber",
    accepted: "badge-green",
    rejected: "badge-red",
  };
  return `<span class="badge ${map[status] ?? "badge-grey"}">${esc(status)}</span>`;
}

function riskBadge(band) {
  if (!band) return "";
  const map = { low: "badge-green", medium: "badge-amber", high: "badge-red" };
  return `<span class="badge ${map[band] ?? "badge-grey"}">${esc(band)}</span>`;
}

function checkStatusBadge(status) {
  const map = { passed: "badge-green", flagged: "badge-amber", failed: "badge-red", pending: "badge-grey" };
  return `<span class="badge ${map[status] ?? "badge-grey"}">${esc(status)}</span>`;
}

// ---------------------------------------------------------------------------
// Fetch

async function fetchCandidate() {
  // Fetch candidate state from candidates list (the list endpoint returns all candidates)
  const [listRes, checksRes] = await Promise.all([
    fetch("/api/kyc/candidates"),
    fetch(`/api/kyc/candidates/${encodeURIComponent(candidateId)}`),
  ]);
  if (!listRes.ok) throw new Error(`/api/kyc/candidates returned ${listRes.status}`);
  const listData = await listRes.json();
  const candidate = (listData.candidates ?? []).find(c => c.candidateId === candidateId) ?? null;

  let kycChecks = null;
  if (checksRes.ok) {
    const checksData = await checksRes.json();
    kycChecks = checksData.kycChecks ?? null;
  }

  return { candidate, kycChecks };
}

// ---------------------------------------------------------------------------
// Render header

function renderHeader(candidate) {
  if (!candidate) {
    $("entityNameTitle").textContent = candidateId;
    $("headerMeta").innerHTML = `<span class="muted">Candidate not found in projection</span>`;
    return;
  }
  const entityName = candidate.entityName ?? candidate.candidateId;
  $("entityNameTitle").textContent = entityName;
  document.title = `${entityName} · KYC Candidate · Hoz`;

  $("headerMeta").innerHTML = [
    candidate.entityType ? `<span class="muted">${esc(candidate.entityType)}</span>` : "",
    candidate.jurisdiction ? `<code>${esc(candidate.jurisdiction)}</code>` : "",
    `<span class="muted">Days open: ${daysOpen(candidate.registeredAt)}</span>`,
    statusBadge(candidate.status),
    riskBadge(candidate.riskBand ?? candidate.riskRating),
  ].filter(Boolean).join(" ");

  // "Advance" button — visible when not at human gate and not terminal
  const terminal = candidate.status === "accepted" || candidate.status === "rejected";
  const humanGate = candidate.requiresHuman === true;
  const actionsEl = $("headerActions");
  if (!terminal && !humanGate) {
    actionsEl.innerHTML = `<button class="btn btn-primary" id="advanceBtn" onclick="advanceStep()">▶ Advance</button>`;
  } else {
    actionsEl.innerHTML = "";
  }
}

// ---------------------------------------------------------------------------
// Render stepper

function renderStepper(candidate) {
  if (!candidate) { $("kysStepper").innerHTML = ""; return; }
  const currentStep = candidate.currentStep ?? candidate.status;
  const currentIdx = PROC_STEPS.findIndex(s => s.key === currentStep);
  const isTerminalReject = candidate.status === "rejected";
  const isTerminalAccept = candidate.status === "accepted";

  $("kysStepper").innerHTML = PROC_STEPS.map((step, i) => {
    let state;
    if (isTerminalReject && step.key === "accepted") {
      state = "pending";
    } else if (i < currentIdx || isTerminalAccept) {
      state = "complete";
    } else if (i === currentIdx) {
      state = "active";
    } else {
      state = "pending";
    }
    const dotContent = state === "complete" ? "✓" : (i + 1).toString();
    return `<div class="kyc-step ${state}">
      <div class="kyc-step-dot ${state}">${dotContent}</div>
      <div class="kyc-step-label">${esc(step.label)}</div>
    </div>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Render KYC checks

function renderChecks(kycChecks) {
  const grid = $("checksGrid");
  const empty = $("checksEmpty");

  if (!kycChecks || !kycChecks.checks || Object.keys(kycChecks.checks).length === 0) {
    grid.innerHTML = "";
    grid.hidden = true;
    empty.hidden = false;
    return;
  }
  grid.hidden = false;
  empty.hidden = true;

  const CHECK_LABELS = {
    "identity-verification": "Identity Verification",
    "sanctions-pep-screening": "Sanctions / PEP",
    "ubo-resolution": "UBO Resolution",
    "risk-rating": "Risk Rating",
    "edd": "Enhanced Due Diligence",
  };

  const entries = Object.entries(kycChecks.checks);
  grid.innerHTML = entries.map(([key, check]) => {
    const label = CHECK_LABELS[key] ?? key;
    const raw = JSON.stringify(check.result, null, 2);
    return `<div class="check-card">
      <div class="check-card-head">
        <span class="check-card-name">${esc(label)}</span>
        ${checkStatusBadge(check.status)}
      </div>
      <div class="check-card-ts">${fmtTs(check.checkedAt)}</div>
      <details class="check-raw">
        <summary>Raw result</summary>
        <pre>${esc(raw)}</pre>
      </details>
    </div>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Render EDD panel

function renderEDD(candidate) {
  const section = $("eddSection");
  if (!candidate) { section.hidden = true; return; }

  const checks = candidate;
  const isEDDStep = candidate.currentStep === "edd-in-progress" && candidate.requiresHuman;
  section.hidden = !isEDDStep;

  if (isEDDStep) {
    $("eddReason").textContent = `EDD initiated — reason: ${candidate.humanGateReason ?? "high-risk or PEP-linked"}. Complete EDD review and provide MLRO sign-off to proceed.`;
  }
}

// ---------------------------------------------------------------------------
// Render decision panel

function renderDecision(candidate) {
  const section = $("decisionSection");
  if (!candidate) { section.hidden = true; return; }

  const needsDecision = candidate.requiresHuman &&
    candidate.status === "in-progress" &&
    candidate.currentStep !== "edd-in-progress";

  section.hidden = !needsDecision;
  if (needsDecision) {
    $("decisionReason").textContent =
      `Risk band: ${candidate.riskBand ?? "unknown"} — reason: ${candidate.humanGateReason ?? "review-required"}. ` +
      "Accept or reject this candidate after reviewing all KYC checks.";
  }
}

// ---------------------------------------------------------------------------
// Render event log

function renderEventLog(candidate) {
  const log = $("eventLog");
  if (!candidate || !candidate.events || candidate.events.length === 0) {
    log.innerHTML = `<div class="muted" style="font-family:var(--sans);font-size:13px;">No events yet.</div>`;
    return;
  }
  log.innerHTML = candidate.events.map((evtId, i) => `
    <div class="event-log-item">
      <span class="event-log-ts">#${i + 1}</span>
      <span class="event-log-type">${esc(evtId)}</span>
    </div>
  `).join("");
}

// ---------------------------------------------------------------------------
// Advance step

async function advanceStep() {
  const btn = $("advanceBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Advancing…"; }
  try {
    const res = await fetch(`/api/kyc/candidates/${encodeURIComponent(candidateId)}/advance`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
    showToast(`Step advanced → ${data.currentStep}`, "success");
    await load();
  } catch (e) {
    showToast(`Advance failed: ${e.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "▶ Advance"; }
  }
}
window.advanceStep = advanceStep;

// ---------------------------------------------------------------------------
// Complete EDD

async function completeEDD() {
  const btn = $("completeEDDBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Completing EDD…"; }
  try {
    const decidedBy = (window.bankShell?.user?.id) ?? "marc@tgv.co.za";
    const res = await fetch(`/api/kyc/candidates/${encodeURIComponent(candidateId)}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "accept", decidedBy, mlroSignOffId: "manual-mlro-approval" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
    showToast("EDD completed — candidate proceeds to decision gate.", "success");
    await load();
  } catch (e) {
    showToast(`EDD completion failed: ${e.message}`);
    if (btn) { btn.disabled = false; btn.textContent = "Complete EDD (MLRO sign-off)"; }
  }
}
window.completeEDD = completeEDD;

// ---------------------------------------------------------------------------
// Decision dialog

function openDecisionDialog(decision) {
  pendingDecision = decision;
  $("dialogTitle").textContent = decision === "accept" ? "Accept Candidate" : "Reject Candidate";
  $("dialogBody").textContent = decision === "accept"
    ? "Confirm acceptance of this candidate as a KYC-approved client. This will emit ClientAccepted and cannot be undone."
    : "Confirm rejection of this candidate. This will emit ClientRejected and cannot be undone.";
  const confirmBtn = $("dialogConfirmBtn");
  confirmBtn.textContent = decision === "accept" ? "Accept" : "Reject";
  confirmBtn.className = `btn ${decision === "accept" ? "btn-success" : "btn-danger"}`;
  $("decisionDialog").className = "dialog-overlay show";
}
window.openDecisionDialog = openDecisionDialog;

function closeDecisionDialog() {
  $("decisionDialog").className = "dialog-overlay";
  pendingDecision = null;
}
window.closeDecisionDialog = closeDecisionDialog;

async function confirmDecision() {
  if (!pendingDecision) return;
  const decision = pendingDecision;
  closeDecisionDialog();

  try {
    const decidedBy = (window.bankShell?.user?.id) ?? "marc@tgv.co.za";
    const res = await fetch(`/api/kyc/candidates/${encodeURIComponent(candidateId)}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, decidedBy }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
    showToast(
      decision === "accept" ? "Candidate accepted → client register." : "Candidate rejected.",
      "success"
    );
    await load();
  } catch (e) {
    showToast(`Decision failed: ${e.message}`);
  }
}
window.confirmDecision = confirmDecision;

// ---------------------------------------------------------------------------
// Main load

async function load() {
  try {
    const { candidate, kycChecks } = await fetchCandidate();
    candidateState = candidate;

    renderHeader(candidate);
    renderStepper(candidate);
    renderChecks(kycChecks);
    renderEDD(candidate);
    renderDecision(candidate);
    renderEventLog(candidate);

    const dot = $("liveDot");
    const lu = $("lastUpdated");
    if (dot) dot.className = "live-dot";
    if (lu) lu.textContent = `updated ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error("[kyc-candidate]", e);
    const dot = $("liveDot");
    const lu = $("lastUpdated");
    if (dot) dot.className = "live-dot stale";
    if (lu) lu.textContent = "fetch failed";
  }
}

load();
setInterval(load, 5_000);
