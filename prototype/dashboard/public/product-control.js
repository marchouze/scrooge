// product-control.js — Product Control daily FX P&L dashboard page.
//
// Fetches /api/product-control/daily-pnl and /api/product-control/report-history,
// renders tiles (total P&L, unrealised, active positions, cancelled),
// tables (by currency, by counterparty, trade-level detail, report history).
//
// Authority: D-FX-SALES-TRADING-FRONTEND; IFRS 9 §5.7.1; IAS-21-§28.
// Author: Bea (Accounting & financial reporting engineer, engineering)

(() => {
  function zarFmt(minor) {
    const zar = minor / 100;
    const abs = Math.abs(zar).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${zar < 0 ? "−" : ""}ZAR ${abs}`;
  }

  function numFmt(minor, ccy) {
    const amount = minor / 100;
    const abs = Math.abs(amount).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${ccy} ${amount < 0 ? "−" : ""}${abs}`;
  }

  function pnlColour(minor) {
    if (minor < 0) return "var(--color-danger)";
    if (minor > 0) return "var(--color-success)";
    return "var(--color-text-secondary)";
  }

  function tradeModalBody(t) {
    const rows = [
      ["Trade ID", `<code style="font:12px var(--font-mono)">${SC.esc(t.tradeId)}</code>`],
      ["Side", t.side ? t.side.charAt(0).toUpperCase() + t.side.slice(1) : "—"],
      [
        "Base",
        t.baseCurrency && t.notionalBaseMinor != null
          ? numFmt(t.notionalBaseMinor, t.baseCurrency)
          : t.baseCurrency || "—",
      ],
      [
        "Quote",
        t.quoteCurrency && t.notionalQuoteMinor != null
          ? numFmt(t.notionalQuoteMinor, t.quoteCurrency)
          : t.quoteCurrency || "—",
      ],
      ["Book Rate", typeof t.bookRate === "number" ? t.bookRate.toFixed(6) : "—"],
      ["Reval Rate", t.revalRate != null ? t.revalRate.toFixed(6) : "—"],
      ["Trade Date", t.tradeDate || "—"],
      ["Settle Date", t.settleDate || "—"],
      ["Counterparty", SC.esc(t.counterpartyName || t.counterpartyId || "—")],
      [
        "Unrealised P&L",
        t.status === "cancelled"
          ? "—"
          : t.markStatus === "unavailable"
            ? `<span style="color:#ff4d4f;font-style:italic">⚠ no mark</span>`
            : `<span style="color:${pnlColour(t.unrealisedPnlZarMinor)}">${zarFmt(t.unrealisedPnlZarMinor)}</span>`,
      ],
      ["Realised P&L", zarFmt(t.realisedPnlZarMinor || 0)],
      [
        "Status",
        `${SC.renderBadge(t.status || "live")}${t.markStatus && t.markStatus !== "live" ? ` <small style="opacity:.7">(mark: ${SC.esc(t.markStatus)})</small>` : ""}`,
      ],
    ];

    const tableRows = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:var(--color-text-secondary);white-space:nowrap;vertical-align:top">${label}</td><td style="padding:4px 0;vertical-align:top">${value}</td></tr>`,
      )
      .join("");
    return `<table style="border-collapse:collapse;width:100%;font:var(--text-body)">${tableRows}</table>`;
  }

  const TRADE_HEADERS = [
    "Trade ID",
    "Pair",
    "Side",
    "Book Rate",
    "Reval Rate",
    "Unrealised P&L (ZAR)",
    "Status",
  ];

  // Build a single trade-detail table row ({cells, data}) — shared by the full
  // list and the live-only filtered view.
  function tradeRow(t) {
    const dimStyle = t.status !== "live" ? ' style="opacity:0.6"' : "";
    const pnlCell =
      t.status === "cancelled"
        ? `<span style="color:var(--color-text-disabled)">—</span>`
        : t.markStatus === "unavailable"
          ? `<span style="color:#ff4d4f;font-style:italic" title="No mark available — MTM data missing">⚠ no mark</span>`
          : t.markStatus === "stale"
            ? `<span style="color:#d48806" title="Stale mark — overnight carry-forward from prior close">${zarFmt(t.unrealisedPnlZarMinor)} <small style="opacity:.7">stale</small></span>`
            : t.markStatus === "overnight"
              ? `<span style="color:#d48806" title="Overnight close proxy — no live feed">${zarFmt(t.unrealisedPnlZarMinor)} <small style="opacity:.7">close</small></span>`
              : `<span style="color:${pnlColour(t.unrealisedPnlZarMinor)}">${zarFmt(t.unrealisedPnlZarMinor)}</span>`;
    const cells = [
      `<span${dimStyle}><code style="font:12px var(--font-mono)">${SC.esc(t.tradeId)}</code></span>`,
      `<span${dimStyle}>${SC.esc(t.pair)}</span>`,
      `<span${dimStyle}>${SC.esc(t.side)}</span>`,
      `<span${dimStyle}>${typeof t.bookRate === "number" ? t.bookRate.toFixed(6) : "—"}</span>`,
      `<span${dimStyle}>${t.revalRate != null ? t.revalRate.toFixed(6) : "—"}</span>`,
      `<span${dimStyle}>${pnlCell}</span>`,
      `<span${dimStyle}>${SC.renderBadge(
        t.status === "cancelled" ? "cancelled" : t.status === "settled" ? "settled" : "live",
      )}</span>`,
    ];
    return { cells, data: t };
  }

  async function load() {
    const [pnlData, history] = await Promise.all([
      fetch("/api/product-control/daily-pnl").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/product-control/report-history").then((r) => (r.ok ? r.json() : null)),
    ]);

    const report = pnlData?.report;

    // ── Mark-unavailable warning banner ────────────────────────────────────
    const tilesEl = document.getElementById("pc-tiles");
    if (tilesEl && pnlData?.marksUnavailableCount > 0) {
      const banner = document.createElement("div");
      banner.style.cssText =
        "background:#fff1f0;border:1px solid #ff4d4f;border-radius:4px;padding:8px 12px;margin-bottom:12px;font:var(--text-body)";
      banner.textContent = `⚠ ${pnlData.marksUnavailableCount} position(s) have no mark — unrealised P&L is incomplete. MTM feed required.`;
      tilesEl.before(banner);
    }

    // ── Summary tiles ──────────────────────────────────────────────────────
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

    // ── By currency ────────────────────────────────────────────────────────
    const ccyEl = document.getElementById("pc-by-currency");
    if (ccyEl && report?.byCurrency?.length) {
      ccyEl.innerHTML = SC.renderSectionHeader("P&L by Currency", null);
      const tableWrap = document.createElement("div");
      ccyEl.appendChild(tableWrap);
      SC.renderTable({
        container: tableWrap,
        headers: [
          "Currency",
          "Trades",
          "Unrealised P&L (ZAR)",
          "Realised P&L (ZAR)",
          "Total (ZAR)",
        ],
        rows: report.byCurrency.map((r) => ({
          cells: [
            `<strong>${SC.esc(r.currency)}</strong>`,
            String(r.tradeCount),
            `<span style="color:${pnlColour(r.unrealisedPnlZarMinor)}">${zarFmt(r.unrealisedPnlZarMinor)}</span>`,
            zarFmt(r.realisedPnlZarMinor),
            `<span style="color:${pnlColour(r.unrealisedPnlZarMinor + r.realisedPnlZarMinor)}">${zarFmt(r.unrealisedPnlZarMinor + r.realisedPnlZarMinor)}</span>`,
          ],
          data: r,
        })),
        onRowClick: (r) =>
          SC.openModal({
            title: `P&L — ${r.currency}`,
            body: `<pre style="font:13px/1.6 var(--font-mono);white-space:pre-wrap">${SC.esc(JSON.stringify(r, null, 2))}</pre>`,
          }),
        emptyMessage: "No positions",
      });
    } else if (ccyEl && report) {
      ccyEl.innerHTML = `${SC.renderSectionHeader("P&L by Currency", null)}<p style="color:var(--color-text-secondary);padding:var(--space-2) 0">No currency data.</p>`;
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
        onRowClick: (r) => {
          // Drill down to the full trade list backing this counterparty's P&L.
          window.location.href = `/product-control-counterparty.html?cp=${encodeURIComponent(r.counterpartyId)}`;
        },
        emptyMessage: "No counterparty data",
      });
    } else if (cpEl && report) {
      cpEl.innerHTML = `${SC.renderSectionHeader("P&L by Counterparty", null)}<p style="color:var(--color-text-secondary);padding:var(--space-2) 0">No counterparty data.</p>`;
    }

    // ── Trade-level detail (all positions, with live-only filter) ──────────
    const tradesEl = document.getElementById("pc-trades");
    if (tradesEl && pnlData?.trades) {
      // Show ALL trades by default — live, settled, and cancelled (non-live
      // greyed out) — with a filter to restrict the list to live trades only.
      const allTrades = pnlData.trades;
      tradesEl.innerHTML = SC.renderSectionHeader("Trade-Level Detail", null);

      const toolbar = document.createElement("div");
      toolbar.style.cssText =
        "display:flex;align-items:center;gap:var(--space-3);margin:var(--space-2) 0 var(--space-3)";
      toolbar.innerHTML =
        `<label style="display:flex;align-items:center;gap:6px;font:var(--text-body);cursor:pointer">` +
        `<input type="checkbox" id="pc-live-only"> Live trades only</label>` +
        `<span id="pc-trade-count" style="color:var(--color-text-secondary);font:var(--text-small)"></span>`;
      tradesEl.appendChild(toolbar);

      const tableWrap = document.createElement("div");
      tradesEl.appendChild(tableWrap);

      function renderTrades(liveOnly) {
        const shown = liveOnly ? allTrades.filter((t) => t.status === "live") : allTrades;
        const countEl = document.getElementById("pc-trade-count");
        if (countEl) countEl.textContent = `Showing ${shown.length} of ${allTrades.length} trade(s)`;
        SC.renderTable({
          container: tableWrap,
          headers: TRADE_HEADERS,
          rows: shown.map(tradeRow),
          onRowClick: (t) =>
            SC.openModal({
              title: `Trade ${t.tradeId}`,
              body: tradeModalBody(t),
            }),
          emptyMessage: liveOnly ? "No live trades" : "No trades",
        });
      }

      renderTrades(false);
      const liveOnlyCb = document.getElementById("pc-live-only");
      if (liveOnlyCb)
        liveOnlyCb.addEventListener("change", () => renderTrades(liveOnlyCb.checked));
    }

    // ── Report history (closing report per day) ────────────────────────────
    const histEl = document.getElementById("pc-history");
    if (histEl && history?.reports) {
      // Multiple reports can be generated for the same trading day (intraday
      // re-runs). The closing report is the one with the latest generatedAt for
      // that reportDate — that is the day's record of account.
      const closingByDate = new Map();
      for (const r of history.reports) {
        const prev = closingByDate.get(r.reportDate);
        if (!prev || (r.generatedAt || "") > (prev.generatedAt || "")) {
          closingByDate.set(r.reportDate, r);
        }
      }
      const closingReports = [...closingByDate.values()].sort((a, b) =>
        a.reportDate < b.reportDate ? 1 : a.reportDate > b.reportDate ? -1 : 0,
      );
      histEl.innerHTML = SC.renderSectionHeader("Report History — Daily Close", null);
      const tableWrap = document.createElement("div");
      histEl.appendChild(tableWrap);
      SC.renderTable({
        container: tableWrap,
        headers: ["Report ID", "Date", "Total P&L (ZAR)", "Positions", "Generated At"],
        rows: closingReports.map((r) => ({
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
