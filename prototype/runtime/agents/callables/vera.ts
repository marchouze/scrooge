// runtime/agents/callables/vera.ts
// Per-agent callable map for Vera (Internal Audit Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import veraCodebaseQualityReview from "../vera-codebase-quality-review";
import veraEventTriage from "../vera-event-triage";
import veraGoalLoop from "../vera-goal-loop";
import veraIssuesTracker from "../vera-issues-tracker";
import veraOvernightRecon from "../vera-overnight-recon";

export const VERA_CALLABLES: Record<string, AgentRunHandler> = {
  "vera:overnight-recon": veraOvernightRecon,
  "vera:codebase-quality-review": veraCodebaseQualityReview,
  "vera:goal-loop": veraGoalLoop,
  "vera:event-triage": veraEventTriage,
  "vera:issues-tracker": veraIssuesTracker,
};
