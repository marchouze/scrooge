// platform/kyc/adapters/cipc-company.ts
//
// CIPC (Companies and Intellectual Property Commission) company registry
// verification adapter.
//
// Simulate mode (KYC_ADAPTER_MODE=simulate or unset):
//   - registrationNumber starting with "2020" → active
//   - registrationNumber starting with "1990" → deregistered
//   - registrationNumber starting with "2019" → name-mismatch
//   - others                                  → active
//
// Live mode: TODO — replace with actual CIPC BizPortal API integration at
// licence-day. The interface contract below is stable.
//
// Fail-closed: any exception returns `{ ok: false, result: { active: false, status: "not-found" } }`.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   Companies Act 71/2008; FIC-ACT-38-2001 s.21B (legal-entity CDD).
//
// Author: Atlas (Core banking platform architect, engineering).

import type { KYCAdapter, KYCAdapterResult } from "./types";
import { adapterMode } from "./types";

export interface CIPCCompanyInput {
  registrationNumber: string;
  entityName: string;
}

export interface CIPCCompanyResult {
  active: boolean;
  status: "active" | "deregistered" | "name-mismatch" | "not-found";
  directors?: string[]; // canonical director list from CIPC when active
  registeredAddress?: string; // canonical registered address from CIPC
}

export class CIPCCompanyAdapter implements KYCAdapter<CIPCCompanyInput, CIPCCompanyResult> {
  async check(input: CIPCCompanyInput): Promise<KYCAdapterResult<CIPCCompanyResult>> {
    try {
      if (adapterMode() === "live") {
        // TODO: integrate with CIPC BizPortal API.
        // Expected contract:
        //   GET https://bizportal.gov.za/api/company/{registrationNumber}
        //   → { status: string, directors: string[], registeredAddress: string }
        throw new Error("CIPC live adapter not yet implemented — licence-day integration required");
      }

      return this._simulate(input);
    } catch (_err) {
      // Fail-closed: adapter failure returns not-found shape.
      return {
        ok: false,
        result: { active: false, status: "not-found" },
      };
    }
  }

  private _simulate(input: CIPCCompanyInput): KYCAdapterResult<CIPCCompanyResult> {
    const prefix = input.registrationNumber.slice(0, 4);

    if (prefix === "1990") {
      return {
        ok: true,
        result: { active: false, status: "deregistered" },
        simulationScenario: "deregistered",
      };
    }

    if (prefix === "2019") {
      return {
        ok: true,
        result: { active: false, status: "name-mismatch" },
        simulationScenario: "name-mismatch",
      };
    }

    // Default (including prefix "2020") → active
    return {
      ok: true,
      result: {
        active: true,
        status: "active",
        directors: ["SIMULATED DIRECTOR ONE", "SIMULATED DIRECTOR TWO"],
        registeredAddress: "1 Simulated Street, Johannesburg, 2001, ZA",
      },
      simulationScenario: "active",
    };
  }
}

/** Singleton for convenience imports. */
export const cipcCompanyAdapter = new CIPCCompanyAdapter();
