// scripts/file-orphan-run-deliverable-state-spec.ts
//
// Events-first filing (RMS Phase 3 RecordFiled) for Atlas's spec:
// "Classify orphan dispatch runs by deliverable state — finished-but-didn't-
// return vs abandoned."
//
// Also registers the workstream WS-DISPATCH-LIFECYCLE-INTEGRITY so the spec +
// follow-on work have a citable workstream id.
//
// Authority: D-BEA-GOAL-LOOP-SINGLE-FLIGHT; D-PROACTIVE-ESCALATION-SURFACING.
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { makeWorkstreamRegistered } from "../platform/event-store/event-types/platform";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-orphan-run-deliverable-state-spec",
  docName: "2026-06-10_atlas_orphan-run-deliverable-state-classification-spec.md",
  recordId: "record:documents:atlas:orphan-run-deliverable-state-classification-spec:2026-06-10",
  documentHash: "blake3:c63eb38dc53cb4f2f97f54f1d14326c5e6e03b1af016701825cc4c33de4a09eb",
});
const asOf = clock.now();

// 1. Register the workstream (citable handle for the spec + follow-on slices).
eventStore.append(
  makeWorkstreamRegistered({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:atlas:engineering" },
    citations: ["D-BEA-GOAL-LOOP-SINGLE-FLIGHT", "D-PROACTIVE-ESCALATION-SURFACING"],
    payload: {
      workstreamId: "WS-DISPATCH-LIFECYCLE-INTEGRITY",
      title: "Dispatch lifecycle integrity — orphan-run classification + routing",
      owner: "agent:atlas:engineering",
      status: "in-flight",
      summary:
        "Classify orphan open dispatch runs by deliverable state (finished-but-didn't-return vs abandoned); auto-reconcile merged-PR orphans (anti-fabrication gated); surface deliverable-ready orphans as low one-action items; keep abandoned ones high-severity.",
    },
  }),
);

// 2. File the spec into the Documents register.
const result = recordFiled(
  {
    recordId: "record:documents:atlas:orphan-run-deliverable-state-classification-spec:2026-06-10",
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "BANKS-ACT-94-1990",
      minimumYears: 5,
      archivalTier: "cool" as const,
    },
    citations: ["D-BEA-GOAL-LOOP-SINGLE-FLIGHT", "D-PROACTIVE-ESCALATION-SURFACING"],
    actor: { type: "service", id: "agent:atlas:engineering" },
  },
  asOf,
);

console.log(
  JSON.stringify(
    {
      filed: "2026-06-10_atlas_orphan-run-deliverable-state-classification-spec.md",
      recordId:
        "record:documents:atlas:orphan-run-deliverable-state-classification-spec:2026-06-10",
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
