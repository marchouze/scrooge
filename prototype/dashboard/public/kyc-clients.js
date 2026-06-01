// dashboard/public/kyc-clients.js
//
// KYC Client Register page — /kyc-clients
// Fetches GET /api/kyc/clients; no auto-refresh (clients don't change often).
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001.
// Author: Atlas (Core banking platform architect, engineering)

const $ = (id) => document.getElementById(id);

let allClients = [];

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

function riskBadge(band) {
  const map = { low: "badge-green", medium: "badge-amber", high: "badge-red" };
  return `<span class="badge ${map[band] ?? "badge-grey"}">${esc(band ?? "—")}</span>`;
}

function catBadge(cat) {
  const map = { EC: "badge-purple", PC: "badge-blue" };
  return `<span class="badge ${map[cat] ?? "badge-grey"}">${esc(cat ?? "—")}</span>`;
}

// ---------------------------------------------------------------------------
// Fetch

async function fetchClients() {
  const res = await fetch("/api/kyc/clients");
  if (!res.ok) throw new Error(`/api/kyc/clients returned ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Render

function renderSummary(counts) {
  const cards = [
    { num: counts.total ?? 0, lbl: "Total" },
    { num: counts.low ?? 0, lbl: "Low risk" },
    { num: counts.medium ?? 0, lbl: "Medium risk" },
    { num: counts.high ?? 0, lbl: "High risk" },
    { num: counts.ec ?? 0, lbl: "EC" },
    { num: counts.pc ?? 0, lbl: "PC" },
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

function filteredClients() {
  const risk = $("riskFilter")?.value ?? "all";
  const cat = $("catFilter")?.value ?? "all";
  return allClients.filter(
    (c) => (risk === "all" || c.riskBand === risk) && (cat === "all" || c.category === cat),
  );
}

function renderTable(clients) {
  const tbody = $("clientsBody");
  const subtitle = $("tableSubtitle");
  const wrap = $("tableWrap");
  const empty = $("emptyState");

  if (!clients || clients.length === 0) {
    wrap.hidden = true;
    empty.hidden = false;
    if (subtitle) subtitle.textContent = "";
    tbody.innerHTML = "";
    return;
  }

  wrap.hidden = false;
  empty.hidden = true;
  if (subtitle) subtitle.textContent = `${clients.length} client${clients.length !== 1 ? "s" : ""}`;

  tbody.innerHTML = clients
    .map((c) => {
      const products =
        Array.isArray(c.authorisedProducts) && c.authorisedProducts.length
          ? c.authorisedProducts
              .map((p) => `<span class="badge badge-grey">${esc(p)}</span>`)
              .join(" ")
          : "—";
      return `<tr onclick="window.location.href='/kyc-clients/${encodeURIComponent(c.clientId)}'" title="${esc(c.clientId)}">
      <td>${esc(c.entityName ?? "—")}</td>
      <td><code>${esc(c.bic ?? "—")}</code></td>
      <td><code>${esc(c.lei ?? "—")}</code></td>
      <td>${esc(c.jurisdiction ?? "—")}</td>
      <td>${riskBadge(c.riskBand)}</td>
      <td>${catBadge(c.category)}</td>
      <td>${products}</td>
      <td>${fmtDate(c.onboardedAt)}</td>
      <td>${fmtDate(c.nextRefreshDue)}</td>
      <td><a class="btn btn-outline btn-sm" href="/kyc-clients/${encodeURIComponent(c.clientId)}" onclick="event.stopPropagation()">View</a></td>
    </tr>`;
    })
    .join("");
}

function applyFilters() {
  renderTable(filteredClients());
  const subtitle = $("tableSubtitle");
  const shown = filteredClients().length;
  if (subtitle)
    subtitle.textContent = `${shown} of ${allClients.length} client${allClients.length !== 1 ? "s" : ""}`;
}
window.applyFilters = applyFilters;

// ---------------------------------------------------------------------------
// CSV export

function exportCSV() {
  const clients = filteredClients();
  if (clients.length === 0) {
    alert("No clients to export.");
    return;
  }

  const headers = [
    "clientId",
    "entityName",
    "bic",
    "lei",
    "jurisdiction",
    "riskBand",
    "category",
    "authorisedProducts",
    "onboardedAt",
    "nextRefreshDue",
  ];
  const rows = clients.map((c) =>
    headers.map((h) => `"${String(c[h] ?? "").replace(/"/g, '""')}"`).join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kyc-clients-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
window.exportCSV = exportCSV;

// ---------------------------------------------------------------------------
// Main

async function load() {
  try {
    const data = await fetchClients();
    allClients = data.clients ?? [];
    renderSummary(data.counts ?? {});
    renderTable(filteredClients());

    const asOf = $("asOfLabel");
    if (asOf && data.asOf) asOf.textContent = `as of ${data.asOf.slice(0, 16).replace("T", " ")}Z`;

    const dot = $("liveDot");
    const lu = $("lastUpdated");
    if (dot) dot.className = "live-dot";
    if (lu) lu.textContent = `updated ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error("[kyc-clients]", e);
    const dot = $("liveDot");
    const lu = $("lastUpdated");
    if (dot) dot.className = "live-dot stale";
    if (lu) lu.textContent = "fetch failed";
  }
}

load();
