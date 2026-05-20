// runtime/agents/callables/atlas.ts
// Per-agent callable map for Atlas (Core Banking Platform Architect).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import atlasAlcoPack from "../atlas-alco-pack";
import atlasCollateralSnapshot from "../atlas-collateral-snapshot";
import atlasEventTriage from "../atlas-event-triage";
import atlasGoalLoop from "../atlas-goal-loop";
import atlasIlaapRun from "../atlas-ilaap-run";
import atlasPermissionPolicyRefresh from "../atlas-permission-policy-refresh";
import atlasProductNarrativeFulfilment from "../atlas-product-narrative-fulfilment";
import atlasSubstrateState from "../atlas-substrate-state";

export const ATLAS_CALLABLES: Record<string, AgentRunHandler> = {
  "atlas:substrate-state": atlasSubstrateState,
  "atlas:goal-loop": atlasGoalLoop,
  "atlas:event-triage": atlasEventTriage,
  "atlas:permission-policy-refresh": atlasPermissionPolicyRefresh,
  "atlas:collateral-snapshot": atlasCollateralSnapshot,
  "atlas:ilaap-run": atlasIlaapRun,
  "atlas:alco-pack": atlasAlcoPack,
  "atlas:product-narrative-fulfilment": atlasProductNarrativeFulfilment,
};
