// regulatory.js — Regulatory Intelligence dashboard page.
//
// Fetches from:
//   GET /api/regulatory/instruments               — instrument list + summary
//   GET /api/regulatory/instruments/:id/concepts  — per-instrument concepts
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  // ── State ────────────────────────────────────────────────────────────────
  let allInstruments = [];
  let activeInstrumentId = null;
  let allConcepts = [];
  let expandedSectionId = null;

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const sumInstruments = document.getElementById("sumInstruments");
  const sumConcepts = document.getElementById("sumConcepts");
  const sumHighApp = document.getElementById("sumHighApp");
  const sumAvgApp = document.getElementById("sumAvgApp");
  const sumAvgRel = document.getElementById("sumAvgRel");

  const filterType = document.getElementById("filterType");
  const filterStatus = document.getElementById("filterStatus");
  const filterSearch = document.getElementById("filterSearch");
  const instrumentCount = document.getElementById("instrumentCount");
  const instrumentGrid = document.getElementById("instrumentGrid");

  const conceptsPanel = document.getElementById("conceptsPanel");
  const conceptsPanelTitle = document.getElementById("conceptsPanelTitle");
  const conceptsClose = document.getElementById("conceptsClose");
  const conceptSort = document.getElementById("conceptSort");
  const conceptMinScore = document.getElementById("conceptMinScore");
  const conceptDomain = document.getElementById("conceptDomain");
  const conceptCount = document.getElementById("conceptCount");
  const conceptBody = document.getElementById("conceptBody");
  const thApp = document.getElementById("thApp");
  const thRel = document.getElementById("thRel");

  const refreshBtn = document.getElementById("refreshBtn");
  const lastUpdated = document.getElementById("lastUpdated");

  // ── Helpers ───────────────────────────────────────────────────────────────

  function pct(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "—";
    return (n * 100).toFixed(0) + "%";
  }

  function scoreBar(score, color) {
    const pctVal = Math.round(score * 100);
    return `<span class="reg-score-bar" style="width:${pctVal}px;max-width:80px;background:${color};"></span>`;
  }

  function scoreColor(score) {
    if (score >= 0.7) return "#2e7d32";
    if (score >= 0.4) return "#f57c00";
    return "#bdbdbd";
  }

  function statusClass(status) {
    if (status === "complete") return "status-complete";
    if (status === "in-progress") return "status-in-progress";
    return "status-pending";
  }

  function statusLabel(status) {
    if (status === "in-progress") return "In progress";
    if (status === "complete") return "Complete";
    return "Pending";
  }

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tagsHtml(arr, cls = "reg-tag") {
    if (!arr || arr.length === 0) return '<span style="color:var(--neutral-stone)">—</span>';
    return arr.map((t) => `<span class="${cls}">${esc(t)}</span>`).join(" ");
  }

  // ── Summary bar ───────────────────────────────────────────────────────────

  function renderSummary(summary) {
    if (!summary) return;
    sumInstruments.textContent = summary.totalInstruments;
    sumConcepts.textContent = summary.totalConcepts;
    sumHighApp.textContent = summary.highApplicabilityCount;
    sumAvgApp.textContent = pct(summary.avgApplicabilityScore);
    sumAvgRel.textContent = pct(summary.avgRelevancyScore);
  }

  // ── Instrument cards ──────────────────────────────────────────────────────

  function filterInstruments() {
    const typeVal = filterType.value.toLowerCase();
    const statusVal = filterStatus.value;
    const searchVal = filterSearch.value.toLowerCase();

    return allInstruments.filter((inst) => {
      if (typeVal && inst.instrumentType !== typeVal) return false;
      if (statusVal && inst.extractionStatus !== statusVal) return false;
      if (searchVal) {
        const haystack = [
          inst.title,
          inst.instrumentId,
          inst.issuingBody,
          inst.regulatoryAuthority?.name,
          inst.regulatoryObjective?.primaryObjective,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchVal)) return false;
      }
      return true;
    });
  }

  function renderInstrumentCards() {
    const visible = filterInstruments();
    instrumentCount.textContent = `${visible.length} of ${allInstruments.length} instrument${allInstruments.length !== 1 ? "s" : ""}`;

    if (visible.length === 0) {
      instrumentGrid.innerHTML =
        '<div class="reg-empty" style="grid-column:1/-1;">No instruments match the current filters.</div>';
      return;
    }

    instrumentGrid.innerHTML = visible
      .map((inst) => {
        const isActive = inst.instrumentId === activeInstrumentId;
        const sClass = statusClass(inst.extractionStatus);
        const sLabel = statusLabel(inst.extractionStatus);
        const regName = inst.regulatoryAuthority?.name ?? "";
        const approach = inst.regulatoryObjective?.enforcementApproach ?? "";
        return `<div class="reg-instrument-card${isActive ? " active" : ""}" data-id="${esc(inst.instrumentId)}" tabindex="0" role="button" aria-pressed="${isActive}">
  <div class="reg-instrument-head">
    <div class="reg-instrument-title">${esc(inst.title)}</div>
    <span class="reg-status-badge ${sClass}">${sLabel}</span>
  </div>
  <div class="reg-instrument-meta">
    <span><code>${esc(inst.instrumentId)}</code></span>
    <span>${esc(inst.issuingBody)}</span>
    <span>${esc(inst.instrumentType)}</span>
    ${regName ? `<span>${esc(regName)}</span>` : ""}
    ${approach ? `<span style="color:var(--neutral-stone)">${esc(approach)}</span>` : ""}
  </div>
  <div class="reg-instrument-stats">
    <span class="reg-stat-chip"><b>${inst.conceptCount}</b> concepts</span>
    <span class="reg-stat-chip hi-app"><b>${inst.highApplicabilityCount}</b> high-app</span>
    <span class="reg-stat-chip hi-rel"><b>${inst.highRelevancyCount ?? 0}</b> high-rel</span>
    <span class="reg-stat-chip">avg app <b>${pct(inst.avgApplicabilityScore)}</b></span>
    <span class="reg-stat-chip">avg rel <b>${pct(inst.avgRelevancyScore)}</b></span>
    ${inst.linkedObligationCount > 0 ? `<span class="reg-stat-chip"><b>${inst.linkedObligationCount}</b> linked</span>` : ""}
  </div>
</div>`;
      })
      .join("");

    // Attach click handlers
    for (const card of instrumentGrid.querySelectorAll(".reg-instrument-card")) {
      card.addEventListener("click", () => onSelectInstrument(card.dataset.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectInstrument(card.dataset.id);
        }
      });
    }
  }

  // ── Instrument selection → load concepts ──────────────────────────────────

  async function onSelectInstrument(id) {
    if (activeInstrumentId === id) {
      // Toggle off
      activeInstrumentId = null;
      expandedSectionId = null;
      conceptsPanel.classList.remove("open");
      allConcepts = [];
      renderInstrumentCards();
      return;
    }

    activeInstrumentId = id;
    expandedSectionId = null;
    renderInstrumentCards();

    const inst = allInstruments.find((i) => i.instrumentId === id);
    conceptsPanelTitle.textContent = inst
      ? `Concepts — ${inst.title}`
      : `Concepts — ${id}`;
    conceptsPanel.classList.add("open");
    conceptBody.innerHTML =
      '<tr><td colspan="7" class="reg-empty">Loading concepts…</td></tr>';
    conceptsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    await loadConcepts();
  }

  // ── Concept domain dropdown population ───────────────────────────────────

  function populateDomainDropdown(concepts) {
    const domains = new Set();
    for (const c of concepts) {
      for (const d of c.classifications?.domain ?? []) domains.add(d);
    }
    const currentVal = conceptDomain.value;
    conceptDomain.innerHTML = '<option value="">All domains</option>';
    for (const d of [...domains].sort()) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (d === currentVal) opt.selected = true;
      conceptDomain.appendChild(opt);
    }
  }

  // ── Load concepts from API ────────────────────────────────────────────────

  async function loadConcepts() {
    if (!activeInstrumentId) return;

    const sort = conceptSort.value;
    const minScore = Number.parseFloat(conceptMinScore.value) || 0;
    const domain = conceptDomain.value;

    const params = new URLSearchParams({ sort, minScore: String(minScore) });
    if (domain) params.set("domain", domain);

    try {
      const resp = await fetch(
        `/api/regulatory/instruments/${encodeURIComponent(activeInstrumentId)}/concepts?${params}`,
        { headers: { Accept: "application/json" } },
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allConcepts = data.concepts ?? [];
      populateDomainDropdown(allConcepts);
      renderConceptsTable(sort);
    } catch (err) {
      conceptBody.innerHTML = `<tr><td colspan="7" class="reg-empty" style="color:#b71c1c;">Failed to load concepts: ${esc(String(err))}</td></tr>`;
    }
  }

  // ── Concept table render ──────────────────────────────────────────────────

  function renderConceptsTable(sort) {
    conceptCount.textContent = `${allConcepts.length} concept${allConcepts.length !== 1 ? "s" : ""}`;

    // Update sort header styling
    thApp.className = sort === "applicability" ? "sortable sort-active" : "sortable";
    thApp.textContent = sort === "applicability" ? "Applicability ↓" : "Applicability";
    thRel.className = sort === "relevancy" ? "sortable sort-active" : "sortable";
    thRel.textContent = sort === "relevancy" ? "Relevancy ↓" : "Relevancy";

    if (allConcepts.length === 0) {
      conceptBody.innerHTML =
        '<tr><td colspan="7" class="reg-empty">No concepts match the current filters.</td></tr>';
      return;
    }

    conceptBody.innerHTML = allConcepts
      .map((c) => {
        const appColor = scoreColor(c.applicabilityScore);
        const relColor = scoreColor(c.relevancyScore);
        const isExpanded = c.sectionId === expandedSectionId;
        const domainTags = tagsHtml(c.classifications?.domain);
        const riskTags = tagsHtml(c.classifications?.riskTaxonomy, "reg-tag reg-tag-risk");
        const obligType = c.obligation?.type ?? "—";

        let rows = `<tr data-section-id="${esc(c.sectionId)}" class="reg-concept-row${isExpanded ? " reg-concept-expanded" : ""}">
  <td><button class="reg-section-btn" data-section-id="${esc(c.sectionId)}">${esc(c.sectionId)}</button></td>
  <td>
    ${scoreBar(c.applicabilityScore, appColor)}
    <span class="reg-score-val" style="color:${appColor}">${pct(c.applicabilityScore)}</span>
  </td>
  <td>
    ${scoreBar(c.relevancyScore, relColor)}
    <span class="reg-score-val" style="color:${relColor}">${pct(c.relevancyScore)}</span>
  </td>
  <td><span class="reg-tag-oblig">${esc(obligType)}</span></td>
  <td style="max-width:280px;word-break:break-word;">${esc(c.obligation?.actionSummary ?? "")}</td>
  <td>${domainTags}</td>
  <td>${riskTags}</td>
</tr>`;

        if (isExpanded) {
          rows += expandRowHtml(c);
        }

        return rows;
      })
      .join("");

    // Attach click handlers
    for (const btn of conceptBody.querySelectorAll(".reg-section-btn")) {
      btn.addEventListener("click", () => toggleExpandRow(btn.dataset.sectionId));
    }
  }

  // ── Expand row detail ─────────────────────────────────────────────────────

  function expandRowHtml(c) {
    const subjectLines = [
      c.subjectScope?.entityTypes?.length
        ? `Entity types: ${c.subjectScope.entityTypes.join(", ")}`
        : null,
      c.subjectScope?.licenceTypes?.length
        ? `Licence types: ${c.subjectScope.licenceTypes.join(", ")}`
        : null,
      c.subjectScope?.roles?.length ? `Roles: ${c.subjectScope.roles.join(", ")}` : null,
      c.subjectScope?.thresholdDescription
        ? `Threshold: ${c.subjectScope.thresholdDescription}`
        : null,
    ]
      .filter(Boolean)
      .join("<br>");

    const temporalLines = [
      `Cadence: ${c.temporalScope?.cadence ?? "—"}`,
      c.temporalScope?.commencementDate
        ? `Commencement: ${c.temporalScope.commencementDate}`
        : null,
      c.temporalScope?.eventTrigger ? `Trigger: ${c.temporalScope.eventTrigger}` : null,
      c.temporalScope?.periodDays ? `Period: ${c.temporalScope.periodDays} days` : null,
      c.temporalScope?.transitionalNote ? `Note: ${c.temporalScope.transitionalNote}` : null,
    ]
      .filter(Boolean)
      .join("<br>");

    const conditionLines = [
      c.conditionScope?.clientTypes?.length
        ? `Client types: ${c.conditionScope.clientTypes.join(", ")}`
        : null,
      c.conditionScope?.activityTriggers?.length
        ? `Activity triggers: ${c.conditionScope.activityTriggers.join(", ")}`
        : null,
      c.conditionScope?.instrumentTypes?.length
        ? `Instrument types: ${c.conditionScope.instrumentTypes.join(", ")}`
        : null,
      c.conditionScope?.thresholdConditions?.length
        ? `Thresholds: ${c.conditionScope.thresholdConditions.join(", ")}`
        : null,
      c.conditionScope?.exclusions?.length
        ? `Exclusions: ${c.conditionScope.exclusions.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("<br>");

    const obligLines = [
      `Actor: ${(c.obligation?.actor ?? []).join(", ") || "—"}`,
      c.obligation?.timeframeDescription
        ? `Timeframe: ${c.obligation.timeframeDescription}`
        : null,
      c.obligation?.output ? `Output: ${c.obligation.output}` : null,
      c.obligation?.recipient?.length
        ? `Recipient: ${c.obligation.recipient.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("<br>");

    const classLines = [
      `Domain: ${(c.classifications?.domain ?? []).join(", ") || "—"}`,
      `Risk taxonomy: ${(c.classifications?.riskTaxonomy ?? []).join(", ") || "—"}`,
      `Product scope: ${(c.classifications?.productScope ?? []).join(", ") || "—"}`,
      `Activity scope: ${(c.classifications?.activityScope ?? []).join(", ") || "—"}`,
    ].join("<br>");

    return `<tr class="reg-expand-row">
  <td colspan="7">
    <div class="reg-expand-body">
      <dt>Section title</dt>
      <dd>${esc(c.sectionTitle)}</dd>
      <dt>Verbatim text</dt>
      <dd><div class="reg-expand-verbatim">${esc(c.verbatimText)}</div></dd>
      <div class="reg-expand-dims">
        <div class="reg-expand-dim">
          <div class="reg-expand-dim-title">D1 — Subject scope (to whom)</div>
          <div class="reg-expand-dim-body">${subjectLines || "—"}</div>
        </div>
        <div class="reg-expand-dim">
          <div class="reg-expand-dim-title">D2 — Temporal scope (when)</div>
          <div class="reg-expand-dim-body">${temporalLines || "—"}</div>
        </div>
        <div class="reg-expand-dim">
          <div class="reg-expand-dim-title">D3 — Condition scope (under what)</div>
          <div class="reg-expand-dim-body">${conditionLines || "—"}</div>
        </div>
        <div class="reg-expand-dim">
          <div class="reg-expand-dim-title">D4 — Obligation (what must happen)</div>
          <div class="reg-expand-dim-body">${obligLines || "—"}</div>
        </div>
      </div>
      <dt>Applicability rationale</dt>
      <dd>${esc(c.applicabilityRationale)}</dd>
      <dt>Relevancy rationale</dt>
      <dd>${esc(c.relevancyRationale)}</dd>
      <dt>Classifications</dt>
      <dd>${classLines}</dd>
      <dt>Extracted</dt>
      <dd>${esc(c.extractedAt)} by <code>${esc(c.extractedBy)}</code></dd>
    </div>
  </td>
</tr>`;
  }

  function toggleExpandRow(sectionId) {
    if (expandedSectionId === sectionId) {
      expandedSectionId = null;
    } else {
      expandedSectionId = sectionId;
    }
    renderConceptsTable(conceptSort.value);
  }

  // ── Instruments load ──────────────────────────────────────────────────────

  async function loadInstruments() {
    try {
      const resp = await fetch("/api/regulatory/instruments", {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allInstruments = data.instruments ?? [];
      renderSummary(data.summary);
      renderInstrumentCards();
      if (lastUpdated) {
        lastUpdated.textContent = data.asOf
          ? `as of ${new Date(data.asOf).toLocaleTimeString()}`
          : "loaded";
      }
      // If an instrument was previously selected, reload concepts
      if (activeInstrumentId) {
        await loadConcepts();
      }
    } catch (err) {
      instrumentGrid.innerHTML = `<div class="reg-empty" style="color:#b71c1c;grid-column:1/-1;">Failed to load instruments: ${esc(String(err))}</div>`;
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  filterType.addEventListener("change", renderInstrumentCards);
  filterStatus.addEventListener("change", renderInstrumentCards);
  filterSearch.addEventListener("input", renderInstrumentCards);

  conceptsClose.addEventListener("click", () => {
    activeInstrumentId = null;
    expandedSectionId = null;
    allConcepts = [];
    conceptsPanel.classList.remove("open");
    renderInstrumentCards();
  });

  conceptSort.addEventListener("change", async () => {
    expandedSectionId = null;
    await loadConcepts();
  });

  conceptMinScore.addEventListener("change", async () => {
    expandedSectionId = null;
    await loadConcepts();
  });

  conceptDomain.addEventListener("change", async () => {
    expandedSectionId = null;
    await loadConcepts();
  });

  thApp.addEventListener("click", async () => {
    conceptSort.value = "applicability";
    expandedSectionId = null;
    await loadConcepts();
  });

  thRel.addEventListener("click", async () => {
    conceptSort.value = "relevancy";
    expandedSectionId = null;
    await loadConcepts();
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadInstruments());
  }

  // ── Provenance badge ──────────────────────────────────────────────────────
  // The provenance-badge.js script watches for elements with
  // data-provenance-badge="page-top" and reads the data-provenance-source
  // attribute. It is wired in the HTML; nothing extra needed here.

  // ── Boot ──────────────────────────────────────────────────────────────────

  loadInstruments();

  // Periodic refresh every 60s (visibility-aware)
  let pollTimer = null;
  function startPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (!document.hidden) loadInstruments();
    }, 60_000);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadInstruments();
  });
  startPoll();
})();
