// platform/returns/ba300/deposit-funding-sim-book.ts
//
// SIMULATOR-FIRST DEPOSIT / FUNDING / HQLA BOOK — canonical specification
// (D-BA-RETURN-SIMULATOR-FIRST).
//
// THE single source of truth for the simulated deposit / funding / HQLA book.
// The seed (`scripts/sim/seed-deposit-funding-book-sim-v1.ts`), the golden-case
// tests, and the recon gate (`platform/recon/ba300-deposit-funding-sim-drive.ts`)
// all read this module so the book and its hand-computed oracle figures can
// never drift apart (Engineering Charter cmd 4 — source, don't hardcode in three
// places).
//
// All amounts are CLEAN ROUND NUMBERS chosen so the LCR / NSFR / BA-310 folds
// land on the oracle figures below, which are derived from the regulation, not
// from the engine (domain-truth validation, not internal consistency).
//
// Deposit / funding-line / interbank principals are carried on their events in
// ZAR MINOR units (the `principalZar: z.number().int()` schema), matching the
// existing repo-mmd-ibl event contract; the major-unit values are the
// authoritative economic quantity and the minor-unit field is `major × 100`.
// The HQLA snapshot (`CollateralInventorySnapshotted`) carries MAJOR ZAR
// (`l1Zar` etc. are folded into `amountZar` without a /100 in alm-positions.ts).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST; Reg 26 (LCR) / Reg 26A (NSFR) /
//   Reg 27 (minimum liquid reserve); SARB Act 90 of 1989; BCBS D295 / BCBS 295.
// Author: Atlas (Core banking platform architect, engineering).

export const DEPOSIT_FUNDING_SIM_SCENARIO = "deposit-funding-book-sim-v1" as const;

// ---------------------------------------------------------------------------
// Book element shapes.
// ---------------------------------------------------------------------------

export interface SimDepositSpec {
  readonly depositId: string;
  readonly counterpartyLei: string;
  /** Principal in ZAR MAJOR units (the authoritative economic quantity). */
  readonly principalMajor: number;
  /** Principal in ZAR MINOR units = principalMajor × 100 (event-carried). */
  readonly principalMinor: number;
  readonly interestRateDecimal: number;
  /** ISO 8601 — scheduled maturity. */
  readonly maturityDate: string;
  readonly depositCategory:
    | "retail-stable"
    | "retail-less-stable"
    | "wholesale-operational"
    | "wholesale-non-operational";
  readonly instrumentRef: string;
}

export interface SimFundingLineSpec {
  readonly fundingLineId: string;
  readonly drawnAmountMajor: number;
  readonly drawnAmountMinor: number;
  readonly maturityDate: string;
  readonly rateDecimal: number;
}

export interface SimInterbankPlacementSpec {
  readonly placementId: string;
  readonly counterpartyLei: string;
  readonly principalMajor: number;
  readonly principalMinor: number;
  readonly rateDecimal: number;
  readonly startDate: string;
  /** ISO 8601 — fixed-term maturity (within the 30-day LCR horizon). */
  readonly maturityDate: string;
  readonly instrumentRef: string;
}

export interface SimHqlaSpec {
  readonly snapshotId: string;
  /** Level-1 HQLA market value (pre-haircut) in ZAR MAJOR units. */
  readonly l1Zar: number;
  /** Level-2A HQLA market value (pre-haircut) in ZAR MAJOR units. */
  readonly l2aZar: number;
  /** Level-2B HQLA market value (pre-haircut) in ZAR MAJOR units. */
  readonly l2bZar: number;
  readonly securityCount: number;
}

export interface DepositFundingSimBook {
  readonly scenario: typeof DEPOSIT_FUNDING_SIM_SCENARIO;
  readonly entity: string;
  /** ISO 8601 — the as-of the book is snapshotted at. */
  readonly asOf: string;
  readonly functionalCurrency: string;
  readonly bookId: string;
  readonly deposits: readonly SimDepositSpec[];
  readonly fundingLines: readonly SimFundingLineSpec[];
  readonly interbankPlacements: readonly SimInterbankPlacementSpec[];
  readonly hqla: SimHqlaSpec;
}

const toMinor = (major: number): number => Math.round(major * 100);

// ---------------------------------------------------------------------------
// The book. Maturities are inside the 30-day LCR horizon from AS_OF so the
// product-maturity LCR folds and the NSFR < 1yr ASF bands are exercised.
// ---------------------------------------------------------------------------

const AS_OF = "2026-06-26T00:00:00.000Z";

export const DEPOSIT_FUNDING_SIM_BOOK: DepositFundingSimBook = {
  scenario: DEPOSIT_FUNDING_SIM_SCENARIO,
  entity: "LE-ZA-HOZ-BANK",
  asOf: AS_OF,
  functionalCurrency: "ZAR",
  bookId: "BOOK-TREASURY-SIM",
  deposits: [
    {
      depositId: "DFSIM-DEP-RETAIL-STABLE",
      counterpartyLei: "SIM00RETAILSTABLE0001",
      principalMajor: 500_000_000, // R500m
      principalMinor: toMinor(500_000_000),
      interestRateDecimal: 0.062,
      maturityDate: "2026-07-10", // within 30-day horizon, < 1yr
      depositCategory: "retail-stable",
      instrumentRef: "MMD-ZAR-001",
    },
    {
      depositId: "DFSIM-DEP-RETAIL-LESS-STABLE",
      counterpartyLei: "SIM0RETAILLESSSTBL01",
      principalMajor: 200_000_000, // R200m
      principalMinor: toMinor(200_000_000),
      interestRateDecimal: 0.071,
      maturityDate: "2026-07-12",
      depositCategory: "retail-less-stable",
      instrumentRef: "MMD-ZAR-001",
    },
    {
      depositId: "DFSIM-DEP-WHOLESALE-OPERATIONAL",
      counterpartyLei: "SIM00WHOLESALEOPER01",
      principalMajor: 100_000_000, // R100m
      principalMinor: toMinor(100_000_000),
      interestRateDecimal: 0.078,
      maturityDate: "2026-07-15",
      depositCategory: "wholesale-operational",
      instrumentRef: "MMD-ZAR-001",
    },
    {
      depositId: "DFSIM-DEP-WHOLESALE-NON-OPERATIONAL",
      counterpartyLei: "SIM0WHOLESALENONOP01",
      principalMajor: 150_000_000, // R150m
      principalMinor: toMinor(150_000_000),
      interestRateDecimal: 0.083,
      maturityDate: "2026-07-18",
      depositCategory: "wholesale-non-operational",
      instrumentRef: "MMD-ZAR-001",
    },
  ],
  fundingLines: [
    {
      fundingLineId: "DFSIM-FUND-WHOLESALE-LINE",
      drawnAmountMajor: 80_000_000, // R80m, 100% LCR run-off
      drawnAmountMinor: toMinor(80_000_000),
      maturityDate: "2026-07-20",
      rateDecimal: 0.088,
    },
  ],
  interbankPlacements: [
    {
      placementId: "DFSIM-IBL-PLACEMENT",
      counterpartyLei: "SIM00INTERBANKBANK01",
      principalMajor: 120_000_000, // R120m, 100% contractual LCR inflow
      principalMinor: toMinor(120_000_000),
      rateDecimal: 0.0795,
      startDate: "2026-06-26",
      maturityDate: "2026-07-16", // 20 days — within LCR horizon, < 6m RSF band
      instrumentRef: "IBL-ZAR-001",
    },
  ],
  hqla: {
    snapshotId: "DFSIM-HQLA-SNAPSHOT",
    l1Zar: 800_000_000, // R800m — cash / SARB reserves / 0%-RW ZAR sovereigns
    l2aZar: 150_000_000, // R150m — 20%-RW sovereigns / AA- corporates
    l2bZar: 30_000_000, // R30m — qualifying equities / BBB-..A+ corporates
    securityCount: 12,
  },
};

// ---------------------------------------------------------------------------
// HAND-COMPUTED ORACLE FIGURES (domain truth — derived from the regulation).
//
// === LCR (BCBS D295 / Reg 26) ===
// HQLA (post-haircut, post-cap):
//   L1  = 800m × (1 − 0.00)            = 800,000,000
//   L2A = 150m × (1 − 0.15)            = 127,500,000
//   L2B = 30m  × (1 − 0.25)            =  22,500,000
//   L2b cap  = (0.15/0.85) × 800m = 141.18m  → 22.5m NOT binding
//   L2  cap  = (0.40/0.60) × 800m = 533.33m  → 150m  NOT binding
//   HQLA total                         = 950,000,000
// Stressed outflows (run-off rates):
//   retail-stable           500m × 0.03 =  15,000,000
//   retail-less-stable      200m × 0.10 =  20,000,000
//   wholesale-operational   100m × 0.25 =  25,000,000
//   wholesale-non-oper.     150m × 1.00 = 150,000,000
//   funding line (wnop)      80m × 1.00 =  80,000,000
//   stressed outflows                   = 290,000,000
// Stressed inflows:
//   IBL placement (contractual) 120m × 1.00 = 120,000,000
//   inflow cap = 0.75 × 290m = 217.5m → recognised = min(120m, 217.5m) = 120m
//   net cash outflows = 290m − 120m         = 170,000,000
// LCR = 950m / 170m = 5.5882352941… → 558.82% (>= 100%, above-minimum)
//
// === NSFR (BCBS 295 / Reg 26A) ===
// All deposits / funding mature < 1yr; IBL matures < 6m.
// ASF (per alm-positions buildASFItems, weights from financial-constants):
//   tier-1 capital (ICAAP build-phase R300m baseline, 100% ASF) = 300,000,000
//     — alm-positions buildASFItems folds Tier-1 capital from computeCapitalMetrics,
//       which under the operating-book lens applies the confirmed R300m ICAAP
//       build-phase baseline (capital.build-phase.total-capital-minor;
//       D-MARKETS-CAPITAL-TIME-SHAPE). This is REAL build-phase ASF, not omitted.
//   retail-stable < 1yr        500m × 0.95 = 475,000,000
//   retail-less-stable < 1yr   200m × 0.90 = 180,000,000
//   wholesale-op < 1yr         100m × 0.50 =  50,000,000
//   wholesale-non-op (any)     150m × 0.00 =           0
//   (funding line: NOT folded into ASF — alm-positions buildASFItems folds
//    DepositTaken + capital + BalanceSheetProjected only; the drawn line is a
//    LCR outflow, not an NSFR ASF source here.)
//   ASF total = 300m + 475m + 180m + 50m + 0 = 1,005,000,000
// RSF (per alm-positions buildRSFItems):
//   HQLA L1  800m × 0.05 =  40,000,000
//   HQLA L2a 150m × 0.15 =  22,500,000
//   HQLA L2b  30m × 0.50 =  15,000,000
//   IBL placement (20d residual → loan-lt6m) 120m × 0.10 = 12,000,000
//   RSF total                              =  89,500,000
// NSFR = 1,005m / 89.5m = 11.2290502793… → 1122.91% (>= 100%, above-minimum)
//
// === BA 310 (minimum liquid reserve + level-1 liquid assets; Reg 27 / SARB Act) ===
// R0010 Liabilities (deposit + funding-line + IBL-is-an-asset-not-liability):
//   deposit liabilities   500m + 200m + 100m + 150m = 950,000,000
//   funding-line drawn (a borrowing / liability)     =  80,000,000
//   R0010 total liabilities base                     = 1,030,000,000
//   (the interbank PLACEMENT is a bank asset — NOT a liability — excluded.)
// R0020 less group funding   = 0  (no head-office funding in the sim book)
// R0030 less interbank-owed  = 0  (the bank is a net placer, owes nothing)
// R0040 Liabilities, as reduced = max(0, 1,030m − 0 − 0) = 1,030,000,000
// R0050 less repo funding = 0; R0060 less deriv liab = 0; R0070 less inv-grade
//   foreign-bank claims = 0; R0080 add-back group funding = 0
// R0090 Liabilities, as adjusted = 1,030m − 0 − 0 − 0 + 0 = 1,030,000,000
// R0100 minimum reserve balance = R0090 × 2.5% =  25,750,000
// R0140 level-1 HQLA required   = R0040 × 5.0% =  51,500,000
// R0150 level-1 HQLA held       = snapshot L1  = 800,000,000  (>> required)
//   surplus level-1 liquid assets = 800m − 51.5m = 748,500,000 (compliant)
// ---------------------------------------------------------------------------

export const DEPOSIT_FUNDING_SIM_ORACLE = {
  lcr: {
    hqlaZar: 950_000_000,
    netCashOutflowsZar: 170_000_000,
    /** LCR as a percentage. */
    lcrRatioPct: (950_000_000 / 170_000_000) * 100,
    status: "above-minimum" as const,
  },
  nsfr: {
    // ASF = R300m tier-1 ICAAP build-phase capital baseline + 705m deposit ASF.
    asfZar: 1_005_000_000,
    rsfZar: 89_500_000,
    nsfrRatioPct: (1_005_000_000 / 89_500_000) * 100,
    status: "above-minimum" as const,
  },
  ba310: {
    liabilitiesBaseZar: 1_030_000_000, // R0010
    liabilitiesReducedZar: 1_030_000_000, // R0040
    liabilitiesAdjustedZar: 1_030_000_000, // R0090
    minimumReserveBalanceZar: 25_750_000, // R0100 = R0090 × 2.5%
    levelOneRequiredZar: 51_500_000, // R0140 = R0040 × 5%
    levelOneHeldZar: 800_000_000, // R0150 = snapshot L1
    compliant: true,
  },
} as const;
