// dashboard/public/kyc-client-detail.js
//
// KYC Client Detail page — /kyc-clients/:id
// Fetches GET /api/kyc/clients/:id
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001.
// Author: Atlas (Core banking platform architect, engineering)

const $ = (id) => document.getElementById(id);

const clientId = decodeURIComponent(window.location.pathname.replace(/^\/kyc-clients\//, ""));

// ---------------------------------------------------------------------------
// Utilities

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function fmtTs(iso) {
  if (!iso) return "—";
  return `${iso.slice(0, 16).replace("T", " ")}Z`;
}

function showToast(msg, type = "error") {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => {
    t.className = "toast";
  }, 4000);
}

function riskBadge(band) {
  const map = { low: "badge-green", medium: "badge-amber", high: "badge-red" };
  return `<span class="badge ${map[band] ?? "badge-grey"}">${esc(band ?? "—")}</span>`;
}

function catBadge(cat) {
  const map = { EC: "badge-purple", PC: "badge-blue" };
  return `<span class="badge ${map[cat] ?? "badge-grey"}">${esc(cat ?? "—")}</span>`;
}

function checkStatusBadge(status) {
  const map = {
    passed: "badge-green",
    flagged: "badge-amber",
    failed: "badge-red",
    pending: "badge-grey",
  };
  return `<span class="badge ${map[status] ?? "badge-grey"}">${esc(status)}</span>`;
}

// ---------------------------------------------------------------------------
// Fetch

async function fetchClient() {
  const res = await fetch(`/api/kyc/clients/${encodeURIComponent(clientId)}`);
  if (!res.ok) throw new Error(`/api/kyc/clients/${clientId} returned ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Render header

function renderHeader(client) {
  if (!client) {
    $("entityNameTitle").textContent = clientId;
    $("headerMeta").innerHTML = `<span class="muted">Client not found</span>`;
    return;
  }
  const name = client.entityName ?? clientId;
  $("entityNameTitle").textContent = name;
  document.title = `${name} · KYC Client · Hoz`;

  $("headerMeta").innerHTML = [
    client.entityType ? `<span class="muted">${esc(client.entityType)}</span>` : "",
    client.jurisdiction ? `<code>${esc(client.jurisdiction)}</code>` : "",
    riskBadge(client.riskBand),
    catBadge(client.category),
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Render detail grid

function renderDetails(client) {
  if (!client) {
    $("detailGrid").innerHTML = "";
    return;
  }
  $("detailGrid").innerHTML = `
    <dt>Client ID</dt><dd><code>${esc(client.clientId)}</code></dd>
    <dt>Entity name</dt><dd>${esc(client.entityName ?? "—")}</dd>
    <dt>Entity type</dt><dd>${esc(client.entityType ?? "—")}</dd>
    <dt>Jurisdiction</dt><dd>${esc(client.jurisdiction ?? "—")}</dd>
    <dt>Risk band</dt><dd>${riskBadge(client.riskBand)}</dd>
    <dt>Category</dt><dd>${catBadge(client.category)}</dd>
    <dt>Onboarded</dt><dd>${fmtDate(client.onboardedAt)}</dd>
    <dt>Next refresh due</dt><dd>${fmtDate(client.nextRefreshDue)}</dd>
    <dt>Last updated</dt><dd>${fmtTs(client.lastUpdatedAt)}</dd>
  `;
}

// ---------------------------------------------------------------------------
// Render KYC checks

const CHECK_LABELS = {
  "identity-verification": "Identity Verification",
  "sanctions-pep-screening": "Sanctions / PEP",
  "ubo-resolution": "UBO Resolution",
  "risk-rating": "Risk Rating",
  edd: "Enhanced Due Diligence",
};

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

  grid.innerHTML = Object.entries(kycChecks.checks)
    .map(([key, check]) => {
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
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Render timeline
// Reconstructs a KYC history timeline from the kycChecks projection data.

function renderTimeline(kycChecks) {
  const tl = $("timeline");

  if (!kycChecks || !kycChecks.checks) {
    tl.innerHTML = `<p class="muted">No KYC history available for this client.</p>`;
    return;
  }

  const events = Object.entries(kycChecks.checks)
    .map(([key, check]) => ({
      ts: check.checkedAt,
      type: CHECK_LABELS[key] ?? key,
      status: check.status,
    }))
    .sort((a, b) => a.ts.localeCompare(b.ts));

  if (events.length === 0) {
    tl.innerHTML = `<p class="muted">No KYC events found.</p>`;
    return;
  }

  tl.innerHTML = events
    .map(
      (e) => `
    <div class="timeline-item">
      <span class="timeline-ts">${fmtTs(e.ts)}</span>
      <span class="timeline-event">${esc(e.type)}</span>
      <span>${checkStatusBadge(e.status)}</span>
    </div>
  `,
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Trigger early refresh

async function triggerRefresh() {
  const btn = $("refreshBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Scheduling…";
  }
  try {
    const res = await fetch(`/api/kyc/clients/${encodeURIComponent(clientId)}/refresh`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
    showToast("KYC refresh scheduled — KYCRefreshScheduled event emitted.", "success");
  } catch (e) {
    showToast(`Refresh failed: ${e.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "↻ Trigger early refresh";
    }
  }
}
window.triggerRefresh = triggerRefresh;

// ---------------------------------------------------------------------------
// Main

async function load() {
  try {
    const data = await fetchClient();
    renderHeader(data.client);
    renderDetails(data.client);
    renderChecks(data.kycChecks);
    renderTimeline(data.kycChecks);
  } catch (e) {
    console.error("[kyc-client-detail]", e);
    $("entityNameTitle").textContent = "Error loading client";
    $("headerMeta").innerHTML = `<span class="muted">${esc(e.message)}</span>`;
  }
}

load();
