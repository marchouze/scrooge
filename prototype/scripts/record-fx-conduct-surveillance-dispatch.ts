// prototype/scripts/record-fx-conduct-surveillance-dispatch.ts
//
// One-shot: record CEO session-delegated approval ("continue as recommended",
// 2026-06-11) to dispatch Zara (Chief Compliance Officer, governance) on the
// OTC Vanilla FX conduct dimension — leading with a live best-execution /
// FAIS-suitability surveillance defect surfaced by the per-dimension
// verification pass v2 (D-FX-NPA-VERIFICATION-PASS-2-DISPATCH).
//
// Finding (grounded in the canonical store 2026-06-11):
//   - 44 FxTradeExecuted events on the book; 54 ConflictOfInterestDisclosed.
//   - BUT 0 BestExecutionVerified / 0 BestExecutionBreached /
//     0 FaisClassificationSuitabilityChecked / 0 CounterpartyFaisClassified.
//   - runtime/agents/rohan-conduct-risk-events.ts (handler
//     "rohan:conduct-risk-events", subscribesTo FxTradeExecuted) emits all
//     three families but has NEVER run: 0 AgentRunStarted, 0 bus dispatch
//     claims. It is a registered-but-never-dispatched INERT subscriber.
//   - The 54 conflict events come from a different path (onboarding/seed),
//     which is why the asymmetry appears as "best-ex missing".
//   => 44 FX trades executed with no best-execution verification and no FAIS
//      suitability surveillance — a TCF / best-execution conduct gap.
//
// Authority: CEO (Marc), in-session "continue as recommended" 2026-06-11.
// Author: Scrooge (Chief of Staff)

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-11T10:00:00.000Z";

const result = recordDecision(
  {
    decisionId: "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "OTC Vanilla FX — dispatch Zara (CCO) on the conduct dimension: wire the inert markets conduct-surveillance handler (best-execution + FAIS suitability) and take the conduct attestation",
    category: "compliance",
    recommendation:
      "Dispatch Zara (Chief Compliance Officer, governance) to own the conduct dimension of prd:bank:fx:otc-vanilla: diagnose and remediate the inert rohan:conduct-risk-events surveillance handler so best-execution verification and FAIS-suitability checks fire on the live FX book, then either promote conduct to implementation-attested (with tracked deferred gaps) or hold it design-attested with a grounded reason and the seat decisions still needed.",
    rationale:
      "The verification pass v2 (#1213) correctly held conduct design-attested. Code-level investigation grounds the reason: the markets conduct-surveillance handler is a registered-but-never-dispatched inert subscriber — 44 FX trades executed with zero best-execution / FAIS-suitability events. This is a live TCF/best-execution conduct gap in Zara's mandate (FAIS conduct, TCF), with the wiring fix engineering-owned (handler authored by Rohan). Surfacing the defect before attesting prevents over-attestation and closes a real surveillance hole.",
    sourceDocHashes: [],
    citations: [
      "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL",
    ],
    recordedVia: "scrooge:session-delegation",
    actor: { type: "human", id: "marc@tgv.co.za" },
  },
  AS_OF,
);

console.log(
  `✓ D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH → approved (eventId: ${result.eventId})`,
);
