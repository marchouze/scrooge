// platform/event-store/event-types.ts
//
// SHIM — F-020 split (Atlas, 2026-05-11).
//
// The event-type schemas have been split into per-domain modules under
// `./event-types/`:
//
//   agent.ts          — AgentEscalation family, AgentDecision,
//                       AgentRegistered, SubstrateAgentRun*, RMS agent-runs,
//                       AgentGoalEvaluated, AgentGoalSelected, AgentGoalDeferred
//   platform.ts       — WorkstreamRegistered, DecisionComment,
//                       ScheduledTrigger, SubstrateAlert, IdentityKeyRotated,
//                       PermissionPolicyPublished, BusDispatched,
//                       LegacyFanoutShadowed
//   risk.ts           — RiskRaised, RasLineCalibrated
//   model-risk.ts     — ModelSubmitted, ModelTierClassified,
//                       ModelValidation*, ValidationFinding*, Backtest*,
//                       ModelDriftDetected, ProductionUseRequested,
//                       MethodologyChangeRequested,
//                       ValidationMethodologyPublished
//   trading.ts        — OrderProposed, GatewayCheck*, OrderApproved/Rejected,
//                       PreTradeLimitChanged, CounterpartyEligibility*,
//                       SwitchTest*
//   legal-entity.ts   — LegalEntityRegistered/Changed,
//                       IntraGroupArrangementSigned
//   product.ts        — 12 product-lifecycle events
//   rms.ts            — DecisionRequested, Feedback, BriefSuperseded,
//                       RecordFiled, CeoDecisionRmsExtended
//   accounting.ts     — BankAccount*, AccountingPeriod*, TrialBalanceSnapshotted
//
// This file re-exports everything from the barrel so existing imports of
// `../event-store/event-types` continue to resolve without change. New code
// should import from the per-domain module or from
// `../event-store/event-types/index` directly.

export * from "./event-types/index";
