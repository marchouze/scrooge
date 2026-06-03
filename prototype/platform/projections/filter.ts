// platform/projections/filter.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 2 — projection-runtime mode selection.
//
// `ProvenanceFilter` is the typed lens that every projection-runtime call
// site uses to select between production-only / simulated-only / combined
// reads, and to narrow further by scenario / variant / sourceLineage.
//
// Authority:
//   - D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10)
//   - Owner Inbox/2026-05-10_atlas-anya_d-data-provenance-substrate-build-spec.md §5
//   - Principle 1 — events are the only source of truth (the filter is a
//     query over the canonical log, not a parallel store)
//   - Principle 5 — multi-axis envelope dimensions are first-class typed
//     primitives (provenance is structurally similar to currency / entity)
//
// Default mode (per D-PROVENANCE-FILTER-ENFORCEMENT, CEO-approved 2026-05-12):
//   Always `production-only`. Test / scenario data is tagged `kind:simulated`
//   and excluded from all projections by default. Callers must explicitly opt
//   into `simulated-only` or `combined` to see simulated events.
//
// Snapshot-key strategy: a filter digest is included in the effective
// stream key the runtime passes to the EventStore snapshot APIs. A
// snapshot computed under filter `{mode: "production-only"}` is
// structurally distinct from one computed under `{mode: "combined"}`;
// re-snapshotting under a new filter creates a parallel snapshot row
// rather than overwriting (per pack §5.1).
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime)

import { createHash } from "node:crypto";

import { bankLifecyclePhase } from "../event-store/provenance";
import type {
  ProvenanceKind,
  ScenarioId,
  SourceLineageRef,
  VariantId,
} from "../event-store/provenance";
import type { Event, ProvenanceTag } from "../event-store/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Read-time mode selector. Mirrors the §5.1 spec:
 *   - `production-only`  — only events with `provenance.kind === "production"`.
 *   - `simulated-only`   — only events with `provenance.kind === "simulated"`.
 *   - `combined`         — both kinds; consumers handling combined-mode
 *                          aggregations must preserve per-event provenance
 *                          in the output (Slice 4 builds the typed
 *                          `ProvenanceAggregate<>` primitive on top).
 */
export type ProvenanceMode = "production-only" | "simulated-only" | "combined" | "operating-book";

// ---------------------------------------------------------------------------
// Operating-book inclusion — D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE.
//
// `operating-book` is the canonical inclusion axis, separate from the
// lineage/audit axis (`provenance.kind`). It answers the one question every
// measurement / alert actually needs: "is this event part of the bank's live
// operating book?" — keyed off the lifecycle phase, NOT off `kind` directly.
//
//   - build-phase   → the book = everything the bank actually operates on
//                     (production + operational-simulated flows), EXCLUDING
//                     (a) seed-harness scaffolding (`build-phase-fixture`) and
//                     (b) sandbox runs (scenario / rehearsal / stress /
//                     counterfactual / test-pollution). This matches the
//                     confirmed liveFlowView intent: "every flow someone
//                     actually booked, real or rehearsed, but nothing the seed
//                     harness fabricated, and nothing from a what-if sandbox."
//   - commencement  → the book = production only; everything else archival.
//
// Sandbox classification: a reserved `tags: ["sandbox"]` marker on the
// provenance envelope (the schema already carries `tags?: string[]`), plus a
// fallback classifier on held-out `scenario`-id prefixes so legacy scenario
// runs are held out WITHOUT a re-tagging migration. Adding a new held-out
// class is a one-line edit here.
// ---------------------------------------------------------------------------

/** Reserved provenance tag marking an event as sandbox (held out of the book). */
export const SANDBOX_TAG = "sandbox";

/**
 * `scenario`-id prefixes whose simulated events are sandbox (held out of the
 * operating book): what-if / rehearsal / stress / counterfactual analyses, and
 * test-pollution left in the shared store by test runs. Operational simulated
 * data (the build-phase bank actually operating — manual bookings, the sim-hub
 * book, pre-substrate operating backfill) does NOT match these and stays in the
 * book. Belt-and-suspenders alongside the explicit `SANDBOX_TAG` so no legacy
 * re-tagging is required (see D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE roadmap).
 */
export const SANDBOX_SCENARIO_PREFIXES: readonly string[] = [
  "rehearsal-",
  "stress-",
  "counterfactual-",
  "what-if-",
  "test-pollution",
];

/** True iff `tag` denotes a sandbox event held out of the operating book. */
export function isSandboxProvenance(tag: ProvenanceTag): boolean {
  if (tag.tags?.includes(SANDBOX_TAG)) return true;
  if (tag.kind === "simulated" && tag.scenario) {
    return SANDBOX_SCENARIO_PREFIXES.some((p) => tag.scenario?.startsWith(p));
  }
  return false;
}

/**
 * Typed read-time provenance filter. Carried by every projection-runtime
 * call site from Slice 2 onwards. The runtime applies the filter to
 * every event it folds into the projection state and includes a
 * structural digest of the filter in the snapshot key.
 *
 * Axis precedence (all narrowing — empty array means "no narrowing", not
 * "match nothing"):
 *   1. `mode`            — primary kind discriminator (mandatory).
 *   2. `scenarios`       — narrow simulated runs to specific scenario(s).
 *                          Has no effect on production events; in
 *                          `production-only` mode it is structurally
 *                          recorded in the digest but never restricts
 *                          the result set.
 *   3. `variants`        — narrow within scenario(s).
 *   4. `sourceLineages`  — narrow by originating system / process.
 */
export interface ProvenanceFilter {
  readonly mode: ProvenanceMode;
  readonly scenarios?: ReadonlyArray<ScenarioId>;
  readonly variants?: ReadonlyArray<VariantId>;
  readonly sourceLineages?: ReadonlyArray<SourceLineageRef>;
}

// ---------------------------------------------------------------------------
// Env-derived default
// ---------------------------------------------------------------------------

/**
 * Resolve the default `ProvenanceMode` for the current environment.
 *
 * Default: `operating-book` (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR3,
 * CEO-approved 2026-06-03). The bank's live operating book is the canonical
 * default for every projection / report — during build phase that means
 * production + operational-simulated data (so all measurements and alerts
 * exercise the real operating book, never suppressed merely for being
 * simulated), holding out only seed scaffolding (`build-phase-fixture`) and
 * sandbox runs (scenario / rehearsal / stress / test-pollution). At
 * commencement it resolves to production-only automatically.
 *
 * This supersedes the inclusion semantics of D-PROVENANCE-FILTER-ENFORCEMENT
 * (which made `production-only` the permanent default and silently dropped the
 * build-phase operating data); the legitimate concern behind that decision —
 * scenario runs must not pollute reporting — is preserved exactly by the
 * sandbox classifier (`isSandboxProvenance`). Callers needing a strict
 * production view still request `production-only` explicitly.
 *
 * Process-local override hook: `setDefaultProvenanceModeOverride()` lets tests
 * pin the default; the override always wins when set.
 */
let DEFAULT_MODE_OVERRIDE: ProvenanceMode | undefined;

export function setDefaultProvenanceModeOverride(value: ProvenanceMode | undefined): void {
  DEFAULT_MODE_OVERRIDE = value;
}

export function defaultProvenanceMode(): ProvenanceMode {
  if (DEFAULT_MODE_OVERRIDE !== undefined) return DEFAULT_MODE_OVERRIDE;
  // operating-book is the canonical default (D-OPERATING-BOOK-PROVENANCE-
  // ARCHITECTURE PR3): production + operational-simulated in build phase,
  // production-only at commencement; seed scaffolding + sandbox always held out.
  return "operating-book";
}

/**
 * Resolve the default `ProvenanceFilter` for the current environment.
 * Returns a mode-only filter (no scenario / variant / lineage narrowing).
 * Consumers needing a tighter scope construct an explicit filter.
 */
export function defaultProvenanceFilter(): ProvenanceFilter {
  return { mode: defaultProvenanceMode() };
}

/**
 * The canonical operating-book filter (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE).
 * Every projection / GL / ALM / RWA / recon / dashboard fold that asks "what is
 * in the bank's live operating book?" must use this rather than a bespoke
 * `kind`-based check. See `ProvenanceMode = "operating-book"` for the semantics.
 */
export function operatingBookFilter(): ProvenanceFilter {
  return { mode: "operating-book" };
}

/**
 * Predicate form of `operatingBookFilter()` — true iff `event` is part of the
 * bank's live operating book under the current lifecycle phase. Replaces inline
 * `provenance?.kind === "build-phase-fixture"` checks and per-module
 * `isFixture()` helpers.
 */
export function eventInOperatingBook(event: Pick<Event, "provenance">): boolean {
  return eventMatchesProvenanceFilter(event, operatingBookFilter());
}

// ---------------------------------------------------------------------------
// Predicates — applied at runtime to every event during fold.
// ---------------------------------------------------------------------------

/**
 * True iff `event.provenance` satisfies `filter`. An event with no
 * provenance tag (legacy / pre-substrate; see `provenance.ts`) is treated
 * as `simulated` for filter purposes — consistent with the soft-tagger's
 * default and with the operating-model section of CLAUDE.md ("build phase
 * has only simulated data").
 */
export function eventMatchesProvenanceFilter(
  event: Pick<Event, "provenance">,
  filter: ProvenanceFilter,
): boolean {
  const tag: ProvenanceTag = event.provenance ?? UNTAGGED_AS_SIMULATED;

  // Mode check (primary discriminator).
  //
  // D-PROVENANCE-BUILD-PHASE-CLASS Slice 1 — production-only is lifecycle-aware:
  //   - During build phase, production-only ALSO admits `build-phase-fixture`
  //     events (real bank state authored pre-commencement: opening balances,
  //     founding capital, internal trades, build-phase positions). This is
  //     why BA-325 / BA-100 / other production-grade reports are non-empty
  //     before commencement-of-trading.
  //   - At commencement-of-trading, production-only admits only `production`.
  //   - `simulated` is rejected by production-only in BOTH phases.
  if (filter.mode === "production-only") {
    if (tag.kind === "production") {
      // always admitted
    } else if (tag.kind === "build-phase-fixture") {
      if (bankLifecyclePhase() !== "build-phase") return false;
    } else {
      // simulated
      return false;
    }
  }
  if (filter.mode === "simulated-only" && tag.kind !== "simulated") return false;

  // Operating-book inclusion (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE).
  //   - commencement: only `production` is in the book.
  //   - build-phase: everything the bank operates on EXCEPT seed-harness
  //     scaffolding (`build-phase-fixture`) and sandbox runs.
  if (filter.mode === "operating-book") {
    if (bankLifecyclePhase() === "commencement") {
      if (tag.kind !== "production") return false;
    } else {
      if (tag.kind === "build-phase-fixture") return false;
      if (isSandboxProvenance(tag)) return false;
    }
  }
  // `combined` accepts all kinds.

  // Scenario narrowing — only meaningful when the event is simulated. A
  // production event has no scenario, so a non-empty `scenarios` filter
  // implicitly excludes production events EVEN in combined mode (the
  // filter is read as "of these scenarios"). This matches the §5.1
  // contract: scenarios applies in `simulated-only` and `combined`.
  if (filter.scenarios && filter.scenarios.length > 0) {
    if (tag.kind === "production") return false;
    if (!tag.scenario || !filter.scenarios.includes(tag.scenario as ScenarioId)) return false;
  }

  // Variant narrowing — same logic as scenario.
  if (filter.variants && filter.variants.length > 0) {
    if (!tag.variant || !filter.variants.includes(tag.variant as VariantId)) return false;
  }

  // Source-lineage narrowing — applies to both kinds.
  if (filter.sourceLineages && filter.sourceLineages.length > 0) {
    if (!filter.sourceLineages.includes(tag.sourceLineage as SourceLineageRef)) return false;
  }

  return true;
}

/**
 * Default provenance for legacy events lacking a `provenance` field.
 * Mirrors `PRE_SUBSTRATE_BACKFILL_TAG` semantically (kind=simulated,
 * scenario=pre-substrate-build-phase) so filter behaviour matches the
 * post-soft-tagger persisted state. Re-declared inline (rather than
 * imported) to avoid a circular dep with the event-store layer.
 */
const UNTAGGED_AS_SIMULATED: ProvenanceTag = {
  kind: "simulated" as ProvenanceKind,
  scenario: "pre-substrate-build-phase",
  sourceLineage: "pre-substrate-backfill",
};

// ---------------------------------------------------------------------------
// Snapshot-key digest — pack §5.1 third axis.
// ---------------------------------------------------------------------------

/**
 * Stable structural digest of a `ProvenanceFilter` for use in the
 * effective snapshot stream key. The digest:
 *   - is deterministic given the same logical filter (sorted axes;
 *     no encoding sensitivity),
 *   - distinguishes filters that produce different result sets,
 *   - collides on filters that produce the same result set (e.g.
 *     scenarios=[] is treated identically to omitted scenarios).
 *
 * Output is a 12-character lowercase-hex prefix of SHA-256 of the
 * canonicalised JSON. Twelve characters = 48 bits of namespace, ample
 * for any plausible per-bank filter-set cardinality and short enough
 * to keep stream keys readable in logs.
 */
export function provenanceFilterDigest(filter: ProvenanceFilter): string {
  const canonical = canonicaliseFilter(filter);
  const json = JSON.stringify(canonical);
  return createHash("sha256").update(json).digest("hex").slice(0, 12);
}

function canonicaliseFilter(filter: ProvenanceFilter): Record<string, unknown> {
  const out: Record<string, unknown> = { mode: filter.mode };
  if (filter.scenarios && filter.scenarios.length > 0) {
    out.scenarios = [...filter.scenarios].slice().sort();
  }
  if (filter.variants && filter.variants.length > 0) {
    out.variants = [...filter.variants].slice().sort();
  }
  if (filter.sourceLineages && filter.sourceLineages.length > 0) {
    out.sourceLineages = [...filter.sourceLineages].slice().sort();
  }
  return out;
}

/**
 * Derive the *effective* stream key the runtime passes to the EventStore
 * snapshot APIs. The base stream key (the consumer's logical
 * `<entity>|<aggregate>` per the D-EVENT-STORE-SCALING Q4 convention) is
 * suffixed with `#prov=<digest>` so a snapshot computed under one filter
 * never serves a request for another.
 *
 * This isolates the filter dimension to the projection-runtime layer
 * without requiring a schema change in the EventStore — the snapshots
 * table remains keyed on `(stream_key, as_of, upto_sequence)`; the
 * digest rides inside `stream_key`.
 */
export function effectiveStreamKey(baseStreamKey: string, filter: ProvenanceFilter): string {
  return `${baseStreamKey}#prov=${provenanceFilterDigest(filter)}`;
}
