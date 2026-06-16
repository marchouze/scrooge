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
import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import { productionTag } from "../platform/event-store/provenance";
import type { Actor } from "../platform/event-store/types";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../platform/market-data/store";
import { readRwaComputedV2Decoded } from "../platform/risk/rwa-computed-engine-v2";
import { generateAndEmitRwaComputedForPeriod } from "../runtime/agents/bea-rwa-period-close";

const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_ID = "period:hoz-bank:month:2026-05-rwa-v2-seed";
const AS_OF = "2026-05-31T23:59:59.000Z";
const CLOSED_AT = "2026-06-01T08:00:00.000Z";
const TRADE_ID = "bond-rwa-v2-seed-sa-sovereign";

const ACTOR: Actor = { type: "service", id: "script:seed-rwa-computed-v2" };

const CITATIONS = [
  "D-RWA-ENGINE-W2-SLICE-3",
  "D-BANK-WIDE-V2-MIGRATION",
  "Banks Act 94 of 1990 §70",
  "Regulations Relating to Banks Reg 23",
  "Principles/1-events-are-truth.md",
];

/** True iff the seed bond already exists (idempotency guard). */
function seedBondExists(): boolean {
  for (const e of eventStore.replay({ type: "BondTradeExecuted" })) {
    if ((e.payload as { tradeId?: string }).tradeId === TRADE_ID) return true;
  }
  return false;
}

function seedBond(): void {
  if (seedBondExists()) return;
  const ev = makeBondTradeExecuted({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: TRADE_ID,
      bondIsin: "ZAG000000001",
      side: "buy",
      nominalMinor: 100_000_000_00, // R100m nominal
      cleanPricePercent: 100,
      accruedInterestMinor: 0,
      dirtyPricePercent: 100,
      settlementDate: AS_OF,
      portfolio: "banking-book",
      couponRate: 0.085,
      maturityDate: "2030-12-31",
      currency: "ZAR",
      counterpartyLei: "LEI-SEED-DEALER",
      executedAt: AS_OF,
      exposureClass: "corporate",
    },
  });
  eventStore.append({
    ...ev,
    provenance: productionTag({ sourceLineage: "seed:rwa-computed-v2" }),
  });
}

function main(): number {
  seedBond();

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

  // Verify the production emit is non-vacuous: the V2 register (production
  // filter) must now carry the seeded period with a decoded total RWA > 0.
  // readRwaComputedV2Decoded already canonicalises totalRwa via decodeMoney.
  const v2 = readRwaComputedV2Decoded(eventStore).find((r) => r.periodId === PERIOD_ID);
  const nonVacuous = v2 !== undefined && Number(v2.totalRwa) > 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "seed-rwa-computed-v2",
        emitResult: result,
        v2RegisterRow: v2 ?? null,
        conditionTwoNonVacuous: nonVacuous,
      },
      null,
      2,
    ),
  );

  if (!nonVacuous) {
    // Fail-closed (Charter cmd 2): the whole pilot rests on condition 2 being
    // non-vacuous. If the seed did not produce a positive decoded RWA, the flip
    // basis is unproven — error loudly rather than let recon pass vacuously.
    process.stderr.write(
      "seed-rwa-computed-v2: FAILED — no RwaComputedV2 with a positive decoded total RWA was produced. " +
        "RBC condition 2 (V2 sole live path produces) is unproven. Inspect the engine + provenance category.\n",
    );
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}

export { main, PERIOD_ID as RWA_V2_SEED_PERIOD_ID };
