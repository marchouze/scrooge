// runtime/agents/callables/ravi.ts
// Per-agent callable map for Ravi (Treasury / ALM Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import raviAlmReadiness from "../ravi-alm-readiness";
import raviEventTriage from "../ravi-event-triage";
import raviFtpAttribution from "../ravi-ftp-attribution";
import raviFtpCurvePublish from "../ravi-ftp-curve-publish";
import raviGoalLoop from "../ravi-goal-loop";
import type { AgentRunHandler } from "../../types";

export const RAVI_CALLABLES: Record<string, AgentRunHandler> = {
  "ravi:alm-readiness": raviAlmReadiness,
  "ravi:ftp-curve-publish": raviFtpCurvePublish,
  "ravi:ftp-attribution": raviFtpAttribution,
  "ravi:goal-loop": raviGoalLoop,
  "ravi:event-triage": raviEventTriage,
};
