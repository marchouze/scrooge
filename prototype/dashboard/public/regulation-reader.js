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

(function () {
  "use strict";

  // ── State ────────────────────────────────────────────────────────
  let currentSlug = null;
  let currentDetail = null;

  // ── DOM refs (populated after DOMContentLoaded) ──────────────────
  let listEl;
  let detailEl;
  let placeholderEl;
  let headerEl;
  let sectionsEl;
  let searchEl;
  let searchCountEl;

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
    if (s.includes("not-applicable") || s.includes("not_applicable")) return "rr-obl-status-not-applicable";
    return "";
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
    listEl.querySelectorAll(".rr-instrument-item").forEach((el) => {
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
    });
  }

  function setActiveSidebarItem(slug) {
    listEl.querySelectorAll(".rr-instrument-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.slug === slug);
    });
  }

  // ── Detail rendering ─────────────────────────────────────────────

  function renderHeader(detail) {
    headerEl.innerHTML = `
<h2 class="rr-main-title">${esc(detail.title)}</h2>
<div class="rr-main-subtitle">
  ${esc(detail.regulator)} · ${esc(String(detail.year))}
  · ${detail.totalObligations} obligation${detail.totalObligations !== 1 ? "s" : ""}
  · ${detail.chapters.reduce((n, ch) => n + ch.sections.length, 0)} sections
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

  function renderSections(chapters) {
    return chapters
      .map((chapter) => {
        const sectionsHtml = chapter.sections
          .map((section) => {
            const verbatimClass = section.verbatim ? " verbatim" : "";
            const summaryNote = !section.verbatim
              ? '<div class="rr-summary-note">Summary — full statutory text pending</div>'
              : "";
            const subsectionsHtml = section.subsections && section.subsections.length > 0
              ? section.subsections
                  .map(
                    (sub) =>
                      `<div style="margin-top:var(--space-2);padding-left:var(--space-3);border-left:2px solid var(--color-border)">
                        <span style="font-weight:600;color:var(--color-text-muted);font-size:0.85em">${esc(sub.number)}</span>
                        <span class="rr-section-text${sub.verbatim ? " verbatim" : ""}" style="display:block;margin-top:var(--space-1)">${esc(sub.text)}</span>
                      </div>`,
                  )
                  .join("")
              : "";

            const obligationsHtml = renderObligations(section.obligations);

            return `<div class="rr-section" id="${esc(section.id)}" data-section-id="${esc(section.id)}">
  <div class="rr-section-header">
    <span class="rr-section-number">§ ${esc(section.number)}</span>
    <span class="rr-section-heading">${esc(section.heading)}</span>
  </div>
  <div class="rr-section-text${verbatimClass}">${esc(section.text)}</div>
  ${summaryNote}
  ${subsectionsHtml}
  ${obligationsHtml}
</div>`;
          })
          .join("");

        return `<div class="rr-chapter">
  <div class="rr-chapter-heading">Chapter ${esc(chapter.number)} — ${esc(chapter.heading)}</div>
  ${sectionsHtml}
</div>`;
      })
      .join("");
  }

  // ── Search ───────────────────────────────────────────────────────

  function applySearch(query) {
    if (!sectionsEl) return;

    const term = (query || "").trim().toLowerCase();
    const allSections = sectionsEl.querySelectorAll(".rr-section");
    let visibleCount = 0;

    allSections.forEach((el) => {
      if (!term) {
        el.classList.remove("hidden");
        visibleCount++;
        return;
      }
      const text = el.textContent.toLowerCase();
      if (text.includes(term)) {
        el.classList.remove("hidden");
        visibleCount++;
      } else {
        el.classList.add("hidden");
      }
    });

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
    sectionsEl.innerHTML = renderSections(data.chapters);

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

  // ── Hash routing ─────────────────────────────────────────────────

  function handleHash() {
    const hash = window.location.hash.slice(1); // remove leading #
    if (!hash) return;

    const parts = hash.split("/");
    const slug = parts[0];
    const sectionId = parts[1] || null;

    if (slug) {
      selectInstrument(slug, sectionId);
    }
  }

  // ── Init ─────────────────────────────────────────────────────────

  async function init() {
    // Init shell chrome
    if (typeof initShell === "function") {
      initShell({ title: "Regulation Reader" });
    }

    // Grab DOM refs
    listEl = document.getElementById("rr-instrument-list");
    detailEl = document.getElementById("rr-detail");
    placeholderEl = document.getElementById("rr-placeholder");
    headerEl = document.getElementById("rr-header");
    sectionsEl = document.getElementById("rr-sections");
    searchEl = document.getElementById("rr-search");
    searchCountEl = document.getElementById("rr-search-count");

    // Search handler
    if (searchEl) {
      searchEl.addEventListener("input", (e) => applySearch(e.target.value));
    }

    // Hash routing
    window.addEventListener("hashchange", handleHash);

    // Load instrument list
    const data = await sf("/api/regulation-reader/instruments");
    const instruments = data?.instruments ?? [];

    renderSidebar(instruments);

    // Handle initial hash or auto-load priority-1
    if (window.location.hash) {
      handleHash();
    } else if (instruments.length > 0) {
      const first = instruments[0];
      if (first) selectInstrument(first.slug);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
