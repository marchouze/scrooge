// tests/legal-entity-tree.test.ts
//
// Unit tests for the legal-entity event family (D-LEGAL-ENTITY-TREE-V0 +
// D-REGULATORY-PERIMETER). PR scope: typed events
// `LegalEntityRegistered`, `LegalEntityChanged`,
// `IntraGroupArrangementSigned` + the canonical seed at
// `Regulations/_legal-entity-tree.md` mirrored to
// `prototype/seeds/legal-entity-tree.json`.
//
// Asserts:
//   - Each event factory passes a Zod parse round-trip.
//   - Citation slot is enforced (≥1 citation required on the envelope).
//   - `regulatoryRegime.primaryRegulator` enum is enforced.
//   - `LegalEntityChanged` requires both `priorValue` and `newValue`
//     (a change-event without those is a registration, not a change).
//   - `IntraGroupArrangementSigned` requires `fromEntityId !== toEntityId`
//     (no self-arrangements).
//   - Registry lookup returns the typed payload schema for each.
//   - The canonical seed JSON parses against the registered payload
//     schema for `LegalEntityRegistered` (modulo the citations slot,
//     which the envelope carries — not the payload).
//
// Author: Atlas (Core banking platform architect; reports to Devon, COO,
// governance).

import { describe, expect, it } from "bun:test";

import {
  type IntraGroupArrangementSignedPayload,
  type LegalEntityChangedPayload,
  type LegalEntityRegisteredPayload,
  legalEntityRegisteredPayloadSchema,
  makeIntraGroupArrangementSigned,
  makeLegalEntityChanged,
  makeLegalEntityRegistered,
} from "../platform/event-store/event-types";
import { lookupEventType } from "../platform/event-store/registry";
import type { Actor } from "../platform/event-store/types";
import seed from "../seeds/legal-entity-tree.json";

const ENTITY = "urn:legal-entity:hoz:hoz-group:v1";
const T0 = "2026-05-09T08:00:00.000Z";

const IMANI_ACTOR: Actor = { type: "service", id: "agent:imani:legal-entity-registrar" };

const CITATIONS = [
  "COMPANIES-ACT-71-2008",
  "BANKS-ACT-94-1990",
  "[citation: TBC pending counsel verification]",
];

const REGISTERED_PAYLOAD: LegalEntityRegisteredPayload = {
  entityId: "urn:legal-entity:hoz:hoz-group:v1",
  legalName: "Hoz Group Limited",
  registeredForm: "Ltd",
  jurisdiction: "ZA",
  registeredOffice: {
    street: "[citation: TBC]",
    city: "Johannesburg",
    country: "ZA",
  },
  parentEntityId: null,
  regulatoryRegime: {
    primaryRegulator: "none-companies-act-only",
    regimeAnchor: ["Companies Act 71 of 2008", "Banks Act 94 of 1990 § 60"],
  },
  directors: [],
  registrationDate: "2026-05-09",
};

describe("LegalEntityRegistered — factory", () => {
  it("round-trips a valid registration event (the group, parent=null)", () => {
    const event = makeLegalEntityRegistered({
      asOf: T0,
      entity: ENTITY,
      actor: IMANI_ACTOR,
      citations: CITATIONS,
      payload: REGISTERED_PAYLOAD,
    });
    expect(event.type).toBe("LegalEntityRegistered");
    expect(event.payload.legalName).toBe("Hoz Group Limited");
    expect(event.payload.parentEntityId).toBeNull();
    expect((event.payload as LegalEntityRegisteredPayload).regulatoryRegime.primaryRegulator).toBe(
      "none-companies-act-only",
    );
  });

  it("rejects an envelope with empty citations (P2)", () => {
    expect(() =>
      makeLegalEntityRegistered({
        asOf: T0,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: [],
        payload: REGISTERED_PAYLOAD,
      }),
    ).toThrow();
  });

  it("rejects an unknown primaryRegulator", () => {
    expect(() =>
      makeLegalEntityRegistered({
        asOf: T0,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: CITATIONS,
        payload: {
          ...REGISTERED_PAYLOAD,
          regulatoryRegime: {
            // @ts-expect-error — testing runtime enforcement of the enum
            primaryRegulator: "SARS",
            regimeAnchor: ["nope"],
          },
        },
      }),
    ).toThrow();
  });

  it("rejects an empty regimeAnchor (≥1 anchor required)", () => {
    expect(() =>
      makeLegalEntityRegistered({
        asOf: T0,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: CITATIONS,
        payload: {
          ...REGISTERED_PAYLOAD,
          regulatoryRegime: {
            primaryRegulator: "PA",
            regimeAnchor: [],
          },
        },
      }),
    ).toThrow();
  });

  it("rejects a non-ISO-2 jurisdiction code", () => {
    expect(() =>
      makeLegalEntityRegistered({
        asOf: T0,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: CITATIONS,
        payload: { ...REGISTERED_PAYLOAD, jurisdiction: "ZAF" },
      }),
    ).toThrow();
  });
});

describe("LegalEntityChanged — factory", () => {
  const changedPayload: LegalEntityChangedPayload = {
    entityId: "urn:legal-entity:hoz:hoz-bank:v1",
    changeType: "regulatory-regime-updated",
    priorValue: { primaryRegulator: "PA", regimeAnchor: ["Banks Act 94 of 1990"] },
    newValue: {
      primaryRegulator: "PA",
      regimeAnchor: ["Banks Act 94 of 1990 (s.7 banking licence)", "Joint Standards"],
    },
    effectiveDate: "2026-05-09",
  };

  it("round-trips a valid regulatory-regime-updated change", () => {
    const event = makeLegalEntityChanged({
      asOf: T0,
      entity: "urn:legal-entity:hoz:hoz-bank:v1",
      actor: IMANI_ACTOR,
      citations: CITATIONS,
      payload: changedPayload,
    });
    expect(event.type).toBe("LegalEntityChanged");
    expect(event.payload.changeType).toBe("regulatory-regime-updated");
  });

  it("rejects an unknown changeType", () => {
    expect(() =>
      makeLegalEntityChanged({
        asOf: T0,
        entity: "urn:legal-entity:hoz:hoz-bank:v1",
        actor: IMANI_ACTOR,
        citations: CITATIONS,
        payload: {
          ...changedPayload,
          // @ts-expect-error — testing runtime enforcement of the enum
          changeType: "vibes-changed",
        },
      }),
    ).toThrow();
  });

  it("requires priorValue (undefined rejected; null is permitted as explicit absence)", () => {
    // Cast to bypass the TS narrowing on the Zod-inferred type — we are
    // exercising the runtime guard that rejects `undefined` even though
    // the schema permits `unknown`.
    const bad = {
      ...changedPayload,
      priorValue: undefined,
    } as unknown as LegalEntityChangedPayload;
    expect(() =>
      makeLegalEntityChanged({
        asOf: T0,
        entity: "urn:legal-entity:hoz:hoz-bank:v1",
        actor: IMANI_ACTOR,
        citations: CITATIONS,
        payload: bad,
      }),
    ).toThrow();
  });

  it("requires newValue (undefined rejected; null is permitted as explicit absence)", () => {
    const bad = { ...changedPayload, newValue: undefined } as unknown as LegalEntityChangedPayload;
    expect(() =>
      makeLegalEntityChanged({
        asOf: T0,
        entity: "urn:legal-entity:hoz:hoz-bank:v1",
        actor: IMANI_ACTOR,
        citations: CITATIONS,
        payload: bad,
      }),
    ).toThrow();
  });
});

describe("IntraGroupArrangementSigned — factory", () => {
  const arrangementPayload: IntraGroupArrangementSignedPayload = {
    arrangementId: "arrangement:hoz-group:hoz-bank:services:v1",
    arrangementType: "services",
    fromEntityId: "urn:legal-entity:hoz:hoz-group:v1",
    toEntityId: "urn:legal-entity:hoz:hoz-bank:v1",
    effectiveDate: "2026-05-09",
    armsLengthRationale:
      "[citation: TBC pending Yael TP analysis] — cost-plus 5% per OECD TP Guidelines Chapter VII",
    "IAS24-disclosure-ref": "disclosure:hoz-group:2026:ias24:services-bank",
  };

  it("round-trips a valid services arrangement", () => {
    const event = makeIntraGroupArrangementSigned({
      asOf: T0,
      entity: ENTITY,
      actor: IMANI_ACTOR,
      citations: CITATIONS,
      payload: arrangementPayload,
    });
    expect(event.type).toBe("IntraGroupArrangementSigned");
    expect(event.payload.arrangementType).toBe("services");
  });

  it("rejects a self-arrangement (fromEntityId === toEntityId)", () => {
    expect(() =>
      makeIntraGroupArrangementSigned({
        asOf: T0,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: CITATIONS,
        payload: {
          ...arrangementPayload,
          toEntityId: arrangementPayload.fromEntityId,
        },
      }),
    ).toThrow();
  });

  it("rejects an unknown arrangementType", () => {
    expect(() =>
      makeIntraGroupArrangementSigned({
        asOf: T0,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: CITATIONS,
        payload: {
          ...arrangementPayload,
          // @ts-expect-error — testing runtime enforcement of the enum
          arrangementType: "vibes",
        },
      }),
    ).toThrow();
  });
});

describe("Event-type registry — legal-entity entries", () => {
  it("registers all three types as governance-class with Imani as issuer", () => {
    for (const type of [
      "LegalEntityRegistered",
      "LegalEntityChanged",
      "IntraGroupArrangementSigned",
    ]) {
      const meta = lookupEventType(type);
      expect(meta).toBeDefined();
      expect(meta?.class).toBe("governance");
      expect(meta?.issuer).toBe("Imani");
      expect(meta?.payloadSchema).toBeDefined();
    }
  });
});

describe("Canonical seed — Regulations/_legal-entity-tree.md mirror", () => {
  it("parses every entity in seeds/legal-entity-tree.json against legalEntityRegisteredPayloadSchema", () => {
    expect(seed.entities.length).toBe(3);
    for (const entity of seed.entities) {
      // The seed carries `citations` at the entity level; the typed
      // payload's citations live on the event envelope, so we strip
      // before parsing.
      const { citations: _ignored, ...payload } = entity as Record<string, unknown> & {
        citations?: unknown;
      };
      expect(() => legalEntityRegisteredPayloadSchema.parse(payload)).not.toThrow();
    }
  });

  it("seeds the three Hoz entities with the expected URNs and primaryRegulators", () => {
    const byId = new Map(seed.entities.map((e) => [e.entityId, e] as const));
    expect(byId.get("urn:legal-entity:hoz:hoz-group:v1")?.regulatoryRegime.primaryRegulator).toBe(
      "none-companies-act-only",
    );
    expect(byId.get("urn:legal-entity:hoz:hoz-bank:v1")?.regulatoryRegime.primaryRegulator).toBe(
      "PA",
    );
    expect(
      byId.get("urn:legal-entity:hoz:hoz-securities:v1")?.regulatoryRegime.primaryRegulator,
    ).toBe("JSE");
  });

  it("seeds tree-shape: group has parentEntityId=null; bank+securities point at group", () => {
    const byId = new Map(seed.entities.map((e) => [e.entityId, e] as const));
    expect(byId.get("urn:legal-entity:hoz:hoz-group:v1")?.parentEntityId).toBeNull();
    expect(byId.get("urn:legal-entity:hoz:hoz-bank:v1")?.parentEntityId).toBe(
      "urn:legal-entity:hoz:hoz-group:v1",
    );
    expect(byId.get("urn:legal-entity:hoz:hoz-securities:v1")?.parentEntityId).toBe(
      "urn:legal-entity:hoz:hoz-group:v1",
    );
  });
});
