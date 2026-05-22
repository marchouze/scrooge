// platform/markets/cdm/dcam-actus-mapping.ts
//
// DCAM Layer 1-3 taxonomy for ACTUS contract types.
//
// Maps each ACTUS Financial Research Foundation contract type to the EDM
// Council DCAM three-layer classification architecture adopted for product
// families in `platform/markets/products/dcam-mapping.ts`. This extends the
// DCAM taxonomy to the instrument level, enabling classification of individual
// FinancialInstrument records as well as product families.
//
// Design:
//   - DCAM Layer 1: top-level asset category (aligned to FIBO conceptual layer)
//   - DCAM Layer 2: asset sub-category (CDM/ESMA-CFI/BCBS logical standard)
//   - DCAM Layer 3: specific instrument type (ISO 20022 / bank classification code)
//   - cdmReference: canonical CDM path for the ACTUS contract type
//   - isoInstrumentType: ISO 10962 CFI category code (2 uppercase letters)
//
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
// Architecture: DCAM three-layer model per PR #377 (D-MARKETS-SCHEMA-FOUNDATION).
// Principle 2 (single-graph discipline): every ACTUS contract type has a citable
// DCAM classification node in the regulatory knowledge graph.
//
// Author: Anya (Data / analytics engineer, engineering) per D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

// ---------------------------------------------------------------------------
// ActusDcamEntry interface
// ---------------------------------------------------------------------------

/**
 * DCAM three-layer classification record for a single ACTUS contract type.
 *
 * Follows the same Layer 1→2→3 hierarchy as ProductFamilyDcamLayer3 in
 * `platform/markets/products/dcam-mapping.ts`, extended with CDM reference
 * and ISO CFI category code for regulatory reporting completeness.
 */
export interface ActusDcamEntry {
  /** ACTUS contract type code (PAM, STK, IRS, etc.). */
  readonly actusContractType: string;
  /** DCAM Layer 1 — top-level asset category (FIBO conceptual anchor). */
  readonly dcamLayer1: string;
  /** DCAM Layer 2 — asset sub-category (CDM/ESMA-CFI/BCBS logical standard). */
  readonly dcamLayer2: string;
  /** DCAM Layer 3 — specific instrument type classification. */
  readonly dcamLayer3: string;
  /** Canonical CDM path for this contract type. */
  readonly cdmReference: string;
  /**
   * ISO 10962 Classification of Financial Instruments (CFI) category code.
   * Two uppercase letters: first = asset category, second = group.
   * Examples: DB = Debt, Bearer; ES = Equity, Registered; DW = Derivatives, swap.
   */
  readonly isoInstrumentType: string;
  /** Human-readable description of the instrument type. */
  readonly description: string;
}

// ---------------------------------------------------------------------------
// ACTUS → DCAM mapping table
//
// One entry per ACTUS contract type in the bank's opening product set.
// Ordered as in actusContractTypeSchema (instrument.ts): PAM, STK, IRS,
// FXOUT, CLM, CSH, ZCB, CMP.
// ---------------------------------------------------------------------------

export const ACTUS_DCAM_MAPPING: readonly ActusDcamEntry[] = [
  {
    actusContractType: "PAM",
    dcamLayer1: "Financial Instruments",
    dcamLayer2: "Debt Instruments",
    dcamLayer3: "Fixed-Rate Bond",
    cdmReference: "cdm.base.staticdata.asset.common.DebtTypeEnum.FIXED_RATE",
    isoInstrumentType: "DB", // Debt, Bearer
    description: "Principal-at-maturity fixed-rate bond or fixed deposit",
  },
  {
    actusContractType: "STK",
    dcamLayer1: "Financial Instruments",
    dcamLayer2: "Equity",
    dcamLayer3: "Listed Equity",
    cdmReference: "cdm.base.staticdata.asset.common.EquityTypeEnum.EQUITY",
    isoInstrumentType: "ES", // Equity, Registered
    description: "Listed equity share on regulated exchange",
  },
  {
    actusContractType: "IRS",
    dcamLayer1: "Financial Instruments",
    dcamLayer2: "Derivatives",
    dcamLayer3: "Interest Rate Swap",
    cdmReference: "cdm.product.asset.InterestRatePayout",
    isoInstrumentType: "DW", // Derivatives, swap
    description: "Interest rate swap (compositional; fixed/floating legs)",
  },
  {
    actusContractType: "FXOUT",
    dcamLayer1: "Financial Instruments",
    dcamLayer2: "Derivatives",
    dcamLayer3: "FX Outright",
    cdmReference: "cdm.product.asset.FxSingle",
    isoInstrumentType: "DW", // Derivatives, swap
    description: "FX spot or forward outright contract",
  },
  {
    actusContractType: "CLM",
    dcamLayer1: "Financial Instruments",
    dcamLayer2: "Money-Market",
    dcamLayer3: "Call Money / Demand Deposit",
    cdmReference: "cdm.base.staticdata.asset.common.MoneyMarketTypeEnum",
    isoInstrumentType: "MM", // Money market, term
    description: "Nostro account or demand deposit (callable)",
  },
  {
    actusContractType: "CSH",
    dcamLayer1: "Financial Instruments",
    dcamLayer2: "Cash",
    dcamLayer3: "Central Bank Reserves",
    cdmReference: "cdm.base.staticdata.asset.common.CashTypeEnum",
    isoInstrumentType: "CA", // Cash
    description: "Central bank reserves or vault cash",
  },
  {
    actusContractType: "ZCB",
    dcamLayer1: "Financial Instruments",
    dcamLayer2: "Debt Instruments",
    dcamLayer3: "Zero-Coupon Bond",
    cdmReference: "cdm.base.staticdata.asset.common.DebtTypeEnum.ZERO_COUPON",
    isoInstrumentType: "DB", // Debt, Bearer
    description: "Zero-coupon bond or bond strip created by decomposition",
  },
  {
    actusContractType: "CMP",
    dcamLayer1: "Financial Instruments",
    dcamLayer2: "Structured",
    dcamLayer3: "Composite Instrument",
    cdmReference: "cdm.product.template.TradableProduct",
    isoInstrumentType: "SR", // Structured, other
    description: "Composite structured instrument; components not independently tradeable",
  },
];

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

/**
 * Returns the DCAM entry for a given ACTUS contract type, or `undefined`
 * if the contract type is not in the mapping table.
 *
 * Usage:
 *   const entry = getActusDcamEntry("PAM");
 *   // entry.dcamLayer3 === "Fixed-Rate Bond"
 */
export function getActusDcamEntry(actusContractType: string): ActusDcamEntry | undefined {
  return ACTUS_DCAM_MAPPING.find((e) => e.actusContractType === actusContractType);
}
