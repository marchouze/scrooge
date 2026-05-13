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
