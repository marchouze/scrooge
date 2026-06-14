// runtime/agents/bea-gl-treasury-interpreter-cutover.ts
//
// SLA full-retirement Batch 1 — treasury money-market cutover bridge
// (strangler-fig). The SECOND production seam (after the FX cutover) where
// Bea's universal GL posting engine routes the four treasury money-market
// families — deposit (MMD), funding-line, interbank-loan, repo — through the
// rules-as-data SLA interpreter (IFRS). The hand-coded repo-mmd-ibl.ts
// posting-rule functions this seam replaced have since been retired from tree
// (SLA full-retirement Stage 3b).
//
// SCOPE (D-SLA-ENGINE-RULES-AS-DATA, full-retirement Batch 1): the 15 treasury
// lifecycle event types below post via the interpreter. Every OTHER product
// family (bond, equity, IRS, payments) AND FX (already cut over) stays on its
// existing production path, UNTOUCHED.
//
//   DepositTaken                  → PR-MMD-001     [postingType: deposit-taken]
//   DepositInterestAccrued        → PR-MMD-ACCRUAL [deposit-interest-accrual]
//   DepositMatured                → PR-MMD-MAT     [deposit-maturity]   [enrichment]
//   DepositWithdrawnEarly         → PR-MMD-CANCEL  [deposit-cancellation] [enrichment]
//   FundingLineDrawn              → PR-FUNDING-001 [funding-drawdown]
//   FundingLineRepaid             → PR-FUNDING-END [funding-repayment]
//   InterbankLoanPlaced           → PR-IBL-001     [ibl-placement]
//   InterbankLoanInterestAccrued  → PR-IBL-ACCRUAL [ibl-interest-accrual]
//   InterbankLoanMatured          → PR-IBL-MAT     [ibl-maturity]       [enrichment]
//   InterbankLoanRecalledEarly    → PR-IBL-RECALL  [ibl-recall]         [enrichment]
//   RepoTradeOpened               → PR-REPO-001    [repo-trade-booking]
//   RepoStartLegSettled           → PR-REPO-SETTLE-START [memo; no GL]
//   RepoInterestAccrued           → PR-REPO-ACCRUAL[repo-interest-accrual]
//   RepoEndLegSettled             → PR-REPO-END    [repo-maturity]
//   RepoTradeTerminatedEarly      → PR-REPO-CANCEL [repo-cancellation]  [enrichment]
//
// The three OPENING postingTypes (deposit-taken / ibl-placement /
// repo-trade-booking) are UNCHANGED from the legacy engine so the
// `${sourceEventId}:${postingType}` idempotency key is preserved (no double-post
// on replay). The new accrual/maturity/early-termination/funding event types
// were not previously wired in production, so their postingTypes are new.
//
// ─── BYTE-FOR-BYTE PARITY ───────────────────────────────────────────────────
// Proven by tests/sla-treasury-lifecycle-parallel-run.test.ts. The legacy
// repo-mmd-ibl.ts functions are RETAINED as the parity reference
// (deprecated-for-production, not deleted).
//
// ─── ENRICHMENT ─────────────────────────────────────────────────────────────
// Four rules price off PRIOR-EVENT facts the triggering event does not carry:
//   - PR-MMD-MAT / PR-MMD-CANCEL need the originating DepositTaken's
//     depositCategory (and, for cancel, its principalZar). The legacy functions
//     default the category to "wholesale-non-operational"; this bridge resolves
//     the real category from the opening event and falls back to that SAME
//     default when the opening event is not found — preserving legacy parity.
//   - PR-IBL-MAT / PR-IBL-RECALL need the originating InterbankLoanPlaced's
//     placementType (and, for recall, its principalZar). Legacy default is
//     "fixed-term"; mirrored here.
//   - PR-REPO-CANCEL needs the bilateral unwind cash, which the legacy stub
//     could not access (it returned []). This bridge mirrors the legacy stub:
//     it supplies NO unwind-cash enrichment → the rule produces no GL (parity).
// The interpreter STAYS PURE — enrichment is computed by this caller (which has
// the event stream) and handed in as data.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 1, CEO-approved
// 2026-06-05). Citations: Principles/1-events-are-truth.md.

import {
  type SubLedgerLeg,
  subLedgerLegFromMoney,
} from "../../platform/accounting/fx-accounting-types";
import type { Representation } from "../../platform/accounting/sla/generated/sla-types";
import {
  type InterpretResult,
  type ProposedPosting,
  type UrgentCorrection,
  interpret,
} from "../../platform/accounting/sla/interpreter";
import { TREASURY_IFRS_RULES } from "../../platform/accounting/sla/rules/treasury-index";
import { legAmountMoney } from "../../platform/core/money-codec";
import type {
  DepositTakenPayload,
  InterbankLoanPlacedPayload,
} from "../../platform/event-store/event-types/repo-mmd-ibl";
import type { Event } from "../../platform/event-store/types";

// ---------------------------------------------------------------------------
// Event-type → SubLedgerPostingEmitted.postingType (idempotency-key component).
// The three OPENING strings are IDENTICAL to the legacy engine's so the
// `${sourceEventId}:${postingType}` key is unchanged.
// ---------------------------------------------------------------------------

export type TreasuryPostingType =
  | "deposit-taken"
  | "deposit-interest-accrual"
  | "deposit-maturity"
  | "deposit-cancellation"
  | "funding-drawdown"
  | "funding-repayment"
  | "ibl-placement"
  | "ibl-interest-accrual"
  | "ibl-maturity"
  | "ibl-recall"
  | "repo-trade-booking"
  | "repo-interest-accrual"
  | "repo-maturity"
  | "repo-cancellation";

const TREASURY_POSTING_TYPE: Readonly<Record<string, TreasuryPostingType>> = {
  DepositTaken: "deposit-taken",
  DepositInterestAccrued: "deposit-interest-accrual",
  DepositMatured: "deposit-maturity",
  DepositWithdrawnEarly: "deposit-cancellation",
  FundingLineDrawn: "funding-drawdown",
  FundingLineRepaid: "funding-repayment",
  InterbankLoanPlaced: "ibl-placement",
  InterbankLoanInterestAccrued: "ibl-interest-accrual",
  InterbankLoanMatured: "ibl-maturity",
  InterbankLoanRecalledEarly: "ibl-recall",
  RepoTradeOpened: "repo-trade-booking",
  RepoInterestAccrued: "repo-interest-accrual",
  RepoEndLegSettled: "repo-maturity",
  RepoTradeTerminatedEarly: "repo-cancellation",
  // RepoStartLegSettled is an intentional-no-impact memo (no postingType needed).
};

/** The treasury money-market event types the interpreter now owns in production. */
export const TREASURY_INTERPRETER_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  "DepositTaken",
  "DepositInterestAccrued",
  "DepositMatured",
  "DepositWithdrawnEarly",
  "FundingLineDrawn",
  "FundingLineRepaid",
  "InterbankLoanPlaced",
  "InterbankLoanInterestAccrued",
  "InterbankLoanMatured",
  "InterbankLoanRecalledEarly",
  "RepoTradeOpened",
  "RepoStartLegSettled",
  "RepoInterestAccrued",
  "RepoEndLegSettled",
  "RepoTradeTerminatedEarly",
]);

// Legacy defaults — preserved so parity holds when the opening event cannot be
// located (the legacy functions used these as default arguments).
const DEFAULT_DEPOSIT_CATEGORY: DepositTakenPayload["depositCategory"] =
  "wholesale-non-operational";
const DEFAULT_PLACEMENT_TYPE: InterbankLoanPlacedPayload["placementType"] = "fixed-term";

// ---------------------------------------------------------------------------
// Enrichment builders — resolve the originating event's facts. Mirrors the
// legacy posting-rule default arguments so the interpreter prices off identical
// facts (byte-for-byte parity preserved).
// ---------------------------------------------------------------------------

/**
 * Resolve the deposit-maturity / early-withdrawal enrichment from the
 * originating DepositTaken event (matched by depositId). Returns the category
 * (defaulting to the legacy default) and, for cancellations, the opening
 * principal. Returns `{ depositCategory: default }` if no opening event found —
 * exactly the legacy default-argument behaviour.
 */
export function resolveDepositEnrichment(
  events: ReadonlyArray<Event>,
  depositId: string,
): { depositCategory: DepositTakenPayload["depositCategory"]; openingPrincipalZar: number } {
  for (const e of events) {
    if (e.type !== "DepositTaken") continue;
    const p = e.payload as Partial<DepositTakenPayload>;
    if (p.depositId === depositId) {
      return {
        depositCategory: p.depositCategory ?? DEFAULT_DEPOSIT_CATEGORY,
        openingPrincipalZar: typeof p.principalZar === "number" ? Math.abs(p.principalZar) : 0,
      };
    }
  }
  return { depositCategory: DEFAULT_DEPOSIT_CATEGORY, openingPrincipalZar: 0 };
}

/**
 * Resolve the IBL maturity / recall enrichment from the originating
 * InterbankLoanPlaced event (matched by placementId). Mirrors the legacy
 * default placementType ("fixed-term").
 */
export function resolveIblEnrichment(
  events: ReadonlyArray<Event>,
  placementId: string,
): { placementType: InterbankLoanPlacedPayload["placementType"]; openingPrincipalZar: number } {
  for (const e of events) {
    if (e.type !== "InterbankLoanPlaced") continue;
    const p = e.payload as Partial<InterbankLoanPlacedPayload>;
    if (p.placementId === placementId) {
      return {
        placementType: p.placementType ?? DEFAULT_PLACEMENT_TYPE,
        openingPrincipalZar: typeof p.principalZar === "number" ? Math.abs(p.principalZar) : 0,
      };
    }
  }
  return { placementType: DEFAULT_PLACEMENT_TYPE, openingPrincipalZar: 0 };
}

// ---------------------------------------------------------------------------
// interpretTreasuryEvent — the production cutover seam.
// ---------------------------------------------------------------------------

export type TreasuryInterpretOutcome =
  | {
      readonly kind: "post";
      readonly postingType: TreasuryPostingType;
      readonly legs: SubLedgerLeg[];
      readonly urgentCorrections: readonly UrgentCorrection[];
      // SLA rule lineage (spec §8.1; versioning recon §6.3).
      readonly representation: Representation;
      readonly ruleId: string;
      readonly ruleVersion: number;
      /** Basel III business-line (BCBS d188); forwarded to SubLedgerPostingEmitted. */
      readonly baselBusinessLine?: string;
    }
  | { readonly kind: "no-gl"; readonly detail: string }
  | { readonly kind: "reject"; readonly detail: string };

function toSubLedgerLegs(post: ProposedPosting): SubLedgerLeg[] {
  // ProposedLeg.amount is the decimal MoneyWire source of truth emitted by the
  // SLA bigint engine (D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3);
  // lift it directly to SubLedgerLeg via subLedgerLegFromMoney — no amountMinor read.
  return post.legs.map((l) =>
    subLedgerLegFromMoney(
      { accountId: l.accountId, debitCredit: l.debitCredit },
      legAmountMoney(l),
    ),
  );
}

/**
 * Run the IFRS SLA interpreter for a single treasury money-market lifecycle
 * source event and map the result to the production engine's outcome shape.
 * `enrichment` is the pre-resolved prior-event context the caller computed; omit
 * for events that need none (recognition, accrual, funding, repo open/end).
 */
export function interpretTreasuryEvent(
  event: Event,
  asOf: string,
  enrichment?: unknown,
): TreasuryInterpretOutcome {
  const results: InterpretResult[] = interpret(
    {
      type: event.type,
      entity: event.entity ?? "LE-ZA-HOZ-BANK",
      as_of: event.as_of,
      payload: event.payload,
      enrichment,
    },
    TREASURY_IFRS_RULES,
    ["IFRS"],
    asOf,
  );

  const r = results.find((x) => x.representation === "IFRS");
  if (!r) {
    return { kind: "reject", detail: `interpreter produced no IFRS result for ${event.type}` };
  }

  if (r.outcome === "intentional-no-impact") {
    return { kind: "no-gl", detail: r.detail };
  }
  if (r.outcome === "rejected") {
    return { kind: "reject", detail: `${r.reason}: ${r.detail}` };
  }
  if (r.outcome === "ambiguous") {
    return {
      kind: "reject",
      detail: `ambiguous rule selection: ${r.candidateRuleIds.join(", ")} — ${r.detail}`,
    };
  }

  // outcome === "post"
  const legs = toSubLedgerLegs(r);
  if (legs.length === 0) {
    // A balanced posting with zero legs is the no-GL case (e.g. a guarded
    // early-termination with no enrichment) — matches the legacy `[]` skip.
    return { kind: "no-gl", detail: `${r.ruleId}: zero legs` };
  }

  const postingType = TREASURY_POSTING_TYPE[event.type];
  if (!postingType) {
    return { kind: "reject", detail: `no postingType mapped for treasury event ${event.type}` };
  }

  return {
    kind: "post",
    postingType,
    legs,
    urgentCorrections: r.urgentCorrections,
    representation: "IFRS",
    ruleId: r.ruleId,
    ruleVersion: r.ruleVersion,
    ...(r.baselBusinessLine !== undefined ? { baselBusinessLine: r.baselBusinessLine } : {}),
  };
}
