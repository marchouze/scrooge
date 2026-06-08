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

  // Asset-class display labels. "fx" spans FX Spot & Forward (+ swap/NDF), per
  // Marc (CEO) 2026-06-08 — the FX bucket is not spot-only.
  const ASSET_LABELS = {
    fx: "FX (Spot & Forward)",
    cash: "Cash",
    bond: "Bond",
    equity: "Equity",
    ird: "IRS",
  };
  function assetLabel(ac) {
    return ASSET_LABELS[ac] || ac;
  }

  // Unrealised cell honouring no-silent-zero: an unmarkable row shows "⚠ no mark"
  // (the badge, not a 0, is the signal) rather than a misleading ZAR 0.
  function unrealCell(markable, minor) {
    return markable
      ? `<span style="color:${pnlColour(minor)}">${zarFmt(minor)}</span>`
      : `<span style="color:#ff4d4f;font-style:italic" title="No production mark — cannot revalue (no silent 0)">⚠ no mark</span>`;
  }

  // Position size, shown in the row's natural unit.
  function qtyCell(r) {
    if (r.assetClass === "fx") {
      const base = (r.instrumentKey.split("/")[0] || "").trim();
      return base ? numFmt(r.quantity, base) : String(r.quantity);
    }
    return numFmt(r.quantity, r.currency);
  }

  const INSTRUMENT_HEADERS = [
    "Instrument",
    "Asset Class",
    "Book",
    "Currency",
    "Quantity",
    "Unrealised P&L (ZAR)",
    "Realised P&L (ZAR)",
    "Mark",
  ];

  // One By-Instrument table row ({cells, data}) — shared by the main filtered
  // table and the By-Book drill-down modal.
  function instrumentRow(r) {
    const taxo =
      r.assetClass === "fx" && r.fxTaxonomy
        ? ` <small style="opacity:.65">${SC.esc(r.fxTaxonomy.replace("FX-", ""))}</small>`
        : "";
    return {
      cells: [
        `<code style="font:12px var(--font-mono)">${SC.esc(r.instrumentKey)}</code>`,
        `${SC.esc(assetLabel(r.assetClass))}${taxo}`,
        SC.esc(r.bookId),
        `<strong>${SC.esc(r.currency)}</strong>`,
        qtyCell(r),
        unrealCell(r.markable, r.unrealisedZarMinor),
        r.realisedZarMinor
          ? `<span style="color:${pnlColour(r.realisedZarMinor)}">${zarFmt(r.realisedZarMinor)}</span>`
          : `<span style="color:var(--color-text-secondary)">—</span>`,
        markBadge(r.markStatus),
      ],
      data: r,
    };
  }

  function markBadge(status) {
    const map = {
      live: ["#52c41a", "live"],
      marked: ["#52c41a", "marked"],
      stale: ["#d48806", "stale"],
      overnight: ["#d48806", "close"],
      unavailable: ["#ff4d4f", "no mark"],
      "no-mark": ["#ff4d4f", "no mark"],
    };
    const [colour, label] = map[status] || ["var(--color-text-secondary)", status || "—"];
    return `<span style="color:${colour};font:var(--text-small)">${SC.esc(label)}</span>`;
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

  // Build a single trade-detail table row ({cells, data}) — shared by the full
  // list and the live-only filtered view.
  function tradeRow(t) {
    const dimStyle = t.status !== "live" ? ' style="opacity:0.6"' : "";
    const pnlCell =
      t.status === "cancelled" || t.status === "settled"
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

  async function load() {
    const [pnlData, history, cashData, crossAsset] = await Promise.all([
      fetch("/api/product-control/daily-pnl").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/product-control/report-history").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/product-control/desk-cash").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/product-control/cross-asset").then((r) => (r.ok ? r.json() : null)),
    ]);

    const report = pnlData?.report;

    // ── Mark-unavailable warning banner ────────────────────────────────────
    // Distinguish two causes (server-classified): positions awaiting
    // revaluation (a production mark exists, just not yet revalued — e.g.
    // booked since the last MTM run) vs a genuine feed gap (no production tick
    // for the pair). Only the latter warrants "MTM feed required".
    const tilesEl = document.getElementById("pc-tiles");
    const mu = pnlData?.marksUnavailable;
    if (tilesEl && pnlData?.marksUnavailableCount > 0) {
      const feed = mu?.feedMissing;
      const awaiting = mu?.awaitingReval;
      const lines = [];
      if (feed && feed.count > 0) {
        const pairs = feed.pairs.length ? ` (${feed.pairs.join(", ")})` : "";
        lines.push(
          `⚠ ${feed.count} position(s) have no market-data feed${pairs} — MTM feed required; unrealised P&L excludes them.`,
        );
      }
      if (awaiting && awaiting.count > 0) {
        const pairs = awaiting.pairs.length ? ` (${awaiting.pairs.join(", ")})` : "";
        lines.push(
          `ℹ ${awaiting.count} position(s) awaiting revaluation${pairs} — a mark exists; they will be valued on the next MTM run. Unrealised P&L excludes them until then.`,
        );
      }
      // Fallback when the breakdown is absent (older server payload).
      if (lines.length === 0) {
        lines.push(
          `⚠ ${pnlData.marksUnavailableCount} position(s) have no mark — unrealised P&L is incomplete.`,
        );
      }
      // Severity: red only when a genuine feed gap exists; amber for awaiting-only.
      const isFeedGap = !!(feed && feed.count > 0) || !mu;
      const banner = document.createElement("div");
      banner.style.cssText = isFeedGap
        ? "background:#fff1f0;border:1px solid #ff4d4f;border-radius:4px;padding:8px 12px;margin-bottom:12px;font:var(--text-body)"
        : "background:#fffbe6;border:1px solid #faad14;border-radius:4px;padding:8px 12px;margin-bottom:12px;font:var(--text-body)";
      banner.innerHTML = lines.map((l) => `<div>${l}</div>`).join("");
      tilesEl.before(banner);
    }

    // ── Summary tiles ──────────────────────────────────────────────────────
    if (tilesEl && report) {
      // Headline figures span ALL asset classes (cross-asset engine) when
      // available, falling back to the FX-only report if that fetch failed.
      // Cross-asset unrealised is the markable sum (no-silent-zero); realised is
      // the cross-asset total. Active/Cancelled remain the FX trade counts.
      const unrealZarMinor = crossAsset
        ? crossAsset.markableUnrealisedZarMinor
        : report.totalUnrealisedPnlZarMinor;
      const realisedZarMinor = crossAsset
        ? crossAsset.totalRealisedZarMinor
        : (cashData?.totalRealisedZarMinor ?? report.totalRealisedPnlZarMinor);
      const totalZarMinor = unrealZarMinor + realisedZarMinor;
      const incomplete = crossAsset && crossAsset.unrealisedComplete === false;
      const tiles = [
        SC.renderTile({
          label: "Total P&L",
          value: zarFmt(totalZarMinor),
          status: totalZarMinor < 0 ? "danger" : "ok",
        }),
        SC.renderTile({
          label: incomplete ? "Unrealised P&L (markable)" : "Unrealised P&L",
          value: zarFmt(unrealZarMinor),
          status: unrealZarMinor < 0 ? "danger" : "ok",
        }),
        SC.renderTile({
          label: "Realised P&L",
          value: zarFmt(realisedZarMinor),
          status: realisedZarMinor < 0 ? "danger" : "ok",
        }),
        SC.renderTile({
          label: "Instruments",
          value: crossAsset ? crossAsset.instruments.length : "—",
          status: "info",
        }),
        SC.renderTile({
          label: "Books",
          value: crossAsset ? crossAsset.books.length : "—",
          status: null,
        }),
      ];
      tilesEl.innerHTML = "";
      for (const t of tiles) tilesEl.appendChild(t);
    } else if (tilesEl) {
      tilesEl.innerHTML =
        '<p style="color:var(--color-text-secondary)">No P&L data available. Execute some FX trades to populate this page.</p>';
    }

    // ── By Book (cross-asset, drill into instruments) ──────────────────────
    const bookEl = document.getElementById("pc-by-book");
    if (bookEl && crossAsset) {
      bookEl.innerHTML = SC.renderSectionHeader("P&L by Book", null);
      const note = document.createElement("p");
      note.style.cssText =
        "font:var(--text-small);color:var(--color-text-secondary);margin:0 0 var(--space-3)";
      note.textContent =
        "Every trading book, aggregated across all asset classes. Click a book to drill into its instruments.";
      bookEl.appendChild(note);
      const tableWrap = document.createElement("div");
      bookEl.appendChild(tableWrap);
      SC.renderTable({
        container: tableWrap,
        headers: [
          "Book",
          "Asset Classes",
          "Instruments",
          "Positions",
          "Unrealised P&L (ZAR)",
          "Realised P&L (ZAR)",
          "Total (ZAR)",
        ],
        rows: crossAsset.books.map((b) => {
          const total = (b.markable ? b.unrealisedZarMinor : 0) + b.realisedZarMinor;
          return {
            cells: [
              `<strong>${SC.esc(b.bookId)}</strong>`,
              b.assetClasses.map((ac) => assetLabel(ac)).join(", "),
              String(b.instrumentCount),
              String(b.positionCount),
              unrealCell(b.markable, b.unrealisedZarMinor),
              zarFmt(b.realisedZarMinor),
              `<span style="color:${pnlColour(total)}">${zarFmt(total)}</span>`,
            ],
            data: b,
          };
        }),
        onRowClick: (b) => {
          const inBook = crossAsset.instruments.filter((r) => r.bookId === b.bookId);
          const wrap = document.createElement("div");
          SC.renderTable({
            container: wrap,
            headers: INSTRUMENT_HEADERS,
            rows: inBook.map(instrumentRow),
            emptyMessage: "No instruments in this book",
          });
          SC.openModal({ title: `Book — ${b.bookId}`, body: wrap });
        },
        emptyMessage: "No books",
      });
    }

    // ── By Instrument (cross-asset, asset-class filter) ────────────────────
    const instEl = document.getElementById("pc-by-instrument");
    if (instEl && crossAsset) {
      instEl.innerHTML = SC.renderSectionHeader("P&L by Instrument", null);
      const all = crossAsset.instruments;
      const classes = [...new Set(all.map((r) => r.assetClass))];

      const toolbar = document.createElement("div");
      toolbar.style.cssText =
        "display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin:var(--space-2) 0 var(--space-3)";
      const chipDefs = [{ key: "all", label: "All" }].concat(
        classes.map((ac) => ({ key: ac, label: assetLabel(ac) })),
      );
      let active = "all";
      for (const def of chipDefs) {
        const chip = document.createElement("button");
        chip.dataset.key = def.key;
        chip.textContent = def.label;
        chip.style.cssText =
          "border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text-primary);border-radius:999px;padding:4px 12px;font:var(--text-small);cursor:pointer";
        toolbar.appendChild(chip);
      }
      instEl.appendChild(toolbar);
      const tableWrap = document.createElement("div");
      instEl.appendChild(tableWrap);

      function paintChips() {
        for (const chip of toolbar.children) {
          const on = chip.dataset.key === active;
          chip.style.background = on ? "var(--color-accent, #1677ff)" : "var(--color-surface)";
          chip.style.color = on ? "#fff" : "var(--color-text-primary)";
          chip.style.borderColor = on ? "var(--color-accent, #1677ff)" : "var(--color-border)";
        }
      }
      function renderInstruments() {
        const shown = active === "all" ? all : all.filter((r) => r.assetClass === active);
        SC.renderTable({
          container: tableWrap,
          headers: INSTRUMENT_HEADERS,
          rows: shown.map(instrumentRow),
          onRowClick: (r) =>
            SC.openModal({
              title: r.instrumentKey,
              body: `<pre style="font:13px/1.6 var(--font-mono);white-space:pre-wrap">${SC.esc(JSON.stringify(r, null, 2))}</pre>`,
            }),
          emptyMessage: "No instruments",
        });
      }
      toolbar.addEventListener("click", (e) => {
        const key = e.target?.dataset?.key;
        if (!key) return;
        active = key;
        paintChips();
        renderInstruments();
      });
      paintChips();
      renderInstruments();
    }

    // ── Desk FX cash instruments (settled foreign-currency inventory) ──────
    // The desk's settled foreign currency is a financial instrument, revalued
    // daily against ZAR (CEO instruction 2026-05-31; IAS 21 §28).
    const cashEl = document.getElementById("pc-cash");
    if (cashEl) {
      const cash = cashData;
      const positions = (cash?.positions || []).filter((p) => p.fcyQuantityMinor !== 0);
      if (positions.length) {
        cashEl.innerHTML = SC.renderSectionHeader("Desk FX Cash Instruments", null);
        const note = document.createElement("p");
        note.style.cssText =
          "font:var(--text-small);color:var(--color-text-secondary);margin:0 0 var(--space-3)";
        note.textContent =
          "Settled foreign-currency cash held by each desk, marked to ZAR at the current rate (IAS 21 §28). Unrealised = holding × (current rate − weighted-avg cost).";
        cashEl.appendChild(note);
        const tableWrap = document.createElement("div");
        cashEl.appendChild(tableWrap);
        SC.renderTable({
          container: tableWrap,
          headers: [
            "Instrument",
            "Book",
            "Currency",
            "Holding",
            "Avg Cost (ZAR/ccy)",
            "Mark (ZAR/ccy)",
            "ZAR Value",
            "Unrealised P&L (ZAR)",
            "Realised P&L (ZAR)",
          ],
          rows: positions.map((p) => ({
            cells: [
              `<code style="font:12px var(--font-mono)">${SC.esc(p.instrumentId)}</code>`,
              SC.esc(p.bookId),
              `<strong>${SC.esc(p.currency)}</strong>`,
              numFmt(p.fcyQuantityMinor, p.currency),
              typeof p.avgCostZarRate === "number" ? p.avgCostZarRate.toFixed(6) : "—",
              p.markRate != null ? p.markRate.toFixed(6) : "—",
              p.zarValueMinor != null ? zarFmt(p.zarValueMinor) : "—",
              p.unrealisedMarkable
                ? `<span style="color:${pnlColour(p.unrealisedPnlZarMinor)}">${zarFmt(p.unrealisedPnlZarMinor)}</span>`
                : `<span style="color:#ff4d4f;font-style:italic" title="No CCY/ZAR mark — cannot revalue">⚠ no mark</span>`,
              `<span style="color:${pnlColour(p.realisedZarMinorCumulative)}">${zarFmt(p.realisedZarMinorCumulative)}</span>`,
            ],
            data: p,
          })),
          onRowClick: (p) =>
            SC.openModal({
              title: p.instrumentId,
              body: `<pre style="font:13px/1.6 var(--font-mono);white-space:pre-wrap">${SC.esc(JSON.stringify(p, null, 2))}</pre>`,
            }),
          emptyMessage: "No settled FX cash positions",
        });
      }
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
        `<input type="checkbox" id="pc-live-only" checked> Live trades only</label>` +
        `<span id="pc-trade-count" style="color:var(--color-text-secondary);font:var(--text-small)"></span>`;
      tradesEl.appendChild(toolbar);

      const tableWrap = document.createElement("div");
      tradesEl.appendChild(tableWrap);

      function renderTrades(liveOnly) {
        const shown = liveOnly ? allTrades.filter((t) => t.status === "live") : allTrades;
        const countEl = document.getElementById("pc-trade-count");
        if (countEl)
          countEl.textContent = `Showing ${shown.length} of ${allTrades.length} trade(s)`;
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

      renderTrades(true);
      const liveOnlyCb = document.getElementById("pc-live-only");
      if (liveOnlyCb) liveOnlyCb.addEventListener("change", () => renderTrades(liveOnlyCb.checked));
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
