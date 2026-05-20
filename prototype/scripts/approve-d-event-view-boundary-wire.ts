import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-EVENT-VIEW-BOUNDARY-WIRE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Wire OfficialMarkAdopted + PeriodClosed into MTM engine and close-management substrate",
    category: "engineering",
    recommendation:
      "Approve a 4-slice programme to land the Atlas event-vs-view contract (PR #595) in code: " +
      "(A) OfficialMarkAdopted schema + producer + MTM thread; " +
      "(B) PolicyVersionActivated schema + producer + backfill for valuation / IFRS / FX-translation policies; " +
      "(C) split AccountingPeriodClosed into PeriodSequencePinned (mechanical) + PeriodClosed (CFO attestation with policy refs, code SHA, statement hashes); " +
      "(D) reclassify *PositionRevalued events to projection rows or rename to MarkAppliedToPosition, and retire the MarketDataIngested ghost. " +
      "Each slice lands as its own PR with event-type-registry + zod-schema-coverage + decision-symmetry recon green. " +
      "Engineering owner: Atlas. Consuming owners: Saskia (Slice A), Yael (Slice C).",
    rationale:
      "Atlas's audit during the dispatch surfaced four Principle 1 violations or smells that block reproducible CFO-attested closes: " +
      "(1) MarketDataIngested is a ghost permission row with no schema, no producer; " +
      "(2) FxPositionRevalued / EquityPositionRevalued / IrsPositionRevalued store derived unrealised P&L in the event log (number, not act); " +
      "(3) no PolicyVersionActivated events exist for any policy, so replay-determinism is not machine-assertable today; " +
      "(4) AccountingPeriodClosed conflates the mechanical close with the CFO attestation. " +
      "Without these fixes the bank cannot reproduce a prior month-end's numbers from the log alone — which the auditor and the regulator will both ask for at licence-day. " +
      "CEO approved in session 2026-05-20.",
    sourceDocHashes: ["blake3:22596bb0605f3ff2bd794a6535e26b9620ee5d2aad1ac4cecbd252932d89d62a"],
    citations: ["Principles/1-events-are-truth.md", "D-RMS-PHASE-3", "D-MARKETS-SCHEMA-FOUNDATION"],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);
