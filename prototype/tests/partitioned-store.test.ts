// tests/partitioned-store.test.ts
//
// Test suite for EventStore.archiveEventsOlderThan() and
// PartitionedEventStore. Covers:
//   - archiveEventsOlderThan copies events to archive; hot count drops;
//     archive_partitions row is inserted.
//   - PartitionedEventStore.replay() returns all events (cold + hot) in
//     sequence order.
//   - verifyArchiveIntegrity() returns ok:true on a fresh archive.
//   - verifyArchiveIntegrity() returns ok:false when archive file is
//     truncated.
//   - Replay with fromSequence spanning cold/hot boundary works correctly.
//
// Authority: D-EVENT-STORE-SCALING-PHASE-5.
// Author: Atlas (Core banking platform architect, engineering)

import { mkdtempSync, rmSync, truncateSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId, nowUtc } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { PartitionedEventStore } from "../platform/event-store/partitioned-store";
import type { Event } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mk(overrides: Partial<Event> = {}): Event {
  return {
    event_id: newEventId(),
    type: "TestEvent",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: { type: "system", id: "test" },
    citations: ["D-EVENT-STORE-SCALING-PHASE-5"],
    payload: {},
    ...overrides,
  } as Event;
}

let tmpDir: string;
let hotDbPath: string;
let archivePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "bank-partitioned-store-test-"));
  hotDbPath = join(tmpDir, "hot.db");
  archivePath = join(tmpDir, "archive-001.db");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// archiveEventsOlderThan()
// ---------------------------------------------------------------------------

describe("EventStore.archiveEventsOlderThan()", () => {
  it("copies cold events to archive, drops hot count, inserts partition row", () => {
    const store = new EventStore(hotDbPath);

    // Append 5 events — we'll archive the first 3.
    const ids = Array.from({ length: 5 }, () => newEventId());
    for (const id of ids) store.append(mk({ event_id: id }));

    expect(store.count()).toBe(5);

    // Archive sequences 1-3 (cutoffSequence = 3).
    const result = store.archiveEventsOlderThan(3, archivePath);

    expect(result.minSeq).toBe(1);
    expect(result.maxSeq).toBe(3);
    expect(result.eventCount).toBe(3);
    expect(result.partitionId).toBeString();
    expect(result.sha256Hash).toBeString();
    expect(result.sha256Hash.length).toBe(64); // hex SHA-256

    // Hot store should now have only 2 events.
    expect(store.count()).toBe(2);

    // archive_partitions row should be registered.
    const partitions = store.listArchivePartitions();
    expect(partitions.length).toBe(1);
    expect(partitions[0]!.partition_id).toBe(result.partitionId);
    expect(partitions[0]!.min_sequence).toBe(1);
    expect(partitions[0]!.max_sequence).toBe(3);
    expect(partitions[0]!.event_count).toBe(3);
    expect(partitions[0]!.sha256_hash).toBe(result.sha256Hash);

    store.close();
  });

  it("archive contains the correct event IDs", () => {
    const store = new EventStore(hotDbPath);

    const ids = Array.from({ length: 4 }, () => newEventId());
    for (const id of ids) store.append(mk({ event_id: id }));

    store.archiveEventsOlderThan(2, archivePath);

    // Open archive DB and check event_ids.
    const archiveStore = new EventStore(archivePath);
    const archivedIds = [...archiveStore.replay()].map((e) => e.event_id);
    archiveStore.close();

    expect(archivedIds).toEqual([ids[0], ids[1]]);

    // Hot store should still have the last two.
    const hotIds = [...store.replay()].map((e) => e.event_id);
    expect(hotIds).toEqual([ids[2], ids[3]]);

    store.close();
  });

  it("throws when cutoffSequence <= 0", () => {
    const store = new EventStore(hotDbPath);
    store.append(mk());
    expect(() => store.archiveEventsOlderThan(0, archivePath)).toThrow();
    expect(() => store.archiveEventsOlderThan(-1, archivePath)).toThrow();
    store.close();
  });

  it("throws when archivePath is empty", () => {
    const store = new EventStore(hotDbPath);
    store.append(mk());
    expect(() => store.archiveEventsOlderThan(1, "")).toThrow();
    expect(() => store.archiveEventsOlderThan(1, "   ")).toThrow();
    store.close();
  });

  it("throws when archive file already exists", () => {
    const store = new EventStore(hotDbPath);
    store.append(mk());
    // Create a dummy file at archivePath.
    store.archiveEventsOlderThan(1, archivePath);
    // Now try to archive again to the same path.
    store.append(mk());
    expect(() => store.archiveEventsOlderThan(2, archivePath)).toThrow(/already exists/);
    store.close();
  });

  it("throws when no events exist for the cutoff range", () => {
    const store = new EventStore(hotDbPath);
    // Append 2 events but try to archive seq >= 5.
    store.append(mk());
    store.append(mk());
    // highWatermark is 2; cutoff 10 means some events should exist if seqs 1-2 exist.
    // Archive seq <= 10 will succeed; test no-events case: fresh store.
    const emptyStore = new EventStore(join(tmpDir, "empty.db"));
    expect(() => emptyStore.archiveEventsOlderThan(1, join(tmpDir, "empty-archive.db"))).toThrow();
    emptyStore.close();
    store.close();
  });
});

// ---------------------------------------------------------------------------
// PartitionedEventStore.replay()
// ---------------------------------------------------------------------------

describe("PartitionedEventStore.replay()", () => {
  it("returns all events (cold + hot) in global sequence order", () => {
    const store = new EventStore(hotDbPath);

    const allIds = Array.from({ length: 6 }, () => newEventId());
    for (const id of allIds) store.append(mk({ event_id: id }));

    // Archive sequences 1-3.
    store.archiveEventsOlderThan(3, archivePath);
    // Hot now has sequences 4-6.

    const pStore = new PartitionedEventStore(store);
    const replayed = [...pStore.replay()].map((e) => e.event_id);

    // Should be all 6 in original insertion order.
    expect(replayed).toEqual(allIds);

    pStore.close();
  });

  it("fromSequence spanning cold/hot boundary works correctly", () => {
    const store = new EventStore(hotDbPath);

    const allIds = Array.from({ length: 8 }, () => newEventId());
    for (const id of allIds) store.append(mk({ event_id: id }));

    // Archive sequences 1-4; hot has 5-8.
    store.archiveEventsOlderThan(4, archivePath);

    const pStore = new PartitionedEventStore(store);

    // fromSequence=3 spans cold (seq 3-4) and hot (seq 5-8).
    const replayed = [...pStore.replay({ fromSequence: 3 })].map((e) => e.event_id);
    expect(replayed).toEqual(allIds.slice(2)); // ids[2] through ids[7]

    // fromSequence=5 is entirely in hot store; cold partition is skipped.
    const hotOnly = [...pStore.replay({ fromSequence: 5 })].map((e) => e.event_id);
    expect(hotOnly).toEqual(allIds.slice(4)); // ids[4] through ids[7]

    pStore.close();
  });

  it("replay with no archive partitions works normally", () => {
    const store = new EventStore(hotDbPath);
    const ids = [newEventId(), newEventId(), newEventId()];
    for (const id of ids) store.append(mk({ event_id: id }));

    const pStore = new PartitionedEventStore(store);
    const replayed = [...pStore.replay()].map((e) => e.event_id);
    expect(replayed).toEqual(ids);

    pStore.close();
  });

  it("replay with multiple archive partitions yields events in order", () => {
    const store = new EventStore(hotDbPath);

    const allIds = Array.from({ length: 9 }, () => newEventId());
    for (const id of allIds) store.append(mk({ event_id: id }));

    // First archive: sequences 1-3.
    const archive1 = join(tmpDir, "archive-001.db");
    store.archiveEventsOlderThan(3, archive1);

    // Second archive: sequences 4-6.
    const archive2 = join(tmpDir, "archive-002.db");
    store.archiveEventsOlderThan(6, archive2);

    // Hot has sequences 7-9.

    const pStore = new PartitionedEventStore(store);
    const replayed = [...pStore.replay()].map((e) => e.event_id);
    expect(replayed).toEqual(allIds);

    pStore.close();
  });
});

// ---------------------------------------------------------------------------
// PartitionedEventStore.verifyArchiveIntegrity()
// ---------------------------------------------------------------------------

describe("PartitionedEventStore.verifyArchiveIntegrity()", () => {
  it("returns ok:true on a fresh archive", () => {
    const store = new EventStore(hotDbPath);
    for (let i = 0; i < 5; i++) store.append(mk());
    store.archiveEventsOlderThan(3, archivePath);

    const pStore = new PartitionedEventStore(store);
    const results = pStore.verifyArchiveIntegrity();

    expect(results.length).toBe(1);
    expect(results[0]!.ok).toBe(true);
    expect(results[0]!.error).toBeUndefined();

    pStore.close();
  });

  it("returns ok:false when archive file is truncated", () => {
    const store = new EventStore(hotDbPath);
    for (let i = 0; i < 5; i++) store.append(mk());
    store.archiveEventsOlderThan(3, archivePath);

    // Truncate the archive file to corrupt it.
    truncateSync(archivePath, 16);

    const pStore = new PartitionedEventStore(store);
    const results = pStore.verifyArchiveIntegrity();

    expect(results.length).toBe(1);
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.error).toContain("SHA-256 mismatch");

    pStore.close();
  });

  it("returns ok:false when archive file is missing", () => {
    const store = new EventStore(hotDbPath);
    for (let i = 0; i < 3; i++) store.append(mk());
    store.archiveEventsOlderThan(2, archivePath);

    // Delete the archive file directly.
    rmSync(archivePath);

    const pStore = new PartitionedEventStore(store);
    const results = pStore.verifyArchiveIntegrity();

    expect(results.length).toBe(1);
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.error).toContain("not found");

    pStore.close();
  });

  it("returns empty array when no archive partitions exist", () => {
    const store = new EventStore(hotDbPath);
    store.append(mk());

    const pStore = new PartitionedEventStore(store);
    const results = pStore.verifyArchiveIntegrity();
    expect(results).toEqual([]);

    pStore.close();
  });
});

// ---------------------------------------------------------------------------
// EventStore.minSequence()
// ---------------------------------------------------------------------------

describe("EventStore.minSequence()", () => {
  it("returns 0 on empty store", () => {
    const store = new EventStore(hotDbPath);
    expect(store.minSequence()).toBe(0);
    store.close();
  });

  it("returns the lowest sequence number", () => {
    const store = new EventStore(hotDbPath);
    store.append(mk());
    store.append(mk());
    store.append(mk());
    expect(store.minSequence()).toBe(1);

    // Archive sequences 1-2; hot min becomes 3.
    store.archiveEventsOlderThan(2, archivePath);
    expect(store.minSequence()).toBe(3);

    store.close();
  });
});

// ---------------------------------------------------------------------------
// EventStore.listArchivePartitions()
// ---------------------------------------------------------------------------

describe("EventStore.listArchivePartitions()", () => {
  it("returns empty array when no partitions exist", () => {
    const store = new EventStore(hotDbPath);
    expect(store.listArchivePartitions()).toEqual([]);
    store.close();
  });

  it("returns partitions ordered by min_sequence ASC", () => {
    const store = new EventStore(hotDbPath);
    for (let i = 0; i < 6; i++) store.append(mk());

    const archive1 = join(tmpDir, "a1.db");
    const archive2 = join(tmpDir, "a2.db");
    store.archiveEventsOlderThan(2, archive1);
    store.archiveEventsOlderThan(4, archive2);

    const partitions = store.listArchivePartitions();
    expect(partitions.length).toBe(2);
    expect(partitions[0]!.min_sequence).toBe(1);
    expect(partitions[1]!.min_sequence).toBe(3);

    store.close();
  });
});
