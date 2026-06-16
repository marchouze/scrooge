// v2-core/governance-attestation/events.ts
//
// Wave 2 batch-2 governance-attestation + money-free-risk event-payload schemas
// — the v2-native MIRRORS of seven MONEY-FREE V1 domains, re-declared inside the
// v2-core package so the v2 type registry can validate them (the v2 package has a
// HARD no-v1-import boundary — `recon:v2-no-v1-import` — so the V1 schemas under
// `platform/` cannot be imported here; they are faithfully re-declared).
//
// DOMAINS IN THIS BATCH (all verified money-free — no `*Minor` / MoneyWire /
// notional / ZAR-amount fields; numeric values are integer counts, percentages
// [0..100], weights [0..1], and risk scores — reference / governance data, not
// bank money):
//
//   1. kyc                    — KYCIdentityCollected / Verified /
//                               VerificationFailed, KYCSanctionsPEPScreened,
//                               KYCUBOResolved, KYCRiskRated, KYCEDDInitiated /
//                               Completed, KYCDecisionMade, ClientAccepted /
//                               Rejected, LawfulProcessingRegistered,
//                               KYCRefreshScheduled / Completed, KYCRatingRevised,
//                               CounterpartyCategorised / Declined,
//                               OdpCounterpartyCategorised (18 types)
//   2. cae-governance         — AuditPlanUpdated, AuditIssueTrackerReviewed,
//                               QaipAttestationFiled, ThirdLineOpinionFiled
//                               (4 types)
//   3. ciso-governance        — CisoJs2AttestationFiled, SbomReviewCompleted,
//                               ThreatModelGateCompleted, KeyCeremonyAttested
//                               (4 types)
//   4. governance-seat-runs   — GovernanceSeatRunCompleted,
//                               GovernanceAttestationFiled,
//                               SuspiciousActivityQueueReviewed,
//                               AmlRiskAssessmentCompleted, EddQueueReviewed
//                               (5 types)
//   5. obligation-lifecycle   — ObligationAdopted, ObligationLifecycleTransitioned,
//                               ProvisionScopeAdopted (3 types)
//   6. policy-activation       — PolicyVersionActivated (1 type)
//   7. decision-distillation   — DecisionDistilled (1 type)
//
// SOURCE-OF-TRUTH: the canonical V1 schemas live in
//   platform/event-store/event-types/{kyc,cae-governance,ciso-governance,
//   governance-seat-runs,obligation-lifecycle,policy-activation,
//   decision-distillation}.ts
// These v2 copies are kept structurally identical. The registry test
// (`v2-core/governance-attestation/schema-parity.test.ts`) asserts each v2 schema
// accepts the same canonical sample the V1 emitter produces and rejects what the
// V1 source rejects, so drift is caught in CI — the v2 schema may NOT be weaker
// than its V1 source (Charter cmd 3: no green by concealment / weakened
// assertions).
//
// EXCLUDED (no silent skip — Charter cmd 5):
//   - The dispatch / RMS substrate: `runtime` (AgentRunStarted / Completed /
//     Failed, dispatch, escalation) + the governance RMS family (Decision,
//     RecordFiled, AgentBriefIssued, correspondence / feedback / brief). Emitted
//     LIVE by the orchestration machinery; needs a careful Wave-3 substrate plan
//     (separate, CEO-reviewed). Left v1-only.
//
// DEFERRED to a later money-codec batch (money-bearing — verbatim tee unsafe;
// no silent skip):
//   - conduct        — `notional: z.number()` + `currency` + flat-fee amounts.
//   - alco           — `projectedHQLAZar`, `floorZar` (ZAR money as `z.number()`).
//   - climate-risk   — `totalExposureZAR`, `carbonIntensiveExposureZAR`,
//                      `stressLossZAR` (ZAR money).
//   - model-risk     — `ModelValidationApproved` is double-registered (model-risk
//                      AND market-data registries); flipping one row leaves the
//                      type's two rows with split v2Status. The whole model-risk
//                      family is deferred to its own PR (batch-1 carved it out too).
//
// PACKAGE BOUNDARY: no v1 imports. Only bare `zod`.
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC
//   (both CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-4-batch-2-money-free-risk-governance-atte:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

// ===========================================================================
// Shared primitives (re-declared, no v1 import).
// ===========================================================================

/** Quarter period — `YYYY-QN`. Mirrors the V1 governance regex. */
const quarterPeriodSchema = z.string().regex(/^\d{4}-Q[1-4]$/, {
  message: "period must be YYYY-QN (e.g. 2026-Q2)",
});

/** decisionId — mirrors `platform/event-store/event-types/decision.ts`. */
const decisionIdSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^D-[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/, {
    message: "decisionId must match /^D-[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/ (e.g. `D-RMS-PHASE-1`)",
  });

// ===========================================================================
// 1. kyc
// ===========================================================================

const directorSchema = z.object({
  name: z.string().min(1),
  id_number: z.string().min(1),
  role: z.string().min(1),
});

const uboSchema = z.object({
  name: z.string().min(1),
  id_number: z.string().min(1),
  nationality: z.string().min(1),
  ownership_pct: z.number().min(0).max(100),
  basis_of_control: z.string().min(1),
});

const documentSchema = z.object({
  type: z.string().min(1),
  hash: z.string().min(1),
});

const sanctionsListSchema = z.enum(["un", "ofac", "eu", "uk-hmt", "sa-pocdatara"]);

const hitSchema = z.object({
  list: z.string().min(1),
  name: z.string().min(1),
  score: z.number().min(0).max(100),
});

const uboChainItemSchema = z.object({
  name: z.string().min(1),
  id_number: z.string().min(1),
  nationality: z.string().min(1),
  residence_country: z.string().min(1),
  ownership_pct: z.number().min(0).max(100),
  basis_of_control: z.string().min(1),
  dha_verified: z.boolean(),
  pep_flag: z.boolean(),
});

const riskFactorSchema = z.object({
  factor_name: z.string().min(1),
  weight: z.number().min(0).max(1),
  value: z.number().min(0).max(100),
});

export const kycIdentityCollectedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  directors: z.array(directorSchema).default([]),
  ubos: z.array(uboSchema).default([]),
  documents: z.array(documentSchema).min(1),
  collectedAt: z.string().min(1),
});

export const kycIdentityVerifiedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  adapter: z.enum(["dha", "cipc"]),
  result: z.enum(["matched", "partial"]),
  verifiedAt: z.string().min(1),
});

export const kycIdentityVerificationFailedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  adapter: z.enum(["dha", "cipc"]),
  reason: z.enum(["not-found", "expired", "name-mismatch", "adapter-unavailable"]),
  failedAt: z.string().min(1),
});

export const kycSanctionsPEPScreenedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  lists_checked: z.array(sanctionsListSchema).min(1),
  result: z.enum(["clean", "hit", "false-positive"]),
  hits: z.array(hitSchema).default([]),
  pep_flag: z.boolean(),
  pep_linked: z.boolean(),
  screenedAt: z.string().min(1),
});

export const kycUBOResolvedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  ubo_chain: z.array(uboChainItemSchema).min(1),
  ubo_opaque_structure: z.boolean(),
  resolvedAt: z.string().min(1),
});

export const kycRiskRatedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  score: z.number().min(0).max(100),
  band: z.enum(["low", "medium", "high"]),
  factors: z.array(riskFactorSchema).min(1),
  ratedAt: z.string().min(1),
});

export const kycEDDInitiatedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  reason: z.enum([
    "pep",
    "high-risk-jurisdiction",
    "complex-structure",
    "sanctions-adjacent",
    "other",
  ]),
  initiatedBy: z.string().min(1),
  initiatedAt: z.string().min(1),
});

export const kycEDDCompletedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  mlro_sign_off_event_id: z.string().min(1),
  outcome: z.enum(["proceed", "reject"]),
  completedAt: z.string().min(1),
});

export const kycDecisionMadePayloadSchema = z.object({
  candidateId: z.string().min(1),
  decision: z.enum(["accept", "reject", "refer"]),
  reason: z.string().min(1),
  decided_by: z.string().min(1),
  decidedAt: z.string().min(1),
});

export const clientAcceptedPayloadSchema = z
  .object({
    candidateId: z.string().min(1),
    clientId: z.string().min(1).optional(),
    entityName: z.string().min(1).optional(),
    entityType: z.enum(["company", "trust", "partnership", "individual-sole-trader"]).optional(),
    jurisdiction: z.string().min(1).optional(),
    riskBand: z.enum(["low", "medium", "high"]).optional(),
    category: z.enum(["EC", "PC"]).optional(),
    acceptedAt: z.string().min(1).optional(),
  })
  .passthrough();

export const clientRejectedPayloadSchema = z.object({
  candidateId: z.string().min(1),
  reason: z.string().min(1),
  rejectedAt: z.string().min(1),
});

export const lawfulProcessingRegisteredPayloadSchema = z.object({
  clientId: z.string().min(1),
  lawful_basis: z.enum(["legitimate-interest", "legal-obligation", "contract"]),
  processing_purposes: z.array(z.string().min(1)).min(1),
  registeredAt: z.string().min(1),
});

export const kycRefreshScheduledPayloadSchema = z.object({
  clientId: z.string().min(1),
  cadence: z.enum(["annual", "semi-annual"]),
  triggerReason: z.enum(["calendar", "event-triggered"]),
  scheduledFor: z.string().min(1),
  scheduledAt: z.string().min(1),
});

export const kycRefreshCompletedPayloadSchema = z.object({
  clientId: z.string().min(1),
  refreshId: z.string().min(1),
  nextDueDate: z.string().min(1),
  completedAt: z.string().min(1),
});

export const kycRatingRevisedPayloadSchema = z
  .object({
    clientId: z.string().min(1),
    refreshId: z.string().min(1),
    oldBand: z.enum(["low", "medium", "high"]),
    newBand: z.enum(["low", "medium", "high"]),
    mlro_sign_off_event_id: z.string().optional(),
    revisedAt: z.string().min(1),
  })
  .refine(
    (data) => {
      const riskOrder = { low: 0, medium: 1, high: 2 };
      const isUpgrade = riskOrder[data.newBand] > riskOrder[data.oldBand];
      if (isUpgrade && !data.mlro_sign_off_event_id) return false;
      return true;
    },
    { message: "mlro_sign_off_event_id is required when upgrading to a higher risk band" },
  );

export const counterpartyCategorisedPayloadSchema = z.object({
  partyId: z.string().min(1),
  category: z.enum(["EC", "PC", "RC"]),
  basis: z.string().min(1),
  validUntil: z.string().min(1),
  categorisedBy: z.string().min(1),
  categorisedAt: z.string().min(1),
});

export const counterpartyDeclinedPayloadSchema = z.object({
  partyId: z.string().min(1),
  reason: z.enum(["retail-client-declined", "eligibility-failed"]),
  declinedAt: z.string().min(1),
});

export const odpCounterpartyCategorisedPayloadSchema = z.object({
  partyId: z.string().min(1),
  category: z.enum(["client", "counterparty"]),
  reason: z.string().min(1),
  electedUpCategorisation: z.boolean(),
  asOf: z.string().min(1),
});

// ===========================================================================
// 2. cae-governance
// ===========================================================================

export const auditPlanUpdatedPayloadSchema = z.object({
  runId: z.string().min(1),
  period: quarterPeriodSchema,
  auditsScheduled: z.number().int().nonnegative(),
  auditsCompleted: z.number().int().nonnegative(),
  highRiskAreasCovered: z.number().int().nonnegative(),
  planVersion: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const auditIssueTrackerReviewedPayloadSchema = z.object({
  runId: z.string().min(1),
  period: quarterPeriodSchema,
  openFindings: z.number().int().nonnegative(),
  overdueFindings: z.number().int().nonnegative(),
  criticalFindings: z.number().int().nonnegative(),
  findingsClosedThisQuarter: z.number().int().nonnegative(),
  reviewedAt: z.string().min(1),
});

export const qaipAttestationFiledPayloadSchema = z.object({
  runId: z.string().min(1),
  period: quarterPeriodSchema,
  internalAssessmentCompleted: z.boolean(),
  externalAssessmentDue: z.string().min(1),
  conformanceRating: z.enum(["generally-conforms", "partially-conforms", "does-not-conform"]),
  attestedAt: z.string().min(1),
});

export const thirdLineOpinionFiledPayloadSchema = z.object({
  runId: z.string().min(1),
  period: quarterPeriodSchema,
  opinionScope: z.string().min(1),
  overallAssurance: z.enum(["reasonable", "limited", "no-assurance"]),
  keyFindings: z.array(z.string().min(1)).min(1),
  filedAt: z.string().min(1),
});

// ===========================================================================
// 3. ciso-governance
// ===========================================================================

export const cisoJs2AttestationFiledPayloadSchema = z.object({
  runId: z.string().min(1),
  period: quarterPeriodSchema,
  attestedBy: z.literal("Senna"),
  js2Version: z.string().min(1),
  controlsAssessed: z.number().int().nonnegative(),
  findingsOpen: z.number().int().nonnegative(),
  findingsResolved: z.number().int().nonnegative(),
  overallRating: z.enum(["green", "amber", "red"]),
  attestedAt: z.string().min(1),
});

export const sbomReviewCompletedPayloadSchema = z.object({
  runId: z.string().min(1),
  period: quarterPeriodSchema,
  componentsScanned: z.number().int().nonnegative(),
  vulnerabilitiesFound: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  remediationDeadline: z.string().min(1),
  reviewedAt: z.string().min(1),
});

export const threatModelGateCompletedPayloadSchema = z.object({
  runId: z.string().min(1),
  period: quarterPeriodSchema,
  systemsReviewed: z.number().int().nonnegative(),
  threatsIdentified: z.number().int().nonnegative(),
  controlsAdequate: z.boolean(),
  gateStatus: z.enum(["passed", "conditional", "failed"]),
  completedAt: z.string().min(1),
});

export const keyCeremonyAttestedPayloadSchema = z.object({
  runId: z.string().min(1),
  period: quarterPeriodSchema,
  ceremonyType: z.string().min(1),
  participantCount: z.number().int().positive(),
  witnessedBy: z.string().min(1),
  keyMaterialIntact: z.boolean(),
  completedAt: z.string().min(1),
});

// ===========================================================================
// 4. governance-seat-runs
// ===========================================================================

export const governanceSeatRunCompletedPayloadSchema = z.object({
  seatId: z.string().min(1),
  agentId: z.string().min(1),
  runType: z.string().min(1),
  period: quarterPeriodSchema,
  eventsEmitted: z.number().int().nonnegative(),
  findings: z.array(z.string()),
  status: z.string().min(1),
});

export const governanceAttestationFiledPayloadSchema = z.object({
  seatId: z.string().min(1),
  attestorId: z.string().min(1),
  attestationType: z.string().min(1),
  period: z.string().min(1),
  attestedAt: z.string().min(1),
  findings: z.array(z.string()),
  policyRef: z.string().min(1),
});

export const suspiciousActivityQueueReviewedPayloadSchema = z.object({
  reviewedAt: z.string().min(1),
  queueDepth: z.number().int().nonnegative(),
  strFiled: z.number().int().nonnegative(),
  ctrFiled: z.number().int().nonnegative(),
  notes: z.string(),
});

export const amlRiskAssessmentCompletedPayloadSchema = z.object({
  assessmentType: z.string().min(1),
  period: z.string().min(1),
  riskRating: z.string().min(1),
  keyFindings: z.string(),
  policyRef: z.string().min(1),
});

export const eddQueueReviewedPayloadSchema = z.object({
  reviewedAt: z.string().min(1),
  queueDepth: z.number().int().nonnegative(),
  signed: z.boolean(),
  notes: z.string(),
});

// ===========================================================================
// 5. obligation-lifecycle
// ===========================================================================

export const obligationAdoptedPayloadSchema = z.object({
  obligationId: z.string().min(1),
  urn: z.string(),
  domain: z.string(),
  citation: z.string(),
  requirement: z.string(),
  fulfilmentPolicy: z.string(),
  owner: z.string(),
  status: z.string(),
  derivesFrom: z.array(z.string().min(1)).optional(),
  verbatimSourceText: z.record(z.string()).optional(),
  adoptedAt: z.string().min(1),
});

export const obligationLifecycleTransitionedPayloadSchema = z.object({
  obligationId: z.string().min(1),
  transition: z.enum([
    "policy-assigned",
    "procedure-linked",
    "control-implemented",
    "attested",
    "un-adopted",
    "retired",
    "superseded",
  ]),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  detail: z.string().optional(),
  at: z.string().min(1),
});

export const provisionScopeAdoptedPayloadSchema = z.object({
  instrumentSlug: z.string().min(1),
  scopeId: z.string().min(1),
  adopted: z.boolean(),
  adoptedBy: z.string(),
  adoptedAt: z.string().min(1),
  verbatimHash: z.string(),
});

// ===========================================================================
// 6. policy-activation
// ===========================================================================

export const policyVersionActivatedPayloadSchema = z.object({
  policyDomain: z.enum(["valuation", "accounting-ifrs", "fx-translation"]),
  policyId: z.string().min(1),
  version: z.string().min(1),
  effectiveFrom: z.string().min(1),
  documentHash: z.string().regex(/^blake3:[0-9a-f]{64}$/),
  supersedes: z.string().min(1).nullable(),
  activatedBy: z.string().min(1),
});

// ===========================================================================
// 7. decision-distillation
// ===========================================================================

export const decisionDistilledPayloadSchema = z.object({
  decisionId: decisionIdSchema,
  class: z.enum(["foundational", "directional", "obsolete"]),
  rationale: z.string().min(1),
  citations: z.array(z.string().min(1)).readonly(),
  distilledBy: z.string().min(1),
  workstream: z.string().min(1),
});

// ===========================================================================
// Manifest — every batch-2 event type paired with its v2 schema.
//
// The registry maps these into tee-enabled foothold rows; the parity gate folds
// an event-list register over exactly this type set on both stores; the
// schema-parity test all read this list so the three stay in lock-step.
// ===========================================================================

export const GOVERNANCE_ATTESTATION_BATCH_2_SCHEMAS = {
  // kyc
  KYCIdentityCollected: kycIdentityCollectedPayloadSchema,
  KYCIdentityVerified: kycIdentityVerifiedPayloadSchema,
  KYCIdentityVerificationFailed: kycIdentityVerificationFailedPayloadSchema,
  KYCSanctionsPEPScreened: kycSanctionsPEPScreenedPayloadSchema,
  KYCUBOResolved: kycUBOResolvedPayloadSchema,
  KYCRiskRated: kycRiskRatedPayloadSchema,
  KYCEDDInitiated: kycEDDInitiatedPayloadSchema,
  KYCEDDCompleted: kycEDDCompletedPayloadSchema,
  KYCDecisionMade: kycDecisionMadePayloadSchema,
  ClientAccepted: clientAcceptedPayloadSchema,
  ClientRejected: clientRejectedPayloadSchema,
  LawfulProcessingRegistered: lawfulProcessingRegisteredPayloadSchema,
  KYCRefreshScheduled: kycRefreshScheduledPayloadSchema,
  KYCRefreshCompleted: kycRefreshCompletedPayloadSchema,
  KYCRatingRevised: kycRatingRevisedPayloadSchema,
  CounterpartyCategorised: counterpartyCategorisedPayloadSchema,
  CounterpartyDeclined: counterpartyDeclinedPayloadSchema,
  OdpCounterpartyCategorised: odpCounterpartyCategorisedPayloadSchema,
  // cae-governance
  AuditPlanUpdated: auditPlanUpdatedPayloadSchema,
  AuditIssueTrackerReviewed: auditIssueTrackerReviewedPayloadSchema,
  QaipAttestationFiled: qaipAttestationFiledPayloadSchema,
  ThirdLineOpinionFiled: thirdLineOpinionFiledPayloadSchema,
  // ciso-governance
  CisoJs2AttestationFiled: cisoJs2AttestationFiledPayloadSchema,
  SbomReviewCompleted: sbomReviewCompletedPayloadSchema,
  ThreatModelGateCompleted: threatModelGateCompletedPayloadSchema,
  KeyCeremonyAttested: keyCeremonyAttestedPayloadSchema,
  // governance-seat-runs
  GovernanceSeatRunCompleted: governanceSeatRunCompletedPayloadSchema,
  GovernanceAttestationFiled: governanceAttestationFiledPayloadSchema,
  SuspiciousActivityQueueReviewed: suspiciousActivityQueueReviewedPayloadSchema,
  AmlRiskAssessmentCompleted: amlRiskAssessmentCompletedPayloadSchema,
  EddQueueReviewed: eddQueueReviewedPayloadSchema,
  // obligation-lifecycle
  ObligationAdopted: obligationAdoptedPayloadSchema,
  ObligationLifecycleTransitioned: obligationLifecycleTransitionedPayloadSchema,
  ProvisionScopeAdopted: provisionScopeAdoptedPayloadSchema,
  // policy-activation
  PolicyVersionActivated: policyVersionActivatedPayloadSchema,
  // decision-distillation
  DecisionDistilled: decisionDistilledPayloadSchema,
} as const;

export type GovernanceAttestationBatch2Type = keyof typeof GOVERNANCE_ATTESTATION_BATCH_2_SCHEMAS;

/** Sorted array of the batch's event-type names. */
export const GOVERNANCE_ATTESTATION_BATCH_2_TYPES: readonly GovernanceAttestationBatch2Type[] =
  Object.keys(GOVERNANCE_ATTESTATION_BATCH_2_SCHEMAS).sort() as GovernanceAttestationBatch2Type[];
