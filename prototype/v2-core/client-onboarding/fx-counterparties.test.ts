// v2-core/client-onboarding/fx-counterparties.test.ts
//
// Unit tests for the onboarded-client → FX-counterparty resolver — the
// coherence rule of the simulated outside world (D-FX-V2-SIMULATOR-FIRST):
// a client is an FX counterparty ONLY once it reaches terminal `activated` with
// a BIC + a non-empty FX-eligible pair set. Everything short of that is excluded
// (fail-closed). No onboarding → no FX counterparty.

import { describe, expect, it } from "bun:test";

import {
  CLIENT_ACCOUNTS_SETUP,
  CLIENT_ACTIVATED,
  CLIENT_BO_RESOLVED,
  CLIENT_CREDIT_ASSESSED,
  CLIENT_FAIS_CLASSIFIED,
  CLIENT_FATCA_CRS_CLASSIFIED,
  CLIENT_KYC_PASSED,
  CLIENT_POPIA_RECORDED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_SOUNDING_OPENED,
} from "./events";
import { fxCounterpartiesFromOnboardingEvents } from "./fx-counterparties";

interface Raw {
  kind: string;
  payload: Record<string, unknown>;
  asOf: string;
}

function lifecycle(
  cp: string,
  prospectExtra: Record<string, unknown>,
  opts: { activate?: boolean } = {},
): Raw[] {
  const ev = (kind: string, extra: Record<string, unknown> = {}): Raw => ({
    kind,
    payload: { counterpartyId: cp, ...extra },
    asOf: "2026-06-22T08:00:00.000Z",
  });
  const events: Raw[] = [
    ev(CLIENT_SOUNDING_OPENED),
    ev(CLIENT_PROSPECT_REGISTERED, { legalName: cp, jurisdiction: "ZA", sector: "banking", ...prospectExtra }),
    ev(CLIENT_KYC_PASSED),
    ev(CLIENT_SANCTIONS_CLEARED),
    ev(CLIENT_FAIS_CLASSIFIED),
    ev(CLIENT_BO_RESOLVED),
    ev(CLIENT_FATCA_CRS_CLASSIFIED),
    ev(CLIENT_POPIA_RECORDED),
    ev(CLIENT_CREDIT_ASSESSED),
    ev(CLIENT_ACCOUNTS_SETUP),
  ];
  if (opts.activate !== false) events.push(ev(CLIENT_ACTIVATED));
  return events;
}

describe("fxCounterpartiesFromOnboardingRegister", () => {
  it("includes an activated client with BIC + FX pairs", () => {
    const cps = fxCounterpartiesFromOnboardingEvents(
      lifecycle("cp-bank", { bic: "ABCDZAJJXXX", fxEligiblePairs: ["USD/ZAR", "EUR/ZAR"] }),
    );
    expect(cps).toHaveLength(1);
    expect(cps[0]?.counterpartyId).toBe("cp-bank");
    expect(cps[0]?.bic).toBe("ABCDZAJJXXX");
    expect(cps[0]?.eligiblePairs).toEqual(["USD/ZAR", "EUR/ZAR"]);
  });

  it("excludes an activated client with NO BIC (onboarded ≠ FX-eligible)", () => {
    const cps = fxCounterpartiesFromOnboardingEvents(
      lifecycle("cp-corp", { fxEligiblePairs: ["USD/ZAR"] }),
    );
    expect(cps).toHaveLength(0);
  });

  it("excludes an activated client with EMPTY FX pairs", () => {
    const cps = fxCounterpartiesFromOnboardingEvents(
      lifecycle("cp-x", { bic: "ABCDZAJJXXX", fxEligiblePairs: [] }),
    );
    expect(cps).toHaveLength(0);
  });

  it("excludes a NOT-YET-activated client (no onboarding → no trading)", () => {
    const cps = fxCounterpartiesFromOnboardingEvents(
      lifecycle("cp-pending", { bic: "ABCDZAJJXXX", fxEligiblePairs: ["USD/ZAR"] }, { activate: false }),
    );
    expect(cps).toHaveLength(0);
  });

  it("returns a deterministic (sorted) order", () => {
    const cps = fxCounterpartiesFromOnboardingEvents([
      ...lifecycle("cp-zulu", { bic: "ZZZZZAJJXXX", fxEligiblePairs: ["USD/ZAR"] }),
      ...lifecycle("cp-alpha", { bic: "AAAAZAJJXXX", fxEligiblePairs: ["USD/ZAR"] }),
    ]);
    expect(cps.map((c) => c.counterpartyId)).toEqual(["cp-alpha", "cp-zulu"]);
  });
});
