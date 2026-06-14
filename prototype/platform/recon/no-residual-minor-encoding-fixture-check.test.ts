// platform/recon/no-residual-minor-encoding-fixture-check.test.ts
//
// WS-MONEY-DECIMAL-PURGE-REMEDIATION Wave 1 — proves the residual-minor gate
// is load-bearing against a POPULATED transactional store (item (b) of the
// brief): the gate FAILS on a store containing a legacy `*Minor` event and does
// NOT false-positive on clean MoneyWire / string-"*Minor" events. This is the
// CI-visibility the regression needed — the gate's normal CI run is against a
// fresh config-only store where no transactional *Minor event exists.
//
// Also asserts directly (not just via the companion) that the underlying gate
// flags a legacy event, so a regression in the gate itself is caught.
//
// Authority: D-MONEY-DECIMAL-PURGE-REMEDIATION (CEO-approved 2026-06-14, be0580ff).
// Author: Atlas (Core banking platform architect, engineering)

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { run as runResidualMinorGate } from "./no-residual-minor-encoding";
import { runFixtureCheck } from "./no-residual-minor-encoding-fixture-check";

describe("no-residual-minor-encoding fixture companion", () => {
  test("(b) reports the gate FAILS on a store with a legacy *Minor event", () => {
    const r = runFixtureCheck();
    expect(r.ok).toBe(true);
    expect(r.legacyDetected).toBe(true);
    // at least one fail violation, all on the single legacy fixture event
    // (the legacy event carries two *Minor fields → two paths; no false
    // positives on the clean MoneyWire / string-Minor events).
    expect(r.violationCount).toBeGreaterThanOrEqual(1);
  });
});

describe("no-residual-minor-encoding gate — direct, against a populated store", () => {
  let dir: string;
  let dbPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "residual-minor-direct-"));
    dbPath = join(dir, "event.db");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE events (
        sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id    TEXT UNIQUE NOT NULL,
        type        TEXT NOT NULL,
        as_of       TEXT NOT NULL,
        entity      TEXT NOT NULL,
        actor_type  TEXT NOT NULL,
        actor_id    TEXT NOT NULL,
        citations   TEXT NOT NULL,
        payload     TEXT NOT NULL
      );
    `);
    const ins = db.prepare(
      "INSERT INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload) VALUES (?,?,?,?,?,?,?,?)",
    );
    ins.run(
      "legacy-1",
      "RealisedPnlRecognised",
      "2026-06-14",
      "LE-ZA-HOZ-BANK",
      "agent",
      "agent:atlas",
      "[]",
      JSON.stringify({ realisedPnlZarMinor: -15_275_564 }),
    );
    ins.run(
      "clean-1",
      "FxSettlementInstructed",
      "2026-06-14",
      "LE-ZA-HOZ-BANK",
      "agent",
      "agent:atlas",
      "[]",
      JSON.stringify({ amount: { __money: "v1", amount: "10.00", currency: "ZAR" } }),
    );
    db.close();
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("gate FAILS (ok:false) and flags the legacy event only", () => {
    const result = runResidualMinorGate({ dbPath });
    expect(result.ok).toBe(false);
    const failSubjects = result.violations
      .filter((v) => v.severity === "fail")
      .map((v) => v.subject);
    expect(failSubjects).toContain("legacy-1");
    expect(failSubjects).not.toContain("clean-1");
  });
});
