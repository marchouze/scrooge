// scripts/record-d-queue-closeout-2026-06-10.ts
//
// Records D-QUEUE-CLOSEOUT-2026-06-10 — Marc's in-session approval ("do all",
// 2026-06-10) of the six-item open-thread queue presented by Scrooge:
//   (1) FX pre-trade gateway capital-impact + funding threshold ratification
//       and enforcement wiring (Helena CRO primary, Ravi Treasury/ALM co-own,
//       per the open D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS request, PR #1181).
//   (2) WS-RETURNS-SUBMISSION-WIRING Wave B — wire the remaining inert returns
//       subscribers following the Wave A (BA 300 LCR, PR #1180) pattern.
//   (3) Goal-loop run-lifecycle instrumentation rollout — the 15 remaining
//       uninstrumented goal-loops, following the Atlas pattern (PR #1182).
//   (4) Obligations -> policies mapping layer (named NEXT of
//       D-OBLIGATIONS-REGISTER-CLEANUP).
//   (5) FX OTC umbrella build-3 — rule-widen + deferred tail (PR #1163 residue).
//   (6) Tail: B-IRS-DISALLOWANCES / B-IRS-MULTICURVE, GAP-LCR-CONSOLIDATION-ENGINE,
//       reg-intelligence per-regulator ALIGNS_TO gap-fill + advisory gates to
//       enforcing.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-DECISIONS-FRAMEWORK-REDESIGN.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-10T16:54:00.000Z";
const APP = "2026-06-10T16:55:00.000Z";

const base = {
  decisionId: "D-QUEUE-CLOSEOUT-2026-06-10",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Close out the full 2026-06-10 open-thread queue: FX gateway thresholds, returns wiring Wave B, goal-loop instrumentation, obligations->policies mapping, FX OTC build-3, IRS/LCR/reg-intelligence tail",
  category: "engineering" as const,
  recommendation:
    "Dispatch and land all six open queue items: (1) ratify the FX pre-trade gateway capital-impact + funding thresholds (CRO primary, ALCO/Treasury co-own) and wire routeOrderToGateway from approve-always to enforcing against the ratified thresholds; (2) WS-RETURNS-SUBMISSION-WIRING Wave B for the remaining inert returns subscribers, following the Wave A BA 300 LCR pattern; (3) instrument the 15 remaining uninstrumented goal-loops with AgentRunStarted/Completed/Failed lifecycle events, following the Atlas goal-loop pattern of PR #1182; (4) build the obligations->policies mapping layer so adopted obligations trace to the policies that implement them; (5) FX OTC umbrella build-3 rule-widen plus the deferred any-pair/all-counterparty/chain/UI/option tail; (6) close the named tail items B-IRS-DISALLOWANCES, B-IRS-MULTICURVE, GAP-LCR-CONSOLIDATION-ENGINE, and the reg-intelligence per-regulator ALIGNS_TO gaps with advisory gates promoted to enforcing where green.",
  rationale:
    "CEO instruction 'do all' given in-session 2026-06-10 over the six-item queue Scrooge presented (decision-required scan was clean: Tomas daily-reconciliation failure streak resolved by PR #1136 in production, zero high/critical SubstrateAlerts, :3010 deploy current). Standing CEO approval authorises downstream dispatch under the no-pause rule; per-item authority follows the decision-authority routing table (FX gateway thresholds remain a CRO/ALCO ratification inside item 1).",
  citations: [
    "Principles/1-events-are-truth.md",
    "Principles/6-autonomous-by-default.md",
    "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
    "D-OBLIGATIONS-REGISTER-CLEANUP",
    "D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
