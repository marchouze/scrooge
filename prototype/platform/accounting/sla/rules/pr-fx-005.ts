// platform/accounting/sla/rules/pr-fx-005.ts
//
// PR-FX-005 — IFRS-9 default-recognition on FxSettlementFailed. Rules-as-data
// form of the legacy `fxSettlementFailedJournals`
// (platform/accounting/posting-rules/fx-spot.ts).
//
// ─── CONTEXT-ENRICHMENT (brief deliverable 2) ──────────────────────────────
// The `FxSettlementFailed` payload carries `failureKind` + `legStatus` but NOT
// the currency / amount / ZAR-equivalent of the failed RECEIVE leg — those live
// on the ORIGINATING `FxTradeExecuted`. The caller (GL posting engine) resolves
// them via `resolveFailedReceiveLeg(...)` and passes them in as a PRE-RESOLVED
// enrichment object: `event.enrichment.failedReceiveLeg.{currency, amountMinor,
// zarEquivalentMinor}`. The interpreter stays PURE — it never reads the event
// store; the enrichment is a typed input. (See interpreter.ts InterpreterEvent
// docblock for the full enrichment-model rationale.)
//
// ─── LEGACY BEHAVIOUR (one-leg-delivered = Herstatt-active only) ────────────
//   failureKind ∈ {neither-delivered, operational-delay} → NO GL (FVTPL out of
//     ECL scope, IFRS 9 §5.5.1). No lines fire → zero legs.
//   failureKind == "one-leg-delivered":
//     (a) Reclassify FVTPL receivable → amortised-cost defaulted claim
//         (per receive-leg currency):
//           Dr fx.settlement_failed_receivable[recv-ccy]  abs(amountMinor)
//           Cr fx.receivable[recv-ccy]                     abs(amountMinor)
//     (b) Stage-3 lifetime ECL = 100% of receivable's ZAR equivalent (ZAR):
//           Dr fx.credit_loss_expense                      abs(zarEquivalentMinor)
//           Cr fx.ecl_allowance_settlement_failed          abs(zarEquivalentMinor)
//
// The failureKind branch is expressed in DATA via per-line `when` predicates on
// `event.failureKind`. NOTE: this rule does NOT enforce the legacy function's
// legStatus assertions (payLegDelivered===true && receiveLegDelivered===false)
// — the caller enrichment step already validates classification before
// supplying `failedReceiveLeg`; if the caller declines to enrich a malformed
// payload, no `one-leg-delivered` legs can fire (the amount paths are absent →
// loud UnknownPathError, never a silent wrong posting).
//
// Per-currency resolution (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE): a non-ZAR/USD
// receive-leg currency without a dedicated settlement-failed-receivable account
// account-resolution-misses → suspense + urgent-correction alert.
//
// Authored by: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05);
//            D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05).
// Cites: IFRS 9 §5.5 (impairment), §5.5.13 (credit-impaired measurement),
//        §4.4.1 (reclassification), IAS 21 §23, IAS 1 §82(ba).

import type { SlaRule } from "../generated/sla-types";

// Herstatt branch AND a non-zero amount on the respective leg — mirrors the
// legacy function's `if (absAmount > 0)` / `if (absZar > 0)` guards so a
// zero-amount leg emits no line (byte-for-byte parity).
const HERSTATT_RECV =
  'event.failureKind == "one-leg-delivered" && abs(event.enrichment.failedReceiveLeg.amountMinor) > 0';
const HERSTATT_ECL =
  'event.failureKind == "one-leg-delivered" && abs(event.enrichment.failedReceiveLeg.zarEquivalentMinor) > 0';

export const PR_FX_005: SlaRule = {
  rule_id: "PR-FX-005",
  representation: "IFRS",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FxSettlementFailed",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
  },
  condition: {
    kind: "always",
    detail: "IFRS 9 §5.5.1 — default-recognition; non-Herstatt branches fire no lines (FVTPL out of ECL scope)",
  },
  lines: [
    // (a) Reclassify receivable → settlement-failed receivable (recv-ccy).
    {
      account: {
        logical: "fx.settlement_failed_receivable",
        currency: "event.enrichment.failedReceiveLeg.currency",
      },
      side: "debit",
      amount: "abs(event.enrichment.failedReceiveLeg.amountMinor)",
      currency: "event.enrichment.failedReceiveLeg.currency",
      when: HERSTATT_RECV,
    },
    {
      account: {
        logical: "fx.receivable",
        currency: "event.enrichment.failedReceiveLeg.currency",
      },
      side: "credit",
      amount: "abs(event.enrichment.failedReceiveLeg.amountMinor)",
      currency: "event.enrichment.failedReceiveLeg.currency",
      when: HERSTATT_RECV,
    },
    // (b) Stage-3 lifetime ECL = 100% of ZAR-equivalent (ZAR functional ccy).
    {
      account: { logical: "fx.credit_loss_expense", currency: "ZAR" },
      side: "debit",
      amount: "abs(event.enrichment.failedReceiveLeg.zarEquivalentMinor)",
      currency: "ZAR",
      when: HERSTATT_ECL,
    },
    {
      account: { logical: "fx.ecl_allowance_settlement_failed", currency: "ZAR" },
      side: "credit",
      amount: "abs(event.enrichment.failedReceiveLeg.zarEquivalentMinor)",
      currency: "ZAR",
      when: HERSTATT_ECL,
    },
  ],
  balancing: "assert_zero",
  cites: [
    "urn:obligation:ifrs:ifrs9:5.5.13",
    "urn:obligation:ifrs:ifrs9:4.4.1",
    "urn:obligation:ifrs:ias21:23",
  ],
};
