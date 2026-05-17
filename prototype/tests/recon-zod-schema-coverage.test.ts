// tests/recon-zod-schema-coverage.test.ts
//
// Unit tests for the Zod payload-schema coverage recon (F-032 gap-2).
//
// - Smoke: pipeline runs over the live registry and reports coverage %.
// - Unit: synthetic registry with and without schemas produces correct findings.
// - Schema unit tests: happy-path + rejection for the 8 new governance schemas.
// - Integration: append with malformed CeoDecision payload throws.
//
// Authority: brief:atlas:zod-schemas-at-emit-site-substrate-gap-2-f-032:2026-05-17
// Citations: P1-EVENTS-AS-TRUTH, F-032
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { EventStore } from "../platform/event-store/store";
import {
  ceoDecisionPayloadSchema,
  dataProjectionSnapshotPayloadSchema,
  governanceCyclePrepPayloadSchema,
  inboxHygieneSweepPayloadSchema,
  obligationsRegisterSnapshotPayloadSchema,
  reconResultPayloadSchema,
  securitySubstrateSnapshotPayloadSchema,
  substrateStateSnapshotPayloadSchema,
} from "../platform/event-store/event-types/governance-snapshots";
import { run } from "../platform/recon/zod-schema-coverage";

// ---------------------------------------------------------------------------
// Smoke test — live registry
// ---------------------------------------------------------------------------

describe("zod-schema-coverage recon — live corpus", () => {
  it("runs over the live registry and reports a coverage metric", () => {
    const r = run();
    expect(r.pipeline).toBe("zod-schema-coverage");
    expect(r.asserted).toBeGreaterThan(0);
    // This pipeline never hard-fails CI — only warn / info severities.
    expect(r.ok).toBe(true);
    // There should be no fail-severity violations from this pipeline.
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.length).toBe(0);
    // At minimum the 8 newly-schematised types are covered — assert
    // the pipeline actually checked something and the coverage is > 0.
    const warns = r.violations.filter((v) => v.severity === "warn");
    // Warn count < asserted (some types DO have schemas).
    expect(warns.length).toBeLessThan(r.asserted);
  });

  it("the 8 newly-schematised types do NOT appear in warn findings", () => {
    const r = run();
    const warnedTypes = new Set(
      r.violations
        .filter((v) => v.severity === "warn")
        .map((v) => v.subject.replace(/^event-type:/, "")),
    );
    const newlyCovered = [
      "CeoDecision",
      "ReconResult",
      "SubstrateStateSnapshot",
      "GovernanceCyclePrep",
      "DataProjectionSnapshot",
      "InboxHygieneSweep",
      "ObligationsRegisterSnapshot",
      "SecuritySubstrateSnapshot",
    ];
    for (const t of newlyCovered) {
      expect(warnedTypes.has(t)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Unit tests — synthetic registry
// ---------------------------------------------------------------------------

describe("zod-schema-coverage recon — synthetic registry", () => {
  it("reports warn for a type with no schema", () => {
    const r = run({
      registry: [{ type: "Foo", payloadSchema: undefined }],
    });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]!.severity).toBe("warn");
    expect(r.violations[0]!.subject).toBe("event-type:Foo");
  });

  it("reports no violation for a type with a schema", () => {
    const r = run({
      registry: [{ type: "Foo", payloadSchema: z.object({ id: z.string() }) }],
    });
    expect(r.violations.length).toBe(0);
  });

  it("reports info (not warn) for a deprecated type with no schema", () => {
    const r = run({
      registry: [{ type: "Bar", payloadSchema: undefined, status: "deprecated" }],
    });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]!.severity).toBe("info");
  });

  it("ok stays true even when there are warn findings", () => {
    const r = run({
      registry: [
        { type: "A", payloadSchema: undefined },
        { type: "B", payloadSchema: z.object({}) },
      ],
    });
    expect(r.ok).toBe(true); // warn doesn't break ok
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]!.severity).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Schema unit tests — happy path + rejection
// ---------------------------------------------------------------------------

describe("ceoDecisionPayloadSchema", () => {
  it("accepts a valid CeoDecision payload", () => {
    const result = ceoDecisionPayloadSchema.safeParse({
      decisionId: "D-LICENCE-TYPE",
      title: "Licence type decision",
      action: "approve",
      outcome: "Approved by CEO",
      recordedVia: "scrooge:session-delegation",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing decisionId", () => {
    const result = ceoDecisionPayloadSchema.safeParse({
      title: "Missing ID",
      action: "approve",
      outcome: "ok",
      recordedVia: "scrooge",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid action enum", () => {
    const result = ceoDecisionPayloadSchema.safeParse({
      decisionId: "D-X",
      title: "Test",
      action: "yolo",
      outcome: "ok",
      recordedVia: "scrooge",
    });
    expect(result.success).toBe(false);
  });

  it("passes through extra legacy fields", () => {
    const result = ceoDecisionPayloadSchema.safeParse({
      decisionId: "D-BACKFILL",
      title: "Backfill record",
      action: "approve",
      outcome: "(approved — backfilled from owner-inbox record)",
      recordedVia: "backfill:owner-inbox-records",
      followOnRoutes: ["atlas", "vera"],
      legacyFieldFromOldCorpus: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("reconResultPayloadSchema", () => {
  it("accepts a minimal ReconResult payload", () => {
    const result = reconResultPayloadSchema.safeParse({
      pipeline: "mandate-ownership-integrity",
      ok: true,
      asserted: 35,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing pipeline", () => {
    const result = reconResultPayloadSchema.safeParse({
      ok: true,
      asserted: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing ok", () => {
    const result = reconResultPayloadSchema.safeParse({
      pipeline: "test",
      asserted: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe("substrateStateSnapshotPayloadSchema", () => {
  it("accepts a valid payload", () => {
    const result = substrateStateSnapshotPayloadSchema.safeParse({
      totalEvents: 8,
      eventTypeCount: 1,
      personaCoverage: { total: 27, withSpec: 4, withoutSpec: 23 },
      runtimeHandlerCount: 2,
      substrateGapCount: 6,
      runTrigger: "overnight-recon",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty payload (all optional fields)", () => {
    const result = substrateStateSnapshotPayloadSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("governanceCyclePrepPayloadSchema", () => {
  it("accepts a valid payload", () => {
    const result = governanceCyclePrepPayloadSchema.safeParse({
      decisionsOpen: 0,
      openSeats: 2,
      recentDecisions7d: 0,
      runTrigger: "overnight-recon",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty payload", () => {
    expect(governanceCyclePrepPayloadSchema.safeParse({}).success).toBe(true);
  });
});

describe("dataProjectionSnapshotPayloadSchema", () => {
  it("accepts a valid payload with counts", () => {
    const result = dataProjectionSnapshotPayloadSchema.safeParse({
      counts: {
        principlesInClaudeMd: 6,
        personaFiles: 27,
        procedureFiles: 20,
      },
      cacheReachable: true,
      runTrigger: "overnight-recon",
    });
    expect(result.success).toBe(true);
  });
});

describe("inboxHygieneSweepPayloadSchema", () => {
  it("accepts a valid payload", () => {
    const result = inboxHygieneSweepPayloadSchema.safeParse({
      teamInboxOpen: 0,
      teamInboxActioned: 40,
      ownerInboxCount: 0,
      moved: 0,
      reportOnly: 0,
      runTrigger: "overnight-recon",
    });
    expect(result.success).toBe(true);
  });
});

describe("obligationsRegisterSnapshotPayloadSchema", () => {
  it("accepts a valid payload", () => {
    const result = obligationsRegisterSnapshotPayloadSchema.safeParse({
      obligationsCount: 181,
      regulatorInstrumentsCount: 83,
      regulatorInstrumentsPopulated: 4,
      runTrigger: "overnight-recon",
    });
    expect(result.success).toBe(true);
  });
});

describe("securitySubstrateSnapshotPayloadSchema", () => {
  it("accepts a valid payload", () => {
    const result = securitySubstrateSnapshotPayloadSchema.safeParse({
      ciGates: 6,
      reconPipelines: 5,
      threatModels: 0,
      sboms: 0,
      incidentsLast7d: 0,
      keyRotationsLast7d: 0,
      threatModelDecisionsLast7d: 0,
      runTrigger: "overnight-recon",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration test — emit-site validation via EventStore.append()
// ---------------------------------------------------------------------------

describe("EventStore emit-site validation — CeoDecision schema", () => {
  it("append with malformed CeoDecision payload throws ZodError", () => {
    const store = new EventStore(":memory:");

    // provenance substrate gate is off in tests (BANK_PROVENANCE_SUBSTRATE_ACTIVE
    // not set), so we don't need to supply a provenance tag.
    expect(() => {
      store.append({
        event_id: "evt-test-bad-ceo",
        type: "CeoDecision",
        as_of: "2026-05-17T00:00:00Z",
        entity: "LE-BANK-SA",
        actor: { type: "human", id: "marc@tgv.co.za" },
        citations: ["D-TEST"],
        payload: {
          // Missing required fields: decisionId, title, action, outcome, recordedVia
          randomGarbage: true,
        },
      });
    }).toThrow();
  });

  it("append with valid CeoDecision payload succeeds", () => {
    const store = new EventStore(":memory:");
    expect(() => {
      store.append({
        event_id: "evt-test-good-ceo",
        type: "CeoDecision",
        as_of: "2026-05-17T00:00:00Z",
        entity: "LE-BANK-SA",
        actor: { type: "human", id: "marc@tgv.co.za" },
        citations: ["D-TEST"],
        payload: {
          decisionId: "D-TEST-DECISION",
          title: "Test decision",
          action: "approve",
          outcome: "Approved in test",
          recordedVia: "test",
        },
      });
    }).not.toThrow();
    expect(store.count()).toBe(1);
  });

  it("append with malformed ReconResult payload throws", () => {
    const store = new EventStore(":memory:");
    expect(() => {
      store.append({
        event_id: "evt-test-bad-recon",
        type: "ReconResult",
        as_of: "2026-05-17T00:00:00Z",
        entity: "LE-BANK-SA",
        actor: { type: "service", id: "agent:vera" },
        citations: ["D-TEST"],
        payload: {
          // Missing required `pipeline` and `ok` fields
          asserted: "not-a-number",
        },
      });
    }).toThrow();
  });

  it("append with valid ReconResult payload succeeds", () => {
    const store = new EventStore(":memory:");
    expect(() => {
      store.append({
        event_id: "evt-test-good-recon",
        type: "ReconResult",
        as_of: "2026-05-17T00:00:00Z",
        entity: "LE-BANK-SA",
        actor: { type: "service", id: "agent:vera" },
        citations: ["D-TEST"],
        payload: {
          pipeline: "test-pipeline",
          ok: true,
          asserted: 10,
        },
      });
    }).not.toThrow();
    expect(store.count()).toBe(1);
  });
});
