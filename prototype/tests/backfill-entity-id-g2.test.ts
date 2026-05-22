// tests/backfill-entity-id-g2.test.ts
//
// D-G2-ENTITY-ID-BACKFILL — unit tests for the entity-id backfill.
//
// Covers:
//   (1) Identification rule (`isLegacyEntityId`)
//   (2) Idempotency: second pass reclassifies zero rows + emits zero audit events
//
// Author: Atlas (Records & Documents Engineer, engineering — substrate)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { isLegacyEntityId } from "../scripts/backfill-entity-id-g2";

// ---------------------------------------------------------------------------
// (1) Identification rule
// ---------------------------------------------------------------------------

describe("isLegacyEntityId — entity identification rule", () => {
  it("identifies the legacy BANK-ZA-001 entity ID", () => {
    expect(isLegacyEntityId("BANK-ZA-001")).toBe(true);
  });

  it("does not match the canonical LE-ZA-HOZ-BANK entity ID", () => {
    expect(isLegacyEntityId("LE-ZA-HOZ-BANK")).toBe(false);
  });

  it("does not match other entity IDs", () => {
    expect(isLegacyEntityId("BANK-ZA-002")).toBe(false);
    expect(isLegacyEntityId("")).toBe(false);
    expect(isLegacyEntityId("BANK-ZA")).toBe(false);
    expect(isLegacyEntityId("bank-za-001")).toBe(false); // case-sensitive
  });
});

// ---------------------------------------------------------------------------
// (2) Idempotency
// ---------------------------------------------------------------------------

describe("runBackfill — idempotency", () => {
  let tmpDb: string;

  beforeEach(() => {
    tmpDb = `/tmp/test-backfill-entity-id-g2-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
    process.env.BANK_EVENT_DB = tmpDb;
  });

  afterEach(() => {
    process.env.BANK_EVENT_DB = undefined;
    try {
      const { unlinkSync } = require("node:fs");
      unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });

  it("second pass after first pass reclassifies zero rows + emits zero audit events", async () => {
    // Dynamic import so composition.ts picks up BANK_EVENT_DB set in beforeEach.
    const { runBackfill } = await import("../scripts/backfill-entity-id-g2");

    // First pass — run against the (possibly seeded) store.
    const r1 = runBackfill({ runRef: "test-entity-g2-run-1" });

    // Per-run consistency: each row reclassified must emit exactly one audit event.
    expect(r1.reclassified).toBe(r1.auditEventsEmitted);

    // Second pass — must be a complete no-op.
    const r2 = runBackfill({ runRef: "test-entity-g2-run-2" });

    expect(r2.reclassified).toBe(0);
    expect(r2.auditEventsEmitted).toBe(0);
    expect(r2.skippedAlreadyAtTarget).toBe(0);
  });
});
