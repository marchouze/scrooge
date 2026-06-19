// tests/fx-data-feed-lineage.test.ts
//
// Regression test for `recon:fx-data-feed-lineage` (the FX C8 data-quality
// lineage audit). This is the test the recon's own header cites as the proof
// of NON-VACUITY (Engineering Charter command 3 — no green by concealment):
// the recon claims its settlement-confirmation rule is "proven to FAIL on a
// populated store missing lineage by tests/fx-data-feed-lineage.test.ts". This
// file makes that claim true.
//
// What "non-vacuous" means here, and how each test proves it:
//
//   - The gate must FAIL CLOSED on real defective lineage, not merely pass on
//     an empty store. So we POPULATE both feeds with rows that bypass the
//     constructor validation (exactly what a legacy backfill / a defective
//     producer / a pre-substrate row looks like — and exactly the raw-row
//     threat the recon reads `market_data_ticks` / `replay()` directly to
//     catch) and assert the gate returns `ok: false`.
//
//   - The gate must GREEN (no `fail`) when lineage IS present end-to-end. So we
//     populate the SAME feeds with well-formed lineage and assert `ok: true`.
//
//   - The "non-vacuity guard" tests assert the gate actually ASSERTED over a
//     non-empty population (`asserted > 0`) on the failing fixtures. If a future
//     edit removed the rate-feed or settlement assertion, the populated-FAIL
//     tests below would flip to `ok: true` and fail — this test cannot pass
//     vacuously.
//
// We write raw SQLite rows directly (not via `MarketDataStore.append` /
// `makeFilFxSettlementConfirmed`) on purpose: those constructors REJECT the
// defective shapes (blank `source` is `NOT NULL`; `provenanceTagSchema`
// rejects an empty `sourceLineage`). The audit's whole job is to catch a row
// that bypassed (or predates) the constructor — so the fixture must bypass it
// too, the same way the recon reads raw rows to find what the safe defaults
// would hide.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-DATA-PROVENANCE-SUBSTRATE; Principle 1; Principle 2.
// Author: Anya (Data & analytics engineer, engineering).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { run } from "../platform/recon/fx-data-feed-lineage";

// ---------------------------------------------------------------------------
// Fixture harness — two on-disk stores the recon opens by path.
// ---------------------------------------------------------------------------

let dir: string;
let eventDbPath: string;
let marketDataDbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fx-lineage-recon-"));
  eventDbPath = join(dir, "event.db");
  marketDataDbPath = join(dir, "market-data.db");

  // Create the event-store schema by opening (then closing) a real EventStore;
  // we then write the FilFxSettlementConfirmed rows raw so we can control the
  // `provenance` envelope column + `payload` JSON byte-for-byte.
  new EventStore(eventDbPath).close();

  // Create the market_data_ticks table with the production DDL.
  const md = new Database(marketDataDbPath);
  md.exec(`
    CREATE TABLE IF NOT EXISTS market_data_ticks (
      id           TEXT PRIMARY KEY,
      source       TEXT,
      instrument   TEXT NOT NULL,
      data_type    TEXT NOT NULL,
      provenance   TEXT NOT NULL DEFAULT 'production',
      as_of        TEXT NOT NULL,
      payload      TEXT NOT NULL,
      ingested_at  TEXT NOT NULL
    );
  `);
  md.close();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Raw inserters — write the exact rows the recon reads.
// ---------------------------------------------------------------------------

function insertRateTick(row: {
  id: string;
  source: string | null;
  instrument: string;
  provenance: string;
  payload?: Record<string, unknown>;
}): void {
  const db = new Database(marketDataDbPath);
  try {
    db.prepare(
      `INSERT INTO market_data_ticks
         (id, source, instrument, data_type, provenance, as_of, payload, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.source,
      row.instrument,
      "fx-quote",
      row.provenance,
      "2026-06-19T10:00:00.000Z",
      JSON.stringify(row.payload ?? { mid: 18.5 }),
      "2026-06-19T10:00:01.000Z",
    );
  } finally {
    db.close();
  }
}

function insertSettlementEvent(row: {
  eventId: string;
  payload: Record<string, unknown>;
  provenance: Record<string, unknown> | null;
}): void {
  const db = new Database(eventDbPath);
  try {
    db.prepare(
      `INSERT INTO events
         (event_id, type, as_of, entity, actor_type, actor_id, citations, payload, provenance)
       VALUES (?, 'FilFxSettlementConfirmed', ?, ?, 'agent', ?, '[]', ?, ?)`,
    ).run(
      row.eventId,
      "2026-06-19T10:00:00.000Z",
      "LE-ZA-HOZ-BANK",
      "anya",
      JSON.stringify(row.payload),
      row.provenance === null ? null : JSON.stringify(row.provenance),
    );
  } finally {
    db.close();
  }
}

/**
 * The economic body of a FilFxSettlementConfirmed payload WITHOUT the
 * `originatingEvent` back-ref — the lineage-less shape FEED 2 must FAIL on.
 */
function settlementPayloadWithoutOriginatingEvent(): Record<string, unknown> {
  return {
    kind: "FilFxSettlementConfirmed",
    instance: "fil:inst:LE-ZA-HOZ-BANK:fx-0001",
    type: "fil:type:fx:vanilla:spot@1.0",
    tenant: "LE-ZA-HOZ-BANK",
    asOf: "2026-06-19T10:00:00.000Z",
    legRole: "spot",
    boughtBooked: { currency: "USD", amount: "1000000.00" },
    boughtSettled: { currency: "USD", amount: "1000000.00" },
    soldBooked: { currency: "ZAR", amount: "18500000.00" },
    soldSettled: { currency: "ZAR", amount: "18510000.00" },
  };
}

/** A fully-formed FilFxSettlementConfirmed payload (lineage intact). */
function settlementPayloadWithLineage(): Record<string, unknown> {
  return {
    ...settlementPayloadWithoutOriginatingEvent(),
    // The lineage-back-to-the-trade ref the recon requires.
    originatingEvent: {
      eventType: "FxTradeExecuted",
      eventId: "evt-fx-trade-0001",
    },
  };
}

const PRODUCTION_TAG = { kind: "production", sourceLineage: "fx-settlement-flow" };

// ---------------------------------------------------------------------------
// FEED 1 — rate-feed lineage.
// ---------------------------------------------------------------------------

describe("recon:fx-data-feed-lineage — FEED 1 (rate-feed lineage)", () => {
  it("FAILS on a populated store: an fx-quote tick with a BLANK source", () => {
    insertRateTick({
      id: "tick-blank",
      source: "",
      instrument: "USDZAR",
      provenance: "production",
    });

    const r = run({ eventDbPath, marketDataDbPath });

    // Non-vacuity: the gate asserted over a real (non-empty) tick population.
    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.some((v) => v.subject === "rate-feed:tick:tick-blank")).toBe(true);
  });

  it("FAILS on a populated store: an fx-quote tick with a NULL source", () => {
    insertRateTick({
      id: "tick-null",
      source: null,
      instrument: "USDZAR",
      provenance: "production",
    });

    const r = run({ eventDbPath, marketDataDbPath });

    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.subject === "rate-feed:tick:tick-null"),
    ).toBe(true);
  });

  it("FAILS on an fx-quote tick with an UNRECOGNISED provenance value", () => {
    insertRateTick({
      id: "tick-bad-prov",
      source: "twelve-data",
      instrument: "USDZAR",
      provenance: "made-up",
    });

    const r = run({ eventDbPath, marketDataDbPath });

    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.subject === "rate-feed:tick:tick-bad-prov",
      ),
    ).toBe(true);
  });

  it("PASSES (no fail) when every tick carries a non-empty source + recognised production provenance", () => {
    insertRateTick({
      id: "tick-ok-1",
      source: "twelve-data",
      instrument: "USDZAR",
      provenance: "production",
    });
    insertRateTick({
      id: "tick-ok-2",
      source: "open-er-api",
      instrument: "EURZAR",
      provenance: "production",
    });
    // A settlement event with full lineage so FEED 2 also greens.
    insertSettlementEvent({
      eventId: "evt-settle-ok",
      payload: settlementPayloadWithLineage(),
      provenance: PRODUCTION_TAG,
    });

    const r = run({ eventDbPath, marketDataDbPath });

    expect(r.asserted).toBeGreaterThan(0);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("surfaces a SIMULATED source as an honest `info` tracked residual (never a silent green, never a fail)", () => {
    insertRateTick({
      id: "tick-sim",
      source: "ws-v2-s1-fixture",
      instrument: "USDZAR",
      provenance: "simulated",
    });

    const r = run({ eventDbPath, marketDataDbPath });

    // Simulated lineage is traceable → no fail; but it is surfaced explicitly.
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
    expect(
      r.violations.some(
        (v) => v.severity === "info" && v.subject === "rate-feed:simulated-source:ws-v2-s1-fixture",
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FEED 2 — settlement-confirmation lineage.
// ---------------------------------------------------------------------------

describe("recon:fx-data-feed-lineage — FEED 2 (settlement-confirmation lineage)", () => {
  it("FAILS on a populated store: a FilFxSettlementConfirmed event MISSING originatingEvent", () => {
    insertSettlementEvent({
      eventId: "evt-no-orig",
      payload: settlementPayloadWithoutOriginatingEvent(),
      provenance: PRODUCTION_TAG,
    });

    const r = run({ eventDbPath, marketDataDbPath });

    // Non-vacuity: the gate asserted over a real (non-empty) settlement population.
    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.subject === "settlement:evt-no-orig"),
    ).toBe(true);
  });

  it("FAILS when originatingEvent is present but eventId is BLANK (broken back-ref)", () => {
    const payload = settlementPayloadWithLineage();
    (payload.originatingEvent as Record<string, unknown>).eventId = "   ";
    insertSettlementEvent({
      eventId: "evt-blank-origid",
      payload,
      provenance: PRODUCTION_TAG,
    });

    const r = run({ eventDbPath, marketDataDbPath });

    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.subject === "settlement:evt-blank-origid",
      ),
    ).toBe(true);
  });

  it("FAILS when originatingEvent is intact but envelope provenance.sourceLineage is EMPTY", () => {
    insertSettlementEvent({
      eventId: "evt-no-lineage",
      payload: settlementPayloadWithLineage(),
      // originating-system axis missing → broken lineage.
      provenance: { kind: "production", sourceLineage: "" },
    });

    const r = run({ eventDbPath, marketDataDbPath });

    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.subject === "settlement:evt-no-lineage"),
    ).toBe(true);
  });

  it("FAILS when the envelope provenance tag is entirely ABSENT (NULL column)", () => {
    insertSettlementEvent({
      eventId: "evt-null-prov",
      payload: settlementPayloadWithLineage(),
      provenance: null,
    });

    const r = run({ eventDbPath, marketDataDbPath });

    expect(r.asserted).toBeGreaterThan(0);
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && v.subject === "settlement:evt-null-prov"),
    ).toBe(true);
  });

  it("PASSES (no fail) when originatingEvent + provenance.sourceLineage are both present", () => {
    insertSettlementEvent({
      eventId: "evt-settle-ok",
      payload: settlementPayloadWithLineage(),
      provenance: PRODUCTION_TAG,
    });

    const r = run({ eventDbPath, marketDataDbPath });

    expect(r.asserted).toBeGreaterThan(0);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
    // The build-phase `info` residual must NOT fire — the population is non-empty.
    expect(r.violations.some((v) => v.subject === "settlement:tracked-residual")).toBe(false);
  });

  it("emits the honest empty-population `info` residual when NO settlement events exist", () => {
    // Rate feed has one clean tick; settlement feed is empty.
    insertRateTick({
      id: "tick-ok",
      source: "twelve-data",
      instrument: "USDZAR",
      provenance: "production",
    });

    const r = run({ eventDbPath, marketDataDbPath });

    expect(r.ok).toBe(true);
    expect(
      r.violations.some(
        (v) => v.severity === "info" && v.subject === "settlement:tracked-residual",
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY GUARD — the assertions above are load-bearing, not tautologies.
// ---------------------------------------------------------------------------

describe("recon:fx-data-feed-lineage — non-vacuity guard", () => {
  it("a populated, fully-lineaged store GREENS while a defective store FAILS — the gate discriminates", () => {
    // Defective store: one blank-source tick + one lineage-less settlement.
    insertRateTick({ id: "bad-tick", source: "", instrument: "USDZAR", provenance: "production" });
    insertSettlementEvent({
      eventId: "bad-settle",
      payload: settlementPayloadWithoutOriginatingEvent(),
      provenance: PRODUCTION_TAG,
    });
    const bad = run({ eventDbPath, marketDataDbPath });
    expect(bad.ok).toBe(false);
    // BOTH feeds contributed a failure — neither rule is dead code.
    const badFails = bad.violations.filter((v) => v.severity === "fail");
    expect(badFails.some((v) => v.subject.startsWith("rate-feed:tick:"))).toBe(true);
    expect(badFails.some((v) => v.subject.startsWith("settlement:"))).toBe(true);

    // The asserted count reflects a real (non-empty) population on both feeds:
    // had either assertion been removed, this fixture would have GREENED and the
    // populated-FAIL tests above would fail. That is the non-vacuity proof.
    expect(bad.asserted).toBeGreaterThanOrEqual(2);
  });
});
