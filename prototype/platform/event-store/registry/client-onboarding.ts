// platform/event-store/registry/client-onboarding.ts
//
// EventTypeMetadata rows for the BORN-V2 client (counterparty) onboarding event
// family. The 12 ClientOnboarding* phase events are registered here; the
// payload schemas are sourced via the V1-side adapter
// (`../event-types/client-onboarding`), which itself re-exports the canonical
// v2-core schemas (one grammar source; the permitted v1→v2 direction).
//
// THREE-SITE REGISTRATION (recurring gotcha — F-032):
//   1. event-types  → ../event-types/client-onboarding.ts (schema re-exports + factories)
//   2. registry     → THIS file (EventTypeMetadata rows; wired into registry/index.ts)
//   3. provenance   → ../provenance-category.ts (ClientOnboarding PREFIX → "counterparty")
//
// Born V2 (D-V1-REMOVAL-PHASE-1): every row is `v2Status: "v2-replaced"` — the
// V2 path is authoritative and there is no V1 lifecycle module behind it (the
// family never emits a `v1-only` type and never imports a V1 lifecycle module).
// "v2-replaced" is the registry's term for "V2 is the sole authority" — there is
// no separate "v2-native" status in the V2CutoverStatus union, so a born-V2
// family that has no V1 ancestor lands directly at "v2-replaced".
//
// Registry `class` taxonomy is "runtime" | "markets" | "governance" | "audit"
// (NOT a per-domain enum) — onboarding/CDD lifecycle records are audit-trail
// events, mirroring the V1 KYC registry rows (registry/kyc.ts), so every row is
// `class: "audit"`. The provenance CATEGORY (a separate axis) is "counterparty".
//
// Retention: FIC Act s.22 imposes a 5-year CDD-record floor on the gating KYC /
// sanctions / BO / FATCA-CRS / credit / accounts / activation / offboarding
// events (RETENTION_FIC_5Y); POPIA s.55 processing records carry the 7-year
// governance floor (RETENTION_GOVERNANCE_7Y) for the consent record.
//
// Replay: the terminal-state phase records (Activated / Offboarded) and the
// pair-coupled gating outcomes use `pair-coupled` (open-until-terminal); the
// append-only log phases (sounding / prospect / KYC / sanctions / FAIS / BO /
// FATCA-CRS / POPIA / credit / accounts) use `append-only-audit`. The
// projection (`v2-core/client-onboarding/projection.ts`) is the structural
// truth; these replay tags document the per-type fold discipline.
//
// Authority: D-V1-REMOVAL-PHASE-1 (born V2); WS-V2-CLIENT-ONBOARDING;
//   brief:atlas:v2-client-onboarding-family-onboard-15-sim-clien:2026-06-22.
//   FIC Act 38/2001 (KYC/CDD, BO, sanctions); FAIS Act 37/2002 (categorisation);
//   POPIA s.11/s.55 (consent / processing records); IRS IRC §1471–1474 + OECD
//   CRS (FATCA/CRS); Banks Act 94/1990 (counterparty credit / accounts).
// Author: Atlas (Core banking platform architect, engineering).

import {
  CLIENT_ACCOUNTS_SETUP,
  CLIENT_ACTIVATED,
  CLIENT_BO_RESOLVED,
  CLIENT_CREDIT_ASSESSED,
  CLIENT_FAIS_CLASSIFIED,
  CLIENT_FATCA_CRS_CLASSIFIED,
  CLIENT_KYC_PASSED,
  CLIENT_OFFBOARDED,
  CLIENT_POPIA_RECORDED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_SOUNDING_OPENED,
} from "../../../v2-core/client-onboarding/events";
import {
  clientAccountsSetupPayloadSchema,
  clientActivatedPayloadSchema,
  clientBeneficialOwnerResolvedPayloadSchema,
  clientCreditAssessedPayloadSchema,
  clientFaisClassifiedPayloadSchema,
  clientFatcaCrsClassifiedPayloadSchema,
  clientKycPassedPayloadSchema,
  clientOffboardedPayloadSchema,
  clientPopiaConsentRecordedPayloadSchema,
  clientProspectRegisteredPayloadSchema,
  clientSanctionsClearedPayloadSchema,
  clientSoundingOpenedPayloadSchema,
} from "../event-types/client-onboarding";
import { RETENTION_FIC_5Y, RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/client-onboarding.ts";

/**
 * Born-V2 client (counterparty) onboarding lifecycle event-type registry rows.
 *
 * Subscribers (seats that read the family):
 *   Zara (MLRO) — KYC / sanctions / BO / FATCA-CRS gating events.
 *   Niko (Client lifecycle) — onboarding progress + activation / offboarding.
 *   Mira (CCO / RegTech) — FAIS categorisation + POPIA consent.
 *   Helena (CRO) — credit-assessment gate.
 *   Atlas (platform) — all events for substrate monitoring.
 */
export const CLIENT_ONBOARDING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: CLIENT_SOUNDING_OPENED,
    class: "audit",
    issuer: "Niko",
    subscribers: ["Niko", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientSoundingOpenedPayloadSchema,
    source: SOURCE,
    citationsHint: ["D-V1-REMOVAL-PHASE-1", "WS-V2-CLIENT-ONBOARDING"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_PROSPECT_REGISTERED,
    class: "audit",
    issuer: "Niko",
    subscribers: ["Niko", "Zara", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientProspectRegisteredPayloadSchema,
    source: SOURCE,
    citationsHint: ["D-V1-REMOVAL-PHASE-1", "FIC-ACT-38-2001"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_KYC_PASSED,
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Niko", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientKycPassedPayloadSchema,
    source: SOURCE,
    citationsHint: ["FIC-ACT-38-2001", "FIC-ACT-38-2001-S21"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_SANCTIONS_CLEARED,
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientSanctionsClearedPayloadSchema,
    source: SOURCE,
    citationsHint: ["FIC-ACT-38-2001-S28A", "FATF-REC-6"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_FAIS_CLASSIFIED,
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Niko", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: clientFaisClassifiedPayloadSchema,
    source: SOURCE,
    citationsHint: ["FAIS-ACT-37-2002", "FAIS-GCC-S2"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_BO_RESOLVED,
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientBeneficialOwnerResolvedPayloadSchema,
    source: SOURCE,
    citationsHint: ["FIC-ACT-38-2001-S21B", "FATF-REC-10"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_FATCA_CRS_CLASSIFIED,
    class: "audit",
    issuer: "Zara",
    subscribers: ["Zara", "Mira", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientFatcaCrsClassifiedPayloadSchema,
    source: SOURCE,
    citationsHint: ["IRC-1471-1474", "OECD-CRS"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_POPIA_RECORDED,
    class: "audit",
    issuer: "Mira",
    subscribers: ["Mira", "Zara", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: clientPopiaConsentRecordedPayloadSchema,
    source: SOURCE,
    citationsHint: ["POPIA-S11", "POPIA-S55"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_CREDIT_ASSESSED,
    class: "audit",
    issuer: "Helena",
    subscribers: ["Helena", "Niko", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientCreditAssessedPayloadSchema,
    source: SOURCE,
    citationsHint: ["BANKS-ACT-94-1990", "D-CREDIT-LIMIT-ENGINE-BUILD"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_ACCOUNTS_SETUP,
    class: "audit",
    issuer: "Niko",
    subscribers: ["Niko", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientAccountsSetupPayloadSchema,
    source: SOURCE,
    citationsHint: ["BANKS-ACT-94-1990", "WS-V2-CLIENT-ONBOARDING"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_ACTIVATED,
    class: "audit",
    issuer: "Niko",
    subscribers: ["Niko", "Zara", "Mira", "Helena", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientActivatedPayloadSchema,
    source: SOURCE,
    citationsHint: ["FIC-ACT-38-2001", "WS-V2-CLIENT-ONBOARDING"],
    v2Status: "v2-replaced",
  },
  {
    type: CLIENT_OFFBOARDED,
    class: "audit",
    issuer: "Niko",
    subscribers: ["Niko", "Zara", "Atlas"],
    replay: "pair-coupled",
    retention: RETENTION_FIC_5Y,
    payloadSchema: clientOffboardedPayloadSchema,
    source: SOURCE,
    citationsHint: ["FIC-ACT-38-2001", "WS-V2-CLIENT-ONBOARDING"],
    v2Status: "v2-replaced",
  },
];
