// runtime/agents/callables/atlas.ts
// Per-agent callable map for Atlas (Core Banking Platform Architect).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import atlasEventTriage from "../atlas-event-triage";
import atlasGoalLoop from "../atlas-goal-loop";
import atlasPermissionPolicyRefresh from "../atlas-permission-policy-refresh";
import atlasSubstrateState from "../atlas-substrate-state";

export const ATLAS_CALLABLES: Record<string, AgentRunHandler> = {
  "atlas:substrate-state": atlasSubstrateState,
  "atlas:goal-loop": atlasGoalLoop,
  "atlas:event-triage": atlasEventTriage,
  "atlas:permission-policy-refresh": atlasPermissionPolicyRefresh,
};
