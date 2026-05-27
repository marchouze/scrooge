// runtime/agents/metadata/env.ts
// Per-agent handler metadata for Env (External Environment Simulator).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const ENV_HANDLER_METADATA: readonly HandlerMetadata[] = [
  // Weekly readiness snapshot — surfaces sim-engine substrate gaps,
  // sub-simulator state, and scheduled-autonomy gap (Team/Env.md §16).
  // Cadence: Fridays at 07:17 UTC (weekly, consistent with other
  // engineering-substrate agents).
  entry("Env", "readiness", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "17 7 * * FRI",
  }),
];
