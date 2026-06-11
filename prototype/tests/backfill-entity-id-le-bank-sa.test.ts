// tests/backfill-entity-id-le-bank-sa.test.ts
//
// D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN — unit tests for
// the LE-BANK-SA → LE-ZA-HOZ-BANK entity-id backfill. Mirrors
// `tests/backfill-entity-id-g2.test.ts` (D-G2-ENTITY-ID-BACKFILL precedent).
//
// Covers:
//   (1) Identification rule (`isLegacyEntityId`)
//   (2) Idempotency: second pass reclassifies zero rows + emits zero audit events
//   (3) End-to-end: a seeded legacy-entity row is reclassified to the
//       canonical id with exactly one `EntityReclassified` audit event
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { isLegacyEntityId } from "../scripts/backfill-entity-id-le-bank-sa";

// ---------------------------------------------------------------------------
// (1) Identification rule
// ---------------------------------------------------------------------------

describe("isLegacyEntityId — LE-BANK-SA identification rule", () => {
  it("identifies the legacy LE-BANK-SA entity ID", () => {
    expect(isLegacyEntityId("LE-BANK-SA")).toBe(true);
  });

  it("does not match the canonical LE-ZA-HOZ-BANK entity ID", () => {
    expect(isLegacyEntityId("LE-ZA-HOZ-BANK")).toBe(false);
  });

  it("does not match the other legacy ID (BANK-ZA-001 — separate backfill)", () => {
    expect(isLegacyEntityId("BANK-ZA-001")).toBe(false);
  });

  it("does not match other entity IDs", () => {
    expect(isLegacyEntityId("LE-BANK-SA-2")).toBe(false);
    expect(isLegacyEntityId("")).toBe(false);
    expect(isLegacyEntityId("LE-BANK")).toBe(false);
    expect(isLegacyEntityId("le-bank-sa")).toBe(false); // case-sensitive
  });
});

// ---------------------------------------------------------------------------
// (2) + (3) — idempotency and end-to-end reclassification
// ---------------------------------------------------------------------------

describe("runBackfill — LE-BANK-SA", () => {
  let tmpDb: string;

  beforeEach(() => {
    tmpDb = `/tmp/test-backfill-entity-id-le-bank-sa-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
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
    const { runBackfill } = await import("../scripts/backfill-entity-id-le-bank-sa");

    // First pass — run against the (possibly seeded) store.
    const r1 = runBackfill({ runRef: "test-entity-le-bank-sa-run-1" });

    // Per-run consistency: each row reclassified must emit exactly one audit event.
    expect(r1.reclassified).toBe(r1.auditEventsEmitted);

    // Second pass — must be a complete no-op.
    const r2 = runBackfill({ runRef: "test-entity-le-bank-sa-run-2" });

    expect(r2.reclassified).toBe(0);
    expect(r2.auditEventsEmitted).toBe(0);
    expect(r2.skippedAlreadyAtTarget).toBe(0);
  });

  it("reclassifies a seeded legacy-entity row and emits one audit event citing the decision", async () => {
    const { runBackfill, CANONICAL_ENTITY_ID, LEGACY_ENTITY_ID } = await import(
      "../scripts/backfill-entity-id-le-bank-sa"
    );
    const { eventStore } = await import("../platform/composition");
    const { newEventId } = await import("../platform/core/types");
    const { makeEntityReclassified } = await import(
      "../platform/event-store/event-types/entity-reclassified"
    );
    const { productionTag } = await import("../platform/event-store/provenance");

    // Drain any pre-existing legacy rows so the assertions below are exact.
    runBackfill({ runRef: "test-entity-le-bank-sa-drain" });

    // Seed one synthetic event carrying the legacy entity id. Any registered
    // event type works — the backfill keys on the envelope `entity` axis only;
    // `EntityReclassified` is used because its factory is already imported here.
    const targetEventId = newEventId();
    const seed = makeEntityReclassified({
      eventId: targetEventId,
      asOf: new Date().toISOString(),
      entity: LEGACY_ENTITY_ID,
      actor: { type: "system", id: "bea@bank" },
      citations: ["test:seed"],
      payload: {
        targetEventId: "synthetic-prior-event",
        targetEventType: "TestSeed",
        priorEntity: "X",
        newEntity: "Y",
        decisionRef: "test:seed",
        reclassificationReason: "synthetic seed row for backfill test",
        runRef: "test-seed",
      },
    });
    eventStore.append({ ...seed, provenance: productionTag({ sourceLineage: "test-seed" }) });

    const r = runBackfill({ runRef: "test-entity-le-bank-sa-run-seeded" });

    expect(r.candidates).toBe(1);
    expect(r.reclassified).toBe(1);
    expect(r.auditEventsEmitted).toBe(1);
    expect(r.byEventType.EntityReclassified).toBe(1);

    // The target row now carries the canonical entity id…
    let targetEntity: string | undefined;
    let audit: { citations: readonly string[]; payload: Record<string, unknown> } | undefined;
    for (const e of eventStore.replay({ type: "EntityReclassified" })) {
      if (e.event_id === targetEventId) targetEntity = e.entity;
      const p = e.payload as Record<string, unknown>;
      if (p.runRef === "test-entity-le-bank-sa-run-seeded" && p.targetEventId === targetEventId) {
        audit = { citations: e.citations, payload: p };
      }
    }
    expect(targetEntity).toBe(CANONICAL_ENTITY_ID);

    // …and the audit event records the before/after axes + authorising decision.
    expect(audit).toBeDefined();
    expect(audit?.payload.priorEntity).toBe(LEGACY_ENTITY_ID);
    expect(audit?.payload.newEntity).toBe(CANONICAL_ENTITY_ID);
    expect(audit?.payload.decisionRef).toBe(
      "D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN",
    );
    expect(audit?.citations).toContain("D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN");
  });
});
