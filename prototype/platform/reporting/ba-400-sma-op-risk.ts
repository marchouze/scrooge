// platform/reporting/ba-400-sma-op-risk.ts
//
// BA 400 (Operational Risk) — SMA (Standardised Measurement Approach) engine.
//
// ── DOMAIN TRUTH: SMA SUPERSEDES BIA / TSA ──────────────────────────────────
// The CURRENT SARB BA 400 form (XSD element BA12000000+, SARB PA Directive
// D5/2025 §2.1.18, rows R0050–R0500) is structured entirely around the SMA:
// the Business Indicator (BI), its three components (ILDC / SC / FC), the
// Business Indicator Component (BIC), the Loss Component (LC), the Internal
// Loss Multiplier (ILM), and Operational Risk Capital / RWA. The legacy BIA
// (α=15% × average positive gross income, bcbs128 §645) and TSA (β by business
// line, §652) are SUPERSEDED at the SARB transition — the legacy
// platform/reporting/ba-400-op-risk.ts engine's own forward-link flagged this.
// This engine implements the SMA per OPE25 (BCBS SCO consolidated standard).
//
// ── SMA ARITHMETIC (OPE25) ──────────────────────────────────────────────────
//
//   Business Indicator (BI) = ILDC + SC + FC   (OPE25 §25.2, three-year average)
//
//     ILDC = Min(|InterestIncome − InterestExpense|, 0.0225 × InterestEarningAssets)
//            + DividendIncome                                       (OPE25 §25.3)
//     SC   = Max(OtherOpIncome, OtherOpExpense)
//            + Max(FeeIncome, FeeExpense)                           (OPE25 §25.4)
//     FC   = |Net P&L Trading Book| + |Net P&L Banking Book|        (OPE25 §25.5)
//
//   Business Indicator Component (BIC) — marginal coefficients by bucket
//   (OPE25 §25.6, Table; thresholds in the SARB-functional currency):
//     Bucket 1: BI ≤ T1            → 12% × BI
//     Bucket 2: T1 < BI ≤ T2       → 12% × T1 + 15% × (BI − T1)
//     Bucket 3: BI > T2            → 12% × T1 + 15% × (T2 − T1) + 18% × (BI − T2)
//
//   Internal Loss Multiplier (ILM) — OPE25 §25.7:
//     ILM = Ln( e − 1 + (LC / BIC)^0.8 )
//   where LC = 15 × (10-year average annual operational-risk losses). National
//   discretion (OPE25 §25.8): supervisors may set ILM = 1 for all banks (e.g.
//   no qualifying loss history). PRE-LICENCE the bank has NO loss history, so
//   ILM = 1 (BA 400 row R0010 "Are losses used to calculate the ILM" = No). The
//   loss-driven ILM path is a Phase-B follow-on (needs the loss-event stream;
//   BA 410 / BA 420). This engine drives the ILM=1 path and surfaces the
//   loss-driven path as a tracked gap, never a silent assumption.
//
//   Operational Risk Capital (ORC)        = BIC × ILM
//   Operational Risk-Weighted Assets      = 12.5 × ORC   (Reg 38; RWA = 12.5 × charge)
//
// ── PURE PROJECTION ──────────────────────────────────────────────────────────
// Inputs are caller-supplied (the adapter folds them from the
// OperatingIncomeStatementSnapshotted event). No event-store side-effects. All
// money on the decimal engine (no float on a money figure; HALF_UP at the
// rounding boundary). Per-entity; bank-licence-bound (LE-ZA-HOZ-BANK).
//
// Authority:
//   - D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26)
//   - D-CAPITAL-ASSET-CLASS-V1 (the BA 700 capital-ratio capstone this feeds)
//   - OPE25 / BCBS SCO (SMA); SARB Reg 33 revised; SARB PA D5/2025 §2.1.18
//   - Regulations Relating to Banks Reg 38 (RWA = 12.5 × capital requirement)
//   - Principle 1; Principle 5
//
// Authors: Atlas (Core banking platform architect, engineering); op-risk
//   methodology owner Helena (Chief Risk Officer, governance); BA-form line
//   mapping Bea (Accounting & financial reporting engineer, engineering).

import {
  type DecimalValue,
  absD,
  addD,
  cmpD,
  mulD,
  roundDecimal,
  subD,
  toCanonicalString,
  toDecimal,
  toMinorUnits,
} from "../core/decimal-engine";
import { type MoneyWire, decodeMoney } from "../core/money-codec";

// ---------------------------------------------------------------------------
// SMA regulatory constants — OPE25 (sourced, not invented).
// ---------------------------------------------------------------------------

/** ILDC net-interest-income cap as a fraction of interest-earning assets. OPE25 §25.3. */
const ILDC_NII_CAP_FRACTION = "0.0225";

/** BIC marginal coefficients by bucket. OPE25 §25.6 Table. */
const BIC_COEFFICIENT_BUCKET_1 = "0.12";
const BIC_COEFFICIENT_BUCKET_2 = "0.15";
const BIC_COEFFICIENT_BUCKET_3 = "0.18";

/** RWA = 12.5 × capital requirement (reciprocal of the 8% minimum). Reg 38. */
const RWA_PER_CAPITAL_CHARGE = "12.5";

/**
 * Default SMA bucket thresholds, in the SARB-functional currency (ZAR).
 *
 * OPE25 §25.6 sets Bucket-1 ≤ EUR 1bn and Bucket-2 ≤ EUR 30bn. SARB applies the
 * thresholds in the functional currency; the precise ZAR conversion is a SARB
 * Reg 33-revision parameter (`smaBucketThresholdsMajor` overridable by the
 * caller). The conservative build-phase default uses a ZAR ≈ EUR×20 placeholder
 * (1bn EUR → R20bn; 30bn EUR → R600bn). It is surfaced as a tracked input
 * parameter — NEVER silently load-bearing — and the build-phase simulated bank
 * sits well inside Bucket 1, so the result is independent of the exact threshold
 * (the 12% marginal coefficient applies to the whole BI). Authority: OPE25
 * §25.6; SARB Reg 33 revised (threshold-conversion parameter tracked).
 */
export const DEFAULT_SMA_BUCKET_THRESHOLDS_MAJOR: SmaBucketThresholdsMajor = {
  bucket1MaxMajor: "20000000000", // R20,000,000,000 (≈ EUR 1bn placeholder)
  bucket2MaxMajor: "600000000000", // R600,000,000,000 (≈ EUR 30bn placeholder)
};

export interface SmaBucketThresholdsMajor {
  /** Upper bound of Bucket 1 (12% marginal), MAJOR-unit decimal string. */
  readonly bucket1MaxMajor: string;
  /** Upper bound of Bucket 2 (15% marginal), MAJOR-unit decimal string. */
  readonly bucket2MaxMajor: string;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * The SMA income-statement component inputs (the 3-year-average BI inputs).
 * Every field is decimal-native MoneyWire (MAJOR units). These are the absolute
 * income-statement magnitudes; the engine applies the OPE25 abs / max / cap
 * arithmetic (single derivation site).
 */
export interface Ba400SmaInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank. */
  readonly entity: string;
  /** ISO 8601 — period-end as-of date. */
  readonly asOf: string;
  /** Period identifier. */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;

  // ILDC inputs
  readonly interestIncome: MoneyWire;
  readonly interestExpense: MoneyWire;
  readonly interestEarningAssets: MoneyWire;
  readonly dividendIncome: MoneyWire;
  // SC inputs
  readonly feeIncome: MoneyWire;
  readonly feeExpense: MoneyWire;
  readonly otherOperatingIncome: MoneyWire;
  readonly otherOperatingExpense: MoneyWire;
  // FC inputs
  readonly netPnlTradingBook: MoneyWire;
  readonly netPnlBankingBook: MoneyWire;

  /**
   * Loss Component (LC) = 15 × 10-year-average annual op-risk losses, MAJOR-unit
   * decimal string. OMITTED pre-licence (no loss history) → ILM is forced to 1
   * (OPE25 §25.8 national discretion; BA 400 R0010 = "No"). Supplying it drives
   * the loss-sensitive ILM = Ln(e − 1 + (LC/BIC)^0.8). Phase-B follow-on.
   */
  readonly lossComponentMajor?: string;

  /** Optional SMA bucket thresholds override (defaults to the build-phase ZAR set). */
  readonly bucketThresholds?: SmaBucketThresholdsMajor;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type SmaBucket = "bucket-1" | "bucket-2" | "bucket-3";

export interface Ba400SmaOutput {
  readonly meta: {
    readonly form: "BA 400";
    readonly approach: "sma";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
  };
  /** Interest, Lease and Dividend Component (ILDC), minor units. Form R0350. */
  readonly ildcMinor: number;
  /** Whether the NII was capped at 2.25% × interest-earning-assets (OPE25 §25.3). */
  readonly ildcNiiCapped: boolean;
  /** Services Component (SC), minor units. Form R0360. */
  readonly scMinor: number;
  /** Financial Component (FC), minor units. Form R0370. */
  readonly fcMinor: number;
  /** Business Indicator (BI) = ILDC + SC + FC, minor units. Form R0380. */
  readonly biMinor: number;
  /** The bucket the BI falls in. Form R0390. */
  readonly bucket: SmaBucket;
  /** Business Indicator Component (BIC), minor units. Form R0400. */
  readonly bicMinor: number;
  /** Loss Component (LC), minor units (0 when no loss history). Form R0430. */
  readonly lcMinor: number;
  /** Internal Loss Multiplier (ILM). Form R0440. 1 when no loss history. */
  readonly ilm: string;
  /** Whether losses were used to compute the ILM (BA 400 R0010). */
  readonly lossesUsedForIlm: boolean;
  /** Operational Risk Capital (ORC) = BIC × ILM, minor units. Form R0450/R0460. */
  readonly opRiskCapitalMinor: number;
  /** Operational Risk-Weighted Assets = 12.5 × ORC, minor units. Form R0490. */
  readonly opRiskRwaMinor: number;
  readonly citations: readonly string[];
  /** Tracked gaps — never silent. */
  readonly gaps: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba400SmaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba400SmaError";
  }
}

export const BA_400_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_400_BANK_ENTITIES.includes(entity)) {
    throw new Ba400SmaError(
      `BA 400 (operational risk) is bank-licence-bound; entity '${entity}' is not in BA_400_BANK_ENTITIES (${BA_400_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode a MoneyWire to a decimal, asserting the currency matches the functional ccy. */
function amt(wire: MoneyWire, ccy: string, label: string): DecimalValue {
  const m = decodeMoney(wire);
  if (m.currency !== ccy) {
    throw new Ba400SmaError(
      `BA 400 SMA: ${label} currency '${m.currency}' ≠ functional currency '${ccy}'. Cross-currency BI aggregation is a licence-day refinement; all components must be functional-denominated for the build-phase fold.`,
    );
  }
  return toDecimal(m.amount);
}

function maxD(a: DecimalValue, b: DecimalValue): DecimalValue {
  return cmpD(a, b) >= 0 ? a : b;
}

function minD(a: DecimalValue, b: DecimalValue): DecimalValue {
  return cmpD(a, b) <= 0 ? a : b;
}

/** Round a decimal (functional MAJOR units) to integer minor units (cents, scale 2). */
function toMinor(d: DecimalValue): number {
  const rounded = roundDecimal(d, 2, "HALF_UP");
  return Number(toMinorUnits(rounded, 2));
}

// ---------------------------------------------------------------------------
// SMA engine
// ---------------------------------------------------------------------------

export function generateBa400Sma(input: Ba400SmaInput): Ba400SmaOutput {
  assertBankEntity(input.entity);
  const ccy = input.functionalCurrency;
  if (!ccy || ccy.length !== 3) {
    throw new Ba400SmaError(
      `BA 400 SMA: functionalCurrency must be ISO-4217 (3 chars), got '${ccy}'`,
    );
  }
  const gaps: string[] = [];

  // --- BI components (OPE25 §25.3–§25.5) ---
  const ii = amt(input.interestIncome, ccy, "interestIncome");
  const ie = amt(input.interestExpense, ccy, "interestExpense");
  const iea = amt(input.interestEarningAssets, ccy, "interestEarningAssets");
  const di = amt(input.dividendIncome, ccy, "dividendIncome");

  // ILDC = Min(|II − IE|, 2.25% × IEA) + DividendIncome.
  const nii = absD(subD(ii, ie));
  const niiCap = mulD(toDecimal(ILDC_NII_CAP_FRACTION), iea);
  const cappedNii = minD(nii, niiCap);
  const ildcNiiCapped = cmpD(nii, niiCap) > 0;
  const ildc = addD(cappedNii, di);

  // SC = Max(OOI, OOE) + Max(FI, FE).
  const fi = amt(input.feeIncome, ccy, "feeIncome");
  const fe = amt(input.feeExpense, ccy, "feeExpense");
  const ooi = amt(input.otherOperatingIncome, ccy, "otherOperatingIncome");
  const ooe = amt(input.otherOperatingExpense, ccy, "otherOperatingExpense");
  const sc = addD(maxD(ooi, ooe), maxD(fi, fe));

  // FC = |trading-book P&L| + |banking-book P&L|.
  const tpl = amt(input.netPnlTradingBook, ccy, "netPnlTradingBook");
  const bpl = amt(input.netPnlBankingBook, ccy, "netPnlBankingBook");
  const fc = addD(absD(tpl), absD(bpl));

  // Business Indicator.
  const bi = addD(addD(ildc, sc), fc);

  // --- BIC (OPE25 §25.6 marginal coefficients) ---
  const thresholds = input.bucketThresholds ?? DEFAULT_SMA_BUCKET_THRESHOLDS_MAJOR;
  const t1 = toDecimal(thresholds.bucket1MaxMajor);
  const t2 = toDecimal(thresholds.bucket2MaxMajor);
  if (cmpD(t2, t1) <= 0) {
    throw new Ba400SmaError(
      `BA 400 SMA: bucket-2 threshold (${thresholds.bucket2MaxMajor}) must exceed bucket-1 threshold (${thresholds.bucket1MaxMajor}).`,
    );
  }

  const c1 = toDecimal(BIC_COEFFICIENT_BUCKET_1);
  const c2 = toDecimal(BIC_COEFFICIENT_BUCKET_2);
  const c3 = toDecimal(BIC_COEFFICIENT_BUCKET_3);

  let bic: DecimalValue;
  let bucket: SmaBucket;
  if (cmpD(bi, t1) <= 0) {
    bucket = "bucket-1";
    bic = mulD(c1, bi);
  } else if (cmpD(bi, t2) <= 0) {
    bucket = "bucket-2";
    bic = addD(mulD(c1, t1), mulD(c2, subD(bi, t1)));
  } else {
    bucket = "bucket-3";
    bic = addD(addD(mulD(c1, t1), mulD(c2, subD(t2, t1))), mulD(c3, subD(bi, t2)));
  }

  // --- ILM (OPE25 §25.7–§25.8) ---
  // Pre-licence: no loss history → ILM = 1 (national discretion, BA 400 R0010 = No).
  // The loss-driven ILM = Ln(e − 1 + (LC/BIC)^0.8) needs the 10-year loss stream
  // (Phase-B: BA 410 / BA 420) — surfaced as a tracked gap, never assumed.
  const lossesUsedForIlm = input.lossComponentMajor !== undefined;
  let lc = toDecimal("0");
  let ilm = toDecimal("1");
  if (lossesUsedForIlm && input.lossComponentMajor !== undefined) {
    lc = toDecimal(input.lossComponentMajor);
    // ILM = ln(e − 1 + (LC/BIC)^0.8). Guard BIC=0 (then ILM stays 1 by convention).
    if (cmpD(bic, toDecimal("0")) > 0) {
      const ratio = Number(toCanonicalString(lc)) / Number(toCanonicalString(bic));
      const ilmNum = Math.log(Math.E - 1 + ratio ** 0.8);
      // ILM is a multiplier (not a money figure) — bounded scalar, rounded to 6dp.
      ilm = roundDecimal(toDecimal(ilmNum.toFixed(6)), 6, "HALF_UP");
    }
  } else {
    gaps.push(
      "GAP-BA400-ILM-LOSS-DRIVEN: ILM is forced to 1 (OPE25 §25.8 national discretion; BA 400 R0010 = No — no qualifying loss history pre-licence-day). The loss-sensitive ILM = Ln(e − 1 + (LC/BIC)^0.8) requires the 10-year operational-loss stream (Phase-B: BA 410 / BA 420 loss-event returns). Surfaced, never silently assumed. Authority: OPE25 §25.7–§25.8; D-BA-RETURN-SIMULATOR-FIRST.",
    );
  }

  // --- ORC + op-RWA ---
  const orc = mulD(bic, ilm);
  const opRwa = mulD(toDecimal(RWA_PER_CAPITAL_CHARGE), orc);

  return {
    meta: {
      form: "BA 400",
      approach: "sma",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: ccy,
    },
    ildcMinor: toMinor(ildc),
    ildcNiiCapped,
    scMinor: toMinor(sc),
    fcMinor: toMinor(fc),
    biMinor: toMinor(bi),
    bucket,
    bicMinor: toMinor(bic),
    lcMinor: toMinor(lc),
    ilm: toCanonicalString(ilm),
    lossesUsedForIlm,
    opRiskCapitalMinor: toMinor(orc),
    opRiskRwaMinor: toMinor(opRwa),
    citations: [
      "D-BA-RETURN-SIMULATOR-FIRST",
      "D-CAPITAL-ASSET-CLASS-V1",
      "urn:reg:bcbs:ope25",
      "urn:reg:za:regs-relating-to-banks:reg33",
      "urn:reg:za:regs-relating-to-banks:reg38",
      "SARB PA Directive D5/2025 §2.1.18 (BA 400)",
    ],
    gaps,
  };
}
