// runtime/handlers-metadata.ts
//
// A1 — canonical handler-metadata registry.
//
// The single authoring location for the (agent, trigger) pairs the
// runtime knows about, with their kind / cadence / subscription /
// cron metadata. Closes the drift Marc surfaced when asking why fleet
// health was out of date — there were three diverging copies of this
// list:
//
//   - `HANDLERS` map in `runtime/run.ts` (with handler callables)
//   - `RUNTIME_HANDLERS` const in `dashboard/derive.ts` (metadata only)
//   - `knownRuntimeHandlers()` in `runtime/agents/atlas-substrate-state.ts`
//     (metadata only)
//
// They drifted silently when new handlers landed (mira:citation-gate,
// anya:projection-refresh) — the dashboard kept claiming agents were
// stale that were on a different cadence than its hardcoded map said.
//
// After A1: this file is canonical. `runtime/handler-callables.ts`
// owns the map from (agent, trigger) → handler callable; the metadata
// array here is what every other consumer reads. The handler-callable
// map lives separately to keep this module free of runtime side-effects
// (the dashboard imports it; the dashboard must NOT pull in
// composition.ts or the EventStore).
//
// CRON CONSOLIDATION (post-PR #193):
//   Adding a new scheduled handler used to require touching FOUR
//   authoring locations: this file, `handler-callables.ts`,
//   `SCHEDULER_CRON_MAP` in `platform/scheduler/scheduler.ts`, and
//   `.github/workflows/agent-runtime-<agent>-<trigger>.yml`. The
//   `cronExpression` field below collapses (this file ↔ scheduler.ts)
//   into a single source of truth — `SCHEDULER_CRON_MAP` is now a
//   derived projection (`derivedCronMap()`). The workflow YAML
//   remains an independent surface for now; `recon:cron-map-drift`
//   asserts they agree, and a future slice will template-generate
//   the YAMLs from this metadata too.
//
// Adding a new handler:
//   - Add a metadata row here. For `kind: "scheduled"`, supply a
//     `cronExpression` (and `cadenceHours`). For `event-driven`,
//     supply `subscribesTo`. For `on-request`, no extras needed.
//   - Add the callable in `handler-callables.ts` under the same key.
//   - For scheduled handlers, also add the workflow YAML at
//     `.github/workflows/agent-runtime-<agent>-<trigger>.yml` with
//     a `schedule.cron` matching `cronExpression`.
//   - Vera's `recon:runtime-handler-sync` and `recon:cron-map-drift`
//     assert these stay in sync.
//
// Author: Atlas

import type { TriggerKind } from "./types";

export interface HandlerMetadata {
  /** Persona name as it appears in /Team/<Name>.md */
  readonly agent: string;
  /** Trigger id — second half of the `agent:trigger` key. */
  readonly trigger: string;
  /** Trigger classification. */
  readonly kind: TriggerKind;
  /**
   * Expected cadence in hours for `scheduled` handlers. Undefined for
   * `event-driven` (fires when subscribed event lands) and `on-request`
   * (fires when something asks). Used by the fleet-health page to set
   * staleness thresholds.
   */
  readonly cadenceHours?: number;
  /**
   * For `event-driven` handlers: the event types this handler
   * subscribes to. The runtime fans out to the handler when a parent
   * run appends an event whose type intersects this set.
   */
  readonly subscribesTo?: readonly string[];
  /**
   * For `scheduled` handlers: the 5-field cron expression the
   * in-process scheduler and the GH Actions workflow both fire on.
   * MUST be present for `kind: "scheduled"` rows; `recon:cron-map-drift`
   * asserts this. Undefined for `event-driven` and `on-request`.
   *
   * The mirrored authoritative source for GH Actions is the
   * corresponding `.github/workflows/agent-runtime-<agent>-<trigger>.yml`
   * file's `schedule.cron`. Both must match — the recon asserts.
   */
  readonly cronExpression?: string;
  /** Composite key — `<lowercased-agent>:<trigger>`. Computed for convenience. */
  readonly key: string;
}

function entry(
  agent: string,
  trigger: string,
  kind: TriggerKind,
  extras: {
    cadenceHours?: number;
    subscribesTo?: readonly string[];
    cronExpression?: string;
  } = {},
): HandlerMetadata {
  return {
    agent,
    trigger,
    kind,
    ...(extras.cadenceHours !== undefined ? { cadenceHours: extras.cadenceHours } : {}),
    ...(extras.subscribesTo !== undefined ? { subscribesTo: extras.subscribesTo } : {}),
    ...(extras.cronExpression !== undefined ? { cronExpression: extras.cronExpression } : {}),
    key: `${agent.toLowerCase()}:${trigger}`,
  };
}

/**
 * Canonical handler metadata. Order matches the fleet-health card
 * order (engineering-first, then on-request) but is not load-bearing —
 * consumers sort their own views.
 */
export const HANDLERS_METADATA: readonly HandlerMetadata[] = [
  entry("Vera", "overnight-recon", "scheduled", {
    cadenceHours: 24,
    cronExpression: "13 2 * * *",
  }),
  // Vera's weekly codebase quality review — distinct from overnight-recon.
  // Runs the deterministic-checkable subset of code-quality heuristics
  // (any-density, swallowed-errors, legacy-bypass-watch). LLM-judgment
  // findings (severity classification, principle-violation interpretation)
  // remain Scrooge-coordinated until handler-LLM-runtime lands.
  // Authority: D-AGENT-RUNTIME-AUTHORIZE (S8 / fleet-rollout slice).
  entry("Vera", "codebase-quality-review", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "23 3 * * SAT",
  }),
  entry("Atlas", "substrate-state", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "19 6 * * 1",
  }),
  // atlas:goal-loop — hourly tick; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Tracks slow-moving substrate state; handler runs in dryRun=true (shadow) until
  // 2 successful ticks have been observed per spec §4.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3, D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  entry("Atlas", "goal-loop", "scheduled", {
    cadenceHours: 1,
    cronExpression: "0 * * * *",
  }),
  // bea:goal-loop — daily 06:00 UTC; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Tracks regulatory filing schedule and accounting readiness.
  // Handler runs in dryRun=true (shadow) for first 2 ticks per spec §4.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3, D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  entry("Bea", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 6 * * *",
  }),
  // vera:goal-loop — event-driven only; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Fires on AuditFinding / ReconResult events; no cron trigger.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3, D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  entry("Vera", "goal-loop", "event-driven", {
    subscribesTo: ["AuditFinding", "ReconResult"],
  }),
  // owen:goal-loop — daily 07:00 UTC; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Tracks governance cycle, decisions, and briefs.
  // Handler runs in dryRun=true (shadow) for first 2 ticks per spec §4.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3, D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  entry("Owen", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 7 * * *",
  }),
  entry("Helena", "risk-appetite-watch", "scheduled", {
    cadenceHours: 24,
    cronExpression: "30 4 * * *",
  }),
  // helena:goal-loop — no cron; shadow mode for first cohort ticks (on-request only).
  // Cohort-3 agent. Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Helena", "goal-loop", "on-request"),
  entry("Devon", "operational-resilience-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "23 5 * * MON",
  }),
  entry("Camille", "financial-position-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "41 6 * * MON",
  }),
  // anya:goal-loop — no cron; shadow mode for cohort-3 (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Anya", "goal-loop", "on-request"),
  entry("Anya", "projection-drift", "scheduled", {
    cadenceHours: 24,
    cronExpression: "17 3 * * *",
  }),
  entry("Anya", "projection-refresh", "event-driven", {
    subscribesTo: [
      "SubstrateStateSnapshot",
      "WorkstreamRegistered",
      "WorkstreamCompleted",
      "CeoDecision",
    ],
  }),
  entry("Scrooge", "inbox-hygiene", "scheduled", {
    cadenceHours: 24,
    cronExpression: "27 4 * * *",
  }),
  entry("Scrooge", "ceo-decision-record", "on-request"),
  entry("Scrooge", "follow-on-router", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
  entry("Owen", "governance-cycle-prep", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "31 7 * * 2",
  }),
  entry("Rohan", "risk-run", "scheduled", {
    cadenceHours: 24,
    cronExpression: "43 3 * * *",
  }),
  // rohan:goal-loop — no cron; shadow mode for cohort-3 first ticks (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Rohan", "goal-loop", "on-request"),
  entry("Mira", "obligations-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "29 7 * * 3",
  }),
  entry("Mira", "citation-gate", "on-request"),
  // mira:goal-loop — event-driven only; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Fires on regulatory obligation events; no cron trigger.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3, D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  entry("Mira", "goal-loop", "event-driven", {
    subscribesTo: [
      "RegulatoryInstrumentUpdate",
      "ObligationRegistered",
      "SanctionsListPublished",
      "PepListPublished",
    ],
  }),
  entry("Senna", "security-substrate-state", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "37 7 * * 4",
  }),
  entry("Zara", "mlro-supervision", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "30 5 * * MON",
  }),
  entry("Thandiwe", "audit-committee-prep", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "47 7 * * 2",
  }),
  // thandiwe:goal-loop — no cron; shadow mode for cohort-3 (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Thandiwe", "goal-loop", "on-request"),
  // cohort-3 goal-loops (batch 2) — no cron; shadow mode (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Zara", "goal-loop", "on-request"),
  entry("Eitan", "goal-loop", "on-request"),
  entry("Camille", "goal-loop", "on-request"),
  entry("Iris", "goal-loop", "on-request"),
  entry("Rashida", "goal-loop", "on-request"),
  entry("Senna", "goal-loop", "on-request"),
  entry("Kai", "goal-loop", "on-request"),
  entry("Tomas", "goal-loop", "on-request"),
  entry("Ravi", "goal-loop", "on-request"),
  entry("Imani", "goal-loop", "on-request"),
  entry("Devon", "goal-loop", "on-request"),
  entry("Saskia", "goal-loop", "on-request"),
  entry("Rashida", "cyber-resilience-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "49 7 * * 4",
  }),
  entry("Iris", "popia-controls-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "51 7 * * 3",
  }),
  entry("Eitan", "liquidity-snapshot", "scheduled", {
    cadenceHours: 24,
    cronExpression: "53 6 * * *",
  }),
  entry("Saskia", "markets-readiness-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "33 5 * * MON",
  }),
  entry("Kai", "m1-cdm-typescript-bindings", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "27 6 * * MON",
  }),
  entry("Kai", "pre-trade-gateway-aggregator", "event-driven", {
    subscribesTo: ["OrderProposed"],
  }),
  entry("Bea", "accounting-readiness", "scheduled", {
    cadenceHours: 24,
    cronExpression: "47 5 * * *",
  }),
  entry("Yael", "tax-readiness", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "7 6 * * THU",
  }),
  entry("Tomas", "payments-readiness", "scheduled", {
    cadenceHours: 24,
    cronExpression: "21 4 * * *",
  }),
  entry("Imani", "legal-readiness", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "9 7 * * 5",
  }),
  entry("Ravi", "alm-readiness", "scheduled", {
    cadenceHours: 24,
    cronExpression: "37 5 * * *",
  }),
  entry("Sade", "agentops-readiness", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "41 7 * * 5",
  }),
  // Sade — AgentOps & Token Efficiency Engineer.
  // Daily full-fleet token analysis; subscribes to TokenUsageRecorded for
  // ingestion and anomaly detection.
  // Authority: Sade mandate (AgentOps & Token Efficiency Engineer).
  entry("Sade", "token-usage-analysis", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 5 * * *",
  }),
  // Sade — efficiency advisory emission; fires on every AgentRun completion
  // to check whether the run has crossed the efficiency degradation threshold.
  entry("Sade", "efficiency-advisory", "event-driven", {
    subscribesTo: ["AgentRunCompleted", "TokenUsageRecorded"],
  }),
  // Sade — daily fleet prompt/mandate optimisation cycle; applies queued
  // bounded optimisations (no structural role changes).
  entry("Sade", "fleet-optimisation", "scheduled", {
    cadenceHours: 24,
    cronExpression: "30 5 * * *",
  }),
  entry("PAX", "role-research-queue", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "11 8 * * 5",
  }),
  // S7-Targeted #4 — Rohan's backtest harness (v0). Event-driven on
  // `BacktestRequested`; emits `BacktestRun`. Tier-1 IFRS 9 ECL only.
  // Added at the end of the array to minimise file-clash with Saskia+Kai's
  // parallel gateway slice (six handler-metadata entries land alongside).
  entry("Rohan", "backtest-harness", "event-driven", {
    subscribesTo: ["BacktestRequested"],
  }),
  // M1 — Anya's projection-runtime-mapping handler.
  entry("Anya", "m1-projection-runtime-mapping", "event-driven", {
    subscribesTo: ["CeoDecision", "CdmBindingsRegenerated"],
  }),
  // B-1 — Bea FX posting engine. Subscribes to FX lifecycle events and
  // emits SubLedgerPostingEmitted for each posting rule:
  //   PR-FX-001 (FxTradeExecuted → trade-booking)
  //   PR-FX-002 (FxPositionRevalued → revaluation)
  //   PR-FX-003 (FxSettlementConfirmed → settlement)
  // Authority: D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12).
  entry("Bea", "fx-posting-engine", "event-driven", {
    subscribesTo: ["FxTradeExecuted", "FxPositionRevalued", "FxSettlementConfirmed"],
  }),
  // M1 — Bea IFRS-9 classification rules.
  entry("Bea", "m1-ifrs-classification-rules", "event-driven", {
    subscribesTo: [
      "CeoDecision",
      "CdmBindingsRegenerated",
      "EquityTradeBooked",
      "EquitySettlementInstructed",
      "EquityCorporateActionApplied",
    ],
  }),
  // M1 — Mira's regulator-citation-URN handler.
  entry("Mira", "m1-regulator-citation-urns", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
  // PROC-FC-01 — Mira's KYC onboarding gateway.
  // Processes ClientCandidateRegistered through PROC-FC-01 steps 1–9:
  // sanctions screening, PEP screening, UBO resolution, RBA risk rating,
  // and terminal accept/reject/EDD-initiation.
  // Authority: PROC-FC-01 (Approved), KYC/CDD/EDD Policy (BRC-approved).
  entry("Mira", "kyc-onboarding-gateway", "event-driven", {
    subscribesTo: ["ClientCandidateRegistered"],
  }),
  // M1 — Senna's trading-stack threat-model handler.
  entry("Senna", "m1-trading-stack-threat-model", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
  // D-OWNER-INBOX-AUTO-ARCHIVE — Scrooge's auto-archiver moves the source
  // decision-required card from `Owner Inbox/` to `Owner Inbox/actioned/`
  // and emits a typed `RecordFiled` event whenever a CeoDecision fires.
  // Closes the half-automated CEO-decision-card lifecycle (Atlas + Owen,
  // 2026-05-10).
  entry("Scrooge", "owner-inbox-archiver", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),

  // -------------------------------------------------------------------------
  // Slice 2b — per-persona event-triage stubs.
  //
  // Each entry below closes ≥1 `specWithoutHandler` violation surfaced by
  // `recon:trigger-spec-handler-symmetry` (Slice 2a, PR #212). The handler
  // files are minimal stubs (log + acknowledge); full implementations are
  // roadmap items per D-AGENT-AUTONOMY-OPERATIONAL.
  // -------------------------------------------------------------------------

  // Rashida — CISO; security-domain events (9 event types → 1 handler).
  entry("Rashida", "event-triage", "event-driven", {
    subscribesTo: [
      "SecurityIncidentRaised",
      "ThreatModelExceptionRequested",
      "ThreatModelGateDecision",
      "KeyCeremonyScheduled",
      "SBOMAcceptanceRequired",
      "VendorSecurityReview",
      "RegulatorCyberInquiry",
      "PersonalInformationCompromiseSuspected",
      "AgentEscalation",
    ],
  }),

  // Rohan — Risk engineer; risk/market events.
  entry("Rohan", "event-triage", "event-driven", {
    subscribesTo: [
      "TradeBooked",
      "PositionAdjusted",
      "CollateralUpdated",
      "LimitBreachProposed",
      "LimitBreachActioned",
      "ModelDriftDetected",
      "PolicyChange",
      "PortfolioReclassification",
    ],
  }),

  // Kai — Trading systems engineer; order/market-data events.
  entry("Kai", "event-triage", "event-driven", {
    subscribesTo: [
      "OrderSubmitted",
      "OrderFilled",
      "PreTradeGatewayBlock",
      "OrderRoutingAnomaly",
      "SurveillanceFeedGap",
      "MarketDataOutage",
      "ExchangeRuleChange",
    ],
  }),

  // Nadia — Model validation engineer; model-lifecycle events.
  entry("Nadia", "event-triage", "event-driven", {
    subscribesTo: [
      "ModelRegistered",
      "ProductionUseRequested",
      "MethodologyChangeRequested",
      "BacktestTriggered",
      "ModelDriftDetected",
      "ValidationFindingRaised",
      "RiskPolicyChange",
    ],
  }),
  // Nadia — scheduled validation-cycle (closes `scheduled-coverage` violation).
  entry("Nadia", "validation-cycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "17 7 * * THU",
  }),

  // Owen — Company Secretary; corporate-governance events.
  entry("Owen", "event-triage", "event-driven", {
    subscribesTo: [
      "ResolutionRequired",
      "ConflictDeclared",
      "RelatedPartyTransactionProposed",
      "WhistleblowingDisclosure",
      "PAIARequest",
      "MOIChangeProposed",
      "SupervisoryLetterReceived",
      "AgentEscalation",
    ],
  }),

  // Ravi — Treasury/ALM engineer; balance-sheet/treasury events.
  entry("Ravi", "event-triage", "event-driven", {
    subscribesTo: [
      "TradePosted",
      "FundingDrawn",
      "DepositReceived",
      "SAMOSFundingShortfall",
      "HQLACompositionDrift",
      "IRRBBExcursion",
      "FXPositionBreach",
      "HedgeIneffective",
    ],
  }),

  // Sade — AgentOps/HR engineer; agent-lifecycle and HR events.
  entry("Sade", "event-triage", "event-driven", {
    subscribesTo: [
      "AgentRegistered",
      "AgentRetired",
      "AgentCapabilityChanged",
      "PersonaSpecChanged",
      "HireConfirmed",
      "Termination",
      "LeaveGranted",
      "DisciplinaryActionRequested",
    ],
  }),

  // Saskia — Head of Global Markets; markets/franchise events.
  entry("Saskia", "event-triage", "event-driven", {
    subscribesTo: [
      "DealerMandateBreach",
      "SurveillanceAlert",
      "CurveSourceAnomaly",
      "CounterpartyEvent",
      "RASCalibrationChange",
      "LicenceGranted",
      "CEODecision",
      "AgentEscalation",
    ],
  }),

  // Thandiwe — CAE; audit/oversight events.
  entry("Thandiwe", "event-triage", "event-driven", {
    subscribesTo: [
      "AuditFinding",
      "AuditIssueOpened",
      "AuditIssueClosed",
      "AgentEscalation",
      "WhistleblowingDisclosure",
      "ExternalAuditorInquiry",
      "AppetiteBreach",
    ],
  }),

  // Bea — Accountant/IFRS engineer; accounting/financial events.
  entry("Bea", "event-triage", "event-driven", {
    subscribesTo: [
      "TradePosted",
      "FundingDrawn",
      "PaymentSettled",
      "AccrualBooked",
      "IFRS9ECLPublished",
      "TaxClassificationPublished",
      "RestatementProposed",
    ],
  }),

  // Devon — Operational Resilience engineer; resilience/incident events.
  entry("Devon", "event-triage", "event-driven", {
    subscribesTo: [
      "IncidentRaised",
      "SLOBudgetBurn",
      "CapacityBreach",
      "ChangeApprovalRequested",
      "AgentEscalation",
      "ResilienceTestResult",
      "AuditFinding",
    ],
  }),

  // Eitan — Liquidity/Capital engineer; liquidity/capital events.
  entry("Eitan", "event-triage", "event-driven", {
    subscribesTo: [
      "IRRBBExcursion",
      "FXPositionBreach",
      "LCRRatioProjection",
      "NSFRRatioProjection",
      "CapitalActionTrigger",
      "AgentEscalation",
      "PolicyChange",
    ],
  }),

  // Iris — POPIA/Privacy engineer; data-protection events.
  entry("Iris", "event-triage", "event-driven", {
    subscribesTo: [
      "PersonalInformationCompromiseSuspected",
      "DSARReceived",
      "NewProcessingPurposeProposed",
      "ConsentWithdrawn",
      "CrossBorderTransferRequested",
      "InformationRegulatorInquiry",
      "AgentEscalation",
    ],
  }),

  // Mira — Compliance/AML/FICA engineer; compliance/AML events.
  entry("Mira", "event-triage", "event-driven", {
    subscribesTo: [
      "ClientCandidateRegistered",
      "TransactionPosted",
      "SanctionsListPublished",
      "PepListPublished",
      "AdverseMediaPublished",
      "RegulatoryInstrumentUpdate",
      "AlertOpened",
    ],
  }),

  // Tomas — Payments engineer; payment/settlement events.
  entry("Tomas", "event-triage", "event-driven", {
    subscribesTo: [
      "SettlementInstructionReceived",
      "PaymentInitiated",
      "ReconciliationBreak",
      "CutOffBreach",
      "SchemeRuleChange",
      "CSPAttestationDue",
      "SanctionsHoldRaised",
    ],
  }),

  // Zara — MLRO/FIC Compliance Officer; AML/FICA events.
  entry("Zara", "event-triage", "event-driven", {
    subscribesTo: [
      "STRCandidate",
      "SanctionsHit",
      "PEPMatchExceedsThreshold",
      "FAISConductBreachSuspected",
      "RegulatorInquiry",
      "PolicyChange",
      "AgentEscalation",
    ],
  }),

  // Camille — CFO/Financial Controller; financial/audit events.
  entry("Camille", "event-triage", "event-driven", {
    subscribesTo: [
      "RestatementProposed",
      "CapitalEvent",
      "MaterialIFRSClassificationChange",
      "AgentEscalation",
      "AuditFinding",
      "RegulatorRequest",
    ],
  }),

  // Imani — Legal/ISDA/contract engineer; legal/contract events.
  entry("Imani", "event-triage", "event-driven", {
    subscribesTo: [
      "ContractDraftRequested",
      "ClauseChangeProposed",
      "SignatureRequested",
      "ECTAExceptionFlagged",
      "LegalEntityChange",
      "ObligationRegistered",
    ],
  }),

  // Niko — Client lifecycle engineer (paused until licence-day); client events.
  entry("Niko", "event-triage", "event-driven", {
    subscribesTo: [
      "LeadCaptured",
      "SuitabilityAssessmentRequired",
      "AdviceRecordRequested",
      "OnboardingHandoffPending",
      "ConsentWithdrawn",
    ],
  }),
  // Niko — scheduled client-lifecycle cycle (closes `scheduled-coverage`).
  entry("Niko", "client-lifecycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "23 8 * * MON",
  }),

  // Senna — DevSecOps/security substrate engineer; DevSecOps events.
  entry("Senna", "event-triage", "event-driven", {
    subscribesTo: [
      "MergeRequested",
      "SecurityIncidentRaised",
      "KeyRotationDue",
      "DependencyVulnDetected",
      "SuspiciousAuthEvent",
      "SBOMRequired",
    ],
  }),

  // Helena — CRO; risk-governance events.
  entry("Helena", "event-triage", "event-driven", {
    subscribesTo: [
      "AppetiteBreach",
      "ModelRiskDecisionRequired",
      "SupervisoryLetterReceived",
      "IcaapIlaapInputReady",
      "RiskPolicyChangeProposal",
    ],
  }),

  // Scrooge — Chief of Staff; orchestration-relevant events.
  entry("Scrooge", "event-triage", "event-driven", {
    subscribesTo: [
      "AgentEscalation",
      "WorkstreamCompleted",
      "WorkstreamRegistered",
      "HireConfirmed",
      "MandateGapDetected",
    ],
  }),

  // Yael — Tax engineer; tax events.
  entry("Yael", "event-triage", "event-driven", {
    subscribesTo: [
      "SARSGuidanceUpdate",
      "IFRS9ECLChange",
      "InterEntityTransactionProposed",
      "ClientCandidateRegistered",
      "ClientReviewTriggered",
    ],
  }),

  // Linnea — COO/Operations engineer; operations-relevant events.
  entry("Linnea", "event-triage", "event-driven", {
    subscribesTo: ["CeoDecision", "WorkstreamRegistered", "AgentEscalation"],
  }),
  // Linnea — scheduled ops-cycle (closes `scheduled-coverage`).
  entry("Linnea", "ops-cycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "29 8 * * TUE",
  }),

  // Nolan — HR/Hiring engineer; hiring/mandate events.
  entry("Nolan", "event-triage", "event-driven", {
    subscribesTo: ["RoleBriefDelivered", "MandateGapDetected", "WorkstreamRegistered"],
  }),
  // Nolan — scheduled hiring-cycle (closes `scheduled-coverage`).
  entry("Nolan", "hiring-cycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "53 8 * * FRI",
  }),

  // Anya — projection/schema engineer; additional schema/obligation events.
  entry("Anya", "event-triage", "event-driven", {
    subscribesTo: ["EventSchemaPublished", "ObligationRegistered", "PolicyChange"],
  }),

  // Atlas — Core banking platform architect; platform-architecture events.
  entry("Atlas", "event-triage", "event-driven", {
    subscribesTo: ["EventSchemaProposal", "IdentityPermissionChangeProposal", "SubstrateAlert"],
  }),

  // PAX — Research assistant; role-research and mandate-gap events.
  entry("PAX", "event-triage", "event-driven", {
    subscribesTo: ["RoleResearchRequested", "MandateGapDetected", "AgentEscalation"],
  }),

  // Vera — Internal audit engineer; CEO-decision audit trail events.
  entry("Vera", "event-triage", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
];

/** Map from `<lowercased-agent>:<trigger>` to metadata. */
export const HANDLERS_METADATA_BY_KEY: ReadonlyMap<string, HandlerMetadata> = new Map(
  HANDLERS_METADATA.map((h) => [h.key, h]),
);

/** Look up metadata by composite key. */
export function lookupHandler(key: string): HandlerMetadata | undefined {
  return HANDLERS_METADATA_BY_KEY.get(key);
}

/** All registered keys, useful for error messages. */
export function handlerKeys(): readonly string[] {
  return HANDLERS_METADATA.map((h) => h.key);
}

/**
 * Derived projection of `(scheduled handlers) → cron expression`.
 *
 * This is the post-consolidation canonical source for cron expressions.
 * The historic `SCHEDULER_CRON_MAP` literal in
 * `platform/scheduler/scheduler.ts` is now derived from this function;
 * the runtime / scheduler / GH Actions surfaces all reconcile back here.
 *
 * Filters to `kind: "scheduled"` rows that have a `cronExpression` set.
 * A scheduled row WITHOUT a cronExpression is a substrate finding —
 * `recon:cron-map-drift` asserts every scheduled row has one.
 */
export function derivedCronMap(): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const h of HANDLERS_METADATA) {
    if (h.kind === "scheduled" && h.cronExpression !== undefined) {
      out[h.key] = h.cronExpression;
    }
  }
  return out;
}

/**
 * `kind: "scheduled"` handlers that are missing a `cronExpression`.
 * Empty when the registry is well-formed; populated when a scheduled
 * row was added without supplying the cron — `recon:cron-map-drift`
 * surfaces these as findings.
 */
export function scheduledHandlersMissingCron(): readonly HandlerMetadata[] {
  return HANDLERS_METADATA.filter((h) => h.kind === "scheduled" && h.cronExpression === undefined);
}
