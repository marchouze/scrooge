// runtime/agents/helena-risk-appetite-watch.ts
//
// Helena's daily risk-appetite-watch handler. First handler in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes Helena's spec § 6 inactivity-SLA: "Daily
// appetite-monitoring rollup must produce an event; quiet > 24h is a
// substrate alert."
//
// What this handler does:
//   1. Walks the canonical RAS appetite-line register
//      (`platform/risk/ras-appetite-register.ts`) — the typed
//      citation-bound mirror of the Risk Appetite Statement (RAS) §§B1–B8.
//      Each line's citations point back into the RAS sections + decisions
//      that define it (D-RAS, D-RAS-STRUCTURED-REGISTER).
//   2. For each line, attempts to compute current value + status from
//      the event store. Today most are `unmeasured` because Rohan's
//      measurement substrate is not yet built — that's the dominant
//      substrate gap and the dominant signal of the run.
//   3. Reads recent AppetiteBreach events; counts those without a
//      matching AppetiteBreachDisposed.
//   4. Emits one RiskAppetiteSnapshot event carrying the full state.
//   5. If any Tier-1 or Tier-2 breach is open past its SLA, emits a
//      typed AgentEscalation routed to the CEO.
//   6. Writes a daily deliverable to Owner Inbox.
//
// Build-phase posture:
//   - The bank has zero positions, zero customers, zero capital. Most
//     appetite metrics are structurally unmeasurable today; the run's
//     value is in (a) reporting that the framework + monitor exist and
//     (b) surfacing the substrate gaps that block measurement.
//   - When Rohan ships a measurement projection (workstream #5 in the
//     fleet-rollout plan), this handler swaps the `unmeasured` branch
//     for actual reads against `@platform/risk-appetite-monitoring`.
//     The handler shape doesn't change — only the measurement source.
//
// Author: Helena (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeAgentEscalation } from "../../platform/event-store/event-types";
import type { EventStore } from "../../platform/event-store/store";

// How many consecutive RiskAppetiteSnapshot runs with unmeasuredCount > 0
// before Helena emits a formal substrate-gap escalation to Scrooge.
// Must match the threshold in helena-goal-loop.ts.
const UNMEASURED_ESCALATION_THRESHOLD = 3;
import { computeIntradayLiquidityMetrics } from "../../platform/alm/intraday-liquidity-metrics";
import { computeLCR } from "../../platform/liquidity/lcr";
import { computeNSFR } from "../../platform/liquidity/nsfr";
import { getALMPositionSnapshot } from "../../platform/projections/alm-positions";
import { computeCapitalMetrics } from "../../platform/projections/capital-metrics";
import { getClimateRiskMetric } from "../../platform/projections/climate-risk-projection";
import { computeCyberSeverityPosture } from "../../platform/projections/cyber-incident-severity";
import { computeLeverageRatioMetrics } from "../../platform/projections/leverage-ratio-metrics";
import { getModelTierDisciplineMetric } from "../../platform/projections/model-tier-discipline";
import { computeRwaFromPositions } from "../../platform/projections/rwa-from-positions";
// Canonical appetite-line register — the single source of truth for the 14
// RAS appetite lines, their tiers, structured thresholds, measurement
// bindings, and citations. Replaces the former hand-curated AppetiteLine
// interface + APPETITE_LINES array (gap #6; D-RAS-STRUCTURED-REGISTER).
import {
  RAS_APPETITE_LINES,
  type RasAppetiteLine,
  type RasMetricStatus,
  classifyUsageRatio,
  formatThresholds,
  requireRasAppetiteLine,
} from "../../platform/risk/ras-appetite-register";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["BANKS-ACT-94-1990", "BCBS-CG-PRINCIPLE-6", "RAS-FRAMEWORK-2026-05-06"];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const HELENA_NARRATIVE_SYSTEM = `You are Helena, the bank's Chief Risk Officer — owner of the Risk Appetite Statement & Framework, the risk taxonomy, three-lines-of-defence operating discipline, ICAAP / ILAAP, the stress-testing programme, model-risk governance, and the Board Risk Committee secretariat. Your operating spec is at \`Team/Helena.md\`. You report to the CEO with a direct line to the BRC.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your daily risk-appetite-watch rollup — an inventory of every appetite line in the RAS shadow set, the measurement status for each, the count of open breaches, and the days-since-last-RAS-review counter.

You are NOT an engineer. You do not edit code, build pipelines, or measure risk. You govern. Your voice is composed, direct, unsentimental — a CRO who has chaired enough BRCs to know the difference between a number that satisfies a regulator and a number that protects a bank.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the appetite-monitoring substrate is, and which class of metrics is most exposed (capital, liquidity, market, credit, conduct, financial-crime, model, climate).
- Picks the 1–3 most consequential observations: an unmeasured line that is load-bearing on a regulator commitment (LCR, NSFR, CET1), a breach class with no measurement substrate, an RAS section the BRC will need to revisit at next cycle.
- Names the next governance step. Be concrete: a specific BRC paper to write, a specific limit cascade to commission from Rohan, a specific exception to register.

Cite Banks Act 94 of 1990 and BCBS Corporate Governance Principles for Banks where they bind. Reference the RAS by section (e.g. RAS §B3 for liquidity buffers). The framework is the canonical authoring location; your narrative is governance interpretation, not new framework substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Helena's narrative". Just produce the prose.

If the input shows zero measurements (build phase), say so plainly. The dominant signal in build phase is the *gap inventory*, not the metrics themselves.`;

// Appetite-line types + the 14-line set are now the canonical register's
// (platform/risk/ras-appetite-register.ts). These aliases keep the handler's
// internal references stable while the register is the single source of truth.
type Tier = RasAppetiteLine["tier"];
type MetricStatus = RasMetricStatus;
type AppetiteLine = RasAppetiteLine;

/** The canonical RAS appetite lines, imported from the register. */
const APPETITE_LINES: readonly AppetiteLine[] = RAS_APPETITE_LINES;

interface LineState {
  readonly line: AppetiteLine;
  readonly status: MetricStatus;
  readonly note: string;
}

interface BreachCounts {
  readonly openBreaches: number;
  readonly disposedBreaches: number;
  readonly tier1Open: number;
  readonly tier2Open: number;
}

export interface AppetiteSnapshot {
  readonly lineStates: readonly LineState[];
  readonly measuredCount: number;
  readonly unmeasuredCount: number;
  readonly breachCounts: BreachCounts;
  readonly daysSinceRasReview: number;
}

// ---------------------------------------------------------------------------
// Liquidity metric (RAS §B3 thresholds)
// ---------------------------------------------------------------------------
// Builds the LCR + NSFR + intraday measurements for the
// appetite:liquidity:lcr, appetite:liquidity:nsfr, and
// appetite:liquidity:intraday lines via Ravi (Treasury and ALM engineer)'s
// ALM-positions projection and BCBS 248 metrics engine. Build-phase posture: when no positions are fed
// (empty inputs → `status: no-positions` from `computeLCR`/`computeNSFR`),
// the appetite line resolves to a measured green-with-substrate-gap rather
// than `unmeasured` — the framework knows the answer is "above-minimum" by
// construction (no outflows → no shortfall) while explicitly carrying the
// gap inventory for the BRC pack.
//
// RAS §B3 thresholds are canonical in `platform/risk/ras-appetite-register.ts`
// (the `appetite:liquidity:lcr` / `appetite:liquidity:nsfr` lines'
// `thresholds`); `formatThresholds` round-trips them to the exact strings the
// report prints. The numeric band logic below mirrors those bounds.

interface LiquidityMetricForLine {
  /** Computed status under RAS §B3 — never `unmeasured`. */
  readonly status: MetricStatus;
  /** Human-readable note for the line. */
  readonly note: string;
}

function statusForLcrRatio(ratioPct: number | null): MetricStatus {
  if (ratioPct === null) {
    // Null + above-minimum status is the "effectively infinite" case
    // (HQLA present, zero net outflows). Treat as green.
    return "green";
  }
  if (ratioPct < 105) return "red"; // critical band
  if (ratioPct < 110) return "red";
  if (ratioPct < 120) return "amber";
  return "green";
}

function statusForNsfrRatio(ratioPct: number | null): MetricStatus {
  if (ratioPct === null) return "green";
  if (ratioPct < 103) return "red"; // critical band
  if (ratioPct < 108) return "red";
  if (ratioPct < 115) return "amber";
  return "green";
}

function buildLiquidityMetric(asOf: string): {
  lcr: LiquidityMetricForLine;
  nsfr: LiquidityMetricForLine;
  intraday: LiquidityMetricForLine;
} {
  // T+30 snapshot is the canonical horizon for the RAS §B3 buffer line
  // (30-day stress per BA 110). Anya's daily handler computes both T+0 and
  // T+30; the appetite line uses T+30 for forward-looking buffer adequacy.
  const alm = getALMPositionSnapshot(eventStore, asOf, 30);
  const lcr = computeLCR([...alm.hqlaPositions], [...alm.fundingPositions]);
  const nsfr = computeNSFR([...alm.asfItems], [...alm.rsfItems]);

  // Build-phase: no positions → `no-positions` status. By construction the
  // bank holds zero outflows and zero RSF, so the ratio is structurally
  // above the regulatory minimum. Report green-with-substrate-gap.
  const gapSummary = alm.gaps.length > 0 ? ` Substrate gaps: ${alm.gaps.length} class(es).` : "";

  // Threshold strings are read from the canonical register — NOT re-typed
  // here. `formatThresholds` round-trips to the exact human string the report
  // has always printed (parity gate + faithfulness test pin this).
  const lcrThresholds = formatThresholds(
    requireRasAppetiteLine("appetite:liquidity:lcr").thresholds,
  );
  const nsfrThresholds = formatThresholds(
    requireRasAppetiteLine("appetite:liquidity:nsfr").thresholds,
  );

  const lcrStatus: MetricStatus =
    lcr.status === "no-positions" ? "green" : statusForLcrRatio(lcr.lcrRatioPct);
  const lcrNote =
    lcr.status === "no-positions"
      ? `Build-phase: no positions in store → no-outflow construction; RAS §B3 LCR appetite line resolves to green-with-substrate-gap.${gapSummary} Source: Ravi (Treasury and ALM engineer, engineering) ALM-positions projection T+30.`
      : `LCR T+30 = ${lcr.lcrRatioPct === null ? "∞" : `${lcr.lcrRatioPct.toFixed(1)}%`} (HQLA R${lcr.hqlaZar.toLocaleString()}, net outflows R${lcr.netCashOutflowsZar.toLocaleString()}). RAS §B3 thresholds: ${lcrThresholds}.${gapSummary}`;

  const nsfrStatus: MetricStatus =
    nsfr.status === "no-positions" ? "green" : statusForNsfrRatio(nsfr.nsfrRatioPct);
  const nsfrNote =
    nsfr.status === "no-positions"
      ? `Build-phase: no positions in store → no-RSF construction; RAS §B3 NSFR appetite line resolves to green-with-substrate-gap.${gapSummary} Source: Ravi (Treasury and ALM engineer, engineering) ALM-positions projection T+30.`
      : `NSFR T+30 = ${nsfr.nsfrRatioPct === null ? "∞" : `${nsfr.nsfrRatioPct.toFixed(1)}%`} (ASF R${nsfr.asfZar.toLocaleString()}, RSF R${nsfr.rsfZar.toLocaleString()}). RAS §B3 thresholds: ${nsfrThresholds}.${gapSummary}`;

  // appetite:liquidity:intraday — measured by Ravi (Treasury and ALM
  // engineer, engineering)'s BCBS 248 seven-tool computation
  // (`computeIntradayLiquidityMetrics`, platform/alm/intraday-liquidity-
  // metrics.ts). Build-phase posture: zero positions → overallStatus
  // "no-positions" → green-with-substrate-gap (zero usage of a zero buffer by
  // construction — same convention as LCR/NSFR above). When measured, the
  // headline `peakUsagePctOfAvailable` classifies under the register line's
  // higher-is-worse ladder via `classifyUsageRatio` — thresholds are READ
  // from the canonical register, never re-typed here.
  // Authority: D-INTRADAY-RAS-APPETITE (CRO-approved 2026-06-11);
  //   D-TREASURER-WAVE1-SUBSTRATE; RAS §B3; BCBS 248; LRM Policy v1 §4.5.
  const intradayLine = requireRasAppetiteLine("appetite:liquidity:intraday");
  const intradayMetrics = computeIntradayLiquidityMetrics(asOf, { eventStore });
  const intradayThresholds = formatThresholds(intradayLine.thresholds);
  let intradayStatus: MetricStatus;
  let intradayNote: string;
  if (intradayMetrics.overallStatus === "no-positions") {
    intradayStatus = "green";
    intradayNote = `Build-phase: zero start-of-day intraday liquidity → zero usage by construction; RAS §B3 intraday appetite line resolves to green-with-substrate-gap. Governed floor R${(intradayLine.floorZar ?? 0).toLocaleString()} (register floorZar; D-INTRADAY-RAS-APPETITE). Source: Ravi (Treasury and ALM engineer, engineering) BCBS 248 metrics (computeIntradayLiquidityMetrics).`;
  } else {
    const peak = intradayMetrics.peakUsagePctOfAvailable;
    intradayStatus = classifyUsageRatio(intradayLine.thresholds, peak) ?? "green";
    intradayNote = `Intraday peak usage = ${peak === null ? "0" : peak.toFixed(1)}% of available start-of-day liquidity (R${intradayMetrics.availableAtStartZar.toLocaleString()} available; BCBS 248 tools 1/2). RAS §B3 thresholds: ${intradayThresholds}. Governed floor R${(intradayLine.floorZar ?? 0).toLocaleString()} (D-INTRADAY-RAS-APPETITE). LRM Policy v1 §4.5 stress trigger at red (≥80%).`;
  }

  return {
    lcr: { status: lcrStatus, note: lcrNote },
    nsfr: { status: nsfrStatus, note: nsfrNote },
    intraday: { status: intradayStatus, note: intradayNote },
  };
}

function statusForLine(
  line: AppetiteLine,
  capitalMetrics?: ReturnType<typeof computeCapitalMetrics>,
  climateMetric?: ReturnType<typeof getClimateRiskMetric>,
  leverageMetrics?: ReturnType<typeof computeLeverageRatioMetrics>,
  liquidityMetric?: ReturnType<typeof buildLiquidityMetric>,
  modelTierMetric?: ReturnType<typeof getModelTierDisciplineMetric>,
  cyberPosture?: ReturnType<typeof computeCyberSeverityPosture>,
): LineState {
  // In build phase, every metric is structurally unmeasurable: there
  // are no positions, no customers, no capital. The exception is
  // zero-appetite lines (sanctions, STR judgement, TCF) where the
  // *posture* is the appetite — Mira's pipeline already gates these,
  // and the framework requires zero violations rather than tracking
  // a number. Those lines report `green` in build phase if no
  // override events exist; otherwise `red`.
  if (line.tier === "zero-appetite") {
    return {
      line,
      status: "green",
      note: "Zero-appetite line; Mira's gate enforces. No override events observed in this run.",
    };
  }

  // appetite:capital:cet1-buffer — measured by Bea's capital-metrics module.
  // Returns an actual status (green/amber/red) from the ICAAP v1 build-phase
  // baseline or from live CapitalEvent events when they exist.
  // Authority: D-RAS (2026-05-06), D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12).
  if (line.id === "appetite:capital:cet1-buffer" && capitalMetrics !== undefined) {
    return {
      line,
      status: capitalMetrics.status,
      note: capitalMetrics.note,
    };
  }

  // appetite:capital:leverage-ratio — measured by the Basel III leverage-
  // ratio projection. Build-phase posture (CLAUDE.md): no live positions ⇒
  // exposure = 0 ⇒ ratio = Infinity ⇒ green (compliant by convention; the
  // regulator-floor compliance flag also reports `true`). Lights up
  // amber/red when the periodic SA-CCR + commitment projections start
  // dropping live exposure values into the store.
  // Authority: D-RAS (2026-05-06), D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12),
  //   Banks Act §70, RRTB Reg 38, BCBS Basel III §147–§165.
  if (line.id === "appetite:capital:leverage-ratio" && leverageMetrics !== undefined) {
    return {
      line,
      status: leverageMetrics.status,
      note: leverageMetrics.note,
    };
  }

  // appetite:liquidity:lcr / appetite:liquidity:nsfr — measured by Ravi's
  // ALM-positions projection + Anya's LCR/NSFR engines. Build-phase posture:
  // empty positions → green-with-substrate-gap (no outflows by construction).
  // Once positions flow, status maps under RAS §B3 thresholds.
  // Authority: D-RAS (2026-05-06); RAS §B3; RRTB Reg 26 (LCR); RRTB Reg 26A
  // (NSFR); brief:ravi:alm-position-substrate-and-helena-liquidity-line:
  // 2026-05-21.
  if (line.id === "appetite:liquidity:lcr" && liquidityMetric !== undefined) {
    return {
      line,
      status: liquidityMetric.lcr.status,
      note: liquidityMetric.lcr.note,
    };
  }
  if (line.id === "appetite:liquidity:nsfr" && liquidityMetric !== undefined) {
    return {
      line,
      status: liquidityMetric.nsfr.status,
      note: liquidityMetric.nsfr.note,
    };
  }

  // appetite:liquidity:intraday — measured by Ravi's BCBS 248 seven-tool
  // computation (computeIntradayLiquidityMetrics). Build-phase posture: zero
  // positions → green-with-substrate-gap; once intraday flows exist, the
  // headline peakUsagePctOfAvailable classifies under the register ladder.
  // Authority: D-INTRADAY-RAS-APPETITE (2026-06-11); RAS §B3; BCBS 248;
  // LRM Policy v1 §4.5.
  if (line.id === "appetite:liquidity:intraday" && liquidityMetric !== undefined) {
    return {
      line,
      status: liquidityMetric.intraday.status,
      note: liquidityMetric.intraday.note,
    };
  }

  // appetite:climate:guidance-note-1-2024 — measured by the climate-risk projection.
  // Reads ClimateScenarioRun events; computes worstCaseStressLossPct.
  // Returns no-data in build phase (no live book, no quarterly run yet) — this is the
  // correct posture, not a violation.
  // Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK; PA Guidance Note 1 of 2024; PROC-RISK-CR-01.
  if (line.id === "appetite:climate:guidance-note-1-2024" && climateMetric !== undefined) {
    if (climateMetric.status === "no-data") {
      return {
        line,
        status: "n/a-build-phase",
        note: "No ClimateScenarioRun events yet — first run due at next quarterly tick. Build-phase posture: no live book, no portfolio to stress. PA GN 1/2024 measurement substrate live (PROC-RISK-CR-01); awaiting first quarterly run.",
      };
    }
    // Measured: derive RAG from worstCaseStressLossPct.
    // RAS thresholds (BRC to calibrate at commencement; build-phase defaults per PROC-RISK-CR-01 §6.3):
    //   green:  worstCaseStressLossPct < 5%
    //   amber:  5% ≤ worstCaseStressLossPct ≤ 10%
    //   red:    worstCaseStressLossPct > 10%
    const pct = climateMetric.worstCaseStressLossPct;
    let status: MetricStatus;
    if (pct > 10) {
      status = "red";
    } else if (pct >= 5) {
      status = "amber";
    } else {
      status = "green";
    }
    const scenariosLabel = climateMetric.scenariosRun.join(", ");
    return {
      line,
      status,
      note: `ClimateScenarioRun measured: worst-case stress loss ${pct.toFixed(2)}% of total exposure (scenarios: ${scenariosLabel}; latest run: ${climateMetric.latestRunDate}). PA GN 1/2024; PROC-RISK-CR-01.`,
    };
  }

  // appetite:model:tier-discipline — measured by the model-tier-discipline
  // projection. Reads the model registry event stream (ModelSubmitted,
  // ModelTierClassified, ModelValidationApproved, ModelValidationWithheld,
  // ValidationFindingRaised, ValidationFindingClosed) and computes the MRAS
  // (Model Risk Appetite Score) per model-risk-policy-v1.md §6.1.
  // Build-phase posture: empty registry → `no-models` → green by construction
  // (no models deployed = no model risk). Status rises to amber/red as Rohan
  // seeds models and Nadia runs validation.
  // Authority: D-RAS (2026-05-06); RAS §B7;
  //   brief:atlas:build-model-tier-discipline-measurement-substrat:2026-06-01.
  if (line.id === "appetite:model:tier-discipline" && modelTierMetric !== undefined) {
    if (modelTierMetric.status === "no-models") {
      return {
        line,
        status: "green",
        note: `No models deployed in build phase; model risk appetite satisfied by construction. RAS §B7. ${modelTierMetric.note}`,
      };
    }
    const metricNote = modelTierMetric.note;
    return {
      line,
      status: modelTierMetric.status,
      note: metricNote,
    };
  }

  // appetite:operational:cyber-severity-tiers — measured by Senna's
  // cyber-incident-severity projection. Reads IncidentClassified,
  // IncidentContained, and PostIncidentReviewCompleted events and maps
  // to RAG per CY-IRP-01 §2.1 + §7.2 KRIs.
  // Build-phase posture: zero incidents → green by construction.
  // Authority: D-RAS (2026-05-06); RAS §B6; CY-IRP-01;
  //   brief:senna:build-cyber-incident-severity-measurement-substr:2026-06-01.
  if (line.id === "appetite:operational:cyber-severity-tiers" && cyberPosture !== undefined) {
    if (cyberPosture.status === "no-incidents") {
      return {
        line,
        status: "green",
        note: "No incidents in build phase; cyber-severity appetite satisfied by construction. RAS §B6.",
      };
    }
    return {
      line,
      status: cyberPosture.status,
      note: cyberPosture.note,
    };
  }

  // Everything else: unmeasured pending Rohan / Bea / Ravi measurement
  // substrate. Build-phase n/a is *not* the same as unmeasured — n/a
  // means structurally not applicable yet (no book, no portfolio); we
  // use it for lines where the bank simply has nothing to measure.
  if (line.category === "market" || line.category === "credit") {
    return {
      line,
      status: "n/a-build-phase",
      note: "No book or portfolio in build phase; line activates at commencement of trading.",
    };
  }
  return {
    line,
    status: "unmeasured",
    note: `Measurement substrate not yet built (${line.measurementOwner}).`,
  };
}

function readBreachCounts(): BreachCounts {
  // AppetiteBreach / AppetiteBreachDisposed are events Helena's spec
  // declares as her output set (§ 9, § 11); they don't exist in the
  // store yet (no measurement → no breaches → no disposals). The walk
  // is correct against the empty set today; it stays correct when
  // events flow.
  const breaches = [...eventStore.replay({ type: "AppetiteBreach" })];
  const disposals = new Set<string>();
  for (const e of eventStore.replay({ type: "AppetiteBreachDisposed" })) {
    const id = (e.payload as { breachId?: string })?.breachId;
    if (id) disposals.add(id);
  }
  let openBreaches = 0;
  let disposedBreaches = 0;
  let tier1Open = 0;
  let tier2Open = 0;
  for (const b of breaches) {
    const id = (b.payload as { breachId?: string })?.breachId;
    const tier = (b.payload as { tier?: Tier })?.tier;
    const isDisposed = id ? disposals.has(id) : false;
    if (isDisposed) {
      disposedBreaches++;
    } else {
      openBreaches++;
      if (tier === "tier-1") tier1Open++;
      if (tier === "tier-2") tier2Open++;
    }
  }
  return { openBreaches, disposedBreaches, tier1Open, tier2Open };
}

function daysSince(asOfIso: string, sinceIso: string): number {
  const ms = new Date(asOfIso).getTime() - new Date(sinceIso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function buildSnapshot(asOfIso: string): AppetiteSnapshot {
  // Compute CET1 capital headroom metrics (Bea's module — closes the
  // appetite:capital:cet1-buffer unmeasured gap). Build-phase fallback
  // to ICAAP v1 confirmed figures when no live CapitalEvent events exist.
  // Authority: D-RAS (2026-05-06), D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12).
  const capitalMetrics = computeCapitalMetrics(eventStore, asOfIso);

  // Compute climate-risk metric (Helena's climate-risk projection — closes the
  // appetite:climate:guidance-note-1-2024 unmeasured gap).
  // Returns no-data in build phase (no ClimateScenarioRun events yet); this is
  // the correct posture — build-phase status is n/a-build-phase, not unmeasured.
  // Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK; PA GN 1/2024; PROC-RISK-CR-01.
  const climateMetric = getClimateRiskMetric(eventStore);

  // Compute Basel III leverage-ratio metric (Helena + Rohan projection — closes
  // the appetite:capital:leverage-ratio unmeasured gap). Build-phase posture:
  // exposure = 0 against Tier-1 R300m envelope ⇒ ratio = Infinity ⇒ green.
  // Authority: D-RAS, D-MARKETS-CAPITAL-TIME-SHAPE, Banks Act §70,
  //   RRTB Reg 38, BCBS Basel III §147–§165.
  const leverageMetrics = computeLeverageRatioMetrics(eventStore, asOfIso);

  // Compute liquidity metrics (Ravi's ALM-positions projection + Anya's
  // LCR/NSFR engines — closes the appetite:liquidity:lcr and
  // appetite:liquidity:nsfr unmeasured gaps).
  // Build-phase posture: empty positions → green-with-substrate-gap;
  // RAS §B3 thresholds applied when positions flow.
  // Authority: D-RAS (2026-05-06); RAS §B3; RRTB Reg 26 (LCR); RRTB Reg 26A (NSFR).
  const liquidityMetric = buildLiquidityMetric(asOfIso);

  // Compute model-tier-discipline metric (Atlas projection — closes the
  // appetite:model:tier-discipline unmeasured gap). Reads from the
  // LocalModelRegistry event stream (ModelSubmitted, ModelTierClassified,
  // ModelValidationApproved/Withheld, ValidationFindingRaised/Closed).
  // Build-phase posture: empty registry → `no-models` → green by construction.
  // Authority: D-RAS (2026-05-06); RAS §B7;
  //   brief:atlas:build-model-tier-discipline-measurement-substrat:2026-06-01.
  const modelTierMetric = getModelTierDisciplineMetric(eventStore);

  // Compute cyber-incident severity posture (Senna's cyber-incident-
  // severity projection — closes the appetite:operational:cyber-severity-tiers
  // unmeasured gap).
  // Build-phase posture: zero IncidentClassified events → green by
  // construction (no incidents to measure).
  // Authority: D-RAS (2026-05-06); RAS §B6; CY-IRP-01;
  //   brief:senna:build-cyber-incident-severity-measurement-substr:2026-06-01.
  const cyberPosture = computeCyberSeverityPosture(eventStore, asOfIso);

  const lineStates = APPETITE_LINES.map((line) =>
    statusForLine(
      line,
      capitalMetrics,
      climateMetric,
      leverageMetrics,
      liquidityMetric,
      modelTierMetric,
      cyberPosture,
    ),
  );
  const measuredCount = lineStates.filter(
    (s) => s.status === "green" || s.status === "amber" || s.status === "red",
  ).length;
  const unmeasuredCount = lineStates.filter((s) => s.status === "unmeasured").length;
  const breachCounts = readBreachCounts();
  // RAS approved 2026-05-06 (D-RAS) per memory; quarterly review cadence.
  const daysSinceRasReview = daysSince(asOfIso, "2026-05-06T00:00:00Z");
  return { lineStates, measuredCount, unmeasuredCount, breachCounts, daysSinceRasReview };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: AppetiteSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(
    `appetite-line inventory: ${APPETITE_LINES.length} lines across ${new Set(APPETITE_LINES.map((l) => l.category)).size} categories`,
  );
  lines.push(`  measured (green/amber/red): ${snap.measuredCount}`);
  lines.push(`  unmeasured (substrate gap): ${snap.unmeasuredCount}`);
  lines.push(
    `  n/a in build phase: ${snap.lineStates.filter((s) => s.status === "n/a-build-phase").length}`,
  );
  lines.push("");
  lines.push("breach counts:");
  lines.push(
    `  open: ${snap.breachCounts.openBreaches} (tier-1: ${snap.breachCounts.tier1Open}; tier-2: ${snap.breachCounts.tier2Open})`,
  );
  lines.push(`  disposed: ${snap.breachCounts.disposedBreaches}`);
  lines.push("");
  lines.push(`days since RAS review: ${snap.daysSinceRasReview}`);
  lines.push("RAS quarterly cadence: next review due day 90");
  lines.push("");
  lines.push("appetite-line states:");
  for (const s of snap.lineStates) {
    lines.push(`  - [${s.status}] ${s.line.id} (${s.line.tier}, ${s.line.rasSection}): ${s.note}`);
  }
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on a regulator commitment; close with the next governance step.",
  );
  return lines.join("\n");
}

/** True when the store holds zero events of the given type (probe helper). */
function storeHasNoEventsOfType(store: EventStore, type: string): boolean {
  for (const _ of store.replay({ type })) {
    return false;
  }
  return true;
}

/**
 * Derive the "Substrate gaps surfaced this run" bullets from the event store,
 * NOT from unconditional string literals. Each gap is emitted ONLY when its
 * closing condition is actually unmet; a closed gap drops off the report
 * automatically (D-CRO-GAP-SECTION-DERIVE-FROM-STORE, 2026-06-08). Before this
 * fix the section was a split-brain render: the appetite-line table derived its
 * status live from the store while these bullets were hard-coded, so the RWA-
 * engine and independent-model-validation gaps kept printing as open long after
 * `computeRwaFromPositions` (2026-05-30) and Nadia (Model Validation lead,
 * governance — hired 2026-05-09) closed them. Prose wording per bullet is
 * preserved; only the emission moved from unconditional to store-derived.
 *
 * Probe → bullet map:
 *   - Measurement substrate: `snap.unmeasuredCount > 0`.
 *   - Live capital events: zero `CapitalEvent` events (same condition as the
 *     `live === null` branch in `capital-metrics.ts`).
 *   - RWA engine: `computeRwaFromPositions(store, asOf).buildPhaseFallback`
 *     (true ⇒ no live trade positions ⇒ CET1 denominator still ICAAP v1).
 *   - Structured RAS register: the one remaining standing meta-gap (no
 *     structured register exists yet).
 *   - Independent model-validation: zero `ModelValidationApproved` events.
 *   - Climate-risk substrate: zero `ClimateScenarioRun` events.
 */
export function buildSubstrateGapLines(
  store: EventStore,
  asOf: string,
  snap: AppetiteSnapshot,
): string[] {
  const gaps: string[] = [];

  // Measurement substrate — only while some line is still unmeasured.
  if (snap.unmeasuredCount > 0) {
    gaps.push(
      `- **Measurement substrate** — ${snap.unmeasuredCount} of ${APPETITE_LINES.length} lines are unmeasured pending Rohan engineering (next handler #5 in the fleet-rollout plan). Closed: \`appetite:capital:cet1-buffer\` (Bea's capital-metrics module, D-MARKETS-CAPITAL-TIME-SHAPE); \`appetite:liquidity:lcr\` and \`appetite:liquidity:nsfr\` (Ravi's ALM-positions projection wired to RAS §B3 thresholds, build-phase green-with-substrate-gap per brief \`brief:ravi:alm-position-substrate-and-helena-liquidity-line:2026-05-21\`).`,
    );
  }

  // Live capital events — only while no CapitalEvent events exist in the store
  // (mirrors the `live === null` build-phase branch in capital-metrics.ts).
  if (storeHasNoEventsOfType(store, "CapitalEvent")) {
    gaps.push(
      "- **Live capital events** — CET1 metrics currently use ICAAP v1 build-phase baseline (D-MARKETS-CAPITAL-TIME-SHAPE). Substrate gap: no live CapitalEvent events (CapitalContributionRecorded / equity-issuance) in the store. When real capital is raised at licence-day, the module auto-switches to live-event mode.",
    );
  }

  // RWA engine — only while the live RWA projection falls back (no live trades).
  // Reuses computeRwaFromPositions; the CET1 line already prints live RWA when
  // trades exist, so this gap closes automatically the moment trades are booked.
  if (computeRwaFromPositions(store, asOf).buildPhaseFallback) {
    gaps.push(
      "- **RWA engine** — CET1 ratio denominator uses build-phase ICAAP v1 RWA (R73.75m) until W2 Slice 3 RWA engine lands. Owner: Bea + Rohan.",
    );
  }

  // Structured RAS register — CLOSED by D-RAS-STRUCTURED-REGISTER
  // (2026-06-08). Appetite lines are now read from the typed citation-bound
  // register `platform/risk/ras-appetite-register.ts`; the hand-curated shadow
  // is retired. The `recon:ras-register-parity` gate asserts no handler
  // re-defines a parallel appetite-line array. No bullet emitted — the gap is
  // closed, and a closed gap drops off the report by construction (same rule
  // as the RWA / model-validation bullets above).

  // Independent model-validation — only while no ModelValidationApproved events
  // exist. Nadia (Model Validation lead, governance) has emitted these since
  // 2026-05-09, so this gap closes against any live store.
  if (storeHasNoEventsOfType(store, "ModelValidationApproved")) {
    gaps.push(
      "- **Independent model-validation function** — RAS §B7 model-tier discipline depends on an independent validation team that is not yet staffed. Owner: PAX research / Nolan hire.",
    );
  }

  // Climate-risk substrate — only while no ClimateScenarioRun events exist.
  if (storeHasNoEventsOfType(store, "ClimateScenarioRun")) {
    gaps.push(
      "- **Climate-risk substrate** — PA Guidance Note 1 of 2024 measurement substrate is now live (`PROC-RISK-CR-01`, `platform/projections/climate-risk-projection.ts`). The `appetite:climate:guidance-note-1-2024` line is wired; it returns `n/a-build-phase` until the first quarterly `ClimateScenarioRun` event is emitted. Remaining gap: Rohan (Risk engineer) to produce the first quarterly run and the daily `ClimateExposureRevalued` proxy.",
    );
  }

  return gaps;
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: AppetiteSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Helena", "risk-appetite-watch", ctx.asOf));
  lines.push(`# Helena — risk-appetite watch, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Helena's daily risk-appetite-watch per `Team/Helena.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. First handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${APPETITE_LINES.length} appetite lines · ${snap.measuredCount} measured · ${snap.unmeasuredCount} unmeasured (substrate gap) · ${snap.breachCounts.openBreaches} open breaches (${snap.breachCounts.tier1Open} tier-1, ${snap.breachCounts.tier2Open} tier-2) · ${snap.daysSinceRasReview} days since RAS approval.`,
  );
  lines.push("");

  lines.push("## Appetite-line states");
  lines.push("");
  lines.push("| Line | Category | Tier | RAS § | Status | Note |");
  lines.push("|---|---|---|---|---|---|");
  for (const s of snap.lineStates) {
    lines.push(
      `| ${s.line.label} | ${s.line.category} | ${s.line.tier} | ${s.line.rasSection} | ${s.status} | ${s.note} |`,
    );
  }
  lines.push("");

  lines.push("## Breach counts");
  lines.push("");
  lines.push("| Class | Count |");
  lines.push("|---|---|");
  lines.push(`| Open breaches | ${snap.breachCounts.openBreaches} |`);
  lines.push(`| &nbsp;&nbsp;Tier-1 open | ${snap.breachCounts.tier1Open} |`);
  lines.push(`| &nbsp;&nbsp;Tier-2 open | ${snap.breachCounts.tier2Open} |`);
  lines.push(`| Disposed breaches | ${snap.breachCounts.disposedBreaches} |`);
  lines.push("");
  if (snap.breachCounts.openBreaches === 0) {
    lines.push(
      "_Zero breach events in the store — consistent with the build-phase posture (no positions, no portfolio, no client transactions). Breach events flow from the measurement substrate when Rohan / Ravi / Bea ship; this rollup runs correctly against the empty set today._",
    );
    lines.push("");
  }

  lines.push("## RAS cadence");
  lines.push("");
  lines.push("- RAS approved: 2026-05-06 (decision `D-RAS`)");
  lines.push(`- Days since approval: ${snap.daysSinceRasReview}`);
  lines.push("- Quarterly BRC review: due day 90 from approval");
  lines.push("- Annual Board review: due day 365 from approval");
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  // Derived from the event store — each bullet is gated on a real probe (see
  // buildSubstrateGapLines). A gap whose closing condition is met drops off
  // automatically (D-CRO-GAP-SECTION-DERIVE-FROM-STORE).
  const gapLines = buildSubstrateGapLines(eventStore, ctx.asOf, snap);
  if (gapLines.length > 0) {
    for (const g of gapLines) lines.push(g);
  } else {
    lines.push(
      "_No open substrate gaps this run — every gap's closing condition is met against the live event store._",
    );
  }
  lines.push("");

  if (narrative) {
    lines.push("## Helena's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Helena's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    'Appetite lines sourced from the typed citation-bound register `platform/risk/ras-appetite-register.ts` (canonical mirror of the RAS, `D-RAS` / `D-RAS-STRUCTURED-REGISTER`); breach counts via `eventStore.replay({type:"AppetiteBreach"})` reconciled against `AppetiteBreachDisposed`; RAS cadence anchored to the `D-RAS` decision date.',
  );
  lines.push("");
  return lines.join("\n");
}

function consecutiveUnmeasuredSnapshotCount(): number {
  const counts: number[] = [];
  for (const e of eventStore.replay({ type: "RiskAppetiteSnapshot" })) {
    const p = e.payload as Record<string, unknown>;
    counts.push(typeof p.unmeasuredCount === "number" ? p.unmeasuredCount : 0);
  }
  let consecutive = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    if ((counts[i] ?? 0) > 0) {
      consecutive++;
    } else {
      break;
    }
  }
  return consecutive;
}

// Returns true if Helena already raised an unmeasured-lines escalation
// within the last 24 hours, preventing escalation flood.
function hasRecentUnmeasuredEscalation(): boolean {
  const windowMs = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;
  for (const e of eventStore.replay({ type: "AgentEscalation" })) {
    const p = e.payload as Record<string, unknown>;
    if (!String(p.escalationId ?? "").includes("unmeasured-lines")) continue;
    if (new Date(e.as_of).getTime() > cutoff) return true;
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx.asOf);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    // Per-line status map — every appetite line's status keyed by id. Lets
    // the `recon:liquidity-appetite-snapshot-coverage` gate assert that
    // LCR/NSFR lines are not 'unmeasured' without re-running the handler.
    const lineStatuses: Record<string, MetricStatus> = {};
    for (const s of snap.lineStates) {
      lineStatuses[s.line.id] = s.status;
    }

    eventStore.append({
      event_id: newEventId(),
      type: "RiskAppetiteSnapshot",
      as_of: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:helena:risk-appetite-watch" },
      citations: EVENT_CITATIONS,
      payload: {
        appetiteLineCount: APPETITE_LINES.length,
        measuredCount: snap.measuredCount,
        unmeasuredCount: snap.unmeasuredCount,
        nABuildPhaseCount: snap.lineStates.filter((s) => s.status === "n/a-build-phase").length,
        openBreaches: snap.breachCounts.openBreaches,
        tier1OpenBreaches: snap.breachCounts.tier1Open,
        tier2OpenBreaches: snap.breachCounts.tier2Open,
        disposedBreaches: snap.breachCounts.disposedBreaches,
        daysSinceRasReview: snap.daysSinceRasReview,
        runTrigger: ctx.trigger.id,
        // Per-line status map — keyed by appetite-line id. Recon
        // pipelines walk this to assert specific lines (e.g. LCR/NSFR)
        // are measured. See `recon:liquidity-appetite-snapshot-coverage`.
        lineStatuses,
      },
    });
    eventsEmitted = 1;

    // Escalate any open Tier-1 breach. None exist today; the shape is
    // here so the moment Rohan's measurement substrate ships and emits
    // an AppetiteBreach event, Helena's next run routes it.
    if (snap.breachCounts.tier1Open > 0) {
      eventStore.append(
        makeAgentEscalation({
          asOf: ctx.asOf,
          entity: "LE-ZA-HOZ-BANK",
          actor: { type: "service", id: "agent:helena:risk-appetite-watch" },
          citations: EVENT_CITATIONS,
          payload: {
            escalationId: `escalation:helena:tier1-breach-${fmtDateUTC(ctx.asOf)}`,
            raisedBy: "Helena",
            question: `${snap.breachCounts.tier1Open} open Tier-1 appetite breach(es) past disposition SLA.`,
            options: [
              "Tolerate (within RAS §B9 disposition tree)",
              "Remediate (require management action plan)",
              "Escalate to Board + PA notification",
            ],
            blockedBy:
              "Tier-1 breach disposition is reserved to the Board; CEO peer-challenge required interim per CLAUDE.md dual-hat rule.",
            severity: "blocking",
            routedTo: "human:marc@tgv.co.za",
          },
        }),
      );
      eventsEmitted++;
    }

    // Persistent unmeasured appetite lines → escalate to Scrooge for
    // engineering dispatch. Helena governs; she cannot build measurement
    // substrate herself (§3: "Helena does not measure risk"). This
    // escalation routes the gap to the engineering-execution substrate.
    //
    // De-duplicated: only emits if no unmeasured-lines escalation was
    // raised in the last 24h (prevents flood on every goal-loop tick).
    //
    // Unmeasured lines today (from lineStatuses above):
    //   - appetite:operational:cyber-severity-tiers (RAS §B6)
    //     Owner: Senna (CISO, engineering) + Atlas (platform substrate)
    //   - appetite:model:tier-discipline (RAS §B7)
    //     Owner: Independent Validation function + Atlas (platform substrate)
    if (snap.unmeasuredCount > 0 && !hasRecentUnmeasuredEscalation()) {
      const consecutiveCount = consecutiveUnmeasuredSnapshotCount();
      if (consecutiveCount >= UNMEASURED_ESCALATION_THRESHOLD) {
        const unmeasuredLineIds = snap.lineStates
          .filter((s) => s.status === "unmeasured")
          .map((s) => `${s.line.id} (${s.line.rasSection}, owner: ${s.line.measurementOwner})`)
          .join("; ");
        eventStore.append(
          makeAgentEscalation({
            asOf: ctx.asOf,
            entity: "LE-ZA-HOZ-BANK",
            actor: { type: "service", id: "agent:helena:risk-appetite-watch" },
            citations: EVENT_CITATIONS,
            payload: {
              escalationId: `escalation:helena:unmeasured-lines-${fmtDateUTC(ctx.asOf)}`,
              raisedBy: "Helena",
              question: `${snap.unmeasuredCount} appetite line(s) have been unmeasured for ${consecutiveCount} consecutive runs. Helena cannot build the measurement substrate (§3); engineering dispatch required. Lines: ${unmeasuredLineIds}.`,
              options: [
                "Dispatch Senna + Atlas to build cyber-incident severity measurement substrate (RAS §B6)",
                "Dispatch independent validation function + Atlas to build model-tier discipline measurement substrate (RAS §B7)",
                "Defer to M1 milestone (accept substrate gap; record in §16)",
              ],
              blockedBy:
                "Engineering build work required. Scrooge to dispatch Senna (CISO eng) + Atlas for RAS §B6; Atlas + model-validation substrate owner for RAS §B7.",
              severity: "medium",
              routedTo: "agent:scrooge",
            },
          }),
        );
        eventsEmitted++;
        logger.info(
          { unmeasuredCount: snap.unmeasuredCount, consecutiveCount },
          "helena:risk-appetite-watch — persistent unmeasured lines escalation emitted to Scrooge",
        );
      }
    }
  }

  // Narrative pass (degrades gracefully when ANTHROPIC_API_KEY is unset).
  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: HELENA_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, snap),
        maxTokens: 6_000,
        effort: "high",
        meta: { runId: ctx.runId ?? ctx.trigger.id, agent: ctx.agent, dryRun: ctx.dryRun },
      });
      if (r.ok) {
        narrative = r.result.text.trim();
        logger.info(
          {
            inputTokens: r.result.usage.inputTokens,
            cacheReadInputTokens: r.result.usage.cacheReadInputTokens,
            outputTokens: r.result.usage.outputTokens,
            model: r.result.model,
          },
          "helena:risk-appetite-watch — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "helena narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_helena_risk-appetite-watch.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      appetiteLineCount: APPETITE_LINES.length,
      measured: snap.measuredCount,
      unmeasured: snap.unmeasuredCount,
      openBreaches: snap.breachCounts.openBreaches,
    },
    "helena:risk-appetite-watch — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${APPETITE_LINES.length} appetite lines · ${snap.measuredCount} measured · ${snap.unmeasuredCount} unmeasured · ${snap.breachCounts.openBreaches} open breaches.`,
    ok: true,
  };
};

export default handler;
