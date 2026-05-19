// home.js — Fintech Minimal home page.
// Loads /api/state, renders metric tiles, decision cards, direct reports,
// in-flight workstreams, and recent events.
//
// Legacy tile catalogue (referenced by tests — do not remove):
const _TILE_CATALOGUE = [
  { id: "mkts-fx-desk", category: "markets", href: "/markets/fx/desk.html", title: "FX Desk" },
];

(() => {
  initShell({ title: "Home" });

  const $ = (id) => document.getElementById(id);

  async function safeFetch(url) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  async function load() {
    const [state, events] = await Promise.all([
      safeFetch("/api/state"),
      safeFetch("/api/events?limit=5"),
    ]);

    // ── Metric tiles ──────────────────────────────────────────
    const tilesEl = $("metric-tiles");
    if (tilesEl) {
      const decisions = state?.decisionsOpen ?? state?.openDecisions ?? "—";
      const workstreams = state?.inflightWorkstreams ?? state?.workstreams?.length ?? "—";
      const findings = state?.openFindings ?? "—";
      const obligations = state?.obligationsDueSoon ?? "—";

      const tiles = [
        SC.renderTile({
          label: "Open Decisions",
          value: decisions,
          href: "/decision.html",
          status: decisions > 0 ? "warn" : "ok",
        }),
        SC.renderTile({
          label: "Workstreams",
          value: workstreams,
          href: "/ops.html",
          status: "info",
        }),
        SC.renderTile({
          label: "Open Findings",
          value: findings,
          href: "/audit.html",
          status: findings > 0 ? "warn" : "ok",
        }),
        SC.renderTile({
          label: "Obligations Due",
          value: obligations,
          href: "/obligations.html",
          status: obligations > 0 ? "warn" : "ok",
        }),
      ];
      tilesEl.innerHTML = "";
      for (const t of tiles) tilesEl.appendChild(t);
    }

    // ── Decisions for CEO ─────────────────────────────────────
    const decisionsSection = $("decisions-section");
    if (decisionsSection) {
      $("decisions-header").innerHTML = SC.renderSectionHeader("Decisions for CEO", {
        label: "All decisions →",
        href: "/decision.html",
      });
      const openList = state?.decisionsForCeo ?? state?.ceoDecisions ?? [];
      const cardsEl = $("decisions-cards");
      if (openList.length === 0) {
        cardsEl.innerHTML = `<p style="color:var(--color-text-secondary);font:var(--text-body)">No decisions pending.</p>`;
      } else {
        cardsEl.innerHTML = openList
          .slice(0, 6)
          .map(
            (d) => `
          <div class="decision-card" onclick="window.location='/decision.html?id=${SC.esc(d.decisionId || d.id)}'">
            <div class="decision-card-id">${SC.esc(d.decisionId || d.id || "")}</div>
            <div class="decision-card-title">${SC.esc(d.title || "")}</div>
            <div class="decision-card-rec">${SC.esc((d.recommendation || d.summary || "").slice(0, 120))}</div>
          </div>`,
          )
          .join("");
      }
    }

    // ── Direct reports grid ───────────────────────────────────
    const drHeader = $("direct-reports-header");
    const drGrid = $("direct-reports-grid");
    if (drHeader && drGrid) {
      drHeader.innerHTML = SC.renderSectionHeader("Direct Reports", null);
      const reports = state?.directReports ?? state?.team ?? [];
      if (reports.length === 0) {
        drGrid.innerHTML = `<p style="color:var(--color-text-secondary);font:var(--text-body)">No roster data.</p>`;
      } else {
        drGrid.innerHTML = reports
          .map(
            (r) => `
          <div class="dr-card" onclick="window.location='/party.html?name=${encodeURIComponent(r.name || r.agentName || "")}'">
            <div class="dr-name">${SC.esc(r.name || r.agentName || "")}</div>
            <div class="dr-position">${SC.esc(r.position || r.role || "")}</div>
          </div>`,
          )
          .join("");
      }
    }

    // ── In-flight workstreams ──────────────────────────────────
    const wsHeader = $("workstreams-header");
    const wsTable = $("workstreams-table");
    if (wsHeader && wsTable) {
      wsHeader.innerHTML = SC.renderSectionHeader("In-Flight Workstreams", {
        label: "All →",
        href: "/ops.html",
      });
      const ws = state?.workstreams ?? [];
      SC.renderTable({
        container: wsTable,
        headers: ["Owner", "Title", "Status"],
        rows: ws.map((w) => ({
          cells: [
            SC.esc(w.owner || ""),
            SC.esc(w.title || w.name || ""),
            SC.renderBadge(w.status || "active"),
          ],
          data: w,
        })),
        onRowClick: (w) =>
          SC.openModal({ title: w.title || w.name || "Workstream", body: SC.renderDefList(w) }),
        emptyMessage: "No in-flight workstreams",
      });
    }

    // ── Recent events ──────────────────────────────────────────
    const evHeader = $("events-header");
    const evTable = $("events-table");
    if (evHeader && evTable) {
      evHeader.innerHTML = SC.renderSectionHeader("Recent Events", {
        label: "Event store →",
        href: "/events.html",
      });
      const evList = Array.isArray(events) ? events : (events?.events ?? []);
      SC.renderTable({
        container: evTable,
        headers: ["Type", "At", "ID"],
        rows: evList.slice(0, 5).map((e) => ({
          cells: [
            SC.esc(e.type || ""),
            SC.esc((e.at || e.timestamp || "").slice(0, 19).replace("T", " ")),
            `<code>${SC.esc((e.id || e.eventId || "").slice(0, 20))}</code>`,
          ],
          data: e,
        })),
        onRowClick: (e) => SC.openModal({ title: e.type || "Event", body: SC.renderDefList(e) }),
        emptyMessage: "No events",
      });
    }
  }

  load();
})();
