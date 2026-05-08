// scripts/backfill-escalation-recommendations-2026-05-07.ts
//
// One-off: re-emit existing unresolved-route AgentEscalation events with the
// new optional `recommendation` payload populated. The dashboard's escalation
// lift takes the latest event per escalationId, so emitting a fresh event
// with the same escalationId supersedes the recommendation-less original.
//
// Substrate change context (2026-05-07): Marc surfaced that no open decision
// on the dashboard was carrying a recommendation. The follow-on router now
// emits a stance with each unresolved-route escalation; this backfill brings
// the eight escalations already in the store up to the new shape so the CEO
// view is consistent.
//
// Author: Scrooge (orchestration) · Atlas (event substrate).

import { eventStore, logger } from "../platform/composition";
import { makeAgentEscalation } from "../platform/event-store/event-types";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

// The asOf is "now" — the supersession is happening now, not back-dated.
const asOf = new Date().toISOString();

let supersededCount = 0;
let skippedCount = 0;

for (const e of eventStore.replay({ type: "AgentEscalation" })) {
  const p = e.payload as Record<string, unknown>;
  const escalationId = String(p.escalationId ?? "");
  if (!escalationId.startsWith("escalation:scrooge:unresolved-route:")) {
    skippedCount++;
    continue;
  }
  if (p.recommendation && typeof p.recommendation === "object") {
    skippedCount++;
    continue;
  }

  // Decision-id and route are encoded in the escalationId after the prefix:
  // escalation:scrooge:unresolved-route:<DECISION_ID>:agent:<name>:<trigger>
  const tail = escalationId.slice("escalation:scrooge:unresolved-route:".length);
  const firstColon = tail.indexOf(":agent:");
  const decisionId = firstColon >= 0 ? tail.slice(0, firstColon) : "(unknown)";
  const route = firstColon >= 0 ? tail.slice(firstColon + 1) : tail;

  // Re-emit with recommendation populated. We preserve every other payload
  // field verbatim so this is a pure recommendation backfill.
  eventStore.append(
    makeAgentEscalation({
      asOf,
      entity: e.entity,
      actor: { type: "service", id: "agent:scrooge:follow-on-router" },
      citations: EVENT_CITATIONS,
      payload: {
        escalationId,
        raisedBy: String(p.raisedBy ?? "Scrooge"),
        question: String(p.question ?? ""),
        options: Array.isArray(p.options) ? (p.options as string[]) : [],
        blockedBy: String(p.blockedBy ?? ""),
        severity:
          p.severity === "low" ||
          p.severity === "medium" ||
          p.severity === "high" ||
          p.severity === "blocking"
            ? p.severity
            : "medium",
        routedTo: String(p.routedTo ?? "human:marc@tgv.co.za"),
        ...(typeof p.deadline === "string" ? { deadline: p.deadline } : {}),
        recommendation: {
          stance: "Build the missing handler",
          reasoning: `Parent decision ${decisionId} was approved, which authorised the substantive work behind \`${route}\`. The unresolved route is a substrate gap (handler not yet registered in runtime/handlers-metadata.ts), not a scope question. Default stance is to register the handler so the chain auto-fires next CEO approval; re-target only if a fitter handler exists, and strike only when the route was a synthetic test fixture.`,
        },
      },
    }),
  );
  supersededCount++;
}

logger.info({ supersededCount, skippedCount }, "backfill — escalation recommendations");
console.log(
  `Superseded ${supersededCount} escalation event(s); skipped ${skippedCount} (already had recommendation, or not an unresolved-route escalation).`,
);
