// tests/runtime-rohan-backtest.test.ts
//
// Tests for Rohan's backtest-harness handler — S7-Targeted #4, v0.
//
// Asserts:
//   - Handler ingests `BacktestRequested` events from `triggeringEvents`
//     and emits exactly one `BacktestRun` per request.
//   - Empty triggering set → no events, summary acknowledges no work.
//   - Each fixture (within-tolerance / amber / red / staging-transition)
//     produces the expected severity and the deterministic backtestRunId.
//   - Red severity additionally emits a `RiskRaised` event (Q5 — risk
//     channel; the AuditFinding channel is Vera's pipeline output).
//   - Same input twice → same `backtestRunId`; different `event_id`s
//     (deterministic-id invariant from scoping brief §1).
//   - Citation chain on every `BacktestRun` carries SR-11-7 / SS-1-23 /
//     Banks Act § 70 (2A)(b) (the ORG-PR-21 row that closes the
//     register chain) plus the metric-specific reference.
//   - Non-ECL outcome metric (`kupiec`) → skipped run, severity =
//     within-tolerance, predictionCount = 0 (Tier-1 only per Q1).
//
// Fixture isolation: each fixture uses a unique entity id so the
// composition singleton's event store is partitioned at replay time
// (the harness scopes `eventStore.replay({ entity, ... })`).
//
// Author: Rohan

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import {
  type BacktestRunPayload,
  makeBacktestRequested,
} from "../platform/event-store/event-types";
import type { Event } from "../platform/event-store/types";
import rohanBacktestHarness from "../runtime/agents/rohan-backtest-harness";
import type { AgentRunContext } from "../runtime/types";
import {
  type BacktestEclFixture,
  allFixtures,
  fixtureAmber,
  fixtureRed,
  fixtureStagingTransition,
  fixtureWithinTolerance,
} from "./fixtures/backtest-ecl";

const SCHEDULER_ACTOR = { type: "service" as const, id: "substrate:scheduler" } as const;
const REQUEST_CITATIONS = ["SR-11-7-2011", "SS-1-23-2023", "BANKS-ACT-94-1990", "ORG-PR-21"];

function makeContext(overrides: Partial<AgentRunContext> = {}): AgentRunContext {
  const repoRoot = join(import.meta.dir, "..", "..");
  const ownerInboxDir = mkdtempSync(join(tmpdir(), "rohan-backtest-"));
  return {
    agent: "Rohan",
    trigger: { kind: "event-driven", id: "backtest-harness", triggeringEvents: [] },
    asOf: "2026-05-09T08:00:00.000Z",
    repoRoot,
    ownerInboxDir,
    dryRun: false,
    ...overrides,
  };
}

function seedFixture(fx: BacktestEclFixture): void {
  for (const e of [...fx.priorSignals, ...fx.windowSignals]) {
    try {
      eventStore.append(e);
    } catch (err) {
      // Idempotent across test re-runs — duplicate event_id throws; that's
      // fine, the prior seeding already populated the store.
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

describe("runtime — Rohan backtest-harness handler", () => {
  it("returns ok with no events when triggering set is empty", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await rohanBacktestHarness(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/no BacktestRequested/);
  });

  it("dry-run with a request emits no events but still reports ok", async () => {
    const ctx = makeContext({
      dryRun: true,
      trigger: {
        kind: "event-driven",
        id: "backtest-harness",
        triggeringEvents: [appendBacktestRequest(fixtureWithinTolerance)],
      },
    });
    seedFixture(fixtureWithinTolerance);
    const result = await rohanBacktestHarness(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.deliverable).toBeUndefined();
  });
});

describe("runtime — Rohan backtest-harness — severity bands per fixture", () => {
  for (const fx of allFixtures) {
    it(`fixture '${fx.name}' produces severity ${fx.expectedSeverity}`, async () => {
      seedFixture(fx);
      const requestEvent = appendBacktestRequest(fx);
      const ctx = makeContext({
        dryRun: false,
        trigger: {
          kind: "event-driven",
          id: "backtest-harness",
          triggeringEvents: [requestEvent],
        },
      });

      try {
        const result = await rohanBacktestHarness(ctx);
        expect(result.ok).toBe(true);
        // 1 BacktestRun + (1 RiskRaised iff red).
        const expectedEvents = fx.expectedSeverity === "red" ? 2 : 1;
        expect(result.eventsEmitted).toBe(expectedEvents);
        expect(result.deliverable).toMatch(/_rohan_backtest-harness\.md$/);

        // Find the most recent BacktestRun emitted for this fixture's entity.
        const emitted = [...eventStore.replay({ type: "BacktestRun", entity: fx.entity })];
        expect(emitted.length).toBeGreaterThanOrEqual(1);
        const last = emitted[emitted.length - 1];
        expect(last).toBeDefined();
        const payload = last?.payload as BacktestRunPayload;
        expect(payload.severity).toBe(fx.expectedSeverity);
        expect(payload.modelId).toBe(fx.request.modelId);
        expect(payload.version).toBe(fx.request.version);
        expect(payload.comparisonMetric).toBe(fx.request.outcomeMetric);
        expect(payload.sourceRequestEventId).toBe(requestEvent.event_id);
        expect(payload.methodologyHash).toBe(fx.request.methodologyHash);
        // predictionCount = 10 daily points across [2026-01-01, 2026-01-10].
        expect(payload.predictionCount).toBe(10);
        // Citation chain: SR-11-7-2011, SS-1-23-2023, BANKS-ACT-94-1990,
        // ORG-PR-21 + IFRS-9 + BCBS-CR-2017 (for staging-stability).
        expect(last?.citations).toContain("SR-11-7-2011");
        expect(last?.citations).toContain("SS-1-23-2023");
        expect(last?.citations).toContain("BANKS-ACT-94-1990");
        expect(last?.citations).toContain("ORG-PR-21");
        expect(last?.citations).toContain("IFRS-9");

        if (fx.expectedSeverity === "red") {
          // Red runs emit a `RiskRaised` (Q5). Confirm it's there for this entity.
          const risks = [...eventStore.replay({ type: "RiskRaised", entity: fx.entity })].filter(
            (e) => (e.payload as { raisedBy?: string }).raisedBy === "agent:rohan:backtest-harness",
          );
          expect(risks.length).toBeGreaterThanOrEqual(1);
          const r = risks[risks.length - 1];
          const rPayload = r?.payload as { severity?: string; category?: string };
          expect(rPayload.severity).toBe("critical");
          expect(rPayload.category).toBe("model");
        }
      } finally {
        rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
      }
    });
  }
});

describe("runtime — Rohan backtest-harness — determinism", () => {
  it("re-running same request produces stable backtestRunId modulo event_id", async () => {
    seedFixture(fixtureWithinTolerance);
    // Two distinct request events with identical payload — both should
    // produce the same backtestRunId (deterministic in payload), but
    // distinct event_ids (one per emit).
    const req1 = appendBacktestRequest(fixtureWithinTolerance);
    const req2 = appendBacktestRequest(fixtureWithinTolerance);
    expect(req1.event_id).not.toBe(req2.event_id);

    const ctx = makeContext({
      dryRun: false,
      trigger: {
        kind: "event-driven",
        id: "backtest-harness",
        triggeringEvents: [req1, req2],
      },
    });

    try {
      const result = await rohanBacktestHarness(ctx);
      expect(result.ok).toBe(true);
      // Two BacktestRun emits; deliverable still single.
      expect(result.eventsEmitted).toBeGreaterThanOrEqual(2);

      const runs = [
        ...eventStore.replay({ type: "BacktestRun", entity: fixtureWithinTolerance.entity }),
      ];
      // Take the last two emitted (this run's pair).
      const recent = runs.slice(-2);
      expect(recent).toHaveLength(2);
      const id1 = (recent[0]?.payload as BacktestRunPayload).backtestRunId;
      const id2 = (recent[1]?.payload as BacktestRunPayload).backtestRunId;
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^backtest:/);
      // Distinct event_ids though.
      expect(recent[0]?.event_id).not.toBe(recent[1]?.event_id);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});

describe("runtime — Rohan backtest-harness — non-ECL metrics", () => {
  it("skips Tier-2 VaR (kupiec) with severity within-tolerance and predictionCount 0", async () => {
    const entity = "BANK-FIXTURE-NON-ECL-001";
    const req = makeBacktestRequested({
      asOf: "2026-01-10T00:00:00.000Z",
      entity,
      actor: SCHEDULER_ACTOR,
      citations: REQUEST_CITATIONS,
      payload: {
        modelId: "model:var-historical-99",
        version: "v0.1.0",
        windowStart: "2026-01-01T00:00:00.000Z",
        windowEnd: "2026-01-10T00:00:00.000Z",
        predictionGranularity: "daily",
        outcomeMetric: "kupiec",
        requestedBy: "agent:rohan",
        methodologyHash: "1".repeat(64),
      },
    });
    eventStore.append(req);

    const ctx = makeContext({
      dryRun: false,
      trigger: {
        kind: "event-driven",
        id: "backtest-harness",
        triggeringEvents: [req],
      },
    });

    try {
      const result = await rohanBacktestHarness(ctx);
      expect(result.ok).toBe(true);
      expect(result.summary).toMatch(/non-ECL skipped/);
      const runs = [...eventStore.replay({ type: "BacktestRun", entity })];
      expect(runs.length).toBeGreaterThanOrEqual(1);
      const last = runs[runs.length - 1];
      const payload = last?.payload as BacktestRunPayload;
      expect(payload.severity).toBe("within-tolerance");
      expect(payload.predictionCount).toBe(0);
      // Citation chain still present — KUPIEC-1995 for the kupiec metric.
      expect(last?.citations).toContain("KUPIEC-1995");
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});

// `fixtureAmber`, `fixtureRed`, `fixtureStagingTransition` are imported
// indirectly via `allFixtures`; keep the explicit imports for IDE
// discovery. They are referenced by name only in this file's narration.
void fixtureAmber;
void fixtureRed;
void fixtureStagingTransition;
