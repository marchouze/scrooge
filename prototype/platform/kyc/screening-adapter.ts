// platform/kyc/screening-adapter.ts
//
// Thin-shim screening adapter for the KYC onboarding gateway.
//
// Authority: PROC-FC-01 (Approved), KYC/CDD/EDD Policy (BRC-approved)
// Citations: ORG-FC-03 (sanctions screening), ORG-FC-04 (PEP screening),
//   FIC-ACT-S21, FATF-REC-12
//
// Fail-closed contract: if checkSanctions or checkPEP throws, the caller
// MUST emit the screening event with result: "ERROR" and treat the
// candidate as rejected (SCREENING_ERROR). This satisfies PROC-FC-01
// steps 2–3 even before a real vendor is wired.
//
// StubScreeningAdapter is the build-phase implementation. Replace with a
// real vendor adapter (Refinitiv World-Check, ComplyAdvantage, etc.) at
// licence-day. The interface contract is unchanged.
//
// Author: Mira (Regulatory Intelligence Engineer)

export type ScreeningResult = {
  result: "CLEAR" | "HIT" | "ERROR";
  matchRefs?: string[];
  pepTier?: 1 | 2 | 3;
};

export interface ScreeningAdapter {
  /**
   * Check the candidate against consolidated sanctions lists (UN, OFAC,
   * EU, HMT, POCDATARA). Fail-closed: throws propagate as ERROR.
   */
  checkSanctions(candidateId: string, name: string, dob?: string): Promise<ScreeningResult>;

  /**
   * Check the candidate against PEP lists. Assigns a pepTier (1 = foreign
   * head of state / senior official, 2 = domestic senior official, 3 =
   * international organisation official) on HIT. Fail-closed: throws
   * propagate as ERROR.
   */
  checkPEP(candidateId: string, name: string, nationality: string): Promise<ScreeningResult>;
}

/**
 * StubScreeningAdapter — build-phase stub that always returns CLEAR.
 *
 * Fail-closed by design: if any internal logic throws, the caller
 * receives a rejected promise which it MUST handle as ERROR.
 *
 * Replace at licence-day with a real vendor implementation. The
 * ScreeningAdapter interface is the stable contract; no call-site
 * changes are required.
 */
export class StubScreeningAdapter implements ScreeningAdapter {
  async checkSanctions(
    _candidateId: string,
    _name: string,
    _dob?: string,
  ): Promise<ScreeningResult> {
    // Stub: unconditional CLEAR. Real adapter calls vendor API here.
    return { result: "CLEAR" };
  }

  async checkPEP(
    _candidateId: string,
    _name: string,
    _nationality: string,
  ): Promise<ScreeningResult> {
    // Stub: unconditional CLEAR. Real adapter calls vendor API here.
    return { result: "CLEAR" };
  }
}
