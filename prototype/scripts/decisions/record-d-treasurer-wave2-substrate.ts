// scripts/decisions/record-d-treasurer-wave2-substrate.ts
//
// Records D-TREASURER-WAVE2-SUBSTRATE — Marc's in-session approval
// (2026-06-11, "continue wave 2") of the Wave-2 pre-licence dispatch set
// surfaced by the Treasurer role-definition review (D-TREASURER-ROLE-DEFINITION-REVIEW,
// PR #1199) and its Wave-1 closure (D-TREASURER-WAVE1-SUBSTRATE, PR #1212).
//
// SCOPE (four dispatchable items; two externally blocked noted below):
//   1. NSFR full balance-sheet scope (Ravi):
//      BalanceSheetProjected event closes the full BA 300-series NSFR scope
//      (currently only CapitalEvent + DepositTaken + InterbankLoanPlaced folded).
//   2. Non-trade contractual outflows (Ravi + Atlas):
//      SettlementInstructionIssued event class folds non-trade contractual
//      outflows into LCR denominator (today only buy-side trades with explicit
//      settlementDate fold via buildSettlementOutflows in
//      platform/projections/alm-positions.ts).
//   3. EWI live feed adapter wiring (Ravi):
//      ExternalCreditEventDetected + RecoveryEarlyWarningTriggered are currently
//      injectable stubs in PR #1206; define real feed adapter interfaces/wire
//      points so external credit ratings and recovery-plan triggers are
//      sourced from live feeds (build-phase: adapter interfaces + stubs with
//      documented injection contracts).
//   4. CFP plan instance + PROC-RISK-CFP-01 + rehearsal harness (Eitan + Ravi):
//      LRM §5.3 funding-source inventory register; PROC-RISK-CFP-01
//      (cfp-invocation-and-rehearsal.md) covering tier governance, escalation
//      path, and annual rehearsal standard; W2-Slice-5 rehearsal harness
//      firing all 7 trigger events in sequence (Helena aligns stress framework).
//   5. Treasury returns submission wiring (Mira + Bea):
//      Wire BA 300 (LCR/NSFR), BA 330 (IRRBB), BA 700 (capital) generators
//      into the SARB returns submission layer; completeness-audit inert-module
//      gate green for treasury returns (WS-COMPLETENESS-AUDIT taxonomy).
//
// EXTERNALLY BLOCKED (not dispatched):
//   - W2.1 Correspondent settlement interface (Tomas + Ravi):
//     blocked on correspondent/sponsor-bank selection (licence-application
//     moment); activates once correspondent is named.
//   - W2.3 FTP live market-data feeds (Ravi + Atlas):
//     ZARONIA/JIBAR/OIS/SAGB feeds blocked on vendor-selection phase.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-11 ("continue
// wave 2"); Scrooge is the recording instrument.
// Category: engineering build decisions → CEO (build phase) per routing table.
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-11T07:00:00.000Z";
const ASOF = "2026-06-11T07:01:00.000Z";

const TITLE =
  "Treasurer Wave-2 pre-licence substrate — NSFR balance-sheet scope, non-trade contractual outflows, EWI live feed adapter wiring, CFP plan instance + PROC-RISK-CFP-01 + rehearsal harness, treasury returns submission wiring";

const CITATIONS = [
  "D-TREASURER-ROLE-DEFINITION-REVIEW",
  "D-TREASURER-WAVE1-SUBSTRATE",
  "docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md",
  "Policies/liquidity-risk-management-policy-v1.md",
  "Policies/asset-liability-management-policy-v1.md",
  "prototype/platform/projections/alm-positions.ts",
  "prototype/platform/alm/cfp-ewi.ts",
  "prototype/platform/recon/cfp-trigger-coverage.ts",
];

const RECOMMENDATION =
  "Dispatch the Wave-2 pre-licence build-phase set from the Treasurer role-definition " +
  "review Part D.2: (1) Ravi (Treasury/ALM engineer) defines the BalanceSheetProjected " +
  "event type and updates the NSFR projection engine to consume it, closing the full " +
  "BA 300-series NSFR balance-sheet scope; (2) Ravi adds SettlementInstructionIssued " +
  "to fold non-trade contractual outflows into the LCR denominator in " +
  "platform/projections/alm-positions.ts buildSettlementOutflows; (3) Ravi defines " +
  "real feed adapter interfaces and injection contracts for ExternalCreditEventDetected " +
  "and RecoveryEarlyWarningTriggered (currently injectable stubs from PR #1206), " +
  "documenting the live-feed wire points for licence-day activation; " +
  "(4) Eitan (Treasurer, governance) authors the LRM §5.3 funding-source inventory " +
  "register and PROC-RISK-CFP-01 (cfp-invocation-and-rehearsal.md — tier governance, " +
  "escalation path, annual rehearsal standard), with Ravi building the W2-Slice-5 " +
  "rehearsal harness that fires all 7 CFP trigger events in sequence and validates " +
  "funding-source drawdown order, with Helena (Chief Risk Officer) aligning the stress " +
  "framework assumptions; (5) Mira (Compliance / RegTech engineer) and Bea " +
  "(Accounting & financial reporting engineer) wire BA 300 (LCR/NSFR), BA 330 (IRRBB), " +
  "and BA 700 (capital) generators into the SARB returns submission layer, turning " +
  "the completeness-audit inert-module gate green for treasury returns. Items 1–3 run " +
  "as one Ravi stream; item 4 runs as a parallel Eitan+Ravi stream (Eitan procedure " +
  "authors in parallel with Ravi ALM code); item 5 runs as a parallel Mira+Bea stream. " +
  "Two items remain externally blocked: W2.1 (correspondent settlement interface, Tomas+Ravi) " +
  "on correspondent/sponsor-bank selection at licence-application moment; W2.3 (FTP live " +
  "market-data feeds, Ravi+Atlas) on vendor-selection phase.";

const RATIONALE =
  "Wave-1 (D-TREASURER-WAVE1-SUBSTRATE, PR #1212) closed the CFP trigger substrate, " +
  "BCBS 248 intraday metrics, intraday RAS appetite line, procedure tail, and routing " +
  "table row. The role-definition review Part D.2 identified five remaining pre-licence " +
  "items for Wave 2. Three have no external blockers and can run in parallel now: the " +
  "NSFR engine only partially folds the balance sheet (three event types, missing " +
  "BalanceSheetProjected); the LCR denominator misses non-trade contractual outflows " +
  "because SettlementInstructionIssued is not defined; and the EWI feed adapters for " +
  "ExternalCreditEventDetected and RecoveryEarlyWarningTriggered are injectable stubs " +
  "with no real feed wire points documented. The CFP plan is still policy prose — the " +
  "LRM §5.3 inventory register and PROC-RISK-CFP-01 procedure are unbuilt, and the " +
  "§5.4 annual rehearsal has never been run. The treasury returns submission layer " +
  "remains dark for all treasury forms. Marc approved dispatch in-session 2026-06-11 " +
  "('continue wave 2').";

requestDecision(
  {
    decisionId: "D-TREASURER-WAVE2-SUBSTRATE",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: "Wave-2 pre-licence set from Part D.2 of role-definition review; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-TREASURER-WAVE2-SUBSTRATE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result }, null, 2));
