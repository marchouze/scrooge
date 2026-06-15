// platform/conduct/fx-bestex-policy-schedule.ts
//
// The CCO's founding best-execution tolerance schedule for the FX OTC vanilla
// product (prd:bank:fx:otc-vanilla) — BESTEX-SCHED-2026-001.
//
// ## Seat judgement (Zara, Chief Compliance Officer, governance)
//
// The tolerance bands below are a conduct-committee decision, not engineering
// improvisation. Rationale for the build-phase calibration:
//
//   - FX-spot 10 bps — the most liquid, continuously-quoted instrument class;
//     interbank USD/ZAR spot spreads are tight, so a >10 bps adverse deviation
//     from reference is a genuine execution-quality question.
//   - FX-forward 15 bps — forward points add a term-structure component with
//     wider quoting; tolerance is wider than spot but still inside normal
//     institutional dealing ranges.
//   - FX-swap 20 bps — two-leg pricing (near + far) compounds quoting noise.
//   - NDF 25 bps — offshore-fixing instruments with the widest dealing
//     spreads in the in-scope set.
//   - default 20 bps — any unmapped instrument class stays surveilled (no
//     trade escapes evaluation because its taxonomy is unmapped).
//
// These ratify the build-phase constants the surveillance previously carried
// in code (platform/conduct/fx-trade-conduct-evaluation.ts), so publishing the
// schedule changes OWNERSHIP (conduct committee, via event of record) without
// flipping any historical verdict.
//
// SCOPE SEPARATION: this schedule owns the TOLERANCE. The REFERENCE basis is
// `executed-rate` until the separate tracked gap
// fx-best-execution-reference-benchmark (Rohan, Markets risk/quant engineer,
// engineering) lands an independent benchmark feed — that gap stays OPEN.
//
// Authority: FAIS Act 37/2002 §16 (best execution) + §8D; FSCA Conduct
//   Standard 3 of 2018; FSB Treating Customers Fairly 2012;
//   D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH; D-MARKET-CONDUCT.
// Author: Zara (Chief Compliance Officer, governance).

import {
  type BestExecutionPolicySchedulePayload,
  makeBestExecutionPolicySchedule,
} from "../event-store/event-types/conduct";
import { provenanceForEmit } from "../event-store/provenance";
import type { EventStore } from "../event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";

const CCO_ACTOR = {
  type: "service" as const,
  id: "agent:zara:bestex-policy-schedule",
};

export const BESTEX_SCHEDULE_CITATIONS: readonly string[] = [
  "FAIS-ACT-37-2002-S16",
  "FAIS-ACT-37-2002-S8D",
  "CS-3-2018",
  "FSB-TCF-2012",
  "D-MARKET-CONDUCT",
  "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
  "D-FX-HELD-DIMS-SEAT-SWEEP",
];

/** Founding CCO schedule — see header for the per-band rationale. */
export const BESTEX_SCHEDULE_2026_001: BestExecutionPolicySchedulePayload = {
  scheduleId: "BESTEX-SCHED-2026-001",
  productScope: "prd:bank:fx:otc-vanilla",
  toleranceBands: [
    { instrumentClass: "FX-spot", maxAdverseSpreadBps: 10 },
    { instrumentClass: "FX-forward", maxAdverseSpreadBps: 15 },
    { instrumentClass: "FX-swap", maxAdverseSpreadBps: 20 },
    { instrumentClass: "NDF", maxAdverseSpreadBps: 25 },
  ],
  defaultToleranceBps: 20,
  referenceRateBasis: "executed-rate",
  effectiveFrom: "2026-06-12T06:00:00.000Z",
  reviewCadence:
    "annual conduct-committee review at the CCO's scheduled tick; earlier on the " +
    "independent-benchmark feed landing (gap fx-best-execution-reference-benchmark), " +
    "a RAS conduct-line breach, or a material market-structure change",
  supersedes: null,
  publishedBy: "Zara (Chief Compliance Officer, governance)",
  notes:
    "Founding schedule: ratifies the build-phase tolerance constants as a conduct-committee " +
    "decision of record (spot tighter than forward; two-leg and offshore-fixing classes wider). " +
    "Reference basis stays executed-rate until the independent benchmark feed lands — the " +
    "schedule owns TOLERANCE; gap fx-best-execution-reference-benchmark owns REFERENCE.",
};

export interface PublishScheduleResult {
  readonly published: boolean;
  readonly skipped: boolean;
  /** event_id of the schedule on the store (existing or newly appended). */
  readonly scheduleEventId: string;
}

/**
 * Publish the founding CCO best-execution tolerance schedule. Idempotent:
 * skips when a BestExecutionPolicySchedule with the same scheduleId already
 * exists on the store.
 */
export function publishFxBestExecutionPolicySchedule(
  store: EventStore,
  opts: { asOf: string },
): PublishScheduleResult {
  for (const e of store.replay({ type: "BestExecutionPolicySchedule" })) {
    const p = e.payload as { scheduleId?: unknown };
    if (p.scheduleId === BESTEX_SCHEDULE_2026_001.scheduleId) {
      return { published: false, skipped: true, scheduleEventId: e.event_id };
    }
  }

  const event = makeBestExecutionPolicySchedule({
    asOf: opts.asOf,
    entity: ENTITY,
    actor: CCO_ACTOR,
    citations: [...BESTEX_SCHEDULE_CITATIONS],
    payload: BESTEX_SCHEDULE_2026_001,
  });
  store.append({
    ...event,
    // Sanctioned category-policy derivation (governance → production): a
    // CCO-published tolerance schedule is a real conduct-committee
    // commitment, not simulated market activity. Attached explicitly so the
    // tag never depends on a soft-tagger pass racing an older code version.
    provenance: provenanceForEmit("BestExecutionPolicySchedule", {
      sourceLineage: "cco:bestex-policy-schedule",
    }),
  });

  return { published: true, skipped: false, scheduleEventId: event.event_id };
}

// ---------------------------------------------------------------------------
// BESTEX-SCHED-2026-002 — FTP mid-rate benchmark reference (2026-06-15)
//
// Supersedes BESTEX-SCHED-2026-001. Key change: `referenceRateBasis` is
// promoted from "executed-rate" to "independent-benchmark", wiring the ZAR FTP
// curve short-end (ON/1D rate from the latest FtpCurvePublished event) as the
// reference benchmark for best-execution spread measurement (FAIS §16).
//
// Tolerance bands are UNCHANGED from v1 — the scope-separation discipline
// holds: this schedule retains ownership of TOLERANCE; the FTP mid-rate feed
// is now the REFERENCE.
//
// Build-phase constraint: the FTP curve (Ravi, Treasury/ALM Engineer,
// engineering) is a ZAR money-market curve, not a live FX mid-rate feed. Using
// the ZAR ON rate as a reference when the executed rate is an FX exchange rate
// is a directional proxy only — the spread is not directly comparable in units.
// The tracked deferred gap `fx-best-ex-ftp-live-feed` (Rohan, Markets
// risk/quant engineer, engineering) owns the build-out of a real FX mid-rate
// feed; until it lands, this schedule records the best available independent
// benchmark while making the build-phase limitation explicit in the notes.
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//   D-NPA-GATE-POLICY-REDESIGN; FAIS Act 37/2002 §16 (best execution duty);
//   FSCA Conduct Standard 3 of 2018; FSB TCF 2012 outcomes 4–5.
// Author: Zara (Chief Compliance Officer, governance).
// ---------------------------------------------------------------------------

/** Citations for the v2 FTP-benchmark schedule. */
export const BESTEX_SCHEDULE_V2_CITATIONS: readonly string[] = [
  ...BESTEX_SCHEDULE_CITATIONS,
  "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
  "D-NPA-GATE-POLICY-REDESIGN",
];

/**
 * BESTEX-SCHED-2026-002 — FTP mid-rate as independent benchmark reference.
 * Supersedes BESTEX-SCHED-2026-001.
 *
 * The `supersedes` field is populated at publish time with the event_id of the
 * BESTEX-SCHED-2026-001 event; at construction time it is set to the sentinel
 * string "BESTEX-SCHED-2026-001" and the publisher resolves it to the actual
 * event_id before appending.
 */
export function buildBestexSchedule2026002(
  supersedes: string | null,
): BestExecutionPolicySchedulePayload {
  return {
    scheduleId: "BESTEX-SCHED-2026-002",
    productScope: "prd:bank:fx:otc-vanilla",
    // Tolerance bands unchanged from v1 — per-class rationale in file header.
    toleranceBands: [
      { instrumentClass: "FX-spot", maxAdverseSpreadBps: 10 },
      { instrumentClass: "FX-forward", maxAdverseSpreadBps: 15 },
      { instrumentClass: "FX-swap", maxAdverseSpreadBps: 20 },
      { instrumentClass: "NDF", maxAdverseSpreadBps: 25 },
    ],
    defaultToleranceBps: 20,
    // KEY CHANGE from v1: FTP mid-rate is now the independent reference.
    referenceRateBasis: "independent-benchmark",
    effectiveFrom: "2026-06-15T00:00:00.000Z",
    reviewCadence:
      "quarterly conduct-committee review at the CCO's scheduled tick; " +
      "earlier on a live FX mid-rate feed landing (gap fx-best-ex-ftp-live-feed, Rohan), " +
      "a RAS conduct-line breach, or a material market-structure change. " +
      "T+2 standard settlement window applies for vanilla OTC FX trades " +
      "(execution window: standard T+2).",
    supersedes,
    publishedBy: "Zara (Chief Compliance Officer, governance)",
    notes:
      "v2 schedule: promotes referenceRateBasis from executed-rate to independent-benchmark " +
      "(ZAR FTP curve ON/1D rate from FtpCurvePublished events — Ravi's treasury system). " +
      "Build-phase proxy: the FTP curve is a ZAR money-market rate (≈8–10% p.a.) not a live " +
      "FX mid-rate; spread measurement is directional until gap fx-best-ex-ftp-live-feed lands. " +
      "Product scope institutional counterparties only (D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY). " +
      "FAIS appropriateness for non-institutional is out-of-scope at v1.0.",
  };
}

export interface PublishScheduleV2Result {
  readonly published: boolean;
  readonly skipped: boolean;
  readonly scheduleEventId: string;
  /** event_id of the v1 schedule this supersedes (null if v1 not found). */
  readonly supersededEventId: string | null;
}

/**
 * Publish BESTEX-SCHED-2026-002 (FTP mid-rate independent benchmark).
 * Idempotent: skips when the schedule already exists on the store.
 * Resolves the event_id of BESTEX-SCHED-2026-001 to populate `supersedes`.
 *
 * GATE: the v1 schedule (BESTEX-SCHED-2026-001) must already be published
 * before v2 can be emitted — over-closure is the failure mode.
 */
export function publishFxBestExScheduleV2(
  store: EventStore,
  opts: { asOf: string },
): PublishScheduleV2Result {
  let v1EventId: string | null = null;

  for (const e of store.replay({ type: "BestExecutionPolicySchedule" })) {
    const p = e.payload as { scheduleId?: unknown };
    if (p.scheduleId === "BESTEX-SCHED-2026-002") {
      return {
        published: false,
        skipped: true,
        scheduleEventId: e.event_id,
        supersededEventId: v1EventId,
      };
    }
    if (p.scheduleId === "BESTEX-SCHED-2026-001") {
      v1EventId = e.event_id;
    }
  }

  const payload = buildBestexSchedule2026002(v1EventId);
  const event = makeBestExecutionPolicySchedule({
    asOf: opts.asOf,
    entity: ENTITY,
    actor: CCO_ACTOR,
    citations: [...BESTEX_SCHEDULE_V2_CITATIONS],
    payload,
  });

  store.append({
    ...event,
    provenance: provenanceForEmit("BestExecutionPolicySchedule", {
      sourceLineage: "cco:bestex-policy-schedule",
    }),
  });

  return {
    published: true,
    skipped: false,
    scheduleEventId: event.event_id,
    supersededEventId: v1EventId,
  };
}
