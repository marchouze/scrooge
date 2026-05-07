// scripts/backfill-workstream-and-decision-events-2026-05-07.ts
//
// One-off backfill: emit the events that capture work already completed today
// so the dashboard can re-derive the truth (per Principle 1 — events are the
// only source of truth) instead of relying on hand-edits to the curated seed.
//
// Backfilled events:
//   • WorkstreamCompleted — WS-MARKETS-FRANCHISE   (Saskia's first-run design)
//   • WorkstreamCompleted — WS-CISO-RECRUITMENT     (Rashida hired & in seat)
//   • WorkstreamCompleted — WS-IA-CHARTER           (charter + plan approved)
//   • CeoDecision         — D10 autonomous-agents   (operating-model rule;
//                                                    new Principle 7)
//
// Idempotency: event IDs are deterministic (event_id derived from a fixed
// seed string per backfill row). Re-running the script is a no-op because
// the event-store schema treats event_id as UNIQUE — duplicate inserts
// throw, which we catch and report.
//
// Author: Atlas (with apologies to the future replacement of the curated
// seed altogether — see roadmap item: "drop dashboard-curated.json")

import { eventStore, logger } from "../platform/composition";
import type { Event } from "../platform/event-store/types";

interface BackfillRow {
  readonly event: Event;
  readonly description: string;
}

// The agent-rule decision: Marc set this on 2026-05-07 — bank is run by
// autonomous agents, humans oversee the residual. Captured in
// `feedback_synchronous_delegation.md` (memory) and as the new Principle 7
// in `CLAUDE.md`. Source-of-truth event, so the dashboard reflects it.
const AS_OF = "2026-05-07T05:35:00.000Z";

const ROWS: BackfillRow[] = [
  {
    description: "WS-MARKETS-FRANCHISE — Saskia franchise design delivered",
    event: {
      event_id: "evt-backfill-2026-05-07-ws-markets-franchise-completed",
      type: "WorkstreamCompleted",
      as_of: AS_OF,
      entity: "BANK-ZA-001",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        workstreamId: "WS-MARKETS-FRANCHISE",
        what: "Markets franchise design",
        owner: "Saskia",
        outcomeDoc: "Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md",
        outcomeNote:
          "First-run output of the Saskia standing-agent. Build-only posture incorporated. Eight §8 questions surfaced for CEO judgement.",
      },
    },
  },
  {
    description: "WS-CISO-RECRUITMENT — Rashida hired and in seat",
    event: {
      event_id: "evt-backfill-2026-05-07-ws-ciso-recruitment-completed",
      type: "WorkstreamCompleted",
      as_of: AS_OF,
      entity: "BANK-ZA-001",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        workstreamId: "WS-CISO-RECRUITMENT",
        what: "CISO recruitment",
        owner: "Nolan",
        outcomeDoc: "Owner Inbox/2026-05-06_ciso-hire-confirmation.md",
        outcomeNote:
          "Rashida selected from the shortlist; in seat from 2026-05-06. Senna and Iris handover briefs actioned 2026-05-07.",
      },
    },
  },
  {
    description: "WS-IA-CHARTER — Charter and first audit plan approved",
    event: {
      event_id: "evt-backfill-2026-05-07-ws-ia-charter-completed",
      type: "WorkstreamCompleted",
      as_of: AS_OF,
      entity: "BANK-ZA-001",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        workstreamId: "WS-IA-CHARTER",
        what: "Internal Audit Charter + first audit plan",
        owner: "Thandiwe",
        outcomeNote:
          "Closed by CEO decisions D6 (Internal Audit Charter) and D7 (First 12-month risk-based audit plan), both approved 2026-05-06.",
      },
    },
  },
  {
    description:
      "D10 autonomous-agents — operating-model rule; new Principle 7 (Autonomous by default)",
    event: {
      event_id: "evt-backfill-2026-05-07-d10-autonomous-agents",
      type: "CeoDecision",
      as_of: AS_OF,
      entity: "BANK-ZA-001",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
      payload: {
        decisionId: "D10",
        title: "Autonomous-agent operating model — personas as standing agents",
        action: "approve",
        outcome:
          "Approved. Bank operates as an autonomous AI-run institution: every persona is a standing agent that runs on its own cadence; humans (CEO; future overseers) supervise the residual set of decisions and actions agents cannot make on their own. New Principle 7 (Autonomous by default; humans oversee the residual). CLAUDE.md and Team/Saskia.md updated; remaining /Team/ files to be upgraded to operating-spec form as a roadmap item.",
        comment:
          "Supersedes the earlier same-day 'delegation is synchronous' rule. Memory: feedback_synchronous_delegation.md.",
      },
    },
  },
];

let appended = 0;
let skipped = 0;
const failures: { id: string; err: string }[] = [];

for (const row of ROWS) {
  try {
    eventStore.append(row.event);
    appended++;
    logger.info(
      { eventId: row.event.event_id, type: row.event.type },
      `appended: ${row.description}`,
    );
  } catch (e) {
    const msg = (e as Error).message;
    if (/UNIQUE constraint failed/.test(msg)) {
      skipped++;
      logger.info(
        { eventId: row.event.event_id },
        `already present (idempotent): ${row.description}`,
      );
    } else {
      failures.push({ id: row.event.event_id, err: msg });
      logger.error({ eventId: row.event.event_id, err: msg }, `failed: ${row.description}`);
    }
  }
}

logger.info({ appended, skipped, failed: failures.length }, "backfill complete");

if (failures.length > 0) {
  process.exit(1);
}
