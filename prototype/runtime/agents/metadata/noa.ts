// runtime/agents/metadata/noa.ts
// Per-agent handler metadata for Noa (Intranet Product Owner & UI Architect).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const NOA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  // Three event-driven handlers — one per typed event family.
  // Authority: Principle 1 (events-first authoring per CLAUDE.md).
  entry("Noa", "feature-shipped", "event-driven", {
    subscribesTo: ["IntranetFeatureShipped"],
  }),
  entry("Noa", "design-review-complete", "event-driven", {
    subscribesTo: ["DesignReviewComplete"],
  }),
  entry("Noa", "ux-finding-raised", "event-driven", {
    subscribesTo: ["UXFindingRaised"],
  }),
  // Weekly design-sprint-boundary ops cycle per Team/Noa.md §6 "Cadence".
  // Cadence: Tuesdays at 08:11 UTC (consistent with Linnea's sprint cadence).
  entry("Noa", "ops-cycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "11 8 * * TUE",
  }),
];
