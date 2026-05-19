// dashboard/public/events.js — local event store browser.
// Reads GET /api/events with page/limit/type/entity/search params.

(() => {
  const PAGE_SIZE = 50;

  const state = {
    page: 1,
    limit: PAGE_SIZE,
    type: "",
    search: "",
    provenance: "all",
    data: null,
    selectedEventId: null,
  };

  // ---- DOM refs ----
  const tbody = document.getElementById("ev-tbody");
  const pagination = document.getElementById("pagination");
  const resultCount = document.getElementById("result-count");
  const storeCountBadge = document.getElementById("store-count-badge");
  const typeSelect = document.getElementById("type-select");
  const provenanceSelect = document.getElementById("provenance-select");
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-btn");
  const detailHint = document.getElementById("ev-detail-hint");
  const refreshBtn = document.getElementById("refresh-btn");

  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  function provBadge(prov) {
    if (!prov) return `<span class="ev-prov none">—</span>`;
    const mode = prov.scenario ?? prov.mode ?? String(prov);
    if (mode.startsWith("production"))
      return `<span class="ev-prov prod" title="${esc(JSON.stringify(prov))}">prod</span>`;
    if (mode.startsWith("simulated") || mode.includes("dry-run"))
      return `<span class="ev-prov sim" title="${esc(JSON.stringify(prov))}">sim</span>`;
    return `<span class="ev-prov" title="${esc(JSON.stringify(prov))}">${esc(mode.slice(0, 12))}</span>`;
  }

  function actorLabel(actor) {
    if (!actor) return "—";
    if (typeof actor === "object") return actor.id ?? actor.type ?? JSON.stringify(actor);
    return String(actor);
  }

  function fmtAsOf(s) {
    if (!s) return "—";
    return s.slice(0, 19).replace("T", " ");
  }

  async function load() {
    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
    });
    if (state.type) params.set("type", state.type);
    if (state.search) params.set("search", state.search);
    if (state.provenance && state.provenance !== "all") params.set("provenance", state.provenance);

    tbody.innerHTML = `<tr><td colspan="7" class="ev-empty">Loading…</td></tr>`;
    pagination.innerHTML = "";
    resultCount.textContent = "";

    try {
      const res = await fetch(`/api/events?${params}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="ev-empty">Failed to load: ${esc(String(e))}</td></tr>`;
      return;
    }

    render();
  }

  function render() {
    const d = state.data;
    if (!d) return;

    // Store count badge
    if (storeCountBadge) {
      storeCountBadge.textContent = `${d.storeCount.toLocaleString()} total events in store.`;
    }

    // Result count
    resultCount.textContent = `${d.total.toLocaleString()} matching`;

    // Populate type dropdown on first load (no filter active)
    if (typeSelect.options.length === 1 && d.events.length > 0) {
      // Collect distinct types from this result set — only meaningful when unfiltered
      // A dedicated /api/events/types endpoint would be cleaner; for now collect from full store via first load
    }

    // Rows
    if (d.events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="ev-empty">No events match the current filters.</td></tr>`;
    } else {
      tbody.innerHTML = d.events
        .map((ev) => {
          const selected = ev.event_id === state.selectedEventId ? " ev-selected" : "";
          return `<tr class="ev-row${selected}" data-event-id="${esc(ev.event_id)}" style="cursor:pointer">
            <td class="ev-seq">${ev.sequence}</td>
            <td class="ev-type">${esc(ev.type)}</td>
            <td class="ev-as-of">${esc(fmtAsOf(ev.as_of))}</td>
            <td class="ev-entity">${esc(ev.entity)}</td>
            <td class="ev-actor">${esc(actorLabel(ev.actor))}</td>
            <td>${provBadge(ev.provenance)}</td>
            <td class="ev-id" title="${esc(ev.event_id)}">${esc(ev.event_id)}</td>
          </tr>`;
        })
        .join("");

      // Row click → modal detail
      for (const row of tbody.querySelectorAll(".ev-row")) {
        row.addEventListener("click", () => {
          const ev = d.events.find((e) => e.event_id === row.dataset.eventId);
          if (ev) showDetail(ev);
        });
      }
    }

    // Pagination
    renderPagination(d.page, d.totalPages);
  }

  function renderPagination(current, total) {
    if (total <= 1) {
      pagination.innerHTML = "";
      return;
    }

    const _pages = [];
    // Always show first, last, current ±2
    const visible = new Set(
      [1, total, current - 2, current - 1, current, current + 1, current + 2].filter(
        (p) => p >= 1 && p <= total,
      ),
    );
    const sorted = [...visible].sort((a, b) => a - b);

    let html = `<button id="pg-prev" ${current === 1 ? "disabled" : ""}>← Prev</button>`;
    let last = 0;
    for (const p of sorted) {
      if (last && p - last > 1) html += `<span class="ev-page-info">…</span>`;
      html += `<button class="pg-num${p === current ? " active" : ""}" data-page="${p}">${p}</button>`;
      last = p;
    }
    html += `<button id="pg-next" ${current === total ? "disabled" : ""}>Next →</button>`;
    html += `<span class="ev-page-info">page ${current} of ${total}</span>`;
    pagination.innerHTML = html;

    pagination.querySelector("#pg-prev")?.addEventListener("click", () => {
      state.page--;
      load();
    });
    pagination.querySelector("#pg-next")?.addEventListener("click", () => {
      state.page++;
      load();
    });
    for (const btn of pagination.querySelectorAll(".pg-num")) {
      btn.addEventListener("click", () => {
        state.page = Number(btn.dataset.page);
        load();
      });
    }
  }

  function showDetail(ev) {
    if (detailHint) detailHint.style.display = "none";
    SC.openModal({
      title: ev.type,
      body: `<pre style="margin:0;font:13px/1.6 var(--font-mono);white-space:pre-wrap;word-break:break-all">${esc(JSON.stringify(ev, null, 2))}</pre>`,
    });
  }

  // Populate type dropdown from first full load
  // ---- Type dropdown: populate from first full load ----
  function populateTypeDropdown(events) {
    if (typeSelect.options.length > 1) return; // already populated
    const _types = [...new Set(events.map((e) => e.type))].sort();
    // Since we're paginated we can't see all types from one page — do a background fetch
    fetch("/api/events?limit=200&page=1", { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((d) => {
        // Collect from all pages would need iteration; approximate with first 200
        const allTypes = [...new Set(d.events.map((e) => e.type))].sort();
        typeSelect.innerHTML = `<option value="">All types (${allTypes.length}+)</option>${allTypes
          .map(
            (t) =>
              `<option value="${esc(t)}"${state.type === t ? " selected" : ""}>${esc(t)}</option>`,
          )
          .join("")}`;
      })
      .catch(() => {});
  }

  // ---- Events ----
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      state.page = 1;
      load();
    }, 300);
  });

  typeSelect.addEventListener("change", () => {
    state.type = typeSelect.value;
    state.page = 1;
    load();
  });

  provenanceSelect?.addEventListener("change", () => {
    state.provenance = provenanceSelect.value;
    state.page = 1;
    load();
  });

  clearBtn.addEventListener("click", () => {
    state.type = "";
    state.search = "";
    state.provenance = "all";
    state.page = 1;
    searchInput.value = "";
    typeSelect.value = "";
    if (provenanceSelect) provenanceSelect.value = "all";
    load();
  });

  refreshBtn?.addEventListener("click", () => load());

  // Populate type dropdown after initial load
  const _origRender = render;
  function renderWithTypeInit() {
    _origRender();
    if (state.data?.events?.length) populateTypeDropdown(state.data.events);
  }

  // Override render to also init types
  window._eventsPage = { load, render: renderWithTypeInit };

  // ---- Boot ----
  load().then(() => {
    if (state.data?.events?.length) populateTypeDropdown(state.data.events);
  });
})();
