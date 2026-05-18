// platform/projections/kyc/index.ts
//
// Public surface of the KYC candidate projection.
//
// Authority: D-LIFECYCLE-SLICE-2 (onboarding Slice 2);
//            AML-CFT-POLICY-V1; FIC-ACT-38-2001.
//
// Authors: Anya (Data / analytics engineer, engineering)

export { kycCandidateProjection } from "./kyc-candidate-projection";
export type {
  KycCandidateProjectionState,
  KycCandidateState,
  KycCandidateStatus,
} from "./types";
// D-KYC-ONBOARDING-BUILD — additional gateway projections.
export { clientsProjection } from "./clients-projection";
export type {
  ClientCategory,
  ClientEntityType,
  ClientRiskBand,
  ClientState,
  ClientsProjectionState,
} from "./clients-projection";
export { kycChecksProjection } from "./kyc-checks-projection";
export type {
  CheckStatus,
  KYCCheckResult,
  KYCChecksProjectionState,
  KYCChecksState,
  KYCCheckType,
} from "./kyc-checks-projection";
