// dashboard/types.ts
//
// Shape of the dashboard state registry. The registry is the source-of-truth
// JSON the dashboard reads on every tick. CEO-decision actions emit events
// to the event store AND mutate the registry (the registry is a *cache* per
// Principle 1; the events outrank it on every reconciliation).
//
// Author: Atlas · Owen (decision-pack discipline) · Anya (data shape)

export interface BankMetrics {
  principles: number;
  policies: number;
  obligations: number;
  instruments: number;
  instrumentsAnalysed: number;
  proceduresPopulated: number;
  proceduresPlanned: number;
  ceoDecisionsActioned: number;
  directReports: number;
  openGovernanceSeats: number;
}

export interface StrategicFoundation {
  type: string;
  products: readonly string[];
  clients: readonly string[];
  geography: string;
  capital: string;
  licence: string;
}

export interface BankSummary {
  name: string;
  operatingPosture: string;
  strategicFoundation: StrategicFoundation;
  metrics: BankMetrics;
  cloudTarget: string;
}

export interface Person {
  name: string;
  role: string;
  type: "Functional" | "Governance";
}

export interface OpenSeat {
  role: string;
  status: string;
}

export interface Principle {
  n: number;
  title: string;
  summary: string;
}

export type DecisionCategory =
  | "pacing"
  | "near-term"
  | "second-order"
  | "medium-term"
  | "long-horizon";

/**
 * Domain category carried on a unified `Decision` event payload (per
 * `D-DECISIONS-FRAMEWORK-REDESIGN`). Orthogonal to the legacy
 * pacing-flavoured `DecisionCategory` above — Slice B surfaces both so
 * callers can group by either axis.
 */
export type DecisionDomainCategory =
  | "governance"
  | "risk"
  | "compliance"
  | "engineering"
  | "people"
  | "finance"
  | "product"
  | "other";

export interface DecisionOption {
  label: string;
  description: string;
  consequence?: string;
}

export interface DecisionDependency {
  ref: string; // decision id ("D1") or token ("strategic-foundation")
  title: string;
  status: "open" | "resolved";
}

export interface Stakeholder {
  name: string;
  role: string;
  position?: string;
}

export interface SupportingDoc {
  path: string;
  title: string;
  summary: string;
}

export interface DecisionRecommendation {
  stance: string; // e.g. "Approve" / "TBD pending draft" / "Designate Iris"
  reasoning: string;
}

export interface DecisionBrief {
  summary: string;
  background: string;
  options: readonly DecisionOption[];
  recommendation: DecisionRecommendation;
  dependencies: {
    gatedOn: readonly DecisionDependency[];
    gates: readonly DecisionDependency[];
  };
  stakeholders: readonly Stakeholder[];
  timeline: string;
  supportingDocs: readonly SupportingDoc[];
}

export interface OpenDecision {
  id: string;
  title: string;
  category: DecisionCategory;
  /** D-DECISIONS-FRAMEWORK-REDESIGN — unified payload's domain category. */
  domainCategory?: DecisionDomainCategory;
  /** D-DECISIONS-FRAMEWORK-REDESIGN — which authority seat owns this decision. */
  authority?: string;
  owner: string;
  trigger: string;
  decisionForCEO: string;
  sourceDocs: readonly string[];
  note?: string;
  recommendation?: DecisionRecommendation;
  brief?: DecisionBrief;
}

export interface ResolvedDecision {
  id: string;
  title: string;
  actionedAt: string;
  outcome: string;
  sourceDoc: string;
  comment?: string;
  actionedBy?: string;
  /** D-DECISIONS-FRAMEWORK-REDESIGN — unified payload's domain category. */
  domainCategory?: DecisionDomainCategory;
}

export interface InFlightItem {
  id: string;
  what: string;
  owner: string;
  due: string;
  active: boolean;
  startedAt?: string;
  completedAt?: string;
  outcomeDoc?: string;
  outcomeNote?: string;
  briefDoc?: string;
  /** Maps this workstream to a roadmap section (A–D). Items without this tag
   *  are internal-tracking only and do not surface on the roadmap page. */
  roadmapWorkstream?: "A" | "B" | "C" | "D";
}

export interface PrototypeModule {
  name: string;
  status: string;
}

export interface PrototypeStatus {
  ciStatus: "green" | "amber" | "red";
  tests: number;
  modules: readonly PrototypeModule[];
  next: readonly string[];
}

export interface AgentDeliverable {
  date: string; // ISO yyyy-mm-dd
  path: string; // relative to repo root
  title: string; // humanised filename
}

export interface SubordinateMini {
  name: string;
  role: string;
  hasOperatingSpec: boolean;
  activeWorkstreams: readonly InFlightItem[];
  recentlyCompletedWorkstreams: readonly InFlightItem[];
  openDecisionsOwned: readonly OpenDecision[];
  recentDeliverables: readonly AgentDeliverable[];
  lastActivityAt?: string;
}

export interface AgentMiniDashboard {
  name: string;
  role: string;
  type: "Functional" | "Governance";
  isDirectReport: boolean; // true iff in CLAUDE.md "CEO direct reports today"
  personaPath: string; // relative path to /Team/<Name>.md
  mandate: string; // first paragraph of the Mandate section, plain text
  hasOperatingSpec: boolean; // true iff persona file declares an agent-spec section
  activeWorkstreams: readonly InFlightItem[];
  recentlyCompletedWorkstreams: readonly InFlightItem[];
  openDecisionsOwned: readonly OpenDecision[];
  recentlyResolvedDecisions: readonly ResolvedDecision[];
  recentDeliverables: readonly AgentDeliverable[];
  lastActivityAt?: string; // ISO date — most recent of completion / decision / deliverable
  // Subordinates rolled up under this seat's accountability. Per the
  // autonomous-agent operating model (CLAUDE.md, 2026-05-07), CEO-reporting
  // personas report on their own duties *and* the duties of those who
  // report to them. Empty array for personas with no reports.
  subordinates: readonly SubordinateMini[];
  // Totals including subordinates — the at-a-glance number for the CEO.
  totalActive: number;
  totalRecentlyCompleted: number;
  totalOpenDecisions: number;
  totalRecentDeliverables: number;
}

export interface FindingSummary {
  id: string;
  source: string; // raising agent / pipeline (e.g. "agent:vera:overnight-recon")
  severity: string; // "low" | "medium" | "high" | "critical"
  principle?: string; // optional citation to the principle that's violated
  description: string;
  asOf: string; // ISO 8601 — when raised
}

export interface DecisionCommentSummary {
  eventId: string;
  decisionId: string;
  author: string; // display name
  actorType: "human" | "service" | "system";
  actorId: string; // strong identity
  body: string;
  inReplyToEventId?: string;
  asOf: string;
}

export interface RuntimeHandlerInfo {
  agent: string; // matches /Team/<Name>.md
  trigger: string; // trigger id (e.g. "overnight-recon")
  kind: "scheduled" | "event-driven" | "on-request";
  cadenceHours?: number; // expected cadence in hours; undefined for event-driven / on-request
  subscribesTo?: readonly string[]; // event types for event-driven handlers
}

// ---------------------------------------------------------------------------
// A3.2 — CEO Oversight UI projections.
//
// Read-only views derived from the typed escalation lifecycle (A3.1) plus
// runtime-handler metadata. The dashboard wraps the EscalationChannel.list()
// fold + handler metadata into stable JSON shapes so the front-end never has
// to know about the channel directly.
// ---------------------------------------------------------------------------

/**
 * Lifecycle status as the channel sees it (open | acknowledged | delegated |
 * decided). The `overdue` boolean is a separate decoration that may overlay
 * any non-terminal status. The dashboard collapses both into a single tag in
 * the UI when convenient — `decided` is terminal; `overdue` overlays open /
 * acknowledged / delegated.
 */
export type EscalationLifecycle = "open" | "acknowledged" | "delegated" | "decided" | "overdue";

/**
 * Raw summary of a single AgentEscalation event payload, as extracted by
 * the EventSource.agentEscalations() reader. Defined here (canonical shared
 * types) so both dashboard/derive.ts and projections/decisions.ts can import
 * it without creating a circular dependency.
 * D-DATA-QUALITY-GOLDEN-SOURCE-V1 — moved from derive.ts local definition.
 */
export interface AgentEscalationEventSummary {
  readonly escalationId: string;
  readonly raisedBy: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly blockedBy: string;
  readonly severity: "low" | "medium" | "high" | "blocking";
  readonly routedTo: string;
  readonly deadline?: string;
  readonly asOf: string;
}

export interface EscalationView {
  escalationId: string;
  raisedBy: string;
  question: string;
  options: readonly string[];
  blockedBy: string;
  severity: "low" | "medium" | "high" | "blocking";
  routedTo: string;
  deadline?: string;
  /** Sealed-routing reason (POPIA, fraud, whistleblowing). undefined = unsealed. */
  sealedReason?: "fraud" | "whistleblowing" | "popia-incident";
  status: EscalationLifecycle;
  /** Overdue decoration — may be true even for `acknowledged` / `delegated`. */
  overdue: boolean;
  /** Most recent responsible party (last delegate / acknowledger / original raiser / decider). */
  currentResponsible: string;
  acknowledgementCount: number;
  delegationCount: number;
  /** event_id of the originating AgentEscalation. */
  openedEventId: string;
  /** ISO 8601 of the originating AgentEscalation envelope. */
  raisedAt: string;
  /** True if a CeoDecision event with the same id as escalationId has landed. */
  hasResolvingDecision: boolean;
}

export interface FleetAgentStatus {
  /**
   * The persona name (matches /Team/<Name>.md). When an agent registers
   * multiple triggers, one entry per (agent, trigger) pair surfaces here.
   */
  agent: string;
  trigger: string;
  /** Composite key — `<lowercased-agent>:<trigger>`. */
  handlerKey: string;
  kind: "scheduled" | "event-driven" | "on-request";
  cadenceHours?: number;
  /** Synthetic agent URN — `agent:<lowercased-name>`. */
  agentUrn: string;
  /**
   * Timestamp of the most recent closed run event
   * (SubstrateAgentRunCompleted or SubstrateAgentRunFailed) from the event
   * store lifecycle fold. The canonical "last touched" signal.
   */
  lastRunAt?: string;
  /**
   * Alias of `lastRunAt` — retained for backwards compat with dashboard
   * consumers that read the legacy field name.
   * @deprecated Prefer `lastRunAt`.
   */
  lastActivityAt?: string;
  /**
   * Predicted next scheduled run — computed from the handler's
   * `cronExpression` + `lastRunAt` via `nextFireAfter` (accurate cron
   * evaluation). Falls back to `lastRunAt + cadenceHours` when no cron
   * expression is available. Undefined for event-driven / on-request.
   * ISO 8601.
   */
  nextRunAt?: string;
  /**
   * In-flight runs the substrate is tracking. The current in-process model
   * runs synchronously, so this is always 0 today; reserved for the
   * substrate's future scheduler.
   */
  inFlightRuns: number;
  pendingEscalationCount: number;
  recentDecisionsCount: number;
  /** Subscriptions for event-driven handlers — surfaced as the "trigger source". */
  subscribesTo?: readonly string[];
}

export interface EscalationLifecycleEvent {
  type:
    | "AgentEscalation"
    | "AgentEscalationAcknowledged"
    | "AgentEscalationDecided"
    | "AgentEscalationDelegated"
    | "AgentEscalationOverdue";
  escalationId: string;
  asOf: string;
  actor: string;
  /** Free-form summary line — populated per type. */
  summary: string;
}

export interface DecisionDrillDown {
  decisionId: string;
  /** The originating escalation, when one exists with the same id. */
  escalation?: EscalationView;
  /** All lifecycle events for the escalation, ordered oldest-first. */
  lifecycle: readonly EscalationLifecycleEvent[];
  /** The CeoDecision (if it has landed) folded into the resolved-decision shape. */
  resolution?: ResolvedDecision;
  /** The originating open-decision row (when still open). */
  open?: OpenDecision;
  /** Comments thread. */
  comments: readonly DecisionCommentSummary[];
  /**
   * True when the decision's sealed-reason or sealed metadata implies
   * POPIA s.71 (automated decisioning). Today we surface the notice for
   * any decision with `sealedReason === "popia-incident"`. Refinable by
   * Iris in a future pass.
   */
  popiaS71: boolean;
  /** Citations attached to the originating escalation envelope. */
  citations: readonly string[];
  /**
   * Rich row from the RMS decisions register (title, category, recommendation,
   * source-document hashes, citations, options, deadline, requestedAt,
   * resolution). Present whenever the decisionId appears in the register fold.
   */
  registerRow?: unknown;
}

/**
 * Source classification — which kind of upstream authority a policy
 * implements. Per CLAUDE.md Principle 2: "(Regulation OR Bank Objective)
 * → Policy → Procedure → System Capability". A policy may carry both
 * sources (e.g. Capital Management Policy implements Banks Act regulatory
 * minima AND the bank's own RAS B2 internal buffer).
 */
export type PolicySource = "REGULATORY" | "OBJECTIVE";

/**
 * Bind classification — when a policy's underlying obligation actually
 * binds the bank. Per `project_rules_bind_at_commencement` (2026-05-07):
 * banking-specific rules apply from licence-day or commencement-of-trading,
 * not from the build-phase. The four-bucket taxonomy lets the dashboard
 * surface "preparing to comply" vs "in force" without conflating them.
 */
export type PolicyBind =
  | "CORPORATE-BIND"
  | "LICENCE-BIND"
  | "COMMENCEMENT-BIND"
  | "CONDITIONAL-BIND";

/**
 * Normalised policy status — verbatim contents in `statusRaw`. Anything
 * outside the five canonical values surfaces as "OTHER" so the dashboard
 * can render a fall-back style without throwing.
 */
export type PolicyStatus = "IN FORCE" | "EXISTS" | "DRAFTING" | "PLANNED" | "BOARD-RES" | "OTHER";

/**
 * A policy entry parsed from `Owner Inbox/2026-05-06_policy-register.md`,
 * cross-referenced against `Regulations/_obligations-register.md` for
 * `linkedObligations[]`. Contract surface for the policies-library page.
 */
export interface Policy {
  /** Stable id: `pol-<domainNumber>-<slug>`, e.g. `pol-2-credit-risk-policy`. */
  id: string;
  /** Display name with the leading `★` MVP marker stripped. */
  name: string;
  /** "N. Domain name" string from the section heading. */
  domain: string;
  owner: string;
  approval: string;
  cadence: string;
  /** Verbatim citation cell content. */
  citation: string;
  /** Source mix — REGULATORY, OBJECTIVE, both, or empty when neither matches. */
  sources: readonly PolicySource[];
  /** Bind state(s) — CORPORATE / LICENCE / COMMENCEMENT / CONDITIONAL. */
  binds: readonly PolicyBind[];
  /** Normalised status enum (best-effort match against the canonical five). */
  status: PolicyStatus;
  /** Verbatim status cell, including any parenthetical context. */
  statusRaw: string;
  /** True if the source register prefixed the policy name with `★`. */
  mvp: boolean;
  /** ORG-* obligation IDs whose Fulfilment-policy column names this policy. */
  linkedObligations: readonly string[];
  /**
   * Source markdown files that author this policy. Always non-empty: the
   * canonical policy register is always first (the row-of-truth fallback).
   * Two path forms are used:
   * - Bare basenames for `Owner Inbox/` files (e.g. `2026-05-06_policy-register.md`)
   * - `Policies/<basename>` qualified paths for canonical policy documents
   *   under the `Policies/` directory (D-POLICY-DOCUMENT-HOME Option C, 2026-05-12)
   * The `/api/policy/:filename` endpoint accept-list is the union of these paths
   * and resolves each to its directory accordingly.
   */
  sourceFiles: readonly string[];
}

// ---------------------------------------------------------------------------
// Slice 5 — RAS limit utilisation rows (LimitUtilisationProjection)
// Authors: Rohan (Risk engineer) + Helena (Chief Risk Officer, governance)
// Authority: D-MARKETS-SCHEMA-FOUNDATION Slice 5
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AgentOps dashboard tile — Sade (AgentOps & Token Efficiency Engineer)
//
// Projection derived from TokenUsageRecorded, AgentEfficiencyAdvisoryIssued,
// and AgentPromptOptimizationApplied events. Surfaces on the CEO dashboard
// as the AgentOps tile. Handler: dashboard/agent-ops.ts.
//
// Summary types mirror the canonical event payloads but are scoped to what
// the dashboard projection needs, avoiding a circular dependency on the
// event-store event-types module.
// ---------------------------------------------------------------------------

export interface AgentTokenSummary {
  /** Bare agent name — matches AgentRegistered.agentId. */
  agent: string;
  /** Total tokens consumed in the last 7 calendar days. */
  tokens7d: number;
  /** Total tokens consumed in the last 30 calendar days. */
  tokens30d: number;
  /** Estimated cost (USD) for the last 7 days. */
  estimatedCost7d: number;
  /** Estimated cost (USD) for the last 30 days. */
  estimatedCost30d: number;
  /** Efficiency trend for this agent derived from rolling window. */
  trend: "improving" | "stable" | "degrading";
  /** Most recent advisory ID issued for this agent, or null if none. */
  lastAdvisoryId: string | null;
}

export interface AgentEfficiencyAdvisorySummary {
  advisoryId: string;
  agent: string;
  finding: string;
  severity: "low" | "medium" | "high";
  issuedAt: string;
}

export interface PromptOptimisationSummary {
  optimisationId: string;
  agent: string;
  summary: string;
  changeType: string;
  appliedAt: string;
}

export interface AgentOpsState {
  /** Total tokens across the whole fleet in the last 7 days. */
  totalTokens7d: number;
  /** Total tokens across the whole fleet in the last 30 days. */
  totalTokens30d: number;
  /** Estimated fleet cost (USD) for the last 7 days. */
  estimatedCost7d: number;
  /** Estimated fleet cost (USD) for the last 30 days. */
  estimatedCost30d: number;
  /** Per-agent token summary rows. */
  byAgent: AgentTokenSummary[];
  /** Most recent efficiency advisories (up to 10). */
  recentAdvisories: AgentEfficiencyAdvisorySummary[];
  /** Most recent prompt/mandate optimisations applied (up to 10). */
  recentOptimisations: PromptOptimisationSummary[];
  /** Overall fleet efficiency trend derived from the rolling window. */
  efficiencyTrend: "improving" | "stable" | "degrading";
  /** ISO 8601 — when this projection slice was last updated. */
  lastUpdated: string;
}

export interface LimitUtilisationStateSummary {
  cluster: "B1" | "B2" | "B3" | "B4" | "B5";
  limitName: string;
  utilisationPct: number;
  limitValue: number;
  currentExposure: number;
  currency: string;
  ragStatus: "green" | "amber" | "red";
  asOf: string;
}

// ---------------------------------------------------------------------------
// FTP dashboard tile — Ravi (Treasury/ALM Engineer) + Eitan (Treasurer).
//
// Derived from FtpAttributionRecorded and FtpCurvePublished events via
// buildFtpPortfolio(). Null when no FTP data has been emitted yet (build
// phase); populated once the first FtpCurvePublished event lands.
// ---------------------------------------------------------------------------

export interface FtpDashboardSummary {
  totalAttributions: number;
  weightedAvgSpreadBps: number;
  activeCurveId: string | null;
  lastUpdated: string;
}

export interface DashboardState {
  asOf: string;
  /**
   * Canonical bank name, surfaced for client pages to read consistently.
   * Sourced from `Regulations/_bank-name.md` (canonical register, URN
   * `urn:obligation:bank:gv:bank-name-registered:v1`); falls through to
   * `bank.name` if the register is unreadable. Drift between register
   * and `bank.name` is reportable under Vera Wave-4 #16.
   */
  bankName: string;
  bank: BankSummary;
  directReports: readonly Person[];
  openSeats: readonly OpenSeat[];
  principles: readonly Principle[];
  decisionsOpen: readonly OpenDecision[];
  decisionsResolved: readonly ResolvedDecision[];
  inFlight: readonly InFlightItem[];
  agents: readonly AgentMiniDashboard[];
  /**
   * Full policy library, parsed from the policy register and cross-
   * referenced against the obligations register. The frontend's
   * /policies.html page reads this directly. `bank.metrics.policies`
   * preserves the count for the bank-overview card.
   */
  policies: readonly Policy[];
  prototype: PrototypeStatus;
  risks: readonly string[];
  findings: readonly FindingSummary[];
  runtimeHandlers: readonly RuntimeHandlerInfo[];
  /** Comments per decisionId — append-only thread, oldest first. */
  decisionComments: Readonly<Record<string, readonly DecisionCommentSummary[]>>;
  /**
   * Slice 5 — per-cluster RAS limit utilisations. Derived from the
   * LimitUtilisationProjection (Rohan). Empty array if no
   * RasLimitSchedulePublished event has been emitted yet.
   */
  limitUtilisations: readonly LimitUtilisationStateSummary[];
  /**
   * AgentOps tile — token efficiency monitoring by Sade
   * (AgentOps & Token Efficiency Engineer). Derived from TokenUsageRecorded,
   * AgentEfficiencyAdvisoryIssued, and AgentPromptOptimizationApplied events.
   */
  agentOps: AgentOpsState;
  /**
   * FTP summary tile — Ravi (Treasury/ALM Engineer) + Eitan (Treasurer).
   * Derived from FtpAttributionRecorded + FtpCurvePublished events via
   * buildFtpPortfolio(). Null when no FTP data has been emitted yet.
   */
  ftp?: FtpDashboardSummary | null;
  /**
   * Capital position tile — Helena (CRO) + Bea (Accounting engineer).
   * Derived from computeCapitalMetrics() against the event store.
   * Null when the projection is unavailable.
   */
  capitalPositions?: import("../platform/projections/capital-metrics").CapitalMetrics | null;
  /**
   * Liquidity metrics tile — LCR / NSFR ratios computed from ALM positions.
   * Null when no ALM positions exist (build phase; no deposits / HQLA events).
   */
  liquidityMetrics?: {
    lcr: number | null;
    nsfr: number | null;
    lcrStatus: string;
    nsfrStatus: string;
  } | null;
}

export interface DecisionRequestBody {
  decisionId: string;
  action: string;
  outcome: string;
  comment?: string;
}

export interface StartWorkstreamRequestBody {
  id: string;
}

export interface CompleteWorkstreamRequestBody {
  id: string;
  outcomeDoc?: string;
  outcomeNote?: string;
}
