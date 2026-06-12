// regulation-reader.js
// Client-side logic for /regulation-reader.html
//
// Fetches instrument list and detail from:
//   GET /api/regulation-reader/instruments
//   GET /api/regulation-reader/:slug
//
// URL hash routing:
//   #slug           — selects instrument
//   #slug/sNN       — selects instrument and scrolls to section
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  // ── State ────────────────────────────────────────────────────────
  let currentSlug = null;
  let currentDetail = null;
  // adoptionState: { scopes: { [scopeId]: { adopted, adoptedAt } } }
  let adoptionState = { scopes: {} };
  // clientTree: Map<nodeId, { parentId, children, text }>
  let clientTree = null;

  // ── List view state ──────────────────────────────────────────────
  let allInstruments = [];
  let activeTabKey = "all";
  let activeDrillSlug = null;
  const drillDetailCache = {};

  const TABS = [
    { key: "all", label: "All", filter: () => true },
    { key: "p1", label: "Priority 1", filter: (i) => i.priority === 1 },
    { key: "p12", label: "Priority ≤ 2", filter: (i) => i.priority <= 2 },
  ];

  // ── DOM refs (populated after DOMContentLoaded) ──────────────────
  let listEl;
  let detailEl;
  let placeholderEl;
  let headerEl;
  let sectionsEl;
  let searchEl;
  let searchCountEl;
  let showOblEl;

  // ── Utils ────────────────────────────────────────────────────────

  async function sf(url) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      return r.ok ? r.json() : null;
    } catch {
      return null;
    }
  }

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusClass(status) {
    if (!status) return "";
    const s = status.toLowerCase().replace(/[^a-z]/g, "-");
    if (s.includes("in-force") || s.includes("in_force")) return "rr-obl-status-in-force";
    if (s.includes("partial")) return "rr-obl-status-partial";
    if (s.includes("draft")) return "rr-obl-status-drafting";
    if (s.includes("plan")) return "rr-obl-status-planned";
    if (s.includes("not-applicable") || s.includes("not_applicable"))
      return "rr-obl-status-not-applicable";
    return "";
  }

  // ── Client-side provision tree ───────────────────────────────────

  function buildClientTree(detail) {
    const tree = new Map();
    tree.set(detail.slug, { parentId: null, children: [], text: "" });
    for (const chapter of detail.chapters || []) {
      tree.set(chapter.id, { parentId: detail.slug, children: [], text: "" });
      tree.get(detail.slug).children.push(chapter.id);
      for (const section of chapter.sections || []) {
        tree.set(section.id, { parentId: chapter.id, children: [], text: section.text || "" });
        tree.get(chapter.id).children.push(section.id);
        for (const sub of section.subsections || []) {
          tree.set(sub.id, { parentId: section.id, children: [], text: sub.text || "" });
          tree.get(section.id).children.push(sub.id);
        }
      }
    }
    return tree;
  }

  function getLeafDescendantsC(tree, nodeId) {
    const node = tree.get(nodeId);
    if (!node) return [];
    if (node.children.length === 0) return [nodeId];
    return node.children.flatMap((c) => getLeafDescendantsC(tree, c));
  }

  function getAncestorsC(tree, nodeId) {
    const node = tree.get(nodeId);
    if (!node || node.parentId === null) return [];
    return [node.parentId, ...getAncestorsC(tree, node.parentId)];
  }

  function resolveLeafStateC(leafId, tree, scopes) {
    const ancestors = getAncestorsC(tree, leafId);
    const covering = Object.entries(scopes).filter(
      ([sid]) => sid === leafId || ancestors.includes(sid),
    );
    if (covering.length === 0) return false;
    const depthOf = (id) => {
      if (id === leafId) return 0;
      const idx = ancestors.indexOf(id);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx + 1;
    };
    covering.sort(([aId, aS], [bId, bS]) => {
      if (aS.adoptedAt !== bS.adoptedAt) return aS.adoptedAt < bS.adoptedAt ? 1 : -1;
      return depthOf(aId) - depthOf(bId);
    });
    return covering[0][1].adopted;
  }

  // Returns 'checked' | 'indeterminate' | 'unchecked'
  function computeNodeStateC(nodeId, tree, scopes) {
    const leaves = getLeafDescendantsC(tree, nodeId);
    if (leaves.length === 0) return "unchecked";
    const n = leaves.filter((l) => resolveLeafStateC(l, tree, scopes)).length;
    if (n === 0) return "unchecked";
    if (n === leaves.length) return "checked";
    return "indeterminate";
  }

  // Returns count of adopted leaves across entire instrument
  function countAdoptedLeaves(tree, slug, scopes) {
    const leaves = getLeafDescendantsC(tree, slug);
    return leaves.filter((l) => resolveLeafStateC(l, tree, scopes)).length;
  }

  // ── Sidebar rendering ────────────────────────────────────────────

  function renderSidebar(instruments) {
    if (!instruments || instruments.length === 0) {
      listEl.innerHTML = '<div class="rr-skeleton">No instruments found.</div>';
      return;
    }

    listEl.innerHTML = instruments
      .map((inst) => {
        const textChip = inst.hasFullText
          ? '<span class="rr-badge rr-badge-text">Full text</span>'
          : '<span class="rr-badge rr-badge-summary">Summary</span>';
        const oblChip =
          inst.obligationCount > 0
            ? `<span class="rr-badge rr-badge-obl">${inst.obligationCount} obligation${inst.obligationCount !== 1 ? "s" : ""}</span>`
            : "";

        return `<div class="rr-instrument-item" data-slug="${esc(inst.slug)}" role="button" tabindex="0" aria-label="${esc(inst.shortTitle)}">
  <div class="rr-instrument-name">${esc(inst.shortTitle)}</div>
  <div class="rr-instrument-meta">
    <span class="rr-year">${esc(String(inst.year))}</span>
    ${oblChip}
    ${textChip}
  </div>
</div>`;
      })
      .join("");

    // Attach click handlers
    for (const el of listEl.querySelectorAll(".rr-instrument-item")) {
      el.addEventListener("click", () => {
        const slug = el.dataset.slug;
        if (slug) selectInstrument(slug);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const slug = el.dataset.slug;
          if (slug) selectInstrument(slug);
        }
      });
    }
  }

  function setActiveSidebarItem(slug) {
    for (const el of listEl.querySelectorAll(".rr-instrument-item")) {
      el.classList.toggle("active", el.dataset.slug === slug);
    }
  }

  // ── Detail rendering ─────────────────────────────────────────────

  function renderHeader(detail) {
    const sectionCount = detail.chapters.reduce((n, ch) => n + ch.sections.length, 0);
    headerEl.innerHTML = `
<div style="display:flex;align-items:flex-start;gap:var(--space-3)">
  <div style="flex:1">
    <h2 class="rr-main-title">${esc(detail.title)}</h2>
    <div class="rr-main-subtitle">
      ${esc(detail.regulator)} · ${esc(String(detail.year))}
      · ${detail.totalObligations} obligation${detail.totalObligations !== 1 ? "s" : ""}
      · ${sectionCount} sections
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:4px;flex-shrink:0">
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85em;color:var(--color-text-muted)" title="Adopt/unadopt entire instrument">
      <input type="checkbox" id="rr-doc-adopt-cb" data-scope-id="${esc(detail.slug)}" style="width:16px;height:16px;accent-color:var(--color-primary,#3b82f6);cursor:pointer">
      Adopt all
    </label>
    <button type="button" id="rr-distill-btn" style="padding:4px 10px;font-size:0.82em;background:var(--color-primary,#3b82f6);color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap" title="Distill adopted provisions into obligation proposals via LLM">
      Distill…
    </button>
  </div>
</div>`;
  }

  function renderObligations(obligations) {
    if (!obligations || obligations.length === 0) return "";

    const cards = obligations
      .map((obl) => {
        const policyHtml = obl.policy
          ? `<a class="rr-obl-policy" href="/policies.html" title="${esc(obl.policy.urn || obl.policy.filename)}">→ ${esc(obl.policy.title)}</a>`
          : "";
        const req = obl.requirement
          ? obl.requirement.slice(0, 200) + (obl.requirement.length > 200 ? "…" : "")
          : "";

        return `<div class="rr-obl-card">
  <div class="rr-obl-header">
    <span class="rr-obl-id">${esc(obl.id)}</span>
    <span class="rr-obl-status ${statusClass(obl.status)}">${esc(obl.status || "")}</span>
  </div>
  ${req ? `<div class="rr-obl-req">${esc(req)}</div>` : ""}
  ${policyHtml}
</div>`;
      })
      .join("");

    return `<div class="rr-obligations">
  <div class="rr-obl-label">Obligations</div>
  ${cards}
</div>`;
  }

  function renderInstrumentWideObligations(obligations) {
    if (!obligations || obligations.length === 0) return "";

    const cards = obligations
      .map((obl) => {
        const policyHtml = obl.policy
          ? `<a class="rr-obl-policy" href="/policies.html" title="${esc(obl.policy.urn || obl.policy.filename)}">→ ${esc(obl.policy.title)}</a>`
          : "";
        const req = obl.requirement
          ? obl.requirement.slice(0, 200) + (obl.requirement.length > 200 ? "…" : "")
          : "";

        return `<div class="rr-obl-card">
  <div class="rr-obl-header">
    <span class="rr-obl-id">${esc(obl.id)}</span>
    <span class="rr-obl-status ${statusClass(obl.status)}">${esc(obl.status || "")}</span>
  </div>
  ${req ? `<div class="rr-obl-req">${esc(req)}</div>` : ""}
  ${policyHtml}
</div>`;
      })
      .join("");

    return `<div class="rr-instrument-wide">
  <div class="rr-instrument-wide-label">Instrument-wide obligations</div>
  <div class="rr-instrument-wide-note">Obligations whose citation anchors to this instrument as a whole (no specific section reference).</div>
  <div class="rr-instrument-wide-cards">${cards}</div>
</div>`;
  }

  function renderSubsection(sub, depth) {
    const indent = depth * 16;
    const borderColor = depth === 1 ? "var(--color-border)" : "var(--color-border-muted, #e5e7eb)";
    const summaryText = sub.summary || (!sub.verbatim ? sub.text : null);
    const bodyHtml = sub.verbatim
      ? `<span class="rr-section-text verbatim" style="display:block;margin-top:var(--space-1)">${esc(sub.text)}</span>`
      : summaryText
        ? `<span class="rr-section-text" style="display:block;margin-top:var(--space-1);font-style:italic;color:var(--color-text-muted)">${esc(summaryText)}</span>`
        : "";
    const childrenHtml =
      sub.subsections && sub.subsections.length > 0
        ? sub.subsections.map((child) => renderSubsection(child, depth + 1)).join("")
        : "";
    return `<div data-section-id="${esc(sub.id)}" style="margin-top:var(--space-2);padding-left:${indent}px;border-left:2px solid ${borderColor}">
      <span style="display:inline-flex;align-items:center;gap:6px">
        <input type="checkbox" class="rr-scope-checkbox" data-scope-id="${esc(sub.id)}" style="width:14px;height:14px;accent-color:var(--color-primary,#3b82f6);cursor:pointer;flex-shrink:0" title="Adopt/unadopt this subsection">
        <span style="font-weight:600;color:var(--color-text-muted);font-size:0.85em">${esc(sub.number)}</span>
      </span>
      ${bodyHtml}
      ${childrenHtml}
    </div>`;
  }

  function renderSections(chapters) {
    return chapters
      .map((chapter) => {
        const sectionsHtml = chapter.sections
          .map((section) => {
            const verbatimOpeningHtml = section.verbatimOpening
              ? `<div class="rr-section-text verbatim" style="margin-bottom:var(--space-2)">${esc(section.verbatimOpening)}</div>
                 <div class="rr-summary-note" style="margin-bottom:var(--space-2)">Opening subregulations above are verbatim. Full regulation summarised below.</div>`
              : "";
            // When a section has structured subsections, its text field is typically the
            // full aggregated body (a large blob). Suppress it and let subsections speak.
            // Only show the parent text when: no subsections, OR text is a short intro (≤300 chars).
            const hasSubsections = section.subsections && section.subsections.length > 0;
            const textIsIntro = !section.text || section.text.length <= 300;
            const summaryText = section.summary || (!section.verbatim ? section.text : null);
            const bodyHtml =
              hasSubsections && !textIsIntro
                ? ""
                : section.verbatim
                  ? `<div class="rr-section-text verbatim">${esc(section.text)}</div>`
                  : summaryText
                    ? `${verbatimOpeningHtml}<div class="rr-section-text" style="font-style:italic;color:var(--color-text-muted)">${esc(summaryText)}</div>`
                    : `<div class="rr-section-text" style="color:var(--color-text-muted)">Full text not reproduced.</div>`;
            const subsectionsHtml =
              section.subsections && section.subsections.length > 0
                ? section.subsections.map((sub) => renderSubsection(sub, 1)).join("")
                : "";

            // Render inline excerpt images (WS-REGULATORY-LIBRARY-V1 Slice 4)
            const excerptsHtml =
              section.excerpts && section.excerpts.length > 0
                ? section.excerpts
                    .map((exc) => {
                      const src = `/api/regulation-reader/${esc(currentSlug)}/excerpt/${esc(exc.id)}`;
                      const alt = esc(exc.caption || exc.kind || "excerpt");
                      const caption = esc(
                        exc.caption ||
                          (exc.kind
                            ? exc.kind.charAt(0).toUpperCase() + exc.kind.slice(1)
                            : "Excerpt") + (exc.pages ? ` (p. ${exc.pages})` : ""),
                      );
                      return `<figure class="reg-excerpt" style="margin:var(--space-3) 0;padding:var(--space-2);border:1px solid var(--color-border);border-radius:4px;background:var(--color-surface-muted,#f9fafb)">
  <img src="${src}" alt="${alt}" loading="lazy" style="max-width:100%;height:auto;display:block"
       onerror="this.parentElement.style.display='none'">
  <figcaption style="margin-top:var(--space-1);font-size:0.8em;color:var(--color-text-muted);font-style:italic">${caption}</figcaption>
</figure>`;
                    })
                    .join("")
                : "";

            const obligationsHtml = renderObligations(section.obligations);
            const oblCount = section.obligations?.length || 0;
            const toggleHtml =
              oblCount > 0
                ? `<button type="button" class="rr-obl-toggle" data-rr-obl-toggle aria-expanded="false" aria-label="Toggle ${oblCount} obligation${oblCount !== 1 ? "s" : ""}">
    <span class="rr-obl-toggle-icon" aria-hidden="true">▶</span>
    <span>${oblCount} obligation${oblCount !== 1 ? "s" : ""}</span>
  </button>`
                : "";

            const sNum = section.sectionNumber || section.number || section.id;
            const sHead = section.title || section.heading || "";
            return `<div class="rr-section" id="${esc(section.id)}" data-section-id="${esc(section.id)}" data-obl-count="${oblCount}">
  <div class="rr-section-header">
    <input type="checkbox" class="rr-scope-checkbox" data-scope-id="${esc(section.id)}" style="width:15px;height:15px;accent-color:var(--color-primary,#3b82f6);cursor:pointer;flex-shrink:0;margin-right:4px" title="Adopt/unadopt this section">
    <span class="rr-section-number">${esc(sNum)}</span>
    <span class="rr-section-heading">${esc(sHead)}</span>
    ${toggleHtml}
  </div>
  ${bodyHtml}
  ${excerptsHtml}
  ${subsectionsHtml}
  ${obligationsHtml}
</div>`;
          })
          .join("");

        const chNum = chapter.number || chapter.id || "";
        const chHead = chapter.heading || chapter.title || "";
        return `<div class="rr-chapter">
  <div class="rr-chapter-heading">${esc(chNum)}${chNum && chHead ? " — " : ""}${esc(chHead)}</div>
  ${sectionsHtml}
</div>`;
      })
      .join("");
  }

  // ── Obligation expand/collapse ──────────────────────────────────

  function setSectionExpanded(sectionEl, expanded) {
    sectionEl.classList.toggle("rr-expanded", expanded);
    const btn = sectionEl.querySelector("[data-rr-obl-toggle]");
    if (btn) btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function bindObligationToggles() {
    if (!sectionsEl) return;
    for (const btn of sectionsEl.querySelectorAll("[data-rr-obl-toggle]")) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const section = btn.closest(".rr-section");
        if (!section) return;
        const next = !section.classList.contains("rr-expanded");
        setSectionExpanded(section, next);
        // If the global checkbox is on but the user collapses one, leave
        // the global state as-is; treat it as "this section overrides".
      });
    }
  }

  // ── Provision-scope adoption ──────────────────────────────────────

  function paintCheckboxes(scopes) {
    if (!clientTree) return;
    for (const cb of document.querySelectorAll(".rr-scope-checkbox")) {
      const scopeId = cb.dataset.scopeId;
      if (!scopeId) continue;
      const state = computeNodeStateC(scopeId, clientTree, scopes);
      cb.checked = state === "checked";
      cb.indeterminate = state === "indeterminate";
    }
    // Document-level checkbox
    const docCb = document.getElementById("rr-doc-adopt-cb");
    if (docCb && currentDetail) {
      const state = computeNodeStateC(currentDetail.slug, clientTree, scopes);
      docCb.checked = state === "checked";
      docCb.indeterminate = state === "indeterminate";
    }
    // Update adopted count badge in distill button label if present
    const distillBtn = document.getElementById("rr-distill-btn");
    if (distillBtn && currentDetail) {
      const n = countAdoptedLeaves(clientTree, currentDetail.slug, scopes);
      distillBtn.style.display = n > 0 ? "" : "none";
      if (n > 0) distillBtn.textContent = `Distill ${n} adopted…`;
    }
  }

  async function toggleProvisionScope(scopeId, adopted) {
    if (!currentSlug) return;
    const resp = await fetch(`/api/regulation-reader/${currentSlug}/adopt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ scopeId, adopted }),
    });
    if (!resp.ok) {
      console.warn("adopt failed", await resp.text());
      return;
    }
    const data = await resp.json();
    if (data.scopes) {
      adoptionState = { scopes: data.scopes };
      paintCheckboxes(adoptionState.scopes);
    }
  }

  function bindScopeCheckboxes() {
    if (!sectionsEl) return;
    for (const cb of sectionsEl.querySelectorAll(".rr-scope-checkbox")) {
      cb.addEventListener("change", async (e) => {
        e.stopPropagation();
        const scopeId = cb.dataset.scopeId;
        if (!scopeId) return;
        await toggleProvisionScope(scopeId, cb.checked);
      });
    }
    // Document-level checkbox
    const docCb = document.getElementById("rr-doc-adopt-cb");
    if (docCb) {
      docCb.addEventListener("change", async () => {
        if (!currentDetail) return;
        await toggleProvisionScope(currentDetail.slug, docCb.checked);
      });
    }
    // Distill button
    const distillBtn = document.getElementById("rr-distill-btn");
    if (distillBtn) {
      distillBtn.addEventListener("click", () => {
        if (!currentDetail) return;
        showDistillPanel(currentDetail.slug);
      });
    }
  }

  // ── Distill panel ─────────────────────────────────────────────────

  async function showDistillPanel(scopeId) {
    if (!currentSlug) return;
    const overlay = getOrCreateOverlay();
    overlay.innerHTML = `<div class="rr-modal">
  <div class="rr-modal-header">
    <span style="font-weight:600">Distilling obligations…</span>
    <button type="button" class="rr-modal-close" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:1.2em">✕</button>
  </div>
  <div class="rr-modal-body" style="padding:var(--space-4);color:var(--color-text-muted);font-style:italic">
    Sending ${countAdoptedLeaves(clientTree, currentDetail?.slug ?? currentSlug, adoptionState.scopes)} adopted provisions to LLM…
  </div>
</div>`;
    overlay.style.display = "flex";
    overlay.querySelector(".rr-modal-close")?.addEventListener("click", closeOverlay);

    const resp = await fetch(`/api/regulation-reader/${currentSlug}/distill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ scopeId }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      renderDistillError(overlay, err.error || "Distillation failed");
      return;
    }
    const data = await resp.json();
    renderDistillProposals(overlay, data.proposals || [], {
      provider: data.provider || "anthropic",
      model: data.model || "",
    });
  }

  function renderDistillError(overlay, msg) {
    const body = overlay.querySelector(".rr-modal-body");
    if (body) body.innerHTML = `<div style="color:var(--color-error,#ef4444)">${esc(msg)}</div>`;
  }

  function renderDistillProposals(overlay, proposals, engine) {
    if (proposals.length === 0) {
      renderDistillError(
        overlay,
        "No obligation proposals generated. Try adopting more provisions.",
      );
      return;
    }

    // Track edits
    const edited = proposals.map((p) => ({ ...p }));

    const proposalCards = edited
      .map((p, i) => {
        const verbatimRows = Object.entries(p.verbatimSourceText || {})
          .map(
            ([pid, quote]) =>
              `<div style="margin-top:6px;font-size:0.8em;color:var(--color-text-muted)"><code>${esc(pid)}</code>: <em>"${esc(String(quote).slice(0, 180))}${String(quote).length > 180 ? "…" : ""}"</em></div>`,
          )
          .join("");
        return `<div class="rr-distill-card" style="border:1px solid var(--color-border);border-radius:6px;padding:var(--space-3);margin-bottom:var(--space-3)">
  <div style="display:flex;gap:var(--space-2);align-items:flex-start;margin-bottom:var(--space-2)">
    <input type="text" class="rr-prop-org-id" data-idx="${i}" value="${esc(p.suggestedOrgId)}" style="width:100px;padding:3px 6px;border:1px solid var(--color-border);border-radius:4px;font-size:0.82em;font-family:monospace" placeholder="ORG-ID">
    <input type="text" class="rr-prop-urn" data-idx="${i}" value="${esc(p.suggestedUrn)}" style="flex:1;padding:3px 6px;border:1px solid var(--color-border);border-radius:4px;font-size:0.82em;font-family:monospace" placeholder="urn:obligation:…">
    <span style="font-size:0.75em;color:var(--color-text-muted);padding-top:5px">${Math.round((p.confidence || 0) * 100)}% confidence</span>
  </div>
  <textarea class="rr-prop-req" data-idx="${i}" rows="3" style="width:100%;padding:6px;border:1px solid var(--color-border);border-radius:4px;font-size:0.88em;resize:vertical;box-sizing:border-box">${esc(p.requirement)}</textarea>
  <div style="margin-top:6px;font-size:0.8em;color:var(--color-text-muted)">Sources: ${p.contributingProvisionIds?.join(", ") || "—"}</div>
  ${verbatimRows}
</div>`;
      })
      .join("");

    const header = overlay.querySelector(".rr-modal-header span");
    if (header)
      header.textContent = `${proposals.length} obligation proposal${proposals.length !== 1 ? "s" : ""} — review and approve${engine?.provider ? ` · ${engine.provider}${engine.model ? ` (${engine.model})` : ""}` : ""}`;

    const body = overlay.querySelector(".rr-modal-body");
    if (body) {
      body.style.overflowY = "auto";
      body.style.maxHeight = "60vh";
      body.innerHTML = `${proposalCards}
<div style="display:flex;gap:var(--space-2);justify-content:flex-end;padding-top:var(--space-2);border-top:1px solid var(--color-border)">
  <button type="button" id="rr-approve-all-btn" style="padding:6px 16px;background:var(--color-primary,#3b82f6);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.9em">Approve all &amp; emit events</button>
  <button type="button" id="rr-cancel-distill-btn" style="padding:6px 12px;background:none;border:1px solid var(--color-border);border-radius:4px;cursor:pointer;font-size:0.9em">Cancel</button>
</div>`;
    }

    // Sync edited array on input
    for (const el of overlay.querySelectorAll(".rr-prop-req")) {
      el.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        edited[idx].requirement = e.target.value;
      });
    }
    for (const el of overlay.querySelectorAll(".rr-prop-org-id")) {
      el.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        edited[idx].suggestedOrgId = e.target.value;
      });
    }
    for (const el of overlay.querySelectorAll(".rr-prop-urn")) {
      el.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        edited[idx].suggestedUrn = e.target.value;
      });
    }

    overlay.querySelector("#rr-approve-all-btn")?.addEventListener("click", async () => {
      await approveObligations(edited, overlay);
    });
    overlay.querySelector("#rr-cancel-distill-btn")?.addEventListener("click", closeOverlay);
  }

  async function approveObligations(proposals, overlay) {
    const body = overlay.querySelector(".rr-modal-body");
    if (body)
      body.innerHTML = `<div style="color:var(--color-text-muted);font-style:italic">Emitting ObligationAdopted events…</div>`;

    const obligations = proposals.map((p) => ({
      obligationId: p.suggestedOrgId,
      urn: p.suggestedUrn,
      requirement: p.requirement,
      derivesFrom: p.contributingProvisionIds || [],
      owner: "",
      domain: "",
    }));

    const resp = await fetch(`/api/regulation-reader/${currentSlug}/adopt-obligations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ obligations }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      if (body)
        body.innerHTML = `<div style="color:var(--color-error,#ef4444)">Failed: ${esc(err.error || "unknown error")}</div>`;
      return;
    }
    const data = await resp.json();
    if (body)
      body.innerHTML = `<div style="color:var(--color-success,#22c55e)">✓ Adopted ${data.adopted?.length ?? 0} obligations: ${(data.adopted || []).map((id) => `<code>${esc(id)}</code>`).join(", ")}</div>
<div style="margin-top:var(--space-2)"><button type="button" id="rr-close-after-adopt" style="padding:6px 12px;background:none;border:1px solid var(--color-border);border-radius:4px;cursor:pointer">Close</button></div>`;
    overlay.querySelector("#rr-close-after-adopt")?.addEventListener("click", closeOverlay);
  }

  // ── Modal overlay helpers ─────────────────────────────────────────

  function getOrCreateOverlay() {
    let overlay = document.getElementById("rr-modal-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "rr-modal-overlay";
      overlay.style.cssText =
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;justify-content:center;align-items:center;padding:var(--space-4)";
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeOverlay();
      });
      const modal = document.createElement("div");
      modal.className = "rr-modal";
      modal.style.cssText =
        "background:var(--color-surface);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.2);width:min(640px,100%);display:flex;flex-direction:column";
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function closeOverlay() {
    const overlay = document.getElementById("rr-modal-overlay");
    if (overlay) overlay.style.display = "none";
  }

  // ── Modal header/body structure (rendered into overlay) ──────────
  // (overlay.innerHTML is replaced on each showDistillPanel call above)

  function applyGlobalObligationToggle(show) {
    if (!sectionsEl) return;
    for (const section of sectionsEl.querySelectorAll(".rr-section[data-obl-count]")) {
      const has = (Number(section.dataset.oblCount) || 0) > 0;
      setSectionExpanded(section, show && has);
    }
  }

  // ── Search ───────────────────────────────────────────────────────

  function applySearch(query) {
    if (!sectionsEl) return;

    const term = (query || "").trim().toLowerCase();
    const allSections = sectionsEl.querySelectorAll(".rr-section");
    let visibleCount = 0;

    for (const el of allSections) {
      if (!term) {
        el.classList.remove("hidden");
        visibleCount++;
        continue;
      }
      const text = el.textContent.toLowerCase();
      if (text.includes(term)) {
        el.classList.remove("hidden");
        visibleCount++;
      } else {
        el.classList.add("hidden");
      }
    }

    if (searchCountEl) {
      searchCountEl.textContent = term
        ? `${visibleCount} of ${allSections.length} sections`
        : `${allSections.length} sections`;
    }
  }

  // ── Instrument selection ─────────────────────────────────────────

  async function selectInstrument(slug, sectionId) {
    if (slug === currentSlug && currentDetail) {
      setActiveSidebarItem(slug);
      showDetail();
      if (sectionId) scrollToSection(sectionId);
      return;
    }

    currentSlug = slug;
    setActiveSidebarItem(slug);

    // Show loading state
    placeholderEl.style.display = "block";
    placeholderEl.textContent = "Loading…";
    detailEl.style.display = "none";

    const data = await sf(`/api/regulation-reader/${slug}`);
    if (!data || data.error) {
      placeholderEl.textContent = `Could not load instrument: ${slug}`;
      return;
    }

    currentDetail = data;

    renderHeader(data);
    const wideHtml = renderInstrumentWideObligations(data.instrumentWideObligations);
    sectionsEl.innerHTML = wideHtml + renderSections(data.chapters);
    bindObligationToggles();

    // Build client-side provision tree for three-state checkbox logic
    clientTree = buildClientTree(data);
    adoptionState = { scopes: {} };

    // Bind checkbox + distill handlers before painting so initial paint wires correctly
    bindScopeCheckboxes();

    // Load adoption state and paint checkboxes
    sf(`/api/regulation-reader/${slug}/adoption-state`).then((st) => {
      if (st?.scopes) {
        adoptionState = { scopes: st.scopes };
        paintCheckboxes(adoptionState.scopes);
      } else {
        paintCheckboxes({});
      }
    });

    // Honour the current global toggle state on freshly-rendered sections.
    if (showOblEl?.checked) {
      applyGlobalObligationToggle(true);
    }

    // Reset search
    if (searchEl) {
      searchEl.value = "";
    }
    applySearch("");

    // Update URL hash (without triggering hashchange)
    const newHash = `#${slug}`;
    if (window.location.hash !== newHash) {
      history.replaceState(null, "", newHash);
    }

    showDetail();

    if (sectionId) {
      // Small delay to allow render
      requestAnimationFrame(() => scrollToSection(sectionId));
    }
  }

  function showDetail() {
    placeholderEl.style.display = "none";
    detailEl.style.display = "flex";
  }

  function scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("highlight");
      setTimeout(() => el.classList.remove("highlight"), 2000);
    }
  }

  // ── View switching ───────────────────────────────────────────────

  function switchView(view) {
    const listView = document.getElementById("rr-list-view");
    const readerView = document.getElementById("rr-reader-view");
    const btnList = document.getElementById("rr-btn-list");
    const btnReader = document.getElementById("rr-btn-reader");
    if (view === "reader") {
      if (listView) listView.style.display = "none";
      if (readerView) readerView.style.display = "";
      if (btnList) btnList.classList.remove("active");
      if (btnReader) btnReader.classList.add("active");
    } else {
      if (listView) listView.style.display = "";
      if (readerView) readerView.style.display = "none";
      if (btnList) btnList.classList.add("active");
      if (btnReader) btnReader.classList.remove("active");
    }
  }

  // ── List view ────────────────────────────────────────────────────

  function renderTabs() {
    const container = document.getElementById("rr-tabs");
    if (!container) return;
    container.innerHTML = TABS.map((tab) => {
      const count = allInstruments.filter(tab.filter).length;
      const active = tab.key === activeTabKey ? " active" : "";
      return `<button type="button" class="rr-tab${active}" data-tab="${esc(tab.key)}">${esc(tab.label)}<span class="rr-tab-count">${count}</span></button>`;
    }).join("");
    for (const btn of container.querySelectorAll(".rr-tab")) {
      btn.addEventListener("click", () => {
        activeTabKey = btn.dataset.tab;
        for (const b of container.querySelectorAll(".rr-tab")) {
          b.classList.toggle("active", b.dataset.tab === activeTabKey);
        }
        renderInstTable(applyListFilters());
      });
    }
  }

  function populateRegulatorFilter(instruments) {
    const sel = document.getElementById("rr-regulator-filter");
    if (!sel) return;
    const regs = Array.from(new Set(instruments.map((i) => i.regulator).filter(Boolean))).sort();
    for (const r of regs) {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r.length > 40 ? `${r.slice(0, 37)}…` : r;
      sel.appendChild(opt);
    }
  }

  function applyListFilters() {
    const tab = TABS.find((t) => t.key === activeTabKey) || TABS[0];
    const search = (document.getElementById("rr-list-search")?.value || "").trim().toLowerCase();
    const regFilter = document.getElementById("rr-regulator-filter")?.value || "";
    return allInstruments.filter((i) => {
      if (!tab.filter(i)) return false;
      if (regFilter && i.regulator !== regFilter) return false;
      if (search) {
        const hay = [i.shortTitle, i.title, i.regulator, String(i.year)].join(" ").toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  function renderInstTable(instruments) {
    const body = document.getElementById("rr-inst-body");
    const countEl = document.getElementById("rr-list-count");
    if (!body) return;
    if (countEl) countEl.textContent = `${instruments.length} of ${allInstruments.length}`;
    if (instruments.length === 0) {
      body.innerHTML = `<tr><td colspan="6" style="padding:var(--space-4);text-align:center;color:var(--color-text-muted);font:var(--text-small)">No instruments match the current filter.</td></tr>`;
      return;
    }
    body.innerHTML = instruments
      .map((inst) => {
        const pCell =
          inst.priority <= 2
            ? `<span class="rr-badge rr-badge-obl">P${inst.priority}</span>`
            : `<span style="color:var(--color-text-muted);font-size:0.82em">P${inst.priority}</span>`;
        const isActive = inst.slug === activeDrillSlug;
        const oblCell = (inst.obligationCount || 0) > 0 ? inst.obligationCount : "—";
        return `<tr class="rr-inst-row${isActive ? " rr-row-active" : ""}" data-slug="${esc(inst.slug)}">
  <td><div class="rr-inst-name">${esc(inst.shortTitle)}</div>${inst.shortTitle !== inst.title ? `<div class="rr-inst-short">${esc(inst.title)}</div>` : ""}</td>
  <td>${esc(String(inst.year))}</td>
  <td style="max-width:200px">${esc(inst.regulator)}</td>
  <td class="rr-num-cell">${inst.sectionCount ?? "—"}</td>
  <td class="rr-num-cell">${oblCell}</td>
  <td>${pCell}</td>
</tr>`;
      })
      .join("");
    for (const tr of body.querySelectorAll(".rr-inst-row")) {
      tr.addEventListener("click", () => {
        const slug = tr.dataset.slug;
        const inst = allInstruments.find((i) => i.slug === slug);
        if (slug && inst) openDrilldown(slug, inst);
      });
    }
  }

  // ── Drilldown panel ──────────────────────────────────────────────

  async function openDrilldown(slug, inst) {
    activeDrillSlug = slug;
    for (const tr of document.querySelectorAll(".rr-inst-row")) {
      tr.classList.toggle("rr-row-active", tr.dataset.slug === slug);
    }
    const drill = document.getElementById("rr-drill");
    const titleEl = document.getElementById("rr-drill-title");
    const content = document.getElementById("rr-drill-content");
    if (!drill) return;
    drill.style.display = "";
    if (titleEl) titleEl.textContent = inst.shortTitle;
    if (content) content.innerHTML = `<div class="rr-drill-loading">Loading…</div>`;

    // Fetch detail (cached)
    if (!drillDetailCache[slug]) {
      drillDetailCache[slug] = await sf(`/api/regulation-reader/${slug}`);
    }
    const detail = drillDetailCache[slug];
    if (!content) return;

    const totalSecs = detail
      ? detail.chapters.reduce((n, ch) => n + (ch.sections?.length || 0), 0)
      : (inst.sectionCount ?? 0);

    const toc = detail
      ? detail.chapters
          .map((ch) => {
            const num = ch.number || ch.id || "";
            const head = ch.heading || ch.title || "";
            const cnt = ch.sections?.length || 0;
            return `<div class="rr-drill-toc-item">
  <span class="rr-drill-toc-num">${esc(num)}</span>
  <span class="rr-drill-toc-head">${esc(head)}</span>
  <span class="rr-drill-toc-count">${cnt} section${cnt !== 1 ? "s" : ""}</span>
</div>`;
          })
          .join("")
      : `<div class="rr-drill-loading">Could not load detail.</div>`;

    const oblCount = inst.obligationCount || 0;
    content.innerHTML = `
<button type="button" class="rr-drill-read-btn" data-read-slug="${esc(slug)}">
  Read instrument <span>→</span>
</button>
<div class="rr-drill-meta-grid">
  <div class="rr-drill-meta-row"><span class="rr-drill-meta-lbl">Regulator</span><span class="rr-drill-meta-val">${esc(inst.regulator)}</span></div>
  <div class="rr-drill-meta-row"><span class="rr-drill-meta-lbl">Year</span><span class="rr-drill-meta-val">${esc(String(inst.year))}</span></div>
  <div class="rr-drill-meta-row"><span class="rr-drill-meta-lbl">Priority</span><span class="rr-drill-meta-val">P${inst.priority}</span></div>
  <div class="rr-drill-meta-row"><span class="rr-drill-meta-lbl">Sections</span><span class="rr-drill-meta-val">${totalSecs}</span></div>
  ${oblCount > 0 ? `<div class="rr-drill-meta-row"><span class="rr-drill-meta-lbl">Obligations</span><span class="rr-drill-meta-val">${oblCount}</span></div>` : ""}
</div>
<div class="rr-drill-sect-head">Chapters (${detail?.chapters?.length ?? 0})</div>
<div>${toc}</div>`;

    const readBtn = content.querySelector(".rr-drill-read-btn");
    if (readBtn) {
      readBtn.addEventListener("click", () => {
        switchView("reader");
        selectInstrument(readBtn.dataset.readSlug);
        history.replaceState(null, "", `#${readBtn.dataset.readSlug}`);
      });
    }
  }

  function closeDrilldown() {
    activeDrillSlug = null;
    const drill = document.getElementById("rr-drill");
    if (drill) drill.style.display = "none";
    for (const tr of document.querySelectorAll(".rr-inst-row")) {
      tr.classList.remove("rr-row-active");
    }
  }

  // ── Hash routing ─────────────────────────────────────────────────

  function handleHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const parts = hash.split("/");
    const slug = parts[0];
    const sectionId = parts[1] || null;

    if (slug) {
      switchView("reader");
      selectInstrument(slug, sectionId);
    }
  }

  // ── Init ─────────────────────────────────────────────────────────

  async function init() {
    if (typeof initShell === "function") {
      initShell({ title: "Regulation Reader" });
    }

    // Reader DOM refs
    listEl = document.getElementById("rr-instrument-list");
    detailEl = document.getElementById("rr-detail");
    placeholderEl = document.getElementById("rr-placeholder");
    headerEl = document.getElementById("rr-header");
    sectionsEl = document.getElementById("rr-sections");
    searchEl = document.getElementById("rr-search");
    searchCountEl = document.getElementById("rr-search-count");
    showOblEl = document.getElementById("rr-show-obl");

    if (searchEl) searchEl.addEventListener("input", (e) => applySearch(e.target.value));
    if (showOblEl)
      showOblEl.addEventListener("change", (e) => applyGlobalObligationToggle(e.target.checked));

    // View toggle buttons
    document.getElementById("rr-btn-list")?.addEventListener("click", () => switchView("list"));
    document.getElementById("rr-btn-reader")?.addEventListener("click", () => switchView("reader"));

    // Drilldown close
    document.getElementById("rr-drill-close")?.addEventListener("click", closeDrilldown);

    // List filters
    document
      .getElementById("rr-list-search")
      ?.addEventListener("input", () => renderInstTable(applyListFilters()));
    document
      .getElementById("rr-regulator-filter")
      ?.addEventListener("change", () => renderInstTable(applyListFilters()));

    // Hash routing
    window.addEventListener("hashchange", handleHash);

    // Load instruments
    const data = await sf("/api/regulation-reader/instruments");
    allInstruments = data?.instruments ?? [];

    renderSidebar(allInstruments);
    renderTabs();
    populateRegulatorFilter(allInstruments);
    renderInstTable(applyListFilters());

    // Hash → reader; no hash → list view (default)
    if (window.location.hash) {
      handleHash();
    } else {
      switchView("list");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
