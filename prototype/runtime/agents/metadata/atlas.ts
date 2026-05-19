// runtime/agents/metadata/atlas.ts
// Per-agent handler metadata for Atlas (Core Banking Platform Architect).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const ATLAS_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Atlas", "substrate-state", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "19 6 * * 1",
  }),
  // atlas:goal-loop — hourly tick; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3, D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  entry("Atlas", "goal-loop", "scheduled", {
    cadenceHours: 1,
    cronExpression: "0 * * * *",
  }),
  entry("Atlas", "event-triage", "event-driven", {
    subscribesTo: ["EventSchemaProposal", "IdentityPermissionChangeProposal", "SubstrateAlert"],
  }),
  // atlas:permission-policy-refresh — T-12 mitigation. Fires on AgentRegistered to auto-publish
  // PermissionPolicyPublished for newly-registered (or re-registered) agents. Also sweeps the
  // full registry on each invocation to catch stale policies.
  // Authority: T-12, D-T01-PERMISSION-GATE-SECURE-DEFAULT, P4-SECURITY-DESIGNED-IN, ORG-CY-09.
  entry("Atlas", "permission-policy-refresh", "event-driven", {
    subscribesTo: ["AgentRegistered"],
  }),
  // atlas:collateral-snapshot — daily HQLA collateral inventory snapshot.
  // Classifies security positions per BA 325 Annex 1, checks L2/L2b caps,
  // emits CollateralInventorySnapshot and (if caps breached) HQLACompositionDrift.
  // Closes Eitan's substrate gap "Collateral inventory substrate — not yet built."
  // Authority: BA 325 Annex 1; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
  entry("Atlas", "collateral-snapshot", "scheduled", {
    cadenceHours: 24,
    cronExpression: "30 6 * * *",
  }),
  // atlas:ilaap-run — quarterly ILAAP stress scenario engine.
  // Runs 4 scenarios (idiosyncratic, market-wide, combined, reverse-stress).
  // Emits ILAAPScenarioRun (×4) + ILAAPSummaryCompleted + IcaapIlaapInputReady.
  // Escalates via AgentEscalation if overallStatus === "inadequate".
  // Closes Eitan's substrate gap "ILAAP engine — not yet built."
  // Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; BA 325; PA ILAAP guidance.
  entry("Atlas", "ilaap-run", "scheduled", {
    cadenceHours: 24 * 90,
    cronExpression: "0 7 1 1,4,7,10 *",
  }),
];
