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
  owner: string;
  trigger: string;
  decisionForCEO: string;
  sourceDocs: readonly string[];
  note?: string;
  recommendation?: DecisionRecommendation;
  brief?: DecisionBrief;
}

export type DecisionAction = "approve" | "defer" | "modify" | "request-revision";

export interface ResolvedDecision {
  id: string;
  title: string;
  actionedAt: string;
  outcome: string;
  sourceDoc: string;
  action?: DecisionAction;
  comment?: string;
  actionedBy?: string;
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

// Owner-Inbox feed item. Every deliverable saved to /Owner Inbox/ surfaces
// here automatically so the CEO sees the full inbox in the dashboard, not
// just hand-curated decisions. Items declaring `decision-required: true`
// in their YAML frontmatter are also lifted into `decisionsOpen`.
//
// Frontmatter is optional; files without it are parsed from filename
// (date + slug) plus the body's first H1 and Author line.
export interface OwnerInboxItem {
  filename: string; // basename, e.g. "2026-05-07_vera_agent-discipline-assurance-extension.md"
  path: string; // repo-relative, e.g. "Owner Inbox/<filename>"
  date: string; // YYYY-MM-DD parsed from filename or frontmatter
  title: string;
  author?: string;
  summary?: string;
  decisionRequired: boolean;
  // Fields below are populated only when decisionRequired is true.
  decisionId?: string;
  decisionStatus?: "open" | "resolved"; // resolved iff a CeoDecision event exists for decisionId
  decisionCategory?: DecisionCategory;
  decisionForCEO?: string;
  decisionRecommendation?: string;
  decisionOwner?: string;
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
  /** Last activity attributed to the agent (deliverable / completion / decision). */
  lastActivityAt?: string;
  /**
   * Predicted next scheduled run (now + cadenceHours from lastActivityAt).
   * Undefined for event-driven / on-request. ISO 8601.
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
}

/**
 * Source classification — which kind of upstream authority a policy
 * implements. Per CLAUDE.md Principle 6: "(Regulation OR Bank Objective)
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
}

export interface DashboardState {
  asOf: string;
  bank: BankSummary;
  directReports: readonly Person[];
  openSeats: readonly OpenSeat[];
  principles: readonly Principle[];
  decisionsOpen: readonly OpenDecision[];
  decisionsResolved: readonly ResolvedDecision[];
  inFlight: readonly InFlightItem[];
  agents: readonly AgentMiniDashboard[];
  ownerInboxFeed: readonly OwnerInboxItem[];
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
}

export interface DecisionRequestBody {
  decisionId: string;
  action: DecisionAction;
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
