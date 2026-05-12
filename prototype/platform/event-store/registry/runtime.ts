// platform/event-store/registry/runtime.ts
//
// F-021 (Atlas, 2026-05-12): runtime event-type registry rows.
//
// Covers:
//   - Agent escalation family (AgentEscalation, AgentEscalationAcknowledged,
//     AgentEscalationDecided, AgentEscalationDelegated, AgentEscalationOverdue)
//   - AgentDecision, AgentRegistered (deprecated), AgentRetired
//   - AgentRunStarted, AgentRunCompleted, AgentRunFailed
//   - SubstrateAgentRunStarted, SubstrateAgentRunCompleted, SubstrateAgentRunFailed
//   - WorkstreamRegistered, RiskRaised
//   - IdentityKeyRotated, PermissionPolicyPublished
//   - ScheduledTrigger, BusDispatched, LegacyFanoutShadowed, SubstrateAlert
//   - Goal-loop planning trace (AgentGoalEvaluated, AgentGoalSelected, AgentGoalDeferred)

import {
  agentDecisionPayloadSchema,
  agentEscalationAcknowledgedPayloadSchema,
  agentEscalationDecidedPayloadSchema,
  agentEscalationDelegatedPayloadSchema,
  agentEscalationOverduePayloadSchema,
  agentEscalationPayloadSchema,
  agentGoalDeferredPayloadSchema,
  agentGoalEvaluatedPayloadSchema,
  agentGoalSelectedPayloadSchema,
  agentRegisteredPayloadSchema,
  agentRunCompletedPayloadSchema,
  agentRunStartedPayloadSchema,
  busDispatchedPayloadSchema,
  identityKeyRotatedPayloadSchema,
  legacyFanoutShadowedPayloadSchema,
  permissionPolicyPublishedPayloadSchema,
  riskRaisedPayloadSchema,
  scheduledTriggerPayloadSchema,
  substrateAgentRunCompletedPayloadSchema,
  substrateAgentRunFailedPayloadSchema,
  substrateAgentRunStartedPayloadSchema,
  substrateAlertPayloadSchema,
  workstreamRegisteredPayloadSchema,
} from "../event-types";
import {
  RETENTION_GOVERNANCE_7Y,
  RETENTION_RUNTIME_1Y,
  type EventTypeMetadata,
} from "./types";

export const RUNTIME_EVENT_TYPES: readonly EventTypeMetadata[] = [
  // The four typed events that already have Zod schemas.
  {
    type: "AgentEscalation",
    class: "runtime",
    payloadSchema: agentEscalationPayloadSchema,
    issuer: "any-agent",
    subscribers: ["overseer", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #10",
  },
  {
    type: "AgentDecision",
    class: "runtime",
    payloadSchema: agentDecisionPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Vera", "Anya"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #9",
  },
  {
    type: "WorkstreamRegistered",
    class: "runtime",
    payloadSchema: workstreamRegisteredPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Anya", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze (markets-side coordinator); Atlas runtime spec §11",
  },
  {
    type: "RiskRaised",
    class: "runtime",
    payloadSchema: riskRaisedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Helena", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Helena risk-cycle spec; Atlas substrate-state",
  },
  // The remaining 11 runtime types from A0 §4 — registered without
  // typed payload schemas yet. They flow today via the envelope-only
  // path; typed schemas land as producers need them.
  {
    type: "AgentRegistered",
    class: "runtime",
    // Deprecated by D-PARTY-REGISTER (CEO-approved 2026-05-11, PR 4).
    // The unified Party event family — PartyRegistered{kind: "agent"} —
    // supersedes this type. Existing historical events remain in the log
    // (Principle 1 / append-only); no new emissions should use this type.
    // Backfill of historical AgentRegistered events into PartyRegistered
    // events lands in D-PARTY-REGISTER PR 2 (Imani — Legal-as-code engineer).
    status: "deprecated",
    supersededBy: "PartyRegistered",
    payloadSchema: agentRegisteredPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Vera", "Anya", "Iris"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-01", "D-PARTY-REGISTER"],
    // Agent-registration is governance: who is empowered to act for the
    // bank. 7y to match Companies Act director/officer-decision norms.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #1; A1.1 registry — platform/agent-runtime/registry.ts",
  },
  {
    type: "AgentRetired",
    class: "runtime",
    issuer: "Atlas",
    subscribers: ["Vera", "Anya", "Iris"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-01"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #2",
  },
  {
    type: "IdentityKeyRotated",
    class: "runtime",
    payloadSchema: identityKeyRotatedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Senna", "Rashida"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "ORG-CY-09", "ORG-PR-17"],
    // Key-rotation events are security-of-record. 7y matches the
    // governance / audit-trail norm; Joint Standard 2 of 2024 expects
    // forensic key-management trails for the lifetime of the affected
    // material, which the Principle 1 indefinite-log delivers.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #3; A1.2 issuer — platform/agent-identity/issuer.ts",
  },
  {
    type: "PermissionPolicyPublished",
    class: "runtime",
    payloadSchema: permissionPolicyPublishedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Vera", "Senna"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "ORG-CY-09"],
    // Permission-policy publications drive zero-trust access decisions;
    // forensic-grade retention for audit reconstruction.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #4; A1.2 policy — platform/agent-identity/permission-policy.ts",
  },
  {
    type: "ScheduledTrigger",
    class: "runtime",
    payloadSchema: scheduledTriggerPayloadSchema,
    issuer: "substrate",
    subscribers: ["target-agent", "Atlas", "Vera"],
    replay: "cumulative-fold",
    citationsHint: ["ORG-CY-01"],
    // Scheduler-tick stream — operational. 1y floor; high cardinality.
    retention: RETENTION_RUNTIME_1Y,
    source: "A0 freeze §4 #5; A2.1 scheduler — platform/scheduler/scheduler.ts",
  },
  {
    // Typed under D-RMS-PHASE-1 Slice 2 (CEO standing authority 2026-05-09).
    // S8/RMS overlap disposition (Scrooge ruling, 2026-05-10) — RMS owns
    // this records-of-agent-runs lifecycle event; class / issuer /
    // subscribers / replay unchanged from the A0 envelope-only row.
    type: "AgentRunStarted",
    class: "runtime",
    payloadSchema: agentRunStartedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Vera", "Anya"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_RUNTIME_1Y,
    source:
      "A0 freeze §4 #6; D-RMS-PHASE-1 Slice 2 typed payload — Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3.2",
  },
  {
    // Typed under D-RMS-PHASE-1 Slice 2 (CEO standing authority 2026-05-09).
    // S8/RMS overlap disposition (Scrooge ruling, 2026-05-10) — RMS owns
    // this records-of-agent-runs lifecycle event; class / issuer /
    // subscribers / replay unchanged from the A0 envelope-only row.
    type: "AgentRunCompleted",
    class: "runtime",
    payloadSchema: agentRunCompletedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Vera", "Anya"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_RUNTIME_1Y,
    source:
      "A0 freeze §4 #7; D-RMS-PHASE-1 Slice 2 typed payload — Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3.3",
  },
  {
    type: "AgentRunFailed",
    class: "runtime",
    issuer: "substrate",
    subscribers: ["Vera", "Devon"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-PR-17"],
    // Failures retained longer for incident analysis — promote to 7y.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #8",
  },
  {
    type: "AgentEscalationAcknowledged",
    class: "runtime",
    payloadSchema: agentEscalationAcknowledgedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["issuing-agent"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #11; A3.1 — platform/escalation/channel.ts",
  },
  {
    type: "AgentEscalationDecided",
    class: "runtime",
    payloadSchema: agentEscalationDecidedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["issuing-agent"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #12; A3.1 — platform/escalation/channel.ts",
  },
  {
    type: "AgentEscalationDelegated",
    class: "runtime",
    payloadSchema: agentEscalationDelegatedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["overseer-chain"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #13; A3.1 — platform/escalation/channel.ts",
  },
  {
    type: "AgentEscalationOverdue",
    class: "runtime",
    payloadSchema: agentEscalationOverduePayloadSchema,
    issuer: "substrate",
    subscribers: ["Vera", "governance-chain"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-04"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #14; A3.1 — platform/escalation/channel.ts",
  },
  {
    type: "SubstrateAlert",
    class: "runtime",
    payloadSchema: substrateAlertPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Devon", "Atlas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "ORG-PR-18"],
    // Substrate alerts are operational-incident records — promote to
    // 7y to match incident-record retention norms.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "A0 freeze §4 #15; A2.1 scheduler — platform/scheduler/scheduler.ts",
  },
  {
    type: "BusDispatched",
    class: "runtime",
    payloadSchema: busDispatchedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Atlas", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-01"],
    // High-cardinality dispatch trail — runtime tier.
    retention: RETENTION_RUNTIME_1Y,
    source: "Atlas runtime spec §3.3; A2.2 bus — platform/event-trigger-bus/bus.ts",
  },
  {
    // Substrate-runner lifecycle (S8 / D-AGENT-RUNTIME-AUTHORIZE).
    // Distinct from RMS's brief-coupled `AgentRunStarted` (which requires
    // a `briefId`). Wraps every `runAgent` invocation regardless of
    // whether a brief exists. Pair-coupled with `SubstrateAgentRun*` via
    // `runId`. See assessment doc
    // `Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md`.
    type: "SubstrateAgentRunStarted",
    class: "runtime",
    payloadSchema: substrateAgentRunStartedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Vera", "Atlas"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-09"],
    retention: RETENTION_RUNTIME_1Y,
    source:
      "Atlas runtime spec §3.4; S8 substrate-runner lifecycle — runtime/run.ts (Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md)",
  },
  {
    type: "SubstrateAgentRunCompleted",
    class: "runtime",
    payloadSchema: substrateAgentRunCompletedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Vera", "Atlas"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-09"],
    retention: RETENTION_RUNTIME_1Y,
    source:
      "Atlas runtime spec §3.4; S8 substrate-runner lifecycle — runtime/run.ts (Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md)",
  },
  {
    // Failures retained for 7y for incident analysis (matches the existing
    // RMS `AgentRunFailed` row's retention rule).
    type: "SubstrateAgentRunFailed",
    class: "runtime",
    payloadSchema: substrateAgentRunFailedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Vera", "Devon", "Atlas"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-09", "ORG-PR-17"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Atlas runtime spec §3.4; S8 substrate-runner lifecycle — runtime/run.ts (Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md)",
  },
  {
    // Short-lived event introduced for D-A22-RETIRE-LEGACY Phase 1
    // (bus-canonical, legacy-shadow). The legacy in-process fan-out
    // emits this per (parent run, triggered handler key) row instead
    // of invoking the handler. Phase 2 deletes both the legacy
    // fan-out and this event type. Vera's Wave-4 #13b
    // parallel-dispatch-divergence pipeline reconciles
    // LegacyFanoutShadowed against BusDispatched during Phase 1.
    type: "LegacyFanoutShadowed",
    class: "runtime",
    payloadSchema: legacyFanoutShadowedPayloadSchema,
    issuer: "substrate",
    subscribers: ["Atlas", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-01"],
    // Phase-1 transitional event; drops out at A22 Phase 2. Runtime tier.
    retention: RETENTION_RUNTIME_1Y,
    source:
      "Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md §3.1; D-A22-RETIRE-LEGACY Phase 1",
  },
];

// ---------------------------------------------------------------------------
// Goal-loop planning-trace event types
//
// Three new planning-trace event shapes emitted at every goal-loop iteration.
// Spec: Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.3.
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
//   - AgentGoalEvaluated — always emitted; audit start of each iteration.
//   - AgentGoalSelected  — emitted when the deriver selects a goal (P2 citations).
//   - AgentGoalDeferred  — emitted when no action is justified (safe default).
// ---------------------------------------------------------------------------

export const GOAL_LOOP_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "AgentGoalEvaluated",
    class: "runtime",
    payloadSchema: agentGoalEvaluatedPayloadSchema,
    issuer: "Atlas", // goal-loop runner is an Atlas substrate component
    subscribers: ["Vera", "Atlas"],
    replay: "append-only-audit",
    citationsHint: ["D-AGENT-AUTONOMY-OPERATIONAL", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "platform/agent-runtime/goal-loop.ts; D-AGENT-AUTONOMY-OPERATIONAL Slice 3; Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.3",
  },
  {
    type: "AgentGoalSelected",
    class: "runtime",
    payloadSchema: agentGoalSelectedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Vera", "Atlas", "Anya"],
    replay: "append-only-audit",
    citationsHint: ["D-AGENT-AUTONOMY-OPERATIONAL", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "platform/agent-runtime/goal-loop.ts; D-AGENT-AUTONOMY-OPERATIONAL Slice 3; Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.3",
  },
  {
    type: "AgentGoalDeferred",
    class: "runtime",
    payloadSchema: agentGoalDeferredPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Vera", "Atlas"],
    replay: "append-only-audit",
    citationsHint: ["D-AGENT-AUTONOMY-OPERATIONAL", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "platform/agent-runtime/goal-loop.ts; D-AGENT-AUTONOMY-OPERATIONAL Slice 3; Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.3",
  },
];

