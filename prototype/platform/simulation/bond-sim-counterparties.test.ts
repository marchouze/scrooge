// platform/simulation/bond-sim-counterparties.test.ts

import { describe, expect, it } from "bun:test";

import type { PartyProjection, PartyRecord } from "../identity/party-projection";
import {
  bondCounterpartiesFromPartyRegister,
  realBondCounterpartiesFromPartyRegister,
} from "./bond-sim-counterparties";

function rec(partyId: string, attrs: Record<string, unknown>): PartyRecord {
  return {
    partyId,
    kind: "legal-entity",
    displayName: partyId,
    jurisdictions: ["ZA"],
    classifications: [],
    screeningResults: [],
    kindAttributes: { kind: "legal-entity", ...attrs },
    registeredAt: "2026-01-01T00:00:00Z",
  } as unknown as PartyRecord;
}

function proj(records: PartyRecord[]): PartyProjection {
  return {
    parties: new Map(records.map((r) => [r.partyId, r])),
  } as unknown as PartyProjection;
}

describe("bondCounterpartiesFromPartyRegister", () => {
  it("includes only bond-authorised legal entities with a BIC", () => {
    const p = proj([
      rec("urn:party:legal-entity:a", {
        bic: "AAAAZAJJXXX",
        authorisedProducts: ["fx-spot", "bond"],
        lei: "LEI-A",
      }),
      // no bond authorisation
      rec("urn:party:legal-entity:b", { bic: "BBBBZAJJXXX", authorisedProducts: ["fx-spot"] }),
      // bond but no BIC
      rec("urn:party:legal-entity:c", { authorisedProducts: ["bond"] }),
      // sim, bond-authorised
      rec("urn:party:legal-entity:s", {
        bic: "SSSSZAJJXXX",
        authorisedProducts: ["bond"],
        buildPhaseStatus: "sim",
      }),
    ]);

    const all = bondCounterpartiesFromPartyRegister(p);
    expect(all.map((c) => c.partyId).sort()).toEqual([
      "urn:party:legal-entity:a",
      "urn:party:legal-entity:s",
    ]);
    expect(all[0]?.eligibleIsins.length).toBeGreaterThan(0);

    const real = realBondCounterpartiesFromPartyRegister(p);
    expect(real.map((c) => c.partyId)).toEqual(["urn:party:legal-entity:a"]);
    expect(real[0]?.isSim).toBe(false);
  });
});
