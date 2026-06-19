// dashboard/v2-markets-fx-view.ts
//
// V2 boundary DTOs for the FX desk surface (`/api/v2/markets/fx/*`). This is the
// V2-authoritative re-build of the legacy `/api/markets/fx/*` surfaces, which
// read V1 trading events (`FxTradeExecuted`, `OrderRejectedAtGateway`, …). The
// V2 surface reads the FIL instance projection + the sibling V2 projections that
// are now authoritative on main:
//
//   - Risk / net-open-position / FX capital charge → `computeBA320V2`
//     (FilInstrumentCreated/Terminated FX; D-V1-REMOVAL-PHASE-3E, PR #1447).
//   - Trade blotter                                → live FIL FX instances
//     (foldFilInstances over the FX asset class; D-FIL-FRAMEWORK-UNIFICATION).
//   - Summary / P&L headline                       → `computeDailyPnLV2`
//     (the FIL-instance daily-P&L engine; D-FX-OTC-CLOSURE-BACKLOG A2, PR #1446).
//   - Market-risk VaR                              → `getMarketRiskMeasure`
//     promoting the V2 `MarketRiskVarComputed` figure (PR #1450).
//   - Counterparties                               → eligibility register ∩
//     the counterparties actually carrying live FIL FX instances.
//   - NPA attestation                              → product NPA lifecycle
//     (ProductApproved/ProductWithheld on the umbrella `prd:bank:fx:otc-vanilla`
//     product — canonical, product-keyed, not a V1 FX-trade leg).
//
// HONESTY (Engineering Charter cmd 3): every panel carries an explicit
// `dataState` ("live" | "empty" | "v1-only") and, when empty / V1-only, a
// `reason`. Nothing is presented as a real zero. The two panels with no V2
// source yet (gateway rejections; RAS headroom utilisation) are surfaced as
// `v1-only` with the honest reason — they are NOT silently dropped, and the V2
// surface does NOT read V1 for them (it states the gap).
//
// NAME-FREE (standing policy; feedback_no_agent_names_in_ui): the FX book carries
// counterparty party-ids and seat references, never agent PERSONAL names. Every
// owner / attester / approver field is mapped to its seat Title via `seatTitle`.
// The legacy markets-fx-*.ts authors carried persona names in COMMENTS only (not
// payloads), but this boundary still routes every seat-bearing field through
// `seatTitle` defensively so a name can never leak into a /api/v2 FX response.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../platform/event-store/store";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import type { MarketDataStore } from "../platform/market-data/store";
import { computeDailyPnLV2 } from "../platform/product-control/daily-pnl-v2";
import { computeBA320V2 } from "../platform/projections/ba320-fx-v2";
import { getMarketRiskMeasure } from "../platform/projections/markets/market-risk-measure";
import { type FilInstanceRow, foldFilInstances, liveInstances } from "../v2-core/fil-instances";
import { seatTitle } from "./agent-title";
import { buildCounterpartiesView } from "./markets-fx-counterparties";
import { type NpaStatus, buildNpaView } from "./markets-fx-npa";

// ---------------------------------------------------------------------------
// Shared honesty primitive — every panel declares its data state explicitly.
// ---------------------------------------------------------------------------

/**
 * The serving state of a V2 FX panel.
 *   - "live"    — the V2 source returned real data.
 *   - "empty"   — the V2 source is authoritative but data-empty on this store
 *                 (honest absent state, never a silent zero).
 *   - "v1-only" — no V2 source exists for this panel yet; the V2 surface does
 *                 NOT serve V1 here. The legacy `/api/markets/fx/*` route remains
 *                 the only source until the V2 substrate lands. `reason` says why.
 */
export type PanelDataState = "live" | "empty" | "v1-only";

interface PanelMeta {
  readonly dataState: PanelDataState;
  /** Why a panel is empty or v1-only. Omitted (null) when live. */
  readonly reason: string | null;
}

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// FIL FX instance read — the V2-native trade source.
// ---------------------------------------------------------------------------

/**
 * Fold the FIL instance lifecycle family from the (main) event store into the
 * current-state register, returning the LIVE FX instances. Reads the same
 * `FilInstrumentCreated/Amended/Terminated` family the BA-320 V2 projection and
 * the daily-P&L V2 engine consume — the single FIL data-access path
 * (D-MODEL-BINDING-CONTRACT-V1). The fold is replay-derived (Principle 1).
 */
function liveFxInstances(store: Pick<EventStore, "replay">): FilInstanceRow[] {
  const events: unknown[] = [];
  for (const type of [
    "FilInstrumentCreated",
    "FilInstrumentAmended",
    "FilInstrumentTerminated",
  ] as const) {
    try {
      for (const e of store.replay({ type })) events.push(e.payload);
    } catch {
      // Family not registered in this store — fold what we have (conservative).
    }
  }
  const register = foldFilInstances(events as never);
  return liveInstances(register).filter((r) => r.economicTerms.assetClass === "fx");
}

// ---------------------------------------------------------------------------
// 1. Trade blotter — live FIL FX instances (name-free).
// ---------------------------------------------------------------------------

export interface V2FxBlotterRow {
  /** `fil:inst:<tenant>:<id>` — the instance identity. */
  instance: string;
  /** Short instance id (trailing URN segment) for display. */
  tradeId: string;
  /** FIL taxonomy URN (`fil:type:fx:…`). */
  type: string;
  /** FX pair (hedging-set tag, e.g. "USD/ZAR"). */
  pair: string;
  /** "long" | "short" — book direction. */
  direction: "long" | "short";
  /** Notional in the netting-set currency (major-unit decimal string + ccy). */
  notional: { amount: string; currency: string };
  /** Counterparty party-id (NOT an agent name — a counterparty identity). */
  counterpartyId: string;
  /** Legally-enforceable netting-set id. */
  nettingSetId: string;
  /** Settlement / maturity date of the driving leg (ISO). */
  settlementDate: string;
  /** Current lifecycle stage. */
  stage: string;
}

export interface V2FxBlotterView extends PanelMeta {
  rows: V2FxBlotterRow[];
  count: number;
}

function buildBlotter(store: Pick<EventStore, "replay">): V2FxBlotterView {
  const live = liveFxInstances(store);
  const rows: V2FxBlotterRow[] = live.map((r) => {
    const t = r.economicTerms;
    return {
      instance: r.instance,
      tradeId: r.instance.split(":").pop() ?? r.instance,
      type: r.type,
      pair: t.hedgingSetTag ?? `${t.currency}/${anchorFunctionalCurrency()}`,
      direction: t.direction,
      notional: { amount: t.notional.amount, currency: t.notional.currency },
      counterpartyId: t.counterpartyId,
      nettingSetId: t.nettingSetId,
      settlementDate: t.settlementDate,
      stage: r.stage,
    };
  });
  // Deterministic order: by pair then instance id.
  rows.sort((a, b) =>
    a.pair !== b.pair ? a.pair.localeCompare(b.pair) : a.instance.localeCompare(b.instance),
  );
  return rows.length > 0
    ? { dataState: "live", reason: null, rows, count: rows.length }
    : {
        dataState: "empty",
        reason:
          "No live FX FIL instruments on this store. The build-phase store carries " +
          "no executed FX trades yet (no real customers pre-licence-day).",
        rows: [],
        count: 0,
      };
}

// ---------------------------------------------------------------------------
// 2. Risk — net open position + FX capital charge (BA-320 V2).
// ---------------------------------------------------------------------------

export interface V2FxPositionRow {
  baseCurrency: string;
  /** Net open position in base-currency minor units (signed: + long, − short). */
  netPositionBaseCurrencyMinor: number;
  /** Net open position in functional-currency minor units (null if no rate). */
  netPositionFunctionalMinor: number | null;
  openInstanceCount: number;
  /** Whether a production functional-currency rate was available (fail-closed). */
  rateAvailable: boolean;
}

export interface V2FxRiskView extends PanelMeta {
  functionalCurrency: string;
  /** Net open position by base currency (functional excluded per Reg 28(5)). */
  positions: V2FxPositionRow[];
  /** 8% × max(Σ|long|, Σ|short|) open-position charge, functional minor units. */
  openPositionChargeMinor: number | null;
  totalLongFunctionalMinor: number | null;
  totalShortFunctionalMinor: number | null;
  /** "no-data" | "partial" | "complete" — BA-320 V2 coverage. */
  coverageStatus: "no-data" | "partial" | "complete";
  openFxInstanceCount: number;
  /** Advisory gap markers from the BA-320 V2 projection (tracked, not hidden). */
  gaps: string[];
}

function buildRisk(
  store: EventStore,
  marketDataStore: MarketDataStore,
  asOf: string,
): V2FxRiskView {
  const ba320 = computeBA320V2({ eventStore: store, asOf, marketDataStore, entity: ANCHOR_ENTITY });
  const positions: V2FxPositionRow[] = ba320.fx.positions.map((p) => ({
    baseCurrency: p.baseCurrency,
    netPositionBaseCurrencyMinor: p.netPositionBaseCurrencyMinor,
    netPositionFunctionalMinor: p.netPositionFunctionalMinor,
    openInstanceCount: p.openInstanceCount,
    rateAvailable: p.rateAvailable,
  }));
  const live = ba320.fx.coverageStatus !== "no-data";
  return {
    dataState: live ? "live" : "empty",
    reason: live
      ? null
      : "No open FX FIL instruments on this store (BA-320 V2 coverage = no-data).",
    functionalCurrency: ba320.meta.functionalCurrency,
    positions,
    openPositionChargeMinor: ba320.fx.openPositionChargeMinor,
    totalLongFunctionalMinor: ba320.fx.totalLongZarMinor,
    totalShortFunctionalMinor: ba320.fx.totalShortZarMinor,
    coverageStatus: ba320.fx.coverageStatus,
    openFxInstanceCount: ba320.meta.openFxInstanceCount,
    gaps: [...ba320.gaps],
  };
}

// ---------------------------------------------------------------------------
// 3. Market-risk VaR — promoted V2 figure (MarketRiskVarComputed).
// ---------------------------------------------------------------------------

export interface V2FxVarView extends PanelMeta {
  varZar: number | null;
  svarZar: number | null;
  esZar: number | null;
  varAppetiteZar: number | null;
  utilisationPct: number | null;
  ragStatus: "green" | "amber" | "red" | null;
  asOf: string | null;
}

function buildVar(store: EventStore): V2FxVarView {
  // getMarketRiskMeasure folds BOTH the V1 MarketRiskMeasureComputed AND the V2
  // MarketRiskVarComputed (exposed as v2Measure). We surface the V2 figure
  // directly — never the V1 figure — so this panel is V2-authoritative.
  const view = getMarketRiskMeasure([
    ...store.replay({ type: "MarketRiskMeasureComputed" }),
    ...store.replay({ type: "MarketRiskVarComputed" }),
  ]);
  const v2 = view.v2Measure;
  if (!v2 || v2.varZar === null) {
    return {
      dataState: "empty",
      reason:
        "No V2 MarketRiskVarComputed event with a markable VaR on this store. " +
        "The V2 VaR emitter fails closed when the book is flat or history is too " +
        "short (D-V1-REMOVAL-PHASE2-GAP-A3) — an honest absent figure, never a " +
        "silent zero.",
      varZar: null,
      svarZar: null,
      esZar: null,
      varAppetiteZar: view.varAppetiteZar,
      utilisationPct: null,
      ragStatus: null,
      asOf: null,
    };
  }
  const appetite = view.varAppetiteZar;
  const utilisationPct = appetite !== null && appetite > 0 ? v2.varZar / appetite : null;
  let ragStatus: "green" | "amber" | "red" | null = null;
  if (utilisationPct !== null) {
    ragStatus = utilisationPct >= 1.0 ? "red" : utilisationPct >= 0.85 ? "amber" : "green";
  }
  return {
    dataState: "live",
    reason: null,
    varZar: v2.varZar,
    svarZar: v2.svarZar,
    esZar: v2.esZar,
    varAppetiteZar: appetite,
    utilisationPct: utilisationPct === null ? null : Math.min(utilisationPct, 9.99),
    ragStatus,
    asOf: v2.asOf,
  };
}

// ---------------------------------------------------------------------------
// 4. Summary / P&L headline — daily-P&L V2 + BA-320 charge + blotter counts.
// ---------------------------------------------------------------------------

export interface V2FxPnLView extends PanelMeta {
  reportDate: string;
  /** Headline unrealised P&L (functional minor units). Honest completeness flag. */
  totalUnrealisedFunctionalMinor: number;
  /** false ⇒ figure EXCLUDES ≥1 unmarkable live position — do not read as complete. */
  unrealisedComplete: boolean;
  marksUnavailableCount: number;
  /**
   * Per-currency breakdown. KNOWN GAP (chip task_82fb5a6d): computeDailyPnLV2
   * returns byCurrency=[] on the FIL path. When empty we say so honestly rather
   * than paper over it with a fabricated split.
   */
  byCurrency: Array<{ currency: string; trades: number; unrealisedFunctionalMinor: number }>;
  byCurrencyGap: string | null;
}

export interface V2FxSummaryView extends PanelMeta {
  functionalCurrency: string;
  /** Live FX FIL-instance count (the V2-native "trades" measure). */
  liveTradeCount: number;
  /** Distinct counterparties carrying live FX instances. */
  counterpartyCount: number;
  /** FX open-position capital charge (functional minor units) — BA-320 V2. */
  openPositionChargeMinor: number | null;
  /** Headline P&L panel. */
  pnl: V2FxPnLView;
  /** Promoted V2 VaR panel. */
  var: V2FxVarView;
  asOf: string;
}

function buildPnL(
  store: EventStore,
  marketDataStore: MarketDataStore,
  reportDate: string,
  nowIso: string,
): V2FxPnLView {
  const result = computeDailyPnLV2(store, marketDataStore, reportDate, () => nowIso);
  const byCurrencyRaw = result.payload.byCurrency ?? [];
  const byCurrency = byCurrencyRaw.map((c) => ({
    currency: c.currency,
    trades: c.tradeCount,
    unrealisedFunctionalMinor: c.unrealisedPnlZarMinor,
  }));
  const hasInstruments = liveFxInstances(store).length > 0 || result.trades.length > 0;
  // The headline figure is present when every live position was markable.
  const present = result.totalUnrealised.present;
  return {
    dataState: hasInstruments ? "live" : "empty",
    reason: hasInstruments
      ? null
      : "No live FX FIL instruments — daily-P&L V2 has nothing to value.",
    reportDate,
    totalUnrealisedFunctionalMinor: result.payload.totalUnrealisedPnlZarMinor,
    unrealisedComplete: present && result.marksUnavailableCount === 0,
    marksUnavailableCount: result.marksUnavailableCount,
    byCurrency,
    byCurrencyGap:
      byCurrency.length === 0 && hasInstruments
        ? "computeDailyPnLV2 returns no per-currency breakdown on the FIL path " +
          "(chip task_82fb5a6d). The headline figure above is authoritative; the " +
          "per-currency split is not yet derived from FIL instances."
        : null,
  };
}

export function buildV2FxSummaryView(
  store: EventStore,
  marketDataStore: MarketDataStore,
  nowIso: string,
): V2FxSummaryView {
  const reportDate = nowIso.slice(0, 10);
  const live = liveFxInstances(store);
  const counterparties = new Set(live.map((r) => r.economicTerms.counterpartyId));
  const ba320 = computeBA320V2({
    eventStore: store,
    asOf: nowIso,
    marketDataStore,
    entity: ANCHOR_ENTITY,
  });
  const pnl = buildPnL(store, marketDataStore, reportDate, nowIso);
  const varPanel = buildVar(store);
  const hasData = live.length > 0;
  return {
    dataState: hasData ? "live" : "empty",
    reason: hasData
      ? null
      : "No live FX FIL instruments on the build-phase store (no real trades pre-licence-day).",
    functionalCurrency: ba320.meta.functionalCurrency,
    liveTradeCount: live.length,
    counterpartyCount: counterparties.size,
    openPositionChargeMinor: ba320.fx.openPositionChargeMinor,
    pnl,
    var: varPanel,
    asOf: nowIso,
  };
}

// ---------------------------------------------------------------------------
// 5. Counterparties — eligibility register ∩ live FX FIL counterparties.
// ---------------------------------------------------------------------------

export interface V2FxCounterpartyRow {
  counterpartyId: string;
  /** Latest institutional-eligibility outcome. */
  eligibility: "institutional-eligible" | "ineligible" | "indeterminate" | "unscreened";
  /** Number of live FX FIL instruments facing this counterparty. */
  liveFxInstruments: number;
  asOf: string | null;
}

export interface V2FxCounterpartiesView extends PanelMeta {
  rows: V2FxCounterpartyRow[];
  count: number;
}

function buildCounterparties(
  store: Pick<EventStore, "replay">,
  nowIso: string,
): V2FxCounterpartiesView {
  const eligibility = buildCounterpartiesView(store, nowIso);
  const eligibleById = new Map(eligibility.counterparties.map((c) => [c.counterpartyId, c]));
  const live = liveFxInstances(store);
  const fxByCp = new Map<string, number>();
  for (const r of live) {
    const cp = r.economicTerms.counterpartyId;
    fxByCp.set(cp, (fxByCp.get(cp) ?? 0) + 1);
  }
  // Union: every eligible counterparty + every counterparty carrying a live FX trade.
  const ids = new Set<string>([...eligibleById.keys(), ...fxByCp.keys()]);
  const rows: V2FxCounterpartyRow[] = [...ids].map((id) => {
    const e = eligibleById.get(id);
    return {
      counterpartyId: id,
      eligibility: e ? e.outcome : "unscreened",
      liveFxInstruments: fxByCp.get(id) ?? 0,
      asOf: e ? e.asOf : null,
    };
  });
  rows.sort((a, b) =>
    b.liveFxInstruments !== a.liveFxInstruments
      ? b.liveFxInstruments - a.liveFxInstruments
      : a.counterpartyId.localeCompare(b.counterpartyId),
  );
  return rows.length > 0
    ? { dataState: "live", reason: null, rows, count: rows.length }
    : {
        dataState: "empty",
        reason: "No screened counterparties and no live FX FIL counterparties on this store.",
        rows: [],
        count: 0,
      };
}

// ---------------------------------------------------------------------------
// 6. NPA attestation — product NPA lifecycle (canonical, product-keyed).
// ---------------------------------------------------------------------------

export interface V2FxNpaRow {
  productCode: string;
  status: NpaStatus;
  approvedAt: string | null;
  withheldAt: string | null;
  withheldReason: string | null;
  outOfScope: boolean;
}

export interface V2FxNpaView extends PanelMeta {
  /** The umbrella OTC-vanilla FX product the attestation is keyed on. */
  productId: string;
  attestations: V2FxNpaRow[];
}

function buildNpa(store: Pick<EventStore, "replay">, nowIso: string): V2FxNpaView {
  const view = buildNpaView(store, nowIso);
  const attestations: V2FxNpaRow[] = view.attestations.map((a) => ({
    productCode: a.productCode,
    status: a.status,
    approvedAt: a.approvedAt ?? null,
    withheldAt: a.withheldAt ?? null,
    withheldReason: a.withheldReason ?? null,
    outOfScope: a.outOfScope ?? false,
  }));
  const anyApproved = attestations.some((a) => a.status !== "pending");
  return {
    dataState: anyApproved ? "live" : "empty",
    reason: anyApproved
      ? null
      : "No ProductApproved / ProductWithheld event for the umbrella FX product yet.",
    productId: "prd:bank:fx:otc-vanilla",
    attestations,
  };
}

// ---------------------------------------------------------------------------
// 7. Gateway rejections — V1-ONLY (no V2 gateway event family yet).
// ---------------------------------------------------------------------------

export interface V2FxRejectionsView extends PanelMeta {
  rows: never[];
  legacyRoute: string;
}

function buildRejections(): V2FxRejectionsView {
  // The pre-trade gateway pipeline (8 checks → OrderApprovedAtGateway /
  // OrderRejectedAtGateway) is a V1-only event family. There is NO V2-FIL
  // equivalent: FIL instances are MATERIALISED post-execution, so a rejected
  // order never produces a FIL instance and cannot be reconstructed from the FIL
  // register. The V2 surface does NOT read the V1 events here — it states the gap
  // honestly. The legacy route remains authoritative until a V2 gateway event
  // family is built (out of scope for B5; Phase C).
  return {
    dataState: "v1-only",
    reason:
      "Gateway rejections (OrderRejectedAtGateway) are a V1 pre-trade event family " +
      "with no V2 equivalent: FIL instances materialise post-execution, so a rejected " +
      "order produces no FIL instance. Source remains GET /api/markets/fx/rejections " +
      "until a V2 gateway event family is built (Phase C). Authority: D-FX-OTC-CLOSURE-BACKLOG.",
    rows: [],
    legacyRoute: "GET /api/markets/fx/rejections",
  };
}

// ---------------------------------------------------------------------------
// 8. Headroom — V1-ONLY (RAS limit-utilisation folds V1 FxTradeExecuted).
// ---------------------------------------------------------------------------

export interface V2FxHeadroomView extends PanelMeta {
  rows: never[];
  legacyRoute: string;
}

function buildHeadroom(): V2FxHeadroomView {
  // The RAS limit-utilisation projection (B-cluster headroom) folds the V1
  // FxTradeExecuted near-leg into the B3 market-risk bucket. There is no
  // FIL-instance-sourced limit-utilisation projection yet — the FX B3 exposure
  // leg is still V1. The V2 risk panel above DOES surface the FX net-open-position
  // and capital charge from BA-320 V2 (the FIL-sourced exposure), but the
  // RAS-cluster utilisation framing (B1–B5 vs published RAS schedule) is V1-only.
  return {
    dataState: "v1-only",
    reason:
      "RAS headroom (limit-utilisation B1–B5) folds the V1 FxTradeExecuted near-leg " +
      "for the B3 market-risk bucket; no FIL-sourced limit-utilisation projection " +
      "exists yet. The FX net-open-position + capital charge ARE V2 (see the risk " +
      "panel, BA-320 V2). Source remains GET /api/markets/fx/headroom until a " +
      "FIL-sourced RAS utilisation projection is built (Phase C). " +
      "Authority: D-FX-OTC-CLOSURE-BACKLOG.",
    rows: [],
    legacyRoute: "GET /api/markets/fx/headroom",
  };
}

// ---------------------------------------------------------------------------
// Top-level surface — one call assembling every panel + a panel-status manifest.
// ---------------------------------------------------------------------------

export interface V2FxPanelStatus {
  panel: string;
  route: string;
  source: "v2" | "v1-only";
  dataState: PanelDataState;
  reason: string | null;
}

export interface V2FxSurfaceView {
  summary: V2FxSummaryView;
  risk: V2FxRiskView;
  blotter: V2FxBlotterView;
  counterparties: V2FxCounterpartiesView;
  npa: V2FxNpaView;
  rejections: V2FxRejectionsView;
  headroom: V2FxHeadroomView;
  /** Per-panel V2-completeness manifest — which read V2, which are V1-only. */
  panels: V2FxPanelStatus[];
  /**
   * The autonomous seat that owns the FX book, by TITLE only (name-free policy).
   * Sourced through `seatTitle` so a persona name can never leak here.
   */
  deskOwnerSeatTitle: string;
  asOf: string;
}

/**
 * Build the whole FX V2 surface in one pass. The dashboard exposes both this
 * aggregate (`GET /api/v2/markets/fx`) and each panel as its own route
 * (`GET /api/v2/markets/fx/<panel>`).
 */
export function buildV2FxSurfaceView(
  store: EventStore,
  marketDataStore: MarketDataStore,
  nowIso: string,
): V2FxSurfaceView {
  const summary = buildV2FxSummaryView(store, marketDataStore, nowIso);
  const risk = buildRisk(store, marketDataStore, nowIso);
  const blotter = buildBlotter(store);
  const counterparties = buildCounterparties(store, nowIso);
  const npa = buildNpa(store, nowIso);
  const rejections = buildRejections();
  const headroom = buildHeadroom();

  const panels: V2FxPanelStatus[] = [
    panelStatus("summary", "/api/v2/markets/fx/summary", summary),
    panelStatus("risk", "/api/v2/markets/fx/risk", risk),
    panelStatus("blotter", "/api/v2/markets/fx/blotter", blotter),
    panelStatus("counterparties", "/api/v2/markets/fx/counterparties", counterparties),
    panelStatus("npa", "/api/v2/markets/fx/npa", npa),
    panelStatus("rejections", "/api/v2/markets/fx/rejections", rejections),
    panelStatus("headroom", "/api/v2/markets/fx/headroom", headroom),
  ];

  return {
    summary,
    risk,
    blotter,
    counterparties,
    npa,
    rejections,
    headroom,
    panels,
    // "Head of Global Markets" is the seat that owns the FX book; mapped via
    // seatTitle defensively (the roster name "Saskia" → her seat Title) so no
    // personal name reaches the /api/v2 boundary.
    deskOwnerSeatTitle: seatTitle("Saskia"),
    asOf: nowIso,
  };
}

function panelStatus(panel: string, route: string, view: PanelMeta): V2FxPanelStatus {
  return {
    panel,
    route,
    source: view.dataState === "v1-only" ? "v1-only" : "v2",
    dataState: view.dataState,
    reason: view.reason,
  };
}

// Per-panel builders are exported for the route handlers + tests.
export {
  buildBlotter as buildV2FxBlotterView,
  buildRisk as buildV2FxRiskView,
  buildVar as buildV2FxVarView,
  buildCounterparties as buildV2FxCounterpartiesView,
  buildNpa as buildV2FxNpaView,
  buildRejections as buildV2FxRejectionsView,
  buildHeadroom as buildV2FxHeadroomView,
};
