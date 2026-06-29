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
import {
  BA325_RESIDENCY_BUCKET_LABEL,
  type Ba325ResidencyBucket,
  type ResidencyOracle,
  buildResidencyOracle,
} from "../platform/markets/fx/counterparty-residency";
import { computeDailyPnLV2 } from "../platform/product-control/daily-pnl-v2";
import { computeBA320V2 } from "../platform/projections/ba320-fx-v2";
import {
  type FilFxHeadroomB3Row,
  buildFilFxHeadroomView,
} from "../platform/projections/markets/fil-fx-limit-utilisation-v2";
import { getMarketRiskMeasure } from "../platform/projections/markets/market-risk-measure";
import {
  type V2FxRejectionRow,
  readV2FxRejections,
} from "../platform/projections/markets/v2-fx-gateway-rejections";
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
  /**
   * Trade / deal date (ISO) — read DEFENSIVELY off `economicTerms.tradeDate`
   * (Lane 1 / Kai adds this field born-V2). `null` for legacy instances that
   * predate the field; the UI renders "—" rather than a fabricated date.
   */
  tradeDate: string | null;
  /** Current lifecycle stage. */
  stage: string;
  /**
   * Counterparty BA-325 reg-29(3) residency bucket
   * (resident / non-resident / authorised-dealer / sarb) from the live
   * counterparty-residency oracle. `null` when the counterparty is UNMAPPABLE —
   * `residencyUnmapped` then flags it loudly (the trade would drop out of BA-325).
   */
  residencyBucket: Ba325ResidencyBucket | null;
  /** Human-facing residency label (matches the BA-325 form row labels). */
  residencyLabel: string | null;
  /** Provenance lineage for the residency classification (Principle 2). */
  residencyLineage: string | null;
  /** TRUE when the counterparty could not be classified (fail-closed, loud). */
  residencyUnmapped: boolean;
  /** Why the residency classification failed (only when `residencyUnmapped`). */
  residencyReason: string | null;
  /** Counterparty legal/display name (counterparties are NOT name-free). */
  counterpartyName: string | null;
  /** Counterparty jurisdiction / domicile (tax-residency basis, else incorporation). */
  counterpartyJurisdiction: string | null;
  /** Counterparty business sector. */
  counterpartySector: string | null;
}

export interface V2FxBlotterView extends PanelMeta {
  rows: V2FxBlotterRow[];
  count: number;
}

/**
 * Defensive read of `economicTerms.tradeDate` (Lane 1 / Kai adds this field
 * born-V2). The typed `FilEconomicTerms` does not yet declare it, so this reads
 * it off the runtime object without a hardcoded fallback: a non-empty string
 * value, else `null` (the UI renders "—" — never a fabricated date).
 */
function readTradeDate(terms: unknown): string | null {
  if (typeof terms !== "object" || terms === null) return null;
  const v = (terms as Record<string, unknown>).tradeDate;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function buildBlotter(store: EventStore): V2FxBlotterView {
  const live = liveFxInstances(store);
  // One oracle for the whole blotter build (folds party + onboarding registers
  // once). Read-only; reused for every row's residency + descriptive detail.
  const oracle: ResidencyOracle = buildResidencyOracle(store);
  const rows: V2FxBlotterRow[] = live.map((r) => {
    const t = r.economicTerms;
    const detail = oracle.classifyDetail(t.counterpartyId);
    const classified = detail.residency.classified ? detail.residency : null;
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
      tradeDate: readTradeDate(t),
      stage: r.stage,
      residencyBucket: classified ? classified.bucket : null,
      residencyLabel: classified ? BA325_RESIDENCY_BUCKET_LABEL[classified.bucket] : null,
      residencyLineage: classified ? classified.lineage : null,
      residencyUnmapped: !detail.residency.classified,
      residencyReason: detail.residency.classified ? null : detail.residency.reason,
      counterpartyName: detail.legalName,
      counterpartyJurisdiction: detail.jurisdiction,
      counterpartySector: detail.sector,
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
// 7. Gateway rejections — V2-fed from the V2-NATIVE gateway-rejection family
//    in the V2 control-plane store (FU3).
// ---------------------------------------------------------------------------

export interface V2FxRejectionsView extends PanelMeta {
  rows: V2FxRejectionRow[];
  count: number;
  /**
   * The tracked substrate gap: no V2 gateway-rejection EMITTER ships yet (the
   * V1 gateway aggregator still emits `OrderRejectedAtGateway`). Surfaced so the
   * honest empty state is self-explaining, never silent.
   */
  substrateGap: string | null;
}

/**
 * The V2 rejections panel reads the V2-NATIVE `V2FxOrderRejectedAtGateway`
 * family from the V2 control-plane store (the V2/FIL world) — NOT the V1 store.
 * A pre-trade rejected order never materialises a FIL instance, so the FIL
 * register has no source for it; this V2-native gateway family is the V2-world
 * representation a gate outcome takes. On the clean build-phase store there are
 * zero such events (no V2 emitter ships yet — the V1→V2 emitter cutover is the
 * tracked substrate gap), so the panel shows an honest `empty` state. It NEVER
 * falls back to reading V1.
 */
function buildRejections(readV2Rejections: () => V2FxRejectionRow[]): V2FxRejectionsView {
  const rows = readV2Rejections();
  const substrateGap =
    "No V2 gateway-rejection EMITTER ships yet: the V1 pre-trade gateway aggregator " +
    "still emits `OrderRejectedAtGateway` into the V1 store; the V2-native " +
    "`V2FxOrderRejectedAtGateway` family (read here) is registered and parallel, but " +
    "the V1→V2 emitter cutover is a tracked substrate gap. Authority: D-FX-OTC-CLOSURE-BACKLOG.";
  return rows.length > 0
    ? { dataState: "live", reason: null, rows, count: rows.length, substrateGap }
    : {
        dataState: "empty",
        reason:
          "No V2 gateway-rejection events on the V2 control-plane store. On the " +
          "build-phase clean store this is expected (no V2 emitter ships yet — see " +
          "substrateGap). This is an honest absent state, NOT a silent zero, and the " +
          "panel does NOT fall back to the V1 store.",
        rows: [],
        count: 0,
        substrateGap,
      };
}

// ---------------------------------------------------------------------------
// 8. Headroom — V2-fed: FIL-sourced RAS B3 (FX) limit-utilisation (FU3).
// ---------------------------------------------------------------------------

export interface V2FxHeadroomView extends PanelMeta {
  /** The single B3 FX limit-utilisation line, derived from FIL FX positions. */
  b3: FilFxHeadroomB3Row;
  /** BA-320 V2 coverage carried through (no-data | partial | complete). */
  coverageStatus: "no-data" | "partial" | "complete";
  /** Advisory gap markers from the FIL projection (tracked, not hidden). */
  gaps: string[];
  /**
   * SCOPE NOTE: only the B3 (FX net-open-position) cluster is taken V2 here —
   * that is the cluster the FX book drives. The other RAS clusters (B1
   * pre-settlement credit, B2 settlement-window, B4 IRRBB, B5) fold non-FX /
   * settlement-lifecycle events and stay on the V1 limit-utilisation projection
   * (consumed by the legacy desk pages). Stated so the panel never implies it is
   * the whole RAS headroom view.
   */
  scopeNote: string;
}

/**
 * The V2 headroom panel derives the B3 FX net-open-position utilisation from the
 * SAME FIL FX instances the V2 risk panel (BA-320 V2) consumes — never from V1
 * `FxTradeExecuted`. The B3 LIMIT is the canonical RAS schedule row the Chief
 * Risk Officer seat publishes. Honest states: `empty` (no FIL FX instruments —
 * labelled zero),
 * `no-limit` (FIL positions but no B3 RAS row — exposure shown, utilisation
 * null), or `live`.
 */
function buildHeadroom(
  store: EventStore,
  marketDataStore: MarketDataStore,
  nowIso: string,
): V2FxHeadroomView {
  const view = buildFilFxHeadroomView(store, marketDataStore, nowIso);
  // Map the projection's own data state onto the shared PanelMeta state. "no-limit"
  // is a present-but-incomplete state → surface as "empty" at the panel level
  // (no utilisation to render) while carrying the precise reason through.
  const dataState: PanelDataState = view.dataState === "live" ? "live" : "empty";
  return {
    dataState,
    reason: view.reason,
    b3: view.b3,
    coverageStatus: view.coverageStatus,
    gaps: [...view.gaps],
    scopeNote:
      "Only the B3 (FX net-open-position) RAS cluster is V2-fed (FIL-sourced) here — " +
      "it is the cluster the FX book drives. B1/B2/B4/B5 fold non-FX or " +
      "settlement-lifecycle events and remain on the V1 limit-utilisation projection " +
      "(legacy desk pages). Authority: D-FX-OTC-CLOSURE-BACKLOG.",
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
 * Optional injection seam for the surface builder.
 *
 * `readV2Rejections` — reader for the V2 gateway-rejection feed. Defaults to
 *   `readV2FxRejections` (the production V2 control-plane store reader). Tests
 *   inject a reader pointed at a tmpdir control-plane store (or returning a
 *   fixture) so the surface build never touches the home store.
 */
export interface V2FxSurfaceDeps {
  readonly readV2Rejections?: () => V2FxRejectionRow[];
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
  deps: V2FxSurfaceDeps = {},
): V2FxSurfaceView {
  const summary = buildV2FxSummaryView(store, marketDataStore, nowIso);
  const risk = buildRisk(store, marketDataStore, nowIso);
  const blotter = buildBlotter(store);
  const counterparties = buildCounterparties(store, nowIso);
  const npa = buildNpa(store, nowIso);
  // The V2 rejections feed reads the V2 control-plane store (default path). The
  // reader is injected so tests can point at a tmpdir control-plane store and so
  // the build never silently touches the home store.
  const rejections = buildRejections(deps.readV2Rejections ?? (() => readV2FxRejections()));
  const headroom = buildHeadroom(store, marketDataStore, nowIso);

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

export type { V2FxRejectionRow } from "../platform/projections/markets/v2-fx-gateway-rejections";
export type { FilFxHeadroomB3Row } from "../platform/projections/markets/fil-fx-limit-utilisation-v2";
