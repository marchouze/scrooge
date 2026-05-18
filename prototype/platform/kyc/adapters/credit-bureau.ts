// platform/kyc/adapters/credit-bureau.ts
//
// Credit bureau adapter — TransUnion / Experian SA (institutional).
//
// Note: This adapter is for KYC risk-scoring purposes, not credit
// decisioning. The credit assessment proper lives in Niko's onboarding
// lifecycle (CreditAssessmentCompleted event).
//
// Simulate mode (KYC_ADAPTER_MODE=simulate or unset):
//   - idNumber ending in "9" → adverse
//   - idNumber ending in "8" → bankrupt
//   - others                  → clean
//
// Live mode: TODO — integrate with TransUnion SA API at licence-day.
//
// Fail-closed: any exception returns `{ ok: false, result: { status: "adverse" } }`.
// (Conservative fail: adverse is safer than clean when bureau is unavailable.)
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   National Credit Act 34/2005; FIC-ACT-38-2001 s.21 (customer due diligence).
//
// Author: Atlas (Core banking platform architect, engineering).

import type { KYCAdapter, KYCAdapterResult } from "./types";
import { adapterMode } from "./types";

export interface CreditBureauInput {
  idNumber: string;
  entityName?: string; // for legal entities
}

export interface CreditBureauResult {
  status: "clean" | "adverse" | "bankrupt";
  score?: number; // 300-850 range (TransUnion SA convention)
  summary?: string;
}

export class CreditBureauAdapter implements KYCAdapter<CreditBureauInput, CreditBureauResult> {
  async check(input: CreditBureauInput): Promise<KYCAdapterResult<CreditBureauResult>> {
    try {
      if (adapterMode() === "live") {
        // TODO: integrate with TransUnion SA or Experian SA API at licence-day.
        // Expected contract:
        //   POST https://api.transunion.co.za/consumer/credit-report
        //   { idNumber, entityName? } → { score: number, status: string, summary: string }
        throw new Error(
          "Credit bureau live adapter not yet implemented — licence-day API integration required",
        );
      }

      return this._simulate(input);
    } catch (_err) {
      // Fail-closed (conservative): bureau unavailable → treat as adverse.
      return {
        ok: false,
        result: { status: "adverse", summary: "Bureau unavailable — treated as adverse" },
      };
    }
  }

  private _simulate(input: CreditBureauInput): KYCAdapterResult<CreditBureauResult> {
    const lastDigit = input.idNumber.slice(-1);

    if (lastDigit === "8") {
      return {
        ok: true,
        result: {
          status: "bankrupt",
          score: 300,
          summary: "Simulated: sequestration / liquidation order on record",
        },
        simulationScenario: "bankrupt",
      };
    }

    if (lastDigit === "9") {
      return {
        ok: true,
        result: {
          status: "adverse",
          score: 420,
          summary: "Simulated: adverse credit listings — arrears on record",
        },
        simulationScenario: "adverse",
      };
    }

    // Default → clean
    return {
      ok: true,
      result: {
        status: "clean",
        score: 720,
        summary: "Simulated: no adverse listings",
      },
      simulationScenario: "clean",
    };
  }
}

/** Singleton for convenience imports. */
export const creditBureauAdapter = new CreditBureauAdapter();
