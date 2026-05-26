// platform/markets/products/rwa-delta.ts
//
// Per-product marginal RWA estimator.
//
// Wraps the existing computeRwa() engine (platform/risk/rwa-engine.ts)
// to produce a point-estimate of the incremental risk-weighted asset
// impact of adding one unit of a given product to the trading book.
// Used by the NPA attestation gate for dimension 9 (capital adequacy)
// and by Helena's CRO sign-off workflow.
//
// Per Principle 1: pure function — no event side-effects. Same input
// always produces same output. Callers are responsible for event emission.
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10).
//            D-REGULATORY-READINESS-GATE-PLAN — RWA engine authority.
// Author: Atlas (substrate) · Rohan (risk systems engineer, engineering).

import { type RwaEngineInput, computeRwa } from "../../risk/rwa-engine";
import type { Product, ProductFamily } from "./types";

// ---------------------------------------------------------------------------
// RWA weights from the capital-funding stub (build-phase)
// ---------------------------------------------------------------------------

import capitalFundingStub from "../regulatory/capital-funding-stub.json" with { type: "json" };

const RWA_WEIGHT_BY_INSTRUMENT_CLASS = capitalFundingStub.rwa.rwaWeightByInstrumentClass as Record<
  string,
  number
>;

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

/**
 * Point-estimate of the incremental RWA impact of one product unit.
 * All monetary values in minor units (cents).
 */
export interface RwaDeltaOutput {
  /** Stable product URN (prd:bank:...). */
  readonly productId: string;
  /** Product family discriminator. */
  readonly family: ProductFamily;
  /** Reference notional used for the estimation (minor units). */
  readonly referenceNotionalMinor: number;
  /**
   * Marginal credit RWA in minor units.
   * Zero for products with creditRiskShape = "no-counterparty".
   */
  readonly creditRwaDeltaMinor: number;
  /** Marginal market RWA in minor units (12.5 × notional × marketRiskWeight). */
  readonly marketRwaDeltaMinor: number;
  /** Total marginal RWA = creditRwaDeltaMinor + marketRwaDeltaMinor. */
  readonly totalRwaDeltaMinor: number;
  /**
   * Estimated impact on Capital Adequacy Ratio expressed in basis points.
   * Computed as: (totalRwaDeltaMinor / TIER1_TARGET_MINOR) × 10000
   * where TIER1_TARGET_MINOR is the build-phase R300bn tier-1 capital
   * target (R300bn × 100 to convert to minor units).
   * This is an orientation figure only; the live CAR impact depends on
   * the entity's actual CET1 stack at the time of booking.
   */
  readonly estimatedCarImpactBps: number;
  /** Engine version tag — always "v0.1" at this revision. */
  readonly engineVersion: "v0.1";
  /** Principle 2 citations. */
  readonly citations: readonly string[];
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Thrown when computeProductRwaDelta() is called for an entity outside
 * the bank-licence-bound perimeter. Only "LE-ZA-HOZ-BANK" is in scope
 * at v0.1 (mirrors the RWA engine's own entity guard).
 */
export class RwaDeltaEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RwaDeltaEngineError";
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bank-licence-bound entity in scope at v0.1. */
const BANK_ENTITY_ID = "LE-ZA-HOZ-BANK";

/**
 * Build-phase tier-1 capital target in minor units (cents).
 * R300bn = R300,000,000,000 × 100 cents = 30,000,000,000,000 minor units.
 * Used only for orientation — the live CAR uses the actual capital stack.
 */
const TIER1_TARGET_MINOR = 30_000_000_000_00;

const CITATIONS: readonly string[] = [
  "D-REGULATORY-READINESS-GATE-PLAN",
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "Reg38-CRE20",
];

// ---------------------------------------------------------------------------
// Instrument-class → RWA weight resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the market-risk weight for a product based on its family and
 * marketRiskDimensions, using the capital-funding stub weights.
 *
 * Mapping rules (per brief):
 * - dimensions include "curve" or "basis" AND family is "otc-ird" → "interest-rate"
 * - dimensions include "delta" AND family is "fx"                 → "fx"
 * - dimensions include "delta" AND family is "listed-equity"      → "equity"
 * - family is "listed-bond" or "repo"                            → "interest-rate"
 * - default                                                       → "interest-rate", weight 0.08
 */
function resolveMarketRiskWeight(product: Product): {
  riskType: "interest-rate" | "fx" | "equity";
  weight: number;
} {
  const dims = product.riskProfile.marketRiskDimensions;
  const family = product.family;

  if ((dims.includes("curve") || dims.includes("basis")) && family === "otc-ird") {
    return {
      riskType: "interest-rate",
      weight: RWA_WEIGHT_BY_INSTRUMENT_CLASS["OTC-IRD"] ?? 0.5,
    };
  }

  if (dims.includes("delta") && family === "fx") {
    return {
      riskType: "fx",
      weight: RWA_WEIGHT_BY_INSTRUMENT_CLASS["FX-spot"] ?? 0.2,
    };
  }

  if (dims.includes("delta") && family === "listed-equity") {
    return {
      riskType: "equity",
      weight: RWA_WEIGHT_BY_INSTRUMENT_CLASS["JSE-EQUITY"] ?? 0.35,
    };
  }

  if (family === "listed-bond" || family === "repo") {
    return {
      riskType: "interest-rate",
      weight: RWA_WEIGHT_BY_INSTRUMENT_CLASS["ZA-GOV-BOND"] ?? 0.0,
    };
  }

  // Conservative fallback — documented per brief
  return {
    riskType: "interest-rate",
    weight: 0.08,
  };
}

// ---------------------------------------------------------------------------
// Credit RWA delta resolver
// ---------------------------------------------------------------------------

/**
 * Compute the marginal credit RWA contribution for a given product and
 * reference notional, based on the product's creditRiskShape.
 *
 * Mapping rules (per brief):
 * - "no-counterparty"            → 0
 * - "principal-on-settlement"    → 20% of notional × 0.75 (bank unrated, CRE20)
 * - "ongoing-bilateral-exposure" → 50% of notional × 0.75 (CCR bilateral)
 */
function resolveCreditRwaDelta(
  creditRiskShape: Product["riskProfile"]["creditRiskShape"],
  referenceNotionalMinor: number,
): number {
  switch (creditRiskShape) {
    case "no-counterparty":
      return 0;

    case "principal-on-settlement":
      // EAD approximation: 20% of notional (intraday settlement exposure CCF).
      // Risk weight: 0.75 (bank counterparty, unrated, SCRA Grade B per CRE20).
      return Math.round(referenceNotionalMinor * 0.2 * 0.75);

    case "ongoing-bilateral-exposure":
      // EAD approximation: 50% of notional (bilateral CCR exposure; mark-to-market
      // replacement cost not yet modelled at v0.1).
      // Risk weight: 0.75 (bank counterparty, unrated, SCRA Grade B per CRE20).
      return Math.round(referenceNotionalMinor * 0.5 * 0.75);
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Compute the per-product marginal RWA delta for a reference notional.
 *
 * This wraps computeRwa() from the RWA engine with a single-position /
 * single-exposure input constructed from the product's risk profile.
 * The result is deterministic and has no side-effects.
 *
 * @param product                 The Product to estimate RWA for.
 * @param referenceNotionalMinor  Notional in minor units (e.g. 100_000_00 = R100,000).
 * @param entityId                Legal entity. Defaults to "LE-ZA-HOZ-BANK".
 *                                Any other value throws RwaDeltaEngineError.
 * @param asOf                    Valuation date (YYYY-MM-DD). Defaults to
 *                                wall-clock today. Pass an explicit date for
 *                                deterministic scenarios.
 *
 * @throws {RwaDeltaEngineError}  If entityId is not "LE-ZA-HOZ-BANK".
 */
export function computeProductRwaDelta(
  product: Product,
  referenceNotionalMinor: number,
  entityId: string = BANK_ENTITY_ID,
  asOf?: string,
): RwaDeltaOutput {
  if (entityId !== BANK_ENTITY_ID) {
    throw new RwaDeltaEngineError(
      `RwaDelta engine: capital-adequacy estimation is bank-licence-bound; entity '${entityId}' is not in scope. Only '${BANK_ENTITY_ID}' is supported at v0.1. See D-REGULATORY-READINESS-GATE-PLAN + D-PRODUCT-CONSTRUCTION-SUBSTRATE.`,
    );
  }

  const { riskType, weight: marketRiskWeight } = resolveMarketRiskWeight(product);
  const creditRwaDeltaMinor = resolveCreditRwaDelta(
    product.riskProfile.creditRiskShape,
    referenceNotionalMinor,
  );

  // Build a minimal RwaEngineInput with a single trading-book position and
  // a single credit exposure (if applicable). Operational risk is zeroed
  // (build-phase; the marginal operational impact of one product is
  // negligible and not modelled at v0.1).
  const engineInput: RwaEngineInput = {
    entityId: BANK_ENTITY_ID,
    asOf: asOf ?? new Date().toISOString().slice(0, 10), // wall-clock: default; inject asOf for deterministic scenarios
    functionalCurrency: product.currency,
    creditExposures:
      creditRwaDeltaMinor > 0
        ? [
            {
              counterpartyId: "rwa-delta-synthetic",
              counterpartyType: "bank",
              eadMinor: (() => {
                // Back-derive the EAD from the credit delta to stay consistent.
                // principal-on-settlement: EAD = 20% of notional
                // ongoing-bilateral-exposure: EAD = 50% of notional
                const shape = product.riskProfile.creditRiskShape;
                if (shape === "principal-on-settlement") {
                  return Math.round(referenceNotionalMinor * 0.2);
                }
                return Math.round(referenceNotionalMinor * 0.5);
              })(),
              currency: product.currency,
              ratingBucket: "unrated",
              residualMaturity: "long-term",
            },
          ]
        : [],
    tradingBookPositions: [
      {
        positionId: `rwa-delta-${product.productId}`,
        riskType,
        notionalMinor: referenceNotionalMinor,
        currency: product.currency,
        side: "long",
        marketRiskWeight,
      },
    ],
    businessIndicator: {
      ildcMinor: 0,
      scMinor: 0,
      fcMinor: 0,
      eurToFunctionalRate: 20_00, // ~R20/€ build-phase rate; operational RWA zeroed anyway
      ilm: 1,
    },
  };

  const engineOutput = computeRwa(engineInput);

  const marketRwaDeltaMinor = engineOutput.market.totalMinor;
  const totalRwaDeltaMinor = creditRwaDeltaMinor + marketRwaDeltaMinor;

  // estimatedCarImpactBps = (totalRwaDeltaMinor / TIER1_TARGET_MINOR) × 10000
  // TIER1_TARGET_MINOR = R300bn in minor units (build-phase capital target).
  // Round to 2 decimal places for orientation.
  const estimatedCarImpactBps =
    Math.round((totalRwaDeltaMinor / TIER1_TARGET_MINOR) * 10000 * 100) / 100;

  return {
    productId: product.productId,
    family: product.family,
    referenceNotionalMinor,
    creditRwaDeltaMinor,
    marketRwaDeltaMinor,
    totalRwaDeltaMinor,
    estimatedCarImpactBps,
    engineVersion: "v0.1",
    citations: CITATIONS,
  };
}
