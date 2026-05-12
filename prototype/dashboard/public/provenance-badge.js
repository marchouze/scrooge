// provenance-badge.js — D-DATA-PROVENANCE-SUBSTRATE Slice 3.
//
// Output watermarking. Renders a visible <ProvenanceBadge> on dashboard
// pages that surface data, so the reader knows whether what's on screen
// is production, simulated, or a mix. Per pack §6.1 the badge is *not*
// in a tooltip — it sits in the page chrome (top-of-page) or top-of-tile,
// visible by intent.
//
// Three modes (per pack §6.2 + dispatch brief):
//   production-only  → 🟢 PRODUCTION DATA
//   simulated-only   → 🟡 SIMULATED DATA
//   combined         → 🔵 COMBINED (P+S)
//
// Plus a fourth opt-out:
//   data-provenance-content="none"  → no badge mounted at all
//                                     (prose pages — architecture diagrams,
//                                     principles viewers, persona-spec
//                                     surfaces — that surface no data).
//
// Filter narrowing (scenario / variant / sourceLineage) appends a suffix
// to the badge label (e.g. "SIMULATED DATA · scenario: rehearsal-2026-Q1").
//
// Per-page resolution (the "two-source-of-truth" rule, set 2026-05-10
// after Marc flagged that every page was painting "Simulated data"
// regardless of what was on screen):
//   1. **Static markup opt-out.** A `data-provenance-content="none"`
//      attribute on `<body>` or any wrapper element instructs the
//      auto-mounter to skip the page entirely — no badge node is
//      created. Prose pages (no data) declare this.
//   2. **Per-page API-driven mode.** Data pages declare a primary API
//      endpoint via `data-provenance-source="/api/<endpoint>"` on the
//      same element they use to mark provenance content. The auto-
//      mounter fetches that endpoint and reads `pageProvenance` from
//      the response (mode + optional scenario / variant / lineage
//      narrowing) — *not* from the global `/api/provenance/mode`.
//   3. **Fallback.** Pages with no `data-provenance-source` fall back
//      to `/api/provenance/mode` (the env-derived default). The recon
//      flags pages that hit this fallback as findings; the runtime
//      keeps the watermark visible regardless.
//
// API:
//   window.provenanceBadge.render(filter)         → HTMLElement (caller-owned)
//   window.provenanceBadge.mount(target, opts?)   → mounts into the target
//                                                   element (replaces children)
//   window.provenanceBadge.fetch(endpoint?)       → fetches the resolved
//                                                   filter from the page's
//                                                   primary API endpoint
//                                                   (or `/api/provenance/mode`
//                                                   when none is given)
//   window.provenanceBadge.autoMount()            → auto-mounts on every
//                                                   `[data-provenance-badge]`
//                                                   marker, OR skips entirely
//                                                   when `data-provenance-
//                                                   content="none"` is
//                                                   declared on the page
//
// Auto-init: runs on DOMContentLoaded — checks the page declaration first;
// if `none`, no badge is rendered. Otherwise fetches the page-scoped mode
// and mounts every marker.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer).

(() => {
  const FALLBACK_ENDPOINT = "/api/provenance/mode";

  /** Module-private cached resolved filter. */
  let cached = null;
  /**
   * True when the last fetch resolved successfully with `pageProvenance: null`
   * (i.e. the endpoint explicitly said "no data was queried, suppress the
   * badge"). Distinct from "fetch failed" — the latter renders the error
   * state, the former renders nothing at all.
   */
  let suppressed = false;

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

  // ------------------------------------------------------------------
  // Events-array mode derivation (Slice 3 hardening)
  // ------------------------------------------------------------------

  /**
   * Derive a ProvenanceMode by inspecting the `provenance.kind` field on
   * each event in an array. Returns one of four outcomes:
   *   - "empty"           → 0 events; badge shows neutral "No event data"
   *   - "production-only" → all events have kind === "production"
   *   - "simulated-only"  → all events have kind === "simulated"
   *   - "combined"        → mix of production + simulated events
   *
   * Any event missing provenance or with an unrecognised kind is treated
   * as "simulated" (conservative: err on the side of surfacing the warning).
   */
  function deriveFilterFromEvents(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return { mode: "empty" };
    }
    let hasProd = false;
    let hasSim = false;
    for (const ev of events) {
      const kind = ev?.provenance?.kind;
      if (kind === "production") {
        hasProd = true;
      } else {
        // "simulated" or missing/unknown → treat as simulated
        hasSim = true;
      }
      if (hasProd && hasSim) break; // short-circuit
    }
    if (hasProd && hasSim) return { mode: "combined" };
    if (hasProd) return { mode: "production-only" };
    return { mode: "simulated-only" };
  }

  /**
   * Append `limit=200` to a URL that doesn't already carry a `limit`
   * parameter. The badge needs a representative sample (not just page 1)
   * to correctly classify mixed stores.
   */
  function withLimit(url, limitVal) {
    if (!url || url.includes("limit=")) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}limit=${limitVal || 200}`;
  }

  // ------------------------------------------------------------------
  // Renderer additions for the two-state hardened modes
  // ------------------------------------------------------------------

  /**
   * Render a "no event data" neutral badge for an empty event store.
   * Kept separate from the main render() path so callers can distinguish
   * between "unknown filter" (error state) and "explicitly empty store".
   */
  function renderEmpty() {
    const root = document.createElement("span");
    root.className = "provenance-badge provenance-badge-page-top prov-badge prov-none";
    root.setAttribute("data-mode", "empty");
    root.setAttribute("role", "status");
    root.setAttribute("aria-label", "No event data in store");
    root.setAttribute("title", "Event store is empty — no provenance to report");

    const dot = document.createElement("span");
    dot.className = "provenance-badge-dot";
    dot.setAttribute("aria-hidden", "true");
    root.appendChild(dot);

    const label = document.createElement("span");
    label.className = "provenance-badge-label";
    label.textContent = "No event data";
    root.appendChild(label);

    return root;
  }

  /**
   * Fetch the resolved filter from a page-scoped endpoint, or
   * `/api/provenance/mode` when no endpoint is given. On success the
   * resolved filter is cached so subsequent `mount()` calls don't refetch.
   * On failure caches `null` and returns `null`; the badge renders an
   * explicit error state rather than disappearing.
   *
   * Response shape resolution (priority order):
   *   1. **Events array** — if the response body contains an `events`
   *      array, the badge derives the mode directly by inspecting
   *      `provenance.kind` on each event (hardened Slice 3 path). A
   *      `limit=200` query param is appended to the fetch URL so the
   *      badge sees a representative sample, not just page 1.
   *      Four outcomes: "production-only", "simulated-only", "combined",
   *      or "empty" (zero events — neutral badge, not an error).
   *
   *   2. **Page-scoped `pageProvenance`** — `{ pageProvenance: <filter|null> }`
   *      (Slice 3.5). `null` → endpoint explicitly says "no data, suppress
   *      badge". This is distinct from a failed fetch.
   *
   *   3. **Top-level `{ filter: <filter> }`** — `/api/provenance/mode`
   *      (Slice 3 original fallback endpoint).
   *
   *   4. **Top-level filter object** — forward-compat shape.
   */
  async function fetchFilter(endpoint) {
    const rawUrl = typeof endpoint === "string" && endpoint.length > 0 ? endpoint : FALLBACK_ENDPOINT;
    // Append limit when fetching an events endpoint so we get a
    // representative sample, not just the first page.
    const url = withLimit(rawUrl, 200);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = await res.json();

      // Shape 1 — events array (hardened path: derive mode from data).
      if (body && Array.isArray(body.events)) {
        const derived = deriveFilterFromEvents(body.events);
        if (derived.mode === "empty") {
          // Store is empty — show the neutral badge, not an error.
          cached = derived;
          suppressed = false;
          return cached;
        }
        cached = derived;
        suppressed = false;
        return cached;
      }

      // Shape 2 — page-scoped pageProvenance field (Slice 3.5).
      let filter = null;
      let explicitNull = false;
      if (body && Object.prototype.hasOwnProperty.call(body, "pageProvenance")) {
        filter = body.pageProvenance;
        explicitNull = filter === null;
      } else if (body?.filter) {
        // Shape 3 — /api/provenance/mode top-level { filter } object.
        filter = body.filter;
      } else {
        // Shape 4 — forward-compat top-level filter object.
        filter = body;
      }
      if (explicitNull) {
        cached = null;
        suppressed = true;
        return null;
      }
      cached = filter && typeof filter.mode === "string" ? filter : null;
      suppressed = false;
      return cached;
    } catch (e) {
      console.warn("[provenance-badge] fetch failed", url, e);
      cached = null;
      suppressed = false;
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Auto-mount
  // ------------------------------------------------------------------

  /**
   * Read the page-level provenance declaration. Returns:
   *   - `{ content: "none" }` when the page declares it surfaces no data.
   *   - `{ content: "data", endpoint: <string|null> }` otherwise. The
   *     endpoint is the page's primary API URL (read from the closest
   *     element carrying a `data-provenance-source` attribute, typically
   *     `<body>` or the badge marker itself); when no endpoint is
   *     declared, the global fallback is used.
   *
   * The check looks at `<body>` and `<html>` first (so a page-wide
   * declaration on either is the canonical place), then any element
   * carrying `data-provenance-content`. A page is "none" if any such
   * declaration says `none`.
   */
  function readPageDeclaration() {
    const declElement =
      document.querySelector("[data-provenance-content]") ||
      document.body ||
      document.documentElement;
    const content = declElement?.getAttribute
      ? declElement.getAttribute("data-provenance-content")
      : null;
    if (content === "none") {
      return { content: "none" };
    }
    const sourceElement = document.querySelector("[data-provenance-source]");
    const endpoint = sourceElement?.getAttribute
      ? sourceElement.getAttribute("data-provenance-source")
      : null;
    return { content: "data", endpoint: endpoint || null };
  }

  /**
   * Auto-mount the badge:
   *
   *   1. If the page declares `data-provenance-content="none"` on `<body>`
   *      or any wrapper element, **no badge is rendered** — not the
   *      "Provenance unavailable" error state, not the chrome fallback,
   *      nothing. The page is intentionally blank.
   *
   *   2. Otherwise, find every element with `[data-provenance-badge]`
   *      and mount a placement-appropriate badge (defaults to "page-top";
   *      tile-marked elements use `data-provenance-badge="tile"`).
   *
   *   3. If no `[data-provenance-badge]` marker exists on the page,
   *      inject a fallback badge into the page chrome (`.shell-meta`,
   *      legacy `.topbar-inner .meta`, `<header>`, or `<body>`). The
   *      recon flags pages that hit this fallback so authors add an
   *      explicit marker in a follow-up.
   */
  function autoMount() {
    const decl = readPageDeclaration();
    if (decl.content === "none") {
      // Intentional opt-out. Render nothing — not even an error state.
      return;
    }
    if (suppressed) {
      // Endpoint returned `pageProvenance: null` — endpoint-side opt-out
      // (e.g. /api/procedures, which surfaces authored markdown, not
      // event-derived data). Render nothing, same as the page-side opt-out.
      return;
    }

    const markers = document.querySelectorAll("[data-provenance-badge]");
    if (markers.length > 0) {
      for (const el of markers) {
        const placement = el.getAttribute("data-provenance-badge") || "page-top";
        let node;
        if (cached === null) {
          node = renderError(decl.endpoint || FALLBACK_ENDPOINT);
        } else if (cached.mode === "empty") {
          node = renderEmpty();
        } else {
          node = render(cached, { placement });
        }
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
    let node;
    if (cached === null) {
      node = renderError(decl.endpoint || FALLBACK_ENDPOINT);
    } else if (cached.mode === "empty") {
      node = renderEmpty();
    } else {
      node = render(cached, { placement: "page-top" });
    }
    // Place at the start so the badge is the first thing the eye reaches.
    fallback.insertBefore(node, fallback.firstChild);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  window.provenanceBadge = {
    render,
    renderError,
    renderEmpty,
    mount,
    fetch: fetchFilter,
    autoMount,
    describe, // exposed for tests
    deriveFilterFromEvents, // exposed for tests
    withLimit, // exposed for tests
    readPageDeclaration, // exposed for tests
    isSuppressed: () => suppressed, // exposed for tests
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const decl = readPageDeclaration();
    if (decl.content === "none") {
      // Skip the network round-trip when the page has opted out of any
      // provenance render. Saves an /api/* call on every prose page.
      return;
    }
    await fetchFilter(decl.endpoint || undefined);
    autoMount();
  });
})();
