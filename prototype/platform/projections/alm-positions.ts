// platform/projections/alm-positions.ts
//
// ALM (Asset-Liability Management) position projection.
//
// Folds events into the four input sets that drive LCR / NSFR computation:
//   - HQLAPosition[]   — Level 1 / Level 2A / Level 2B classification per BCBS D295.
//   - FundingPosition[] — outflow / inflow buckets per BCBS D295 (30-day stress).
//   - ASFItem[]        — Available Stable Funding per BCBS D295/D396.
//   - RSFItem[]        — Required Stable Funding per BCBS D295/D396.
//
// Source events (when they exist):
//   HQLA:
//     - `CollateralInventorySnapshotted` (Tomas + Atlas; deferred substrate).
//     - `TradeBooked` / `TradeSettled` (security positions; partial — see
//       `platform/collateral/inventory.ts` for the live HQLA classifier).
//     - `CapitalEvent` / cash balances (build-phase cash treated as L1 ZAR).
//   Funding:
//     - `DepositTaken` (retail / wholesale classification; live via WS1-PR1a).
//     - `SettlementInstructionIssued` (contractual outflows; not yet a typed event).
//     - `FundingLineDrawn` (live via WS1-PR1a).
//     - `InterbankLoanPlaced` (interbank cash placements; live via WS1-PR1a).
//   ASF / RSF:
//     - CapitalEvent → tier1-capital ASF (via computeCapitalMetrics).
//     - DepositTaken → ASF by category + maturity.
//     - InterbankLoanPlaced → RSF by residual maturity.
//     - HQLA positions → RSF by tier.
//     - BalanceSheetProjected (Bea + Ravi substrate; gap still outstanding for
//       full BA 326 scope).
//
// Build-phase posture (CLAUDE.md "build phase vs licence-day"):
//   Funding / ASF / RSF are now partially wired via WS1-PR1a events. HQLA is
//   partially queryable by folding `TradeBooked` / `TradeSettled` events through
//   the HQLA classifier (`classifyHQLA`). This module returns live-event-sourced
//   arrays when events exist, plus an explicit `gaps: string[]` field naming each
//   remaining missing event class.
//
// Authority: D-RAS (CEO-approved 2026-05-06) · D-MARKETS-CAPITAL-TIME-SHAPE
//   (CEO-approved 2026-05-12) · RRTB Regulation 26 (LCR) · RRTB Regulation
//   26A (NSFR) · BCBS D295 · BCBS D396 · BA 325 · BA 326.
//
// Author: Ravi (Treasury and ALM engineer, engineering)

import { type SecurityDescriptor, classifyHQLA } from "../collateral/hqla-classifier";
import type { EventStore } from "../event-store/store";
import type { FundingPosition, HQLAPosition } from "../liquidity/lcr";
import type { ASFItem, RSFItem } from "../liquidity/nsfr";
import { computeCapitalMetrics } from "./capital-metrics";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * Snapshot of the ALM position set at a given as-of date.
 *
 * Carries the four input arrays for `computeLCR` and `computeNSFR`, plus
 * an explicit `gaps` array naming each missing event class. In build phase
 * `gaps` is the dominant signal: every array is empty (or partial for HQLA)
 * and `gaps` names the substrate roadmap.
 */
export interface ALMPositionSnapshot {
  /** ISO 8601 — as-of date the snapshot was computed at. */
  readonly asOf: string;
  /** Projection horizon in days (0 = T+0, 30 = T+30, etc.). */
  readonly horizonDays: number;
  /** HQLA positions for LCR numerator (post-classification, pre-haircut). */
  readonly hqlaPositions: readonly HQLAPosition[];
  /** Funding positions (outflows + inflows) for LCR denominator. */
  readonly fundingPositions: readonly FundingPosition[];
  /** Available Stable Funding items for NSFR numerator. */
  readonly asfItems: readonly ASFItem[];
  /** Required Stable Funding items for NSFR denominator. */
  readonly rsfItems: readonly RSFItem[];
  /**
   * Substrate gaps blocking full population. Each entry names an event class
   * that has not yet been wired or has no events in the store. When
   * `gaps.length === 0`, all four arrays are derived from live events.
   */
  readonly gaps: readonly string[];
  /**
   * True when the snapshot is the build-phase fallback (no positions
   * derived from live events; only HQLA may be partially populated from
   * the collateral inventory projection). False when at least one of the
   * four arrays is derived from live (non-empty) event sourcing.
   */
  readonly buildPhase: boolean;
  /** Human-readable note summarising the source + gap inventory. */
  readonly note: string;
}

// ---------------------------------------------------------------------------
// Source-event class names — single-graph discipline (Principle 2)
// ---------------------------------------------------------------------------

/**
 * Event classes this projection consumes when they exist. The strings are
 * the canonical event-type names (see `platform/event-store/event-types/`).
 * They double as gap labels — when an event class is absent from the store,
 * the gap label is emitted verbatim.
 */
export const ALM_POSITION_SOURCE_EVENTS = {
  // HQLA — Tomas + Atlas substrate
  hqlaCollateral: "CollateralInventorySnapshotted",
  hqlaCash: "CashBalanceSnapshotted",
  // Funding — Ravi + Atlas substrate (WS1-PR1a live)
  fundingDepositTaken: "DepositTaken",
  fundingSettlementOut: "SettlementInstructionIssued",
  fundingLineDraw: "FundingLineDrawn",
  fundingIBL: "InterbankLoanPlaced",
  // ASF / RSF — Bea + Ravi substrate (balance-sheet projection)
  asfBalanceSheet: "BalanceSheetProjected",
  rsfBalanceSheet: "BalanceSheetProjected",
} as const;

// ---------------------------------------------------------------------------
// HQLA projection — fold TradeBooked / TradeSettled through HQLA classifier
// ---------------------------------------------------------------------------

interface RawPosition {
  isin: string;
  marketValueZar: number;
  currency: string;
  descriptor: SecurityDescriptor;
}

interface CollateralSnapshotPayload {
  l1Zar: number;
  l2aZar: number;
  l2bZar: number;
}

function extractDescriptor(payload: Record<string, unknown>, isin: string): SecurityDescriptor {
  const assetClass = ((): SecurityDescriptor["assetClass"] => {
    const ac = typeof payload.assetClass === "string" ? payload.assetClass : "";
    if (ac === "sovereign-bond") return "sovereign-bond";
    if (ac === "corporate-bond") return "corporate-bond";
    if (ac === "equity") return "equity";
    if (ac === "covered-bond") return "covered-bond";
    if (ac === "cash") return "cash";
    // Heuristic from ISIN prefix: ZAG = SA government bond, ZAE = JSE equity
    if (isin.startsWith("ZAG")) return "sovereign-bond";
    if (isin.startsWith("ZAE")) return "equity";
    return "other";
  })();

  return {
    isin,
    issuer: typeof payload.issuer === "string" ? payload.issuer : "unknown",
    assetClass,
    creditRating: typeof payload.creditRating === "string" ? payload.creditRating : undefined,
    riskWeight: typeof payload.riskWeight === "number" ? payload.riskWeight : undefined,
    currency: typeof payload.currency === "string" ? payload.currency : "ZAR",
    residualMaturityDays:
      typeof payload.residualMaturityDays === "number" ? payload.residualMaturityDays : undefined,
  };
}

function extractRawPosition(type: string, payload: Record<string, unknown>): RawPosition | null {
  if (type !== "TradeBooked" && type !== "TradeSettled") return null;
  const isin = typeof payload.isin === "string" ? payload.isin : null;
  if (!isin) return null;

  const faceValue =
    typeof payload.faceValue === "number"
      ? payload.faceValue
      : typeof payload.notional === "number"
        ? payload.notional
        : 0;
  const marketValueZar =
    typeof payload.marketValueZar === "number"
      ? payload.marketValueZar
      : typeof payload.marketValue === "number"
        ? payload.marketValue
        : faceValue;
  const currency = typeof payload.currency === "string" ? payload.currency : "ZAR";

  return {
    isin,
    marketValueZar,
    currency,
    descriptor: extractDescriptor(payload, isin),
  };
}

/**
 * Read HQLA positions from the event store.
 *
 * Priority: if `CollateralInventorySnapshotted` events exist, use the latest
 * one's authoritative L1/L2a/L2b totals (already haircut-adjusted per Atlas's
 * collateral-snapshot handler). Falls back to folding `TradeBooked` /
 * `TradeSettled` events through the HQLA classifier when no snapshot exists.
 *
 * Returns the per-tier pre-haircut positions as `HQLAPosition[]` (pre-cap;
 * `computeLCR` applies the L2 / L2b caps + haircuts downstream). Returns
 * an empty array when no snapshot and no trades exist (build-phase default).
 */
function readHQLAFromEventStore(eventStore: EventStore, asOf: string): HQLAPosition[] {
  // Check for authoritative CollateralInventorySnapshotted events first.
  let latestSnapshot: { as_of: string; payload: CollateralSnapshotPayload } | null = null;
  for (const ev of eventStore.replay({ type: "CollateralInventorySnapshotted" })) {
    if (ev.as_of > asOf) continue;
    if (!latestSnapshot || ev.as_of > latestSnapshot.as_of) {
      latestSnapshot = {
        as_of: ev.as_of,
        payload: ev.payload as unknown as CollateralSnapshotPayload,
      };
    }
  }
  const out: HQLAPosition[] = [];

  if (latestSnapshot) {
    // Snapshot covers security positions only (TradeBooked/TradeSettled with ISINs).
    const { l1Zar, l2aZar, l2bZar } = latestSnapshot.payload;
    if (l1Zar > 0) out.push({ amountZar: l1Zar, tier: "L1" });
    if (l2aZar > 0) out.push({ amountZar: l2aZar, tier: "L2a" });
    if (l2bZar > 0) out.push({ amountZar: l2bZar, tier: "L2b" });
  } else {
    // Fallback: aggregate positions by ISIN — latest trade event wins.
    const positionMap = new Map<string, RawPosition>();

    for (const event of eventStore.replay({ type: "TradeBooked" })) {
      if (event.as_of > asOf) continue;
      const raw = extractRawPosition(event.type, event.payload as Record<string, unknown>);
      if (!raw) continue;
      positionMap.set(raw.isin, raw);
    }
    for (const event of eventStore.replay({ type: "TradeSettled" })) {
      if (event.as_of > asOf) continue;
      const raw = extractRawPosition(event.type, event.payload as Record<string, unknown>);
      if (!raw) continue;
      positionMap.set(raw.isin, raw);
    }

    for (const raw of positionMap.values()) {
      const classification = classifyHQLA(raw.descriptor);
      if (classification.level === "non-HQLA") continue;
      out.push({
        amountZar: raw.marketValueZar,
        tier: classification.level,
      });
    }
  }

  // Repo cash proceeds (Level-1): cash received by the bank on the start leg
  // of a repo is unencumbered ZAR cash — the SAGB collateral is pledged to
  // the counterparty, but the cash sits free in the bank's account (BCBS
  // D295 §50 — ZAR central bank reserves / unrestricted cash = L1). Subtract
  // repos that have already matured or been terminated early.
  // NB: always runs — the security snapshot does not capture repo cash.
  const closedRepoIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "RepoEndLegSettled" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as { tradeId?: string };
    if (p.tradeId) closedRepoIds.add(p.tradeId);
  }
  for (const ev of eventStore.replay({ type: "RepoTradeTerminatedEarly" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as { tradeId?: string };
    if (p.tradeId) closedRepoIds.add(p.tradeId);
  }
  for (const ev of eventStore.replay({ type: "RepoTradeOpened" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as { tradeId?: string; startLegCashZar?: number };
    if (!p.tradeId || closedRepoIds.has(p.tradeId)) continue;
    const cashZar = (p.startLegCashZar ?? 0) / 100;
    if (cashZar <= 0) continue;
    out.push({ amountZar: cashZar, tier: "L1" });
  }

  // Bond positions (BondTradeExecuted): the banking-book bond inventory is HQLA
  // when the issuer qualifies (BA 325 Annex 1). The bond desk books via
  // BondTradeExecuted — NOT the older TradeBooked/TradeSettled vocabulary the
  // CollateralInventorySnapshotted fold above covers — so this fold ALWAYS runs
  // (additive, like repo cash) regardless of any security snapshot. Each open
  // buy is classified through classifyHQLA: a ZAG-prefix ISIN is an SA sovereign
  // bond (0% RW → L1, zero haircut); other ISINs are corporate bonds with no
  // rating on the booking event → non-HQLA (conservative; a rating-bearing
  // SecurityMaster feed would reclassify them). Sells / matured / sold positions
  // are excluded. Market value = nominalMinor × cleanPricePercent / 100, in major
  // ZAR. Authority: BA 325 Annex 1; BCBS D295 §50.
  const closedBondTradeIds = new Set<string>();
  for (const evType of ["BondSold", "BondMatured"] as const) {
    for (const ev of eventStore.replay({ type: evType })) {
      if (ev.as_of > asOf) continue;
      const p = ev.payload as { tradeId?: string };
      if (p.tradeId) closedBondTradeIds.add(p.tradeId);
    }
  }
  for (const ev of eventStore.replay({ type: "BondTradeExecuted" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as {
      tradeId?: string;
      bondIsin?: string;
      side?: string;
      nominalMinor?: number;
      cleanPricePercent?: number;
      currency?: string;
    };
    if (!p.tradeId || !p.bondIsin || !p.nominalMinor) continue;
    if (p.side === "sell") continue; // short — not an HQLA asset
    if (closedBondTradeIds.has(p.tradeId)) continue; // sold or matured

    const isRsaGovtBond = p.bondIsin.startsWith("ZAG");
    const descriptor: SecurityDescriptor = {
      isin: p.bondIsin,
      issuer: isRsaGovtBond ? "Republic of South Africa" : "unknown",
      assetClass: isRsaGovtBond ? "sovereign-bond" : "corporate-bond",
      currency: p.currency ?? "ZAR",
      // ZAG = SA government bond, 0% RW → L1. Corporate bonds carry no rating on
      // the booking event, so they fall to non-HQLA (skipped below).
      ...(isRsaGovtBond ? { riskWeight: 0 } : {}),
    };
    const classification = classifyHQLA(descriptor);
    if (classification.level === "non-HQLA") continue;
    const marketValueZar = (p.nominalMinor * (p.cleanPricePercent ?? 100)) / 100 / 100;
    if (marketValueZar <= 0) continue;
    out.push({ amountZar: marketValueZar, tier: classification.level });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Funding position fold — DepositTaken, FundingLineDrawn, InterbankLoanPlaced
// ---------------------------------------------------------------------------

interface DepositTakenPayload {
  depositId: string;
  principalZar: number;
  maturityDate: string;
  depositCategory: FundingPosition["category"];
}

interface DepositClosedPayload {
  depositId: string;
}

interface FundingLinePayload {
  fundingLineId: string;
  drawnAmountZar: number;
  maturityDate: string;
}

interface FundingLineRepaidPayload {
  fundingLineId: string;
}

interface InterbankLoanPayload {
  placementId: string;
  principalZar: number;
  maturityDate: string | null;
}

interface InterbankLoanClosedPayload {
  placementId: string;
}

/**
 * Fold DepositTaken / FundingLineDrawn / InterbankLoanPlaced events into
 * FundingPosition entries for the LCR denominator.
 *
 * - DepositTaken → category maps directly from depositCategory (string literals match).
 * - FundingLineDrawn → "wholesale-non-operational" (conservative, BA 325 §34).
 * - InterbankLoanPlaced → "wholesale-non-operational" (counterparty claim; outflow).
 *
 * Closed positions (DepositMatured, DepositWithdrawnEarly, FundingLineRepaid,
 * InterbankLoanMatured, InterbankLoanRecalledEarly) are excluded.
 *
 * Amounts are in ZAR minor units (cents) in the events; convert to ZAR major
 * units (rands) for FundingPosition.amountZar (which computeLCR treats as ZAR).
 */
function buildFundingPositions(
  eventStore: EventStore,
  asOf: string,
): {
  positions: FundingPosition[];
  depositCount: number;
  fundingLineCount: number;
  iblCount: number;
} {
  const positions: FundingPosition[] = [];

  // -------------------------------------------------------------------------
  // DepositTaken — collect closed deposit IDs first
  // -------------------------------------------------------------------------
  const closedDepositIds = new Set<string>();
  for (const event of eventStore.replay({ type: "DepositMatured" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as DepositClosedPayload;
    if (p.depositId) closedDepositIds.add(p.depositId);
  }
  for (const event of eventStore.replay({ type: "DepositWithdrawnEarly" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as DepositClosedPayload;
    if (p.depositId) closedDepositIds.add(p.depositId);
  }

  let depositCount = 0;
  for (const event of eventStore.replay({ type: "DepositTaken" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as DepositTakenPayload;
    if (!p.depositId || closedDepositIds.has(p.depositId)) continue;
    // Convert ZAR cents → ZAR major units
    const amountZar = (p.principalZar ?? 0) / 100;
    if (amountZar <= 0) continue;
    positions.push({ amountZar, category: p.depositCategory });
    depositCount++;
  }

  // -------------------------------------------------------------------------
  // FundingLineDrawn — collect repaid IDs
  // -------------------------------------------------------------------------
  const repaidLineIds = new Set<string>();
  for (const event of eventStore.replay({ type: "FundingLineRepaid" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as FundingLineRepaidPayload;
    if (p.fundingLineId) repaidLineIds.add(p.fundingLineId);
  }

  let fundingLineCount = 0;
  for (const event of eventStore.replay({ type: "FundingLineDrawn" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as FundingLinePayload;
    if (!p.fundingLineId || repaidLineIds.has(p.fundingLineId)) continue;
    const amountZar = (p.drawnAmountZar ?? 0) / 100;
    if (amountZar <= 0) continue;
    // Conservative per BA 325 §34: classify as wholesale-non-operational (100% runoff)
    positions.push({ amountZar, category: "wholesale-non-operational" });
    fundingLineCount++;
  }

  // -------------------------------------------------------------------------
  // InterbankLoanPlaced — collect matured / recalled IDs
  // -------------------------------------------------------------------------
  const closedIblIds = new Set<string>();
  for (const event of eventStore.replay({ type: "InterbankLoanMatured" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as InterbankLoanClosedPayload;
    if (p.placementId) closedIblIds.add(p.placementId);
  }
  for (const event of eventStore.replay({ type: "InterbankLoanRecalledEarly" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as InterbankLoanClosedPayload;
    if (p.placementId) closedIblIds.add(p.placementId);
  }

  let iblCount = 0;
  for (const event of eventStore.replay({ type: "InterbankLoanPlaced" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as InterbankLoanPayload;
    if (!p.placementId || closedIblIds.has(p.placementId)) continue;
    const amountZar = (p.principalZar ?? 0) / 100;
    if (amountZar <= 0) continue;
    // IBL placements: asset on bank's books but creates counterparty claim;
    // include as outflow (inflow-contractual) — conservative treatment.
    positions.push({ amountZar, category: "inflow-contractual" });
    iblCount++;
  }

  return { positions, depositCount, fundingLineCount, iblCount };
}

// ---------------------------------------------------------------------------
// Settlement-outflow fold — TradeBooked buy-side with explicit settlementDate
// ---------------------------------------------------------------------------
// Settlement date conventions differ by product (SAGB T+3, FX spot T+2,
// repo T+0/T+1, IRDs vary). We NEVER compute T+N from trade date; we only
// consume trades that carry an explicit `settlementDate` field in the payload.
// Trades without `settlementDate` are skipped and counted in `skippedNoDate`.
// ---------------------------------------------------------------------------

interface TradeBookedSettlementPayload {
  tradeId?: string;
  side?: string;
  marketValueZar?: number;
  marketValue?: number;
  faceValue?: number;
  notional?: number;
  settlementDate?: string;
}

interface SettlementOutflowResult {
  positions: FundingPosition[];
  count: number;
  skippedNoDate: number;
  instructionCount: number;
}

interface SettlementInstructionPayload {
  settlementInstructionId?: string;
  settlementDate?: string;
  outflowAmountZar?: number;
}

/**
 * Fold `TradeBooked` buy-side events into contractual settlement outflows
 * for the LCR denominator (BA 325 §23 — contractual maturity within the
 * stress horizon).
 *
 * Only includes trades that:
 *   1. Carry an explicit `settlementDate` field in the payload.
 *   2. Have not yet been matched by a `TradeSettled` event.
 *   3. Have a settlement date within `[asOf, asOf + horizonDays]`.
 *   4. Are buy-side (`side === "buy"`).
 *
 * Conservative treatment: classified as `"wholesale-non-operational"` per
 * BA 325 §23 contractual-maturity outflow bucket.
 */
function buildSettlementOutflows(
  eventStore: EventStore,
  asOf: string,
  horizonDays: number,
): SettlementOutflowResult {
  const asOfDate = new Date(asOf);
  const horizonDate = new Date(asOf);
  horizonDate.setUTCDate(horizonDate.getUTCDate() + horizonDays);

  // Collect already-settled trade IDs so we can exclude them.
  const settledTradeIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "TradeSettled" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as { tradeId?: string };
    if (p.tradeId) settledTradeIds.add(p.tradeId);
  }

  const positions: FundingPosition[] = [];
  let count = 0;
  let skippedNoDate = 0;

  for (const ev of eventStore.replay({ type: "TradeBooked" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as unknown as TradeBookedSettlementPayload;

    // Only buy-side creates a cash outflow on settlement.
    if (p.side !== "buy") continue;

    // Skip if no explicit settlementDate — never infer T+N arithmetic.
    if (!p.settlementDate || typeof p.settlementDate !== "string") {
      skippedNoDate++;
      continue;
    }

    // Skip already-settled trades.
    if (p.tradeId && settledTradeIds.has(p.tradeId)) continue;

    // Check settlement date falls within stress horizon.
    const settlementDate = new Date(p.settlementDate);
    if (settlementDate < asOfDate || settlementDate > horizonDate) continue;

    const amountZar =
      typeof p.marketValueZar === "number"
        ? p.marketValueZar
        : typeof p.marketValue === "number"
          ? p.marketValue
          : typeof p.faceValue === "number"
            ? p.faceValue
            : typeof p.notional === "number"
              ? p.notional
              : 0;
    if (amountZar <= 0) continue;

    positions.push({ amountZar, category: "wholesale-non-operational" });
    count++;
  }

  // SettlementInstructionIssued — non-trade contractual outflows per BA 325 §23.
  let instructionCount = 0;
  for (const ev of eventStore.replay({ type: "SettlementInstructionIssued" })) {
    if (ev.as_of > asOf) continue;
    const p = ev.payload as unknown as SettlementInstructionPayload;
    if (!p.settlementDate || typeof p.settlementDate !== "string") continue;
    const settlementDate = new Date(p.settlementDate);
    if (settlementDate < asOfDate || settlementDate > horizonDate) continue;
    const amountZar = (p.outflowAmountZar ?? 0) / 100;
    if (amountZar <= 0) continue;
    positions.push({ amountZar, category: "wholesale-non-operational" });
    instructionCount++;
  }

  return { positions, count, skippedNoDate, instructionCount };
}

// ---------------------------------------------------------------------------
// ASF / RSF fold — CapitalEvent + DepositTaken + InterbankLoanPlaced + HQLA
//                  + BalanceSheetProjected (supplemental BA 326 scope)
// ---------------------------------------------------------------------------

interface BalanceSheetPayload {
  tier2CapitalZar?: number;
  unsecuredWholesaleFundingGt1yZar?: number;
  coveredBondsIssuedGt6mZar?: number;
  unencumberedRetailLoansLt1yZar?: number;
  unencumberedRetailLoansGt1yZar?: number;
  encumberedAssetsZar?: number;
  offBalanceSheetCommitmentsZar?: number;
}

/**
 * Build ASF items per BA 326 §8:
 *   - Tier 1 capital: 100% ASF weight (from computeCapitalMetrics).
 *   - DepositTaken: weight by category × residual maturity.
 */
function buildASFItems(
  eventStore: EventStore,
  asOf: string,
  liveDeposits: Array<{ principalZar: number; maturityDate: string; depositCategory: string }>,
): ASFItem[] {
  const asfItems: ASFItem[] = [];
  const asOfDate = new Date(asOf);

  // Tier 1 capital — 100% ASF weight
  const capitalMetrics = computeCapitalMetrics(eventStore, asOf);
  const tier1Zar = capitalMetrics.availableCapitalMinor / 100;
  if (tier1Zar > 0) {
    asfItems.push({ amountZar: tier1Zar, category: "tier1-capital" });
  }

  // DepositTaken → ASF by category + maturity
  for (const dep of liveDeposits) {
    const maturityDate = new Date(dep.maturityDate);
    const residualDays = Math.floor((maturityDate.getTime() - asOfDate.getTime()) / 86_400_000);
    const amountZar = dep.principalZar / 100;
    if (amountZar <= 0) continue;

    let category: ASFItem["category"];
    switch (dep.depositCategory) {
      case "retail-stable":
        category = residualDays >= 365 ? "wholesale-gt1y" : "retail-stable-lt1y";
        break;
      case "retail-less-stable":
        category = residualDays >= 365 ? "wholesale-gt1y" : "retail-less-stable-lt1y";
        break;
      case "wholesale-operational":
        category = residualDays >= 365 ? "wholesale-gt1y" : "wholesale-lt1y-operational";
        break;
      case "wholesale-non-operational":
        // 0% ASF weight regardless of tenor (BA 326 Table 1)
        category = "wholesale-lt1y-non-operational";
        break;
      default:
        category = "wholesale-lt1y-non-operational";
    }
    asfItems.push({ amountZar, category });
  }

  // BalanceSheetProjected — supplemental BA 326 ASF items (latest snapshot wins).
  let latestBs: { as_of: string; payload: BalanceSheetPayload } | null = null;
  for (const ev of eventStore.replay({ type: "BalanceSheetProjected" })) {
    if (ev.as_of > asOf) continue;
    if (!latestBs || ev.as_of > latestBs.as_of) {
      latestBs = { as_of: ev.as_of, payload: ev.payload as unknown as BalanceSheetPayload };
    }
  }
  if (latestBs) {
    const bs = latestBs.payload;
    const tier2Zar = (bs.tier2CapitalZar ?? 0) / 100;
    if (tier2Zar > 0) asfItems.push({ amountZar: tier2Zar, category: "tier1-capital" });
    const unsecuredGt1yZar = (bs.unsecuredWholesaleFundingGt1yZar ?? 0) / 100;
    if (unsecuredGt1yZar > 0)
      asfItems.push({ amountZar: unsecuredGt1yZar, category: "wholesale-gt1y" });
    const coveredBondsZar = (bs.coveredBondsIssuedGt6mZar ?? 0) / 100;
    if (coveredBondsZar > 0)
      asfItems.push({ amountZar: coveredBondsZar, category: "wholesale-gt1y" });
  }

  return asfItems;
}

/**
 * Build RSF items per BA 326:
 *   - HQLA L1: 5%, L2a: 15%, L2b: 50%.
 *   - InterbankLoanPlaced (live placements): RSF by residual maturity.
 *   - BalanceSheetProjected: retail loans + encumbered assets + OBS commitments.
 */
function buildRSFItems(
  eventStore: EventStore,
  asOf: string,
  hqlaPositions: readonly HQLAPosition[],
  liveIBLs: Array<{ principalZar: number; maturityDate: string | null }>,
): RSFItem[] {
  const rsfItems: RSFItem[] = [];
  const asOfDate = new Date(asOf);

  // HQLA → RSF by tier (pre-haircut amounts used for RSF, same as LCR input)
  for (const pos of hqlaPositions) {
    const category: RSFItem["category"] =
      pos.tier === "L1" ? "hqla-l1" : pos.tier === "L2a" ? "hqla-l2a" : "hqla-l2b";
    rsfItems.push({ amountZar: pos.amountZar, category });
  }

  // IBL placements → RSF by residual maturity (BA 326 §14)
  for (const ibl of liveIBLs) {
    const amountZar = ibl.principalZar / 100;
    if (amountZar <= 0) continue;
    let residualDays: number;
    if (ibl.maturityDate === null) {
      // Call placement — treat as overnight (1 day residual)
      residualDays = 1;
    } else {
      const maturityDate = new Date(ibl.maturityDate);
      residualDays = Math.floor((maturityDate.getTime() - asOfDate.getTime()) / 86_400_000);
    }
    const category: RSFItem["category"] = residualDays >= 180 ? "loan-6m-1y" : "loan-lt6m";
    rsfItems.push({ amountZar, category });
  }

  // BalanceSheetProjected — supplemental BA 326 RSF items (latest snapshot wins).
  let latestBsRsf: { as_of: string; payload: BalanceSheetPayload } | null = null;
  for (const ev of eventStore.replay({ type: "BalanceSheetProjected" })) {
    if (ev.as_of > asOf) continue;
    if (!latestBsRsf || ev.as_of > latestBsRsf.as_of) {
      latestBsRsf = { as_of: ev.as_of, payload: ev.payload as unknown as BalanceSheetPayload };
    }
  }
  if (latestBsRsf) {
    const bs = latestBsRsf.payload;
    const retailLt1yZar = (bs.unencumberedRetailLoansLt1yZar ?? 0) / 100;
    if (retailLt1yZar > 0) rsfItems.push({ amountZar: retailLt1yZar, category: "loan-lt6m" });
    const retailGt1yZar = (bs.unencumberedRetailLoansGt1yZar ?? 0) / 100;
    if (retailGt1yZar > 0) rsfItems.push({ amountZar: retailGt1yZar, category: "loan-6m-1y" });
    const encumberedZar = (bs.encumberedAssetsZar ?? 0) / 100;
    if (encumberedZar > 0) rsfItems.push({ amountZar: encumberedZar, category: "loan-6m-1y" });
    const obsZar = (bs.offBalanceSheetCommitmentsZar ?? 0) / 100;
    if (obsZar > 0) rsfItems.push({ amountZar: obsZar, category: "loan-lt6m" });
  }

  return rsfItems;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the ALM position snapshot for a given as-of date and projection
 * horizon.
 *
 * This is the canonical entry point for liquidity-position queries: Anya's
 * daily handler, Helena's daily appetite-watch, and any ad-hoc
 * `computeLCR` / `computeNSFR` caller goes through this projection rather
 * than synthesising input arrays in-handler.
 *
 * WS2 wiring (live event sources):
 *   - Funding: DepositTaken + FundingLineDrawn + InterbankLoanPlaced (WS1-PR1a).
 *   - ASF: CapitalEvent (via computeCapitalMetrics) + DepositTaken.
 *   - RSF: HQLA positions (via readHQLAFromEventStore) + InterbankLoanPlaced.
 *   - SettlementInstructionIssued: gap still outstanding.
 *   - BalanceSheetProjected: gap partially wired; full BA 326 scope pending.
 *
 * @param eventStore  - the event store to fold against (caller passes the
 *                      composition singleton in production; tests pass an
 *                      isolated in-memory store).
 * @param asOf        - ISO 8601 run timestamp.
 * @param horizonDays - projection horizon (0 = T+0, 30 = T+30, etc.).
 */
export function getALMPositionSnapshot(
  eventStore: EventStore,
  asOf: string,
  horizonDays: number,
): ALMPositionSnapshot {
  const gaps: string[] = [];

  // -------------------------------------------------------------------------
  // HQLA — fold the security snapshot (CollateralInventorySnapshotted, or the
  // legacy TradeBooked/TradeSettled stream) PLUS always-on repo-cash and
  // BondTradeExecuted bond-inventory folds through the HQLA classifier. The
  // bond fold is what makes a banking-book ZAG sovereign bond count as L1 HQLA
  // (the bond desk books via BondTradeExecuted, not the older trade vocabulary).
  // -------------------------------------------------------------------------
  const hqlaPositions = readHQLAFromEventStore(eventStore, asOf);

  // Detect whether any of the canonical HQLA-source events exist; if not,
  // record the gap. (`getCollateralInventory()` reads TradeBooked /
  // TradeSettled today; the full HQLA substrate is `CollateralInventory-
  // Snapshotted`. Mark the gap if no snapshotted events are present.)
  if (!hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.hqlaCollateral)) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.hqlaCollateral}: not yet emitted (Tomas + Atlas substrate). HQLA derived from TradeBooked/TradeSettled events via collateral inventory projection; ${hqlaPositions.length} position(s) found.`,
    );
  }

  // -------------------------------------------------------------------------
  // Funding — live event fold via WS1-PR1a event types
  // -------------------------------------------------------------------------
  const {
    positions: rawFundingPositions,
    depositCount,
    fundingLineCount,
    iblCount,
  } = buildFundingPositions(eventStore, asOf);

  if (
    depositCount === 0 &&
    !hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.fundingDepositTaken)
  ) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.fundingDepositTaken}: not yet emitted (Ravi + Atlas substrate). Retail / wholesale deposit classification per BA 325 §19 not yet queryable.`,
    );
  }

  // Settlement outflows — fold TradeBooked buy-side with explicit settlementDate.
  // Trades without settlementDate are skipped; see buildSettlementOutflows.
  const settlementResult = buildSettlementOutflows(eventStore, asOf, horizonDays);
  const fundingPositions: FundingPosition[] = [
    ...rawFundingPositions,
    ...settlementResult.positions,
  ];

  if (settlementResult.count > 0 || settlementResult.instructionCount > 0) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut}: ${settlementResult.count} pending buy trade(s) + ${settlementResult.instructionCount} settlement instruction(s) included in LCR outflow over ${horizonDays}-day horizon. ${settlementResult.skippedNoDate} trade(s) skipped (no settlementDate in payload).`,
    );
  } else {
    const hasInstructionType = hasAnyEventOfType(
      eventStore,
      ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut,
    );
    if (hasInstructionType) {
      gaps.push(
        `${ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut}: 0 settlement instructions within ${horizonDays}-day horizon (event class defined; no instructions issued yet).${settlementResult.skippedNoDate > 0 ? ` (${settlementResult.skippedNoDate} TradeBooked event(s) skipped — no explicit settlementDate in payload)` : ""}`,
      );
    } else {
      gaps.push(
        `${ALM_POSITION_SOURCE_EVENTS.fundingSettlementOut}: 0 settlement instructions within ${horizonDays}-day horizon (event class defined; no instructions issued yet).${settlementResult.skippedNoDate > 0 ? ` (${settlementResult.skippedNoDate} TradeBooked event(s) skipped — no explicit settlementDate in payload)` : ""}`,
      );
    }
  }

  if (
    fundingLineCount === 0 &&
    !hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.fundingLineDraw)
  ) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.fundingLineDraw}: not yet emitted (Ravi + Atlas substrate). Drawn funding-line balances not yet queryable.`,
    );
  }

  // -------------------------------------------------------------------------
  // Collect live deposits + IBLs for ASF / RSF fold
  // -------------------------------------------------------------------------
  const closedDepositIds = new Set<string>();
  for (const event of eventStore.replay({ type: "DepositMatured" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as { depositId?: string };
    if (p.depositId) closedDepositIds.add(p.depositId);
  }
  for (const event of eventStore.replay({ type: "DepositWithdrawnEarly" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as { depositId?: string };
    if (p.depositId) closedDepositIds.add(p.depositId);
  }
  const liveDeposits: Array<{
    principalZar: number;
    maturityDate: string;
    depositCategory: string;
  }> = [];
  for (const event of eventStore.replay({ type: "DepositTaken" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as DepositTakenPayload;
    if (!p.depositId || closedDepositIds.has(p.depositId)) continue;
    liveDeposits.push({
      principalZar: p.principalZar ?? 0,
      maturityDate: p.maturityDate,
      depositCategory: p.depositCategory,
    });
  }

  const closedIblIds = new Set<string>();
  for (const event of eventStore.replay({ type: "InterbankLoanMatured" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as { placementId?: string };
    if (p.placementId) closedIblIds.add(p.placementId);
  }
  for (const event of eventStore.replay({ type: "InterbankLoanRecalledEarly" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as { placementId?: string };
    if (p.placementId) closedIblIds.add(p.placementId);
  }
  const liveIBLs: Array<{ principalZar: number; maturityDate: string | null }> = [];
  for (const event of eventStore.replay({ type: "InterbankLoanPlaced" })) {
    if (event.as_of > asOf) continue;
    const p = event.payload as unknown as InterbankLoanPayload;
    if (!p.placementId || closedIblIds.has(p.placementId)) continue;
    liveIBLs.push({
      principalZar: p.principalZar ?? 0,
      maturityDate: p.maturityDate ?? null,
    });
  }

  // -------------------------------------------------------------------------
  // ASF / RSF — partially wired via WS2 event folds
  // -------------------------------------------------------------------------
  const asfItems = buildASFItems(eventStore, asOf, liveDeposits);
  const rsfItems = buildRSFItems(eventStore, asOf, hqlaPositions, liveIBLs);

  // BalanceSheetProjected gap: conditional on event existence
  if (!hasAnyEventOfType(eventStore, ALM_POSITION_SOURCE_EVENTS.asfBalanceSheet)) {
    gaps.push(
      `${ALM_POSITION_SOURCE_EVENTS.asfBalanceSheet}: partially wired via CapitalEvent + DepositTaken + InterbankLoanPlaced; BalanceSheetProjected event pending for complete BA 326 scope (Bea + Ravi substrate).`,
    );
  }

  // -------------------------------------------------------------------------
  // Note + buildPhase flag
  // -------------------------------------------------------------------------
  const totalPositionCount =
    hqlaPositions.length + fundingPositions.length + asfItems.length + rsfItems.length;
  const buildPhase = totalPositionCount === 0;

  const note = buildPhase
    ? `Build-phase ALM snapshot at ${asOf} (T+${horizonDays}d): no positions derived from live events. ${gaps.length} substrate gap(s) named. Anya's downstream LCR/NSFR computation returns 'no-positions'; Helena's appetite line reports green-with-substrate-gap.`
    : `Live ALM snapshot at ${asOf} (T+${horizonDays}d): ${hqlaPositions.length} HQLA position(s), ${fundingPositions.length} funding position(s) [${depositCount} deposit(s), ${fundingLineCount} funding line(s), ${iblCount} IBL(s)], ${asfItems.length} ASF item(s), ${rsfItems.length} RSF item(s). ${gaps.length} residual substrate gap(s).`;

  return {
    asOf,
    horizonDays,
    hqlaPositions,
    fundingPositions,
    asfItems,
    rsfItems,
    gaps,
    buildPhase,
    note,
  };
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Cheap "has at least one event of type `t`" check via the event store's
 * filtered replay. Returns on the first match; does not iterate the full
 * event set. Used for gap detection (we only need a yes/no per event class).
 */
function hasAnyEventOfType(eventStore: EventStore, t: string): boolean {
  for (const _e of eventStore.replay({ type: t })) {
    return true;
  }
  return false;
}
