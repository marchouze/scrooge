// scripts/record-d-sla-sarb-activation-cfo.ts
//
// SARB-BA-RETURN activation — Round 2, CFO half (WS-SLA-ENGINE).
//
// Camille (Chief Financial Officer, finance) records, autonomously, the two
// CFO `Decision`s the activation runbook (Phase-0 design spec §9.5 steps 1–2)
// and the approval-workflow recon (`recon:sla-approval-workflow` check (b))
// require BEFORE SARB-BA-RETURN may be added to `PRODUCTION_REPRESENTATIONS`:
//
//   1. D-SLA-SARB-BA350-NOP-STRUCTURE-CFO — the CFO confirmation that the
//      minimal long/short NOP memorandum (ACC-9000-001 long / ACC-9000-002
//      short) is the adequate BA-350 go-live structure for the FX worked
//      example, with richer per-maturity / structural-vs-trading decomposition
//      deferred (not required at go-live).
//   2. D-SLA-SARB-ACTIVATION-CFO — the CFO half of the joint SARB-BA-RETURN
//      activation approval (D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL).
//      Owen (Company Secretary, governance) records the CoSec half in parallel.
//
// Each decision is a two-phase pair (`requested` → `approved`) at DISTINCT,
// FIXED asOfs so re-runs are idempotent (recordDecision dedups on
// (decisionId, phase, as_of)).
//
// This script does NOT flip production: `PRODUCTION_REPRESENTATIONS` stays
// `["IFRS"]` (Round 3, engineering). It records the CFO records only; it is NOT
// wired into package.json / ci:migrate (Round 3 carries that, to avoid
// colliding with Owen's parallel CoSec run).
//
// Authority: D-SLA-RULE-ACTIVATION-AUTHORITY-CFO (CFO holds rule-version
//   activation authority); D-SLA-FIRST-REPRESENTATION-SARB-BA;
//   D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL (activation = CFO + CoSec).
// Citations: Principles/1-events-are-truth.md (events-first),
//   Principles/2-single-graph-discipline.md (typed citation upward).
//
// Run (live home store):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/record-d-sla-sarb-activation-cfo.ts
//
// Author: Camille (Chief Financial Officer, finance).

import { recordDecision } from "../runtime/decisions/record";

const CFO_ACTOR = { type: "service" as const, id: "agent:camille" };
const CFO_REF = "agent:camille";
const RECORDED_VIA = "agent:autonomous" as const;
const CITATIONS = ["urn:obligation:sarb:ba350:nop", "urn:obligation:reg:banks-act:fx-exposure"];

interface DecisionPairSpec {
  readonly decisionId: string;
  readonly requestedAsOf: string;
  readonly approvedAsOf: string;
  readonly title: string;
  readonly recommendation: string;
  readonly rationale: string;
}

function recordPair(spec: DecisionPairSpec): void {
  recordDecision(
    {
      decisionId: spec.decisionId,
      phase: "requested",
      authority: "CFO",
      authorityRef: CFO_REF,
      title: spec.title,
      category: "finance",
      recommendation: spec.recommendation,
      rationale: spec.rationale,
      sourceDocHashes: [],
      citations: CITATIONS,
      recordedVia: RECORDED_VIA,
      actor: CFO_ACTOR,
    },
    spec.requestedAsOf,
  );
  recordDecision(
    {
      decisionId: spec.decisionId,
      phase: "approved",
      authority: "CFO",
      authorityRef: CFO_REF,
      title: spec.title,
      category: "finance",
      recommendation: spec.recommendation,
      rationale: spec.rationale,
      sourceDocHashes: [],
      citations: CITATIONS,
      recordedVia: RECORDED_VIA,
      actor: CFO_ACTOR,
    },
    spec.approvedAsOf,
  );
}

const PAIRS: readonly DecisionPairSpec[] = [
  {
    decisionId: "D-SLA-SARB-BA350-NOP-STRUCTURE-CFO",
    requestedAsOf: "2026-06-06T09:00:00.000Z",
    approvedAsOf: "2026-06-06T09:30:00.000Z",
    title: "BA-350 NOP memorandum structure — minimal long/short adequate for go-live",
    recommendation:
      "Adopt the minimal net-open-position memorandum (ACC-9000-001 Net Open Position Memorandum — Long / ACC-9000-002 Net Open Position Memorandum — Short) as the BA-350 structure for SARB-BA-RETURN go-live. Approved as adequate for the FX worked example; per-maturity bucketing and a structural-vs-trading split are deferred as a later accounting-policy enrichment, not a go-live blocker.",
    rationale:
      "The BA-350 (net open position return) classifies an FX-spot booking by the gross open position it creates (long vs short by currency), independent of the IFRS trading receivable/payable split. The two 9000-range memorandum accounts are currency-free (per-leg currency authoritative, D-COA-CURRENCY-DECOUPLING) and balance per currency (long == short within a currency), which is exactly the minimal shape PR-FX-001-BA (and the FX lifecycle rules) require to produce a balancing NOP memo for the FX worked example. They never touch the IFRS balance sheet or P&L (distinct 9000 range, physically un-confusable). Richer BA-350 decomposition (per-maturity buckets; structural vs trading) is a deeper CFO accounting-policy call that does not block first-representation go-live; it is recorded here as deferred, to be revisited when the SARB return scope widens beyond the FX worked example.",
  },
  {
    decisionId: "D-SLA-SARB-ACTIVATION-CFO",
    requestedAsOf: "2026-06-06T10:00:00.000Z",
    approvedAsOf: "2026-06-06T10:30:00.000Z",
    title: "Activate SARB-BA-RETURN as a production representation — CFO half of joint approval",
    recommendation:
      "As CFO, approve the activation of SARB-BA-RETURN as a secondary production accounting representation alongside IFRS, conditional on the parallel CoSec approval (Owen) and on every published SARB rule carrying a four-eyes SlaRuleApproved (approver != publisher). This is the CFO half of the D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL joint decision; it does NOT itself flip PRODUCTION_REPRESENTATIONS (Round 3, engineering, gated on both halves + the four-eyes approvals + green recon:sla-approval-workflow).",
    rationale:
      "SARB-BA-RETURN is the first secondary representation (D-SLA-FIRST-REPRESENTATION-SARB-BA). Its NOP memorandum structure is confirmed adequate for go-live (D-SLA-SARB-BA350-NOP-STRUCTURE-CFO). Activation is additive: the IFRS primary representation is unchanged (byte-for-byte, spec §2.2 / §11.5); the SARB basis posts only to the 9000-range memorandum accounts. The accounting-policy judgement that the parallel BA-350 basis is correct and ready for production sits with the CFO seat (IFRS / regulatory accounting policy, decision-authority routing). Per D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL neither seat may activate a parallel basis alone, so this CFO Decision is recorded as one half of the pair; Owen records the CoSec half. recon:sla-approval-workflow check (b) requires BOTH approved Decisions on the log before SARB-BA-RETURN may appear in PRODUCTION_REPRESENTATIONS — this Decision satisfies the CFO side of that gate.",
  },
];

for (const pair of PAIRS) recordPair(pair);

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      recorded: PAIRS.map((p) => ({
        decisionId: p.decisionId,
        authority: "CFO",
        phase: "approved",
      })),
      productionRepresentationsFlipped: false,
    },
    null,
    2,
  ),
);
