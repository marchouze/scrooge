// platform/recon/event-store-append-only.test.ts
//
// Unit tests for the event-store-append-only recon pipeline.
//
// Coverage:
//   - First-run path (no baseline → asserts the seed observation).
//   - Happy path (steady growth across runs → invariants hold).
//   - (A) row-count regression detected.
//   - (B) max-sequence regression detected.
//   - (C) interior-gap regression at constant rowCount detected.
//   - Legitimate cloud-merge (interior gap grows) does not flag.
//   - Failed run does NOT ratchet the baseline forward.
//   - Red-team end-to-end: synthetic `DELETE FROM events` against a
//     real SQLite DB triggers the exact violation with the precise
//     rowcount delta.
//
// Author: Vera (Internal audit engineer, third line)

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  type EventStoreBaseline,
  type EventStoreObservation,
  compareToBaseline,
  loadBaselineFromDisk,
  observeEventStore,
  ratchetBaseline,
  runEventStoreAppendOnlyRecon,
  writeBaselineToDisk,
} from "./event-store-append-only";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function obs(partial: Partial<EventStoreObservation>): EventStoreObservation {
  return {
    rowCount: 100,
    maxSequence: 100,
    minSequence: 1,
    interiorGap: 0,
    archivedCount: 0,
    archivedMaxSequence: 0,
    observedAt: "2026-05-21T16:00:00.000Z",
    ...partial,
  };
}

function baseline(partial: Partial<EventStoreBaseline>): EventStoreBaseline {
  return {
    rowCount: 100,
    maxSequence: 100,
    minSequence: 1,
    interiorGap: 0,
    archivedCount: 0,
    baselineAt: "2026-05-21T12:00:00.000Z",
    updatedAt: "2026-05-21T12:00:00.000Z",
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// compareToBaseline — pure-function semantics
// ---------------------------------------------------------------------------

describe("compareToBaseline", () => {
  it("returns no violations on first run (no baseline)", () => {
    expect(compareToBaseline(obs({}), null)).toEqual([]);
  });

  it("returns no violations when invariants hold", () => {
    const v = compareToBaseline(obs({ rowCount: 150, maxSequence: 150 }), baseline({}));
    expect(v).toEqual([]);
  });

  it("flags row-count regression as fail with subject 'events:rowCount'", () => {
    const v = compareToBaseline(
      obs({ rowCount: 95, maxSequence: 100 }),
      baseline({ rowCount: 100, maxSequence: 100 }),
    );
    expect(v).toHaveLength(1);
    expect(v[0]?.severity).toBe("fail");
    expect(v[0]?.subject).toBe("events:rowCount");
    // Precise delta should be present in the message.
    expect(v[0]?.message).toContain("100");
    expect(v[0]?.message).toContain("95");
    expect(v[0]?.message).toContain("DELETE");
  });

  it("flags max-sequence regression as fail with subject 'events:maxSequence'", () => {
    const v = compareToBaseline(
      obs({ rowCount: 100, maxSequence: 80 }),
      baseline({ rowCount: 100, maxSequence: 100 }),
    );
    expect(v).toHaveLength(1);
    expect(v[0]?.severity).toBe("fail");
    expect(v[0]?.subject).toBe("events:maxSequence");
  });

  it("flags interior-gap shrinkage at constant rowCount", () => {
    const v = compareToBaseline(
      obs({ rowCount: 100, maxSequence: 100, interiorGap: 0 }),
      baseline({ rowCount: 100, maxSequence: 100, interiorGap: 10 }),
    );
    expect(v).toHaveLength(1);
    expect(v[0]?.severity).toBe("fail");
    expect(v[0]?.subject).toBe("events:interiorGap");
  });

  it("does NOT flag interior-gap growth (legitimate cloud-merge)", () => {
    // Cloud-merge brings in rows whose birth-store sequence is higher
    // than the local max — interior gap legitimately widens.
    const v = compareToBaseline(
      obs({ rowCount: 200, maxSequence: 500, interiorGap: 300 }),
      baseline({ rowCount: 100, maxSequence: 100, interiorGap: 0 }),
    );
    expect(v).toEqual([]);
  });

  it("does NOT flag interior-gap shrinkage if rowCount grew (in-fill)", () => {
    // Legitimate scenario: cloud-merge pulled new rows that filled
    // pre-existing gaps. rowCount grew, gap narrowed — fine.
    const v = compareToBaseline(
      obs({ rowCount: 150, maxSequence: 200, interiorGap: 50 }),
      baseline({ rowCount: 100, maxSequence: 200, interiorGap: 100 }),
    );
    expect(v).toEqual([]);
  });

  it("can flag multiple invariants at once (combined DELETE)", () => {
    // A bulk DELETE of recent rows lowers rowCount AND maxSequence.
    const v = compareToBaseline(
      obs({ rowCount: 90, maxSequence: 90 }),
      baseline({ rowCount: 100, maxSequence: 100 }),
    );
    expect(v).toHaveLength(2);
    const subjects = v.map((x) => x.subject).sort();
    expect(subjects).toEqual(["events:maxSequence", "events:rowCount"]);
  });
});

// ---------------------------------------------------------------------------
// ratchetBaseline — monotonic forward
// ---------------------------------------------------------------------------

describe("ratchetBaseline", () => {
  it("initialises from observation when no baseline exists", () => {
    const b = ratchetBaseline(obs({ rowCount: 100, maxSequence: 100 }), null);
    expect(b.rowCount).toBe(100);
    expect(b.maxSequence).toBe(100);
    expect(b.baselineAt).toBe("2026-05-21T16:00:00.000Z");
  });

  it("ratchets row count + max sequence forward", () => {
    const b = ratchetBaseline(
      obs({ rowCount: 150, maxSequence: 150 }),
      baseline({ rowCount: 100, maxSequence: 100 }),
    );
    expect(b.rowCount).toBe(150);
    expect(b.maxSequence).toBe(150);
  });

  it("preserves baseline-at (first-seen timestamp)", () => {
    const b = ratchetBaseline(
      obs({ rowCount: 150 }),
      baseline({ baselineAt: "2026-05-01T00:00:00.000Z" }),
    );
    expect(b.baselineAt).toBe("2026-05-01T00:00:00.000Z");
    expect(b.updatedAt).toBe("2026-05-21T16:00:00.000Z");
  });

  it("retains the largest interior gap seen (monotonic upward)", () => {
    const b = ratchetBaseline(
      obs({ interiorGap: 50, rowCount: 200, maxSequence: 250 }),
      baseline({ interiorGap: 100, rowCount: 150, maxSequence: 250 }),
    );
    expect(b.interiorGap).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// runEventStoreAppendOnlyRecon — orchestration with injected observation
// ---------------------------------------------------------------------------

describe("runEventStoreAppendOnlyRecon (injected observation)", () => {
  it("first-run path: no baseline → ok=true, no violations", () => {
    const r = runEventStoreAppendOnlyRecon({
      observation: obs({ rowCount: 100, maxSequence: 100 }),
      baseline: null,
      persistBaseline: false,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.observation?.rowCount).toBe(100);
    expect(r.baselineBefore).toBe(null);
  });

  it("happy path: baseline + steady growth → ok=true", () => {
    const r = runEventStoreAppendOnlyRecon({
      observation: obs({ rowCount: 150, maxSequence: 150 }),
      baseline: baseline({ rowCount: 100, maxSequence: 100 }),
      persistBaseline: false,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.baselineAfter?.rowCount).toBe(150);
  });

  it("regression path: row-count drop → ok=false, no baseline ratchet", () => {
    const before = baseline({ rowCount: 100, maxSequence: 100 });
    const r = runEventStoreAppendOnlyRecon({
      observation: obs({ rowCount: 95, maxSequence: 100 }),
      baseline: before,
      persistBaseline: false,
    });
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.subject).toBe("events:rowCount");
    // Failed run must NOT advance the baseline.
    expect(r.baselineAfter).toBe(before);
  });

  it("nothing to assert when DB doesn't exist (fresh CI runner)", () => {
    const r = runEventStoreAppendOnlyRecon({
      eventDbPath: "/tmp/__bank_does_not_exist_event.db",
      baseline: null,
      persistBaseline: false,
    });
    // observeEventStore returns null when the file is absent. With
    // an injected null observation we return ok=true.
    expect(r.observation).toBe(null);
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// observeEventStore + baseline I/O — real SQLite file
// ---------------------------------------------------------------------------

describe("observeEventStore + baseline I/O", () => {
  let tmp: string;
  let dbPath: string;
  let baselinePath: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "vera-append-only-"));
    dbPath = join(tmp, "event.db");
    baselinePath = join(tmp, "baseline.json");
    // Construct a minimal events table (the production schema is much
    // wider but only `sequence` is load-bearing for our invariants).
    const db = new Database(dbPath);
    db.exec(
      "CREATE TABLE events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, type TEXT, as_of TEXT, entity TEXT, actor_type TEXT, actor_id TEXT, citations TEXT, payload TEXT)",
    );
    const ins = db.prepare(
      "INSERT INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (let i = 1; i <= 10; i++) {
      ins.run(`evt-${i}`, "Synthetic", "2026-05-21", "test", "system", "vera-test", "[]", "{}");
    }
    db.close();
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reads count + min + max + interior gap from a real DB", () => {
    const o = observeEventStore(dbPath);
    expect(o).not.toBe(null);
    expect(o?.rowCount).toBe(10);
    expect(o?.minSequence).toBe(1);
    expect(o?.maxSequence).toBe(10);
    expect(o?.interiorGap).toBe(0);
  });

  it("returns null when DB path does not exist", () => {
    expect(observeEventStore(join(tmp, "absent.db"))).toBe(null);
  });

  it("returns null when DB exists but lacks events table", () => {
    const emptyPath = join(tmp, "empty.db");
    const db = new Database(emptyPath);
    db.exec("CREATE TABLE other (id INTEGER)");
    db.close();
    expect(observeEventStore(emptyPath)).toBe(null);
  });

  it("writes and reads baseline JSON round-trip", () => {
    const b = baseline({});
    writeBaselineToDisk(baselinePath, b);
    const loaded = loadBaselineFromDisk(baselinePath);
    expect(loaded).toEqual(b);
  });

  it("loadBaselineFromDisk returns null for missing file", () => {
    expect(loadBaselineFromDisk(join(tmp, "no-such-baseline.json"))).toBe(null);
  });

  it("loadBaselineFromDisk returns null for malformed file", () => {
    const bad = join(tmp, "bad-baseline.json");
    writeFileSync(bad, "not-json{{");
    expect(loadBaselineFromDisk(bad)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Red-team end-to-end: synthetic DELETE → pipeline flags exact delta
// ---------------------------------------------------------------------------

describe("red-team: DELETE FROM events triggers the pipeline", () => {
  let tmp: string;
  let dbPath: string;
  let baselinePath: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "vera-redteam-"));
    dbPath = join(tmp, "event.db");
    baselinePath = join(tmp, "baseline.json");
    const db = new Database(dbPath);
    db.exec(
      "CREATE TABLE events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, type TEXT, as_of TEXT, entity TEXT, actor_type TEXT, actor_id TEXT, citations TEXT, payload TEXT)",
    );
    const ins = db.prepare(
      "INSERT INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (let i = 1; i <= 100; i++) {
      ins.run(`evt-${i}`, "Synthetic", "2026-05-21", "test", "system", "vera-test", "[]", "{}");
    }
    db.close();
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("seeds baseline on first run", () => {
    const r = runEventStoreAppendOnlyRecon({
      eventDbPath: dbPath,
      baselinePath,
    });
    expect(r.ok).toBe(true);
    expect(r.observation?.rowCount).toBe(100);
    expect(r.observation?.maxSequence).toBe(100);
    // First run: no prior baseline.
    expect(r.baselineBefore).toBe(null);
    // Baseline now persisted to disk.
    const persisted = loadBaselineFromDisk(baselinePath);
    expect(persisted?.rowCount).toBe(100);
  });

  it("second run with no mutation: still ok=true, baseline ratchets timestamps", () => {
    const r = runEventStoreAppendOnlyRecon({
      eventDbPath: dbPath,
      baselinePath,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.baselineBefore?.rowCount).toBe(100);
  });

  it("injected DELETE FROM events trips the pipeline with the precise delta", () => {
    // Side-band DELETE — simulates the 2026-05-21 incident.
    const sideband = new Database(dbPath);
    sideband.exec("DELETE FROM events WHERE sequence IN (50, 51, 52)");
    sideband.close();

    const r = runEventStoreAppendOnlyRecon({
      eventDbPath: dbPath,
      baselinePath,
    });

    expect(r.ok).toBe(false);
    // Row count dropped from 100 to 97; max-sequence unchanged (we
    // deleted interior rows, not the tail). So exactly one finding
    // on `events:rowCount`. Interior-gap grew (3 holes carved) but
    // rowCount dropped — interior-gap-growth-without-rowCount-growth
    // is NOT flagged by design (we only flag *shrinkage* there).
    expect(r.violations).toHaveLength(1);
    const violation = r.violations[0];
    expect(violation?.subject).toBe("events:rowCount");
    expect(violation?.severity).toBe("fail");
    // Precise delta in the message.
    expect(violation?.message).toContain("100");
    expect(violation?.message).toContain("97");
    expect(violation?.message).toContain("-3");
    expect(violation?.message).toContain("DELETE");
    expect(violation?.message).toContain("Principle 1");
    // Failed run did NOT ratchet baseline forward.
    expect(r.baselineAfter?.rowCount).toBe(100);
    // Disk baseline likewise untouched.
    expect(loadBaselineFromDisk(baselinePath)?.rowCount).toBe(100);
  });

  it("tail DELETE (highest-sequence rows) trips BOTH rowCount and maxSequence", () => {
    // Fresh fixture for this case so we don't carry forward the interior
    // DELETE state from the previous test.
    const tmp2 = mkdtempSync(join(tmpdir(), "vera-redteam-tail-"));
    try {
      const dbPath2 = join(tmp2, "event.db");
      const baselinePath2 = join(tmp2, "baseline.json");
      const db = new Database(dbPath2);
      db.exec(
        "CREATE TABLE events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, type TEXT, as_of TEXT, entity TEXT, actor_type TEXT, actor_id TEXT, citations TEXT, payload TEXT)",
      );
      const ins = db.prepare(
        "INSERT INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (let i = 1; i <= 100; i++) {
        ins.run(`evt-${i}`, "Synthetic", "2026-05-21", "test", "system", "vera-test", "[]", "{}");
      }
      db.close();

      // Seed baseline.
      const first = runEventStoreAppendOnlyRecon({
        eventDbPath: dbPath2,
        baselinePath: baselinePath2,
      });
      expect(first.ok).toBe(true);

      // SQLite AUTOINCREMENT preserves sqlite_sequence across DELETEs,
      // so to provoke a maxSequence regression we must also delete the
      // sqlite_sequence row OR replay against a fresh AUTOINCREMENT
      // counter. We use the observation-injection path to assert the
      // semantic. (A real-world max-sequence regression requires VACUUM
      // or store rebuild — the pipeline catches both via this code
      // path.)
      const r = runEventStoreAppendOnlyRecon({
        eventDbPath: dbPath2,
        baselinePath: baselinePath2,
        observation: {
          rowCount: 95,
          maxSequence: 95,
          minSequence: 1,
          interiorGap: 0,
          archivedCount: 0,
          archivedMaxSequence: 0,
          observedAt: "2026-05-21T17:00:00.000Z",
        },
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toHaveLength(2);
      const subjects = r.violations.map((v) => v.subject).sort();
      expect(subjects).toEqual(["events:maxSequence", "events:rowCount"]);
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Partition-aware semantics (D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION):
// a hot row-count decrease is sanctioned IFF covered by newly registered
// archive partitions; uncovered decreases still fail.
// ---------------------------------------------------------------------------

describe("partition-aware compareToBaseline", () => {
  it("sanctions a hot decrease exactly covered by new archive partitions (info note, no fail)", () => {
    const v = compareToBaseline(
      obs({ rowCount: 80, archivedCount: 20, maxSequence: 100, archivedMaxSequence: 95 }),
      baseline({ rowCount: 100, archivedCount: 0, maxSequence: 100 }),
    );
    expect(v.filter((x) => x.severity === "fail")).toHaveLength(0);
    expect(v).toHaveLength(1);
    expect(v[0]?.severity).toBe("info");
    expect(v[0]?.subject).toBe("events:rowCount:archive-sanctioned");
    expect(v[0]?.message).toContain("covered by registered archive partitions");
  });

  it("sanctions a hot decrease covered by archival with concurrent appends (effective count grew)", () => {
    // 2857 extracted, 500 appended: hot 100000 → 97643, archived 0 → 2857.
    const v = compareToBaseline(
      obs({
        rowCount: 97_643,
        archivedCount: 2_857,
        maxSequence: 100_500,
        archivedMaxSequence: 99_000,
      }),
      baseline({ rowCount: 100_000, archivedCount: 0, maxSequence: 100_000 }),
    );
    expect(v.filter((x) => x.severity === "fail")).toHaveLength(0);
  });

  it("fails a hot decrease NOT covered by archive partitions (partial coverage)", () => {
    // 20 rows left hot, only 15 arrived in partitions — 5 destroyed.
    const v = compareToBaseline(
      obs({ rowCount: 80, archivedCount: 15, maxSequence: 100 }),
      baseline({ rowCount: 100, archivedCount: 0, maxSequence: 100 }),
    );
    expect(v).toHaveLength(1);
    expect(v[0]?.severity).toBe("fail");
    expect(v[0]?.subject).toBe("events:rowCount");
    expect(v[0]?.message).toContain("NOT covered");
  });

  it("fails when a previously registered partition's rows vanish (effective shrink without hot decrease)", () => {
    const v = compareToBaseline(
      obs({ rowCount: 100, archivedCount: 0, maxSequence: 100 }),
      baseline({ rowCount: 100, archivedCount: 20, maxSequence: 100 }),
    );
    expect(v).toHaveLength(1);
    expect(v[0]?.severity).toBe("fail");
    expect(v[0]?.subject).toBe("events:rowCount");
  });

  it("does NOT flag a hot max-sequence drop when the max row moved to a partition", () => {
    const v = compareToBaseline(
      obs({ rowCount: 90, archivedCount: 10, maxSequence: 95, archivedMaxSequence: 100 }),
      baseline({ rowCount: 100, archivedCount: 0, maxSequence: 100 }),
    );
    expect(v.filter((x) => x.severity === "fail")).toHaveLength(0);
  });

  it("still fails when even the effective max-sequence regressed", () => {
    const v = compareToBaseline(
      obs({ rowCount: 100, archivedCount: 0, maxSequence: 80, archivedMaxSequence: 70 }),
      baseline({ rowCount: 100, maxSequence: 100 }),
    );
    expect(v).toHaveLength(1);
    expect(v[0]?.subject).toBe("events:maxSequence");
  });

  it("legacy baseline without archivedCount loads with archivedCount=0", () => {
    const tmp = mkdtempSync(join(tmpdir(), "vera-legacy-baseline-"));
    try {
      const p = join(tmp, "legacy.json");
      writeFileSync(
        p,
        JSON.stringify({
          rowCount: 100,
          maxSequence: 100,
          minSequence: 1,
          interiorGap: 0,
          baselineAt: "2026-05-21T12:00:00.000Z",
          updatedAt: "2026-05-21T12:00:00.000Z",
        }),
      );
      const loaded = loadBaselineFromDisk(p);
      expect(loaded?.archivedCount).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("ratchet snaps hot/archived counts to the clean observation (no eternal re-report after archival)", () => {
    const b = ratchetBaseline(
      obs({ rowCount: 80, archivedCount: 20, maxSequence: 100, archivedMaxSequence: 95 }),
      baseline({ rowCount: 100, archivedCount: 0, maxSequence: 100 }),
    );
    expect(b.rowCount).toBe(80);
    expect(b.archivedCount).toBe(20);
    expect(b.maxSequence).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: selective extraction against a real store keeps the recon
// green (sanctioned), while a DELETE without a partition still fails.
// ---------------------------------------------------------------------------

describe("end-to-end: extraction is sanctioned, bare DELETE is not", () => {
  let tmp: string;
  let dbPath: string;
  let baselinePath: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "vera-extraction-e2e-"));
    dbPath = join(tmp, "event.db");
    baselinePath = join(tmp, "baseline.json");
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("extraction → recon ok with sanctioned info note; boundary check ignores the overlapping partition", async () => {
    const { EventStore } = await import("../event-store/store");
    const store = new EventStore(dbPath);
    for (let i = 1; i <= 50; i++) {
      store.append({
        event_id: `evt-e2e-${i}`,
        type: i % 5 === 0 ? "FixtureNoise" : "RealEvent",
        as_of: "2026-06-11T00:00:00.000Z",
        entity: i % 5 === 0 ? "BANK-FIXTURE-OK" : "LE-ZA-HOZ-BANK",
        actor: { type: "system", id: "vera-test" },
        citations: ["D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION"],
        payload: {},
      });
    }

    // Seed baseline at 50 hot / 0 archived.
    const first = runEventStoreAppendOnlyRecon({ eventDbPath: dbPath, baselinePath });
    expect(first.ok).toBe(true);
    expect(first.observation?.rowCount).toBe(50);
    expect(first.observation?.archivedCount).toBe(0);

    // Selectively extract the 10 fixture rows (sparse, mid-range).
    const archivePath = join(tmp, "fixture-extract.db");
    const result = store.extractToArchivePartition(
      { predicate: { where: "entity = ?", params: ["BANK-FIXTURE-OK"] } },
      archivePath,
    );
    expect(result.eventCount).toBe(10);
    store.close();

    // Recon must pass: hot decrease 50→40 covered by archived 0→10.
    const r = runEventStoreAppendOnlyRecon({ eventDbPath: dbPath, baselinePath });
    expect(r.ok).toBe(true);
    expect(r.observation?.rowCount).toBe(40);
    expect(r.observation?.archivedCount).toBe(10);
    const fails = r.violations.filter((x) => x.severity === "fail");
    expect(fails).toHaveLength(0);
    // Sanctioned info note present.
    expect(r.violations.some((x) => x.subject === "events:rowCount:archive-sanctioned")).toBe(true);
    // Baseline snapped to the new split.
    const persisted = loadBaselineFromDisk(baselinePath);
    expect(persisted?.rowCount).toBe(40);
    expect(persisted?.archivedCount).toBe(10);
  });

  it("a subsequent bare DELETE (no partition) still fails", () => {
    const sideband = new Database(dbPath);
    sideband.exec("DELETE FROM events WHERE sequence IN (1, 2)");
    sideband.close();

    const r = runEventStoreAppendOnlyRecon({ eventDbPath: dbPath, baselinePath });
    expect(r.ok).toBe(false);
    expect(r.violations.some((x) => x.subject === "events:rowCount" && x.severity === "fail")).toBe(
      true,
    );
  });

  it("hot-overlap check fails when an archived sequence is duplicated back into the hot store", async () => {
    // Fresh fixture store.
    const tmp2 = mkdtempSync(join(tmpdir(), "vera-overlap-"));
    try {
      const dbPath2 = join(tmp2, "event.db");
      const baselinePath2 = join(tmp2, "baseline.json");
      const { EventStore } = await import("../event-store/store");
      const store = new EventStore(dbPath2);
      for (let i = 1; i <= 10; i++) {
        store.append({
          event_id: `evt-ov-${i}`,
          type: "TestEvent",
          as_of: "2026-06-11T00:00:00.000Z",
          entity: i <= 5 ? "BANK-FIXTURE-OK" : "LE-ZA-HOZ-BANK",
          actor: { type: "system", id: "vera-test" },
          citations: ["D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION"],
          payload: {},
        });
      }
      store.extractToArchivePartition(
        { predicate: { where: "entity = ?", params: ["BANK-FIXTURE-OK"] } },
        join(tmp2, "extract.db"),
      );
      store.close();

      // Re-insert a row at an archived sequence (1) — tier duplication.
      const sideband = new Database(dbPath2);
      sideband
        .prepare(
          "INSERT INTO events (sequence, event_id, type, as_of, entity, actor_type, actor_id, citations, payload) VALUES (1, 'evt-dup', 'TestEvent', '2026-06-11', 'LE-ZA-HOZ-BANK', 'system', 'vera-test', '[]', '{}')",
        )
        .run();
      sideband.close();

      const r = runEventStoreAppendOnlyRecon({
        eventDbPath: dbPath2,
        baselinePath: baselinePath2,
      });
      expect(
        r.violations.some(
          (x) => x.subject.startsWith("archive_partitions:hot-overlap:") && x.severity === "fail",
        ),
      ).toBe(true);
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
  });

  it("registry-parity check fails when rows are deleted from the cold file", async () => {
    const tmp3 = mkdtempSync(join(tmpdir(), "vera-parity-"));
    try {
      const dbPath3 = join(tmp3, "event.db");
      const baselinePath3 = join(tmp3, "baseline.json");
      const { EventStore } = await import("../event-store/store");
      const store = new EventStore(dbPath3);
      for (let i = 1; i <= 10; i++) {
        store.append({
          event_id: `evt-pp-${i}`,
          type: "TestEvent",
          as_of: "2026-06-11T00:00:00.000Z",
          entity: i <= 5 ? "BANK-FIXTURE-OK" : "LE-ZA-HOZ-BANK",
          actor: { type: "system", id: "vera-test" },
          citations: ["D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION"],
          payload: {},
        });
      }
      const coldPath = join(tmp3, "extract.db");
      store.extractToArchivePartition(
        { predicate: { where: "entity = ?", params: ["BANK-FIXTURE-OK"] } },
        coldPath,
      );
      store.close();

      // Tamper: remove a row from the cold file.
      const cold = new Database(coldPath);
      cold.exec("DELETE FROM events WHERE sequence = 2");
      cold.close();

      const r = runEventStoreAppendOnlyRecon({
        eventDbPath: dbPath3,
        baselinePath: baselinePath3,
      });
      expect(
        r.violations.some(
          (x) =>
            x.subject.startsWith("archive_partitions:registry-parity:") && x.severity === "fail",
        ),
      ).toBe(true);
    } finally {
      rmSync(tmp3, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Live store sanity — run against the home-store if it exists. Not strictly
// required for CI (the env may not have it), but it documents the intended
// invocation site.
// ---------------------------------------------------------------------------

describe("live event store sanity (best-effort)", () => {
  it("documents the resolved live path and stays passive (no baseline write)", () => {
    // We isolate side effects by pointing the baseline at a tmp file
    // so the test never touches the operator's recon baseline.
    const tmpBaselineDir = mkdtempSync(join(tmpdir(), "vera-live-"));
    try {
      const baselinePath = resolve(tmpBaselineDir, "live.json");
      const r = runEventStoreAppendOnlyRecon({
        baselinePath,
        // No event-db override: pick up whatever the env resolves.
      });
      // The live store may or may not exist on the test runner. Either
      // outcome is acceptable; we just confirm the call shape returns
      // a well-formed result.
      expect(typeof r.eventDbPath).toBe("string");
      expect(typeof r.baselinePath).toBe("string");
      expect(typeof r.ok).toBe("boolean");
    } finally {
      rmSync(tmpBaselineDir, { recursive: true, force: true });
    }
  });
});
