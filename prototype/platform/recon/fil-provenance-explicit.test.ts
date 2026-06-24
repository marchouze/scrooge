// platform/recon/fil-provenance-explicit.test.ts
//
// D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN — regression tests for the FIL
// provenance fail-closed harden tail (WS-FX-FIL-INTEGRITY Slice B):
//   (1) the live event store is green (every FIL event carries an explicit tag),
//   (2) the NEGATIVE case — an UNTAGGED FIL event FAILS the gate (the defect
//       class the pipeline exists to catch),
//   (3) a soft-default-lineage FIL event (category fail-open) FAILS the gate,
//   (4) the emit BOUNDARY (`assertExplicitFilProvenance` via the make* helpers)
//       fails closed on a soft-default tag and accepts an explicit one.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { filInstrumentCreatedPayloadSchema } from "../../v2-core/fil-instances/events";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { buildPhaseFixtureTag, defaultProvenanceFor } from "../event-store/provenance";
import {
  type FilEventProvenanceRow,
  evaluateFilProvenanceRows,
  run,
} from "./fil-provenance-explicit";

// ---------------------------------------------------------------------------
// (1) Live store — the gate is green in CI (the seeded FIL events all carry an
// explicit provenance tag after this slice's emit-site + script migration).
// ---------------------------------------------------------------------------

describe("recon:fil-provenance-explicit — live store", () => {
  it("is green: every FIL event in the store carries an explicit provenance tag", () => {
    const result = run();
    const fails = result.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (2)+(3) Pure verdict — the NEGATIVE cases the gate must catch.
// ---------------------------------------------------------------------------

describe("recon:fil-provenance-explicit — verdict", () => {
  it("passes a FIL event with an explicit (concrete-lineage) provenance tag", () => {
    const rows: FilEventProvenanceRow[] = [
      {
        eventId: "ev-explicit",
        type: "FilInstrumentCreated",
        kind: "build-phase-fixture",
        sourceLineage: "scripts/backfill-fil-instances.ts",
      },
    ];
    const { asserted, violations } = evaluateFilProvenanceRows(rows);
    expect(asserted).toBe(1);
    expect(violations).toEqual([]);
  });

  it("FAILS an UNTAGGED FIL event (no provenance at all)", () => {
    const rows: FilEventProvenanceRow[] = [
      { eventId: "ev-untagged", type: "FilInstrumentCreated", kind: null, sourceLineage: null },
    ];
    const { violations } = evaluateFilProvenanceRows(rows);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("fail");
    expect(violations[0]?.subject).toBe("FilInstrumentCreated:ev-untagged");
  });

  it("FAILS a FIL event resting on the category soft-default (fail-open) lineage", () => {
    // This is exactly the byte-shape the soft-tagger / defaultProvenanceFor
    // produces for a FIL type today (governance → production, bare category
    // lineage) — the fail-open the harden exists to eliminate.
    const softDefault = defaultProvenanceFor("FilInstrumentCreated");
    const rows: FilEventProvenanceRow[] = [
      {
        eventId: "ev-soft",
        type: "FilInstrumentCreated",
        kind: softDefault.kind,
        sourceLineage: softDefault.sourceLineage,
      },
    ];
    const { violations } = evaluateFilProvenanceRows(rows);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("fail");
    expect(violations[0]?.message).toContain("soft-default");
  });
});

// ---------------------------------------------------------------------------
// (4) Emit boundary — assertExplicitFilProvenance (via the make* helper).
// ---------------------------------------------------------------------------

describe("FIL emit boundary — fail-closed on soft-default provenance", () => {
  const payload = filInstrumentCreatedPayloadSchema.parse({
    kind: "FilInstrumentCreated",
    instance: "fil:inst:LE-ZA-HOZ-BANK:test-trade",
    type: "fil:type:fx:spot:otc-vanilla@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-24T00:00:00.000Z",
    originatingEvent: { eventType: "TradeAffirmed", eventId: "ev-origin" },
    initialStage: "active",
    economicTerms: {
      assetClass: "fx",
      notional: { currency: "EUR", amount: "100000.00" },
      direction: "long",
      counterpartyId: "CP-TEST",
      nettingSetId: "NS-CP-TEST-ZAR",
      currency: "EUR",
      settlementDate: "2026-06-26",
      hedgingSetTag: "EUR/ZAR",
    },
  });

  it("THROWS when handed the category soft-default tag (fail-open prevented)", () => {
    const softDefault = defaultProvenanceFor("FilInstrumentCreated");
    expect(() =>
      makeFilInstrumentCreated({
        asOf: payload.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:test" },
        citations: [],
        provenance: softDefault,
        payload,
      }),
    ).toThrow(/must carry an EXPLICIT/);
  });

  it("accepts an explicit build-phase-fixture tag and stamps it on the event", () => {
    const tag = buildPhaseFixtureTag({ sourceLineage: "scripts/test" });
    const event = makeFilInstrumentCreated({
      asOf: payload.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:test" },
      citations: ["D-FIL-FRAMEWORK-UNIFICATION"],
      provenance: tag,
      payload,
    });
    expect(event.provenance).toEqual(tag);
  });
});
