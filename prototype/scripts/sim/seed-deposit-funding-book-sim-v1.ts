// scripts/sim/seed-deposit-funding-book-sim-v1.ts
//
// SIMULATOR-FIRST DEPOSIT / FUNDING / HQLA BOOK — (D-BA-RETURN-SIMULATOR-FIRST).
//
// Seeds a small, clearly-SYNTHETIC deposit / funding / HQLA book that drives the
// BA 300 liquidity engines (LCR + NSFR) AND the new BA 310 minimum-liquid-reserve
// fold to realistic, oracle-validated, NON-ZERO outputs. Before this seed the
// LCR/NSFR/BA-310 cells folded to honest-0 because no deposit / funding / HQLA
// event stream fed the engines.
//
// WHAT IT EMITS (all `provenance: simulated`, scenario "deposit-funding-book-sim-v1"):
//   - Deposits (DepositTaken) across the four LCR/NSFR funding-stability
//     categories — retail-stable, retail-less-stable, wholesale-operational,
//     wholesale-non-operational — by counterparty + maturity, exercising every
//     LCR outflow bucket and every NSFR ASF factor band.
//   - Funding line (FundingLineDrawn) — wholesale borrowing, 100% LCR run-off.
//   - Interbank placement (InterbankLoanPlaced) — 30-day contractual LCR inflow +
//     short-term RSF claim on a financial institution.
//   - HQLA stock (CollateralInventorySnapshotted) — Level-1 (cash / central-bank
//     reserves / 0%-RW sovereigns), Level-2A, Level-2B — the LCR numerator AND
//     the BA-310 level-1 liquid-asset stock.
//
// The book is sized to clean round numbers so the LCR / NSFR / BA-310 folds land
// on the hand-computed golden-case figures asserted by
// `platform/recon/ba300-deposit-funding-sim-drive.ts` + the golden-case tests.
//
// PROVENANCE BOUNDARY (CRITICAL — the R300m-into-Prod lesson):
//   Every event carries an EXPLICIT `simulatedTag(...)` (never the category
//   soft-default — the fail-open FIL-fixture lesson). The PRODUCTION read
//   (`production-only`) EXCLUDES every event here — so the production-only
//   LCR / NSFR / BA-310 stays ZERO pre-licence-day. The simulated book appears
//   only under the operating-book / combined / simulated-only reads. Both legs
//   are proven by `recon:ba300-deposit-funding-sim-drive` + the golden-case test.
//
// IDEMPOTENT + REPLAY-SAFE: fixed asOf, fixed event ids, guarded on event_id in
// the store. No wall-clock (Charter cmd 6).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FX-V2-SIMULATOR-FIRST; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-BA300-LCR-FX-ENRICHMENT;
//   Regulations Relating to Banks Reg 26 (LCR) / Reg 26A (NSFR) / Reg 27
//   (minimum liquid reserve); SARB Act 90 of 1989 (cash-reserve requirement);
//   BCBS D295 (LCR) / BCBS 295 (NSFR); Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../../platform/composition";
import { makeCollateralInventorySnapshotted } from "../../platform/event-store/event-types/collateral";
import {
  makeDepositTaken,
  makeFundingLineDrawn,
  makeInterbankLoanPlaced,
} from "../../platform/event-store/event-types/repo-mmd-ibl";
import { simulatedTag } from "../../platform/event-store/provenance";
import {
  DEPOSIT_FUNDING_SIM_BOOK,
  DEPOSIT_FUNDING_SIM_SCENARIO,
} from "../../platform/returns/ba300/deposit-funding-sim-book";

// ---------------------------------------------------------------------------
// Fixed simulation parameters — no wall-clock; idempotent ids.
// ---------------------------------------------------------------------------

const ENTITY = DEPOSIT_FUNDING_SIM_BOOK.entity;
const AS_OF = DEPOSIT_FUNDING_SIM_BOOK.asOf;

const ACTOR = {
  type: "service" as const,
  id: "agent:atlas:seed-deposit-funding-book-sim-v1",
};

const CITATIONS = [
  "D-BA-RETURN-SIMULATOR-FIRST",
  "urn:reg:za:regs-relating-to-banks:reg26",
  "urn:reg:za:regs-relating-to-banks:reg27",
  "urn:reg:bcbs:d295:lcr",
  "P1-EVENTS-AS-TRUTH",
];

const SIM_PROVENANCE = simulatedTag({
  scenario: DEPOSIT_FUNDING_SIM_SCENARIO,
  sourceLineage: "scripts/sim/seed-deposit-funding-book-sim-v1.ts",
  tags: [
    "manual-simulation",
    "deposit-funding-book",
    "liquidity-risk",
    "d-ba-return-simulator-first",
  ],
});

// ---------------------------------------------------------------------------
// Idempotency helper — single replay for O(1) idempotency.
// ---------------------------------------------------------------------------

function collectExistingEventIds(): Set<string> {
  const ids = new Set<string>();
  for (const ev of eventStore.replay({})) ids.add(ev.event_id);
  return ids;
}

const EXISTING_EVENT_IDS = collectExistingEventIds();

function alreadyEmitted(eventId: string): boolean {
  return EXISTING_EVENT_IDS.has(eventId);
}

// ---------------------------------------------------------------------------
// Emit.
// ---------------------------------------------------------------------------

function emitDeposits(): number {
  let n = 0;
  for (const d of DEPOSIT_FUNDING_SIM_BOOK.deposits) {
    const eventId = `EV-${d.depositId}`;
    if (alreadyEmitted(eventId)) continue;
    eventStore.append(
      makeDepositTaken({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        eventId,
        provenance: SIM_PROVENANCE,
        payload: {
          depositId: d.depositId,
          counterpartyLei: d.counterpartyLei,
          principalZar: d.principalMinor,
          interestRateDecimal: d.interestRateDecimal,
          maturityDate: d.maturityDate,
          depositCategory: d.depositCategory,
          bookId: DEPOSIT_FUNDING_SIM_BOOK.bookId,
          instrumentRef: d.instrumentRef,
        },
      }),
    );
    n += 1;
  }
  return n;
}

function emitFundingLines(): number {
  let n = 0;
  for (const f of DEPOSIT_FUNDING_SIM_BOOK.fundingLines) {
    const eventId = `EV-${f.fundingLineId}`;
    if (alreadyEmitted(eventId)) continue;
    eventStore.append(
      makeFundingLineDrawn({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        eventId,
        provenance: SIM_PROVENANCE,
        payload: {
          fundingLineId: f.fundingLineId,
          drawnAmountZar: f.drawnAmountMinor,
          maturityDate: f.maturityDate,
          rateDecimal: f.rateDecimal,
        },
      }),
    );
    n += 1;
  }
  return n;
}

function emitInterbankPlacements(): number {
  let n = 0;
  for (const p of DEPOSIT_FUNDING_SIM_BOOK.interbankPlacements) {
    const eventId = `EV-${p.placementId}`;
    if (alreadyEmitted(eventId)) continue;
    eventStore.append(
      makeInterbankLoanPlaced({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        eventId,
        provenance: SIM_PROVENANCE,
        payload: {
          placementId: p.placementId,
          counterpartyLei: p.counterpartyLei,
          principalZar: p.principalMinor,
          rateDecimal: p.rateDecimal,
          startDate: p.startDate,
          maturityDate: p.maturityDate,
          placementType: "fixed-term",
          bookId: DEPOSIT_FUNDING_SIM_BOOK.bookId,
          instrumentRef: p.instrumentRef,
        },
      }),
    );
    n += 1;
  }
  return n;
}

function emitHqlaSnapshot(): number {
  const h = DEPOSIT_FUNDING_SIM_BOOK.hqla;
  const eventId = `EV-${h.snapshotId}`;
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
        snapshotId: h.snapshotId,
        asOf: AS_OF,
        totalHQLAZar: h.l1Zar + h.l2aZar + h.l2bZar,
        l1Zar: h.l1Zar,
        l2aZar: h.l2aZar,
        l2bZar: h.l2bZar,
        l2CapBreached: false,
        l2bCapBreached: false,
        securityCount: h.securityCount,
        currency: DEPOSIT_FUNDING_SIM_BOOK.functionalCurrency,
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
    `[seed-deposit-funding-book-sim-v1] emitted deposits=${deposits} fundingLines=${funding} interbankPlacements=${ibl} hqlaSnapshot=${hqla} (scenario=${DEPOSIT_FUNDING_SIM_SCENARIO}, provenance=simulated, entity=${ENTITY}). Production LCR/NSFR/BA-310 read stays 0; operating-book / simulated read drives the engines to the golden figures.`,
  );
  return 0;
}

process.exit(main());
