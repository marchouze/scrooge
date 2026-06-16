// v2-core/governance-attestation/index.ts
//
// Barrel export for the Wave 2 batch-2 governance-attestation + money-free-risk
// sub-package.
//
// Public surface:
//   events      — re-declared money-free payload schemas for seven V1 domains
//                 (kyc, cae-governance, ciso-governance, governance-seat-runs,
//                 obligation-lifecycle, policy-activation, decision-distillation)
//                 + the batch type/schema manifest.
//   projection  — GovernanceAttestationRegister, foldGovernanceAttestationRegister
//                 (the event-list parity projection).
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./events";
export * from "./projection";
