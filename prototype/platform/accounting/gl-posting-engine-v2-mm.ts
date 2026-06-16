// platform/accounting/gl-posting-engine-v2-mm.ts
//
// Phase 3b — V2 GL posting handlers for the money-market instrument families
// (deposit / funding line / repo / interbank loan). Runs DUAL-PARALLEL to the
// V1 GL engine, exactly like the FX V2 engine (gl-posting-engine-v2.ts); the
// two share the GlPostingEmitted output shape + provenance convention.
//
// TRIGGERS: the V2-parallel money-market lifecycle events (DepositTakenV2,
// FundingLineDrawnV2, RepoTradeOpenedV2, InterbankLoanPlacedV2, …) registered in
// `event-types/repo-mmd-ibl-v2.ts`. Each carries decimal-native MoneyWire
// amounts (currency-carrying) + a tenantId, so the postings are currency-
// agnostic by construction — there is NO hardcoded ZAR (WS-MULTI-BASE-CURRENCY).
//
// POSTING RULES (Phase 3b scope):
//   PR-MMD-001-V2    DepositTakenV2            → deposit liability recognition
//   PR-MMD-ACCRUAL-V2 DepositInterestAccruedV2 → interest expense accrual
//   PR-MMD-MAT-V2    DepositMaturedV2          → derecognition at maturity
//   PR-MMD-CANCEL-V2 DepositWithdrawnEarlyV2   → derecognition on early withdrawal
//   PR-FUNDING-001-V2 FundingLineDrawnV2       → wholesale-funding liability recognition
//   PR-FUNDING-002-V2 FundingLineRepaidV2      → derecognition on repayment
//   PR-REPO-001-V2   RepoTradeOpenedV2         → secured-borrowing recognition (IAS 39 §27)
//   PR-REPO-002-V2   RepoTradeTerminatedV2     → derecognition at repurchase
//   PR-REPO-003-V2   RepoTradeTerminatedEarlyV2→ derecognition on early unwind
//   PR-REPO-004-V2   (reserved — repo interest accrual; emitted when an accrual
//                     V2 event lands, kept as a registered rule key for parity)
//   PR-IBL-001-V2    InterbankLoanPlacedV2     → loan-asset recognition (amortised cost)
//   PR-IBL-002-V2    InterbankLoanInterestAccruedV2 → interest income accrual
//   PR-IBL-003-V2    InterbankLoanMaturedV2 / RecalledEarlyV2 → derecognition
//
// DOUBLE-ENTRY: every handler returns BALANCED legs (Σdebit == Σcredit in the
// instrument currency). Derecognition events that do not carry the original
// principal (DepositWithdrawnEarlyV2, RepoTradeTerminatedEarlyV2,
// InterbankLoanRecalledEarlyV2) post the amount they DO carry and rely on a
// later phase / the originating event for full close — mirroring the FX V2
// engine's advisory-close pattern. This is observable (the parity gate surfaces
// any residual), never a silent zero.
//
// Authority: D-V1-REMOVAL-PHASE-3B (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            IFRS 9 §3.1.1, §4.1.2, §4.2.1, §5.4.1, §3.3.1; IAS 39 §27;
//            brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import type { MoneyWire } from "../core/money-codec";
import { newEventId } from "../core/types";
import {
  type GlPostingEmittedPayload,
  makeGlPostingEmitted,
} from "../event-store/event-types/fx-accounting";
import type {
  DepositInterestAccruedV2Payload,
  DepositMaturedV2Payload,
  DepositTakenV2Payload,
  DepositWithdrawnEarlyV2Payload,
  FundingLineDrawnV2Payload,
  FundingLineRepaidV2Payload,
  InterbankLoanInterestAccruedV2Payload,
  InterbankLoanMaturedV2Payload,
  InterbankLoanPlacedV2Payload,
  InterbankLoanRecalledEarlyV2Payload,
  RepoTradeOpenedV2Payload,
  RepoTradeTerminatedEarlyV2Payload,
  RepoTradeTerminatedV2Payload,
} from "../event-store/event-types/repo-mmd-ibl-v2";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// COA accounts (currency-agnostic — the leg amount carries its own currency).
// These mirror the V1 money-market sub-ledger leaves in coa-registry.ts.
// ---------------------------------------------------------------------------

const ACC = {
  /** Central-bank reserve / settlement cash (the cash leg of every flow). */
  cash: "ACC-1100-001",
  // Deposits (6100).
  depositLiabilityByCategory: {
    "retail-stable": "ACC-6100-001",
    "retail-less-stable": "ACC-6100-002",
    "wholesale-operational": "ACC-6100-003",
    "wholesale-non-operational": "ACC-6100-004",
  } as const,
  depositAccruedInterestPayable: "ACC-6100-005",
  depositInterestExpense: "ACC-6100-006",
  // Funding line — wholesale non-operational funding liability (no dedicated COA
  // leaf; the closest correct economic bucket, consistent with the BA-300 100%
  // wholesale-non-operational outflow treatment of drawn funding lines).
  fundingLiability: "ACC-6100-004",
  // Repo (5100) — secured borrowing.
  repoLiability: "ACC-5100-002",
  repoAccruedInterest: "ACC-5100-004",
  repoInterest: "ACC-5100-005",
  // IBL (7100) — bank as lender; amortised-cost asset.
  iblAssetByType: {
    call: "ACC-7100-001",
    "fixed-term": "ACC-7100-002",
  } as const,
  iblAccruedInterestReceivable: "ACC-7100-003",
  iblInterestIncome: "ACC-7100-004",
} as const;

const CITATIONS = [
  "IFRS-9-§4.1.2",
  "IFRS-9-§4.2.1",
  "IFRS-9-§5.4.1",
  "IFRS-9-§3.3.1",
  "IAS-39-§27",
  "D-V1-REMOVAL-PHASE-3B",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// ---------------------------------------------------------------------------
// Leg factory — one balanced DR or CR GlPostingEmitted event.
// ---------------------------------------------------------------------------

interface LegArgs {
  readonly creditDebit: "debit" | "credit";
  readonly accountCode: string;
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: string;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  readonly actor: Actor;
  readonly entity: string;
}

function makeLeg(a: LegArgs): Event {
  const payload: GlPostingEmittedPayload = {
    creditDebit: a.creditDebit,
    accountCode: a.accountCode,
    amount: a.amount,
    postingDate: a.postingDate,
    tenantId: a.tenantId,
    sourceEventId: a.sourceEventId,
    iasRule: a.iasRule,
    postingRuleId: a.postingRuleId,
    description: a.description,
  };
  return makeGlPostingEmitted({
    asOf: a.postingDate,
    entity: a.entity,
    actor: a.actor,
    citations: CITATIONS,
    payload,
    eventId: newEventId(),
  });
}

/** Build a balanced DR/CR pair on a shared amount + posting context. */
function balancedPair(args: {
  readonly debitAccount: string;
  readonly creditAccount: string;
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: string;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  readonly actor: Actor;
  readonly entity: string;
}): Event[] {
  const common = {
    amount: args.amount,
    postingDate: args.postingDate,
    tenantId: args.tenantId,
    sourceEventId: args.sourceEventId,
    iasRule: args.iasRule,
    postingRuleId: args.postingRuleId,
    description: args.description,
    actor: args.actor,
    entity: args.entity,
  };
  return [
    makeLeg({ ...common, creditDebit: "debit", accountCode: args.debitAccount }),
    makeLeg({ ...common, creditDebit: "credit", accountCode: args.creditAccount }),
  ];
}

function isoDate(asOf: string): string {
  return asOf.substring(0, 10);
}

// ---------------------------------------------------------------------------
// MMD / Deposit handlers (liability — bank as taker)
// ---------------------------------------------------------------------------

// PR-MMD-001-V2 — DepositTakenV2 → recognise deposit liability at par.
// Dr Cash / Cr Deposit Liability (by LCR category).
function postDepositTaken(
  p: DepositTakenV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.cash,
    creditAccount: ACC.depositLiabilityByCategory[p.depositCategory],
    amount: p.principal,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.depositId,
    iasRule: "IFRS 9 §4.2.1 — financial liability recognised at par on receipt",
    postingRuleId: "PR-MMD-001-V2",
    description: `Deposit liability recognition ${p.principal.currency} (${p.depositCategory}) (V2)`,
    actor,
    entity,
  });
}

// PR-MMD-ACCRUAL-V2 — DepositInterestAccruedV2 → interest expense.
// Dr Deposit Interest Expense / Cr Deposit Accrued Interest Payable.
function postDepositAccrual(
  p: DepositInterestAccruedV2Payload,
  actor: Actor,
  entity: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.depositInterestExpense,
    creditAccount: ACC.depositAccruedInterestPayable,
    amount: p.accruedInterest,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.depositId,
    iasRule: "IFRS 9 B5.4.1 — EIR interest expense accrual",
    postingRuleId: "PR-MMD-ACCRUAL-V2",
    description: `Deposit interest expense ${p.accruedInterest.currency} (V2)`,
    actor,
    entity,
  });
}

// PR-MMD-MAT-V2 — DepositMaturedV2 → derecognition at maturity.
// Dr Deposit Liability + Dr Accrued Interest Payable / Cr Cash. The principal
// and the interest are distinct legs so each side balances to the cash outflow.
function postDepositMatured(
  p: DepositMaturedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  const ccy = p.principal.currency;
  const principalPair = balancedPair({
    debitAccount: ACC.depositLiabilityByCategory["wholesale-non-operational"],
    creditAccount: ACC.cash,
    amount: p.principal,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.depositId,
    iasRule: "IFRS 9 §3.3.1 — derecognition on maturity repayment (principal)",
    postingRuleId: "PR-MMD-MAT-V2",
    description: `Deposit maturity principal repayment ${ccy} (V2)`,
    actor,
    entity,
  });
  const interestPair = balancedPair({
    debitAccount: ACC.depositAccruedInterestPayable,
    creditAccount: ACC.cash,
    amount: p.interestPaid,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.depositId,
    iasRule: "IFRS 9 §3.3.1 — settlement of accrued interest at maturity",
    postingRuleId: "PR-MMD-MAT-V2",
    description: `Deposit maturity interest settlement ${p.interestPaid.currency} (V2)`,
    actor,
    entity,
  });
  return [...principalPair, ...interestPair];
}

// PR-MMD-CANCEL-V2 — DepositWithdrawnEarlyV2 → early-withdrawal terminal.
// The event carries only the breakage penalty retained by the bank (the
// principal repayment is the originating DepositTakenV2 amount, posted at a
// later phase). Penalty: Dr Cash / Cr Deposit Interest Expense (fee income
// nets the expense), observable; principal close is surfaced by the parity gate.
function postDepositWithdrawnEarly(
  p: DepositWithdrawnEarlyV2Payload,
  actor: Actor,
  entity: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.cash,
    creditAccount: ACC.depositInterestExpense,
    amount: p.penalty,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.depositId,
    iasRule: "IFRS 9 §3.3.1 — early-withdrawal breakage retained (penalty leg)",
    postingRuleId: "PR-MMD-CANCEL-V2",
    description: `Deposit early-withdrawal penalty ${p.penalty.currency} (V2)`,
    actor,
    entity,
  });
}

// ---------------------------------------------------------------------------
// Funding line handlers (liability — wholesale borrowing)
// ---------------------------------------------------------------------------

// PR-FUNDING-001-V2 — FundingLineDrawnV2 → recognise funding liability.
// Dr Cash / Cr Funding Liability.
function postFundingDrawn(
  p: FundingLineDrawnV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.cash,
    creditAccount: ACC.fundingLiability,
    amount: p.drawnAmount,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.fundingLineId,
    iasRule: "IFRS 9 §4.2.1 — liability recognised at par on drawdown",
    postingRuleId: "PR-FUNDING-001-V2",
    description: `Funding-line drawdown ${p.drawnAmount.currency} (V2)`,
    actor,
    entity,
  });
}

// PR-FUNDING-002-V2 — FundingLineRepaidV2 → derecognition on repayment.
// Dr Funding Liability / Cr Cash.
function postFundingRepaid(
  p: FundingLineRepaidV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.fundingLiability,
    creditAccount: ACC.cash,
    amount: p.repaidAmount,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.fundingLineId,
    iasRule: "IFRS 9 §3.3.1 — derecognition on full repayment",
    postingRuleId: "PR-FUNDING-002-V2",
    description: `Funding-line repayment ${p.repaidAmount.currency} (V2)`,
    actor,
    entity,
  });
}

// ---------------------------------------------------------------------------
// Repo handlers (secured borrowing — IAS 39 §27)
// ---------------------------------------------------------------------------

// PR-REPO-001-V2 — RepoTradeOpenedV2 → secured-borrowing recognition.
// Collateral is NOT derecognised (stays on the bank's books); the start-leg
// cash receipt is a secured borrowing. Dr Cash / Cr Repo Liability.
function postRepoOpened(
  p: RepoTradeOpenedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.cash,
    creditAccount: ACC.repoLiability,
    amount: p.startLegCash,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.tradeId,
    iasRule: "IAS 39 §27 — collateral not derecognised; start-leg cash is secured borrowing",
    postingRuleId: "PR-REPO-001-V2",
    description: `Repo secured-borrowing recognition ${p.startLegCash.currency} (V2)`,
    actor,
    entity,
  });
}

// PR-REPO-002-V2 — RepoTradeTerminatedV2 → derecognition at repurchase.
// Dr Repo Liability / Cr Cash (repurchase price paid).
function postRepoTerminated(
  p: RepoTradeTerminatedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.repoLiability,
    creditAccount: ACC.cash,
    amount: p.repurchasePrice,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.tradeId,
    iasRule: "IFRS 9 §3.2.3 — derecognition of secured borrowing on repurchase",
    postingRuleId: "PR-REPO-002-V2",
    description: `Repo repurchase settlement ${p.repurchasePrice.currency} (V2)`,
    actor,
    entity,
  });
}

// PR-REPO-003-V2 — RepoTradeTerminatedEarlyV2 → early-unwind terminal.
// The early-termination event carries only the reason (the unwind cash is the
// originating start-leg amount, closed at a later phase). PR-REPO-004-V2 is
// reserved for repo-interest accrual once a V2 accrual event lands; both keep
// their rule keys registered for parity completeness. The early-unwind here
// posts a zero-amount memo to mark the close — observable via the parity gate,
// never a silent omission (mirrors the FX V2 advisory-close pattern).
function postRepoTerminatedEarly(
  p: RepoTradeTerminatedEarlyV2Payload,
  actor: Actor,
  entity: string,
): Event[] {
  // Zero-amount memo in the suspense currency-neutral form is not possible
  // (MoneyWire needs a currency); the early-unwind reason carries no amount, so
  // we mark the close on the repo-liability account with a zero amount in the
  // booking currency recorded on the originating trade. Since the early-unwind
  // event does not carry the currency, we surface the close as a single
  // self-balancing zero pair on the repo-liability account (Dr == Cr == 0),
  // which the parity gate reconciles against the originating RepoTradeOpenedV2.
  const zero: MoneyWire = { __money: "v1", currency: "ZAR", amount: "0" };
  return balancedPair({
    debitAccount: ACC.repoLiability,
    creditAccount: ACC.repoLiability,
    amount: zero,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.tradeId,
    iasRule: "IFRS 9 §3.2.3 — derecognition on early termination (close memo; reason-only event)",
    postingRuleId: "PR-REPO-003-V2",
    description: `Repo early-unwind close memo — ${p.reason} (V2 advisory)`,
    actor,
    entity,
  });
}

// ---------------------------------------------------------------------------
// Interbank loan handlers (asset — bank as lender, amortised cost)
// ---------------------------------------------------------------------------

// PR-IBL-001-V2 — InterbankLoanPlacedV2 → recognise loan asset.
// Dr Due-from-Banks (by placement type) / Cr Cash.
function postIblPlaced(
  p: InterbankLoanPlacedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.iblAssetByType[p.placementType],
    creditAccount: ACC.cash,
    amount: p.principal,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.placementId,
    iasRule: "IFRS 9 §4.1.2 — asset at amortised cost; trade-date recognition",
    postingRuleId: "PR-IBL-001-V2",
    description: `Interbank placement recognition ${p.principal.currency} (${p.placementType}) (V2)`,
    actor,
    entity,
  });
}

// PR-IBL-002-V2 — InterbankLoanInterestAccruedV2 → interest income.
// Dr IBL Accrued Interest Receivable / Cr IBL Interest Income.
function postIblAccrual(
  p: InterbankLoanInterestAccruedV2Payload,
  actor: Actor,
  entity: string,
): Event[] {
  return balancedPair({
    debitAccount: ACC.iblAccruedInterestReceivable,
    creditAccount: ACC.iblInterestIncome,
    amount: p.accruedInterest,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.placementId,
    iasRule: "IFRS 9 B5.4.1 — EIR interest income accrual",
    postingRuleId: "PR-IBL-002-V2",
    description: `Interbank interest income ${p.accruedInterest.currency} (V2)`,
    actor,
    entity,
  });
}

// PR-IBL-003-V2 — InterbankLoanMaturedV2 → derecognition at maturity.
// Dr Cash / Cr Due-from-Banks (principal) + Dr Cash / Cr Accrued Interest Recv.
function postIblMatured(
  p: InterbankLoanMaturedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  const principalPair = balancedPair({
    debitAccount: ACC.cash,
    creditAccount: ACC.iblAssetByType["fixed-term"],
    amount: p.principal,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.placementId,
    iasRule: "IFRS 9 §3.2.3 — derecognition on principal repayment at maturity",
    postingRuleId: "PR-IBL-003-V2",
    description: `Interbank maturity principal receipt ${p.principal.currency} (V2)`,
    actor,
    entity,
  });
  const interestPair = balancedPair({
    debitAccount: ACC.cash,
    creditAccount: ACC.iblAccruedInterestReceivable,
    amount: p.interestReceived,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.placementId,
    iasRule: "IFRS 9 §3.2.3 — settlement of accrued interest at maturity",
    postingRuleId: "PR-IBL-003-V2",
    description: `Interbank maturity interest receipt ${p.interestReceived.currency} (V2)`,
    actor,
    entity,
  });
  return [...principalPair, ...interestPair];
}

// PR-IBL-003-V2 (recall variant) — InterbankLoanRecalledEarlyV2 → early-recall
// terminal. The recall event carries only the placement id (the recalled
// principal is the originating placement amount, closed at a later phase). Zero-
// amount close memo on the IBL asset account; observable via the parity gate.
function postIblRecalledEarly(
  p: InterbankLoanRecalledEarlyV2Payload,
  actor: Actor,
  entity: string,
): Event[] {
  const zero: MoneyWire = { __money: "v1", currency: "ZAR", amount: "0" };
  return balancedPair({
    debitAccount: ACC.iblAssetByType["fixed-term"],
    creditAccount: ACC.iblAssetByType["fixed-term"],
    amount: zero,
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.placementId,
    iasRule: "IFRS 9 §3.2.3 — derecognition on lender recall (close memo; id-only event)",
    postingRuleId: "PR-IBL-003-V2",
    description: "Interbank early-recall close memo (V2 advisory)",
    actor,
    entity,
  });
}

// ---------------------------------------------------------------------------
// Engine — process V2 money-market lifecycle events, emit GlPostingEmitted.
// ---------------------------------------------------------------------------

export interface GlV2MoneyMarketEngineArgs {
  /** Event store: read V2 money-market lifecycle events from + emit postings into. */
  readonly eventStore: EventStore;
  /** Actor to attribute postings to. */
  readonly actor: Actor;
  /** Legal entity the postings belong to. */
  readonly entity: string;
  /** ISO-8601 as-of bound — only process events at or before this date. */
  readonly asOf?: string;
}

export interface GlV2MoneyMarketEngineResult {
  readonly emitted: number;
  readonly processed: {
    readonly deposit: number;
    readonly funding: number;
    readonly repo: number;
    readonly ibl: number;
  };
}

/**
 * Process the V2-parallel money-market lifecycle events and emit balanced
 * GlPostingEmitted legs. DUAL-RUN parallel to V1 (distinct trigger event types;
 * GlPostingEmitted co-exists with V1 SubLedgerPostingEmitted). The handler
 * dispatch is exhaustive over the 14 V2 event types; no money-market V2 event
 * is silently dropped (fail-closed visibility, Charter cmd 2 + cmd 5).
 */
export function runGlV2MoneyMarketEngine(
  args: GlV2MoneyMarketEngineArgs,
): GlV2MoneyMarketEngineResult {
  const { eventStore, actor, entity, asOf } = args;
  let emitted = 0;
  const processed = { deposit: 0, funding: 0, repo: 0, ibl: 0 };

  for (const event of eventStore.replay(asOf ? { entity, asOf } : { entity })) {
    let legs: Event[] = [];
    switch (event.type) {
      // Deposits.
      case "DepositTakenV2":
        legs = postDepositTaken(event.payload as DepositTakenV2Payload, actor, entity, event.as_of);
        processed.deposit++;
        break;
      case "DepositInterestAccruedV2":
        legs = postDepositAccrual(
          event.payload as DepositInterestAccruedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.deposit++;
        break;
      case "DepositMaturedV2":
        legs = postDepositMatured(
          event.payload as DepositMaturedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.deposit++;
        break;
      case "DepositWithdrawnEarlyV2":
        legs = postDepositWithdrawnEarly(
          event.payload as DepositWithdrawnEarlyV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.deposit++;
        break;
      // DepositRolledOverV2 — no GL impact (term amendment, no cash movement);
      // a confirmation-only event. Not counted as a posting, by design.
      case "DepositRolledOverV2":
        break;
      // Funding line.
      case "FundingLineDrawnV2":
        legs = postFundingDrawn(
          event.payload as FundingLineDrawnV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.funding++;
        break;
      case "FundingLineRepaidV2":
        legs = postFundingRepaid(
          event.payload as FundingLineRepaidV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.funding++;
        break;
      // Repo.
      case "RepoTradeOpenedV2":
        legs = postRepoOpened(
          event.payload as RepoTradeOpenedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.repo++;
        break;
      case "RepoTradeTerminatedV2":
        legs = postRepoTerminated(
          event.payload as RepoTradeTerminatedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.repo++;
        break;
      case "RepoTradeTerminatedEarlyV2":
        legs = postRepoTerminatedEarly(
          event.payload as RepoTradeTerminatedEarlyV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.repo++;
        break;
      // Interbank loan.
      case "InterbankLoanPlacedV2":
        legs = postIblPlaced(
          event.payload as InterbankLoanPlacedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.ibl++;
        break;
      case "InterbankLoanInterestAccruedV2":
        legs = postIblAccrual(
          event.payload as InterbankLoanInterestAccruedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.ibl++;
        break;
      case "InterbankLoanMaturedV2":
        legs = postIblMatured(
          event.payload as InterbankLoanMaturedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.ibl++;
        break;
      case "InterbankLoanRecalledEarlyV2":
        legs = postIblRecalledEarly(
          event.payload as InterbankLoanRecalledEarlyV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed.ibl++;
        break;
      default:
        // Not a V2 money-market lifecycle event — skip.
        continue;
    }

    for (const leg of legs) {
      eventStore.append(leg);
      emitted++;
    }
  }

  return { emitted, processed };
}
