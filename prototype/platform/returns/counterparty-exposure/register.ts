// platform/returns/counterparty-exposure/register.ts
//
// M3 Slice 10 — Counterparty-exposure register generator.
//
// Derives the counterparty-exposure register from event replay of
// CounterpartyExposureCalculated events. Follows the M3 pattern: pure
// function, event-store input, typed output (Principle 1).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   Banks Act 94 of 1990 §73 (large exposures);
//   RRB Regulation 23 (credit-risk large exposure limits);
//   BCBS 283 (large exposures framework, 2014);
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
//
// Author: Atlas (Principal Software Engineer, engineering)

import type { CounterpartyExposureCalculatedPayload } from "../../event-store/event-types/counterparty-exposure";
import type { EventStore } from "../../event-store/store";
import type {
  CounterpartyExposureMetrics,
  CounterpartyExposureRegister,
  CounterpartyExposureRegisterEntry,
  CounterpartyExposureSnapshot,
  ExposureRegisterKey,
  ExposureType,
} from "./types";

// ---------------------------------------------------------------------------
// Generator input
// ---------------------------------------------------------------------------

export interface CounterpartyExposureRegisterInput {
  /**
   * ISO 8601 — derive the register as at this timestamp.
   * Events with `as_of` <= asOf are included.
   */
  readonly asOf: string;
  /** Event store to query. */
  readonly eventStore: EventStore;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp Date.parse to finite; fall back to 0. */
function parseTs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Build the register key. */
function registerKey(counterpartyId: string, exposureType: ExposureType): ExposureRegisterKey {
  return `${counterpartyId}:${exposureType}` as ExposureRegisterKey;
}

// ---------------------------------------------------------------------------
// Register generator
// ---------------------------------------------------------------------------

/**
 * Derive the counterparty-exposure register as-at `asOf`.
 *
 * Algorithm:
 *   1. Replay all CounterpartyExposureCalculated events with as_of <= asOf.
 *   2. Group by `${counterpartyId}:${exposureType}` key.
 *   3. Within each group, keep all snapshots sorted newest-first; expose
 *      `latest` as the snapshot with the greatest `calculatedAt`.
 *   4. Build aggregate metrics.
 *
 * Principle 1 compliance: all cells derive from event replay only.
 * No stored aggregates are read.
 */
export function deriveCounterpartyExposureRegister(
  input: CounterpartyExposureRegisterInput,
): CounterpartyExposureRegister {
  const { asOf, eventStore } = input;
  const asOfTs = parseTs(asOf);

  // Map from register key → list of snapshots (unsorted during scan).
  const groups = new Map<ExposureRegisterKey, CounterpartyExposureSnapshot[]>();

  for (const event of eventStore.replay({ type: "CounterpartyExposureCalculated" })) {
    // Temporal filter: exclude events after asOf.
    if (parseTs(event.as_of) > asOfTs) continue;

    const p = event.payload as CounterpartyExposureCalculatedPayload;
    const key = registerKey(p.counterpartyId, p.exposureType);

    const snapshot: CounterpartyExposureSnapshot = {
      counterpartyId: p.counterpartyId,
      exposureType: p.exposureType,
      grossExposure: p.grossExposure,
      netExposure: p.netExposure,
      nettingAgreementId: p.nettingAgreementId,
      collateralHeld: p.collateralHeld,
      uncoveredExposure: p.uncoveredExposure,
      limitUtilisationPct: p.limitUtilisationPct,
      breached: p.breached,
      calculatedAt: p.calculatedAt,
    };

    const arr = groups.get(key) ?? [];
    arr.push(snapshot);
    groups.set(key, arr);
  }

  // Build entries — sort each group newest-first, expose latest.
  const entries: CounterpartyExposureRegisterEntry[] = [];

  for (const [key, snapshots] of groups) {
    // Sort newest-first by calculatedAt.
    snapshots.sort((a, b) => parseTs(b.calculatedAt) - parseTs(a.calculatedAt));

    const latest = snapshots[0];
    // latest is always defined here since groups only forms from non-empty push.
    if (!latest) continue;

    entries.push({
      key,
      latest,
      calculationCount: snapshots.length,
      history: snapshots,
    });
  }

  // Sort entries for deterministic output: by counterpartyId then exposureType.
  entries.sort((a, b) => {
    const cpCmp = a.latest.counterpartyId.localeCompare(b.latest.counterpartyId);
    if (cpCmp !== 0) return cpCmp;
    return a.latest.exposureType.localeCompare(b.latest.exposureType);
  });

  // Breached subset.
  const breached = entries.filter((e) => e.latest.breached);

  // Aggregate metrics.
  const metrics = buildMetrics(entries);

  return {
    asOf,
    entries,
    breached,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Metrics builder
// ---------------------------------------------------------------------------

function buildMetrics(entries: readonly CounterpartyExposureRegisterEntry[]): CounterpartyExposureMetrics {
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      breachedCount: 0,
      distinctCounterparties: 0,
      exposureTypesPresent: [],
      totalUncoveredExposure: 0,
      maxLimitUtilisationPct: 0,
    };
  }

  const counterpartySet = new Set<string>();
  const exposureTypeSet = new Set<ExposureType>();
  let totalUncovered = 0;
  let maxUtil = 0;
  let breachedCount = 0;

  for (const entry of entries) {
    const { latest } = entry;
    counterpartySet.add(latest.counterpartyId);
    exposureTypeSet.add(latest.exposureType);
    totalUncovered += latest.uncoveredExposure;
    if (latest.limitUtilisationPct > maxUtil) maxUtil = latest.limitUtilisationPct;
    if (latest.breached) breachedCount += 1;
  }

  return {
    totalEntries: entries.length,
    breachedCount,
    distinctCounterparties: counterpartySet.size,
    exposureTypesPresent: [...exposureTypeSet].sort() as ExposureType[],
    totalUncoveredExposure: totalUncovered,
    maxLimitUtilisationPct: maxUtil,
  };
}
