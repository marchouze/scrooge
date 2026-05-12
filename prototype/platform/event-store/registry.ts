// platform/event-store/registry.ts
//
// A1 — Event-type registry.
//
// The single canonical authoring location for every event type the
// substrate emits or accepts. Closes the gap from A0 where event-type
// metadata (issuer, subscribers, replay rule, citation hint) lived only
// in `Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md` as
// prose. The freeze is the spec; this is the runtime substrate.
//
// What it does:
//   - Names every event type in one place.
//   - Holds the typed payload schema where one exists (today: 4 typed
//     events from event-types.ts; the rest are "envelope-only" and will
//     gain typed schemas as their producers wire up — see A0 §11 "What
//     this freeze does *not* do" — Zod schemas land per type as the
//     consumer needs the contract).
//   - Records the issuer, subscriber agents, replay-fold rule, and
//     citation-set hint per type. Atlas's permission-policy generator
//     (A2 work) will publish per-agent allow-lists from this matrix.
//   - Provides `validatePayload(type, payload)` that the EventStore's
//     append path calls to enforce the typed contract at the boundary.
//   - Validation is fail-open for unknown types (keeps build-phase
//     forward compat); fail-closed for known types whose schema rejects
//     the payload (loud, immediate).
//
// What it does NOT do (deferred):
//   - Cross-language schema export (Python/Java consumers don't exist).
//   - Schema-version migration runtime — A0 §8 says corrections land as
//     `…Corrected` events; this registry doesn't yet enumerate the
//     `…Corrected` shapes.
//   - Permission-policy publication — A2.
//
// Author: Atlas

import type { z } from "zod";

import {
  beneficialOwnerChainAssertedPayloadSchema,
  partyAttributeChangedPayloadSchema,
  partyClassifiedPayloadSchema,
  partyDeactivatedPayloadSchema,
  partyDeclassifiedPayloadSchema,
  partyRegisteredPayloadSchema,
  partyRelationshipAssertedPayloadSchema,
  partyRelationshipChangedPayloadSchema,
  partyRelationshipRevokedPayloadSchema,
  partyScreeningCompletedPayloadSchema,
} from "../../domains/party";
import {
  equityCorporateActionAppliedPayloadSchema,
  equitySettlementInstructedPayloadSchema,
  equityTradeBookedPayloadSchema,
} from "../markets/cdm/equity";
import {
  fxSettlementInstructedPayloadSchema,
  fxTradeExecutedPayloadSchema,
} from "../markets/cdm/fx";
import {
  accountingPeriodClosedPayloadSchema,
  accountingPeriodOpenedPayloadSchema,
  agentBriefIssuedPayloadSchema,
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
  backtestBreachDisposedPayloadSchema,
  backtestRequestedPayloadSchema,
  backtestRunPayloadSchema,
  bankAccountClosedPayloadSchema,
  bankAccountConfiguredPayloadSchema,
  bankAccountOpenedPayloadSchema,
  briefSupersededPayloadSchema,
  busDispatchedPayloadSchema,
  counterpartyEligibilityBreachedPayloadSchema,
  counterpartyEligibilityRevalidatedPayloadSchema,
  counterpartyEligibilityScreenedPayloadSchema,
  decisionCommentPayloadSchema,
  decisionRequestedPayloadSchema,
  documentRegisteredPayloadSchema,
  feedbackPayloadSchema,
  gatewayCheckCompletedPayloadSchema,
  gatewayCheckRequestedPayloadSchema,
  identityKeyRotatedPayloadSchema,
  intraGroupArrangementSignedPayloadSchema,
  legacyFanoutShadowedPayloadSchema,
  legalEntityChangedPayloadSchema,
  legalEntityRegisteredPayloadSchema,
  methodologyChangeRequestedPayloadSchema,
  modelDriftDetectedPayloadSchema,
  modelSubmittedPayloadSchema,
  modelTierClassifiedPayloadSchema,
  modelValidationApprovedPayloadSchema,
  modelValidationWithheldPayloadSchema,
  orderApprovedAtGatewayPayloadSchema,
  orderProposedPayloadSchema,
  orderRejectedAtGatewayPayloadSchema,
  permissionPolicyPublishedPayloadSchema,
  preTradeLimitChangedPayloadSchema,
  productApprovedPayloadSchema,
  productConceptualisedPayloadSchema,
  productDimensionAttestedPayloadSchema,
  productDueDiligenceCompletedPayloadSchema,
  productDueDiligenceWithheldPayloadSchema,
  productLaunchedPayloadSchema,
  productPostImplementationReviewCompletedPayloadSchema,
  productProposalRegisteredPayloadSchema,
  productRetiredPayloadSchema,
  productReviewCompletedPayloadSchema,
  productVersionPublishedPayloadSchema,
  productWithheldPayloadSchema,
  productionUseRequestedPayloadSchema,
  rasLineCalibratedPayloadSchema,
  recordFiledPayloadSchema,
  riskRaisedPayloadSchema,
  scheduledTriggerPayloadSchema,
  substrateAgentRunCompletedPayloadSchema,
  substrateAgentRunFailedPayloadSchema,
  substrateAgentRunStartedPayloadSchema,
  substrateAlertPayloadSchema,
  switchTestActivatedPayloadSchema,
  switchTestEndedPayloadSchema,
  switchTestReportPayloadSchema,
  trialBalanceSnapshottedPayloadSchema,
  validationFindingClosedPayloadSchema,
  validationFindingRaisedPayloadSchema,
  validationMethodologyPublishedPayloadSchema,
  workstreamRegisteredPayloadSchema,
} from "./event-types";
import { cdmBindingsRegeneratedPayloadSchema } from "./event-types-cdm";
import {
  accountingReadinessSnapshotPayloadSchema,
  agentOpsReadinessSnapshotPayloadSchema,
  mlroAttestationPayloadSchema,
} from "./event-types-readiness-snapshots";

/**
 * Archival-tier policy per event type. Mirrors §4.2 of the event-store
 * scaling design (PR #38; Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md):
 *
 *   - "hot-only"        — never tiers down. Reserved for short-lived
 *                         operational events kept entirely in the hot
 *                         path; not used at v1 (every type has at least
 *                         a Cool target by Q2 of D-EVENT-STORE-SCALING).
 *   - "hot-cool"        — hot for 90 days then Cool indefinitely. Used
 *                         for substrate-runtime events whose retention
 *                         floor is short and whose cold-restore needs
 *                         do not justify Archive's restore latency.
 *   - "hot-cool-archive" — hot 90 days, Cool 90 days, Archive thereafter.
 *                         Default for regulated retention; matches the
 *                         regulator-request horizons specified in §3.4
 *                         and the Q2-resolution of D-EVENT-STORE-SCALING.
 *
 * Local build-phase substrate stores everything in one SQLite table —
 * the tier is metadata only today; the cloud lift (D-EVENT-STORE-SCALING
 * Slice 8 / M8) reads this field to drive Blob Storage tier transitions.
 */
export type ArchivalTier = "hot-only" | "hot-cool" | "hot-cool-archive";

/**
 * Per-event-type retention metadata. Authority: D-EVENT-STORE-SCALING
 * (CEO approved 2026-05-10) Slice 1; design brief
 * Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5.
 *
 * Every registered event type carries this field. The retention floor
 * is a *minimum* — the bank's Principle 1 default is to retain the
 * append-only log indefinitely; compaction (§3.4) reduces hot-storage
 * footprint without deleting the underlying log. Deletion only occurs
 * where a citation requires it (e.g. POPIA s.14 minimum-necessary for
 * personal information once the lawful basis lapses).
 *
 * The `citationRef` resolves into the obligations register
 * (Regulations/_obligations-register.md) — Vera's planned Wave-4 #14
 * recon (`retention-citation-coverage`) asserts every value here is a
 * live URN. As of v1.12 of the obligations register
 * (D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 follow-on, 2026-05-10),
 * every retention class below carries a concrete URN — the four
 * `[register: route to Mira]` markers introduced under
 * D-EVENT-STORE-SCALING Slice 1 are closed (`ORG-GV-21`,
 * `ORG-MK-15`, `ORG-RM-01`, plus the M2-fixture
 * `ORG-MK-16` JSE Debt Listing Rules row). The recon may now
 * fail-closed on any future regression to a marker form.
 */
export interface RetentionMetadata {
  /** Minimum retention horizon in years (regulator-mandated floor). */
  readonly minimumYears: number;
  /** Archival-tier policy for cold storage. */
  readonly archivalTier: ArchivalTier;
  /**
   * Obligations-register URN (or `[register: route to Mira — ...]`
   * marker pending citation population). Resolved by Vera's Wave-4 #14
   * recon once Mira lands the JSE-Equities-Rules / Companies-Act /
   * BCBS-239 / Records-Management-Policy rows.
   */
  readonly citationRef: string;
}

/**
 * Pre-canned retention classes. Mirrors the §5 retention table of the
 * design brief — every event type maps onto one of these. Local
 * helpers keep the per-row authoring noise low while the structured
 * shape stays uniform across ~50 types.
 */
const RETENTION_BANKING_5Y: RetentionMetadata = {
  minimumYears: 5,
  archivalTier: "hot-cool-archive",
  citationRef: "ORG-CS3-009", // SARB CS 3/2018 §12 — records ≥5y, tamper-evident
};

const RETENTION_FIC_5Y: RetentionMetadata = {
  minimumYears: 5,
  archivalTier: "hot-cool-archive",
  citationRef: "ORG-FC-05", // FIC Act 38/2001 s.22
};

const RETENTION_ACCOUNTING_7Y: RetentionMetadata = {
  minimumYears: 7,
  archivalTier: "hot-cool-archive",
  citationRef: "COMPANIES-ACT-71-2008-S24", // accounting-records retention
};

const RETENTION_GOVERNANCE_7Y: RetentionMetadata = {
  // Audit / governance / decision events. Companies Act director-decision
  // retention (Companies Act ss.24 + 66 + 71 + 73 + 75 read together with
  // Banks Act s.60) + BCBS 239 audit-trail expectations (Principles I,
  // III, IX, XIV). Register row `ORG-GV-21` (Domain F) — landed under
  // v1.12 of `Regulations/_obligations-register.md` per
  // D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 follow-on Mira route.
  minimumYears: 7,
  archivalTier: "hot-cool-archive",
  citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
};

const RETENTION_JSE_TRADE_7Y: RetentionMetadata = {
  // JSE Equities Rules — trade-record retention sub-rules (the JSE
  // Equities Rules' record-keeping section imposes a 7-year retention
  // floor on trading-member books and records; cross-reads with FMA
  // s.5 exchange-licence-conditions). Register row `ORG-MK-15`
  // (Domain J) — landed under v1.12 of
  // `Regulations/_obligations-register.md` per
  // D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 follow-on Mira route.
  minimumYears: 7,
  archivalTier: "hot-cool-archive",
  citationRef: "urn:obligation:bank:mk:jse-equities-rules-retention:v1",
};

const RETENTION_RUNTIME_1Y: RetentionMetadata = {
  // Operational substrate events. Internal-policy retention via the
  // bank's Records Management Policy (planned — Owen primary, Devon
  // secondary, Board approval per `Owner Inbox/2026-05-06_policy-register.md`
  // line 111). Register row `ORG-RM-01` (Domain RM — internal-policy
  // citation handles) — landed under v1.12 of
  // `Regulations/_obligations-register.md` per
  // D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 3 follow-on Mira route.
  // The URN handle is a citation seat: it resolves to the policy
  // register entry today; once Owen authors policy text, the URN's
  // citation chain expands to name precise policy sections (Vera
  // Wave-4 records-management-policy-authoring-gap finding tracks the
  // gap).
  minimumYears: 1,
  archivalTier: "hot-cool",
  citationRef: "urn:policy:bank:records-management:operational-substrate-retention:v1",
};

/**
 * Default-when-unknown retention. Conservative class — Banks Act +
 * CS 3/2018 §12 5-year floor; full-tier-down. Any row using this
 * default is an explicit "use the strongest applicable floor pending
 * classification" and is a Mira follow-on to refine.
 *
 * Exported so future event-type rows that ship before the contributor
 * has classified the retention class can drop in this default safely;
 * the Vera Wave-4 #14 retention-citation-coverage recon then surfaces
 * them as findings to refine. Today (Slice 1 exit) every registered
 * row carries a classified retention — no row uses this default.
 */
export const RETENTION_CONSERVATIVE_DEFAULT: RetentionMetadata = {
  minimumYears: 5,
  archivalTier: "hot-cool-archive",
  citationRef: "ORG-CS3-009",
};

/**
 * Per-event-type snapshot cadence. Authority: D-EVENT-STORE-SCALING
 * (CEO-approved 2026-05-10) Slice 2; Q1 resolution — *hybrid: every K
 * events OR every T time, tunable per stream*. Design brief
 * `Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md` §4.2 +
 * §7 Q1.
 *
 * Two thresholds; consumers that call
 * `eventStore.shouldSnapshot({ streamKey, eventType })` snapshot when
 * **either** is met (the scaling design rationale: K-only starves
 * low-velocity streams of fresh snapshots; T-only burns RU/IO on
 * high-velocity streams for redundant snapshots).
 *
 * The store does *not* auto-snapshot inside `append()` — Slice 3
 * consumers own the projection state being snapshotted and call
 * `snapshot()` after a fold update. The cadence rule is a hint; the
 * consumer remains free to snapshot more / less aggressively.
 *
 * The field is **optional** on `EventTypeMetadata`. Rows without an
 * explicit cadence resolve to `DEFAULT_SNAPSHOT_CADENCE` (1000 events,
 * 24 hours). A Mira follow-on (Wave-5; routed via Slice 1 retention
 * uplift) populates per-event-type cadence values where retention or
 * read-amplification characteristics warrant tighter or looser
 * cadence.
 */
export interface SnapshotCadence {
  /** Snapshot when ≥ this many events have been appended since the
   *  last snapshot for the affected stream. */
  readonly everyKEvents: number;
  /** Snapshot when ≥ this many seconds have elapsed since the last
   *  snapshot. */
  readonly everyTSeconds: number;
}

/**
 * Default cadence — Q1 of the design brief: 1000 events / 1 hour. The
 * scaling brief's §4.2 example (K=1000) is the events-floor; T = 1
 * hour is the time-floor for low-velocity streams. Per-event-type
 * tuning lands as Mira's follow-on classifies high-velocity types
 * (e.g. `MarkToMarketObserved` at K=10,000) and low-velocity types
 * (e.g. `AgentRegistered` at K=100). The store falls back here for
 * any type lacking a `cadence` field, including unregistered types.
 */
export const DEFAULT_SNAPSHOT_CADENCE: SnapshotCadence = {
  everyKEvents: 1000,
  everyTSeconds: 60 * 60, // 1 hour
};

/**
 * Replay-fold rule the substrate's projections obey for this event type.
 * Mirrors A0 freeze §6 ("folding rules").
 */
export type ReplayFold =
  /** Once present, fixes the projection; later events on the same subject
   * are recorded but don't change state. e.g. TradeMatured. */
  | "idempotent-terminal"
  /** Latest event with the same key supersedes earlier values; replay at
   * as-of < latest yields the earlier value. e.g. MarkToMarketObserved. */
  | "latest-wins-per-key"
  /** Projection accumulates the full sequence; value at as-of is the
   * fold of all events ≤ as-of. e.g. Reset, BarrierObservation. */
  | "cumulative-fold"
  /** Open-until-paired; projections track open/closed state. e.g.
   * AgentEscalation ↔ AgentEscalationDecided. */
  | "pair-coupled"
  /** Append-only audit observation; projections aggregate but don't
   * compute current-state. e.g. RiskRaised, AuditFinding. */
  | "append-only-audit";

/**
 * Lifecycle status for a registered event type.
 *
 *   - "active"     — the current canonical type; producers should emit it.
 *   - "deprecated" — superseded by a newer type (see `supersededBy`); the
 *                    append path still accepts the type for backward compat
 *                    but no new code should emit it. Vera's
 *                    `event-type-registry-coverage` recon asserts that no
 *                    new `eventStore.append` call sites reference a
 *                    deprecated type. Authority: D-PARTY-REGISTER (2026-05-11).
 */
export type EventTypeStatus = "active" | "deprecated";

export interface EventTypeMetadata {
  /** Canonical type name. Matches the `event.type` literal at append. */
  readonly type: string;
  /** Class — agent-runtime substrate or markets lifecycle. Mirrors A0 §4 / §5. */
  readonly class: "runtime" | "markets" | "governance" | "audit";
  /**
   * Lifecycle status. Defaults to `"active"` when absent (all rows authored
   * before D-PARTY-REGISTER PR 4 omit this field; the `lookupEventType`
   * helper normalises the absence to `"active"` so callers may always
   * compare `status === "deprecated"` without an undefined guard).
   */
  readonly status?: EventTypeStatus;
  /**
   * The event type that supersedes this one. Set when `status === "deprecated"`.
   * Carries the canonical type name of the replacement; callers and producers
   * should migrate to that type. Omit for active rows.
   */
  readonly supersededBy?: string;
  /**
   * Zod schema for the payload, when one exists. When undefined the
   * append path validates only the envelope (event_id / type / as_of /
   * entity / actor / citations / payload-as-Record<string,unknown>) and
   * waits for the producer to land its typed schema.
   */
  readonly payloadSchema?: z.ZodType<Record<string, unknown>>;
  /**
   * Who emits this event. "any-agent" means any registered agent may
   * emit it (e.g. AgentEscalation). Specific agent names match the
   * /Team/<Name>.md persona file. "substrate" means the runtime emits
   * it without an agent in the loop (e.g. ScheduledTrigger).
   */
  readonly issuer: "any-agent" | "substrate" | string;
  /**
   * Agents (and "external" / "audit") that read this event type. Used by
   * Atlas's permission-policy generator (A2) to publish event-subscribe
   * allow-lists, and by Vera's audit pipelines to know what to expect.
   */
  readonly subscribers: readonly string[];
  /** Replay-fold rule this type's payload obeys (A0 §6). */
  readonly replay: ReplayFold;
  /**
   * Per-type retention floor + archival-tier policy. Authority:
   * D-EVENT-STORE-SCALING (CEO approved 2026-05-10) Slice 1. Required
   * non-null on every row — conservative-default backfill is
   * `RETENTION_CONSERVATIVE_DEFAULT` and is a Mira follow-on to refine.
   */
  readonly retention: RetentionMetadata;
  /**
   * Per-type snapshot cadence. Authority: D-EVENT-STORE-SCALING
   * (CEO-approved 2026-05-10) Slice 2 / Q1 resolution. **Optional** —
   * unset rows resolve to `DEFAULT_SNAPSHOT_CADENCE` at lookup time.
   * Mira (Compliance / RegTech engineer) follow-on populates per-type
   * cadence values where retention / read-amplification justify
   * tighter or looser thresholds; until then, every type rides the
   * default.
   */
  readonly cadence?: SnapshotCadence;
  /**
   * Citation-set hint — a starter list of obligation URNs / governance
   * tokens the producer is expected to cite. Not enforced by this
   * registry (the P2 gate is content-of-citations agnostic; it just
   * requires non-empty); used as a documentation aid and as input to
   * Mira's URN-coverage recon.
   */
  readonly citationsHint?: readonly string[];
  /** Source-spec reference (A0 freeze entry, persona spec section, etc.). */
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Registry — every event type the substrate currently knows about.
//
// Adding a new type: append a row here AND, if a payload schema exists,
// import it from the appropriate _schemas/ module. Vera's planned
// agent-spec-integrity recon (Wave-4 #10) will assert the registry stays
// in sync with each persona's §11 (Outputs) declared event types.
// ---------------------------------------------------------------------------

const RUNTIME_EVENT_TYPES: readonly EventTypeMetadata[] = [
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

// Model-registry event types. The skeleton lives in
// `platform/model-registry/registry.ts`; co-curated by Rohan (submits)
// and Nadia (validates). See `Team/Nadia.md` §11 / §12 / §15 for the
// independence boundary; `Team/Rohan.md` §11 for the model-builder side.
const MODEL_REGISTRY_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "ModelSubmitted",
    class: "runtime",
    payloadSchema: modelSubmittedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7"],
    // Model-risk lineage events: governance retention 7y per
    // SR 11-7 / SS 1/23 + Companies Act decision-trail norms.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §11; Team/Rohan.md §11; platform/model-registry/registry.ts",
  },
  {
    type: "ModelTierClassified",
    class: "runtime",
    payloadSchema: modelTierClassifiedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ModelValidationApproved",
    class: "runtime",
    payloadSchema: modelValidationApprovedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera", "Camille"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ModelValidationWithheld",
    class: "runtime",
    payloadSchema: modelValidationWithheldPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ValidationFindingRaised",
    class: "runtime",
    payloadSchema: validationFindingRaisedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "cumulative-fold",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ValidationFindingClosed",
    class: "runtime",
    payloadSchema: validationFindingClosedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  // Backtest family — gates Rohan's S7-Targeted #4 backtest harness.
  // Co-evolved with Nadia's validation-event family; BacktestRun is the
  // input to BacktestBreachDisposed.
  {
    type: "BacktestRequested",
    class: "runtime",
    payloadSchema: backtestRequestedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["SR-11-7", "SS-1-23", "BANKS-ACT-94-1990"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md §4.1; Team/Rohan.md §11",
  },
  {
    type: "BacktestRun",
    class: "runtime",
    payloadSchema: backtestRunPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["SR-11-7", "SS-1-23", "BCBS-VAR-BACKTEST-1996"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md §4.2; Team/Rohan.md §11",
  },
  // Validation methodology family — gates Nadia's S7-Targeted #3
  // methodology library. Per Nadia §5.3 + §6 #3/#5 and Team/Nadia.md §11.
  {
    type: "ValidationMethodologyPublished",
    class: "runtime",
    payloadSchema: validationMethodologyPublishedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["SR-11-7", "SS-1-23", "RAS-B7"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md §5.3; Team/Nadia.md §11",
  },
  {
    type: "BacktestBreachDisposed",
    class: "runtime",
    payloadSchema: backtestBreachDisposedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md §7 Q3+Q5; Team/Nadia.md §9, §11",
  },
  {
    type: "ModelDriftDetected",
    class: "runtime",
    payloadSchema: modelDriftDetectedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Nadia", "Rohan", "Helena", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §11",
  },
  {
    type: "ProductionUseRequested",
    class: "runtime",
    payloadSchema: productionUseRequestedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Nadia", "Helena", "Vera", "Kai"],
    replay: "latest-wins-per-key",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §11, §16",
  },
  {
    type: "MethodologyChangeRequested",
    class: "runtime",
    payloadSchema: methodologyChangeRequestedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §11",
  },
];

// Markets lifecycle event types from A0 §5. Today only TradeExecuted
// is registered; the remaining 23 land as Kai's M4 / M5 work and the
// other product families (M1 listed equity, M2 SAGB, M3 corporate
// bonds, M5 IRS) build out.
//
// Per-product variants of these payloads live under
// `platform/markets/cdm/events/` (e.g. TradeExecuted-FxSpot.ts).
// `payloadSchema` here is left undefined because the registry holds
// one schema per type and these events are polymorphic on the
// embedded `contract` shape — the per-product variant validates at
// the factory, and Vera's planned cross-validator (Wave-4) will
// reconcile the registry view to the per-variant schemas.
const MARKETS_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "TradeExecuted",
    class: "markets",
    issuer: "any-agent",
    subscribers: ["Position", "Bea", "Rohan", "Mira", "Tomas"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "ORG-FC-13"],
    // JSE trade record — 7y per JSE Equities Rules retention norms.
    retention: RETENTION_JSE_TRADE_7Y,
    source: "A0 freeze §5 #2; per-product variants in platform/markets/cdm/events/",
  },
  // Pre-trade gateway family — gates Saskia+Kai's S7-Targeted #5 envelope.
  // Per `Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md`
  // §3 + §5.1. Each check handler is separately-registered; permission-policy
  // scopes each handler's event-stream access (Principle 4).
  {
    type: "OrderProposed",
    class: "markets",
    payloadSchema: orderProposedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Kai", "Saskia", "Mira", "Rohan", "Eitan", "Imani", "Senna", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "FIC-ACT-38-2001"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3; Team/Kai.md §11",
  },
  {
    type: "GatewayCheckRequested",
    class: "markets",
    payloadSchema: gatewayCheckRequestedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Mira", "Rohan", "Eitan", "Imani", "Senna", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5"],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3, §5.1",
  },
  {
    type: "GatewayCheckCompleted",
    class: "markets",
    payloadSchema: gatewayCheckCompletedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Kai", "Saskia", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5"],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3, §5.1",
  },
  {
    type: "OrderApprovedAtGateway",
    class: "markets",
    payloadSchema: orderApprovedAtGatewayPayloadSchema,
    issuer: "Kai",
    subscribers: ["Saskia", "Bea", "Vera", "dashboard"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3, §5.1",
  },
  {
    type: "OrderRejectedAtGateway",
    class: "markets",
    payloadSchema: orderRejectedAtGatewayPayloadSchema,
    issuer: "Kai",
    subscribers: ["Saskia", "Mira", "Niko", "Imani", "Vera", "dashboard"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "FIC-ACT-38-2001"],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3, §5.1",
  },
  {
    type: "PreTradeLimitChanged",
    class: "markets",
    payloadSchema: preTradeLimitChangedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Kai", "Saskia", "Helena", "Rohan", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "RAS-B7"],
    // Pre-trade-limit changes are governance decisions over the
    // trading franchise — Companies Act / RAS retention 7y.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Kai.md §11, §15",
  },
  // CRM lifecycle — counterparty institutional-eligibility screening
  // (Niko, v0). D-FSP-LICENCE-NECESSITY confirm-A binds Posture A:
  // every counterparty must clear an institutional-eligibility test
  // anchoring FAIS scope-of-services to institutional product set.
  // Citation hint references Mira's PR #70 FAIS Posture A URN cluster;
  // sub-section refs of FAIS s.45 carry [citation: TBC pending counsel].
  {
    type: "CounterpartyEligibilityScreened",
    class: "markets",
    payloadSchema: counterpartyEligibilityScreenedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Saskia", "Zara", "Imani", "Mira", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: [
      "FAIS-ACT-37-2002",
      "urn:obligation:bank:fais:general-code-of-conduct:v1",
      "ORG-CD-01",
      "ORG-CD-04",
    ],
    // Counterparty CDD-equivalent records: 5y per FIC Act s.22.
    retention: RETENTION_FIC_5Y,
    source:
      "Procedures/by-policy/counterparty-institutional-eligibility-screening.md (PROC-CRM-CIE-01); Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md (PR #62)",
  },
  {
    type: "CounterpartyEligibilityRevalidated",
    class: "markets",
    payloadSchema: counterpartyEligibilityRevalidatedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Saskia", "Zara", "Imani", "Mira", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: [
      "FAIS-ACT-37-2002",
      "urn:obligation:bank:fais:general-code-of-conduct:v1",
      "ORG-CD-01",
      "ORG-CD-04",
    ],
    retention: RETENTION_FIC_5Y,
    source:
      "Procedures/by-policy/counterparty-institutional-eligibility-screening.md (PROC-CRM-CIE-01)",
  },
  {
    type: "CounterpartyEligibilityBreached",
    class: "markets",
    payloadSchema: counterpartyEligibilityBreachedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Saskia", "Zara", "Imani", "Mira", "Kai", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "FAIS-ACT-37-2002",
      "urn:obligation:bank:fais:general-code-of-conduct:v1",
      "ORG-CD-01",
      "ORG-CD-04",
    ],
    retention: RETENTION_FIC_5Y,
    source:
      "Procedures/by-policy/counterparty-institutional-eligibility-screening.md (PROC-CRM-CIE-01)",
  },
  // Switch-test event family — opens/closes/reports the quarterly +
  // triggered switch-test window during which a configurable fraction
  // of `primary`-tagged FX traffic is routed via the backup
  // correspondent. Per Devon (COO, governance) + Tomas (Operations &
  // payments engineer) named-correspondent-pair proposal §4 (PR #58)
  // and D-FX-CORRESPONDENT-PAIR-NAMING (CEO approved 2026-05-09; PR #59).
  {
    type: "SwitchTestActivated",
    class: "markets",
    payloadSchema: switchTestActivatedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Saskia", "Devon", "Helena", "Rohan", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["BCBS-239-2013", "GOV-FRAMEWORK-CEO-RESERVED"],
    // Operational-resilience attestations — governance retention 7y.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md §4 (PR #58)",
  },
  {
    type: "SwitchTestEnded",
    class: "markets",
    payloadSchema: switchTestEndedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Saskia", "Devon", "Helena", "Rohan", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["BCBS-239-2013"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md §4 (PR #58)",
  },
  {
    type: "SwitchTestReport",
    class: "markets",
    payloadSchema: switchTestReportPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Saskia", "Devon", "Helena", "Rohan", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["BCBS-239-2013", "RAS-B7"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md §4 (PR #58)",
  },
  // M1 IFRS-classification + sub-ledger family — emitted by Bea's
  // m1-ifrs-classification-rules handler under D-MARKETS-SCHEMA-FOUNDATION
  // (CEO approved 2026-05-07). `IfrsClassificationApplied` records the
  // IFRS-9 / IFRS-13 / IAS-21 dispatch outcome per equity trade
  // (category, hierarchy level, FX flag, business model, SPPI result);
  // `SubLedgerPostingEmitted` records the trade-date / settlement-date
  // / dividend-accrual posting derived from the classification. Both
  // are append-only-audit: the accounting record is forensic — a
  // re-classification or correction posts a new event, never an
  // overwrite (Principle 1; matches the audit-trail expectation under
  // IAS 1 / Companies Act 71/2008 s.28-30 accounting records).
  // Retention floor is 7 years (SA accounting + tax retention norm:
  // Companies Act 71/2008 s.24 record-retention period for accounting
  // records and supporting documents). Subscribers: Anya consumes for
  // GL-projection assembly; Camille (CFO) + Bea consume for the
  // close engine; Vera for the IFRS-classification recon.
  {
    type: "IfrsClassificationApplied",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Anya", "Camille", "Bea", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "IFRS-9-§4.1.1",
      "IFRS-9-§4.1.2",
      "IFRS-9-§5.7.5",
      "IFRS-13-§72-90",
      "IAS-21-§23",
      "ORG-AC-01",
      "ORG-AC-05",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    // Retention floor: ≥7 years — Companies Act 71/2008 s.24
    // (accounting-records retention) covers IFRS-classification
    // outputs as supporting accounting documents. The bank's
    // Principle-1 default retains the append-only log indefinitely;
    // the 7-year floor is the regulator-mandated minimum.
    source:
      "runtime/agents/bea-m1-ifrs-classification-rules.ts; Team Inbox/2026-05-07_brief_bea_m1-ifrs-classification-rules.md; D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5 (retention floor: Companies Act 71/2008 s.24 accounting records, ≥7y)",
  },
  {
    type: "SubLedgerPostingEmitted",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Anya", "Camille", "Bea", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "IFRS-9-§4.1.1",
      "IAS-1",
      "IAS-21-§23",
      "ORG-AC-01",
      "ORG-AC-08",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    // Retention floor: ≥7 years — Companies Act 71/2008 s.24
    // (accounting-records retention period for company financial
    // records and supporting documentation). Sub-ledger postings are
    // the accounting record; the GL projection (Anya) is a derived
    // cache. Principle-1 default keeps the log indefinitely.
    source:
      "runtime/agents/bea-m1-ifrs-classification-rules.ts; Team Inbox/2026-05-07_brief_bea_m1-ifrs-classification-rules.md; D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5 (retention floor: Companies Act 71/2008 s.24 accounting records, ≥7y)",
  },
  // M1 CDM equity events — schemas live at platform/markets/cdm/equity.ts
  // (their natural domain home); referenced from the registry to satisfy
  // F-032 event-type-registry-coverage. Issuer is `Kai` (M1 OMS / EMS
  // bookings) with the M1-tranche subscriber set already exercising the
  // payloads through `m1-projection-runtime-mapping` (Anya) and
  // `m1-ifrs-classification-rules` (Bea).
  {
    type: "EquityTradeBooked",
    class: "markets",
    payloadSchema: equityTradeBookedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Rohan", "Mira", "Tomas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M1 bindings); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  {
    type: "EquitySettlementInstructed",
    class: "markets",
    payloadSchema: equitySettlementInstructedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Tomas", "Bea", "Anya", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "STRATE-RULES", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M1 bindings); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  {
    type: "EquityCorporateActionApplied",
    class: "markets",
    payloadSchema: equityCorporateActionAppliedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Rohan", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["JSE-RULES-EQUITIES", "IFRS-9-§5.7.5", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M1 bindings); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  // M3 CDM FX events — schemas at platform/markets/cdm/fx.ts. Today
  // exercised by the FX end-to-end rehearsal scenario + dashboard widget;
  // registry rows close the F-032 surface so the typed payload contract
  // is enforced at append-time regardless of caller.
  {
    type: "FxTradeExecuted",
    class: "markets",
    payloadSchema: fxTradeExecutedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Rohan", "Tomas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["FMA-S5", "EXCON-SARB-CIRC-3-2020", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/fx.ts (Kai M3 FX bindings); scenarios/03-fx-end-to-end-rehearsal.ts; Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  {
    type: "FxSettlementInstructed",
    class: "markets",
    payloadSchema: fxSettlementInstructedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Tomas", "Bea", "Anya", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["FMA-S5", "EXCON-SARB-CIRC-3-2020", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/fx.ts (Kai M3 FX bindings); scenarios/03-fx-end-to-end-rehearsal.ts; Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  // CDM substrate — bindings-regeneration self-test, emitted by Kai's
  // m1-cdm-typescript-bindings handler after inventory + round-trip. The
  // payload records the surface inventory + self-test outcome; downstream
  // subscribers re-validate their mappings on the latest event per stream.
  {
    type: "CdmBindingsRegenerated",
    class: "markets",
    payloadSchema: cdmBindingsRegeneratedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/event-store/event-types-cdm.ts; runtime/agents/kai-m1-cdm-typescript-bindings.ts; D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07)",
  },
];

// Governance / audit / observation event types currently in flight.
// These predate A0 (already emitted by handlers); registered here for
// completeness so the registry covers what the event store actually
// contains.
const GOVERNANCE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "CeoDecision",
    class: "governance",
    issuer: "human",
    subscribers: ["Owen", "dashboard", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Procedures/by-policy/ceo-decision-review.md",
  },
  {
    type: "WorkstreamStarted",
    class: "governance",
    issuer: "any-agent",
    subscribers: ["dashboard"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Workstream lifecycle (pre-A0)",
  },
  {
    type: "WorkstreamCompleted",
    class: "governance",
    issuer: "any-agent",
    subscribers: ["dashboard"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Workstream lifecycle (pre-A0)",
  },
  // D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12).
  // Emitted once per versioned policy/charter/procedure/report registered in
  // Policies/. The document-registration recon pipeline enforces CI coverage.
  {
    type: "DocumentRegistered",
    class: "governance",
    payloadSchema: documentRegisteredPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Owen", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-POLICY-DOCUMENT-HOME", "GOV-FRAMEWORK-CEO-RESERVED"],
    // Policy documents must be retained for the audit lifecycle: minimum 7y
    // matches the Companies Act / BCBS-239 governance record floor.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "prototype/platform/recon/document-registration.ts",
  },
];

const AUDIT_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "AuditFinding",
    class: "audit",
    issuer: "any-agent",
    subscribers: ["Thandiwe", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Vera continuous-controls programme; Mira citation-gate",
  },
  {
    type: "ReconResult",
    class: "audit",
    issuer: "Vera",
    subscribers: ["Thandiwe", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/recon/types.ts",
  },
  {
    type: "CitationGatePassed",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Thandiwe", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["P2-CITATION-DISCIPLINE", "FIC-ACT-38-2001"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/mira-citation-gate.ts",
  },
  {
    type: "CitationGateFailed",
    class: "audit",
    issuer: "Mira",
    subscribers: ["Thandiwe", "Vera", "Atlas"],
    replay: "append-only-audit",
    citationsHint: ["P2-CITATION-DISCIPLINE", "FIC-ACT-38-2001"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/mira-citation-gate.ts",
  },
  {
    type: "SubstrateStateSnapshot",
    class: "runtime",
    issuer: "Atlas",
    subscribers: ["Devon", "dashboard", "Anya"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    // Substrate-state is operational telemetry — runtime tier.
    retention: RETENTION_RUNTIME_1Y,
    source: "runtime/agents/atlas-substrate-state.ts",
  },
  {
    type: "DashboardProjectionRefreshed",
    class: "audit",
    issuer: "Anya",
    subscribers: ["Atlas", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_RUNTIME_1Y,
    source: "runtime/agents/anya-projection-refresh.ts",
  },
  {
    type: "DataProjectionSnapshot",
    class: "audit",
    issuer: "Anya",
    subscribers: ["Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_RUNTIME_1Y,
    source: "runtime/agents/anya-projection-drift.ts",
  },
  {
    type: "DecisionComment",
    class: "governance",
    payloadSchema: decisionCommentPayloadSchema,
    issuer: "any-agent",
    subscribers: ["dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "dashboard decision-comments thread (Phase 1 slice 2)",
  },
  {
    type: "GovernanceCyclePrep",
    class: "governance",
    issuer: "Owen",
    subscribers: ["dashboard"],
    replay: "append-only-audit",
    citationsHint: ["COMPANIES-ACT-71-2008", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/owen-governance-cycle-prep.ts",
  },
  {
    type: "ObligationsRegisterSnapshot",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Zara", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["FIC-ACT-38-2001", "FAIS-ACT-37-2002", "BANKS-ACT-94-1990"],
    // Obligations register is FIC-record-bind (5y) but treated as
    // governance retention 7y for audit-trail integrity.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/mira-obligations-snapshot.ts",
  },
  // M1 obligations-register family — emitted by Mira's
  // m1-regulator-citation-urns handler under D-MARKETS-SCHEMA-FOUNDATION
  // (CEO approved 2026-05-07). Each `ObligationRegistered` records a
  // single regulator-citation URN with the upstream decision-event id;
  // `M1CitationTrancheRegistered` is the per-run summary covering the
  // catalogue (count registered / skipped). Both are append-only-audit:
  // the obligations register is canonical-source, never latest-wins —
  // a re-registration with corrected metadata produces a new event, not
  // an overwrite. Retention floor is 5 years (CS 3/2018 §12 + FIC Act
  // s.22 record-keeping); the bank's Principle 1 default retains the
  // append-only log indefinitely. No emit-side subscribers — Mira is
  // the issuer; Vera's URN-coverage recon (Wave-4) and Anya's
  // dashboard projections consume the stream.
  {
    type: "ObligationRegistered",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Vera", "Anya", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "P2-CITATION-DISCIPLINE",
      "ORG-FC-01",
      "ORG-CS3-009",
      "ORG-FC-05",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_BANKING_5Y,
    // Retention floor: ≥5 years per ORG-CS3-009 (SARB CS 3/2018 §12 —
    // Records ≥5y, tamper-evident) and ORG-FC-05 (FIC Act s.22 —
    // 5-year record-keeping on CDD/EDD/transactions/STRs).
    source:
      "runtime/agents/mira-m1-regulator-citation-urns.ts; Team Inbox/2026-05-07_brief_mira_m1-regulator-citation-urns.md; D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5 (retention floor: ORG-CS3-009 + ORG-FC-05, ≥5y)",
  },
  {
    type: "M1CitationTrancheRegistered",
    class: "governance",
    issuer: "Mira",
    subscribers: ["Vera", "Anya", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "P2-CITATION-DISCIPLINE",
      "ORG-FC-01",
      "ORG-CS3-009",
      "ORG-FC-05",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_BANKING_5Y,
    // Retention floor: ≥5 years per ORG-CS3-009 + ORG-FC-05 (mirrors
    // ObligationRegistered — the tranche summary is the audit anchor
    // for the per-run registration cohort).
    source:
      "runtime/agents/mira-m1-regulator-citation-urns.ts; Team Inbox/2026-05-07_brief_mira_m1-regulator-citation-urns.md; D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5 (retention floor: ORG-CS3-009 + ORG-FC-05, ≥5y)",
  },
  {
    type: "SecuritySubstrateSnapshot",
    class: "audit",
    issuer: "Senna",
    subscribers: ["Rashida", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["JOINT-STANDARD-2-2024", "POPIA-S19-22"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/senna-security-substrate-state.ts",
  },
  {
    type: "InboxHygieneSweep",
    class: "audit",
    issuer: "Scrooge",
    subscribers: ["dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    // Inbox-hygiene sweeps are operational housekeeping — runtime tier.
    retention: RETENTION_RUNTIME_1Y,
    source: "runtime/agents/scrooge-inbox-hygiene.ts",
  },
  // M1 markets-projection family — emitted by Anya's
  // m1-projection-runtime-mapping handler. Envelope-only at v0;
  // typed payload schemas land at M2.
  {
    type: "MarketsProjectionRegistered",
    class: "audit",
    issuer: "Anya",
    subscribers: ["Bea", "Kai", "Saskia", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-RULES-EQUITIES", "ORG-AC-01", "ORG-AC-05", "GOV-FRAMEWORK-CEO-RESERVED"],
    // Markets projection registry is governance-of-projections — 7y.
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "runtime/agents/anya-m1-projection-runtime-mapping.ts; Team Inbox/2026-05-07_brief_anya_m1-projection-runtime-mapping.md",
  },
  {
    type: "MarketsProjectionRefreshed",
    class: "audit",
    issuer: "Anya",
    subscribers: ["Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["JSE-RULES-EQUITIES", "ORG-AC-05", "GOV-FRAMEWORK-CEO-RESERVED"],
    // High-cadence refresh — runtime tier.
    retention: RETENTION_RUNTIME_1Y,
    source: "runtime/agents/anya-m1-projection-runtime-mapping.ts",
  },
  // M1 security family — emitted by Senna's m1-trading-stack-threat-model handler.
  {
    type: "ThreatModelDimensionRegistered",
    class: "audit",
    issuer: "Senna",
    subscribers: ["Rashida", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "ORG-CY-03", "ORG-CY-05", "ORG-PR(IV)-06"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/senna-m1-trading-stack-threat-model.ts",
  },
  {
    type: "SecurityGateRegistered",
    class: "audit",
    issuer: "Senna",
    subscribers: ["Rashida", "Atlas", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "ORG-CY-03", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/senna-m1-trading-stack-threat-model.ts",
  },
];

// Legal-entity event family (D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER).
// Three typed events that materialise the v0 entity tree (Hoz Group +
// Hoz Bank + Hoz Securities) into the event log per Principle 1 +
// Principle 5. Substantive content: Imani (Legal-as-code engineer) +
// Owen (Company Secretary, governance). Substrate: Atlas.
const LEGAL_ENTITY_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "LegalEntityRegistered",
    class: "governance",
    // Deprecated by D-PARTY-REGISTER (CEO-approved 2026-05-11, PR 4).
    // The unified Party event family — PartyRegistered{kind: "legal-entity"} —
    // supersedes this type. Existing historical events remain in the log
    // (Principle 1 / append-only); no new emissions should use this type.
    // Backfill of historical LegalEntityRegistered events into PartyRegistered
    // events lands in D-PARTY-REGISTER PR 2 (Imani — Legal-as-code engineer).
    status: "deprecated",
    supersededBy: "PartyRegistered",
    payloadSchema: legalEntityRegisteredPayloadSchema,
    issuer: "Imani",
    subscribers: ["Owen", "Mira", "Bea", "Yael", "Helena", "Anya", "dashboard", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: [
      "COMPANIES-ACT-71-2008",
      "BANKS-ACT-94-1990",
      "FAIS-ACT-37-2002",
      "JSE-RULES",
      "GOV-FRAMEWORK-CEO-RESERVED",
      "D-PARTY-REGISTER",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md §6; Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md (PR #82); Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md (PR #85); Regulations/_legal-entity-tree.md",
  },
  {
    type: "LegalEntityChanged",
    class: "governance",
    payloadSchema: legalEntityChangedPayloadSchema,
    issuer: "Imani",
    subscribers: ["Owen", "Mira", "Bea", "Yael", "Helena", "Anya", "dashboard", "Vera"],
    replay: "cumulative-fold",
    citationsHint: ["COMPANIES-ACT-71-2008", "BANKS-ACT-94-1990", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md §6.2; Regulations/_legal-entity-tree.md",
  },
  {
    type: "IntraGroupArrangementSigned",
    class: "governance",
    payloadSchema: intraGroupArrangementSignedPayloadSchema,
    issuer: "Imani",
    subscribers: ["Owen", "Bea", "Yael", "Camille", "Mira", "Helena", "dashboard", "Vera"],
    replay: "append-only-audit",
    citationsHint: [
      "COMPANIES-ACT-71-2008-S75",
      "IAS-24",
      "BANKS-ACT-94-1990-S73",
      "OECD-TP-GUIDELINES",
    ],
    // Related-party arrangements bind accounting + Companies Act
    // record-keeping — 7y per accounting retention.
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md §2 (intra-group arrangement stubs); Regulations/_legal-entity-tree.md §2",
  },
];

// ===========================================================================
// Party event family — D-PARTY-REGISTER + D-PARTY-RELATIONSHIP-KINDS-V0
// (both CEO-approved 2026-05-11). PR 1 of D-PARTY-REGISTER ships the
// substrate only — these 10 rows close 10 of the 14 remaining F-032
// event-type registry-coverage gaps. Backfill from existing legal-entity /
// counterparty / agent events into Party events lands in PR 2 (Imani —
// Legal-as-code engineer). Until PR 2 lands, the `subscribers` arrays are
// empty (no consumer projection yet); the registry rows still register the
// types so the typed payload contract is enforced at append time.
//
// `issuer` field: today the only producer is Atlas (the substrate path —
// initial seed-loader / synthetic emit during PR 1 testing). When PR 2's
// backfill + projection lands, the issuer matrix expands:
//   - PartyRegistered{kind: "legal-entity"}  → backfilled by Imani
//   - PartyRegistered{kind: "counterparty"}  → backfilled by Imani; Niko
//                                              from licence-day (customer
//                                              onboarding paused per
//                                              buildPhaseStatus)
//   - PartyRegistered{kind: "agent"}         → backfilled by Imani / Atlas
//   - PartyRegistered{kind: "natural-person"} → Niko from licence-day;
//                                              Owen for directors / key-
//                                              individuals; Sade's HR slice
//                                              from licence-day
//   - PartyRelationship*                     → emitted by the producer of
//                                              the relationship event
//                                              (Imani for org-tree edges,
//                                              Owen for governance edges,
//                                              Atlas for agent-runtime
//                                              edges)
//
// Retention: identity-axis events are governance — Companies Act director
// & officer record retention (s.24 + s.66) + Banks Act fit-and-proper
// records + FIC Act s.22 CDD records (5y). PartyRegistered + the
// PartyRelationship* family use `RETENTION_GOVERNANCE_7Y`;
// PartyScreeningCompleted + BeneficialOwnerChainAsserted use
// `RETENTION_FIC_5Y` (FIC Act s.22 minimum); PartyDeactivated uses
// `RETENTION_GOVERNANCE_7Y` (terminal lifecycle event for governance
// records).
// ===========================================================================

const PARTY_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "PartyRegistered",
    class: "governance",
    payloadSchema: partyRegisteredPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "latest-wins-per-key",
    citationsHint: [
      "D-PARTY-REGISTER",
      "BANKS-ACT-94-1990",
      "COMPANIES-ACT-71-2008",
      "FIC-ACT-38-2001",
      "POPIA-ACT-4-2013",
      "FAIS-ACT-37-2002",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md; domains/party/types.ts; domains/party/schemas.ts",
  },
  {
    type: "PartyAttributeChanged",
    class: "governance",
    payloadSchema: partyAttributeChangedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "cumulative-fold",
    citationsHint: [
      "D-PARTY-REGISTER",
      "COMPANIES-ACT-71-2008",
      "POPIA-ACT-4-2013",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md; domains/party/schemas.ts",
  },
  {
    type: "PartyClassified",
    class: "governance",
    payloadSchema: partyClassifiedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "cumulative-fold",
    citationsHint: [
      "D-PARTY-REGISTER",
      "FIC-ACT-38-2001",
      "FAIS-ACT-37-2002",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md; domains/party/schemas.ts",
  },
  {
    type: "PartyDeclassified",
    class: "governance",
    payloadSchema: partyDeclassifiedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "pair-coupled",
    citationsHint: [
      "D-PARTY-REGISTER",
      "FIC-ACT-38-2001",
      "FAIS-ACT-37-2002",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md; domains/party/schemas.ts",
  },
  {
    type: "PartyScreeningCompleted",
    class: "governance",
    payloadSchema: partyScreeningCompletedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "append-only-audit",
    citationsHint: [
      "D-PARTY-REGISTER",
      "FIC-ACT-38-2001",
      "ORG-FC-05",
      "BANKS-ACT-94-1990",
      "FAIS-ACT-37-2002",
    ],
    // Screening evidence is a CDD record under FIC Act s.22 — 5y floor.
    retention: RETENTION_FIC_5Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md; domains/party/schemas.ts",
  },
  {
    type: "PartyRelationshipAsserted",
    class: "governance",
    payloadSchema: partyRelationshipAssertedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "latest-wins-per-key",
    citationsHint: [
      "D-PARTY-REGISTER",
      "D-PARTY-RELATIONSHIP-KINDS-V0",
      "COMPANIES-ACT-71-2008-S69",
      "FIC-ACT-38-2001-S21B",
      "FAIS-ACT-37-2002",
      "BANKS-ACT-94-1990",
      "IAS-24",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md; domains/party/schemas.ts (RELATIONSHIP_KIND_CONSTRAINTS)",
  },
  {
    type: "PartyRelationshipChanged",
    class: "governance",
    payloadSchema: partyRelationshipChangedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "cumulative-fold",
    citationsHint: [
      "D-PARTY-REGISTER",
      "D-PARTY-RELATIONSHIP-KINDS-V0",
      "COMPANIES-ACT-71-2008",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md; domains/party/schemas.ts",
  },
  {
    type: "PartyRelationshipRevoked",
    class: "governance",
    payloadSchema: partyRelationshipRevokedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "pair-coupled",
    citationsHint: [
      "D-PARTY-REGISTER",
      "D-PARTY-RELATIONSHIP-KINDS-V0",
      "COMPANIES-ACT-71-2008",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md; domains/party/schemas.ts",
  },
  {
    type: "BeneficialOwnerChainAsserted",
    class: "governance",
    payloadSchema: beneficialOwnerChainAssertedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "append-only-audit",
    citationsHint: [
      "D-PARTY-REGISTER",
      "FIC-ACT-38-2001-S21B",
      "ORG-FC-05",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    // UBO chain evidence is a FIC Act s.21B / s.22 CDD record — 5y floor.
    retention: RETENTION_FIC_5Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md; domains/party/schemas.ts (chain-shape enforcement)",
  },
  {
    type: "PartyDeactivated",
    class: "governance",
    payloadSchema: partyDeactivatedPayloadSchema,
    issuer: "Atlas",
    subscribers: [],
    replay: "idempotent-terminal",
    citationsHint: [
      "D-PARTY-REGISTER",
      "COMPANIES-ACT-71-2008",
      "POPIA-ACT-4-2013",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md; domains/party/schemas.ts",
  },
];

// Product-lifecycle event family — D-PRODUCT-CONSTRUCTION-SUBSTRATE
// (CEO approved 2026-05-10) Slice 2. Twelve events governing a Product
// from proposal through retirement (source brief §4). All twelve are
// `append-only-audit`: the Product's *current state* is a projection
// over this stream — never stored as authoritative.
//
// Per Q2 resolution: per-dimension agent emits its own
// `ProductDimensionAttested`; the orchestrator only sequences. The
// emitting agent is recorded via the envelope `actor` field, so issuer
// here is "any-agent" for ProductDimensionAttested. The other 11 are
// emitted by Saskia (franchise authority) for proposal/conceptualisation,
// the orchestrator/governance for due-diligence aggregation, and the
// CEO/BRC for approval/withholding/launch. At v1, all are scoped
// "any-agent" pending the dispatch substrate (Slice 4) that will
// publish per-event-type permission policies.
//
// Retention: governance-7y. Product-approval records are
// regulator-relevant under Banks Act Reg 39 + BCBS new-product-approval
// principles; 7y matches Companies Act director-decision retention.
const PRODUCT_LIFECYCLE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "ProductProposalRegistered",
    class: "governance",
    payloadSchema: productProposalRegisteredPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Vera", "Anya", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-MARKETS-SCHEMA-FOUNDATION", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #1; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    type: "ProductConceptualised",
    class: "governance",
    payloadSchema: productConceptualisedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Kai", "Atlas", "Vera", "Anya", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-MARKETS-SCHEMA-FOUNDATION", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #2; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    type: "ProductDueDiligenceCompleted",
    class: "governance",
    payloadSchema: productDueDiligenceCompletedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Helena", "Camille", "Zara", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #3; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    type: "ProductDueDiligenceWithheld",
    class: "governance",
    payloadSchema: productDueDiligenceWithheldPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Helena", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #4; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    // Per Q2 resolution: per-dimension agent emits its own attestation —
    // the actor envelope captures *which* agent. Per Q3: result carries
    // "design-attested" / "implementation-attested" / "failed".
    type: "ProductDimensionAttested",
    class: "governance",
    payloadSchema: productDimensionAttestedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Helena", "Camille", "Zara", "Vera", "Anya", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY", "P2-CITATION-DISCIPLINE"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #5 + §5; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (Q2 + Q3 resolutions)",
  },
  {
    type: "ProductApproved",
    class: "governance",
    payloadSchema: productApprovedPayloadSchema,
    issuer: "any-agent",
    subscribers: [
      "Saskia",
      "Owen",
      "Helena",
      "Camille",
      "Zara",
      "Kai",
      "Vera",
      "Anya",
      "dashboard",
    ],
    replay: "append-only-audit",
    citationsHint: [
      "D-NEW-PRODUCT-APPROVAL-POLICY",
      "BCBS-NEW-PRODUCT-PRINCIPLES",
      "BANKS-ACT-94-1990",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #6; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    type: "ProductWithheld",
    class: "governance",
    payloadSchema: productWithheldPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Helena", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #7; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (Q4 explicit-decision resolution)",
  },
  {
    type: "ProductLaunched",
    class: "governance",
    payloadSchema: productLaunchedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Kai", "Helena", "Vera", "Anya", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY", "RAS-B7"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #8; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    type: "ProductPostImplementationReviewCompleted",
    class: "governance",
    payloadSchema: productPostImplementationReviewCompletedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Helena", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #9; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    type: "ProductReviewCompleted",
    class: "governance",
    payloadSchema: productReviewCompletedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Helena", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #10 (annual cadence); D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    type: "ProductRetired",
    class: "governance",
    payloadSchema: productRetiredPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Imani", "Helena", "Vera", "Anya", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #11 (binds Imani migration-clause); D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2",
  },
  {
    // Per Q5 resolution: material change increments version on the same
    // productId; new productId reserved for genuinely new products.
    type: "ProductVersionPublished",
    class: "governance",
    payloadSchema: productVersionPublishedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Saskia", "Owen", "Kai", "Helena", "Vera", "Anya", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §4 #12; D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (Q5 same-productId resolution)",
  },
];

// ===========================================================================
// Records Management Substrate (RMS) Phase 1 Slice 2 — five new event types.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); slice authorisation
// D-RMS-PHASE-1-SLICE-2. Spec at
// `Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`
// §3 (Event type definitions).
//
// S8/RMS overlap disposition (Scrooge ruling, 2026-05-10): RMS owns the seven
// records-of-agent-runs event types; S8 keeps the agent-runtime primitives.
// Two of the seven (`AgentRunStarted`, `AgentRunCompleted`) already had
// envelope-only rows in `RUNTIME_EVENT_TYPES`; Slice 2 added typed payload
// schemas in-place there. The remaining five are registered below.
//
// Class is `governance` for `RecordFiled` (it makes a markdown a *record* in
// the governance sense — Owen's note in spec §3.8) and `runtime` for the
// rest (they describe the bank's agent-run lifecycle / dispatch / decision-
// surfacing flow, not a regulator-facing record themselves). Retention is
// `RETENTION_RUNTIME_1Y` for the runtime types; `RecordFiled` is governance
// (the record-filing event itself is governance retention; the retention
// regime of the record's *content* is what the payload's `retention.citationRef`
// names).
//
// Replay rules:
//   - `AgentBriefIssued`     → pair-coupled (closes when AgentRunCompleted
//                              with matching briefId, or when BriefSuperseded).
//   - `DecisionRequested`    → pair-coupled (closes when CeoDecision with
//                              matching decisionId).
//   - `Feedback`             → append-only-audit (no closure semantics; the
//                              register accumulates).
//   - `BriefSuperseded`      → append-only-audit (the supersession chain is
//                              audit; the Briefs register reads it as a fold).
//   - `RecordFiled`          → append-only-audit (records are immutable;
//                              corrections land as a new RecordFiled).
//
// Author: Owen (Company Secretary, governance) +
//         Atlas (Core banking platform architect, engineering)
// ===========================================================================

const RMS_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "AgentBriefIssued",
    class: "runtime",
    payloadSchema: agentBriefIssuedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["target-agent", "Vera", "Anya", "dashboard"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_RUNTIME_1Y,
    source:
      "Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3.1; D-RMS-PHASE-1 Slice 2",
  },
  {
    type: "DecisionRequested",
    class: "runtime",
    payloadSchema: decisionRequestedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Scrooge", "Vera", "dashboard"],
    replay: "pair-coupled",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    // Decision-surfacing events are governance-adjacent: the CeoDecision
    // they pair with is 7y-retained; the DecisionRequested seat for that
    // pairing rides the same governance horizon for symmetry.
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3.4; D-RMS-PHASE-1 Slice 2",
  },
  {
    type: "Feedback",
    class: "runtime",
    payloadSchema: feedbackPayloadSchema,
    issuer: "Scrooge",
    subscribers: ["target-agent", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    // Feedback events become canonical CEO direction once the substrate
    // intakes from chat — that direction may inform later disputes /
    // governance reviews. Promote to governance 7y.
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3.6; D-RMS-PHASE-1 Slice 2",
  },
  {
    type: "BriefSuperseded",
    class: "runtime",
    payloadSchema: briefSupersededPayloadSchema,
    issuer: "any-agent",
    subscribers: ["target-agent", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_RUNTIME_1Y,
    source:
      "Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3.7; D-RMS-PHASE-1 Slice 2",
  },
  {
    type: "RecordFiled",
    // RecordFiled is the event that turns a markdown into a *record* in the
    // governance sense (Owen's note, spec §3.8). Class = governance.
    class: "governance",
    payloadSchema: recordFiledPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Vera", "Owen", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    // The RecordFiled event itself rides governance retention (7y). The
    // *record* it refers to has its own retention regime named in the
    // payload's `retention.citationRef`; that field is what the recon
    // ultimately checks for the document's retention horizon.
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3.8; D-RMS-PHASE-1 Slice 2",
  },
];

// ===========================================================================
// Bank-account event family — D-BANK-ACCOUNT-SUBSTRATE.
//
// Standing authority: D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10),
// which adopted D-BANK-ACCOUNT-SUBSTRATE as a sub-decision under its
// umbrella per pack §6 brief #A1. No new CEO approval required.
//
// Three events govern the lifecycle of a bank-owned account (nostro / vostro
// / capital / SARB-operational / clearing / internal-suspense). Every
// posting in the bank's sub-ledger ultimately dispatches against an account
// in this family — the account-master + account-balance projections are the
// typed input to every BA-return cell and AFS line that decomposes into a
// `Balance` semantic-layer query.
//
// Class is `governance` because account opening / closing decisions are
// regulator-relevant under Banks Act + the bank's own Records Management
// Policy (account openings feed BA-return composition and the chart-of-
// accounts mapping is itself a board-approved register). Retention is
// 7-year governance + a citation chain into the chart-of-accounts.
//
// Replay rule:
//   - `BankAccountOpened`     → idempotent-terminal on (accountId): a second
//                               open with the same accountId is a substrate-
//                               integrity violation; the master keeps the
//                               first.
//   - `BankAccountConfigured` → cumulative-fold on (accountId, configKey):
//                               latest-wins per key; the audit trail records
//                               every transition.
//   - `BankAccountClosed`     → idempotent-terminal on (accountId): once
//                               present the account is closed; no re-open.
//
// Authors: Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; lead) · Atlas (Core banking platform architect, engineering
//   — substrate consult) · Bea (Accounting & financial reporting engineer,
//   engineering — reports to Camille CFO; chart-of-accounts integration).
// ===========================================================================

const BANK_ACCOUNT_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "BankAccountOpened",
    class: "governance",
    payloadSchema: bankAccountOpenedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea", "Eitan", "Anya", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: [
      "D-FIRST-DRY-RUN-SCENARIO",
      "D-BANK-ACCOUNT-SUBSTRATE",
      "INTERNAL-FINANCE-CHART-OF-ACCOUNTS",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md §6 #A1; D-BANK-ACCOUNT-SUBSTRATE",
  },
  {
    type: "BankAccountConfigured",
    class: "governance",
    payloadSchema: bankAccountConfiguredPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea", "Helena", "Eitan", "Vera", "dashboard"],
    replay: "cumulative-fold",
    citationsHint: ["D-FIRST-DRY-RUN-SCENARIO", "D-BANK-ACCOUNT-SUBSTRATE"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md §6 #A1; D-BANK-ACCOUNT-SUBSTRATE",
  },
  {
    type: "BankAccountClosed",
    class: "governance",
    payloadSchema: bankAccountClosedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea", "Eitan", "Anya", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: ["D-FIRST-DRY-RUN-SCENARIO", "D-BANK-ACCOUNT-SUBSTRATE"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md §6 #A1; D-BANK-ACCOUNT-SUBSTRATE",
  },
];

// ===========================================================================
// Period-close event family — D-REPORTING-CAPABILITY-SLICE-2.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 2. Three event types govern accounting-period
// close per entity (per pack §6 Q2: each Hoz entity closes independently).
//
// Replay-fold rules:
//   - AccountingPeriodOpened    → idempotent-terminal on (entity, periodId)
//                                 while the period is open. Reopens append a
//                                 new event with `reopenOf` chain — the
//                                 forensic chain is open → close → open
//                                 (reopen) → close (reclose).
//   - AccountingPeriodClosed    → idempotent-terminal on (entity, periodId).
//                                 References the trial-balance-snapshot
//                                 event_id captured at close.
//   - TrialBalanceSnapshotted   → append-only-audit. Multiple snapshots per
//                                 (entity, periodId) — one `close`-kind
//                                 emitted automatically; arbitrary `interim`-
//                                 kind for in-period checkpoints.
//
// Subscribers: Bea (close orchestration owner) + Camille (CFO accountable
// signer per Slice 6+ AFS approvals) + Vera (continuous-controls — recon
// pipelines on close coverage + trial-balance-debits-equal-credits) +
// Anya (semantic-layer + downstream BA-return generators consume the
// snapshot) + dashboard (period-status tile).
//
// Retention: RETENTION_ACCOUNTING_7Y — Companies Act 71/2008 s.24
// accounting-records floor. Principle 1's append-only log retains
// indefinitely; the 7-year minimum is the regulator-mandated floor.
// ===========================================================================

const PERIOD_CLOSE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "AccountingPeriodOpened",
    class: "markets", // accounting events sit in the same class as M1 sub-ledger postings
    payloadSchema: accountingPeriodOpenedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Anya", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-2",
      "IAS-1",
      "IAS-21-§9",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md §6 Slice 2; D-REPORTING-CAPABILITY-SLICE-2",
  },
  {
    type: "AccountingPeriodClosed",
    class: "markets",
    payloadSchema: accountingPeriodClosedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Anya", "Helena", "Eitan", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-2",
      "IAS-1",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md §6 Slice 2; D-REPORTING-CAPABILITY-SLICE-2",
  },
  {
    type: "TrialBalanceSnapshotted",
    class: "markets",
    payloadSchema: trialBalanceSnapshottedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Anya", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-2",
      "IAS-1",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md §6 Slice 2; D-REPORTING-CAPABILITY-SLICE-2",
  },
];

const RAS_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "RasLineCalibrated",
    class: "governance",
    payloadSchema: rasLineCalibratedPayloadSchema,
    issuer: "Helena",
    subscribers: ["Helena", "Camille", "Rohan", "Bea", "Mira", "Vera", "dashboard"],
    // Each new calibration may supersede a prior; the supersedes-chain is
    // the audit lineage. Active line is "the one no later event supersedes".
    replay: "append-only-audit",
    citationsHint: [
      "D-REGULATORY-READINESS-GATE-PLAN",
      "D-REGULATORY-READINESS-W2-SLICE-2",
      "BANKS-ACT-94-1990",
      "REG-RELATING-TO-BANKS-REG-38",
      "BCBS-BASEL-III-IV-CAPITAL-BUFFERS",
      "RAS-FRAMEWORK-2026-05-06-B3",
      "ORG-PR-04",
    ],
    // Risk-appetite calibration is a CRO-ratified governance event under
    // Banks Act § 60+ + BCBS Corporate Governance Principle 2 — director-
    // decision retention class (7y, hot-cool-archive).
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md §3 W2 Slice 2; D-REGULATORY-READINESS-W2-SLICE-2",
  },
];

// Per-persona readiness-snapshot family. Each handler emits a weekly
// (or trigger-driven) snapshot rolling up the persona's obligations
// register slice + persona-specific operational counters. The
// snapshots feed Saskia's pre-licence go-live readiness gate, Devon's
// resilience digest, and Vera's audit trail. Schemas live at
// `platform/event-store/event-types-readiness-snapshots.ts`. F-032
// brought the gap from envelope-only to schema-typed; payload shapes
// diverge enough between personas that a shared schema would force
// `z.record(...)` and add no validation.
const READINESS_SNAPSHOT_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "MLROAttestation",
    class: "governance",
    payloadSchema: mlroAttestationPayloadSchema,
    issuer: "Zara",
    subscribers: ["Saskia", "Devon", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["FIC-ACT-38-2001", "ORG-FC-05", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_FIC_5Y,
    source:
      "runtime/agents/zara-mlro-supervision.ts; D-REGULATORY-READINESS-GATE-PLAN; Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032)",
  },
  {
    type: "AccountingReadinessSnapshot",
    class: "governance",
    payloadSchema: accountingReadinessSnapshotPayloadSchema,
    issuer: "Bea",
    subscribers: ["Saskia", "Devon", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["COMPANIES-ACT-71-2008-S24", "ORG-AC-01", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "runtime/agents/bea-accounting-readiness.ts; D-REGULATORY-READINESS-GATE-PLAN; Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032)",
  },
  {
    type: "AgentOpsReadinessSnapshot",
    class: "governance",
    payloadSchema: agentOpsReadinessSnapshotPayloadSchema,
    issuer: "Sade",
    subscribers: ["Saskia", "Devon", "Atlas", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-CY-01", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "runtime/agents/sade-agentops-readiness.ts; D-REGULATORY-READINESS-GATE-PLAN; Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032)",
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

const GOAL_LOOP_EVENT_TYPES: readonly EventTypeMetadata[] = [
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

/**
 * Full registry — flat list. Keep RUNTIME / GOVERNANCE / AUDIT split
 * above for readability; the consumer-facing surface is this combined
 * array.
 */
export const EVENT_TYPE_REGISTRY: readonly EventTypeMetadata[] = [
  ...RUNTIME_EVENT_TYPES,
  ...MODEL_REGISTRY_EVENT_TYPES,
  ...MARKETS_EVENT_TYPES,
  ...GOVERNANCE_EVENT_TYPES,
  ...AUDIT_EVENT_TYPES,
  ...LEGAL_ENTITY_EVENT_TYPES,
  ...PARTY_EVENT_TYPES_REGISTRY,
  ...PRODUCT_LIFECYCLE_EVENT_TYPES,
  ...RMS_EVENT_TYPES,
  ...BANK_ACCOUNT_EVENT_TYPES,
  ...PERIOD_CLOSE_EVENT_TYPES,
  ...RAS_EVENT_TYPES,
  ...READINESS_SNAPSHOT_EVENT_TYPES,
  ...GOAL_LOOP_EVENT_TYPES,
];

const REGISTRY_BY_TYPE: ReadonlyMap<string, EventTypeMetadata> = new Map(
  EVENT_TYPE_REGISTRY.map((m) => [m.type, m]),
);

/**
 * Look up a type's registered metadata. Returns undefined for types
 * that aren't in the registry (which is fine in build phase — the
 * envelope-only path still validates and appends them).
 *
 * The returned record normalises `status` to `"active"` when the row
 * was authored before the `status` field was introduced (D-PARTY-REGISTER
 * PR 4, 2026-05-11) so callers can always compare
 * `meta.status === "deprecated"` without an undefined guard.
 */
export function lookupEventType(
  type: string,
): (EventTypeMetadata & { status: EventTypeStatus }) | undefined {
  const meta = REGISTRY_BY_TYPE.get(type);
  if (!meta) return undefined;
  return { ...meta, status: meta.status ?? "active" };
}

/**
 * Validate a payload against the registered schema for `type`.
 *
 * Behaviour:
 *   - Type registered with payloadSchema → schema.parse() throws on bad
 *     payload (caller propagates as append failure).
 *   - Type registered without payloadSchema → no-op (envelope-only).
 *   - Type not in registry → no-op (build-phase forward compat). Will
 *     tighten to fail-closed once Vera's #11 / #12 pipelines assert
 *     the registry is complete.
 *
 * The top-level `eventSchema` envelope is validated separately by the
 * EventStore's append; this is the type-dispatched layer on top.
 */
export function validatePayload(type: string, payload: Record<string, unknown>): void {
  const meta = REGISTRY_BY_TYPE.get(type);
  if (!meta || !meta.payloadSchema) return;
  meta.payloadSchema.parse(payload);
}

/**
 * Issuer/subscriber matrix view — used by the dashboard health page,
 * Atlas's permission-policy generator (A2), and Vera's coverage recon.
 *
 * Returns an array of {issuer, eventTypes} groups. Stable sort: issuer
 * name then event-type name.
 */
export function issuerMatrix(): ReadonlyArray<{
  readonly issuer: string;
  readonly eventTypes: readonly string[];
}> {
  const grouped = new Map<string, string[]>();
  for (const m of EVENT_TYPE_REGISTRY) {
    const arr = grouped.get(m.issuer) ?? [];
    arr.push(m.type);
    grouped.set(m.issuer, arr);
  }
  return [...grouped.entries()]
    .map(([issuer, eventTypes]) => ({ issuer, eventTypes: eventTypes.slice().sort() }))
    .sort((a, b) => a.issuer.localeCompare(b.issuer));
}

/**
 * Per-subscriber view — every event type a given subscriber agent (or
 * "external" / "audit" / "dashboard") consumes. Symmetric to
 * issuerMatrix(); needed for permission-policy event-subscribe
 * allow-lists.
 */
export function subscriberMatrix(): ReadonlyArray<{
  readonly subscriber: string;
  readonly eventTypes: readonly string[];
}> {
  const grouped = new Map<string, string[]>();
  for (const m of EVENT_TYPE_REGISTRY) {
    for (const s of m.subscribers) {
      const arr = grouped.get(s) ?? [];
      arr.push(m.type);
      grouped.set(s, arr);
    }
  }
  return [...grouped.entries()]
    .map(([subscriber, eventTypes]) => ({ subscriber, eventTypes: eventTypes.slice().sort() }))
    .sort((a, b) => a.subscriber.localeCompare(b.subscriber));
}
