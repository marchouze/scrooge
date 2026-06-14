// platform/recon/no-residual-minor-encoding-fixture-check.ts
//
// gate: recon:no-residual-minor-encoding-fixture
//
// WHY THIS EXISTS
// ---------------
// `recon:no-residual-minor-encoding` is FAIL-severity and DOES fail on the
// populated canonical store (the WS-MONEY-DECIMAL-PURGE regression left 496
// transactional events, 6,212 *Minor violations). But CI runs every recon gate
// against a FRESH config-only store (`ci:migrate` seeds only config events),
// where no transactional `*Minor` event exists — so the gate is trivially green
// on every PR and could never have caught that regression class.
//
// This check closes that CI-visibility gap WITHOUT depending on the ambient CI
// store. It builds an EPHEMERAL store in a tmpdir, seeds a representative
// transactional surface containing at least one legacy integer `*Minor` event,
// runs the residual-minor gate against THAT store, and asserts the gate REPORTS
// the violation (i.e. it would have failed on the regression). It also seeds a
// clean decimal-encoded (MoneyWire) event and asserts the gate does NOT flag it,
// so the check is non-vacuous in both directions.
//
// The store it runs against: a self-built tmpdir SQLite store seeded with
//   (a) a legacy `*Minor` numeric event  → expected: 1 violation, gate FAILS;
//   (b) a clean MoneyWire decimal event   → expected: 0 violations;
//   (c) a non-money string-"*Minor" field → expected: 0 violations (no false +).
// This is deterministic and runner-independent: it passes/fails identically
// under local `bun run ci` and on a clean GitHub CI runner.
//
// Authority: D-MONEY-DECIMAL-PURGE-REMEDIATION (CEO-approved 2026-06-14, be0580ff).
// Brief: brief:atlas:wave-1-close-purge-classifier-gap-make-residual-:2026-06-14.
// Author: Atlas (Core banking platform architect, engineering)

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Database } from "bun:sqlite";

import { run as runResidualMinorGate } from "./no-residual-minor-encoding";

const PIPELINE = "no-residual-minor-encoding-fixture";

const FIXTURE_DDL = `
CREATE TABLE IF NOT EXISTS events (
  sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT    UNIQUE NOT NULL,
  type        TEXT    NOT NULL,
  as_of       TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  actor_type  TEXT    NOT NULL,
  actor_id    TEXT    NOT NULL,
  citations   TEXT    NOT NULL,
  payload     TEXT    NOT NULL,
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;

interface FixtureEvent {
  readonly event_id: string;
  readonly type: string;
  readonly payload: unknown;
}

/**
 * A representative transactional surface. The first event is a legacy
 * integer `*Minor` encoding — exactly the class the purge missed. The gate MUST
 * flag it; if it does not, this check fails (the gate would silently let the
 * regression through). The clean MoneyWire + string-"*Minor" events guard
 * against false positives.
 */
const FIXTURE_EVENTS: readonly FixtureEvent[] = [
  {
    // (a) LEGACY — must trip the gate.
    event_id: "fixture:legacy-minor:1",
    type: "BondSettlementInstructed",
    payload: {
      settlementId: "FIXTURE-SET-1",
      nominalMinor: 4_910_000_000,
      dirtyConsiderationZarMinor: 4_810_919_487,
    },
  },
  {
    // (b) CLEAN decimal MoneyWire — must NOT trip the gate.
    event_id: "fixture:decimal-money:1",
    type: "FxSettlementInstructed",
    payload: {
      settlementId: "FIXTURE-SET-2",
      consideration: { __money: "v1", amount: "1234.56", currency: "ZAR" },
    },
  },
  {
    // (c) string field ending in "Minor" — NOT a number, must NOT trip the gate.
    event_id: "fixture:string-minor:1",
    type: "RecordFiled",
    payload: { recordId: "r1", labelMinor: "this is prose, not a number" },
  },
];

export interface FixtureCheckResult {
  readonly ok: boolean;
  readonly legacyDetected: boolean;
  readonly violationCount: number;
  readonly assertedEvents: number;
  readonly message: string;
}

/**
 * Build the ephemeral store, run the gate, and assert it reports exactly the
 * legacy `*Minor` event (and nothing else). Pure — returns a structured result.
 */
export function runFixtureCheck(): FixtureCheckResult {
  const dir = mkdtempSync(join(tmpdir(), "residual-minor-fixture-"));
  const dbPath = join(dir, "fixture-event.db");
  try {
    const db = new Database(dbPath);
    db.exec(FIXTURE_DDL);
    const insert = db.prepare(
      "INSERT INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const e of FIXTURE_EVENTS) {
      insert.run(
        e.event_id,
        e.type,
        "2026-06-14",
        "LE-ZA-HOZ-BANK",
        "agent",
        "agent:atlas:fixture",
        "[]",
        JSON.stringify(e.payload),
      );
    }
    db.close();

    const result = runResidualMinorGate({ dbPath });
    const failViolations = result.violations.filter((v) => v.severity === "fail");
    const legacyDetected = failViolations.some((v) => v.subject === "fixture:legacy-minor:1");
    const falsePositive = failViolations.some(
      (v) => v.subject === "fixture:decimal-money:1" || v.subject === "fixture:string-minor:1",
    );

    // The check is GREEN iff the gate (a) flagged the legacy event and
    // (b) raised no false positive on the clean events. Crucially: if the gate
    // had NOT detected the legacy event (regression in the gate, or the gate
    // running against an empty store), legacyDetected=false → this check FAILS,
    // which is precisely the CI visibility the brief requires.
    const ok = legacyDetected && !falsePositive;
    const message = ok
      ? `residual-minor gate correctly FAILS on a store with a legacy *Minor event (1 legacy violation detected, 0 false positives across ${FIXTURE_EVENTS.length} fixture events)`
      : !legacyDetected
        ? "FAIL: residual-minor gate did NOT detect the legacy *Minor fixture event — the gate is not load-bearing against a populated transactional store"
        : "FAIL: residual-minor gate raised a FALSE POSITIVE on a clean MoneyWire or string-Minor fixture event";

    return {
      ok,
      legacyDetected,
      violationCount: failViolations.length,
      assertedEvents: result.asserted,
      message,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export default runFixtureCheck;

// CLI entrypoint
if (import.meta.main) {
  const r = runFixtureCheck();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      pipeline: PIPELINE,
      ok: r.ok,
      asserted: r.assertedEvents,
      legacyDetected: r.legacyDetected,
      violations: r.violationCount,
      msg: r.message,
    }),
  );
  if (!r.ok) process.exit(1);
}
