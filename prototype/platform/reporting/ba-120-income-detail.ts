// platform/reporting/ba-120-income-detail.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — BA 610 detail (Selected Income-Statement
// Information / Profitability Detail) projection. Monthly SARB return.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), extended 2026-05-17 to add the BA-returns
// quintet (Marc's directive — `WS-FINANCE-BA-RETURNS-QUINTET`).
//
// BA 610 detail extends BA 610. It takes the `Ba610IncomeStatement` output as its
// primary typed input and decomposes the NII + non-interest income further
// by:
//   (a) Instrument class (interbank / corporate / sovereign / retail-
//       placeholder) — per the caller-supplied `Ba610DetailBandingMap`.
//   (b) ALM maturity band (overnight / 1-7d / 8-30d / 1-3m / 3-6m /
//       6-12m / >1y) — per the caller-supplied `Ba610DetailBandingMap`.
//   (c) Net-Interest Margin (NIM) — NII divided by average earning assets
//       (AEA), client NIM vs structural NIM split deferred pending Ravi's
//       FTP engine.
//   (d) Non-interest income — lifted straight from the BA 610 output
//       `feeIncome` + `tradingProfitLoss` sections.
//   (e) Operating efficiency — cost-to-income ratio.
//
// BA 610 detail does NOT re-fold the trial balance independently. The BA 610
// output is the canonical entry point; BA 610 detail only re-slices its NII
// sub-sections using the banding map.
//
// Pipeline:
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → PERIOD CLOSE          — Slice 2 — period-delta trial balance
//      → BA 610 PROJECTION     — `ba-610-income-statement.ts`
//      → BA 610 detail PROJECTION     — this module — pure function over BA 610 output
//      → RENDER + STORE        — `ba-610-detail-render.ts` + RMS doc store
//
// Computation per Banks Act 94 of 1990 §75 + Regulations Relating to
// Banks Reg 32 (monthly returns) + SARB BA 610 detail published schema:
//
//   netInterestIncome   = ba300.netInterestIncomeMinor
//   niiByClass[k]       = Σ ba300 interest-income/expense line items matched
//                         to instrument class k via the banding map
//   niiByBand[b]        = Σ ba300 interest-income/expense line items matched
//                         to maturity band b via the banding map
//   nim                 = netInterestIncome / averageEarningAssetsMinor
//   costToIncomeRatio   = operatingExpenses / (netInterestIncome + feeIncome
//                         + tradingProfitLoss + otherIncome)
//
// Per-entity. Bank-licence-bound; only Hoz Bank `LE-ZA-HOZ-BANK` in scope
// at v0. Group-consolidated BA 610 detail deferred under `D-REGULATORY-PERIMETER`.
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **FTP engine (Ravi, IRRBB substrate, downstream)** — client NIM vs
//     structural NIM split is informational at v0; FTP rates are caller-
//     supplied via `Ba610DetailFtpRates` (nullable). When Ravi's FTP engine
//     lands, the engine's typed output replaces the caller-supplied fixture.
//     No generator API change expected.
//   - **ALM cashflow engine (Ravi, downstream)** — ALM maturity-band
//     banding is caller-supplied via `Ba610DetailBandingMap` at v0. The ALM
//     cashflow engine will produce contractual maturity dates that drive
//     the banding automatically; the generator's banding interface is
//     forward-compatible.
//   - **No real loan book** — NII by instrument class has only FX-spot
//     activity in the sub-ledger at build-phase. Synthetic fixtures cover
//     interbank / corporate / sovereign / retail-placeholder slots.
//   - **SARB BA 610 detail XML adapter** deferred to a downstream slice; this
//     module emits canonical JSON only.
//   - **Group-consolidated BA 610 detail** (LE-ZA-HOZ-GROUP look-through per
//     Banks Act §60) deferred. Solo entity only at v0.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration; JSON-schema co-design)
//   + Ravi (Treasury & ALM engineer, engineering — FTP + ALM banding
//   substrate consult).

import type { Ba610IncomeStatement, Ba610LineItem } from "./ba-120-income-statement";

// ---------------------------------------------------------------------------
// Instrument classes
// ---------------------------------------------------------------------------

/**
 * Instrument class per SARB BA 610 detail income-by-sector decomposition.
 * `retail-placeholder` is a structural slot that will resolve to sub-
 * categories (mortgage / personal / SME) at a future slice once the
 * loan-book substrate lands.
 */
export type Ba610DetailInstrumentClass =
  | "interbank"
  | "corporate"
  | "sovereign"
  | "retail-placeholder";

// ---------------------------------------------------------------------------
// ALM maturity bands
// ---------------------------------------------------------------------------

/**
 * ALM maturity bands per SARB BA 610 detail + BCBS IRRBB §26. Bands follow
 * contractual repricing / maturity schedule. v0 banding is caller-supplied
 * (Ravi's ALM cashflow engine downstream).
 */
export type Ba610DetailMaturityBand =
  | "overnight"
  | "1-7d"
  | "8-30d"
  | "1-3m"
  | "3-6m"
  | "6-12m"
  | ">1y";

// ---------------------------------------------------------------------------
// Banding map
// ---------------------------------------------------------------------------

/**
 * Per-leaf-account banding map entry. Maps an account that contributes
 * to interest income or interest expense to an instrument class and an
 * ALM maturity band. Accounts not in the map are surfaced in
 * `classificationGaps`.
 *
 * `volumeMinor` is the average volume of the earning asset or interest-
 * bearing liability over the period in the functional currency (minor
 * units). Used for NIM calculation. v0 contract: caller supplies a
 * fixture (synthetic average balance). Ravi's ALM cashflow engine
 * produces this shape once it lands.
 */
export interface Ba610DetailBandingEntry {
  readonly leafAccountId: string;
  readonly instrumentClass: Ba610DetailInstrumentClass;
  readonly maturityBand: Ba610DetailMaturityBand;
  /**
   * Average volume (earning asset or interest-bearing liability) over the
   * period, in minor units (unsigned). Used as the denominator proxy for
   * NIM when the caller supplies this. Zero means no volume contribution
   * to the AEA denominator from this account.
   */
  readonly volumeMinor: number;
}

/**
 * Banding map: one entry per leaf account that participates in interest
 * income or interest expense decomposition. Accounts without an entry are
 * classified as gaps.
 */
export type Ba610DetailBandingMap = readonly Ba610DetailBandingEntry[];

// ---------------------------------------------------------------------------
// FTP rates (optional — nullable at v0)
// ---------------------------------------------------------------------------

/**
 * Internal Funds Transfer Pricing (FTP) rates per maturity band. Used to
 * split NIM into client NIM (spread attributable to origination) vs
 * structural NIM (spread retained by Treasury). v0: pass as a typed
 * fixture or `null` to suppress the split; the client/structural split
 * fields in the output are `null` when FTP rates are absent.
 *
 * Ravi's IRRBB substrate will produce this shape once it lands.
 */
export interface Ba610DetailFtpRateBand {
  readonly maturityBand: Ba610DetailMaturityBand;
  /** FTP rate per band (basis-points: 100 = 1%). */
  readonly ftpRateBps: number;
}

export type Ba610DetailFtpRates = readonly Ba610DetailFtpRateBand[] | null;

// ---------------------------------------------------------------------------
// Generator input
// ---------------------------------------------------------------------------

/**
 * The complete BA 610 detail generator input.
 *
 * The `ba300Output` is the primary data source — BA 610 detail never re-folds the
 * trial balance; it re-slices the BA 610 NII sections using the banding
 * map.
 *
 * `bandingMap` is the per-account instrument-class + ALM-band assignment.
 * `ftpRates` is optional; `null` suppresses client/structural NIM split.
 * `averageEarningAssetsMinor` is the AEA denominator for the NIM
 * calculation — caller-supplied at v0 (Ravi's ALM cashflow engine
 * downstream). Must be non-negative; zero produces null NIM.
 */
export interface Ba610DetailGeneratorInput {
  /** BA 610 output — primary typed input for BA 610 detail. */
  readonly ba300Output: Ba610IncomeStatement;
  /** Per-account instrument class + ALM maturity band assignments. */
  readonly bandingMap: Ba610DetailBandingMap;
  /** FTP rates per band — `null` suppresses client/structural NIM split. */
  readonly ftpRates: Ba610DetailFtpRates;
  /**
   * Average earning assets over the period, in minor units (unsigned).
   * Denominator for the NIM calculation. v0: caller-supplied fixture.
   * Ravi's ALM cashflow engine downstream.
   */
  readonly averageEarningAssetsMinor: number;
  /**
   * Optional citation to the source `TrialBalanceSnapshotted.event_id`
   * from the BA 610 input — forwarded into the BA 610 detail output for Principle
   * 1 chain-of-custody.
   */
  readonly trialBalanceSnapshotEventId?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface Ba610DetailLineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly contributingAccounts: readonly string[];
  readonly subCategory?: string;
  readonly note?: string;
}

/**
 * NII decomposed by instrument class.
 */
export interface Ba610DetailNiiByClass {
  readonly instrumentClass: Ba610DetailInstrumentClass;
  readonly interestIncomeMinor: number;
  readonly interestExpenseMinor: number;
  readonly netInterestIncomeMinor: number;
  readonly lineItems: readonly Ba610DetailLineItem[];
}

/**
 * NII + volume decomposed by ALM maturity band.
 */
export interface Ba610DetailNiiByBand {
  readonly maturityBand: Ba610DetailMaturityBand;
  readonly interestIncomeMinor: number;
  readonly interestExpenseMinor: number;
  readonly netInterestIncomeMinor: number;
  /** Average volume (earning asset / funding) for this band in minor units. */
  readonly volumeMinor: number;
  readonly lineItems: readonly Ba610DetailLineItem[];
}

/**
 * NII breakdown section.
 */
export interface Ba610DetailNiiBreakdown {
  readonly totalInterestIncomeMinor: number;
  readonly totalInterestExpenseMinor: number;
  readonly totalNetInterestIncomeMinor: number;
  readonly byInstrumentClass: readonly Ba610DetailNiiByClass[];
  readonly byMaturityBand: readonly Ba610DetailNiiByBand[];
  /** Accounts in interest income/expense sections not covered by the banding map. */
  readonly bandingGaps: readonly string[];
}

/**
 * ALM banding section — mirrors `byMaturityBand` with volume coverage.
 */
export interface Ba610DetailAlmBandingSection {
  readonly totalVolumeMinor: number;
  readonly totalNetInterestIncomeMinor: number;
  readonly bands: readonly Ba610DetailNiiByBand[];
}

/**
 * NIM section. The overall NIM is computed from aggregate NII / AEA.
 * Client NIM vs structural NIM split is informational at v0 (FTP engine
 * downstream). Fields are `null` when FTP rates are not supplied or when
 * AEA is zero (division undefined).
 */
export interface Ba610DetailNimSection {
  /** Overall NIM = totalNetInterestIncome / averageEarningAssets. Null if AEA is zero. */
  readonly overallNim: number | null;
  readonly overallNimBps: number | null;
  readonly averageEarningAssetsMinor: number;
  /**
   * Client NIM = client spread × AEA. Null when FTP rates not supplied.
   * Forward-link: Ravi's FTP engine provides rate decomposition.
   */
  readonly clientNim: number | null;
  /**
   * Structural NIM = structural spread × AEA. Null when FTP rates not
   * supplied.
   */
  readonly structuralNim: number | null;
  /**
   * Per-band NIM. Populated when FTP rates are supplied; null elements
   * when FTP not available for the band.
   */
  readonly byBand: ReadonlyArray<{
    readonly maturityBand: Ba610DetailMaturityBand;
    readonly nim: number | null;
    readonly nimBps: number | null;
    readonly clientNim: number | null;
    readonly structuralNim: number | null;
    readonly volumeMinor: number;
  }>;
}

/**
 * Non-interest income section — lifted from the BA 610 output.
 */
export interface Ba610DetailNonInterestSection {
  readonly feeIncomeMinor: number;
  readonly tradingProfitLossMinor: number;
  readonly otherIncomeMinor: number;
  readonly otherExpenseMinor: number;
  readonly totalNonInterestIncomeMinor: number;
  readonly lineItems: readonly Ba610DetailLineItem[];
}

/**
 * Operating efficiency (cost-to-income ratio) section.
 */
export interface Ba610DetailEfficiencySection {
  /**
   * Cost-to-income ratio = operatingExpenses / totalOperatingIncome.
   * Null when totalOperatingIncome is zero (division undefined).
   */
  readonly costToIncomeRatio: number | null;
  readonly costToIncomePercent: string | null;
  readonly operatingExpensesMinor: number;
  /**
   * Total operating income = NII + fee income + trading P&L + other income
   * − other expense.
   */
  readonly totalOperatingIncomeMinor: number;
}

/**
 * Full BA 610 detail output.
 */
export interface Ba610DetailIncomeDetail {
  readonly meta: {
    readonly form: "BA 120 detail";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly trialBalanceSnapshotEventId?: string;
    readonly ba300ClassificationsFingerprint: string;
    readonly bandingMapFingerprint: string;
  };
  readonly netInterestIncome: Ba610DetailNiiBreakdown;
  readonly almBanding: Ba610DetailAlmBandingSection;
  readonly netInterestMargin: Ba610DetailNimSection;
  readonly nonInterestIncome: Ba610DetailNonInterestSection;
  readonly operatingEfficiency: Ba610DetailEfficiencySection;
  readonly lineItems: readonly Ba610DetailLineItem[];
  readonly classificationGaps: readonly string[];
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly entity: string;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors + scope guard
// ---------------------------------------------------------------------------

export class Ba610DetailGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba610DetailGeneratorError";
  }
}

export const BA_610_DETAIL_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_610_DETAIL_BANK_ENTITIES.includes(entity)) {
    throw new Ba610DetailGeneratorError(
      `BA 610 detail (Selected Income-Statement Information) is bank-licence-bound; entity '${entity}' is not in BA_610_DETAIL_BANK_ENTITIES (${BA_610_DETAIL_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER. Group-consolidated BA 610 detail lands at a later slice.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Ordered band / class lists
// ---------------------------------------------------------------------------

const ORDERED_BANDS: readonly Ba610DetailMaturityBand[] = [
  "overnight",
  "1-7d",
  "8-30d",
  "1-3m",
  "3-6m",
  "6-12m",
  ">1y",
];

const ORDERED_CLASSES: readonly Ba610DetailInstrumentClass[] = [
  "interbank",
  "corporate",
  "sovereign",
  "retail-placeholder",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Non-null safe get from a Map that is known to contain all keys. Throws
 * a descriptive `Ba610DetailGeneratorError` on the impossible code path instead
 * of using a non-null assertion (Biome `noNonNullAssertion` rule).
 */
function mustGet<K, V>(map: Map<K, V>, key: K, context: string): V {
  const v = map.get(key);
  if (v === undefined) {
    throw new Ba610DetailGeneratorError(
      `BA 610 detail generator: internal error — expected '${String(key)}' in ${context}`,
    );
  }
  return v;
}

function fingerprintBandingMap(map: Ba610DetailBandingMap): string {
  const sorted = [...map].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );
  return JSON.stringify(sorted);
}

function nimBps(nim: number | null): number | null {
  return nim === null ? null : Math.round(nim * 10_000);
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function ba300LineToLineItem(
  item: Ba610LineItem,
  lineIdPrefix: string,
  newAmountMinor: number,
  currency: string,
): Ba610DetailLineItem {
  return {
    lineId: `${lineIdPrefix}.${item.lineId}`,
    lineLabel: item.lineLabel,
    amountMinor: newAmountMinor,
    currency,
    contributingAccounts: [...item.contributingAccounts],
    ...(item.subCategory ? { subCategory: item.subCategory } : {}),
    ...(item.note ? { note: item.note } : {}),
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 610 detail (Selected Income-Statement Information) projection
 * from a `Ba610IncomeStatement` output + caller-supplied banding map +
 * optional FTP rates. Pure function; deterministic.
 *
 * BA 610 detail DOES NOT re-fold the trial balance. It re-slices the BA 610 NII
 * sections via the banding map and derives NIM / ALM-band decomposition /
 * non-interest income / efficiency sections. All NII figures are sourced
 * from the BA 610 `interestIncome` + `interestExpense` sections.
 *
 * Sign convention: inherits from BA 610 — interest income / fee income are
 * positive magnitudes in the BA 610 output; interest expense + operating
 * expense are also positive magnitudes (signed out at the NII / PBT
 * computation layer).
 */
export function generateBa610DetailIncomeDetail(
  input: Ba610DetailGeneratorInput,
): Ba610DetailIncomeDetail {
  const { ba300Output, bandingMap, ftpRates, averageEarningAssetsMinor } = input;

  // Entity inherited from BA 610 — assert it is bank-licensed.
  assertBankEntity(ba300Output.meta.entity);

  if (!ba300Output.meta.functionalCurrency || ba300Output.meta.functionalCurrency.length !== 3) {
    throw new Ba610DetailGeneratorError(
      `BA 610 detail generator: BA 610 functionalCurrency must be ISO-4217 (3 chars), got '${ba300Output.meta.functionalCurrency}'`,
    );
  }
  if (!(ba300Output.meta.periodStart < ba300Output.meta.periodEnd)) {
    throw new Ba610DetailGeneratorError(
      `BA 610 detail generator: periodStart (${ba300Output.meta.periodStart}) must precede periodEnd (${ba300Output.meta.periodEnd})`,
    );
  }
  if (!Number.isFinite(averageEarningAssetsMinor) || averageEarningAssetsMinor < 0) {
    throw new Ba610DetailGeneratorError(
      `BA 610 detail generator: averageEarningAssetsMinor must be a non-negative finite number, got ${averageEarningAssetsMinor}`,
    );
  }

  const ccy = ba300Output.meta.functionalCurrency;

  // Build banding index. Duplicate detection.
  const bandIndex = new Map<string, Ba610DetailBandingEntry>();
  for (const entry of bandingMap) {
    if (bandIndex.has(entry.leafAccountId)) {
      throw new Ba610DetailGeneratorError(
        `BA 610 detail generator: duplicate banding-map entry for account '${entry.leafAccountId}'`,
      );
    }
    if (!Number.isFinite(entry.volumeMinor) || entry.volumeMinor < 0) {
      throw new Ba610DetailGeneratorError(
        `BA 610 detail generator: banding-map entry for '${entry.leafAccountId}' has invalid volumeMinor=${entry.volumeMinor} (must be non-negative finite)`,
      );
    }
    bandIndex.set(entry.leafAccountId, entry);
  }

  // ---------------------------------------------------------------------------
  // NII decomposition by instrument class + maturity band.
  // We iterate over the BA 610 interest-income + interest-expense line items.
  // ---------------------------------------------------------------------------

  type ClassBucket = {
    interestIncome: number;
    interestExpense: number;
    lines: Ba610DetailLineItem[];
  };
  type BandBucket = {
    interestIncome: number;
    interestExpense: number;
    volume: number;
    lines: Ba610DetailLineItem[];
  };

  const classBuckets = new Map<Ba610DetailInstrumentClass, ClassBucket>(
    ORDERED_CLASSES.map((c) => [c, { interestIncome: 0, interestExpense: 0, lines: [] }]),
  );
  const bandBuckets = new Map<Ba610DetailMaturityBand, BandBucket>(
    ORDERED_BANDS.map((b) => [b, { interestIncome: 0, interestExpense: 0, volume: 0, lines: [] }]),
  );

  const bandingGaps = new Set<string>();

  const processInterestItems = (
    items: readonly Ba610LineItem[],
    side: "income" | "expense",
  ): void => {
    for (const item of items) {
      const accountId = item.contributingAccounts[0] ?? item.lineId;
      const entry = bandIndex.get(accountId);
      if (!entry) {
        bandingGaps.add(accountId);
        continue;
      }

      const lineItem: Ba610DetailLineItem = ba300LineToLineItem(
        item,
        `ba310.${side}`,
        item.amountMinor,
        ccy,
      );

      const cb = classBuckets.get(entry.instrumentClass);
      const bb = bandBuckets.get(entry.maturityBand);
      if (cb) {
        if (side === "income") {
          cb.interestIncome += item.amountMinor;
        } else {
          cb.interestExpense += item.amountMinor;
        }
        cb.lines.push(lineItem);
      }
      if (bb) {
        if (side === "income") {
          bb.interestIncome += item.amountMinor;
        } else {
          bb.interestExpense += item.amountMinor;
        }
        bb.volume += entry.volumeMinor;
        bb.lines.push(lineItem);
      }
    }
  };

  processInterestItems(ba300Output.interestIncome.lineItems, "income");
  processInterestItems(ba300Output.interestExpense.lineItems, "expense");

  // Build NII by class.
  const byInstrumentClass: Ba610DetailNiiByClass[] = ORDERED_CLASSES.map((cls) => {
    const b = mustGet(classBuckets, cls, "classBuckets");
    return {
      instrumentClass: cls,
      interestIncomeMinor: b.interestIncome,
      interestExpenseMinor: b.interestExpense,
      netInterestIncomeMinor: b.interestIncome - b.interestExpense,
      lineItems: b.lines,
    };
  });

  // Build NII by band.
  const byMaturityBand: Ba610DetailNiiByBand[] = ORDERED_BANDS.map((band) => {
    const b = mustGet(bandBuckets, band, "bandBuckets");
    return {
      maturityBand: band,
      interestIncomeMinor: b.interestIncome,
      interestExpenseMinor: b.interestExpense,
      netInterestIncomeMinor: b.interestIncome - b.interestExpense,
      volumeMinor: b.volume,
      lineItems: b.lines,
    };
  });

  const totalInterestIncomeMinor = ba300Output.interestIncome.totalMinor;
  const totalInterestExpenseMinor = ba300Output.interestExpense.totalMinor;
  const totalNiiMinor = ba300Output.netInterestIncomeMinor;

  const niiBreakdown: Ba610DetailNiiBreakdown = {
    totalInterestIncomeMinor,
    totalInterestExpenseMinor,
    totalNetInterestIncomeMinor: totalNiiMinor,
    byInstrumentClass,
    byMaturityBand,
    bandingGaps: [...bandingGaps].sort(),
  };

  // ---------------------------------------------------------------------------
  // ALM banding section
  // ---------------------------------------------------------------------------

  const almTotalVolume = byMaturityBand.reduce((s, b) => s + b.volumeMinor, 0);

  const almBanding: Ba610DetailAlmBandingSection = {
    totalVolumeMinor: almTotalVolume,
    totalNetInterestIncomeMinor: totalNiiMinor,
    bands: byMaturityBand,
  };

  // ---------------------------------------------------------------------------
  // NIM section
  // ---------------------------------------------------------------------------

  const aea = averageEarningAssetsMinor;
  const overallNim = aea > 0 ? totalNiiMinor / aea : null;
  const overallNimBpsVal = nimBps(overallNim);

  // FTP-based client/structural split.
  let clientNimTotal: number | null = null;
  let structuralNimTotal: number | null = null;

  const nimByBand = ORDERED_BANDS.map((band) => {
    const bData = mustGet(bandBuckets, band, "bandBuckets");
    const bandNii = bData.interestIncome - bData.interestExpense;
    const bandVolume = bData.volume;
    const bandNim = bandVolume > 0 ? bandNii / bandVolume : null;

    let clientNim: number | null = null;
    let structuralNim: number | null = null;

    if (ftpRates !== null) {
      const ftpEntry = ftpRates.find((r) => r.maturityBand === band);
      if (ftpEntry && bandVolume > 0) {
        const ftpRate = ftpEntry.ftpRateBps / 10_000;
        // Structural NIM = FTP rate portion; client NIM = residual.
        structuralNim = ftpRate;
        clientNim = bandNim !== null ? bandNim - structuralNim : null;
      }
    }

    return {
      maturityBand: band,
      nim: bandNim,
      nimBps: nimBps(bandNim),
      clientNim,
      structuralNim,
      volumeMinor: bandVolume,
    };
  });

  if (ftpRates !== null && aea > 0) {
    // Aggregate client/structural NIM: weighted by per-band volume.
    let weightedClientNii = 0;
    let weightedStructuralNii = 0;
    let volumeWithFtp = 0;
    for (const b of nimByBand) {
      if (b.clientNim !== null && b.structuralNim !== null && b.volumeMinor > 0) {
        weightedClientNii += b.clientNim * b.volumeMinor;
        weightedStructuralNii += b.structuralNim * b.volumeMinor;
        volumeWithFtp += b.volumeMinor;
      }
    }
    if (volumeWithFtp > 0) {
      clientNimTotal = weightedClientNii / volumeWithFtp;
      structuralNimTotal = weightedStructuralNii / volumeWithFtp;
    }
  }

  const nimSection: Ba610DetailNimSection = {
    overallNim,
    overallNimBps: overallNimBpsVal,
    averageEarningAssetsMinor: aea,
    clientNim: clientNimTotal,
    structuralNim: structuralNimTotal,
    byBand: nimByBand,
  };

  // ---------------------------------------------------------------------------
  // Non-interest income section — lifted from BA 610 output.
  // ---------------------------------------------------------------------------

  const feeMinor = ba300Output.feeIncome.totalMinor;
  const tradingMinor = ba300Output.tradingProfitLoss.totalMinor;
  const otherIncomeMinor = ba300Output.otherIncome.totalMinor;
  const otherExpenseMinor = ba300Output.otherExpenses.totalMinor;
  const totalNonInterestIncome = feeMinor + tradingMinor + otherIncomeMinor - otherExpenseMinor;

  const nonInterestLineItems: Ba610DetailLineItem[] = [
    ...ba300Output.feeIncome.lineItems.map((item) =>
      ba300LineToLineItem(item, "ba310.fee", item.amountMinor, ccy),
    ),
    ...ba300Output.tradingProfitLoss.lineItems.map((item) =>
      ba300LineToLineItem(item, "ba310.trading", item.amountMinor, ccy),
    ),
    ...ba300Output.otherIncome.lineItems.map((item) =>
      ba300LineToLineItem(item, "ba310.other-income", item.amountMinor, ccy),
    ),
    ...ba300Output.otherExpenses.lineItems.map((item) =>
      ba300LineToLineItem(item, "ba310.other-expense", item.amountMinor, ccy),
    ),
  ];

  const nonInterestSection: Ba610DetailNonInterestSection = {
    feeIncomeMinor: feeMinor,
    tradingProfitLossMinor: tradingMinor,
    otherIncomeMinor,
    otherExpenseMinor,
    totalNonInterestIncomeMinor: totalNonInterestIncome,
    lineItems: nonInterestLineItems,
  };

  // ---------------------------------------------------------------------------
  // Operating efficiency section.
  // ---------------------------------------------------------------------------

  const opExpMinor = ba300Output.operatingExpenses.totalMinor;
  const totalOpIncome =
    totalNiiMinor + feeMinor + tradingMinor + otherIncomeMinor - otherExpenseMinor;
  const cir = totalOpIncome !== 0 ? opExpMinor / totalOpIncome : null;

  const efficiencySection: Ba610DetailEfficiencySection = {
    costToIncomeRatio: cir,
    costToIncomePercent: cir !== null ? formatPercent(cir) : null,
    operatingExpensesMinor: opExpMinor,
    totalOperatingIncomeMinor: totalOpIncome,
  };

  // ---------------------------------------------------------------------------
  // Aggregate lineItems list (top-level convenience — all Ba610Detail line items).
  // ---------------------------------------------------------------------------

  const allLineItems: Ba610DetailLineItem[] = [
    ...byInstrumentClass.flatMap((c) => c.lineItems),
    ...nonInterestLineItems,
  ];

  // Dedup by lineId — class + band sections may produce duplicates when the
  // same account contributes to both (they share the same contributing account
  // but different lineId prefixes). No dedup needed here since class vs band
  // use different prefixes.

  // ---------------------------------------------------------------------------
  // Placeholders
  // ---------------------------------------------------------------------------

  const placeholders: string[] = [];
  if (bandingGaps.size > 0) {
    placeholders.push(
      `[citation: TBC — BA 610 detail: ${bandingGaps.size} interest-income/expense lines have no banding-map entry; pending ALM cashflow engine (Ravi) producing contractual maturity bands]`,
    );
  }
  if (ftpRates === null) {
    placeholders.push(
      "[citation: TBC — BA 610 detail: FTP rates not supplied; client NIM vs structural NIM split deferred; Ravi's IRRBB FTP engine downstream]",
    );
  }
  placeholders.push(
    "[citation: TBC — exact SARB BA 610 detail line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
  );
  placeholders.push(
    "[citation: TBC — BA 610 detail: no real loan book at build-phase; NII by instrument class has FX-spot activity only; synthetic fixtures cover interbank/corporate/sovereign/retail slots]",
  );
  placeholders.push(
    "[citation: TBC — BA 610 detail: averageEarningAssetsMinor is caller-supplied fixture at v0; Ravi's ALM cashflow engine produces this from contractual cash-flow schedules]",
  );

  // Classification gaps: union of BA 610 classification gaps (forwarded) and
  // banding gaps (BA 610 detail-specific).
  const classificationGaps: string[] = [
    ...ba300Output.classificationGaps.map((g) => g.leafAccountId),
    ...[...bandingGaps].filter(
      (id) => !ba300Output.classificationGaps.some((g) => g.leafAccountId === id),
    ),
  ].sort();

  return {
    meta: {
      form: "BA 120 detail",
      formVersion: "v0.1-rehearsal",
      entity: ba300Output.meta.entity,
      periodStart: ba300Output.meta.periodStart,
      periodEnd: ba300Output.meta.periodEnd,
      periodId: ba300Output.meta.periodId,
      functionalCurrency: ccy,
      generatorVersion: "v0.1",
      ...(input.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
        : {}),
      ba300ClassificationsFingerprint: ba300Output.meta.classificationsFingerprint,
      bandingMapFingerprint: fingerprintBandingMap(bandingMap),
    },
    netInterestIncome: niiBreakdown,
    almBanding,
    netInterestMargin: nimSection,
    nonInterestIncome: nonInterestSection,
    operatingEfficiency: efficiencySection,
    lineItems: allLineItems,
    classificationGaps,
    periodStart: ba300Output.meta.periodStart,
    periodEnd: ba300Output.meta.periodEnd,
    entity: ba300Output.meta.entity,
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "WS-FINANCE-BA-RETURNS-QUINTET",
      "Banks Act 94 of 1990 §75",
      "Regulations Relating to Banks Reg 32",
      "BCBS IRRBB §26",
      "IAS 1 §82–§87 — Statement of Comprehensive Income",
    ],
    placeholders,
  };
}
