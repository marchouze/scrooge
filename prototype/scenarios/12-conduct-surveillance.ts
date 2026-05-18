// scenarios/12-conduct-surveillance.ts
//
// M3 Slice 9 — Counterparty conduct surveillance scenario seed.
//
// Demonstrates the full ConductEventRecorded lifecycle:
//   T0  ConductEventRecorded (best-execution-failure, flag-raised)
//   T1  ConductEventRecorded (front-running-flag, flag-raised)
//   T2  ConductEventRecorded (wash-trade-flag, under-investigation)
//   T3  ConductEventRecorded (market-manipulation-alert, flag-raised)
//   T4  ConductEventRecorded (best-execution-failure, under-investigation)
//   T5  ConductEventRecorded (front-running-flag, resolved)
//   T6  ConductEventRecorded (wash-trade-flag, escalated)
//
// Together these events:
//   - Exercise all four mandatory categories.
//   - Exercise all four mandatory lifecycle statuses.
//   - Satisfy the `recon:conduct-surveillance-coverage` gate.
//
// Authority:
//   D-MARKET-CONDUCT — market conduct surveillance framework
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN — M3 Slice 9 build plan
//   Financial Markets Act 19 of 2012 §§78–82 (market abuse prohibitions)
//   FSRA §131 (FSCA conduct mandate)
//   FAIS Act 37/2002 §§16–17 (best execution obligation)
//
// Run: `bun run scenario:conduct-surveillance`
//
// Authors:
//   Atlas (Principal Software Engineer, engineering) — scenario wiring
//   Mira (Compliance / RegTech engineer, engineering) — conduct obligation chain

import { unlinkSync } from "node:fs";

import { BANK_ZA_001, newEventId } from "@platform/core/types";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import { makeConductEventRecorded } from "@platform/event-store/event-types/conduct";
import { logger } from "@platform/observability/logger";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

export const SCENARIO_ID = "conduct-surveillance-m3-slice9";
export const SOURCE_LINEAGE = "scenario-runner:12-conduct-surveillance";
export const ENTITY = BANK_ZA_001;

// Synthetic institutional counterparties — designed to exercise the
// conduct surveillance system only. Not live counterparties.
export const COUNTERPARTY_A = "CP-SYN-CONDUCT-001";
export const COUNTERPARTY_B = "CP-SYN-CONDUCT-002";

// Scenario clock: 2026-05-18
const BASE_TIMESTAMP = "2026-05-18T08:00:00.000Z";

// Surveillance model identifiers
const SPREAD_MONITOR = "spread-monitor-v1";
const PATTERN_MATCHER = "pattern-matcher-v2";
const MANUAL_REVIEW = "manual-review";

// ---------------------------------------------------------------------------
// Provenance tag — all events in this scenario carry this exact tag.
// ---------------------------------------------------------------------------

export const SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

// ---------------------------------------------------------------------------
// Actor
// ---------------------------------------------------------------------------

const MIRA_ACTOR = { type: "service" as const, id: "agent:mira:conduct-surveillance" };

// ---------------------------------------------------------------------------
// Shared citations — minimum set per Principle 2 upward chain.
// ---------------------------------------------------------------------------

const CONDUCT_CITATIONS = [
  "D-MARKET-CONDUCT",
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "FINANCIAL-MARKETS-ACT-19-2012-S78",
  "FSRA-S131",
];

// ---------------------------------------------------------------------------
// Event builders — pure, return Event; no I/O.
// ---------------------------------------------------------------------------

/**
 * T0 — Best-execution failure flag raised against Counterparty A.
 * Spread-monitor detected execution rate 25 bps above reference on ZAR bond trade.
 * Status: flag-raised (initial observation).
 */
function buildBestExecutionFlag(asOf: string): Event {
  const base = makeConductEventRecorded({
    asOf,
    entity: ENTITY,
    actor: MIRA_ACTOR,
    citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S16"],
    eventId: newEventId(),
    payload: {
      observationId: "CER-2026-05-001",
      observedAt: asOf,
      category: "best-execution-failure",
      status: "flag-raised",
      counterpartyId: COUNTERPARTY_A,
      severity: "warning",
      tradeIds: ["TRD-BOND-2026-0501", "TRD-BOND-2026-0502"],
      description:
        "Spread-monitor detected execution rate 25 bps above reference rate on " +
        "ZA-GOV-BOND trades for counterparty CP-SYN-CONDUCT-001. " +
        "Tolerance: 5 bps. Breach ratio: 2/2 trades in review window. " +
        "Automatic escalation review pending.",
      escalatedToMlro: false,
      sourceModel: SPREAD_MONITOR,
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T1 — Front-running flag raised against Counterparty B.
 * Pattern-matcher detected trading-ahead-of-client-order pattern.
 * Status: flag-raised (initial observation).
 */
function buildFrontRunningFlag(asOf: string): Event {
  const base = makeConductEventRecorded({
    asOf,
    entity: ENTITY,
    actor: MIRA_ACTOR,
    citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S17"],
    eventId: newEventId(),
    payload: {
      observationId: "CER-2026-05-002",
      observedAt: asOf,
      category: "front-running-flag",
      status: "flag-raised",
      counterpartyId: COUNTERPARTY_B,
      severity: "critical",
      tradeIds: ["TRD-EQ-2026-0301"],
      description:
        "Pattern-matcher detected potential front-running: counterparty CP-SYN-CONDUCT-002 " +
        "placed large buy order in JSE equity 90 seconds before a significant client order " +
        "was executed. Price impact: +1.2%. Pattern flagged per FMA §78 market-abuse criteria.",
      escalatedToMlro: true,
      sourceModel: PATTERN_MATCHER,
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T2 — Wash-trade flag under investigation.
 * Self-matched trades suspected to create false liquidity in ZAR IRS.
 * Status: under-investigation (complaint opened, review in progress).
 */
function buildWashTradeFlag(asOf: string): Event {
  const base = makeConductEventRecorded({
    asOf,
    entity: ENTITY,
    actor: MIRA_ACTOR,
    citations: CONDUCT_CITATIONS,
    eventId: newEventId(),
    payload: {
      observationId: "CER-2026-05-003",
      observedAt: asOf,
      category: "wash-trade-flag",
      status: "under-investigation",
      counterpartyId: COUNTERPARTY_A,
      severity: "critical",
      tradeIds: ["TRD-IRS-2026-0101", "TRD-IRS-2026-0102", "TRD-IRS-2026-0103"],
      description:
        "Manual review identified potential wash-trading in ZAR interest-rate swaps: " +
        "3 trades (TRD-IRS-2026-0101/02/03) appear to be self-matched (same notional, " +
        "opposite directions, zero net economic effect) within a 30-minute window. " +
        "Internal investigation opened. FSCA notification under review.",
      escalatedToMlro: true,
      sourceModel: MANUAL_REVIEW,
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T3 — Market-manipulation alert raised.
 * Benchmark distortion pattern detected in JSE equity reference price.
 * Status: flag-raised (initial alert from surveillance model).
 */
function buildMarketManipulationAlert(asOf: string): Event {
  const base = makeConductEventRecorded({
    asOf,
    entity: ENTITY,
    actor: MIRA_ACTOR,
    citations: [...CONDUCT_CITATIONS, "FINANCIAL-MARKETS-ACT-19-2012-S80"],
    eventId: newEventId(),
    payload: {
      observationId: "CER-2026-05-004",
      observedAt: asOf,
      category: "market-manipulation-alert",
      status: "flag-raised",
      counterpartyId: COUNTERPARTY_B,
      severity: "critical",
      tradeIds: ["TRD-EQ-2026-0401", "TRD-EQ-2026-0402"],
      description:
        "Surveillance model detected potential benchmark-manipulation pattern: " +
        "a sequence of large orders placed and cancelled near JSE close " +
        "may have influenced the volume-weighted average price (VWAP) reference. " +
        "Pattern consistent with FMA §80 benchmark-distortion prohibition. " +
        "Escalated to Mira for regulatory assessment.",
      escalatedToMlro: false,
      sourceModel: PATTERN_MATCHER,
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T4 — Best-execution failure under investigation (lifecycle progression of CER-2026-05-001).
 * Investigation opened; additional trades identified.
 */
function buildBestExecutionUnderInvestigation(asOf: string): Event {
  const base = makeConductEventRecorded({
    asOf,
    entity: ENTITY,
    actor: MIRA_ACTOR,
    citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S16"],
    eventId: newEventId(),
    payload: {
      observationId: "CER-2026-05-005",
      observedAt: asOf,
      category: "best-execution-failure",
      status: "under-investigation",
      counterpartyId: COUNTERPARTY_A,
      severity: "warning",
      tradeIds: ["TRD-BOND-2026-0501", "TRD-BOND-2026-0502", "TRD-BOND-2026-0503"],
      description:
        "Extended review of CER-2026-05-001: 3rd trade identified with execution spread " +
        "22 bps above reference. Total breach count: 3/3 trades reviewed. " +
        "Investigation expanded to cover prior 30-day window. " +
        "Counterparty notification draft in progress.",
      escalatedToMlro: false,
      sourceModel: SPREAD_MONITOR,
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T5 — Front-running investigation resolved (lifecycle close of CER-2026-05-002).
 * Investigation concluded: alert was a false positive.
 */
function buildFrontRunningResolved(asOf: string): Event {
  const base = makeConductEventRecorded({
    asOf,
    entity: ENTITY,
    actor: MIRA_ACTOR,
    citations: [...CONDUCT_CITATIONS, "FAIS-ACT-37-2002-S17"],
    eventId: newEventId(),
    payload: {
      observationId: "CER-2026-05-006",
      observedAt: asOf,
      category: "front-running-flag",
      status: "resolved",
      counterpartyId: COUNTERPARTY_B,
      severity: "advisory",
      tradeIds: ["TRD-EQ-2026-0301"],
      description:
        "Investigation of CER-2026-05-002 concluded: front-running flag was a false positive. " +
        "The counterparty's order was placed on a separate market information feed " +
        "with a documented 90-second latency differential; no causal link to the " +
        "client order timing was established. Alert closed. No regulatory notification required.",
      escalatedToMlro: false,
      sourceModel: MANUAL_REVIEW,
      closedAt: asOf,
      resolutionSummary:
        "False positive — order timing attributable to documented market-data latency. " +
        "No FMA §78 breach. CER-2026-05-002 closed with no action.",
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

/**
 * T6 — Wash-trade case escalated to FSCA (lifecycle close of CER-2026-05-003).
 * Investigation confirmed; FSCA notification filed.
 */
function buildWashTradeEscalated(asOf: string): Event {
  const base = makeConductEventRecorded({
    asOf,
    entity: ENTITY,
    actor: MIRA_ACTOR,
    citations: [...CONDUCT_CITATIONS, "FIC-ACT-38-2001-S29"],
    eventId: newEventId(),
    payload: {
      observationId: "CER-2026-05-007",
      observedAt: asOf,
      category: "wash-trade-flag",
      status: "escalated",
      counterpartyId: COUNTERPARTY_A,
      severity: "critical",
      tradeIds: ["TRD-IRS-2026-0101", "TRD-IRS-2026-0102", "TRD-IRS-2026-0103"],
      description:
        "Investigation of CER-2026-05-003 confirmed: wash-trading pattern in ZAR IRS. " +
        "Three self-matched trades confirmed by order-management system audit log. " +
        "MLRO assessment: conduct constitutes a suspicious transaction reportable under " +
        "FIC Act §29. FSCA and FIC notifications filed. " +
        "Counterparty relationship review initiated.",
      escalatedToMlro: true,
      sourceModel: MANUAL_REVIEW,
      closedAt: asOf,
      resolutionSummary:
        "Wash-trading confirmed. STR filed with FIC per FIC Act §29. " +
        "FSCA notification filed per FSRA §131. " +
        "Counterparty account under restriction pending further review.",
    },
  });
  return { ...base, provenance: SCENARIO_PROVENANCE };
}

// ---------------------------------------------------------------------------
// Scenario builder — pure, returns the ordered event list.
// ---------------------------------------------------------------------------

export interface ConductSurveillanceScenarioEvents {
  readonly bestExecutionFlag: Event;
  readonly frontRunningFlag: Event;
  readonly washTradeFlag: Event;
  readonly marketManipulationAlert: Event;
  readonly bestExecutionUnderInvestigation: Event;
  readonly frontRunningResolved: Event;
  readonly washTradeEscalated: Event;
  readonly all: ReadonlyArray<Event>;
}

export function buildConductSurveillanceScenarioEvents(): ConductSurveillanceScenarioEvents {
  // Timestamps advance by 10 minutes per event to model a realistic
  // surveillance sweep cycle.
  const t0 = "2026-05-18T08:00:00.000Z";
  const t1 = "2026-05-18T08:10:00.000Z";
  const t2 = "2026-05-18T08:20:00.000Z";
  const t3 = "2026-05-18T08:30:00.000Z";
  const t4 = "2026-05-18T09:00:00.000Z";
  const t5 = "2026-05-18T10:00:00.000Z";
  const t6 = "2026-05-18T11:00:00.000Z";

  const bestExecutionFlag = buildBestExecutionFlag(t0);
  const frontRunningFlag = buildFrontRunningFlag(t1);
  const washTradeFlag = buildWashTradeFlag(t2);
  const marketManipulationAlert = buildMarketManipulationAlert(t3);
  const bestExecutionUnderInvestigation = buildBestExecutionUnderInvestigation(t4);
  const frontRunningResolved = buildFrontRunningResolved(t5);
  const washTradeEscalated = buildWashTradeEscalated(t6);

  return {
    bestExecutionFlag,
    frontRunningFlag,
    washTradeFlag,
    marketManipulationAlert,
    bestExecutionUnderInvestigation,
    frontRunningResolved,
    washTradeEscalated,
    all: [
      bestExecutionFlag,
      frontRunningFlag,
      washTradeFlag,
      marketManipulationAlert,
      bestExecutionUnderInvestigation,
      frontRunningResolved,
      washTradeEscalated,
    ],
  };
}

// ---------------------------------------------------------------------------
// Runner — invoked by `bun run scenario:conduct-surveillance`.
// ---------------------------------------------------------------------------

export interface ConductSurveillanceScenarioResult {
  readonly ok: boolean;
  readonly emitted: number;
  readonly countsByType: Record<string, number>;
  readonly categoriesCovered: string[];
  readonly statusesCovered: string[];
}

export function runConductSurveillanceScenario(opts: {
  dbPath: string;
  cleanup: boolean;
}): ConductSurveillanceScenarioResult {
  const events = buildConductSurveillanceScenarioEvents();

  // Wipe and recreate per-run so the script is deterministic on repeat.
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run or already clean */
  }

  const store = new EventStore(opts.dbPath);
  store.appendAll([...events.all]);

  const total = store.count();

  // Verify provenance — all events must carry the scenario tag.
  let provenanceOk = true;
  for (const e of store.replay({ entity: ENTITY })) {
    if (e.provenance?.kind !== "simulated" || e.provenance.scenario !== SCENARIO_ID) {
      provenanceOk = false;
      break;
    }
  }

  // Collect categories and statuses covered.
  const categoriesPresent = new Set<string>();
  const statusesPresent = new Set<string>();
  const countsByType: Record<string, number> = {};

  for (const e of events.all) {
    countsByType[e.type] = (countsByType[e.type] ?? 0) + 1;
    const p = e.payload as { category?: string; status?: string };
    if (p.category) categoriesPresent.add(p.category);
    if (p.status) statusesPresent.add(p.status);
  }

  store.close();
  if (opts.cleanup) {
    try {
      unlinkSync(opts.dbPath);
    } catch {
      /* nothing to clean */
    }
  }

  return {
    ok: provenanceOk && total === events.all.length,
    emitted: total,
    countsByType,
    categoriesCovered: [...categoriesPresent].sort(),
    statusesCovered: [...statusesPresent].sort(),
  };
}

// ---------------------------------------------------------------------------
// Top-level invocation — gated on import.meta.main.
// ---------------------------------------------------------------------------

if (import.meta.main) {
  logger.info(
    {
      scenario: SCENARIO_ID,
      sourceLineage: SOURCE_LINEAGE,
      baseTimestamp: BASE_TIMESTAMP,
    },
    "scenario 12 — Conduct Surveillance — starting",
  );

  const result = runConductSurveillanceScenario({
    dbPath: ".local/scenario-conduct-surveillance.db",
    cleanup: true,
  });

  logger.info(
    {
      ok: result.ok,
      emitted: result.emitted,
      countsByType: result.countsByType,
      categoriesCovered: result.categoriesCovered,
      statusesCovered: result.statusesCovered,
      authority: [
        "D-MARKET-CONDUCT",
        "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
        "FINANCIAL-MARKETS-ACT-19-2012-S78",
        "FSRA-S131",
      ],
      substrateGaps: [
        "ConductEventRecorded does not yet trigger automated FSCA notification workflow (D-FSCA-NOTIFICATION-SUBSTRATE)",
        "MLRO escalation channel not yet wired to FIC-Act-STR-filing substrate",
        "Conduct surveillance register projection not yet surfaced on dashboard",
      ],
    },
    result.ok
      ? "scenario 12 — Conduct Surveillance — PASSED"
      : "scenario 12 — Conduct Surveillance — FAILED",
  );

  process.exit(result.ok ? 0 : 1);
}
