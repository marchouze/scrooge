// provenance-badge.js — D-DATA-PROVENANCE-SUBSTRATE Slice 3.
//
// Output watermarking. Renders a visible <ProvenanceBadge> on every dashboard
// page so the reader knows whether the data on screen is production,
// simulated, or a mix. Per pack §6.1 the badge is *not* in a tooltip — it
// sits in the page chrome (top-of-page) or top-of-tile, visible by intent.
//
// Three modes (per pack §6.2 + dispatch brief):
//   production-only  → 🟢 PRODUCTION DATA
//   simulated-only   → 🟡 SIMULATED DATA
//   combined         → 🔵 COMBINED (P+S)
//
// Filter narrowing (scenario / variant / sourceLineage) appends a suffix
// to the badge label (e.g. "SIMULATED DATA · scenario: rehearsal-2026-Q1").
//
// API:
//   window.provenanceBadge.render(filter)         → HTMLElement (caller-owned)
//   window.provenanceBadge.mount(target, opts?)   → mounts into the target
//                                                   element (replaces children)
//   window.provenanceBadge.fetch()                → fetches /api/provenance/mode
//   window.provenanceBadge.autoMount()            → auto-mounts on every
//                                                   `[data-provenance-badge]`
//                                                   marker + injects a top-of-
//                                                   page badge into the page
//                                                   header if no marker exists
//
// Auto-init: runs on DOMContentLoaded — fetches the resolved mode then mounts
// every marker. Pages that don't include a marker get one injected into the
// `.shell-meta` block (new shell) or `.meta` block (legacy index/activity).
// This guarantees coverage even on pages that forget to add the marker —
// the recon backstops that guarantee at build time.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer).

(() => {
  const ENDPOINT = "/api/provenance/mode";

  /** Module-private cached resolved filter. */
  let cached = null;

  /** Map from ProvenanceMode → { label, modeAttr } per the §6.2 taxonomy. */
  const MODE_DESCRIPTORS = {
    "production-only": { label: "Production data", aria: "Production data" },
    "simulated-only": { label: "Simulated data", aria: "Simulated data" },
    combined: { label: "Combined (P+S)", aria: "Combined production and simulated data" },
  };

  // ------------------------------------------------------------------
  // Filter → badge model
  // ------------------------------------------------------------------

  /**
   * Reduce a `ProvenanceFilter` (mode + scenarios + variants + sourceLineages)
   * to a presentation tuple consumed by the renderer. `mode` is mandatory; if
   * absent the badge falls back to `unknown` so the page still renders the
   * watermarking surface (with a visible "unknown" status, never silent).
   */
  function describe(filter) {
    if (!filter || typeof filter.mode !== "string") {
      return { mode: "unknown", label: "Unknown provenance", suffix: null };
    }
    const desc = MODE_DESCRIPTORS[filter.mode];
    if (!desc) {
      return { mode: "unknown", label: filter.mode, suffix: null };
    }
    const suffixParts = [];
    if (Array.isArray(filter.scenarios) && filter.scenarios.length > 0) {
      suffixParts.push(`scenarios: ${filter.scenarios.join(", ")}`);
    }
    if (Array.isArray(filter.variants) && filter.variants.length > 0) {
      suffixParts.push(`variants: ${filter.variants.join(", ")}`);
    }
    if (Array.isArray(filter.sourceLineages) && filter.sourceLineages.length > 0) {
      suffixParts.push(`lineages: ${filter.sourceLineages.join(", ")}`);
    }
    return {
      mode: filter.mode,
      label: desc.label,
      aria: desc.aria,
      suffix: suffixParts.length > 0 ? suffixParts.join(" · ") : null,
    };
  }

  // ------------------------------------------------------------------
  // Renderer
  // ------------------------------------------------------------------

  /**
   * Build a badge DOM node for the given filter. Caller owns the returned
   * element — `mount()` is the convenience wrapper that places it into a
   * target.
   *
   * @param {object|null} filter — ProvenanceFilter shape (mode + axes).
   * @param {object} [opts]
   * @param {string} [opts.placement="page-top"|"tile"] — controls margin class.
   * @returns {HTMLElement}
   */
  function render(filter, opts) {
    const placement = opts?.placement || "page-top";
    const m = describe(filter);

    const root = document.createElement("span");
    root.className = "provenance-badge";
    root.setAttribute("data-mode", m.mode);
    root.setAttribute("role", "status");
    root.setAttribute(
      "aria-label",
      `Provenance: ${m.aria || m.label}${m.suffix ? ` (${m.suffix})` : ""}`,
    );
    root.setAttribute(
      "title",
      m.suffix ? `${m.label} — ${m.suffix}` : `${m.label} — D-DATA-PROVENANCE-SUBSTRATE Slice 3`,
    );
    if (placement === "page-top") root.classList.add("provenance-badge-page-top");
    if (placement === "tile") root.classList.add("provenance-badge-tile");

    const dot = document.createElement("span");
    dot.className = "provenance-badge-dot";
    dot.setAttribute("aria-hidden", "true");
    root.appendChild(dot);

    const label = document.createElement("span");
    label.className = "provenance-badge-label";
    label.textContent = m.label;
    root.appendChild(label);

    if (m.suffix) {
      const suffix = document.createElement("span");
      suffix.className = "provenance-badge-suffix";
      suffix.textContent = `· ${m.suffix}`;
      root.appendChild(suffix);
    }

    return root;
  }

  /** Build an explicit error badge. */
  function renderError(message) {
    const root = document.createElement("span");
    root.className = "provenance-badge provenance-badge-page-top";
    root.setAttribute("data-mode", "error");
    root.setAttribute("role", "status");
    root.setAttribute("aria-label", `Provenance unavailable: ${message}`);
    root.setAttribute("title", `Provenance feed unavailable — ${message}`);

    const dot = document.createElement("span");
    dot.className = "provenance-badge-dot";
    dot.setAttribute("aria-hidden", "true");
    root.appendChild(dot);

    const label = document.createElement("span");
    label.className = "provenance-badge-label";
    label.textContent = "Provenance unavailable";
    root.appendChild(label);

    return root;
  }

  // ------------------------------------------------------------------
  // Mount
  // ------------------------------------------------------------------

  /**
   * Mount a badge into the given element (replaces children).
   *
   * @param {HTMLElement} target
   * @param {object} [opts] — { filter?: object, placement?: string }
   *                          when filter is omitted, uses the cached fetch.
   */
  function mount(target, opts) {
    if (!target) return null;
    const effectiveOpts = opts || {};
    const filter = effectiveOpts.filter !== undefined ? effectiveOpts.filter : cached;
    const node = render(filter, effectiveOpts);
    target.replaceChildren(node);
    return node;
  }

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------

  /**
   * Fetch the resolved filter from `/api/provenance/mode`. On success the
   * resolved filter is cached so subsequent `mount()` calls don't refetch.
   * On failure caches `null` and returns `null`; the badge renders an
   * explicit error state rather than disappearing.
   */
  async function fetchFilter() {
    try {
      const res = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = await res.json();
      // The endpoint returns the resolved filter directly OR `{ filter: ... }`;
      // accept both for forward-compat with the Slice 7 toggle UX.
      const filter = body?.filter ? body.filter : body;
      cached = filter && typeof filter.mode === "string" ? filter : null;
      return cached;
    } catch (e) {
      console.warn("[provenance-badge] fetch failed", e);
      cached = null;
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Auto-mount
  // ------------------------------------------------------------------

  /**
   * Auto-mount the badge:
   *
   *   1. Find every element with `[data-provenance-badge]` and mount a
   *      placement-appropriate badge (defaults to "page-top"; tile-marked
   *      elements use `data-provenance-badge="tile"`).
   *
   *   2. If no `[data-provenance-badge]` marker exists on the page,
   *      inject a fallback badge into the page chrome:
   *        - new shell: `.shell-meta` (the meta strip in the header)
   *        - legacy index.html: `.meta` strip in `.topbar-inner`
   *      This guarantees coverage even on pages that forget the marker.
   */
  function autoMount() {
    const markers = document.querySelectorAll("[data-provenance-badge]");
    if (markers.length > 0) {
      for (const el of markers) {
        const placement = el.getAttribute("data-provenance-badge") || "page-top";
        const node =
          cached === null ? renderError("/api/provenance/mode") : render(cached, { placement });
        // Marker was an empty span in markup — replace its children only;
        // do not re-create the marker itself (preserves layout siblings).
        el.replaceChildren(node);
      }
      return;
    }

    // No marker on the page → inject into page chrome. The recon
    // pipeline still flags the page as a finding so authors add an
    // explicit marker in a follow-up; the runtime fallback is to keep
    // the watermark visible regardless.
    const fallback =
      document.querySelector(".shell-meta") ||
      document.querySelector(".topbar-inner .meta") ||
      document.querySelector("header") ||
      document.body;
    if (!fallback) return;
    const node =
      cached === null
        ? renderError("/api/provenance/mode")
        : render(cached, { placement: "page-top" });
    // Place at the start so the badge is the first thing the eye reaches.
    fallback.insertBefore(node, fallback.firstChild);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  window.provenanceBadge = {
    render,
    renderError,
    mount,
    fetch: fetchFilter,
    autoMount,
    describe, // exposed for tests
  };

  document.addEventListener("DOMContentLoaded", async () => {
    await fetchFilter();
    autoMount();
  });
})();
