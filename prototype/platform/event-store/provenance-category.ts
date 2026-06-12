// platform/event-store/provenance-category.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE Phase C — the low-level provenance
// category taxonomy.
//
// This module is intentionally dependency-free (no event-store/types import) so
// the low-level `provenance.ts` can consult it without the cycle that
// event-types/bank-mode.ts would introduce. It owns:
//   - the category enum (the granularity axis for the bank-wide policy),
//   - the default per-category policy (governance/build = production; everything
//     the bank operates on = simulated),
//   - `categoryForEventType`, mapping each event type to its category.
//
// The event-sourced override (the settable per-category policy) lives in the
// bank-mode projection; this module is the static taxonomy + default it layers
// on top of.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

/**
 * Provenance categories — the granularity axis. Each maps a family of event
 * domains to its default provenance under the current bank-wide mode.
 */
export const PROVENANCE_CATEGORIES = [
  "governance", // decisions, briefs, agent runs, board/committee records
  "build", // substrate, platform, schema, recon, security, code
  "trading", // FX / bond / IRS / equity / repo trades
  "accounting", // GL / sub-ledger postings
  "counterparty", // counterparty / party register
  "messaging", // correspondence, SWIFT, advices
  "settlement", // settlement instructions / confirmations
  "market-data", // rates / FX / bond price feeds
] as const;
export type ProvenanceCategory = (typeof PROVENANCE_CATEGORIES)[number];

/** Per-category provenance under the default (sim) policy. */
export type CategoryProvenanceMap = Readonly<
  Record<ProvenanceCategory, "production" | "simulated">
>;

/**
 * Default per-category policy: governance + build/substrate are real (production
 * — real commitments, real engineering) even in build phase; everything the
 * bank operates on is simulated. Generalises the legacy hardcoded
 * PRODUCTION_CARVE_OUTS into data.
 */
export const DEFAULT_CATEGORY_POLICY: CategoryProvenanceMap = {
  governance: "production",
  build: "production",
  trading: "simulated",
  accounting: "simulated",
  counterparty: "simulated",
  messaging: "simulated",
  settlement: "simulated",
  "market-data": "simulated",
};

// ---------------------------------------------------------------------------
// Event-type → category mapping.
//
// Exact names first, then prefix/substring heuristics. An event type with no
// match returns `undefined` — the caller treats that as "operational /
// simulated by default", preserving the pre-Phase-C behaviour where only the
// production carve-outs were production. Mapping a type to governance/build is
// therefore the only way to make it production under the default policy.
// ---------------------------------------------------------------------------

const EXACT: Readonly<Record<string, ProvenanceCategory>> = {
  // Governance — decisions, briefs, records, audit, agent governance.
  Decision: "governance",
  CeoDecision: "governance",
  DecisionRequested: "governance",
  DecisionComment: "governance",
  AgentBriefIssued: "governance",
  BriefSuperseded: "governance",
  BankModePolicySet: "governance",
  RecordFiled: "governance",
  Feedback: "governance",
  RasLineCalibrated: "governance",
  AuditFinding: "governance",
  AuditFindingClosed: "governance",
  AgentRunStarted: "governance",
  AgentRunCompleted: "governance",
  AgentEscalation: "governance",
  AgentEscalationDecided: "governance",
  ProductApproved: "governance",
  // CCO-published best-execution tolerance schedule — a conduct-committee
  // governance record (real seat decision, not simulated market activity).
  // Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH; FAIS §16.
  BestExecutionPolicySchedule: "governance",
  // Counterparty / party register.
  PartyRegistered: "counterparty",
  PartyClassified: "counterparty",
  PartyAttributeChanged: "counterparty",
  PartyRelationshipAsserted: "counterparty",
  LegalEntityRegistered: "counterparty",
  // Settlement.
  SettlementInstructionIssued: "settlement",
  SettlementConfirmed: "settlement",
  PrincipalPayment: "settlement",
};

const PREFIX: ReadonlyArray<[string, ProvenanceCategory]> = [
  // Build / substrate / platform / recon / security.
  ["Substrate", "build"],
  ["Workstream", "build"],
  ["Recon", "build"],
  ["DataProjection", "build"],
  ["DashboardProjection", "build"],
  ["MarketsProjection", "build"],
  ["SecurityGate", "build"],
  ["ThreatModel", "build"],
  ["IdentityKey", "build"],
  ["PermissionPolicy", "build"],
  ["Bus", "build"],
  ["LegacyFanout", "build"],
  ["Scheduled", "build"],
  ["CdmBindings", "build"],
  // Trading.
  ["FxTrade", "trading"],
  ["BondTrade", "trading"],
  ["EquityTrade", "trading"],
  ["IrsTrade", "trading"],
  ["IrdSwap", "trading"],
  ["RepoTrade", "trading"],
  ["DepositTaken", "trading"],
  ["InterbankLoan", "trading"],
  ["FundingLine", "trading"],
  ["FundingDrawn", "trading"],
  // Accounting.
  ["SubLedger", "accounting"],
  ["Journal", "accounting"],
  ["Gl", "accounting"],
  ["Posting", "accounting"],
  // Market data / marks / revaluation.
  ["OfficialMark", "market-data"],
  ["MarketData", "market-data"],
  ["FxPositionRevalued", "market-data"],
  ["BondPositionRevalued", "market-data"],
  ["IrsPositionRevalued", "market-data"],
];

/**
 * Map an event type to its provenance category, or `undefined` when unmapped
 * (treated as operational/simulated by the caller).
 */
export function categoryForEventType(eventType: string): ProvenanceCategory | undefined {
  const exact = EXACT[eventType];
  if (exact) return exact;
  for (const [prefix, category] of PREFIX) {
    if (eventType.startsWith(prefix)) return category;
  }
  return undefined;
}
