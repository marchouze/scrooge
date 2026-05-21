// scripts/emit-camille-capital-plan-2026-05-12.ts
//
// One-shot: emit an AgentRunCompleted event recording Camille's (CFO, finance)
// capital plan deliverable under D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12).
//
// Events-first authoring (Principle 1): the markdown document is a render of
// this event; this event is the canonical artefact. The document body is stored
// in the RMS document store and referenced by BLAKE3 hash.
//
// Substrate gap noted: no `CapitalPlanProduced` typed event exists in
// prototype/platform/event-store/event-types/. AgentRunCompleted (RMS-3) is
// used as the closest available typed record. The gap is logged below and
// surfaced via `substrateGapsSurfaced` in the event payload.
//
// Run once; idempotent on the document-store layer (same bytes = same hash).
// The AgentRunCompleted event is appended on every run — guard on the run-id
// to skip duplicates.
//
// Authority: D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12).
// Author: Camille (CFO, finance)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordAgentRunCompleted } from "../platform/records";

const RUN_ID = "camille-capital-plan-d-markets-capital-time-shape-2026-05-12";
const BRIEF_ID = "2026-05-12_scrooge_camille_capital-time-shape-approved";
const AS_OF = "2026-05-12T09:00:00.000Z";
const REPO_ROOT = join(import.meta.dir, "../..");

const CAMILLE_ACTOR = { type: "service" as const, id: "camille@bank-za-001" };
const CAMILLE_REF = { name: "Camille", position: "CFO, finance", agentId: "camille" } as const;

const CITATIONS = ["D-MARKETS-CAPITAL-TIME-SHAPE", "D-RMS-PHASE-1"];

const SUBSTRATE_GAPS = [
  "No CapitalPlanProduced typed event exists in prototype/platform/event-store/event-types/; AgentRunCompleted (RMS-3) used as interim record. Atlas to add finance event-types module.",
];

function main(): number {
  // Idempotency guard — skip if run-id already present.
  for (const e of eventStore.replay({ type: "AgentRunCompleted" })) {
    const payload = e.payload as Record<string, unknown>;
    if (payload.runId === RUN_ID) {
      logger.info({ runId: RUN_ID }, "skipped — AgentRunCompleted event already exists");
      return 0;
    }
  }

  // Read the deliverable document body from the Owner Inbox.
  const deliverablePath = join(
    REPO_ROOT,
    "Owner Inbox/2026-05-12_camille_capital-plan-d-markets-capital-time-shape.md",
  );
  const deliverableBody = readFileSync(deliverablePath, "utf-8");

  const result = recordAgentRunCompleted(
    {
      runId: RUN_ID,
      briefId: BRIEF_ID,
      agent: CAMILLE_REF,
      completedAt: AS_OF,
      outcome: "delivered",
      deliverableBodies: [deliverableBody],
      substrateGapsSurfaced: SUBSTRATE_GAPS,
      deliverableCitations: [...CITATIONS],
      followOnRoutes: [
        {
          kind: "agent",
          target: "helena",
          directive:
            "ICAAP RWA sizing — use R150m trading-book backing + ~R125m ILAAP buffer as approved inputs; confirm or adjust sizing",
        },
      ],
      citations: [...CITATIONS],
      actor: CAMILLE_ACTOR,
      entity: "LE-ZA-HOZ-BANK",
    },
    AS_OF,
  );

  logger.info(
    {
      runId: RUN_ID,
      eventId: result.eventId,
      documentHashes: result.deliverableDocumentHashes,
      newDocuments: result.newDeliverableCount,
    },
    "AgentRunCompleted event emitted — Camille capital plan",
  );

  return 0;
}

process.exit(main());
