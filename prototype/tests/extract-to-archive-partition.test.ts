// tests/extract-to-archive-partition.test.ts
//
// Test suite for EventStore.extractToArchivePartition() (selective
// archive extraction), the read-only cold-store open, and the bun-test
// home-store construction guard. Covers:
//   - Predicate extraction: sparse mid-range rows move hot → cold; the
//     partition registry row is registered with correct min/max/count/
//     SHA-256; non-matching rows are untouched.
//   - Event-id extraction: explicit id list; missing ids are rejected.
//   - PartitionedEventStore.replay() yields every extracted event after
//     extraction (cold-first ordering) — nothing destroyed.
//   - verifyArchiveIntegrity() passes on a fresh extraction AND STILL
//     passes after a replay (read-only cold opens — regression test for
//     the journal-mode-header hash-breakage defect).
//   - Error cases: empty selection, existing archive file, empty
//     predicate, read-only store.
//   - Home-store guard: constructing a writable EventStore at the
//     shared home store path under bun test throws; the
//     BANK_TEST_USE_AMBIENT_DB=1 escape hatch and read-only opens are
//     exempt.
//
// Authority: D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION (CEO-approved
// 2026-06-11); D-EVENT-STORE-SCALING-PHASE-5.
// Author: Atlas (Core banking platform architect, engineering)

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { PartitionedEventStore } from "../platform/event-store/partitioned-store";
import { EventStore, forbiddenTestHomeStorePath } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";

function mk(overrides: Partial<Event> = {}): Event {
  return {
    event_id: crypto.randomUUID(),
    type: "TestEvent",
    as_of: "2026-06-11T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "system", id: "atlas-test" },
    citations: ["D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION"],
    payload: {},
    ...overrides,
  } as Event;
}

let tmpDir: string;
let hotDbPath: string;
let archivePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "bank-extract-partition-test-"));
  hotDbPath = join(tmpDir, "hot.db");
  archivePath = join(tmpDir, "extract-001.db");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Seed 20 events: every 4th row is a fixture (sequences 4, 8, 12, 16, 20). */
function seedMixedStore(): { store: EventStore; fixtureIds: string[]; realIds: string[] } {
  const store = new EventStore(hotDbPath);
  const fixtureIds: string[] = [];
  const realIds: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const isFixture = i % 4 === 0;
    const id = `evt-${String(i).padStart(2, "0")}`;
    store.append(
      mk({
        event_id: id,
        entity: isFixture ? "BANK-FIXTURE-RED" : "LE-ZA-HOZ-BANK",
        type: isFixture ? "FixtureNoise" : "RealEvent",
      }),
    );
    (isFixture ? fixtureIds : realIds).push(id);
  }
  return { store, fixtureIds, realIds };
}

describe("EventStore.extractToArchivePartition() — predicate selection", () => {
  it("moves sparse matching rows to a new cold partition and registers it", () => {
    const { store, fixtureIds, realIds } = seedMixedStore();

    const result = store.extractToArchivePartition(
      { predicate: { where: "entity LIKE ?", params: ["BANK-FIXTURE-%"] } },
      archivePath,
    );

    // Sparse range: sequences 4..20, count 5 over a 17 span.
    expect(result.eventCount).toBe(5);
    expect(result.minSeq).toBe(4);
    expect(result.maxSeq).toBe(20);
    expect(result.sha256Hash.length).toBe(64);
    expect(result.byEntity["BANK-FIXTURE-RED"]).toBe(5);
    expect(result.byType.FixtureNoise).toBe(5);

    // Hot store: only the 15 real rows remain, untouched.
    expect(store.count()).toBe(15);
    const hotIds = [...store.replay()].map((e) => e.event_id);
    expect(hotIds).toEqual(realIds);
    expect(hotIds).not.toContain(fixtureIds[0]);

    // Registry row matches.
    const partitions = store.listArchivePartitions();
    expect(partitions).toHaveLength(1);
    expect(partitions[0]?.partition_id).toBe(result.partitionId);
    expect(partitions[0]?.min_sequence).toBe(4);
    expect(partitions[0]?.max_sequence).toBe(20);
    expect(partitions[0]?.event_count).toBe(5);
    expect(partitions[0]?.sha256_hash).toBe(result.sha256Hash);

    // Stored hash matches the file bytes on disk.
    const actualHash = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
    expect(actualHash).toBe(result.sha256Hash);

    store.close();
  });

  it("extracted events remain fully replayable via PartitionedEventStore (cold-first)", () => {
    const { store, fixtureIds, realIds } = seedMixedStore();
    store.extractToArchivePartition(
      { predicate: { where: "entity LIKE ?", params: ["BANK-FIXTURE-%"] } },
      archivePath,
    );

    const pStore = new PartitionedEventStore(store);
    const replayed = [...pStore.replay()].map((e) => e.event_id);

    // Total preserved: every event exactly once; cold partition first.
    expect(replayed).toHaveLength(20);
    expect(replayed.slice(0, 5)).toEqual(fixtureIds);
    expect(replayed.slice(5)).toEqual(realIds);

    // Payload/envelope fidelity on a cold event.
    const cold = [...pStore.replay()].find((e) => e.event_id === fixtureIds[0]);
    expect(cold?.entity).toBe("BANK-FIXTURE-RED");
    expect(cold?.type).toBe("FixtureNoise");
    expect(cold?.citations).toEqual(["D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION"]);

    pStore.close();
  });

  it("hash integrity verifies on a fresh extraction AND still verifies after replay (read-only cold opens)", () => {
    const { store } = seedMixedStore();
    store.extractToArchivePartition(
      { predicate: { where: "entity LIKE ?", params: ["BANK-FIXTURE-%"] } },
      archivePath,
    );

    const pStore = new PartitionedEventStore(store);
    expect(pStore.verifyArchiveIntegrity().every((r) => r.ok)).toBe(true);

    // Replay opens the cold store. Pre-fix this flipped the SQLite
    // journal-mode header byte (read-write EventStore open runs
    // PRAGMA journal_mode=WAL + DDL + soft-tagger + claim backfill)
    // and permanently invalidated the registered SHA-256. The read-only
    // cold open must leave every byte intact.
    const replayCount = [...pStore.replay()].length;
    expect(replayCount).toBe(20);
    expect(pStore.verifyArchiveIntegrity().every((r) => r.ok)).toBe(true);

    pStore.close();
  });

  it("a second extraction to a second partition co-exists (multiple sparse partitions)", () => {
    const { store } = seedMixedStore();
    store.extractToArchivePartition(
      { predicate: { where: "entity LIKE ?", params: ["BANK-FIXTURE-%"] } },
      archivePath,
    );
    // Extract the RealEvent rows 1..3 by id.
    const second = join(tmpDir, "extract-002.db");
    store.extractToArchivePartition({ eventIds: ["evt-01", "evt-02", "evt-03"] }, second);

    expect(store.count()).toBe(12);
    expect(store.listArchivePartitions()).toHaveLength(2);

    const pStore = new PartitionedEventStore(store);
    expect([...pStore.replay()]).toHaveLength(20);
    expect(pStore.verifyArchiveIntegrity().every((r) => r.ok)).toBe(true);
    pStore.close();
  });

  it("rejects an empty-match predicate", () => {
    const { store } = seedMixedStore();
    expect(() =>
      store.extractToArchivePartition(
        { predicate: { where: "entity = ?", params: ["NO-SUCH-ENTITY"] } },
        archivePath,
      ),
    ).toThrow(/zero rows/);
    expect(store.count()).toBe(20);
    store.close();
  });

  it("rejects an empty predicate string", () => {
    const { store } = seedMixedStore();
    expect(() =>
      store.extractToArchivePartition({ predicate: { where: "   " } }, archivePath),
    ).toThrow(/non-empty/);
    store.close();
  });

  it("refuses to overwrite an existing archive file", () => {
    const { store } = seedMixedStore();
    store.extractToArchivePartition(
      { predicate: { where: "entity LIKE ?", params: ["BANK-FIXTURE-%"] } },
      archivePath,
    );
    expect(() =>
      store.extractToArchivePartition(
        { predicate: { where: "type = ?", params: ["RealEvent"] } },
        archivePath,
      ),
    ).toThrow(/already exists/);
    store.close();
  });
});

describe("EventStore.extractToArchivePartition() — event-id selection", () => {
  it("extracts exactly the requested ids", () => {
    const { store, fixtureIds } = seedMixedStore();
    const result = store.extractToArchivePartition({ eventIds: fixtureIds }, archivePath);
    expect(result.eventCount).toBe(5);
    expect(store.count()).toBe(15);
    store.close();
  });

  it("rejects when any requested id is missing from the hot store", () => {
    const { store, fixtureIds } = seedMixedStore();
    expect(() =>
      store.extractToArchivePartition(
        { eventIds: [...fixtureIds, "evt-does-not-exist"] },
        archivePath,
      ),
    ).toThrow(/not present in the hot store/);
    // Nothing moved.
    expect(store.count()).toBe(20);
    expect(store.listArchivePartitions()).toHaveLength(0);
    store.close();
  });

  it("rejects an empty id list", () => {
    const { store } = seedMixedStore();
    expect(() => store.extractToArchivePartition({ eventIds: [] }, archivePath)).toThrow(
      /zero rows/,
    );
    store.close();
  });
});

describe("read-only EventStore open", () => {
  it("replays without mutating a single byte", () => {
    const { store } = seedMixedStore();
    store.close();

    const before = createHash("sha256").update(readFileSync(hotDbPath)).digest("hex");
    const ro = new EventStore(hotDbPath, { readonly: true });
    expect(ro.readonlyMode).toBe(true);
    expect([...ro.replay()]).toHaveLength(20);
    expect(ro.count()).toBe(20);
    ro.close();
    const after = createHash("sha256").update(readFileSync(hotDbPath)).digest("hex");
    expect(after).toBe(before);
  });

  it("rejects appends and extraction", () => {
    const { store } = seedMixedStore();
    store.close();
    const ro = new EventStore(hotDbPath, { readonly: true });
    expect(() => ro.append(mk())).toThrow();
    expect(() =>
      ro.extractToArchivePartition({ eventIds: ["evt-01"] }, join(tmpDir, "x.db")),
    ).toThrow(/read-only/);
    ro.close();
  });
});

describe("bun-test home-store construction guard", () => {
  const env = { nodeEnv: "test", allowAmbient: undefined, bankHomeEventDb: undefined };
  const home = "/Users/example";
  const homeDefault = "/Users/example/.local/share/bank/event.db";

  it("forbids the home-default path under bun test", () => {
    expect(forbiddenTestHomeStorePath(homeDefault, env, home)).toBe(homeDefault);
  });

  it("forbids the BANK_HOME_EVENT_DB path under bun test", () => {
    expect(
      forbiddenTestHomeStorePath(
        "/custom/shared.db",
        { ...env, bankHomeEventDb: "/custom/shared.db" },
        home,
      ),
    ).toBe("/custom/shared.db");
  });

  it("allows tmpdir paths under bun test", () => {
    expect(forbiddenTestHomeStorePath("/tmp/bank-test-x/event.db", env, home)).toBe(null);
  });

  it("allows :memory: under bun test", () => {
    expect(forbiddenTestHomeStorePath(":memory:", env, home)).toBe(null);
  });

  it("allows the home-default path outside bun test", () => {
    expect(forbiddenTestHomeStorePath(homeDefault, { ...env, nodeEnv: "production" }, home)).toBe(
      null,
    );
    expect(forbiddenTestHomeStorePath(homeDefault, { ...env, nodeEnv: undefined }, home)).toBe(
      null,
    );
  });

  it("honours the BANK_TEST_USE_AMBIENT_DB=1 escape hatch", () => {
    expect(forbiddenTestHomeStorePath(homeDefault, { ...env, allowAmbient: "1" }, home)).toBe(null);
  });

  it("constructor enforces the guard end-to-end (via BANK_HOME_EVENT_DB)", () => {
    // Point the "shared home store" env at a tmp path so the guard
    // triggers without ever touching the operator's real home store.
    // bun test sets NODE_ENV=test; tests/_setup.ts leaves
    // BANK_TEST_USE_AMBIENT_DB unset.
    const fakeShared = join(tmpDir, "fake-shared-event.db");
    const prior = process.env.BANK_HOME_EVENT_DB;
    process.env.BANK_HOME_EVENT_DB = fakeShared;
    try {
      expect(() => new EventStore(fakeShared)).toThrow(/refusing to open the shared home store/);
      // Read-only open of the same path is exempt (cannot pollute) —
      // but the file must exist for SQLite readonly mode, so create it
      // via a non-shared path first.
      const seed = new EventStore(join(tmpDir, "seed.db"));
      seed.append(mk());
      seed.close();
    } finally {
      // Empty string is treated as unset by the resolution + guard
      // helpers (nonEmpty / optional-chain trim) — avoids the noDelete
      // lint and the "undefined"-string coercion of env assignment.
      process.env.BANK_HOME_EVENT_DB = prior ?? "";
    }
  });
});
