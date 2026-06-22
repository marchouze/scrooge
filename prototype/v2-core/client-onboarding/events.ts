// v2-core/client-onboarding/events.ts
//
// BORN-V2 client (counterparty) onboarding event family. This is the V2-native
// re-build of the V1 institutional-client lifecycle — it copies the SHAPE of the
// V1 family (domains/customer/types.ts + platform/lifecycle/onboarding-
// orchestrator.ts) but imports NONE of it. The lifecycle SHAPE is reproduced;
// the V1 code is not.
//
// PACKAGE BOUNDARY: no v1 imports permitted (D-V1-REMOVAL-PHASE-1;
// recon:v2-no-v1-import). The only dependencies are `zod` and the v2-core
// fil-core primitives. Identity lineage to the Party axis is carried as a plain
// `partyRef` string — we deliberately do NOT import the V1 `domains/party`
// family (Party URN discipline lives on the V1 side; the V2 family records the
// ref, never the type).
//
// Lifecycle SHAPE (monotonic; mirrors the V1 21-phase orchestrator, condensed to
// the gating set the recon gate enforces):
//
//   sounding → prospect-registered → kyc-passed → sanctions-cleared
//     → fais-classified → bo-resolved → fatca-crs-classified → popia-recorded
//     → credit-assessed → accounts-setup → activated  (terminal)
//                                                       → offboarded (terminal)
//
// Each phase is a typed, citable, replayable event. The projection
// (`projection.ts`) folds ONLY these events. A counterparty MUST NOT reach
// `activated` without every gating upstream event — the recon gate
// (`recon:v2-client-onboarding-integrity`) asserts this fail-closed.
//
// Authority: D-V1-REMOVAL-PHASE-1 (born V2; v2Status v2-native);
//   WS-V2-CLIENT-ONBOARDING; brief:atlas:v2-client-onboarding-family-onboard-15-
//   sim-clien:2026-06-22.
// Regulatory SHAPE-source citations (copied from V1, not imported):
//   FIC Act 38/2001 s.21/s.21B/s.28A (KYC/CDD, BO resolution, sanctions);
//   FAIS Act 37/2002 s.45 + GCC s.2(1) (FAIS categorisation);
//   IRS IRC §1471–1474 + OECD CRS (FATCA/CRS); POPIA s.11 (consent);
//   Banks Act 94/1990 (counterparty credit / accounts).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { citationRefSchema, instantSchema } from "../fil-core/primitives";

// ---------------------------------------------------------------------------
// Closed vocabularies
// ---------------------------------------------------------------------------

/** KYC tier — mirrors the V1 `KycTier`. */
export const CLIENT_KYC_TIERS = ["Tier-1", "Tier-2"] as const;
export type ClientKycTier = (typeof CLIENT_KYC_TIERS)[number];
export const clientKycTierSchema = z.enum(CLIENT_KYC_TIERS);

/** Counterparty sector — the business kind of the onboarded party. */
export const CLIENT_SECTORS = ["banking", "corporate", "sovereign", "fund", "other"] as const;
export type ClientSector = (typeof CLIENT_SECTORS)[number];
export const clientSectorSchema = z.enum(CLIENT_SECTORS);

/** FAIS client category — mirrors the V1 `CounterpartyFaisClassifiedPayload`. */
export const CLIENT_FAIS_CATEGORIES = [
  "professional-client",
  "retail-client",
  "market-counterparty",
] as const;
export type ClientFaisCategory = (typeof CLIENT_FAIS_CATEGORIES)[number];
export const clientFaisCategorySchema = z.enum(CLIENT_FAIS_CATEGORIES);

/** FATCA status — mirrors the V1 `FatcaCrsClassifiedPayload`. */
export const CLIENT_FATCA_STATUSES = ["us-person", "non-us-person", "exempt"] as const;
export type ClientFatcaStatus = (typeof CLIENT_FATCA_STATUSES)[number];
export const clientFatcaStatusSchema = z.enum(CLIENT_FATCA_STATUSES);

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const counterpartyId = z.string().min(1);
const reviewerRef = z.string().min(1); // seat ref / Party URN ref (lineage only)

// ---------------------------------------------------------------------------
// Event payloads — born V2 Zod `.strict()` schemas
// ---------------------------------------------------------------------------

/** Phase 0 — a new counterparty enters the onboarding pipeline. */
export const clientSoundingOpenedPayloadSchema = z
  .object({
    counterpartyId,
    channel: z.enum(["introduction", "inbound", "outbound", "event"]),
    introSource: z.string().min(1).optional(),
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientSoundingOpenedPayload = z.infer<typeof clientSoundingOpenedPayloadSchema>;

/** Phase 1 — the prospect's legal identity is registered. */
export const clientProspectRegisteredPayloadSchema = z
  .object({
    counterpartyId,
    legalName: z.string().min(1),
    /** ISO 3166-1 alpha-2 jurisdiction of incorporation. */
    jurisdiction: z.string().min(1),
    sector: clientSectorSchema,
    /** Party-axis lineage ref (string only — V2 never imports the V1 party type). */
    partyRef: z.string().min(1).optional(),
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientProspectRegisteredPayload = z.infer<typeof clientProspectRegisteredPayloadSchema>;

/** Phase 2 — KYC/CDD completed (gating). FIC Act 38/2001 s.21. */
export const clientKycPassedPayloadSchema = z
  .object({
    counterpartyId,
    tier: clientKycTierSchema,
    pep: z.boolean(),
    jurisdictionalRiskScore: z.enum(["low", "medium", "high"]),
    reviewerRef,
    passedAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientKycPassedPayload = z.infer<typeof clientKycPassedPayloadSchema>;

/** Phase 3 — sanctions screening cleared (gating). FIC Act 38/2001 s.28A. */
export const clientSanctionsClearedPayloadSchema = z
  .object({
    counterpartyId,
    screeningProvider: z.string().min(1),
    screeningRef: z.string().min(1),
    clearedAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientSanctionsClearedPayload = z.infer<typeof clientSanctionsClearedPayloadSchema>;

/** Phase 4 — FAIS categorisation (gating). FAIS Act 37/2002 s.45. */
export const clientFaisClassifiedPayloadSchema = z
  .object({
    counterpartyId,
    faisCategory: clientFaisCategorySchema,
    classifiedAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientFaisClassifiedPayload = z.infer<typeof clientFaisClassifiedPayloadSchema>;

/** Phase 5 — beneficial-ownership resolution (gating). FIC Act 38/2001 s.21B. */
export const clientBeneficialOwnerResolvedPayloadSchema = z
  .object({
    counterpartyId,
    beneficialOwners: z
      .array(
        z
          .object({
            partyRef: z.string().min(1),
            ownershipPct: z.number().min(0).max(100),
            controlBasis: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    resolvedAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientBeneficialOwnerResolvedPayload = z.infer<
  typeof clientBeneficialOwnerResolvedPayloadSchema
>;

/** Phase 6 — FATCA/CRS classification (gating). IRS IRC §1471–1474; OECD CRS. */
export const clientFatcaCrsClassifiedPayloadSchema = z
  .object({
    counterpartyId,
    fatcaStatus: clientFatcaStatusSchema,
    /** ISO 3166-1 alpha-2 CRS tax-residency. */
    crsResidency: z.string().min(1),
    classifiedAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientFatcaCrsClassifiedPayload = z.infer<
  typeof clientFatcaCrsClassifiedPayloadSchema
>;

/** Phase 7 — POPIA processing consent recorded (gating). POPIA s.11. */
export const clientPopiaConsentRecordedPayloadSchema = z
  .object({
    counterpartyId,
    consentScope: z.array(z.string().min(1)).min(1),
    recordedAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientPopiaConsentRecordedPayload = z.infer<
  typeof clientPopiaConsentRecordedPayloadSchema
>;

/** Phase 8 — internal credit assessment completed (gating). */
export const clientCreditAssessedPayloadSchema = z
  .object({
    counterpartyId,
    creditGrade: z.string().min(1),
    /** Exposure limit — canonical decimal string in MAJOR units (no JS number). */
    exposureLimit: z
      .object({ currency: z.string().length(3), amount: z.string().min(1) })
      .strict(),
    assessedAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientCreditAssessedPayload = z.infer<typeof clientCreditAssessedPayloadSchema>;

/** Phase 9 — settlement / nostro accounts set up (gating). */
export const clientAccountsSetupPayloadSchema = z
  .object({
    counterpartyId,
    accounts: z
      .array(
        z
          .object({
            accountId: z.string().min(1),
            currency: z.string().length(3),
            accountType: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
    setupAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientAccountsSetupPayload = z.infer<typeof clientAccountsSetupPayloadSchema>;

/** Phase 10 — counterparty activated (terminal-success). */
export const clientActivatedPayloadSchema = z
  .object({
    counterpartyId,
    activatedAt: instantSchema,
    activatedBy: z.string().min(1),
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientActivatedPayload = z.infer<typeof clientActivatedPayloadSchema>;

/** Off-ramp — counterparty offboarded (terminal). */
export const clientOffboardedPayloadSchema = z
  .object({
    counterpartyId,
    reason: z.string().min(1),
    offboardedAt: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ClientOffboardedPayload = z.infer<typeof clientOffboardedPayloadSchema>;

// ---------------------------------------------------------------------------
// Event-kind constants (`export const X = "..." as const` — born-V2 idiom)
// ---------------------------------------------------------------------------

export const CLIENT_SOUNDING_OPENED = "ClientOnboardingSoundingOpened" as const;
export const CLIENT_PROSPECT_REGISTERED = "ClientOnboardingProspectRegistered" as const;
export const CLIENT_KYC_PASSED = "ClientOnboardingKycPassed" as const;
export const CLIENT_SANCTIONS_CLEARED = "ClientOnboardingSanctionsCleared" as const;
export const CLIENT_FAIS_CLASSIFIED = "ClientOnboardingFaisClassified" as const;
export const CLIENT_BO_RESOLVED = "ClientOnboardingBeneficialOwnerResolved" as const;
export const CLIENT_FATCA_CRS_CLASSIFIED = "ClientOnboardingFatcaCrsClassified" as const;
export const CLIENT_POPIA_RECORDED = "ClientOnboardingPopiaConsentRecorded" as const;
export const CLIENT_CREDIT_ASSESSED = "ClientOnboardingCreditAssessed" as const;
export const CLIENT_ACCOUNTS_SETUP = "ClientOnboardingAccountsSetup" as const;
export const CLIENT_ACTIVATED = "ClientOnboardingActivated" as const;
export const CLIENT_OFFBOARDED = "ClientOnboardingOffboarded" as const;

export const CLIENT_ONBOARDING_EVENT_KINDS = [
  CLIENT_SOUNDING_OPENED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_KYC_PASSED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_FAIS_CLASSIFIED,
  CLIENT_BO_RESOLVED,
  CLIENT_FATCA_CRS_CLASSIFIED,
  CLIENT_POPIA_RECORDED,
  CLIENT_CREDIT_ASSESSED,
  CLIENT_ACCOUNTS_SETUP,
  CLIENT_ACTIVATED,
  CLIENT_OFFBOARDED,
] as const;

export type ClientOnboardingEventKind = (typeof CLIENT_ONBOARDING_EVENT_KINDS)[number];

/**
 * Map of kind → payload schema. Used by the registry adapter (V1 side) and the
 * recon gate to validate replayed payloads without re-declaring shapes.
 */
export const CLIENT_ONBOARDING_PAYLOAD_SCHEMAS = {
  [CLIENT_SOUNDING_OPENED]: clientSoundingOpenedPayloadSchema,
  [CLIENT_PROSPECT_REGISTERED]: clientProspectRegisteredPayloadSchema,
  [CLIENT_KYC_PASSED]: clientKycPassedPayloadSchema,
  [CLIENT_SANCTIONS_CLEARED]: clientSanctionsClearedPayloadSchema,
  [CLIENT_FAIS_CLASSIFIED]: clientFaisClassifiedPayloadSchema,
  [CLIENT_BO_RESOLVED]: clientBeneficialOwnerResolvedPayloadSchema,
  [CLIENT_FATCA_CRS_CLASSIFIED]: clientFatcaCrsClassifiedPayloadSchema,
  [CLIENT_POPIA_RECORDED]: clientPopiaConsentRecordedPayloadSchema,
  [CLIENT_CREDIT_ASSESSED]: clientCreditAssessedPayloadSchema,
  [CLIENT_ACCOUNTS_SETUP]: clientAccountsSetupPayloadSchema,
  [CLIENT_ACTIVATED]: clientActivatedPayloadSchema,
  [CLIENT_OFFBOARDED]: clientOffboardedPayloadSchema,
} as const satisfies Record<ClientOnboardingEventKind, z.ZodType>;
