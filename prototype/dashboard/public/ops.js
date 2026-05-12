// ops.js — Operations department view.
//
// Pulls /api/state for fleet/escalations/gaps and /api/events for
// recent operational events. Shows settlement status, system health
// metrics, and an event feed.
//
// Author: Atlas (Core banking platform architect) — under CEO directive
// 2026-05-12 (intranet scaffold).

(() => {
  // Settlement / clearing systems shown in the ops panel.
  const SETTLEMENT_SYSTEMS = [
    { id: "samos", label: "SAMOS", sub: "SARB — via sponsor bank (indirect)" },
    { id: "cls", label: "CLS", sub: "FX netting — via correspondent" },
    { id: "jse-csd", label: "JSE CSD", sub: "Equities / bonds settlement" },
    { id: "swift", label: "SWIFT / ISO 20022", sub: "Messaging layer" },
  ];

  function statusTone(s) {
    if (!s) return "muted";
    const v = String(s).toLowerCase();
    if (v === "operational" || v === "green" || v === "ok" || v === "connected") return "green";
    if (v === "degraded" || v === "amber" || v === "warn") return "amber";
    if (v === "down" || v === "red" || v === "error" || v === "failed") return "red";
    return "muted";
  }

  function setMetric(id, text, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "–";
    if (tone) el.setAttribute("data-tone", tone);
  }

  function renderSettlement(state) {
    const settlementState = state?.settlementStatus || {};
    const rows = SETTLEMENT_SYSTEMS.map((sys) => {
      const raw = settlementState[sys.id] || settlementState[sys.id.replace(/-/g, "")] || null;
      const tone = statusTone(raw);
      const display = raw ? String(raw).toUpperCase() : "AWAITING DATA";
      return `<div class="tl-row">
  <span class="tl-dot" data-tone="${tone}" title="${tone}"></span>
  <span class="tl-label">
    <strong>${sys.label}</strong><br>
    <span style="font-size:var(--type-caption);color:var(--neutral-stone)">${sys.sub}</span>
  </span>
  <span class="tl-value">${display}</span>
</div>`;
    }).join("");
    return `<div>${rows}</div>`;
  }

  function renderEvents(events) {
    if (!Array.isArray(events) || !events.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No events found. <a href="/events.html" style="color:var(--accent-ink)">Browse event store →</a></p>`;
    }
    const rows = events
      .slice(0, 20)
      .map((ev) => {
        const seq = ev.seq ?? ev.sequence ?? "–";
        const type = ev.type ?? ev.event_type ?? "–";
        const asOf = ev.as_of ?? ev.asOf ?? ev.timestamp ?? null;
        const timeStr = asOf
          ? `${new Date(asOf).toISOString().slice(0, 19).replace("T", " ")}Z`
          : "–";
        const entity = ev.entity ?? ev.entityId ?? "–";
        return `<tr>
  <td class="ev-seq">${seq}</td>
  <td style="font-family:var(--font-mono);font-size:var(--type-caption);color:var(--accent-ink)">${type}</td>
  <td style="font-family:var(--font-mono);font-size:var(--type-caption);white-space:nowrap">${timeStr}</td>
  <td style="font-size:var(--type-caption);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${entity}</td>
</tr>`;
      })
      .join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Recent operational events">
    <thead><tr><th>#</th><th>Type</th><th>Time</th><th>Entity</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  <a href="/events.html" style="color:var(--accent-ink)">Browse full event store →</a>
</p>`;
  }

  async function load() {
    const [state, substrateGaps, fleet, escalations, eventsResp] = await Promise.all([
      window.bankShell
        ? window.bankShell.fetch.state()
        : fetch("/api/state", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
      window.bankShell
        ? window.bankShell.fetch.substrateGaps()
        : fetch("/api/substrate-gaps", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
      window.bankShell
        ? window.bankShell.fetch.fleet()
        : fetch("/api/fleet", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
      window.bankShell
        ? window.bankShell.fetch.escalations()
        : fetch("/api/escalations", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
      fetch("/api/events?limit=20", { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    if (window.bankShell?.render?.asOf && state?.asOf) {
      window.bankShell.render.asOf(state.asOf);
    }

    // --- Settlement panel ------------------------------------------
    document.getElementById("ops-settlement-body").innerHTML = renderSettlement(state || {});

    // --- Health metrics -------------------------------------------
    const fleetList = Array.isArray(fleet?.fleet) ? fleet.fleet : [];
    const fleetTotal = fleetList.length;
    let red = 0;
    let amber = 0;
    for (const a of fleetList) {
      const s = (a.status || "").toLowerCase();
      if (s === "red" || s === "blocked" || s === "blocking") red++;
      else if (s === "amber" || s === "warn") amber++;
    }
    const fleetTone = red > 0 ? "error" : amber > 0 ? "warn" : fleetTotal > 0 ? "success" : "muted";
    const fleetText =
      fleetTotal > 0
        ? `${fleetTotal} (${red > 0 ? `${red} red` : amber > 0 ? `${amber} amber` : "all green"})`
        : "–";
    setMetric("ops-fleet", fleetText, fleetTone);

    const openEscalations = Array.isArray(escalations?.escalations)
      ? escalations.escalations.length
      : 0;
    setMetric("ops-escalations", String(openEscalations), openEscalations > 0 ? "warn" : "muted");

    const gapCount = substrateGaps?.gaps?.length ?? 0;
    setMetric("ops-gaps", String(gapCount), gapCount > 0 ? "warn" : "muted");

    // --- Recent events --------------------------------------------
    const events = Array.isArray(eventsResp?.events)
      ? eventsResp.events
      : Array.isArray(eventsResp)
        ? eventsResp
        : [];
    document.getElementById("ops-events-body").innerHTML = renderEvents(events);
  }

  window.bankOps = { load };

  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(load, 30_000);
  } else {
    setInterval(() => load().catch((e) => console.warn("[ops] refresh failed", e)), 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
