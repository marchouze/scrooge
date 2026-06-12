// scripts/decide-helena-unmeasured-lines-2026-06-12.ts
//
// Resolves escalation:helena:unmeasured-lines-2026-06-12 and records the
// CEO decision authorising the corresponding engineering dispatch.
//
// The escalation's live-derived question identifies the actual unmeasured
// line as appetite:irrbb:delta-eve-outlier (RAS §B4, owner Rohan (eng) →
// Helena (CRO, governance)). Its hardcoded options reference RAS §B6/§B7
// lines that have since become measured — the CEO decision targets the
// real §B4 gap, not the stale options. The same dispatch covers fixing
// Helena's handler so options derive from live lineStatuses (same defect
// class as D-CRO-GAP-SECTION-DERIVE-FROM-STORE, 2026-06-08).
//
// Authority: CEO (marc@tgv.co.za), recordedVia: scrooge:session-delegation
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/decide-helena-unmeasured-lines-2026-06-12.ts

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeAgentEscalationDecided } from "../platform/event-store/event-types/agent";
import { DECISION_TERMINAL_PHASES } from "../platform/event-store/event-types/decision";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-12T00:00:00.000Z";
const ESCALATION_ID = "escalation:helena:unmeasured-lines-2026-06-12";
const DECISION_ID = "D-IRRBB-DELTA-EVE-OUTLIER-MEASUREMENT";
const TERMINAL = new Set(DECISION_TERMINAL_PHASES);

const CHOSEN_OPTION =
  "Dispatch Rohan (market-risk engineering) + Atlas (platform substrate) to build the " +
  "RAS §B4 appetite:irrbb:delta-eve-outlier measurement substrate. The escalation's " +
  "hardcoded §B6/§B7 options are stale and do not match the live-derived unmeasured " +
  "line; the dispatch also derives Helena's escalation options from live lineStatuses.";

const RATIONALE =
  "CEO session delegation 2026-06-12: the §B4 delta-EVE outlier line has been " +
  "unmeasured for 9 consecutive risk-appetite-watch runs. Helena governs but cannot " +
  "build measurement substrate (§3). Approving the escalation does not auto-dispatch " +
  "— no consumer of AgentEscalationDecided opens a brief — so Scrooge dispatches " +
  "under the no-pause rule in the same turn.";

function alreadyDecided(): boolean {
  for (const e of eventStore.replay({ type: "AgentEscalationDecided" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.escalationId ?? "") === ESCALATION_ID) return true;
  }
  return false;
}

function decisionAlreadyTerminal(): boolean {
  for (const e of eventStore.replay({ type: "Decision" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.decisionId ?? "") === DECISION_ID && p.phase && TERMINAL.has(String(p.phase))) {
      return true;
    }
  }
  return false;
}

if (decisionAlreadyTerminal()) {
  logger.info(
    { decisionId: DECISION_ID },
    "decide-helena-unmeasured — decision already terminal, skipping",
  );
} else {
  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Build RAS §B4 delta-EVE outlier measurement substrate (resolves Helena unmeasured-lines escalation)",
      category: "engineering",
      recommendation: CHOSEN_OPTION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [],
      recordedVia: "scrooge:session-delegation",
    },
    AS_OF,
  );
  logger.info(
    { decisionId: DECISION_ID },
    "decide-helena-unmeasured — Decision(approved) recorded",
  );
}

if (alreadyDecided()) {
  logger.info(
    { escalationId: ESCALATION_ID },
    "decide-helena-unmeasured — escalation already decided, skipping",
  );
} else {
  eventStore.append(
    makeAgentEscalationDecided({
      asOf: AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      eventId: `evt-esc-decided-${newEventId()}`,
      payload: {
        escalationId: ESCALATION_ID,
        decidedBy: "marc@tgv.co.za",
        chosenOption: CHOSEN_OPTION,
        rationale: RATIONALE,
      },
    }),
  );
  logger.info(
    { escalationId: ESCALATION_ID },
    "decide-helena-unmeasured — AgentEscalationDecided emitted",
  );
}
