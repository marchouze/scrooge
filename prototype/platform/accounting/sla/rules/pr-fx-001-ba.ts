// platform/accounting/sla/rules/pr-fx-001-ba.ts
//
// PR-FX-001-BA — SARB FX net-open-position (NOP) memorandum classification
// for an FX-spot trade booking, expressed as rules-as-data (spec §3.2).
//
// ─── Return-form attribution (D-FX-NOP-SLA-CITATION-D5-MIGRATION) ────────────
// The FX effective net-open-position attestation is required under regulation
// 29(3) of the Regulations relating to Banks and is carried on form BA 325 —
// the daily return for selected risk exposure arising from trading and treasury
// activities (RRB GG 35950 reg 29; D5/2025 §2.1.14). It is NOT carried on BA 350
// (BA 350 in D5/2025 = the credit-concentration return; under GG 35950 reg 32 it
// was the derivative-instruments monthly return — neither is the NOP). Earlier
// comments here said "BA 350"; that was a form-number error corrected per
// D-FX-NOP-SLA-CITATION-D5-MIGRATION (CEO 2026-06-07; engineering co-owners
// Eitan (Treasurer, governance) — reg 29(3) NOP subject-matter — and Bea
// (Accounting & financial reporting engineer, engineering)).
// NOTE: the opaque citation identifier `urn:obligation:sarb:ba350:nop` is
// retained UNCHANGED below — it is replay-sensitive (embedded in already-emitted
// SlaRuleApproved + Decision events; the rule-content hash includes `cites`, so a
// `cites` change is a new-version + re-approval ceremony). The forward-only URL
// migration to `urn:obligation:sarb:ba325:nop` is DEFERRED to a dedicated
// supersession run (see file footer). Labels/comments only are corrected here.
//
// This is the FIRST SECONDARY REPRESENTATION (D-SLA-FIRST-REPRESENTATION-SARB-BA,
// CFO Camille (Chief Financial Officer, finance)). It proves the parallel-basis
// fan-out: the SAME `FxTradeExecuted` event that produces the IFRS trading
// receivable/payable split (PR-FX-001) ALSO produces — independently and in
// parallel — this differing SARB regulatory-basis entry. One event → two
// `ProposedPosting`s, one per representation, each balanced independently
// (Phase-0 spec §2.2).
//
// ─── The differing basis ────────────────────────────────────────────────────
// The SARB BA 325 (reg 29(3) — daily trading/treasury selected-risk return;
// effective net-open-position attestation) classifies an internal FX-spot
// booking by the GROSS OPEN POSITION it creates,
// not by the IFRS trading sub-ledger split. A buy USD / sell ZAR booking opens a
// USD LONG position; the regulatory memo records that as a balanced
// long-vs-short pair on the receive-leg currency (the bought currency is the
// long position; the offset is the short memo). Concretely (per spec §3.2):
//   Dr reg.nop_long  [receiveCurrency]  = |near.counterNotional.amountMinor|
//   Cr reg.nop_short [receiveCurrency]  = |near.counterNotional.amountMinor|
// The memo balances per currency (long == short within the bought currency) and
// lands in a SEPARATE physical account range (ACC-9000-xxx) than the IFRS
// trading accounts (ACC-2100-xxx) — "differing regulatory requirements"
// satisfied STRUCTURALLY by a parallel rule set, not by an `if (basis)` branch.
//
// ─── Account resolution (resolver.ts, SARB-BA-RETURN rows) ──────────────────
//   reg.nop_long  → ACC-9000-001 (NOP Memorandum — Long, debit)
//   reg.nop_short → ACC-9000-002 (NOP Memorandum — Short, credit)
// Both accounts are multi-currency NOP memos (per-entry currency authoritative).
// A currency with no resolver row follows the SAME no-silent-fallback discipline
// as the IFRS resolver: unmapped currency → FX unresolved-currency suspense
// (ACC-2100-007) + a high-severity urgent-correction alert
// (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE) — but because the NOP memo rows are
// authored as multi-currency (any traded currency resolves), this is the
// permanent last-resort safety net only.
//
// ─── ACTIVATED IN PRODUCTION (SARB activation Round 3 — the flip) ────────────
// The production GL posting engine (`bea-gl-posting-engine.ts` via
// `bea-gl-fx-interpreter-cutover.ts`) now calls
// `interpret(..., ["IFRS","SARB-BA-RETURN"], ...)` — every FX booking yields the
// IFRS trading split AND this SARB NOP memo, each balanced independently. The
// rule is interpreter-eligible only because it carries a four-eyes SlaRuleApproved
// (approver Camille ≠ publisher Bea); the CFO+CoSec joint activation Decisions are
// on the log. Additivity holds: the IFRS posting is byte-for-byte unchanged.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4, CEO-approved 2026-06-06);
//            D-SLA-FIRST-REPRESENTATION-SARB-BA (CFO Camille);
//            D-SLA-SARB-ACTIVATION-CFO + D-SLA-SARB-BA-RETURN-ACTIVATION-COSEC
//            (joint production activation, Round 3).
// Cites: SARB BA 325 (reg 29(3) — daily NOP attestation); Banks Act 94 of 1990 (exposure).

import type { SlaRule } from "../generated/sla-types";

export const PR_FX_001_BA: SlaRule = {
  rule_id: "PR-FX-001-BA",
  representation: "SARB-BA-RETURN",
  version: 1,
  effective_from: "2026-01-01",
  effective_to: null,
  applies_to: {
    event_type: "FxTradeExecuted",
    instrument_type: "FX-spot",
    entity: "LE-ZA-HOZ-BANK",
    jurisdiction: "ZA",
    regulatory_regime: "SARB-banks-act",
  },
  condition: {
    // NOTE: `condition.detail` is part of the rule-content hash (approval.ts
    // ruleContentHash includes `condition`); editing it would break the in-force
    // four-eyes approval exactly like a `cites` change. Left UNCHANGED here — the
    // BA-350 → BA 325 (reg 29(3)) re-label of this field is part of the deferred
    // supersession ceremony (see file footer), NOT a zero-replay label fix.
    kind: "always",
    detail: "SARB BA-350 — FX net open position memorandum classification",
  },
  lines: [
    // The bought (receive-leg) currency is the LONG open position; the offset is
    // the SHORT memo. Both legs carry the receive-leg currency so the NOP memo
    // balances per currency (long == short). Amount = receive-leg notional.
    {
      account: { logical: "reg.nop_long", currency: "event.near.receiveCurrency" },
      side: "debit",
      amount: "abs(event.near.counterNotional.amountMinor)",
      currency: "event.near.receiveCurrency",
    },
    {
      account: { logical: "reg.nop_short", currency: "event.near.receiveCurrency" },
      side: "credit",
      amount: "abs(event.near.counterNotional.amountMinor)",
      currency: "event.near.receiveCurrency",
    },
  ],
  balancing: "assert_zero",
  // RETAINED UNCHANGED (replay-sensitive — see file header). The correct form is
  // BA 325 (reg 29(3)); the opaque URN below is migrated forward to
  // `urn:obligation:sarb:ba325:nop` only via the deferred supersession ceremony.
  cites: ["urn:obligation:sarb:ba350:nop", "urn:obligation:reg:banks-act:fx-exposure"],
};

// ─── DEFERRED forward-only URN migration (Step 3 — D-FX-NOP-SLA-CITATION-D5) ──
// This pass corrected human-facing LABELS only (BA 350 → BA 325 / reg 29(3)).
// The opaque citation identity strings (`cites`) and the hash-relevant
// `condition.detail` are LEFT UNCHANGED because they are replay-sensitive:
//   1. `urn:obligation:sarb:ba350:nop` is embedded verbatim in already-emitted
//      SlaRuleApproved + Decision events (15 in the production store as of
//      2026-06-07). Those events MUST NOT be rewritten (Principle 1).
//   2. The four-eyes interpreter-eligibility hash (approval.ts ruleContentHash)
//      INCLUDES `cites` and `condition`. Editing either on this in-force,
//      production-active rule changes its content hash → the existing
//      SlaRuleApproved no longer matches → the rule silently DE-ACTIVATES on the
//      live SARB-BA-RETURN path (recon:sla-approval-workflow fails).
// CORRECT forward-only migration (a dedicated run under Bea's SLA-engine
// ownership + Camille (CFO) re-approval):
//   a. `supersede()` this rule (and the lifecycle/cancel rules) to a NEW version
//      whose `cites` use `urn:obligation:sarb:ba325:nop` (+ keep banks-act
//      fx-exposure), abutting the in-force window left-closed/right-open.
//   b. Retain THIS version (now window-closed) so historical reproduce-as-of
//      still resolves the old URN — supersede-never-edit; never mutate this body.
//   c. Re-publish (Bea) + re-approve (Camille, four-eyes) each new version so it
//      is interpreter-eligible; backfill grandfather if needed.
//   d. Record a supersession mapping ba350:nop → ba325:nop in the citation graph
//      once obligation nodes exist for SARB return-form URNs (none today).
// Authority: D-FX-NOP-SLA-CITATION-D5-MIGRATION (CEO 2026-06-07);
//            D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025.
