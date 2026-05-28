#!/usr/bin/env bun
// CEO approves Eitan's intraday unwind strategy for B3 FX NOP breach.
// Closes escalation ESC-FX-B3-2026-05-28 via AgentEscalationDecided.

import { eventStore } from "../platform/composition";
import { makeAgentEscalationDecided } from "../platform/event-store/event-types/agent";

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = new Date().toISOString();

const decided = makeAgentEscalationDecided({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "human", id: "marc@tgv.co.za" },
  citations: ["RAS-B3", "EXCON-OECD-FX-001", "TEAM-EITAN-SPEC-S10"],
  payload: {
    escalationId: "ESC-FX-B3-2026-05-28",
    decidedBy: "marc@tgv.co.za",
    chosenOption: "approve-intraday-unwind-strategy",
    rationale:
      "CEO approves Eitan's direction to Saskia to reduce FX NOP by ZAR 53.9M via USD/ZAR sells to reach target ZAR 180M. No appetite change required. Proceed under existing Excon authority.",
  },
});

eventStore.append(decided);
console.log(
  "AgentEscalationDecided emitted — escalationId=ESC-FX-B3-2026-05-28, chosenOption=approve-intraday-unwind-strategy",
);
