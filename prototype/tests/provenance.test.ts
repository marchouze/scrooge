// tests/provenance.test.ts
//
// D-DATA-PROVENANCE-SUBSTRATE — Slice 1+6 unit tests.
//
// Covers per dispatch brief:
//   - ProvenanceTag Zod parse + boundary (cross-axis rules)
//   - Append-rejection on/off behaviour with the substrate-active flag
//   - Cross-reference rules (production cannot reference simulated)
//   - Carve-out coverage for CeoDecision + AgentBriefIssued
//   - Backfill round-trip + soft-tagger auto-heal
//
// Author: Atlas (Core banking platform architect, engineering — substrate)

import { afterEach, describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId, nowUtc } from "../platform/core/types";
import {
  PRE_SUBSTRATE_BACKFILL_TAG,
  PRODUCTION_CARVE_OUTS,
  checkCrossReference,
  defaultProvenanceFor,
  isProvenanceSubstrateActive,
  productionTag,
  provenanceTagSchema,
  setProvenanceSubstrateActive,
  simulatedTag,
} from "../platform/event-store/provenance";
import {
  isRegisteredLineage,
  listRegisteredLineages,
} from "../platform/event-store/provenance-lineage.registry";
import { EventStore } from "../platform/event-store/store";
import type { Event, ProvenanceTag } from "../platform/event-store/types";

function mk(overrides: Partial<Event> = {}): Event {
  return {
    event_id: newEventId(),
    type: "TestEvent",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: { type: "human", id: "test" },
    citations: ["TEST-CIT"],
    payload: {},
    ...overrides,
  } as Event;
}

afterEach(() => {
  // Reset the substrate-active override between tests so cross-test
  // pollution doesn't mask regressions.
  setProvenanceSubstrateActive(undefined);
});

// ---------------------------------------------------------------------------
// 1. ProvenanceTag Zod parse + cross-axis boundary
// ---------------------------------------------------------------------------

describe("ProvenanceTag schema (cross-axis rules)", () => {
  it("accepts a well-formed production tag", () => {
    const tag = provenanceTagSchema.parse({
      kind: "production",
      sourceLineage: "ceo-decision-record",
    });
    expect(tag.kind).toBe("production");
    expect(tag.sourceLineage).toBe("ceo-decision-record");
  });

  it("accepts a well-formed simulated tag with scenario", () => {
    const tag = provenanceTagSchema.parse({
      kind: "simulated",
      scenario: "01-hello-bank",
      sourceLineage: "scenario-runner:01-hello-bank",
    });
    expect(tag.scenario).toBe("01-hello-bank");
  });

  it("rejects production tag carrying a scenario", () => {
    expect(() =>
      provenanceTagSchema.parse({
        kind: "production",
        scenario: "stress-adverse",
        sourceLineage: "ceo-decision-record",
      }),
    ).toThrow(/scenario/);
  });

  it("rejects simulated tag without scenario", () => {
    expect(() =>
      provenanceTagSchema.parse({
        kind: "simulated",
        sourceLineage: "scenario-runner:foo",
      }),
    ).toThrow(/scenario/);
  });

  it("rejects empty sourceLineage", () => {
    expect(() =>
      provenanceTagSchema.parse({
        kind: "production",
        sourceLineage: "",
      }),
    ).toThrow();
  });

  it("accepts variant + tags on either kind", () => {
    const sim = provenanceTagSchema.parse({
      kind: "simulated",
      scenario: "stress-adverse",
      variant: "what-if-rate-cut-50bp",
      sourceLineage: "scenario-runner:stress-adverse",
      tags: ["regression", "training-corpus"],
    });
    expect(sim.variant).toBe("what-if-rate-cut-50bp");
    expect(sim.tags).toEqual(["regression", "training-corpus"]);
  });
});

// ---------------------------------------------------------------------------
// 2. Carve-out coverage
// ---------------------------------------------------------------------------

describe("Carve-outs (CeoDecision + AgentBriefIssued)", () => {
  it("CeoDecision resolves to production / ceo-decision-record", () => {
    const tag = defaultProvenanceFor("CeoDecision");
    expect(tag.kind).toBe("production");
    expect(tag.sourceLineage).toBe("ceo-decision-record");
  });

  it("AgentBriefIssued resolves to production / agent-brief", () => {
    const tag = defaultProvenanceFor("AgentBriefIssued");
    expect(tag.kind).toBe("production");
    expect(tag.sourceLineage).toBe("agent-brief");
  });

  it("Other event types resolve to the build-phase simulated default", () => {
    const tag = defaultProvenanceFor("SomeOtherEventType");
    expect(tag.kind).toBe("simulated");
    expect(tag.scenario).toBe("pre-substrate-build-phase");
    expect(tag.sourceLineage).toBe("pre-substrate-backfill");
  });

  it("Carve-outs are exposed as the readonly registry constant", () => {
    expect(PRODUCTION_CARVE_OUTS.CeoDecision?.kind).toBe("production");
    expect(PRODUCTION_CARVE_OUTS.AgentBriefIssued?.kind).toBe("production");
  });

  it("PRE_SUBSTRATE_BACKFILL_TAG is the canonical simulated default", () => {
    expect(PRE_SUBSTRATE_BACKFILL_TAG.kind).toBe("simulated");
    expect(PRE_SUBSTRATE_BACKFILL_TAG.scenario).toBe("pre-substrate-build-phase");
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-reference rule (substrate-level)
// ---------------------------------------------------------------------------

describe("Cross-reference rules", () => {
  it("rejects production → simulated reference", () => {
    const r = checkCrossReference({
      source: productionTag({ sourceLineage: "ceo-decision-record" }),
      target: simulatedTag({
        scenario: "stress-adverse",
        sourceLineage: "scenario-runner:stress-adverse",
      }),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/audit integrity/);
  });

  it("allows simulated → production reference", () => {
    const r = checkCrossReference({
      source: simulatedTag({
        scenario: "stress-adverse",
        sourceLineage: "scenario-runner:stress-adverse",
      }),
      target: productionTag({ sourceLineage: "ceo-decision-record" }),
    });
    expect(r.ok).toBe(true);
  });

  it("allows simulated → simulated reference", () => {
    const r = checkCrossReference({
      source: simulatedTag({
        scenario: "stress-adverse",
        sourceLineage: "scenario-runner:stress-adverse",
      }),
      target: simulatedTag({
        scenario: "baseline-2026",
        sourceLineage: "scenario-runner:baseline-2026",
      }),
    });
    expect(r.ok).toBe(true);
  });

  it("allows production → production reference", () => {
    const r = checkCrossReference({
      source: productionTag({ sourceLineage: "ceo-decision-record" }),
      target: productionTag({ sourceLineage: "agent-brief" }),
    });
    expect(r.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Source-lineage registry
// ---------------------------------------------------------------------------

describe("Source-lineage registry", () => {
  it("recognises static entries", () => {
    expect(isRegisteredLineage("ceo-decision-record")).toBe(true);
    expect(isRegisteredLineage("agent-brief")).toBe(true);
    expect(isRegisteredLineage("pre-substrate-backfill")).toBe(true);
  });

  it("recognises parameterised patterns", () => {
    expect(isRegisteredLineage("agent-runtime:atlas-2026-05-10")).toBe(true);
    expect(isRegisteredLineage("bun-test-runner:tests/foo.test.ts")).toBe(true);
    expect(isRegisteredLineage("scenario-runner:01-hello-bank")).toBe(true);
    expect(isRegisteredLineage("synthetic-bank-seed:v3")).toBe(true);
    expect(isRegisteredLineage("script:provenance-backfill")).toBe(true);
    expect(isRegisteredLineage("backfill:decision-events-2026-05-10")).toBe(true);
  });

  it("rejects unknown lineages", () => {
    expect(isRegisteredLineage("totally-made-up-lineage")).toBe(false);
    expect(isRegisteredLineage("nonsense:value")).toBe(false);
  });

  it("listRegisteredLineages returns both static and patterns", () => {
    const r = listRegisteredLineages();
    expect(r.static.length).toBeGreaterThan(0);
    expect(r.patterns.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Substrate-active flag — append-rejection on/off
// ---------------------------------------------------------------------------

describe("EventStore append — substrate-active flag", () => {
  it("when flag is false, untagged appends succeed (legacy path)", () => {
    setProvenanceSubstrateActive(false);
    expect(isProvenanceSubstrateActive()).toBe(false);

    const store = new EventStore();
    const e = mk();
    expect(() => store.append(e)).not.toThrow();
    const replayed = [...store.replay()];
    expect(replayed.length).toBe(1);
    // Untagged in this branch — soft-tagger heals on next open, but
    // mid-process the event has no provenance.
    expect(replayed[0]?.provenance).toBeUndefined();
    store.close();
  });

  it("when flag is true, untagged non-carve-out append is rejected", () => {
    setProvenanceSubstrateActive(true);
    const store = new EventStore();
    expect(() => store.append(mk({ type: "RandomEvent" }))).toThrow(
      /requires an explicit provenance tag/,
    );
    store.close();
  });

  it("when flag is true, CeoDecision auto-injects production carve-out", () => {
    setProvenanceSubstrateActive(true);
    const store = new EventStore();
    store.append(mk({ type: "CeoDecision", citations: ["GOV-FRAMEWORK-CEO-RESERVED"] }));
    const replayed = [...store.replay()];
    expect(replayed[0]?.provenance?.kind).toBe("production");
    expect(replayed[0]?.provenance?.sourceLineage).toBe("ceo-decision-record");
    store.close();
  });

  it("when flag is true, AgentBriefIssued auto-injects production carve-out", () => {
    setProvenanceSubstrateActive(true);
    const store = new EventStore();
    store.append(
      mk({
        type: "AgentBriefIssued",
        citations: ["GOV-AGENT-DISPATCH"],
        payload: {
          briefId: "brief:atlas:provenance-test",
          issuedTo: { name: "Atlas", position: "Core banking platform architect" },
          issuedBy: { name: "Scrooge", position: "Chief of Staff" },
          title: "Test brief",
          directiveDocumentHash: `blake3:${"a".repeat(64)}`,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "test output" }],
        },
      }),
    );
    const replayed = [...store.replay()];
    expect(replayed[0]?.provenance?.kind).toBe("production");
    expect(replayed[0]?.provenance?.sourceLineage).toBe("agent-brief");
    store.close();
  });

  it("explicit provenance always wins (regardless of flag)", () => {
    setProvenanceSubstrateActive(true);
    const store = new EventStore();
    const tag = simulatedTag({
      scenario: "stress-adverse",
      sourceLineage: "scenario-runner:stress-adverse",
    });
    store.append(mk({ type: "ScenarioEvent", provenance: tag }));
    const replayed = [...store.replay()];
    expect(replayed[0]?.provenance?.kind).toBe("simulated");
    expect(replayed[0]?.provenance?.scenario).toBe("stress-adverse");
    store.close();
  });

  it("explicit provenance with invalid cross-axis is rejected at append", () => {
    setProvenanceSubstrateActive(true);
    const store = new EventStore();
    expect(() =>
      store.append(
        mk({
          type: "ScenarioEvent",
          // Intentionally invalid: production must not carry scenario.
          // Cast through unknown to bypass the structural type.
          provenance: {
            kind: "production",
            scenario: "stress-adverse",
            sourceLineage: "scenario-runner:foo",
          } as unknown as ProvenanceTag,
        }),
      ),
    ).toThrow();
    store.close();
  });
});

// ---------------------------------------------------------------------------
// 6. Soft-tagger / backfill round-trip
// ---------------------------------------------------------------------------

describe("Soft-tagger + backfill round-trip", () => {
  it("auto-heals untagged events on store-open (constructor pass)", () => {
    setProvenanceSubstrateActive(false);
    const store = new EventStore();
    // Append legacy-shape events under the flag-off path.
    store.append(mk({ type: "RandomEvent" }));
    store.append(mk({ type: "CeoDecision", citations: ["GOV-FRAMEWORK-CEO-RESERVED"] }));
    store.append(
      mk({
        type: "AgentBriefIssued",
        citations: ["GOV-AGENT-DISPATCH"],
        payload: {
          briefId: "brief:atlas:provenance-test",
          issuedTo: { name: "Atlas", position: "Core banking platform architect" },
          issuedBy: { name: "Scrooge", position: "Chief of Staff" },
          title: "Test brief",
          directiveDocumentHash: `blake3:${"a".repeat(64)}`,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "test output" }],
        },
      }),
    );

    // Pre-soft-tag: replay shows them untagged.
    const before = [...store.replay()];
    expect(before.every((e) => e.provenance === undefined)).toBe(true);

    // Manually invoke the soft-tagger (the constructor's call had no
    // rows to heal because they didn't exist yet).
    const result = store.softTagUntaggedEvents();
    expect(result.tagged).toBe(3);
    expect(result.byKind.production).toBe(2); // CeoDecision + AgentBriefIssued
    expect(result.byKind.simulated).toBe(1); // RandomEvent

    // Post-soft-tag: every event has a provenance, with correct carve-outs.
    const after = [...store.replay()];
    const ceo = after.find((e) => e.type === "CeoDecision");
    const brief = after.find((e) => e.type === "AgentBriefIssued");
    const random = after.find((e) => e.type === "RandomEvent");
    expect(ceo?.provenance?.kind).toBe("production");
    expect(ceo?.provenance?.sourceLineage).toBe("ceo-decision-record");
    expect(brief?.provenance?.kind).toBe("production");
    expect(brief?.provenance?.sourceLineage).toBe("agent-brief");
    expect(random?.provenance?.kind).toBe("simulated");
    expect(random?.provenance?.scenario).toBe("pre-substrate-build-phase");
    store.close();
  });

  it("is idempotent — second invocation is a no-op", () => {
    setProvenanceSubstrateActive(false);
    const store = new EventStore();
    store.append(mk({ type: "RandomEvent" }));
    store.softTagUntaggedEvents(); // first pass
    const result = store.softTagUntaggedEvents(); // second pass
    expect(result.tagged).toBe(0);
    expect(result.byKind.production).toBe(0);
    expect(result.byKind.simulated).toBe(0);
    store.close();
  });

  it("countByProvenanceKind reports per-kind totals", () => {
    setProvenanceSubstrateActive(true);
    const store = new EventStore();
    store.append(mk({ type: "CeoDecision", citations: ["GOV-FRAMEWORK-CEO-RESERVED"] }));
    store.append(
      mk({
        type: "AgentBriefIssued",
        citations: ["GOV-AGENT-DISPATCH"],
        payload: {
          briefId: "brief:atlas:provenance-test",
          issuedTo: { name: "Atlas", position: "Core banking platform architect" },
          issuedBy: { name: "Scrooge", position: "Chief of Staff" },
          title: "Test brief",
          directiveDocumentHash: `blake3:${"a".repeat(64)}`,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "test output" }],
        },
      }),
    );
    store.append(
      mk({
        type: "ScenarioEvent",
        provenance: simulatedTag({
          scenario: "stress-adverse",
          sourceLineage: "scenario-runner:stress-adverse",
        }),
      }),
    );
    const counts = store.countByProvenanceKind();
    expect(counts.production).toBe(2);
    expect(counts.simulated).toBe(1);
    expect(counts.untagged).toBe(0);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// 7. Test-fixture convention (per pack §12.2)
// ---------------------------------------------------------------------------

describe("Test-fixture convention (unit-test scenario)", () => {
  it("test fixtures use simulated/unit-test/bun-test-runner pattern", () => {
    const tag = simulatedTag({
      scenario: "unit-test",
      sourceLineage: "bun-test-runner:tests/provenance.test.ts",
    });
    const parsed = provenanceTagSchema.parse(tag);
    expect(parsed.kind).toBe("simulated");
    expect(parsed.scenario).toBe("unit-test");
    expect(isRegisteredLineage(String(tag.sourceLineage))).toBe(true);
  });
});
