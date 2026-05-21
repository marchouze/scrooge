// scripts/close-escalation-router-test-2026-05-12.ts
//
// One-shot: emit AgentEscalationDecided for the ghost-open escalation
// escalation:scrooge:unresolved-route:D-FOLLOW-ON-ROUTER-TEST:agent:nolan:author-persona-spec
//
// Root cause:
//   resolve-router-escalations-2026-05-07.ts used recordCeoDecision (which
//   emits CeoDecision events) instead of AgentEscalationDecided. The escalation
//   channel (channel.ts) only folds AgentEscalationDecided to transition status
//   to "decided"; it ignores CeoDecision events entirely. The CeoDecision was
//   recorded at seq 672 (via dashboard /api/decide, asOf 2026-05-07T18:06:12Z)
//   with action "approve" / "Approved as drafted." — confirming intent to
//   strike the route as a test fixture.
//
// Fix: emit the missing AgentEscalationDecided event back-dated to the
//   CeoDecision timestamp so the channel folds it as terminal ("decided").
//
// Idempotency: deterministic event_id; re-run is a UNIQUE-constraint no-op.
//
// Author: Scrooge (Chief of Staff / Orchestrator).

import { eventStore } from "../platform/composition";
import { makeAgentEscalationDecided } from "../platform/event-store/event-types/agent";
import { logger } from "../platform/observability/logger";

const ESCALATION_ID =
  "escalation:scrooge:unresolved-route:D-FOLLOW-ON-ROUTER-TEST:agent:nolan:author-persona-spec";

// Deterministic event_id for idempotency.
const EVENT_ID = "evt-2026-05-12-close-escalation-router-test-nolan";

// Back-dated to the CeoDecision timestamp (seq 672, asOf 2026-05-07T18:06:12Z).
const AS_OF = "2026-05-07T18:06:12.000Z";

function main(): number {
  // Check idempotency — skip if already decided.
  for (const e of eventStore.replay({ type: "AgentEscalationDecided" })) {
    const p = e.payload as Record<string, unknown>;
    if (p.escalationId === ESCALATION_ID) {
      logger.info(
        { escalationId: ESCALATION_ID, eventId: e.event_id },
        "skipped — already decided",
      );
      return 0;
    }
  }

  const event = makeAgentEscalationDecided({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "marc@tgv.co.za" },
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    eventId: EVENT_ID,
    payload: {
      escalationId: ESCALATION_ID,
      decidedBy: "marc@tgv.co.za",
      chosenOption: "Strike from followOnRoutes (decline to auto-fire)",
      rationale:
        "D-FOLLOW-ON-ROUTER-TEST was a substrate smoke-test fixture. The route agent:nolan:author-persona-spec has no runtime handler; the decision (CeoDecision seq 672, 2026-05-07T18:06:12Z via dashboard /api/decide) was to strike the route as a test fixture. A test-fixture guard was added to scrooge:follow-on-router to prevent recurrence. This AgentEscalationDecided back-fills the missing terminal event so the escalation channel closes the escalation correctly.",
    },
  });

  try {
    eventStore.append(event);
    logger.info(
      { escalationId: ESCALATION_ID, eventId: EVENT_ID },
      "emitted — escalation now decided",
    );
    return 0;
  } catch (e) {
    const msg = (e as Error).message;
    if (/UNIQUE constraint failed/.test(msg)) {
      logger.info({ eventId: EVENT_ID }, "skipped — already exists (idempotent)");
      return 0;
    }
    logger.error({ err: msg }, "failed");
    return 1;
  }
}

process.exit(main());
