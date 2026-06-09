// platform/event-store/event-types/repo-mmd-ibl.ts
//
// Repo, Money Market Deposit (bank as taker), and Interbank Loan (bank as
// lender) event-payload schemas.
//
// Covers three treasury instrument lifecycles introduced in WS1-PR1a:
//
//   Repo:
//     RepoTradeOpened         — opening: repo trade executed (bank sells
//                               collateral and agrees to repurchase)
//     RepoStartLegSettled     — start-leg cash exchange confirmed
//     RepoInterestAccrued     — daily repo rate accrual
//     RepoMarginCallIssued    — variation margin / additional collateral call
//     RepoEndLegSettled       — end-leg repurchase settled (normal terminal)
//     RepoTradeTerminatedEarly — trade unwound before end date (cancellation)
//
//   Money Market Deposit (MMD, bank as deposit taker):
//     DepositTaken            — opening: deposit received from counterparty
//     DepositInterestAccrued  — daily / periodic interest accrual
//     DepositMatured          — principal + interest repaid at maturity (normal)
//     DepositWithdrawnEarly   — depositor exercises early-withdrawal (cancellation)
//     DepositRolledOver       — deposit extended at maturity (in-flight amendment)
//
//   Funding line (wholesale borrowing, separate lifecycle from MMD):
//     FundingLineDrawn        — opening: bank draws on committed facility
//     FundingLineRepaid       — facility repaid in full (normal terminal)
//
//   Interbank Loan (IBL, bank as lender / cash placer):
//     InterbankLoanPlaced     — opening: bank places cash with another bank
//     InterbankLoanInterestAccrued — daily interest accrual
//     InterbankLoanMatured    — principal + interest received at maturity (normal)
//     InterbankLoanRecalledEarly — bank recalls the loan early (cancellation)
//
// Authority: WS1-PR1a (brief:ravi:ws1-pr1a-repo-mmd-ibl-event-types-lifecycle-regi:2026-05-23);
//            D-MARKETS-SCHEMA-FOUNDATION (CEO-approved);
//            IFRS 9 §3.1.1, §4.1.1, §5.4.1, §5.7.1;
//            Banks Act 94 of 1990 — Reg 26/27 (LCR/NSFR);
//            BCBS d365 (IRRBB); BA 110 / BA 120.
//
// Authors: Ravi (Treasury/ALM Engineer, engineering),
//          Eitan (Treasurer, governance)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Repo event schemas
// ---------------------------------------------------------------------------

// RepoTradeOpened — opening event for a repo lifecycle.
// The bank sells securities (collateral) with an agreement to repurchase them
// at a fixed price on the end-leg settlement date. From the bank's perspective
// this is a secured borrowing (IFRS 9 §3.2.4 — pass-through with recourse).

export const repoTradeOpenedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string(),
  /** Legal Entity Identifier of the repo counterparty. */
  counterpartyLei: z.string(),
  /** ISO 8601 date — start leg (initial cash inflow to the bank). */
  startLegSettlementDate: z.string(),
  /** ISO 8601 date — end leg (bank repurchases collateral). */
  endLegSettlementDate: z.string(),
  /** Cash received on start leg in ZAR minor units (cents). */
  startLegCashZar: z.number().int(),
  /** Agreed repurchase price in ZAR minor units (cents). */
  repurchasePriceZar: z.number().int(),
  /** Repo rate as decimal (e.g. 0.0825 = 8.25% per annum). */
  repoRateDecimal: z.number(),
  /** ISIN of the collateral security posted. */
  collateralIsin: z.string(),
  /** Face / nominal value of collateral in ZAR minor units. */
  collateralFaceValue: z.number().int(),
  /** Haircut applied to collateral as a percentage (e.g. 2.0 = 2%). */
  collateralHaircutPct: z.number(),
  /** Trading / treasury book identifier. */
  bookId: z.string(),
  /** Reference to the trader who executed the repo. */
  traderRef: z.string(),
  /** Reference to the FinancialInstrumentDefined instrumentId (REPO-ZAR-001). */
  instrumentRef: z.string(),
});

export type RepoTradeOpenedPayload = z.infer<typeof repoTradeOpenedPayloadSchema>;

export function makeRepoTradeOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoTradeOpenedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoTradeOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoTradeOpenedPayloadSchema.parse(args.payload),
  });
}

// RepoStartLegSettled — start-leg cash received by the bank.
// The counterparty has delivered the start-leg cash (bank's secured borrowing
// cash inflow). No additional GL impact beyond the opening recognition.

export const repoStartLegSettledPayloadSchema = z.object({
  /** Reference to the originating RepoTradeOpened tradeId. */
  tradeId: z.string(),
  /** Actual cash received in ZAR minor units (may differ from agreed by rounding). */
  cashZar: z.number().int(),
});

export type RepoStartLegSettledPayload = z.infer<typeof repoStartLegSettledPayloadSchema>;

export function makeRepoStartLegSettled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoStartLegSettledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoStartLegSettled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoStartLegSettledPayloadSchema.parse(args.payload),
  });
}

// RepoInterestAccrued — daily repo rate accrual.
// Accrual of repo interest (the difference between repurchase price and start-
// leg cash, amortised over the repo term under the effective interest method).

export const repoInterestAccruedPayloadSchema = z.object({
  /** Reference to the originating RepoTradeOpened tradeId. */
  tradeId: z.string(),
  /** Accrued interest for this period in ZAR minor units. */
  accruedInterestZar: z.number().int(),
  /** ISO 8601 date of this accrual entry. */
  accrualDate: z.string(),
});

export type RepoInterestAccruedPayload = z.infer<typeof repoInterestAccruedPayloadSchema>;

export function makeRepoInterestAccrued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoInterestAccruedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoInterestAccrued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoInterestAccruedPayloadSchema.parse(args.payload),
  });
}

// RepoMarginCallIssued — variation margin / additional collateral request.
// Emitted when the haircut-adjusted collateral value falls below the repo
// balance, requiring the bank to post additional collateral.

export const repoMarginCallIssuedPayloadSchema = z.object({
  /** Reference to the originating RepoTradeOpened tradeId. */
  tradeId: z.string(),
  /** Collateral shortfall in ZAR minor units. */
  shortfallZar: z.number().int(),
  /** ISIN of additional collateral to be delivered. */
  additionalCollateralIsin: z.string(),
});

export type RepoMarginCallIssuedPayload = z.infer<typeof repoMarginCallIssuedPayloadSchema>;

export function makeRepoMarginCallIssued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoMarginCallIssuedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoMarginCallIssued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoMarginCallIssuedPayloadSchema.parse(args.payload),
  });
}

// RepoEndLegSettled — end leg repurchase settled (normal terminal).
// The bank has repaid the repurchase price, received back its collateral,
// and the repo lifecycle is closed.

export const repoEndLegSettledPayloadSchema = z.object({
  /** Reference to the originating RepoTradeOpened tradeId. */
  tradeId: z.string(),
  /** Actual repurchase price paid in ZAR minor units. */
  repurchasePriceZar: z.number().int(),
});

export type RepoEndLegSettledPayload = z.infer<typeof repoEndLegSettledPayloadSchema>;

export function makeRepoEndLegSettled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoEndLegSettledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoEndLegSettled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoEndLegSettledPayloadSchema.parse(args.payload),
  });
}

// RepoTradeTerminatedEarly — early termination (cancellation terminal).
// Repo unwound before the agreed end-leg date. Cash is returned at par;
// any accrued interest is settled bilaterally.

export const repoTradeTerminatedEarlyPayloadSchema = z.object({
  /** Reference to the originating RepoTradeOpened tradeId. */
  tradeId: z.string(),
  /** Reason for early termination (free text). */
  reason: z.string(),
});

export type RepoTradeTerminatedEarlyPayload = z.infer<typeof repoTradeTerminatedEarlyPayloadSchema>;

export function makeRepoTradeTerminatedEarly(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RepoTradeTerminatedEarlyPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RepoTradeTerminatedEarly",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: repoTradeTerminatedEarlyPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Money Market Deposit (MMD) event schemas — bank as deposit taker
// ---------------------------------------------------------------------------

// DepositTaken — opening event for a money market deposit lifecycle.
// Bank receives a deposit from a counterparty. The deposit category determines
// the LCR outflow rate (BA 110 Table 1) and the GL sub-ledger used.
//
// NOTE: The exact name "DepositTaken" is required by alm-positions.ts gap stubs.

export const depositTakenPayloadSchema = z.object({
  /** Internal deposit identifier. */
  depositId: z.string(),
  /** Legal Entity Identifier of the depositing counterparty. */
  counterpartyLei: z.string(),
  /** Principal amount deposited in ZAR minor units (cents). */
  principalZar: z.number().int(),
  /** Agreed interest rate as decimal (e.g. 0.0795 = 7.95% per annum). */
  interestRateDecimal: z.number(),
  /** ISO 8601 date — scheduled maturity of the deposit. */
  maturityDate: z.string(),
  /**
   * Deposit category per BA 110 Table 1 LCR outflow classification:
   *   retail-stable            — stable retail (5% outflow rate)
   *   retail-less-stable       — less stable retail (10% outflow rate)
   *   wholesale-operational    — operational wholesale (25% outflow rate)
   *   wholesale-non-operational — non-operational wholesale (100% outflow rate)
   */
  depositCategory: z.enum([
    "retail-stable",
    "retail-less-stable",
    "wholesale-operational",
    "wholesale-non-operational",
  ]),
  /** Trading / treasury book identifier. */
  bookId: z.string(),
  /** Reference to the FinancialInstrumentDefined instrumentId (MMD-ZAR-001). */
  instrumentRef: z.string(),
});

export type DepositTakenPayload = z.infer<typeof depositTakenPayloadSchema>;

export function makeDepositTaken(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositTakenPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositTaken",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositTakenPayloadSchema.parse(args.payload),
  });
}

// DepositInterestAccrued — daily / periodic interest accrual on deposit.
// Bank accrues the interest expense owed to the depositor.

export const depositInterestAccruedPayloadSchema = z.object({
  /** Reference to the originating DepositTaken depositId. */
  depositId: z.string(),
  /** Accrued interest for this period in ZAR minor units. */
  accruedInterestZar: z.number().int(),
  /** ISO 8601 date of this accrual entry. */
  accrualDate: z.string(),
});

export type DepositInterestAccruedPayload = z.infer<typeof depositInterestAccruedPayloadSchema>;

export function makeDepositInterestAccrued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositInterestAccruedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositInterestAccrued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositInterestAccruedPayloadSchema.parse(args.payload),
  });
}

// DepositMatured — deposit matures at par (normal terminal).
// Bank repays the principal plus total interest to the depositor.

export const depositMaturedPayloadSchema = z.object({
  /** Reference to the originating DepositTaken depositId. */
  depositId: z.string(),
  /** Principal repaid in ZAR minor units. */
  principalZar: z.number().int(),
  /** Total interest paid at maturity in ZAR minor units. */
  interestPaidZar: z.number().int(),
});

export type DepositMaturedPayload = z.infer<typeof depositMaturedPayloadSchema>;

export function makeDepositMatured(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositMaturedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositMatured",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositMaturedPayloadSchema.parse(args.payload),
  });
}

// DepositWithdrawnEarly — depositor exercises early withdrawal (cancellation terminal).
// May include a penalty (breakage fee) retained by the bank.

export const depositWithdrawnEarlyPayloadSchema = z.object({
  /** Reference to the originating DepositTaken depositId. */
  depositId: z.string(),
  /** Early-withdrawal penalty retained by the bank in ZAR minor units (0 if none). */
  penaltyZar: z.number().int(),
});

export type DepositWithdrawnEarlyPayload = z.infer<typeof depositWithdrawnEarlyPayloadSchema>;

export function makeDepositWithdrawnEarly(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositWithdrawnEarlyPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositWithdrawnEarly",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositWithdrawnEarlyPayloadSchema.parse(args.payload),
  });
}

// DepositRolledOver — deposit extended at maturity (in-flight lifecycle event).
// The depositor opts to roll over the deposit instead of withdrawing. Creates
// a new deposit term; no cash movement.

export const depositRolledOverPayloadSchema = z.object({
  /** Reference to the originating DepositTaken depositId. */
  depositId: z.string(),
  /** ISO 8601 date — new maturity date after rollover. */
  newMaturityDate: z.string(),
  /** New interest rate as decimal after rollover. */
  newInterestRateDecimal: z.number(),
});

export type DepositRolledOverPayload = z.infer<typeof depositRolledOverPayloadSchema>;

export function makeDepositRolledOver(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DepositRolledOverPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DepositRolledOver",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: depositRolledOverPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Funding line event schemas — wholesale committed facility drawdown
// ---------------------------------------------------------------------------

// FundingLineDrawn — opening event for a funding line lifecycle.
// Bank draws down on a committed wholesale credit facility (e.g. from a
// correspondent bank or parent entity). Classified as non-operational wholesale
// for LCR purposes (BA 110 Table 2, 100% outflow rate).
//
// NOTE: The exact name "FundingLineDrawn" is required by alm-positions.ts gap stubs.

export const fundingLineDrawnPayloadSchema = z.object({
  /** Internal funding line identifier. */
  fundingLineId: z.string(),
  /** Amount drawn in ZAR minor units. */
  drawnAmountZar: z.number().int(),
  /** ISO 8601 date — scheduled repayment / maturity of this drawdown. */
  maturityDate: z.string(),
  /** Interest rate on this drawdown as decimal. */
  rateDecimal: z.number(),
});

export type FundingLineDrawnPayload = z.infer<typeof fundingLineDrawnPayloadSchema>;

export function makeFundingLineDrawn(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FundingLineDrawnPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FundingLineDrawn",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fundingLineDrawnPayloadSchema.parse(args.payload),
  });
}

// FundingLineRepaid — facility repaid in full (normal terminal).
// The bank has repaid the drawn amount to the facility provider.

export const fundingLineRepaidPayloadSchema = z.object({
  /** Reference to the originating FundingLineDrawn fundingLineId. */
  fundingLineId: z.string(),
  /** Amount repaid in ZAR minor units. */
  repaidAmountZar: z.number().int(),
});

export type FundingLineRepaidPayload = z.infer<typeof fundingLineRepaidPayloadSchema>;

export function makeFundingLineRepaid(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FundingLineRepaidPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FundingLineRepaid",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fundingLineRepaidPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Interbank Loan (IBL) event schemas — bank as lender / cash placer
// ---------------------------------------------------------------------------

// InterbankLoanPlaced — opening event for an interbank loan lifecycle.
// Bank places surplus liquidity with another financial institution.
// Two placement types:
//   fixed-term — agreed maturity date; maps to instrument IBL-FT-ZAR-001
//   call       — callable on demand; maps to instrument IBL-CALL-ZAR-001

export const interbankLoanPlacedPayloadSchema = z.object({
  /** Internal placement identifier. */
  placementId: z.string(),
  /** Legal Entity Identifier of the borrowing counterparty. */
  counterpartyLei: z.string(),
  /** Principal placed in ZAR minor units. */
  principalZar: z.number().int(),
  /** Interest rate as decimal (e.g. 0.0825 = 8.25% per annum). */
  rateDecimal: z.number(),
  /** ISO 8601 date — placement start date. */
  startDate: z.string(),
  /** ISO 8601 date — scheduled maturity (null for call placements). */
  maturityDate: z.string().nullable(),
  /**
   * Placement type:
   *   fixed-term — maturity date is set; maps to IBL-FT-ZAR-001
   *   call       — no fixed maturity; callable on notice; maps to IBL-CALL-ZAR-001
   */
  placementType: z.enum(["fixed-term", "call"]),
  /** Trading / treasury book identifier. */
  bookId: z.string(),
  /** Reference to the FinancialInstrumentDefined instrumentId. */
  instrumentRef: z.string(),
  /**
   * BA 200 credit-risk exposure class for the borrowing counterparty.
   * Drives the by-category fold of the events-first BA 200 (credit-risk
   * loans-and-advances) projection. Optional additive field; when absent the
   * BA 200 adapter defaults an interbank placement to "bank" (the borrowing
   * counterparty is a financial institution). Authority:
   * D-BA-RETURNS-FOLLOWON-BATCH; Reg 23.
   */
  exposureClass: z.enum(["sovereign", "bank", "corporate", "retail"]).optional(),
});

export type InterbankLoanPlacedPayload = z.infer<typeof interbankLoanPlacedPayloadSchema>;

export function makeInterbankLoanPlaced(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterbankLoanPlacedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterbankLoanPlaced",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interbankLoanPlacedPayloadSchema.parse(args.payload),
  });
}

// InterbankLoanInterestAccrued — daily interest accrual on interbank loan.
// Bank accrues interest income earned on the placed funds.

export const interbankLoanInterestAccruedPayloadSchema = z.object({
  /** Reference to the originating InterbankLoanPlaced placementId. */
  placementId: z.string(),
  /** Accrued interest for this period in ZAR minor units. */
  accruedInterestZar: z.number().int(),
  /** ISO 8601 date of this accrual entry. */
  accrualDate: z.string(),
});

export type InterbankLoanInterestAccruedPayload = z.infer<
  typeof interbankLoanInterestAccruedPayloadSchema
>;

export function makeInterbankLoanInterestAccrued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterbankLoanInterestAccruedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterbankLoanInterestAccrued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interbankLoanInterestAccruedPayloadSchema.parse(args.payload),
  });
}

// InterbankLoanMatured — loan matures, bank receives principal + interest (normal terminal).

export const interbankLoanMaturedPayloadSchema = z.object({
  /** Reference to the originating InterbankLoanPlaced placementId. */
  placementId: z.string(),
  /** Principal received back in ZAR minor units. */
  principalZar: z.number().int(),
  /** Total interest received at maturity in ZAR minor units. */
  interestReceivedZar: z.number().int(),
});

export type InterbankLoanMaturedPayload = z.infer<typeof interbankLoanMaturedPayloadSchema>;

export function makeInterbankLoanMatured(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterbankLoanMaturedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterbankLoanMatured",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interbankLoanMaturedPayloadSchema.parse(args.payload),
  });
}

// InterbankLoanRecalledEarly — bank exercises recall / early repayment (cancellation terminal).
// Bank demands repayment before the scheduled maturity (e.g. for a call placement
// or a fixed-term with a recall clause). Principal is returned; accrued interest
// may be separately settled.

export const interbankLoanRecalledEarlyPayloadSchema = z.object({
  /** Reference to the originating InterbankLoanPlaced placementId. */
  placementId: z.string(),
});

export type InterbankLoanRecalledEarlyPayload = z.infer<
  typeof interbankLoanRecalledEarlyPayloadSchema
>;

export function makeInterbankLoanRecalledEarly(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: InterbankLoanRecalledEarlyPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "InterbankLoanRecalledEarly",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: interbankLoanRecalledEarlyPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FundingLineCommitmentRecorded — new BA 110 off-balance-sheet event
//
// Emitted when the bank records a committed (undrawn) funding facility from
// a counterparty. These undrawn commitments must be reported on the SARB
// BA 110 off-balance-sheet return with the appropriate credit conversion
// factor (CCF) per Banks Act 94 Reg 23 / Basel III SA framework.
//
// A drawn-down on this commitment subsequently emits FundingLineDrawn.
//
// Authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO-approved 2026-06-09);
//            BA 110 — Off-Balance-Sheet items;
//            Basel III SA §2.5 — CCF for undrawn commitments;
//            Regulations Relating to Banks, Reg 23 (contingent liabilities).
// ---------------------------------------------------------------------------

export const fundingLineCommitmentRecordedPayloadSchema = z.object({
  /** Internal facility identifier — links to any subsequent FundingLineDrawn. */
  facilityId: z.string(),
  /** Legal Entity Identifier of the facility counterparty (provider). */
  counterpartyId: z.string(),
  /**
   * Total committed amount in minor currency units (the facility ceiling, not
   * the drawn amount — the undrawn portion is the BA 110 exposure).
   */
  committedAmountMinor: z.number().int(),
  /** ISO 4217 currency of the commitment. */
  currency: z.string().length(3),
  /** ISO 8601 scheduled maturity date of the commitment. */
  maturityDate: z.string(),
  /**
   * Facility type determines LCR outflow classification and CCF treatment:
   *   revolving — can be drawn, repaid, and re-drawn (highest CCF risk).
   *   term       — single draw to maturity; CCF applied to undrawn portion.
   *   standby    — contingent facility, standby letter of credit / backstop.
   */
  facilityType: z.enum(["revolving", "term", "standby"]),
  /**
   * Credit conversion factor (CCF) per Basel III SA / Reg 23 Reg 23 Table B:
   *   0.10 — unconditionally cancellable (SA CCF for retail undrawn lines)
   *   0.20 — short-term self-liquidating trade-related contingencies
   *   0.50 — revolving / standby committed >1 year
   *   1.00 — direct credit substitutes (e.g. financial guarantees)
   * Range [0, 1]. Use the applicable CCF at facility origination; amendments
   * emit a new FundingLineCommitmentRecorded with the updated CCF.
   */
  creditConversionFactor: z.number().min(0).max(1),
});

export type FundingLineCommitmentRecordedPayload = z.infer<
  typeof fundingLineCommitmentRecordedPayloadSchema
>;

export function makeFundingLineCommitmentRecorded(payload: FundingLineCommitmentRecordedPayload): {
  type: "FundingLineCommitmentRecorded";
  payload: FundingLineCommitmentRecordedPayload;
} {
  return { type: "FundingLineCommitmentRecorded" as const, payload };
}

// ---------------------------------------------------------------------------
// Typed event type registry for this module
// ---------------------------------------------------------------------------

export const REPO_MMD_IBL_TYPED_EVENT_TYPES = [
  // Repo
  "RepoTradeOpened",
  "RepoStartLegSettled",
  "RepoInterestAccrued",
  "RepoMarginCallIssued",
  "RepoEndLegSettled",
  "RepoTradeTerminatedEarly",
  // MMD
  "DepositTaken",
  "DepositInterestAccrued",
  "DepositMatured",
  "DepositWithdrawnEarly",
  "DepositRolledOver",
  // Funding line
  "FundingLineDrawn",
  "FundingLineRepaid",
  // IBL
  "InterbankLoanPlaced",
  "InterbankLoanInterestAccrued",
  "InterbankLoanMatured",
  "InterbankLoanRecalledEarly",
  // BA 110 off-balance-sheet (WS-BA-RETURNS-P1-SOURCING Phase 1)
  "FundingLineCommitmentRecorded",
] as const;

export type RepoMmdIblEventType = (typeof REPO_MMD_IBL_TYPED_EVENT_TYPES)[number];
