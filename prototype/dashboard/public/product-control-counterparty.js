// product-control-counterparty.js — Product Control: per-counterparty trades.
//
// Drill-down from the Product Control "P&L by Counterparty" table. Reads the
// `cp` query param (counterpartyId), fetches /api/product-control/daily-pnl,
// filters the trade-level detail to that counterparty, and renders the full
// list of trades that make up that counterparty's P&L. Clicking any trade opens
// the trade-detail modal. A "Live trades only" filter restricts the list.
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
    "Realised P&L (ZAR)",
    "Status",
  ];

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
    const realisedCell = t.realisedPnlZarMinor
      ? `<span style="color:${pnlColour(t.realisedPnlZarMinor)}">${zarFmt(t.realisedPnlZarMinor)}</span>`
      : `<span style="color:var(--color-text-secondary)">—</span>`;
    const cells = [
      `<span${dimStyle}><code style="font:12px var(--font-mono)">${SC.esc(t.tradeId)}</code></span>`,
      `<span${dimStyle}>${SC.esc(t.pair)}</span>`,
      `<span${dimStyle}>${SC.esc(t.side)}</span>`,
      `<span${dimStyle}>${typeof t.bookRate === "number" ? t.bookRate.toFixed(6) : "—"}</span>`,
      `<span${dimStyle}>${t.revalRate != null ? t.revalRate.toFixed(6) : "—"}</span>`,
      `<span${dimStyle}>${pnlCell}</span>`,
      `<span${dimStyle}>${realisedCell}</span>`,
      `<span${dimStyle}>${SC.renderBadge(
        t.status === "cancelled" ? "cancelled" : t.status === "settled" ? "settled" : "live",
      )}</span>`,
    ];
    return { cells, data: t };
  }

  const params = new URLSearchParams(window.location.search);
  const cpId = params.get("cp") || "";

  async function load() {
    const pnlData = await fetch("/api/product-control/daily-pnl").then((r) =>
      r.ok ? r.json() : null,
    );
    const allForCp = (pnlData?.trades || []).filter((t) => t.counterpartyId === cpId);
    const cpName = allForCp[0]?.counterpartyName || cpId || "Unknown counterparty";

    const titleEl = document.getElementById("pc-cp-title");
    if (titleEl) titleEl.textContent = cpName;
    document.title = `${cpName} — Product Control — Scrooge Bank`;

    // ── Summary tiles ──────────────────────────────────────────────────────
    const tilesEl = document.getElementById("pc-cp-tiles");
    if (tilesEl) {
      if (!cpId) {
        tilesEl.innerHTML =
          '<p style="color:var(--color-text-secondary)">No counterparty specified.</p>';
      } else if (allForCp.length === 0) {
        tilesEl.innerHTML =
          '<p style="color:var(--color-text-secondary)">No trades found for this counterparty.</p>';
      } else {
        const unreal = allForCp.reduce(
          (s, t) => s + (t.status === "live" ? t.unrealisedPnlZarMinor : 0),
          0,
        );
        const real = allForCp.reduce((s, t) => s + (t.realisedPnlZarMinor || 0), 0);
        const liveCount = allForCp.filter((t) => t.status === "live").length;
        const tiles = [
          SC.renderTile({ label: "Trades", value: String(allForCp.length), status: "info" }),
          SC.renderTile({ label: "Live", value: String(liveCount), status: "info" }),
          SC.renderTile({
            label: "Unrealised P&L",
            value: zarFmt(unreal),
            status: unreal < 0 ? "danger" : "ok",
          }),
          SC.renderTile({
            label: "Realised P&L",
            value: zarFmt(real),
            status: real < 0 ? "danger" : "ok",
          }),
          SC.renderTile({
            label: "Total P&L",
            value: zarFmt(unreal + real),
            status: unreal + real < 0 ? "danger" : "ok",
          }),
        ];
        tilesEl.innerHTML = "";
        for (const t of tiles) tilesEl.appendChild(t);
      }
    }

    // ── Trade-level detail (with live-only filter) ─────────────────────────
    const tradesEl = document.getElementById("pc-cp-trades");
    if (tradesEl && allForCp.length) {
      tradesEl.innerHTML = SC.renderSectionHeader("Trade-Level Detail", null);

      const toolbar = document.createElement("div");
      toolbar.style.cssText =
        "display:flex;align-items:center;gap:var(--space-3);margin:var(--space-2) 0 var(--space-3)";
      toolbar.innerHTML =
        `<label style="display:flex;align-items:center;gap:6px;font:var(--text-body);cursor:pointer">` +
        `<input type="checkbox" id="pc-cp-live-only"> Live trades only</label>` +
        `<span id="pc-cp-trade-count" style="color:var(--color-text-secondary);font:var(--text-small)"></span>`;
      tradesEl.appendChild(toolbar);

      const tableWrap = document.createElement("div");
      tradesEl.appendChild(tableWrap);

      function renderTrades(liveOnly) {
        const shown = liveOnly ? allForCp.filter((t) => t.status === "live") : allForCp;
        const countEl = document.getElementById("pc-cp-trade-count");
        if (countEl) countEl.textContent = `Showing ${shown.length} of ${allForCp.length} trade(s)`;
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
      const liveOnlyCb = document.getElementById("pc-cp-live-only");
      if (liveOnlyCb) liveOnlyCb.addEventListener("change", () => renderTrades(liveOnlyCb.checked));
    }
  }

  load();
})();
