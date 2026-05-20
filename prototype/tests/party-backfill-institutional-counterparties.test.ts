// tests/party-backfill-institutional-counterparties.test.ts
//
// Asserts step 6 of `runPartyBackfill` — institutional-counterparty Party
// rows in `seeds/party-register.json` (slugs not in the Hoz group) are
// emitted as `PartyRegistered{kind: "legal-entity"}` events.
//
// Canonical first batch (2026-05-20) — Standard Bank Corporate Treasury +
// Investec Bank Treasury for the FX-spot controlled-launch (Helena's
// MR-1-FX limit proposal PR #634; Imani's G-9 close PR #637).
//
// Authority: D-PARTY-REGISTER (CEO-approved 2026-05-11) +
// D-PARTY-REGISTER-CORRECTION (CEO-approved 2026-05-12) — kind is
// intrinsic, counterparty is relational; institutional counterparties
// register as `legal-entity` with a separate `counterparty-of` edge.
//
// Author: Saskia (Chief Markets Officer, governance) co-author Imani
// (Chief Legal Counsel, governance).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "bun:test";

const ISOLATED_DIR = mkdtempSync(join(tmpdir(), "party-backfill-cp-test-"));
process.env.BANK_EVENT_DB = join(ISOLATED_DIR, "event.db");

// Imports after BANK_EVENT_DB set so the singleton resolves to the
// isolated store.
const { eventStore } = await import("../platform/composition");
const { runPartyBackfill } = await import("../scripts/party-backfill");

interface PartyRegisteredPayload {
  partyId: string;
  kind: string;
  displayName: string;
  legalName?: string;
  jurisdictions: readonly string[];
  kindAttributes: {
    kind: string;
    entityForm?: string;
    lei?: string;
    primaryRegulator?: string;
    regimeAnchor?: readonly string[];
  };
}

function findParty(partyId: string): PartyRegisteredPayload | undefined {
  for (const event of eventStore.replay({ type: "PartyRegistered" })) {
    const p = event.payload as unknown as PartyRegisteredPayload;
    if (p.partyId === partyId) return p;
  }
  return undefined;
}

describe("party-backfill — institutional counterparty step", () => {
  beforeAll(() => {
    runPartyBackfill(eventStore, { asOf: "2026-05-20T18:00:00.000Z" });
  });

  it("emits the Standard Bank Corporate Treasury legal-entity Party", () => {
    const p = findParty("urn:party:legal-entity:standard-bank-za");
    expect(p).toBeDefined();
    expect(p?.kind).toBe("legal-entity");
    expect(p?.displayName).toBe("Standard Bank Corporate Treasury");
    expect(p?.legalName).toBe("The Standard Bank of South Africa Limited");
    expect(p?.jurisdictions).toEqual(["ZA"]);
    expect(p?.kindAttributes.entityForm).toBe("Ltd");
    expect(p?.kindAttributes.primaryRegulator).toBe("PA");
    expect(p?.kindAttributes.lei).toBe("QFC8ZCW3Q5PRXU1XTM60");
  });

  it("emits the Investec Bank Treasury legal-entity Party", () => {
    const p = findParty("urn:party:legal-entity:investec-bank-za");
    expect(p).toBeDefined();
    expect(p?.kind).toBe("legal-entity");
    expect(p?.displayName).toBe("Investec Bank Treasury");
    expect(p?.legalName).toBe("Investec Bank Limited");
    expect(p?.jurisdictions).toEqual(["ZA"]);
    expect(p?.kindAttributes.entityForm).toBe("Ltd");
    expect(p?.kindAttributes.primaryRegulator).toBe("PA");
    expect(p?.kindAttributes.lei).toBe("549300RH5FFHO48FXT69");
  });

  it("regimeAnchor records the CIPC registration number and SARB Banks Act licence-number-TBC gap", () => {
    const standardBank = findParty("urn:party:legal-entity:standard-bank-za");
    const investec = findParty("urn:party:legal-entity:investec-bank-za");
    expect(standardBank?.kindAttributes.regimeAnchor?.[0]).toContain("1962/000738/06");
    expect(standardBank?.kindAttributes.regimeAnchor?.[0]).toContain("TBC");
    expect(investec?.kindAttributes.regimeAnchor?.[0]).toContain("1969/004763/06");
    expect(investec?.kindAttributes.regimeAnchor?.[0]).toContain("TBC");
  });

  it("does NOT re-emit Hoz-group legal-entity Parties (those come from step 1, not step 6)", () => {
    // After backfill, we expect exactly one PartyRegistered per Hoz entity
    // (from step 1), not duplicated from step 6.
    const hozBankEvents = [...eventStore.replay({ type: "PartyRegistered" })].filter((e) => {
      const p = e.payload as unknown as PartyRegisteredPayload;
      return p.partyId === "urn:party:legal-entity:hoz-bank";
    });
    expect(hozBankEvents).toHaveLength(1);
  });

  it("is idempotent — second run emits zero new counterparty Parties", () => {
    const beforeCount = [...eventStore.replay({ type: "PartyRegistered" })].length;
    const r = runPartyBackfill(eventStore, { asOf: "2026-05-20T18:00:00.000Z" });
    expect(r.counterpartyPartiesEmitted).toBe(0);
    const afterCount = [...eventStore.replay({ type: "PartyRegistered" })].length;
    expect(afterCount).toBe(beforeCount);
  });
});
