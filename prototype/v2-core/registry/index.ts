// v2-core/registry/index.ts
//
// V2 event-type registry (Wave 0) — the v2-native type registry + payload
// validation that lets non-financial (governance / records / reference) events
// become canonical on the v2 control-plane store.
//
// This is the v2 MIRROR of the v1 registry barrel
// (platform/event-store/registry/index.ts). It assembles every v2-core event
// type into `V2_EVENT_TYPE_REGISTRY`, indexes them by type, and exposes:
//   - `lookupV2EventType(type)` — registered metadata, or undefined.
//   - `validateV2Payload(type, payload)` — fail-closed on a REGISTERED type's
//     bad payload; no-op on an UNREGISTERED type (build-phase forward compat,
//     so footholds keep appending until registered). The control-plane store's
//     `append()` calls this before persisting.
//
// THE 10 V2-PARALLEL FOOTHOLDS — every v2-core slice that has a v1-side
// registry row referencing its schemas (the existing parallel registration)
// is registered here as a first-class v2-native entry:
//
//   1.  control-plane  — TenantRegistered, TenantSurfaceGranted,
//                        TenantUpgradeLedgerEntry, TenantMeterEvent,
//                        FunctionalSeatRegistered
//   2.  banking        — V2ProductRegistered, V2ProductDeprecated,
//                        V2AccountTypeRegistered, V2RiskAppetiteSet
//   3.  fil-instances  — FilInstrumentCreated/Amended/Terminated
//   4.  fil-attribution— InstrumentDimensionAssigned, SliceDefined,
//                        OrgHierarchyEdgeAssigned
//   5.  posture        — PostureRegistered/Activated/Deactivated/Revised
//   6.  applicability  — ApplicabilityAssessmentRequested/Performed/Concluded
//   7.  decision-impact— DecisionImpactSweepRequested, DecisionImpactAssessed
//   8.  eval           — ExamSetRegistered, EvalRunCompleted
//   9.  context-pack   — ContextPackBuilt
//   10. cross-tenant   — CsiCategoryRegistered, CsiCategoryRetired,
//                        CrossTenantLearningScreened, CrossTenantLearningBlocked
//
// All 10 are `schemaVersion 1` and `migrationStatus "v2-parallel"` (v1 is still
// the authoritative emitter; the v2 model runs in parallel). Waves 2-4 add
// non-financial types with `migrationStatus "v2-canonical"`.
//
// BANKING NOTE: the banking slice (`v2-core/banking/events.ts`) carries a
// `kind` discriminator literal IN its payload schema (e.g.
// `kind: z.literal("V2ProductRegistered")`). The registry's `type` field and
// the payload's `kind` field therefore agree by construction — the schema
// validates the full stored payload object including the `kind` literal.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory. See `recon:v2-no-v1-import`.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16).
// Brief: brief:atlas:wave-0-v2-general-host-foundation-schemaversion-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import type { z } from "zod";

import {
  applicabilityAssessmentConcludedPayloadSchema,
  applicabilityAssessmentPerformedPayloadSchema,
  applicabilityAssessmentRequestedPayloadSchema,
} from "../applicability/events";
import {
  v2AccountTypeRegisteredSchema,
  v2ProductDeprecatedSchema,
  v2ProductRegisteredSchema,
  v2RiskAppetiteSetSchema,
} from "../banking/events";
import { BUCKET_A_A2_SPECS } from "../bucket-a-a2";
import { contextPackBuiltPayloadSchema } from "../context-pack/events";
import {
  functionalSeatRegisteredPayloadSchema,
  tenantMeterEventPayloadSchema,
  tenantRegisteredPayloadSchema,
  tenantSurfaceGrantedPayloadSchema,
  tenantUpgradeLedgerEntryPayloadSchema,
} from "../control-plane/events";
import {
  csiCategoryRegisteredPayloadSchema,
  csiCategoryRetiredPayloadSchema,
} from "../cross-tenant/csi-blocklist";
import {
  crossTenantLearningBlockedPayloadSchema,
  crossTenantLearningScreenedPayloadSchema,
} from "../cross-tenant/gate";
import {
  decisionImpactAssessedPayloadSchema,
  decisionImpactSweepRequestedPayloadSchema,
} from "../decision-impact/events";
import { evalRunCompletedPayloadSchema, examSetRegisteredPayloadSchema } from "../eval/events";
import {
  instrumentDimensionAssignedPayloadSchema,
  orgHierarchyEdgeAssignedPayloadSchema,
  sliceDefinedPayloadSchema,
} from "../fil-attribution/events";
import {
  filInstrumentAmendedPayloadSchema,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../fil-instances/events";
import {
  amlRiskAssessmentCompletedPayloadSchema,
  auditIssueTrackerReviewedPayloadSchema,
  auditPlanUpdatedPayloadSchema,
  cisoJs2AttestationFiledPayloadSchema,
  clientAcceptedPayloadSchema,
  clientRejectedPayloadSchema,
  counterpartyCategorisedPayloadSchema,
  counterpartyDeclinedPayloadSchema,
  decisionDistilledPayloadSchema,
  eddQueueReviewedPayloadSchema,
  governanceAttestationFiledPayloadSchema,
  governanceSeatRunCompletedPayloadSchema,
  keyCeremonyAttestedPayloadSchema,
  kycDecisionMadePayloadSchema,
  kycEDDCompletedPayloadSchema,
  kycEDDInitiatedPayloadSchema,
  kycIdentityCollectedPayloadSchema,
  kycIdentityVerificationFailedPayloadSchema,
  kycIdentityVerifiedPayloadSchema,
  kycRatingRevisedPayloadSchema,
  kycRefreshCompletedPayloadSchema,
  kycRefreshScheduledPayloadSchema,
  kycRiskRatedPayloadSchema,
  kycSanctionsPEPScreenedPayloadSchema,
  kycUBOResolvedPayloadSchema,
  lawfulProcessingRegisteredPayloadSchema,
  obligationAdoptedPayloadSchema,
  obligationLifecycleTransitionedPayloadSchema,
  odpCounterpartyCategorisedPayloadSchema,
  policyVersionActivatedPayloadSchema,
  provisionScopeAdoptedPayloadSchema,
  qaipAttestationFiledPayloadSchema,
  sbomReviewCompletedPayloadSchema,
  suspiciousActivityQueueReviewedPayloadSchema,
  thirdLineOpinionFiledPayloadSchema,
  threatModelGateCompletedPayloadSchema,
} from "../governance-attestation/events";
import {
  backtestBreachDisposedPayloadSchema,
  backtestRequestedPayloadSchema,
  backtestRunPayloadSchema,
  designReviewCompletePayloadSchema,
  intranetFeatureShippedPayloadSchema,
  methodologyChangeRequestedPayloadSchema,
  modelDriftDetectedPayloadSchema,
  modelSubmittedPayloadSchema,
  modelTierClassifiedPayloadSchema,
  modelValidationApprovedPayloadSchema,
  modelValidationWithheldPayloadSchema,
  paNotificationSubmittedPayloadSchema,
  productionUseRequestedPayloadSchema,
  sarbSubmissionAttemptedPayloadSchema,
  seedDescopedPayloadSchema,
  seedPromotedToSimulatedPayloadSchema,
  slaRuleApprovedPayloadSchema,
  slaRulePublishedPayloadSchema,
  slaRuleWithheldPayloadSchema,
  tradeReportSubmittedPayloadSchema,
  uxFindingRaisedPayloadSchema,
  validationFindingClosedPayloadSchema,
  validationFindingRaisedPayloadSchema,
  validationMethodologyPublishedPayloadSchema,
} from "../money-free-batch-3/events";
import {
  postureActivatedPayloadSchema,
  postureDeactivatedPayloadSchema,
  postureRegisteredPayloadSchema,
  postureRevisedPayloadSchema,
} from "../posture/events";
import {
  graphEdgeAssertedPayloadSchema,
  graphNodeAssertedPayloadSchema,
  jibarFixingPublishedPayloadSchema,
  marketDataStaleAlertPayloadSchema,
  obligationCandidateProposedPayloadSchema,
  obligationConceptLinkedPayloadSchema,
  obligationEquivalenceClassifiedPayloadSchema,
  obligationReviewCompletedPayloadSchema,
  obligationReviewConflictPayloadSchema,
  obligationReviewMatchedPayloadSchema,
  oisCurvePublishedPayloadSchema,
  regulatoryConceptExtractedPayloadSchema,
  regulatoryInstrumentAmendedPayloadSchema,
  regulatoryInstrumentContextualisedPayloadSchema,
  regulatoryInstrumentRegisteredPayloadSchema,
  regulatorySourceReviewedPayloadSchema,
  sagbYieldsPublishedPayloadSchema,
  zaroniaRatePublishedPayloadSchema,
  zaroniaTermRatePublishedPayloadSchema,
} from "../reference-data/events";
import {
  type V2EventTypeMetadata,
  type V2TeeCodec,
  type V2TeeDeclaration,
  V2_RETENTION_RUNTIME_1Y,
  VERBATIM_CODEC,
} from "./types";

export * from "./types";

// ---------------------------------------------------------------------------
// Schema-cast helper.
//
// Each slice's payload schema is typed `z.ZodType<ConcretePayload>`. The
// registry array is homogeneous (`z.ZodType<Record<string, unknown>>`), so each
// row casts at the declaration site. This is the same `as unknown as` bridge
// the v1-side adapter rows use (e.g. registry/v2-control-plane.ts) — payloads
// ARE `Record<string, unknown>` at the JSON-storage boundary; the concrete
// branded type is a compile-time refinement the homogeneous array cannot carry.
// ---------------------------------------------------------------------------

function asPayloadSchema(schema: z.ZodTypeAny): z.ZodType<Record<string, unknown>> {
  return schema as unknown as z.ZodType<Record<string, unknown>>;
}

const FOOTHOLD_SOURCE =
  "brief:atlas:wave-0-v2-general-host-foundation-schemaversion-:2026-06-16 — v2-parallel foothold";

/**
 * Shared field set for every foothold row (all v2-parallel, schemaVersion 1).
 * `tee` is optional: pass a declaration (`{}` for verbatim, or `{ codec }` for a
 * money-bearing transform) to opt the type into the generic store-tee. Omit it
 * to leave the type un-mirrored.
 */
function foothold(
  type: string,
  cls: V2EventTypeMetadata["class"],
  schema: z.ZodTypeAny,
  tee?: V2TeeDeclaration,
): V2EventTypeMetadata {
  return {
    type,
    class: cls,
    payloadSchema: asPayloadSchema(schema),
    schemaVersion: 1,
    retention: V2_RETENTION_RUNTIME_1Y,
    migrationStatus: "v2-parallel",
    ...(tee !== undefined ? { tee } : {}),
    source: FOOTHOLD_SOURCE,
  };
}

const REFERENCE_DATA_BATCH_1_SOURCE =
  "brief:atlas:wave-2-batch-1-money-free-reference-data-domains:2026-06-16 — " +
  "v2-parallel reference-data migration (tee-enabled, verbatim)";

/**
 * A Wave-2 reference-data migration row: identical to `foothold` but ALWAYS
 * tee-enabled (verbatim — money-free) and carrying the batch source string. The
 * generic store-tee mirrors every V1 append of the type; `recon:reference-data-
 * v2-parity` proves byte-clean equivalence. Onboarding a reference-data type to
 * the rollout is one `refData(...)` line — a registry edit, never a callsite edit.
 */
function refData(
  type: string,
  cls: V2EventTypeMetadata["class"],
  schema: z.ZodTypeAny,
): V2EventTypeMetadata {
  return {
    type,
    class: cls,
    payloadSchema: asPayloadSchema(schema),
    schemaVersion: 1,
    retention: V2_RETENTION_RUNTIME_1Y,
    migrationStatus: "v2-parallel",
    tee: {},
    source: REFERENCE_DATA_BATCH_1_SOURCE,
  };
}

const GOVERNANCE_ATTESTATION_BATCH_2_SOURCE =
  "brief:atlas:wave-2-4-batch-2-money-free-risk-governance-atte:2026-06-16 — " +
  "v2-parallel governance-attestation + money-free-risk migration (tee-enabled, verbatim)";

/**
 * A Wave-2 batch-2 governance-attestation migration row: identical to `refData`
 * (ALWAYS tee-enabled, verbatim — money-free) but carrying the batch-2 source
 * string. The generic store-tee mirrors every V1 append of the type; the
 * `recon:governance-attestation-v2-parity` gate proves byte-clean equivalence.
 * Onboarding a governance-attestation type is one `govAtt(...)` line — a registry
 * edit, never a callsite edit.
 */
function govAtt(
  type: string,
  cls: V2EventTypeMetadata["class"],
  schema: z.ZodTypeAny,
): V2EventTypeMetadata {
  return {
    type,
    class: cls,
    payloadSchema: asPayloadSchema(schema),
    schemaVersion: 1,
    retention: V2_RETENTION_RUNTIME_1Y,
    migrationStatus: "v2-parallel",
    tee: {},
    source: GOVERNANCE_ATTESTATION_BATCH_2_SOURCE,
  };
}

const MONEY_FREE_BATCH_3_SOURCE =
  "brief:atlas:wave-2-batch-3-remaining-money-free-domains:2026-06-16 — " +
  "v2-parallel money-free migration of the remaining self-contained domains (tee-enabled, verbatim)";

/**
 * A Wave-2 batch-3 money-free migration row: identical to `refData` / `govAtt`
 * (ALWAYS tee-enabled, verbatim — money-free) but carrying the batch-3 source
 * string. The generic store-tee mirrors every V1 append of the type; the
 * `recon:money-free-batch-3-v2-parity` gate proves byte-clean equivalence.
 * Onboarding a batch-3 type is one `mfb3(...)` line — a registry edit, never a
 * callsite edit. Used for the SIX RE-DECLARED domains; the FOOTHOLD domains
 * (v2-banking, decision-impact, v2-eval, context-pack, cross-tenant-csi,
 * applicability) are instead tee-enabled in place on their existing foothold rows.
 */
function mfb3(
  type: string,
  cls: V2EventTypeMetadata["class"],
  schema: z.ZodTypeAny,
): V2EventTypeMetadata {
  return {
    type,
    class: cls,
    payloadSchema: asPayloadSchema(schema),
    schemaVersion: 1,
    retention: V2_RETENTION_RUNTIME_1Y,
    migrationStatus: "v2-parallel",
    tee: {},
    source: MONEY_FREE_BATCH_3_SOURCE,
  };
}

const BUCKET_A_A2_SOURCE =
  "brief:atlas:bucket-a-a2-emittable-numeric-money-types:2026-06-16 — " +
  "v2-parallel money-BEARING migration of nine emittable numeric-money non-financial types " +
  "(store-tee + MoneyWire codec; decoded-decimal parity via recon:bucket-a-a2-v2-parity)";

/**
 * A Wave-2 Bucket-A batch-A2 migration row: ALWAYS tee-enabled with a
 * money-BEARING codec (unlike `refData` / `govAtt` / `mfb3`, which are verbatim
 * money-free). The generic store-tee mirrors every V1 append, lifting the
 * legacy numeric money field(s) to decimal-native `MoneyWire` via the row's
 * `tee.codec`. `recon:bucket-a-a2-v2-parity` proves the v2 store payload equals
 * `codec(v1 payload)` on the decoded decimal value. Onboarding a batch-A2 type
 * is one `BUCKET_A_A2_SPECS` entry — a registry edit, never a callsite edit.
 */
function bucketAA2(
  type: string,
  cls: V2EventTypeMetadata["class"],
  schema: z.ZodTypeAny,
  codec: V2TeeCodec,
): V2EventTypeMetadata {
  return {
    type,
    class: cls,
    payloadSchema: asPayloadSchema(schema),
    schemaVersion: 1,
    retention: V2_RETENTION_RUNTIME_1Y,
    migrationStatus: "v2-parallel",
    tee: { codec },
    source: BUCKET_A_A2_SOURCE,
  };
}

// ---------------------------------------------------------------------------
// The registry — every foothold event type with its Zod schema.
// ---------------------------------------------------------------------------

export const V2_EVENT_TYPE_REGISTRY: readonly V2EventTypeMetadata[] = [
  // 1. control-plane
  foothold("TenantRegistered", "runtime", tenantRegisteredPayloadSchema),
  foothold("TenantSurfaceGranted", "runtime", tenantSurfaceGrantedPayloadSchema),
  foothold("TenantUpgradeLedgerEntry", "runtime", tenantUpgradeLedgerEntryPayloadSchema),
  foothold("TenantMeterEvent", "runtime", tenantMeterEventPayloadSchema),
  foothold("FunctionalSeatRegistered", "governance", functionalSeatRegisteredPayloadSchema),

  // 2. banking (slice's own schemas — payload carries a `kind` discriminator).
  // BATCH-3 TEE: the three money-free banking types are mirrored verbatim (V1 and
  // v2 share the SAME schema object — these are true footholds, so no anti-drift
  // re-declaration is needed). V2RiskAppetiteSet is a v2-NATIVE control-plane
  // event (emitted directly by the anchor seed, not tee-mirrored); its money
  // floor was re-minted decimal-native (MoneyWire `floor`), so it is now
  // v2-replaced — see `platform/event-store/registry/v2-banking.ts`.
  foothold("V2ProductRegistered", "governance", v2ProductRegisteredSchema, {}),
  foothold("V2ProductDeprecated", "governance", v2ProductDeprecatedSchema, {}),
  foothold("V2AccountTypeRegistered", "governance", v2AccountTypeRegisteredSchema, {}),
  foothold("V2RiskAppetiteSet", "governance", v2RiskAppetiteSetSchema),

  // 3. fil-instances
  foothold("FilInstrumentCreated", "markets", filInstrumentCreatedPayloadSchema),
  foothold("FilInstrumentAmended", "markets", filInstrumentAmendedPayloadSchema),
  foothold("FilInstrumentTerminated", "markets", filInstrumentTerminatedPayloadSchema),

  // 4. fil-attribution
  foothold("InstrumentDimensionAssigned", "markets", instrumentDimensionAssignedPayloadSchema),
  foothold("SliceDefined", "markets", sliceDefinedPayloadSchema),
  foothold("OrgHierarchyEdgeAssigned", "markets", orgHierarchyEdgeAssignedPayloadSchema),

  // 5. posture — TEE-ENABLED (verbatim; money-free). The generic store-tee
  // mirrors these into the v2 control-plane store on every V1 append; the
  // generic backfill replays history. This is the same set the Wave-2 pilot
  // mirrored via the bespoke posture backfill (now delegating to the generic
  // mechanism), and `recon:posture-v2-parity` remains the byte-clean evidence.
  foothold("PostureRegistered", "governance", postureRegisteredPayloadSchema, {}),
  foothold("PostureActivated", "governance", postureActivatedPayloadSchema, {}),
  foothold("PostureDeactivated", "governance", postureDeactivatedPayloadSchema, {}),
  foothold("PostureRevised", "governance", postureRevisedPayloadSchema, {}),

  // 6. applicability — BATCH-3 TEE-ENABLED (foothold schemas; v1 has its own
  // re-declaration guarded by the batch-3 anti-drift schema-parity test).
  foothold(
    "ApplicabilityAssessmentRequested",
    "governance",
    applicabilityAssessmentRequestedPayloadSchema,
    {},
  ),
  foothold(
    "ApplicabilityAssessmentPerformed",
    "governance",
    applicabilityAssessmentPerformedPayloadSchema,
    {},
  ),
  foothold(
    "ApplicabilityAssessmentConcluded",
    "governance",
    applicabilityAssessmentConcludedPayloadSchema,
    {},
  ),

  // 7. decision-impact — BATCH-3 TEE-ENABLED.
  foothold(
    "DecisionImpactSweepRequested",
    "governance",
    decisionImpactSweepRequestedPayloadSchema,
    {},
  ),
  foothold("DecisionImpactAssessed", "governance", decisionImpactAssessedPayloadSchema, {}),

  // 8. eval — BATCH-3 TEE-ENABLED.
  foothold("ExamSetRegistered", "audit", examSetRegisteredPayloadSchema, {}),
  foothold("EvalRunCompleted", "audit", evalRunCompletedPayloadSchema, {}),

  // 9. context-pack — BATCH-3 TEE-ENABLED.
  foothold("ContextPackBuilt", "runtime", contextPackBuiltPayloadSchema, {}),

  // 10. cross-tenant — BATCH-3 TEE-ENABLED.
  foothold("CsiCategoryRegistered", "governance", csiCategoryRegisteredPayloadSchema, {}),
  foothold("CsiCategoryRetired", "governance", csiCategoryRetiredPayloadSchema, {}),
  foothold(
    "CrossTenantLearningScreened",
    "governance",
    crossTenantLearningScreenedPayloadSchema,
    {},
  ),
  foothold("CrossTenantLearningBlocked", "governance", crossTenantLearningBlockedPayloadSchema, {}),

  // ---------------------------------------------------------------------------
  // WAVE 2 BATCH-1 — money-free reference-data domains (TEE-ENABLED, verbatim).
  //
  // Four V1 reference-data domains migrated to v2-core via the generic store-tee
  // (every row carries `tee: {}` → the tee mirrors each V1 append verbatim, the
  // generic backfill replays history). All money-free (verified: no `*Minor` /
  // MoneyWire / notional-position fields; rate/score values are plain decimals).
  // The schemas are the faithful v2 re-declarations in `reference-data/events.ts`
  // (the v2 package cannot import the V1 schemas — no-v1-import boundary). The
  // batch parity gate `recon:reference-data-v2-parity` is the byte-clean evidence.
  //
  // DEFERRED (no silent skip — Charter cmd 5): isda-odp legal-terms (money-bearing
  // CSA/cross-default thresholds → need a codec), financial-instrument (nested
  // ACTUS union → own PR), market-data ModelValidationApproved (model-risk family).
  //
  // Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
  // ---------------------------------------------------------------------------

  // 11. regulatory (reference data)
  refData(
    "RegulatoryInstrumentRegistered",
    "governance",
    regulatoryInstrumentRegisteredPayloadSchema,
  ),
  refData("RegulatoryInstrumentAmended", "governance", regulatoryInstrumentAmendedPayloadSchema),
  refData(
    "RegulatoryInstrumentContextualised",
    "governance",
    regulatoryInstrumentContextualisedPayloadSchema,
  ),
  refData("RegulatoryConceptExtracted", "governance", regulatoryConceptExtractedPayloadSchema),
  refData("ObligationConceptLinked", "governance", obligationConceptLinkedPayloadSchema),
  refData("RegulatorySourceReviewed", "governance", regulatorySourceReviewedPayloadSchema),
  refData("GraphNodeAsserted", "governance", graphNodeAssertedPayloadSchema),
  refData("GraphEdgeAsserted", "governance", graphEdgeAssertedPayloadSchema),

  // 12. market-data (reference data — rate/curve publications + stale alerts)
  refData("MarketDataStaleAlert", "markets", marketDataStaleAlertPayloadSchema),
  refData("ZaroniaRatePublished", "markets", zaroniaRatePublishedPayloadSchema),
  refData("ZaroniaTermRatePublished", "markets", zaroniaTermRatePublishedPayloadSchema),
  refData("JibarFixingPublished", "markets", jibarFixingPublishedPayloadSchema),
  refData("OisCurvePublished", "markets", oisCurvePublishedPayloadSchema),
  refData("SagbYieldsPublished", "markets", sagbYieldsPublishedPayloadSchema),

  // 13. obligation-review (reference data)
  refData("ObligationReviewMatched", "governance", obligationReviewMatchedPayloadSchema),
  refData("ObligationReviewConflict", "governance", obligationReviewConflictPayloadSchema),
  refData("ObligationCandidateProposed", "governance", obligationCandidateProposedPayloadSchema),
  refData("ObligationReviewCompleted", "governance", obligationReviewCompletedPayloadSchema),

  // 14. obligation-equivalence (reference data)
  refData(
    "ObligationEquivalenceClassified",
    "governance",
    obligationEquivalenceClassifiedPayloadSchema,
  ),

  // ---------------------------------------------------------------------------
  // WAVE 2 BATCH-2 — money-free governance-attestation + KYC + lifecycle domains
  // (TEE-ENABLED, verbatim).
  //
  // Seven V1 domains migrated to v2-core via the generic store-tee (every row
  // carries `tee: {}` → the tee mirrors each V1 append verbatim; the generic
  // backfill replays history). All money-free (verified: no `*Minor` / MoneyWire /
  // notional / ZAR-amount fields — numeric values are integer counts, percentages,
  // weights [0..1], and risk scores). Schemas are the faithful v2 re-declarations
  // in `governance-attestation/events.ts` (no-v1-import boundary). The batch parity
  // gate `recon:governance-attestation-v2-parity` is the byte-clean evidence.
  //
  // EXCLUDED (Charter cmd 5): the dispatch/RMS substrate (runtime AgentRun*,
  // dispatch, escalation; Decision/RecordFiled/AgentBriefIssued/correspondence/
  // feedback/brief) — emitted LIVE by orchestration, needs a Wave-3 substrate plan.
  // DEFERRED (money-bearing → money-codec batch): conduct, alco, climate-risk.
  // DEFERRED (cross-registry split): model-risk (ModelValidationApproved is
  // double-registered) → own PR.
  //
  // Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
  // ---------------------------------------------------------------------------

  // 15. kyc (onboarding lifecycle — money-free; scores/percentages only)
  govAtt("KYCIdentityCollected", "audit", kycIdentityCollectedPayloadSchema),
  govAtt("KYCIdentityVerified", "audit", kycIdentityVerifiedPayloadSchema),
  govAtt("KYCIdentityVerificationFailed", "audit", kycIdentityVerificationFailedPayloadSchema),
  govAtt("KYCSanctionsPEPScreened", "audit", kycSanctionsPEPScreenedPayloadSchema),
  govAtt("KYCUBOResolved", "audit", kycUBOResolvedPayloadSchema),
  govAtt("KYCRiskRated", "audit", kycRiskRatedPayloadSchema),
  govAtt("KYCEDDInitiated", "audit", kycEDDInitiatedPayloadSchema),
  govAtt("KYCEDDCompleted", "audit", kycEDDCompletedPayloadSchema),
  govAtt("KYCDecisionMade", "audit", kycDecisionMadePayloadSchema),
  govAtt("ClientAccepted", "audit", clientAcceptedPayloadSchema),
  govAtt("ClientRejected", "audit", clientRejectedPayloadSchema),
  govAtt("LawfulProcessingRegistered", "audit", lawfulProcessingRegisteredPayloadSchema),
  govAtt("KYCRefreshScheduled", "audit", kycRefreshScheduledPayloadSchema),
  govAtt("KYCRefreshCompleted", "audit", kycRefreshCompletedPayloadSchema),
  govAtt("KYCRatingRevised", "audit", kycRatingRevisedPayloadSchema),
  govAtt("CounterpartyCategorised", "audit", counterpartyCategorisedPayloadSchema),
  govAtt("CounterpartyDeclined", "audit", counterpartyDeclinedPayloadSchema),
  govAtt("OdpCounterpartyCategorised", "audit", odpCounterpartyCategorisedPayloadSchema),

  // 16. cae-governance (third-line audit attestations)
  govAtt("AuditPlanUpdated", "governance", auditPlanUpdatedPayloadSchema),
  govAtt("AuditIssueTrackerReviewed", "governance", auditIssueTrackerReviewedPayloadSchema),
  govAtt("QaipAttestationFiled", "governance", qaipAttestationFiledPayloadSchema),
  govAtt("ThirdLineOpinionFiled", "governance", thirdLineOpinionFiledPayloadSchema),

  // 17. ciso-governance (security governance attestations)
  govAtt("CisoJs2AttestationFiled", "governance", cisoJs2AttestationFiledPayloadSchema),
  govAtt("SbomReviewCompleted", "governance", sbomReviewCompletedPayloadSchema),
  govAtt("ThreatModelGateCompleted", "governance", threatModelGateCompletedPayloadSchema),
  govAtt("KeyCeremonyAttested", "governance", keyCeremonyAttestedPayloadSchema),

  // 18. governance-seat-runs (CCO/CISO/CAE periodic-run + AML/CFT attestations)
  govAtt("GovernanceSeatRunCompleted", "governance", governanceSeatRunCompletedPayloadSchema),
  govAtt("GovernanceAttestationFiled", "governance", governanceAttestationFiledPayloadSchema),
  govAtt(
    "SuspiciousActivityQueueReviewed",
    "governance",
    suspiciousActivityQueueReviewedPayloadSchema,
  ),
  govAtt("AmlRiskAssessmentCompleted", "governance", amlRiskAssessmentCompletedPayloadSchema),
  govAtt("EddQueueReviewed", "governance", eddQueueReviewedPayloadSchema),

  // 19. obligation-lifecycle (bank-obligation adoption + lifecycle)
  govAtt("ObligationAdopted", "governance", obligationAdoptedPayloadSchema),
  govAtt(
    "ObligationLifecycleTransitioned",
    "governance",
    obligationLifecycleTransitionedPayloadSchema,
  ),
  govAtt("ProvisionScopeAdopted", "governance", provisionScopeAdoptedPayloadSchema),

  // 20. policy-activation (policy-version-in-force chain)
  govAtt("PolicyVersionActivated", "governance", policyVersionActivatedPayloadSchema),

  // 21. decision-distillation (BBaaS shared-core seam classification)
  govAtt("DecisionDistilled", "governance", decisionDistilledPayloadSchema),

  // ---------------------------------------------------------------------------
  // WAVE 2 BATCH-3 — remaining money-free, non-substrate domains (TEE-ENABLED,
  // verbatim).
  //
  // SIX RE-DECLARED domains (24 types). Schemas are the faithful v2 re-
  // declarations in `money-free-batch-3/events.ts` (no-v1-import boundary); the
  // anti-drift `money-free-batch-3-v2-schema-parity.test.ts` is the backstop.
  // The FOOTHOLD domains swept by this batch (v2-banking money-free x3,
  // decision-impact x2, v2-eval x2, context-pack x1, cross-tenant-csi x4,
  // applicability x3 = 15) are tee-enabled on their foothold rows above, NOT
  // re-declared here. Total batch-3 = 39 logical types.
  //
  // All money-free (verified field-by-field: no `*Minor` / MoneyWire / notional /
  // par-face / ZAR-amount fields — numeric values are integer counts, ratios,
  // metric values/thresholds, durations, and 1/2/3 tier literals). The parity
  // gate `recon:money-free-batch-3-v2-parity` is the byte-clean evidence.
  //
  // EXCLUDED (Charter cmd 5 — noted, not silently skipped):
  //   - runtime/RMS dispatch substrate (Wave-3, leave v1-only).
  //   - money-bearing: model-risk CalculationPerformed (polymorphic value, unit
  //     may be ZAR-minor), regulatory-reporting RwaComputed (*RwaMinor),
  //     financial-instrument (notional / par-face value).
  //     (V2RiskAppetiteSet's `floorZarMinor` was redenominated decimal-native to
  //     a MoneyWire `floor` and flipped v2-replaced — no longer excluded.)
  //
  // Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
  // ---------------------------------------------------------------------------

  // 22. intranet
  mfb3("IntranetFeatureShipped", "runtime", intranetFeatureShippedPayloadSchema),
  mfb3("DesignReviewComplete", "runtime", designReviewCompletePayloadSchema),
  mfb3("UXFindingRaised", "runtime", uxFindingRaisedPayloadSchema),

  // 23. sla-approval (four-eyes SLA rule approval workflow)
  mfb3("SlaRulePublished", "governance", slaRulePublishedPayloadSchema),
  mfb3("SlaRuleApproved", "governance", slaRuleApprovedPayloadSchema),
  mfb3("SlaRuleWithheld", "governance", slaRuleWithheldPayloadSchema),

  // 24. regulatory-pa (regulator-notification record)
  mfb3("PaNotificationSubmitted", "governance", paNotificationSubmittedPayloadSchema),

  // 25. seed-management (seed lifecycle)
  mfb3("SeedDescoped", "governance", seedDescopedPayloadSchema),
  mfb3("SeedPromotedToSimulated", "governance", seedPromotedToSimulatedPayloadSchema),

  // 26. model-risk (model lifecycle / validation / backtest — money-free)
  mfb3("ModelSubmitted", "governance", modelSubmittedPayloadSchema),
  mfb3("ModelTierClassified", "governance", modelTierClassifiedPayloadSchema),
  mfb3("ModelValidationApproved", "governance", modelValidationApprovedPayloadSchema),
  mfb3("ModelValidationWithheld", "governance", modelValidationWithheldPayloadSchema),
  mfb3("ValidationFindingRaised", "governance", validationFindingRaisedPayloadSchema),
  mfb3("ValidationFindingClosed", "governance", validationFindingClosedPayloadSchema),
  mfb3("BacktestRequested", "governance", backtestRequestedPayloadSchema),
  mfb3("BacktestRun", "governance", backtestRunPayloadSchema),
  mfb3("ValidationMethodologyPublished", "governance", validationMethodologyPublishedPayloadSchema),
  mfb3("BacktestBreachDisposed", "governance", backtestBreachDisposedPayloadSchema),
  mfb3("ModelDriftDetected", "governance", modelDriftDetectedPayloadSchema),
  mfb3("ProductionUseRequested", "governance", productionUseRequestedPayloadSchema),
  mfb3("MethodologyChangeRequested", "governance", methodologyChangeRequestedPayloadSchema),

  // 27. regulatory-reporting (MONEY-FREE rows only; RwaComputed deferred)
  mfb3("TradeReportSubmitted", "governance", tradeReportSubmittedPayloadSchema),
  mfb3("SarbSubmissionAttempted", "governance", sarbSubmissionAttemptedPayloadSchema),

  // ---------------------------------------------------------------------------
  // WAVE 2 BUCKET-A BATCH-A2 — nine EMITTABLE numeric-money, non-financial types
  // (TEE-ENABLED with a money-BEARING codec).
  //
  // These nine carry money as a PLAIN numeric field (not `*Minor`), so they are
  // NOT blocked by recon:no-residual-minor-encoding and stay emittable on main.
  // They dual-write via the generic store-tee: each V1 append is mirrored into
  // the v2 control-plane store with the money field LIFTED to decimal-native
  // MoneyWire by the per-type codec (v2-core/bucket-a-a2/events.ts). V1 stays
  // numeric/authoritative; the v2 mirror holds the canonical decimal.
  //
  // CURRENCY SOURCE (Charter cmd 4 — source, don't hardcode; Principle 5): each
  // codec resolves currency from the V1 payload — `currency` field where present
  // (FeeDisclosureEvent, Correspondent…, Nostro…, STRCandidate, RelatedParty…,
  // InterEntity…), or the schema-declared denomination where the field name /
  // schema doc denominates it (ClimateScenarioRun `*ZAR`, CounterpartyExposure…
  // "ZAR minor units", PAIARequest statutory ZAR PAIA fee). NOT a `?? "ZAR"`
  // fallback. Full per-type rationale: v2-core/bucket-a-a2/events.ts.
  //
  // The parity gate `recon:bucket-a-a2-v2-parity` is the DECODED-DECIMAL evidence
  // (v2 payload == codec(v1 payload)); PASS-on-empty in the build phase (all nine
  // are data-empty today — Charter cmd 5: surfaced, not hidden), load-bearing the
  // moment any event lands.
  //
  // EXCLUDED from this batch (Charter cmd 5 — noted, not silently skipped):
  //   - CalculationPerformed (model-risk): polymorphic numeric `value` + string
  //     `unit` (money AND non-money under one field); 2193 live events; a separate
  //     decimal-correctness track.
  //   - OperationalLossEvent + V2RiskAppetiteSet: un-emittable `*Minor` types →
  //     batch A3 (retired-by-construction).
  //
  // Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC;
  //   D-V2-CORE-MONEY-DECIMAL-NATIVE.
  // ---------------------------------------------------------------------------
  ...BUCKET_A_A2_SPECS.map((s) => bucketAA2(s.type, s.cls, s.schema, s.codec)),
];

// ---------------------------------------------------------------------------
// Lookup + validation surface.
// ---------------------------------------------------------------------------

const V2_REGISTRY_BY_TYPE: ReadonlyMap<string, V2EventTypeMetadata> = new Map(
  V2_EVENT_TYPE_REGISTRY.map((m) => [m.type, m]),
);

/**
 * Look up a type's registered v2 metadata. Returns `undefined` for an
 * unregistered type — the control-plane store treats that as "accept the
 * append" (build-phase forward compat) so the 10 footholds keep working before
 * they were registered, and so a Wave-2 type can be appended for a tick before
 * its registry row lands. The `recon:v2-type-registry-coverage` gate surfaces
 * appended-but-unregistered types as advisory findings.
 */
export function lookupV2EventType(type: string): V2EventTypeMetadata | undefined {
  return V2_REGISTRY_BY_TYPE.get(type);
}

/** True iff `type` is registered. */
export function isV2EventTypeRegistered(type: string): boolean {
  return V2_REGISTRY_BY_TYPE.has(type);
}

/** Every registered v2 event-type name (sorted). */
export function registeredV2EventTypes(): readonly string[] {
  return [...V2_REGISTRY_BY_TYPE.keys()].sort();
}

/**
 * True iff `type` is registered AND carries a `tee` declaration — i.e. the
 * generic store-tee mirrors its V1 appends into the v2 control-plane store. This
 * is the single source of truth for "is this type mirrored"; the composition
 * tee, the generic backfill, and the coverage recon all read it.
 */
export function isV2TeeEnabled(type: string): boolean {
  return V2_REGISTRY_BY_TYPE.get(type)?.tee !== undefined;
}

/** Every tee-enabled (mirrored) v2 event-type name (sorted). */
export function teeEnabledV2EventTypes(): readonly string[] {
  return V2_EVENT_TYPE_REGISTRY.filter((m) => m.tee !== undefined)
    .map((m) => m.type)
    .sort();
}

/**
 * Resolve the codec the tee applies when mirroring `type`. Returns the row's
 * declared `tee.codec`, falling back to `VERBATIM_CODEC` when the row is
 * tee-enabled with no explicit codec, and `undefined` when the type is not
 * tee-enabled (caller must not mirror it).
 */
export function v2TeeCodecFor(type: string): V2TeeCodec | undefined {
  const meta = V2_REGISTRY_BY_TYPE.get(type);
  if (!meta?.tee) return undefined;
  return meta.tee.codec ?? VERBATIM_CODEC;
}

/**
 * Validate a payload against the registered schema for `type`.
 *
 *   - Type registered → `schema.parse(payload)` throws on a bad payload
 *     (FAIL-CLOSED; the store propagates the throw as an append failure).
 *   - Type NOT registered → no-op (build-phase forward compat).
 *
 * This is the type-dispatched validation layer; the envelope itself is
 * validated separately by `v2EnvelopeSchema`.
 */
export function validateV2Payload(type: string, payload: Record<string, unknown>): void {
  const meta = V2_REGISTRY_BY_TYPE.get(type);
  if (!meta) return;
  meta.payloadSchema.parse(payload);
}
