// products.js — New Product Approval & Review console.
//
// Fetches /api/products + /api/products/:id and renders:
//   - product picker (existing products + Propose new product action)
//   - product header (name + description + lifecycle stage + approval state)
//   - worked-journal-entries table (per lifecycle event in the product)
//   - 14 NPA dimension sections (drill-down) per Policy v1.0 §5
//
// Authority: D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10).

(() => {
  const STATUS_PILL = {
    pending: { label: "pending", cls: "warn" },
    "design-attested": { label: "design-attested", cls: "ok" },
    "implementation-attested": { label: "implementation-attested", cls: "ok" },
    failed: { label: "failed", cls: "danger" },
  };

  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  function pill(status) {
    const m = STATUS_PILL[status] || { label: status || "—", cls: "" };
    return `<span class="pp-pill ${m.cls}">${esc(m.label)}</span>`;
  }

  function chips(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '<span class="pp-pill">—</span>';
    return arr.map((c) => `<span class="pp-chip">${esc(c)}</span>`).join(" ");
  }

  let CURRENT_PRODUCT_ID = null;

  // ---------------------------------------------------------------------------
  // Picker
  // ---------------------------------------------------------------------------

  async function loadList() {
    const data = await fetch("/api/products").then((r) => (r.ok ? r.json() : null));
    const picker = document.getElementById("pp-picker");
    if (!picker) return;
    if (!data) {
      picker.innerHTML = "<p>Failed to load products.</p>";
      return;
    }
    const options = data.products
      .map(
        (p) =>
          `<option value="${esc(p.productId)}">${esc(p.name)} — ${esc(p.family)} (${esc(p.lifecycle)})</option>`,
      )
      .join("");
    picker.innerHTML = `
      <label for="pp-product-select" style="font:var(--text-caption);color:var(--color-text-secondary)">Select product</label>
      <select id="pp-product-select">
        <option value="">— select —</option>
        ${options}
      </select>
      <button class="pp-btn pp-btn-primary" id="pp-propose-btn">Propose new product</button>
      <span class="pp-policy-cite">${data.products.length} products in register · NPA Policy v1.0 §5 (14 dimensions)</span>
    `;
    const sel = document.getElementById("pp-product-select");
    sel.addEventListener("change", () => {
      if (sel.value) loadDetail(sel.value);
      else clearDetail();
    });
    document.getElementById("pp-propose-btn").addEventListener("click", openProposeModal);
    // Re-select previously viewed product if it still exists.
    if (CURRENT_PRODUCT_ID && data.products.some((p) => p.productId === CURRENT_PRODUCT_ID)) {
      sel.value = CURRENT_PRODUCT_ID;
      loadDetail(CURRENT_PRODUCT_ID);
    }
  }

  function clearDetail() {
    document.getElementById("pp-header").innerHTML = "";
    document.getElementById("pp-journal").innerHTML = "";
    document.getElementById("pp-sections").innerHTML = "";
    CURRENT_PRODUCT_ID = null;
  }

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------

  async function loadDetail(productId) {
    CURRENT_PRODUCT_ID = productId;
    const data = await fetch(`/api/products/${encodeURIComponent(productId)}`).then((r) =>
      r.ok ? r.json() : null,
    );
    if (!data) {
      document.getElementById("pp-header").innerHTML = "<p>Failed to load product detail.</p>";
      return;
    }
    renderHeader(data);
    renderJournalEntries(data);
    renderDimensions(data);
  }

  function renderHeader(data) {
    const p = data.product;
    const header = document.getElementById("pp-header");
    header.innerHTML = `
      <h2 style="margin:0 0 var(--space-2);font:var(--text-h2)">${esc(p.name)}</h2>
      <p style="font:var(--text-body);margin:0 0 var(--space-2)">${esc(p.description)}</p>
      <div class="pp-row">
        <span class="pp-pill">family: ${esc(p.family)}</span>
        <span class="pp-pill">${esc(p.currency)} · ${esc(p.jurisdiction)}</span>
        <span class="pp-pill">entity: ${esc(p.legalEntityId)}</span>
        <span class="pp-pill">scope: ${esc(p.franchiseScope)}</span>
        <span class="pp-pill ok">lifecycle: ${esc(p.lifecycle)}</span>
        <span class="pp-pill">version ${esc(p.version)}</span>
      </div>
      <div class="pp-row" style="margin-top:var(--space-2)">
        <span class="pp-policy-cite">Citations:</span>
        ${chips(p.citations)}
      </div>
    `;
  }

  function renderJournalEntries(data) {
    const el = document.getElementById("pp-journal");
    if (!data.journalEntries || data.journalEntries.length === 0) {
      el.innerHTML = `
        <h3 style="font:var(--text-h3);margin:0 0 var(--space-2)">Worked journal entries</h3>
        <p class="pp-policy-cite">No lifecycle events declared on this product yet.</p>`;
      return;
    }
    const rows = data.journalEntries
      .map((row) => {
        if (row.status === "present" && row.rule) {
          return `<tr>
            <td><code>${esc(row.eventType)}</code></td>
            <td><span class="pp-pill ok">${esc(row.rule.ruleId)}</span></td>
            <td>${esc(row.rule.legs)}</td>
            <td class="pp-policy-cite">${esc(row.rule.module)}</td>
          </tr>`;
        }
        return `<tr>
            <td><code>${esc(row.eventType)}</code></td>
            <td><span class="pp-pill danger">missing</span></td>
            <td class="pp-missing">substrate gap — Bea posting rule not yet authored</td>
            <td>—</td>
          </tr>`;
      })
      .join("");
    el.innerHTML = `
      <h3 style="font:var(--text-h3);margin:0 0 var(--space-2)">Worked journal entries per lifecycle event</h3>
      <p class="pp-policy-cite">Bea (Accounting & financial reporting engineer) posting-rule registry. Missing rows are substrate gaps.</p>
      <table class="pp-table">
        <thead>
          <tr><th>Lifecycle event</th><th>Posting rule</th><th>Dr / Cr legs</th><th>Module</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderDimensions(data) {
    const container = document.getElementById("pp-sections");
    container.innerHTML = "";
    data.dimensions.forEach((dim, idx) => {
      container.appendChild(renderDimensionSection(data.product, dim, idx + 1));
    });
  }

  function renderDimensionSection(product, dim, ordinal) {
    const section = document.createElement("div");
    section.className = "pp-section";
    section.dataset.dimension = dim.dimension;

    const statusPill = pill(dim.attestation.status);
    const ownerStr = `${esc(dim.owner.name)} — ${esc(dim.owner.position)}`;

    const onboardingBlock = dim.surfacesClientOnboarding
      ? `<div class="pp-onboarding">
          <h4>Client onboarding implications</h4>
          <p class="pp-policy-cite">Per NPA Policy v1.0 §5 — this dimension binds onboarding requirements for any new counterparty class.</p>
          ${renderOnboardingBlock(product, dim)}
        </div>`
      : "";

    const narrativeBlock = renderNarrativeBlock(dim);
    const programmaticBlock = renderProgrammaticBlock(product, dim);

    section.innerHTML = `
      <div class="pp-section-head" data-toggle="1">
        <div>
          <h3>${ordinal}. ${esc(dim.label)}</h3>
          <div class="pp-meta">Owner: <strong>${ownerStr}</strong></div>
        </div>
        <div>${statusPill}</div>
      </div>
      <div class="pp-section-body">
        <dl class="pp-grid">
          <dt>Artefact required</dt><dd>${esc(dim.artefactRequired)}</dd>
          <dt>Fail rule</dt><dd>${esc(dim.failRule)}</dd>
          <dt>Citation chain</dt><dd>${chips(dim.citationChain)}</dd>
        </dl>
        ${onboardingBlock}
        ${narrativeBlock}
        ${programmaticBlock}
        <div class="pp-actions" data-actions-for="${esc(dim.dimension)}"></div>
      </div>
    `;

    section.querySelector("[data-toggle]").addEventListener("click", (e) => {
      // Don't toggle when clicking buttons.
      if (e.target.closest("button")) return;
      section.classList.toggle("open");
    });

    const actions = section.querySelector(".pp-actions");
    actions.appendChild(makeAttestButton(product, dim, "design-attested"));
    actions.appendChild(makeAttestButton(product, dim, "implementation-attested"));
    actions.appendChild(makeAttestButton(product, dim, "failed"));
    actions.appendChild(
      dim.narrative
        ? makeNarrativeButton(product, dim, "Update narrative")
        : makeNarrativeButton(product, dim, "Add narrative"),
    );
    actions.appendChild(makeRequestNarrativeButton(product, dim));

    return section;
  }

  function renderNarrativeBlock(dim) {
    if (dim.narrative) {
      return `
        <div class="pp-narrative">
          <div class="pp-policy-cite" style="margin-bottom:var(--space-1)"><strong>How does this product impact my domain? What do I need to do to support it?</strong></div>
          <div class="pp-narrative-text">${esc(dim.narrative.text)}</div>
          <div class="pp-narrative-attr">
            — ${esc(dim.narrative.authorAgentName)}, ${esc(dim.narrative.authorAgentPosition)} ·
            ${esc(dim.narrative.recordedAt)}
            <div style="margin-top:4px">${chips(dim.narrative.citationChain)}</div>
          </div>
        </div>`;
    }
    if (dim.narrativeRequested) {
      return `
        <div class="pp-narrative" style="border-left-color:var(--color-warn, #b06000)">
          <div class="pp-policy-cite"><strong>How does this product impact my domain?</strong></div>
          <div class="pp-narrative-text"><em>Narrative requested from ${esc(dim.owner.name)} (${esc(dim.owner.position)}) — pending agent return.</em></div>
        </div>`;
    }
    return `
      <div class="pp-narrative" style="border-left-color:var(--color-text-secondary)">
        <div class="pp-policy-cite"><strong>How does this product impact my domain? What do I need to do to support it?</strong></div>
        <div class="pp-narrative-text"><em>No narrative yet. Use the action buttons below to request one from ${esc(dim.owner.name)} or paste it directly.</em></div>
      </div>`;
  }

  function renderProgrammaticBlock(product, dim) {
    const rows = programmaticRows(product, dim);
    if (rows.length === 0) {
      return `<p class="pp-policy-cite">No programmatic detail registered for this dimension yet.</p>`;
    }
    const inner = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("");
    return `
      <div style="margin-top:var(--space-2)">
        <div class="pp-policy-cite" style="margin-bottom:var(--space-1)"><strong>Programmatic detail (from Product record)</strong></div>
        <dl class="pp-grid">${inner}</dl>
      </div>`;
  }

  function renderOnboardingBlock(product, _dim) {
    const masterAgreement = product.legalDocumentation?.masterAgreement || "—";
    const ectaPath = product.legalDocumentation?.ectaExecutionPath || "—";
    const jurisdictionMatrix = product.legalDocumentation?.jurisdictionMatrix || [];
    const scope = product.franchiseScope || "—";
    return `
      <dl class="pp-grid">
        <dt>Master agreement</dt><dd><span class="pp-chip">${esc(masterAgreement)}</span></dd>
        <dt>ECTA execution</dt><dd><span class="pp-chip">${esc(ectaPath)}</span></dd>
        <dt>Jurisdictions</dt><dd>${chips(jurisdictionMatrix)}</dd>
        <dt>Franchise scope</dt><dd><span class="pp-chip">${esc(scope)}</span></dd>
      </dl>`;
  }

  function programmaticRows(product, dim) {
    const rp = product.riskProfile || {};
    const ac = product.accountingClassification || {};
    const ld = product.legalDocumentation || {};
    const or_ = product.operationalReadiness || {};
    const sp = product.securityProfile || {};
    switch (dim.dimension) {
      case "market-risk":
        return [
          ["Market-risk dimensions", chips(rp.marketRiskDimensions || [])],
          ["Pricing-model tier", `<span class="pp-chip">${esc(rp.modelRiskTier || "—")}</span>`],
        ];
      case "credit-risk":
        return [
          ["Credit-risk shape", `<span class="pp-chip">${esc(rp.creditRiskShape || "—")}</span>`],
        ];
      case "liquidity-funding":
        return [
          [
            "Liquidity classification",
            `<span class="pp-chip">${esc(rp.liquidityClassification || "—")}</span>`,
          ],
          ["Funding profile", `<span class="pp-chip">${esc(rp.fundingProfile || "—")}</span>`],
        ];
      case "operational-risk":
        return [
          ["Settlement path", `<span class="pp-chip">${esc(or_.settlementPath || "—")}</span>`],
          [
            "Reconciliation cadence",
            `<span class="pp-chip">${esc(or_.reconciliationCadence || "—")}</span>`,
          ],
        ];
      case "operational-readiness":
        return [
          ["Settlement path", `<span class="pp-chip">${esc(or_.settlementPath || "—")}</span>`],
          [
            "Reconciliation cadence",
            `<span class="pp-chip">${esc(or_.reconciliationCadence || "—")}</span>`,
          ],
          [
            "Substrate completeness gate",
            `<span class="pp-chip">${esc(or_.substrateCompletenessGate || "—")}</span>`,
          ],
          ["Lifecycle events", chips(product.lifecycleEventFamily || [])],
        ];
      case "accounting":
        return [
          ["IFRS 9 family", `<span class="pp-chip">${esc(ac.ifrs9Family || "—")}</span>`],
          [
            "IFRS 13 fair-value level",
            `<span class="pp-chip">${esc(ac.ifrs13FairValueHierarchy || "—")}</span>`,
          ],
          [
            "IAS 21 FX treatment",
            `<span class="pp-chip">${esc(ac.ias21FxTreatment || "—")}</span>`,
          ],
          ["BA-return line mapping", chips(ac.baReturnLineMapping || [])],
        ];
      case "capital":
        return [
          ["BA-return line mapping", chips(ac.baReturnLineMapping || [])],
          ["Funding profile", `<span class="pp-chip">${esc(rp.fundingProfile || "—")}</span>`],
        ];
      case "conduct-suitability":
        return [
          ["Franchise scope", `<span class="pp-chip">${esc(product.franchiseScope || "—")}</span>`],
          ["Jurisdictions", chips(ld.jurisdictionMatrix || [])],
        ];
      case "aml-sanctions-pep":
        return [["Counterparty jurisdictions", chips(ld.jurisdictionMatrix || [])]];
      case "model-risk":
        return [
          ["Model-risk tier", `<span class="pp-chip">${esc(rp.modelRiskTier || "—")}</span>`],
        ];
      case "legal-documentation":
        return [
          ["Master agreement", `<span class="pp-chip">${esc(ld.masterAgreement || "—")}</span>`],
          [
            "ECTA execution path",
            `<span class="pp-chip">${esc(ld.ectaExecutionPath || "—")}</span>`,
          ],
          ["Jurisdictions", chips(ld.jurisdictionMatrix || [])],
        ];
      case "information-security":
        return [
          ["Threat model ref", `<span class="pp-chip">${esc(sp.threatModelRef || "—")}</span>`],
          [
            "HSM custody required",
            `<span class="pp-chip">${sp.hsmCustodyRequired ? "yes" : "no"}</span>`,
          ],
          ["Zero-trust posture", `<span class="pp-chip">${esc(sp.zeroTrustPosture || "—")}</span>`],
        ];
      case "privacy":
        return [
          ["Franchise scope", `<span class="pp-chip">${esc(product.franchiseScope || "—")}</span>`],
          ["Jurisdictions", chips(ld.jurisdictionMatrix || [])],
        ];
      case "tax":
        return [
          ["Currency", `<span class="pp-chip">${esc(product.currency || "—")}</span>`],
          ["Jurisdictions", chips(ld.jurisdictionMatrix || [])],
        ];
      default:
        return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function makeAttestButton(product, dim, result) {
    const btn = document.createElement("button");
    btn.className = result === "failed" ? "pp-btn" : "pp-btn pp-btn-primary";
    btn.textContent =
      result === "failed"
        ? "Mark failed"
        : result === "design-attested"
          ? "Design-attest"
          : "Implementation-attest";
    btn.addEventListener("click", async () => {
      const cite = prompt(
        `Citation for ${result} attestation of "${dim.label}" on ${product.name}?\n(Use a comma-separated list of citation URNs.)`,
        (dim.citationChain || []).join(", "),
      );
      if (cite === null) return;
      const citationChain = cite
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (citationChain.length === 0) {
        alert("At least one citation is required.");
        return;
      }
      btn.disabled = true;
      try {
        const res = await fetch("/api/products/attest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.productId,
            dimension: dim.dimension,
            result,
            citationChain,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Attestation failed: ${err.error || res.statusText}`);
          return;
        }
        await loadDetail(product.productId);
      } finally {
        btn.disabled = false;
      }
    });
    return btn;
  }

  function makeNarrativeButton(product, dim, label) {
    const btn = document.createElement("button");
    btn.className = "pp-btn";
    btn.textContent = label;
    btn.addEventListener("click", () => openNarrativeModal(product, dim));
    return btn;
  }

  function makeRequestNarrativeButton(product, dim) {
    const btn = document.createElement("button");
    btn.className = "pp-btn";
    btn.textContent = `Request narrative from ${dim.owner.name}`;
    btn.addEventListener("click", async () => {
      const note = prompt(
        `Optional note for ${dim.owner.name} (${dim.owner.position}) on what to focus the narrative on:`,
        "",
      );
      if (note === null) return;
      btn.disabled = true;
      try {
        const res = await fetch("/api/products/narrative/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.productId,
            dimension: dim.dimension,
            requestedFromAgentName: dim.owner.name,
            requestedFromAgentPosition: dim.owner.position,
            ...(note ? { note } : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Request failed: ${err.error || res.statusText}`);
          return;
        }
        await loadDetail(product.productId);
      } finally {
        btn.disabled = false;
      }
    });
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Modals
  // ---------------------------------------------------------------------------

  function openNarrativeModal(product, dim) {
    const existing = dim.narrative;
    const body = `
      <div style="display:flex;flex-direction:column;gap:var(--space-2);min-width:480px">
        <p class="pp-policy-cite">
          Answer for <strong>${esc(product.name)}</strong> · dimension <strong>${esc(dim.label)}</strong>.
          The agent of record is <strong>${esc(dim.owner.name)} (${esc(dim.owner.position)})</strong>.
        </p>
        <label>Author agent name<br><input type="text" id="pp-nar-name" value="${esc(existing?.authorAgentName ?? dim.owner.name)}" style="width:100%"></label>
        <label>Author position<br><input type="text" id="pp-nar-pos" value="${esc(existing?.authorAgentPosition ?? dim.owner.position)}" style="width:100%"></label>
        <label>Narrative — answer: (1) how does this product impact my domain? (2) what do I need to do to support it?<br>
          <textarea id="pp-nar-text" rows="8" style="width:100%;font:var(--text-body)">${esc(existing?.text ?? "")}</textarea>
        </label>
        <label>Citations (comma-separated)<br>
          <input type="text" id="pp-nar-cite" value="${esc((existing?.citationChain ?? dim.citationChain ?? []).join(", "))}" style="width:100%">
        </label>
        <div class="pp-actions" style="justify-content:flex-end">
          <button class="pp-btn" id="pp-nar-cancel">Cancel</button>
          <button class="pp-btn pp-btn-primary" id="pp-nar-save">Save</button>
        </div>
      </div>
    `;
    SC.openModal({ title: `Narrative — ${dim.label}`, body });
    document.getElementById("pp-nar-cancel").addEventListener("click", SC.closeModal);
    document.getElementById("pp-nar-save").addEventListener("click", async () => {
      const name = document.getElementById("pp-nar-name").value.trim();
      const pos = document.getElementById("pp-nar-pos").value.trim();
      const text = document.getElementById("pp-nar-text").value.trim();
      const cite = document
        .getElementById("pp-nar-cite")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!name || !pos || !text || cite.length === 0) {
        alert("All fields are required (citations: at least one).");
        return;
      }
      const res = await fetch("/api/products/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.productId,
          dimension: dim.dimension,
          narrative: text,
          authorAgentName: name,
          authorAgentPosition: pos,
          citationChain: cite,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Save failed: ${err.error || res.statusText}`);
        return;
      }
      SC.closeModal();
      await loadDetail(product.productId);
    });
  }

  function openProposeModal() {
    const body = `
      <div style="display:flex;flex-direction:column;gap:var(--space-2);min-width:480px">
        <label>Product ID (URN form: <code>prd:bank:&lt;asset&gt;:&lt;slug&gt;</code>)<br>
          <input type="text" id="pp-pr-id" placeholder="prd:bank:fx:fx-forward-zar-usd" style="width:100%">
        </label>
        <label>Family<br>
          <select id="pp-pr-family" style="width:100%">
            <option value="listed-equity">listed-equity</option>
            <option value="listed-bond">listed-bond</option>
            <option value="repo">repo</option>
            <option value="otc-ird">otc-ird</option>
            <option value="fx" selected>fx</option>
            <option value="structured">structured</option>
          </select>
        </label>
        <label>Name<br><input type="text" id="pp-pr-name" placeholder="FX Forward (ZAR/USD)" style="width:100%"></label>
        <label>Description<br><textarea id="pp-pr-desc" rows="3" style="width:100%"></textarea></label>
        <label>Currency (ISO 4217)<br><input type="text" id="pp-pr-ccy" value="ZAR" maxlength="3" style="width:120px"></label>
        <label>Jurisdiction (ISO 3166-1 alpha-2)<br><input type="text" id="pp-pr-juris" value="ZA" maxlength="2" style="width:120px"></label>
        <div class="pp-actions" style="justify-content:flex-end">
          <button class="pp-btn" id="pp-pr-cancel">Cancel</button>
          <button class="pp-btn pp-btn-primary" id="pp-pr-submit">Register proposal</button>
        </div>
      </div>
    `;
    SC.openModal({ title: "Propose new product", body });
    document.getElementById("pp-pr-cancel").addEventListener("click", SC.closeModal);
    document.getElementById("pp-pr-submit").addEventListener("click", async () => {
      const productId = document.getElementById("pp-pr-id").value.trim();
      const family = document.getElementById("pp-pr-family").value;
      const name = document.getElementById("pp-pr-name").value.trim();
      const description = document.getElementById("pp-pr-desc").value.trim();
      const currency = document.getElementById("pp-pr-ccy").value.trim().toUpperCase();
      const jurisdiction = document.getElementById("pp-pr-juris").value.trim().toUpperCase();
      if (!productId || !family || !name) {
        alert("productId, family, name are required.");
        return;
      }
      const res = await fetch("/api/products/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, family, name, description, currency, jurisdiction }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Propose failed: ${err.error || res.statusText}`);
        return;
      }
      SC.closeModal();
      CURRENT_PRODUCT_ID = productId;
      await loadList();
      await loadDetail(productId);
    });
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", loadList);
})();
