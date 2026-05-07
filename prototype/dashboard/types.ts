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
  prototype: PrototypeStatus;
  risks: readonly string[];
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
