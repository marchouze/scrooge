// tests/npa-fx-bestex-ftp-benchmark-gap-closure.test.ts
//
// Tests for closing the fx-best-execution-reference-benchmark deferred gap on
// prd:bank:fx:otc-vanilla conduct dimension and promoting to implementation-
// attested with the FTP mid-rate as independent benchmark reference.
//
// Sequence under test:
//   1. publishFxBestExecutionPolicySchedule — v1 schedule (idempotent).
//   2. publishFxBestExScheduleV2 — v2 schedule (FTP mid-rate as reference).
//   3. Seed a FtpCurvePublished event (Ravi's treasury system).
//   4. runFxConductBenchmarkGapClosure — removes fx-best-execution-reference-
//      benchmark, adds fx-best-ex-ftp-live-feed, carries fx-edd-str-substrate.
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//   D-NPA-GATE-POLICY-REDESIGN.
// Author: Zara (Chief Compliance Officer, governance).

import { describe, expect, it } from "bun:test";

import {
  publishFxBestExScheduleV2,
  publishFxBestExecutionPolicySchedule,
} from "../platform/conduct/fx-bestex-policy-schedule";
import {
  resolveBestExecutionSchedule,
  resolveFtpMidRate,
} from "../platform/conduct/fx-trade-conduct-evaluation";
import { makeFtpCurvePublished } from "../platform/event-store/event-types/ftp";
import { EventStore } from "../platform/event-store/store";
import {
  BENCHMARK_GAP_ID,
  CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF,
  CONDUCT_PRODUCT_ID,
  FTP_LIVE_FEED_GAP_ID,
  runFxConductAttestation,
  runFxConductBenchmarkGapClosure,
  runFxConductScheduleGapClosure,
} from "../platform/markets/products/npa-fx-conduct-attestation";

const PUBLISH_AS_OF = "2026-06-12T06:00:00.000Z";
const FTP_AS_OF = "2026-06-14T08:00:00.000Z";

function makeFtpEvent(store: EventStore): void {
  store.append(
    makeFtpCurvePublished({
      asOf: FTP_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:ravi:ftp-curve-publish" },
      citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
      payload: {
        curveId: "FTP-ZAR-2026-06-14",
        currency: "ZAR",
        effectiveDate: "2026-06-14",
        tenors: [
          { tenor: "ON", rate: 0.081, basis: "ZARONIA" },
          { tenor: "1W", rate: 0.0815, basis: "ZARONIA" },
          { tenor: "1M", rate: 0.082, basis: "JIBAR" },
          { tenor: "3M", rate: 0.0858, basis: "JIBAR" },
        ],
        methodology: "matched-maturity",
        publishedBy: "ravi",
        publishedAt: FTP_AS_OF,
      },
    }),
  );
}

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

describe("publishFxBestExScheduleV2", () => {
  it("publishes BESTEX-SCHED-2026-002 with referenceRateBasis=independent-benchmark", () => {
    const store = new EventStore(":memory:");
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });
    const v2 = publishFxBestExScheduleV2(store, { asOf: PUBLISH_AS_OF });

    expect(v2.published).toBe(true);
    expect(v2.skipped).toBe(false);
    expect(v2.scheduleEventId).toBeTruthy();
    expect(v2.supersededEventId).toBeTruthy(); // v1 event_id

    // v2 must be the in-force schedule at the closure timestamp.
    const inForce = resolveBestExecutionSchedule(store, CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF);
    expect(inForce?.scheduleId).toBe("BESTEX-SCHED-2026-002");
    expect(inForce?.referenceRateBasis).toBe("independent-benchmark");
    expect(inForce?.defaultToleranceBps).toBe(20);
    // Spot tolerance unchanged from v1.
    expect(inForce?.toleranceBpsByClass.get("FX-spot")).toBe(10);
  });

  it("is idempotent — second publish skips", () => {
    const store = new EventStore(":memory:");
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });
    publishFxBestExScheduleV2(store, { asOf: PUBLISH_AS_OF });

    const second = publishFxBestExScheduleV2(store, { asOf: PUBLISH_AS_OF });
    expect(second.published).toBe(false);
    expect(second.skipped).toBe(true);
  });
});

describe("resolveFtpMidRate", () => {
  it("returns null when no FtpCurvePublished on store", () => {
    const store = new EventStore(":memory:");
    expect(resolveFtpMidRate(store, CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF)).toBeNull();
  });

  it("resolves the ON rate from a FtpCurvePublished event", () => {
    const store = new EventStore(":memory:");
    makeFtpEvent(store);

    const result = resolveFtpMidRate(store, CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF);
    expect(result).not.toBeNull();
    expect(result?.curveId).toBe("FTP-ZAR-2026-06-14");
    expect(result?.onRate).toBe(0.081);
    expect(result?.currency).toBe("ZAR");
  });

  it("returns null for events after asOf", () => {
    const store = new EventStore(":memory:");
    makeFtpEvent(store); // as_of = 2026-06-14

    // Requesting a date before the curve was published.
    const result = resolveFtpMidRate(store, "2026-06-13T00:00:00.000Z");
    expect(result).toBeNull();
  });
});

describe("runFxConductBenchmarkGapClosure", () => {
  it("GATE (a): fails when no v2 schedule (independent-benchmark) in force", () => {
    const store = new EventStore(":memory:");
    runFxConductAttestation(store);
    runFxConductScheduleGapClosure(store); // closes schedule gap, leaves benchmark gap
    makeFtpEvent(store);

    // Only v1 schedule (executed-rate) — gate (a) should fail.
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });

    const result = runFxConductBenchmarkGapClosure(store);
    expect(result.closed).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.reason).toContain("GATE (a) failed");
    // Benchmark gap still present.
    expect(latestConductGapIds(store)).toContain(BENCHMARK_GAP_ID);
  });

  it("GATE (b): fails when no FtpCurvePublished on store", () => {
    const store = new EventStore(":memory:");
    runFxConductAttestation(store);
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });
    runFxConductScheduleGapClosure(store);
    publishFxBestExScheduleV2(store, { asOf: PUBLISH_AS_OF });
    // No FTP curve event.

    const result = runFxConductBenchmarkGapClosure(store);
    expect(result.closed).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.reason).toContain("GATE (b) failed");
  });

  it("closes benchmark gap and adds live-feed gap when both gates pass", () => {
    const store = new EventStore(":memory:");
    runFxConductAttestation(store);
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });
    runFxConductScheduleGapClosure(store);
    publishFxBestExScheduleV2(store, { asOf: PUBLISH_AS_OF });
    makeFtpEvent(store);

    const result = runFxConductBenchmarkGapClosure(store);
    expect(result.closed).toBe(true);
    expect(result.skipped).toBe(false);

    const gaps = latestConductGapIds(store);
    // benchmark gap removed.
    expect(gaps).not.toContain(BENCHMARK_GAP_ID);
    // live-feed gap added.
    expect(gaps).toContain(FTP_LIVE_FEED_GAP_ID);
    // edd/str gap carried forward.
    expect(gaps).toContain("fx-edd-str-substrate");
    // total 2 gaps.
    expect(gaps).toHaveLength(2);

    expect(result.remainingGapIds).toContain(FTP_LIVE_FEED_GAP_ID);
    expect(result.remainingGapIds).toContain("fx-edd-str-substrate");
  });

  it("is idempotent — second run skips", () => {
    const store = new EventStore(":memory:");
    runFxConductAttestation(store);
    publishFxBestExecutionPolicySchedule(store, { asOf: PUBLISH_AS_OF });
    runFxConductScheduleGapClosure(store);
    publishFxBestExScheduleV2(store, { asOf: PUBLISH_AS_OF });
    makeFtpEvent(store);

    runFxConductBenchmarkGapClosure(store);
    const second = runFxConductBenchmarkGapClosure(store);
    expect(second.closed).toBe(false);
    expect(second.skipped).toBe(true);

    // Exactly one closure attestation at the closure as_of.
    let closureCount = 0;
    for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
      if (ev.as_of === CONDUCT_BENCHMARK_GAP_CLOSED_AS_OF) closureCount += 1;
    }
    expect(closureCount).toBe(1);
  });

  it("skips when no conduct attestation exists yet", () => {
    const store = new EventStore(":memory:");
    publishFxBestExScheduleV2(store, { asOf: PUBLISH_AS_OF });
    makeFtpEvent(store);

    const result = runFxConductBenchmarkGapClosure(store);
    expect(result.closed).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("no conduct ProductDimensionAttested");
  });
});
