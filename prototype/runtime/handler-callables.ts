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

import anyaEventTriage from "./agents/anya-event-triage";
import anyaGoalLoop from "./agents/anya-goal-loop";
import anyaM1ProjectionRuntimeMapping from "./agents/anya-m1-projection-runtime-mapping";
import anyaProjectionDrift from "./agents/anya-projection-drift";
import anyaProjectionRefresh from "./agents/anya-projection-refresh";
import atlasEventTriage from "./agents/atlas-event-triage";
import atlasGoalLoop from "./agents/atlas-goal-loop";
import atlasSubstrateState from "./agents/atlas-substrate-state";
import beaAccountingReadiness from "./agents/bea-accounting-readiness";
import beaEventTriage from "./agents/bea-event-triage";
import beaGoalLoop from "./agents/bea-goal-loop";
import beaM1IfrsClassificationRules from "./agents/bea-m1-ifrs-classification-rules";
import camilleEventTriage from "./agents/camille-event-triage";
import camilleFinancialPositionSnapshot from "./agents/camille-financial-position-snapshot";
import devonEventTriage from "./agents/devon-event-triage";
import devonOperationalResilienceSnapshot from "./agents/devon-operational-resilience-snapshot";
import eitanEventTriage from "./agents/eitan-event-triage";
import eitanLiquiditySnapshot from "./agents/eitan-liquidity-snapshot";
import helenaEventTriage from "./agents/helena-event-triage";
import helenaGoalLoop from "./agents/helena-goal-loop";
import helenaRiskAppetiteWatch from "./agents/helena-risk-appetite-watch";
import imaniEventTriage from "./agents/imani-event-triage";
import imaniLegalReadiness from "./agents/imani-legal-readiness";
import irisEventTriage from "./agents/iris-event-triage";
import irisPopiaControlsSnapshot from "./agents/iris-popia-controls-snapshot";
import kaiEventTriage from "./agents/kai-event-triage";
import kaiM1CdmTypescriptBindings from "./agents/kai-m1-cdm-typescript-bindings";
import kaiPreTradeGatewayAggregator from "./agents/kai-pre-trade-gateway-aggregator";
import linneaEventTriage from "./agents/linnea-event-triage";
import linneaOpsCycle from "./agents/linnea-ops-cycle";
import miraCitationGate from "./agents/mira-citation-gate";
import miraEventTriage from "./agents/mira-event-triage";
import miraGoalLoop from "./agents/mira-goal-loop";
import miraM1RegulatorCitationUrns from "./agents/mira-m1-regulator-citation-urns";
import miraObligationsSnapshot from "./agents/mira-obligations-snapshot";
import nadiaEventTriage from "./agents/nadia-event-triage";
import nadiaValidationCycle from "./agents/nadia-validation-cycle";
import nikoClientLifecycle from "./agents/niko-client-lifecycle";
import nikoEventTriage from "./agents/niko-event-triage";
import nolanEventTriage from "./agents/nolan-event-triage";
import nolanHiringCycle from "./agents/nolan-hiring-cycle";
import owenEventTriage from "./agents/owen-event-triage";
import owenGoalLoop from "./agents/owen-goal-loop";
import owenGovernanceCyclePrep from "./agents/owen-governance-cycle-prep";
import paxEventTriage from "./agents/pax-event-triage";
import paxRoleResearchQueue from "./agents/pax-role-research-queue";
import rashidaCyberResilienceSnapshot from "./agents/rashida-cyber-resilience-snapshot";
import rashidaEventTriage from "./agents/rashida-event-triage";
import raviAlmReadiness from "./agents/ravi-alm-readiness";
import raviEventTriage from "./agents/ravi-event-triage";
import rohanBacktestHarness from "./agents/rohan-backtest-harness";
import rohanEventTriage from "./agents/rohan-event-triage";
import rohanGoalLoop from "./agents/rohan-goal-loop";
import rohanRiskRun from "./agents/rohan-risk-run";
import sadeAgentopsReadiness from "./agents/sade-agentops-readiness";
import sadeEventTriage from "./agents/sade-event-triage";
import saskiaEventTriage from "./agents/saskia-event-triage";
import saskiaMarketsReadinessSnapshot from "./agents/saskia-markets-readiness-snapshot";
import scroogeCeoDecisionRecord from "./agents/scrooge-ceo-decision-record";
import scroogeEventTriage from "./agents/scrooge-event-triage";
import { createHandler as createScroogeFollowOnRouter } from "./agents/scrooge-follow-on-router";
import scroogeInboxHygiene from "./agents/scrooge-inbox-hygiene";
import scroogeOwnerInboxArchiver from "./agents/scrooge-owner-inbox-archiver";
import sennaEventTriage from "./agents/senna-event-triage";
import sennaM1TradingStackThreatModel from "./agents/senna-m1-trading-stack-threat-model";
import sennaSecuritySubstrateState from "./agents/senna-security-substrate-state";
import thandiweAuditCommitteePrep from "./agents/thandiwe-audit-committee-prep";
import thandiweEventTriage from "./agents/thandiwe-event-triage";
import thandiweGoalLoop from "./agents/thandiwe-goal-loop";
import tomasEventTriage from "./agents/tomas-event-triage";
import tomasPaymentsReadiness from "./agents/tomas-payments-readiness";
import veraCodebaseQualityReview from "./agents/vera-codebase-quality-review";
import veraEventTriage from "./agents/vera-event-triage";
import veraGoalLoop from "./agents/vera-goal-loop";
import veraOvernightRecon from "./agents/vera-overnight-recon";
import yaelEventTriage from "./agents/yael-event-triage";
import yaelTaxReadiness from "./agents/yael-tax-readiness";
import zaraEventTriage from "./agents/zara-event-triage";
import zaraGoalLoop from "./agents/zara-goal-loop";
import zaraMlroSupervision from "./agents/zara-mlro-supervision";
import type { AgentRunHandler } from "./types";

// Two-phase init to break the cycle between handler-callables.ts and
// scrooge-follow-on-router.ts (F-019):
//   1. Build the map without the follow-on-router entry.
//   2. Create the router with the map injected, then insert it.
// The map is mutable during init, Readonly<> after export.
const _map: Record<string, AgentRunHandler> = {
  "vera:overnight-recon": veraOvernightRecon,
  "vera:codebase-quality-review": veraCodebaseQualityReview,
  "vera:goal-loop": veraGoalLoop,
  "atlas:substrate-state": atlasSubstrateState,
  "atlas:goal-loop": atlasGoalLoop,
  "bea:goal-loop": beaGoalLoop,
  "helena:risk-appetite-watch": helenaRiskAppetiteWatch,
  // helena:goal-loop — no cron; shadow mode for first cohort ticks (on-request only).
  // Cohort-3 agent. Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  "helena:goal-loop": helenaGoalLoop,
  "devon:operational-resilience-snapshot": devonOperationalResilienceSnapshot,
  "camille:financial-position-snapshot": camilleFinancialPositionSnapshot,
  // anya:goal-loop — no cron; shadow mode for cohort-3 (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  "anya:goal-loop": anyaGoalLoop,
  "anya:projection-drift": anyaProjectionDrift,
  "anya:projection-refresh": anyaProjectionRefresh,
  "scrooge:inbox-hygiene": scroogeInboxHygiene,
  "scrooge:ceo-decision-record": scroogeCeoDecisionRecord,
  // "scrooge:follow-on-router" inserted below after createHandler()
  "scrooge:owner-inbox-archiver": scroogeOwnerInboxArchiver,
  "owen:governance-cycle-prep": owenGovernanceCyclePrep,
  "owen:goal-loop": owenGoalLoop,
  "rohan:risk-run": rohanRiskRun,
  // rohan:goal-loop — no cron; shadow mode for cohort-3 first ticks (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  "rohan:goal-loop": rohanGoalLoop,
  "mira:obligations-snapshot": miraObligationsSnapshot,
  "mira:citation-gate": miraCitationGate,
  // mira:goal-loop — no cron; shadow mode for first two cohort ticks (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  "mira:goal-loop": miraGoalLoop,
  "senna:security-substrate-state": sennaSecuritySubstrateState,
  "zara:mlro-supervision": zaraMlroSupervision,
  // zara:goal-loop — no cron; shadow mode for cohort-3 (on-request only). Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  "zara:goal-loop": zaraGoalLoop,
  "thandiwe:audit-committee-prep": thandiweAuditCommitteePrep,
  // thandiwe:goal-loop — no cron; shadow mode for cohort-3 (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  "thandiwe:goal-loop": thandiweGoalLoop,
  "rashida:cyber-resilience-snapshot": rashidaCyberResilienceSnapshot,
  "iris:popia-controls-snapshot": irisPopiaControlsSnapshot,
  "eitan:liquidity-snapshot": eitanLiquiditySnapshot,
  "saskia:markets-readiness-snapshot": saskiaMarketsReadinessSnapshot,
  "kai:m1-cdm-typescript-bindings": kaiM1CdmTypescriptBindings,
  "kai:pre-trade-gateway-aggregator": kaiPreTradeGatewayAggregator,
  "bea:accounting-readiness": beaAccountingReadiness,
  "yael:tax-readiness": yaelTaxReadiness,
  "tomas:payments-readiness": tomasPaymentsReadiness,
  "imani:legal-readiness": imaniLegalReadiness,
  "ravi:alm-readiness": raviAlmReadiness,
  "sade:agentops-readiness": sadeAgentopsReadiness,
  "pax:role-research-queue": paxRoleResearchQueue,
  "rohan:backtest-harness": rohanBacktestHarness,
  "anya:m1-projection-runtime-mapping": anyaM1ProjectionRuntimeMapping,
  "bea:m1-ifrs-classification-rules": beaM1IfrsClassificationRules,
  "mira:m1-regulator-citation-urns": miraM1RegulatorCitationUrns,
  "senna:m1-trading-stack-threat-model": sennaM1TradingStackThreatModel,
  // Slice 2b — per-persona event-triage stubs.
  "rashida:event-triage": rashidaEventTriage,
  "rohan:event-triage": rohanEventTriage,
  "kai:event-triage": kaiEventTriage,
  "nadia:event-triage": nadiaEventTriage,
  "nadia:validation-cycle": nadiaValidationCycle,
  "owen:event-triage": owenEventTriage,
  "ravi:event-triage": raviEventTriage,
  "sade:event-triage": sadeEventTriage,
  "saskia:event-triage": saskiaEventTriage,
  "thandiwe:event-triage": thandiweEventTriage,
  "bea:event-triage": beaEventTriage,
  "devon:event-triage": devonEventTriage,
  "eitan:event-triage": eitanEventTriage,
  "iris:event-triage": irisEventTriage,
  "mira:event-triage": miraEventTriage,
  "tomas:event-triage": tomasEventTriage,
  "zara:event-triage": zaraEventTriage,
  "camille:event-triage": camilleEventTriage,
  "imani:event-triage": imaniEventTriage,
  "niko:event-triage": nikoEventTriage,
  "niko:client-lifecycle": nikoClientLifecycle,
  "senna:event-triage": sennaEventTriage,
  "helena:event-triage": helenaEventTriage,
  "scrooge:event-triage": scroogeEventTriage,
  "yael:event-triage": yaelEventTriage,
  "linnea:event-triage": linneaEventTriage,
  "linnea:ops-cycle": linneaOpsCycle,
  "nolan:event-triage": nolanEventTriage,
  "nolan:hiring-cycle": nolanHiringCycle,
  "anya:event-triage": anyaEventTriage,
  "atlas:event-triage": atlasEventTriage,
  "pax:event-triage": paxEventTriage,
  "vera:event-triage": veraEventTriage,
};

// Phase 2: inject the map into the follow-on-router so it can look up
// callables without importing handler-callables.ts directly (F-019 fix).
_map["scrooge:follow-on-router"] = createScroogeFollowOnRouter(_map);

export const HANDLER_CALLABLES: Readonly<Record<string, AgentRunHandler>> = _map;
