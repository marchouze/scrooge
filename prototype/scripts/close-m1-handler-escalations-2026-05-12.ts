// scripts/close-m1-handler-escalations-2026-05-12.ts
//
// Back-fill AgentEscalationDecided for the 5 M1-handler escalations that were
// "resolved" on 2026-05-07 via recordCeoDecision (resolve-router-escalations-
// 2026-05-07.ts) but never received the terminal event the escalation channel
// actually folds.
//
// Root cause:
//   resolve-router-escalations-2026-05-07.ts called recordCeoDecision (emits
//   CeoDecision) for each escalation. The escalation channel (channel.ts) only
//   folds AgentEscalationDecided to transition status to "decided"; it ignores
//   CeoDecision events entirely. Each escalation therefore had a CeoDecision
//   recorded against it but remained "open" in the channel projection.
//
// Fix: emit one AgentEscalationDecided per escalation, back-dated to the
//   original CeoDecision batch timestamp (2026-05-07T18:12:00Z) so the
//   channel folds them as terminal.
//
// Idempotency: deterministic event_ids; re-run is a UNIQUE-constraint no-op.

import { eventStore } from "../platform/composition";
import { makeAgentEscalationDecided } from "../platform/event-store/event-types/agent";
import { logger } from "../platform/observability/logger";

const AS_OF = "2026-05-07T18:12:00.000Z";
const ACTOR = { type: "human" as const, id: "marc@tgv.co.za" };

const RESOLUTIONS: Array<{ escalationId: string; owner: string; chosenOption: string }> = [
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:kai:m1-cdm-typescript-bindings",
    owner: "Kai",
    chosenOption: "Build the missing handler — CDM TypeScript bindings",
  },
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:anya:m1-projection-runtime-mapping",
    owner: "Anya",
    chosenOption: "Build the missing handler — projection runtime mapping",
  },
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:bea:m1-ifrs-classification-rules",
    owner: "Bea",
    chosenOption: "Build the missing handler — IFRS classification rules",
  },
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:mira:m1-regulator-citation-urns",
    owner: "Mira",
    chosenOption: "Build the missing handler — regulator citation URNs",
  },
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:senna:m1-trading-stack-threat-model",
    owner: "Senna",
    chosenOption: "Build the missing handler — trading stack threat model",
  },
];

function alreadyDecided(escalationId: string): boolean {
  for (const e of eventStore.replay({ type: "AgentEscalationDecided" })) {
    const p = e.payload as Record<string, unknown>;
    if (p.escalationId === escalationId) return true;
  }
  return false;
}

function main(): number {
  let emitted = 0;
  let skipped = 0;

  for (const r of RESOLUTIONS) {
    const eventId = `evt-2026-05-12-close-m1-${r.owner.toLowerCase()}`;

    if (alreadyDecided(r.escalationId)) {
      logger.info({ escalationId: r.escalationId }, "skipped — already decided");
      skipped++;
      continue;
    }

    const event = makeAgentEscalationDecided({
      asOf: AS_OF,
      entity: "BANK-ZA-001",
      actor: ACTOR,
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      eventId,
      payload: {
        escalationId: r.escalationId,
        decidedBy: "marc@tgv.co.za",
        chosenOption: r.chosenOption,
        rationale: `D-MARKETS-SCHEMA-FOUNDATION M1 handler: the CeoDecision (approve) was recorded on 2026-05-07 via resolve-router-escalations-2026-05-07.ts with action "approve" / "Approved as recommended. Build the missing handler." ${r.owner} owns the implementation under the M1 build sequence authorised in D-MARKETS-SCHEMA-FOUNDATION. This AgentEscalationDecided back-fills the missing terminal event so the escalation channel closes the escalation correctly.`,
      },
    });

    try {
      eventStore.append(event);
      logger.info({ escalationId: r.escalationId, eventId }, "emitted — escalation now decided");
      emitted++;
    } catch (e) {
      const msg = (e as Error).message;
      if (/UNIQUE constraint failed/.test(msg)) {
        logger.info({ eventId }, "skipped — already exists (idempotent)");
        skipped++;
      } else {
        logger.error({ escalationId: r.escalationId, err: msg }, "failed");
        return 1;
      }
    }
  }

  logger.info({ emitted, skipped }, "close-m1-handler-escalations complete");
  return 0;
}

process.exit(main());
