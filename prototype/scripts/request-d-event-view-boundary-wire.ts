import { requestDecision } from "../runtime/decisions/record";

const result = requestDecision({
  decisionId: "D-EVENT-VIEW-BOUNDARY-WIRE",
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
    "Landing the schemas as markdown (PR #595) without wiring them into code leaves Principle 1 nominally documented but operationally violated.",
  sourceDocHashes: ["blake3:22596bb0605f3ff2bd794a6535e26b9620ee5d2aad1ac4cecbd252932d89d62a"],
  citations: ["Principles/1-events-are-truth.md", "D-RMS-PHASE-3", "D-MARKETS-SCHEMA-FOUNDATION"],
  followOnDispatch: [
    { route: "agent:atlas", note: "Slice A — OfficialMarkAdopted schema + registry + MTM thread" },
    {
      route: "agent:atlas",
      note: "Slice B — PolicyVersionActivated schema + producer + policy backfill",
    },
    {
      route: "agent:atlas",
      note: "Slice C — split AccountingPeriodClosed into PeriodSequencePinned + PeriodClosed (CFO attestation)",
    },
    {
      route: "agent:atlas",
      note: "Slice D — reclassify *PositionRevalued + retire MarketDataIngested ghost",
    },
  ],
  recordedVia: "scrooge:session-delegation:propose-decision",
});

console.log(
  JSON.stringify({
    ok: true,
    decisionId: "D-EVENT-VIEW-BOUNDARY-WIRE",
    eventId: result.eventId,
    phase: "requested",
  }),
);
