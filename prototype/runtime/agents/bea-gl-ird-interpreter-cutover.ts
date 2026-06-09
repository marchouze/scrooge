// runtime/agents/bea-gl-ird-interpreter-cutover.ts
//
// SLA full-retirement Batch 3 — IRD-swap (OTC interest-rate swap) cutover bridge
// (strangler-fig). The FOURTH production seam (after FX, treasury and securities)
// where Bea's universal GL posting engine routes the IRD-swap lifecycle through
// the rules-as-data SLA interpreter (IFRS). The hand-coded ird-swaps.ts
// posting-rule functions this seam replaced have since been retired from tree
// (SLA full-retirement Stage 3b).
//
// SCOPE (D-SLA-ENGINE-RULES-AS-DATA, full-retirement Batch 3): the four IRD-swap
// lifecycle event types below post via the interpreter. Every OTHER product
// family (payments) AND the already-ported families (FX, treasury, securities)
// stay on their existing production path, UNTOUCHED.
//
//   IrdSwapTradeExecuted    → PR-IRS-001  [ird-swap-trade-booking]
//   IrdSwapPositionRevalued → PR-IRS-002  [ird-swap-revaluation]
//   IrdSwapCouponSettled    → PR-IRS-003  [ird-swap-coupon-settlement]
//   IrdSwapTerminated       → PR-IRS-TERM [ird-swap-termination]
//
// All four postingType strings are UNCHANGED from the legacy engine so the
// `${sourceEventId}:${postingType}` idempotency key is preserved (no double-post
// on replay).
//
// ─── BYTE-FOR-BYTE PARITY ───────────────────────────────────────────────────
// Proven by tests/sla-ird-lifecycle-parallel-run.test.ts. The legacy
// ird-swaps.ts functions are RETAINED as the parity reference
// (deprecated-for-production, not deleted).
//
// ─── NO ENRICHMENT ──────────────────────────────────────────────────────────
// Every IRD rule prices off integer minor-unit fields carried directly on the
// triggering event (npvMinor / npvDeltaMinor / npvOpeningMinor / npvClosingMinor
// / netCashMinor / terminationPaymentMinor / carryingNpvAtTerminationMinor /
// realisedPnlMinor). Unlike the bond family (float dirty-price) or the treasury
// maturity rules (prior-event category), there is no float multiplication and no
// prior-event lookup: the carrying NPV and realised P&L are already on the
// IrdSwapTerminated payload, and the net coupon is on IrdSwapCouponSettled. The
// interpreter STAYS PURE; this bridge passes NO enrichment.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 3, CEO-approved
// 2026-06-05). Citations: Principles/1-events-are-truth.md.

import type { SubLedgerLeg } from "../../platform/accounting/fx-accounting-types";
import type { Representation } from "../../platform/accounting/sla/generated/sla-types";
import {
  type InterpretResult,
  type ProposedPosting,
  type UrgentCorrection,
  interpret,
} from "../../platform/accounting/sla/interpreter";
import { IRD_IFRS_RULES } from "../../platform/accounting/sla/rules/ird-index";
import type { Event } from "../../platform/event-store/types";

// ---------------------------------------------------------------------------
// Event-type → SubLedgerPostingEmitted.postingType (idempotency-key component).
// All four strings are IDENTICAL to the legacy engine's so the
// `${sourceEventId}:${postingType}` key is unchanged.
// ---------------------------------------------------------------------------

export type IrdPostingType =
  | "ird-swap-trade-booking"
  | "ird-swap-revaluation"
  | "ird-swap-coupon-settlement"
  | "ird-swap-termination";

const IRD_POSTING_TYPE: Readonly<Record<string, IrdPostingType>> = {
  IrdSwapTradeExecuted: "ird-swap-trade-booking",
  IrdSwapPositionRevalued: "ird-swap-revaluation",
  IrdSwapCouponSettled: "ird-swap-coupon-settlement",
  IrdSwapTerminated: "ird-swap-termination",
};

/** The IRD-swap event types the interpreter now owns in production. */
export const IRD_INTERPRETER_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  "IrdSwapTradeExecuted",
  "IrdSwapPositionRevalued",
  "IrdSwapCouponSettled",
  "IrdSwapTerminated",
]);

// ---------------------------------------------------------------------------
// interpretIrdEvent — the production cutover seam.
// ---------------------------------------------------------------------------

export type IrdInterpretOutcome =
  | {
      readonly kind: "post";
      readonly postingType: IrdPostingType;
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
  return post.legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: Number(l.amountMinor),
    currency: l.currency,
  }));
}

/**
 * Run the IFRS SLA interpreter for a single IRD-swap lifecycle source event and
 * map the result to the production engine's outcome shape. No enrichment is
 * required for any IRD rule (all amounts are integer minor-unit fields on the
 * triggering event).
 */
export function interpretIrdEvent(event: Event, asOf: string): IrdInterpretOutcome {
  const results: InterpretResult[] = interpret(
    {
      type: event.type,
      entity: event.entity ?? "LE-ZA-HOZ-BANK",
      as_of: event.as_of,
      payload: event.payload,
    },
    IRD_IFRS_RULES,
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
    // `[]` skip (e.g. an at-market zero-NPV booking gated by non-zero-delta).
    return { kind: "no-gl", detail: `${r.ruleId}: zero legs` };
  }

  const postingType = IRD_POSTING_TYPE[event.type];
  if (!postingType) {
    return { kind: "reject", detail: `no postingType mapped for IRD event ${event.type}` };
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
