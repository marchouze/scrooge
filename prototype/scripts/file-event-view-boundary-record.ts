// scripts/file-event-view-boundary-record.ts
//
// One-shot RMS Phase 3 filing for Atlas's event-vs-view boundary record +
// `OfficialMarkAdopted` / `PeriodClosed` schemas (markdown form).
//
// Also registers the workstream WS-PRINCIPLE-1-EVENT-VIEW-BOUNDARY so the
// follow-on implementation slices have a citable workstream id.
//
// Authority: D-RMS-PHASE-3 (active); D-MARKETS-SCHEMA-FOUNDATION;
//            Principle 1 — events are the only source of truth.
// Author: Atlas (Core banking platform architect, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { clock, eventStore } from "../platform/composition";
import { makeWorkstreamRegistered } from "../platform/event-store/event-types/platform";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-05-20_atlas_event-view-boundary-and-mark-period-events.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const asOf = clock.now();

// 1. Register the workstream (citable handle for follow-on slices).
const workstreamEvent = makeWorkstreamRegistered({
  asOf,
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "service", id: "agent:atlas:engineering" },
  citations: ["D-MARKETS-SCHEMA-FOUNDATION", "Principles/1-events-are-truth.md"],
  payload: {
    workstreamId: "WS-PRINCIPLE-1-EVENT-VIEW-BOUNDARY",
    title: "Principle 1 — event-vs-view boundary substrate",
    owner: "agent:atlas:engineering",
    status: "planned",
    summary:
      "Codify OfficialMarkAdopted, ValuationPolicyVersionActivated, and PeriodClosed event types; reclassify *PositionRevalued; close the policy-version-in-force gap so month-end replay is machine-assertable.",
  },
});
eventStore.append(workstreamEvent);

// 2. File the boundary record into the Documents register.
const result = recordFiled(
  {
    recordId: "record:documents:atlas:event-view-boundary-and-mark-period-events:2026-05-20",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-MARKETS-SCHEMA-FOUNDATION", "Principles/1-events-are-truth.md"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Event-vs-view boundary + OfficialMarkAdopted / PeriodClosed schemas",
      path: "2026-05-20_atlas_event-view-boundary-and-mark-period-events.md",
      category: "design-note",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-05-20",
    },
  },
  asOf,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      workstreamEventId: workstreamEvent.event_id,
      recordEventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
