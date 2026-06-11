// runtime/agents/callables/bea.ts
// Per-agent callable map for Bea (Accounting & Financial Reporting Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import beaAccountingReadiness from "../bea-accounting-readiness";
import beaBa300LcrPeriodClose from "../bea-ba300-lcr-period-close";
import beaBa310PeriodClose from "../bea-ba310-period-close";
import beaBa400PeriodClose from "../bea-ba400-period-close";
import beaBa700PeriodClose from "../bea-ba700-period-close";
import beaEventTriage from "../bea-event-triage";
import { beaGlPostingEngine } from "../bea-gl-posting-engine";
import beaGoalLoop from "../bea-goal-loop";
import beaM1IfrsClassificationRules from "../bea-m1-ifrs-classification-rules";
import beaPeriodClose from "../bea-period-close";
import beaProductControlDaily from "../bea-product-control-daily";
import beaRwaPeriodClose from "../bea-rwa-period-close";

export const BEA_CALLABLES: Record<string, AgentRunHandler> = {
  "bea:goal-loop": beaGoalLoop,
  "bea:accounting-readiness": beaAccountingReadiness,
  "bea:gl-posting-engine": beaGlPostingEngine,
  "bea:m1-ifrs-classification-rules": beaM1IfrsClassificationRules,
  "bea:event-triage": beaEventTriage,
  "bea:period-close": beaPeriodClose,
  "bea:ba310-period-close": beaBa310PeriodClose,
  "bea:ba300-lcr-period-close": beaBa300LcrPeriodClose,
  "bea:ba400-period-close": beaBa400PeriodClose,
  "bea:rwa-period-close": beaRwaPeriodClose,
  "bea:ba700-period-close": beaBa700PeriodClose,
  "bea:product-control-daily": beaProductControlDaily,
};
