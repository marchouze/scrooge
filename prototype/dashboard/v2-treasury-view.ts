// dashboard/v2-treasury-view.ts
//
// V2 boundary DTOs for the Treasury liquidity oversight surface
// (`/api/v2/treasury/lcr`, `/nsfr`, `/alm`). Slice 3 of
// D-V2-UI-VISIBILITY-REMEDIATION — the build-phase liquidity metrics
// (LCR / NSFR / ALM positions), each with formula + constituents.
//
// This is the sibling of `v2-finance-view.ts` (the capital reference slice). It
// is built to the V2 UI human-oversight standard (docs/v2-ui-oversight-standard.md,
// D-V2-UI-OVERSIGHT-STANDARD): a clean `/api/v2/*` boundary reading canonical
// sources directly, an explicit `pageProvenance`, and an HONEST data state
// (never a silent zero — Engineering Charter cmd 3 + the standard's "no silent
// gaps").
//
// CANONICAL SOURCES (read directly — Charter cmd 4 source-don't-hardcode):
//   - HQLA + funding + ASF + RSF positions → `getALMPositionSnapshotV2`
//     (platform/projections/alm-positions-v2.ts) — the operating-book fold over
//     the V2-parallel money-market lifecycle events into the `ALMPositionSnapshot`
//     shape. In build phase there are no V2 money-market events, so every array
//     is empty (the honest PASS-on-empty shape). Scoped to the bank-licence
//     entity LE-ZA-HOZ-BANK (Reg 26 / 26A are bank-licence-bound).
//   - LCR ratio + HQLA stock + net 30-day outflows + status → `computeLCR`
//     (platform/liquidity/lcr.ts) — HQLA / net outflows, post-haircut, with caps.
//   - NSFR ratio + ASF + RSF + status → `computeNSFR` (platform/liquidity/nsfr.ts)
//     — ASF / RSF, weighted per BA-120.
//
// PROVENANCE: the V2 money-market fold (deposits / funding lines / repos / IBL)
// is keyed on the operating-book filter — in build phase that book holds no V2
// money-market events under EITHER lens, so those positions are empty for Prod
// and +Sim alike. The ONE provenance-sensitive input is the Tier-1-capital ASF,
// which the ALM snapshot reads via `computeCapitalMetrics`; the page `filter` is
// threaded in as the capital lens so that under Prod the simulated R300m capital
// injection is NOT shown as production ASF (no green-off-the-simulated-baseline,
// consistent with the capital page's gap #1 fix) while +Sim admits it. The route
// attaches `pageProvenance = filter` so the badge matches the header toggle
// exactly; the view records the active mode so the empty-state reason is honest.
//
// NAME-FREE (standing policy; feedback_no_agent_names_in_ui): the liquidity
// positions carry no agent personal names — they are numeric folds. There is no
// name-bearing field in the response. (No `seatTitle` mapping is required.)
//
// BOUNDARY: dashboard layer — MAY import platform projections + v2-core types.
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION (CEO 2026-06-22) under
//   D-V2-UI-OVERSIGHT-STANDARD (CEO 2026-06-17);
//   urn:reg:za:regs-relating-to-banks:reg26 (LCR) · reg26A (NSFR);
//   urn:reg:bcbs:lcr; urn:reg:bcbs:nsfr; BA-300; BA-120; Principle 1; Principle 6.
// Author: Atlas (Core banking platform architect, engineering).

import { roundDecimal, toCanonicalString, toDecimal } from "../platform/core/decimal-engine";
import type { EventStore } from "../platform/event-store/store";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import {
  type FundingPosition,
  type HQLAPosition,
  type LCRResult,
  computeLCR,
} from "../platform/liquidity/lcr";
import {
  type ASFItem,
  type NSFRResult,
  type RSFItem,
  computeNSFR,
} from "../platform/liquidity/nsfr";
import {
  type ALMPositionSnapshot,
  getALMPositionSnapshotV2,
} from "../platform/projections/alm-positions-v2";
import type { ProvenanceFilter } from "../platform/projections/filter";

// ---------------------------------------------------------------------------
// The anchor bank whose liquidity position this surface reports. Reg 26 / 26A
// (LCR / NSFR) are bank-licence-bound, so the snapshot is scoped to the
// bank-licence entity (matching the BA 300 / BA 120 generators).
// ---------------------------------------------------------------------------

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";

/** LCR / NSFR are 30-day-stress / structural ratios over the same snapshot. */
const HORIZON_DAYS = 30;

// ---------------------------------------------------------------------------
// Display helpers (ZAR-centric; the LCR/NSFR engines work in ZAR major units).
// ---------------------------------------------------------------------------

/** Group an integer string with thousands separators (display only). */
function groupThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a ZAR major-unit amount as "R1,234,567" (rands, no cents). The LCR /
 * NSFR engines carry their amounts in ZAR major units (`amountZar` — an intrinsic
 * JS number the engines themselves operate on), so this is a presentation
 * transform on an already-computed engine output, not money arithmetic. The
 * rounding to whole rands goes through the exact decimal engine (Charter cmd 6 —
 * no IEEE float rounding of a money figure): the number is serialised to a
 * decimal string and rounded with `roundDecimal`; the thousands grouping is a
 * pure string transform on the integer digits.
 */
function fmtZar(amountZar: number, currency: string): string {
  // `toDecimal` requires a finite decimal string; `Number.toString()` on a
  // finite number yields one (no exponent for the magnitudes in play here).
  const rounded = roundDecimal(toDecimal(amountZar.toString()), 0, "HALF_UP");
  const canonical = toCanonicalString(rounded);
  const negative = canonical.startsWith("-");
  const digits = negative ? canonical.slice(1) : canonical;
  const symbol = currency === "ZAR" ? "R" : `${currency} `;
  return `${negative ? "−" : ""}${symbol}${groupThousands(digits)}`;
}

/** Format a ratio percentage (e.g. 120.5 → "120.50%"); null → "n/a". */
function fmtRatioPct(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "n/a";
  return `${pct.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Shared DTO shapes (mirrors the capital slice idiom).
// ---------------------------------------------------------------------------

export type LiquidityDataState = "live" | "empty";

/** A single headline metric tile + its detail-page linkage. */
export interface LiquidityMetricTile {
  readonly key: string;
  readonly label: string;
  readonly valueFmt: string;
  readonly unit: string;
}

/** The decomposition behind one metric — formula + constituents (drill target). */
export interface LiquidityMetricDetail {
  readonly key: string;
  readonly label: string;
  readonly numLabel: string;
  readonly numFmt: string;
  readonly denLabel: string | null;
  readonly denFmt: string | null;
  readonly resultLabel: string;
  readonly resultFmt: string;
  readonly reference: string;
  /** Constituent rows (each: ordered cells matching the detail-table columns). */
  readonly constituentColumns: readonly string[];
  readonly constituents: readonly LiquidityConstituentRow[];
}

/** One constituent row, pre-formatted cell-by-cell for the V2 table render. */
export interface LiquidityConstituentRow {
  readonly cells: readonly string[];
}

// ---------------------------------------------------------------------------
// LCR view
// ---------------------------------------------------------------------------

const HQLA_TIER_LABELS: Record<string, string> = {
  L1: "Level 1",
  L2a: "Level 2a",
  L2b: "Level 2b",
};

const FUNDING_CATEGORY_LABELS: Record<string, string> = {
  "retail-stable": "Retail deposits — stable",
  "retail-less-stable": "Retail deposits — less stable",
  "wholesale-operational": "Unsecured wholesale — operational",
  "wholesale-non-operational": "Unsecured wholesale — non-operational",
  "secured-level1": "Secured funding — Level 1 collateral",
  "secured-level2": "Secured funding — Level 2 collateral",
  "inflow-contractual": "Contractual inflows",
  "inflow-other": "Other inflows",
};

export interface LcrView {
  readonly entity: string;
  readonly functionalCurrency: string;
  readonly mode: string;
  readonly dataState: LiquidityDataState;
  readonly reason: string;
  readonly tiles: readonly LiquidityMetricTile[];
  readonly metrics: readonly LiquidityMetricDetail[];
  readonly status: string;
  readonly hqlaConstituents: readonly LiquidityConstituentRow[];
  readonly outflowConstituents: readonly LiquidityConstituentRow[];
  readonly lcrFmt: string;
  readonly hqlaFmt: string;
  readonly netOutflowsFmt: string;
}

export interface BuildLiquidityViewArgs {
  readonly eventStore: EventStore;
  readonly filter: ProvenanceFilter;
  readonly asOf: string;
}

function hqlaRows(positions: readonly HQLAPosition[], currency: string): LiquidityConstituentRow[] {
  return positions.map((p) => ({
    cells: [HQLA_TIER_LABELS[p.tier] ?? p.tier, fmtZar(p.amountZar, currency)],
  }));
}

function outflowRows(
  positions: readonly FundingPosition[],
  currency: string,
): LiquidityConstituentRow[] {
  return positions.map((p) => ({
    cells: [FUNDING_CATEGORY_LABELS[p.category] ?? p.category, fmtZar(p.amountZar, currency)],
  }));
}

/**
 * Build the V2 LCR view. The LCR is HQLA / net 30-day outflows. The positions
 * come from the operating-book ALM snapshot; in build phase there are none, so
 * the honest state is `no-positions` (an explicit empty state, never a zero
 * masquerading as a ratio).
 */
export function buildLcrView(args: BuildLiquidityViewArgs): LcrView {
  const { eventStore, filter, asOf } = args;
  const currency = anchorFunctionalCurrency();
  const snap: ALMPositionSnapshot = getALMPositionSnapshotV2(
    eventStore,
    asOf,
    HORIZON_DAYS,
    ANCHOR_ENTITY,
    filter,
  );
  const lcr: LCRResult = computeLCR(
    snap.hqlaPositions as HQLAPosition[],
    snap.fundingPositions as FundingPosition[],
  );

  const dataState: LiquidityDataState = lcr.status === "no-positions" ? "empty" : "live";
  const mode = filter.mode === "combined" ? "+Sim" : "Prod";
  const reason =
    dataState === "empty"
      ? `No liquidity positions in the operating book under the ${mode} lens — no V2 money-market events (HQLA / deposits / funding lines) booked in the build phase. This is an honest empty state, not a clean zero.`
      : "";

  const lcrFmt = fmtRatioPct(lcr.lcrRatioPct);
  const hqlaFmt = fmtZar(lcr.hqlaZar, currency);
  const netOutflowsFmt = fmtZar(lcr.netCashOutflowsZar, currency);

  const tiles: LiquidityMetricTile[] = [
    {
      key: "lcr",
      label: "Liquidity Coverage Ratio",
      valueFmt: lcrFmt,
      unit: "HQLA / net 30-day outflows",
    },
    {
      key: "hqla",
      label: "HQLA stock",
      valueFmt: hqlaFmt,
      unit: "Post-haircut (high-quality liquid assets)",
    },
    {
      key: "net-outflows",
      label: "Net cash outflows",
      valueFmt: netOutflowsFmt,
      unit: "30-day stress horizon",
    },
    {
      key: "lcr-minimum",
      label: "Minimum requirement",
      valueFmt: "100%",
      unit: "Reg 26 / BCBS LCR",
    },
  ];

  const hqlaConstituents = hqlaRows(snap.hqlaPositions, currency);
  const outflowConstituents = outflowRows(snap.fundingPositions, currency);

  const metrics: LiquidityMetricDetail[] = [
    {
      key: "lcr",
      label: "Liquidity Coverage Ratio",
      numLabel: "Stock of HQLA (post-haircut)",
      numFmt: hqlaFmt,
      denLabel: "Net cash outflows (30-day stress)",
      denFmt: netOutflowsFmt,
      resultLabel: "LCR",
      resultFmt: lcrFmt,
      reference: "Reg 26; BCBS LCR (Jan 2013); BA-300",
      constituentColumns: ["HQLA tier", "Amount"],
      constituents: hqlaConstituents,
    },
    {
      key: "hqla",
      label: "HQLA stock",
      numLabel: "Sum of HQLA positions (post-haircut, capped)",
      numFmt: hqlaFmt,
      denLabel: null,
      denFmt: null,
      resultLabel: "HQLA stock",
      resultFmt: hqlaFmt,
      reference: "Reg 26; BCBS LCR Annex 1 (L1 / L2a / L2b haircuts + caps)",
      constituentColumns: ["HQLA tier", "Amount"],
      constituents: hqlaConstituents,
    },
    {
      key: "net-outflows",
      label: "Net cash outflows",
      numLabel: "Stressed outflows − min(inflows, 75% × outflows)",
      numFmt: netOutflowsFmt,
      denLabel: null,
      denFmt: null,
      resultLabel: "Net cash outflows (30-day)",
      resultFmt: netOutflowsFmt,
      reference: "Reg 26; BCBS LCR §19 (net cash outflows); BA-300",
      constituentColumns: ["Outflow / inflow category", "Amount"],
      constituents: outflowConstituents,
    },
  ];

  return {
    entity: ANCHOR_ENTITY,
    functionalCurrency: currency,
    mode,
    dataState,
    reason,
    tiles,
    metrics,
    status: lcr.status,
    hqlaConstituents,
    outflowConstituents,
    lcrFmt,
    hqlaFmt,
    netOutflowsFmt,
  };
}

// ---------------------------------------------------------------------------
// NSFR view
// ---------------------------------------------------------------------------

const ASF_CATEGORY_LABELS: Record<string, string> = {
  "tier1-capital": "Tier 1 capital",
  "tier2-capital-gt1y": "Tier 2 capital (> 1Y)",
  "retail-stable-lt1y": "Retail deposits — stable (< 1Y)",
  "retail-less-stable-lt1y": "Retail deposits — less stable (< 1Y)",
  "wholesale-gt1y": "Wholesale funding (> 1Y)",
  "wholesale-lt1y-operational": "Wholesale (< 1Y) — operational",
  "wholesale-lt1y-non-operational": "Wholesale (< 1Y) — non-operational",
};

const RSF_CATEGORY_LABELS: Record<string, string> = {
  "hqla-l1": "HQLA Level 1",
  "hqla-l2a": "HQLA Level 2a",
  "hqla-l2b": "HQLA Level 2b",
  "loan-lt6m": "Loans (< 6M)",
  "loan-6m-1y": "Loans (6M–1Y)",
  "loan-gt1y-standard": "Loans (> 1Y) — standard",
  "loan-gt1y-residential": "Loans (> 1Y) — residential",
  "security-lt1y": "Securities (< 1Y)",
  "security-gt1y-non-hqla": "Securities (> 1Y) — non-HQLA",
  "operational-deposit-at-fi": "Operational deposits at other FIs",
  "derivative-net": "Derivatives (net)",
};

export interface NsfrView {
  readonly entity: string;
  readonly functionalCurrency: string;
  readonly mode: string;
  readonly dataState: LiquidityDataState;
  readonly reason: string;
  readonly tiles: readonly LiquidityMetricTile[];
  readonly metrics: readonly LiquidityMetricDetail[];
  readonly status: string;
  readonly asfConstituents: readonly LiquidityConstituentRow[];
  readonly rsfConstituents: readonly LiquidityConstituentRow[];
  readonly nsfrFmt: string;
  readonly asfFmt: string;
  readonly rsfFmt: string;
}

function asfRows(items: readonly ASFItem[], currency: string): LiquidityConstituentRow[] {
  return items.map((i) => ({
    cells: [ASF_CATEGORY_LABELS[i.category] ?? i.category, fmtZar(i.amountZar, currency)],
  }));
}

function rsfRows(items: readonly RSFItem[], currency: string): LiquidityConstituentRow[] {
  return items.map((i) => ({
    cells: [RSF_CATEGORY_LABELS[i.category] ?? i.category, fmtZar(i.amountZar, currency)],
  }));
}

/**
 * Build the V2 NSFR view. NSFR is ASF / RSF (available / required stable
 * funding, weighted per BA-120). Build phase has no positions → honest empty.
 */
export function buildNsfrView(args: BuildLiquidityViewArgs): NsfrView {
  const { eventStore, filter, asOf } = args;
  const currency = anchorFunctionalCurrency();
  const snap: ALMPositionSnapshot = getALMPositionSnapshotV2(
    eventStore,
    asOf,
    HORIZON_DAYS,
    ANCHOR_ENTITY,
    filter,
  );
  const nsfr: NSFRResult = computeNSFR(snap.asfItems as ASFItem[], snap.rsfItems as RSFItem[]);

  const dataState: LiquidityDataState = nsfr.status === "no-positions" ? "empty" : "live";
  const mode = filter.mode === "combined" ? "+Sim" : "Prod";
  const reason =
    dataState === "empty"
      ? `No stable-funding positions in the operating book under the ${mode} lens — no V2 money-market events booked in the build phase. This is an honest empty state, not a clean zero.`
      : "";

  const nsfrFmt = fmtRatioPct(nsfr.nsfrRatioPct);
  const asfFmt = fmtZar(nsfr.asfZar, currency);
  const rsfFmt = fmtZar(nsfr.rsfZar, currency);

  const tiles: LiquidityMetricTile[] = [
    {
      key: "nsfr",
      label: "Net Stable Funding Ratio",
      valueFmt: nsfrFmt,
      unit: "ASF / RSF",
    },
    { key: "asf", label: "Available stable funding", valueFmt: asfFmt, unit: "Weighted (BA-120)" },
    { key: "rsf", label: "Required stable funding", valueFmt: rsfFmt, unit: "Weighted (BA-120)" },
    {
      key: "nsfr-minimum",
      label: "Minimum requirement",
      valueFmt: "100%",
      unit: "Reg 26A / BCBS NSFR",
    },
  ];

  const asfConstituents = asfRows(snap.asfItems, currency);
  const rsfConstituents = rsfRows(snap.rsfItems, currency);

  const metrics: LiquidityMetricDetail[] = [
    {
      key: "nsfr",
      label: "Net Stable Funding Ratio",
      numLabel: "Available Stable Funding (weighted)",
      numFmt: asfFmt,
      denLabel: "Required Stable Funding (weighted)",
      denFmt: rsfFmt,
      resultLabel: "NSFR",
      resultFmt: nsfrFmt,
      reference: "Reg 26A; BCBS NSFR (Oct 2014); BA-120",
      constituentColumns: ["ASF category", "Amount"],
      constituents: asfConstituents,
    },
    {
      key: "asf",
      label: "Available stable funding",
      numLabel: "Sum of ASF sources × ASF weight",
      numFmt: asfFmt,
      denLabel: null,
      denFmt: null,
      resultLabel: "Available Stable Funding",
      resultFmt: asfFmt,
      reference: "Reg 26A; BCBS NSFR — ASF factors; BA-120",
      constituentColumns: ["ASF category", "Amount"],
      constituents: asfConstituents,
    },
    {
      key: "rsf",
      label: "Required stable funding",
      numLabel: "Sum of RSF items × RSF weight",
      numFmt: rsfFmt,
      denLabel: null,
      denFmt: null,
      resultLabel: "Required Stable Funding",
      resultFmt: rsfFmt,
      reference: "Reg 26A; BCBS NSFR — RSF factors; BA-120",
      constituentColumns: ["RSF category", "Amount"],
      constituents: rsfConstituents,
    },
  ];

  return {
    entity: ANCHOR_ENTITY,
    functionalCurrency: currency,
    mode,
    dataState,
    reason,
    tiles,
    metrics,
    status: nsfr.status,
    asfConstituents,
    rsfConstituents,
    nsfrFmt,
    asfFmt,
    rsfFmt,
  };
}

// ---------------------------------------------------------------------------
// ALM positions view
// ---------------------------------------------------------------------------

/** A positions-by-type tile + its row count. */
export interface AlmPositionGroup {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly totalFmt: string;
}

export interface AlmView {
  readonly entity: string;
  readonly functionalCurrency: string;
  readonly mode: string;
  readonly dataState: LiquidityDataState;
  readonly reason: string;
  readonly horizonDays: number;
  /** Headline tiles: one per position class (HQLA / funding / ASF / RSF). */
  readonly tiles: readonly LiquidityMetricTile[];
  /** Per-class position groups (for the positions-by-type table). */
  readonly groups: readonly AlmPositionGroup[];
  /** Substrate gaps reported by the ALM snapshot (named, not hidden). */
  readonly gaps: readonly string[];
  /** Detail constituents per class for the maturity / positions tables. */
  readonly hqlaConstituents: readonly LiquidityConstituentRow[];
  readonly fundingConstituents: readonly LiquidityConstituentRow[];
  readonly asfConstituents: readonly LiquidityConstituentRow[];
  readonly rsfConstituents: readonly LiquidityConstituentRow[];
}

function sumZar(items: readonly { amountZar: number }[]): number {
  return items.reduce((s, i) => s + i.amountZar, 0);
}

/**
 * Build the V2 ALM positions view. The ALM snapshot is the operating-book fold
 * over the V2 money-market lifecycle events; build phase yields empty arrays
 * (the honest PASS-on-empty shape). Each position class is a headline tile that
 * drills to a positions-by-type table.
 */
export function buildAlmView(args: BuildLiquidityViewArgs): AlmView {
  const { eventStore, filter, asOf } = args;
  const currency = anchorFunctionalCurrency();
  const snap: ALMPositionSnapshot = getALMPositionSnapshotV2(
    eventStore,
    asOf,
    HORIZON_DAYS,
    ANCHOR_ENTITY,
    filter,
  );

  const totalCount =
    snap.hqlaPositions.length +
    snap.fundingPositions.length +
    snap.asfItems.length +
    snap.rsfItems.length;
  const dataState: LiquidityDataState = totalCount > 0 ? "live" : "empty";
  const mode = filter.mode === "combined" ? "+Sim" : "Prod";
  const reason =
    dataState === "empty"
      ? `No ALM positions in the operating book under the ${mode} lens — no V2 money-market events (HQLA / deposits / funding lines / interbank loans / repos) booked in the build phase. This is an honest empty state, not a clean zero.`
      : "";

  const hqlaConstituents = hqlaRows(snap.hqlaPositions, currency);
  const fundingConstituents = outflowRows(snap.fundingPositions, currency);
  const asfConstituents = asfRows(snap.asfItems, currency);
  const rsfConstituents = rsfRows(snap.rsfItems, currency);

  const groups: AlmPositionGroup[] = [
    {
      key: "hqla",
      label: "HQLA positions",
      count: snap.hqlaPositions.length,
      totalFmt: fmtZar(sumZar(snap.hqlaPositions), currency),
    },
    {
      key: "funding",
      label: "Funding positions",
      count: snap.fundingPositions.length,
      totalFmt: fmtZar(sumZar(snap.fundingPositions), currency),
    },
    {
      key: "asf",
      label: "ASF items",
      count: snap.asfItems.length,
      totalFmt: fmtZar(sumZar(snap.asfItems), currency),
    },
    {
      key: "rsf",
      label: "RSF items",
      count: snap.rsfItems.length,
      totalFmt: fmtZar(sumZar(snap.rsfItems), currency),
    },
  ];

  const tiles: LiquidityMetricTile[] = groups.map((g) => ({
    key: g.key,
    label: g.label,
    valueFmt: g.totalFmt,
    unit: `${g.count} position${g.count === 1 ? "" : "s"}`,
  }));

  return {
    entity: ANCHOR_ENTITY,
    functionalCurrency: currency,
    mode,
    dataState,
    reason,
    horizonDays: HORIZON_DAYS,
    tiles,
    groups,
    gaps: snap.gaps,
    hqlaConstituents,
    fundingConstituents,
    asfConstituents,
    rsfConstituents,
  };
}
