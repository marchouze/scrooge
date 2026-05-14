// platform/projections/regulatory/reg-instrument-projection.test.ts
//
// Unit tests for the regulatory instrument projection.
// All tests fold events directly through the projection's reduce() function
// (pure — no EventStore or DocumentStore I/O).
//
// Author: Anya (Data / analytics engineer, engineering)

import { describe, expect, it } from "bun:test";
import type { Event } from "../../event-store/types";
import { regInstrumentProjection } from "./reg-instrument-projection";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function baseEvent(overrides: Partial<Event> = {}): Event {
  return {
    event_id: `evt-test-${Math.random().toString(36).slice(2)}`,
    type: "RegulatoryInstrumentRegistered",
    as_of: "2026-05-14T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "system", id: "anya@bank" },
    citations: ["OBL-SARB-001"],
    payload: {},
    ...overrides,
  };
}

function registeredEvent(instrumentId: string, overrides: Record<string, unknown> = {}): Event {
  return baseEvent({
    type: "RegulatoryInstrumentRegistered",
    payload: {
      instrumentId,
      title: `${instrumentId} Title`,
      issuingBody: "SARB",
      instrumentType: "regulation",
      jurisdiction: "ZA",
      publicationDate: "2026-01-01",
      effectiveDate: "2026-03-01",
      version: "1.0",
      contentHash: "blake3:aabbcc",
      ...overrides,
    },
  });
}

function amendedEvent(
  instrumentId: string,
  previousHash: string,
  contentHash: string,
  version = "2.0",
): Event {
  return baseEvent({
    type: "RegulatoryInstrumentAmended",
    as_of: "2026-06-01T00:00:00.000Z",
    payload: {
      instrumentId,
      previousHash,
      contentHash,
      version,
      amendedAt: "2026-06-01T00:00:00.000Z",
    },
  });
}

function contextualisedEvent(instrumentId: string): Event {
  return baseEvent({
    type: "RegulatoryInstrumentContextualised",
    payload: {
      instrumentId,
      regulatoryAuthority: {
        name: "SARB",
        mandate: "Prudential oversight",
        enforcementPowers: ["directive", "fine", "license-revocation"],
      },
      regulatoryObjective: {
        longTitle: "The Banks Act 94 of 1990",
        primaryObjective: "Sound banking practices",
        enforcementApproach: "risk-based",
      },
      internationalAlignment: {
        conformsTo: ["Basel III", "BCBS 239"],
        alignmentDescription: "Full alignment with Basel III capital framework",
      },
    },
  });
}

function conceptExtractedEvent(
  instrumentId: string,
  applicabilityScore: number,
  relevancyScore: number,
): Event {
  return baseEvent({
    type: "RegulatoryConceptExtracted",
    payload: {
      instrumentId,
      conceptId: `concept-${Math.random().toString(36).slice(2)}`,
      applicabilityScore,
      relevancyScore,
    },
  });
}

function obligationLinkedEvent(instrumentId: string): Event {
  return baseEvent({
    type: "ObligationConceptLinked",
    payload: {
      instrumentId,
      obligationId: `obl-${Math.random().toString(36).slice(2)}`,
      conceptId: `concept-${Math.random().toString(36).slice(2)}`,
    },
  });
}

function fold(events: Event[]) {
  return events.reduce(
    (state, evt) => regInstrumentProjection.reduce(state, evt),
    regInstrumentProjection.initial,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("regInstrumentProjection", () => {
  describe("RegulatoryInstrumentRegistered", () => {
    it("creates entry with extractionStatus pending", () => {
      const events = [registeredEvent("BANKS-ACT-94-1990")];
      const state = fold(events);

      const entry = state.get("BANKS-ACT-94-1990");
      expect(entry).toBeDefined();
      expect(entry?.instrumentId).toBe("BANKS-ACT-94-1990");
      expect(entry?.title).toBe("BANKS-ACT-94-1990 Title");
      expect(entry?.extractionStatus).toBe("pending");
      expect(entry?.conceptCount).toBe(0);
      expect(entry?.avgApplicabilityScore).toBe(0);
      expect(entry?.avgRelevancyScore).toBe(0);
      expect(entry?.highApplicabilityCount).toBe(0);
      expect(entry?.highRelevancyCount).toBe(0);
      expect(entry?.linkedObligationCount).toBe(0);
    });

    it("sets initial versionHistory entry", () => {
      const events = [registeredEvent("FAIS-ACT-37-2002")];
      const state = fold(events);

      const entry = state.get("FAIS-ACT-37-2002");
      expect(entry?.versionHistory).toHaveLength(1);
      expect(entry?.versionHistory[0]?.version).toBe("1.0");
      expect(entry?.versionHistory[0]?.contentHash).toBe("blake3:aabbcc");
    });

    it("folds duplicate registrations with last-event-wins semantics", () => {
      // Two registrations for the same instrumentId — last-in-fold wins.
      const events = [
        registeredEvent("SARB-DIRECTIVE-1", { contentHash: "blake3:first" }),
        registeredEvent("SARB-DIRECTIVE-1", { contentHash: "blake3:second" }),
      ];
      const state = fold(events);
      expect(state.get("SARB-DIRECTIVE-1")?.currentHash).toBe("blake3:second");
    });
  });

  describe("RegulatoryConceptExtracted", () => {
    it("increments concept count and updates running averages", () => {
      const events = [
        registeredEvent("BANKS-ACT"),
        conceptExtractedEvent("BANKS-ACT", 0.8, 0.6),
        conceptExtractedEvent("BANKS-ACT", 0.6, 0.9),
      ];
      const state = fold(events);
      const entry = state.get("BANKS-ACT");

      expect(entry?.conceptCount).toBe(2);
      // avg applicability = (0.8 + 0.6) / 2 = 0.7
      expect(entry?.avgApplicabilityScore).toBeCloseTo(0.7, 5);
      // avg relevancy = (0.6 + 0.9) / 2 = 0.75
      expect(entry?.avgRelevancyScore).toBeCloseTo(0.75, 5);
    });

    it("counts high-applicability and high-relevancy concepts correctly", () => {
      const events = [
        registeredEvent("REG-X"),
        conceptExtractedEvent("REG-X", 0.9, 0.5), // high applicability, not high relevancy
        conceptExtractedEvent("REG-X", 0.5, 0.8), // not high applicability, high relevancy
        conceptExtractedEvent("REG-X", 0.7, 0.7), // both at threshold
        conceptExtractedEvent("REG-X", 0.6, 0.6), // neither
      ];
      const state = fold(events);
      const entry = state.get("REG-X");

      expect(entry?.highApplicabilityCount).toBe(2); // 0.9 and 0.7
      expect(entry?.highRelevancyCount).toBe(2); // 0.8 and 0.7
    });

    it("sets extractionStatus to in-progress", () => {
      const events = [registeredEvent("REG-Y"), conceptExtractedEvent("REG-Y", 0.5, 0.5)];
      const state = fold(events);
      expect(state.get("REG-Y")?.extractionStatus).toBe("in-progress");
    });

    it("drops concept-extracted events before registration", () => {
      const events = [conceptExtractedEvent("UNREGISTERED", 0.8, 0.8)];
      const state = fold(events);
      expect(state.get("UNREGISTERED")).toBeUndefined();
    });
  });

  describe("RegulatoryInstrumentAmended", () => {
    it("updates version and hash, pushes to versionHistory", () => {
      const events = [
        registeredEvent("BANKS-ACT", { contentHash: "blake3:v1" }),
        amendedEvent("BANKS-ACT", "blake3:v1", "blake3:v2", "2.0"),
      ];
      const state = fold(events);
      const entry = state.get("BANKS-ACT");

      expect(entry?.currentVersion).toBe("2.0");
      expect(entry?.currentHash).toBe("blake3:v2");
      expect(entry?.versionHistory).toHaveLength(2);
      expect(entry?.versionHistory[1]?.version).toBe("2.0");
      expect(entry?.versionHistory[1]?.contentHash).toBe("blake3:v2");
    });

    it("resets extraction stats on amendment", () => {
      const events = [
        registeredEvent("REG-Z"),
        conceptExtractedEvent("REG-Z", 0.9, 0.9),
        conceptExtractedEvent("REG-Z", 0.8, 0.8),
        amendedEvent("REG-Z", "blake3:aabbcc", "blake3:new", "2.0"),
      ];
      const state = fold(events);
      const entry = state.get("REG-Z");

      expect(entry?.extractionStatus).toBe("pending");
      expect(entry?.conceptCount).toBe(0);
      expect(entry?.avgApplicabilityScore).toBe(0);
      expect(entry?.avgRelevancyScore).toBe(0);
      expect(entry?.highApplicabilityCount).toBe(0);
      expect(entry?.highRelevancyCount).toBe(0);
    });

    it("drops amendment before registration", () => {
      const events = [amendedEvent("NEVER-REGISTERED", "blake3:x", "blake3:y")];
      const state = fold(events);
      expect(state.get("NEVER-REGISTERED")).toBeUndefined();
    });
  });

  describe("RegulatoryInstrumentContextualised", () => {
    it("attaches regulatory authority, objective, and international alignment", () => {
      const events = [registeredEvent("BANKS-ACT"), contextualisedEvent("BANKS-ACT")];
      const state = fold(events);
      const entry = state.get("BANKS-ACT");

      expect(entry?.regulatoryAuthority).toBeDefined();
      expect(entry?.regulatoryAuthority?.name).toBe("SARB");
      expect(entry?.regulatoryAuthority?.enforcementPowers).toContain("directive");

      expect(entry?.regulatoryObjective).toBeDefined();
      expect(entry?.regulatoryObjective?.primaryObjective).toBe("Sound banking practices");

      expect(entry?.internationalAlignment).toBeDefined();
      expect(entry?.internationalAlignment?.conformsTo).toContain("Basel III");
    });

    it("drops contextualisation before registration", () => {
      const events = [contextualisedEvent("PHANTOM-REG")];
      const state = fold(events);
      expect(state.get("PHANTOM-REG")).toBeUndefined();
    });
  });

  describe("ObligationConceptLinked", () => {
    it("increments linkedObligationCount", () => {
      const events = [
        registeredEvent("BANKS-ACT"),
        obligationLinkedEvent("BANKS-ACT"),
        obligationLinkedEvent("BANKS-ACT"),
        obligationLinkedEvent("BANKS-ACT"),
      ];
      const state = fold(events);
      expect(state.get("BANKS-ACT")?.linkedObligationCount).toBe(3);
    });

    it("drops obligation-linked events before registration", () => {
      const events = [obligationLinkedEvent("NO-INSTRUMENT")];
      const state = fold(events);
      expect(state.get("NO-INSTRUMENT")).toBeUndefined();
    });
  });

  describe("multi-instrument isolation", () => {
    it("two instruments fold independently", () => {
      const events = [
        registeredEvent("INST-A", { contentHash: "blake3:a1" }),
        registeredEvent("INST-B", { contentHash: "blake3:b1" }),
        conceptExtractedEvent("INST-A", 0.9, 0.9),
        conceptExtractedEvent("INST-A", 0.8, 0.8),
        conceptExtractedEvent("INST-B", 0.3, 0.3),
        amendedEvent("INST-B", "blake3:b1", "blake3:b2", "2.0"),
        obligationLinkedEvent("INST-A"),
      ];
      const state = fold(events);

      const a = state.get("INST-A");
      const b = state.get("INST-B");

      // A has two concepts, one linked obligation, no amendment
      expect(a?.conceptCount).toBe(2);
      expect(a?.linkedObligationCount).toBe(1);
      expect(a?.currentVersion).toBe("1.0");
      expect(a?.currentHash).toBe("blake3:a1");

      // B has been amended (resets stats), one concept prior to amendment (reset)
      expect(b?.conceptCount).toBe(0);
      expect(b?.extractionStatus).toBe("pending");
      expect(b?.currentVersion).toBe("2.0");
      expect(b?.currentHash).toBe("blake3:b2");
      expect(b?.linkedObligationCount).toBe(0);
    });

    it("accepts() filters correctly", () => {
      expect(
        regInstrumentProjection.accepts(baseEvent({ type: "RegulatoryInstrumentRegistered" })),
      ).toBe(true);
      expect(
        regInstrumentProjection.accepts(baseEvent({ type: "RegulatoryInstrumentAmended" })),
      ).toBe(true);
      expect(
        regInstrumentProjection.accepts(baseEvent({ type: "RegulatoryInstrumentContextualised" })),
      ).toBe(true);
      expect(
        regInstrumentProjection.accepts(baseEvent({ type: "RegulatoryConceptExtracted" })),
      ).toBe(true);
      expect(regInstrumentProjection.accepts(baseEvent({ type: "ObligationConceptLinked" }))).toBe(
        true,
      );
      expect(regInstrumentProjection.accepts(baseEvent({ type: "BankAccountOpened" }))).toBe(false);
      expect(regInstrumentProjection.accepts(baseEvent({ type: "CeoDecision" }))).toBe(false);
    });
  });
});
