// runtime/agents/callables/mira.ts
// Per-agent callable map for Mira (Compliance / RegTech Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import miraCitationGate from "../mira-citation-gate";
import miraEventTriage from "../mira-event-triage";
import miraGoalLoop from "../mira-goal-loop";
import miraKycOnboardingGateway from "../mira-kyc-onboarding-gateway";
import miraM1RegulatorCitationUrns from "../mira-m1-regulator-citation-urns";
import miraObligationsSnapshot from "../mira-obligations-snapshot";
import type { AgentRunHandler } from "../../types";

export const MIRA_CALLABLES: Record<string, AgentRunHandler> = {
  "mira:obligations-snapshot": miraObligationsSnapshot,
  "mira:citation-gate": miraCitationGate,
  "mira:goal-loop": miraGoalLoop,
  "mira:kyc-onboarding-gateway": miraKycOnboardingGateway,
  "mira:m1-regulator-citation-urns": miraM1RegulatorCitationUrns,
  "mira:event-triage": miraEventTriage,
};
