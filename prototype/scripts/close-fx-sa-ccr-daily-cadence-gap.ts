// scripts/close-fx-sa-ccr-daily-cadence-gap.ts
//
// CLOSES tracked deferred gap `fx-sa-ccr-daily-cadence` on the credit-risk
// dimension of prd:bank:fx:otc-vanilla ("approved with tracked deferred gaps",
// D-FX-OTC-NPA-SCOPE-EXPANSION).
//
// The gap's targetTrigger — "SA-CCR EOD run registered in
// runtime/handlers-metadata.ts on the daily scheduled cadence" — is satisfied:
//   - `rohan:sa-ccr-eod` is a registered scheduled handler
//     (runtime/agents/rohan-sa-ccr-eod.ts wrapping the existing
//     runSaCcrForFxPositions driver; cron `0 19 * * 1-5` in
//     runtime/agents/metadata/rohan.ts, read by the launchd scheduler).
//   - Staleness watchdog: per-live-netting-set `sa-ccr-fx-ead-*` expectations
//     (expected-event watchdog, maxAgeBusinessDays 1) raise a SubstrateAlert
//     when a live, registered netting set's CcrEadComputed goes stale.
//   - Idempotency proven in runtime/agents/rohan-sa-ccr-eod.test.ts (same-day
//     double-run emits nothing new).
//
// Re-emits the credit-risk ProductDimensionAttested (latest-wins) with
// `fx-sa-ccr-daily-cadence` REMOVED and every other gap on the latest
// attestation carried forward unchanged. Read-before-write: the script reads
// the CURRENT latest credit-risk attestation from the store, asserts the gap
// is present, and carries the remaining gaps verbatim — it never hardcodes the
// other gaps, so a concurrent re-attestation cannot be silently dropped.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/close-fx-sa-ccr-daily-cadence-gap.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//            D-FX-SA-CCR-BUILD-PHASE-ACTIVATION; D-FX-OTC-NPA-SCOPE-EXPANSION;
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Brief: brief:rohan:close-fx-sa-ccr-daily-cadence-sa-ccr-eod-schedul:2026-06-12.
// Author: Rohan (Risk engineer, engineering) · Scrooge-coordinated session.

import { clock, eventStore } from "../platform/composition";
import {
  type ProductDimensionAttestedPayload,
  makeProductDimensionAttested,
} from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

const PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const DIMENSION = "credit-risk";
const GAP_ID = "fx-sa-ccr-daily-cadence";
// Later than the 2026-06-11T18:00:00.000Z verification-pass-2 attestation so
// latest-wins picks this up.
const AS_OF = "2026-06-12T07:00:00.000Z";

// 1. Read the CURRENT latest credit-risk attestation (latest as_of wins;
//    sequence breaks ties).
let latest: ProductDimensionAttestedPayload | null = null;
for (const ev of eventStore.replay({ type: "ProductDimensionAttested" })) {
  const p = ev.payload as ProductDimensionAttestedPayload;
  if (p.productId !== PRODUCT_ID || p.dimension !== DIMENSION) continue;
  latest = p; // replay is sequence-ordered; as_of is monotone for attestations
}

if (!latest) {
  logger.error({ PRODUCT_ID, DIMENSION }, "no existing credit-risk attestation found — aborting");
  process.exit(1);
}

const before = latest.deferredGaps ?? [];
const target = before.find((g) => g.gapId === GAP_ID);
if (!target) {
  logger.error(
    { gapIds: before.map((g) => g.gapId) },
    `gap ${GAP_ID} not present on the latest credit-risk attestation — nothing to close (already closed?)`,
  );
  process.exit(1);
}

// 2. Carry every OTHER gap forward verbatim.
const carried = before.filter((g) => g.gapId !== GAP_ID);

const provenance = buildPhaseFixtureTag({
  sourceLineage: "platform:npa-attestation-runner",
  variant: `npa-dimension-upgrade:${PRODUCT_ID}:${DIMENSION}:gap-closed-${GAP_ID}`,
  tags: ["npa-gate", "dimension-upgrade", "gap-closed", PRODUCT_ID],
});

eventStore.append({
  ...makeProductDimensionAttested({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:rohan:sa-ccr-eod" },
    citations: [
      "D-FX-HELD-DIMS-SEAT-SWEEP",
      "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      `dimension:${DIMENSION}`,
    ],
    payload: {
      productId: PRODUCT_ID,
      dimension: DIMENSION,
      result: "implementation-attested",
      // Carry the existing citation chain and add the cadence substrate that
      // closes the gap (deduplicated).
      citationChain: [
        ...latest.citationChain,
        ...[
          "D-FX-HELD-DIMS-SEAT-SWEEP",
          "runtime/agents/rohan-sa-ccr-eod.ts",
          "platform/model-registry/expected-event-watchdog.ts",
        ].filter((c) => !(latest?.citationChain ?? []).includes(c)),
      ],
      ...(carried.length > 0 ? { deferredGaps: carried } : {}),
    },
  }),
  provenance,
});

logger.info(
  {
    productId: PRODUCT_ID,
    dimension: DIMENSION,
    closedGap: GAP_ID,
    deferredGapsBefore: before.map((g) => g.gapId),
    deferredGapsAfter: carried.map((g) => g.gapId),
    at: clock.now(),
  },
  `gap ${GAP_ID} CLOSED — SA-CCR EOD registered as scheduled handler (rohan:sa-ccr-eod, cron 0 19 * * 1-5) with per-netting-set staleness watchdog; remaining gaps carried forward unchanged`,
);
process.exit(0);
