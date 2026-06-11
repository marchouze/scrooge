// runtime/agents/ravi-balance-sheet-projector.ts
//
// Ravi's balance-sheet projector handler (W2.4 — D-TREASURER-WAVE2-SUBSTRATE).
//
// Emits a `BalanceSheetProjected` event at the end of each ALM period tick,
// supplying the supplemental BA 120 line items the NSFR engine needs that
// individual trade events do not cover:
//   - Tier 2 capital (ASF 100% weight)
//   - Issued unsecured wholesale funding > 1 year (ASF 100% weight)
//   - Covered bonds issued > 6 months (ASF 100% weight)
//   - Unencumbered retail loans < 1 year (RSF ~50% weight)
//   - Unencumbered retail loans ≥ 1 year (RSF ~65% weight)
//   - Encumbered assets (RSF 100% weight)
//   - Off-balance-sheet commitments (RSF 5% weight)
//
// Idempotent: one projection per (asOf date) — if a `BalanceSheetProjected`
// event with the same projectionId already exists, the handler is a no-op.
//
// Build-phase posture: no real positions yet (CLAUDE.md "build phase vs
// licence-day"). Fields that require originated-loan or encumbered-asset
// events emit zero — correct and auditable (Principle 1). The handler is
// structurally complete and will produce non-zero outputs when:
//   - `CapitalEvent{capitalEventKind:"tier2-issuance"}` events land (Tier 2).
//   - `FundingDrawnDown` events with maturityDate > 1 year exist (wholesale GT1Y).
//   - `LoanOriginated` / `LoanBooked` events exist (retail loans).
//
// Source events folded:
//   - `CapitalEvent{kind:"tier2-issuance"}` → tier2CapitalZar (ZAR cents).
//   - `FundingDrawnDown{maturityDate>1y, currency:"ZAR"}` → unsecuredWholesaleFundingGt1yZar.
//   - `InterbankLoanPlaced{maturityDate>1y}` → unsecuredWholesaleFundingGt1yZar (interbank
//     term funding drawn from other banks, i.e. liabilities side).
//   - All others (retail loans, encumbered assets, OBS commitments) — zero until
//     their event classes land.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
//   BA 120; BCBS D295/D396; Banks Act 94 of 1990 Reg 26A (NSFR).
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeBalanceSheetProjected } from "../../platform/event-store/event-types/balance-sheet";
import type { AgentRunContext, AgentRunOutput } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BANKS-REG-26A",
  "BCBS-D295",
  "BCBS-D396",
  "D-TREASURER-WAVE2-SUBSTRATE",
];

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service", id: "agent:ravi:balance-sheet-projector" } as const;

// ---------------------------------------------------------------------------
// Payload derivation helpers
// ---------------------------------------------------------------------------

interface CapitalEventLike {
  capitalEventKind?: string;
  amount?: number;
  currency?: string;
}

interface FundingDrawnDownLike {
  amount?: number;
  currency?: string;
  maturityDate?: string;
}

interface InterbankLoanPlacedLike {
  principalZar?: number;
  maturityDate?: string | null;
  placementId?: string;
}

/**
 * Derive the supplemental BA 120 balance-sheet line items from the event store.
 *
 * All amounts are returned in ZAR cents (minor units) — consistent with the
 * `/ 100` reads in `platform/projections/alm-positions.ts` buildASFItems /
 * buildRSFItems.
 *
 * @param asOf - ISO 8601 run timestamp; events after this date are excluded.
 */
function deriveBalanceSheetPayload(asOf: string): {
  tier2CapitalZar: number;
  unsecuredWholesaleFundingGt1yZar: number;
  coveredBondsIssuedGt6mZar: number;
  unencumberedRetailLoansLt1yZar: number;
  unencumberedRetailLoansGt1yZar: number;
  encumberedAssetsZar: number;
  offBalanceSheetCommitmentsZar: number;
} {
  const asOfDate = new Date(asOf);
  const oneYearOut = new Date(asOfDate.getTime() + 365 * 86_400_000);
  const sixMonthsOut = new Date(asOfDate.getTime() + 182 * 86_400_000);

  // Tier 2 capital — sum tier2-issuance CapitalEvents (ZAR only)
  let tier2CapitalZar = 0;
  for (const ev of eventStore.replay({ type: "CapitalEvent" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as unknown as CapitalEventLike;
    if (p.capitalEventKind !== "tier2-issuance") continue;
    if (p.currency && p.currency !== "ZAR") continue;
    tier2CapitalZar += p.amount ?? 0;
  }

  // Unsecured wholesale funding > 1 year:
  //   (a) FundingDrawnDown — facility drawdowns with maturityDate > 1yr from asOf
  //   (b) InterbankLoanPlaced with maturityDate > 1yr (interbank liability side)
  // Note: FundingDrawnDown.amount is stored in whatever currency the facility is
  // denominated in; we only fold ZAR events here.
  let unsecuredWholesaleFundingGt1yZar = 0;

  for (const ev of eventStore.replay({ type: "FundingDrawnDown" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as unknown as FundingDrawnDownLike;
    if (p.currency && p.currency !== "ZAR") continue;
    if (!p.maturityDate) continue;
    const maturity = new Date(p.maturityDate);
    if (maturity <= oneYearOut) continue; // maturity must be > 1yr from asOf
    unsecuredWholesaleFundingGt1yZar += p.amount ?? 0;
  }

  for (const ev of eventStore.replay({ type: "InterbankLoanPlaced" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as unknown as InterbankLoanPlacedLike;
    if (!p.maturityDate) continue;
    const maturity = new Date(p.maturityDate);
    if (maturity <= oneYearOut) continue;
    // InterbankLoanPlaced.principalZar is already in ZAR cents
    unsecuredWholesaleFundingGt1yZar += p.principalZar ?? 0;
  }

  // Covered bonds > 6 months — not yet emitted (no CoveredBondIssued event class).
  // Build-phase zero is correct; this comment names the gap explicitly.
  // Gap: CoveredBondIssued event class (target: pre-licence, Bea + Ravi).
  const coveredBondsIssuedGt6mZar = 0;
  void sixMonthsOut; // referenced for future bond-issuance filter

  // Retail loans (unencumbered) — not yet emitted (no LoanOriginated / LoanBooked
  // event class in the current event-store schema at this stage).
  // Gap: LoanOriginated / LoanBooked event class folded here (Niko + Ravi, pre-licence).
  const unencumberedRetailLoansLt1yZar = 0;
  const unencumberedRetailLoansGt1yZar = 0;

  // Encumbered assets — not yet emitted (requires collateral pledge tracking).
  // Gap: CollateralPledged event class (Tomas + Ravi, pre-licence).
  const encumberedAssetsZar = 0;

  // Off-balance-sheet commitments — not yet emitted (requires commitment register).
  // Gap: CommitmentIssued event class (Niko + Imani, pre-licence).
  const offBalanceSheetCommitmentsZar = 0;

  return {
    tier2CapitalZar,
    unsecuredWholesaleFundingGt1yZar,
    coveredBondsIssuedGt6mZar,
    unencumberedRetailLoansLt1yZar,
    unencumberedRetailLoansGt1yZar,
    encumberedAssetsZar,
    offBalanceSheetCommitmentsZar,
  };
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

function projectionIdForDate(date: string): string {
  return `BSP-${date}`;
}

function alreadyEmitted(projectionId: string): boolean {
  for (const ev of eventStore.replay({ type: "BalanceSheetProjected" })) {
    const p = ev.payload as unknown as { projectionId?: string };
    if (p.projectionId === projectionId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Emit a `BalanceSheetProjected` event for the current ALM run date.
 *
 * Idempotent per day — if the projection for `asOf` already exists in the
 * event store the handler returns `eventsEmitted: 0` (no duplicate emission).
 * This is safe to call from `ravi:alm-run` at the end of each daily run.
 */
const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = ctx.asOf.slice(0, 10); // YYYY-MM-DD
  const projectionId = projectionIdForDate(date);

  // Idempotency gate — one projection per business date
  if (!ctx.dryRun && alreadyEmitted(projectionId)) {
    logger.info(
      { projectionId, asOf: ctx.asOf, dryRun: ctx.dryRun },
      "ravi:balance-sheet-projector — projection already emitted for this date; skipping",
    );
    return {
      eventsEmitted: 0,
      summary: `BalanceSheetProjected ${projectionId}: already emitted — no duplicate.`,
      ok: true,
    };
  }

  const payload = deriveBalanceSheetPayload(ctx.asOf);

  if (!ctx.dryRun) {
    const bsEvent = makeBalanceSheetProjected({
      asOf: ctx.asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        projectionId,
        asOf: ctx.asOf,
        ...payload,
      },
    });
    eventStore.append(bsEvent);
  }

  const eventsEmitted = ctx.dryRun ? 0 : 1;

  logger.info(
    {
      projectionId,
      asOf: ctx.asOf,
      tier2CapitalZar: payload.tier2CapitalZar,
      unsecuredWholesaleFundingGt1yZar: payload.unsecuredWholesaleFundingGt1yZar,
      coveredBondsIssuedGt6mZar: payload.coveredBondsIssuedGt6mZar,
      unencumberedRetailLoansLt1yZar: payload.unencumberedRetailLoansLt1yZar,
      unencumberedRetailLoansGt1yZar: payload.unencumberedRetailLoansGt1yZar,
      encumberedAssetsZar: payload.encumberedAssetsZar,
      offBalanceSheetCommitmentsZar: payload.offBalanceSheetCommitmentsZar,
      dryRun: ctx.dryRun,
      eventsEmitted,
    },
    "ravi:balance-sheet-projector — BalanceSheetProjected emitted",
  );

  return {
    eventsEmitted,
    summary: `BalanceSheetProjected ${projectionId}: tier2=${payload.tier2CapitalZar} ZAR-cents; wholesaleGt1y=${payload.unsecuredWholesaleFundingGt1yZar} ZAR-cents; all build-phase zero fields documented. ${eventsEmitted} event(s) emitted.`,
    ok: true,
  };
};

export default handler;
