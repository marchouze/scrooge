// party.js — Party Register view.
//
// Primary persona: Owen (Company Secretary, governance).
// Renders:
//   - Registry summary tiles (counts by kind + relationships)
//   - Registered parties table (filterable by kind)
//   - Relationship graph summary (kind → count)
//   - Recent registrations (last 10 PartyRegistered events)
//
// Data sources:
//   /api/party        → PartyTileSummary (counts + relationship counts)
//   /api/events       → PartyRegistered events for recent-registrations + full list
//
// The /api/party endpoint returns PartyTileSummary (counts + asOf) from
// buildPartyTileSummary(). For the full party list and relationship graph we
// query the event store via /api/events?type=PartyRegistered and
// /api/events?type=PartyRelationshipAsserted.
//
// Build-phase: party data is event-derived → simulated-only. The founding
// CEO (Marc) is the first natural-person Party (PR 3 onward).
//
// Author: Noa (Intranet Product Owner & UI Architect) — 2026-05-12.

(() => {
  // Current active kind filter.
  let activeFilter = "all";
  // Cached full party list derived from event replay.
  let cachedParties = [];
  let cachedRelationships = [];

  function setMetric(id, text, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "–";
    if (tone) el.setAttribute("data-tone", tone);
  }

  function fmtDate(iso) {
    if (!iso) return "–";
    try {
      return new Date(iso).toISOString().slice(0, 10);
    } catch {
      return String(iso);
    }
  }

  function fmtDateTime(iso) {
    if (!iso) return "–";
    try {
      return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")}Z`;
    } catch {
      return String(iso);
    }
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function kindBadgeStatus(kind) {
    switch (kind) {
      case "natural-person":
        return "active";
      case "legal-entity":
        return "pending";
      case "counterparty":
        return "unknown";
      case "agent":
        return "flagged";
      default:
        return "unknown";
    }
  }

  function kindLabel(kind) {
    switch (kind) {
      case "natural-person":
        return "Natural person";
      case "legal-entity":
        return "Legal entity";
      case "counterparty":
        return "Counterparty";
      case "agent":
        return "Agent";
      default:
        return kind || "–";
    }
  }

  // Extract party records from PartyRegistered events.
  // Each event's payload contains: partyId, kind, displayName, registeredAt, etc.
  function extractPartiesFromEvents(events) {
    const partyMap = new Map();
    for (const ev of events) {
      if (ev.type !== "PartyRegistered") continue;
      const p = ev.payload || {};
      const partyId = p.partyId || ev.event_id;
      // Latest-wins-per-key per projection rules.
      partyMap.set(partyId, {
        partyId,
        kind: p.kind || "–",
        displayName: p.displayName || p.legalName || partyId,
        registeredAt: p.registeredAt || ev.as_of || "–",
        status: "active",
        urn: partyId,
      });
    }
    return [...partyMap.values()].sort((a, b) =>
      (b.registeredAt || "").localeCompare(a.registeredAt || ""),
    );
  }

  // Extract relationship records from PartyRelationshipAsserted events.
  function extractRelationshipsFromEvents(events) {
    const relMap = new Map();
    for (const ev of events) {
      if (ev.type !== "PartyRelationshipAsserted") continue;
      const p = ev.payload || {};
      const relId = p.relationshipId || ev.event_id;
      relMap.set(relId, {
        relationshipId: relId,
        kind: p.kind || p.relationshipKind || "–",
        fromPartyId: p.fromPartyId || "–",
        toPartyId: p.toPartyId || "–",
        effectiveFrom: p.effectiveFrom || ev.as_of || "–",
        revoked: false,
      });
    }
    // Apply revocations.
    for (const ev of events) {
      if (ev.type !== "PartyRelationshipRevoked") continue;
      const p = ev.payload || {};
      const rel = relMap.get(p.relationshipId);
      if (rel) relMap.set(p.relationshipId, { ...rel, revoked: true });
    }
    return [...relMap.values()];
  }

  function renderPartyTable(parties, filter) {
    const filtered = filter === "all" ? parties : parties.filter((p) => p.kind === filter);

    if (!filtered.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No parties of kind <strong>${escHtml(filter)}</strong> found. Build-phase: parties are registered via the Party event stream (D-PARTY-REGISTER boot backfill). <a href="/events.html?type=PartyRegistered" style="color:var(--accent-ink)">Browse PartyRegistered events →</a></p>`;
    }

    const rows = filtered
      .map((p) => {
        const urn = escHtml(p.urn || p.partyId || "–");
        const _kind = escHtml(p.kind || "–");
        const displayName = escHtml(p.displayName || "–");
        const regDate = fmtDate(p.registeredAt);
        const status = p.deactivatedAt ? "deactivated" : "active";
        const statusBadge = `<span class="status-badge" data-status="${status === "active" ? "active" : "unknown"}">${status}</span>`;
        const kindBadge = `<span class="status-badge" data-status="${kindBadgeStatus(p.kind)}">${kindLabel(p.kind)}</span>`;
        return `<tr>
  <td><code style="font-size:var(--type-caption);word-break:break-all">${urn}</code></td>
  <td>${kindBadge}</td>
  <td>${displayName}</td>
  <td style="font-family:var(--font-mono);font-size:var(--type-caption);white-space:nowrap">${regDate}</td>
  <td>${statusBadge}</td>
</tr>`;
      })
      .join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Registered parties">
    <thead><tr><th>URN / Party ID</th><th>Kind</th><th>Name</th><th>Registered</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  Showing ${filtered.length}${filter !== "all" ? ` ${filter}` : ""} partie${filtered.length !== 1 ? "s" : ""}.
  <a href="/events.html?type=PartyRegistered" style="color:var(--accent-ink)">Browse PartyRegistered events →</a>
</p>`;
  }

  function renderRelationshipGraph(relationships, tileSummary) {
    const live = relationships.filter((r) => !r.revoked);

    // Build kind → count map.
    const kindCounts = new Map();
    for (const r of live) {
      const k = r.kind || "unknown";
      kindCounts.set(k, (kindCounts.get(k) || 0) + 1);
    }

    // Use tile summary counts when available (more authoritative).
    const liveCount = tileSummary?.relationshipsLive ?? live.length;
    const revokedCount = tileSummary?.relationshipsRevoked ?? relationships.length - live.length;

    if (!live.length && liveCount === 0) {
      return `<div>
  <div style="display:flex;gap:var(--space-6);margin-bottom:var(--space-4);flex-wrap:wrap">
    <div class="dept-metric" style="min-width:120px">
      <p class="dept-metric-label">Live edges</p>
      <p class="dept-metric-value" data-tone="muted">${liveCount}</p>
      <p class="dept-metric-sub">Non-revoked</p>
    </div>
    <div class="dept-metric" style="min-width:120px">
      <p class="dept-metric-label">Revoked</p>
      <p class="dept-metric-value" data-tone="muted">${revokedCount}</p>
      <p class="dept-metric-sub">Historical only</p>
    </div>
  </div>
  <p style="color:var(--neutral-stone);font-size:var(--type-small)">No <code>PartyRelationshipAsserted</code> events found yet. Relationships are asserted during the Party backfill (boot-time) from <code>Team/_team-roster.json</code> → reports-to graph.</p>
</div>`;
    }

    const sortedKinds = [...kindCounts.entries()].sort((a, b) => b[1] - a[1]);

    const kindRows = sortedKinds.length
      ? sortedKinds
          .map(
            ([k, count]) => `<tr>
  <td><code style="font-size:var(--type-caption)">${escHtml(k)}</code></td>
  <td style="font-family:var(--font-mono);font-size:var(--type-caption)">${count}</td>
</tr>`,
          )
          .join("")
      : `<tr><td colspan="2" style="color:var(--neutral-stone);font-size:var(--type-small)">Build-phase: relationship kinds will appear here after boot backfill.</td></tr>`;

    return `<div style="display:flex;gap:var(--space-8);flex-wrap:wrap;align-items:flex-start">
  <div>
    <div style="display:flex;gap:var(--space-6);margin-bottom:var(--space-4);flex-wrap:wrap">
      <div class="dept-metric" style="min-width:120px">
        <p class="dept-metric-label">Live edges</p>
        <p class="dept-metric-value" data-tone="${liveCount > 0 ? "success" : "muted"}">${liveCount}</p>
        <p class="dept-metric-sub">Non-revoked</p>
      </div>
      <div class="dept-metric" style="min-width:120px">
        <p class="dept-metric-label">Revoked</p>
        <p class="dept-metric-value" data-tone="muted">${revokedCount}</p>
        <p class="dept-metric-sub">Historical only</p>
      </div>
      ${
        tileSummary?.beneficialOwnerChains != null
          ? `<div class="dept-metric" style="min-width:120px">
        <p class="dept-metric-label">UBO chains</p>
        <p class="dept-metric-value" data-tone="muted">${tileSummary.beneficialOwnerChains}</p>
        <p class="dept-metric-sub">Asserted</p>
      </div>`
          : ""
      }
    </div>
    <div class="dept-table-wrap" style="max-width:360px">
      <table class="dept-table" aria-label="Relationship kinds and counts">
        <thead><tr><th>Relationship kind</th><th>Count</th></tr></thead>
        <tbody>${kindRows}</tbody>
      </table>
    </div>
  </div>
</div>`;
  }

  function renderRecentRegistrations(events) {
    const regEvents = events.filter((ev) => ev.type === "PartyRegistered").slice(0, 10);

    if (!regEvents.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No <code>PartyRegistered</code> events found. The boot-time party backfill emits these on first server start from legal-entity seeds, counterparty events, AgentRegistered events, and the natural-person founding CEO. <a href="/events.html?type=PartyRegistered" style="color:var(--accent-ink)">Browse event store →</a></p>`;
    }

    const rows = regEvents
      .map((ev) => {
        const p = ev.payload || {};
        const ts = fmtDateTime(ev.as_of);
        const kind = p.kind || "–";
        const name = escHtml(p.displayName || p.legalName || p.partyId || "–");
        const partyId = escHtml(p.partyId || ev.event_id || "–");
        return `<tr>
  <td style="font-family:var(--font-mono);font-size:var(--type-caption);white-space:nowrap">${ts}</td>
  <td><span class="status-badge" data-status="${kindBadgeStatus(kind)}">${kindLabel(kind)}</span></td>
  <td>${name}</td>
  <td><code style="font-size:var(--type-caption);word-break:break-all">${partyId}</code></td>
</tr>`;
      })
      .join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Recent party registrations">
    <thead><tr><th>Timestamp</th><th>Kind</th><th>Name</th><th>Party ID</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  Showing ${regEvents.length} most recent registrations.
  <a href="/events.html?type=PartyRegistered" style="color:var(--accent-ink)">Browse all PartyRegistered events →</a>
</p>`;
  }

  function applyFilter(filter) {
    activeFilter = filter;
    // Update button aria-pressed states.
    const bar = document.getElementById("party-filter-bar");
    if (bar) {
      for (const btn of bar.querySelectorAll("[data-party-filter]")) {
        btn.setAttribute(
          "aria-pressed",
          btn.getAttribute("data-party-filter") === filter ? "true" : "false",
        );
      }
    }
    // Re-render table with new filter.
    const tableEl = document.getElementById("party-table-body");
    if (tableEl) tableEl.innerHTML = renderPartyTable(cachedParties, filter);
  }

  function wireFilterBar() {
    const bar = document.getElementById("party-filter-bar");
    if (!bar) return;
    bar.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-party-filter]");
      if (!btn) return;
      applyFilter(btn.getAttribute("data-party-filter") || "all");
    });
  }

  async function load() {
    // Fetch party tile summary and recent events in parallel.
    const [tileSummary, partyEventsResp, relEventsResp] = await Promise.all([
      fetch("/api/party", { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/events?type=PartyRegistered&limit=200", {
        headers: { Accept: "application/json" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/events?type=PartyRelationshipAsserted&limit=200", {
        headers: { Accept: "application/json" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    // Also fetch revocation events so we can mark revoked edges.
    const relRevokeResp = await fetch("/api/events?type=PartyRelationshipRevoked&limit=200", {
      headers: { Accept: "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    // Update asOf from tile summary.
    if (tileSummary?.asOf && window.bankShell?.render?.asOf) {
      window.bankShell.render.asOf(tileSummary.asOf);
    }

    // Build party list from events.
    const partyEvents = Array.isArray(partyEventsResp?.events) ? partyEventsResp.events : [];
    const relEvents = Array.isArray(relEventsResp?.events) ? relEventsResp.events : [];
    const relRevokeEvents = Array.isArray(relRevokeResp?.events) ? relRevokeResp.events : [];

    cachedParties = extractPartiesFromEvents(partyEvents);
    cachedRelationships = extractRelationshipsFromEvents([...relEvents, ...relRevokeEvents]);

    // --- Summary metrics (prefer tile summary; fall back to event-derived counts) ---
    const counts = tileSummary?.counts ?? {};
    const naturalCount =
      counts["natural-person"] ?? cachedParties.filter((p) => p.kind === "natural-person").length;
    const legalCount =
      counts["legal-entity"] ?? cachedParties.filter((p) => p.kind === "legal-entity").length;
    const counterCount =
      counts.counterparty ?? cachedParties.filter((p) => p.kind === "counterparty").length;
    const agentCount = counts.agent ?? cachedParties.filter((p) => p.kind === "agent").length;
    const totalCount = counts.total ?? cachedParties.length;
    const relLive =
      tileSummary?.relationshipsLive ?? cachedRelationships.filter((r) => !r.revoked).length;

    setMetric("party-natural", String(naturalCount), naturalCount > 0 ? "default" : "muted");
    setMetric("party-legal", String(legalCount), legalCount > 0 ? "default" : "muted");
    setMetric("party-counter", String(counterCount), counterCount > 0 ? "default" : "muted");
    setMetric("party-agents", String(agentCount), agentCount > 0 ? "default" : "muted");
    setMetric("party-relationships", String(relLive), relLive > 0 ? "success" : "muted");
    setMetric("party-total", String(totalCount), totalCount > 0 ? "default" : "muted");

    // --- Party table ---
    const tableEl = document.getElementById("party-table-body");
    if (tableEl) tableEl.innerHTML = renderPartyTable(cachedParties, activeFilter);

    // --- Relationship graph ---
    const graphEl = document.getElementById("party-graph-body");
    if (graphEl) graphEl.innerHTML = renderRelationshipGraph(cachedRelationships, tileSummary);

    // --- Recent registrations ---
    // Newest first: events come in insertion order from the store (oldest first),
    // so reverse to show newest at top.
    const allPartyEvents = partyEvents.slice().reverse();
    const recentEl = document.getElementById("party-recent-body");
    if (recentEl) recentEl.innerHTML = renderRecentRegistrations(allPartyEvents);
  }

  // Wire up filter bar on DOM ready.
  function init() {
    wireFilterBar();
    load();
  }

  window.bankParty = { load };

  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(load, 30_000);
  } else {
    setInterval(() => load().catch((e) => console.warn("[party] refresh failed", e)), 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
