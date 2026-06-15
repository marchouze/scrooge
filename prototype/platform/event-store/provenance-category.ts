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
  // WS-V2-BBAAS W1 — distillation classification of an existing Decision
  // (foundational/directional/obsolete). Governance record, never simulated.
  // Authority: D-V2-BBAAS-W1-DECISION-DISTILLATION (2026-06-12).
  DecisionDistilled: "governance",
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
  // D-NPA-POST-APPROVAL-FINDING-REVIEW (CEO-approved 2026-06-15). Post-approval
  // finding + retrospective review are governance records — mandatory in the
  // pre-licence phase with no deferral allowed. Third site of the three-site
  // registration gotcha (event-types + registry + provenance-category).
  ProductPostApprovalFinding: "governance",
  ProductDimensionRetrospectiveReview: "governance",
  // WS-V2-BBAAS S3 (W8 Slice 1) — agent operating-posture register. A posture
  // is real governance configuration (a typed risk-appetite stance / procedure
  // variant / jurisdictional toggle), not simulated market activity: structured-
  // first, weights propose but only a typed event disposes. Authority:
  // D-W8-POSTURE-REGISTER-SLICE-1; Principle 1.
  PostureRegistered: "governance",
  PostureActivated: "governance",
  PostureDeactivated: "governance",
  PostureRevised: "governance",
  // WS-V2-BBAAS S13 — eval-harness event family. An exam-set registration and
  // an eval verdict are real governance assurance records (the systematic
  // substrate that gates W8 disposal / model adoption), not simulated market
  // activity. Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT.
  ExamSetRegistered: "governance",
  EvalRunCompleted: "governance",
  // WS-V2-BBAAS S8 — applicability-assessment lifecycle. A real regulatory
  // assessment: it determines which contexts (entities / products /
  // jurisdictions) a posture / obligation / regulatory-change binds, recorded
  // as a typed, replayable verdict (not simulated market activity). Authority:
  // D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS; Principle 1.
  ApplicabilityAssessmentRequested: "governance",
  ApplicabilityAssessmentPerformed: "governance",
  ApplicabilityAssessmentConcluded: "governance",
  // WS-V2-BBAAS S9 — decision-impact sweep lifecycle (W8 governance keystone).
  // A real governance record: when a board/seat Decision lands, the sweep
  // computes which downstream artefacts (postures / FIL-Models / obligations /
  // procedures) it touches and records the impact set + recommended actions as
  // typed, replayable events — the structured replacement for the prose
  // follow-on list (not simulated market activity). Authority:
  // D-W8-DECISION-IMPACT-SWEEP; D-V2-BBAAS-BLUEPRINT-SYNTHESIS; Principle 1.
  DecisionImpactSweepRequested: "governance",
  DecisionImpactAssessed: "governance",
  // WS-V2-BBAAS W8 Slice D — per-seat context pack builder. A ContextPackBuilt
  // event records what a seat "knew" when it acted (posture slice, applicable
  // obligations, open queue, decision-impact items). Real governance audit
  // record — makes "what did the agent know?" answerable from the event log
  // (Principle 1). Authority: D-W8-PARAMETRIC-TRAINING-POSITION;
  // D-W8-EXAM-GOVERNANCE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
  ContextPackBuilt: "governance",
  // WS-V2-BBAAS S12 — cross-tenant CSI gate (competition-law keystone). The CSI
  // blocklist register + every cross-tenant learning crossing are real
  // governance / competition-law records (Competition Act 89/1998 s.4(1)),
  // minted through the CCO-governed process and the gate — never simulated
  // market activity. Third site of the three-site-registration gotcha
  // (event-types + registry + provenance-category) so the types do not resolve
  // to "simulated". Authority: D-W7-VENDOR-ENTITY-STRUCTURE; Principle 1.
  CsiCategoryRegistered: "governance",
  CsiCategoryRetired: "governance",
  CrossTenantLearningScreened: "governance",
  CrossTenantLearningBlocked: "governance",
  // CCO-published best-execution tolerance schedule — a conduct-committee
  // governance record (real seat decision, not simulated market activity).
  // Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH; FAIS §16.
  BestExecutionPolicySchedule: "governance",
  // WS-REGULATORY-REVIEW-MARKER (Phase 1) — a RegulatorySourceReviewed event is
  // a real governance assurance record: it attests that a regulator's acquired
  // source text was read / LLM-reviewed and its obligations traced into the
  // bank's register, keyed to the exact source hash reviewed. Never simulated
  // market activity. Third site of the three-site-registration gotcha
  // (event-types + registry + provenance-category) so the type resolves to a
  // production category (governance) rather than "simulated"/scenario-required.
  // Authority: brief:atlas:phase-1-regulatory-review-marker-foundation-regu:2026-06-15;
  // D-REGULATORY-LIBRARY-V1; Principle 1.
  RegulatorySourceReviewed: "governance",
  // WS-V2-BBAAS S7-FIL — a FIL-Model implementation declaration (e.g. SA-CCR as
  // the first FIL-Model) is a governance record: a versioned, citable model
  // binding minted through the governed process, never simulated market
  // activity. Registered v1-side as class "governance"; this mapping keeps the
  // provenance category in lock-step so the type does not resolve to
  // "simulated" (the S3 three-site-registration defect this prevents).
  // Authority: D-FIL-FRAMEWORK-UNIFICATION; Principle 1.
  FilModelImplementationDeclared: "governance",
  // WS-V2-BBAAS — FIL instance lifecycle family. A materialised FIL instance is
  // a real anchor-book record (the native fil:inst feed for the bank's IR + FX
  // book), minted through the governed materialisation process and emitted into
  // the v2 anchor store — never simulated market activity. Registered v1-side as
  // class "governance"; this mapping keeps the provenance category in lock-step
  // (the third site of the recurring three-site-registration gotcha) so the
  // types do not resolve to "simulated".
  // Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1; Principle 1.
  FilInstrumentCreated: "governance",
  FilInstrumentAmended: "governance",
  FilInstrumentTerminated: "governance",
  // WS-V2-BBAAS A1 — FIL attribution kernel. An organisational-dimension
  // assignment (a book/desk/strategy/portfolio re-tag) and a named-slice
  // definition are real governance configuration records (a book/desk/portfolio
  // is a stored predicate, never simulated market activity), emitted into the v2
  // anchor store. Registered v1-side as class "governance"; this mapping keeps
  // the provenance category in lock-step (third site of the three-site-
  // registration gotcha) so the types do not resolve to "simulated".
  // Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL; Principle 1.
  InstrumentDimensionAssigned: "governance",
  SliceDefined: "governance",
  OrgHierarchyEdgeAssigned: "governance",
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
  // WS-MONEY-DECIMAL-PURGE-REMEDIATION Wave 1 — money-bearing transactional
  // event types that were previously UNCATEGORISED (returned <none>), so the
  // slice-4 config-only purge allow-list silently RETAINED them, leaving 496
  // financial-transaction events in the canonical store. Each is now mapped to
  // its correct transactional category so a config-only purge sweeps it and the
  // residual-minor gate is load-bearing. Authority: D-MONEY-DECIMAL-PURGE-
  // REMEDIATION (CEO-approved 2026-06-14, be0580ff).
  //
  // --- Settlements (settlement instructions / custodian confirmations) ---
  // FX leg settlement instruction (near/far) — a settlement message.
  FxSettlementInstructed: "settlement",
  // Bond settlement instruction (DvP nominal + dirty consideration).
  BondSettlementInstructed: "settlement",
  // Bond custodian settlement confirmation (cash leg + securities leg status).
  BondCustodianSettlementConfirmed: "settlement",
  // A4 — FX book EOD valuation snapshot. Category "accounting" (derived
  // snapshot; must survive config-only purges so the prior-day anchor is
  // preserved). Authority: D-FIL-BOOK-COMPOSITE-VALUATION.
  FxBookValuationSnapshotted: "accounting",
  // --- Accounting (GL / journal / realised-P&L postings) ---
  // A manual journal entry (balanced legs into the GL) — an accounting posting.
  ManualJournalEntry: "accounting",
  // Realised P&L recognition on FCY disposal — a GL recognition event.
  RealisedPnlRecognised: "accounting",
  // IAS 21 §28 forward-points daily amortisation — an accounting accrual event.
  // (D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL gap closure, 2026-06-15).
  FxForwardPointsAccrued: "accounting",
  // --- Market-data / valuation / MtM / AVA / exposure computations ---
  // Daily MtM run summary (total P&L delta from revaluation) — a valuation run.
  MtmRunCompleted: "market-data",
  // Fair-value / prudent-valuation adjustment computation (close-out bid-offer,
  // CVA, etc.) — a valuation-engine output, not a config seed.
  ValuationAdjustmentComputed: "market-data",
  // Prudent-valuation AVA aggregation (Σ of valuation adjustments) — valuation.
  PrudentValuationAvaAggregated: "market-data",
  // SA-CCR exposure-at-default computation (rc/pfe/alpha/ead). A valuation /
  // exposure computation, not a config seed. (No "*Minor"/MoneyWire field so the
  // structural money-detector does not flag it, but it is a transactional
  // valuation output the config-only purge must sweep.)
  CcrEadComputed: "market-data",
  // --- Product-control P&L reporting / sign-off family (accounting) ---
  // These are product-control postings/records carrying money figures; they are
  // operational accounting artefacts, not governance config, so a config-only
  // purge must sweep them.
  DailyPnLReportGenerated: "accounting",
  PnLAttributionGenerated: "accounting",
  PnLFlashRecorded: "accounting",
  PnLFlashActualReconciled: "accounting",
  PnLSignedOff: "accounting",
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
