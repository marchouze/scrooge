// dashboard/v2-world-simulator-view.ts
//
// V2 boundary DTO builder for the "Outside World Simulator" read-surface
// (`GET /api/v2/markets/world-simulator`). This is the read-side window onto the
// FX V2 simulator-first model (platform/simulation-v2/): it makes the SIMULATED
// OUTSIDE WORLD and the binding simulator↔SUT boundary visible to the human
// overseer. There are NO control actions in v1 — the simulator is driven by the
// declarative scenario runner, not by buttons (re-run / advance-clock is a v1.1
// deferral, recorded as a tracked deferred-gap below, NOT built).
//
// Four read sections, every value sourced from the live simulator substrate (no
// hardcoded scenario constants in the page):
//
//   1. SCENARIO — the active declarative manifest (scenario-manifest.ts shape):
//      id, seed, baseline instant, EOD hour, day count, counterparties, the
//      market-observation path. The manifest is the simulator's whole input.
//   2. EOD TIMELINE — the deterministic FiredHookRecord[] log from the run's
//      EodTriggerBus (eod-bus.ts): which SUT cadence hooks fired at each
//      end-of-day boundary, in deterministic priority order.
//   3. BOUNDARY ATTESTATION (load-bearing — the page's reason to exist) —
//      green/red derived live from `recon:fx-v2-sim-boundary`
//      (platform/recon/fx-v2-sim-boundary.ts): the binding invariant that the
//      simulator emits ONLY external `simulated`-tagged stimuli and the SUT emits
//      ONLY internal events (replay-safety: no Math.random / Date.now / new Date()).
//   4. RUN RESULT — the last ScenarioRunResult (scenario-runner.ts): boundaries
//      fired, trades generated, FIL cohort size, MtM / VaR / SA-CCR outputs
//      materialised by the SUT over the simulated cohort.
//
// NAME-FREE (D-V2-UI-OVERSIGHT-STANDARD; feedback_no_agent_names_in_ui): the
// simulator surface carries counterparty party-ids + the FX-desk seat Title only.
// The owning seat is routed through `seatTitle()` so a persona name can never leak
// into a /api/v2 response. Counterparty ids (CP-SIM-…) are simulated identities,
// not agent names.
//
// V2-ONLY (CLAUDE.md "V1 retirement"): this is new read-side code. It imports only
// the V2 simulator substrate (platform/simulation-v2/) + the V2 FX SUT engines it
// drives (cohort P&L V2, cohort VaR V2, cohort SA-CCR EAD V2) + the boundary recon.
// It emits no events and widens no v1-only estate.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20). Downstream read
// surface under the no-pause rule. Principle 1 (the run is a deterministic replay,
// not stored state); Principle 2 (the boundary is a topology invariant surfaced here).
// Author: Atlas (Core banking platform architect, engineering).

import { formatInstanceUrn } from "../v2-core/fil-core/urn";
import { computeCohortVar } from "../platform/market-risk/eod-cohort-var-v2";
import { provisionCounterparty } from "../platform/markets/counterparty/provision-counterparty";
import { bookAffirmedFxTrade } from "../platform/markets/products/book-affirmed-fx-trade";
import { settleFxLeg } from "../platform/markets/settlement/settle-fx-leg";
import { computeCohortPnL } from "../platform/product-control/eod-cohort-pnl-v2";
import { run as runBoundaryRecon } from "../platform/recon/fx-v2-sim-boundary";
import { computeAndEmitCohortSaCcrEad } from "../platform/risk/sa-ccr/eod-saccr-ead-v2";
import type { EodHook } from "../platform/simulation-v2/eod-bus";
import type {
  ScenarioDay,
  ScenarioManifest,
  ScenarioMarketObservation,
} from "../platform/simulation-v2/scenario-manifest";
import { runScenario } from "../platform/simulation-v2/scenario-runner";
import { emitCounterpartyProvisioning } from "../platform/simulation-v2/sim-modules/counterparty-provisioning";
import {
  emitSimulatedMarketFeed,
  ingestMarketFeed,
} from "../platform/simulation-v2/sim-modules/market-data-feed-v2";
import { emitSettlementLifecycle } from "../platform/simulation-v2/sim-modules/settlement-lifecycle";
import { emitCounterpartyConfirmation } from "../platform/simulation-v2/sim-modules/trade-confirmation";
import { seatTitle } from "./agent-title";

const REPORTING = "ZAR";
const TENANT = "LE-ZA-HOZ-BANK";
const N_DAYS = 25;
const SPOT_TRADE_ID = "T-SPOT-USD-001";
const SETTLEMENT_DATE = "2026-02-04";

// ---------------------------------------------------------------------------
// The canonical declarative scenario — the SAME deterministic Phase-1 USD/ZAR
// scenario the enforcing recon:fx-v2-sim-oracle replays. Built as data (no
// hardcoding in the page — the page reads whatever this builder returns).
// ---------------------------------------------------------------------------

/** Deterministic 25-day USD/ZAR zig-zag scenario (one risk factor). */
function buildManifest(): ScenarioManifest {
  const days: ScenarioDay[] = [];
  for (let i = 0; i < N_DAYS; i++) {
    const date = `2026-02-${String(i + 2).padStart(2, "0")}`;
    const spot = 18.5 + (i % 2 === 0 ? 0.1 : -0.1);
    const market: ScenarioMarketObservation[] = [
      { pair: "USD/ZAR", spotMid: spot, forwardPoints: 0.05 },
    ];
    days.push(
      i === 0
        ? {
            date,
            market,
            trades: [
              {
                tradeId: SPOT_TRADE_ID,
                counterpartyId: "CP-SIM-RELIABLE-001",
                productTaxonomy: "FX-spot",
                pair: "USD/ZAR",
                side: "buy",
                baseNotionalMajor: 5_000_000,
                rate: 18.5,
                settlementDate: SETTLEMENT_DATE,
              },
            ],
          }
        : { date, market },
    );
  }
  return {
    scenarioId: "fx-v2-world-simulator",
    description:
      "FX V2 simulator-first Phase-1 USD/ZAR scenario: provision a counterparty + ISDA/CSA, " +
      "book a spot, drive a 25-day deterministic market path, fire EOD reval / P&L / VaR / SA-CCR " +
      "cadence hooks, settle (incl. a forced fail-then-retry) so the cash leg materialises.",
    seed: 0x0_7ac1e,
    baselineInstant: "2026-02-02T07:00:00.000Z",
    eodHourUtc: 17,
    defaultOisRate: 0.07,
    counterparties: [
      {
        counterpartyId: "CP-SIM-RELIABLE-001",
        name: "Sim Reliable Bank",
        bic: "SIMRZAJJXXX",
        eligiblePairs: ["USD/ZAR"],
        behaviourProfile: "occasional-fail",
        agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
      },
    ],
    days,
  };
}

// ---------------------------------------------------------------------------
// DTO shapes — name-free, JSON-serialisable.
// ---------------------------------------------------------------------------

export interface SimScenarioCounterpartyDto {
  readonly counterpartyId: string;
  readonly bic: string;
  readonly eligiblePairs: readonly string[];
  readonly behaviourProfile: string;
  readonly agreementType: string | null;
  readonly csaInScope: boolean;
}

export interface SimMarketObservationDto {
  readonly date: string;
  readonly pair: string;
  readonly spotMid: number;
  readonly forwardPoints: number | null;
}

export interface SimScenarioDto {
  readonly scenarioId: string;
  readonly description: string;
  readonly seed: number;
  /** Seed rendered as 0x-hex for the deterministic-PRNG provenance line. */
  readonly seedHex: string;
  readonly baselineInstant: string;
  readonly eodHourUtc: number;
  readonly dayCount: number;
  readonly counterparties: readonly SimScenarioCounterpartyDto[];
  /** The full declared market-observation path (one row per pair per day). */
  readonly marketPath: readonly SimMarketObservationDto[];
}

export interface SimEodTimelineRowDto {
  readonly boundaryInstant: string;
  readonly reportDate: string;
  readonly hookId: string;
  readonly priority: number;
  readonly boundaryIndex: number;
}

export interface SimEodTimelineDto {
  readonly boundariesFired: number;
  readonly finalInstant: string;
  /** Distinct SUT cadence hook ids registered on the bus. */
  readonly hookIds: readonly string[];
  readonly rows: readonly SimEodTimelineRowDto[];
}

export interface SimBoundaryAttestationDto {
  /** true ⇒ the simulator↔SUT boundary invariant holds on the live source tree. */
  readonly ok: boolean;
  readonly statusLabel: "green" | "red";
  readonly asserted: number;
  readonly failCount: number;
  readonly violations: readonly { subject: string; message: string; severity: string }[];
  /** Plain-English statement of what the green/red verdict means. */
  readonly invariant: string;
}

export interface SimRunResultDto {
  readonly scenarioId: string;
  readonly boundariesFired: number;
  readonly finalInstant: string;
  /** FX trades the simulator drove into the SUT (booked FIL FX instruments). */
  readonly tradesGenerated: number;
  /** Total FIL cohort size (every FilInstrumentCreated — FX legs + materialised cash). */
  readonly filCohortSize: number;
  /** Materialised settled-cash FIL instruments (fil:type:cash). */
  readonly cashLegsMaterialised: number;
  /** FX instruments terminated (settled). */
  readonly fxTerminated: number;
  /** Settlement failures the M5 fail-branch emitted (fail-then-retry exercised). */
  readonly settlementFailures: number;
  /** Day-1 cohort daily P&L V2 (MtM, reporting major units) — null if not computed. */
  readonly dailyPnlReporting: number | null;
  /** Late-day cohort VaR V2 (reporting major units) — null unless status="computed". */
  readonly varReporting: number | null;
  readonly svarReporting: number | null;
  readonly esReporting: number | null;
  readonly varStatus: string;
  /** Day-1 cohort SA-CCR EAD (minor units) for the open FX netting set — null if absent. */
  readonly saccrEadMinor: number | null;
  readonly saccrRcMinor: number | null;
  readonly reporting: string;
}

export interface V2WorldSimulatorView {
  readonly scenario: SimScenarioDto;
  readonly eodTimeline: SimEodTimelineDto;
  readonly boundaryAttestation: SimBoundaryAttestationDto;
  readonly runResult: SimRunResultDto;
  /** The autonomous seat that owns the FX book — by Title only (name-free). */
  readonly deskOwnerSeatTitle: string;
  /**
   * Tracked deferred gap (v1.1): control actions (re-run scenario, advance the
   * clock, pick a different manifest) are NOT built in v1 — the surface is
   * read-only. Surfaced honestly so the absence is self-explaining, never silent.
   */
  readonly deferredGap: string;
  readonly asOf: string;
}

// ---------------------------------------------------------------------------
// Scenario replay — run the manifest end-to-end exactly as the oracle does,
// capturing the SUT cohort figures via cadence hooks.
// ---------------------------------------------------------------------------

interface CapturedFigures {
  pnlDay1: ReturnType<typeof computeCohortPnL> | undefined;
  varLate: ReturnType<typeof computeCohortVar> | undefined;
  saccrDay1: ReturnType<typeof computeAndEmitCohortSaCcrEad> | undefined;
}

function replayScenario(manifest: ScenarioManifest): {
  readonly result: ReturnType<typeof runScenario>;
  readonly figures: CapturedFigures;
} {
  const bookedRateByInstance = new Map<string, number>([
    [formatInstanceUrn({ tenant: TENANT, instanceId: SPOT_TRADE_ID }), 18.5],
  ]);
  const figures: CapturedFigures = {
    pnlDay1: undefined,
    varLate: undefined,
    saccrDay1: undefined,
  };

  const result = runScenario(manifest, {
    provisioningDrivers: [
      ({ eventStore, clock, manifest: m }) => {
        for (const cp of m.counterparties) {
          emitCounterpartyProvisioning({
            store: eventStore,
            scenarioId: m.scenarioId,
            asOf: clock.now(),
            counterparty: cp,
            reporting: REPORTING,
          });
          provisionCounterparty({
            store: eventStore,
            scenarioId: m.scenarioId,
            asOf: clock.now(),
            reporting: REPORTING,
            counterparty: cp,
          });
        }
      },
    ],
    dayDrivers: [
      ({ day, marketDataStore, manifest: m, clock }) => {
        emitSimulatedMarketFeed({ day, marketDataStore, manifest: m, asOf: clock.now() });
        ingestMarketFeed({ day, marketDataStore, manifest: m, asOf: clock.now() });
      },
      ({ day, eventStore, clock, manifest: m, rng }) => {
        for (const trade of day.trades ?? []) {
          emitCounterpartyConfirmation({
            store: eventStore,
            scenarioId: m.scenarioId,
            asOf: clock.now(),
            trade,
            affirm: true,
          });
          bookAffirmedFxTrade({
            store: eventStore,
            scenarioId: m.scenarioId,
            asOf: clock.now(),
            reporting: REPORTING,
            trade,
          });
        }
        if (day.date === SETTLEMENT_DATE) {
          const spot = m.days[0]?.trades?.[0];
          if (spot) {
            emitSettlementLifecycle({
              store: eventStore,
              scenarioId: m.scenarioId,
              asOf: clock.now(),
              reporting: REPORTING,
              trade: spot,
              behaviourProfile: "occasional-fail",
              rng,
              forceFirstFail: true,
            });
            settleFxLeg({
              store: eventStore,
              scenarioId: m.scenarioId,
              reporting: REPORTING,
              tradeId: spot.tradeId,
            });
          }
        }
      },
    ],
    cadenceHooks: ({ eventStore, marketDataStore }): readonly EodHook[] => [
      {
        id: "world-sim-pnl",
        cadence: "end-of-day",
        priority: 20,
        run: (ctx) => {
          if (ctx.reportDate === "2026-02-02") {
            figures.pnlDay1 = computeCohortPnL({
              eventStore,
              marketDataStore,
              reporting: REPORTING,
              reportDate: ctx.reportDate,
              bookedRateByInstance,
            });
          }
        },
      },
      {
        id: "world-sim-var",
        cadence: "end-of-day",
        priority: 30,
        run: (ctx) => {
          if (ctx.reportDate === `2026-02-${String(N_DAYS + 1).padStart(2, "0")}`) {
            figures.varLate = computeCohortVar({
              eventStore,
              marketDataStore,
              reporting: REPORTING,
              reportDate: ctx.reportDate,
              asOf: ctx.boundaryInstant,
            });
          }
        },
      },
      {
        id: "world-sim-saccr-ead",
        cadence: "end-of-day",
        priority: 35,
        run: (ctx) => {
          if (ctx.reportDate === "2026-02-02") {
            figures.saccrDay1 = computeAndEmitCohortSaCcrEad({
              eventStore,
              marketDataStore,
              reporting: REPORTING,
              reportDate: ctx.reportDate,
              asOf: ctx.boundaryInstant,
              bookedRateByInstance,
            });
          }
        },
      },
    ],
  });

  return { result, figures };
}

// ---------------------------------------------------------------------------
// Section builders.
// ---------------------------------------------------------------------------

function buildScenarioDto(manifest: ScenarioManifest): SimScenarioDto {
  const counterparties: SimScenarioCounterpartyDto[] = manifest.counterparties.map((cp) => ({
    counterpartyId: cp.counterpartyId,
    bic: cp.bic,
    eligiblePairs: [...cp.eligiblePairs],
    behaviourProfile: cp.behaviourProfile,
    agreementType: cp.agreement?.agreementType ?? null,
    csaInScope: cp.agreement?.csaInScope ?? false,
  }));
  const marketPath: SimMarketObservationDto[] = [];
  for (const day of manifest.days) {
    for (const obs of day.market) {
      marketPath.push({
        date: day.date,
        pair: obs.pair,
        spotMid: obs.spotMid,
        forwardPoints: obs.forwardPoints ?? null,
      });
    }
  }
  return {
    scenarioId: manifest.scenarioId,
    description: manifest.description,
    seed: manifest.seed,
    seedHex: `0x${manifest.seed.toString(16)}`,
    baselineInstant: manifest.baselineInstant,
    eodHourUtc: manifest.eodHourUtc ?? 17,
    dayCount: manifest.days.length,
    counterparties,
    marketPath,
  };
}

function buildEodTimelineDto(result: ReturnType<typeof runScenario>): SimEodTimelineDto {
  const rows: SimEodTimelineRowDto[] = result.firedHooks.map((r) => ({
    boundaryInstant: r.boundaryInstant,
    reportDate: r.reportDate,
    hookId: r.hookId,
    priority: r.priority,
    boundaryIndex: r.boundaryIndex,
  }));
  const hookIds = [...new Set(rows.map((r) => r.hookId))];
  return {
    boundariesFired: result.boundariesFired,
    finalInstant: result.finalInstant,
    hookIds,
    rows,
  };
}

function buildBoundaryAttestationDto(): SimBoundaryAttestationDto {
  const recon = runBoundaryRecon();
  const fails = recon.violations.filter((v) => v.severity === "fail");
  return {
    ok: recon.ok,
    statusLabel: recon.ok ? "green" : "red",
    asserted: recon.asserted,
    failCount: fails.length,
    violations: recon.violations.map((v) => ({
      subject: v.subject,
      message: v.message,
      severity: v.severity,
    })),
    invariant:
      "The simulator emits ONLY external-party stimuli (market rates, confirmations, " +
      "settlement statuses, credit ratings, margin responses) tagged `simulated`; the bank's " +
      "V2 capability (the System Under Test) emits ONLY internal events and never reaches into " +
      "the simulator. The simulator package is replay-safe (no Math.random / Date.now / new Date()). " +
      "Authority: recon:fx-v2-sim-boundary; D-FX-V2-SIMULATOR-FIRST.",
  };
}

function buildRunResultDto(
  manifest: ScenarioManifest,
  result: ReturnType<typeof runScenario>,
  figures: CapturedFigures,
): SimRunResultDto {
  const created = [...result.eventStore.replay({ type: "FilInstrumentCreated" })];
  const cash = created.filter(
    (e) =>
      ((e.payload as { economicTerms?: { assetClass?: string } }).economicTerms?.assetClass ?? "") ===
      "cash",
  );
  const fxBooked = created.filter(
    (e) =>
      ((e.payload as { economicTerms?: { assetClass?: string } }).economicTerms?.assetClass ?? "") ===
      "fx",
  );
  const terminated = [...result.eventStore.replay({ type: "FilInstrumentTerminated" })];
  const fails = [...result.eventStore.replay({ type: "FxSimSettlementFailed" })];

  const pnl = figures.pnlDay1;
  const dailyPnlReporting = pnl ? pnl.totalUnrealisedReporting : null;

  const v = figures.varLate;
  const varComputed = v?.status === "computed";

  const ns = "NS-CP-SIM-RELIABLE-001-ZAR";
  const saccrFig = figures.saccrDay1?.figures.get(ns);

  return {
    scenarioId: manifest.scenarioId,
    boundariesFired: result.boundariesFired,
    finalInstant: result.finalInstant,
    tradesGenerated: fxBooked.length,
    filCohortSize: created.length,
    cashLegsMaterialised: cash.length,
    fxTerminated: terminated.length,
    settlementFailures: fails.length,
    dailyPnlReporting,
    varReporting: varComputed ? v.varReporting : null,
    svarReporting: varComputed ? v.svarReporting : null,
    esReporting: varComputed ? v.esReporting : null,
    varStatus: v?.status ?? "absent",
    saccrEadMinor: saccrFig ? saccrFig.ead : null,
    saccrRcMinor: saccrFig ? saccrFig.rc : null,
    reporting: REPORTING,
  };
}

// ---------------------------------------------------------------------------
// Top-level builder — one pass: build the manifest, replay it, assemble the
// four sections. The caller (server route) echoes pageProvenance.
// ---------------------------------------------------------------------------

export function buildV2WorldSimulatorView(nowIso: string): V2WorldSimulatorView {
  const manifest = buildManifest();
  const scenario = buildScenarioDto(manifest);
  const boundaryAttestation = buildBoundaryAttestationDto();

  const { result, figures } = replayScenario(manifest);
  try {
    const eodTimeline = buildEodTimelineDto(result);
    const runResult = buildRunResultDto(manifest, result, figures);
    return {
      scenario,
      eodTimeline,
      boundaryAttestation,
      runResult,
      // "Head of Global Markets" owns the FX book; routed through seatTitle so a
      // persona name can never reach the /api/v2 boundary (name-free policy).
      deskOwnerSeatTitle: seatTitle("Saskia"),
      deferredGap:
        "Read-only in v1. Control actions — re-run the scenario, advance the simulated clock, " +
        "or select a different manifest — are a v1.1 deferral (the simulator is driven by the " +
        "declarative scenario-runner, not by operator buttons). Tracked, not built. " +
        "Authority: D-FX-V2-SIMULATOR-FIRST.",
      asOf: nowIso,
    };
  } finally {
    result.close();
  }
}
