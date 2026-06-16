// tests/v2-store-tee.test.ts
//
// Generic V1→v2 store-tee — mechanism tests (Wave 2 infra, D-BANK-WIDE-V2-MIGRATION).
//
// Covers:
//   - A tee-enabled type (PostureRegistered) is mirrored on append, byte-equal
//     payload, with the V1 event_id reused (idempotency key) and lineage tags.
//   - A NON-tee-enabled type passes through untouched (no v2 row).
//   - Idempotency: re-appending the same event_id mirrors once (INSERT OR IGNORE).
//   - appendAll mirrors each tee-enabled event in the batch.
//   - Failure handling: a mirror failure does NOT propagate to the V1 caller
//     (the V1 write stands) AND is surfaced as a SubstrateAlert{integrity,high}
//     in the V1 store — never swallowed.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import { V1_SOURCE_TAG_PREFIX, teeEventStore } from "../platform/event-store/v2-store-tee";
import { type ControlPlaneStore, openControlPlaneStore } from "../v2-core/control-plane/store";

// A valid PostureRegistered V1 event (tee-enabled, verbatim codec).
function postureEvent(id: string): Event {
  return {
    event_id: id,
    type: "PostureRegistered",
    as_of: "2026-06-16T00:00:00.000Z",
    entity: "LE-BANK-SA",
    actor: { type: "service", id: "agent:atlas:test" },
    citations: ["D-BANK-WIDE-V2-MIGRATION"],
    payload: {
      postureId: `posture:risk-appetite:${id}`,
      postureClass: "risk-appetite",
      description: "test posture",
      appliesToScope: { kind: "always" },
      appliesToTier: "K",
      proposedBy: "agent:atlas:test",
      citations: ["D-BANK-WIDE-V2-MIGRATION"],
    },
    provenance: {
      kind: "simulated",
      sourceLineage: "test",
      scenario: "v2-store-tee-test",
      tags: [],
    },
  };
}

// A non-tee-enabled type (TenantRegistered IS registered but has NO tee block).
// We use a clearly-untouched type: a bare config event with no v2 registry tee.
function nonTeeEvent(id: string): Event {
  return {
    event_id: id,
    type: "ManualJournalEntryPosted", // a v1 type, not tee-enabled
    as_of: "2026-06-16T00:00:00.000Z",
    entity: "LE-BANK-SA",
    actor: { type: "service", id: "agent:atlas:test" },
    citations: ["D-BANK-WIDE-V2-MIGRATION"],
    payload: { note: "not mirrored" },
    provenance: {
      kind: "simulated",
      sourceLineage: "test",
      scenario: "v2-store-tee-test",
      tags: [],
    },
  };
}

function countV2(store: ControlPlaneStore, type: string): number {
  let n = 0;
  for (const _ of store.replay({ type })) n += 1;
  return n;
}

describe("v2 store-tee — mirroring", () => {
  it("mirrors a tee-enabled type on append, reusing the V1 event_id with lineage tags", () => {
    const v1 = new EventStore(":memory:");
    const cp = openControlPlaneStore(":memory:");
    const teed = teeEventStore(v1, { controlPlaneStore: cp });

    const ev = postureEvent("tee-1");
    teed.append(ev);

    // V1 write happened.
    const v1Rows = [...v1.replay({ type: "PostureRegistered" })];
    expect(v1Rows).toHaveLength(1);

    // v2 mirror happened, same event_id + same payload.
    const v2Rows = [...cp.replay({ type: "PostureRegistered" })];
    expect(v2Rows).toHaveLength(1);
    expect(v2Rows[0]?.event_id).toBe("tee-1");
    expect(v2Rows[0]?.payload).toEqual(ev.payload);
    // Lineage tag carries the V1 source id.
    const tags = (v2Rows[0]?.provenance?.tags as string[] | undefined) ?? [];
    expect(tags).toContain(`${V1_SOURCE_TAG_PREFIX}tee-1`);
    expect(v2Rows[0]?.schemaVersion).toBe(1);

    cp.close();
  });

  it("does NOT mirror a non-tee-enabled type", () => {
    const v1 = new EventStore(":memory:");
    const cp = openControlPlaneStore(":memory:");
    const teed = teeEventStore(v1, { controlPlaneStore: cp });

    teed.append(nonTeeEvent("nontee-1"));

    expect([...v1.replay({ type: "ManualJournalEntryPosted" })]).toHaveLength(1);
    expect(countV2(cp, "ManualJournalEntryPosted")).toBe(0);

    cp.close();
  });

  it("is idempotent on the V1 event_id (re-append mirrors once)", () => {
    const v1 = new EventStore(":memory:");
    const cp = openControlPlaneStore(":memory:");
    const teed = teeEventStore(v1, { controlPlaneStore: cp });

    const ev = postureEvent("tee-dup");
    teed.append(ev);
    // Re-mirror the same id directly (V1 would reject a dup, but the mirror path
    // must be a storage no-op regardless): append a second tee with the same id.
    const teed2 = teeEventStore(new EventStore(":memory:"), { controlPlaneStore: cp });
    teed2.append(ev);

    expect(countV2(cp, "PostureRegistered")).toBe(1);

    cp.close();
  });

  it("mirrors each tee-enabled event in an appendAll batch", () => {
    const v1 = new EventStore(":memory:");
    const cp = openControlPlaneStore(":memory:");
    const teed = teeEventStore(v1, { controlPlaneStore: cp });

    teed.appendAll([postureEvent("b1"), nonTeeEvent("b2"), postureEvent("b3")]);

    expect(countV2(cp, "PostureRegistered")).toBe(2);
    expect(countV2(cp, "ManualJournalEntryPosted")).toBe(0);

    cp.close();
  });

  it("surfaces a mirror failure as a SubstrateAlert without wedging the V1 write", () => {
    const v1 = new EventStore(":memory:");
    // A control-plane store stub whose append always throws — simulates a v2
    // store outage. The tee must NOT propagate this to the V1 caller.
    const failingCp: ControlPlaneStore = {
      append: () => {
        throw new Error("simulated v2 store outage");
      },
      replay: function* () {},
      count: () => 0,
      close: () => {},
    };
    const teed = teeEventStore(v1, { controlPlaneStore: failingCp });

    // The V1 append must succeed despite the mirror failure.
    expect(() => teed.append(postureEvent("fail-1"))).not.toThrow();
    expect([...v1.replay({ type: "PostureRegistered" })]).toHaveLength(1);

    // The failure is surfaced as a SubstrateAlert (integrity, high) in V1.
    const alerts = [...v1.replay({ type: "SubstrateAlert" })];
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const alert = alerts.find(
      (a) => (a.payload as { alertClass?: string }).alertClass === "integrity",
    );
    expect(alert).toBeDefined();
    expect((alert?.payload as { severity?: string }).severity).toBe("high");
  });
});
