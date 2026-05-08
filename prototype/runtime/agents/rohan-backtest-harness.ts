// runtime/agents/rohan-backtest-harness.ts
//
// Rohan's backtest-harness handler — v0, Tier-1 IFRS 9 ECL only.
//
// S7-Targeted critical-path item #4 (CEO-approved 2026-05-08 via
// `D-S7-TARGETED-3-5-OPEN-QUESTIONS`, sub-decision B). Scoped in
// `Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md` —
// per-prediction-point as-of replay (Q4); cron-triggered (Q2);
// human-in-the-loop disposition via Nadia (Q3); both `RiskRaised` and
// `AuditFinding` on red (Q5); Tier-1 ECL only for v0 (Q1).
//
// Trigger kind: event-driven. Subscribes to `BacktestRequested`. The
// runtime's event-driven fan-out (today: bus-canonical under D-A22 Phase 1)
// dispatches this handler with `ctx.trigger.triggeringEvents` populated.
//
// Per CLAUDE.md Principle 1 (events are the only source of truth) the
// harness is a pure consumer of the event store — for each prediction
// point t the harness replays the log to as-of t (predicted state) and
// to as-of t+horizon (realised state), folds a comparison metric, and
// emits exactly one `BacktestRun` event per request. No projections it
// owns; no register it maintains beyond the `BacktestRun` stream.
//
// Severity bands (v0 placeholder).
//   Methodology v0.1 is not yet published (S7-Targeted item #3 in flight).
//   The bands below are encoded in-code as placeholders. Once methodology
//   v0.1 lands they migrate to the `_methodology-tier-1.md` page and the
//   `methodologyHash` payload-field resolves to the published spec.
//
//     ratio = observedExceptions / max(expectedExceptions, 1)
//     ratio ≤ 1.5  → within-tolerance
//     ratio ≤ 3.0  → amber
//     ratio  > 3.0 → red
//
//   Source: PLACEHOLDER — Basel BCBS-VAR-BACKTEST-1996 traffic-light shape
//   adapted for ECL staging-stability. Methodology v0.1 (Nadia) supersedes
//   on publication; the bands here are advisory until then. Vera's Wave-4
//   #11 validation-cycle recon will assert the bands match the published
//   methodology.
//
// Out of scope for v0 (per sub-decision B):
//   - Scheduled-trigger emitter (separate handler, Nadia-side; emits
//     `BacktestRequested` on Tier-1 annual / Tier-2 18-month cadences).
//   - Methodology-change-triggered runs (no `MethodologyChangePublished`
//     event yet).
//   - Auto-suspend-on-red (`BacktestBreachDisposed` is Nadia's authority
//     surface; the harness stops at the typed `BacktestRun`).
//   - Tier-2 / Tier-3 (Tier-1 ECL only).
//
// Author: Rohan (handler) · Atlas (event-types substrate) · Nadia (methodology contract co-author).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import {
  type BacktestRequestedPayload,
  type BacktestRunPayload,
  makeBacktestRun,
  makeRiskRaised,
} from "../../platform/event-store/event-types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

// ---------------------------------------------------------------------------
// Citations.
//
// Every `BacktestRun` carries the full SR-11-7 / SS-1-23 / Banks Act chain
// per Principle 2. The methodology-specific reference (`KUPIEC-1995`,
// `BCBS-VAR-BACKTEST-1996`, etc.) is appended per comparisonMetric — see
// `metricSpecificCitations()`. The `methodologyHash` payload-field is the
// per-spec citation chain anchor; today it references a methodology document
// that does not yet exist in the repo (`Procedures/validation/_methodology-tier-1.md`)
// — flagged here as a known placeholder per scoping brief §8 / Q3.
// ---------------------------------------------------------------------------
const BASE_CITATIONS = ["SR-11-7-2011", "SS-1-23-2023", "BANKS-ACT-94-1990", "ORG-PR-21"] as const;

const RED_RISK_CITATIONS = [
  "SR-11-7-2011",
  "BANKS-ACT-94-1990",
  "ORG-PR-21",
  "RAS-FRAMEWORK-2026-05-06",
] as const;

function metricSpecificCitations(metric: BacktestRequestedPayload["outcomeMetric"]): string[] {
  switch (metric) {
    case "kupiec":
      return ["KUPIEC-1995"];
    case "christoffersen":
      return ["CHRISTOFFERSEN-1998"];
    case "traffic-light":
    case "coverage-test":
      return ["BCBS-VAR-BACKTEST-1996"];
    case "staging-stability":
    case "migration-matrix":
      return ["IFRS-9", "BCBS-CR-2017"];
    case "custom":
      return [];
  }
}

// ---------------------------------------------------------------------------
// Severity bands — placeholder until methodology v0.1 publishes.
// See top-of-file comment for source attribution.
// ---------------------------------------------------------------------------
const SEVERITY_AMBER_RATIO = 1.5;
const SEVERITY_RED_RATIO = 3.0;

function classifySeverity(expected: number, observed: number): BacktestRunPayload["severity"] {
  // Within-tolerance whenever observed lies within the placeholder band of
  // expected; amber on overshoot up to RED_RATIO; red beyond. Note that for
  // small windows expected < 1 — use it directly rather than flooring at 1
  // (the floor produces false within-tolerance for small samples). When
  // expected = 0 (e.g. predictionCount = 0 in the non-ECL skip path) any
  // observed > 0 is by definition out-of-tolerance, but the skip path
  // never reaches this function with observed > 0.
  if (observed === 0) return "within-tolerance";
  if (expected === 0) return "red";
  const ratio = observed / expected;
  if (ratio <= SEVERITY_AMBER_RATIO) return "within-tolerance";
  if (ratio <= SEVERITY_RED_RATIO) return "amber";
  return "red";
}

// ---------------------------------------------------------------------------
// ECL staging-stability proxy (v0 placeholder).
//
// Methodology v0.1 has not yet published the canonical ECL staging-stability
// metric (Nadia's S7-Targeted item #3, in flight). The v0 harness uses a
// proxy that exercises every substrate seam the steady-state harness needs
// — event-store as-of replay; per-prediction-point reconstruction; expected-
// vs-observed exception fold; severity classification — without inventing a
// methodology surface that conflicts with what Nadia publishes.
//
// Proxy:
//   - At each prediction point t, the *prediction* is "no Stage-3 transitions
//     materialise that were not already signalled by t" (the null).
//   - An *exception* is a `RiskRaised` event of `severity: critical` and
//     `category: "credit"` (a synthetic Stage-3 transition signal) whose
//     `as_of` falls in the window (t, t + horizon].
//   - `expectedExceptions` under the null is `predictionCount × 0.05`
//     (placeholder false-positive band, per Basel traffic-light tradition;
//     methodology v0.1 will replace this with the staging-stability χ²
//     reference distribution).
//   - `observedExceptions` is the count of qualifying RiskRaised events
//     across all prediction points (each event counted once even if it
//     falls in multiple prediction windows — uniqueness keyed on event_id).
//
// This is a stand-in that produces deterministic, fixture-driven severity
// classification. The fixture (`prototype/tests/fixtures/backtest-ecl/`)
// drives within-tolerance / amber / red severities by varying the count of
// blocking RiskRaised events relative to predictionCount.
// ---------------------------------------------------------------------------

const HORIZON_DAYS_DEFAULT = 30;

function granularityToStepDays(g: BacktestRequestedPayload["predictionGranularity"]): number {
  switch (g) {
    case "daily":
      return 1;
    case "monthly":
      return 30;
    case "per-event":
      // For per-event granularity we sample at every distinct as_of in the
      // window; collapse to a coarser daily stride so the fixture can
      // exercise this code path without unbounded per-event replay.
      return 1;
  }
}

function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

interface PredictionPoint {
  readonly t: string;
  readonly horizonEnd: string;
}

function predictionPoints(req: BacktestRequestedPayload): PredictionPoint[] {
  const stepDays = granularityToStepDays(req.predictionGranularity);
  const horizonDays = HORIZON_DAYS_DEFAULT;
  const points: PredictionPoint[] = [];
  let t = req.windowStart;
  // Cap iterations defensively at 5,000 — methodology v0.1 will set a
  // canonical cap; v0 budgets enough for ~13 years of daily windows.
  for (let i = 0; i < 5_000 && t <= req.windowEnd; i++) {
    points.push({ t, horizonEnd: isoAddDays(t, horizonDays) });
    t = isoAddDays(t, stepDays);
  }
  return points;
}

interface BacktestComputation {
  readonly predictionCount: number;
  readonly expectedExceptions: number;
  readonly observedExceptions: number;
  readonly perPointSamples: ReadonlyArray<{ t: string; observed: number }>;
}

function isCreditCriticalSignal(e: Event): boolean {
  if (e.type !== "RiskRaised") return false;
  const p = e.payload as { severity?: string; category?: string };
  return p.severity === "critical" && p.category === "credit";
}

function runEclBacktest(req: BacktestRequestedPayload, entity: string): BacktestComputation {
  const points = predictionPoints(req);
  const perPointSamples: { t: string; observed: number }[] = [];
  const observedIds = new Set<string>();

  for (const p of points) {
    // Replay to as-of t — the predictor's information set at t. Per Q4 the
    // model only sees information available at t (no leakage). The replay
    // is read-only; nothing in the store is mutated. Entity-scoped so the
    // backtest sees only signals for the request's portfolio (Principle 5
    // — every event is entity-scoped; the model is portfolio-bound).
    const priorSignals = new Set<string>();
    for (const e of eventStore.replay({ type: "RiskRaised", entity, asOf: p.t })) {
      if (isCreditCriticalSignal(e)) priorSignals.add(e.event_id);
    }

    // Replay to as-of t+horizon — the realised state. Exceptions are the
    // credit-critical RiskRaised events that occurred in (t, t+horizon].
    let observedAtPoint = 0;
    for (const e of eventStore.replay({ type: "RiskRaised", entity, asOf: p.horizonEnd })) {
      if (priorSignals.has(e.event_id)) continue; // already in predictor set
      if (e.as_of <= p.t) continue; // not in (t, t+horizon]
      if (!isCreditCriticalSignal(e)) continue;
      if (observedIds.has(e.event_id)) continue; // dedupe across prediction windows
      observedIds.add(e.event_id);
      observedAtPoint++;
    }
    perPointSamples.push({ t: p.t, observed: observedAtPoint });
  }

  const predictionCount = points.length;
  // Expected = predictionCount × 5% (placeholder; methodology v0.1 supersedes).
  const expectedExceptions = predictionCount * 0.05;

  return {
    predictionCount,
    expectedExceptions,
    observedExceptions: observedIds.size,
    perPointSamples,
  };
}

// ---------------------------------------------------------------------------
// Backtest-run id — deterministic per (modelId, version, windowStart,
// windowEnd, methodologyHash). Re-running the same request produces a
// stable `backtestRunId`; only the `event_id` differs per emission. This
// is the audit-trail invariant in scoping brief §1.
// ---------------------------------------------------------------------------

function deterministicRunId(req: BacktestRequestedPayload): string {
  const slug =
    `${req.modelId}-${req.version}-${req.windowStart}-${req.windowEnd}-${req.methodologyHash.slice(0, 8)}`
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  return `backtest:${slug}`;
}

// ---------------------------------------------------------------------------
// Tier-1 ECL gate.
//
// v0 only services `staging-stability` and `migration-matrix` outcome
// metrics — the Tier-1 ECL surface. Other metrics (kupiec, christoffersen,
// traffic-light, coverage-test) are Tier-2 (VaR / market-risk) and out of
// scope per sub-decision B (Q1 — Tier-1 only). The handler emits a
// `within-tolerance` BacktestRun with predictionCount=0 for non-ECL
// metrics so the request is acknowledged in the event log; Vera's Wave-4
// #11 recon will surface this as a v0 substrate gap.
// ---------------------------------------------------------------------------

function isEclMetric(metric: BacktestRequestedPayload["outcomeMetric"]): boolean {
  return metric === "staging-stability" || metric === "migration-matrix";
}

// ---------------------------------------------------------------------------
// Handler.
// ---------------------------------------------------------------------------

interface RunOutcome {
  readonly request: BacktestRequestedPayload;
  readonly sourceRequestEventId: string;
  readonly runId: string;
  readonly severity: BacktestRunPayload["severity"];
  readonly predictionCount: number;
  readonly expectedExceptions: number;
  readonly observedExceptions: number;
  readonly runDurationMs: number;
  readonly skipped: boolean;
  readonly skipReason?: string;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const requests = triggering.filter((e) => e.type === "BacktestRequested");

  if (requests.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no BacktestRequested events in triggering set; nothing to backtest",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  const outcomes: RunOutcome[] = [];

  for (const req of requests) {
    const payload = req.payload as BacktestRequestedPayload;
    const t0 = Date.now();
    const runId = deterministicRunId(payload);

    const eclScope = isEclMetric(payload.outcomeMetric);
    let comp: BacktestComputation;
    if (eclScope) {
      comp = runEclBacktest(payload, req.entity);
    } else {
      // Out-of-Tier-1 metric. v0 acknowledges with a no-op run so the
      // request is closed in the audit trail. Methodology library Tier-2
      // / Tier-3 bind the harness on lift.
      comp = {
        predictionCount: 0,
        expectedExceptions: 0,
        observedExceptions: 0,
        perPointSamples: [],
      };
    }

    const severity = eclScope
      ? classifySeverity(comp.expectedExceptions, comp.observedExceptions)
      : "within-tolerance";
    const runDurationMs = Date.now() - t0;

    if (!ctx.dryRun) {
      const citations = [...BASE_CITATIONS, ...metricSpecificCitations(payload.outcomeMetric)];
      const runEvent = makeBacktestRun({
        asOf: ctx.asOf,
        entity: req.entity,
        actor: { type: "service", id: "agent:rohan:backtest-harness" },
        citations,
        payload: {
          backtestRunId: runId,
          modelId: payload.modelId,
          version: payload.version,
          windowStart: payload.windowStart,
          windowEnd: payload.windowEnd,
          comparisonMetric: payload.outcomeMetric,
          expectedExceptions: comp.expectedExceptions,
          observedExceptions: comp.observedExceptions,
          severity,
          methodologyHash: payload.methodologyHash,
          predictionCount: comp.predictionCount,
          runDurationMs,
          sourceRequestEventId: req.event_id,
        },
      });
      eventStore.append(runEvent);
      eventsEmitted++;

      // Per Q5 — red runs emit BOTH a `RiskRaised` (Helena's risk-cycle
      // input) AND would emit an `AuditFinding` (Vera's continuous-controls
      // input). The harness emits only the `RiskRaised` here; the
      // `AuditFinding` is Vera's pipeline output (her continuous-controls
      // recon consumes BacktestRun severity=red and emits the finding —
      // scoping brief §2 architecture sketch). This preserves the
      // model-builder / auditor split: the harness measures and signals;
      // Vera's pipeline produces the audit finding.
      if (severity === "red" && eclScope) {
        eventStore.append(
          makeRiskRaised({
            asOf: ctx.asOf,
            entity: req.entity,
            actor: { type: "service", id: "agent:rohan:backtest-harness" },
            citations: [...RED_RISK_CITATIONS],
            payload: {
              riskId: `risk:backtest-red:${runId}`,
              category: "model",
              severity: "critical",
              likelihood: "almost-certain",
              mitigation: "none",
              description: `Backtest run ${runId} for model ${payload.modelId}@${payload.version} breached the red-severity tolerance band: observed ${comp.observedExceptions} exceptions vs expected ${comp.expectedExceptions.toFixed(2)} (predictionCount=${comp.predictionCount}). Methodology hash ${payload.methodologyHash.slice(0, 12)}…. Awaiting Nadia's BacktestBreachDisposed.`,
              raisedBy: "agent:rohan:backtest-harness",
              relatedTo: "appetite:model:tier-discipline",
            },
          }),
        );
        eventsEmitted++;
      }
    }

    outcomes.push({
      request: payload,
      sourceRequestEventId: req.event_id,
      runId,
      severity,
      predictionCount: comp.predictionCount,
      expectedExceptions: comp.expectedExceptions,
      observedExceptions: comp.observedExceptions,
      runDurationMs,
      skipped: !eclScope,
      ...(eclScope
        ? {}
        : {
            skipReason: `v0 services Tier-1 ECL only (metric=${payload.outcomeMetric} out of scope)`,
          }),
    });
  }

  // Owner Inbox deliverable — one file per dispatch, summarising the
  // requests serviced and the runs emitted. Convention matches other
  // event-driven handlers (scrooge:follow-on-router, anya:projection-refresh).
  let deliverable: string | undefined;
  if (!ctx.dryRun && outcomes.length > 0) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_rohan_backtest-harness.md`;
    writeFileSync(resolve(ctx.ownerInboxDir, filename), buildDeliverable(ctx, outcomes), "utf8");
    deliverable = `Owner Inbox/${filename}`;
  }

  const sevCounts = outcomes.reduce<Record<string, number>>((acc, o) => {
    acc[o.severity] = (acc[o.severity] ?? 0) + 1;
    return acc;
  }, {});
  const skipped = outcomes.filter((o) => o.skipped).length;

  logger.info(
    {
      requests: requests.length,
      sevCounts,
      skipped,
      eventsEmitted,
    },
    "rohan:backtest-harness — done",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${requests.length} backtest request${requests.length === 1 ? "" : "s"} — ${describeSeverityCounts(sevCounts)}${skipped ? ` (${skipped} non-ECL skipped)` : ""}.`,
    ok: true,
  };
};

function describeSeverityCounts(counts: Record<string, number>): string {
  const order: BacktestRunPayload["severity"][] = ["within-tolerance", "amber", "red"];
  return order.map((s) => `${counts[s] ?? 0} ${s}`).join(" / ");
}

function buildDeliverable(ctx: AgentRunContext, outcomes: readonly RunOutcome[]): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Rohan", "backtest-harness", ctx.asOf));
  lines.push(`# Rohan — backtest harness, ${date}`);
  lines.push("");
  lines.push(
    "Event-driven run of Rohan's backtest harness (S7-Targeted #4, v0). Subscribes to `BacktestRequested`; emits one `BacktestRun` per request. Tier-1 IFRS 9 ECL only; non-ECL metrics acknowledged with a no-op run pending Tier-2 / Tier-3 lift.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${outcomes.length} request${outcomes.length === 1 ? "" : "s"} serviced · ${outcomes.filter((o) => o.severity === "within-tolerance").length} within-tolerance · ${outcomes.filter((o) => o.severity === "amber").length} amber · ${outcomes.filter((o) => o.severity === "red").length} red.`,
  );
  lines.push("");
  lines.push("## Runs emitted");
  lines.push("");
  lines.push(
    "| Run id | Model | Metric | Predictions | Expected | Observed | Severity | Source request |",
  );
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const o of outcomes) {
    lines.push(
      `| \`${o.runId}\` | \`${o.request.modelId}@${o.request.version}\` | ${o.request.outcomeMetric} | ${o.predictionCount} | ${o.expectedExceptions.toFixed(2)} | ${o.observedExceptions} | ${o.severity}${o.skipped ? " *(skipped — non-ECL)*" : ""} | \`${o.sourceRequestEventId.slice(0, 12)}…\` |`,
    );
  }
  lines.push("");
  lines.push("## Methodology placeholder");
  lines.push("");
  lines.push(
    "Severity bands and the ECL staging-stability proxy used in this run are in-code placeholders pending publication of `Procedures/validation/_methodology-tier-1.md` (Nadia's S7-Targeted item #3, in flight). The bands `ratio ≤ 1.5 / ≤ 3.0 / > 3.0` map within-tolerance / amber / red and are advisory until methodology v0.1 binds them.",
  );
  lines.push("");
  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Triggered event-driven from `BacktestRequested` events appended in the parent run. Per-prediction-point as-of replay against `eventStore.replay({type, asOf})`. Citations on emit: SR-11-7-2011, SS-1-23-2023, BANKS-ACT-94-1990, ORG-PR-21, plus the metric-specific reference (e.g. IFRS-9 / BCBS-CR-2017 for staging-stability).",
  );
  lines.push("");
  return lines.join("\n");
}

export default handler;
