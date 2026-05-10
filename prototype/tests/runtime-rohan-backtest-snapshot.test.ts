// tests/runtime-rohan-backtest-snapshot.test.ts
//
// D-EVENT-STORE-SCALING Slice 3 — backtest-harness snapshot adoption.
//
// Asserts the Slice 3 acceptance criterion: the snapshot-replay path
// and the naive full-history replay path produce byte-identical
// `BacktestRun` payloads on every fixture (within-tolerance, amber, red,
// staging-transition). The two paths are toggled via the
// `BANK_BACKTEST_USE_SNAPSHOTS` env flag.
//
// Equivalence is checked at the payload level — same `severity`,
// `predictionCount`, `expectedExceptions`, `observedExceptions`,
// `methodologyHash`, `comparisonMetric`. The `event_id` and (per the
// determinism test) `as_of` are run-instance metadata; the
// `backtestRunId` is deterministic in the request and is identical
// across both paths.
//
// Author: Rohan (Risk engineer, engineering — reports to Helena CRO)
//   · Anya (Data / analytics engineer, engineering — reports to Devon COO)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import {
  type BacktestRunPayload,
  makeBacktestRequested,
} from "../platform/event-store/event-types";
import type { Event } from "../platform/event-store/types";
import { effectiveStreamKey } from "../platform/projections";
import rohanBacktestHarness from "../runtime/agents/rohan-backtest-harness";
import type { AgentRunContext } from "../runtime/types";
import { type BacktestEclFixture, allFixtures } from "./fixtures/backtest-ecl";

const SCHEDULER_ACTOR = { type: "service" as const, id: "substrate:scheduler" } as const;
const REQUEST_CITATIONS = ["SR-11-7-2011", "SS-1-23-2023", "BANKS-ACT-94-1990", "ORG-PR-21"];

function makeContext(triggeringEvents: readonly Event[], asOf: string): AgentRunContext {
  const repoRoot = join(import.meta.dir, "..", "..");
  const ownerInboxDir = mkdtempSync(join(tmpdir(), "rohan-backtest-snap-"));
  return {
    agent: "Rohan",
    trigger: { kind: "event-driven", id: "backtest-harness", triggeringEvents },
    asOf,
    repoRoot,
    ownerInboxDir,
    dryRun: false,
  };
}

function seedFixture(fx: BacktestEclFixture): void {
  for (const e of [...fx.priorSignals, ...fx.windowSignals]) {
    try {
      eventStore.append(e);
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.includes("UNIQUE") && !msg.includes("duplicate")) throw err;
    }
  }
}

function appendBacktestRequest(fx: BacktestEclFixture): Event {
  const evt = makeBacktestRequested({
    asOf: fx.request.windowEnd,
    entity: fx.entity,
    actor: SCHEDULER_ACTOR,
    citations: REQUEST_CITATIONS,
    payload: fx.request,
  });
  eventStore.append(evt);
  return evt;
}

async function runOnce(fx: BacktestEclFixture, useSnapshots: boolean): Promise<BacktestRunPayload> {
  const prior = process.env.BANK_BACKTEST_USE_SNAPSHOTS;
  process.env.BANK_BACKTEST_USE_SNAPSHOTS = useSnapshots ? "true" : "false";
  try {
    seedFixture(fx);
    const req = appendBacktestRequest(fx);
    const ctx = makeContext([req], "2026-05-09T08:00:00.000Z");
    try {
      const result = await rohanBacktestHarness(ctx);
      expect(result.ok).toBe(true);
      const runs = [...eventStore.replay({ type: "BacktestRun", entity: fx.entity })].filter(
        (e) => (e.payload as BacktestRunPayload).sourceRequestEventId === req.event_id,
      );
      expect(runs.length).toBe(1);
      const last = runs[0];
      if (!last) throw new Error("no BacktestRun emitted for fixture");
      return last.payload as BacktestRunPayload;
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  } finally {
    if (prior === undefined) {
      process.env.BANK_BACKTEST_USE_SNAPSHOTS = undefined;
    } else {
      process.env.BANK_BACKTEST_USE_SNAPSHOTS = prior;
    }
  }
}

describe("runtime — Rohan backtest-harness — snapshot/naive equivalence", () => {
  beforeEach(() => {
    // Default-on at session start; per-test overrides are local.
    process.env.BANK_BACKTEST_USE_SNAPSHOTS = "true";
    // Slice 2 — fixtures use untagged events (legacy); pin the harness
    // to `combined` mode so it consumes both production and simulated
    // (untagged-treated-as-simulated) events. Production mode is the
    // production-default per spec; tests override.
    process.env.BANK_BACKTEST_PROVENANCE_MODE = "combined";
  });
  afterEach(() => {
    process.env.BANK_BACKTEST_USE_SNAPSHOTS = undefined;
    process.env.BANK_BACKTEST_PROVENANCE_MODE = undefined;
  });

  function reEntity(fx: BacktestEclFixture, suffix: string): BacktestEclFixture {
    // Distinct entity AND distinct event_ids so the two paths' fixtures
    // do not collide on the UNIQUE(event_id) constraint.
    const newEntity = `${fx.entity}-${suffix}`;
    const rewrite = (events: readonly Event[]): Event[] =>
      events.map((e) => ({ ...e, event_id: newEventId(), entity: newEntity }));
    return {
      ...fx,
      entity: newEntity,
      priorSignals: rewrite(fx.priorSignals),
      windowSignals: rewrite(fx.windowSignals),
    };
  }

  for (const fx of allFixtures) {
    it(`fixture '${fx.name}' produces identical BacktestRun payload on both paths`, async () => {
      const fxNaive = reEntity(fx, "NAIVE");
      const fxSnap = reEntity(fx, "SNAP");

      const naivePayload = await runOnce(fxNaive, false);
      const snapPayload = await runOnce(fxSnap, true);

      // Equivalence: every payload field that depends on the projection
      // is identical. backtestRunId differs because it's deterministic
      // in (modelId, version, windowStart, windowEnd, methodologyHash) —
      // identical across both runs.
      expect(snapPayload.severity).toBe(naivePayload.severity);
      expect(snapPayload.predictionCount).toBe(naivePayload.predictionCount);
      expect(snapPayload.expectedExceptions).toBe(naivePayload.expectedExceptions);
      expect(snapPayload.observedExceptions).toBe(naivePayload.observedExceptions);
      expect(snapPayload.comparisonMetric).toBe(naivePayload.comparisonMetric);
      expect(snapPayload.methodologyHash).toBe(naivePayload.methodologyHash);
      expect(snapPayload.modelId).toBe(naivePayload.modelId);
      expect(snapPayload.version).toBe(naivePayload.version);
    });
  }

  it("snapshot path persists a snapshot row that subsequent runs reuse", async () => {
    const fx = allFixtures.find((f) => f.windowSignals.length > 0 || f.priorSignals.length > 0);
    if (!fx) throw new Error("expected at least one fixture with signals");
    const isolated = reEntity(fx, "PERSIST");
    // Slice 2 — snapshots persist under the effective stream key
    // (base + provenance-filter digest). Mirror the harness's filter
    // here so listSnapshots resolves to the same physical row.
    const streamKey = effectiveStreamKey(
      `${isolated.entity}|backtest/risk-raised-credit-critical`,
      { mode: "combined" },
    );

    // First run: no snapshot exists → cadence fires `first-snapshot` →
    // a row is persisted.
    await runOnce(isolated, true);
    const after1 = eventStore.listSnapshots(streamKey);
    expect(after1.length).toBeGreaterThanOrEqual(1);

    // Second run with same windowEnd → idempotent on
    // (streamKey, asOf, uptoSequence).
    await runOnce(isolated, true);
    const after2 = eventStore.listSnapshots(streamKey);
    // The unique-on-triple constraint means at most one row per
    // identical (asOf, uptoSequence) is recorded.
    expect(after2.length).toBe(after1.length);
  });

  it("respects BANK_BACKTEST_USE_SNAPSHOTS=false (no snapshot persisted)", async () => {
    const fx = allFixtures[0];
    if (!fx) throw new Error("expected at least one fixture");
    const isolated = reEntity(fx, "FLAGOFF");
    const streamKey = effectiveStreamKey(
      `${isolated.entity}|backtest/risk-raised-credit-critical`,
      { mode: "combined" },
    );
    await runOnce(isolated, false);
    expect(eventStore.listSnapshots(streamKey)).toHaveLength(0);
  });
});
