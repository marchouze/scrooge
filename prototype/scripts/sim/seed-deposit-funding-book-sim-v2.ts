// scripts/sim/seed-deposit-funding-book-sim-v2.ts
//
// SIMULATOR-FIRST DEPOSIT / FUNDING / HQLA BOOK — BORN-V2 LIVE SEED
// (D-BA-RETURN-SIMULATOR-FIRST; closes GAP-BA300-DEPOSIT-FUNDING-SIM-GL).
//
// WHY THIS EXISTS (the headline-LCR root-cause, 2026-06-28):
//   The dashboard headline LCR figure went dark — `alert:integrity:calc-lcr-failed`
//   ("missing input(s): hqlaZar, netCashOutflowsZar") — because the canonical
//   event store held NO live deposit / funding / HQLA book. The calc-provenance
//   tile folds `getALMPositionSnapshot` (`alm-positions.ts`), whose funding +
//   HQLA arrays were empty: zero `DepositTaken*` / `FundingLineDrawn*` /
//   `InterbankLoanPlaced*` events, and only zero-valued `CollateralInventory-
//   Snapshotted` snapshots (Atlas's daily snapshot reads
//   `getCollateralInventory` → `TradeBooked`, which is also empty). This is a
//   SIMULATOR-CADENCE GAP, not a projection/window bug: nothing keeps a live
//   liquidity book rolling in the T+30 LCR window. (Root-cause evidence:
//   run `run:ravi:2026-06-28...`; the snapshot/window logic is correct — there
//   was simply nothing in the window.)
//
// WHY BORN-V2 (and not the V1 seed `seed-deposit-funding-book-sim-v1.ts`):
//   The V1 seed emits `DepositTaken` / `FundingLineDrawn` / `InterbankLoanPlaced`,
//   which ARE V1-only LIFECYCLE-registered openings (lifecycleId mmd-deposit /
//   funding-line / interbank-loan) with POSTING_RULE_REGISTRY rules (PR-MMD-001 /
//   PR-FUNDING-001 / PR-IBL-001). `recon:gl-ledger-coverage` (assertion 5)
//   therefore requires a `SubLedgerPostingEmitted` for each — seeding them WITHOUT
//   postings trips that gate (empirically confirmed); emitting the V1 GL postings
//   would WIDEN the v1-only estate (V1-retirement directive rule 1). So the live
//   seed was deferred (GAP-BA300-DEPOSIT-FUNDING-SIM-GL). The born-V2 event types
//   (`DepositTakenV2` …) are NOT in the V1 lifecycle/posting registry, so
//   `gl-ledger-coverage` requires NO posting for them — the seed adds ZERO v1-only
//   estate AND no GL postings are needed to keep coverage green (empirically
//   confirmed: gl-ledger-coverage passes with these events and no MM postings).
//
// WHAT IT EMITS (all `provenance: simulated`, scenario
// "deposit-funding-book-sim-v2", from the SAME canonical
// `DEPOSIT_FUNDING_SIM_BOOK` so the V1 and V2 seeds share one oracle):
//   - DepositTakenV2 × 4   (the four LCR/NSFR funding-stability categories)
//   - FundingLineDrawnV2 × 1 (wholesale borrowing, 100% LCR run-off)
//   - InterbankLoanPlacedV2 × 1 (30-day contractual LCR inflow)
//   - CollateralInventorySnapshotted × 1 (HQLA L1/L2a/L2b — the LCR numerator).
//     This event type is SHARED vocabulary (HQLA stock, not money-market) and is
//     read by BOTH the V1 and V2 ALM HQLA folds; it carries NO lifecycle GL rule,
//     so it does not trip `recon:gl-ledger-coverage`.
//   No GlPostingEmitted is emitted: the headline LCR tile folds the deposit /
//   funding / HQLA EVENTS (not GL postings), and the V2 money-market types carry
//   no required posting rule. Driving the V2 MM GL engine here would create
//   V2-only GL accounts that `recon:gl-v2-parity` (Phase 3A: FX-only dual-post)
//   correctly flags — a separate concern with its own Decision, deliberately out
//   of scope for surfacing the LCR figure.
//
// HOW THE HEADLINE TILE SEES IT:
//   `getALMPositionSnapshot` (`alm-positions.ts`) folds the V2 money-market
//   funding events (`buildFundingPositionsV2`) alongside its existing V1 folds,
//   and the shared `CollateralInventorySnapshotted` HQLA stock. The store holds
//   zero V1 MM events, so there is no double-count: the V1-vocabulary funding
//   fold yields nothing and the V2 fold yields this book. The headline LCR
//   surfaces the golden oracle figure: HQLA R950m / net-outflow R170m → 558.82%.
//
// PROVENANCE BOUNDARY (the R300m-into-Prod lesson):
//   Every event carries an EXPLICIT `simulatedTag(...)` (never the soft default).
//   The PRODUCTION read (`production-only`) EXCLUDES every event here — so the
//   production-only LCR / NSFR / BA-310 stays ZERO pre-licence-day. The book
//   appears only under operating-book / combined / simulated reads (the tile is
//   intrinsically operating-book).
//
// IDEMPOTENT + REPLAY-SAFE: fixed asOf, fixed event ids, guarded on event_id /
//   posting (sourceEventId × postingRuleId) in the store. No wall-clock
//   (Charter cmd 6).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-CALC-RWA-LCR-SURFACE-V1; D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-PHASE-3B;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; D-V2-CORE-MONEY-DECIMAL-NATIVE;
//   Regulations Relating to Banks Reg 26 (LCR) / Reg 26A (NSFR) / Reg 27;
//   SARB Act 90 of 1989; BCBS D238 (LCR) / BCBS 295 (NSFR); Principle 1; Principle 5.
// Author: Ravi (Treasury / ALM engineer, engineering).

import { eventStore } from "../../platform/composition";
import { moneyWireFromMinor } from "../../platform/core/money-codec";
import { makeCollateralInventorySnapshotted } from "../../platform/event-store/event-types/collateral";
import {
  makeDepositTakenV2,
  makeFundingLineDrawnV2,
  makeInterbankLoanPlacedV2,
} from "../../platform/event-store/event-types/repo-mmd-ibl-v2";
import { simulatedTag } from "../../platform/event-store/provenance";
import { DEPOSIT_FUNDING_SIM_BOOK } from "../../platform/returns/ba300/deposit-funding-sim-book";
import { ANCHOR_TENANT_ID } from "../../v2-core/control-plane/tenant";

// ---------------------------------------------------------------------------
// Fixed simulation parameters — no wall-clock; idempotent ids.
// ---------------------------------------------------------------------------

const SCENARIO_V2 = "deposit-funding-book-sim-v2" as const;
const ENTITY = DEPOSIT_FUNDING_SIM_BOOK.entity;
const AS_OF = DEPOSIT_FUNDING_SIM_BOOK.asOf;
const CCY = DEPOSIT_FUNDING_SIM_BOOK.functionalCurrency;
// Single-tenant anchor (the V2 money-market events carry a tenant axis).
// Sourced from the control-plane constant — never a literal (Charter cmd 4).
const TENANT_ID = ANCHOR_TENANT_ID;

const ACTOR = {
  type: "service" as const,
  id: "agent:ravi:seed-deposit-funding-book-sim-v2",
};

const CITATIONS = [
  "D-BA-RETURN-SIMULATOR-FIRST",
  "D-CALC-RWA-LCR-SURFACE-V1",
  "urn:reg:za:regs-relating-to-banks:reg26",
  "urn:reg:za:regs-relating-to-banks:reg27",
  "urn:reg:bcbs:d295:lcr",
  "P1-EVENTS-AS-TRUTH",
];

const SIM_PROVENANCE = simulatedTag({
  scenario: SCENARIO_V2,
  sourceLineage: "scripts/sim/seed-deposit-funding-book-sim-v2.ts",
  tags: [
    "manual-simulation",
    "deposit-funding-book",
    "liquidity-risk",
    "d-ba-return-simulator-first",
    "born-v2",
  ],
});

/** MoneyWire (decimal-native, `__money`-tagged) from a MINOR-unit amount. */
const wire = (minor: number) => moneyWireFromMinor(minor, CCY);

// ---------------------------------------------------------------------------
// Idempotency — single replay for O(1) event-id checks.
// ---------------------------------------------------------------------------

const existingEventIds = new Set<string>();
for (const ev of eventStore.replay({})) {
  existingEventIds.add(ev.event_id);
}

function alreadyEmitted(eventId: string): boolean {
  return existingEventIds.has(eventId);
}

// ---------------------------------------------------------------------------
// Emit the V2 money-market lifecycle events + HQLA snapshot.
// ---------------------------------------------------------------------------

function emitDeposits(): number {
  let n = 0;
  for (const d of DEPOSIT_FUNDING_SIM_BOOK.deposits) {
    const eventId = `EV-V2-${d.depositId}`;
    if (alreadyEmitted(eventId)) continue;
    eventStore.append(
      makeDepositTakenV2({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        eventId,
        payload: {
          depositId: d.depositId,
          counterpartyLei: d.counterpartyLei,
          principal: wire(d.principalMinor),
          interestRateDecimal: d.interestRateDecimal,
          maturityDate: d.maturityDate,
          depositCategory: d.depositCategory,
          bookId: DEPOSIT_FUNDING_SIM_BOOK.bookId,
          instrumentRef: d.instrumentRef,
          tenantId: TENANT_ID,
          schemaVersion: 2,
        },
        provenance: SIM_PROVENANCE,
      }),
    );
    n += 1;
  }
  return n;
}

function emitFundingLines(): number {
  let n = 0;
  for (const f of DEPOSIT_FUNDING_SIM_BOOK.fundingLines) {
    const eventId = `EV-V2-${f.fundingLineId}`;
    if (alreadyEmitted(eventId)) continue;
    eventStore.append(
      makeFundingLineDrawnV2({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        eventId,
        payload: {
          fundingLineId: f.fundingLineId,
          drawnAmount: wire(f.drawnAmountMinor),
          maturityDate: f.maturityDate,
          rateDecimal: f.rateDecimal,
          tenantId: TENANT_ID,
          schemaVersion: 2,
        },
        provenance: SIM_PROVENANCE,
      }),
    );
    n += 1;
  }
  return n;
}

function emitInterbankPlacements(): number {
  let n = 0;
  for (const p of DEPOSIT_FUNDING_SIM_BOOK.interbankPlacements) {
    const eventId = `EV-V2-${p.placementId}`;
    if (alreadyEmitted(eventId)) continue;
    eventStore.append(
      makeInterbankLoanPlacedV2({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        eventId,
        payload: {
          placementId: p.placementId,
          counterpartyLei: p.counterpartyLei,
          principal: wire(p.principalMinor),
          rateDecimal: p.rateDecimal,
          startDate: p.startDate,
          maturityDate: p.maturityDate,
          placementType: "fixed-term",
          bookId: DEPOSIT_FUNDING_SIM_BOOK.bookId,
          instrumentRef: p.instrumentRef,
          tenantId: TENANT_ID,
          schemaVersion: 2,
        },
        provenance: SIM_PROVENANCE,
      }),
    );
    n += 1;
  }
  return n;
}

function emitHqlaSnapshot(): number {
  const h = DEPOSIT_FUNDING_SIM_BOOK.hqla;
  // Distinct id from the V1 seed so both can coexist; the ALM HQLA fold is
  // latest-wins per snapshot, so a single live HQLA snapshot is sufficient.
  const eventId = `EV-V2-${h.snapshotId}`;
  if (alreadyEmitted(eventId)) return 0;
  eventStore.append(
    makeCollateralInventorySnapshotted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId,
      provenance: SIM_PROVENANCE,
      payload: {
        snapshotId: `${h.snapshotId}-V2`,
        asOf: AS_OF,
        totalHQLAZar: h.l1Zar + h.l2aZar + h.l2bZar,
        l1Zar: h.l1Zar,
        l2aZar: h.l2aZar,
        l2bZar: h.l2bZar,
        l2CapBreached: false,
        l2bCapBreached: false,
        securityCount: h.securityCount,
        currency: CCY,
      },
    }),
  );
  return 1;
}

function main(): number {
  const deposits = emitDeposits();
  const funding = emitFundingLines();
  const ibl = emitInterbankPlacements();
  const hqla = emitHqlaSnapshot();
  console.log(
    `[seed-deposit-funding-book-sim-v2] emitted depositsV2=${deposits} fundingLinesV2=${funding} interbankPlacementsV2=${ibl} hqlaSnapshot=${hqla} (scenario=${SCENARIO_V2}, provenance=simulated, entity=${ENTITY}, born-V2). Production LCR/NSFR/BA-310 read stays 0; operating-book / combined read drives the headline LCR to HQLA R950m / net-outflow R170m → 558.82%.`,
  );
  return 0;
}

process.exit(main());
