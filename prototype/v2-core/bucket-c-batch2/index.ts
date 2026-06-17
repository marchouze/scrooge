// v2-core/bucket-c-batch2/index.ts
//
// Bucket C — bulk batch 2: non-load-bearing control-plane substrate types.
//
// WHAT THIS IS
// ------------
// The single source of truth for the 68 money-free, non-load-bearing bucket-C
// substrate types migrated to the v2 control-plane store via the proven
// store-tee verbatim path (D-BANK-WIDE-V2-MIGRATION). The registry rows
// (`v2-core/registry/index.ts`) and the batch parity gate
// (`platform/recon/bucket-c-batch2-v2-parity.ts`) both derive their type set
// from `BUCKET_C_BATCH2_TYPES` here, so the two can never drift. Direct
// continuation of bucket-C batch 1 (#1408, ratchet 460→403); identical pattern.
//
// Domain grouping (scope §1.1 / appendix §7, non-load-bearing only):
//   - C-7 CISO / security-process (20).
//   - C-5 party / product-lifecycle (29).
//   - C-8 legal / privacy-process (19).
//
// EXPLICITLY EXCLUDED (held for later batches / CEO checkpoint):
//   - The 14 load-bearing dispatch types (RMS registers, run-lifecycle,
//     workstream lifecycle, ReconResult) — Scrooge owns the run lifecycle.
//   - SubstrateAlert (store-tee self-reference hazard, scope §4.3),
//     ScheduledTrigger / SubstrateAgentRunStarted/Completed/Failed
//     (runtime-emitted; sequenced for a dedicated later batch).
//   - The batch-1 set (57 types, #1408) and the pilot pair.
//   - C-4 governance-process remainder, C-6 HR remainder (done in batch 1 / N/A),
//     C-9 audit-process / readiness, and the C-3 agent-lifecycle remainder are
//     deferred to batch 3.
//
// THE SCHEMA CONTRACT — why opaque, not re-declared (Charter cmd 3 + 6)
// --------------------------------------------------------------------
// The store-tee mirrors each V1 append VERBATIM (identity codec) reusing the V1
// event_id. The V1 store is authoritative and ALREADY validated the event's
// concrete payload against its real V1 schema at emit time. The v2 mirror is a
// byte-faithful copy; the parity gate proves byte-equivalence of the
// {event_id, type, payload} tuple. The faithful v2-side schema for a verbatim
// mirror is therefore "an object, validated upstream" — the SHARED opaque
// `bucketCVerbatimSchema` (a `Record<string, unknown>`) reused from batch 1.
// This is NOT a weakened assertion: it is the correct contract for a verbatim
// tee, and the byte-tuple parity gate is the hard backstop that catches any real
// divergence the moment data lands. Re-declaring 68 concrete schemas behind the
// no-v1-import boundary would add drift-prone duplication with no extra safety
// over the byte-parity gate, since the payload is never re-shaped.
//
// PACKAGE BOUNDARY: inside `v2-core/` — MUST NOT import from any v1 code-line
// directory (`recon:v2-no-v1-import`). Only re-exports the batch-1 opaque schema
// (itself a bare-zod construct).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-batch2-ciso-party-legal-substrate-types:2026-06-17.
// Author: Atlas (Core banking platform architect, engineering).

export { bucketCVerbatimSchema } from "../bucket-c-batch1";

/**
 * The 68 non-load-bearing bucket-C substrate types migrated in batch 2. The
 * registry rows and the parity gate derive from this single list.
 */
export const BUCKET_C_BATCH2_TYPES = [
  // --- C-7 CISO / security-process (20) ---
  "SecurityIncidentRaised",
  "KeyRotationDue",
  "DependencyVulnDetected",
  "SuspiciousAuthEvent",
  "SBOMRequired",
  "SBOMAcceptanceRequired",
  "MergeRequested",
  "KeyCeremonyScheduled",
  "VendorSecurityReview",
  "RegulatorCyberInquiry",
  "ThreatModelGateDecision",
  "ThreatModelExceptionRequested",
  "CyberResilienceSnapshot",
  "OperationalResilienceSnapshot",
  "EventSchemaProposal",
  "EventSchemaPublished",
  "IdentityPermissionChangeProposal",
  "ChangeApprovalRequested",
  "SLOBudgetBurn",
  "CapacityBreach",
  // --- C-5 party / product-lifecycle (29) ---
  "LegalEntityRegistered",
  "LegalEntityChanged",
  "IntraGroupArrangementSigned",
  "PartyRegistered",
  "PartyAttributeChanged",
  "PartyClassified",
  "PartyDeclassified",
  "PartyScreeningCompleted",
  "PartyRelationshipAsserted",
  "PartyRelationshipChanged",
  "PartyRelationshipRevoked",
  "BeneficialOwnerChainAsserted",
  "PartyDeactivated",
  "ProductProposalRegistered",
  "ProductConceptualised",
  "ProductDueDiligenceCompleted",
  "ProductDueDiligenceWithheld",
  "ProductDimensionAttested",
  "ProductApproved",
  "ProductWithheld",
  "ProductLaunched",
  "ProductPostImplementationReviewCompleted",
  "ProductReviewCompleted",
  "ProductRetired",
  "ProductVersionPublished",
  "ProductPostApprovalFinding",
  "ProductDimensionRetrospectiveReview",
  "ProductDimensionNarrativeRequested",
  "ProductDimensionNarrativeRecorded",
  // --- C-8 legal / privacy-process (19) ---
  "LegalDocumentationSigned",
  "JurisdictionalOpinionRefreshed",
  "LegalEntityChange",
  "ContractDraftRequested",
  "ClauseChangeProposed",
  "SignatureRequested",
  "ECTAExceptionFlagged",
  "MOIChangeProposed",
  "ConflictDeclared",
  "ResolutionRequired",
  "DSARReceived",
  "DSARClosed",
  "DSARExtended",
  "NewProcessingPurposeProposed",
  "ConsentWithdrawn",
  "CrossBorderTransferRequested",
  "InformationRegulatorInquiry",
  "POPIAControlsSnapshot",
  "PersonalInformationCompromiseSuspected",
] as const;

export type BucketCBatch2Type = (typeof BUCKET_C_BATCH2_TYPES)[number];
