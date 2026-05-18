// platform/kyc/adapters/dha-identity.ts
//
// SA Home Affairs (DHA) identity verification adapter.
//
// Simulate mode (KYC_ADAPTER_MODE=simulate or unset):
//   - idNumber ending in "0001" → valid/matched
//   - idNumber ending in "0002" → expired
//   - idNumber ending in "0003" → not-found
//   - idNumber ending in "0004" → name-mismatch
//   - others                   → valid/matched
//
// Live mode: TODO — replace with actual DHA / eNaTIS API integration at
// licence-day. The interface contract below is stable.
//
// Fail-closed: any exception returns `{ ok: false, result: { matched: false, status: "not-found" } }`.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   FIC-ACT-38-2001 s.21 (customer identification); AML-CFT-POLICY-V1.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { KYCAdapter, KYCAdapterResult } from "./types";
import { adapterMode } from "./types";

export interface DHAIdentityInput {
  idNumber: string;
  surname: string;
  dob: string; // ISO 8601 date
}

export interface DHAIdentityResult {
  matched: boolean;
  status: "valid" | "expired" | "not-found" | "name-mismatch";
  name?: string; // canonical name from DHA when matched
}

export class DHAIdentityAdapter implements KYCAdapter<DHAIdentityInput, DHAIdentityResult> {
  async check(input: DHAIdentityInput): Promise<KYCAdapterResult<DHAIdentityResult>> {
    try {
      if (adapterMode() === "live") {
        // TODO: integrate with DHA / eNaTIS identity verification API.
        // Expected contract:
        //   POST https://dha.gov.za/api/verify
        //   { idNumber, surname, dob } → { verified: bool, name: string, status: string }
        throw new Error("DHA live adapter not yet implemented — licence-day integration required");
      }

      return this._simulate(input);
    } catch (_err) {
      // Fail-closed: adapter failure returns not-found shape.
      return {
        ok: false,
        result: { matched: false, status: "not-found" },
      };
    }
  }

  private _simulate(input: DHAIdentityInput): KYCAdapterResult<DHAIdentityResult> {
    const suffix = input.idNumber.slice(-4);

    if (suffix === "0002") {
      return {
        ok: true,
        result: { matched: false, status: "expired" },
        simulationScenario: "id-expired",
      };
    }

    if (suffix === "0003") {
      return {
        ok: true,
        result: { matched: false, status: "not-found" },
        simulationScenario: "id-not-found",
      };
    }

    if (suffix === "0004") {
      return {
        ok: true,
        result: { matched: false, status: "name-mismatch" },
        simulationScenario: "name-mismatch",
      };
    }

    // Default (including suffix "0001") → valid
    return {
      ok: true,
      result: {
        matched: true,
        status: "valid",
        name: `${input.surname.toUpperCase()}, SIMULATED`,
      },
      simulationScenario: "valid",
    };
  }
}

/** Singleton for convenience imports. */
export const dhaIdentityAdapter = new DHAIdentityAdapter();
