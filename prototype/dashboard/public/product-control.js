// product-control.js — Product Control daily FX P&L dashboard page.
//
// Fetches /api/product-control/daily-pnl and /api/product-control/report-history,
// renders tiles (total P&L, unrealised, active positions, cancelled),
// tables (by pair, by counterparty, trade-level detail, report history).
//
// Authority: D-FX-SALES-TRADING-FRONTEND; IFRS 9 §5.7.1.
// Author: Bea (Accounting & financial reporting engineer, engineering)

(() => {
  function zarFmt(minor) {
    const zar = minor / 100;
    const abs = Math.abs(zar).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${zar < 0 ? "−" : ""}ZAR ${abs}`;
  }

  function pnlColour(minor) {
    if (minor < 0) return "var(--color-danger)";
    if (minor > 0) return "var(--color-success)";
    return "var(--color-text-secondary)";
  }

  async function load() {
    const [pnlData, history] = await Promise.all([
      fetch("/api/product-control/daily-pnl").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/product-control/report-history").then((r) => (r.ok ? r.json() : null)),
    ]);

    const report = pnlData?.report;

    // ── Summary tiles ──────────────────────────────────────────────────────
    const tilesEl = document.getElementById("pc-tiles");
    if (tilesEl && report) {
      const tiles = [
        SC.renderTile({
          label: "Total P&L",
          value: zarFmt(report.totalPnlZarMinor),
          status: report.totalPnlZarMinor < 0 ? "danger" : "ok",
        }),
        SC.renderTile({
          label: "Unrealised P&L",
          value: zarFmt(report.totalUnrealisedPnlZarMinor),
          status: report.totalUnrealisedPnlZarMinor < 0 ? "danger" : "ok",
        }),
        SC.renderTile({
          label: "Realised P&L",
          value: zarFmt(report.totalRealisedPnlZarMinor),
          status: report.totalRealisedPnlZarMinor < 0 ? "danger" : "ok",
        }),
        SC.renderTile({
          label: "Active Positions",
          value: report.activePositions,
          status: "info",
        }),
        SC.renderTile({
          label: "Cancelled",
          value: report.cancelledPositions,
          status: null,
        }),
      ];
      tilesEl.innerHTML = "";
      for (const t of tiles) tilesEl.appendChild(t);
    } else if (tilesEl) {
      tilesEl.innerHTML =
        '<p style="color:var(--color-text-secondary)">No P&L data available. Execute some FX trades to populate this page.</p>';
    }

    // ── By currency pair ───────────────────────────────────────────────────
    const pairEl = document.getElementById("pc-by-pair");
    if (pairEl && report?.byPair?.length) {
      pairEl.innerHTML = SC.renderSectionHeader("P&L by Currency Pair", null);
      const tableWrap = document.createElement("div");
      pairEl.appendChild(tableWrap);
      SC.renderTable({
        container: tableWrap,
        headers: ["Pair", "Trades", "Unrealised P&L (ZAR)", "Realised P&L (ZAR)", "Total (ZAR)"],
        rows: report.byPair.map((r) => ({
          cells: [
            r.pair,
            String(r.tradeCount),
            `<span style="color:${pnlColour(r.unrealisedPnlZarMinor)}">${zarFmt(r.unrealisedPnlZarMinor)}</span>`,
            zarFmt(r.realisedPnlZarMinor),
            `<span style="color:${pnlColour(r.unrealisedPnlZarMinor + r.realisedPnlZarMinor)}">${zarFmt(r.unrealisedPnlZarMinor + r.realisedPnlZarMinor)}</span>`,
          ],
          data: r,
        })),
        onRowClick: (r) =>
          SC.openModal({
            title: `P&L — ${r.pair}`,
            body: `<pre style="font:13px/1.6 var(--font-mono);white-space:pre-wrap">${SC.esc(JSON.stringify(r, null, 2))}</pre>`,
          }),
        emptyMessage: "No positions",
      });
    } else if (pairEl && report) {
      pairEl.innerHTML = `${SC.renderSectionHeader("P&L by Currency Pair", null)}<p style="color:var(--color-text-secondary);padding:var(--space-2) 0">No pair data.</p>`;
    }

    // ── By counterparty ────────────────────────────────────────────────────
    const cpEl = document.getElementById("pc-by-cp");
    if (cpEl && report?.byCounterparty?.length) {
      cpEl.innerHTML = SC.renderSectionHeader("P&L by Counterparty", null);
      const tableWrap = document.createElement("div");
      cpEl.appendChild(tableWrap);
      SC.renderTable({
        container: tableWrap,
        headers: ["Counterparty", "Trades", "Unrealised P&L (ZAR)", "Total (ZAR)"],
        rows: report.byCounterparty.map((r) => ({
          cells: [
            SC.esc(r.counterpartyName || r.counterpartyId),
            String(r.tradeCount),
            `<span style="color:${pnlColour(r.unrealisedPnlZarMinor)}">${zarFmt(r.unrealisedPnlZarMinor)}</span>`,
            `<span style="color:${pnlColour(r.unrealisedPnlZarMinor + r.realisedPnlZarMinor)}">${zarFmt(r.unrealisedPnlZarMinor + r.realisedPnlZarMinor)}</span>`,
          ],
          data: r,
        })),
        onRowClick: (r) =>
          SC.openModal({
            title: r.counterpartyName || r.counterpartyId,
            body: `<pre style="font:13px/1.6 var(--font-mono);white-space:pre-wrap">${SC.esc(JSON.stringify(r, null, 2))}</pre>`,
          }),
        emptyMessage: "No counterparty data",
      });
    } else if (cpEl && report) {
      cpEl.innerHTML = `${SC.renderSectionHeader("P&L by Counterparty", null)}<p style="color:var(--color-text-secondary);padding:var(--space-2) 0">No counterparty data.</p>`;
    }

    // ── Trade-level detail ─────────────────────────────────────────────────
    const tradesEl = document.getElementById("pc-trades");
    if (tradesEl && pnlData?.trades) {
      tradesEl.innerHTML = SC.renderSectionHeader("Trade-Level Detail", null);
      const tableWrap = document.createElement("div");
      tradesEl.appendChild(tableWrap);
      SC.renderTable({
        container: tableWrap,
        headers: [
          "Trade ID",
          "Pair",
          "Side",
          "Book Rate",
          "Reval Rate",
          "Unrealised P&L (ZAR)",
          "Status",
        ],
        rows: pnlData.trades.map((t) => ({
          cells: [
            `<code style="font:12px var(--font-mono)">${SC.esc(t.tradeId)}</code>`,
            SC.esc(t.pair),
            SC.esc(t.side),
            typeof t.bookRate === "number" ? t.bookRate.toFixed(6) : "—",
            t.revalRate != null ? t.revalRate.toFixed(6) : "—",
            t.status === "cancelled"
              ? `<span style="color:var(--color-text-disabled)">—</span>`
              : `<span style="color:${pnlColour(t.unrealisedPnlZarMinor)}">${zarFmt(t.unrealisedPnlZarMinor)}</span>`,
            SC.renderBadge(
              t.status === "cancelled" ? "cancelled" : t.status === "settled" ? "settled" : "live",
            ),
          ],
          data: t,
        })),
        onRowClick: (t) =>
          SC.openModal({
            title: `Trade ${t.tradeId}`,
            body: `<pre style="font:13px/1.6 var(--font-mono);white-space:pre-wrap">${SC.esc(JSON.stringify(t, null, 2))}</pre>`,
          }),
        emptyMessage: "No trades",
      });
    }

    // ── Report history ─────────────────────────────────────────────────────
    const histEl = document.getElementById("pc-history");
    if (histEl && history?.reports) {
      histEl.innerHTML = SC.renderSectionHeader("Report History", null);
      const tableWrap = document.createElement("div");
      histEl.appendChild(tableWrap);
      SC.renderTable({
        container: tableWrap,
        headers: ["Report ID", "Date", "Total P&L (ZAR)", "Positions", "Generated At"],
        rows: history.reports.map((r) => ({
          cells: [
            `<code style="font:12px var(--font-mono)">${SC.esc(r.reportId)}</code>`,
            r.reportDate,
            `<span style="color:${pnlColour(r.totalPnlZarMinor)}">${zarFmt(r.totalPnlZarMinor)}</span>`,
            String(r.activePositions),
            r.generatedAt ? r.generatedAt.slice(0, 19).replace("T", " ") : "—",
          ],
          data: r,
        })),
        onRowClick: (r) =>
          SC.openModal({
            title: `Report ${r.reportId}`,
            body: `<pre style="font:13px/1.6 var(--font-mono);white-space:pre-wrap">${SC.esc(JSON.stringify(r, null, 2))}</pre>`,
          }),
        emptyMessage: "No reports yet",
      });
    }
  }

  load();
})();
