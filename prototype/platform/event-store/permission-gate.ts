// platform/event-store/permission-gate.ts
//
// A1.2 — Event-store permission gate. Hook for the event store's
// `append` path that asserts the actor's agent identity is allowed to
// emit the event type per its published permission policy.
//
// Per Atlas spec §3.1:
//   - The actor's `agent:<urn>` resolves to a registered agent.
//   - The event type is in the agent's `eventEmitAllowList`.
//   - If both pass: append succeeds.
//   - If either fails: append rejects with a typed error AND emits a
//     `SubstrateAlert` (alertClass: integrity).
//
// Vera carve-out: Vera's identity has a hardcoded read-only over every
// stream regardless of permission policy. Vera *cannot* write to streams
// outside her published allow-list — read-only carve-out is asymmetric
// (third-line independence: Vera reads everything to assert; Vera can
// only write what her spec authorises).
//
// Feature-flag posture (T-01 secure-by-default, 2026-05-10):
//   - The gate is **on by default** (`isGateEnabled()` returns `true`
//     unless `BANK_PERMISSION_GATE_DISABLED=true`).
//   - The previous opt-in env-var `BANK_PERMISSION_GATE_ENABLED` was
//     retired; opt-out semantics replace it. Anyone who set the old
//     name to `true` can simply unset it (gate stays on); anyone who
//     relied on the gate being off must now set
//     `BANK_PERMISSION_GATE_DISABLED=true` explicitly.
//   - To soften the flip for events emitted before A1's permission
//     policy was published for the actor, a static
//     `LEGACY_PRE_A1_EVENT_TYPES` allow-list bypasses the gate (with a
//     low-severity `SubstrateAlert` of class `integrity` recording the
//     bypass per (agentUrn, eventType) pair) — the bypass list is
//     driven to zero as agents publish their policies.
//
// Per Senna+Rashida threat-model T-01 (Owner Inbox/2026-05-10_senna-
// rashida_agent-runtime-substrate-threat-model.md):
//   "Flip the default in `permission-gate.ts:isGateEnabled()` so absent
//    env-var means `true`. Add `BANK_PERMISSION_GATE_DISABLED=true` as
//    the explicit *off* switch — opt-out, not opt-in. The semantic
//    flip is the substrate-fix; the env-var rename is its API surface."
//
// Standing authority: S8 agent-runtime substrate + Principle 4
// (security designed in). No new CEO decision required —
// D-T-01-PERMISSION-GATE-SECURE-DEFAULT records the substrate change
// under that umbrella.
//
// Author: Atlas + Senna (A1.2), Atlas (T-01 default-flip 2026-05-10)

import type { PermissionPolicyResolver } from "../agent-identity/permission-policy";
import { makeSubstrateAlert } from "./event-types";
import type { EventStore } from "./store";
import type { Event } from "./types";

/** Vera's URN. Hardcoded — third-line read carve-out is non-configurable. */
export const VERA_URN = "agent:vera";

/**
 * Privileged event types — always require an explicit allow-list entry
 * regardless of actor class.
 *
 * D-T-01-PERMISSION-GATE-SECURE-DEFAULT Option C (CEO-approved 2026-05-12):
 *   Internal service agents (`actor.type === "service"`, `actor.id` starts
 *   with `agent:`) are allow-by-default for all event types EXCEPT the
 *   types in this set. Emitting a privileged type without an explicit
 *   policy allow-list entry is always denied — these types directly mutate
 *   governance, identity, or security state and must remain tightly
 *   controlled regardless of the broader relaxation for operational types.
 *
 * Extending this set requires a CEO decision (the set is a security
 * boundary, not operational scaffolding). Vera's recon asserts the set is
 * non-empty and contains at minimum `CeoDecision` and
 * `IdentityPermissionChanged`.
 */
export const PRIVILEGED_EVENT_TYPES: ReadonlySet<string> = new Set([
  // Governance mutations — direct CEO-level decisions; must never be emitted
  // by an autonomous agent without an explicit policy entry.
  "CeoDecision",
  // Identity / permission mutations — changing who can do what is a
  // security-state mutation; explicit policy required.
  "IdentityPermissionChanged",
  // Permission policy publication — controls the gate itself; if an agent
  // could freely emit this, it could grant itself or others arbitrary access.
  "PermissionPolicyPublished",
  // Key rotation — identity key changes are security-state mutations.
  "IdentityKeyRotated",
  // Security incidents raised at the infrastructure level — not operational
  // findings (those are RiskRaised / ReconViolation), but security-control
  // lifecycle events.
  "SecurityGateRegistered",
] as const);

/**
 * Legacy pre-A1-vintage event types. The gate skips enforcement for
 * events of these types when the actor's policy lookup fails (no
 * `PermissionPolicyPublished` yet). This is the one-time backfill
 * window per D-T-01-PERMISSION-GATE-SECURE-DEFAULT mitigation #2:
 *
 *   "Add a one-time backfill allow-list (`LEGACY_PRE_A1_EVENT_TYPES`)
 *    for the small set of events whose actors pre-date the registry
 *    (the local `.local/event.db` carries them today). The gate skips
 *    enforcement for events in this list, with a `SubstrateAlert` of
 *    `severity: low` recording the bypass per event-type per actor —
 *    so we can drive the list to zero over the next few agent ticks."
 *
 * Composition:
 *   - Every `prototype/platform/event-store/registry.ts` event type as
 *     as of D-T-01-PERMISSION-GATE-SECURE-DEFAULT (2026-05-10) is included. As agents
 *     publish their `PermissionPolicyPublished` events, their actor
 *     URNs naturally take the policy-enforced path; the bypass only
 *     fires when *no policy is published yet* AND the type is on this
 *     list.
 *   - Once every standing agent has published a policy (Wave-4 #11
 *     coverage recon, Vera), this list is retired by deletion.
 *
 * Adding a new event type to the registry does **not** add it here.
 * New types must be in the emitting agent's `eventEmitAllowList` from
 * day one — the backfill is a one-shot for pre-A1 history, not a
 * sustained loophole.
 */
export const LEGACY_PRE_A1_EVENT_TYPES: ReadonlySet<string> = new Set([
  // -------------------------------------------------------------------
  // Snapshot of every event type emitted across `prototype/platform/`,
  // `prototype/runtime/`, `prototype/scenarios/`, `prototype/scripts/`
  // and `prototype/tests/` as of D-T-01-PERMISSION-GATE-SECURE-DEFAULT (2026-05-10).
  // The list is alphabetised for stable diffs; *adding* a type here
  // after this date is a Vera finding (recon:permission-gate-default
  // will assert the snapshot is closed-set). New event types must
  // appear in the emitting agent's `eventEmitAllowList` from day one.
  //
  // Both production-emitted and test-fixture types are included — the
  // bypass is only invoked when the actor has no published policy,
  // which is the steady-state for tests + the migration window for
  // production agents.
  // -------------------------------------------------------------------
  "AFSSigned",
  "ALMReadinessSnapshot",
  "AccountOpened",
  "AccountingPolicyChanged",
  "AccountingReadinessSnapshot",
  "AgentBriefIssued",
  "AgentDecision",
  "AgentEscalation",
  "AgentEscalationAcknowledged",
  "AgentEscalationDecided",
  "AgentEscalationDelegated",
  "AgentEscalationOverdue",
  "AgentFeedbackIssued",
  "AgentOpsReadinessSnapshot",
  "AgentPerformanceEvaluated",
  "AgentRegistered",
  "AgentRetired",
  "AgentRunCompleted",
  "AgentRunFailed",
  "AgentRunStarted",
  "Alpha",
  "AppetiteBreach",
  "AppetiteBreachDisposed",
  "AuditCommitteePackPrepped",
  "AuditFinding",
  "BAReturnSigned",
  "BacktestBreachDisposed",
  "BacktestRequested",
  "BacktestRun",
  "BadMarketsTrade",
  "BankAccountClosed",
  "BankAccountConfigured",
  "BankAccountOpened",
  "BcbsFrtbEvent",
  "Beta",
  "BriefSuperseded",
  "BusDispatched",
  "CRSClassificationAssigned",
  "CRSReportingPublished",
  "CapacityBreach",
  "CapitalContributionRecorded",
  "CapitalEvent",
  "CdmBindingsRegenerated",
  "CeoDecision",
  "ChangeApproved",
  "CitationGateFailed",
  "CitationGatePassed",
  "ClauseLibraryVersionPublished",
  "ClientAccepted",
  "ClientCandidateRegistered",
  "ClientIdentityVerified",
  "CloseApproved",
  "CounterpartyEligibilityBreached",
  "CounterpartyEligibilityRevalidated",
  "CounterpartyEligibilityScreened",
  "CounterpartyEvent",
  "CounterpartyOnboarded",
  "CutoffMissed",
  "CyberResilienceSnapshot",
  "DashboardProjectionRefreshed",
  "DataProjectionSnapshot",
  "DealerMandateBreach",
  "DecisionComment",
  "DecisionRequested",
  "ECLBookingApproved",
  "ECTAExecutionRecorded",
  "EmptyCitationEvent",
  "EquityCorporateActionApplied",
  "EquitySettlementInstructed",
  "EquityTradeBooked",
  "ExternalAuditorInquiry",
  "FAISConductBreachSuspected",
  "FATCAClassificationAssigned",
  "FATCAReportingPublished",
  "Feedback",
  "FicEventOk",
  "FinancialPositionSnapshot",
  "FxSettlementInstructed",
  "FxTradeExecuted",
  "GatewayCheckCompleted",
  "GatewayCheckRequested",
  "GhostEvent",
  "GoodMarketsTrade",
  "GovernanceCyclePrep",
  "GovernanceEvent",
  "GovernanceUrnEvent",
  "IFRSClassificationAssigned",
  "IdentityKeyRotated",
  "IfrsClassificationApplied",
  "InboxHygieneSweep",
  "IncidentRaised",
  "IntraGroupArrangementSigned",
  "IssuerInclusionListRefreshed",
  "KYCRuleEvaluated",
  "KeyRotationPerformed",
  "LegacyFanoutShadowed",
  "LegalEntityChanged",
  "LegalEntityRegistered",
  "LegalReadinessSnapshot",
  "LimitOverrideRequested",
  "LiquiditySnapshot",
  "M1CitationTrancheRegistered",
  "MLROAttestation",
  "MarketDataIngested",
  "MarketSurveillanceAlert",
  "MarketsProjectionRefreshed",
  "MarketsProjectionRegistered",
  "MarketsReadinessSnapshot",
  "MasterAgreementSigned",
  "MaterialIFRSClassificationChange",
  "MethodologyChangeRequested",
  "ModelDriftDetected",
  "ModelSubmitted",
  "ModelTierClassified",
  "ModelValidationApproved",
  "ModelValidationWithheld",
  "NewEvent",
  "ObligationRegistered",
  "ObligationsRegisterSnapshot",
  "OldEvent",
  "OperationalResilienceSnapshot",
  "OrderApprovedAtGateway",
  "OrderProposed",
  "OrderRejectedAtGateway",
  "OtherType",
  "PEPMatchExceedsThreshold",
  "POPIAControlsSnapshot",
  "PaymentInitiated",
  "PaymentSettled",
  "PaymentsReadinessSnapshot",
  "PermissionPolicyPublished",
  "PersonalInformationCompromiseSuspected",
  "PhantomBcbsEvent",
  "PhantomUrnEvent",
  "PositionAdjusted",
  "PreTradeLimitChanged",
  "PricingModelEvaluated",
  "ProductApproved",
  "ProductConceptualised",
  "ProductDimensionAttested",
  "ProductDueDiligenceCompleted",
  "ProductDueDiligenceWithheld",
  "ProductLaunched",
  "ProductPostImplementationReviewCompleted",
  "ProductProposalRegistered",
  "ProductRetired",
  "ProductReviewCompleted",
  "ProductVersionPublished",
  "ProductWithheld",
  "ProductionUseRequested",
  "RMCPVersionApproved",
  "RandomEvent",
  "ReconResult",
  "ReconSynthetic",
  "ReconViolation",
  "ReconciliationCompleted",
  "RecordFiled",
  "RegulatorInquiry",
  "ResilienceTestResult",
  "RestatementProposed",
  "RfqRequested",
  "RiskAppetiteSnapshot",
  "RiskRaised",
  "RiskRatingAssigned",
  "RiskRunCompleted",
  "RoleResearchQueueSnapshot",
  "RuntimeUrnEvent",
  "SAMOSWindowEntered",
  "SARSGuidanceScanned",
  "SBOMAccepted",
  "SBOMRejected",
  "SLOBudgetBurn",
  "STRCandidate",
  "STRDeclined",
  "STRSubmitted",
  "STTRemitted",
  "SWIFTMessageProcessed",
  "SanctionsHit",
  "SanctionsListRefreshed",
  "ScenarioEvent",
  "ScheduledTrigger",
  "SecurityGateRegistered",
  "SecurityIncidentRaised",
  "SecuritySubstrateSnapshot",
  "SubLedgerEntryPosted",
  "SubLedgerPostingEmitted",
  // Substrate-runner lifecycle primitives (S8 / D-AGENT-RUNTIME-AUTHORIZE).
  // Authored 2026-05-10 — same date as the legacy-bypass snapshot, under
  // the same closed-set discipline. The substrate runner actor
  // (`agent:atlas:substrate-runner`) emits these without a published
  // permission policy until A4 fleet rollout publishes one for the
  // substrate's own service identity. Vera's recon driving the bypass
  // count to zero will close out this hand-off when the policy lands.
  "SubstrateAgentRunCompleted",
  "SubstrateAgentRunFailed",
  "SubstrateAgentRunStarted",
  "SubstrateAlert",
  "SubstrateStateSnapshot",
  "SwitchTestActivated",
  "SwitchTestEnded",
  "SwitchTestReport",
  "TaxClassificationPublished",
  "TaxReadinessSnapshot",
  "TaxReturnDrafted",
  "TaxSubmissionApproved",
  "Test",
  "TestEvent",
  "ThreatModelDimensionRegistered",
  "ThreatModelGateDecision",
  "TradeBooked",
  "TradeExecuted",
  "TransferPricingFilingApproved",
  "TypoCitationEvent",
  "UpperCaseUrnEvent",
  "VATFilingApproved",
  "ValidationFindingClosed",
  "ValidationFindingRaised",
  "ValidationMethodologyPublished",
  "VendorSecurityReview",
  "WhistleblowingDisclosure",
  "WidgetTouched",
  "WorkstreamCompleted",
  "WorkstreamRegistered",
  "WorkstreamStarted",
]);

/** Error thrown when the gate denies an append. */
export class PermissionGateDenied extends Error {
  readonly agentUrn: string | undefined;
  readonly eventType: string;
  readonly reason: string;

  constructor(args: { agentUrn: string | undefined; eventType: string; reason: string }) {
    super(
      `Permission gate denied: actor=${args.agentUrn ?? "<no-agent>"} type=${args.eventType} reason=${args.reason}`,
    );
    this.name = "PermissionGateDenied";
    this.agentUrn = args.agentUrn;
    this.eventType = args.eventType;
    this.reason = args.reason;
  }
}

/** Decision the gate produces — used by the wrapper around append. */
export interface GateDecision {
  readonly allowed: boolean;
  readonly reason?: string;
  /**
   * When `allowed === true` because the (agentUrn, eventType) pair fell
   * through the `LEGACY_PRE_A1_EVENT_TYPES` backfill, this carries the
   * bypass details so the wrapper can emit a low-severity
   * `SubstrateAlert` per pair (deduped at the wrapper layer).
   */
  readonly legacyBypass?: {
    readonly agentUrn: string;
    readonly eventType: string;
  };
}

export interface PermissionGateConfig {
  /** Resolver that returns the latest policy for a given agentUrn. */
  readonly policy: PermissionPolicyResolver;
  /**
   * If true, override the env-var feature flag and force-enable. Used by
   * tests that want to assert gate behaviour without setting env vars.
   * Falls through to env-var inspection when false / undefined.
   */
  readonly forceEnabled?: boolean;
  /**
   * If true, override the env-var and force-disable. Used by tests that
   * want to assert pass-through behaviour without setting env vars.
   * Mutually exclusive with `forceEnabled` — `forceEnabled` wins if both
   * are set, since a forced-on gate is the safer assertion.
   */
  readonly forceDisabled?: boolean;
  /**
   * Hook invoked when the gate denies an append. Production: emit a
   * `SubstrateAlert` to the event store. Tests: collect into an array
   * for assertion. The hook must not throw — the gate decision is the
   * return value.
   */
  readonly onDeny?: (decision: { event: Event; reason: string }) => void;
  /**
   * Hook invoked when the gate allows an append via the legacy
   * pre-A1-vintage backfill. Production: emit a low-severity
   * `SubstrateAlert` (alertClass: integrity) so Vera's recon can drive
   * the bypass list to zero. The default wrapper emits one alert per
   * (agentUrn, eventType) pair per process — to avoid alert flood when
   * the same legacy actor emits the same event repeatedly. Tests can
   * override to count every bypass.
   */
  readonly onLegacyBypass?: (decision: { event: Event; agentUrn: string }) => void;
}

/**
 * Returns true when the gate should be active for this process. Reads
 * `BANK_PERMISSION_GATE_DISABLED` at call time — production sets the
 * gate ON by default; the only way to disable is an explicit opt-out.
 *
 * Precedence:
 *   1. `forceEnabled === true` → on (test-only override).
 *   2. `forceDisabled === true` → off (test-only override).
 *   3. `BANK_PERMISSION_GATE_DISABLED === "true"` → off.
 *   4. Default → on.
 */
export function isGateEnabled(forceEnabled?: boolean, forceDisabled?: boolean): boolean {
  if (forceEnabled === true) return true;
  if (forceDisabled === true) return false;
  return process.env.BANK_PERMISSION_GATE_DISABLED !== "true";
}

/**
 * Pure decision function. Doesn't side-effect; callers route the
 * allowed/denied path through `onDeny`. Vera carve-out is enforced
 * here: writes outside the policy allow-list still deny — only *reads*
 * are unconstrained for Vera, and reads don't go through `append`.
 *
 * D-T-01 Option C evaluation order (CEO-approved 2026-05-12):
 *
 *   1. Non-agent actors (human, system, or service without `agent:` prefix):
 *      allowed unconditionally — they go through dashboard / runtime auth.
 *
 *   2. Privileged event type (`PRIVILEGED_EVENT_TYPES`):
 *      always requires explicit policy allow-list entry, regardless of actor.
 *      → If policy exists and type is listed: allowed.
 *      → If policy exists and type is NOT listed: denied.
 *      → If no policy: falls through to legacy-backfill check first, then denied.
 *
 *   3. Internal service agent (type=service, id=agent:*) emitting a
 *      NON-privileged type:
 *      → If policy exists and type is listed: allowed.
 *      → If policy exists and type is NOT listed: allowed-by-default
 *        (Option C relaxation — operational events don't need explicit entries).
 *      → If no policy: legacy-backfill check, then allowed-by-default.
 *
 * Backfill behaviour (unchanged): when the actor has no published policy
 * AND the event type is in `LEGACY_PRE_A1_EVENT_TYPES`, the decision is
 * `allowed: true` with `legacyBypass` populated so the caller can record
 * the bypass via `SubstrateAlert`. For privileged types this bypass is
 * still active during the migration window (preserves backward compatibility
 * for legacy actors that emitted CeoDecision before T-01 landed).
 */
export function decideAppend(args: {
  event: Event;
  policy: PermissionPolicyResolver;
}): GateDecision {
  const actor = args.event.actor;
  // Only `service` actors with `agent:<urn>` ids are subject to the
  // permission gate today. Human actors (CEO decisions) and `system`
  // actors are bypassed — they go through the dashboard / runtime
  // authentication paths instead. This keeps the gate scoped to
  // autonomous agent appends.
  if (actor.type !== "service" || !actor.id.startsWith("agent:")) {
    return { allowed: true };
  }
  const urn = actor.id;
  const eventType = args.event.type;
  const isPrivileged = PRIVILEGED_EVENT_TYPES.has(eventType);
  const policy = args.policy.lookup(urn);

  if (!policy) {
    // No published policy for this actor.
    if (LEGACY_PRE_A1_EVENT_TYPES.has(eventType)) {
      // Legacy backfill window: allow with bypass alert regardless of
      // whether the type is privileged (preserves backward compatibility
      // for pre-T-01 history).
      return {
        allowed: true,
        legacyBypass: { agentUrn: urn, eventType },
      };
    }
    if (isPrivileged) {
      // Privileged type with no policy and not in legacy backfill: deny.
      return {
        allowed: false,
        reason: `${urn} attempted to emit privileged type ${eventType} without a published permission policy (PRIVILEGED_EVENT_TYPES requires explicit allow-list entry)`,
      };
    }
    // Non-privileged type with no policy: Option C allow-by-default.
    return { allowed: true };
  }

  // Policy exists. Check the allow-list.
  if (policy.eventEmitAllowList.includes(eventType)) {
    return { allowed: true };
  }

  // Type not on allow-list.
  if (isPrivileged) {
    // Privileged types always require explicit listing — deny even for
    // Option C internal agents.
    return {
      allowed: false,
      reason: `${urn} not allowed to emit privileged type ${eventType} — add to eventEmitAllowList in the agent spec (PRIVILEGED_EVENT_TYPES: ${[...PRIVILEGED_EVENT_TYPES].join(", ")})`,
    };
  }

  // Non-privileged type not on allow-list for an internal service agent:
  // Option C allow-by-default. The policy's listed types are additive
  // (explicit entries remain valid); unlisted non-privileged types are
  // permitted for operational autonomy.
  return { allowed: true };
}

/**
 * Wrap an existing `EventStore`'s append path with the permission gate.
 * Returns a new object that delegates to the underlying store but runs
 * the gate first when enabled.
 *
 * The wrapper preserves identity for `replay`, `count`, `close`, etc. —
 * Vera's read carve-out flows through naturally because reads are not
 * intercepted.
 */
export function gateEventStore(args: {
  store: EventStore;
  config: PermissionGateConfig;
}): EventStore {
  const { store, config } = args;
  // Per-process dedup of legacy-bypass alerts — one per (agentUrn,
  // eventType) pair, to avoid alert flood. Vera's recon driving the
  // list to zero is the closure-mechanism, not high-frequency alerts.
  const seenBypasses = new Set<string>();
  // We expose the same surface as EventStore but intercept append.
  // Bun's class-based EventStore is structurally typed; we use a
  // proxy-style wrapper.
  const wrapped: EventStore = Object.create(store) as EventStore;
  const handleDecision = (e: Event, decision: GateDecision): void => {
    if (decision.allowed) {
      if (decision.legacyBypass) {
        const key = `${decision.legacyBypass.agentUrn}|${decision.legacyBypass.eventType}`;
        if (!seenBypasses.has(key)) {
          seenBypasses.add(key);
          if (config.onLegacyBypass) {
            try {
              config.onLegacyBypass({ event: e, agentUrn: decision.legacyBypass.agentUrn });
            } catch {
              // hook must not propagate — gate decision dominates.
            }
          } else {
            // Default behaviour: emit a low-severity SubstrateAlert
            // through the underlying store (bypass the gate; the alert
            // itself is on the legacy list).
            try {
              store.append(
                makeSubstrateAlert({
                  asOf: e.as_of,
                  entity: e.entity,
                  actor: { type: "service", id: "agent:atlas:permission-gate" },
                  citations: [
                    "P4-SECURITY-DESIGNED-IN",
                    "ORG-CY-03",
                    "Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md (T-01)",
                  ],
                  payload: {
                    alertId: `alert:integrity:permission-gate-legacy-bypass-${decision.legacyBypass.agentUrn.replace(/[^a-z0-9]/g, "-")}-${decision.legacyBypass.eventType.toLowerCase()}`,
                    alertClass: "integrity",
                    agentUrn: decision.legacyBypass.agentUrn,
                    severity: "low",
                    details: `Legacy pre-A1 backfill bypass: ${decision.legacyBypass.agentUrn} emitted ${decision.legacyBypass.eventType} without a published PermissionPolicy. Drive to zero by publishing the policy (bun run identity:issue) — see Senna+Rashida threat model T-01.`,
                  },
                }),
              );
            } catch {
              // Best-effort. If alert emission fails (e.g. closed store
              // during teardown), we still allow the original append to
              // proceed; the gate decision dominates.
            }
          }
        }
      }
      return;
    }
    const reason = decision.reason ?? "denied";
    if (config.onDeny) {
      try {
        config.onDeny({ event: e, reason });
      } catch {
        // onDeny must not propagate; the gate decision dominates.
      }
    }
    throw new PermissionGateDenied({
      agentUrn: e.actor.id.startsWith("agent:") ? e.actor.id : undefined,
      eventType: e.type,
      reason,
    });
  };

  wrapped.append = (raw: Event) => {
    if (!isGateEnabled(config.forceEnabled, config.forceDisabled)) {
      return store.append(raw);
    }
    const decision = decideAppend({ event: raw, policy: config.policy });
    handleDecision(raw, decision);
    return store.append(raw);
  };
  // appendAll batches through the same path; each event re-runs the
  // gate so a partial-failure event in the middle still rolls the
  // whole batch back via SQLite's transaction.
  wrapped.appendAll = (events: Event[]) => {
    if (!isGateEnabled(config.forceEnabled, config.forceDisabled)) {
      return store.appendAll(events);
    }
    for (const e of events) {
      const decision = decideAppend({ event: e, policy: config.policy });
      handleDecision(e, decision);
    }
    return store.appendAll(events);
  };
  return wrapped;
}
