// tests/customer.test.ts
//
// Unit tests for the institutional client lifecycle module.
//   - Every event constructor produces a P2-valid event.
//   - Counterparty master projection advances through the expected statuses.
//   - ISDA tracker reaches ReadyToExecute and Executed only on activation.
//   - Soft-franchise (sounding-only) does not register as a prospect.
//   - As-of replay (P1) — projection at earlier time reflects earlier state.
//
// Author: Niko

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { LocalProjector } from "../platform/projections";

import {
  authorisedSignatoryAdded,
  counterpartyActivated,
  counterpartyId,
  counterpartyMaster,
  documentationDrafted,
  documentationReadyToExecute,
  isdaTracker,
  kycCompleted,
  mandateAssigned,
  prospectRegistered,
  signatoryBook,
  soundingOpened,
} from "../domains/customer";
import type { PartyId } from "../domains/party";

const human = { type: "human" as const, id: "niko@bank.local" };
const compliance = { type: "human" as const, id: "mira@bank.local" };
const sales = { type: "human" as const, id: "saskia@bank.local" };
const cite = { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] };
const fic = { actor: compliance, citations: ["FIC-S21", "FIC-GN7-RBA"] };

describe("@domains/customer onboarding", () => {
  it("rejects events with no citations (P2)", () => {
    expect(() =>
      soundingOpened(
        { counterpartyId: counterpartyId("X"), channel: "inbound" },
        { actor: human, citations: [] },
      ),
    ).toThrow(/citation/i);
  });

  it("counterparty master advances through the lifecycle statuses", () => {
    const store = new EventStore();
    const cp = counterpartyId("CP-T1");
    store.append(soundingOpened({ counterpartyId: cp, channel: "outbound" }, cite));
    store.append(
      prospectRegistered(
        {
          counterpartyId: cp,
          legalName: "Test Inst Ltd",
          jurisdiction: "ZA",
          sector: "bank",
        },
        cite,
      ),
    );
    store.append(
      kycCompleted(
        {
          counterpartyId: cp,
          tier: "Tier-1",
          pep: false,
          sanctionsClear: true,
          jurisdictionalRiskScore: "low",
          reviewerId: "urn:party:natural-person:mira-compliance" as PartyId,
        },
        fic,
      ),
    );
    store.append(
      documentationDrafted({ counterpartyId: cp, agreementType: "ISDA", version: "v1" }, cite),
    );
    store.append(
      documentationReadyToExecute(
        { counterpartyId: cp, agreementType: "ISDA", version: "v1" },
        cite,
      ),
    );
    store.append(
      mandateAssigned(
        {
          counterpartyId: cp,
          products: ["ISDA"],
          limits: { ccr_zar_minor: 1_000 },
          rasReference: "RAS-2026",
        },
        { actor: sales, citations: ["RAS-2026"] },
      ),
    );
    const projector = new LocalProjector(store);
    const master = projector.build(counterpartyMaster);
    expect(master[cp]?.status).toBe("MandateAssigned");
    expect(master[cp]?.currentTier).toBe("Tier-1");
    expect(master[cp]?.legalName).toBe("Test Inst Ltd");
    store.close();
  });

  it("soft-franchise sounding does not falsely register as prospect", () => {
    const store = new EventStore();
    const cp = counterpartyId("CP-SOFT");
    store.append(soundingOpened({ counterpartyId: cp, channel: "introduction" }, cite));
    const projector = new LocalProjector(store);
    const master = projector.build(counterpartyMaster);
    expect(master[cp]?.status).toBe("Sounding");
    expect(master[cp]?.legalName).toBeUndefined();
    store.close();
  });

  it("isda tracker transitions to ReadyToExecute on documentation event", () => {
    const store = new EventStore();
    const cp = counterpartyId("CP-T2");
    store.append(
      documentationDrafted({ counterpartyId: cp, agreementType: "ISDA", version: "v1" }, cite),
    );
    store.append(
      documentationReadyToExecute(
        { counterpartyId: cp, agreementType: "ISDA", version: "v1" },
        cite,
      ),
    );
    const projector = new LocalProjector(store);
    const tracker = projector.build(isdaTracker);
    expect(tracker[`${cp}::ISDA`]).toBe("ReadyToExecute");
    store.close();
  });

  it("isda tracker transitions ReadyToExecute → Executed on activation", () => {
    const store = new EventStore();
    const cp = counterpartyId("CP-T3");
    store.append(
      documentationDrafted({ counterpartyId: cp, agreementType: "ISDA", version: "v1" }, cite),
    );
    store.append(
      documentationReadyToExecute(
        { counterpartyId: cp, agreementType: "ISDA", version: "v1" },
        cite,
      ),
    );
    store.append(
      counterpartyActivated(
        { counterpartyId: cp, configSwitchEventId: "config-switch-1" },
        { actor: { type: "system", id: "go-live" }, citations: ["GO-LIVE-CONFIG"] },
      ),
    );
    const tracker = projector(store).build(isdaTracker);
    expect(tracker[`${cp}::ISDA`]).toBe("Executed");
    store.close();
  });

  it("signatory book accumulates entries by counterparty", () => {
    const store = new EventStore();
    const cp = counterpartyId("CP-T4");
    store.append(
      authorisedSignatoryAdded(
        {
          counterpartyId: cp,
          personId: "urn:party:natural-person:signatory-001" as PartyId,
          scope: "signatory",
          evidenceRef: "ev1",
        },
        cite,
      ),
    );
    store.append(
      authorisedSignatoryAdded(
        {
          counterpartyId: cp,
          personId: "urn:party:natural-person:signatory-002" as PartyId,
          scope: "authorised-trader",
          evidenceRef: "ev2",
        },
        cite,
      ),
    );
    const book = projector(store).build(signatoryBook);
    expect(book[cp]).toHaveLength(2);
    expect(book[cp]?.[0]?.personId).toBe("urn:party:natural-person:signatory-001" as PartyId);
    store.close();
  });

  it("supports as-of replay — projection at earlier time reflects earlier state", () => {
    const store = new EventStore();
    const cp = counterpartyId("CP-T5");
    const earlier = "2026-01-01T00:00:00.000Z";
    const later = "2026-12-31T00:00:00.000Z";
    store.append(
      soundingOpened({ counterpartyId: cp, channel: "outbound" }, { ...cite, asOf: earlier }),
    );
    store.append(
      prospectRegistered(
        {
          counterpartyId: cp,
          legalName: "Future Ltd",
          jurisdiction: "ZA",
          sector: "corporate",
        },
        { ...cite, asOf: later },
      ),
    );
    const proj = projector(store);
    const masterEarly = proj.build(counterpartyMaster, { asOf: earlier });
    const masterLater = proj.build(counterpartyMaster, { asOf: later });
    expect(masterEarly[cp]?.status).toBe("Sounding");
    expect(masterLater[cp]?.status).toBe("Prospect");
    store.close();
  });
});

function projector(store: EventStore): LocalProjector {
  return new LocalProjector(store);
}
