// platform/kyc/adapters/pep-adverse-media.ts
//
// PEP (Politically Exposed Person) and adverse media screening adapter.
//
// Simulate mode (KYC_ADAPTER_MODE=simulate or unset):
//   - name starting with "PEP"     → pep-direct (domestic by default)
//   - name starting with "LINKED"  → pep-linked
//   - name starting with "ADVERSE" → adverse-media-hit
//   - others                        → clean
//
// Live mode: TODO — integrate with Refinitiv World-Check or ComplyAdvantage
//   PEP database at licence-day.
//
// Fail-closed: any exception returns `{ ok: false, result: { pep_flag: false, ... } }`.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   FATF-REC-12 (PEP due diligence); FIC-ACT-38-2001 s.21A;
//   Prevention of Corrupt Activities Act 12/2004.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { KYCAdapter, KYCAdapterResult } from "./types";
import { adapterMode } from "./types";

export interface PEPAdverseMediaInput {
  name: string;
  dob?: string;
  nationality?: string;
}

export interface PEPAdverseMediaResult {
  pep_flag: boolean;
  pep_linked: boolean;
  pep_type?: "domestic" | "foreign" | "international-org";
  adverse_media: boolean;
  summary?: string;
}

export class PEPAdverseMediaAdapter
  implements KYCAdapter<PEPAdverseMediaInput, PEPAdverseMediaResult>
{
  async check(input: PEPAdverseMediaInput): Promise<KYCAdapterResult<PEPAdverseMediaResult>> {
    try {
      if (adapterMode() === "live") {
        // TODO: integrate with PEP/adverse-media vendor at licence-day.
        // Expected contract:
        //   POST /api/pep-screen { name, dob?, nationality? }
        //   → { pep: bool, pepLinked: bool, pepType?: string, adverseMedia: bool }
        throw new Error(
          "PEP/adverse-media live adapter not yet implemented — licence-day vendor integration required",
        );
      }

      return this._simulate(input);
    } catch (_err) {
      // Fail-closed: adapter failure → conservative clean shape (not a block).
      // The caller should log the failure and escalate for manual review.
      return {
        ok: false,
        result: {
          pep_flag: false,
          pep_linked: false,
          adverse_media: false,
        },
      };
    }
  }

  private _simulate(input: PEPAdverseMediaInput): KYCAdapterResult<PEPAdverseMediaResult> {
    const upper = input.name.toUpperCase();

    if (upper.startsWith("PEP")) {
      return {
        ok: true,
        result: {
          pep_flag: true,
          pep_linked: false,
          pep_type: "domestic",
          adverse_media: false,
          summary: "Simulated: directly identified as domestic PEP",
        },
        simulationScenario: "pep-direct",
      };
    }

    if (upper.startsWith("LINKED")) {
      return {
        ok: true,
        result: {
          pep_flag: false,
          pep_linked: true,
          pep_type: "foreign",
          adverse_media: false,
          summary: "Simulated: closely associated with a foreign PEP",
        },
        simulationScenario: "pep-linked",
      };
    }

    if (upper.startsWith("ADVERSE")) {
      return {
        ok: true,
        result: {
          pep_flag: false,
          pep_linked: false,
          adverse_media: true,
          summary: "Simulated: adverse media hit — financial crime related",
        },
        simulationScenario: "adverse-media-hit",
      };
    }

    // Default → clean
    return {
      ok: true,
      result: {
        pep_flag: false,
        pep_linked: false,
        adverse_media: false,
      },
      simulationScenario: "clean",
    };
  }
}

/** Singleton for convenience imports. */
export const pepAdverseMediaAdapter = new PEPAdverseMediaAdapter();
