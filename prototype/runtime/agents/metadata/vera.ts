// runtime/agents/metadata/vera.ts
// Per-agent handler metadata for Vera (Internal Audit Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const VERA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Vera", "overnight-recon", "scheduled", {
    cadenceHours: 24,
    cronExpression: "13 2 * * *",
  }),
  // Vera's weekly codebase quality review — distinct from overnight-recon.
  // Authority: D-AGENT-RUNTIME-AUTHORIZE (S8 / fleet-rollout slice).
  entry("Vera", "codebase-quality-review", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "23 3 * * SAT",
  }),
  // vera:goal-loop — event-driven only; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Vera", "goal-loop", "event-driven", {
    subscribesTo: ["AuditFinding", "ReconResult"],
  }),
  entry("Vera", "event-triage", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
];
