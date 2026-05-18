// platform/kyc/adapters/index.ts
//
// Public surface of the KYC adapter layer.
//
// All adapters implement KYCAdapter<TInput, TResult> and support two modes:
//   - simulate (default, KYC_ADAPTER_MODE=simulate): deterministic responses
//   - live (KYC_ADAPTER_MODE=live): real API calls (TODO at licence-day)
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
// Author: Atlas (Core banking platform architect, engineering).

export type { KYCAdapter, KYCAdapterResult } from "./types";
export { adapterMode } from "./types";

export type { DHAIdentityInput, DHAIdentityResult } from "./dha-identity";
export { DHAIdentityAdapter, dhaIdentityAdapter } from "./dha-identity";

export type { CIPCCompanyInput, CIPCCompanyResult } from "./cipc-company";
export { CIPCCompanyAdapter, cipcCompanyAdapter } from "./cipc-company";

export type {
  ScreeningAdapterInput,
  ScreeningAdapterResult,
  ScreeningHit,
  SanctionsList,
} from "./screening-adapter";
export { ScreeningAdapter, screeningAdapter } from "./screening-adapter";

export type { PEPAdverseMediaInput, PEPAdverseMediaResult } from "./pep-adverse-media";
export { PEPAdverseMediaAdapter, pepAdverseMediaAdapter } from "./pep-adverse-media";

export type { CreditBureauInput, CreditBureauResult } from "./credit-bureau";
export { CreditBureauAdapter, creditBureauAdapter } from "./credit-bureau";

export type { BankAccountVerifyInput, BankAccountVerifyResult } from "./bank-account-verify";
export { BankAccountVerifyAdapter, bankAccountVerifyAdapter } from "./bank-account-verify";
