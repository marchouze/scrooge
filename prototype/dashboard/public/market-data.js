// market-data.js — MarketDataStore browser.
// Reads GET /api/market-data with source/instrument/dataType/provenance/limit
// filters and GET /api/market-data/facets for dropdown options.
//
// Most-recent-first ordering comes from the server (as_of DESC). The "search"
// box is a client-side substring match over instrument + payload JSON.

(() => {
  const state = {
    source: "",
    instrument: "",
    dataType: "",
    provenance: "",
    limit: 200,
    search: "",
    ticks: [],
  };

  const tbody = document.getElementById("md-tbody");
  const storeBadge = document.getElementById("md-store-badge");
  const resultCount = document.getElementById("md-result-count");
  const searchInput = document.getElementById("md-search");
  const sourceSel = document.getElementById("md-source");
  const instrumentSel = document.getElementById("md-instrument");
  const typeSel = document.getElementById("md-type");
  const provSel = document.getElementById("md-provenance");
  const limitSel = document.getElementById("md-limit");
  const refreshBtn = document.getElementById("md-refresh");
  const clearBtn = document.getElementById("md-clear");
  const hint = document.getElementById("md-hint");

  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  function fmtTs(s) {
    if (!s) return "—";
    return String(s).slice(0, 19).replace("T", " ");
  }

  function provBadge(p) {
    if (p === "production") return `<span class="md-prov prod">prod</span>`;
    if (p === "simulated") return `<span class="md-prov sim">sim</span>`;
    return `<span class="md-prov" title="${esc(String(p))}">${esc(String(p ?? "—"))}</span>`;
  }

  function payloadPreview(payload) {
    if (payload == null) return "—";
    try {
      // Compact one-line preview — full JSON is in the modal.
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }

  function matchesSearch(tick) {
    if (!state.search) return true;
    const needle = state.search.toLowerCase();
    if (tick.instrument?.toLowerCase().includes(needle)) return true;
    try {
      if (JSON.stringify(tick.payload).toLowerCase().includes(needle)) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  async function loadFacets() {
    try {
      const r = await fetch("/api/market-data/facets", { headers: { Accept: "application/json" } });
      if (!r.ok) return;
      const d = await r.json();
      populateSelect(sourceSel, d.sources, state.source);
      populateSelect(instrumentSel, d.instruments, state.instrument);
      populateSelect(typeSel, d.dataTypes, state.dataType);
    } catch {
      /* facets are best-effort; manual search/refresh still works */
    }
  }

  function populateSelect(sel, values, current) {
    const firstOption = sel.options[0];
    sel.innerHTML = "";
    sel.appendChild(firstOption);
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      if (current === v) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function load() {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Loading…</td></tr>`;
    resultCount.textContent = "";

    const params = new URLSearchParams();
    if (state.source) params.set("source", state.source);
    if (state.instrument) params.set("instrument", state.instrument);
    if (state.dataType) params.set("dataType", state.dataType);
    if (state.provenance) params.set("provenance", state.provenance);
    params.set("limit", String(state.limit));

    try {
      const r = await fetch(`/api/market-data?${params}`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      state.ticks = d.ticks ?? [];
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Failed to load: ${esc(String(e))}</td></tr>`;
      return;
    }

    render();
  }

  function render() {
    const filtered = state.ticks.filter(matchesSearch);

    if (storeBadge) {
      storeBadge.textContent = `${state.ticks.length.toLocaleString()} ticks loaded (limit ${state.limit}).`;
    }
    resultCount.textContent = state.search
      ? `${filtered.length.toLocaleString()} match search`
      : `${filtered.length.toLocaleString()} shown`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No ticks match the current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (t) => `
          <tr class="md-row" data-tick-id="${esc(t.id)}">
            <td>${esc(fmtTs(t.asOf))}</td>
            <td class="md-source">${esc(t.source)}</td>
            <td class="md-instr">${esc(t.instrument)}</td>
            <td class="md-type">${esc(t.dataType)}</td>
            <td>${provBadge(t.provenance)}</td>
            <td class="md-payload" title="${esc(payloadPreview(t.payload))}">${esc(payloadPreview(t.payload))}</td>
            <td class="md-id" title="${esc(t.ingestedAt)}">${esc(fmtTs(t.ingestedAt))}</td>
          </tr>`,
      )
      .join("");

    for (const row of tbody.querySelectorAll(".md-row")) {
      row.addEventListener("click", () => {
        const tick = state.ticks.find((t) => t.id === row.dataset.tickId);
        if (tick) showDetail(tick);
      });
    }
  }

  function showDetail(tick) {
    if (hint) hint.style.display = "none";
    if (typeof window.SC?.openModal === "function") {
      window.SC.openModal({
        title: `${tick.source} — ${tick.instrument}`,
        body: `<pre style="margin:0;font:13px/1.6 var(--font-mono);white-space:pre-wrap;word-break:break-all">${esc(
          JSON.stringify(tick, null, 2),
        )}</pre>`,
      });
    } else {
      alert(JSON.stringify(tick, null, 2));
    }
  }

  // ── Asset-class sections (latest tick per instrument) ────────────
  const SECTIONS = [
    { key: "fx", title: "FX", containerId: "md-section-fx" },
    { key: "rates", title: "Rates", containerId: "md-section-rates" },
    { key: "bonds", title: "Bonds", containerId: "md-section-bonds" },
    { key: "other", title: "Other", containerId: "md-section-other" },
  ];

  function pct(decimalStr) {
    const n = Number(decimalStr);
    if (!Number.isFinite(n)) return esc(String(decimalStr));
    return `${(n * 100).toFixed(3)}%`;
  }

  // Derive a compact human-readable headline value per data type. Falls back
  // to the raw payload preview for unknown types so nothing is hidden.
  function summariseTick(tick) {
    const p = tick.payload || {};
    switch (tick.dataType) {
      case "fx-quote":
        return p.mid != null ? String(p.mid) : payloadPreview(p);
      case "zaronia-rate":
      case "jibar-fixing":
        return p.rate != null ? pct(p.rate) : payloadPreview(p);
      case "repo-prime-rate":
        return p.repoRate != null
          ? `repo ${pct(p.repoRate)} · prime ${pct(p.primeRate)}`
          : payloadPreview(p);
      case "swap-curve-snapshot": {
        const tenors = p.tenors ? Object.keys(p.tenors).length : 0;
        const node = p.tenors && p.tenors["3M"] != null ? `3M ${pct(p.tenors["3M"])}` : "";
        return tenors ? `${tenors} tenors${node ? ` · ${node}` : ""}` : payloadPreview(p);
      }
      case "bond-price":
        return p.cleanPrice != null
          ? `${p.cleanPrice}${p.yieldToMaturity != null ? ` · ytm ${pct(p.yieldToMaturity)}` : ""}`
          : payloadPreview(p);
      default:
        return payloadPreview(p);
    }
  }

  // Bonds carry the human bond code in payload; show it next to the ISIN.
  function instrumentLabel(tick) {
    const code = tick.payload?.bondCode;
    return code
      ? `${esc(tick.instrument)} <span style="color:var(--color-text-secondary)">(${esc(code)})</span>`
      : esc(tick.instrument);
  }

  function renderSection(section, ticks) {
    const container = document.getElementById(section.containerId);
    if (!container) return;
    container.innerHTML = window.SC?.renderSectionHeader
      ? window.SC.renderSectionHeader(`${section.title} (${ticks.length})`)
      : `<h2>${esc(section.title)} (${ticks.length})</h2>`;
    const tableHost = document.createElement("div");
    container.appendChild(tableHost);

    if (window.SC?.renderTable) {
      window.SC.renderTable({
        container: tableHost,
        headers: ["as_of", "Instrument", "Source", "Value", "Prov"],
        rows: ticks.map((t) => ({
          cells: [
            esc(fmtTs(t.asOf)),
            instrumentLabel(t),
            `<span class="md-source">${esc(t.source)}</span>`,
            `<span class="md-val">${esc(summariseTick(t))}</span>`,
            provBadge(t.provenance),
          ],
          data: t,
        })),
        onRowClick: (t) => showDetail(t),
        emptyMessage: `No ${section.title} data ingested yet.`,
      });
    }
  }

  async function loadSections() {
    try {
      const r = await fetch("/api/market-data/by-class", {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      for (const section of SECTIONS) {
        renderSection(section, Array.isArray(d[section.key]) ? d[section.key] : []);
      }
    } catch (e) {
      for (const section of SECTIONS) {
        const container = document.getElementById(section.containerId);
        if (container) {
          container.innerHTML = `<div class="table-empty">Failed to load ${esc(section.title)}: ${esc(String(e))}</div>`;
        }
      }
    }
  }

  // ── Wiring ───────────────────────────────────────────────────────
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      render();
    }, 200);
  });

  sourceSel.addEventListener("change", () => {
    state.source = sourceSel.value;
    load();
  });
  instrumentSel.addEventListener("change", () => {
    state.instrument = instrumentSel.value;
    load();
  });
  typeSel.addEventListener("change", () => {
    state.dataType = typeSel.value;
    load();
  });
  provSel.addEventListener("change", () => {
    state.provenance = provSel.value;
    load();
  });
  limitSel.addEventListener("change", () => {
    state.limit = Number(limitSel.value);
    load();
  });

  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing…";
    try {
      await Promise.all([loadFacets(), load(), loadSections()]);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh";
    }
  });

  clearBtn.addEventListener("click", () => {
    state.source = "";
    state.instrument = "";
    state.dataType = "";
    state.provenance = "";
    state.search = "";
    state.limit = 200;
    searchInput.value = "";
    sourceSel.value = "";
    instrumentSel.value = "";
    typeSel.value = "";
    provSel.value = "";
    limitSel.value = "200";
    load();
  });

  // ── Boot ─────────────────────────────────────────────────────────
  loadSections();
  loadFacets();
  load();
})();
