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
import beaAccountingReadiness from "./agents/bea-accounting-readiness";
import beaM1IfrsClassificationRules from "./agents/bea-m1-ifrs-classification-rules";
import camilleFinancialPositionSnapshot from "./agents/camille-financial-position-snapshot";
import devonOperationalResilienceSnapshot from "./agents/devon-operational-resilience-snapshot";
import eitanLiquiditySnapshot from "./agents/eitan-liquidity-snapshot";
import helenaRiskAppetiteWatch from "./agents/helena-risk-appetite-watch";
import imaniLegalReadiness from "./agents/imani-legal-readiness";
import irisPopiaControlsSnapshot from "./agents/iris-popia-controls-snapshot";
import kaiM1CdmTypescriptBindings from "./agents/kai-m1-cdm-typescript-bindings";
import kaiPreTradeGatewayAggregator from "./agents/kai-pre-trade-gateway-aggregator";
import miraCitationGate from "./agents/mira-citation-gate";
import miraM1RegulatorCitationUrns from "./agents/mira-m1-regulator-citation-urns";
import miraObligationsSnapshot from "./agents/mira-obligations-snapshot";
import owenGovernanceCyclePrep from "./agents/owen-governance-cycle-prep";
import paxRoleResearchQueue from "./agents/pax-role-research-queue";
import rashidaCyberResilienceSnapshot from "./agents/rashida-cyber-resilience-snapshot";
import raviAlmReadiness from "./agents/ravi-alm-readiness";
import rohanBacktestHarness from "./agents/rohan-backtest-harness";
import rohanRiskRun from "./agents/rohan-risk-run";
import sadeAgentopsReadiness from "./agents/sade-agentops-readiness";
import saskiaMarketsReadinessSnapshot from "./agents/saskia-markets-readiness-snapshot";
import scroogeCeoDecisionRecord from "./agents/scrooge-ceo-decision-record";
import scroogeFollowOnRouter from "./agents/scrooge-follow-on-router";
import scroogeInboxHygiene from "./agents/scrooge-inbox-hygiene";
import sennaM1TradingStackThreatModel from "./agents/senna-m1-trading-stack-threat-model";
import sennaSecuritySubstrateState from "./agents/senna-security-substrate-state";
import thandiweAuditCommitteePrep from "./agents/thandiwe-audit-committee-prep";
import tomasPaymentsReadiness from "./agents/tomas-payments-readiness";
import veraOvernightRecon from "./agents/vera-overnight-recon";
import yaelTaxReadiness from "./agents/yael-tax-readiness";
import zaraMlroSupervision from "./agents/zara-mlro-supervision";
import type { AgentRunHandler } from "./types";

export const HANDLER_CALLABLES: Readonly<Record<string, AgentRunHandler>> = {
  "vera:overnight-recon": veraOvernightRecon,
  "atlas:substrate-state": atlasSubstrateState,
  "helena:risk-appetite-watch": helenaRiskAppetiteWatch,
  "devon:operational-resilience-snapshot": devonOperationalResilienceSnapshot,
  "camille:financial-position-snapshot": camilleFinancialPositionSnapshot,
  "anya:projection-drift": anyaProjectionDrift,
  "anya:projection-refresh": anyaProjectionRefresh,
  "scrooge:inbox-hygiene": scroogeInboxHygiene,
  "scrooge:ceo-decision-record": scroogeCeoDecisionRecord,
  "scrooge:follow-on-router": scroogeFollowOnRouter,
  "owen:governance-cycle-prep": owenGovernanceCyclePrep,
  "rohan:risk-run": rohanRiskRun,
  "mira:obligations-snapshot": miraObligationsSnapshot,
  "mira:citation-gate": miraCitationGate,
  "senna:security-substrate-state": sennaSecuritySubstrateState,
  "zara:mlro-supervision": zaraMlroSupervision,
  "thandiwe:audit-committee-prep": thandiweAuditCommitteePrep,
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
  "bea:m1-ifrs-classification-rules": beaM1IfrsClassificationRules,
  "mira:m1-regulator-citation-urns": miraM1RegulatorCitationUrns,
  "senna:m1-trading-stack-threat-model": sennaM1TradingStackThreatModel,
};
