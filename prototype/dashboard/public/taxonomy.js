// taxonomy.js — Taxonomy Explorer page logic.
//
// Fetches /api/taxonomies and renders four collapsible panels:
//   1. Risk taxonomy — expandable L1/L2/L3 tree
//   2. Activity taxonomy — grouped ACT-* chips
//   3. Domain taxonomy — 10-row table with clickable domain codes
//   4. Product scope — 7-row table (DCAM-aligned)
//
// DCAM alignment badges are shown on nodes that carry dcamAlignment:
//   L1 chip (indigo): FIBO · {module} — links to fiboIri
//   L2 chips (colour by standard): CDM=teal, ESMA-CFI=emerald, BCBS=red,
//              FATF=amber, ISO17442=slate
//   L3 chips (purple): ISO20022 · {messageType}
//
// Search bar at the top filters all four panels simultaneously.
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  // ── DCAM legend (collapsible) ─────────────────────────────────────────────
  function renderDcamLegend() {
    const container = document.getElementById("dcamLegend");
    if (!container) return;

    container.innerHTML = `
      <div id="dcamLegendHead" role="button" tabindex="0" aria-expanded="false"
           style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:8px 12px;
                  background:#f8f9fa; border-radius:6px; border:1px solid #e2e8f0; user-select:none;"
           onclick="this.setAttribute('aria-expanded', this.nextElementSibling.style.display==='none'?'true':'false');
                    this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
        <span style="font-size:11px;">▶</span>
        <strong style="font-size:13px;">DCAM Alignment Legend</strong>
        <span style="font-size:12px; color:#64748b;">EDM Council three-layer architecture</span>
      </div>
      <div style="display:none; padding:12px 16px; border:1px solid #e2e8f0; border-top:none;
                  border-radius:0 0 6px 6px; background:#fff;">
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:12px;">
          <div>
            <div style="font-weight:600; font-size:12px; margin-bottom:6px; color:#4338ca;">L1 — Conceptual (FIBO)</div>
            <div style="font-size:11px; color:#64748b; line-height:1.5;">
              FIBO ontological anchors — defines what the concept IS.<br>
              Links to spec.edmcouncil.org IRI. Click chip to open.
            </div>
            <div style="margin-top:6px;">
              <span style="background:#4338ca; color:white; padding:2px 6px; border-radius:3px; font-size:11px;">FIBO · SEC</span>
            </div>
          </div>
          <div>
            <div style="font-weight:600; font-size:12px; margin-bottom:6px; color:#0f766e;">L2 — Logical (Industry Standards)</div>
            <div style="font-size:11px; color:#64748b; line-height:1.5;">
              CDM, ESMA-CFI, BCBS, FATF, ISO17442. How concepts are MODELED.
            </div>
            <div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">
              <span style="background:#0f766e; color:white; padding:2px 5px; border-radius:3px; font-size:10px;">CDM</span>
              <span style="background:#059669; color:white; padding:2px 5px; border-radius:3px; font-size:10px;">ESMA-CFI</span>
              <span style="background:#dc2626; color:white; padding:2px 5px; border-radius:3px; font-size:10px;">BCBS</span>
              <span style="background:#d97706; color:white; padding:2px 5px; border-radius:3px; font-size:10px;">FATF</span>
              <span style="background:#475569; color:white; padding:2px 5px; border-radius:3px; font-size:10px;">ISO17442</span>
            </div>
          </div>
          <div>
            <div style="font-weight:600; font-size:12px; margin-bottom:6px; color:#7e22ce;">L3 — Physical (ISO 20022)</div>
            <div style="font-size:11px; color:#64748b; line-height:1.5;">
              Message formats. The node's own code string is also Layer 3.
            </div>
            <div style="margin-top:6px;">
              <span style="background:#7e22ce; color:white; padding:2px 6px; border-radius:3px; font-size:11px;">ISO20022 · sese.023</span>
            </div>
          </div>
        </div>
        <div style="font-size:11px; color:#64748b; border-top:1px solid #f1f5f9; padding-top:8px;">
          <strong>SKOS match opacity:</strong>
          exactMatch (100%) · closeMatch (80%) · broadMatch (60%) · relatedMatch (50%) · narrowMatch (70%)
        </div>
      </div>`;
  }

  // ── Severity colour map for risk L1 nodes ────────────────────────────────
  // Derived from the risk register — L1 codes carry an implicit severity
  // based on their regulatory weight and capital requirements.
  const L1_SEVERITY = {
    "RT-CR": "critical", // Credit — largest capital consumer
    "RT-MK": "critical", // Market — trading-book P&L tail risk
    "RT-LQ": "critical", // Liquidity — existential if breached
    "RT-IRRBB": "high",
    "RT-OP": "high",
    "RT-CD": "high",
    "RT-FC": "critical", // Financial crime — licence-threatening
    "RT-LR": "high",
    "RT-ST": "medium",
    "RT-RP": "medium",
    "RT-CL": "low",
  };

  // ── Panel collapse/expand ─────────────────────────────────────────────────
  function wirePanel(panelId, headId) {
    const panel = document.getElementById(panelId);
    const head = document.getElementById(headId);
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

  wirePanel("panelRisk", "panelRiskHead");
  wirePanel("panelActivity", "panelActivityHead");
  wirePanel("panelDomain", "panelDomainHead");
  wirePanel("panelProduct", "panelProductHead");

  // Render the DCAM legend
  renderDcamLegend();

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
    for (const l1El of document.querySelectorAll(".risk-l1")) {
      const l1Code = l1El.dataset.code ?? "";
      const l1Label = l1El.dataset.label ?? "";
      const l1Match =
        !term || normalise(l1Code).includes(term) || normalise(l1Label).includes(term);
      let anyChild = false;

      for (const l2El of l1El.querySelectorAll(".risk-l2")) {
        const l2Code = l2El.dataset.code ?? "";
        const l2Label = l2El.dataset.label ?? "";
        const l2Match =
          !term || normalise(l2Code).includes(term) || normalise(l2Label).includes(term);
        let anyL3 = false;

        for (const l3El of l2El.querySelectorAll(".risk-l3-item")) {
          const l3Code = l3El.dataset.code ?? "";
          const l3Label = l3El.dataset.label ?? "";
          const show =
            !term || normalise(l3Code).includes(term) || normalise(l3Label).includes(term);
          l3El.classList.toggle("tax-hidden", !show);
          if (show) anyL3 = true;
        }

        const show = l2Match || anyL3;
        l2El.classList.toggle("tax-hidden", !show);
        if (show) {
          anyChild = true;
          matchCount++;
        }
      }

      const show = l1Match || anyChild;
      l1El.classList.toggle("tax-hidden", !show);
      if (show && l1Match) matchCount++;
    }

    // -- Activity chips
    for (const el of document.querySelectorAll(".act-chip-item")) {
      const code = el.dataset.code ?? "";
      const label = el.dataset.label ?? "";
      const show = !term || normalise(code).includes(term) || normalise(label).includes(term);
      el.classList.toggle("tax-hidden", !show);
      if (show) matchCount++;
    }
    // Hide groups that are entirely empty after filter
    for (const grp of document.querySelectorAll(".act-group")) {
      const anyVisible = [...grp.querySelectorAll(".act-chip-item")].some(
        (el) => !el.classList.contains("tax-hidden"),
      );
      grp.classList.toggle("tax-hidden", !anyVisible);
    }

    // -- Domain table rows
    for (const tr of document.querySelectorAll("#domainBody tr")) {
      const code = tr.dataset.code ?? "";
      const label = tr.dataset.label ?? "";
      const show = !term || normalise(code).includes(term) || normalise(label).includes(term);
      tr.classList.toggle("tax-hidden", !show);
      if (show) matchCount++;
    }

    // -- Product table rows
    for (const tr of document.querySelectorAll("#productBody tr")) {
      const code = tr.dataset.code ?? "";
      const label = tr.dataset.label ?? "";
      const show = !term || normalise(code).includes(term) || normalise(label).includes(term);
      tr.classList.toggle("tax-hidden", !show);
      if (show) matchCount++;
    }

    const info = document.getElementById("taxSearchInfo");
    if (info) {
      info.textContent = term ? `${matchCount} match${matchCount !== 1 ? "es" : ""}` : "";
    }
  }

  const searchEl = document.getElementById("taxSearch");
  const clearBtn = document.getElementById("taxClear");
  if (searchEl) {
    searchEl.addEventListener("input", () => applySearch(searchEl.value));
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchEl) {
        searchEl.value = "";
      }
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

  // SKOS match opacity
  const SKOS_OPACITY = {
    exactMatch: 1.0,
    closeMatch: 0.8,
    broadMatch: 0.6,
    relatedMatch: 0.5,
    narrowMatch: 0.7,
  };

  // L2 standard colours
  const L2_COLORS = {
    CDM: "#0f766e",
    "ESMA-CFI": "#059669",
    BCBS: "#dc2626",
    FATF: "#d97706",
    ISO17442: "#475569",
  };

  /**
   * Render DCAM alignment chips for a node.
   * Returns HTML string — empty string if no alignment.
   */
  function renderDcamChips(dcamAlignment) {
    if (!dcamAlignment) return "";
    const parts = [];

    // L1 — Conceptual (FIBO)
    if (dcamAlignment.conceptual) {
      const c = dcamAlignment.conceptual;
      const opacity = SKOS_OPACITY[c.skosMatch] ?? 0.7;
      const title = `${esc(c.fiboLabel)} (${esc(c.skosMatch)})${c.definition ? ` — ${esc(c.definition)}` : ""}`;
      parts.push(
        `<a href="${esc(c.fiboIri)}" target="_blank" rel="noopener"
            title="${title}"
            style="display:inline-block; opacity:${opacity}; text-decoration:none; margin-right:3px; margin-bottom:3px;
                   background:#4338ca; color:white; padding:2px 6px; border-radius:3px; font-size:10px; white-space:nowrap;">
          FIBO · ${esc(c.fiboModule)}
        </a>`,
      );
    }

    // L2 — Logical
    if (dcamAlignment.logical && dcamAlignment.logical.length > 0) {
      for (const l of dcamAlignment.logical) {
        const opacity = SKOS_OPACITY[l.skosMatch] ?? 0.7;
        const color = L2_COLORS[l.standard] ?? "#64748b";
        const title = `${esc(l.label)} (${esc(l.skosMatch)})${l.notes ? ` — ${esc(l.notes)}` : ""}`;
        parts.push(
          `<a href="${esc(l.ref)}" target="_blank" rel="noopener"
              title="${title}"
              style="display:inline-block; opacity:${opacity}; text-decoration:none; margin-right:3px; margin-bottom:3px;
                     background:${color}; color:white; padding:2px 6px; border-radius:3px; font-size:10px; white-space:nowrap;">
            ${esc(l.standard)}
          </a>`,
        );
      }
    }

    // L3 — Physical (ISO 20022)
    if (dcamAlignment.physical && dcamAlignment.physical.length > 0) {
      for (const p of dcamAlignment.physical) {
        const title = `${esc(p.label)}${p.notes ? ` — ${esc(p.notes)}` : ""}`;
        parts.push(
          `<span title="${title}"
                 style="display:inline-block; margin-right:3px; margin-bottom:3px;
                        background:#7e22ce; color:white; padding:2px 6px; border-radius:3px; font-size:10px; white-space:nowrap;">
            ISO20022 · ${esc(p.messageType)}
          </span>`,
        );
      }
    }

    if (parts.length === 0) return "";
    return `<div style="margin-top:4px; line-height:1.8;">${parts.join("")}</div>`;
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

    // biome-ignore lint/complexity/useLiteralKeys: sentinel key uses double underscores — not a JS identifier
    const l1Nodes = byParent["__root__"] ?? [];

    const html = l1Nodes
      .map((l1) => {
        const sev = L1_SEVERITY[l1.code] ?? "medium";
        const l2Nodes = byParent[l1.code] ?? [];

        const l2Html = l2Nodes
          .map((l2) => {
            const l3Nodes = byParent[l2.code] ?? [];

            const l3Html = l3Nodes.length
              ? `<ul class="risk-l3-list">
              ${l3Nodes
                .map(
                  (l3) => `
                <li class="risk-l3-item" data-code="${esc(l3.code)}" data-label="${esc(l3.name ?? l3.label ?? "")}">
                  <span class="tax-chip">${esc(l3.code)}</span>
                  <span>${esc(l3.name ?? l3.label ?? "")}</span>
                </li>`,
                )
                .join("")}
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
          })
          .join("");

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
      })
      .join("");

    container.innerHTML = html || "<p class='muted'>No nodes.</p>";
  }

  // ── Render: Activity taxonomy ─────────────────────────────────────────────
  function renderActivityGroups(groups, nodes) {
    const container = document.getElementById("activityGroups");
    const badge = document.getElementById("activityBadge");
    if (!container) return;

    const totalCodes = nodes.length;
    if (badge) badge.textContent = `${Object.keys(groups).length} groups · ${totalCodes} codes`;

    // Build code → label map from nodes
    const codeLabel = {};
    for (const n of nodes) {
      codeLabel[n.code] = n.label;
    }

    const html = Object.entries(groups)
      .map(([group, codes]) => {
        const chips = codes
          .map(
            (code) => `
        <span class="act-chip-item" data-code="${esc(code)}" data-label="${esc(codeLabel[code] ?? "")}">
          <span class="tax-chip tax-chip-act" title="${esc(codeLabel[code] ?? "")}">${esc(code)}</span>
          <span style="font-size:12px; color:var(--text-secondary)">${esc(codeLabel[code] ?? "")}</span>
        </span>`,
          )
          .join("");

        return `
        <div class="act-group" data-group="${esc(group)}">
          <div class="act-group-head">${esc(group)}</div>
          <div class="act-chips">${chips}</div>
        </div>`;
      })
      .join("");

    container.innerHTML = html || "<p class='muted'>No activities.</p>";
  }

  // ── Render: Domain table ──────────────────────────────────────────────────
  function renderDomainTable(nodes) {
    const tbody = document.getElementById("domainBody");
    const badge = document.getElementById("domainBadge");
    if (!tbody) return;
    if (badge) badge.textContent = `${nodes.length} domains`;

    tbody.innerHTML = nodes
      .map(
        (n) => `
      <tr data-code="${esc(n.code)}" data-label="${esc(n.label)}">
        <td class="code-col">
          <a class="tax-chip tax-chip-domain"
             href="/obligations.html?domain=${encodeURIComponent(n.code)}"
             title="View obligations for ${esc(n.label)}">${esc(n.code)}</a>
        </td>
        <td><strong>${esc(n.label)}</strong></td>
        <td class="desc-col">
          ${esc(n.description)}
          ${renderDcamChips(n.dcamAlignment)}
        </td>
      </tr>`,
      )
      .join("");
  }

  // ── Render: Product scope table ───────────────────────────────────────────
  function renderProductTable(nodes) {
    const tbody = document.getElementById("productBody");
    const badge = document.getElementById("productBadge");
    if (!tbody) return;
    if (badge) badge.textContent = `${nodes.length} products`;

    tbody.innerHTML = nodes
      .map(
        (n) => `
      <tr data-code="${esc(n.code)}" data-label="${esc(n.label)}">
        <td class="code-col">
          <span class="tax-chip tax-chip-product">${esc(n.code)}</span>
        </td>
        <td><strong>${esc(n.label)}</strong></td>
        <td class="desc-col">
          ${esc(n.description)}
          ${renderDcamChips(n.dcamAlignment)}
        </td>
      </tr>`,
      )
      .join("");
  }

  // ── Fetch and render ──────────────────────────────────────────────────────
  async function load() {
    try {
      const res = await fetch("/api/taxonomies");
      const data = await res.json();
      allData = data;

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
      if (dot) {
        dot.className = "live-dot live-dot-green";
      }
    } catch (err) {
      console.error("taxonomy load failed", err);
      const lu = document.getElementById("lastUpdated");
      const dot = document.getElementById("liveDot");
      if (lu) lu.textContent = "fetch failed";
      if (dot) dot.className = "live-dot live-dot-red";
    }
  }

  load();
})();
