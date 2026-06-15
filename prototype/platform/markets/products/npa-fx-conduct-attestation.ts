// platform/markets/products/npa-fx-conduct-attestation.ts
//
// FX OTC umbrella NPA — conduct dimension attestation (CCO verification).
//
// The per-dimension verification pass v2 (#1213) correctly HELD conduct
// design-attested: the markets conduct-surveillance handler was registered but
// materially inert (0 BestExecutionVerified / 0 FaisClassificationSuitability-
// Checked on 44 booked FX trades) and the gateway suitability check was an
// approve-always stub. This pass promotes conduct to implementation-attested
// ONLY after that gap is genuinely closed at code level:
//
//   1. Surveillance now fires reliably — the store-scanning sweep
//      rohan:conduct-surveillance-sweep (platform/conduct/fx-conduct-
//      surveillance-sweep.ts) is registered on a daily scheduled cadence and the
//      one-shot backfill driver covers the 44 historical trades, so best-
//      execution + FAIS-suitability + conflict surveillance are events of record
//      over the whole live book (verified by the canonical-store before/after).
//   2. FAIS-suitability genuinely fires — the FX counterparties are classified
//      market-counterparty (CCO, platform/conduct/fx-counterparty-fais-
//      classification.ts), so the §8D suitability check produces a positive
//      recorded control rather than skipping on an unclassified counterparty.
//   3. Conduct posture set — the gateway suitability check is now ENFORCED
//      (rejects retail-client + fail-closed on unclassified) rather than an
//      approve-always stub; institutional/professional scope keeps appropriate-
//      ness light while the FAIS §16 / TCF best-execution duty binds on every
//      trade.
//
// Residuals are tracked as ProductDeferredGap entries (owner + trigger +
// citations enforced at write-time; recon:npa-deferred-gap-tracking inventories
// them) — never hidden.
//
// Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
//   delegation 2026-06-11); D-MARKET-CONDUCT; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; FAIS Act 37/2002 §§16–17, §8D.
// Author: Zara (Chief Compliance Officer, governance).

import { resolveBestExecutionSchedule } from "../../conduct/fx-trade-conduct-evaluation";
import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
  productDeferredGapSchema,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const CONDUCT_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the pass-2 conduct HOLD (2026-06-11T18:00) so latest-wins folds
// pick up the promotion.
export const CONDUCT_AS_OF = "2026-06-11T20:00:00.000Z";

const CONDUCT_ACTOR = {
  type: "service" as const,
  id: "agent:zara:npa-conduct-attestation",
};

const CONDUCT_CITATIONS = [
  "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

export const CONDUCT_CITATION_CHAIN: readonly string[] = [
  ...CONDUCT_CITATIONS,
  "D-MARKET-CONDUCT",
  "ORG-MK-01",
  "FAIS-ACT-37-2002-S16",
  "FAIS-ACT-37-2002-S8D",
  "platform/conduct/fx-conduct-surveillance-sweep.ts",
  "platform/conduct/fx-trade-conduct-evaluation.ts",
  "runtime/agents/rohan-conduct-surveillance-sweep.ts",
  "dashboard/markets-fx-gateway.ts",
];

export const CONDUCT_DEFERRED_GAPS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-best-execution-policy-schedule",
    title:
      "Best-execution tolerance bps are fixed build-phase constants (BE_TOLERANCE_BY_ASSET_CLASS); production drives them from a published BestExecutionPolicySchedule event so the conduct committee owns the thresholds.",
    owner: "Zara (Chief Compliance Officer, governance)",
    targetTrigger: "conduct committee publishes a BestExecutionPolicySchedule event of record",
    citations: ["D-MARKET-CONDUCT", "platform/conduct/fx-trade-conduct-evaluation.ts"],
  },
  {
    gapId: "fx-best-execution-reference-benchmark",
    title:
      "Best-execution spread is measured against the executed rate as reference (single price source → 0 bps) until an independent benchmark/FTP-curve feed lands; the verdict is structurally 'verified' for in-tolerance trades but cannot yet detect off-market execution.",
    owner: "Rohan (Markets risk/quant engineer, engineering)",
    targetTrigger:
      "independent FX benchmark / mid-rate feed wired as the best-execution reference (closes fx-forward-curve-live-feed dependency)",
    citations: ["FAIS-ACT-37-2002-S16", "platform/conduct/fx-trade-conduct-evaluation.ts"],
  },
  {
    gapId: "fx-edd-str-substrate",
    title:
      "EDD workflow and STR/CTR/TPR conduct-reporting substrate are design-only; they bind at licence-day when real counterparties exist and FIC registration is live.",
    owner: "Zara (Chief Compliance Officer, governance)",
    targetTrigger: "licence-day FIC registration + real-counterparty onboarding",
    citations: ["ORG-FC-02", "ORG-FC-08"],
  },
];

export interface ConductAttestationResult {
  readonly promoted: boolean;
  readonly skipped: boolean;
}

/**
 * Emit the conduct dimension promotion to implementation-attested with the
 * tracked deferred gaps. Idempotent: skips if a conduct implementation-attested
 * event at or after CONDUCT_AS_OF already exists for the product.
 */
export function runFxConductAttestation(store: EventStore): ConductAttestationResult {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === CONDUCT_PRODUCT_ID &&
      p.dimension === "conduct" &&
      p.result === "implementation-attested" &&
      ev.as_of >= CONDUCT_AS_OF
    ) {
      return { promoted: false, skipped: true };
    }
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${CONDUCT_PRODUCT_ID}:conduct:surveillance-wiring`,
    tags: ["npa-gate", "dimension-upgrade", "conduct", CONDUCT_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: CONDUCT_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: CONDUCT_ACTOR,
      citations: [...CONDUCT_CITATIONS, "dimension:conduct"],
      payload: {
        productId: CONDUCT_PRODUCT_ID,
        dimension: "conduct",
        result: "implementation-attested",
        citationChain: [...CONDUCT_CITATION_CHAIN],
        deferredGaps: CONDUCT_DEFERRED_GAPS.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return { promoted: true, skipped: false };
}

// ---------------------------------------------------------------------------
// fx-best-execution-policy-schedule gap closure (2026-06-12)
//
// The gap's targetTrigger — "conduct committee publishes a
// BestExecutionPolicySchedule event of record" — is satisfied once the CCO
// schedule (platform/event-store/event-types/conduct.ts →
// BestExecutionPolicySchedule; published by scripts/publish-fx-bestex-policy-
// schedule.ts) is on the store AND the surveillance read-path consumes it
// (platform/conduct/fx-trade-conduct-evaluation.ts resolveBestExecutionSchedule,
// latest-effective-wins). This re-emits the conduct ProductDimensionAttested
// (latest-wins) with that gap REMOVED and every other gap on the latest
// attestation carried forward UNCHANGED (read from the store, not from the
// constants above — the store is the source of truth, Principle 1).
//
// Over-closure is the failure mode, so the closure GATES on the schedule
// actually being in force at the closure asOf: no schedule → no re-attestation.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH; D-NEW-PRODUCT-APPROVAL-
//   POLICY §5.
// Author: Zara (Chief Compliance Officer, governance).
// ---------------------------------------------------------------------------

export const SCHEDULE_GAP_ID = "fx-best-execution-policy-schedule";

// Later than CONDUCT_AS_OF (2026-06-11T20:00) so latest-wins folds pick up the
// closure.
export const CONDUCT_SCHEDULE_GAP_CLOSED_AS_OF = "2026-06-12T07:00:00.000Z";

export interface ScheduleGapClosureResult {
  readonly closed: boolean;
  readonly skipped: boolean;
  /** Why nothing was emitted, when skipped/blocked. */
  readonly reason?: string;
  /** Gap ids on the attestation emitted (or already current), for reporting. */
  readonly remainingGapIds: readonly string[];
}

/**
 * Re-emit the conduct dimension attestation with the
 * fx-best-execution-policy-schedule deferred gap removed. Reads the LATEST
 * conduct ProductDimensionAttested for the product first; all other gaps are
 * carried forward unchanged. Gated on a BestExecutionPolicySchedule being in
 * force; idempotent (skips when the latest attestation already lacks the gap).
 */
export function runFxConductScheduleGapClosure(store: EventStore): ScheduleGapClosureResult {
  // 1. Latest conduct attestation for the product (latest as_of wins).
  let latest: { asOf: string; payload: Record<string, unknown> } | null = null;
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as Record<string, unknown>;
    if (p.productId !== CONDUCT_PRODUCT_ID || p.dimension !== "conduct") continue;
    if (latest === null || ev.as_of >= latest.asOf) {
      latest = { asOf: ev.as_of, payload: p };
    }
  }

  if (latest === null) {
    return {
      closed: false,
      skipped: true,
      reason:
        "no conduct ProductDimensionAttested exists for the product — run the conduct attestation first (scripts/run-fx-conduct-attestation.ts)",
      remainingGapIds: [],
    };
  }

  const currentGaps = Array.isArray(latest.payload.deferredGaps)
    ? latest.payload.deferredGaps.map((g) => productDeferredGapSchema.parse(g))
    : [];

  // 2. Idempotency: latest attestation already lacks the gap → nothing to do.
  if (!currentGaps.some((g) => g.gapId === SCHEDULE_GAP_ID)) {
    return {
      closed: false,
      skipped: true,
      reason: `latest conduct attestation (as_of ${latest.asOf}) already lacks ${SCHEDULE_GAP_ID}`,
      remainingGapIds: currentGaps.map((g) => g.gapId),
    };
  }

  // 3. GATE: the schedule must genuinely be in force — over-closure is the
  //    failure mode.
  const schedule = resolveBestExecutionSchedule(store, CONDUCT_SCHEDULE_GAP_CLOSED_AS_OF);
  if (schedule === null) {
    return {
      closed: false,
      skipped: false,
      reason:
        "GATE failed — no BestExecutionPolicySchedule in force; publish the CCO schedule first (scripts/publish-fx-bestex-policy-schedule.ts); NOT closing the gap",
      remainingGapIds: currentGaps.map((g) => g.gapId),
    };
  }

  // 4. Re-emit with the gap removed; all other gaps carried forward UNCHANGED.
  const remaining: ProductDeferredGap[] = currentGaps.filter((g) => g.gapId !== SCHEDULE_GAP_ID);

  const priorChain = Array.isArray(latest.payload.citationChain)
    ? latest.payload.citationChain.filter((c): c is string => typeof c === "string")
    : [...CONDUCT_CITATION_CHAIN];

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${CONDUCT_PRODUCT_ID}:conduct:bestex-schedule-gap-closure`,
    tags: ["npa-gate", "deferred-gap-closure", "conduct", CONDUCT_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: CONDUCT_SCHEDULE_GAP_CLOSED_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: CONDUCT_ACTOR,
      citations: [...CONDUCT_CITATIONS, "D-FX-HELD-DIMS-SEAT-SWEEP", "dimension:conduct"],
      payload: {
        productId: CONDUCT_PRODUCT_ID,
        dimension: "conduct",
        result: "implementation-attested",
        citationChain: [
          ...new Set([
            ...priorChain,
            `bestex-schedule:${schedule.scheduleId}`,
            "scripts/publish-fx-bestex-policy-schedule.ts",
          ]),
        ],
        deferredGaps: remaining,
      },
    }),
    provenance,
  });

  return {
    closed: true,
    skipped: false,
    remainingGapIds: remaining.map((g) => g.gapId),
  };
}

// ---------------------------------------------------------------------------
// fx-best-execution-reference-benchmark gap closure (2026-06-15)
//
// The gap's targetTrigger — "independent FX benchmark / mid-rate feed wired as
// the best-execution reference" — is satisfied at the build-phase level once:
//
//   1. BESTEX-SCHED-2026-002 (referenceRateBasis = "independent-benchmark") is
//      on the store (published by scripts/publish-fx-bestex-ftp-benchmark.ts).
//   2. resolveFtpMidRate() can resolve a FtpCurvePublished event from the store
//      (Ravi's treasury system has published a curve).
//   3. The evaluation path in platform/conduct/fx-trade-conduct-evaluation.ts
//      uses the FTP mid-rate as reference when the in-force schedule so directs.
//
// A new deferred gap `fx-best-ex-ftp-live-feed` is introduced to track the
// remaining build-out: the FTP curve is a ZAR money-market proxy, not a live
// FX mid-rate feed; the live feed must be active at execution time before
// spread enforcement is fully calibrated.
//
// Over-closure is the failure mode; the closure GATES on:
//   (a) BESTEX-SCHED-2026-002 being in force, AND
//   (b) at least one FtpCurvePublished event being on the store.
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//   D-NPA-GATE-POLICY-REDESIGN; D-FX-HELD-DIMS-SEAT-SWEEP.
// Author: Zara (Chief Compliance Officer, governance).
// ---------------------------------------------------------------------------

export const BENCHMARK_GAP_ID = "fx-best-execution-reference-benchmark";
export const FTP_LIVE_FEED_GAP_ID = "fx-best-ex-ftp-live-feed";

/** Later than CONDUCT_SCHEDULE_GAP_CLOSED_AS_OF so latest-wins picks up. */
export const CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF = "2026-06-15T00:00:00.000Z";

/** The new deferred gap that replaces fx-best-execution-reference-benchmark. */
export const FTP_LIVE_FEED_DEFERRED_GAP: ProductDeferredGap = {
  gapId: FTP_LIVE_FEED_GAP_ID,
  title:
    "FTP curve feed must be live and real-time before best-ex spread can be enforced on " +
    "live trades at execution time; build-phase uses the latest FtpCurvePublished event " +
    "(ZAR ON rate) as reference proxy. The FTP rate is a ZAR money-market rate, not an FX " +
    "mid-rate — spread comparison is directional until a live FX mid-rate feed lands.",
  owner: "Rohan (Markets risk/quant engineer, engineering)",
  targetTrigger: "live FTP curve feed active at execution time; live FX mid-rate feed wired as reference",
  citations: [
    "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
    "D-NPA-GATE-POLICY-REDESIGN",
    "FAIS-ACT-37-2002-S16",
    "platform/conduct/fx-trade-conduct-evaluation.ts",
    "platform/conduct/fx-bestex-policy-schedule.ts",
  ],
};

export interface BenchmarkGapClosureResult {
  readonly closed: boolean;
  readonly skipped: boolean;
  readonly reason?: string;
  readonly remainingGapIds: readonly string[];
}

/**
 * Re-emit the conduct dimension attestation with the
 * fx-best-execution-reference-benchmark gap REMOVED and the new
 * fx-best-ex-ftp-live-feed gap ADDED (replacing it with the more precise
 * build-phase residual). All other existing gaps are carried forward unchanged.
 *
 * GATES on:
 *   (a) BESTEX-SCHED-2026-002 (independent-benchmark basis) being in force.
 *   (b) At least one FtpCurvePublished event being on the store.
 *
 * Idempotent: skips when the latest attestation already lacks the benchmark gap.
 */
export function runFxConductBenchmarkGapClosure(
  store: EventStore,
): BenchmarkGapClosureResult {
  // 1. Latest conduct attestation for the product.
  let latest: { asOf: string; payload: Record<string, unknown> } | null = null;
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as Record<string, unknown>;
    if (p.productId !== CONDUCT_PRODUCT_ID || p.dimension !== "conduct") continue;
    if (latest === null || ev.as_of >= latest.asOf) {
      latest = { asOf: ev.as_of, payload: p };
    }
  }

  if (latest === null) {
    return {
      closed: false,
      skipped: true,
      reason:
        "no conduct ProductDimensionAttested exists for the product — run the conduct attestation first",
      remainingGapIds: [],
    };
  }

  const currentGaps = Array.isArray(latest.payload.deferredGaps)
    ? latest.payload.deferredGaps.map((g) => productDeferredGapSchema.parse(g))
    : [];

  // 2. Idempotency: if benchmark gap already absent and live-feed gap already present.
  const hasBenchmarkGap = currentGaps.some((g) => g.gapId === BENCHMARK_GAP_ID);
  const hasLiveFeedGap = currentGaps.some((g) => g.gapId === FTP_LIVE_FEED_GAP_ID);
  if (!hasBenchmarkGap && hasLiveFeedGap) {
    return {
      closed: false,
      skipped: true,
      reason: `latest conduct attestation (as_of ${latest.asOf}) already has ${FTP_LIVE_FEED_GAP_ID} and lacks ${BENCHMARK_GAP_ID}`,
      remainingGapIds: currentGaps.map((g) => g.gapId),
    };
  }

  // 3a. GATE: BESTEX-SCHED-2026-002 must be in force.
  const schedule = resolveBestExecutionSchedule(store, CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF);
  if (schedule === null || schedule.referenceRateBasis !== "independent-benchmark") {
    return {
      closed: false,
      skipped: false,
      reason:
        "GATE (a) failed — no BestExecutionPolicySchedule with referenceRateBasis=independent-benchmark " +
        "in force; publish BESTEX-SCHED-2026-002 first (scripts/publish-fx-bestex-ftp-benchmark.ts); " +
        "NOT closing the gap",
      remainingGapIds: currentGaps.map((g) => g.gapId),
    };
  }

  // 3b. GATE: at least one FtpCurvePublished event must be on the store.
  let ftpAvailable = false;
  for (const e of store.replay({ type: "FtpCurvePublished" })) {
    if (e.as_of <= CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF) {
      ftpAvailable = true;
      break;
    }
  }
  if (!ftpAvailable) {
    return {
      closed: false,
      skipped: false,
      reason:
        "GATE (b) failed — no FtpCurvePublished event found on the store at or before " +
        `${CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF}; Ravi must publish an FTP curve first; ` +
        "NOT closing the gap",
      remainingGapIds: currentGaps.map((g) => g.gapId),
    };
  }

  // 4. Re-emit: remove benchmark gap, add live-feed gap (unless already present),
  //    carry all other gaps forward UNCHANGED.
  const remaining: ProductDeferredGap[] = currentGaps
    .filter((g) => g.gapId !== BENCHMARK_GAP_ID && g.gapId !== FTP_LIVE_FEED_GAP_ID);
  remaining.push({ ...FTP_LIVE_FEED_DEFERRED_GAP, citations: [...FTP_LIVE_FEED_DEFERRED_GAP.citations] });

  const priorChain = Array.isArray(latest.payload.citationChain)
    ? latest.payload.citationChain.filter((c): c is string => typeof c === "string")
    : [...CONDUCT_CITATION_CHAIN];

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${CONDUCT_PRODUCT_ID}:conduct:bestex-benchmark-gap-closure`,
    tags: ["npa-gate", "deferred-gap-closure", "conduct", CONDUCT_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: CONDUCT_ACTOR,
      citations: [
        ...CONDUCT_CITATIONS,
        "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
        "D-NPA-GATE-POLICY-REDESIGN",
        "D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY",
        "dimension:conduct",
      ],
      payload: {
        productId: CONDUCT_PRODUCT_ID,
        dimension: "conduct",
        result: "implementation-attested",
        citationChain: [
          ...new Set([
            ...priorChain,
            `bestex-schedule:${schedule.scheduleId}`,
            "platform/conduct/fx-trade-conduct-evaluation.ts:resolveFtpMidRate",
            "scripts/publish-fx-bestex-ftp-benchmark.ts",
          ]),
        ],
        deferredGaps: remaining,
      },
    }),
    provenance,
  });

  return {
    closed: true,
    skipped: false,
    remainingGapIds: remaining.map((g) => g.gapId),
  };
}
