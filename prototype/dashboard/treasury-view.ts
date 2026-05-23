// dashboard/treasury-view.ts
//
// Treasury dashboard view types and helpers.
//
// Exports:
//   TreasuryApiResponse — the shape returned by GET /api/treasury
//   buildTreasuryView   — stub that echoes the response (consumed by tests + future drill-down)
//
// Authority: WS3-PR3a (brief:atlas:ws3-pr3a-treasury-dashboard-scaffold-api-treasur:2026-05-23).
// Author: Atlas (Core banking platform architect, engineering)

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface TreasuryCapital {
  availableCapitalZar: number;
  ticrZar: number;
  headroomZar: number;
  cet1RatioPct: string;
  status: string;
  critical: boolean;
  buildPhase: boolean;
}

export interface TreasuryLiquidityLcr {
  ratio: number | null;
  hqlaZar: number;
  netOutflows30dZar: number;
  status: string;
}

export interface TreasuryLiquidityNsfr {
  ratio: number | null;
  asfZar: number;
  rsfZar: number;
  status: string;
}

export interface TreasuryLiquidity {
  lcr: TreasuryLiquidityLcr;
  nsfr: TreasuryLiquidityNsfr;
  almGaps: string[];
  buildPhase: boolean;
}

export interface TreasuryEveScenario {
  shockLabel: string;
  description: string;
  deltaEveZar: number;
  deltaEvePctTier1: number | null;
}

export interface TreasuryEve {
  worstCaseDeltaEveZar: number;
  worstCaseDeltaEvePctTier1: number | null;
  status: string;
  scenarios: TreasuryEveScenario[];
}

export interface TreasuryNiiScenario {
  shockLabel: string;
  description: string;
  deltaNiiZar: number;
}

export interface TreasuryNii {
  worstCaseDeltaNiiZar: number;
  status: string;
  scenarios: TreasuryNiiScenario[];
}

export interface TreasuryRepricingGapRow {
  bucket: string;
  rsaZar: number;
  rslZar: number;
  gapZar: number;
  cumulativeGapZar: number;
}

export interface TreasuryRepricingGap {
  status: string;
  rows: TreasuryRepricingGapRow[];
}

export interface TreasuryIrrbb {
  eve: TreasuryEve;
  nii: TreasuryNii;
  repricingGap: TreasuryRepricingGap;
}

export interface TreasuryCollateral {
  totalHQLAZar: number;
  l1Zar: number;
  l2aZar: number;
  l2bZar: number;
  l2CapBreached: boolean;
  l2bCapBreached: boolean;
  positionCount: number;
}

export interface TreasuryFtp {
  totalAttributions: number;
  weightedAvgSpreadBps: number;
  activeCurveId: string | null;
}

export interface TreasuryRepoBook {
  openCount: number;
  totalCashLentZar: number;
  weightedAvgRateDecimal: number;
}

export interface TreasuryDepositBook {
  openCount: number;
  totalPrincipalZar: number;
}

export interface TreasuryIbPlacementBook {
  openCount: number;
  totalPlacedZar: number;
  fixedTermZar: number;
  callZar: number;
}

// ---------------------------------------------------------------------------
// Full API response type
// ---------------------------------------------------------------------------

export interface TreasuryApiResponse {
  asOf: string;
  capital: TreasuryCapital;
  liquidity: TreasuryLiquidity;
  irrbb: TreasuryIrrbb;
  collateral: TreasuryCollateral;
  ftp: TreasuryFtp;
  repoBook: TreasuryRepoBook;
  depositBook: TreasuryDepositBook;
  ibPlacementBook: TreasuryIbPlacementBook;
}

// ---------------------------------------------------------------------------
// View builder (stub — echoes the response for downstream consumers)
// ---------------------------------------------------------------------------

/**
 * Build the treasury view from the raw API response.
 *
 * Currently a passthrough — the dashboard HTML page consumes the API
 * response directly. This function exists as a typed seam so that future
 * drill-down views and agent handlers can derive typed sub-views without
 * importing server-side engine types.
 */
export function buildTreasuryView(response: TreasuryApiResponse): TreasuryApiResponse {
  return response;
}
