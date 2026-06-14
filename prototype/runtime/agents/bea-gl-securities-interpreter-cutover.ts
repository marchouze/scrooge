// runtime/agents/bea-gl-securities-interpreter-cutover.ts
//
// SLA full-retirement Batch 2 — securities (bond + equity) cutover bridge
// (strangler-fig). The THIRD production seam (after the FX and treasury
// cutovers) where Bea's universal GL posting engine routes the bond + equity
// lifecycles through the rules-as-data SLA interpreter (IFRS). The hand-coded
// bonds.ts / equities.ts posting-rule functions this seam replaced have since
// been retired from tree (SLA full-retirement Stage 3b).
//
// SCOPE (D-SLA-ENGINE-RULES-AS-DATA, full-retirement Batch 2): the nine bond +
// equity lifecycle event types below post via the interpreter. Every OTHER
// product family (IRS, payments) AND the already-ported families (FX, treasury)
// stay on their existing production path, UNTOUCHED.
//
//   BondTradeExecuted       → PR-BOND-001  [bond-trade-booking]    [enrichment]
//   BondInterestAccrued     → PR-BOND-EIR  [bond-interest-accrual]
//   BondPositionRevalued    → PR-BOND-002  [bond-revaluation]
//   BondMatured             → PR-BOND-MAT  [bond-maturity]         [enrichment]
//   BondSold                → PR-BOND-SALE [bond-sale]             [enrichment]
//   EquityTradeExecuted     → PR-EQ-001    [equity-trade-booking]
//   EquityPositionRevalued  → PR-EQ-002    [equity-revaluation]
//   EquityDividendAccrued   → PR-EQ-CA     [equity-dividend-accrual]
//   EquitySold              → PR-EQ-004    [equity-sale]
//
// All nine postingType strings are UNCHANGED from the legacy engine so the
// `${sourceEventId}:${postingType}` idempotency key is preserved (no double-post
// on replay).
//
// ─── BYTE-FOR-BYTE PARITY ───────────────────────────────────────────────────
// Proven by tests/sla-securities-lifecycle-parallel-run.test.ts. The legacy
// bonds.ts / equities.ts functions are RETAINED as the parity reference
// (deprecated-for-production, not deleted).
//
// ─── ENRICHMENT ─────────────────────────────────────────────────────────────
// Three bond rules price off facts the triggering event does not carry:
//   - PR-BOND-001 (booking) needs the integer dirty-price amount
//     `Math.round(nominalMinor * dirtyPricePercent / 100)`. `dirtyPricePercent`
//     is a non-integer; the integer-only SLA expression sandbox cannot multiply
//     by it (spec §4.2). This bridge pre-computes the amount with the SAME
//     `Math.round` the legacy `bondBankingBookJournals/bondTradingBookJournals`
//     use and hands it in as `enrichment.dirtyPriceAmountMinor` — byte-for-byte.
//   - PR-BOND-MAT / PR-BOND-SALE need the originating trade's `portfolio` (the
//     BondMatured/BondSold payloads do not carry it). The legacy engine
//     hard-codes "banking-book" for maturity and "trading-book" for sale. This
//     bridge resolves the REAL portfolio from the originating BondTradeExecuted
//     (matched by tradeId) and falls back to the SAME legacy default when the
//     opening event is not found — preserving parity, and improving correctness
//     when the opening event IS present.
// Equity rules need no enrichment (all amounts are flat minor-unit fields on the
// triggering event; FVTPL/FVOCI is carried on EquitySold.classification). The
// interpreter STAYS PURE — enrichment is computed by this caller (which has the
// event stream) and handed in as data.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 2, CEO-approved
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
import { SECURITIES_IFRS_RULES } from "../../platform/accounting/sla/rules/securities-index";
import { legAmountMoney } from "../../platform/core/money-codec";
import type { BondTradeExecutedPayload } from "../../platform/event-store/event-types/bond-accounting";
import type { Event } from "../../platform/event-store/types";

// ---------------------------------------------------------------------------
// Event-type → SubLedgerPostingEmitted.postingType (idempotency-key component).
// All nine strings are IDENTICAL to the legacy engine's so the
// `${sourceEventId}:${postingType}` key is unchanged.
// ---------------------------------------------------------------------------

export type SecuritiesPostingType =
  | "bond-trade-booking"
  | "bond-interest-accrual"
  | "bond-revaluation"
  | "bond-maturity"
  | "bond-sale"
  | "equity-trade-booking"
  | "equity-revaluation"
  | "equity-dividend-accrual"
  | "equity-sale";

const SECURITIES_POSTING_TYPE: Readonly<Record<string, SecuritiesPostingType>> = {
  BondTradeExecuted: "bond-trade-booking",
  BondInterestAccrued: "bond-interest-accrual",
  BondPositionRevalued: "bond-revaluation",
  BondMatured: "bond-maturity",
  BondSold: "bond-sale",
  EquityTradeExecuted: "equity-trade-booking",
  EquityPositionRevalued: "equity-revaluation",
  EquityDividendAccrued: "equity-dividend-accrual",
  EquitySold: "equity-sale",
};

/** The bond + equity event types the interpreter now owns in production. */
export const SECURITIES_INTERPRETER_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  "BondTradeExecuted",
  "BondInterestAccrued",
  "BondPositionRevalued",
  "BondMatured",
  "BondSold",
  "EquityTradeExecuted",
  "EquityPositionRevalued",
  "EquityDividendAccrued",
  "EquitySold",
]);

// Legacy hard-coded portfolio defaults — preserved so parity holds when the
// originating BondTradeExecuted cannot be located. The legacy engine passed
// "banking-book" to bondMaturityJournals and "trading-book" to bondSaleJournals.
export const DEFAULT_BOND_MATURITY_PORTFOLIO: BondTradeExecutedPayload["portfolio"] =
  "banking-book";
export const DEFAULT_BOND_SALE_PORTFOLIO: BondTradeExecutedPayload["portfolio"] = "trading-book";

// ---------------------------------------------------------------------------
// Enrichment builders
// ---------------------------------------------------------------------------

/**
 * The integer dirty-price amount for a BondTradeExecuted booking. Reproduces the
 * legacy `Math.round((nominalMinor * dirtyPricePercent) / 100)` EXACTLY (the
 * legacy `bondBankingBookJournals/bondTradingBookJournals` both use this). The
 * SLA expression sandbox is integer-only, so this float-derived amount is
 * computed HERE and handed to the pure interpreter as enrichment.
 */
export function bondDirtyPriceAmountMinor(payload: BondTradeExecutedPayload): number {
  return Math.round((payload.nominalMinor * payload.dirtyPricePercent) / 100);
}

/**
 * Resolve the bond maturity / sale portfolio from the originating
 * BondTradeExecuted (matched by tradeId). Returns the real portfolio, defaulting
 * to the supplied legacy default when no opening event is found — exactly the
 * legacy hard-coded default-argument behaviour (and strictly more correct when
 * the opening event is present).
 */
export function resolveBondPortfolio(
  events: ReadonlyArray<Event>,
  tradeId: string,
  fallback: BondTradeExecutedPayload["portfolio"],
): BondTradeExecutedPayload["portfolio"] {
  for (const e of events) {
    if (e.type !== "BondTradeExecuted") continue;
    const p = e.payload as Partial<BondTradeExecutedPayload>;
    if (
      p.tradeId === tradeId &&
      (p.portfolio === "banking-book" || p.portfolio === "trading-book")
    ) {
      return p.portfolio;
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// interpretSecuritiesEvent — the production cutover seam.
// ---------------------------------------------------------------------------

export type SecuritiesInterpretOutcome =
  | {
      readonly kind: "post";
      readonly postingType: SecuritiesPostingType;
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
 * Run the IFRS SLA interpreter for a single bond/equity lifecycle source event
 * and map the result to the production engine's outcome shape. `enrichment` is
 * the pre-resolved prior-event context the caller computed; omit for events that
 * need none (accrual, reval, dividend, equity booking).
 */
export function interpretSecuritiesEvent(
  event: Event,
  asOf: string,
  enrichment?: unknown,
): SecuritiesInterpretOutcome {
  const results: InterpretResult[] = interpret(
    {
      type: event.type,
      entity: event.entity ?? "LE-ZA-HOZ-BANK",
      as_of: event.as_of,
      payload: event.payload,
      enrichment,
    },
    SECURITIES_IFRS_RULES,
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
    // A balanced posting with zero legs is the no-GL case — matches the legacy
    // `[]` skip (e.g. a zero-amount accrual gated by the non-zero-delta cond).
    return { kind: "no-gl", detail: `${r.ruleId}: zero legs` };
  }

  const postingType = SECURITIES_POSTING_TYPE[event.type];
  if (!postingType) {
    return { kind: "reject", detail: `no postingType mapped for securities event ${event.type}` };
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
