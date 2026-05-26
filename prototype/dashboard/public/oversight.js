// dashboard/public/oversight.js
//
// CEO Oversight dashboard — active escalations, agent fleet status, and open
// decisions. Auto-refreshes every 30 s and on tab-visibility restore so the
// CEO always sees current state without a manual reload.
//
// Authority: D-DATA-QUALITY-GOLDEN-SOURCE-V1 (Slice 4 — stale-page recon gate)
// Author: Atlas (Core banking platform architect, engineering)

const $ = (id) => document.getElementById(id);

function esc(str) {
  return String(str ?? "")
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
// Fetch helpers

async function safeFetch(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Render helpers

function setTile(container, label, value, href, status) {
  if (!container || typeof SC === "undefined") return;
  const tile = SC.renderTile({ label, value: value ?? "—", href, status: status ?? "info" });
  container.appendChild(tile);
}

function renderSection(headerId, tableId, title, headers, rows, emptyMessage) {
  const headerEl = $(headerId);
  const tableEl = $(tableId);
  if (!headerEl || !tableEl || typeof SC === "undefined") return;
  headerEl.innerHTML = SC.renderSectionHeader(title, null);
  SC.renderTable({ container: tableEl, headers, rows, emptyMessage });
}

// ---------------------------------------------------------------------------
// Main load

async function load() {
  const live = $("live-indicator");
  const stamp = $("stamp");
  if (live) live.className = "live-dot loading";

  try {
    const [escData, fleetData, state] = await Promise.all([
      safeFetch("/api/escalations"),
      safeFetch("/api/fleet"),
      safeFetch("/api/state"),
    ]);

    // ── Tiles ──────────────────────────────────────────────────────────────
    const tilesEl = $("oversight-tiles");
    if (tilesEl) {
      tilesEl.innerHTML = "";

      const escalationCount =
        escData?.active?.length ??
        escData?.escalations?.filter((e) => e.status === "active")?.length ??
        0;

      const fleetTotal = fleetData?.total ?? fleetData?.count ?? 0;
      const fleetFailed = fleetData?.failed ?? 0;
      const openDecisions = state?.decisionsOpen?.length ?? 0;

      if (typeof SC !== "undefined") {
        [
          SC.renderTile({
            label: "Active Escalations",
            value: escalationCount,
            href: "/escalations.html",
            status: escalationCount > 0 ? "danger" : "ok",
          }),
          SC.renderTile({
            label: "Fleet Agents",
            value: fleetTotal,
            href: "/fleet.html",
            status: "info",
          }),
          SC.renderTile({
            label: "Failed Agents",
            value: fleetFailed,
            href: "/fleet.html",
            status: fleetFailed > 0 ? "danger" : "ok",
          }),
          SC.renderTile({
            label: "Open Decisions",
            value: openDecisions,
            href: "/decisions.html",
            status: openDecisions > 0 ? "amber" : "ok",
          }),
        ].forEach((t) => tilesEl.appendChild(t));
      }
    }

    // ── Escalations table ──────────────────────────────────────────────────
    const escList = escData?.active ?? escData?.escalations ?? [];
    renderSection(
      "escalations-header",
      "escalations-table",
      "Active Escalations",
      ["ID", "Type", "Severity", "Raised"],
      escList.slice(0, 10).map((e) => ({
        cells: [
          `<code>${esc(e.id ?? e.escalationId ?? "")}</code>`,
          esc(e.type ?? e.escalationType ?? "—"),
          esc(e.severity ?? "—"),
          esc(fmtDate(e.raisedAt ?? e.at ?? e.timestamp)),
        ],
        data: e,
      })),
      "No active escalations",
    );

    // ── Fleet table ────────────────────────────────────────────────────────
    const fleetRows = fleetData?.fleet ?? fleetData?.breakdown ?? fleetData?.byStatus ?? [];
    renderSection(
      "fleet-header",
      "fleet-table",
      "Agent Fleet",
      ["Agent", "Status", "Last Run"],
      (Array.isArray(fleetRows) ? fleetRows : []).slice(0, 10).map((a) => ({
        cells: [
          esc(a.name ?? a.agentName ?? a.handlerName ?? "—"),
          esc(a.status ?? "—"),
          esc(fmtDate(a.lastRun ?? a.lastRunAt ?? a.at)),
        ],
        data: a,
      })),
      "No fleet data",
    );

    // ── Open decisions table ───────────────────────────────────────────────
    const decisionsOpen = state?.decisionsOpen ?? [];
    renderSection(
      "decisions-header",
      "decisions-table",
      "Open Decisions",
      ["Decision ID", "Title", "Authority"],
      decisionsOpen.slice(0, 10).map((d) => ({
        cells: [
          `<a href="/decisions/${esc(d.id)}" class="decision-link"><code>${esc(d.id)}</code></a>`,
          esc(d.title ?? "—"),
          esc(d.authority ?? "CEO"),
        ],
        data: d,
      })),
      "No open decisions",
    );

    // ── Stamp ──────────────────────────────────────────────────────────────
    if (live) live.className = "live-dot ok";
    if (stamp) {
      const now = new Date().toISOString().slice(0, 16).replace("T", " ");
      stamp.textContent = `Updated ${now}Z`;
    }
  } catch (e) {
    if (live) live.className = "live-dot bad";
    if (stamp) stamp.textContent = `Offline (${e.message})`;
  }
}

// ---------------------------------------------------------------------------
// Polling — 30 s interval + visibility-change refresh
// Authority: D-DATA-QUALITY-GOLDEN-SOURCE-V1 Slice 4

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) load();
});

if (typeof window.registerPagePoll === "function") {
  window.registerPagePoll(load, 30_000);
} else {
  setInterval(load, 30_000);
}

load();
