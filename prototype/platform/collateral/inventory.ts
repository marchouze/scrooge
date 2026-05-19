// platform/collateral/inventory.ts
//
// Collateral inventory projection — reads event-store positions and maintains
// a collateral position register with HQLA classification and cap checks.
//
// Reads: TradeBooked, TradeSettled events → extracts security positions.
// Computes:
//   - Per-security: HQLA level, haircut, haircut-adjusted market value ZAR.
//   - Total HQLA buffer = Σ(haircut-adjusted MV) for L1 + L2a + L2b.
//   - L2 cap: L2 ≤ 40% of total HQLA (if breached → l2CapBreached: true).
//   - L2b cap: L2b ≤ 15% of total HQLA (if breached → l2bCapBreached: true).
//
// Build-phase note: zero real positions → all totals are zero.
// Authority: BA 325 Annex 1; Banks Act Reg 26.
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import { type HQLAClassification, type SecurityDescriptor, classifyHQLA } from "./hqla-classifier";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollateralPosition {
  /** ISIN / security identifier */
  isin: string;
  description: string;
  /** Face value (nominal) in the security's native currency */
  faceValue: number;
  /** Market value in ZAR */
  marketValueZar: number;
  hqlaLevel: HQLAClassification["level"];
  haircut: number;
  /** marketValueZar × (1 - haircut) */
  haircutAdjustedValueZar: number;
  currency: string;
  eligibilityRationale: string;
}

export interface CollateralInventoryResult {
  asOf: string;
  positions: CollateralPosition[];
  /** Sum of haircut-adjusted MV for L1 positions */
  l1Zar: number;
  /** Sum of haircut-adjusted MV for L2a positions */
  l2aZar: number;
  /** Sum of haircut-adjusted MV for L2b positions */
  l2bZar: number;
  /** Total HQLA buffer = l1Zar + l2aZar + l2bZar */
  totalHQLAZar: number;
  /** L2 = l2aZar + l2bZar. Breached if > 40% of totalHQLAZar. */
  l2CapBreached: boolean;
  /** L2b. Breached if > 15% of totalHQLAZar. */
  l2bCapBreached: boolean;
  currency: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawPosition {
  isin: string;
  description: string;
  faceValue: number;
  marketValueZar: number;
  currency: string;
}

/**
 * Attempt to extract security position from a TradeBooked or TradeSettled payload.
 * Returns null if the payload does not describe a security position.
 */
function extractPosition(type: string, payload: Record<string, unknown>): RawPosition | null {
  // Only process trade events that carry security position data
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

  const description =
    typeof payload.description === "string"
      ? payload.description
      : typeof payload.instrumentName === "string"
        ? payload.instrumentName
        : isin;

  return { isin, description, faceValue, marketValueZar, currency };
}

/**
 * Build a SecurityDescriptor from the raw position for HQLA classification.
 * Uses heuristics on ISIN prefix and payload fields if available.
 */
function buildDescriptor(raw: RawPosition, payload: Record<string, unknown>): SecurityDescriptor {
  const assetClass = ((): SecurityDescriptor["assetClass"] => {
    const ac = typeof payload.assetClass === "string" ? payload.assetClass : "";
    if (ac === "sovereign-bond") return "sovereign-bond";
    if (ac === "corporate-bond") return "corporate-bond";
    if (ac === "equity") return "equity";
    if (ac === "covered-bond") return "covered-bond";
    if (ac === "cash") return "cash";
    // Heuristic from ISIN prefix: ZAG = SA government bond, ZAE = JSE equity
    if (raw.isin.startsWith("ZAG")) return "sovereign-bond";
    if (raw.isin.startsWith("ZAE")) return "equity";
    return "other";
  })();

  const creditRating = typeof payload.creditRating === "string" ? payload.creditRating : undefined;
  const riskWeight = typeof payload.riskWeight === "number" ? payload.riskWeight : undefined;

  return {
    isin: raw.isin,
    issuer: typeof payload.issuer === "string" ? payload.issuer : "unknown",
    assetClass,
    creditRating,
    riskWeight,
    currency: raw.currency,
    residualMaturityDays:
      typeof payload.residualMaturityDays === "number" ? payload.residualMaturityDays : undefined,
  };
}

// ---------------------------------------------------------------------------
// Pure computation (testable without event store)
// ---------------------------------------------------------------------------

/**
 * Compute HQLA totals and cap checks from a set of already-classified positions.
 * Extracted as a pure function so tests can verify computation without event store.
 */
export function computeInventoryTotals(
  asOf: string,
  positions: CollateralPosition[],
): CollateralInventoryResult {
  let l1Zar = 0;
  let l2aZar = 0;
  let l2bZar = 0;

  for (const pos of positions) {
    if (pos.hqlaLevel === "L1") l1Zar += pos.haircutAdjustedValueZar;
    else if (pos.hqlaLevel === "L2a") l2aZar += pos.haircutAdjustedValueZar;
    else if (pos.hqlaLevel === "L2b") l2bZar += pos.haircutAdjustedValueZar;
  }

  const totalHQLAZar = l1Zar + l2aZar + l2bZar;
  const l2TotalZar = l2aZar + l2bZar;
  const l2CapBreached = totalHQLAZar > 0 && l2TotalZar / totalHQLAZar > 0.4;
  const l2bCapBreached = totalHQLAZar > 0 && l2bZar / totalHQLAZar > 0.15;

  return {
    asOf,
    positions,
    l1Zar,
    l2aZar,
    l2bZar,
    totalHQLAZar,
    l2CapBreached,
    l2bCapBreached,
    currency: "ZAR",
  };
}

// ---------------------------------------------------------------------------
// Main projection function
// ---------------------------------------------------------------------------

/**
 * Build the collateral inventory as of `asOf`.
 *
 * Reads TradeBooked + TradeSettled events from the event store.
 * Aggregates positions by ISIN (last-event-wins for market value).
 * Classifies each position using the HQLA classifier.
 * Returns cap-checked totals.
 *
 * Build phase: zero trades → zero positions, zero HQLA buffer.
 */
export function getCollateralInventory(asOf: string): CollateralInventoryResult {
  // Aggregate positions by ISIN (latest trade event wins)
  const positionMap = new Map<string, { raw: RawPosition; payload: Record<string, unknown> }>();

  for (const event of eventStore.replay({ type: "TradeBooked" })) {
    if (event.as_of > asOf) continue;
    const payload = event.payload as Record<string, unknown>;
    const raw = extractPosition(event.type, payload);
    if (!raw) continue;
    positionMap.set(raw.isin, { raw, payload });
  }

  for (const event of eventStore.replay({ type: "TradeSettled" })) {
    if (event.as_of > asOf) continue;
    const payload = event.payload as Record<string, unknown>;
    const raw = extractPosition(event.type, payload);
    if (!raw) continue;
    // TradeSettled may update the market value — always overwrite
    positionMap.set(raw.isin, { raw, payload });
  }

  // Build classified positions
  const positions: CollateralPosition[] = [];

  for (const { raw, payload } of positionMap.values()) {
    const descriptor = buildDescriptor(raw, payload);
    const classification = classifyHQLA(descriptor);
    const haircutAdjustedValueZar = raw.marketValueZar * (1 - classification.haircut);

    positions.push({
      isin: raw.isin,
      description: raw.description,
      faceValue: raw.faceValue,
      marketValueZar: raw.marketValueZar,
      hqlaLevel: classification.level,
      haircut: classification.haircut,
      haircutAdjustedValueZar,
      currency: raw.currency,
      eligibilityRationale: classification.eligibilityRationale,
    });
  }

  return computeInventoryTotals(asOf, positions);
}
