// runtime/agents/bea-gl-payments-interpreter-cutover.ts
//
// SLA full-retirement Batch 4 — payment / settlement cutover bridge
// (strangler-fig). The FIFTH and LAST production seam where Bea's universal GL
// posting engine routes the payment lifecycle through the rules-as-data SLA
// interpreter (IFRS). After this cutover EVERY product family routes through an
// interpreter bridge — the legacy posting-rule dispatch arms are fully
// strangled, and the hand-coded payments.ts posting-rule functions this seam
// replaced have since been retired from tree (SLA full-retirement Stage 3b).
//
// SCOPE (D-SLA-ENGINE-RULES-AS-DATA, full-retirement Batch 4): the three payment
// lifecycle event types below post via the interpreter. The already-ported
// families (FX, treasury, securities, IRD) stay on their interpreter bridges,
// UNTOUCHED.
//
//   PaymentInitiated              → PR-PAY-001  [payment-initiation]
//   PaymentSettled                → PR-PAY-002  [payment-settlement]
//   SettlementInstructionReceived → PR-SET-001  [settlement-instruction]
//
// All three postingType strings are UNCHANGED from the legacy engine so the
// `${sourceEventId}:${postingType}` idempotency key is preserved (no double-post
// on replay).
//
// ─── BYTE-FOR-BYTE PARITY ───────────────────────────────────────────────────
// Proven by tests/sla-payments-lifecycle-parallel-run.test.ts. The legacy
// payments.ts functions are RETAINED as the parity reference
// (deprecated-for-production, not deleted).
//
// ─── NO ENRICHMENT ──────────────────────────────────────────────────────────
// Every payment rule prices off a single integer minor-unit field carried
// directly on the triggering event (`netCash`, schema-positive). There is no
// float multiplication and no prior-event lookup; each rule emits two fixed legs.
// The interpreter STAYS PURE; this bridge passes NO enrichment (mirroring the IRD
// family).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 4, CEO-approved
// 2026-06-05). Citations: Principles/1-events-are-truth.md.

import type { SubLedgerLeg } from "../../platform/accounting/fx-accounting-types";
import type { Representation } from "../../platform/accounting/sla/generated/sla-types";
import {
  type InterpretResult,
  type ProposedPosting,
  type UrgentCorrection,
  interpret,
} from "../../platform/accounting/sla/interpreter";
import { PAYMENTS_IFRS_RULES } from "../../platform/accounting/sla/rules/payments-index";
import type { Event } from "../../platform/event-store/types";

// ---------------------------------------------------------------------------
// Event-type → SubLedgerPostingEmitted.postingType (idempotency-key component).
// All three strings are IDENTICAL to the legacy engine's so the
// `${sourceEventId}:${postingType}` key is unchanged.
// ---------------------------------------------------------------------------

export type PaymentsPostingType =
  | "payment-initiation"
  | "payment-settlement"
  | "settlement-instruction";

const PAYMENTS_POSTING_TYPE: Readonly<Record<string, PaymentsPostingType>> = {
  PaymentInitiated: "payment-initiation",
  PaymentSettled: "payment-settlement",
  SettlementInstructionReceived: "settlement-instruction",
};

/** The payment event types the interpreter now owns in production. */
export const PAYMENTS_INTERPRETER_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  "PaymentInitiated",
  "PaymentSettled",
  "SettlementInstructionReceived",
]);

// ---------------------------------------------------------------------------
// interpretPaymentEvent — the production cutover seam.
// ---------------------------------------------------------------------------

export type PaymentsInterpretOutcome =
  | {
      readonly kind: "post";
      readonly postingType: PaymentsPostingType;
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
 * Run the IFRS SLA interpreter for a single payment lifecycle source event and
 * map the result to the production engine's outcome shape. No enrichment is
 * required for any payment rule (each prices off the integer `netCash` field on
 * the triggering event).
 */
export function interpretPaymentEvent(event: Event, asOf: string): PaymentsInterpretOutcome {
  const results: InterpretResult[] = interpret(
    {
      type: event.type,
      entity: event.entity ?? "LE-ZA-HOZ-BANK",
      as_of: event.as_of,
      payload: event.payload,
    },
    PAYMENTS_IFRS_RULES,
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
    // A balanced posting with zero legs is the no-GL case. Payment rules are
    // `always` with `netCash`-positive amounts, so this never fires in practice;
    // retained for symmetry with the other bridges.
    return { kind: "no-gl", detail: `${r.ruleId}: zero legs` };
  }

  const postingType = PAYMENTS_POSTING_TYPE[event.type];
  if (!postingType) {
    return { kind: "reject", detail: `no postingType mapped for payment event ${event.type}` };
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
