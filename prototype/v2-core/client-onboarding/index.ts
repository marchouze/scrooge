// v2-core/client-onboarding/index.ts
//
// Barrel export for the born-V2 client (counterparty) onboarding sub-package.
//
// Public surface:
//   events     — the 12 ClientOnboarding* event payload schemas + kind constants
//                + CLIENT_ONBOARDING_EVENT_KINDS + CLIENT_ONBOARDING_PAYLOAD_SCHEMAS
//   projection — ClientOnboardingRegister, foldClientOnboardingRegister,
//                emptyClientOnboardingRegister, ClientOnboardingPhase,
//                REQUIRED_GATING_PHASES
//   fx-counterparties — fxCounterpartiesFromOnboardingRegister /
//                ...FromOnboardingEvents, isFxEligibleOnboardedClient,
//                OnboardedFxCounterparty (the onboarded→FX-eligible resolver)
//
// PACKAGE BOUNDARY: no v1 imports (D-V1-REMOVAL-PHASE-1; recon:v2-no-v1-import).
// Authority: D-V1-REMOVAL-PHASE-1; WS-V2-CLIENT-ONBOARDING.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./events";
export * from "./projection";
export * from "./fx-counterparties";
