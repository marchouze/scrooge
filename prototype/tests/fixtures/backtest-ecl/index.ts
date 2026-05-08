// tests/fixtures/backtest-ecl/index.ts
//
// Synthetic ECL backtest fixtures. Closes substrate gap §8.3 from
// `Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md` —
// "no historical-replay test fixture" against which a backtest run can
// be regression-tested.
//
// Each fixture exposes:
//   - `entity` — a unique legal-entity id so the fixture's events are
//     isolated from the rest of the in-process event store. The backtest
//     harness scopes its replay by entity (Principle 5 — every event is
//     entity-scoped); fixtures relying on the same entity would collide.
//   - `request` — the `BacktestRequested` payload to drive the harness.
//     `windowStart` / `windowEnd` are sized so the prediction-point set
//     is small (≤ 13 daily points) — enough to exercise the per-prediction-
//     point as-of replay (Q4) without unbounded test time.
//   - `priorSignals` — `RiskRaised` events to seed before `windowStart`.
//     These appear in the predictor's information set at every prediction
//     point and are NOT counted as exceptions (per the proxy in
//     rohan-backtest-harness.ts §runEclBacktest). Used to assert that the
//     harness correctly excludes prior-known signals from the exception
//     count — i.e. the staging-transition test.
//   - `windowSignals` — `RiskRaised` events to seed inside the prediction
//     window. These are the exceptions the harness counts; their count
//     drives the severity classification (within-tolerance / amber / red).
//
// The fixtures intentionally use a small daily window (10 prediction
// points) so expectedExceptions = 10 × 0.05 = 0.5, and the placeholder
// severity bands map cleanly to observed-exception counts:
//
//   ratio = observed / expected (where expected = 0.5)
//   - within-tolerance: 0 observed (special-case for "no exceptions")
//   - amber:            1 observed → ratio = 2.0 (1.5 < r ≤ 3.0)
//   - red:              ≥ 2 observed → ratio ≥ 4.0 (> 3.0)
//
// Methodology v0.1 will publish the canonical bands; the fixture's
// fixture-arithmetic above will need updating when those bands bind.
//
// Author: Rohan (fixture) · co-authored with Nadia (severity-band placeholder).

import { makeRiskRaised } from "../../../platform/event-store/event-types";
import type { Event } from "../../../platform/event-store/types";

const ROHAN_ACTOR = { type: "service" as const, id: "agent:rohan:backtest-harness" };

const FIXTURE_CITATIONS = ["IFRS-9", "BCBS-CR-2017", "ORG-PR-21"];

export interface BacktestEclFixture {
  readonly name: string;
  readonly entity: string;
  readonly request: {
    readonly modelId: string;
    readonly version: string;
    readonly windowStart: string;
    readonly windowEnd: string;
    readonly predictionGranularity: "daily" | "monthly" | "per-event";
    readonly outcomeMetric:
      | "kupiec"
      | "christoffersen"
      | "traffic-light"
      | "staging-stability"
      | "migration-matrix"
      | "coverage-test"
      | "custom";
    readonly requestedBy: string;
    readonly methodologyHash: string;
  };
  readonly priorSignals: readonly Event[];
  readonly windowSignals: readonly Event[];
  readonly expectedSeverity: "within-tolerance" | "amber" | "red";
}

/**
 * 64-char lowercase hex placeholder for the methodology hash.
 * Methodology v0.1 publishes the canonical content; fixtures use a stable
 * placeholder so the deterministic-runId assertion is reproducible.
 */
const FIXTURE_METHODOLOGY_HASH = "0".repeat(64);

const WINDOW_START = "2026-01-01T00:00:00.000Z";
const WINDOW_END = "2026-01-10T00:00:00.000Z"; // 10 daily prediction points (inclusive)
const PRIOR_TS = "2025-12-15T00:00:00.000Z"; // before windowStart

function creditSignal(args: {
  riskId: string;
  asOf: string;
  entity: string;
  description: string;
}): Event {
  return makeRiskRaised({
    asOf: args.asOf,
    entity: args.entity,
    actor: ROHAN_ACTOR,
    citations: FIXTURE_CITATIONS,
    payload: {
      riskId: args.riskId,
      raisedBy: "agent:rohan:backtest-harness:fixture",
      description: args.description,
      category: "credit",
      severity: "critical",
      likelihood: "almost-certain",
      mitigation: "none",
    },
  });
}

function baseRequest(entity: string): BacktestEclFixture["request"] {
  return {
    modelId: `model:ecl-${entity.toLowerCase()}`,
    version: "v0.1.0",
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    predictionGranularity: "daily",
    outcomeMetric: "staging-stability",
    requestedBy: "agent:rohan",
    methodologyHash: FIXTURE_METHODOLOGY_HASH,
  };
}

// ---------------------------------------------------------------------------
// Fixture A — within-tolerance.
//
// Zero exceptions in the window; one prior staging-2 signal exists so the
// harness must correctly EXCLUDE it from the exception count (the staging-
// transition test). Expected severity: within-tolerance (0/0.5 ≤ 1.5).
// ---------------------------------------------------------------------------
const ENTITY_OK = "BANK-FIXTURE-OK-001";
export const fixtureWithinTolerance: BacktestEclFixture = {
  name: "within-tolerance",
  entity: ENTITY_OK,
  request: baseRequest(ENTITY_OK),
  priorSignals: [
    creditSignal({
      riskId: "risk:fixture-ok:prior-stage-2",
      asOf: PRIOR_TS,
      entity: ENTITY_OK,
      description:
        "Pre-window credit-critical signal — already in predictor set; not an exception.",
    }),
  ],
  windowSignals: [],
  expectedSeverity: "within-tolerance",
};

// ---------------------------------------------------------------------------
// Fixture B — amber.
//
// One exception inside the window. observedExceptions = 1, expected = 0.5,
// ratio = 2.0 → amber band (1.5 < ratio ≤ 3.0).
// ---------------------------------------------------------------------------
const ENTITY_AMBER = "BANK-FIXTURE-AMBER-001";
export const fixtureAmber: BacktestEclFixture = {
  name: "amber",
  entity: ENTITY_AMBER,
  request: baseRequest(ENTITY_AMBER),
  priorSignals: [],
  windowSignals: [
    creditSignal({
      riskId: "risk:fixture-amber:in-window-1",
      asOf: "2026-01-05T12:00:00.000Z",
      entity: ENTITY_AMBER,
      description: "Synthetic in-window staging-3 transition #1 — counts as an exception.",
    }),
  ],
  expectedSeverity: "amber",
};

// ---------------------------------------------------------------------------
// Fixture C — red.
//
// Three exceptions inside the window. observedExceptions = 3, expected = 0.5,
// ratio = 6.0 → red band (ratio > 3.0). The harness must additionally emit a
// `RiskRaised` event when a run lands red (per Q5 — both `RiskRaised` and
// `AuditFinding` on red; AuditFinding is Vera's pipeline output).
// ---------------------------------------------------------------------------
const ENTITY_RED = "BANK-FIXTURE-RED-001";
export const fixtureRed: BacktestEclFixture = {
  name: "red",
  entity: ENTITY_RED,
  request: baseRequest(ENTITY_RED),
  priorSignals: [],
  windowSignals: [
    creditSignal({
      riskId: "risk:fixture-red:in-window-1",
      asOf: "2026-01-03T06:00:00.000Z",
      entity: ENTITY_RED,
      description: "Synthetic in-window staging-3 transition #1.",
    }),
    creditSignal({
      riskId: "risk:fixture-red:in-window-2",
      asOf: "2026-01-05T06:00:00.000Z",
      entity: ENTITY_RED,
      description: "Synthetic in-window staging-3 transition #2.",
    }),
    creditSignal({
      riskId: "risk:fixture-red:in-window-3",
      asOf: "2026-01-08T06:00:00.000Z",
      entity: ENTITY_RED,
      description: "Synthetic in-window staging-3 transition #3.",
    }),
  ],
  expectedSeverity: "red",
};

// ---------------------------------------------------------------------------
// Fixture D — staging transition (within-tolerance with multiple prior
// signals demonstrating that the predictor's information set evolves
// correctly across prediction points).
//
// Two prior signals (one Stage-2, one already-Stage-3-pre-window) plus zero
// in-window exceptions. Expected severity: within-tolerance. Asserts the
// staging-transition behaviour: the harness must correctly fold prior
// signals into `priorSignals` at each prediction point and exclude them.
// ---------------------------------------------------------------------------
const ENTITY_STAGING = "BANK-FIXTURE-STAGING-001";
export const fixtureStagingTransition: BacktestEclFixture = {
  name: "staging-transition",
  entity: ENTITY_STAGING,
  request: baseRequest(ENTITY_STAGING),
  priorSignals: [
    creditSignal({
      riskId: "risk:fixture-staging:prior-1",
      asOf: "2025-12-01T00:00:00.000Z",
      entity: ENTITY_STAGING,
      description: "Pre-window credit-critical signal #1.",
    }),
    creditSignal({
      riskId: "risk:fixture-staging:prior-2",
      asOf: "2025-12-20T00:00:00.000Z",
      entity: ENTITY_STAGING,
      description: "Pre-window credit-critical signal #2.",
    }),
  ],
  windowSignals: [],
  expectedSeverity: "within-tolerance",
};

export const allFixtures: readonly BacktestEclFixture[] = [
  fixtureWithinTolerance,
  fixtureAmber,
  fixtureRed,
  fixtureStagingTransition,
];
