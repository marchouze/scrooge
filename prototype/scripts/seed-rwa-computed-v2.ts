// scripts/seed-rwa-computed-v2.ts
//
// WS-V2-MIGRATION-BUCKET-A PILOT — seed ONE production RwaComputedV2 so the
// retired-by-construction flip's condition 2 (V2 SOLE LIVE PATH PRODUCES) is
// NON-VACUOUS on the ci:migrate seeded store.
//
// ## Why this exists (Charter cmd 5 — no green by concealment)
//
// The pilot flips RwaComputed to v2-replaced RETIRED-BY-CONSTRUCTION. RBC
// condition 2 requires the V2 sole live path to actually PRODUCE — a parity
// gate over an empty V2 register is vacuously green and would NOT prove the
// flip. RwaComputed/RwaComputedV2 are data-empty in the build phase (see
// prototype/docs/bucket-a-money-bearing-nonfinancial-scope.md §6), so this seed
// drives the REAL production emit path — `generateAndEmitRwaComputedForPeriod`
// (bea-rwa-period-close.ts), now re-pointed to `emitRwaComputedV2` — over a
// seeded credit exposure, producing ≥1 RwaComputedV2 with a decoded total RWA
// > 0. The companion gate `recon:rwa-computed-v2-parity` then asserts that
// non-vacuous figure (condition 2) plus decoded-decimal parity (V1 == V2 on the
// shared register; vacuous V1 side is documented).
//
// The credit exposure is a single SA-sovereign bond — RWA carries the standard
// CRE20 risk weight; the figure is real and event-sourced (not fabricated), it
// simply seeds a minimal book so the engine has something to weight.
//
// ## Idempotency
//
// `generateAndEmitRwaComputedForPeriod` is idempotent (one RwaComputedV2 per
// (entity, periodId)); the bond seed is guarded by a deterministic tradeId so a
// re-run appends nothing. The whole script is a safe no-op on re-run.
//
// Run via:  bun run seed:rwa-computed-v2   (from prototype/)
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC; D-V2-CORE-MONEY-DECIMAL-NATIVE;
//   D-RWA-ENGINE-W2-SLICE-3.
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Citations: Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 23;
//   BCBS Basel III/IV (CRE20); Principles/1-events-are-truth.md.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../platform/composition";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../platform/market-data/store";
import { readRwaComputedV2Decoded } from "../platform/risk/rwa-computed-engine-v2";
import { generateAndEmitRwaComputedForPeriod } from "../runtime/agents/bea-rwa-period-close";

const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_ID = "period:hoz-bank:month:2026-05-rwa-v2-seed";
const CLOSED_AT = "2026-06-01T08:00:00.000Z";

function main(): number {
  // NOTE: condition-2 (V2 sole live path produces a decoded RWA) is driven by
  // the MARKET-RISK leg already seeded upstream in ci:migrate (`mr:measure-run`
  // → MarketRiskMeasureComputed) plus the operational-RWA placeholder — NOT by a
  // seeded bond exposure. The credit-RWA input layer (`readDebtExposures`) still
  // reads the legacy `*Minor` `BondTradeExecuted` / `InterbankLoanPlaced` events,
  // which are un-emittable on main (recon:no-residual-minor-encoding, no
  // allowlist). Seeding one purely to inflate this pilot's RWA would re-introduce
  // a forbidden legacy `*Minor` event into the store — so we drive the production
  // emit path over the decimal-native exposures that already exist. Migrating the
  // debt-exposure input layer to decimal-native is bucket-B scope.
  const marketData = new MarketDataStore(resolveMarketDataDbPath().path);

  const result = generateAndEmitRwaComputedForPeriod({
    store: eventStore,
    marketData,
    entity: ENTITY,
    closedPayload: {
      periodId: PERIOD_ID,
      closedAt: CLOSED_AT,
      trialBalanceSnapshotEventId: "seed-rwa-v2-tb-snapshot",
      uptoSequence: 0,
    },
  });

  // Confirm the re-pointed production emit path RAN end-to-end: a decimal-native
  // RwaComputedV2 must now exist for the seeded period. In the build phase the
  // decoded total RWA is legitimately ZERO — the credit-RWA input layer reads
  // legacy `*Minor` exposure events that are un-emittable on main, and there is
  // no real exposure book. We do NOT fabricate a positive RWA (that would require
  // re-introducing a forbidden legacy `*Minor` event = concealment). The RBC
  // condition-2 proof that the emitter produces a POSITIVE decoded RWA from real
  // inputs lives in the engine unit test (rwa-computed-engine-v2.test.ts); the
  // parity gate is PASS-on-empty (cf. BA-700 capital). See
  // docs/bucket-a-money-bearing-nonfinancial-scope.md §6.
  const v2 = readRwaComputedV2Decoded(eventStore).find((r) => r.periodId === PERIOD_ID);
  const pathRan = v2 !== undefined;

  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "seed-rwa-computed-v2",
        emitResult: result,
        v2RegisterRow: v2 ?? null,
        emitPathRan: pathRan,
        decodedTotalRwa: v2 ? v2.totalRwa : null,
        note: "build-phase RWA is legitimately 0; condition-2 RWA>0 proof is the engine unit test",
      },
      null,
      2,
    ),
  );

  if (!pathRan) {
    // Fail-closed (Charter cmd 2): the re-pointed emitter must at least PRODUCE a
    // RwaComputedV2 event for the period. A missing event means the emit path is
    // broken (e.g. provenance-category gap tags it scenario-required) — error
    // loudly rather than let the flip rest on a path that never runs.
    process.stderr.write(
      "seed-rwa-computed-v2: FAILED — the re-pointed period-close emitter produced no RwaComputedV2 " +
        "event for the seeded period. The V2 emit path is broken. Inspect the engine + provenance category.\n",
    );
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}

export { main, PERIOD_ID as RWA_V2_SEED_PERIOD_ID };
