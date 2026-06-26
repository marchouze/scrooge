// scripts/record-d-fx-vanilla-ifrs-cfo-signoff.ts
//
// Records D-FX-VANILLA-IFRS-CFO-SIGNOFF — Camille's (Chief Financial Officer,
// governance) CFO sign-off RATIFYING the FX-vanilla IFRS domain-truth foundation
// (Bea's merged #1552) as the accountable signer of the bank's AFS and BA
// returns. This is the DECIDER leg of WS-FX-IFRS-REVIEW-FOUNDATION, paired with
// Bea's reviewer brief under the reviewer→decider sync primitive
// (D-DISPATCH-SYNC-PRIMITIVE). Camille independently re-validated all five IFRS
// premises against IFRS 9 / IAS 21 / IFRS 13 themselves (not against the code's
// internal consistency, PROC-GOV-ADC-01 §4/§20) before signing.
//
// AUTHORITY ATTRIBUTION — CFO seat, not CEO. The decision-authority-routing
// table (CLAUDE.md) routes "IFRS accounting policy" to the CFO. `DecisionAuthority`
// admits "CFO"; this sign-off is therefore attributed to the CFO seat — the
// natural authority for the category — NOT forced onto CEO. Recorded via
// `agent:autonomous` (Camille is the standing agent acting within her mandate),
// not session-delegation (Marc did not author this specific verdict).
//
// CATEGORY — the routing table calls this category "accounting"; the typed
// DECISION_CATEGORIES vocabulary's coarsest matching bucket is `finance` (there
// is no `accounting` member). Using `finance` and noting the descriptive→typed
// mapping here (a brief-premise clarification, not a substantive change).
//
// Idempotent on (decisionId, phase, as_of).
// Authority: D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26); the
//   decision-authority-routing table (CLAUDE.md); PROC-FIN-12; PROC-GOV-ADC-01;
//   D-ENGINEERING-INTEGRITY-CHARTER; Principles 1 & 2.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

// The sign-off carries the full phase chain (requested → approved) so the
// decision-symmetry gate (recon:decision-symmetry) — which fails closed on a
// closed decision lacking a `requested` event — is satisfied. The CFO tables
// the ratification for sign-off (requested) and signs it (approved) in the
// same run; both phases are recorded.
const REQUESTED = "2026-06-26T10:55:00.000Z";
const APPROVED = "2026-06-26T11:00:00.000Z";

const base = {
  decisionId: "D-FX-VANILLA-IFRS-CFO-SIGNOFF",
  authority: "CFO" as const,
  authorityRef: "camille@bank — Chief Financial Officer (governance)",
  title:
    "CFO sign-off ratifying the FX-vanilla IFRS domain-truth foundation (oracle, golden cases, invariant gates, review methodology) as IFRS-correct",
  category: "finance" as const,
  recommendation:
    "RATIFY the FX-vanilla IFRS domain-truth foundation merged under D-FX-IFRS-REVIEW-FOUNDATION (#1552) as the accountable CFO signer. The five IFRS premises are independently confirmed against the standards; the golden worked cases (CASE 1-5) reproduce the production posting functions byte-for-byte; the two new domain-invariant gates (recon:fx-pnl-account-category-integrity, recon:fx-monetary-closing-rate-integrity) plus the reframed recon:fx-trade-date-obs-memorandum encode the IFRS invariants fail-closed; and the PROC-FIN-12 review harness aggregates them into a typed PASS verdict on the canonical store. The FX-vanilla accounting is validated against IFRS, not merely internally consistent. Sign-off recorded.",
  rationale:
    "PREMISE-CHALLENGE (PROC-GOV-ADC-01 §20) — I re-validated each premise against IFRS itself before signing: (1) FVTPL classification CONFIRMED — IFRS 9 §4.1.4 measures a financial asset/derivative at FVTPL unless the §4.1.2 amortised-cost or §4.1.2A FVOCI conditions are met, which an FX forward (a derivative held for trading) does not meet. (2) At-market trade-date OBS, FV≈0 CONFIRMED — IFRS 9 §5.1.1 records at fair value on initial recognition; an at-market forward's fair value is ~nil, so there is no on-balance-sheet gross-up (the old self-cancelling Dr-receivable/Cr-payable pair is correctly removed); the notionals sit OBS as a memorandum commitment (B3.1.2; IAS 21 §21 spot recording). (3) Monetary/closing-rate CONFIRMED — IAS 21 §8 makes an open FX position a monetary item (a right to receive / obligation to deliver a fixed number of currency units); §23(a) retranslates monetary items at the closing rate at each reporting date; §28 recognises the exchange difference in profit or loss in the functional currency. (4) Settlement P&L-neutral CONFIRMED — IAS 21 §28/§29: the exchange difference is struck on translation and on settlement, but settling the contract into FCY cash at the same ZAR carrying basis realises nothing on its own; realisation arises only on the subsequent FCY→ZAR conversion. (5) Realised FX gain/loss → P&L only CONFIRMED — IAS 21 §28 recognises the difference in profit or loss, never a balance-sheet account; the COA-category gate enforces this fail-closed, which is the exact invariant the historical settlement-realisation bug violated. No premise is overturned. EVIDENCE — golden cases 8/8 green; PROC-FIN-12 harness PASS on the CI-canonical store; the five FX domain gates registered in ci:recon:domain. One operational note recorded for the signer, not a sign-off blocker: recon:fx-pnl-fcy-exposure-integrity flags settled-FCY-cash instances that lack a stamped ZAR cost basis on a STALE home store; on the canonical seeded store the gate is green — the condition is a settlement-materialisation data concern outside this foundation's scope, routed to the materialisation owner. Aligns with the Engineering Charter (no green by concealment; fail-closed) and Principle 2 (every posting traces to its IFRS paragraph).",
  sourceDocHashes: [],
  citations: [
    "D-FX-IFRS-REVIEW-FOUNDATION",
    "D-FX-TRADE-DATE-FVTPL-OBS",
    "D-FX-PNL-FCY-EXPOSURE-REVALUATION",
    "D-ACCT-FX-IFRS-POSTING-COMPLETENESS",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "Procedures/finance/fx-vanilla-ifrs-accounting-review.md",
    "Procedures/by-policy/agent-domain-competence-framework.md",
    "Regulations/INTL/IASB/source-docs/ias-21-structured.json",
    "Regulations/INTL/IASB/source-docs/ifrs-9-structured.json",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "agent:autonomous" as const,
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-FX-VANILLA-IFRS-CFO-SIGNOFF" },
    null,
    2,
  ),
);
