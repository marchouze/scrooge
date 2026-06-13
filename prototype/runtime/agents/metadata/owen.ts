// runtime/agents/metadata/owen.ts
// Per-agent handler metadata for Owen (Company Secretary / Governance).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const OWEN_HANDLER_METADATA: readonly HandlerMetadata[] = [
  // owen:goal-loop — daily 07:00 UTC; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Owen", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 7 * * *",
  }),
  entry("Owen", "governance-cycle-prep", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "31 7 * * 2",
  }),
  entry("Owen", "event-triage", "event-driven", {
    subscribesTo: [
      "ResolutionRequired",
      "ConflictDeclared",
      "RelatedPartyTransactionProposed",
      "WhistleblowingDisclosure",
      "PAIARequest",
      "MOIChangeProposed",
      "SupervisoryLetterReceived",
      "AgentEscalation",
    ],
  }),
  // owen:decision-impact-sweep — the W8 S9 auto-trigger. Fires on every appended
  // `Decision`; the handler sweeps only those in phase `approved`. Closes the
  // loop "when a Decision lands, an automated sweep computes its impact".
  // Idempotent (bus BusDispatched + handler sweep-level guard) → replay/
  // migration-safe. Authority: D-W8-DECISION-IMPACT-SWEEP.
  entry("Owen", "decision-impact-sweep", "event-driven", {
    subscribesTo: ["Decision"],
  }),
];
