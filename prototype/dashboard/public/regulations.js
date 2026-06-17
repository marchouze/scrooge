// regulations.js — the unified Regulations module controller.
//
// Three cross-linked panels over the two-plane architecture:
//   Regulations  — instrument list (Plane A reference) + the bank-obligation
//                  count each one generated (back-population from Plane B).
//   Reader       — section text with the adopted bank obligations traced back to
//                  each section (status + applicability + owner seat TITLE),
//                  each linking forward into the Obligations panel.
//   Obligations  — the event-sourced register with a drill-down that links the
//                  reverse direction ("View in source regulation") back to the
//                  exact provision in the Reader.
//
// All data is read-side (Principle 1). Seats are shown by TITLE only — the
// server already masks the agent personal name (V2 UI rule).

initShell({ title: "Regulations" });

(() => {
  const esc = (s) => (window.SC && SC.esc ? SC.esc(s) : String(s ?? ""));
  async function sf(u) {
    try {
      const r = await fetch(u, { headers: { Accept: "application/json" } });
      return r.ok ? r.json() : null;
    } catch {
      return null;
    }
  }
  const $ = (id) => document.getElementById(id);

  // ── Shared status / verdict presentation ────────────────────────────────
  function statusBadge(status) {
    const s = (status || "").toLowerCase();
    let cls = "rg-b-muted";
    if (/attest|in-force|implemented|complete/.test(s)) cls = "rg-b-green";
    else if (/procedure|control|assigned|partial/.test(s)) cls = "rg-b-indigo";
    else if (/adopt|planned|draft/.test(s)) cls = "rg-b-accent";
    return `<span class="rg-badge ${cls}">${esc(status || "—")}</span>`;
  }
  function verdictBadge(v) {
    if (!v) return `<span class="rg-badge rg-b-grey">unassessed</span>`;
    const cls =
      v === "applies" ? "rg-b-green" : v === "partially-applies" ? "rg-b-amber" : "rg-b-grey";
    return `<span class="rg-badge ${cls}">${esc(v)}</span>`;
  }
  function reviewBadge(status) {
    const cls =
      status === "reviewed" ? "rg-b-green" : status === "stale" ? "rg-b-amber" : "rg-b-muted";
    return `<span class="rg-badge ${cls}">${esc(status || "unreviewed")}</span>`;
  }

  // ── State ────────────────────────────────────────────────────────────────
  let instruments = [];
  let obligations = [];
  const detailCache = new Map(); // slug → detail view
  let _currentTab = "regulations";

  // ── Tabs + hash routing ───────────────────────────────────────────────────
  function setTab(tab) {
    _currentTab = tab;
    for (const b of document.querySelectorAll(".rg-tab"))
      b.classList.toggle("active", b.dataset.tab === tab);
    for (const p of document.querySelectorAll(".rg-panel"))
      p.classList.toggle("active", p.id === `panel-${tab}`);
  }

  function applyHash() {
    const raw = location.hash.replace(/^#/, "");
    const [tab, a, b] = raw.split("/").map(decodeURIComponent);
    if (tab === "reader") {
      setTab("reader");
      if (a) openReader(a, b);
    } else if (tab === "obligations") {
      setTab("obligations");
      if (a) openObligation(a);
      else closeDrill();
    } else {
      setTab("regulations");
    }
  }

  for (const b of document.querySelectorAll(".rg-tab"))
    b.addEventListener("click", () => {
      location.hash = b.dataset.tab;
    });
  window.addEventListener("hashchange", applyHash);

  // ── Regulations panel ──────────────────────────────────────────────────────
  function renderInstruments() {
    const q = $("rg-inst-search").value.trim().toLowerCase();
    const reg = $("rg-inst-regulator").value;
    const rev = $("rg-inst-review").value;
    const rows = instruments.filter(
      (i) =>
        (!reg || i.regulator === reg) &&
        (!rev || i.reviewStatus === rev) &&
        (!q || `${i.title} ${i.shortTitle} ${i.slug}`.toLowerCase().includes(q)),
    );
    $("rg-inst-count").textContent = `${rows.length} of ${instruments.length}`;
    $("rg-inst-body").innerHTML =
      rows
        .map(
          (i) => `<tr data-slug="${esc(i.slug)}">
        <td><div class="rg-name">${esc(i.shortTitle || i.title)}</div><div class="rg-sub">${esc(i.title)}</div></td>
        <td>${esc(i.year || "—")}</td>
        <td>${esc(i.regulator || "—")}</td>
        <td class="rg-num">${i.sectionCount ?? 0}</td>
        <td class="rg-num">${i.obligationsLinked ?? i.obligationCount ?? 0}</td>
        <td class="rg-num">${
          i.derivedObligationCount
            ? `<span class="rg-badge rg-b-accent">${i.derivedObligationCount}</span>`
            : '<span class="rg-sub">0</span>'
        }</td>
        <td>${reviewBadge(i.reviewStatus)}</td>
      </tr>`,
        )
        .join("") || `<tr><td colspan="7" class="rg-skeleton">No regulations match.</td></tr>`;
    for (const tr of $("rg-inst-body").querySelectorAll("tr[data-slug]"))
      tr.addEventListener("click", () => {
        location.hash = `reader/${encodeURIComponent(tr.dataset.slug)}`;
      });
  }

  // ── Reader panel ───────────────────────────────────────────────────────────
  async function loadDetail(slug) {
    if (detailCache.has(slug)) return detailCache.get(slug);
    const d = await sf(`/api/regulation-reader/${encodeURIComponent(slug)}`);
    if (d && !d.error) detailCache.set(slug, d);
    return d;
  }

  function oblCard(ref) {
    const meta = [
      ref.applicability ? verdictBadge(ref.applicability.verdict) : verdictBadge(null),
      ref.ownerSeatTitle ? `<span class="rg-obl-meta">${esc(ref.ownerSeatTitle)}</span>` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<div class="rg-obl-card">
      <div class="rg-obl-row1">
        <span class="rg-obl-id" data-obl="${esc(ref.id)}">${esc(ref.id)}</span>
        ${statusBadge(ref.status)}
        <span class="rg-jump" data-obl-jump="${esc(ref.id)}">View obligation →</span>
      </div>
      <div class="rg-obl-title">${esc(ref.title || "")}</div>
      <div class="rg-obl-row1">${meta}</div>
    </div>`;
  }

  async function openReader(slug, scrollProvision) {
    $("rg-reader-select").value = slug;
    $("rg-reader-body").innerHTML = `<div class="rg-skeleton">Loading…</div>`;
    const d = await loadDetail(slug);
    if (!d || d.error) {
      $("rg-reader-body").innerHTML = `<div class="rg-skeleton">Could not load ${esc(slug)}.</div>`;
      return;
    }
    $("rg-reader-meta").textContent =
      `${d.totalObligations || 0} source obligations · ${d.derivedObligationCount || 0} bank obligations derived`;
    const chaptersHtml = (d.chapters || [])
      .map((ch) => {
        const secs = (ch.sections || [])
          .map((s) => {
            const num = s.number || s.sectionNumber || "";
            const derived = (s.derivedObligations || []).map(oblCard).join("");
            const derivedBlock = derived
              ? `<div class="rg-derived"><div class="rg-derived-lbl">Bank obligations derived from this section</div>${derived}</div>`
              : "";
            const idAttr = s.id ? ` id="sec-${esc(s.id)}" data-prov="${esc(s.id)}"` : "";
            return `<div class="rg-section"${idAttr}>
              <div class="rg-section-hd"><span class="rg-section-num">${esc(num)}</span>
                <span class="rg-section-heading">${esc(s.heading || s.title || "")}</span></div>
              ${s.text ? `<div class="rg-section-text">${esc(s.text)}</div>` : ""}
              ${derivedBlock}
            </div>`;
          })
          .join("");
        return `<div class="rg-chapter"><div class="rg-chapter-h">${esc(ch.heading || ch.title || ch.number || "")}</div>${secs}</div>`;
      })
      .join("");
    $("rg-reader-body").innerHTML = chaptersHtml || `<div class="rg-skeleton">No sections.</div>`;
    wireReaderEvents();
    applyReaderSearch();
    if (scrollProvision) flashProvision(scrollProvision);
  }

  function flashProvision(provId) {
    // Provision ids span two spaces; the section carries its structured-doc id.
    let el = document.getElementById(`sec-${provId}`);
    if (!el) {
      // graph-form id (PROV-<SLUG>-s<n>): match the section whose number tail agrees.
      const m = /-s(.+)$/.exec(provId);
      if (m) {
        for (const c of document.querySelectorAll(".rg-section[data-prov]")) {
          if ((c.dataset.prov || "").toLowerCase().endsWith(m[1].toLowerCase())) {
            el = c;
            break;
          }
        }
      }
    }
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("rg-flash");
      setTimeout(() => el.classList.remove("rg-flash"), 2400);
    }
  }

  function wireReaderEvents() {
    for (const el of document.querySelectorAll("[data-obl-jump], .rg-obl-id[data-obl]"))
      el.addEventListener("click", () => {
        const id = el.dataset.oblJump || el.dataset.obl;
        location.hash = `obligations/${encodeURIComponent(id)}`;
      });
  }

  function applyReaderSearch() {
    const q = $("rg-reader-search").value.trim().toLowerCase();
    for (const sec of document.querySelectorAll("#rg-reader-body .rg-section")) {
      sec.style.display = !q || sec.textContent.toLowerCase().includes(q) ? "" : "none";
    }
  }

  // ── Obligations panel ──────────────────────────────────────────────────────
  function renderObligations() {
    const q = $("rg-obl-search").value.trim().toLowerCase();
    const st = $("rg-obl-status").value;
    const av = $("rg-obl-applic").value;
    const ow = $("rg-obl-owner").value;
    const reg = $("rg-obl-regulator").value;
    const rows = obligations.filter(
      (o) =>
        (!st || o.status === st) &&
        (!av || (o.applicabilityVerdict ?? "(unassessed)") === av) &&
        (!ow || (o.ownerSeatTitle ?? "") === ow) &&
        (!reg || o.regulator === reg) &&
        (!q || `${o.id} ${o.title} ${o.requirement}`.toLowerCase().includes(q)),
    );
    $("rg-obl-count").textContent = `${rows.length} of ${obligations.length}`;
    $("rg-obl-tbody").innerHTML =
      rows
        .map(
          (o) => `<tr data-obl="${esc(o.id)}">
        <td><div class="rg-name">${esc(o.title || o.id)}</div><div class="rg-sub">${esc(o.id)}</div></td>
        <td>${statusBadge(o.status)}</td>
        <td>${verdictBadge(o.applicabilityVerdict)}</td>
        <td>${esc(o.ownerSeatTitle || "—")}</td>
        <td>${esc(o.regulator || "—")}</td>
      </tr>`,
        )
        .join("") || `<tr><td colspan="5" class="rg-skeleton">No obligations match.</td></tr>`;
    for (const tr of $("rg-obl-tbody").querySelectorAll("tr[data-obl]"))
      tr.addEventListener("click", () => {
        location.hash = `obligations/${encodeURIComponent(tr.dataset.obl)}`;
      });
  }

  function closeDrill() {
    $("rg-obl-drill").style.display = "none";
  }

  async function openObligation(id) {
    const drill = $("rg-obl-drill");
    drill.style.display = "";
    $("rg-drill-title").textContent = id;
    $("rg-drill-c").innerHTML = `<div class="rg-skeleton">Loading…</div>`;
    const [detail, src] = await Promise.all([
      sf(`/api/obligation?id=${encodeURIComponent(id)}`),
      sf(`/api/regulations/obligation-source/${encodeURIComponent(id)}`),
    ]);
    if (!detail || detail.error) {
      $("rg-drill-c").innerHTML = `<div class="rg-skeleton">Could not load ${esc(id)}.</div>`;
      return;
    }
    $("rg-drill-title").textContent = detail.title || id;
    const ap = detail.applicability;
    const links = src?.links || [];
    const sourceBtns = links
      .map(
        (l) =>
          `<button type="button" class="rg-source-btn" data-slug="${esc(l.slug)}" data-prov="${esc((l.provisionIds || [])[0] || "")}">
            <span>View in source regulation — ${esc(l.slug)}</span><span>→</span></button>`,
      )
      .join("");
    const hist = (detail.history || [])
      .map(
        (h) =>
          `<div class="rg-hist-item">${esc(h.at?.slice(0, 10) || "")} · ${esc(h.kind)}${h.status ? ` → ${esc(h.status)}` : ""}</div>`,
      )
      .join("");
    $("rg-drill-c").innerHTML = `
      ${sourceBtns}
      <div class="rg-meta-grid">
        <div><div class="rg-meta-l">Status</div><div class="rg-meta-v">${statusBadge(detail.projection?.status || (detail.adopted ? "adopted" : "—"))}</div></div>
        <div><div class="rg-meta-l">Applicability</div><div class="rg-meta-v">${verdictBadge(ap?.verdict)}</div></div>
        <div><div class="rg-meta-l">Regulator</div><div class="rg-meta-v">${esc(detail.regulator || "—")}</div></div>
        <div><div class="rg-meta-l">Domain</div><div class="rg-meta-v">${esc(detail.domainDescription || "—")}</div></div>
      </div>
      ${ap?.rationale ? `<div class="rg-meta-l">Applicability rationale</div><div class="rg-prose" style="margin-bottom:var(--space-3)">${esc(ap.rationale)}</div>` : ""}
      <div class="rg-meta-l">Requirement</div>
      <div class="rg-prose" style="margin-bottom:var(--space-3)">${esc(detail.seed?.requirement || detail.projection?.requirement || "—")}</div>
      ${detail.verbatimText ? `<div class="rg-meta-l">Verbatim source</div><div class="rg-prose" style="margin-bottom:var(--space-3)">${esc(detail.verbatimText)}</div>` : ""}
      ${hist ? `<div class="rg-meta-l">Lifecycle history</div>${hist}` : ""}
    `;
    for (const btn of $("rg-drill-c").querySelectorAll(".rg-source-btn"))
      btn.addEventListener("click", () => {
        const slug = btn.dataset.slug;
        const prov = btn.dataset.prov;
        location.hash = prov
          ? `reader/${encodeURIComponent(slug)}/${encodeURIComponent(prov)}`
          : `reader/${encodeURIComponent(slug)}`;
      });
  }

  function fillSelect(sel, values, current) {
    const keep = sel.value || current || "";
    const opts = [...sel.querySelectorAll("option")].slice(0, 1).map((o) => o.outerHTML);
    for (const v of [...new Set(values)].filter(Boolean).sort())
      opts.push(`<option value="${esc(v)}">${esc(v)}</option>`);
    sel.innerHTML = opts.join("");
    sel.value = keep;
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  (async () => {
    const [instData, oblData] = await Promise.all([
      sf("/api/regulation-reader/instruments"),
      sf("/api/bank-obligations"),
    ]);
    instruments = instData?.instruments || [];
    obligations = oblData?.obligations || [];

    // Populate selects.
    fillSelect(
      $("rg-inst-regulator"),
      instruments.map((i) => i.regulator),
    );
    fillSelect(
      $("rg-reader-select"),
      [], // populated below with slug→label options
    );
    $("rg-reader-select").innerHTML = `<option value="">Choose a regulation…</option>${instruments
      .map((i) => `<option value="${esc(i.slug)}">${esc(i.shortTitle || i.title)}</option>`)
      .join("")}`;
    fillSelect(
      $("rg-obl-status"),
      obligations.map((o) => o.status),
    );
    fillSelect(
      $("rg-obl-owner"),
      obligations.map((o) => o.ownerSeatTitle),
    );
    fillSelect(
      $("rg-obl-regulator"),
      obligations.map((o) => o.regulator),
    );

    // Wire filters.
    for (const id of ["rg-inst-search", "rg-inst-regulator", "rg-inst-review"])
      $(id).addEventListener("input", renderInstruments);
    for (const id of [
      "rg-obl-search",
      "rg-obl-status",
      "rg-obl-applic",
      "rg-obl-owner",
      "rg-obl-regulator",
    ])
      $(id).addEventListener("input", renderObligations);
    $("rg-reader-search").addEventListener("input", applyReaderSearch);
    $("rg-reader-select").addEventListener("change", (e) => {
      if (e.target.value) location.hash = `reader/${encodeURIComponent(e.target.value)}`;
    });
    $("rg-drill-x").addEventListener("click", () => {
      closeDrill();
      location.hash = "obligations";
    });

    renderInstruments();
    renderObligations();
    applyHash();
  })();
})();
