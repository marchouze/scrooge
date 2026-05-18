// dashboard/public/kyc-onboarding.js
//
// KYC Onboarding Queue page — /kyc-onboarding
// Fetches GET /api/kyc/candidates, refreshes every 10s.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001.
// Author: Atlas (Core banking platform architect, engineering)

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Utilities

function daysOpen(registeredAt) {
  if (!registeredAt) return "—";
  const ms = Date.now() - new Date(registeredAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000)).toString();
}

function statusBadge(status) {
  const map = {
    "in-progress": "badge-blue",
    referred: "badge-amber",
    accepted: "badge-green",
    rejected: "badge-red",
  };
  const cls = map[status] ?? "badge-grey";
  return `<span class="badge ${cls}">${status}</span>`;
}

function riskBadge(band) {
  if (!band) return "<span class='muted'>—</span>";
  const map = {
    low: "badge-green",
    medium: "badge-amber",
    high: "badge-red",
  };
  const cls = map[band] ?? "badge-grey";
  return `<span class="badge ${cls}">${band}</span>`;
}

function fmtStep(step) {
  return step ? step.replace(/-/g, " ") : "—";
}

// ---------------------------------------------------------------------------
// Fetch

async function fetchCandidates() {
  const res = await fetch("/api/kyc/candidates");
  if (!res.ok) throw new Error(`/api/kyc/candidates returned ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Render

function renderSummary(counts) {
  const cards = [
    { num: counts.total, lbl: "Total" },
    { num: counts.pending, lbl: "Pending" },
    { num: counts.screening, lbl: "Screening" },
    { num: counts.riskRating, lbl: "Risk rating" },
    { num: counts.eddPending, lbl: "EDD pending" },
    { num: counts.accepted, lbl: "Accepted" },
    { num: counts.rejected, lbl: "Rejected" },
  ];
  $("summaryCards").innerHTML = cards
    .map(
      (c) => `
    <div class="kyc-card">
      <div class="kyc-card-num">${c.num}</div>
      <div class="kyc-card-lbl">${c.lbl}</div>
    </div>
  `,
    )
    .join("");
}

function renderTable(candidates) {
  const tbody = $("candidatesBody");
  if (!candidates || candidates.length === 0) {
    $("tableWrap").hidden = true;
    $("emptyState").hidden = false;
    $("tableSubtitle").textContent = "";
    tbody.innerHTML = "";
    return;
  }
  $("tableWrap").hidden = false;
  $("emptyState").hidden = true;
  $("tableSubtitle").textContent =
    `${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`;

  tbody.innerHTML = candidates
    .map((c) => {
      const entityName = c.entityName ?? `${c.candidateId.slice(0, 12)}…`;
      const entityType = c.entityType ?? "—";
      const jurisdiction = c.jurisdiction ?? "—";
      return `<tr>
      <td><a href="/kyc-onboarding/${encodeURIComponent(c.candidateId)}">${entityName}</a></td>
      <td>${entityType}</td>
      <td>${jurisdiction}</td>
      <td>${fmtStep(c.currentStep ?? c.status)}</td>
      <td>${riskBadge(c.riskBand ?? c.riskRating)}</td>
      <td>${daysOpen(c.registeredAt)}</td>
      <td>${statusBadge(c.status)}</td>
      <td><a class="btn btn-outline btn-sm" href="/kyc-onboarding/${encodeURIComponent(c.candidateId)}">View</a></td>
    </tr>`;
    })
    .join("");
}

function renderAsOf(asOf) {
  $("asOfLabel").textContent = asOf ? `as of ${asOf.slice(0, 16).replace("T", " ")}Z` : "";
}

function updateLiveDot(ok) {
  const dot = $("liveDot");
  if (dot) dot.className = ok ? "live-dot" : "live-dot stale";
  const lu = $("lastUpdated");
  if (lu) lu.textContent = ok ? `updated ${new Date().toLocaleTimeString()}` : "fetch failed";
}

// ---------------------------------------------------------------------------
// Main loop

async function load() {
  try {
    const data = await fetchCandidates();
    renderSummary(data.counts ?? {});
    renderTable(data.candidates ?? []);
    renderAsOf(data.asOf);
    updateLiveDot(true);
  } catch (e) {
    console.error("[kyc-onboarding]", e);
    updateLiveDot(false);
  }
}

load();
setInterval(load, 10_000);
