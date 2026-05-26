// platform/markets/pricing/registry.ts
//
// Pricing-model registry — pure lookup table mapping ProductFamily →
// PricingModelEntry. No event side-effects; no I/O. Feeds NPA dimension
// model-risk (attestation gate) and capital (RWA-delta input).
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10).
// Author: Atlas (substrate authority) · Kai (trading systems engineer, engineering).

import type { ProductFamily } from "../products/types";

export interface PricingModelEntry {
  readonly modelId: string;
  readonly family: ProductFamily;
  readonly tier: "tier-1" | "tier-2" | "tier-3";
  readonly valuationApproach: string;
  readonly curveDependencies: readonly string[];
}

export class PricingModelNotFoundError extends Error {
  constructor(family: string) {
    super(`No pricing model registered for product family: ${family}`);
    this.name = "PricingModelNotFoundError";
  }
}

const REGISTRY = new Map<ProductFamily, PricingModelEntry>([
  [
    "listed-equity",
    {
      modelId: "pm:equity:last-observed-price",
      family: "listed-equity",
      tier: "tier-3",
      valuationApproach:
        "Last observed market price (JSE closing price or intraday quote)",
      curveDependencies: [],
    },
  ],
  [
    "listed-bond",
    {
      modelId: "pm:bond:dirty-price-accrued",
      family: "listed-bond",
      tier: "tier-2",
      valuationApproach:
        "Dirty price + accrued interest (clean price + day-count accrual per ACT/365 SA convention)",
      curveDependencies: ["SAGB-yield-curve"],
    },
  ],
  [
    "repo",
    {
      modelId: "pm:repo:dirty-price-accrued",
      family: "repo",
      tier: "tier-2",
      valuationApproach:
        "Repo rate × notional × day-count fraction (cash-flow-based; no optionality)",
      curveDependencies: ["SAGB-yield-curve"],
    },
  ],
  [
    "otc-ird",
    {
      modelId: "pm:ird:par-swap-dcf",
      family: "otc-ird",
      tier: "tier-1",
      valuationApproach:
        "Par-swap discounted cash-flow (NPV of fixed less floating legs, discounted at JIBAR/ZARONIA OIS curve)",
      curveDependencies: ["JIBAR-3M", "ZARONIA"],
    },
  ],
  [
    "fx",
    {
      modelId: "pm:fx:spot-forward-points",
      family: "fx",
      tier: "tier-2",
      valuationApproach:
        "Spot rate + forward points (interest rate parity; SARB fixing / Twelve Data observable)",
      curveDependencies: ["SARB-fixing", "twelve-data"],
    },
  ],
  [
    "money-market",
    {
      modelId: "pm:mm:yield-to-maturity",
      family: "money-market",
      tier: "tier-3",
      valuationApproach:
        "Yield-to-maturity (simple interest; amortised-cost approximation for short tenors)",
      curveDependencies: [],
    },
  ],
  [
    "interbank-loan",
    {
      modelId: "pm:ibl:yield-to-maturity",
      family: "interbank-loan",
      tier: "tier-3",
      valuationApproach:
        "Yield-to-maturity (simple interest; amortised-cost per IFRS 9 §4.1.2)",
      curveDependencies: [],
    },
  ],
]);

export function lookupPricingModel(family: ProductFamily): PricingModelEntry {
  const entry = REGISTRY.get(family);
  if (!entry) throw new PricingModelNotFoundError(family);
  return entry;
}

/** All registered families — useful for iteration in attestation workflows. */
export const REGISTERED_FAMILIES: readonly ProductFamily[] = [...REGISTRY.keys()];
