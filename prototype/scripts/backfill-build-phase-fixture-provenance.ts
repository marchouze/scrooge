// scripts/backfill-build-phase-fixture-provenance.ts
//
// D-PROVENANCE-BUILD-PHASE-CLASS Slice 2 — backfill of build-phase
// fixture events from `simulated` → `build-phase-fixture`.
//
// Why this script exists
// ----------------------
// Slice 1 (PR #727) introduced the third `ProvenanceKind` value
// `build-phase-fixture` and made the default provenance filter
// lifecycle-aware (production-only ALSO admits build-phase-fixture rows
// during the build phase). At that point no event in the live store was
// yet tagged `build-phase-fixture`. This script performs the one-shot
// idempotent re-tag so M2 returns (BA 110, BA 350, BA 100, IFRS
// statements, dashboard reporting tiles) populate during the build phase
// under the production-only filter.
//
// Identification rule (per decision card)
// ---------------------------------------
// A `simulated`-tagged event is identified as a build-phase fixture iff
// its `provenance.sourceLineage` matches the BUILD_PHASE_FIXTURE_LINEAGES
// allowlist below. The allowlist is:
//
//   - `pre-substrate-backfill`              (Slice-6 soft-tagger default)
//   - `synthetic-bank-seed:<vN>`            (Atlas's synthetic seed corpus)
//   - `sarb-fixing-fixture:<...>`           (SARB FX fixing build-phase fixture)
//
// Scenario / rehearsal / counterfactual lineages stay under `simulated`
// and are NOT touched by this backfill (decision-card §"Backfill needs").
// Specifically excluded:
//
//   - `scenario-runner:*`                   (scenario rehearsal emissions)
//   - `agent-runtime:*`                     (agent-runtime simulated runs)
//   - `script:run-*`                        (one-shot rehearsal scripts)
//   - `recon-harness`                       (Vera synthetic events)
//   - `test-fixture` / `bun-test-runner:*`  (test-only fixtures)
//
// Mechanism (Principle 1 compliant)
// ---------------------------------
// For each identified row the script:
//
//   1. Emits a typed `ProvenanceReclassified` audit event (kind:
//      `production`, sourceLineage: `backfill:build-phase-fixture-
//      provenance`) recording the prior + new envelope tag, the
//      authorising decision (`D-PROVENANCE-BUILD-PHASE-CLASS`), and
//      a `runRef` clustering all rows reclassified in this run.
//   2. Calls `eventStore.reclassifyProvenance(eventId, newTag)`, which
//      mirrors the existing Slice-6 soft-tagger pattern (envelope-axis
//      UPDATE; payload + actor + citations + sequence unchanged).
//
// Idempotency
// -----------
// `reclassifyProvenance` returns `{reclassified: false, reason:
// "already-at-target"}` when the row is already at `build-phase-fixture`,
// in which case no audit event is emitted. Running the script twice
// produces a 0-row second pass.
//
// Cross-reference rule
// --------------------
// The `ProvenanceReclassified` audit event is tagged `production` and
// references the (post-reclassification) `build-phase-fixture` target via
// citation. `production → build-phase-fixture` is permitted during the
// build phase (decision card §"Cross-reference rule extends naturally");
// `production → simulated` would be forbidden, which is why the audit
// event is emitted AFTER the UPDATE applies (target is `build-phase-
// fixture` at emit time).
//
// Tests + CI safety
// -----------------
// The script runs against whatever event store the composition root
// resolves (typically `~/.local/share/bank/event.db` via the shared
// home-store resolver). Unit tests build their own throwaway store via
// the EventStore constructor pointing at a tmpfile; CI test runs do NOT
// invoke this script (no `bun run ci` entry).
//
// Usage
// -----
//
//   bun run scripts/backfill-build-phase-fixture-provenance.ts
//
//   # dry-run: report counts without applying
//   bun run scripts/backfill-build-phase-fixture-provenance.ts --dry-run
//
// Exit codes: 0 always (the soft-tagger pattern). The script reports
// counts via stdout and logger.info; a `--dry-run` flag prints the
// would-apply totals without mutating the store.
//
// Authority
// ---------
//   - D-PROVENANCE-BUILD-PHASE-CLASS (CEO-approved 2026-05-22,
//     event `138a7570-be2a-4d0a-8762-c060c345ff15`)
//   - D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10)
//   - Principle 1 — events are the only source of truth
//
// Author: Atlas (Records & Documents Engineer, engineering — substrate)

import { applyDispatchEventDbResolution } from "./dispatch/resolve-event-db";

// Adopt the shared home-store before importing composition (so the
// backfill operates on the canonical bank event log).
applyDispatchEventDbResolution();

import { eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import { newEventId } from "../platform/core/types";
import { makeProvenanceReclassified } from "../platform/event-store/event-types/provenance-reclassified";
import {
  type ProvenanceTag,
  buildPhaseFixtureTag,
  productionTag,
} from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Identification rule
// ---------------------------------------------------------------------------

/**
 * Static allowlist of `sourceLineage` literal values whose `simulated`
 * events are reclassified to `build-phase-fixture`. Augmented by
 * BUILD_PHASE_FIXTURE_LINEAGE_PATTERNS below for parameterised tokens.
 *
 * This list is intentionally small + audited. Adding a new entry is a
 * Vera review item — every entry must be a genuine build-phase fixture
 * lineage (real bank state, not scenario / rehearsal / counterfactual).
 */
export const BUILD_PHASE_FIXTURE_LINEAGES: ReadonlyArray<string> = ["pre-substrate-backfill"];

/**
 * Parameterised patterns. Tokens of the form `<prefix>:<suffix>` that
 * match these regexes are treated as build-phase fixtures.
 */
export const BUILD_PHASE_FIXTURE_LINEAGE_PATTERNS: ReadonlyArray<RegExp> = [
  /^synthetic-bank-seed:v\d+$/,
  /^sarb-fixing-fixture(?::[a-zA-Z0-9_./:-]+)?$/,
];

/**
 * True iff `sourceLineage` is a recognised build-phase fixture lineage.
 * Exported so the unit test can assert the allowlist rule directly.
 */
export function isBuildPhaseFixtureLineage(sourceLineage: string): boolean {
  if (BUILD_PHASE_FIXTURE_LINEAGES.includes(sourceLineage)) return true;
  return BUILD_PHASE_FIXTURE_LINEAGE_PATTERNS.some((re) => re.test(sourceLineage));
}

// ---------------------------------------------------------------------------
// Reclassification orchestrator
// ---------------------------------------------------------------------------

export interface BackfillResult {
  readonly scanned: number;
  readonly candidates: number;
  readonly reclassified: number;
  readonly skippedAlreadyAtTarget: number;
  readonly auditEventsEmitted: number;
  readonly byEventType: Readonly<Record<string, number>>;
}

interface BackfillOpts {
  readonly dryRun?: boolean;
  /** Override the run identifier; default is the current ISO timestamp. */
  readonly runRef?: string;
}

/**
 * Run the backfill against the composition-root event store. Returns
 * a structured result so callers (and tests) can assert on the counts.
 *
 * Idempotency: re-running this against an already-backfilled store
 * yields `reclassified === 0` and emits zero audit events.
 */
export function runBackfill(opts: BackfillOpts = {}): BackfillResult {
  const dryRun = opts.dryRun ?? false;
  const runRef =
    opts.runRef ?? `backfill:build-phase-fixture-provenance:${new Date().toISOString()}`;

  const byEventType: Record<string, number> = {};
  let scanned = 0;
  let candidates = 0;
  let reclassified = 0;
  let skippedAlreadyAtTarget = 0;
  let auditEventsEmitted = 0;

  for (const e of eventStore.replay()) {
    scanned += 1;
    const tag = e.provenance;
    if (!tag) continue;
    if (tag.kind !== "simulated") continue;
    if (!isBuildPhaseFixtureLineage(tag.sourceLineage)) continue;
    candidates += 1;
    byEventType[e.type] = (byEventType[e.type] ?? 0) + 1;

    if (dryRun) continue;

    const newTag: ProvenanceTag = buildPhaseFixtureTag({
      sourceLineage: tag.sourceLineage,
      ...(tag.variant !== undefined ? { variant: tag.variant } : {}),
      ...(tag.tags !== undefined ? { tags: tag.tags } : {}),
    });

    const result = eventStore.reclassifyProvenance(e.event_id, newTag);
    if (!result.reclassified) {
      if (result.reason === "already-at-target") skippedAlreadyAtTarget += 1;
      continue;
    }
    reclassified += 1;

    // Emit the typed audit event AFTER the UPDATE so the cross-reference
    // rule (production -> simulated is forbidden) is not tripped — at
    // emit time the target row is `build-phase-fixture`, which is a
    // permitted cite target for `production`.
    const auditEvent = makeProvenanceReclassified({
      eventId: newEventId(),
      asOf: new Date().toISOString(),
      entity: BANK_ZA_001,
      actor: { type: "system", id: "atlas@bank" },
      citations: ["D-PROVENANCE-BUILD-PHASE-CLASS", "D-DATA-PROVENANCE-SUBSTRATE", e.event_id],
      payload: {
        targetEventId: e.event_id,
        targetEventType: e.type,
        priorKind: result.priorTag.kind,
        priorSourceLineage: result.priorTag.sourceLineage,
        ...(result.priorTag.scenario !== undefined
          ? { priorScenario: result.priorTag.scenario }
          : {}),
        newKind: newTag.kind,
        newSourceLineage: newTag.sourceLineage,
        decisionRef: "D-PROVENANCE-BUILD-PHASE-CLASS",
        reclassificationReason:
          "build-phase-fixture identified by sourceLineage allowlist — Slice 2 backfill " +
          "(real bank state authored pre-commencement; not scenario/rehearsal data)",
        runRef,
      },
      // Tag the audit event itself as `production` (real architectural
      // commitment to audit log; sourceLineage matches `backfill:*` pattern).
    });
    // Explicit provenance for the audit event.
    const auditEventWithProvenance = {
      ...auditEvent,
      provenance: productionTag({ sourceLineage: runRef }),
    };
    eventStore.append(auditEventWithProvenance);
    auditEventsEmitted += 1;
  }

  return {
    scanned,
    candidates,
    reclassified,
    skippedAlreadyAtTarget,
    auditEventsEmitted,
    byEventType,
  };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function main(argv: ReadonlyArray<string>): number {
  const dryRun = argv.includes("--dry-run");

  const beforeCounts = eventStore.countByProvenanceKind();
  logger.info(
    { mode: dryRun ? "dry-run" : "apply", ...beforeCounts },
    "backfill-build-phase-fixture-provenance — pre-counts",
  );

  const result = runBackfill({ dryRun });

  const afterCounts = eventStore.countByProvenanceKind();

  logger.info(
    {
      mode: dryRun ? "dry-run" : "apply",
      scanned: result.scanned,
      candidates: result.candidates,
      reclassified: result.reclassified,
      skippedAlreadyAtTarget: result.skippedAlreadyAtTarget,
      auditEventsEmitted: result.auditEventsEmitted,
      ...afterCounts,
    },
    dryRun
      ? "backfill-build-phase-fixture-provenance — dry-run summary (no events mutated)"
      : "backfill-build-phase-fixture-provenance — apply summary",
  );

  // Human-readable top event types reclassified.
  const top = Object.entries(result.byEventType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);
  for (const [type, count] of top) {
    logger.info({ count, type }, "backfill-build-phase-fixture-provenance — by event type");
  }

  return 0;
}

// Only run main when invoked directly, NOT when imported (tests import).
if (import.meta.path === Bun.main) {
  process.exit(main(process.argv.slice(2)));
}
