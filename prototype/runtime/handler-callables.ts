// runtime/handler-callables.ts
//
// The agent → handler-callable map. Extracted from runtime/run.ts so
// other runtime modules (notably the follow-on-router) can dispatch by
// key without importing run.ts (which would create a circular import:
// run.ts imports the router, the router would import run.ts).
//
// Adding a new handler:
//   - Add a row to runtime/handlers-metadata.ts (canonical metadata).
//   - Add a row here (callable function pointer).
//   - The startup-validate in run.ts throws if either side is missing
//     a key.
//
// Author: Atlas

import anyaProjectionDrift from "./agents/anya-projection-drift";
import anyaProjectionRefresh from "./agents/anya-projection-refresh";
import atlasSubstrateState from "./agents/atlas-substrate-state";
import devonOperationalResilienceSnapshot from "./agents/devon-operational-resilience-snapshot";
import helenaRiskAppetiteWatch from "./agents/helena-risk-appetite-watch";
import miraCitationGate from "./agents/mira-citation-gate";
import miraObligationsSnapshot from "./agents/mira-obligations-snapshot";
import owenGovernanceCyclePrep from "./agents/owen-governance-cycle-prep";
import scroogeCeoDecisionRecord from "./agents/scrooge-ceo-decision-record";
import scroogeFollowOnRouter from "./agents/scrooge-follow-on-router";
import scroogeInboxHygiene from "./agents/scrooge-inbox-hygiene";
import sennaSecuritySubstrateState from "./agents/senna-security-substrate-state";
import veraOvernightRecon from "./agents/vera-overnight-recon";
import zaraMlroSupervision from "./agents/zara-mlro-supervision";
import type { AgentRunHandler } from "./types";

export const HANDLER_CALLABLES: Readonly<Record<string, AgentRunHandler>> = {
  "vera:overnight-recon": veraOvernightRecon,
  "atlas:substrate-state": atlasSubstrateState,
  "helena:risk-appetite-watch": helenaRiskAppetiteWatch,
  "devon:operational-resilience-snapshot": devonOperationalResilienceSnapshot,
  "anya:projection-drift": anyaProjectionDrift,
  "anya:projection-refresh": anyaProjectionRefresh,
  "scrooge:inbox-hygiene": scroogeInboxHygiene,
  "scrooge:ceo-decision-record": scroogeCeoDecisionRecord,
  "scrooge:follow-on-router": scroogeFollowOnRouter,
  "owen:governance-cycle-prep": owenGovernanceCyclePrep,
  "mira:obligations-snapshot": miraObligationsSnapshot,
  "mira:citation-gate": miraCitationGate,
  "senna:security-substrate-state": sennaSecuritySubstrateState,
  "zara:mlro-supervision": zaraMlroSupervision,
};
