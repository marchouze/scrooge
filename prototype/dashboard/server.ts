// dashboard/server.ts
//
// Bun.serve HTTP server for the bank operations dashboard. Serves static
// assets from `public/` and exposes:
//   GET  /api/state       — current dashboard state (JSON registry).
//   POST /api/decide      — record a CEO decision; appends an event and
//                           re-derives the registry.
//   POST /api/inflight/start
//                          — mark a workstream active; appends an event and
//                            re-derives the registry.
//   POST /api/inflight/complete
//                          — mark a workstream complete; appends an event
//                            and re-derives the registry.
//
// State persistence (Principle 1):
//   • The dashboard registry is a *cache* — a projection over canonical
//     sources + the event store. The runtime cache lives at
//     `BANK_DASHBOARD_RUNTIME_STATE` (default `.local/dashboard-state.json`,
//     gitignored). There is no committed cache.
//   • Every metric and list is reproducible from canonical sources via
//     `dashboard/derive.ts` (CLAUDE.md, registers, /Procedures/, /Team/,
//     event store). Hand-editing the runtime cache is futile — the next
//     re-derivation tick will overwrite drift.
//   • Re-derivation triggers: server startup, a polling timer, fs.watch on
//     canonical paths (debounced), and any state-mutating POST.
//
// Runtime cache path (D-EVENT-STORE-SCALING Slice 3a → Slice 3b, 2026-05-10):
//   • RUNTIME_STATE_PATH (`BANK_DASHBOARD_RUNTIME_STATE`, default
//     `.local/dashboard-state.json`) is the *live runtime cache*: re-derived
//     on every poll / mutation / fs.watch tick. Lives under `.local/` (which
//     is gitignored) so a dashboard run never makes `git status` dirty.
//
// Slice 3a (PR #138) split this runtime path off the previously-committed
// `seeds/dashboard-state.json`. Slice 3b (this commit) removes the seed
// entirely from the commit graph: the dashboard cache is a *projection*
// (Principle 1 — events/sources are truth, projections are queries) and
// the recon harness now derives + asserts internal consistency at recon
// time rather than comparing against a stored cache. See
// `Owner Inbox/2026-05-10_atlas_d-event-store-scaling-slice-3b-cache-from-commit-graph.md`.
//
// Substrate-replacement seam (P6 — upward chain). The local Bun.serve
// implementation is replaced at M8 by an Azure Container App; the HTTP
// surface and event integration are unchanged. The fs.watch trigger is
// replaced by Event Grid notifications; `deriveState()` itself does not
// change.
//
// Author: Atlas · Anya (derivation)

import { execSync } from "node:child_process";
import {
  type FSWatcher,
  existsSync,
  watch as fsWatch,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

// Must precede any import of platform/composition — sets BANK_EVENT_DB to the
// shared canonical store (config file → ~/.local/share/bank/event.db).
import "../platform/event-store/resolve-event-db-boot";

import {
  type ChartOfAccountsEntry,
  checkAgedItems,
} from "../platform/accounting/gl-subledger-recon";
import { computeEVE } from "../platform/alm/eve";
import { computeNII } from "../platform/alm/nii";
import { computeRepricingGap } from "../platform/alm/repricing-gap";
import { getCollateralInventory } from "../platform/collateral/inventory";
import { eventStore, logger } from "../platform/composition";
import { FINANCIAL_CONSTANTS } from "../platform/config/financial-constants";
import { updateConfigFile } from "../platform/config/loader";
import type {
  BankConfigDisplay,
  BankConfigPaths,
  BankConfigServer,
} from "../platform/config/schema";
import { CURRENCY_POSITIONS, NEGATIVE_STYLES } from "../platform/config/schema";
import { newEventId, nowUtc } from "../platform/core/types";
import { defaultDocumentStore } from "../platform/document-store";
import { makeAgentEscalationDecided } from "../platform/event-store/event-types/agent";
import type { SubLedgerPostingEmittedPayload } from "../platform/event-store/event-types/fx-accounting";
import { makeSubstrateAlert } from "../platform/event-store/event-types/platform";
import {
  makeProductApproved,
  makeProductDimensionAttested,
  makeProductDimensionNarrativeRecorded,
  makeProductDimensionNarrativeRequested,
  makeProductProposalRegistered,
} from "../platform/event-store/event-types/product";

import { publishFtpCurveIfMissing } from "../platform/alm/ftp-curve-publisher";
import {
  makeSeedDescoped,
  makeSeedPromotedToSimulated,
} from "../platform/event-store/event-types/seed-management";
import type { Event } from "../platform/event-store/types";
import { LocalEventTriggerBus, defaultBusSource } from "../platform/event-trigger-bus";
import {
  DEFAULT_HORIZON_DAYS,
  VIEWS,
  VIEW_NAMES,
  buildForwardObligations,
  type resolveHorizon,
} from "../platform/forward-obligations";
import { buildFtpPortfolio } from "../platform/ftp/projection";
import { buildPartyProjection, buildPartyTileSummary } from "../platform/identity/party-projection";
import { KYCOrchestrator } from "../platform/kyc/orchestrator";
import type { NewCandidateInput } from "../platform/kyc/orchestrator";
import { isLiveInstance, resolveTradeLifecycle } from "../platform/lifecycle/trade-lifecycle-state";
import { computeLCR } from "../platform/liquidity/lcr";
import { computeNSFR } from "../platform/liquidity/nsfr";
import { ingestBondPriceFixtureFromFile } from "../platform/market-data/bond-price-ingester";
import { ingestJibarFixingFixtureFromFile } from "../platform/market-data/jibar-fixing-ingester";
import { ingestJibarSwapCurveFixtureFromFile } from "../platform/market-data/jibar-swap-curve-ingester";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { ingestSarbRepoPrimeFixtureFromFile } from "../platform/market-data/sarb-repo-prime-ingester";
import { ingestZaroniaFixtureFromFile } from "../platform/market-data/sarb-zaronia-ingester";
import { MarketDataStore, lookupQuoteWithInverse } from "../platform/market-data/store";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";
import { emitOpinionRefreshGapAlerts } from "../platform/markets/legal/opinion-refresh-watchdog";
import { seedCalcModels } from "../platform/model-registry/calc-model-definitions";
import { emitAllCalculationProvenance } from "../platform/model-registry/calculation-provenance";
import { buildDataFailuresView } from "../platform/model-registry/data-failures-view";
import {
  checkExpectedEvents,
  emitExpectedEventGapAlerts,
} from "../platform/model-registry/expected-event-watchdog";
import { buildCalcModelsView } from "../platform/model-registry/models-view";
import { findKnowledgeBaseObligation } from "../platform/obligations/knowledge-base";
import { buildCrossAssetBreakdown } from "../platform/product-control/cross-asset-positions";
import {
  classifyUnmarkable,
  computeDailyPnL,
  runDailyPnLReport,
} from "../platform/product-control/daily-pnl";
import { computeDeskCashPositions } from "../platform/product-control/desk-cash-positions";
import { buildPnLDataFailuresView } from "../platform/product-control/pnl-data-failures-view";
import {
  defaultProvenanceFilter,
  eventInOperatingBook,
  eventMatchesProvenanceFilter,
} from "../platform/projections";
import { getALMPositionSnapshot } from "../platform/projections/alm-positions";
import {
  type CapitalMetrics,
  computeCapitalMetrics,
} from "../platform/projections/capital-metrics";
import {
  buildLimitUtilisationDeps,
  getCorrespondentRouting,
  getLimitUtilisations,
  getMarketRiskMeasure,
  rebuildCorrespondentRouting,
  rebuildLimitUtilisation,
} from "../platform/projections/markets";
import { runObligationPolicyCoverageRecon } from "../platform/recon/obligation-policy-coverage";
import { runObligationReviewStatusRecon } from "../platform/recon/obligation-review-status";
import { seatForBcbsObligationId } from "../platform/regulatory/basel-family-seat";
import { tracePolicyBackToRegulation } from "../platform/regulatory/graph/query";
import { getActiveBondCounterparties } from "../platform/simulation/bond-counterparty-registry";
import { BondSimEngine } from "../platform/simulation/bond-sim-engine";
import { getActiveFxCounterparties } from "../platform/simulation/fx-counterparty-registry";

import {
  makeApplicabilityAssessmentConcluded,
  makeApplicabilityAssessmentPerformed,
  makeApplicabilityAssessmentRequested,
} from "../platform/event-store/event-types/applicability-assessment";
import {
  makeObligationAdopted,
  makeObligationLifecycleTransitioned,
  makeProvisionScopeAdopted,
} from "../platform/event-store/event-types/obligation-lifecycle";
import {
  assessObligationApplicability,
  buildBankPostureContexts,
  concludedAssessmentIds,
  obligationAssessmentId,
  readPostureRegister,
} from "../platform/obligations/applicability";
import { loadProvisionAdoptionState } from "../platform/obligations/projection";
import {
  currentBankModePolicy,
  syncBankModeToLifecyclePhase,
} from "../platform/projections/bank-mode";
import {
  type RegStructuredDocMinimal,
  buildProvisionTree,
  computeScopeVerbatimHash,
  getLeafDescendants,
  resolveLeafAdoptionState,
} from "../platform/regulatory/graph/provision-tree";
import { loadStructuredDocBySlug } from "../platform/regulatory/structured-doc-loader";
import { FxSimEngine } from "../platform/simulation/fx-sim-engine";
import { buildDefaultHub } from "../platform/simulation/hub/register-defaults";
import { settleMaturedTrades } from "../platform/simulation/settle-matured-trades";
import { StdbankCustodianSim } from "../platform/simulation/stdbank-custodian-sim/index";
import { isPresent } from "../platform/types/financial-input";
import {
  buildDecisionsRegister,
  buildOpenDecisionsFromEscalations,
  decisionsSourceFromStore,
} from "../projections/decisions";
import { beaGlPostingEngine } from "../runtime/agents/bea-gl-posting-engine";
import { recordBankModePolicy } from "../runtime/bank-mode/record";
import { tryGenerateNarrative } from "../runtime/claude";
import { backfillCeoDecisionsFromRecords } from "../runtime/decisions/backfill-from-records";
import {
  type RecordDecisionCommentResult,
  type RecordDecisionResult,
  recordDecision,
  recordDecisionComment,
} from "../runtime/decisions/record";
import { tryGenerateNarrativeGemini } from "../runtime/gemini";
import { runAgent } from "../runtime/run";
import { getSeedManifestEntry } from "../seeds/manifest";
import { buildSeedsView } from "../seeds/seeds-view";
import { getAgentRuns, groupByAgent } from "./agent-runs";
import {
  getBankObligationsView,
  getObligationDetail,
  getUnadoptedObligationsView,
  loadObligationSeed,
} from "./bank-obligations-view";
import { bookBondTrade, registerBondGatewayRoutes } from "./bond-gateway";
import { buildConfigView } from "./config-view";
import { defaultSourcePaths, deriveState, eventSourceFromStore, watchTargets } from "./derive";
import { registerFxSimRoutes } from "./fx-sim-view";
import { registerGlRoutes } from "./gl-view";
import { registerGraphRoutes } from "./graph-view";
import { registerInstrumentRoutes } from "./instruments-view";
import { buildKycCandidatesView } from "./kyc-candidates-view";
import {
  buildKycCandidateDetailView,
  buildKycClientDetailView,
  buildKycClientsView,
} from "./kyc-clients-view";
import { registerMarketDataRoutes } from "./market-data-view";
import { buildCounterpartiesView } from "./markets-fx-counterparties";
import { type GatewayOrderResult, routeOrderToGateway } from "./markets-fx-gateway";
import { buildHeadroomView } from "./markets-fx-headroom";
import { buildNpaView } from "./markets-fx-npa";
import { buildRiskView } from "./markets-fx-risk";
import { buildFxSummaryView } from "./markets-fx-summary";
import {
  type RfqInput,
  type TradeEmitResult,
  emitTrade,
  quoteOnly,
  quoteRfq,
} from "./markets-fx-trade";
import { getObligationReadersView } from "./obligation-readers-view";
import { getObligationsView } from "./obligations-view";
import { buildOnboardingView } from "./onboarding-view";
import {
  POPIA_S71_NOTICE,
  buildDecisionDrillDown,
  buildFleetStatus,
  enrichBlockedBy,
  listEscalations,
} from "./oversight";
import { getOwnershipMapView, getSeatObligations } from "./ownership-map-view";
import {
  eventDerivedPageProvenance,
  productionReferencePageProvenance,
  proseAuthoredPageProvenance,
  substrateGapsPageProvenance,
} from "./page-provenance";
import { buildPerformanceView, getAgentPerformanceState } from "./performance-view";
import { getProceduresIndex } from "./procedures-index";
import { buildProductDetailView } from "./products-detail";
import { listPolicies, listProcedures } from "./products-policy-chain";
import { buildProductListView } from "./products-view";
import { saveState } from "./registry";
import { buildInstrumentDetailView, buildInstrumentsListView } from "./regulation-reader-view";
import { buildRegConceptsView, buildRegInstrumentsView } from "./regulatory-view";
import { buildRiskRegisterView } from "./risk-register";
import {
  RMS_REGISTER_KEYS,
  buildRmsRegistersFold,
  isRmsRegisterKey,
  selectRegisterView,
  summariseFold,
} from "./rms-view";
import {
  CommentBodySchema,
  CompleteWorkstreamBodySchema,
  DecideBodySchema,
  RfqBodySchema,
  StartWorkstreamBodySchema,
} from "./server-schemas";
import { registerSimHubRoutes } from "./sim-hub-view";
import { registerSlaApprovalRoutes } from "./sla-approval-view";
import { registerSlaRepresentationRoutes } from "./sla-representation-view";
import { serveStaticFile } from "./static-assets";
import { getSubstrateGapsView } from "./substrate-gaps";
import { buildTaxonomiesView } from "./taxonomy-view";
import { type TradeBookBody, bookFxTrade, registerTradeBookRoutes } from "./trade-book-view";
import type { DashboardState } from "./types";

const PORT = Number(process.env.BANK_DASHBOARD_PORT ?? 3010);
const REFRESH_MS = Number(process.env.BANK_DASHBOARD_REFRESH_MS ?? 30_000);
const WATCH_DEBOUNCE_MS = Number(process.env.BANK_DASHBOARD_WATCH_DEBOUNCE_MS ?? 500);
const REPO_ROOT = process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..");
// Live runtime cache; re-derived on every poll / mutation / watch event.
// Lives under `.local/` (gitignored) so the server never dirties git state.
// Per D-EVENT-STORE-SCALING Slice 3b (2026-05-10) there is no committed
// cache; the recon harness derives at recon time and asserts internal
// consistency rather than comparing against a stored file.
const RUNTIME_STATE_PATH =
  process.env.BANK_DASHBOARD_RUNTIME_STATE ?? ".local/dashboard-state.json";
const PUBLIC_DIR = resolve(import.meta.dir, "public");

const GIT_HASH = (() => {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
})();
const GIT_BRANCH = (() => {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
})();
const STARTED_AT = new Date().toISOString();

const SOURCES = (() => {
  const base = defaultSourcePaths(REPO_ROOT);
  // Allow the curated path to be overridden so tests / alt layouts can
  // run the server pointed at a fixture.
  const curated = process.env.BANK_DASHBOARD_CURATED ?? base.curated;
  return { ...base, curated };
})();
const EVENTS = eventSourceFromStore(eventStore);

function ensureRuntimeDir(path: string): void {
  const dir = dirname(path);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// MarketDataStore — must be declared before bootDerive() to avoid TDZ
// (getLimitUtilisations references it during boot derivation).
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
const marketDataDbPath = resolveMarketDataDbPath().path;
const marketDataStore = new MarketDataStore(marketDataDbPath);

let cachedState: DashboardState = bootDerive();

// FX market-making engine — module-level singleton. Hosts the still-live
// FX market-making engine — hosts sub-simulators (market data, nostro, correspondent,
// SARB ack) and the in-process counterparty FX trade loop driven from /sim-hub.
// Trades route through bookFxTrade (same path as manual desk) tagged with
// whichever provenance the operator configures.
// Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION.

function fxPayloadToBookBody(
  payload: FxTradeExecutedPayload,
  provenanceMode: "simulated" | "production",
  settlementMode: "realtime" | "accelerated",
): TradeBookBody {
  const leg = payload.legs[0];
  return {
    productType: "fx",
    provenanceMode,
    settlementMode,
    currencyPair: { base: payload.currencyPair.base, quote: payload.currencyPair.quote },
    side: payload.side,
    notionalAmount: leg ? leg.notional.amountMinor / 1_000_000 : 0,
    notionalCurrency: leg ? leg.notional.currency : payload.currencyPair.base,
    rate: leg ? leg.rate.amount : 0,
    settlementDate: leg ? leg.settlementDate.iso : "",
    counterpartyName: payload.counterparty.name,
    counterpartyLei: payload.counterparty.partyId,
    traderRef: "sim:counterparty-fx-request",
  };
}

const fxSimEngine = new FxSimEngine(eventStore, {
  marketDataStore,
  getCounterparties: () => getActiveFxCounterparties(eventStore),
  executeFxTrade: (payload, _asOf, _counterpartyBic, provenanceMode, settlementMode) => {
    void bookFxTrade(fxPayloadToBookBody(payload, provenanceMode, settlementMode)).catch(
      (err: unknown) => {
        console.error("[sim] FX booking via normal path failed:", err);
      },
    );
  },
});

// Boot-sync the event-sourced bank-wide provenance policy to the lifecycle-phase
// indicator BEFORE any projection or simulator reads it
// (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR2). The most recent
// BankModePolicySet event (default: sim → build-phase) drives bankLifecyclePhase()
// and therefore the canonical operating-book filter + the sandbox-simulator gate.
syncBankModeToLifecyclePhase(eventStore);

// Standard Bank bond custodian — shared by the bond-gateway HTTP route and the
// bond market-making simulator (both book through bookBondTrade).
const custodianSim = new StdbankCustodianSim(eventStore);
custodianSim.start();

// Bond market-making simulator — counterparty RFQ loop + synthetic bond-price
// feed. Counterparties resolve from the party register; trades book through the
// bank's normal bookBondTrade path (BondTradeExecuted → GL → settlement →
// custodian), exactly like a manual bond booking.
const bondSimEngine = new BondSimEngine(eventStore, {
  marketDataStore,
  getCounterparties: () => getActiveBondCounterparties(eventStore),
  executeBondTrade: (body) => {
    void bookBondTrade(body, eventStore, custodianSim).catch((err: unknown) => {
      console.error("[sim] bond booking via normal path failed:", err);
    });
  },
});

// Centralised 3rd-party simulator hub — registers the FX-counterparty stimulus
// plus the external sub-simulators (market data, nostro, correspondent, SARB
// ack) and the bond market-making modules behind one registry, reusing the live
// fxSimEngine + bondSimEngine + custodianSim instances.
const { hub: simHub } = buildDefaultHub({
  eventStore,
  envSimEngine: fxSimEngine,
  custodianSim,
  bondSimEngine,
});

function buildSlice5Projections(): void {
  // Slice 5 — rebuild LimitUtilisation + CorrespondentRouting projections
  // from the current event store on every derive tick.
  const allEvents = [...eventStore.replay({})];
  rebuildLimitUtilisation(allEvents);
  rebuildCorrespondentRouting(allEvents);
}

/** Derive the FTP portfolio summary from the current event store. */
function buildFtpSummary(): import("./types").FtpDashboardSummary | null {
  const allEvents = [...eventStore.replay({})];
  const portfolio = buildFtpPortfolio(allEvents);
  if (portfolio.totalAttributions === 0 && portfolio.activeCurveId === null) {
    return null;
  }
  return {
    totalAttributions: portfolio.totalAttributions,
    weightedAvgSpreadBps: portfolio.weightedAvgSpread,
    activeCurveId: portfolio.activeCurveId,
    lastUpdated: portfolio.lastUpdated,
  };
}

function buildCapitalPositions(): CapitalMetrics | null {
  return computeCapitalMetrics(eventStore, nowUtc());
}

function buildLiquidityMetrics(): {
  lcr: number | null;
  nsfr: number | null;
  lcrStatus: string;
  nsfrStatus: string;
} {
  // Per-entity LCR: scope to the bank-licence entity, matching the BA 110
  // generator's LE-ZA-HOZ-BANK-only scope (Reg 26 is bank-licence-bound).
  // Authority: WS-LCR-ENGINE-RECONCILIATION; D-LCR-TILE-PROVENANCE.
  const snap = getALMPositionSnapshot(eventStore, nowUtc(), 30, "LE-ZA-HOZ-BANK");
  const lcr = computeLCR(
    snap.hqlaPositions as import("../platform/liquidity/lcr").HQLAPosition[],
    snap.fundingPositions as import("../platform/liquidity/lcr").FundingPosition[],
  );
  const nsfr = computeNSFR(
    snap.asfItems as import("../platform/liquidity/nsfr").ASFItem[],
    snap.rsfItems as import("../platform/liquidity/nsfr").RSFItem[],
  );
  return {
    lcr: lcr.lcrRatioPct,
    nsfr: nsfr.nsfrRatioPct,
    lcrStatus: lcr.status,
    nsfrStatus: nsfr.status,
  };
}

function buildTreasuryMetrics() {
  const asOf = nowUtc();

  // Capital
  const capital = computeCapitalMetrics(eventStore, asOf);

  // ALM + liquidity — per-entity, scoped to the bank-licence entity to match
  // the BA 110 generator (Reg 26 / 26A are bank-licence-bound).
  // Authority: WS-LCR-ENGINE-RECONCILIATION; D-LCR-TILE-PROVENANCE.
  const almSnapshot = getALMPositionSnapshot(eventStore, asOf, 30, "LE-ZA-HOZ-BANK");
  const lcr = computeLCR(
    almSnapshot.hqlaPositions as import("../platform/liquidity/lcr").HQLAPosition[],
    almSnapshot.fundingPositions as import("../platform/liquidity/lcr").FundingPosition[],
  );
  const nsfr = computeNSFR(
    almSnapshot.asfItems as import("../platform/liquidity/nsfr").ASFItem[],
    almSnapshot.rsfItems as import("../platform/liquidity/nsfr").RSFItem[],
  );

  // IRRBB
  const eve = computeEVE(eventStore, asOf);
  const nii = computeNII(eventStore, asOf);
  const repricingGap = computeRepricingGap(eventStore, asOf);

  // Collateral
  const collateral = getCollateralInventory(asOf);

  // FTP
  const allEvents = [...eventStore.replay({})];
  const ftpPortfolio = buildFtpPortfolio(allEvents);

  return {
    asOf,
    capital: {
      availableCapitalZar: capital.availableCapitalMinor / 100,
      ticrZar: capital.ticrMinor / 100,
      headroomZar: capital.headroomZar,
      cet1RatioPct: capital.cet1RatioPct,
      status: capital.status,
      critical: capital.critical,
      buildPhase: capital.buildPhase,
    },
    liquidity: {
      lcr: {
        ratio: lcr.lcrRatioPct,
        hqlaZar: lcr.hqlaZar,
        netOutflows30dZar: lcr.netCashOutflowsZar,
        status: lcr.status,
      },
      nsfr: {
        ratio: nsfr.nsfrRatioPct,
        asfZar: nsfr.asfZar,
        rsfZar: nsfr.rsfZar,
        status: nsfr.status,
      },
      almGaps: [...almSnapshot.gaps],
      buildPhase: almSnapshot.buildPhase,
    },
    irrbb: {
      eve: {
        worstCaseDeltaEveZar: eve.worstCaseDeltaEveZar,
        worstCaseDeltaEvePctTier1: null,
        status: eve.status,
        scenarios: eve.results.map((r) => ({
          shockLabel: r.shockLabel,
          description: r.description,
          deltaEveZar: r.deltaEveZar,
          deltaEvePctTier1: r.deltaEvePctTier1,
        })),
      },
      nii: {
        worstCaseDeltaNiiZar: nii.worstCaseDeltaNiiZar,
        status: nii.status,
        scenarios: nii.results.map((r) => ({
          shockLabel: r.shockLabel,
          description: r.description,
          deltaNiiZar: r.deltaNiiZar,
        })),
      },
      repricingGap: {
        status: repricingGap.status,
        rows: repricingGap.rows.map((r) => ({
          bucket: r.bucket,
          rsaZar: r.rsaZar,
          rslZar: r.rslZar,
          gapZar: r.gapZar,
          cumulativeGapZar: r.cumulativeGapZar,
        })),
      },
    },
    collateral: {
      totalHQLAZar: collateral.totalHQLAZar,
      l1Zar: collateral.l1Zar,
      l2aZar: collateral.l2aZar,
      l2bZar: collateral.l2bZar,
      l2CapBreached: collateral.l2CapBreached,
      l2bCapBreached: collateral.l2bCapBreached,
      positionCount: collateral.positions.length,
    },
    ftp: {
      totalAttributions: ftpPortfolio.totalAttributions,
      weightedAvgSpreadBps: ftpPortfolio.weightedAvgSpread,
      activeCurveId: ftpPortfolio.activeCurveId,
    },
    // Repo Book — fold RepoTradeOpened, subtract terminal events
    repoBook: (() => {
      const repoOpened = [...eventStore.replay({ type: "RepoTradeOpened" })].filter((e) =>
        eventInOperatingBook(e),
      );
      const repoIdx = resolveTradeLifecycle([
        ...eventStore.replay({ type: "RepoTradeOpened" }),
        ...eventStore.replay({ type: "RepoEndLegSettled" }),
        ...eventStore.replay({ type: "RepoTradeTerminatedEarly" }),
      ]);
      const liveRepos = repoOpened.filter((e) => isLiveInstance(repoIdx.get(e.payload.tradeId)));
      const repoCashMinor = liveRepos.reduce((s, e) => s + e.payload.startLegCashZar, 0);
      const repoWeightedRate =
        liveRepos.length > 0
          ? liveRepos.reduce(
              (s, e) => s + e.payload.repoRateDecimal * e.payload.startLegCashZar,
              0,
            ) / repoCashMinor
          : 0;
      return {
        openCount: liveRepos.length,
        totalCashLentZar: repoCashMinor / 100,
        weightedAvgRateDecimal: repoWeightedRate,
      };
    })(),
    // Deposit Book — fold DepositTaken, subtract terminal events
    depositBook: (() => {
      const depositsOpened = [...eventStore.replay({ type: "DepositTaken" })].filter((e) =>
        eventInOperatingBook(e),
      );
      const depositIdx = resolveTradeLifecycle([
        ...eventStore.replay({ type: "DepositTaken" }),
        ...eventStore.replay({ type: "DepositMatured" }),
        ...eventStore.replay({ type: "DepositWithdrawnEarly" }),
      ]);
      const liveDeposits = depositsOpened.filter((e) =>
        isLiveInstance(depositIdx.get(e.payload.depositId)),
      );
      const depositPrincipalMinor = liveDeposits.reduce((s, e) => s + e.payload.principalZar, 0);
      return {
        openCount: liveDeposits.length,
        totalPrincipalZar: depositPrincipalMinor / 100,
      };
    })(),
    // IB Placement Book — fold InterbankLoanPlaced, subtract terminal events, split by type
    ibPlacementBook: (() => {
      const iblOpened = [...eventStore.replay({ type: "InterbankLoanPlaced" })].filter((e) =>
        eventInOperatingBook(e),
      );
      const iblIdx = resolveTradeLifecycle([
        ...eventStore.replay({ type: "InterbankLoanPlaced" }),
        ...eventStore.replay({ type: "InterbankLoanMatured" }),
        ...eventStore.replay({ type: "InterbankLoanRecalledEarly" }),
      ]);
      const liveIBL = iblOpened.filter((e) => isLiveInstance(iblIdx.get(e.payload.placementId)));
      const fixedTermMinor = liveIBL
        .filter((e) => e.payload.placementType === "fixed-term")
        .reduce((s, e) => s + e.payload.principalZar, 0);
      const callMinor = liveIBL
        .filter((e) => e.payload.placementType === "call")
        .reduce((s, e) => s + e.payload.principalZar, 0);
      return {
        openCount: liveIBL.length,
        totalPlacedZar: (fixedTermMinor + callMinor) / 100,
        fixedTermZar: fixedTermMinor / 100,
        callZar: callMinor / 100,
      };
    })(),
  };
}

// ---------------------------------------------------------------------------
// Continuous aging watchdog (PROC-FIN-BSS-01 §5 step 3c)
// ---------------------------------------------------------------------------
//
// The step-3c aged-item check was previously only called during period-close.
// A $185B open residual on ACC-2100-002 went undetected for 14 days because
// no continuous check existed.
//
// This function runs on every `refresh()` cycle. It:
//   1. Replays all SubLedgerPostingEmitted events and builds a provenance-filtered
//      posting list (same fixture guard as run-bss-2026-05-seed.ts).
//   2. Builds a minimal trial balance from those postings.
//   3. Calls checkAgedItems for accounts with clearanceHorizonDays.
//   4. For each aged item, emits SubstrateAlert{alertClass:"integrity"} using an
//      idempotent alertId — one alert per distinct residual, not per derive cycle.
//
// Authority: FIN-BSS-01; PROC-FIN-BSS-01; Principle 1.
// Brief: brief:bea:bss-provenance-filter-continuous-aging-watchdog:2026-05-31

// Minimal COA subset for the continuous aging watchdog — only accounts with
// clearanceHorizonDays set. Kept here (not shared with BSS script) so the
// watchdog is self-contained and the script's full COA can evolve independently.
const AGING_WATCHDOG_COA: ChartOfAccountsEntry[] = [
  {
    accountId: "ACC-1100-004",
    name: "FX Settlement Suspense — ZAR",
    currency: "ZAR",
    ifrsClassification: "amortised-cost",
    ifrsClassificationStatus: "in-force",
    clearanceHorizonDays: 2,
    shouldNetToZeroAtPeriodEnd: true,
    sourceEventTypes: ["FxTradeExecuted", "FxSettlementConfirmed"],
  },
  {
    accountId: "ACC-1100-005",
    name: "FX Settlement Suspense — USD",
    currency: "USD",
    ifrsClassification: "amortised-cost",
    ifrsClassificationStatus: "in-force",
    clearanceHorizonDays: 2,
    shouldNetToZeroAtPeriodEnd: true,
    sourceEventTypes: ["FxTradeExecuted", "FxSettlementConfirmed"],
  },
  {
    accountId: "ACC-2100-002",
    name: "FX Receivables — Foreign CCY",
    currency: "multi",
    ifrsClassification: "fvtpl",
    ifrsClassificationStatus: "in-force",
    clearanceHorizonDays: 2,
    sourceEventTypes: ["FxTradeExecuted", "FxSettlementConfirmed"],
  },
];
// Note: ACC-2200-001 (Customer Payables, ZAR) has no clearanceHorizonDays in the
// canonical chart-of-accounts and is not eligible for aging checks.

// Source event types whose build-phase-fixture instances should be excluded
// from the aging watchdog posting list (mirrors FIXTURE_SOURCE_TYPES in
// run-bss-2026-05-seed.ts).
const WATCHDOG_FIXTURE_SOURCE_TYPES = new Set([
  "FxTradeExecuted",
  "FxPositionRevalued",
  "TradeMatured",
  "PrincipalPayment",
  "SettlementConfirmed",
  "SubLedgerPostingRemediationRecorded",
]);

const WATCHDOG_ENTITY = "LE-ZA-HOZ-BANK";
const WATCHDOG_ACTOR_AGING = {
  type: "service" as const,
  id: "agent:bea:aging-watchdog",
};
const WATCHDOG_CITATIONS = ["FIN-BSS-01", "PROC-FIN-BSS-01", "Principle 1"];

/**
 * Emit a `SubstrateAlert{alertClass:"integrity",severity:"high"}` for each
 * aged open residual found in the provenance-filtered posting stream.
 *
 * Idempotent: an alertId already present in the log is skipped.
 *
 * Returns `{ emitted, skipped, clean }` counts.
 */
function emitAgedItemAlerts(
  store: typeof eventStore,
  asOf: string,
): { emitted: number; skipped: number; clean: number } {
  // Step 1 — build out-of-book source-event set so seed-scaffolding / sandbox
  // postings are excluded (prevents CONDUCT-TEST entries firing as aged items).
  // Canonical operating-book inclusion (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE)
  // replaces the inline build-phase-fixture check.
  const outOfBookSourceIds = new Set<string>();
  for (const ev of store.replay({})) {
    if (WATCHDOG_FIXTURE_SOURCE_TYPES.has(ev.type) && !eventInOperatingBook(ev)) {
      outOfBookSourceIds.add(ev.event_id);
    }
  }

  // Replay SubLedgerPostingEmitted and filter out out-of-book-sourced postings.
  const allPostings: SubLedgerPostingEmittedPayload[] = [];
  for (const ev of store.replay({ type: "SubLedgerPostingEmitted" })) {
    const p = ev.payload as SubLedgerPostingEmittedPayload;
    if (!p.postedAt) continue; // skip pre-schema postings missing postedAt
    if (p.sourceEventId && outOfBookSourceIds.has(p.sourceEventId)) continue;
    allPostings.push(p);
  }

  // Build a minimal trial balance from the filtered postings (net per account+currency).
  const netByKey = new Map<
    string,
    { leafAccountId: string; currency: string; amountMinor: number }
  >();
  for (const posting of allPostings) {
    for (const leg of posting.legs) {
      const key = `${leg.accountId}|${leg.currency}`;
      const existing = netByKey.get(key) ?? {
        leafAccountId: leg.accountId,
        currency: leg.currency,
        amountMinor: 0,
      };
      existing.amountMinor += leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
      netByKey.set(key, existing);
    }
  }
  const trialBalance = { rows: [...netByKey.values()] };

  // Step 2 — collect confirmed source event IDs (same logic as BSS script).
  const confirmedSourceEventIds = new Set<string>();
  for (const type of ["SettlementConfirmed", "FxSettlementConfirmed", "TradeMatured"]) {
    for (const ev of store.replay({ type })) {
      confirmedSourceEventIds.add(ev.event_id);
    }
  }

  // Step 3 — run checkAgedItems over the watchdog COA subset.
  const agedResult = checkAgedItems({
    trialBalance,
    chartOfAccounts: AGING_WATCHDOG_COA,
    asOf: asOf.slice(0, 10),
    postingEvents: allPostings,
    confirmedSourceEventIds,
  });

  // Step 4 — collect already-emitted alertIds (idempotency guard).
  const existingAlertIds = new Set<string>();
  for (const ev of store.replay({ type: "SubstrateAlert" })) {
    const id = (ev.payload as { alertId?: string }).alertId;
    if (id) existingAlertIds.add(id);
  }

  let emitted = 0;
  let skipped = 0;

  // Step 5 — emit one SubstrateAlert per distinct aged residual.
  for (const item of agedResult.aged) {
    // Build a slug that is stable for this account+currency+oldest-date residual.
    const slug = [
      "aged-item",
      item.accountId.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      item.currency.toLowerCase(),
      item.oldestPostingDate.replace(/-/g, ""),
    ].join("-");
    const alertId = `alert:integrity:${slug}`;
    if (existingAlertIds.has(alertId)) {
      skipped++;
      continue;
    }
    store.append(
      makeSubstrateAlert({
        asOf,
        entity: WATCHDOG_ENTITY,
        actor: WATCHDOG_ACTOR_AGING,
        citations: WATCHDOG_CITATIONS,
        payload: {
          alertId,
          alertClass: "integrity",
          severity: "high",
          details: `Aged open residual: account=${item.accountId} ccy=${item.currency} ageDays=${item.ageCalendarDays} (threshold=${item.clearanceHorizonDays}d) amountMinor=${item.amountMinor} oldestPostingDate=${item.oldestPostingDate}. PROC-FIN-BSS-01 §5 step 3c.`,
        },
      }),
    );
    emitted++;
  }

  return { emitted, skipped, clean: agedResult.clean.length };
}

function bootDerive(): DashboardState {
  try {
    // D-DECISIONS-FRAMEWORK-REDESIGN Slice D: backfillCeoDecisionsFromRecords
    // is now a retired no-op stub. Legacy CeoDecision backfill was replaced
    // by migrate:decisions-backfill (unified Decision events with proper
    // symmetry). The call is kept for backwards-compat but emits nothing.
    backfillCeoDecisionsFromRecords(SOURCES.ownerInboxDir, eventStore);

    // FTP curve — ensure the SARB ZARONIA overnight fixing is in the market-data
    // store (idempotent ingest from the seed fixture), then publish today's ZAR
    // FTP curve from the latest fixing. This is the funding-cost input the P&L
    // attribution carry component resolves against — with the curve present, the
    // pnl-attribution figure lifts from `degraded` (carry absent) to `ok`. No
    // silent constant: a missing ZARONIA fixing leaves the curve unpublished and
    // the carry degrades loudly. Runs BEFORE emitCalculationProvenance so the
    // boot-suite pnl-attribution emitter sees the curve. Authority:
    // D-PNL-ATTR-FTP-CURVE-FIX; D-TRUSTED-FIGURES-PROGRAM-V1.
    try {
      const zaroniaFixturePath = resolve(import.meta.dir, "..", "seeds", "zaronia-rates.json");
      ingestZaroniaFixtureFromFile(marketDataStore, zaroniaFixturePath);
      const ftp = publishFtpCurveIfMissing({
        eventStore,
        marketDataStore,
        asOf: nowUtc(),
        logger,
      });
      if (ftp.published) {
        logger.info({ rate: ftp.rate }, "ftp-curve: ZAR overnight curve published from ZARONIA");
      }
    } catch (ftpErr) {
      logger.warn({ err: (ftpErr as Error).message }, "ftp-curve: publish skipped");
    }

    // Market-data reference feeds — seed the rate + bond reference feeds that
    // already have build-phase fixtures into the market-data store so the
    // /market-data dashboard surfaces Rates (JIBAR 3M, ZAR swap curve, SARB
    // repo/prime) and Bonds (SA government benchmarks) alongside FX, rather
    // than FX-only. ZARONIA is already seeded above (FTP-curve path). Each
    // ingest is idempotent (deterministic tick ids → INSERT OR IGNORE) and
    // independently guarded so one malformed fixture never blocks the others
    // — a skipped feed degrades loudly (warn), never silently. Authority:
    // D-MARKETS-SCHEMA-FOUNDATION; D-FINANCIAL-INSTRUMENT-ENTITY Slice 10.
    const seedsDir = resolve(import.meta.dir, "..", "seeds");
    const referenceFeeds: ReadonlyArray<{
      readonly label: string;
      readonly run: () => { ticksAppended: number; ticksSkippedAsDuplicate: number };
    }> = [
      {
        label: "jibar-fixing",
        run: () =>
          ingestJibarFixingFixtureFromFile(
            marketDataStore,
            resolve(seedsDir, "jibar-fixings.json"),
          ),
      },
      {
        label: "swap-curve",
        run: () =>
          ingestJibarSwapCurveFixtureFromFile(
            marketDataStore,
            resolve(seedsDir, "jibar-swap-curve.json"),
          ),
      },
      {
        label: "repo-prime",
        run: () =>
          ingestSarbRepoPrimeFixtureFromFile(
            marketDataStore,
            resolve(seedsDir, "sarb-repo-rate.json"),
          ),
      },
      {
        label: "bond-price",
        run: () =>
          ingestBondPriceFixtureFromFile(marketDataStore, resolve(seedsDir, "bond-prices.json")),
      },
    ];
    for (const feed of referenceFeeds) {
      try {
        const r = feed.run();
        logger.info(
          { appended: r.ticksAppended, skipped: r.ticksSkippedAsDuplicate },
          `market-data: ${feed.label} reference feed seeded`,
        );
      } catch (feedErr) {
        logger.warn(
          { err: (feedErr as Error).message },
          `market-data: ${feed.label} reference feed seed skipped`,
        );
      }
    }

    // Trusted-Figures provenance — emit CalculationPerformed for LCR/NSFR/CET1.
    // Runs after treasury + balance-sheet seeds so the ALM snapshot is populated.
    // Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
    emitCalculationProvenance();
    // Slice 5 — rebuild LimitUtilisation + CorrespondentRouting projections.
    buildSlice5Projections();
    // Product Control — emit DailyPnLReportGenerated on each derive cycle.
    // Idempotent in practice (new event per cycle); API returns only the latest.
    // Authority: D-FX-SALES-TRADING-FRONTEND; IFRS 9 §5.7.1.
    try {
      runDailyPnLReport(eventStore, nowUtc);
    } catch (pnlErr) {
      logger.warn({ err: (pnlErr as Error).message }, "product-control: daily P&L report skipped");
    }
    // Trusted-Figures follow-on — expected-event watchdog. After every emitter
    // above has had its chance, assert the events that MUST exist actually do.
    // An expectation with no matching event (e.g. a calc try/catch bailed, or
    // the daily-P&L run was skipped) emits a SubstrateAlert{integrity} so the
    // data-failure banner surfaces the silent gap rather than letting a figure
    // read from stale/absent state. Idempotent by alertId.
    // Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
    try {
      const watchdog = emitExpectedEventGapAlerts(eventStore, nowUtc());
      if (watchdog.emitted.length > 0) {
        logger.warn(
          { gaps: watchdog.emitted },
          "expected-event-watchdog: expected events missing — SubstrateAlert(integrity) emitted",
        );
      }
    } catch (wErr) {
      logger.warn({ err: (wErr as Error).message }, "expected-event-watchdog: check skipped");
    }
    // Legal dimension — ISDA jurisdictional-opinion annual-refresh watchdog
    // (D-FX-HELD-DIMS-SEAT-SWEEP; #1102 pattern). Missing/stale opinion for a
    // counterparty-with-ISDA emits a MEDIUM SubstrateAlert{integrity} — a
    // monitoring finding, never an order-path block. Idempotent by alertId.
    try {
      const opinionWatchdog = emitOpinionRefreshGapAlerts(eventStore, nowUtc());
      if (opinionWatchdog.emitted.length > 0) {
        logger.warn(
          { alerts: opinionWatchdog.emitted },
          "opinion-refresh-watchdog: ISDA netting-opinion refresh SLA findings — SubstrateAlert(integrity, medium) emitted",
        );
      }
    } catch (owErr) {
      logger.warn({ err: (owErr as Error).message }, "opinion-refresh-watchdog: check skipped");
    }
    const s = deriveState({
      sources: SOURCES,
      events: EVENTS,
      limitUtilisations: getLimitUtilisations(
        marketDataStore,
        buildLimitUtilisationDeps(eventStore, nowUtc()),
      ),
      ftp: buildFtpSummary(),
      capitalPositions: buildCapitalPositions(),
      liquidityMetrics: buildLiquidityMetrics(),
    });
    ensureRuntimeDir(RUNTIME_STATE_PATH);
    saveState(s, RUNTIME_STATE_PATH);
    return s;
  } catch (e) {
    logger.error({ err: (e as Error).message }, "initial derivation failed");
    throw e;
  }
}

/**
/**
 * Emit one CalculationPerformed event per surfaced regulatory figure
 * (LCR / NSFR / CET1 / RWA / ECL / IRRBB ΔEVE / IRRBB ΔNII) on each boot cycle — the calculation-history provenance
 * axis (which model, which inputs, with what trust status). A figure whose bound
 * model is not approved is NOT emitted as a number: it is a loud skip + warning
 * (objective 3). A figure with a missing required input emits status `failed`,
 * output null — never a silent 0 (objective 4).
 *
 * Called after the calc models are seeded + approved and after treasury/balance
 * sheet seeds so the ALM snapshot is populated.
 *
 * Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
 */
function emitCalculationProvenance(): void {
  // Register + approve the regulatory-metric calc models BEFORE emitting any
  // provenance. emitAllCalculationProvenance does a loud skip (no
  // CalculationPerformed) for any figure whose bound model is not `approved` in
  // the registry — so the models must be seeded on the SAME store this boot
  // emits against. Idempotent: models already submitted/approved are skipped.
  //
  // This restores the boot-seed step retired in commit 1aaff5c5 ("retire
  // calc-models boot seed"), which moved seedCalcModels to a standalone script
  // and dropped the call from server boot. The retirement was silent on any
  // store that did not have the script run against it: on the canonical home
  // store the current-id models (model:lcr-ba110-v1 / model:nsfr-ba110-v1 /
  // model:capital-cet1-ba100-v1) were never registered, so every boot loud-
  // skipped LCR/NSFR/CET1 → no CalculationPerformed → three expected-event gaps
  // (calc-lcr / calc-nsfr / calc-capital-cet1) on /api/data-failures. The other
  // figures (RWA/ECL/IRRBB/market-risk/CVA) emitted fine because their model
  // ids never churned and were already approved in the store. Seeding on boot
  // makes model approval a structural invariant of the emit path again rather
  // than a manual prerequisite that drifts. Authority: D-TRUSTED-FIGURES-
  // PROGRAM-V1.
  const seedResult = seedCalcModels(eventStore);
  if (seedResult.submitted.length > 0 || seedResult.approved.length > 0) {
    logger.info(
      {
        submitted: seedResult.submitted.length,
        tierClassified: seedResult.tierClassified.length,
        approved: seedResult.approved.length,
        skipped: seedResult.skipped.length,
      },
      "calc-provenance: regulatory-metric calc models registered + approved (boot seed)",
    );
  }

  // Delegates to the extracted, unit-testable emission suite. RWA is now a
  // first-class emitted figure (model:rwa-sa-v1) alongside the LCR/NSFR/CET1/
  // ECL/IRRBB/market-risk/CVA figures — closing the gap where `rwa` had a
  // binding but no emitter. The guardrail test (tests/calculation-provenance.test.ts)
  // asserts every CALC_BINDINGS key produces an emission.
  emitAllCalculationProvenance({
    eventStore,
    marketDataStore,
    asOf: nowUtc(),
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service" as const, id: "agent:atlas:calc-provenance" },
    logger,
  });
}

function refresh(reason: string): void {
  try {
    // Settle any realtime-mode sim trades whose T+2 settlement date has arrived.
    const settled = settleMaturedTrades(eventStore, nowUtc().slice(0, 10));
    if (settled > 0) {
      logger.info({ settled }, "realtime settlement: matured trades confirmed");
    }

    buildSlice5Projections();
    const next = deriveState({
      sources: SOURCES,
      events: EVENTS,
      limitUtilisations: getLimitUtilisations(
        marketDataStore,
        buildLimitUtilisationDeps(eventStore, nowUtc()),
      ),
      ftp: buildFtpSummary(),
      capitalPositions: buildCapitalPositions(),
      liquidityMetrics: buildLiquidityMetrics(),
    });
    cachedState = next;
    // RMS Slice 4 — invalidate the register-fold cache because new
    // appends to the event store may have changed any of the seven
    // projections. The next /api/rms* request re-folds.
    invalidateRmsFold();
    ensureRuntimeDir(RUNTIME_STATE_PATH);
    saveState(next, RUNTIME_STATE_PATH);
    logger.debug(
      { reason, asOf: next.asOf, runtimePath: RUNTIME_STATE_PATH },
      "dashboard re-derived",
    );
    // Continuous aging watchdog (PROC-FIN-BSS-01 §5 step 3c).
    // Replays and provenance-filters postings; emits a SubstrateAlert{integrity}
    // for each open residual that has exceeded its clearanceHorizonDays.
    // Idempotent by alertId — one alert per distinct residual, not per cycle.
    // Authority: FIN-BSS-01; PROC-FIN-BSS-01; Principle 1.
    try {
      const aging = emitAgedItemAlerts(eventStore, nowUtc());
      if (aging.emitted > 0) {
        logger.warn(
          { emitted: aging.emitted, skipped: aging.skipped, clean: aging.clean },
          "aging-watchdog: aged open residuals found — SubstrateAlert(integrity) emitted",
        );
      }
    } catch (agingErr) {
      logger.warn({ err: (agingErr as Error).message }, "aging-watchdog: check skipped");
    }

    // GL posting engine — catch-all for any events (FX lifecycle, cancellations,
    // sim trades, script-emitted events) that weren't posted inline. This is now
    // the SOLE FX + non-FX posting path: the redundant `bea:fx-posting-engine`
    // was retired under WS-SLA-FULL-RETIREMENT (D-SLA-ENGINE-RULES-AS-DATA) — it
    // subscribed to the same FX event types and was a latent double-posting path.
    // Idempotent: already-posted events are skipped. Fire-and-forget so the
    // refresh cycle is not blocked; errors are logged but do not abort derivation.
    const glCtx = {
      agent: "Bea",
      trigger: { kind: "scheduled" as const, id: "refresh-cycle-gl-catch-all" },
      asOf: nowUtc(),
      repoRoot: process.cwd(),
      ownerInboxDir: `${process.cwd()}/Owner Inbox`,
      dryRun: false,
    };
    beaGlPostingEngine(glCtx).catch((err) => {
      logger.warn({ err: (err as Error).message }, "refresh: GL posting engine error");
    });
  } catch (e) {
    // Failing closed: keep serving the previous state, log loudly.
    logger.error(
      { err: (e as Error).message, reason },
      "re-derivation failed; serving previous state",
    );
  }
}

// Static serving lives in static-assets.ts (cache-validation headers + 304
// revalidation; WS-DASHBOARD-STATIC-CACHING). `req` carries If-None-Match.
function serveStatic(pathname: string, req?: Request): Response {
  return serveStaticFile(PUBLIC_DIR, pathname, req);
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Normalise a raw party object to always emit `partyKind`.
 *
 * The canonical field name for the party kind discriminant is `partyKind`
 * (D-DATA-QUALITY-GOLDEN-SOURCE-V1). Legacy serialization paths may emit
 * `kind` or `type`. This helper normalises the wire format to `partyKind`
 * and removes the legacy aliases so clients never need a fallback chain.
 *
 * Apply to every party object before including it in an API response.
 */
function normalizePartyShape(raw: Record<string, unknown>): Record<string, unknown> {
  const kind = (raw.partyKind ?? raw.kind ?? raw.type ?? "") as string;
  const {
    kind: _k,
    type: _t,
    ...rest
  } = raw as {
    kind?: unknown;
    type?: unknown;
    [k: string]: unknown;
  };
  return { ...rest, partyKind: kind };
}

async function handleDecide(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const parsed = DecideBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  // D-DECISIONS-FRAMEWORK-REDESIGN Slice B — caller identity is
  // mandatory; the handler no longer hard-codes a fallback. The
  // dashboard UI passes the CEO's email; agent callers pass their
  // strong identity. Anonymous requests are rejected.
  const actor =
    typeof body.actor === "string" && body.actor.trim().length > 0 ? body.actor.trim() : null;
  if (!actor) {
    return jsonResponse(
      { error: "unauthenticated: `actor` is required (no server-side fallback)" },
      401,
    );
  }

  const fold = getRmsFold();
  const openDecision = fold.decisions.find(
    (d) => d.decisionId === body.decisionId && d.status === "open",
  );
  if (!openDecision) {
    // The dashboard surfaces open AgentEscalations as approvable "decisions"
    // (buildOpenDecisionsFromEscalations) but they never appear in the RMS
    // Decision fold. When the CEO disposes of one of these escalation-derived
    // items, there is no backing Decision to resolve — the terminal artefact
    // is AgentEscalationDecided. Without this fallback the disposition 404s
    // ("Decision not found or not open"). Authority: GOV-FRAMEWORK-CEO-RESERVED.
    const escResolvedIds = new Set(
      [...eventStore.replay({ type: "CeoDecision" })]
        .map((e) => String((e.payload as Record<string, unknown>).decisionId ?? ""))
        .filter(Boolean),
    );
    const matchingEscalationOnly = listEscalations(eventStore, escResolvedIds).find(
      (esc) => esc.escalationId === body.decisionId && esc.status !== "decided",
    );
    if (!matchingEscalationOnly) {
      return jsonResponse({ error: `Decision not found or not open: ${body.decisionId}` }, 404);
    }
    try {
      const escalationEvent = makeAgentEscalationDecided({
        asOf: nowUtc(),
        entity: matchingEscalationOnly.entity ?? "LE-ZA-HOZ-BANK",
        actor: { type: "human", id: actor },
        citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        eventId: `evt-escalation-decided-${newEventId()}`,
        payload: {
          escalationId: body.decisionId,
          decidedBy: actor,
          chosenOption: body.action,
          rationale: body.outcome,
        },
      });
      eventStore.append(escalationEvent);
      logger.info(
        { escalationId: body.decisionId, escalationEventId: escalationEvent.event_id },
        "closed escalation via AgentEscalationDecided (no backing Decision)",
      );
    } catch (escalationErr) {
      return jsonResponse({ error: (escalationErr as Error).message }, 400);
    }
    refresh("decide");
    return jsonResponse({ ok: true, escalationId: body.decisionId, kind: "escalation-decided" });
  }

  // Route through the canonical unified-Decision recorder. The handler
  // performs no event construction itself — `recordDecision` is the
  // only path to `eventStore.append` for decision events.
  const followOnRoutes = Array.isArray(body.followOnRoutes)
    ? body.followOnRoutes
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
    : [];

  // Map the legacy `action` onto the unified `phase`.
  const phase =
    body.action === "approve" || body.action === "modify"
      ? "approved"
      : body.action === "defer"
        ? "deferred"
        : "requested"; // request-revision reopens

  let result: RecordDecisionResult;
  try {
    result = recordDecision(
      {
        decisionId: body.decisionId,
        phase,
        authority: "CEO",
        authorityRef: actor,
        title: openDecision.title,
        category:
          openDecision.category === "governance" ||
          openDecision.category === "risk" ||
          openDecision.category === "compliance" ||
          openDecision.category === "engineering" ||
          openDecision.category === "people" ||
          openDecision.category === "finance" ||
          openDecision.category === "product" ||
          openDecision.category === "other"
            ? openDecision.category
            : "governance",
        recommendation: body.outcome,
        rationale: body.comment ?? body.outcome,
        sourceDocHashes: [],
        citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
        ...(followOnRoutes.length > 0
          ? { followOnDispatch: followOnRoutes.map((route) => ({ route })) }
          : {}),
        recordedVia: "authoring-ui",
      },
      nowUtc(),
    );
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }

  // If this decisionId is also an open escalation ID, emit the terminal
  // AgentEscalationDecided event so the escalation channel folds it as
  // "decided". The escalation channel only processes AgentEscalationDecided
  // (not CeoDecision) for terminal state — without this the escalation
  // stays ghost-open even though a CeoDecision was recorded against it.
  const resolvedIds = new Set(
    [...eventStore.replay({ type: "CeoDecision" })]
      .map((e) => String((e.payload as Record<string, unknown>).decisionId ?? ""))
      .filter(Boolean),
  );
  const openEscalations = listEscalations(eventStore, resolvedIds);
  const matchingEscalation = openEscalations.find(
    (esc) => esc.escalationId === body.decisionId && esc.status !== "decided",
  );
  if (matchingEscalation) {
    try {
      const escalationEvent = makeAgentEscalationDecided({
        asOf: nowUtc(),
        entity: matchingEscalation.entity ?? "LE-ZA-HOZ-BANK",
        actor: { type: "human", id: actor },
        citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        eventId: `evt-escalation-decided-${newEventId()}`,
        payload: {
          escalationId: body.decisionId,
          decidedBy: actor,
          chosenOption: body.action,
          rationale: body.outcome,
        },
      });
      eventStore.append(escalationEvent);
      logger.info(
        { escalationId: body.decisionId, escalationEventId: escalationEvent.event_id },
        "co-emitted AgentEscalationDecided alongside CeoDecision",
      );
    } catch (escalationErr) {
      logger.warn(
        { escalationId: body.decisionId, err: (escalationErr as Error).message },
        "failed to co-emit AgentEscalationDecided — escalation may remain ghost-open",
      );
    }
  }

  refresh("decide");
  const resolved = cachedState.decisionsResolved.find((r) => r.id === body.decisionId);

  logger.info(
    {
      decisionId: body.decisionId,
      action: body.action,
      eventId: result.eventId,
      followOnRoutes: followOnRoutes.length,
    },
    "CEO decision recorded via dashboard",
  );
  return jsonResponse({ ok: true, resolved, eventId: result.eventId });
}

async function handleComment(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const parsed = CommentBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  const actorId =
    typeof body.actorId === "string" && body.actorId.trim().length > 0
      ? body.actorId.trim()
      : "marc@tgv.co.za";
  const author =
    typeof body.author === "string" && body.author.trim().length > 0 ? body.author.trim() : "Marc";

  let result: RecordDecisionCommentResult;
  try {
    result = recordDecisionComment(
      {
        decisionId: body.decisionId,
        author,
        actorType: "human",
        actorId,
        body: body.body,
        ...(typeof body.inReplyToEventId === "string"
          ? { inReplyToEventId: body.inReplyToEventId }
          : {}),
      },
      nowUtc(),
    );
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }

  refresh("comment");
  logger.info(
    { decisionId: body.decisionId, eventId: result.eventId },
    "decision comment recorded via dashboard",
  );
  return jsonResponse({ ok: true, eventId: result.eventId });
}

// ---------------------------------------------------------------------------
// KYC mutation handlers — D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
//
// POST /api/kyc/start           — register a new candidate; returns { candidateId }
// POST /api/kyc/candidates/:id/advance — advance one step; returns CandidateState
// POST /api/kyc/candidates/:id/decide  — record human decision; returns CandidateState
// POST /api/kyc/clients/:id/refresh    — emit KYCRefreshScheduled; returns { ok }
// POST /api/kyc/simulate               — run sim scenario(s); returns array of results
//
// Authority: D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
// ---------------------------------------------------------------------------

const kycOrchestrator = new KYCOrchestrator();

async function handleKycStart(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const input = body as NewCandidateInput;
  if (!input.entityName || !input.entityType || !input.jurisdiction) {
    return jsonResponse({ error: "entityName, entityType, jurisdiction are required" }, 400);
  }
  // Guard: reject if an accepted client with the same entityName already exists.
  const existingClients = buildKycClientsView(eventStore);
  const nameLower = input.entityName.trim().toLowerCase();
  const duplicate = existingClients.clients.find(
    (c) => c.entityName.trim().toLowerCase() === nameLower,
  );
  if (duplicate) {
    return jsonResponse(
      {
        error: `Client "${input.entityName}" is already onboarded`,
        existingClientId: duplicate.clientId,
      },
      409,
    );
  }

  try {
    const result = await kycOrchestrator.startOnboarding(input);
    refresh("kyc-start");
    logger.info(
      { candidateId: result.candidateId, entityName: input.entityName },
      "KYC candidate registered via dashboard",
    );
    return jsonResponse(result, 201);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}

async function handleKycAdvance(candidateId: string): Promise<Response> {
  try {
    const state = await kycOrchestrator.advanceStep(candidateId);
    refresh("kyc-advance");
    logger.info(
      { candidateId, currentStep: state.currentStep, status: state.status },
      "KYC step advanced via dashboard",
    );
    return jsonResponse(state);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (msg.includes("not found")) return jsonResponse({ error: msg }, 404);
    return jsonResponse({ error: msg }, 500);
  }
}

async function handleKycDecide(req: Request, candidateId: string): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const { decision, decidedBy, mlroSignOffId } = body as {
    decision?: string;
    decidedBy?: string;
    mlroSignOffId?: string;
  };
  if (decision !== "accept" && decision !== "reject") {
    return jsonResponse({ error: "decision must be 'accept' or 'reject'" }, 400);
  }
  if (!decidedBy || typeof decidedBy !== "string") {
    return jsonResponse({ error: "decidedBy is required" }, 400);
  }
  try {
    const state = await kycOrchestrator.recordHumanDecision(
      candidateId,
      decision,
      decidedBy,
      mlroSignOffId,
    );
    refresh("kyc-decide");
    logger.info({ candidateId, decision, decidedBy }, "KYC human decision recorded via dashboard");
    return jsonResponse(state);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (msg.includes("not found")) return jsonResponse({ error: msg }, 404);
    return jsonResponse({ error: msg }, 500);
  }
}

function handleKycClientRefresh(clientId: string): Response {
  const asOf = nowUtc();
  const evt = {
    event_id: newEventId(),
    type: "KYCRefreshScheduled",
    as_of: asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human" as const, id: "marc@tgv.co.za" },
    citations: ["D-KYC-ONBOARDING-BUILD", "AML-CFT-POLICY-V1", "FIC-ACT-38-2001"],
    payload: {
      clientId,
      scheduledAt: asOf,
      reason: "early-refresh-requested",
    },
  };
  eventStore.append(evt);
  refresh("kyc-client-refresh");
  logger.info({ clientId, eventId: evt.event_id }, "KYCRefreshScheduled emitted via dashboard");
  return jsonResponse({ ok: true, clientId, eventId: evt.event_id });
}

async function handleKycSimulate(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const {
    scenario,
    count = 1,
    runFull = false,
  } = body as {
    scenario?: string;
    count?: number;
    runFull?: boolean;
  };
  if (!scenario || typeof scenario !== "string") {
    return jsonResponse({ error: "scenario is required" }, 400);
  }

  // Import sim module dynamically to avoid circular dependencies.
  let simModule: { SCENARIOS?: Record<string, () => NewCandidateInput> };
  try {
    simModule = await import("../scripts/kyc/sim");
  } catch {
    return jsonResponse({ error: "sim module not available" }, 500);
  }

  const SCENARIOS = (simModule as { SCENARIOS?: Record<string, () => NewCandidateInput> })
    .SCENARIOS;
  if (!SCENARIOS || !(scenario in SCENARIOS)) {
    const available = SCENARIOS ? Object.keys(SCENARIOS).join(", ") : "(unknown)";
    return jsonResponse({ error: `unknown scenario "${scenario}". Available: ${available}` }, 400);
  }

  const safeCount = Math.max(1, Math.min(10, Number(count) || 1));
  const orchestrator = new KYCOrchestrator();
  const results: Array<{
    candidateId: string;
    entityName: string;
    scenario: string;
    finalStep: string;
    outcome: string;
    riskBand?: string;
  }> = [];

  for (let i = 0; i < safeCount; i++) {
    const input = SCENARIOS[scenario]?.();
    if (safeCount > 1) input.entityName = `${input.entityName} #${i + 1}`;
    try {
      const { candidateId } = await orchestrator.startOnboarding(input);
      let state = await orchestrator.getCandidateState(candidateId);
      if (runFull) {
        state = await orchestrator.runFull(candidateId);
      }
      results.push({
        candidateId,
        entityName: input.entityName,
        scenario,
        finalStep: state.currentStep,
        outcome: state.status,
        riskBand: state.riskBand,
      });
    } catch (_e) {
      results.push({
        candidateId: `error-${i}`,
        entityName: "error",
        scenario,
        finalStep: "error",
        outcome: "error",
      });
    }
  }

  refresh("kyc-simulate");
  logger.info(
    { scenario, count: safeCount, runFull },
    `KYC simulation completed: ${results.length} candidates`,
  );
  return jsonResponse({ results });
}

// ---------------------------------------------------------------------------
// Products (NPA & review console) — five POST handlers.
//
// Each handler validates a JSON body, constructs the appropriate typed event
// via the product.ts factories, appends it to the event store, and refreshes
// the cached state. Authority: D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved
// 2026-05-10).
// ---------------------------------------------------------------------------

/**
 * One-shot bus tick after a dashboard append. Mirrors the runtime's
 * post-run bus hook (runtime/run.ts §"Bus-tick hook"): immediately fans
 * the just-appended event to any subscribed event-driven handler. Lets
 * the /products narrative-request endpoint trigger
 * atlas:product-narrative-fulfilment without waiting for the
 * standalone `bus:tick` cron.
 */
let productsBusSingleton: LocalEventTriggerBus | undefined;
async function tickBusForProducts(fromSequence: number): Promise<void> {
  try {
    if (!productsBusSingleton) {
      productsBusSingleton = new LocalEventTriggerBus({
        eventStore,
        source: defaultBusSource(),
        runner: async ({ agent, trigger }) => {
          const out = await runAgent({ agent, trigger, dryRun: false });
          return { ok: out.ok };
        },
      });
      productsBusSingleton.syncSubscriptions();
    }
    await productsBusSingleton.tick(fromSequence, new Date()); // wall-clock: bus-tick dispatch timestamp
  } catch (err) {
    logger.warn(
      { fromSequence, err: (err as Error).message },
      "products: bus tick failed (non-fatal); event remains pending for next bus:tick",
    );
  }
}

const PRODUCT_FAMILY_VALUES = [
  "listed-equity",
  "listed-bond",
  "repo",
  "otc-ird",
  "fx",
  "structured",
] as const;

const NPA_DIMENSION_VALUES = [
  "market-risk",
  "credit-risk",
  "liquidity-funding",
  "operational-risk",
  "operational-readiness",
  "accounting",
  "capital",
  "conduct-suitability",
  "aml-sanctions-pep",
  "model-risk",
  "legal-documentation",
  "information-security",
  "privacy",
  "tax",
] as const;

async function handleProductPropose(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const family = typeof body.family === "string" ? body.family : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const currency = typeof body.currency === "string" ? body.currency : "";
  const jurisdiction = typeof body.jurisdiction === "string" ? body.jurisdiction : "";
  const proposedBy =
    typeof body.proposedBy === "string" && body.proposedBy.trim().length > 0
      ? body.proposedBy.trim()
      : "marc@tgv.co.za";
  if (!productId || !family || !name) {
    return jsonResponse({ error: "productId, family, name are required" }, 400);
  }
  if (!PRODUCT_FAMILY_VALUES.includes(family as (typeof PRODUCT_FAMILY_VALUES)[number])) {
    return jsonResponse(
      { error: `family must be one of ${PRODUCT_FAMILY_VALUES.join(", ")}` },
      400,
    );
  }
  const asOf = nowUtc();
  try {
    const evt = makeProductProposalRegistered({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: proposedBy },
      citations: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
      payload: {
        productId,
        family: family as (typeof PRODUCT_FAMILY_VALUES)[number],
        proposedBy,
        asOf,
      },
    });
    // Augment the payload with optional descriptive fields the projection
    // reads (name, description, currency, jurisdiction). The schema accepts
    // additional payload keys via z.record.
    const enriched = {
      ...evt,
      payload: {
        ...(evt.payload as Record<string, unknown>),
        name,
        description,
        currency,
        jurisdiction,
      },
    };
    eventStore.append(enriched);
    refresh("product-propose");
    logger.info({ productId, family }, "ProductProposalRegistered emitted via dashboard");
    return jsonResponse({ ok: true, eventId: evt.event_id, productId }, 201);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
}

async function handleProductAttest(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const dimension = typeof body.dimension === "string" ? body.dimension : "";
  const result = typeof body.result === "string" ? body.result : "";
  const citationChain = Array.isArray(body.citationChain)
    ? (body.citationChain as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const attestedBy =
    typeof body.attestedBy === "string" && body.attestedBy.trim().length > 0
      ? body.attestedBy.trim()
      : "marc@tgv.co.za";
  if (!productId || !dimension || !result) {
    return jsonResponse({ error: "productId, dimension, result are required" }, 400);
  }
  if (!NPA_DIMENSION_VALUES.includes(dimension as (typeof NPA_DIMENSION_VALUES)[number])) {
    return jsonResponse({ error: "dimension must be one of NPA Policy §5" }, 400);
  }
  if (!["design-attested", "implementation-attested", "failed"].includes(result)) {
    return jsonResponse(
      { error: "result must be design-attested | implementation-attested | failed" },
      400,
    );
  }
  if (citationChain.length === 0) {
    return jsonResponse({ error: "citationChain must contain at least one citation" }, 400);
  }
  try {
    const evt = makeProductDimensionAttested({
      asOf: nowUtc(),
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: attestedBy },
      citations: citationChain,
      payload: {
        productId,
        dimension,
        result: result as "design-attested" | "implementation-attested" | "failed",
        citationChain,
      },
    });
    eventStore.append(evt);
    refresh("product-attest");
    logger.info({ productId, dimension, result }, "ProductDimensionAttested emitted via dashboard");
    return jsonResponse({ ok: true, eventId: evt.event_id }, 201);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
}

async function handleProductApprove(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const version = typeof body.version === "string" ? body.version : "1.0.0";
  const conditions = Array.isArray(body.conditions)
    ? (body.conditions as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const approvedBy =
    typeof body.approvedBy === "string" && body.approvedBy.trim().length > 0
      ? body.approvedBy.trim()
      : "marc@tgv.co.za";
  if (!productId) {
    return jsonResponse({ error: "productId is required" }, 400);
  }
  try {
    const evt = makeProductApproved({
      asOf: nowUtc(),
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: approvedBy },
      citations: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
      payload: { productId, version, conditions, approvedBy },
    });
    eventStore.append(evt);
    refresh("product-approve");
    logger.info({ productId, approvedBy }, "ProductApproved emitted via dashboard");
    return jsonResponse({ ok: true, eventId: evt.event_id }, 201);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
}

/**
 * POST /api/seeds/descope — emit SeedDescoped so a descopable boot seed is
 * skipped at next boot (objective 1 of D-TRUSTED-FIGURES-PROGRAM-V1). The
 * skip takes effect on the next server boot (boot seeds run once at startup);
 * the response says so explicitly rather than implying an immediate effect.
 */
async function obligationActionBody(req: Request): Promise<{ id: string; actorId: string } | null> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return null;
  const actorId =
    typeof body.actor === "string" && body.actor.trim().length > 0
      ? body.actor.trim()
      : "marc@tgv.co.za";
  return { id, actorId };
}

/** POST /api/obligations/adopt — the bank adopts a (seed) obligation: emits ObligationAdopted. */
async function handleObligationAdopt(req: Request): Promise<Response> {
  const parsed = await obligationActionBody(req);
  if (!parsed) return jsonResponse({ error: "body must be { id }" }, 400);
  const { id, actorId } = parsed;
  // Prefer the authored seed row; otherwise adopt straight from the knowledge
  // base (BCBS / extracted source obligations). The bank obligation derives from
  // the source provision (the DERIVES_FROM bridge); owner / fulfilment policy are
  // assigned later via lifecycle transitions ("adopt now, refine later").
  const row = loadObligationSeed(REPO_ROOT).find((r) => r.id === id);
  const now = nowUtc();
  let payload: Parameters<typeof makeObligationAdopted>[0]["payload"];
  if (row) {
    payload = {
      obligationId: row.id,
      urn: row.urn ?? "",
      domain: row.section ?? "",
      citation: row.citation ?? "",
      requirement: row.requirement ?? "",
      fulfilmentPolicy: row.fulfilmentPolicy ?? "",
      owner: row.owner ?? "",
      status: row.reviewStatus || "active",
      adoptedAt: now,
    };
  } else {
    const kb = findKnowledgeBaseObligation(id);
    if (!kb) return jsonResponse({ error: `unknown obligation "${id}"` }, 404);
    payload = {
      obligationId: kb.key,
      urn: kb.nodeId,
      domain: kb.domain || kb.standard,
      citation: kb.citation,
      requirement: kb.requirement,
      fulfilmentPolicy: "",
      // Populate owner AT EMIT TIME from the shared Basel-family → seat map so
      // adopting a graph-imported BCBS obligation never re-introduces an
      // empty-owner row that silently reverts the #1143 backfill. A family with
      // no mapping (or a non-BCBS knowledge-base id) yields "" — left empty, not
      // guessed. D-OBLIGATIONS-REGISTER-CLEANUP · WS-OBLIGATIONS-CLEANUP.
      owner: seatForBcbsObligationId(kb.key),
      status: "adopted",
      derivesFrom: kb.sourceProvision ? [kb.sourceProvision] : [],
      adoptedAt: now,
    };
  }
  const evt = makeObligationAdopted({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: actorId },
    citations: ["D-REGULATORY-ARCHITECTURE-TWO-PLANE", "P1-EVENTS-AS-TRUTH"],
    payload,
  });
  eventStore.append(evt);
  logger.info({ id, actorId }, "ObligationAdopted emitted via dashboard");
  return jsonResponse({ ok: true, eventId: evt.event_id, id }, 201);
}

/** POST /api/obligations/unadopt — the bank rejects/un-adopts an obligation. */
async function handleObligationUnadopt(req: Request): Promise<Response> {
  const parsed = await obligationActionBody(req);
  if (!parsed) return jsonResponse({ error: "body must be { id }" }, 400);
  const { id, actorId } = parsed;
  const now = nowUtc();
  const evt = makeObligationLifecycleTransitioned({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: actorId },
    citations: ["D-REGULATORY-ARCHITECTURE-TWO-PLANE", "P1-EVENTS-AS-TRUTH"],
    payload: { obligationId: id, transition: "un-adopted", toStatus: "un-adopted", at: now },
  });
  eventStore.append(evt);
  logger.info({ id, actorId }, "Obligation un-adopted via dashboard");
  return jsonResponse({ ok: true, eventId: evt.event_id, id }, 201);
}

// ---------------------------------------------------------------------------
// Provision-scope adoption helpers
// ---------------------------------------------------------------------------

/**
 * Load the structured doc for a slug via the shared slug-resolving, enriching
 * loader (platform/regulatory/structured-doc-loader.ts). Resolves by the
 * JSON's internal `slug` field (BCBS files are named by bare standard, e.g.
 * mar-structured.json → slug bcbs-mar), fills BCBS section text from
 * chapter-text.json, and assigns the same deterministic provision ids the
 * reader view renders — so client scopeIds always resolve here.
 */
function loadStructuredDocForSlug(slug: string): RegStructuredDocMinimal | null {
  return loadStructuredDocBySlug(slug, REPO_ROOT) as RegStructuredDocMinimal | null;
}

/**
 * GET /api/regulation-reader/:slug/adoption-state
 * Returns the ProvisionAdoptionState for the instrument — scope events keyed
 * by scopeId. Client combines with the provision tree to compute three-state
 * checkboxes (checked / unchecked / indeterminate).
 */
async function handleRegAdoptionState(_req: Request, slug: string): Promise<Response> {
  const state = loadProvisionAdoptionState(eventStore, slug);
  return jsonResponse({ slug, scopes: state.scopes });
}

/**
 * POST /api/regulation-reader/:slug/adopt
 * Body: { scopeId: string; adopted: boolean; adoptedBy?: string }
 * Emits ProvisionScopeAdopted event; returns updated adoption state.
 */
async function handleRegAdopt(req: Request, slug: string): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const scopeId = typeof body.scopeId === "string" ? body.scopeId.trim() : "";
  const adopted = typeof body.adopted === "boolean" ? body.adopted : null;
  const adoptedBy =
    typeof body.adoptedBy === "string" && body.adoptedBy.trim()
      ? body.adoptedBy.trim()
      : "marc@tgv.co.za";
  if (!scopeId || adopted === null) {
    return jsonResponse({ error: "scopeId (string) and adopted (boolean) are required" }, 400);
  }

  const doc = loadStructuredDocForSlug(slug);
  if (!doc) return jsonResponse({ error: `Instrument not found: ${slug}` }, 404);

  const tree = buildProvisionTree(doc);
  if (!tree.has(scopeId) && scopeId !== slug) {
    return jsonResponse({ error: `scopeId not found in instrument: ${scopeId}` }, 400);
  }
  const verbatimHash = computeScopeVerbatimHash(tree, scopeId);

  const now = nowUtc();
  const evt = makeProvisionScopeAdopted({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: adoptedBy },
    citations: ["D-REGULATORY-ARCHITECTURE-TWO-PLANE", "P1-EVENTS-AS-TRUTH"],
    payload: { instrumentSlug: slug, scopeId, adopted, adoptedBy, adoptedAt: now, verbatimHash },
  });
  eventStore.append(evt);
  logger.info({ slug, scopeId, adopted, adoptedBy }, "ProvisionScopeAdopted emitted");

  const state = loadProvisionAdoptionState(eventStore, slug);
  return jsonResponse({ ok: true, eventId: evt.event_id, scopes: state.scopes }, 201);
}

// DistillationProposal — the shape returned by /distill for human review.
interface DistillationProposal {
  suggestedSlug: string;
  suggestedUrn: string;
  suggestedOrgId: string;
  requirement: string;
  contributingProvisionIds: string[];
  verbatimSourceText: Record<string, string>;
  confidence: number;
}

const DISTILLATION_SYSTEM_PROMPT = `You are a regulatory compliance specialist helping a South African bank create obligation records from adopted regulation provisions.

Given a list of adopted regulation provisions (each with an ID, heading, and verbatim text), cluster them into 1–5 semantically coherent obligation groups. Each group represents one discrete compliance obligation the bank must meet.

Return ONLY a JSON array of obligation proposals. Each element must have:
- suggestedSlug: kebab-case identifier (e.g. "minimum-capital-adequacy")
- suggestedUrn: "urn:obligation:bank:<domain>:<slug>" (infer domain from context)
- suggestedOrgId: "ORG-<DOMAIN>-<nn>" (e.g. "ORG-CAP-01")
- requirement: a concise (1–3 sentence) plain-English description of what the bank must do
- contributingProvisionIds: array of provision IDs that underlie this obligation
- verbatimSourceText: object mapping each contributing provisionId to a short verbatim quote (max 200 chars per entry)
- confidence: float 0–1 reflecting how clear the grouping is

Group provisions that address the same compliance topic. If a provision stands alone, give it its own group.
Return a valid JSON array only — no preamble, no markdown fences.`;

/**
 * POST /api/regulation-reader/:slug/distill
 * Body: { scopeId?: string }   (defaults to whole instrument)
 * Collects adopted leaves under scopeId, calls LLM, returns DistillationProposal[].
 * No events emitted — proposals are returned for human review.
 */
async function handleRegDistill(req: Request, slug: string): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const scopeId =
    typeof body.scopeId === "string" && body.scopeId.trim() ? body.scopeId.trim() : slug;

  const doc = loadStructuredDocForSlug(slug);
  if (!doc) return jsonResponse({ error: `Instrument not found: ${slug}` }, 404);

  const tree = buildProvisionTree(doc);
  const state = loadProvisionAdoptionState(eventStore, slug);
  const scopeEvents = Object.entries(state.scopes).map(([sid, s]) => ({
    scopeId: sid,
    adopted: s.adopted,
    adoptedAt: s.adoptedAt,
  }));

  const allLeaves = getLeafDescendants(tree, scopeId);
  const adoptedLeaves = allLeaves.filter((leafId) =>
    resolveLeafAdoptionState(leafId, tree, scopeEvents),
  );

  if (adoptedLeaves.length === 0) {
    return jsonResponse({ proposals: [], message: "No adopted provisions in this scope" });
  }

  // ── Provider selection ──
  // BANK_DISTILL_PROVIDER ∈ { "anthropic" (default) | "gemini" | "stub" }.
  // BANK_DISTILL_STUB=1 is kept as a back-compat alias for "stub".
  // Gemini scope: distillation only — all other narrative paths stay on
  // Claude (runtime/claude.ts). Distillation sends only published regulation
  // text (Plane A), so the cheaper provider carries no data-protection cost.
  const distillProvider =
    process.env.BANK_DISTILL_STUB === "1"
      ? "stub"
      : (process.env.BANK_DISTILL_PROVIDER ?? "anthropic");

  // ── Stub mode — deterministic heuristic proposals ──
  // Lets the full tick → distill → review → approve flow be exercised with no
  // API key at all. Proposals are clearly labelled: ORG-STUB-* ids,
  // confidence 0, requirement prefixed "[STUB]". Never enabled by default.
  if (distillProvider === "stub") {
    const groups = new Map<string, string[]>();
    for (const leafId of adoptedLeaves) {
      const parentId = tree.get(leafId)?.parentId ?? scopeId;
      const g = groups.get(parentId);
      if (g) g.push(leafId);
      else groups.set(parentId, [leafId]);
    }
    const stubProposals: DistillationProposal[] = [...groups.entries()].map(
      ([parentId, leaves], i) => {
        const parent = tree.get(parentId);
        const heading = [parent?.number, parent?.heading].filter(Boolean).join(" ") || parentId;
        const verbatim: Record<string, string> = {};
        for (const l of leaves) {
          const t = (tree.get(l)?.text ?? "").trim();
          if (t) verbatim[l] = t.slice(0, 180);
        }
        const firstText = leaves
          .map((l) => (tree.get(l)?.text ?? "").trim())
          .find((t) => t.length > 0);
        const slugPart = heading
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40);
        return {
          suggestedSlug: `stub-${slugPart || `group-${i + 1}`}`,
          suggestedUrn: `urn:obligation:bank:stub:${slugPart || `group-${i + 1}`}`,
          suggestedOrgId: `ORG-STUB-${String(i + 1).padStart(2, "0")}`,
          requirement: `[STUB — heuristic, no LLM] Comply with "${heading}" of ${doc.title ?? slug}: ${(firstText ?? "(no verbatim text)").slice(0, 200)}`,
          contributingProvisionIds: leaves,
          verbatimSourceText: verbatim,
          confidence: 0,
        };
      },
    );
    logger.info(
      { slug, scopeId, groups: stubProposals.length },
      "distill served by STUB mode (BANK_DISTILL_PROVIDER=stub)",
    );
    return jsonResponse({
      slug,
      scopeId,
      adoptedCount: adoptedLeaves.length,
      stub: true,
      provider: "stub",
      proposals: stubProposals,
    });
  }

  // Build the user prompt listing adopted provision texts
  const provisionLines = adoptedLeaves
    .map((leafId) => {
      const node = tree.get(leafId);
      const text = (node?.text ?? "").trim();
      const heading = [node?.number, node?.heading].filter(Boolean).join(" ");
      return `### ${leafId}${heading ? ` — ${heading}` : ""}\n${text || "(no verbatim text)"}`;
    })
    .join("\n\n");

  const userInput = `Instrument: ${slug} (${doc.title ?? slug})
Scope: ${scopeId}
Excluded (unadopted): ${allLeaves.filter((l) => !adoptedLeaves.includes(l)).length} provisions

Adopted provisions (${adoptedLeaves.length}):\n\n${provisionLines}`;

  // No `meta` — there is no agent run to record token usage against
  // (interactive dashboard request; the request is logged below either way).
  const narrativeReq = {
    stableSystem: DISTILLATION_SYSTEM_PROMPT,
    userInput,
    maxTokens: 4096,
    effort: "medium" as const,
  };
  const llmResult =
    distillProvider === "gemini"
      ? await tryGenerateNarrativeGemini(narrativeReq)
      : await tryGenerateNarrative(narrativeReq);

  if (!llmResult.ok) {
    logger.warn(
      { slug, scopeId, provider: distillProvider, error: llmResult.error },
      "LLM distillation failed",
    );
    return jsonResponse(
      {
        error: "LLM distillation failed",
        provider: distillProvider,
        detail: llmResult.error,
        retryable: llmResult.retryable,
      },
      502,
    );
  }

  let proposals: DistillationProposal[] = [];
  try {
    const parsed = JSON.parse(llmResult.result.text);
    proposals = Array.isArray(parsed) ? (parsed as DistillationProposal[]) : [];
  } catch {
    logger.warn({ slug, scopeId, text: llmResult.result.text }, "LLM response was not valid JSON");
    return jsonResponse(
      { error: "LLM returned invalid JSON", rawText: llmResult.result.text },
      502,
    );
  }

  return jsonResponse({
    slug,
    scopeId,
    adoptedCount: adoptedLeaves.length,
    provider: distillProvider,
    model: llmResult.result.model,
    proposals,
  });
}

// ApprovedObligation — submitted by the UI after the human reviews LLM proposals.
interface ApprovedObligation {
  obligationId: string;
  urn: string;
  requirement: string;
  derivesFrom: string[];
  /** Provision id → verbatim quote, snapshotted at adoption time. */
  verbatimSourceText?: Record<string, string>;
  owner: string;
  domain: string;
}

/**
 * POST /api/regulation-reader/:slug/adopt-obligations
 * Body: { obligations: ApprovedObligation[] }
 * Emits ObligationAdopted per approved obligation. Returns new obligation IDs.
 */
async function handleRegAdoptObligations(req: Request, slug: string): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.obligations) || body.obligations.length === 0) {
    return jsonResponse({ error: "obligations array is required and must be non-empty" }, 400);
  }

  const now = nowUtc();
  const emitted: string[] = [];

  // Snapshot FULL verbatim text per contributing provision from the source
  // doc at approval time — authoritative, not the LLM's truncated quotes.
  // Client-sent quotes are a fallback for provisions that no longer resolve.
  const approvalDoc = loadStructuredDocForSlug(slug);
  const approvalTree = approvalDoc ? buildProvisionTree(approvalDoc) : null;

  // W8 Slice C — distill → applicability closed loop. Build the candidate
  // operating context(s) from the bank's active posture register ONCE before
  // the loop, and snapshot the already-concluded assessment ids for the
  // idempotency guard. After each ObligationAdopted append we auto-assess the
  // obligation's applicability and emit the S8 lifecycle (REUSE — no new event
  // type). A future event-driven bus handler (subscribe ObligationAdopted, like
  // owen-decision-impact-sweep) would catch non-dashboard adoptions; the inline
  // path keeps the dashboard adopt action responsive. (Out of scope here.)
  const postureRegister = readPostureRegister(eventStore);
  const applicabilityContexts = buildBankPostureContexts(postureRegister);
  const alreadyAssessed = concludedAssessmentIds(eventStore);
  const applicabilityActor = {
    type: "service" as const,
    id: "agent:mira:obligation-applicability",
  };
  const applicabilityCitations = [
    "D-W8-POSTURE-REGISTER-SLICE-1",
    "P1-EVENTS-AS-TRUTH",
    "P2-SINGLE-GRAPH-DISCIPLINE",
  ];

  for (const ob of body.obligations as ApprovedObligation[]) {
    if (!ob.obligationId || !ob.requirement) continue;
    const verbatim: Record<string, string> = {};
    for (const provId of ob.derivesFrom ?? []) {
      const fullText = approvalTree?.get(provId)?.text?.trim();
      const fallback = ob.verbatimSourceText?.[provId];
      if (fullText) verbatim[provId] = fullText;
      else if (fallback) verbatim[provId] = fallback;
    }
    const evt = makeObligationAdopted({
      asOf: now,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["D-REGULATORY-ARCHITECTURE-TWO-PLANE", "P1-EVENTS-AS-TRUTH"],
      payload: {
        obligationId: ob.obligationId,
        urn: ob.urn ?? "",
        domain: ob.domain ?? "",
        citation: slug,
        requirement: ob.requirement,
        fulfilmentPolicy: "",
        owner: ob.owner ?? "",
        status: "active",
        derivesFrom: ob.derivesFrom ?? [],
        ...(Object.keys(verbatim).length > 0 ? { verbatimSourceText: verbatim } : {}),
        adoptedAt: now,
      },
    });
    eventStore.append(evt);
    emitted.push(ob.obligationId);

    // W8 Slice C — auto-assess the adopted obligation's applicability against
    // the bank's posture-derived contexts and emit the S8 lifecycle. Idempotent:
    // skip if an ApplicabilityAssessmentConcluded with this assessmentId already
    // exists (same obligation, same as-of day) — mirrors the
    // owen-decision-impact-sweep guard.
    const assessmentId = obligationAssessmentId(ob.obligationId, now);
    if (alreadyAssessed.has(assessmentId)) continue;
    alreadyAssessed.add(assessmentId); // guard intra-batch repeats of the same id

    // subjectRef is the obligationId (the detail view folds Concluded events by
    // subjectRef === obligation id; see dashboard/bank-obligations-view.ts).
    const subjectRef = ob.obligationId;
    const { appliesToScope, contextsEvaluated, result } = assessObligationApplicability(
      {
        obligationId: ob.obligationId,
        derivesFrom: ob.derivesFrom ?? [],
        domain: ob.domain ?? "",
      },
      applicabilityContexts,
    );

    eventStore.append(
      makeApplicabilityAssessmentRequested({
        asOf: now,
        entity: "LE-ZA-HOZ-BANK",
        actor: applicabilityActor,
        citations: applicabilityCitations,
        payload: {
          assessmentId,
          subjectRef,
          subjectKind: "obligation",
          appliesToScope,
          requestedBy: applicabilityActor.id,
          citations: applicabilityCitations,
        },
      }),
    );
    eventStore.append(
      makeApplicabilityAssessmentPerformed({
        asOf: now,
        entity: "LE-ZA-HOZ-BANK",
        actor: applicabilityActor,
        citations: applicabilityCitations,
        payload: {
          assessmentId,
          contextsEvaluated,
          matches: result.matches,
          performedBy: applicabilityActor.id,
          performedAt: now,
        },
      }),
    );
    eventStore.append(
      makeApplicabilityAssessmentConcluded({
        asOf: now,
        entity: "LE-ZA-HOZ-BANK",
        actor: applicabilityActor,
        citations: applicabilityCitations,
        payload: {
          assessmentId,
          verdict: result.verdict,
          appliesToContexts: result.matches,
          rationale: result.rationale,
          concludedBy: applicabilityActor.id,
          concludedAt: now,
          citations: applicabilityCitations,
        },
      }),
    );
  }

  logger.info({ slug, count: emitted.length }, "ObligationAdopted events emitted from tick-flow");
  return jsonResponse({ ok: true, slug, adopted: emitted }, 201);
}

async function handleSeedDescope(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const seedId = typeof body.seedId === "string" ? body.seedId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const actorId =
    typeof body.actor === "string" && body.actor.trim().length > 0
      ? body.actor.trim()
      : "marc@tgv.co.za";
  if (!seedId) return jsonResponse({ error: "seedId is required" }, 400);
  if (!reason) return jsonResponse({ error: "reason is required" }, 400);
  const entry = getSeedManifestEntry(seedId);
  if (!entry) return jsonResponse({ error: `unknown seedId "${seedId}"` }, 400);
  if (!entry.descopable) {
    return jsonResponse(
      { error: `seed "${seedId}" is structural (not descopable) — ${entry.title}` },
      400,
    );
  }
  try {
    const evt = makeSeedDescoped({
      asOf: nowUtc(),
      entity: "LE-BANK-SA",
      actor: { type: "human", id: actorId },
      citations: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
      payload: { seedId, reason },
    });
    eventStore.append(evt);
    logger.info({ seedId, actorId }, "SeedDescoped emitted via dashboard");
    return jsonResponse(
      {
        ok: true,
        eventId: evt.event_id,
        effect: "Seed will be skipped at next server boot. Bounce the server to apply.",
      },
      201,
    );
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
}

/**
 * POST /api/seeds/promote — emit SeedPromotedToSimulated, recording that a boot
 * seed has been replaced by author-driven simulated events (links the
 * replacement event ids). Also descopes the seed at next boot.
 */
async function handleSeedPromote(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const seedId = typeof body.seedId === "string" ? body.seedId.trim() : "";
  const replacementEventIds = Array.isArray(body.replacementEventIds)
    ? (body.replacementEventIds as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const note = typeof body.note === "string" ? body.note.trim() : undefined;
  const actorId =
    typeof body.actor === "string" && body.actor.trim().length > 0
      ? body.actor.trim()
      : "marc@tgv.co.za";
  if (!seedId) return jsonResponse({ error: "seedId is required" }, 400);
  const entry = getSeedManifestEntry(seedId);
  if (!entry) return jsonResponse({ error: `unknown seedId "${seedId}"` }, 400);
  if (!entry.descopable) {
    return jsonResponse(
      { error: `seed "${seedId}" is structural (not descopable) — ${entry.title}` },
      400,
    );
  }
  try {
    const evt = makeSeedPromotedToSimulated({
      asOf: nowUtc(),
      entity: "LE-BANK-SA",
      actor: { type: "human", id: actorId },
      citations: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
      payload: { seedId, replacementEventIds, note },
    });
    eventStore.append(evt);
    logger.info(
      { seedId, replacements: replacementEventIds.length, actorId },
      "SeedPromotedToSimulated emitted via dashboard",
    );
    return jsonResponse(
      {
        ok: true,
        eventId: evt.event_id,
        effect: "Seed replaced + descoped at next boot. Bounce the server to apply.",
      },
      201,
    );
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
}

async function handleProductNarrative(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const dimension = typeof body.dimension === "string" ? body.dimension : "";
  const narrative = typeof body.narrative === "string" ? body.narrative.trim() : "";
  const authorAgentName =
    typeof body.authorAgentName === "string" ? body.authorAgentName.trim() : "";
  const authorAgentPosition =
    typeof body.authorAgentPosition === "string" ? body.authorAgentPosition.trim() : "";
  const citationChain = Array.isArray(body.citationChain)
    ? (body.citationChain as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  if (!productId || !dimension || !narrative || !authorAgentName || !authorAgentPosition) {
    return jsonResponse(
      {
        error: "productId, dimension, narrative, authorAgentName, authorAgentPosition are required",
      },
      400,
    );
  }
  if (!NPA_DIMENSION_VALUES.includes(dimension as (typeof NPA_DIMENSION_VALUES)[number])) {
    return jsonResponse({ error: "dimension must be one of NPA Policy §5" }, 400);
  }
  if (citationChain.length === 0) {
    return jsonResponse({ error: "citationChain must contain at least one citation" }, 400);
  }
  try {
    const evt = makeProductDimensionNarrativeRecorded({
      asOf: nowUtc(),
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: citationChain,
      payload: {
        productId,
        dimension,
        narrative,
        authorAgentName,
        authorAgentPosition,
        citationChain,
      },
    });
    eventStore.append(evt);
    refresh("product-narrative");
    logger.info(
      { productId, dimension, authorAgentName },
      "ProductDimensionNarrativeRecorded emitted",
    );
    return jsonResponse({ ok: true, eventId: evt.event_id }, 201);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
}

async function handleProductNarrativeRequest(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "body must be a JSON object" }, 400);
  }
  const body = raw as Record<string, unknown>;
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const dimension = typeof body.dimension === "string" ? body.dimension : "";
  const requestedFromAgentName =
    typeof body.requestedFromAgentName === "string" ? body.requestedFromAgentName.trim() : "";
  const requestedFromAgentPosition =
    typeof body.requestedFromAgentPosition === "string"
      ? body.requestedFromAgentPosition.trim()
      : "";
  const note = typeof body.note === "string" ? body.note.trim() : undefined;
  if (!productId || !dimension || !requestedFromAgentName || !requestedFromAgentPosition) {
    return jsonResponse(
      {
        error:
          "productId, dimension, requestedFromAgentName, requestedFromAgentPosition are required",
      },
      400,
    );
  }
  if (!NPA_DIMENSION_VALUES.includes(dimension as (typeof NPA_DIMENSION_VALUES)[number])) {
    return jsonResponse({ error: "dimension must be one of NPA Policy §5" }, 400);
  }
  try {
    const seqBefore = eventStore.highWatermark();
    const evt = makeProductDimensionNarrativeRequested({
      asOf: nowUtc(),
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
      payload: {
        productId,
        dimension,
        requestedFromAgentName,
        requestedFromAgentPosition,
        ...(note ? { note } : {}),
      },
    });
    eventStore.append(evt);
    // Fan the request to atlas:product-narrative-fulfilment (and any future
    // subscriber). The handler emits ProductDimensionNarrativeRecorded
    // before this request returns, so the next /api/products/:id read
    // shows the narrative.
    await tickBusForProducts(seqBefore + 1);
    refresh("product-narrative-request");
    logger.info(
      { productId, dimension, requestedFromAgentName },
      "ProductDimensionNarrativeRequested emitted",
    );
    return jsonResponse({ ok: true, eventId: evt.event_id }, 201);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
}

// ---------------------------------------------------------------------------
// FX desk Slice 2 — RFQ quote + trade-emit handlers.
// ---------------------------------------------------------------------------

async function handleFxQuote(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid JSON body" }, 400);
  }
  const parsed = RfqBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const result = quoteOnly(parsed.data as RfqInput);
  if (result.status === "rejected") {
    return jsonResponse(result, 400);
  }
  return jsonResponse(result);
}

async function handleFxTrade(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid JSON body" }, 400);
  }
  const parsed = RfqBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }

  let result: TradeEmitResult;
  try {
    result = emitTrade({
      store: eventStore,
      input: parsed.data as RfqInput,
      asOf: nowUtc(),
    });
  } catch (e) {
    // CDM zod-parse / append-rejection failures land here.
    return jsonResponse({ status: "rejected", reason: (e as Error).message }, 400);
  }

  if (result.status === "rejected") {
    return jsonResponse(result, 400);
  }
  refresh("fx-trade");
  logger.info(
    {
      tradeId: result.tradeId,
      rfqId: result.rfqId,
      eventId: result.eventId,
      provenanceScenario: result.provenance.scenario,
    },
    "FX trade event emitted via dashboard",
  );
  return jsonResponse(result);
}

async function handleFxOrder(req: Request): Promise<Response> {
  // FX desk Slice 4 — order acceptance + gateway pipeline.
  // Validates the RFQ form input, prices a synthetic quote, then routes
  // the order through the 7-check pre-trade gateway. Returns a
  // GatewayOrderResult with per-check outcomes.
  // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ status: "rejected", reason: "invalid JSON body" }, 400);
  }
  const parsed = RfqBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }

  let result: GatewayOrderResult;
  try {
    const rfqInput = parsed.data as RfqInput;
    const quote = quoteRfq(rfqInput);
    result = routeOrderToGateway({
      store: eventStore,
      rfqInput,
      quote,
      asOf: nowUtc(),
    });
  } catch (e) {
    return jsonResponse({ status: "rejected", reason: (e as Error).message }, 400);
  }

  if (result.status === "rejected") {
    return jsonResponse(result, 200);
  }
  refresh("fx-order");
  return jsonResponse(result);
}

async function handleStartWorkstream(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const parsed = StartWorkstreamBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  const item = cachedState.inFlight.find((i) => i.id === body.id);
  if (!item) {
    return jsonResponse({ error: `In-flight item not found: ${body.id}` }, 404);
  }
  if (item.active) {
    return jsonResponse({ error: `In-flight item already active: ${body.id}` }, 409);
  }

  const actor =
    typeof body.actor === "string" && body.actor.trim().length > 0
      ? body.actor.trim()
      : "marc@tgv.co.za";
  const event: Event = {
    event_id: newEventId(),
    type: "WorkstreamStarted",
    as_of: nowUtc(),
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: actor },
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    payload: {
      workstreamId: item.id,
      what: item.what,
      owner: item.owner,
      ...(item.briefDoc ? { briefDoc: item.briefDoc } : {}),
    },
  };
  eventStore.append(event);
  refresh("inflight-start");
  const updated = cachedState.inFlight.find((i) => i.id === body.id);

  logger.info({ workstreamId: item.id, eventId: event.event_id }, "Workstream started");
  return jsonResponse({ ok: true, item: updated, eventId: event.event_id });
}

async function handleCompleteWorkstream(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  const parsed = CompleteWorkstreamBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "bad request", issues: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  const item = cachedState.inFlight.find((i) => i.id === body.id);
  if (!item) {
    return jsonResponse({ error: `In-flight item not found: ${body.id}` }, 404);
  }
  if (!item.active) {
    return jsonResponse({ error: `In-flight item not active: ${body.id}` }, 409);
  }

  const actor =
    typeof body.actor === "string" && body.actor.trim().length > 0
      ? body.actor.trim()
      : "marc@tgv.co.za";
  const event: Event = {
    event_id: newEventId(),
    type: "WorkstreamCompleted",
    as_of: nowUtc(),
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: actor },
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    payload: {
      workstreamId: item.id,
      what: item.what,
      owner: item.owner,
      ...(body.outcomeDoc ? { outcomeDoc: body.outcomeDoc } : {}),
      ...(body.outcomeNote ? { outcomeNote: body.outcomeNote } : {}),
    },
  };
  eventStore.append(event);
  refresh("inflight-complete");
  const updated = cachedState.inFlight.find((i) => i.id === body.id);

  logger.info({ workstreamId: item.id, eventId: event.event_id }, "Workstream completed");
  return jsonResponse({ ok: true, item: updated, eventId: event.event_id });
}

// ---------------------------------------------------------------------------
// RMS Phase 1 Slice 4 — register render endpoints.
//
// Two endpoints surface the seven RMS register projections (Slice 3
// substrate at `prototype/platform/rms-registers/`) alongside the legacy
// Owner Inbox feed (Phase 1 dual-render contract):
//
//   GET /api/rms                 — catalogue + counts.
//   GET /api/rms/:register       — rows for one register.
//
// A 5s server-side cache avoids re-folding the event store on every poll
// from the front-end. The cache invalidates whenever the dashboard's
// `refresh()` runs (decisions, fx-trade, workstream-mutation, fs.watch),
// because the underlying event store may have new appends.
//
// Authority: D-RMS-PHASE-1-SLICE-4 under standing D-RMS-PHASE-1.
// ---------------------------------------------------------------------------

const RMS_FOLD_CACHE_TTL_MS = 5_000;
let rmsFoldCache: ReturnType<typeof buildRmsRegistersFold> | null = null;
let rmsFoldCacheAt = 0;

function invalidateRmsFold(): void {
  rmsFoldCache = null;
  rmsFoldCacheAt = 0;
}

function getRmsFold(): ReturnType<typeof buildRmsRegistersFold> {
  const now = Date.now(); // wall-clock: TTL cache elapsed-time check
  if (rmsFoldCache && now - rmsFoldCacheAt < RMS_FOLD_CACHE_TTL_MS) {
    return rmsFoldCache;
  }
  rmsFoldCache = buildRmsRegistersFold(eventStore);
  rmsFoldCacheAt = now;
  return rmsFoldCache;
}

function handleRmsCatalogue(): Response {
  // pageProvenance: event-derived — RMS registers fold typed events
  // from the event store (Phase 1 dual-render). Build phase →
  // simulated-only.
  //
  // Filesystem-derived registers (policies, procedures) are appended to
  // the catalogue here, not stored as projections — they live in
  // /Policies/*.md and /Procedures/**/*.md, not in the event log. They
  // share the register UI but carry a separate provenance tag.
  const eventFold = summariseFold(getRmsFold());
  const policies = listPolicies(REPO_ROOT);
  const procedures = listProcedures(REPO_ROOT);
  return jsonResponse({
    asOf: eventFold.asOf,
    counts: {
      ...eventFold.counts,
      policies: policies.length,
      procedures: procedures.length,
    },
    catalogue: [
      ...eventFold.catalogue,
      {
        key: "policies",
        title: "Policies",
        blurb:
          "Bank policy library under /Policies. Status, owner, and citation chain come from each policy's frontmatter.",
        folds: ["filesystem: /Policies/*.md (frontmatter)"],
        statusTaxonomy: ["in-force", "draft", "planned"],
      },
      {
        key: "procedures",
        title: "Procedures",
        blurb:
          "Bank procedure library under /Procedures. Each row carries its anchor policy (policy-cited) and implementing system-capability.",
        folds: ["filesystem: /Procedures/**/*.md (frontmatter)"],
        statusTaxonomy: ["populated", "planned", "stub"],
      },
    ],
    pageProvenance: eventDerivedPageProvenance(),
  });
}

// Stream the raw markdown body for a single procedure file under
// `Procedures/by-policy/` so the procedures-page inline-preview modal can
// render it without leaving the page. Mirrors the Owner Inbox endpoint
// (`handleOwnerInboxFetch`) — same rejection pattern, same allow-list
// discipline. Authored by Anya (Data / analytics engineer).
//
// Safety:
//   • Filename must be exactly a basename (no `/`, no `..`).
//   • Filename must end in `.md`.
//   • Filename must be present in the live procedures index — i.e. some
//     `_index.md` row resolves to the file under `by-policy/`. An orphan
//     citation (file missing on disk) is *not* in the allow-list because
//     `getProceduresIndex` flags it but the file does not exist; any such
//     request returns 404 rather than 500.
function handleProcedureFetch(filename: string): Response {
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return jsonResponse({ error: "invalid filename" }, 400);
  }
  if (!filename.toLowerCase().endsWith(".md")) {
    return jsonResponse({ error: "only .md files are previewable" }, 400);
  }
  // Allow-list check. Procedures live under two trees:
  //   • `Procedures/by-policy/` — indexed by getProceduresIndex (the
  //     canonical policy → procedure mapping per Principle 2).
  //   • `Procedures/<area>/` — area-organised procedures (markets,
  //     finance, operations, …) surfaced via listProcedures() for the
  //     RMS Procedures register.
  // We accept either source.
  const view = getProceduresIndex(REPO_ROOT);
  const byPolicyAllowed = view.groups.some((g) =>
    g.rows.some((r) => r.procedureFile === filename && !r.orphan),
  );
  const indexedRow = listProcedures(REPO_ROOT).find((r) => r.filename === filename);
  if (!byPolicyAllowed && !indexedRow) {
    return jsonResponse({ error: `not in current procedures index: ${filename}` }, 404);
  }
  // Resolve to disk. by-policy/ rows live there; indexed rows carry their
  // repo-relative path; prefer the index path when available so area
  // subfolders (markets, finance, …) work.
  const filePath = indexedRow
    ? join(REPO_ROOT, indexedRow.path)
    : join(REPO_ROOT, "Procedures", "by-policy", filename);
  if (!existsSync(filePath)) {
    return jsonResponse({ error: `file not found on disk: ${filename}` }, 404);
  }
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (err) {
    return jsonResponse(
      { error: `failed to read file: ${err instanceof Error ? err.message : String(err)}` },
      500,
    );
  }
  return new Response(content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

// Stream the raw markdown body for a single policy source file under
// `Owner Inbox/` so the policies-page inline-preview modal can render it
// without leaving the page. Mirrors `handleOwnerInboxFetch` and
// `handleProcedureFetch` — same rejection pattern, same allow-list
// discipline. Authored by Anya (Data / analytics engineer).
//
// Safety:
//   • Filename must be exactly a basename (no `/`, no `..`).
//   • Filename must end in `.md`.
//   • Filename must be present in the live policy register's union of
//     per-policy `sourceFiles[]` — the policy register itself is always
//     in the union as the row-of-truth fallback, plus any explicit
//     `Owner Inbox/...md` references on a policy's status / citation
//     cell. A file under `Owner Inbox/` not cited by the register is
//     not servable through this endpoint.
//
// Follow-on (do not ship in this PR): the three sibling endpoints
// `/api/owner-inbox/:filename` (#192), `/api/procedure/:filename` (#198),
// and this one collapse cleanly to a single `/api/markdown/:scope/:filename`
// surface where each scope provides its own allow-list source. Worth
// queueing once a fourth scope (Team / Principles / Persona-spec
// preview) lands.
function handlePolicyFetch(filename: string): Response {
  // Accept bare basenames (Owner Inbox files) or `Policies/<basename>` qualified paths
  // (D-POLICY-DOCUMENT-HOME Option C, 2026-05-12). Reject anything else.
  const isPoliciesQualified = /^Policies\/[A-Za-z0-9._-]+\.md$/.test(filename);
  const isBareBasename =
    !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
  if (!isPoliciesQualified && !isBareBasename) {
    return jsonResponse({ error: "invalid filename" }, 400);
  }
  if (!filename.toLowerCase().endsWith(".md")) {
    return jsonResponse({ error: "only .md files are previewable" }, 400);
  }
  // Allow-list check. Two canonical sources combine here:
  //   • cachedState.policies[*].sourceFiles[] — the legacy register-derived
  //     allow-list. Owner Inbox files are bare basenames; Policies/ files
  //     use the `Policies/<basename>` qualified form.
  //   • listPolicies() — the live filesystem index used by /rms's Policies
  //     register. Every file there is trivially safe to serve.
  const baseName = isPoliciesQualified ? filename.replace(/^Policies\//, "") : filename;
  const allowedByLegacy = cachedState.policies.some(
    (p) => p.sourceFiles.includes(filename) || p.sourceFiles.includes(`Policies/${baseName}`),
  );
  const allowedByIndex = listPolicies(REPO_ROOT).some((p) => p.filename === baseName);
  if (!allowedByLegacy && !allowedByIndex) {
    return jsonResponse({ error: `not in current policy register: ${filename}` }, 404);
  }
  // Resolve to disk. Resolution priority:
  //   1. Qualified `Policies/<file>` → that exact path.
  //   2. Bare basename present in listPolicies() → `Policies/<file>`.
  //   3. Bare basename otherwise → `archive/owner-inbox/<file>` (legacy
  //      Phase 4 fallback for inbox-only basenames).
  let filePath: string;
  if (isPoliciesQualified) {
    filePath = join(REPO_ROOT, filename);
  } else if (allowedByIndex) {
    filePath = join(REPO_ROOT, "Policies", filename);
  } else {
    filePath = join(REPO_ROOT, "archive", "owner-inbox", filename);
  }
  if (!existsSync(filePath)) {
    return jsonResponse({ error: `file not found on disk: ${filename}` }, 404);
  }
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (err) {
    return jsonResponse(
      { error: `failed to read file: ${err instanceof Error ? err.message : String(err)}` },
      500,
    );
  }
  return new Response(content, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// GET /api/rms/document-content?hash=<blake3:...>
//
// Serves the raw text content of a document from the BLAKE3 content-addressed
// store so the RMS document register can render a click-to-view markdown
// preview panel. Authority: D-RMS-PHASE-1 (document register, Slice 4+).
//
// Safety:
//   • hash param must match blake3:[a-f0-9]{64} — rejects traversal + malformed.
//   • DocumentStoreMissError → 404; all other errors → 500.
// ---------------------------------------------------------------------------

const BLAKE3_HASH_RE = /^blake3:[a-f0-9]{64}$/;

function handleRmsDocumentContent(searchParams: URLSearchParams): Response {
  const hash = searchParams.get("hash");
  if (!hash || !BLAKE3_HASH_RE.test(hash)) {
    return new Response("Bad request: hash must match blake3:[a-f0-9]{64}", { status: 400 });
  }
  let bytes: Uint8Array;
  try {
    bytes = defaultDocumentStore.get(hash as import("../platform/document-store").DocumentHash);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (msg.includes("not found") || msg.includes("DocumentStoreMiss")) {
      return new Response("Document not found", { status: 404 });
    }
    return new Response(`Store error: ${msg}`, { status: 500 });
  }
  const text = new TextDecoder().decode(bytes);
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function handleRmsRegister(register: string): Response {
  // Filesystem-derived registers — same shape, distinct provenance, read
  // directly from /Policies and /Procedures.
  if (register === "policies") {
    return jsonResponse({
      asOf: nowUtc(),
      register,
      rows: listPolicies(REPO_ROOT),
      pageProvenance: eventDerivedPageProvenance(),
    });
  }
  if (register === "procedures") {
    return jsonResponse({
      asOf: nowUtc(),
      register,
      rows: listProcedures(REPO_ROOT),
      pageProvenance: eventDerivedPageProvenance(),
    });
  }
  if (!isRmsRegisterKey(register)) {
    return jsonResponse(
      {
        error: `unknown register: ${register}`,
        validKeys: [...RMS_REGISTER_KEYS, "policies", "procedures"],
      },
      404,
    );
  }
  const fold = getRmsFold();
  return jsonResponse({
    asOf: fold.asOf,
    register,
    rows: selectRegisterView(fold, register),
    pageProvenance: eventDerivedPageProvenance(),
  });
}

// ---------------------------------------------------------------------------
// Continuous derivation: poll + fs.watch (debounced).
// ---------------------------------------------------------------------------

const watchers: FSWatcher[] = [];
let pollTimer: ReturnType<typeof setInterval> | undefined;

function installContinuousDerivation(): void {
  if (REFRESH_MS > 0) {
    pollTimer = setInterval(() => refresh("poll"), REFRESH_MS);
  }
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  for (const target of watchTargets(SOURCES)) {
    try {
      const w = fsWatch(target, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => refresh("watch"), WATCH_DEBOUNCE_MS);
      });
      watchers.push(w);
    } catch (e) {
      logger.warn({ target, err: (e as Error).message }, "fs.watch unavailable for source path");
    }
  }
}

function shutdownContinuousDerivation(): void {
  if (pollTimer) clearInterval(pollTimer);
  for (const w of watchers) {
    try {
      w.close();
    } catch {
      // best-effort
    }
  }
  watchers.length = 0;
}

process.on("SIGINT", () => {
  shutdownContinuousDerivation();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdownContinuousDerivation();
  process.exit(0);
});

installContinuousDerivation();

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/version" && req.method === "GET") {
      return jsonResponse({ gitHash: GIT_HASH, gitBranch: GIT_BRANCH, startedAt: STARTED_AT });
    }
    if (url.pathname === "/api/state" && req.method === "GET") {
      // Slice 3.5 — attach `pageProvenance` so the badge resolves the
      // page's mode from the data the endpoint actually returned, not
      // from a page-global env-derived default. /api/state folds
      // event-store-derived projections → build phase resolves to
      // simulated-only; licence-day flips automatically.
      return jsonResponse({ ...cachedState, pageProvenance: eventDerivedPageProvenance() });
    }
    // Procedure markdown body fetch for the procedures-page inline-preview
    // modal. Mirrors the Owner Inbox endpoint above; allow-list bound to
    // the live procedures index. Authored by Anya (Data / analytics
    // engineer); does not mutate state and does not change
    // `getProceduresIndex`'s derivation contract.
    {
      const procMatch = url.pathname.match(/^\/api\/procedure\/(.+)$/);
      if (procMatch?.[1] && req.method === "GET") {
        return handleProcedureFetch(decodeURIComponent(procMatch[1]));
      }
    }
    // Policy-source markdown body fetch for the policies-page inline-preview
    // modal. Mirrors the Owner Inbox / procedure endpoints above; allow-list
    // bound to the live policy register's per-policy `sourceFiles[]` union
    // (every Policy carries the register itself plus any explicit
    // `Owner Inbox/...md` reference from its status / citation cell).
    // Authored by Anya (Data / analytics engineer); does not mutate state.
    {
      const polMatch = url.pathname.match(/^\/api\/policy\/(.+)$/);
      if (polMatch?.[1] && req.method === "GET") {
        return handlePolicyFetch(decodeURIComponent(polMatch[1]));
      }
    }
    // ---------- D-DATA-PROVENANCE-SUBSTRATE Slice 3 — output watermarking ----------
    // Single source of the resolved ProvenanceFilter for the page chrome's
    // <ProvenanceBadge>. Reads the projection-runtime default (env-derived
    // from BANK_PHASE per Slice 2 §5.2) so the badge reflects exactly the
    // filter projections compute under at request time.
    //
    // Slice 7 (toggle UX) extends this to honour a per-user session
    // override; today the response is the env-derived default only.
    // Authority: D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10);
    // pack §6 + §7 row 3.
    if (url.pathname === "/api/provenance/mode" && req.method === "GET") {
      const filter = defaultProvenanceFilter();
      return jsonResponse({
        asOf: nowUtc(),
        bankPhase: process.env.BANK_PHASE ?? "build",
        filter,
        sliceAuthority: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-3",
      });
    }
    if (url.pathname === "/api/bank-mode" && req.method === "GET") {
      // D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR2 — the settable, event-sourced
      // bank-wide prod/sim mode + per-category provenance policy. The policy
      // itself is a production governance record (BankModePolicySet rides
      // production provenance), so the page badge is production-only.
      return jsonResponse({
        asOf: nowUtc(),
        policy: currentBankModePolicy(eventStore),
        pageProvenance: { mode: "production-only" },
      });
    }
    if (url.pathname === "/api/bank-mode" && req.method === "POST") {
      // Set the bank-wide mode / per-category policy. Authority is CEO-level
      // (crosses the build-phase/commencement boundary + sandbox-simulator gate);
      // the authorising principal is carried in `setBy`.
      let body: {
        bankMode?: string;
        categoryPolicy?: Array<{ category: string; provenance: string }>;
        note?: string;
        setBy?: string;
      };
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ ok: false, error: "invalid JSON body" }, 400);
      }
      if (body.bankMode !== "sim" && body.bankMode !== "prod") {
        return jsonResponse({ ok: false, error: "bankMode must be 'sim' or 'prod'" }, 400);
      }
      // Default to the current category policy when the caller only flips the mode.
      const current = currentBankModePolicy(eventStore);
      const categoryPolicy = (body.categoryPolicy ?? current.categoryPolicy) as Array<{
        category: import("../platform/event-store/event-types/bank-mode").ProvenanceCategory;
        provenance: "production" | "simulated";
      }>;
      try {
        const { eventId } = recordBankModePolicy({
          payload: {
            bankMode: body.bankMode,
            categoryPolicy,
            ...(body.note ? { note: body.note } : {}),
            setBy: body.setBy ?? "dashboard-operator",
          },
        });
        // Re-sync the lifecycle phase immediately so the running process reflects
        // the new mode without a restart.
        const policy = syncBankModeToLifecyclePhase(eventStore);
        return jsonResponse({ ok: true, eventId, policy });
      } catch (err) {
        return jsonResponse(
          { ok: false, error: err instanceof Error ? err.message : String(err) },
          400,
        );
      }
    }
    if (url.pathname === "/api/substrate-gaps" && req.method === "GET") {
      // Substrate-gap inventory parsed from Atlas's most-recent
      // substrate-state deliverable. 5-min server-side cache.
      // pageProvenance: production-only — authored register (reference
      // data), not event-derived.
      return jsonResponse({
        ...getSubstrateGapsView(REPO_ROOT),
        pageProvenance: substrateGapsPageProvenance(),
      });
    }
    if (url.pathname === "/api/review-debt" && req.method === "GET") {
      // WS-OBLIGATION-REVIEW-SUBSTRATE — combined output of the two
      // obligation-review advisory recons. Powers the "Review debt"
      // tile on home.html. Computed fresh on each request; the recons
      // walk the obligations register markdown directly (no event-store
      // pre-aggregation today).
      // Authority: D-OBLIGATION-REVIEW-SUBSTRATE; D-KG-GRAPHITI-ADOPT.
      // pageProvenance: production-only — register cites regulators
      // (SARB / FIC / FSCA / PA), production reference data.
      const statusResult = runObligationReviewStatusRecon(REPO_ROOT);
      const coverageResult = runObligationPolicyCoverageRecon(REPO_ROOT);
      return jsonResponse({
        asOf: statusResult.asOf,
        queue: statusResult.summary,
        policyCoverage: {
          coveragePct: coverageResult.overallCoveragePct,
          coverageByDomain: coverageResult.coverageByDomain,
          uncoveredCount: coverageResult.violations.length,
        },
        citations: [
          "D-OBLIGATION-REVIEW-SUBSTRATE",
          "D-KG-GRAPHITI-ADOPT",
          "P2-SINGLE-GRAPH-DISCIPLINE",
        ],
        pageProvenance: productionReferencePageProvenance(),
      });
    }
    if (url.pathname === "/api/obligations" && req.method === "GET") {
      // Obligation-detail map keyed by ORG-* id, served to the policies
      // drilldown so it can show citation / requirement / source / bind /
      // status per linked obligation. Parsed from the obligations register
      // on each request — file is small; no caching needed.
      // pageProvenance: production-only — register cites regulators
      // (SARB / FIC / FSCA / PA), production reference data.
      return jsonResponse({
        ...getObligationsView(REPO_ROOT),
        pageProvenance: productionReferencePageProvenance(),
      });
    }
    if (url.pathname === "/api/bank-obligations" && req.method === "GET") {
      // Event-sourced bank-obligation register — folded from the ObligationAdopted
      // lifecycle events (Plane B, D-REGULATORY-ARCHITECTURE-TWO-PLANE). The
      // canonical obligations viewer; the legacy /api/obligations (markdown) is
      // tracked for migration on /obligation-readers.html.
      return jsonResponse({
        ...getBankObligationsView(eventStore, REPO_ROOT),
        pageProvenance: productionReferencePageProvenance(),
      });
    }
    if (url.pathname === "/api/ownership-map" && req.method === "GET") {
      // Coherent Agent ⟺ Domain ⟺ Obligation ownership map (D-DOMAIN-OWNERSHIP-MAP):
      // by-agent + by-domain rollups + two-axis coverage stats. Optional
      // ?seat=<seat> returns that seat's obligations with owner-drift flags.
      const seat = url.searchParams.get("seat");
      if (seat) {
        return jsonResponse({
          seat,
          obligations: getSeatObligations(eventStore, seat),
          pageProvenance: productionReferencePageProvenance(),
        });
      }
      return jsonResponse({
        ...getOwnershipMapView(eventStore),
        pageProvenance: productionReferencePageProvenance(),
      });
    }
    if (url.pathname === "/api/obligation-readers" && req.method === "GET") {
      // Migration tracker — codebase files still reading the legacy obligations
      // markdown, grouped by area. Self-updating as readers migrate.
      return jsonResponse(getObligationReadersView(resolve(REPO_ROOT, "prototype")));
    }
    if (url.pathname === "/api/unadopted-obligations" && req.method === "GET") {
      // Knowledge-base obligations not currently adopted — candidates for
      // adoption (Unadopted = knowledge base − adopted + un-adopted). Sourced
      // from the reference graph, with server-side facets + paging.
      const sp = url.searchParams;
      const limit = Number.parseInt(sp.get("limit") ?? "", 10);
      const offset = Number.parseInt(sp.get("offset") ?? "", 10);
      return jsonResponse({
        ...getUnadoptedObligationsView(eventStore, {
          source: sp.get("source") ?? undefined,
          standard: sp.get("standard") ?? undefined,
          q: sp.get("q") ?? undefined,
          limit: Number.isNaN(limit) ? undefined : limit,
          offset: Number.isNaN(offset) ? undefined : offset,
        }),
        pageProvenance: productionReferencePageProvenance(),
      });
    }
    if (url.pathname === "/api/obligation" && req.method === "GET") {
      // Single-obligation detail (reference seed + projection state + lifecycle
      // history) for the drill-down + adopt/un-adopt actions.
      const id = url.searchParams.get("id") ?? "";
      if (!id) return jsonResponse({ error: "id is required" }, 400);
      const detail = getObligationDetail(eventStore, REPO_ROOT, id);
      if (!detail) return jsonResponse({ error: `unknown obligation "${id}"` }, 404);
      return jsonResponse(detail);
    }
    if (url.pathname === "/api/obligations/adopt" && req.method === "POST") {
      return handleObligationAdopt(req);
    }
    if (url.pathname === "/api/obligations/unadopt" && req.method === "POST") {
      return handleObligationUnadopt(req);
    }

    // ---------------------------------------------------------------------------
    // GET /api/reg/policy/:policyId/trace-to-regulation
    //
    // Walk Policy → CLOSES → Obligation → ←EXPRESSES← Provision → ←CONTAINS←
    // Document, returning verbatimText, goldenSourceHash, sourcePages and
    // sourceProvisionUrn per item. Optional ?includeCrossPlane=true follows
    // DERIVES_FROM / EQUIVALENT_TO to unadopted source obligations.
    //
    // Authority: D-REGULATORY-LIBRARY-V1 (WS-REGULATORY-LIBRARY-V1 Slice 3).
    // Author: Mira (Compliance / RegTech engineer, engineering).
    // ---------------------------------------------------------------------------
    if (
      url.pathname.startsWith("/api/reg/policy/") &&
      url.pathname.endsWith("/trace-to-regulation") &&
      req.method === "GET"
    ) {
      // pathname: /api/reg/policy/<policyId>/trace-to-regulation
      const segments = url.pathname.split("/");
      // segments: ["", "api", "reg", "policy", "<policyId>", "trace-to-regulation"]
      const policyId = segments[4] ?? "";
      if (!policyId) return jsonResponse({ error: "policyId is required" }, 400);
      const includeCrossPlane = url.searchParams.get("includeCrossPlane") === "true";
      const asOf = url.searchParams.get("asOf") ?? undefined;
      const items = tracePolicyBackToRegulation(policyId, { includeCrossPlane, asOf });
      return jsonResponse({
        policyId,
        items: items.map((item) => ({
          obligationId: item.obligation.id,
          provisionId: item.provision?.id ?? null,
          documentId: item.document?.id ?? null,
          verbatimText: item.verbatimText,
          goldenSourceHash: item.goldenSourceHash,
          sourcePages: item.sourcePages,
          sourceProvisionUrn: item.sourceProvisionUrn,
          ...(item.crossPlane
            ? {
                crossPlane: {
                  sourceObligationId: item.crossPlane.sourceObligation.id,
                  sourceProvisionId: item.crossPlane.sourceProvision?.id ?? null,
                  sourceDocumentId: item.crossPlane.sourceDocument?.id ?? null,
                },
              }
            : {}),
        })),
      });
    }

    // ---------------------------------------------------------------------------
    // GET /api/reg/golden-source/:hash
    //
    // Resolves the BLAKE3 content-addressed hash in the document store and
    // streams the bytes as application/pdf. Security: validates hash format
    // (blake3:[a-f0-9]{64}) — no path traversal since lookup is content-addressed.
    // Returns 404 when not found; never 500 on missing document.
    //
    // Authority: D-REGULATORY-LIBRARY-V1 (WS-REGULATORY-LIBRARY-V1 Slice 3).
    // Author: Mira (Compliance / RegTech engineer, engineering).
    // ---------------------------------------------------------------------------
    if (url.pathname.startsWith("/api/reg/golden-source/") && req.method === "GET") {
      const hash = url.pathname.slice("/api/reg/golden-source/".length);
      if (!BLAKE3_HASH_RE.test(hash)) {
        return new Response("Bad request: hash must match blake3:[a-f0-9]{64}", { status: 400 });
      }
      let bytes: Uint8Array;
      try {
        bytes = defaultDocumentStore.get(hash as import("../platform/document-store").DocumentHash);
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        if (msg.includes("not found") || msg.includes("DocumentStoreMiss")) {
          return new Response("Document not found", { status: 404 });
        }
        // Never 500 on a missing document — treat unexpected errors as 404 too
        // but log for diagnostics.
        logger.warn(`golden-source lookup error for ${hash}: ${msg}`);
        return new Response("Document not found", { status: 404 });
      }
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${hash.slice(7, 15)}.pdf"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    if (url.pathname === "/api/procedures" && req.method === "GET") {
      // Procedures index — every row of `Procedures/_index.md` grouped by
      // its H2 domain section, enriched per-row with frontmatter parsed
      // from the per-procedure file under `Procedures/by-policy/`. Surfaces
      // the "no orphans" count (rows whose cited file does not exist) per
      // Principle 2. Parsed live; small enough not to cache.
      // pageProvenance: null — procedures are markdown authored as the
      // canonical source per Principle 2 upward chain. No data surface
      // → no badge. The /procedures.html page can declare its own
      // `data-provenance-content="none"` if it consumes this and renders
      // nothing else, OR mount the badge with the null mode (suppress).
      return jsonResponse({
        ...getProceduresIndex(REPO_ROOT),
        pageProvenance: proseAuthoredPageProvenance(),
      });
    }
    if (url.pathname === "/api/agent-runs" && req.method === "GET") {
      // GitHub Actions run history per agent — for the per-agent "Recent
      // runs" enrichment on /agents.html and the conclusion-aware
      // traffic-light on /health.html. 5-minute server-side cache.
      // pageProvenance: production-only — GitHub Actions runs are
      // production observability data (real CI), not simulated events.
      const result = await getAgentRuns();
      return jsonResponse({
        fetchedAt: new Date(result.fetchedAt).toISOString(),
        cacheAgeMs: result.cacheAgeMs,
        ...(result.error ? { error: result.error } : {}),
        byAgent: groupByAgent(result.runs, 5),
        all: result.runs,
        pageProvenance: productionReferencePageProvenance(),
      });
    }
    if (url.pathname === "/api/models" && req.method === "GET") {
      // Trusted-Figures Program — calculation models. Each surfaced regulatory
      // figure (LCR/NSFR/CET1) bound to an owned, registered model, with its
      // governance status, model-approval gate, input contract, and latest
      // CalculationPerformed lineage (inputs → output + trust status).
      // pageProvenance: event-derived → simulated-only in build phase.
      // Authority: D-TRUSTED-FIGURES-PROGRAM-V1.
      const models = buildCalcModelsView(eventStore);
      return jsonResponse({
        models,
        counts: {
          total: models.length,
          approved: models.filter((m) => m.approved).length,
          unapproved: models.filter((m) => !m.approved).length,
        },
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/data-failures" && req.method === "GET") {
      // Trusted-Figures Program objective 4 — cross-page data-failure surface.
      // Every bound figure whose latest computation is degraded/failed (a
      // missing required/optional input), so the figure renders "value
      // unavailable" with the missing inputs named — never a silent 0.
      // Authority: D-TRUSTED-FIGURES-PROGRAM-V1.
      const modelFailures = buildDataFailuresView(eventStore);
      // Product-control daily P&L — the headline unrealised figure is computed
      // outside CALC_BINDINGS but obeys the same no-silent-zero discipline: a
      // live FX position with no usable mark makes the aggregate incomplete
      // rather than contributing a silent 0. Folded into the same `failures`
      // section. Authority: D-TRUSTED-FIGURES-PROGRAM-V1; WS-TRUSTED-FIGURES.
      const pnlFailures = buildPnLDataFailuresView(eventStore, nowUtc().slice(0, 10));
      const failures = [...modelFailures, ...pnlFailures];
      // Expected-event gaps — the other silent-gap shape: an event that should
      // have been emitted but wasn't (no degraded calc to show; figure reads
      // from stale/absent state). Surfaced in the same banner.
      const expectedEventGaps = checkExpectedEvents(eventStore);
      // A `deferred` gap is an honest, tracked build-phase deferral (the event's
      // trigger does not yet exist on the live event flow), NOT a silent-red
      // fault. It is still surfaced (so the disposition is visible) but counted
      // distinctly from genuine absent/stale gaps. `expectedEventGaps` keeps its
      // historical meaning — genuine (non-deferred) gaps — so existing callers
      // and the banner threshold do not regress; `expectedEventDeferrals`
      // surfaces the deferred count alongside it.
      const genuineGaps = expectedEventGaps.filter((g) => g.kind !== "deferred");
      const deferrals = expectedEventGaps.filter((g) => g.kind === "deferred");
      return jsonResponse({
        failures,
        expectedEventGaps,
        counts: {
          total: failures.length,
          failed: failures.filter((f) => f.status === "failed").length,
          degraded: failures.filter((f) => f.status === "degraded").length,
          expectedEventGaps: genuineGaps.length,
          expectedEventDeferrals: deferrals.length,
        },
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/seeds" && req.method === "GET") {
      // Trusted-Figures Program objective 1 — foundational seed inventory. Every
      // build-phase seed (seeds/manifest.ts) — boot-time market-data ingesters
      // and standing idempotent scripts — its descope status, the
      // descope/promotion lineage, and the live count of events it has emitted
      // (plus market-data ticks for the reference feeds).
      // pageProvenance: event-derived → simulated-only in build phase.
      // Authority: D-TRUSTED-FIGURES-PROGRAM-V1.
      const seeds = buildSeedsView(eventStore, marketDataStore);
      return jsonResponse({
        seeds,
        counts: {
          total: seeds.length,
          descoped: seeds.filter((s) => s.descoped).length,
          descopable: seeds.filter((s) => s.descopable).length,
        },
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/seeds/descope" && req.method === "POST") {
      return handleSeedDescope(req);
    }
    if (url.pathname === "/api/seeds/promote" && req.method === "POST") {
      return handleSeedPromote(req);
    }
    if (url.pathname === "/api/constants" && req.method === "GET") {
      // Trusted-Figures Program objective 2 — owned financial-constants
      // inventory. Every regulatory calibration number consumed by the LCR /
      // NSFR / capital / leverage calc engines, declared once in
      // platform/config/financial-constants.ts with its owning seat + citation.
      // Read-only: regulated constants change via a governed Decision, not a
      // dashboard field. Authority: D-TRUSTED-FIGURES-PROGRAM-V1.
      const groupsMap = new Map<string, (typeof FINANCIAL_CONSTANTS)[number][]>();
      for (const c of FINANCIAL_CONSTANTS) {
        const list = groupsMap.get(c.category) ?? [];
        list.push(c);
        groupsMap.set(c.category, list);
      }
      const groups = [...groupsMap.entries()].map(([category, constants]) => ({
        category,
        constants,
      }));
      const owners = [...new Set(FINANCIAL_CONSTANTS.map((c) => c.owningRole))];
      return jsonResponse({
        groups,
        counts: {
          total: FINANCIAL_CONSTANTS.length,
          categories: groups.length,
          owners: owners.length,
        },
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/party" && req.method === "GET") {
      // D-PARTY-REGISTER PR 2 — Party tile read-side. Folds the unified
      // Party event family (10 event types in domains/party/) and
      // returns the four kind sub-counts + relationships sub-count.
      // D-DATA-QUALITY-GOLDEN-SOURCE-V1 — normalizePartyShape applied to
      // every party object so the wire format always emits `partyKind`.
      // pageProvenance: event-derived → simulated-only in build phase.
      const projection = buildPartyProjection(eventStore, cachedState.asOf);
      const summary = buildPartyTileSummary(projection);
      const parties = [...projection.parties.values()].map((p) =>
        normalizePartyShape(p as unknown as Record<string, unknown>),
      );
      return jsonResponse({
        ...summary,
        parties,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/onboarding" && req.method === "GET") {
      // Onboarding orchestrator — Slice 1. Folds the 12 customer event types
      // into per-counterparty lifecycle phases (21 phases). Read-only;
      // no caching (event volume is small in build phase).
      // Authority: D-PARTY-REGISTER (CEO-approved 2026-05-11);
      //            AML-CFT-POLICY-V1 (PR #261); TRADING-MANDATE-V1 (PR #256).
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildOnboardingView(eventStore, nowUtc()),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/kyc/candidates" && req.method === "GET") {
      // KYC candidate projection — folds the KYC lifecycle event family
      // (ClientCandidateRegistered → SanctionsClearancePassed → PEPScreeningCompleted
      // → BeneficialOwnerResolved → RiskRatingAssigned → EddInitiated/EddCompleted
      // → ClientAccepted / ClientRejected) into per-candidate current state.
      // Read-only; no caching (event volume is small in build phase).
      // Authority: D-LIFECYCLE-SLICE-2; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildKycCandidatesView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // GET /api/kyc/candidates/:id — single candidate with KYC checks.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (
      url.pathname.startsWith("/api/kyc/candidates/") &&
      req.method === "GET" &&
      url.pathname !== "/api/kyc/candidates/"
    ) {
      const candidateId = decodeURIComponent(url.pathname.replace("/api/kyc/candidates/", ""));
      return jsonResponse({
        ...buildKycCandidateDetailView(eventStore, candidateId),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }

    // GET /api/kyc/clients — accepted clients register (master).
    // CRITICAL: only clients with a ClientAccepted event appear here.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (url.pathname === "/api/kyc/clients" && req.method === "GET") {
      return jsonResponse({
        ...buildKycClientsView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }

    // GET /api/kyc/clients/:id — single client with KYC checks.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (
      url.pathname.startsWith("/api/kyc/clients/") &&
      req.method === "GET" &&
      url.pathname !== "/api/kyc/clients/"
    ) {
      const clientId = decodeURIComponent(url.pathname.replace("/api/kyc/clients/", ""));
      return jsonResponse({
        ...buildKycClientDetailView(eventStore, clientId),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }

    // POST /api/kyc/start — register a new KYC candidate.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (url.pathname === "/api/kyc/start" && req.method === "POST") {
      return handleKycStart(req);
    }

    // POST /api/kyc/simulate — run a simulation scenario.
    // D-KYC-ONBOARDING-BUILD.
    if (url.pathname === "/api/kyc/simulate" && req.method === "POST") {
      return handleKycSimulate(req);
    }

    // POST /api/kyc/candidates/:id/advance — advance one KYC step.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    {
      const advMatch = url.pathname.match(/^\/api\/kyc\/candidates\/([^/]+)\/advance$/);
      if (advMatch?.[1] && req.method === "POST") {
        return handleKycAdvance(decodeURIComponent(advMatch[1]));
      }
    }

    // POST /api/kyc/candidates/:id/decide — record human decision.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    {
      const decMatch = url.pathname.match(/^\/api\/kyc\/candidates\/([^/]+)\/decide$/);
      if (decMatch?.[1] && req.method === "POST") {
        return handleKycDecide(req, decodeURIComponent(decMatch[1]));
      }
    }

    // POST /api/kyc/clients/:id/refresh — emit KYCRefreshScheduled.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    {
      const refMatch = url.pathname.match(/^\/api\/kyc\/clients\/([^/]+)\/refresh$/);
      if (refMatch?.[1] && req.method === "POST") {
        return handleKycClientRefresh(decodeURIComponent(refMatch[1]));
      }
    }

    if (url.pathname === "/api/forward-obligations" && req.method === "GET") {
      // Forward Obligations projection — multi-source derived view of future events.
      //
      // Query params:
      //   ?view=planning   — Planning view (what action / by whom / by when).
      //   ?view=liquidity  — Liquidity view (net cashflow by date, probability-weighted).
      //   ?horizon=30      — Horizon in days from today (default 90).
      //   ?from=YYYY-MM-DD — Explicit window start (overrides horizon).
      //   ?to=YYYY-MM-DD   — Explicit window end (overrides horizon).
      //
      // Authority: CEO design brief 2026-05-12.
      // pageProvenance: event-derived → simulated-only in build phase.
      const viewName = url.searchParams.get("view") ?? "planning";
      const view = VIEWS[viewName];
      if (!view) {
        return jsonResponse(
          {
            error: `unknown view: ${viewName}`,
            validViews: VIEW_NAMES,
          },
          400,
        );
      }

      const asOf = nowUtc(); // full ISO timestamp so replay's `as_of <=` gate includes same-day events
      let horizonOpts: Parameters<typeof resolveHorizon>[1];
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");
      if (fromParam && toParam) {
        horizonOpts = { kind: "range", from: fromParam, to: toParam };
      } else {
        const horizonDays = Number.parseInt(
          url.searchParams.get("horizon") ?? String(DEFAULT_HORIZON_DAYS),
          10,
        );
        horizonOpts = {
          kind: "days",
          days: Number.isFinite(horizonDays) ? horizonDays : DEFAULT_HORIZON_DAYS,
        };
      }

      const result = buildForwardObligations({
        store: eventStore,
        asOf,
        horizon: horizonOpts,
      });

      const output = view.fold(result.obligations, asOf);

      return jsonResponse({
        asOf: result.asOf,
        from: result.from,
        to: result.to,
        view: viewName,
        viewLabel: view.label,
        availableViews: VIEW_NAMES,
        sourceCounts: result.sourceCounts,
        totalCount: result.obligations.length,
        data: output,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // ── Regulatory horizon-scanning endpoints ──────────────────────────────
    if (url.pathname === "/api/regulatory/instruments" && req.method === "GET") {
      // Regulatory instrument register — folds the reg-instrument projection
      // and returns all instruments with extraction stats, regulator metadata,
      // and concept counts.
      // Authority: D-REGULATORY-HORIZON-SCANNING (Mira + Atlas).
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildRegInstrumentsView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (
      url.pathname.startsWith("/api/regulatory/instruments/") &&
      url.pathname.endsWith("/concepts") &&
      req.method === "GET"
    ) {
      // Per-instrument concept list — replays RegulatoryConceptExtracted events
      // filtered to the requested instrument, sorted and filtered per query params.
      // Query params:
      //   ?sort=applicability|relevancy  (default: applicability)
      //   ?minScore=0.0                  (default: 0)
      //   ?domain=C-FAIS                 (optional)
      // Authority: D-REGULATORY-HORIZON-SCANNING (Mira + Atlas).
      // pageProvenance: event-derived → simulated-only in build phase.
      const segments = url.pathname.split("/");
      // pathname: /api/regulatory/instruments/<id>/concepts
      // segments: ["", "api", "regulatory", "instruments", "<id>", "concepts"]
      const instrumentId = segments[4];
      if (!instrumentId) {
        return jsonResponse({ error: "missing instrumentId" }, 400);
      }
      const sortParam = url.searchParams.get("sort") ?? "applicability";
      const sort = sortParam === "relevancy" ? ("relevancy" as const) : ("applicability" as const);
      const minScore = Math.max(
        0,
        Math.min(1, Number.parseFloat(url.searchParams.get("minScore") ?? "0") || 0),
      );
      const domain = url.searchParams.get("domain") ?? undefined;
      return jsonResponse({
        ...buildRegConceptsView(eventStore, instrumentId, { sort, minScore, domain }),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // ── Regulation Reader endpoints ────────────────────────────────────────
    // GET /api/regulation-reader/instruments — list of all structured regulation instruments
    if (url.pathname === "/api/regulation-reader/instruments" && req.method === "GET") {
      return jsonResponse({
        ...buildInstrumentsListView(REPO_ROOT),
        pageProvenance: proseAuthoredPageProvenance(),
      });
    }
    // GET /api/regulation-reader/:slug — full structured detail for one instrument
    {
      const readerMatch = url.pathname.match(/^\/api\/regulation-reader\/([a-z0-9-]+)$/);
      if (readerMatch?.[1] && req.method === "GET") {
        const slug = readerMatch[1];
        const detail = buildInstrumentDetailView(REPO_ROOT, slug);
        if (!detail) {
          return jsonResponse({ error: `Instrument not found: ${slug}` }, 404);
        }
        return jsonResponse({
          ...detail,
          pageProvenance: proseAuthoredPageProvenance(),
        });
      }
    }

    // GET /api/regulation-reader/:slug/excerpt/:id
    //
    // Resolves an excerpt record in the slug's structured JSON, fetches the
    // PNG bytes from the content-addressed document store, and streams them as
    // image/png with an immutable Cache-Control header (content-addressed →
    // safe to cache forever by hash).
    //
    // Security: the `:id` is resolved against the structured JSON — it is NOT
    // used as a direct hash probe, preventing arbitrary store enumeration.
    // Returns 404 (never 500) when slug, excerpt, or blob is absent.
    //
    // Authority: D-REGULATORY-LIBRARY-V1 (WS-REGULATORY-LIBRARY-V1 Slice 4).
    // Author: Mira (Compliance / RegTech engineer, engineering).
    // ---------------------------------------------------------------------------
    {
      const excerptMatch = url.pathname.match(
        /^\/api\/regulation-reader\/([a-z0-9-]+)\/excerpt\/([a-z0-9-]+)$/,
      );
      if (excerptMatch?.[1] && excerptMatch?.[2] && req.method === "GET") {
        const slugEx = excerptMatch[1];
        const excerptId = excerptMatch[2];

        // Discover the structured JSON for this slug
        let excerptDoc: {
          chapters?: Array<{
            sections?: Array<{
              excerpts?: Array<{ id: string; hash?: string }>;
            }>;
          }>;
        } | null = null;
        try {
          const regsDir = join(REPO_ROOT, "Regulations");
          if (existsSync(regsDir)) {
            for (const sub of readdirSync(regsDir, { encoding: "utf-8" })) {
              const candidate = join(regsDir, sub, "source-docs", `${slugEx}-structured.json`);
              if (existsSync(candidate)) {
                excerptDoc = JSON.parse(readFileSync(candidate, "utf-8")) as typeof excerptDoc;
                break;
              }
            }
          }
        } catch {
          return new Response("Document not found", { status: 404 });
        }
        if (!excerptDoc) {
          return new Response("Instrument not found", { status: 404 });
        }

        // Find the excerpt record by id
        let foundHash: string | undefined;
        outer: for (const chapter of excerptDoc.chapters ?? []) {
          for (const section of chapter.sections ?? []) {
            for (const exc of section.excerpts ?? []) {
              if (exc.id === excerptId) {
                foundHash = exc.hash;
                break outer;
              }
            }
          }
        }
        if (foundHash === undefined) {
          return new Response("Excerpt not found", { status: 404 });
        }
        if (!foundHash) {
          return new Response(JSON.stringify({ error: "excerpt not yet filed" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Resolve hash in document store
        let pngBytes: Uint8Array;
        try {
          pngBytes = defaultDocumentStore.get(
            foundHash as import("../platform/document-store").DocumentHash,
          );
        } catch (e) {
          const msg = (e as Error).message ?? String(e);
          if (msg.includes("not found") || msg.includes("DocumentStoreMiss")) {
            return new Response("Excerpt blob not found", { status: 404 });
          }
          logger.warn(`excerpt blob lookup error for ${foundHash}: ${msg}`);
          return new Response("Excerpt blob not found", { status: 404 });
        }

        return new Response(pngBytes, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // ── Provision-scope adoption routes ────────────────────────────────────
    // GET  /api/regulation-reader/:slug/adoption-state
    // POST /api/regulation-reader/:slug/adopt
    // POST /api/regulation-reader/:slug/distill
    // POST /api/regulation-reader/:slug/adopt-obligations
    {
      const adoptionMatch = url.pathname.match(
        /^\/api\/regulation-reader\/([a-z0-9-]+)\/(adoption-state|adopt|distill|adopt-obligations)$/,
      );
      if (adoptionMatch?.[1] && adoptionMatch?.[2]) {
        const slugAd = adoptionMatch[1];
        const action = adoptionMatch[2];
        if (action === "adoption-state" && req.method === "GET") {
          return handleRegAdoptionState(req, slugAd);
        }
        if (action === "adopt" && req.method === "POST") {
          return handleRegAdopt(req, slugAd);
        }
        if (action === "distill" && req.method === "POST") {
          return handleRegDistill(req, slugAd);
        }
        if (action === "adopt-obligations" && req.method === "POST") {
          return handleRegAdoptObligations(req, slugAd);
        }
      }
    }

    if (url.pathname === "/api/taxonomies" && req.method === "GET") {
      // Canonical taxonomy explorer — all four taxonomies (risk, activity,
      // domain, product scope) bundled in one response. Pure read; no event
      // store dependency. Authority: Atlas (Core banking platform architect,
      // engineering) under CLAUDE.md Principle 2 (single-graph discipline).
      return jsonResponse({
        ...buildTaxonomiesView(),
        pageProvenance: proseAuthoredPageProvenance(),
      });
    }
    // ── Agent Performance endpoints ────────────────────────────────────────
    if (url.pathname === "/api/performance" && req.method === "GET") {
      // Fleet performance summary — folds AgentPerformanceEvaluated +
      // AgentFeedbackIssued events into a per-agent state map and returns
      // aggregate KPIs (avg score, tier distribution, trend counts).
      // pageProvenance: event-derived → simulated-only in build phase.
      return jsonResponse({
        ...buildPerformanceView(eventStore),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    {
      const perfMatch = url.pathname.match(/^\/api\/performance\/(.+)$/);
      if (perfMatch?.[1] && req.method === "GET") {
        // Per-agent performance detail — full history, narrative, feedback path.
        // pageProvenance: event-derived → simulated-only in build phase.
        const agentId = decodeURIComponent(perfMatch[1]);
        const agentState = getAgentPerformanceState(eventStore, agentId);
        if (!agentState) {
          return jsonResponse({ error: `No performance data for agent: ${agentId}` }, 404);
        }
        return jsonResponse({
          ...agentState,
          asOf: nowUtc(),
          pageProvenance: eventDerivedPageProvenance(),
        });
      }
    }
    // ---------- Slice 5 — pre-trade risk controls + correspondent routing ----------
    if (url.pathname === "/api/rejections" && req.method === "GET") {
      // Replays last 24h of OrderRejected events from the event store.
      // Returns { asOf, rows } sorted newest first.
      // Authority: D-MARKETS-SCHEMA-FOUNDATION Slice 5; ORG-JSE-IRC-01.
      // pageProvenance: event-derived → simulated-only in build phase.
      const windowStart = Date.now() - 86_400_000;
      const rows = [...eventStore.replay({ type: "OrderRejected" })]
        .filter((e) => new Date(e.as_of).getTime() >= windowStart)
        .map((e) => e.payload)
        .reverse(); // newest first (replay returns oldest first)
      return jsonResponse({
        asOf: nowUtc(),
        rows,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/correspondent-routing" && req.method === "GET") {
      // Static routing table for the bank's five operating currencies.
      // Folds SettlementInstructionRouted events when available; falls back
      // to the static seed. Authority: D-MARKETS-SCHEMA-FOUNDATION Slice 5;
      // D-FX-CORRESPONDENT-PAIR-NAMING (CEO-approved 2026-05-09).
      // pageProvenance: event-derived (static seed + event-derived overrides).
      return jsonResponse({
        asOf: nowUtc(),
        rows: getCorrespondentRouting(),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // ---------- end Slice 5 ----------
    if (url.pathname === "/api/markets/fx/counterparties" && req.method === "GET") {
      // FX desk Slice 1 picker source. Folds the counterparty
      // institutional-eligibility events and returns the pass-and-not-breached
      // set, enriched with display names from KYC clients and fx-sim register.
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
      const view = buildCounterpartiesView(eventStore);

      // Build name lookup: counterpartyId → display name
      const nameMap = new Map<string, string>();
      // (a) KYC clients
      // KYC-accepted clients (non-simulated) — canonical source
      const kycView = buildKycClientsView(eventStore);
      for (const c of kycView.clients) {
        nameMap.set(c.clientId, c.entityName);
      }

      const enriched = view.counterparties.map((c) => ({
        ...c,
        name: nameMap.get(c.counterpartyId) ?? c.counterpartyId,
      }));

      return jsonResponse({
        ...view,
        counterparties: enriched,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // Counterparty picker for manual trade booking — the full counterparty set
    // from the party register (the master store, Principle 2), each carrying
    // its LEI + BIC. Drives the trade-book.html counterparty dropdowns.
    // Authority: D-PARTY-REGISTER; D-FX-SALES-TRADING-FRONTEND.
    if (url.pathname === "/api/counterparties" && req.method === "GET") {
      const counterparties = getActiveFxCounterparties(eventStore)
        .map((c) => ({
          partyId: c.partyId,
          name: c.name,
          lei: c.lei ?? null,
          bic: c.bic ?? null,
          jurisdiction: c.jurisdiction,
          isSim: c.isSim ?? false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return jsonResponse({
        counterparties,
        asOf: nowUtc(),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/markets/fx/quote" && req.method === "POST") {
      // FX desk Slice 2 — synthetic-quote stub. Returns a fixed-spread
      // bid/offer for ZAR/USD spot without appending any event.
      // Authority: D-FX-SALES-TRADING-FRONTEND-SLICE-2.
      return handleFxQuote(req);
    }
    if (url.pathname === "/api/markets/fx/trade" && req.method === "POST") {
      // FX desk Slice 2 — trade-emit endpoint. Validates the RFQ form
      // input, gates on counterparty eligibility (pack §3 G1), prices a
      // seed-data-driven quote (Slice 3 pricer replaces fixed stub),
      // appends RfqRequested + QuoteResponded + FxTradeExecuted events
      // from the FX CDM, and returns the trade-id + event-id for the UI
      // confirmation panel. Provenance tag is
      // simulated/first-dry-run-2026-Q1/agent-runtime:kai-fx-rfq.
      // Authority: D-FX-SALES-TRADING-FRONTEND-SLICE-2.
      return handleFxTrade(req);
    }
    if (url.pathname === "/api/markets/fx/headroom" && req.method === "GET") {
      // FX desk Slice 3 — headroom panel source. Replays the event store,
      // rebuilds the LimitUtilisationProjection, and returns the five
      // B-cluster rows with RAG status for the #headroom section of the
      // FX desk page. Zero-state (no RAS schedule emitted): all rows
      // green with zero exposure.
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
      //            D-MARKETS-SCHEMA-FOUNDATION Slice 5.
      return jsonResponse(
        buildHeadroomView(
          eventStore,
          marketDataStore,
          buildLimitUtilisationDeps(eventStore, nowUtc()),
        ),
      );
    }
    if (url.pathname === "/api/risk/market-risk-measure" && req.method === "GET") {
      // CRO-owned market-risk measure (RAS B3 review R8 / D-B3-5). Folds the
      // latest MarketRiskMeasureComputed event → VaR / SVaR / ES vs Helena's
      // MR-1-FX VaR appetite. The risk-calibrated rung of the appetite stack;
      // surfaced on the CRO risk page alongside the RAS clusters.
      return jsonResponse(
        getMarketRiskMeasure([...eventStore.replay({ type: "MarketRiskMeasureComputed" })]),
      );
    }
    if (url.pathname === "/api/markets/fx/products/attestation" && req.method === "GET") {
      // FX desk Slice 7 — NPA attestation badge source. Replays the event
      // store, folds the latest ProductApproved / ProductWithheld event per
      // FX product code, and returns a 4-row attestation view. Products with
      // no NPA event → status: "pending" (expected build-phase state per
      // project_product_lifecycle_npa_vs_engineering.md).
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10) Slice 7.
      return jsonResponse(buildNpaView(eventStore));
    }
    if (url.pathname === "/api/risk-register" && req.method === "GET") {
      // Risk register — RiskRaised findings paired with their closure state
      // (RiskResolved/RiskAccepted/RiskMitigated) by riskId. The canonical
      // register is the production set; synthetic findings are flagged.
      // Authority: WS-RISK-REGISTER-CLOSURE.
      return jsonResponse(buildRiskRegisterView(eventStore));
    }
    if (url.pathname === "/api/markets/fx/risk" && req.method === "GET") {
      // FX desk Slice 5 — risk-officer view: rejection feed + correspondent
      // routing status. Replays the event store, folds CorrespondentRouting,
      // collects OrderRejectedAtGateway events (newest-first, ≤50).
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
      return jsonResponse(buildRiskView(eventStore));
    }
    if (url.pathname === "/api/markets/fx/rejections" && req.method === "GET") {
      // FX desk Slice 5 — rejection feed sub-slice. Convenience endpoint that
      // returns only the rejections array + asOf from the full risk view.
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
      const view = buildRiskView(eventStore);
      return jsonResponse({ rejections: view.rejections, asOf: view.asOf });
    }
    if (url.pathname === "/api/markets/fx/correspondent-routing" && req.method === "GET") {
      // FX desk Slice 5 — correspondent-routing status endpoint (FX-scoped alias
      // for /api/correspondent-routing; used by risk.js on the risk page).
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
      //            D-FX-CORRESPONDENT-PAIR-NAMING (CEO-approved 2026-05-09).
      const view = buildRiskView(eventStore);
      return jsonResponse({ correspondentStatus: view.correspondentStatus, asOf: view.asOf });
    }
    if (url.pathname === "/api/markets/fx/summary" && req.method === "GET") {
      // FX desk Slice 6 — CEO oversight tile source. Single-pass replay
      // counting RfqRequested, FxTradeExecuted, OrderApprovedAtGateway,
      // OrderRejectedAtGateway events; top-3 counterparties by trade count;
      // B3 (Market Risk) utilisation RAG status from the limit-utilisation
      // projection. Powers the live metrics on the FX desk tile in home.html.
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
      return jsonResponse(buildFxSummaryView(eventStore, marketDataStore));
    }
    if (url.pathname === "/api/markets/fx/order" && req.method === "POST") {
      // FX desk Slice 4 — order acceptance + gateway pipeline. Routes
      // the RFQ through the 7-check pre-trade gateway (identity, sanctions,
      // suitability, counterparty-eligibility, credit-limit, capital-impact,
      // funding) and returns per-check outcomes. Emits OrderProposed,
      // GatewayCheckRequested×7, GatewayCheckCompleted×7, and either
      // OrderApprovedAtGateway or OrderRejectedAtGateway.
      // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
      return handleFxOrder(req);
    }
    // ---------- Product Control — daily FX P&L ----------
    if (url.pathname === "/api/product-control/daily-pnl" && req.method === "GET") {
      // Returns the latest DailyPnLReportGenerated event payload plus
      // per-trade detail rows. If no report has been generated yet,
      // computes one on-demand (not persisted).
      // Authority: D-FX-SALES-TRADING-FRONTEND; IFRS 9 §5.7.1.
      const reportDate = nowUtc().slice(0, 10);
      // Find the latest persisted report.
      let latestReport: unknown = null;
      for (const e of eventStore.replay({ type: "DailyPnLReportGenerated" })) {
        latestReport = e.payload; // keep last (replay is oldest-first)
      }
      // Compute fresh trade-level detail and report on demand.
      const {
        payload: freshPayload,
        trades,
        marksUnavailableCount,
        totalUnrealised,
      } = computeDailyPnL(eventStore, reportDate);
      // Classify each unmarkable live position: a pair with a production tick
      // is merely awaiting revaluation (not a feed gap); only a pair with no
      // production tick at all genuinely needs an MTM feed. Lets the banner
      // state an honest cause instead of always asserting "MTM feed required".
      const marksUnavailable = classifyUnmarkable(
        freshPayload.unmarkableLiveTradeIds,
        trades,
        (pair) =>
          lookupQuoteWithInverse(marketDataStore, pair, { provenance: "production" }) !== null,
      );
      // Surface the headline-unrealised completeness explicitly (no-silent-zero,
      // D-TRUSTED-FIGURES-PROGRAM-V1). Computed fresh so the signal is honest
      // even if `latestReport` is a stale persisted payload predating this
      // field. `unrealisedComplete: false` means the figure EXCLUDES ≥1
      // unmarkable live position and must not be read as a complete number.
      return jsonResponse({
        report: latestReport ?? freshPayload,
        trades,
        marksUnavailableCount,
        marksUnavailable,
        unrealisedComplete: freshPayload.unrealisedComplete,
        unmarkableLivePositions: freshPayload.unmarkableLivePositions,
        unmarkableLiveTradeIds: freshPayload.unmarkableLiveTradeIds,
        unrealisedFigureState: totalUnrealised.present ? "complete" : "incomplete",
        asOf: nowUtc(),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/product-control/report-history" && req.method === "GET") {
      // Returns all DailyPnLReportGenerated events, newest first.
      // Authority: D-FX-SALES-TRADING-FRONTEND; IFRS 9 §5.7.1.
      const reports: unknown[] = [];
      for (const e of eventStore.replay({ type: "DailyPnLReportGenerated" })) {
        reports.push(e.payload);
      }
      reports.reverse(); // newest first
      return jsonResponse({
        reports,
        total: reports.length,
        asOf: nowUtc(),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/product-control/desk-cash" && req.method === "GET") {
      // Desk FX cash instruments — each desk's settled foreign-currency cash
      // inventory priced to ZAR (IAS 21 §28). Pure read; no appends.
      // FinancialInput<number> is flattened at the API boundary into
      // { unrealisedMarkable: boolean, unrealisedPnlZarMinor: number }.
      // Authority: D-FX-SALES-TRADING-FRONTEND; IAS 21 §28; D-TRUSTED-FIGURES-PROGRAM-V1.
      const set = computeDeskCashPositions(eventStore);
      const positions = set.positions.map((p) => ({
        instrumentId: p.instrumentId,
        entity: p.entity,
        bookId: p.bookId,
        currency: p.currency,
        fcyQuantityMinor: p.fcyQuantityMinor,
        avgCostZarRate: p.avgCostZarRate,
        markRate: p.markRate,
        zarValueMinor: p.zarValueMinor,
        unrealisedMarkable: isPresent(p.unrealisedPnlZarMinor),
        unrealisedPnlZarMinor: isPresent(p.unrealisedPnlZarMinor)
          ? p.unrealisedPnlZarMinor.value
          : 0,
        realisedZarMinorCumulative: p.realisedZarMinorCumulative,
      }));
      return jsonResponse({
        positions,
        totalRealisedZarMinor: set.totalRealisedZarMinor,
        markableUnrealisedZarMinor: set.markableUnrealisedZarMinor,
        unmarkableKeys: set.unmarkableKeys,
        asOf: nowUtc(),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/product-control/cross-asset" && req.method === "GET") {
      // Cross-asset Product Control breakdown — P&L by instrument and by book
      // across EVERY asset class (FX spot & forward, desk cash, bonds, equities,
      // IRD). Pure composition of the FX daily-pnl engine, desk-cash pricer and
      // the all-asset position-source. FinancialInput<number> is flattened at
      // the API boundary into { markable: boolean, valueZarMinor: number }.
      // Authority: Marc (CEO) 2026-06-08 (all instruments / all books); Camille
      //   (CFO) R3; D-TRUSTED-FIGURES-PROGRAM-V1 (no-silent-zero).
      const bd = buildCrossAssetBreakdown(eventStore, nowUtc().slice(0, 10));
      const instruments = bd.instruments.map((r) => ({
        instrumentKey: r.instrumentKey,
        assetClass: r.assetClass,
        fxTaxonomy: r.fxTaxonomy ?? null,
        bookId: r.bookId,
        currency: r.currency,
        quantity: r.quantity,
        markable: isPresent(r.unrealised),
        unrealisedZarMinor: isPresent(r.unrealised) ? r.unrealised.value : 0,
        realisedZarMinor: r.realisedZarMinor,
        positionCount: r.positionCount,
        markStatus: r.markStatus,
      }));
      const books = bd.books.map((b) => ({
        bookId: b.bookId,
        assetClasses: b.assetClasses,
        instrumentCount: b.instrumentCount,
        positionCount: b.positionCount,
        markable: isPresent(b.unrealised),
        unrealisedZarMinor: isPresent(b.unrealised) ? b.unrealised.value : 0,
        realisedZarMinor: b.realisedZarMinor,
      }));
      return jsonResponse({
        instruments,
        books,
        markableUnrealisedZarMinor: bd.markableUnrealisedZarMinor,
        totalRealisedZarMinor: bd.totalRealisedZarMinor,
        unrealisedComplete: isPresent(bd.totalUnrealised),
        unmarkableKeys: bd.unmarkableKeys,
        asOf: nowUtc(),
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // ---------- end Product Control ----------

    // ---------- Products (NPA & review console) ----------
    // GET /api/products — cross-family product list with per-dimension
    // attestation summary. Authority: D-NEW-PRODUCT-APPROVAL-POLICY.
    if (url.pathname === "/api/products" && req.method === "GET") {
      return jsonResponse(buildProductListView(eventStore, nowUtc()));
    }
    // GET /api/products/:productId — full per-product detail (14 dimensions,
    // narratives, worked journal entries per lifecycle event).
    {
      const detailMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
      if (detailMatch?.[1] && req.method === "GET") {
        const productId = decodeURIComponent(detailMatch[1]);
        const view = buildProductDetailView(productId, eventStore, nowUtc());
        if (!view) return jsonResponse({ error: `Product not found: ${productId}` }, 404);
        return jsonResponse(view);
      }
    }
    // POST /api/products/propose — emit ProductProposalRegistered.
    if (url.pathname === "/api/products/propose" && req.method === "POST") {
      return handleProductPropose(req);
    }
    // POST /api/products/attest — emit ProductDimensionAttested.
    if (url.pathname === "/api/products/attest" && req.method === "POST") {
      return handleProductAttest(req);
    }
    // POST /api/products/approve — emit ProductApproved.
    if (url.pathname === "/api/products/approve" && req.method === "POST") {
      return handleProductApprove(req);
    }
    // POST /api/products/narrative — emit ProductDimensionNarrativeRecorded.
    if (url.pathname === "/api/products/narrative" && req.method === "POST") {
      return handleProductNarrative(req);
    }
    // POST /api/products/narrative/request — emit ProductDimensionNarrativeRequested.
    if (url.pathname === "/api/products/narrative/request" && req.method === "POST") {
      return handleProductNarrativeRequest(req);
    }
    // ---------- end Products ----------
    // GET /api/treasury — aggregated treasury metrics (capital, liquidity,
    // IRRBB, collateral, FTP) derived from existing engines.
    // Authority: WS3-PR3a (brief:atlas:ws3-pr3a-treasury-dashboard-scaffold-api-treasur:2026-05-23).
    if (url.pathname === "/api/treasury" && req.method === "GET") {
      return jsonResponse(buildTreasuryMetrics());
    }
    if (url.pathname === "/api/events" && req.method === "GET") {
      // Event store browser — paginated, filterable by type / entity / search / provenance.
      // Query params:
      //   ?page=N           — 1-based page (default 1)
      //   ?limit=N          — page size 1–200 (default 50)
      //   ?type=X           — exact event type filter
      //   ?entity=X         — exact entity filter
      //   ?search=X         — substring match on event_id or payload JSON
      //   ?provenance=M     — provenance mode: "all" | "production-only" | "simulated-only"
      //                       (default "all" so the browser shows every event in the store)
      // pageProvenance: production (real event log, not simulated data).
      const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
      const limit = Math.min(
        200,
        Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
      );
      const typeFilter = url.searchParams.get("type") ?? "";
      const entityFilter = url.searchParams.get("entity") ?? "";
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const provenanceParam = url.searchParams.get("provenance") ?? "all";
      // Resolve to a ProvenanceFilter for the browser — "all" means combined (no filtering).
      const browseProvenanceFilter =
        provenanceParam === "production-only"
          ? { mode: "production-only" as const }
          : provenanceParam === "simulated-only"
            ? { mode: "simulated-only" as const }
            : { mode: "combined" as const };

      const replayOpts: { type?: string; entity?: string } = {};
      if (typeFilter) replayOpts.type = typeFilter;
      if (entityFilter) replayOpts.entity = entityFilter;

      const allEvents: Array<{
        sequence: number;
        event_id: string;
        type: string;
        as_of: string;
        entity: string;
        actor: unknown;
        provenance: unknown;
        payload: unknown;
      }> = [];

      let seq = 0;
      for (const ev of eventStore.replay(replayOpts)) {
        seq++;
        // Apply provenance filter if not "all"/"combined".
        if (browseProvenanceFilter.mode !== "combined") {
          if (!eventMatchesProvenanceFilter(ev, browseProvenanceFilter)) continue;
        }
        if (search) {
          const haystack = `${ev.event_id} ${JSON.stringify(ev.payload)}`.toLowerCase();
          if (!haystack.includes(search)) continue;
        }
        allEvents.push({
          sequence: seq,
          event_id: ev.event_id,
          type: ev.type,
          as_of: ev.as_of,
          entity: ev.entity,
          actor: ev.actor,
          provenance: ev.provenance ?? null,
          payload: ev.payload,
        });
      }

      allEvents.reverse();
      const total = allEvents.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const offset = (safePage - 1) * limit;
      const rows = allEvents.slice(offset, offset + limit);

      // Distinct type list for filter dropdown (from full unfiltered store).
      const allTypes = new Set<string>();
      if (!typeFilter && !entityFilter && !search) {
        for (const ev of eventStore.replay()) allTypes.add(ev.type);
      }

      return jsonResponse({
        total,
        page: safePage,
        limit,
        totalPages,
        typeFilter,
        entityFilter,
        search,
        provenanceFilter: provenanceParam,
        events: rows,
        storeCount: eventStore.count(),
        pageProvenance: { mode: "production-only" },
      });
    }
    if (url.pathname === "/api/refresh" && req.method === "POST") {
      refresh("api-refresh");
      return jsonResponse({ ok: true, asOf: cachedState.asOf });
    }
    // ---------- Platform config store — GET /api/config, PATCH /api/config ----------
    // Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25)
    if (url.pathname === "/api/config" && req.method === "GET") {
      return jsonResponse(buildConfigView());
    }
    if (url.pathname === "/api/config" && req.method === "PATCH") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return new Response(JSON.stringify({ error: "Body must be an object" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const patch = body as Record<string, unknown>;
      const KNOWN_PATH_KEYS: (keyof BankConfigPaths)[] = [
        "eventDb",
        "marketDataDb",
        "graphDb",
        "documentStoreRoot",
        "archiveDir",
        "repoRoot",
      ];
      const KNOWN_SERVER_KEYS: (keyof BankConfigServer)[] = ["port", "refreshMs"];
      const KNOWN_DISPLAY_KEYS: (keyof BankConfigDisplay)[] = [
        "decimals",
        "thousandsSeparator",
        "negativeStyle",
        "rightAlignNumbers",
        "currencyPosition",
        "locale",
      ];
      // Validate — reject unknown top-level keys
      const unknownKeys = Object.keys(patch).filter(
        (k) => k !== "paths" && k !== "server" && k !== "display",
      );
      if (unknownKeys.length > 0) {
        return new Response(JSON.stringify({ error: `Unknown keys: ${unknownKeys.join(", ")}` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Validate paths sub-keys
      if (patch.paths !== undefined) {
        if (typeof patch.paths !== "object" || patch.paths === null) {
          return new Response(JSON.stringify({ error: "paths must be an object" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const unknownPathKeys = Object.keys(patch.paths as object).filter(
          (k) => !KNOWN_PATH_KEYS.includes(k as keyof BankConfigPaths),
        );
        if (unknownPathKeys.length > 0) {
          return new Response(
            JSON.stringify({ error: `Unknown paths keys: ${unknownPathKeys.join(", ")}` }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      // Validate server sub-keys
      if (patch.server !== undefined) {
        if (typeof patch.server !== "object" || patch.server === null) {
          return new Response(JSON.stringify({ error: "server must be an object" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const unknownServerKeys = Object.keys(patch.server as object).filter(
          (k) => !KNOWN_SERVER_KEYS.includes(k as keyof BankConfigServer),
        );
        if (unknownServerKeys.length > 0) {
          return new Response(
            JSON.stringify({ error: `Unknown server keys: ${unknownServerKeys.join(", ")}` }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      // Validate display sub-keys (typed: enums + scalar types)
      if (patch.display !== undefined) {
        if (typeof patch.display !== "object" || patch.display === null) {
          return new Response(JSON.stringify({ error: "display must be an object" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const d = patch.display as Record<string, unknown>;
        const unknownDisplayKeys = Object.keys(d).filter(
          (k) => !KNOWN_DISPLAY_KEYS.includes(k as keyof BankConfigDisplay),
        );
        if (unknownDisplayKeys.length > 0) {
          return new Response(
            JSON.stringify({ error: `Unknown display keys: ${unknownDisplayKeys.join(", ")}` }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const displayError = ((): string | null => {
          if (d.decimals !== undefined) {
            if (
              typeof d.decimals !== "number" ||
              !Number.isInteger(d.decimals) ||
              d.decimals < 0 ||
              d.decimals > 8
            )
              return "display.decimals must be an integer 0–8";
          }
          if (d.thousandsSeparator !== undefined && typeof d.thousandsSeparator !== "boolean")
            return "display.thousandsSeparator must be a boolean";
          if (d.rightAlignNumbers !== undefined && typeof d.rightAlignNumbers !== "boolean")
            return "display.rightAlignNumbers must be a boolean";
          if (d.negativeStyle !== undefined && !NEGATIVE_STYLES.includes(d.negativeStyle as never))
            return `display.negativeStyle must be one of: ${NEGATIVE_STYLES.join(", ")}`;
          if (
            d.currencyPosition !== undefined &&
            !CURRENCY_POSITIONS.includes(d.currencyPosition as never)
          )
            return `display.currencyPosition must be one of: ${CURRENCY_POSITIONS.join(", ")}`;
          if (d.locale !== undefined && (typeof d.locale !== "string" || d.locale.trim() === ""))
            return "display.locale must be a non-empty string";
          return null;
        })();
        if (displayError) {
          return new Response(JSON.stringify({ error: displayError }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      updateConfigFile({
        paths: patch.paths as Partial<BankConfigPaths> | undefined,
        server: patch.server as Partial<BankConfigServer> | undefined,
        display: patch.display as Partial<BankConfigDisplay> | undefined,
      });
      return jsonResponse({ ok: true, config: buildConfigView() });
    }
    if (url.pathname === "/api/decide" && req.method === "POST") {
      return handleDecide(req);
    }
    if (url.pathname === "/api/decisions/comment" && req.method === "POST") {
      return handleComment(req);
    }
    if (url.pathname === "/api/inflight/start" && req.method === "POST") {
      return handleStartWorkstream(req);
    }
    if (url.pathname === "/api/inflight/complete" && req.method === "POST") {
      return handleCompleteWorkstream(req);
    }
    // ---------- RMS Phase 1 Slice 4 — register render endpoints ----------
    // Catalogue + counts. Authority: D-RMS-PHASE-1-SLICE-4 under standing
    // D-RMS-PHASE-1.
    if (url.pathname === "/api/rms" && req.method === "GET") {
      return handleRmsCatalogue();
    }
    if (url.pathname === "/api/rms/document-content" && req.method === "GET") {
      return handleRmsDocumentContent(url.searchParams);
    }
    {
      const rmsMatch = url.pathname.match(/^\/api\/rms\/(.+)$/);
      if (rmsMatch?.[1] && req.method === "GET") {
        return handleRmsRegister(decodeURIComponent(rmsMatch[1]));
      }
    }
    // ---------- A3.2 Oversight UI projections (read-only) ----------
    if (url.pathname === "/api/escalations" && req.method === "GET") {
      // pageProvenance: event-derived → simulated-only in build phase.
      const resolvedIds = new Set(cachedState.decisionsResolved.map((r) => r.id));
      const views = enrichBlockedBy(listEscalations(eventStore, resolvedIds), eventStore);
      return jsonResponse({
        asOf: cachedState.asOf,
        escalations: views,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    if (url.pathname === "/api/fleet" && req.method === "GET") {
      // pageProvenance: event-derived → simulated-only in build phase.
      const resolvedIds = new Set(cachedState.decisionsResolved.map((r) => r.id));
      const escalations = enrichBlockedBy(listEscalations(eventStore, resolvedIds), eventStore);
      const fleet = buildFleetStatus(cachedState, escalations, eventStore);
      return jsonResponse({
        asOf: cachedState.asOf,
        fleet,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // ---------- Autonomy view — GET /api/autonomy ----------
    // Isolates genuinely-autonomous agent activity (substrate = "agent-runtime")
    // from the scheduler heartbeat and Scrooge-coordinated in-session runs, so the
    // CEO can see — and watch climb — how much the bank is running itself.
    //
    // READ-ONLY: replays the live shared event store; emits no new events.
    // Authority: D-AGENT-AUTONOMY-COHORT-2-PILOT (CEO-approved 2026-05-30).
    // Author: Noa (Intranet Product Owner & UI Architect, engineering),
    // brief brief:noa:add-autonomy-dashboard-view-autonomous-activity-:2026-05-30.
    //
    // Substrate lives on AgentRunStarted payloads; AgentRunCompleted does not carry
    // it. So each run is classified by its Started event's substrate, and completion
    // data (outcome, duration, deliverables) is joined back by runId.
    if (url.pathname === "/api/autonomy" && req.method === "GET") {
      type AgentRef = { name?: string; position?: string; agentId?: string };
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();

      const tsMs = (s: unknown): number | null => {
        if (typeof s !== "string" || !s) return null;
        const t = Date.parse(s);
        return Number.isNaN(t) ? null : t;
      };
      const durationLabel = (startMs: number | null, endMs: number | null): string | undefined => {
        if (startMs === null || endMs === null || endMs < startMs) return undefined;
        const secs = Math.round((endMs - startMs) / 1000);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        if (mins < 60) return `${mins}m ${remSecs}s`;
        const hours = Math.floor(mins / 60);
        return `${hours}h ${mins % 60}m`;
      };

      // Index Started events by runId, capturing substrate + start metadata.
      type StartedMeta = {
        runId: string;
        briefId?: string;
        agent: AgentRef;
        substrate: string;
        startedAt?: string;
        startedMs: number | null;
      };
      const startedByRun = new Map<string, StartedMeta>();
      for (const ev of eventStore.replay({ type: "AgentRunStarted" })) {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        const runId = typeof p.runId === "string" ? p.runId : null;
        if (!runId) continue;
        const startedAt = typeof p.startedAt === "string" ? p.startedAt : undefined;
        startedByRun.set(runId, {
          runId,
          briefId: typeof p.briefId === "string" ? p.briefId : undefined,
          agent: (p.agent ?? {}) as AgentRef,
          substrate: typeof p.substrate === "string" ? p.substrate : "unknown",
          startedAt,
          startedMs: tsMs(startedAt) ?? tsMs(ev.as_of),
        });
      }

      // Index Completed events by runId.
      type CompletedMeta = {
        outcome?: string;
        completedAt?: string;
        completedMs: number | null;
        deliverableCount: number;
        briefId?: string;
        agent?: AgentRef;
      };
      const completedByRun = new Map<string, CompletedMeta>();
      for (const ev of eventStore.replay({ type: "AgentRunCompleted" })) {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        const runId = typeof p.runId === "string" ? p.runId : null;
        if (!runId) continue;
        const completedAt = typeof p.completedAt === "string" ? p.completedAt : undefined;
        const hashes = Array.isArray(p.deliverableDocumentHashes)
          ? p.deliverableDocumentHashes
          : [];
        completedByRun.set(runId, {
          outcome: typeof p.outcome === "string" ? p.outcome : undefined,
          completedAt,
          completedMs: tsMs(completedAt) ?? tsMs(ev.as_of),
          deliverableCount: hashes.length,
          briefId: typeof p.briefId === "string" ? p.briefId : undefined,
          agent: (p.agent ?? undefined) as AgentRef | undefined,
        });
      }

      // ── 1. Autonomy ratio (all-time + last-7-days) ─────────────────
      // Count runs by substrate class. A run is counted once (by its Started
      // event). Recency keyed on startedMs.
      let autoAll = 0;
      let coordAll = 0;
      let autoWk = 0;
      let coordWk = 0;
      for (const meta of startedByRun.values()) {
        const isAuto = meta.substrate === "agent-runtime";
        const isCoord = meta.substrate === "scrooge-coordinated-in-session";
        if (!isAuto && !isCoord) continue;
        if (isAuto) autoAll++;
        else coordAll++;
        const recent = meta.startedMs !== null && nowMs - meta.startedMs <= SEVEN_DAYS_MS;
        if (recent) {
          if (isAuto) autoWk++;
          else coordWk++;
        }
      }

      // ── 2. Autonomous run feed (agent-runtime only, newest first) ──
      const autonomousRuns = [...startedByRun.values()]
        .filter((m) => m.substrate === "agent-runtime")
        .sort((a, b) => (b.startedMs ?? 0) - (a.startedMs ?? 0))
        .map((m) => {
          const comp = completedByRun.get(m.runId);
          return {
            runId: m.runId,
            agentName: m.agent?.name ?? comp?.agent?.name ?? "",
            agentPosition: m.agent?.position ?? comp?.agent?.position ?? "",
            briefId: m.briefId ?? comp?.briefId ?? "",
            startedAt: m.startedAt,
            completedAt: comp?.completedAt,
            outcome: comp?.outcome,
            deliverableCount: comp?.deliverableCount ?? 0,
            durationLabel: durationLabel(m.startedMs, comp?.completedMs ?? null),
          };
        });

      // ── 3. Goal-loop heartbeat-vs-action split (per agent) ─────────
      type GoalAgg = { agentUrn: string; evaluated: number; deferred: number };
      const goalByAgent = new Map<string, GoalAgg>();
      const ensureGoal = (urn: string): GoalAgg => {
        let g = goalByAgent.get(urn);
        if (!g) {
          g = { agentUrn: urn, evaluated: 0, deferred: 0 };
          goalByAgent.set(urn, g);
        }
        return g;
      };
      for (const ev of eventStore.replay({ type: "AgentGoalEvaluated" })) {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        const urn = typeof p.agentUrn === "string" ? p.agentUrn : "unknown";
        ensureGoal(urn).evaluated++;
      }
      for (const ev of eventStore.replay({ type: "AgentGoalDeferred" })) {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        const urn = typeof p.agentUrn === "string" ? p.agentUrn : "unknown";
        ensureGoal(urn).deferred++;
      }
      const goalLoop = [...goalByAgent.values()]
        .map((g) => {
          // Evaluated events are total goal-loop iterations; deferred is the
          // subset that took no action. "Acted" = evaluated minus deferred,
          // floored at 0 (defensive against any out-of-window deferrals).
          const acted = Math.max(0, g.evaluated - g.deferred);
          const denom = g.evaluated > 0 ? g.evaluated : g.deferred;
          const deferRatio = denom > 0 ? g.deferred / denom : 0;
          return {
            agentUrn: g.agentUrn,
            agentName: g.agentUrn.replace(/^agent:/, ""),
            evaluated: g.evaluated,
            deferred: g.deferred,
            acted,
            deferRatio,
          };
        })
        .sort((a, b) => b.deferred + b.evaluated - (a.deferred + a.evaluated));

      // ── 4. Scheduler heartbeat (last N, demoted in the UI) ─────────
      const HEARTBEAT_LIMIT = 20;
      const allTicks: Array<{
        agentUrn?: string;
        triggerId?: string;
        cronExpression?: string;
        firedAt?: string;
        firedMs: number | null;
      }> = [];
      let heartbeatTotal = 0;
      for (const ev of eventStore.replay({ type: "ScheduledTrigger" })) {
        heartbeatTotal++;
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        const firedAt = typeof p.firedAt === "string" ? p.firedAt : undefined;
        allTicks.push({
          agentUrn: typeof p.agentUrn === "string" ? p.agentUrn : undefined,
          triggerId: typeof p.triggerId === "string" ? p.triggerId : undefined,
          cronExpression: typeof p.cronExpression === "string" ? p.cronExpression : undefined,
          firedAt,
          firedMs: tsMs(firedAt) ?? tsMs(ev.as_of),
        });
      }
      const heartbeatRecent = allTicks
        .sort((a, b) => (b.firedMs ?? 0) - (a.firedMs ?? 0))
        .slice(0, HEARTBEAT_LIMIT)
        .map(({ firedMs, ...rest }) => rest);

      // ── 5. Autonomy-relevant alerts (inactivity) ───────────────────
      const inactivityAlerts: Array<{
        alertId?: string;
        agentUrn?: string;
        severity?: string;
        details?: string;
        at?: string;
        atMs: number | null;
      }> = [];
      for (const ev of eventStore.replay({ type: "SubstrateAlert" })) {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        if (p.alertClass !== "inactivity") continue;
        inactivityAlerts.push({
          alertId: typeof p.alertId === "string" ? p.alertId : undefined,
          agentUrn: typeof p.agentUrn === "string" ? p.agentUrn : undefined,
          severity: typeof p.severity === "string" ? p.severity : undefined,
          details: typeof p.details === "string" ? p.details : undefined,
          at: ev.as_of,
          atMs: tsMs(ev.as_of),
        });
      }
      inactivityAlerts.sort((a, b) => (b.atMs ?? 0) - (a.atMs ?? 0));
      const inactivityAlertsOut = inactivityAlerts.slice(0, 30).map(({ atMs, ...rest }) => rest);

      return jsonResponse({
        asOf: cachedState.asOf,
        ratio: {
          allTime: { autonomous: autoAll, coordinated: coordAll },
          last7Days: { autonomous: autoWk, coordinated: coordWk },
        },
        autonomousRuns,
        goalLoop,
        heartbeat: { totalCount: heartbeatTotal, recent: heartbeatRecent },
        inactivityAlerts: inactivityAlertsOut,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    // Decisions register — all authorities (CEO, CRO, CoSec, Agent, etc.).
    // Authority: D-DECISIONS-FRAMEWORK-REDESIGN (unified Decision event type).
    if (url.pathname === "/api/decisions-register" && req.method === "GET") {
      // D-DATA-QUALITY-GOLDEN-SOURCE-V1: include escalation-derived open
      // decisions so this endpoint returns the same set as cachedState.decisionsOpenAll.
      const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
      const resolvedIds = new Set(register.resolved.map((r) => r.decisionId));
      // AgentEscalationDecided events close escalations; add their IDs to
      // resolvedIds so buildOpenDecisionsFromEscalations excludes them.
      for (const e of eventStore.replay({ type: "AgentEscalationDecided" })) {
        const id = (e.payload as Record<string, unknown>).escalationId;
        if (typeof id === "string" && id) resolvedIds.add(id);
      }
      const escalationOpen = buildOpenDecisionsFromEscalations(
        EVENTS.agentEscalations(),
        resolvedIds,
      );
      return jsonResponse({
        open: [
          ...register.open.map((r) => ({
            id: r.decisionId,
            title: r.title,
            authority: r.authority,
            authorityRef: r.authorityRef,
            category: r.category,
            phase: r.phase,
            requestedAt: r.openedAt,
          })),
          ...escalationOpen.map((d) => ({
            id: d.id,
            title: d.title,
            authority: "Agent" as const,
            authorityRef: d.owner,
            category: d.category,
            phase: "requested" as const,
            requestedAt: undefined,
            trigger: d.trigger,
            note: d.note,
          })),
        ],
        resolved: register.resolved.map((r) => ({
          id: r.decisionId,
          title: r.title,
          authority: r.authority,
          authorityRef: r.authorityRef,
          category: r.category,
          phase: r.phase,
          actionedAt: r.resolvedAt ?? r.asOf,
          outcome: r.recommendation,
        })),
        asOf: cachedState.asOf,
        pageProvenance: eventDerivedPageProvenance(),
      });
    }
    {
      const decisionMatch = url.pathname.match(/^\/api\/decisions\/(.+)$/);
      if (decisionMatch?.[1] && req.method === "GET") {
        const decisionId = decodeURIComponent(decisionMatch[1]);
        const view = buildDecisionDrillDown(eventStore, cachedState, decisionId);
        if (!view) {
          return jsonResponse({ error: `Decision not found: ${decisionId}` }, 404);
        }
        // Enrich open.authority from the decisions register if missing.
        // Owner-Inbox-sourced OpenDecisions may not carry authority; the
        // register always has it when the Decision event was recorded.
        let enrichedView = view;
        if (view.open && !view.open.authority) {
          const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
          const regRow = register.open.find((r) => r.decisionId === decisionId);
          if (regRow?.authority) {
            enrichedView = {
              ...view,
              open: { ...view.open, authority: regRow.authority },
            };
          }
        }
        // Attach the rich RMS decisions-register row when present — gives
        // the drill-down page the supporting context (citations, source
        // documents, recommendation, options, deadline, requestedAt,
        // resolution metadata) without a second round-trip.
        const rmsFold = getRmsFold();
        const rmsRow = rmsFold.decisions.find((r) => r.decisionId === decisionId);
        if (rmsRow) {
          enrichedView = { ...enrichedView, registerRow: rmsRow };
        }
        return jsonResponse({
          asOf: cachedState.asOf,
          ...enrichedView,
          ...(enrichedView.popiaS71 ? { popiaNotice: POPIA_S71_NOTICE } : {}),
          // Decision drill-down folds CeoDecision* events from the
          // event store → build phase resolves to simulated-only.
          pageProvenance: eventDerivedPageProvenance(),
        });
      }
    }
    // Decisions register page (all authorities, filterable).
    // Must be checked before the /decisions/:id drill-down route.
    if (req.method === "GET" && url.pathname === "/decisions") {
      return serveStatic("/decisions.html", req);
    }
    // New Product Approval & Review console.
    // D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10).
    if (req.method === "GET" && (url.pathname === "/products" || url.pathname === "/products/")) {
      return serveStatic("/products.html", req);
    }
    // Pretty-URL routes for drill-down — Bun serves the static HTML and the
    // page reads the decisionId from `window.location.pathname`.
    if (req.method === "GET" && url.pathname.startsWith("/decisions/")) {
      return serveStatic("/decision.html", req);
    }
    if (req.method === "GET" && url.pathname === "/escalations") {
      return serveStatic("/escalations.html", req);
    }
    // Bank UI v0 — `/` lands on the home shell. The legacy operations
    // dashboard remains at `/index.html` for backwards reference and
    // is linked from the shell sidebar. CEO directive 2026-05-09;
    // Atlas + Anya + Linnea bank-UI v0.
    if (req.method === "GET" && url.pathname === "/") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/home.html" },
      });
    }
    // KYC onboarding queue + subpages.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (req.method === "GET" && url.pathname === "/kyc-onboarding") {
      return serveStatic("/kyc-onboarding.html", req);
    }
    if (req.method === "GET" && url.pathname === "/kyc-onboarding/new") {
      return serveStatic("/kyc-onboarding-new.html", req);
    }
    if (req.method === "GET" && url.pathname === "/kyc-onboarding/simulate") {
      return serveStatic("/kyc-simulate.html", req);
    }
    if (req.method === "GET" && url.pathname.startsWith("/kyc-onboarding/")) {
      return serveStatic("/kyc-candidate.html", req);
    }
    // KYC accepted clients register.
    // D-KYC-ONBOARDING-BUILD; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
    if (
      req.method === "GET" &&
      (url.pathname === "/kyc-clients" || url.pathname === "/kyc-clients/")
    ) {
      return serveStatic("/kyc-clients.html", req);
    }
    if (req.method === "GET" && url.pathname.startsWith("/kyc-clients/")) {
      return serveStatic("/kyc-client-detail.html", req);
    }
    if (req.method === "GET" && url.pathname === "/fleet") {
      return serveStatic("/fleet.html", req);
    }
    // RMS register hub + per-register page (Slice 4).
    if (req.method === "GET" && (url.pathname === "/rms" || url.pathname === "/rms/")) {
      return serveStatic("/rms.html", req);
    }
    // Briefs / dispatches register page — RMS Phase 2 Block A (events-first
    // dispatch). Dedicated route with filters + drawer; the underlying
    // register is also accessible at /rms.html?register=briefs-dispatches.
    // Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
    // TODO F-029: when a future PR adds an action endpoint here
    // (e.g. POST /api/briefs/supersede), validate the request body with a
    // Zod schema rather than an `as` cast.
    if (req.method === "GET" && (url.pathname === "/briefs" || url.pathname === "/briefs/")) {
      return serveStatic("/briefs.html", req);
    }
    // Brief drill-down — pretty URL `/briefs/<briefId>`. Mirrors the
    // /decisions/:id pattern: Bun serves the static detail page and brief.js
    // reads the briefId from `window.location.pathname`. Must be checked after
    // the exact `/briefs` route above.
    // Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
    if (req.method === "GET" && url.pathname.startsWith("/briefs/")) {
      return serveStatic("/brief.html", req);
    }
    // Document register page — RMS Phase 2 Block B (RecordFiled wiring).
    // Mirrors the /briefs pattern: dedicated route with classification +
    // register-key filters and a drawer for full hash + body preview +
    // retention citation + supersession chain. The underlying register
    // is also accessible at /rms.html?register=document.
    // Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
    // F-029 — GET-only, no body to validate. When a future PR adds an
    // action endpoint here (e.g. POST /api/documents/reclassify),
    // validate the request body with a Zod schema rather than an `as`
    // cast.
    if (req.method === "GET" && (url.pathname === "/documents" || url.pathname === "/documents/")) {
      return serveStatic("/documents.html", req);
    }
    // ── General Ledger endpoints — /api/gl/* ──────────────────────────────
    // Authority: General-ledger substrate (Devon COO, engineering);
    //            GL posting engine (Bea CFO, governance).
    // Routes: GET /api/gl/entries, GET /api/gl/trial-balance,
    //         GET /api/gl/accounts, POST /api/gl/journal,
    //         POST /api/gl/run-posting-engine.
    {
      const glResponse = await registerGlRoutes(
        url.pathname,
        req.method,
        url.searchParams,
        req,
        eventStore,
      );
      if (glResponse) return glResponse;
    }
    // ── Regulatory knowledge graph endpoints ──────────────────────────────
    // Authority: PR #424 (graph substrate); Principle 2 (single-graph
    // discipline). The graph DB is lazy-initialised; endpoints handle
    // empty state (totalNodes === 0) gracefully.
    {
      const graphResponse = registerGraphRoutes(url.pathname, req.method, url.searchParams);
      if (graphResponse) return graphResponse;
    }
    if (req.method === "GET" && url.pathname === "/gl") {
      return serveStatic("/gl.html", req);
    }
    // ── SLA parallel-representation preview (read-only / dry-run) ──────────
    // Phase-0 spec §9.2: side-by-side IFRS book entry + SARB-BA-RETURN NOP
    // memorandum entry for one FX event. SARB-BA-RETURN is NOT activated in
    // the production posting path — this is the demonstration surface only.
    // Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4); D-SLA-FIRST-
    // REPRESENTATION-SARB-BA (CFO Camille).
    {
      const slaResponse = registerSlaRepresentationRoutes(
        url.pathname,
        req.method,
        url.searchParams,
      );
      if (slaResponse) return slaResponse;
    }
    if (req.method === "GET" && url.pathname === "/sla-representations") {
      return serveStatic("/sla-representations.html", req);
    }
    // SLA rule approval workflow surface (Phase 4c).
    // Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c); D-SLA-APPROVAL-WORKFLOW-SEGREGATION.
    {
      const approvalResponse = await registerSlaApprovalRoutes(url.pathname, req.method, req);
      if (approvalResponse) return approvalResponse;
    }
    if (req.method === "GET" && url.pathname === "/sla-approvals") {
      return serveStatic("/sla-approvals.html", req);
    }
    // Financial-instrument register pages.
    // Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
    if (req.method === "GET" && url.pathname === "/instruments/new") {
      return serveStatic("/instruments-new.html", req);
    }
    if (
      req.method === "GET" &&
      (url.pathname === "/instruments" || url.pathname === "/instruments/")
    ) {
      return serveStatic("/instruments.html", req);
    }
    // Manual FX trade booking route.
    // Authority: D-MANUAL-TRADE-BOOKING (CEO-approved 2026-05-19).
    {
      const tradeBookResponse = await registerTradeBookRoutes(
        url.pathname,
        req.method,
        req,
        eventStore,
      );
      if (tradeBookResponse) return tradeBookResponse;
    }
    // Financial-instrument register routes (security master read + define).
    // Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
    {
      const instrumentResponse = await registerInstrumentRoutes(
        url.pathname,
        req.method,
        req,
        eventStore,
        url.searchParams,
      );
      if (instrumentResponse) return instrumentResponse;
    }
    // JSE IRC bond bilateral booking + settlement routes.
    // Authority: D-NPA-SAGB-BOND-INTERNAL-TEST (CEO-approved 2026-05-26).
    if (url.pathname.startsWith("/api/bonds/")) {
      const bondResponse = await registerBondGatewayRoutes(
        url.pathname,
        req.method,
        req,
        eventStore,
        custodianSim,
      );
      if (bondResponse) return bondResponse;
    }
    // FX market-making simulation engine routes.
    // Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION.
    {
      const simResponse = await registerFxSimRoutes(
        url.pathname,
        req.method,
        url.searchParams,
        req,
        fxSimEngine,
      );
      if (simResponse) return simResponse;
    }
    // FX simulator control panel page.
    if (req.method === "GET" && url.pathname === "/fx-sim") {
      // FX simulator folded into the 3rd-party simulator hub.
      return new Response(null, { status: 302, headers: { Location: "/sim-hub" } });
    }

    // ----- 3rd-party simulator hub routes -----
    if (url.pathname.startsWith("/api/sim/")) {
      const hubResponse = await registerSimHubRoutes(
        url.pathname,
        req.method,
        url.searchParams,
        req,
        simHub,
      );
      if (hubResponse) return hubResponse;
    }

    if (req.method === "GET" && url.pathname === "/sim-hub") {
      return serveStatic("/sim-hub.html", req);
    }
    // Market data — reference/time-series ticks (MarketDataStore).
    // Authority: D-MARKETS-SCHEMA-FOUNDATION.
    {
      const mdResponse = registerMarketDataRoutes(
        url.pathname,
        req.method,
        url.searchParams,
        marketDataStore,
      );
      if (mdResponse) return mdResponse;
    }
    if (req.method === "GET" && url.pathname === "/market-data") {
      return serveStatic("/market-data.html", req);
    }
    if (req.method === "GET") {
      return serveStatic(url.pathname, req);
    }
    return new Response("Method not allowed", { status: 405 });
  },
});

logger.info(
  {
    port: server.port,
    refreshMs: REFRESH_MS,
    runtimeStatePath: RUNTIME_STATE_PATH,
  },
  "Bank dashboard live",
);
console.log(`\n  Bank dashboard:  http://localhost:${server.port}\n`);

// GL boot catch-up disabled — too expensive with large event stores (52k+ events
// processed synchronously blocks the HTTP event loop indefinitely).
// Bea's GL catch-up runs as a scheduled offline job instead.
