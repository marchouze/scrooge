// platform/kyc/adapters/bank-account-verify.ts
//
// Bank account verification adapter — BankservAfrica-style AVS (Account
// Verification Service).
//
// Simulate mode (KYC_ADAPTER_MODE=simulate or unset):
//   - accountNumber ending in "0" → not-found
//   - accountNumber ending in "9" → mismatch (account holder name mismatch)
//   - others                       → verified
//
// Live mode: TODO — integrate with BankservAfrica AVS or equivalent at
// licence-day. The bank is an indirect NPS participant and routes payments
// via its correspondent bank (CLAUDE.md — payments model).
//
// Fail-closed: any exception returns `{ ok: false, result: { status: "not-found" } }`.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   Financial Intelligence Centre Act 38/2001 s.21 (customer identification);
//   National Payments System Act 78/1998.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { KYCAdapter, KYCAdapterResult } from "./types";
import { adapterMode } from "./types";

export interface BankAccountVerifyInput {
  accountNumber: string;
  branchCode: string;
  accountHolder: string;
}

export interface BankAccountVerifyResult {
  status: "verified" | "mismatch" | "not-found";
}

export class BankAccountVerifyAdapter
  implements KYCAdapter<BankAccountVerifyInput, BankAccountVerifyResult>
{
  async check(
    input: BankAccountVerifyInput,
  ): Promise<KYCAdapterResult<BankAccountVerifyResult>> {
    try {
      if (adapterMode() === "live") {
        // TODO: integrate with BankservAfrica AVS or correspondent bank
        // account verification API at licence-day.
        // Expected contract:
        //   POST /api/avs { accountNumber, branchCode, accountHolder }
        //   → { verified: bool, status: string }
        throw new Error(
          "Bank account verification live adapter not yet implemented — licence-day integration required",
        );
      }

      return this._simulate(input);
    } catch (_err) {
      // Fail-closed: any adapter failure → not-found.
      return {
        ok: false,
        result: { status: "not-found" },
      };
    }
  }

  private _simulate(
    input: BankAccountVerifyInput,
  ): KYCAdapterResult<BankAccountVerifyResult> {
    const lastDigit = input.accountNumber.slice(-1);

    if (lastDigit === "0") {
      return {
        ok: true,
        result: { status: "not-found" },
        simulationScenario: "not-found",
      };
    }

    if (lastDigit === "9") {
      return {
        ok: true,
        result: { status: "mismatch" },
        simulationScenario: "mismatch",
      };
    }

    // Default → verified
    return {
      ok: true,
      result: { status: "verified" },
      simulationScenario: "verified",
    };
  }
}

/** Singleton for convenience imports. */
export const bankAccountVerifyAdapter = new BankAccountVerifyAdapter();
