// runtime/agents/callables/ravi.ts
// Per-agent callable map for Ravi (Treasury / ALM Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import raviAlmReadiness from "../ravi-alm-readiness";
import raviAlmRun from "../ravi-alm-run";
import raviCfpEwiMonitor from "../ravi-cfp-ewi-monitor";
import raviEventTriage from "../ravi-event-triage";
import raviFtpAttribution from "../ravi-ftp-attribution";
import raviFtpCurvePublish from "../ravi-ftp-curve-publish";
import raviGoalLoop from "../ravi-goal-loop";
import raviIntradayLiquidityMetrics from "../ravi-intraday-liquidity-metrics";
import raviIntradayStress from "../ravi-intraday-stress";
import raviJibarFixingIngest from "../ravi-jibar-fixing-ingest";
import raviJibarSwapCurveIngest from "../ravi-jibar-swap-curve-ingest";
import raviRepoPrimeIngest from "../ravi-repo-rate-ingest";

export const RAVI_CALLABLES: Record<string, AgentRunHandler> = {
  "ravi:alm-readiness": raviAlmReadiness,
  "ravi:alm-run": raviAlmRun,
  "ravi:cfp-ewi-monitor": raviCfpEwiMonitor,
  "ravi:ftp-curve-publish": raviFtpCurvePublish,
  "ravi:ftp-attribution": raviFtpAttribution,
  "ravi:goal-loop": raviGoalLoop,
  "ravi:event-triage": raviEventTriage,
  "ravi:intraday-liquidity-metrics": raviIntradayLiquidityMetrics,
  "ravi:intraday-stress": raviIntradayStress,
  "ravi:jibar-fixing-ingest": raviJibarFixingIngest,
  "ravi:jibar-swap-curve-ingest": raviJibarSwapCurveIngest,
  "ravi:repo-rate-ingest": raviRepoPrimeIngest,
};
