// forward-obligations.js
//
// Client-side renderer for the Forward Obligations dashboard page.
//
// Architecture:
//   - Tab switcher is rendered from the `availableViews` list returned by
//     the API — adding a new view requires only a server-side change.
//   - Horizon selector updates the active horizon and re-fetches.
//   - Planning view: table grouped by date bucket with certainty colour coding.
//   - Liquidity view: per-date net cashflow rows with drill-down items.
//   - 60s polling refresh.
//
// Author: Anya (Frontend / dashboard engineer, engineering)

(() => {
  const POLL_MS = 60_000;
  const DEFAULT_HORIZON = 90;

  let activeView = "planning";
  let activeHorizon = DEFAULT_HORIZON;
  let pollTimer = null;
  let _lastData = null;

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  async function fetchView(view, horizon) {
    const res = await fetch(
      `/api/forward-obligations?view=${encodeURIComponent(view)}&horizon=${horizon}`,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Format helpers
  // ---------------------------------------------------------------------------

  function fmtDate(iso) {
    if (!iso) return "";
    // YYYY-MM-DD → "12 May 2026"
    const [y, m, d] = iso.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
  }

  function fmtAmount(amount, currency) {
    if (amount === undefined || amount === null) return "";
    return `${currency} ${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function certBadge(certainty) {
    return `<span class="cert-badge cert-${certainty}">${certainty}</span>`;
  }

  function srcBadge(source) {
    const labels = {
      "regulatory-filing": "Regulatory",
      "trade-settlement": "Trade settlement",
      "policy-review": "Policy review",
      manual: "Manual",
    };
    return `<span class="src-badge ${source}">${labels[source] || source}</span>`;
  }

  function flowClass(n) {
    if (n > 0) return "flow-positive";
    if (n < 0) return "flow-negative";
    return "flow-zero";
  }

  function fmtNet(n, currency) {
    const abs = Math.abs(n);
    const sign = n >= 0 ? "+" : "−";
    return `<span class="${flowClass(n)}">${sign} ${fmtAmount(abs, currency)}</span>`;
  }

  const BUCKET_LABELS = {
    today: "Today",
    "this-week": "This week",
    "this-month": "This month",
    later: "Later in horizon",
  };

  // ---------------------------------------------------------------------------
  // Tab switcher
  // ---------------------------------------------------------------------------

  function renderTabs(availableViews, activeViewName) {
    const nav = document.getElementById("fo-tabs");
    if (!nav) return;
    nav.innerHTML = availableViews
      .map((v) => {
        const label = v.charAt(0).toUpperCase() + v.slice(1);
        return `<button class="fo-tab-btn${v === activeViewName ? " active" : ""}" data-view="${v}">${label}</button>`;
      })
      .join("");
    for (const btn of nav.querySelectorAll(".fo-tab-btn")) {
      btn.addEventListener("click", () => {
        activeView = btn.dataset.view;
        loadAndRender();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Summary cards
  // ---------------------------------------------------------------------------

  function renderSummaryCards(data) {
    const el = document.getElementById("fo-summary");
    if (!el) return;

    const total = data.totalCount ?? 0;
    const sourceCounts = data.sourceCounts ?? {};
    const viewName = data.view ?? "planning";

    const cards = [
      { num: total, lbl: "Obligations in horizon" },
      { num: sourceCounts["regulatory-filing"] ?? 0, lbl: "Regulatory filings" },
      { num: sourceCounts["trade-settlement"] ?? 0, lbl: "Trade settlements" },
      { num: sourceCounts["policy-review"] ?? 0, lbl: "Policy reviews" },
      { num: sourceCounts.manual ?? 0, lbl: "Manual items" },
    ];

    // View-specific summary
    if (viewName === "planning" && data.data?.bucketCounts) {
      const bc = data.data.bucketCounts;
      cards.push({ num: bc.today ?? 0, lbl: "Due today" });
      cards.push({ num: bc["this-week"] ?? 0, lbl: "Due this week" });
    }
    if (viewName === "liquidity" && data.data?.cashflowItemCount !== undefined) {
      cards.push({ num: data.data.cashflowItemCount, lbl: "Cashflow items" });
      if (data.data.totalNetFlow !== undefined) {
        const net = data.data.totalNetFlow;
        const sign = net >= 0 ? "+" : "−";
        cards.push({
          num: `${sign}${Math.abs(net).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`,
          lbl: `Net ${data.data.primaryCurrency ?? "ZAR"} (weighted)`,
        });
      }
    }

    el.innerHTML = cards
      .map(
        (c) =>
          `<div class="fo-card"><div class="fo-card-num">${c.num}</div><div class="fo-card-lbl">${c.lbl}</div></div>`,
      )
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Planning view renderer
  // ---------------------------------------------------------------------------

  function renderPlanning(data) {
    const pd = data.data;
    if (!pd || !Array.isArray(pd.rows)) {
      return `<div class="fo-empty"><strong>No data</strong>Planning view returned no rows.</div>`;
    }
    if (pd.rows.length === 0) {
      return `<div class="fo-empty"><strong>Nothing due in this horizon</strong>No obligations found in the selected window.</div>`;
    }

    const BUCKET_ORDER = ["today", "this-week", "this-month", "later"];

    // Group rows by bucket while preserving order.
    const grouped = {};
    for (const row of pd.rows) {
      const b = row.bucket || "later";
      if (!grouped[b]) grouped[b] = [];
      grouped[b].push(row);
    }

    let html = `<div class="fo-table-wrap"><table class="fo-table">
      <thead><tr>
        <th>Due date</th>
        <th>Title</th>
        <th>Owner</th>
        <th>Certainty</th>
        <th>Source</th>
        <th>Ref</th>
      </tr></thead><tbody>`;

    for (const bucket of BUCKET_ORDER) {
      const rows = grouped[bucket];
      if (!rows || rows.length === 0) continue;

      html += `<tr class="fo-bucket-header"><td colspan="6">${BUCKET_LABELS[bucket] || bucket} (${rows.length})</td></tr>`;

      for (const row of rows) {
        const ref = row.relatedRef
          ? `<code title="${row.relatedRef}">${row.relatedRef.length > 24 ? `${row.relatedRef.slice(0, 22)}…` : row.relatedRef}</code>`
          : `<span style="color:#bbb">—</span>`;
        const desc = row.description ? ` title="${escapeHtml(row.description)}"` : "";
        html += `<tr${desc}>
          <td>${fmtDate(row.dueDate)}</td>
          <td>${escapeHtml(row.title)}</td>
          <td style="font-size:11.5px">${escapeHtml(row.owner)}</td>
          <td>${certBadge(row.certainty)}</td>
          <td>${srcBadge(row.source)}</td>
          <td>${ref}</td>
        </tr>`;
      }
    }

    html += "</tbody></table></div>";
    return html;
  }

  // ---------------------------------------------------------------------------
  // Liquidity view renderer
  // ---------------------------------------------------------------------------

  function renderLiquidity(data) {
    const ld = data.data;
    if (!ld || !Array.isArray(ld.buckets)) {
      return `<div class="fo-empty"><strong>No cashflow data</strong>Liquidity view returned no buckets.</div>`;
    }
    if (ld.buckets.length === 0) {
      return `<div class="fo-empty"><strong>No cashflow items in horizon</strong>
        <p>No obligations with a defined cashflow were found in this window.
        Regulatory filings (no cash impact) are excluded from this view.</p></div>`;
    }

    let html = `<div class="fo-table-wrap"><table class="fo-liq-table">
      <thead><tr>
        <th>Date</th>
        <th>Currency</th>
        <th>Net flow (weighted)</th>
        <th>Gross outflow</th>
        <th>Gross inflow</th>
        <th>Items</th>
      </tr></thead>`;

    for (let i = 0; i < ld.buckets.length; i++) {
      const b = ld.buckets[i];
      const _rowId = `liq-row-${i}`;
      const itemsId = `liq-items-${i}`;
      html += `<tbody>
        <tr class="fo-liq-date-row" onclick="toggleLiqItems('${itemsId}')">
          <td>${fmtDate(b.date)}</td>
          <td><code>${b.currency}</code></td>
          <td>${fmtNet(b.netFlow, b.currency)}</td>
          <td style="color:#c62828">${b.grossOutflow > 0 ? fmtAmount(b.grossOutflow, b.currency) : "—"}</td>
          <td style="color:#2e7d32">${b.grossInflow > 0 ? fmtAmount(b.grossInflow, b.currency) : "—"}</td>
          <td style="color:#888">${b.items.length}</td>
        </tr>
      </tbody>
      <tbody class="fo-liq-items" id="${itemsId}">`;

      for (const item of b.items) {
        const dirSign = item.direction === "outflow" ? "−" : "+";
        const dirColor = item.direction === "outflow" ? "#c62828" : "#2e7d32";
        html += `<tr>
          <td colspan="2">${escapeHtml(item.title)}</td>
          <td colspan="2" style="color:${dirColor}">${dirSign} ${fmtAmount(item.amount, b.currency)}</td>
          <td colspan="2">${certBadge(item.certainty)} <span style="font-size:11px;color:#888">(weighted: ${fmtAmount(item.weightedAmount, b.currency)})</span></td>
        </tr>`;
      }

      html += "</tbody>";
    }

    html += `</table></div>
    <p style="font-size:11.5px;color:#888;margin-top:8px;">
      Click a date row to expand constituent items.
      Net flow is probability-weighted (certain=100%, probable=90%, estimated=60%).
    </p>`;
    return html;
  }

  // Global toggle helper for liquidity drill-down.
  window.toggleLiqItems = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("open");
  };

  // ---------------------------------------------------------------------------
  // Escape helper
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------------------------
  // Main render loop
  // ---------------------------------------------------------------------------

  async function loadAndRender() {
    const contentEl = document.getElementById("fo-content");
    if (!contentEl) return;

    try {
      const data = await fetchView(activeView, activeHorizon);
      _lastData = data;

      // Render tabs (uses availableViews from server to stay in sync).
      if (data.availableViews) {
        renderTabs(data.availableViews, activeView);
      }

      renderSummaryCards(data);

      if (activeView === "planning") {
        contentEl.innerHTML = renderPlanning(data);
      } else if (activeView === "liquidity") {
        contentEl.innerHTML = renderLiquidity(data);
      } else {
        // Generic fallback for future views
        contentEl.innerHTML = `<pre style="font-size:11.5px;overflow:auto">${escapeHtml(JSON.stringify(data.data, null, 2))}</pre>`;
      }

      const ts = document.getElementById("fo-last-updated");
      if (ts) ts.textContent = `Last updated: ${new Date().toLocaleTimeString("en-ZA")}`;
    } catch (err) {
      contentEl.innerHTML = `<div class="fo-error">Failed to load forward obligations: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Horizon selector
  // ---------------------------------------------------------------------------

  function initHorizonButtons() {
    for (const btn of document.querySelectorAll(".fo-horizon-btn")) {
      btn.addEventListener("click", () => {
        activeHorizon = Number.parseInt(btn.dataset.horizon, 10);
        for (const b of document.querySelectorAll(".fo-horizon-btn")) {
          b.classList.toggle("active", b === btn);
        }
        loadAndRender();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadAndRender, POLL_MS);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  initHorizonButtons();
  loadAndRender();
  startPolling();
})();
