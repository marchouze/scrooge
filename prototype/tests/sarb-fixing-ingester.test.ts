// tests/sarb-fixing-ingester.test.ts
//
// Tests for the SARB fixing ingester (build-phase fixture variant).
//
// Covers:
//   1. Idempotency — re-running the same fixture date does not produce
//      duplicate ticks or duplicate OfficialMarkAdopted events.
//   2. Schema validity — emitted events round-trip through
//      `officialMarkAdoptedPayloadSchema`.
//   3. Provenance — emitted events carry the build-phase fixture
//      `provenance.kind === "simulated"` with
//      `sourceLineage === "sarb-fixing-fixture"`.
//   4. Tick provenance — raw ticks land in MarketDataStore with
//      `provenance: "production"` (SARB is a regulator-grade source) and
//      carry the `fixingVariant` marker in their payload.
//   5. Recon pass — `recon:market-data-provenance-gate` continues to
//      pass with the new module in place (the dedup-pattern context
//      exemption fires on the write-path `.query(` callsite).
//   6. Determinism — re-running the ingester against an unchanged
//      fixture produces the same event id (deterministic id derivation).
//   7. No-policy graceful skip — when no VALUATION-POLICY-V1 activation
//      event exists, the ingester logs and skips adoption (ticks still
//      land in MarketDataStore).
//
// Authority: Helena (Chief Risk Officer, governance) FX-spot scope review
// 2026-05-20 §6 G-1; Policies/valuation-policy-v1.md §3.1;
// D-EVENT-VIEW-BOUNDARY-WIRE; D-MARKETS-SCHEMA-FOUNDATION.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makePolicyVersionActivated } from "../platform/event-store/event-types/policy-activation";
import { officialMarkAdoptedPayloadSchema } from "../platform/event-store/event-types/valuation";
import { EventStore } from "../platform/event-store/store";
import {
  BUILD_PHASE_VARIANT_MARKER,
  SARB_FIXING_FIXTURE_PROVENANCE,
  type SarbFixingFixtureShape,
  deriveSarbFixingEventId,
  deriveSarbFixingTickId,
  makeFixtureSarbFixingSource,
  runSarbFixingIngest,
  runSarbFixingIngestAll,
} from "../platform/market-data/sarb-fixing-ingester";
import { MarketDataStore } from "../platform/market-data/store";
import { run as runProvenanceGate } from "../platform/recon/market-data-provenance-gate";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TINY_FIXTURE: SarbFixingFixtureShape = {
  pair: "USD/ZAR",
  source: "SARB",
  refTime: "17:00:00+02:00",
  fixings: {
    "2026-05-18": "18.5680",
    "2026-05-19": "18.5600",
    "2026-05-20": "18.5240",
  },
};

function freshStores(): { eventStore: EventStore; marketDataStore: MarketDataStore } {
  return {
    eventStore: new EventStore(":memory:"),
    marketDataStore: new MarketDataStore(":memory:"),
  };
}

function seedValuationPolicy(eventStore: EventStore): void {
  const activation = makePolicyVersionActivated({
    asOf: "2026-05-19T08:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { id: "agent:helena:cro", type: "service" },
    citations: ["Policies/valuation-policy-v1.md", "D-EVENT-VIEW-BOUNDARY-WIRE"],
    payload: {
      policyDomain: "valuation",
      policyId: "VALUATION-POLICY-V1",
      version: "1.0",
      effectiveFrom: "2026-05-19T00:00:00Z",
      documentHash: "blake3:2e3163f0f1c77812d494f646acc3e8bd9da10b8ec63a2339904609018a5300c2",
      supersedes: null,
      activatedBy: "agent:helena:cro",
    },
  });
  eventStore.append(activation);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sarb-fixing-ingester", () => {
  it("emits one OfficialMarkAdopted event per fixing date", () => {
    const { eventStore, marketDataStore } = freshStores();
    seedValuationPolicy(eventStore);

    const source = makeFixtureSarbFixingSource(TINY_FIXTURE);
    const results = runSarbFixingIngestAll({ source, eventStore, marketDataStore });

    expect(results).toHaveLength(3);
    const totalEmitted = results.reduce((acc, r) => acc + r.eventsEmitted, 0);
    expect(totalEmitted).toBe(3);

    const adopted = [...eventStore.replay({ type: "OfficialMarkAdopted" })];
    expect(adopted).toHaveLength(3);
  });

  it("is idempotent — re-running emits zero new events and zero new ticks", () => {
    const { eventStore, marketDataStore } = freshStores();
    seedValuationPolicy(eventStore);
    const source = makeFixtureSarbFixingSource(TINY_FIXTURE);

    // First pass — full ingest.
    const first = runSarbFixingIngestAll({ source, eventStore, marketDataStore });
    expect(first.reduce((a, r) => a + r.eventsEmitted, 0)).toBe(3);
    expect(first.reduce((a, r) => a + r.ticksAppended, 0)).toBe(3);

    // Second pass — everything must dedup.
    const second = runSarbFixingIngestAll({ source, eventStore, marketDataStore });
    expect(second.reduce((a, r) => a + r.eventsEmitted, 0)).toBe(0);
    expect(second.reduce((a, r) => a + r.eventsSkippedAsDuplicate, 0)).toBe(3);
    expect(second.reduce((a, r) => a + r.ticksAppended, 0)).toBe(0);
    expect(second.reduce((a, r) => a + r.ticksSkippedAsDuplicate, 0)).toBe(3);

    // Still only 3 events and 3 ticks in stores.
    const adopted = [...eventStore.replay({ type: "OfficialMarkAdopted" })];
    expect(adopted).toHaveLength(3);
    const ticks = marketDataStore.query({ source: "SARB" });
    expect(ticks).toHaveLength(3);
  });

  it("derives a deterministic event id for the same (pair, date)", () => {
    const id1 = deriveSarbFixingEventId("USD/ZAR", "2026-05-20");
    const id2 = deriveSarbFixingEventId("USD/ZAR", "2026-05-20");
    const id3 = deriveSarbFixingEventId("USD/ZAR", "2026-05-19");
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    // UUID-shape sanity check
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("derives a deterministic tick id for the same (pair, date)", () => {
    expect(deriveSarbFixingTickId("USD/ZAR", "2026-05-20")).toBe("SARB:USD/ZAR:2026-05-20");
  });

  it("emitted events validate against the OfficialMarkAdopted payload schema", () => {
    const { eventStore, marketDataStore } = freshStores();
    seedValuationPolicy(eventStore);
    runSarbFixingIngestAll({
      source: makeFixtureSarbFixingSource(TINY_FIXTURE),
      eventStore,
      marketDataStore,
    });

    for (const e of eventStore.replay({ type: "OfficialMarkAdopted" })) {
      // Throws on invalid payload.
      const parsed = officialMarkAdoptedPayloadSchema.parse(e.payload);
      expect(parsed.markType).toBe("fx-rate");
      expect(parsed.fairValueLevel).toBe("2");
      expect(parsed.sourceTickRef.source).toBe("SARB");
      expect(parsed.policyVersionRef).toMatch(/^urn:event:PolicyVersionActivated:/);
    }
  });

  it("emitted events carry the build-phase fixture provenance tag", () => {
    const { eventStore, marketDataStore } = freshStores();
    seedValuationPolicy(eventStore);
    runSarbFixingIngest({
      date: "2026-05-20",
      source: makeFixtureSarbFixingSource(TINY_FIXTURE),
      eventStore,
      marketDataStore,
    });

    const adopted = [...eventStore.replay({ type: "OfficialMarkAdopted" })];
    expect(adopted).toHaveLength(1);
    const provenance = adopted[0]?.provenance;
    expect(provenance).toBeDefined();
    expect(provenance?.kind).toBe(SARB_FIXING_FIXTURE_PROVENANCE.kind);
    expect(provenance?.sourceLineage).toBe(SARB_FIXING_FIXTURE_PROVENANCE.sourceLineage);
    expect(provenance?.scenario).toBe(SARB_FIXING_FIXTURE_PROVENANCE.scenario);
  });

  it("raw ticks land in MarketDataStore with production provenance and the variant marker", () => {
    const { eventStore, marketDataStore } = freshStores();
    seedValuationPolicy(eventStore);
    runSarbFixingIngest({
      date: "2026-05-20",
      source: makeFixtureSarbFixingSource(TINY_FIXTURE),
      eventStore,
      marketDataStore,
    });

    const ticks = marketDataStore.query({ source: "SARB", provenance: "production" });
    expect(ticks).toHaveLength(1);
    const tick = ticks[0];
    expect(tick?.instrument).toBe("USD/ZAR");
    expect(tick?.dataType).toBe("fx-quote");
    expect(tick?.payload?.rate).toBe("18.5240");
    expect(tick?.payload?.fixingVariant).toBe(BUILD_PHASE_VARIANT_MARKER);
  });

  it("skips OfficialMarkAdopted emission gracefully when no VALUATION-POLICY-V1 is active", () => {
    const { eventStore, marketDataStore } = freshStores();
    // Deliberately no seedValuationPolicy — fresh store.
    const result = runSarbFixingIngest({
      date: "2026-05-20",
      source: makeFixtureSarbFixingSource(TINY_FIXTURE),
      eventStore,
      marketDataStore,
    });

    expect(result.eventsEmitted).toBe(0);
    expect(result.skippedNoActivePolicy).toBe(1);
    // Tick still lands — MarketDataStore is independent of the policy.
    expect(result.ticksAppended).toBe(1);
  });

  it("returns zero entries for a date with no fixing in the fixture", () => {
    const { eventStore, marketDataStore } = freshStores();
    seedValuationPolicy(eventStore);
    const result = runSarbFixingIngest({
      date: "2026-04-27", // SA Freedom Day — public holiday, no fixing
      source: makeFixtureSarbFixingSource(TINY_FIXTURE),
      eventStore,
      marketDataStore,
    });
    expect(result.entriesProcessed).toBe(0);
    expect(result.eventsEmitted).toBe(0);
    expect(result.ticksAppended).toBe(0);
  });

  it("recon:market-data-provenance-gate passes against the ingester source file", () => {
    // Vendor the ingester source into a temp prototype tree and assert
    // the gate recognises the dedup-pattern context exemption on the
    // write-path .query( callsite.
    const protoDir = mkdtempSync(join(tmpdir(), "sarb-ingester-gate-test-"));
    const marketDataDir = join(protoDir, "platform", "market-data");
    const scriptsAgentsDir = join(protoDir, "scripts", "agents");
    // Recursive mkdir
    const { mkdirSync } = require("node:fs") as typeof import("node:fs");
    mkdirSync(marketDataDir, { recursive: true });
    mkdirSync(scriptsAgentsDir, { recursive: true });

    // Copy the ingester source verbatim (text-only — the gate scans .ts
    // bytes, not parsed TypeScript). Read with Bun's runtime fs.
    const ingesterSrc = require("node:fs").readFileSync(
      join(import.meta.dir, "..", "platform", "market-data", "sarb-fixing-ingester.ts"),
      "utf8",
    );
    writeFileSync(join(marketDataDir, "sarb-fixing-ingester.ts"), ingesterSrc, "utf8");

    const result = runProvenanceGate({ prototypeDir: protoDir });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      // Print the violations to aid diagnosis.
      console.error(JSON.stringify(result.violations, null, 2));
    }
  });
});
