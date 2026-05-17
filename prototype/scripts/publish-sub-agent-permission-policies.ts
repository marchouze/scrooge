// scripts/publish-sub-agent-permission-policies.ts
//
// T-12 — One-shot script that publishes PermissionPolicyPublished events for
// every sub-agent task actor and every platform infrastructure actor currently
// in ACCEPTED_NO_POLICY_ACTORS (platform/recon/permission-gate-default.ts).
//
// After running this script, ACCEPTED_NO_POLICY_ACTORS can be emptied and the
// recon:permission-gate-default recon will report zero info-severity carve-out
// hits.
//
// Design: Option A (registry-time derivation per Senna's T-12 spec §3).
//   - Sub-agent policies derive from parent persona §11 events emitted
//     (containment invariant: permitted(sub-agent) ⊆ permitted(parent)).
//   - Platform actor policies are hand-authored per §2.3 of the spec.
//   - Uses LocalPermissionPolicyPublisher.publish() — same mechanism as
//     `identity:issue` for persona-level agents; idempotent on policyHash.
//
// Invocation: `bun run publish:sub-agent-policies` or directly:
//   cd prototype && bun run scripts/publish-sub-agent-permission-policies.ts
//
// Exit status:
//   0 — all policies published (or unchanged).
//   1 — one or more failures (logged).
//
// Authority:
//   - T-12 threat mitigation (Owner Inbox/2026-05-17_senna_t12-sub-agent-permission-policy-design-spec.md)
//   - D-T01-PERMISSION-GATE-SECURE-DEFAULT; P4-SECURITY-DESIGNED-IN; ORG-CY-09
//
// Author: Atlas (Core banking platform architect, engineering)
// Date: 2026-05-17

import { createHash } from "node:crypto";

import { LocalPermissionPolicyPublisher } from "../platform/agent-identity/permission-policy";
import type { AgentSpec } from "../platform/agent-runtime/spec-parser";
import { eventStore, logger } from "../platform/composition";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic specHash for a synthetic sub-agent spec.
 * Stable across runs as long as the agentUrn and eventsEmitted don't change.
 */
function syntheticSpecHash(agentUrn: string, eventsEmitted: readonly string[]): string {
  const canonical = JSON.stringify({ agentUrn, eventsEmitted: [...eventsEmitted].sort() });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Build a minimal AgentSpec for a sub-agent or platform actor. The fields that
 * the PermissionPolicyPublisher.publish() method uses are:
 *   - agentUrn
 *   - eventsEmitted   → eventEmitAllowList
 *   - systemCapabilities → capabilityAllowList
 *   - triggerSubscriptions → eventSubscribeAllowList
 *   - specHash        → derivedFromSpecHash
 *
 * All other fields are stub-filled; they are not used in policy derivation.
 */
function makeSubAgentSpec(
  agentUrn: string,
  eventsEmitted: readonly string[],
  systemCapabilities: readonly string[] = [],
  triggerSubscriptions: readonly string[] = [],
): AgentSpec {
  const specHash = syntheticSpecHash(agentUrn, eventsEmitted);
  const personaName = agentUrn.replace(/^agent:/, "").replace(/:/g, "-");
  return {
    agentUrn,
    personaName,
    role: `Sub-agent task actor (${agentUrn})`,
    reportsTo: "atlas",
    cadenceMode: "task",
    triggerCount: 0,
    triggerSubscriptions,
    decisionsInScopeCount: 0,
    decisionsInScope: [],
    decisionsEscalateCount: 0,
    escalationClasses: [],
    systemCapabilities,
    eventsEmitted,
    proceduresOwned: [],
    procedureSteps: [],
    specVersion: "v1.0",
    specHash,
    sourcePath: `/synthetic/sub-agents/${agentUrn}`,
  };
}

// ---------------------------------------------------------------------------
// Category A — Substrate-internal actors
// ---------------------------------------------------------------------------
// These actors are platform primitives; their policies are hand-authored per
// §2.3 of Senna's spec. They are not derived from persona specs.

const CATEGORY_A: AgentSpec[] = [
  // Historical handler invocations before per-agent identity issuance landed.
  // Carve-out: only legacy pre-A1 event types. We allow SubstrateAlert as the
  // broadest allowed safety-valve; all legacy events covered via the LEGACY gate.
  makeSubAgentSpec("agent:substrate-runner", ["SubstrateAlert"]),

  // The permission gate itself emits SubstrateAlerts when a legacy bypass fires.
  makeSubAgentSpec("agent:atlas:permission-gate", ["SubstrateAlert"]),
];

// ---------------------------------------------------------------------------
// Category B — Platform infrastructure actors
// ---------------------------------------------------------------------------
// Internal substrate components; hand-authored per §2.3.

const CATEGORY_B: AgentSpec[] = [
  // AgentRunner lifecycle wrapper (S8 Tier 1)
  makeSubAgentSpec("agent:atlas:substrate-runner", [
    "AgentRunStarted",
    "AgentRunCompleted",
    "AgentRunFailed",
    "SubstrateAlert",
  ]),

  // EventTriggerBus — platform/event-trigger-bus/bus.ts
  makeSubAgentSpec("agent:atlas:event-trigger-bus", ["BusDispatched", "SubstrateAlert"]),

  // AgentRegistry — platform/agent-runtime/registry.ts
  makeSubAgentSpec("agent:atlas:registry", [
    "AgentRegistered",
    "AgentRetired",
    "SubstrateAlert",
  ]),

  // PermissionPolicyPublisher — platform/agent-identity/permission-policy.ts
  makeSubAgentSpec("agent:atlas:permission-policy", [
    "PermissionPolicyPublished",
    "SubstrateAlert",
  ]),

  // AgentIdentityIssuer — platform/agent-identity/issuer.ts
  makeSubAgentSpec("agent:atlas:identity-issuer", ["IdentityKeyRotated", "SubstrateAlert"]),

  // AgentScheduler — platform/scheduler/scheduler.ts
  makeSubAgentSpec("agent:atlas:scheduler", ["ScheduledTick", "SubstrateAlert"]),

  // Legacy fanout shadow actor — dashboard/types.ts
  makeSubAgentSpec("agent:atlas:legacy-fanout-shadow", ["SubstrateAlert"]),

  // Goal-loop runner — platform/agent-runtime/goal-loop.ts
  makeSubAgentSpec("agent:atlas:goal-loop-runner", [
    "AgentDecision",
    "AgentEscalation",
    "SubstrateAlert",
  ]),

  // ScheduledTriggerConsumer — platform/event-trigger-bus/scheduled-trigger-consumer.ts
  makeSubAgentSpec("agent:atlas:scheduled-trigger-consumer", [
    "ScheduledTick",
    "SubstrateAlert",
  ]),

  // Substrate-state reporter — runtime/agents/atlas-substrate-state.ts
  makeSubAgentSpec("agent:atlas:substrate-state", [
    "SecuritySubstrateSnapshot",
    "SubstrateAlert",
  ]),
];

// ---------------------------------------------------------------------------
// Category C — Markets / trading task actors
// ---------------------------------------------------------------------------
// Parent: Kai (Markets Engineer, engineering)
// Kai §11 events: OrderSubmitted, OrderRouted, OrderRejected, OrderFilled,
//   OrderCancelled, OrderReplaced, TradeExecuted, TradeBooked, MarketDataDelayed,
//   MarketDataFailover, PreTradeGatewayBlock, PreTradeLimitChanged,
//   SurveillanceFeedGap, SurveillanceThresholdTuned, BestExecutionAttested,
//   OmsConfigChanged, FixGatewayChanged, OrderBookDegraded, OrderBookFailover,
//   TradeReported, AgentEscalation, OrderProposed, GatewayCheckRequested,
//   GatewayCheckCompleted, OrderApprovedAtGateway, OrderRejectedAtGateway

const CATEGORY_C: AgentSpec[] = [
  // FX rate derivation task — pricing events subset
  makeSubAgentSpec("agent:kai:fx-pricer", [
    "MarketDataDelayed",
    "MarketDataFailover",
    "AgentEscalation",
  ]),

  // RFQ gateway task — FX trade lifecycle events
  makeSubAgentSpec("agent:kai:fx-rfq", [
    "OrderProposed",
    "GatewayCheckRequested",
    "GatewayCheckCompleted",
    "OrderApprovedAtGateway",
    "OrderRejectedAtGateway",
    "OrderSubmitted",
    "OrderRouted",
    "OrderRejected",
    "OrderFilled",
    "OrderCancelled",
    "TradeExecuted",
    "TradeBooked",
    "AgentEscalation",
  ]),

  // CDM TypeScript bindings generator — build / schema events
  makeSubAgentSpec("agent:kai:m1-cdm-typescript-bindings", ["AgentEscalation"]),
];

// ---------------------------------------------------------------------------
// Category D — Governance snapshot task actors
// ---------------------------------------------------------------------------

const CATEGORY_D: AgentSpec[] = [
  // Helena (CRO, governance) — risk appetite monitoring
  // Helena §11: AppetiteLineApproved, AppetiteBreachDisposed, ModelRiskApproved,
  //   BrcPaperApproved, StressScenarioApproved, SupervisoryResponseApproved,
  //   RiskPolicyChanged, AgentEscalation
  makeSubAgentSpec("agent:helena:risk-appetite-watch", [
    "AppetiteLineApproved",
    "AppetiteBreachDisposed",
    "AgentEscalation",
  ]),

  // Devon (COO, governance) — operational resilience snapshot
  // Devon §11: AgentDecision, WorkstreamRegistered, AgentEscalation, RiskRaised
  makeSubAgentSpec("agent:devon:operational-resilience-snapshot", [
    "AgentDecision",
    "AgentEscalation",
    "RiskRaised",
  ]),

  // Camille (CFO, governance) — financial position snapshot
  // Camille §11: AgentDecision, AgentEscalation, RiskRaised, WorkstreamRegistered
  makeSubAgentSpec("agent:camille:financial-position-snapshot", [
    "AgentDecision",
    "AgentEscalation",
    "RiskRaised",
  ]),

  // Anya (Data Engineer, engineering) — projection refresh
  // Anya §11: ProjectionRegistered, MetricRegistered, DataContractApproved,
  //   RegulatoryMartRegistered, DashboardProjectionRefreshed,
  //   MarketsProjectionRegistered, MarketsProjectionRefreshed,
  //   MasterDataReconciled, AgentEscalation, AgentDecision
  makeSubAgentSpec("agent:anya:projection-refresh", [
    "DashboardProjectionRefreshed",
    "MarketsProjectionRefreshed",
    "AgentEscalation",
  ]),

  // Anya — projection drift detection
  makeSubAgentSpec("agent:anya:projection-drift", [
    "MasterDataReconciled",
    "AgentEscalation",
  ]),

  // Owen (CoSec, governance) — governance cycle prep
  // Owen §11: AgentDecision, ResolutionRecorded, ConflictRegistered,
  //   RelatedPartyRegistered, ActionClosed, AgentEscalation, WorkstreamRegistered
  makeSubAgentSpec("agent:owen:governance-cycle-prep", [
    "AgentDecision",
    "AgentEscalation",
    "WorkstreamRegistered",
  ]),

  // Rohan (Quant Risk, engineering) — risk run
  // Rohan §11: RiskRunCompleted, RiskRaised, ModelVersionPublished,
  //   LimitOverrideApproved, LimitUtilisationCheckpoint, ScenarioLibraryPublished,
  //   RWAAttributionPublished, RiskRatingRefined, StressTestRun,
  //   ICAAPSubmissionDrafted, AgentEscalation, AgentDecision
  makeSubAgentSpec("agent:rohan:risk-run", [
    "RiskRunCompleted",
    "RiskRaised",
    "LimitUtilisationCheckpoint",
    "AgentEscalation",
  ]),

  // Mira (CCO, governance) — obligations snapshot
  // Mira §11: KycTierAssigned, ClientAccepted, ClientReferredEdd,
  //   ClientReviewTriggered, SanctionsMatchClassified, AlertOpened, AlertDisposed,
  //   ObligationRegistered, M1CitationTrancheRegistered, ObligationImpactAssessed,
  //   StrDrafted, CtrDrafted, TprDrafted, AgentEscalation
  makeSubAgentSpec("agent:mira:obligations-snapshot", [
    "ObligationRegistered",
    "ObligationImpactAssessed",
    "AgentEscalation",
  ]),

  // Senna (CISO, governance) — security substrate state
  // Senna §11: ThreatModelGateDecision, ThreatModelDimensionRegistered,
  //   SecurityGateRegistered, SecurityIncidentRaised, SecurityIncidentEnriched,
  //   SecurityResponseOrchestrated, KeyRotationPerformed, KeyRotationPolicySet,
  //   SecureSdlcPipelineChanged, DetectionRuleChanged, SbomAccepted,
  //   RehearsalApproved, SecuritySubstrateSnapshot, AgentEscalation
  makeSubAgentSpec("agent:senna:security-substrate-state", [
    "SecuritySubstrateSnapshot",
    "ThreatModelGateDecision",
    "AgentEscalation",
  ]),

  // Zara (MLRO, governance) — AML supervision
  // Zara §11: STRSubmitted, STRDeclined, CTRSubmitted, SARSubmitted, TPRSubmitted,
  //   SanctionsHitDisposed, SanctionsRuleApproved, PEPHandlingDecided,
  //   ConductBreachDisposed, RMCPVersionApproved, RegulatorResponseApproved,
  //   AgentEscalation, AgentDecision, SanctionsClearancePassed
  makeSubAgentSpec("agent:zara:mlro-supervision", [
    "AgentDecision",
    "AgentEscalation",
  ]),

  // Thandiwe (CAE, governance) — audit committee prep
  // Thandiwe §11: ThirdLineOpinionSigned, AuditPlanRevisionApproved,
  //   AuditUniverseRevised, AuditFinding, AuditFindingOwnerAssigned,
  //   AuditCharterRevisionApproved, QAIPCycleClosed, InvestigationClosed,
  //   ExternalAuditScopeApproved, AgentEscalation, AgentDecision, CAEAttestation
  makeSubAgentSpec("agent:thandiwe:audit-committee-prep", [
    "AgentDecision",
    "AgentEscalation",
    "CAEAttestation",
  ]),

  // Rashida (CISO/Cyber, governance) — cyber resilience snapshot
  // Rashida §11: ThreatModelGateDecision, SBOMAccepted, SBOMRejected,
  //   SupplyChainAttestationApproved, KeyCeremonyApproved, KeyRotationCadenceApproved,
  //   DetectionStandardApproved, SecurityIncidentRated, SecurityIncidentClosed,
  //   VendorSecurityApproved, VendorSecurityRejected, SecondLineCyberOpinionSigned,
  //   POPIASec19_22AttestationSigned, JointStandard2ProgrammeAttestation,
  //   AgentEscalation, AgentDecision, RiskRaised
  makeSubAgentSpec("agent:rashida:cyber-resilience-snapshot", [
    "AgentDecision",
    "AgentEscalation",
    "RiskRaised",
    "SecondLineCyberOpinionSigned",
  ]),

  // Iris (IO, governance) — POPIA controls snapshot
  // Iris §11: ProcessingPurposeApproved, ProcessingPurposeRejected, DSARClosed,
  //   BreachNotificationDispatched, DataSubjectNotificationDispatched,
  //   CrossBorderTransferApproved, PAIAManualVersionApproved,
  //   ConsentTemplateApproved, RetentionScheduleApproved, AgentEscalation,
  //   AgentDecision
  makeSubAgentSpec("agent:iris:popia-controls-snapshot", [
    "AgentDecision",
    "AgentEscalation",
  ]),

  // Eitan (Treasury, engineering) — liquidity snapshot
  // Eitan §11: AgentDecision, AgentEscalation, RiskRaised, WorkstreamRegistered
  makeSubAgentSpec("agent:eitan:liquidity-snapshot", [
    "AgentDecision",
    "AgentEscalation",
    "RiskRaised",
  ]),

  // Saskia (Markets Ops, engineering) — markets readiness snapshot
  // Saskia §11: AgentDecision, AgentEscalation, RiskRaised, WorkstreamRegistered
  makeSubAgentSpec("agent:saskia:markets-readiness-snapshot", [
    "AgentDecision",
    "AgentEscalation",
    "RiskRaised",
  ]),
];

// ---------------------------------------------------------------------------
// Category E — Operations & readiness task actors
// ---------------------------------------------------------------------------

const CATEGORY_E: AgentSpec[] = [
  // Bea (Finance Engineer, engineering) — accounting readiness
  // Bea §11: PostingRulePublished, IFRSClassificationAssigned,
  //   IfrsClassificationApplied, SubLedgerPostingEmitted, FVHierarchyAssigned,
  //   JournalEntryPosted, SubLedgerReconciled, CloseCycleCompleted,
  //   BalanceSheetSubstantiationCompleted, BAReturnCellMapped, BAReturnGenerated,
  //   AuditPackReady, RestatementBooked, AgentEscalation, AgentDecision
  makeSubAgentSpec("agent:bea:accounting-readiness", [
    "AgentDecision",
    "AgentEscalation",
  ]),

  // Bea — period-close run (Category G in source, same parent)
  makeSubAgentSpec("agent:bea:period-close", [
    "CloseCycleCompleted",
    "SubLedgerReconciled",
    "BalanceSheetSubstantiationCompleted",
    "AgentDecision",
    "AgentEscalation",
  ]),

  // Scrooge (Chief of Staff, governance) — inbox hygiene sweep
  // Scrooge §11: InboxHygieneSweep, WorkRoutedToAgent, RoleResearchRequested,
  //   AgentEscalationFromScrooge, SubstrateGapInventoried
  makeSubAgentSpec("agent:scrooge:inbox-hygiene", [
    "InboxHygieneSweep",
    "AgentEscalation",
  ]),

  // Yael (Tax, governance) — tax readiness
  // Yael §11: TaxClassificationPublished, VATApportionmentBasisApproved,
  //   FATCAClassificationAssigned, CRSClassificationAssigned, TaxReturnDrafted,
  //   TaxPositionTaken, TransferPricingDocumented, SARSGuidanceScanned,
  //   AgentEscalation, AgentDecision
  makeSubAgentSpec("agent:yael:tax-readiness", [
    "AgentDecision",
    "AgentEscalation",
  ]),

  // Tomas (Payments, engineering) — payments readiness
  // Tomas §11: PaymentInitiated, PaymentSettled, PaymentRetried, PaymentFailed,
  //   SettlementBreak, ReconciliationFailed, ReconciliationMatched,
  //   CutOffAdjusted, CutOffBreach, NostroFunded, NostroSwept,
  //   SchemeConnectivityChanged, CalendarEntryPosted, CSPAttestationLodged,
  //   AgentEscalation
  makeSubAgentSpec("agent:tomas:payments-readiness", [
    "AgentEscalation",
  ]),

  // Imani (GC, governance) — legal readiness
  // Imani §11 (build-phase active): ClauseLibraryRevised,
  //   ContractTemplateVersioned, CounterpartyClassified, EctaExecutionApproved,
  //   LegalEntityChanged, NegotiationPositionRecorded, AgentEscalation
  makeSubAgentSpec("agent:imani:legal-readiness", [
    "AgentEscalation",
  ]),

  // Ravi (ALM, engineering) — ALM readiness
  // Ravi §11: ALMRunCompleted, SAMOSFundingPlanned, RepoExecuted, HedgeExecuted,
  //   FundingCurvePublished, FTPRatePublished, LiquidityReallocated,
  //   LiquidityWatchCheckpoint, CollateralSubstituted, HQLACompositionAssessed,
  //   AgentEscalation, AgentDecision
  makeSubAgentSpec("agent:ravi:alm-readiness", [
    "ALMRunCompleted",
    "AgentDecision",
    "AgentEscalation",
  ]),

  // Ravi — FTP curve publication
  makeSubAgentSpec("agent:ravi:ftp-curve-publish", [
    "FTPRatePublished",
    "FundingCurvePublished",
    "AgentEscalation",
  ]),

  // Sade (AgentOps, engineering) — agent operations readiness
  // Sade §11: TokenUsageRecorded, AgentEfficiencyAdvisoryIssued,
  //   AgentPromptOptimizationApplied
  makeSubAgentSpec("agent:sade:agentops-readiness", [
    "TokenUsageRecorded",
    "AgentEfficiencyAdvisoryIssued",
    "AgentPromptOptimizationApplied",
    "AgentEscalation",
  ]),

  // PAX (Research, engineering) — role research queue
  // PAX §11: WorkstreamRegistered, RoleBriefDelivered, SourceScanCompleted,
  //   ResearchDeclined, AgentEscalation
  makeSubAgentSpec("agent:pax:role-research-queue", [
    "WorkstreamRegistered",
    "RoleBriefDelivered",
    "SourceScanCompleted",
    "ResearchDeclined",
    "AgentEscalation",
  ]),
];

// ---------------------------------------------------------------------------
// Category F — Overnight recon + codebase quality task actors
// ---------------------------------------------------------------------------

const CATEGORY_F: AgentSpec[] = [
  // Vera (Internal Audit Engineer, governance) — overnight recon run
  // Vera §11: ReconResult, ReconViolation, AuditFinding, AuditIssueOpened,
  //   AuditIssueClosed, AgentEscalation
  // Sub-agent scope: read-only; emits recon summary events only
  makeSubAgentSpec("agent:vera:overnight-recon", [
    "ReconResult",
    "ReconViolation",
    "AuditFinding",
    "AuditIssueOpened",
    "AuditIssueClosed",
    "AgentEscalation",
  ]),

  // Vera — codebase quality review
  makeSubAgentSpec("agent:vera:codebase-quality-review", [
    "ReconResult",
    "ReconViolation",
    "AuditFinding",
    "AgentEscalation",
  ]),

  // Mira — FAIS horizon scan
  makeSubAgentSpec("agent:mira:fais-horizon-scan", [
    "ObligationRegistered",
    "ObligationImpactAssessed",
    "M1CitationTrancheRegistered",
    "AgentEscalation",
  ]),

  // Sade — performance evaluator
  makeSubAgentSpec("agent:sade:performance-evaluator", [
    "TokenUsageRecorded",
    "AgentEfficiencyAdvisoryIssued",
    "AgentPromptOptimizationApplied",
    "AgentEscalation",
  ]),
];

// ---------------------------------------------------------------------------
// All sub-agent specs
// ---------------------------------------------------------------------------

const ALL_SUB_AGENT_SPECS: AgentSpec[] = [
  ...CATEGORY_A,
  ...CATEGORY_B,
  ...CATEGORY_C,
  ...CATEGORY_D,
  ...CATEGORY_E,
  ...CATEGORY_F,
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface PerActorLog {
  readonly agentUrn: string;
  readonly category: string;
  readonly outcome: "published" | "unchanged" | "failed";
  readonly detail: string;
}

async function main(): Promise<number> {
  const publisher = new LocalPermissionPolicyPublisher({ eventStore });
  const log: PerActorLog[] = [];
  let failures = 0;

  const categoryOf = (urn: string): string => {
    if (CATEGORY_A.some((s) => s.agentUrn === urn)) return "A:substrate-internal";
    if (CATEGORY_B.some((s) => s.agentUrn === urn)) return "B:platform-infra";
    if (CATEGORY_C.some((s) => s.agentUrn === urn)) return "C:markets-trading";
    if (CATEGORY_D.some((s) => s.agentUrn === urn)) return "D:governance-snapshot";
    if (CATEGORY_E.some((s) => s.agentUrn === urn)) return "E:operations-readiness";
    if (CATEGORY_F.some((s) => s.agentUrn === urn)) return "F:recon-quality";
    return "unknown";
  };

  logger.info(
    { total: ALL_SUB_AGENT_SPECS.length },
    "publish:sub-agent-policies — starting",
  );

  for (const spec of ALL_SUB_AGENT_SPECS) {
    const category = categoryOf(spec.agentUrn);
    try {
      const result = publisher.publish(spec);
      log.push({
        agentUrn: spec.agentUrn,
        category,
        outcome: result.status,
        detail: `hash=${result.policyHash.slice(0, 12)} emitted=${result.eventEmitted}`,
      });
      logger.info(
        {
          agentUrn: spec.agentUrn,
          category,
          status: result.status,
          eventEmitted: result.eventEmitted,
          eventsAllowed: spec.eventsEmitted.length,
        },
        `publish:sub-agent-policies — ${result.status}: ${spec.agentUrn}`,
      );
    } catch (e) {
      failures++;
      log.push({
        agentUrn: spec.agentUrn,
        category,
        outcome: "failed",
        detail: `error: ${(e as Error).message}`,
      });
      logger.error(
        { agentUrn: spec.agentUrn, category, err: e },
        `publish:sub-agent-policies — FAILED: ${spec.agentUrn}`,
      );
    }
  }

  const counts = {
    published: log.filter((l) => l.outcome === "published").length,
    unchanged: log.filter((l) => l.outcome === "unchanged").length,
    failed: log.filter((l) => l.outcome === "failed").length,
  };

  logger.info(
    { ...counts, total: ALL_SUB_AGENT_SPECS.length },
    `publish:sub-agent-policies — done: published=${counts.published} unchanged=${counts.unchanged} failed=${counts.failed}`,
  );

  if (failures > 0) {
    logger.error(
      { failures },
      "publish:sub-agent-policies — FAILURES detected; ACCEPTED_NO_POLICY_ACTORS NOT safe to clear",
    );
    return 1;
  }

  logger.info(
    "publish:sub-agent-policies — ALL policies published. Safe to empty ACCEPTED_NO_POLICY_ACTORS.",
  );
  return 0;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
