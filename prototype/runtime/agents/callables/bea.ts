// runtime/agents/callables/bea.ts
// Per-agent callable map for Bea (Accounting & Financial Reporting Engineer).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import beaAccountingReadiness from "../bea-accounting-readiness";
import beaEventTriage from "../bea-event-triage";
import beaFxPostingEngine from "../bea-fx-posting-engine";
import { beaGlPostingEngine } from "../bea-gl-posting-engine";
import beaGoalLoop from "../bea-goal-loop";
import beaM1IfrsClassificationRules from "../bea-m1-ifrs-classification-rules";
import beaPeriodClose from "../bea-period-close";

export const BEA_CALLABLES: Record<string, AgentRunHandler> = {
  "bea:goal-loop": beaGoalLoop,
  "bea:accounting-readiness": beaAccountingReadiness,
  "bea:fx-posting-engine": beaFxPostingEngine,
  "bea:gl-posting-engine": beaGlPostingEngine,
  "bea:m1-ifrs-classification-rules": beaM1IfrsClassificationRules,
  "bea:event-triage": beaEventTriage,
  "bea:period-close": beaPeriodClose,
};
