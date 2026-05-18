// platform/kyc/adapters/screening-adapter.ts
//
// Consolidated sanctions + PEP screening adapter.
//
// Lists checked: UN, OFAC, EU, UK HMT, SA POCDATARA.
//
// Simulate mode (KYC_ADAPTER_MODE=simulate or unset):
//   - name starting with "SANCTION" → exact-hit
//   - name starting with "FUZZY"    → fuzzy-hit (score < 100)
//   - name starting with "FALSE"    → false-positive
//   - others                        → clean
//
// Fail-closed: if the adapter throws, returns
//   `{ ok: false, result: { status: "unavailable", hits: [] } }`.
//   The caller MUST treat `ok: false` as a screening failure and NOT
//   proceed with onboarding. This satisfies PROC-FC-01 steps 2–3.
//
// Note: This replaces / extends the existing StubScreeningAdapter in
// `platform/kyc/screening-adapter.ts`. That file remains for backward
// compatibility (legacy ScreeningAdapter interface). This file provides
// the new gateway-standard interface under `KYCAdapter`.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   FIC-ACT-38-2001 s.28A (sanctions screening); FATF-REC-6, FATF-REC-12;
//   SA POCDATARA Act 1/2004; UN Security Council Resolutions.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { KYCAdapter, KYCAdapterResult } from "./types";
import { adapterMode } from "./types";

export type SanctionsList = "un" | "ofac" | "eu" | "uk-hmt" | "sa-pocdatara";

export interface ScreeningAdapterInput {
  name: string;
  idNumber?: string;
  dob?: string;
  entityType: "natural-person" | "legal-entity";
}

export interface ScreeningHit {
  list: SanctionsList;
  name: string;
  score: number; // 0-100; 100 = exact match
}

export interface ScreeningAdapterResult {
  status: "clean" | "hit" | "fuzzy-hit" | "false-positive" | "unavailable";
  hits: ScreeningHit[];
}

const ALL_LISTS: SanctionsList[] = ["un", "ofac", "eu", "uk-hmt", "sa-pocdatara"];

export class ScreeningAdapter implements KYCAdapter<ScreeningAdapterInput, ScreeningAdapterResult> {
  async check(
    input: ScreeningAdapterInput,
  ): Promise<KYCAdapterResult<ScreeningAdapterResult>> {
    try {
      if (adapterMode() === "live") {
        // TODO: integrate with real sanctions/PEP vendor at licence-day.
        // Candidates: Refinitiv World-Check, ComplyAdvantage, Dow Jones Risk.
        // Expected contract: POST /api/screen { name, idNumber?, dob?, entityType }
        //   → { status, hits: Array<{ list, name, score }> }
        throw new Error(
          "Screening live adapter not yet implemented — licence-day vendor integration required",
        );
      }

      return this._simulate(input);
    } catch (_err) {
      // Fail-closed: any adapter failure → unavailable; caller must reject.
      return {
        ok: false,
        result: { status: "unavailable", hits: [] },
      };
    }
  }

  private _simulate(
    input: ScreeningAdapterInput,
  ): KYCAdapterResult<ScreeningAdapterResult> {
    const upper = input.name.toUpperCase();

    if (upper.startsWith("SANCTION")) {
      const hits: ScreeningHit[] = ALL_LISTS.map((list) => ({
        list,
        name: input.name,
        score: 100,
      }));
      return {
        ok: true,
        result: { status: "hit", hits },
        simulationScenario: "exact-hit",
      };
    }

    if (upper.startsWith("FUZZY")) {
      const hits: ScreeningHit[] = [
        { list: "un", name: `${input.name} SIMILAR`, score: 72 },
        { list: "ofac", name: `${input.name} SIMILAR`, score: 68 },
      ];
      return {
        ok: true,
        result: { status: "fuzzy-hit", hits },
        simulationScenario: "fuzzy-hit",
      };
    }

    if (upper.startsWith("FALSE")) {
      const hits: ScreeningHit[] = [
        { list: "eu", name: `${input.name} (DIFFERENT PERSON)`, score: 55 },
      ];
      return {
        ok: true,
        result: { status: "false-positive", hits },
        simulationScenario: "false-positive",
      };
    }

    // Default → clean
    return {
      ok: true,
      result: { status: "clean", hits: [] },
      simulationScenario: "clean",
    };
  }
}

/** Singleton for convenience imports. */
export const screeningAdapter = new ScreeningAdapter();
