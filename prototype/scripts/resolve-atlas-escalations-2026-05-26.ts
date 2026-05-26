// scripts/resolve-atlas-escalations-2026-05-26.ts
//
// Resolves 6 Atlas AgentEscalation events (date-stamped duplicates for two
// questions) and the D-SLICE-B-TEST-REQUEST test placeholder Decision.
//
// CEO decisions (session delegation, 2026-05-26):
//   esc:atlas:bus-in-process-*   → "Unblocked — no integration test needed.
//                                   In-process fan-out satisfies pipelines #14/#15."
//   esc:atlas:cron-drift-a2-1-*  → "Prioritise A2.1 substrate scheduler now,
//                                   ahead of other M-phase work."
//
// Authority: CEO (marc@tgv.co.za), recordedVia: scrooge:session-delegation
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/resolve-atlas-escalations-2026-05-26.ts

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeAgentEscalationDecided } from "../platform/event-store/event-types/agent";
import { DECISION_TERMINAL_PHASES } from "../platform/event-store/event-types/decision";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-05-26T00:00:00.000Z";
const TERMINAL = new Set(DECISION_TERMINAL_PHASES);

// ---------------------------------------------------------------------------
// Part 1: Resolve Atlas escalations
// ---------------------------------------------------------------------------

const BUS_DECISION = {
  chosenOption:
    "Confirm in-process fan-out satisfies pipelines #14/#15 for now; track cross-process bus as M8 work only.",
  rationale:
    "CEO session delegation 2026-05-26: In-process fan-out is sufficient for " +
    "the build phase. Vera pipelines #14/#15 are unblocked. Cross-process event " +
    "bus deferred to M8 Azure cloud lift.",
};

const CRON_DECISION = {
  chosenOption: "Prioritise A2.1 substrate scheduler ahead of other M-phase items.",
  rationale:
    "CEO session delegation 2026-05-26: Atlas to prioritise the A2.1 substrate " +
    "scheduler (Bun process emitting typed ScheduledTrigger events) ahead of " +
    "other planned M-phase work. GH Actions cron workaround is retired once A2.1 lands.",
};

function getDecidedEscalationIds(): Set<string> {
  const decided = new Set<string>();
  for (const e of eventStore.replay({ type: "AgentEscalationDecided" })) {
    const p = e.payload as Record<string, unknown>;
    const id = String(p.escalationId ?? "");
    if (id) decided.add(id);
  }
  return decided;
}

function resolveEscalations(): number {
  const decided = getDecidedEscalationIds();
  let emitted = 0;
  let skipped = 0;

  for (const e of eventStore.replay({ type: "AgentEscalation" })) {
    const p = e.payload as Record<string, unknown>;
    const id = String(p.escalationId ?? "");
    if (!id) continue;
    if (decided.has(id)) {
      skipped++;
      continue;
    }

    const isBus = id.startsWith("esc:atlas:bus-in-process-");
    const isCron = id.startsWith("esc:atlas:cron-drift-a2-1-");
    if (!isBus && !isCron) continue;

    const { chosenOption, rationale } = isBus ? BUS_DECISION : CRON_DECISION;

    const event = makeAgentEscalationDecided({
      asOf: AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      eventId: `evt-esc-decided-${newEventId()}`,
      payload: { escalationId: id, decidedBy: "marc@tgv.co.za", chosenOption, rationale },
    });

    eventStore.append(event);
    decided.add(id); // update local set for idempotency within this run
    logger.info({ escalationId: id }, "resolve-atlas-escalations — decided");
    emitted++;
  }

  logger.info({ emitted, skipped }, "resolve-atlas-escalations — escalations done");
  return emitted;
}

// ---------------------------------------------------------------------------
// Part 2: Close D-SLICE-B-TEST-REQUEST test artifact
// ---------------------------------------------------------------------------

function closeTestDecision(): void {
  for (const e of eventStore.replay({ type: "Decision" })) {
    const p = e.payload as Record<string, unknown>;
    if (
      String(p.decisionId ?? "") === "D-SLICE-B-TEST-REQUEST" &&
      p.phase &&
      TERMINAL.has(String(p.phase))
    ) {
      logger.info({ decisionId: "D-SLICE-B-TEST-REQUEST" }, "resolve — already terminal, skipping");
      return;
    }
  }

  recordDecision(
    {
      decisionId: "D-SLICE-B-TEST-REQUEST",
      phase: "withdrawn",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "Slice B test request",
      category: "engineering",
      recommendation: "Withdraw — scenario test artifact, never a real decision.",
      rationale:
        "D-SLICE-B-TEST-REQUEST was emitted by a recon scenario test as a fixture " +
        "for the decision-symmetry gate (Slice B). It was never a real CEO decision. " +
        "Withdrawn 2026-05-26 via CEO session delegation to clear the open-decisions queue.",
      sourceDocHashes: [],
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      recordedVia: "scrooge:session-delegation",
    },
    AS_OF,
  );
  logger.info({ decisionId: "D-SLICE-B-TEST-REQUEST" }, "resolve — withdrawn");
}

function main(): number {
  resolveEscalations();
  closeTestDecision();
  return 0;
}

process.exit(main());
