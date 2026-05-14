// taxonomy.js — Taxonomy Explorer page logic.
//
// Fetches /api/taxonomies and renders four collapsible panels:
//   1. Risk taxonomy — expandable L1/L2/L3 tree
//   2. Activity taxonomy — grouped ACT-* chips
//   3. Domain taxonomy — 10-row table with clickable domain codes
//   4. Product scope — 8-row table
//
// Search bar at the top filters all four panels simultaneously.
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  // ── Severity colour map for risk L1 nodes ────────────────────────────────
  // Derived from the risk register — L1 codes carry an implicit severity
  // based on their regulatory weight and capital requirements.
  const L1_SEVERITY = {
    "RT-CR":    "critical",   // Credit — largest capital consumer
    "RT-MK":    "critical",   // Market — trading-book P&L tail risk
    "RT-LQ":    "critical",   // Liquidity — existential if breached
    "RT-IRRBB": "high",
    "RT-OP":    "high",
    "RT-CD":    "high",
    "RT-FC":    "critical",   // Financial crime — licence-threatening
    "RT-LR":    "high",
    "RT-ST":    "medium",
    "RT-RP":    "medium",
    "RT-CL":    "low",
  };

  // ── Panel collapse/expand ─────────────────────────────────────────────────
  function wirePanel(panelId, headId) {
    const panel = document.getElementById(panelId);
    const head  = document.getElementById(headId);
    if (!panel || !head) return;
    head.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("collapsed");
      head.setAttribute("aria-expanded", String(!collapsed));
    });
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        head.click();
      }
    });
  }

  wirePanel("panelRisk",     "panelRiskHead");
  wirePanel("panelActivity", "panelActivityHead");
  wirePanel("panelDomain",   "panelDomainHead");
  wirePanel("panelProduct",  "panelProductHead");

  // ── Search ────────────────────────────────────────────────────────────────
  let allData = null;

  function normalise(s) {
    return (s ?? "").toLowerCase();
  }

  function applySearch(q) {
    if (!allData) return;
    const term = normalise(q).trim();
    let matchCount = 0;

    // -- Risk tree: show/hide l1 blocks and l2 items
    document.querySelectorAll(".risk-l1").forEach((l1El) => {
      const l1Code  = l1El.dataset.code ?? "";
      const l1Label = l1El.dataset.label ?? "";
      let l1Match = !term || normalise(l1Code).includes(term) || normalise(l1Label).includes(term);
      let anyChild = false;

      l1El.querySelectorAll(".risk-l2").forEach((l2El) => {
        const l2Code  = l2El.dataset.code ?? "";
        const l2Label = l2El.dataset.label ?? "";
        let l2Match = !term || normalise(l2Code).includes(term) || normalise(l2Label).includes(term);
        let anyL3 = false;

        l2El.querySelectorAll(".risk-l3-item").forEach((l3El) => {
          const l3Code  = l3El.dataset.code ?? "";
          const l3Label = l3El.dataset.label ?? "";
          const show = !term || normalise(l3Code).includes(term) || normalise(l3Label).includes(term);
          l3El.classList.toggle("tax-hidden", !show);
          if (show) anyL3 = true;
        });

        const show = l2Match || anyL3;
        l2El.classList.toggle("tax-hidden", !show);
        if (show) { anyChild = true; matchCount++; }
      });

      const show = l1Match || anyChild;
      l1El.classList.toggle("tax-hidden", !show);
      if (show && l1Match) matchCount++;
    });

    // -- Activity chips
    document.querySelectorAll(".act-chip-item").forEach((el) => {
      const code  = el.dataset.code ?? "";
      const label = el.dataset.label ?? "";
      const show  = !term || normalise(code).includes(term) || normalise(label).includes(term);
      el.classList.toggle("tax-hidden", !show);
      if (show) matchCount++;
    });
    // Hide groups that are entirely empty after filter
    document.querySelectorAll(".act-group").forEach((grp) => {
      const anyVisible = [...grp.querySelectorAll(".act-chip-item")].some(
        (el) => !el.classList.contains("tax-hidden"),
      );
      grp.classList.toggle("tax-hidden", !anyVisible);
    });

    // -- Domain table rows
    document.querySelectorAll("#domainBody tr").forEach((tr) => {
      const code  = tr.dataset.code ?? "";
      const label = tr.dataset.label ?? "";
      const show  = !term || normalise(code).includes(term) || normalise(label).includes(term);
      tr.classList.toggle("tax-hidden", !show);
      if (show) matchCount++;
    });

    // -- Product table rows
    document.querySelectorAll("#productBody tr").forEach((tr) => {
      const code  = tr.dataset.code ?? "";
      const label = tr.dataset.label ?? "";
      const show  = !term || normalise(code).includes(term) || normalise(label).includes(term);
      tr.classList.toggle("tax-hidden", !show);
      if (show) matchCount++;
    });

    const info = document.getElementById("taxSearchInfo");
    if (info) {
      info.textContent = term ? `${matchCount} match${matchCount !== 1 ? "es" : ""}` : "";
    }
  }

  const searchEl = document.getElementById("taxSearch");
  const clearBtn  = document.getElementById("taxClear");
  if (searchEl) {
    searchEl.addEventListener("input", () => applySearch(searchEl.value));
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchEl) { searchEl.value = ""; }
      applySearch("");
    });
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Render: Risk tree ─────────────────────────────────────────────────────
  function renderRiskTree(nodes) {
    const container = document.getElementById("riskTree");
    if (!container) return;

    const badge = document.getElementById("riskBadge");
    if (badge) badge.textContent = `${nodes.length} nodes`;

    // Group into L1 → L2 → L3
    const byParent = {};
    for (const n of nodes) {
      const key = n.parent ?? "__root__";
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(n);
    }

    const l1Nodes = byParent["__root__"] ?? [];

    const html = l1Nodes.map((l1) => {
      const sev = L1_SEVERITY[l1.code] ?? "medium";
      const l2Nodes = byParent[l1.code] ?? [];

      const l2Html = l2Nodes.map((l2) => {
        const l3Nodes = byParent[l2.code] ?? [];

        const l3Html = l3Nodes.length
          ? `<ul class="risk-l3-list">
              ${l3Nodes.map((l3) => `
                <li class="risk-l3-item" data-code="${esc(l3.code)}" data-label="${esc(l3.name ?? l3.label ?? "")}">
                  <span class="tax-chip">${esc(l3.code)}</span>
                  <span>${esc(l3.name ?? l3.label ?? "")}</span>
                </li>`).join("")}
             </ul>`
          : "";

        return `
          <li class="risk-l2" data-code="${esc(l2.code)}" data-label="${esc(l2.name ?? l2.label ?? "")}">
            <div class="risk-l2-head" role="button" tabindex="0"
                 onclick="this.closest('.risk-l2').classList.toggle('l2-collapsed')"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
              <span class="risk-l2-toggle">▾</span>
              <span class="tax-chip">${esc(l2.code)}</span>
              <span class="risk-l2-label">${esc(l2.name ?? l2.label ?? "")}</span>
            </div>
            <div class="risk-l2-detail">
              <div style="margin-bottom:4px; color:var(--text-secondary)">${esc(l2.definition ?? l2.description ?? "")}</div>
              ${l3Html}
            </div>
          </li>`;
      }).join("");

      return `
        <div class="risk-l1" data-code="${esc(l1.code)}" data-label="${esc(l1.name ?? l1.label ?? "")}">
          <div class="risk-l1-head" role="button" tabindex="0"
               onclick="this.closest('.risk-l1').classList.toggle('l1-collapsed')"
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
            <span class="risk-l1-toggle">▾</span>
            <span class="tax-chip sev-${esc(sev)}">${esc(l1.code)}</span>
            <span class="risk-l1-label">${esc(l1.name ?? l1.label ?? "")}</span>
            <span class="risk-l1-owner">${esc(l1.owner ?? "")}</span>
          </div>
          <div class="risk-l1-def">${esc(l1.definition ?? l1.description ?? "")}</div>
          <div class="risk-l1-children">
            <ul class="risk-l2-list">${l2Html}</ul>
          </div>
        </div>`;
    }).join("");

    container.innerHTML = html || "<p class='muted'>No nodes.</p>";
  }

  // ── Render: Activity taxonomy ─────────────────────────────────────────────
  function renderActivityGroups(groups, nodes) {
    const container = document.getElementById("activityGroups");
    const badge     = document.getElementById("activityBadge");
    if (!container) return;

    const totalCodes = nodes.length;
    if (badge) badge.textContent = `${Object.keys(groups).length} groups · ${totalCodes} codes`;

    // Build code → label map from nodes
    const codeLabel = {};
    for (const n of nodes) {
      codeLabel[n.code] = n.label;
    }

    const html = Object.entries(groups).map(([group, codes]) => {
      const chips = codes.map((code) => `
        <span class="act-chip-item" data-code="${esc(code)}" data-label="${esc(codeLabel[code] ?? "")}">
          <span class="tax-chip tax-chip-act" title="${esc(codeLabel[code] ?? "")}">${esc(code)}</span>
          <span style="font-size:12px; color:var(--text-secondary)">${esc(codeLabel[code] ?? "")}</span>
        </span>`).join("");

      return `
        <div class="act-group" data-group="${esc(group)}">
          <div class="act-group-head">${esc(group)}</div>
          <div class="act-chips">${chips}</div>
        </div>`;
    }).join("");

    container.innerHTML = html || "<p class='muted'>No activities.</p>";
  }

  // ── Render: Domain table ──────────────────────────────────────────────────
  function renderDomainTable(nodes) {
    const tbody = document.getElementById("domainBody");
    const badge = document.getElementById("domainBadge");
    if (!tbody) return;
    if (badge) badge.textContent = `${nodes.length} domains`;

    tbody.innerHTML = nodes.map((n) => `
      <tr data-code="${esc(n.code)}" data-label="${esc(n.label)}">
        <td class="code-col">
          <a class="tax-chip tax-chip-domain"
             href="/obligations.html?domain=${encodeURIComponent(n.code)}"
             title="View obligations for ${esc(n.label)}">${esc(n.code)}</a>
        </td>
        <td><strong>${esc(n.label)}</strong></td>
        <td class="desc-col">${esc(n.description)}</td>
      </tr>`).join("");
  }

  // ── Render: Product scope table ───────────────────────────────────────────
  function renderProductTable(nodes) {
    const tbody = document.getElementById("productBody");
    const badge = document.getElementById("productBadge");
    if (!tbody) return;
    if (badge) badge.textContent = `${nodes.length} products`;

    tbody.innerHTML = nodes.map((n) => `
      <tr data-code="${esc(n.code)}" data-label="${esc(n.label)}">
        <td class="code-col">
          <span class="tax-chip tax-chip-product">${esc(n.code)}</span>
        </td>
        <td><strong>${esc(n.label)}</strong></td>
        <td class="desc-col">${esc(n.description)}</td>
      </tr>`).join("");
  }

  // ── Fetch and render ──────────────────────────────────────────────────────
  async function load() {
    try {
      const res  = await fetch("/api/taxonomies");
      const data = await res.json();
      allData    = data;

      const { risk, activity, domain, productScope } = data.taxonomies;

      renderRiskTree(risk.nodes);
      renderActivityGroups(activity.groups, activity.nodes);
      renderDomainTable(domain.nodes);
      renderProductTable(productScope.nodes);

      const asOfEl = document.getElementById("asOf");
      if (asOfEl && data.asOf) {
        asOfEl.textContent = new Date(data.asOf).toLocaleString();
      }

      const lu = document.getElementById("lastUpdated");
      if (lu) lu.textContent = `updated ${new Date(data.asOf).toLocaleTimeString()}`;

      const dot = document.getElementById("liveDot");
      if (dot) { dot.className = "live-dot live-dot-green"; }

    } catch (err) {
      console.error("taxonomy load failed", err);
      const lu  = document.getElementById("lastUpdated");
      const dot = document.getElementById("liveDot");
      if (lu)  lu.textContent  = "fetch failed";
      if (dot) dot.className   = "live-dot live-dot-red";
    }
  }

  load();
})();
