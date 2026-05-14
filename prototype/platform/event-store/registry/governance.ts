// platform/event-store/registry/governance.ts
//
// F-021 (Atlas, 2026-05-12): governance, audit, legal-entity, party,
// product-lifecycle, RMS, RAS, and readiness-snapshot event-type registry rows.
//
// Covers:
//   - Governance: CeoDecision, WorkstreamStarted, WorkstreamCompleted,
//     DocumentRegistered, DecisionComment, GovernanceCyclePrep,
//     ObligationsRegisterSnapshot, ObligationRegistered, M1CitationTrancheRegistered
//   - Audit: AuditFinding, ReconResult, CitationGatePassed, CitationGateFailed,
//     SubstrateStateSnapshot, DashboardProjectionRefreshed, DataProjectionSnapshot,
//     MarketsProjectionRegistered, MarketsProjectionRefreshed,
//     ThreatModelDimensionRegistered, SecurityGateRegistered, SecuritySubstrateSnapshot,
//     InboxHygieneSweep
//   - Legal entity: LegalEntityRegistered (deprecated), LegalEntityChanged,
//     IntraGroupArrangementSigned
//   - Party (D-PARTY-REGISTER): PartyRegistered, PartyAttributeChanged,
//     PartyClassified, PartyDeclassified, PartyScreeningCompleted,
//     PartyRelationshipAsserted, PartyRelationshipChanged, PartyRelationshipRevoked,
//     BeneficialOwnerChainAsserted, PartyDeactivated
//   - Product lifecycle (D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2): 12 events
//   - RMS (D-RMS-PHASE-1 Slice 2): AgentBriefIssued, DecisionRequested,
//     Feedback, BriefSuperseded, RecordFiled
//   - RAS: RasLineCalibrated
//   - Readiness snapshots: MLROAttestation, AccountingReadinessSnapshot,
//     AgentOpsReadinessSnapshot

import {
  agentFeedbackIssuedPayloadSchema,
  agentPerformanceEvaluatedPayloadSchema,
} from "../event-types/performance";
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
} from "../../../domains/party";
import {
  agentBriefIssuedPayloadSchema,
  briefSupersededPayloadSchema,
  decisionCommentPayloadSchema,
  decisionRequestedPayloadSchema,
  documentRegisteredPayloadSchema,
  feedbackPayloadSchema,
  intraGroupArrangementSignedPayloadSchema,
  legalEntityChangedPayloadSchema,
  legalEntityRegisteredPayloadSchema,
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
  rasLineCalibratedPayloadSchema,
  recordFiledPayloadSchema,
} from "../event-types";
import {
  accountingReadinessSnapshotPayloadSchema,
  agentOpsReadinessSnapshotPayloadSchema,
  mlroAttestationPayloadSchema,
} from "../event-types-readiness-snapshots";
import {
  type EventTypeMetadata,
  RETENTION_ACCOUNTING_7Y,
  RETENTION_BANKING_5Y,
  RETENTION_FIC_5Y,
  RETENTION_GOVERNANCE_7Y,
  RETENTION_RUNTIME_1Y,
} from "./types";

// Governance / audit / observation event types currently in flight.
// These predate A0 (already emitted by handlers); registered here for
// completeness so the registry covers what the event store actually
// contains.
export const GOVERNANCE_EVENT_TYPES: readonly EventTypeMetadata[] = [
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

export const AUDIT_EVENT_TYPES: readonly EventTypeMetadata[] = [
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
  // (CEO approved 2026-05-07).
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
export const LEGAL_ENTITY_EVENT_TYPES: readonly EventTypeMetadata[] = [
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
// event-type registry-coverage gaps.
// ===========================================================================

export const PARTY_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
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
// from proposal through retirement (source brief §4).
export const PRODUCT_LIFECYCLE_EVENT_TYPES: readonly EventTypeMetadata[] = [
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
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09).
// Author: Owen (Company Secretary, governance) +
//         Atlas (Core banking platform architect, engineering)
// ===========================================================================

export const RMS_EVENT_TYPES: readonly EventTypeMetadata[] = [
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

export const RAS_EVENT_TYPES: readonly EventTypeMetadata[] = [
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
// `platform/event-store/event-types-readiness-snapshots.ts`.
export const READINESS_SNAPSHOT_EVENT_TYPES: readonly EventTypeMetadata[] = [
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

// ===========================================================================
// Agent performance management event family.
//
// Authority: Sade mandate (AgentOps) — performance evaluation cadence;
//            Atlas (Core banking platform architect) — projection integration.
// Author: Mira (Compliance / RegTech engineer, engineering)
// ===========================================================================

export const PERFORMANCE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "AgentPerformanceEvaluated",
    class: "audit",
    payloadSchema: agentPerformanceEvaluatedPayloadSchema,
    issuer: "Sade",
    subscribers: ["Atlas", "Vera", "Thandiwe", "dashboard"],
    // Append-only audit — each evaluation period is a distinct snapshot;
    // projections aggregate the series rather than overwrite.
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ORG-GV-21"],
    // Performance evaluations are governance-grade audit records —
    // 7y retention consistent with director-decision and audit-trail
    // requirements (Companies Act / BCBS Principle IX).
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/sade-performance-evaluator.ts; Mira performance substrate",
  },
  {
    type: "AgentFeedbackIssued",
    class: "audit",
    payloadSchema: agentFeedbackIssuedPayloadSchema,
    issuer: "Sade",
    subscribers: ["Atlas", "Vera", "dashboard"],
    // Paired with AgentPerformanceEvaluated — but modelled as append-only
    // since feedback delivery is a separate durable fact.
    replay: "append-only-audit",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "runtime/agents/sade-performance-evaluator.ts; Mira performance substrate",
  },
];
