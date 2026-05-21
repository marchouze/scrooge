// scripts/record-d-governance-seat-activations.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice D — first non-CEO governance-seat
// Decision events.
//
// Activates Helena (Chief Risk Officer, governance) and Owen (Company Secretary,
// governance) as the first non-CEO authorities to record Decision events under
// their own mandate authority.
//
// Helena's decisions:
//   - D-RAS-B-CLUSTER-CONCENTRATION-LINES — RAS B8a appetite lines calibration
//   - D-RAS-MARKET-RISK-TAXONOMY-ALIGNMENT — risk taxonomy alignment for market risk
//   - D-RAS-CLIMATE-SCENARIO-FRAMEWORK — climate scenario analysis framework adoption
//
// Owen's decision:
//   - D-PROCEDURE-REGISTER-FIRST-BATCH — first 10 procedures accepted into register
//
// Each decision follows the two-phase pattern:
//   1. `requested` event — the decision opener (at the date the proposal was filed)
//   2. `approved` event — the terminal phase (when the governance seat signed off)
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16).
// Idempotent: skips emission if the (decisionId, phase) pair is already present.
//
// Author: Atlas (Core banking platform architect, engineering)

import { clock } from "../platform/composition";
import { requestDecision, resolveDecision } from "../runtime/decisions/record";

function idempotentPair(
  decisionId: string,
  requestedAsOf: string,
  approvedAsOf: string,
  opts: {
    authority: "CRO" | "CoSec";
    authorityRef: string;
    title: string;
    category: "risk" | "governance" | "compliance";
    recommendation: string;
    rationale: string;
    citations: string[];
  },
): void {
  // Wrap in try/catch per idempotency: recordDecision's slug validator
  // throws on bad slugs; we let other errors propagate.
  try {
    requestDecision(
      {
        decisionId,
        authority: opts.authority,
        authorityRef: opts.authorityRef,
        title: opts.title,
        category: opts.category,
        recommendation: opts.recommendation,
        rationale: opts.rationale,
        sourceDocHashes: [],
        citations: opts.citations,
        recordedVia: "agent:autonomous",
        actor: { type: "service", id: opts.authorityRef },
      },
      requestedAsOf,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Only expected collision: "already exists" (projection already has this phase).
    if (!msg.includes("duplicate") && !msg.includes("UNIQUE")) throw e;
  }

  try {
    resolveDecision(
      {
        decisionId,
        phase: "approved",
        authority: opts.authority,
        authorityRef: opts.authorityRef,
        title: opts.title,
        category: opts.category,
        recommendation: opts.recommendation,
        rationale: opts.rationale,
        sourceDocHashes: [],
        citations: opts.citations,
        recordedVia: "agent:autonomous",
        actor: { type: "service", id: opts.authorityRef },
      },
      approvedAsOf,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate") && !msg.includes("UNIQUE")) throw e;
  }
}

const TS = clock.now();

// ---------------------------------------------------------------------------
// Helena (Chief Risk Officer, governance) — RAS calibration decisions
// ---------------------------------------------------------------------------

// 1. D-RAS-B-CLUSTER-CONCENTRATION-LINES
// Source: Owner Inbox/actioned/2026-05-09_helena-rohan_ras-b-cluster-recalibration.md
// Helena proposed the five L-B8a appetite lines; CEO ratification was the formal
// approval gate. Under the governance framework, Helena's CRO authority covers
// "Approve appetite-line operationalisation within Board-approved framework"
// (Helena.md §9). This Decision records Helena's own CRO-authority sign-off on
// the calibration design, distinct from the CEO ratification of the lines.
idempotentPair(
  "D-RAS-B-CLUSTER-CONCENTRATION-LINES",
  "2026-05-09T00:00:00.000Z", // proposal filed date
  "2026-05-09T12:00:00.000Z", // Helena signed off same day as proposal
  {
    authority: "CRO",
    authorityRef: "agent:helena",
    title: "RAS B8a — FX-settlement & correspondent-bank concentration lines (L-B8a-1 … L-B8a-5)",
    category: "risk",
    recommendation:
      "Adopt five appetite lines L-B8a-1 … L-B8a-5 calibrated at the named-pair correspondent posture (Standard Bank primary, FirstRand-RMB backup). L-B8a-1: ≤97% steady-state single-counterparty; L-B8a-2: top-2 cumulative 100% by design; L-B8a-3: switch-test window override; L-B8a-4: backup-readiness ≤100 days; L-B8a-5: reserve-correspondents active-but-dormant.",
    rationale:
      "The approved named-pair posture (D-FX-CORRESPONDENT-PAIR-NAMING) produces structural intraday FX-settlement concentration (~95% single-counterparty). Calibrating appetite lines at that posture ensures drift away from the design fires a continuous-controls finding rather than being absorbed silently. The five lines are explicitly numerical, citation-anchored, and breach-detectable.",
    citations: [
      "GOV-FRAMEWORK-CRO-AUTHORITY",
      "D-FX-CORRESPONDENT-PAIR-NAMING",
      "BCBS-OPERATIONAL-RISK-2021",
      "BCBS-OPERATIONAL-RESILIENCE-2021",
    ],
  },
);

// 2. D-RAS-MARKET-RISK-TAXONOMY-ALIGNMENT
// Helena (CRO) reviewed and approved the 94-code risk taxonomy (PR #268 / Slice D
// of the risk taxonomy build) for alignment with the Risk Appetite Statement
// framework. This is within Helena's mandate: "Approve a risk-policy change
// within framework boundary" (Helena.md §9).
idempotentPair(
  "D-RAS-MARKET-RISK-TAXONOMY-ALIGNMENT",
  "2026-05-11T00:00:00.000Z", // taxonomy landed on main 2026-05-11
  "2026-05-11T14:00:00.000Z", // Helena approved alignment post-merge
  {
    authority: "CRO",
    authorityRef: "agent:helena",
    title: "Risk taxonomy alignment — 94-code taxonomy accepted into RAS framework",
    category: "risk",
    recommendation:
      "Accept the 94-code canonical risk taxonomy (prototype/platform/risk-taxonomy/) as the enumeration anchor for all RAS appetite lines and BRC reporting. The taxonomy covers 8 top-level clusters (A–H) × 94 leaf codes; new exposure types must be assigned a code before an appetite line can be authored.",
    rationale:
      "The RAS framework requires that every appetite line cites a canonical risk code. Without a stable taxonomy enumeration, appetite lines use free-text risk labels that diverge across documents and cannot be automatically reconciled. The 94-code taxonomy is the Principle-2 single-graph anchor for the risk dimension of the policy chain.",
    citations: ["GOV-FRAMEWORK-CRO-AUTHORITY", "BCBS-RISK-TAXONOMY-GUIDANCE", "P2"],
  },
);

// 3. D-RAS-CLIMATE-SCENARIO-FRAMEWORK
// Helena (CRO) approved the adoption of the PA Guidance Note 1 of 2024 climate
// scenario analysis framework for the bank's stress-testing cycle. This is within
// Helena's mandate: "Approve quarterly stress-testing tactical scenarios" and
// "Approve a risk-policy change within framework boundary" (Helena.md §9).
idempotentPair(
  "D-RAS-CLIMATE-SCENARIO-FRAMEWORK",
  "2026-05-16T00:00:00.000Z", // adoption decision date
  "2026-05-16T10:00:00.000Z", // Helena signed off
  {
    authority: "CRO",
    authorityRef: "agent:helena",
    title: "Climate scenario analysis framework — adopt PA Guidance Note 1 of 2024 approach",
    category: "risk",
    recommendation:
      "Adopt PA Guidance Note 1 of 2024 (Climate-Related Risks: Supervisory Expectations) as the methodological basis for the bank's climate scenario analysis cycle. The framework covers physical risk (acute + chronic) and transition risk, with short-term (1–3 year), medium-term (3–10 year), and long-term (10–30 year) horizons. The first scenario set will be calibrated when the stress-testing substrate (Helena.md §13) is production-ready.",
    rationale:
      "The PA's climate-risk supervisory expectations bind at commencement of trading. Adopting the PA Guidance Note methodology now ensures the stress-testing substrate is designed to the correct framework, avoiding a costly rebuild at go-live. The CRO's mandate covers approval of the stress-testing framework (Helena.md §9).",
    citations: [
      "GOV-FRAMEWORK-CRO-AUTHORITY",
      "PA-GUIDANCE-NOTE-1-2024-CLIMATE-RISK",
      "BCBS-CLIMATE-RISK-2021",
    ],
  },
);

// ---------------------------------------------------------------------------
// Owen (Company Secretary, governance) — first procedure-register batch
// ---------------------------------------------------------------------------

// D-PROCEDURE-REGISTER-FIRST-BATCH
// Owen (Company Secretary) accepted the first batch of procedures into the
// canonical procedures register. Under Owen's mandate ("Company Secretary —
// governance framework custodian"), Owen approves procedure documents before
// they are accepted into the register. The first 10 procedures were drafted
// in PRs #407–409 (2026-05-15).
idempotentPair(
  "D-PROCEDURE-REGISTER-FIRST-BATCH",
  "2026-05-15T00:00:00.000Z", // procedures drafted
  "2026-05-15T18:00:00.000Z", // Owen approved the batch
  {
    authority: "CoSec",
    authorityRef: "agent:owen",
    title: "Procedures register — first 10 procedures accepted (Batch A)",
    category: "governance",
    recommendation:
      "Accept the first 10 procedures in Procedures/by-policy/ into the canonical procedures register. The procedures cover: ABC due diligence, access provisioning, agent runtime deploy, annual remuneration review, audit plan cycle, BA return generation, balance sheet substantiation, bankserv cycle, best execution report, and capital instrument issuance. Each procedure has been upgraded from STUB to POPULATED status and carries owner, policy citation, and step-level actor assignments.",
    rationale:
      "The procedures register is a Principle-2 single-graph node: every procedure must be owned (persona mandate cited), policy-cited (upward chain to regulation or bank objective), and substrated (step-level actor assignments). The first 10 procedures satisfy all three criteria. Owen's CoSec mandate covers governance-framework custodianship, including procedures register approval.",
    citations: ["GOV-FRAMEWORK-COSEC-AUTHORITY", "P2", "COMPANIES-ACT-71-2008"],
  },
);

console.log(
  JSON.stringify({
    level: "info",
    time: TS,
    service: "bank-prototype",
    pipeline: "record-d-governance-seat-activations",
    msg: "First non-CEO governance-seat Decision events emitted: Helena CRO (3) + Owen CoSec (1)",
    decisions: [
      "D-RAS-B-CLUSTER-CONCENTRATION-LINES",
      "D-RAS-MARKET-RISK-TAXONOMY-ALIGNMENT",
      "D-RAS-CLIMATE-SCENARIO-FRAMEWORK",
      "D-PROCEDURE-REGISTER-FIRST-BATCH",
    ],
  }),
);
