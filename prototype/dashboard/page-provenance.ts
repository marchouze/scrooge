// dashboard/page-provenance.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 3.5 (PR 2 — per-endpoint resolution).
//
// Every dashboard API endpoint that surfaces data attaches a typed
// `pageProvenance` field to its response so the front-end badge can paint
// the right mode for the page that called it. The previous Slice-3 wiring
// (a single page-global `/api/provenance/mode` resolved from `BANK_PHASE`)
// over-painted every page with "Simulated data" — including pages that
// surface no data and pages that surface production-citing data.
//
// Per-endpoint classification (CLAUDE.md "events-first authoring" + the
// dispatch brief's pragmatic-rule-of-thumb section):
//
//   • Endpoints that fold canonical event-store events under
//     `defaultProvenanceFilter()` → return that filter (build phase →
//     simulated-only; licence-day → production-only). Examples:
//     `/api/state`, `/api/escalations`, `/api/fleet`, `/api/agent-runs`,
//     `/api/markets/fx/counterparties`.
//
//   • Endpoints that surface markdown-register data sourced from
//     regulators or other production reference sources →
//     `production-only`. Example: `/api/obligations` (the obligations
//     register cites SARB / FIC / FSCA / PA — production reference data).
//
//   • Endpoints that surface prose authored as the canonical source
//     (procedures, principles, persona specs) → `null` (no data
//     surface — the page either renders the prose directly or the
//     consumer treats the absence of `pageProvenance` as "skip badge").
//     Example: `/api/procedures` (procedures are markdown authored as
//     canonical source per Principle 6 upward chain; not a projection
//     over events).
//
//   • Endpoints that mix both (substrate-gaps surfaces both
//     authored register prose AND derived state) → resolve to
//     `combined` when the build phase introduces event-derived
//     overlays; today the gap inventory is authored markdown only,
//     so substrate-gaps returns `production-only` (authored
//     reference data, not seeded events).
//
// Drift between a declared mode and the actual lineages of the data
// surfaced is a follow-on graph-walk recon for Vera (Slice 5 territory).
// This module is the projection-layer declaration; the recon
// `recon:provenance-badge-coverage` asserts every page wires the badge,
// not yet that the wired modes match lineages.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer).

import {
  type ProvenanceFilter,
  type ProvenanceMode,
  defaultProvenanceFilter,
} from "../platform/projections";

/**
 * Per-endpoint `pageProvenance` field.
 *
 *   • A `ProvenanceFilter` → the badge paints that mode (and any
 *     narrowing axes the filter carries).
 *   • `null` → the endpoint surfaces no data; the badge should suppress.
 *
 * Returning `null` is a peer of `data-provenance-content="none"` on the
 * page side — both opt out of badge mounting.
 */
export type PageProvenance = ProvenanceFilter | null;

/**
 * Build-phase-aware filter for endpoints that fold event-store events
 * via the default projection runtime. Today this resolves to
 * `simulated-only`; at licence-day BANK_PHASE flips and the same call
 * resolves to `production-only` with no code change.
 *
 * Use for: /api/state, /api/escalations, /api/fleet, /api/agent-runs,
 * /api/markets/fx/*, /api/decisions/<id>, RMS register views.
 */
export function eventDerivedPageProvenance(): PageProvenance {
  return defaultProvenanceFilter();
}

/**
 * Production-only filter for endpoints that surface reference data
 * cited from regulators or other production-side authoritative
 * sources. The data is not in the event store — it's a register
 * keyed by regulator citation — so the mode is constant, independent
 * of `BANK_PHASE`.
 *
 * Use for: /api/obligations.
 */
export function productionReferencePageProvenance(): PageProvenance {
  return { mode: "production-only" as ProvenanceMode };
}

/**
 * No-data signal — the endpoint returns prose-only content (markdown
 * authored as the canonical source per Principle 6 upward chain).
 * The front-end badge auto-mounter treats `null` the same as a page
 * declaring `data-provenance-content="none"`.
 *
 * Use for: /api/procedures (authored markdown registers — not events,
 * not regulator reference data, but authoring under Principle 6).
 */
export function proseAuthoredPageProvenance(): PageProvenance {
  return null;
}

/**
 * Production-only for substrate-gap inventory — parsed from Atlas's
 * substrate-state deliverable (an authored register, similar to
 * obligations). Not an event-derived projection.
 *
 * Use for: /api/substrate-gaps.
 */
export function substrateGapsPageProvenance(): PageProvenance {
  return { mode: "production-only" as ProvenanceMode };
}
