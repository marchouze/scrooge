// tests/npa-fx-bestex-schedule-gap-closure.test.ts
//
// Closing the fx-best-execution-policy-schedule deferred gap on the
// prd:bank:fx:otc-vanilla conduct dimension:
//
//   1. publishFxBestExecutionPolicySchedule — CCO schedule publish (idempotent).
//   2. runFxConductScheduleGapClosure — re-emits the conduct attestation with
//      the schedule gap REMOVED and the other gaps carried forward UNCHANGED.
//      GATED on the schedule being in force (over-closure is the failure mode).
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH.
// Author: Zara (Chief Compliance Officer, governance).

import { describe, expect, it } from "bun:test";

import {
  BESTEX_SCHEDULE_2026_001,
  publishFxBestExecutionPolicySchedule,
} from "../platform/conduct/fx-bestex-policy-schedule";
import { resolveBestExecutionSchedule } from "../platform/conduct/fx-trade-conduct-evaluation";
import { EventStore } from "../platform/event-store/store";
import {
  CONDUCT_DEFERRED_GAPS,
  CONDUCT_PRODUCT_ID,
  CONDUCT_SCHEDULE_GAP_CLOSED_AS_OF,
  SCHEDULE_GAP_ID,
  runFxConductAttestation,
  runFxConductScheduleGapClosure,
} from "../platform/markets/products/npa-fx-conduct-attestation";

const PUBLISH_AS_OF = "2026-06-12T06:00:00.000Z";

function latestConductGapIds(store: EventStore): string[] {
  let latest: { asOf: string; gaps: string[] } | null = null;
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as {
      productId?: string;
      dimension?: string;
      deferredGaps?: Array<{ gapId?: string }>;
    };
    if (p.productId !== CONDUCT_PRODUCT_ID || p.dimension !== "conduct") continue;
    if (latest === null || ev.as_of >= latest.asOf) {
      latest = {
        asOf: ev.as_of,
        gaps: (p.deferredGaps ?? []).map((g) => g.gapId ?? ""),
      };
    }
  }
  return latest?.gaps ?? [];
}

describe("publishFxBestExecutionPolicySchedule", () => {
  it("publishes the founding schedule and is idempotent on scheduleId", () => {
    const store = new EventStore(":memory:");

    const first = publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });
    expect(first.published).toBe(true);
    expect(first.skipped).toBe(false);

    const second = publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });
    expect(second.published).toBe(false);
    expect(second.skipped).toBe(true);
    expect(second.scheduleEventId).toBe(first.scheduleEventId);

    expect([...store.replay({ type: "BestExecutionPolicySchedule" })]).toHaveLength(1);
  });

  it("the published schedule resolves on the surveillance read-path with the CCO tolerance values", () => {
    const store = new EventStore(":memory:");
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });

    const resolved = resolveBestExecutionSchedule(store, CONDUCT_SCHEDULE_GAP_CLOSED_AS_OF);
    expect(resolved).not.toBeNull();
    expect(resolved?.scheduleId).toBe(BESTEX_SCHEDULE_2026_001.scheduleId);
    expect(resolved?.referenceRateBasis).toBe("executed-rate");
    expect(resolved?.toleranceBpsByClass.get("FX-spot")).toBe(10);
    expect(resolved?.toleranceBpsByClass.get("FX-forward")).toBe(15);
    expect(resolved?.toleranceBpsByClass.get("FX-swap")).toBe(20);
    expect(resolved?.toleranceBpsByClass.get("NDF")).toBe(25);
    expect(resolved?.defaultToleranceBps).toBe(20);
  });
});

describe("runFxConductScheduleGapClosure", () => {
  it("GATES on the schedule: no BestExecutionPolicySchedule in force → no re-attestation", () => {
    const store = new EventStore(":memory:");
    runFxConductAttestation(store); // latest attestation carries all 3 gaps

    const result = runFxConductScheduleGapClosure(store);
    expect(result.closed).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.reason).toContain("GATE failed");
    // Latest attestation unchanged — the gap is still tracked.
    expect(latestConductGapIds(store)).toContain(SCHEDULE_GAP_ID);
  });

  it("removes ONLY the schedule gap and carries the other two forward unchanged", () => {
    const store = new EventStore(":memory:");
    runFxConductAttestation(store);
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });

    const result = runFxConductScheduleGapClosure(store);
    expect(result.closed).toBe(true);
    expect(result.remainingGapIds).toEqual([
      "fx-best-execution-reference-benchmark",
      "fx-edd-str-substrate",
    ]);

    const latest = latestConductGapIds(store);
    expect(latest).not.toContain(SCHEDULE_GAP_ID);
    expect(latest).toEqual(["fx-best-execution-reference-benchmark", "fx-edd-str-substrate"]);

    // The carried-forward gaps are byte-identical to the prior attestation's.
    for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
      const p = ev.payload as {
        productId?: string;
        dimension?: string;
        deferredGaps?: Array<Record<string, unknown>>;
      };
      if (p.productId !== CONDUCT_PRODUCT_ID || p.dimension !== "conduct") continue;
      if (ev.as_of !== CONDUCT_SCHEDULE_GAP_CLOSED_AS_OF) continue;
      const expected = CONDUCT_DEFERRED_GAPS.filter((g) => g.gapId !== SCHEDULE_GAP_ID).map(
        (g) => ({ ...g, citations: [...g.citations] }),
      );
      expect(p.deferredGaps).toEqual(expected);
    }
  });

  it("is idempotent — a second closure run skips", () => {
    const store = new EventStore(":memory:");
    runFxConductAttestation(store);
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });

    runFxConductScheduleGapClosure(store);
    const second = runFxConductScheduleGapClosure(store);
    expect(second.closed).toBe(false);
    expect(second.skipped).toBe(true);

    // Exactly one closure attestation at the closure as_of.
    let closureCount = 0;
    for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
      if (ev.as_of === CONDUCT_SCHEDULE_GAP_CLOSED_AS_OF) closureCount += 1;
    }
    expect(closureCount).toBe(1);
  });

  it("skips (does not gate-fail) when no conduct attestation exists yet", () => {
    const store = new EventStore(":memory:");
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });

    const result = runFxConductScheduleGapClosure(store);
    expect(result.closed).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("no conduct ProductDimensionAttested");
  });
});
