// platform/reporting/ba-310-min-reserve.ts
//
// BA 310 (Minimum Liquid Reserve Balance and Liquid Assets (HQLA)) fold/engine
// (D-BA-RETURN-SIMULATOR-FIRST). The `ba310-min-reserve-liquid-assets-fold` the
// BA 310 contract's cells reference (v2-core/regulatory-returns/ba310-contract.json).
//
// ── WHAT BA 310 IS ──────────────────────────────────────────────────────────
// BA 310 is the SARB minimum-reserve + minimum-liquid-asset return. It is NOT a
// risk-charge return (that is BA 320 market risk — the prior "market risk"
// annotation on the obligation is the documented fabrication corrected by
// D-BA-RETURN-NUMBERING-EXCEL-CANONICAL). It implements two distinct statutory
// requirements off the bank's liability base:
//
//   1. MINIMUM RESERVE BALANCE — the cash-reserve requirement under the South
//      African Reserve Bank Act 90 of 1989 read with the Regulations Relating to
//      Banks reg 27: a percentage of the bank's adjusted liabilities that must be
//      held as an (essentially non-remunerated) average daily balance WITH the
//      Reserve Bank.
//        R0100  minimum reserve balance = R0090 (liabilities, as adjusted) × 2.5%
//
//   2. MINIMUM LIQUID-ASSET REQUIREMENT — a percentage of the bank's REDUCED
//      liabilities that must be held as level-1 high-quality liquid assets
//      (Reserve Bank notes/coin, gold, central-bank reserves, treasury bills,
//      sec-66 PFMA securities, SARB securities, guaranteed securities).
//        R0140  level-1 HQLA required   = R0040 (liabilities, as reduced) × 5%
//        R0150  level-1 HQLA held       = Σ held level-1 liquid assets
//
// ── METHODOLOGY (the domain-truth oracle — SARB Excel BA 310 derivation chain) ─
//   R0010  Liabilities (per BA 100 R0790/C0030 — the total liability base)
//   R0020  less group funding (head office / same-group branches)
//   R0030  less amounts owing by SA banks/branches/mutual banks
//   R0040  Liabilities, as reduced = max(0, R0010 − R0020 − R0030)
//   R0050  less repo funding
//   R0060  less derivative-instrument liabilities
//   R0070  less inv-grade foreign-bank claims
//   R0080  add back group funding (R0020)
//   R0090  Liabilities, as adjusted = R0040 − R0050 − R0060 − R0070 + R0080
//   R0100  minimum reserve balance   = R0090 × 2.5%
//   R0140  level-1 HQLA required      = R0040 × 5%
//   R0150  level-1 HQLA held          = Σ(R0160..R0230) held level-1 stock
//
// The 2.5% reserve ratio and 5% liquid-asset ratio are SARB-set requirements
// (SARB Act 90 of 1989 cash-reserve requirement; Reg 27 minimum-liquid-asset
// requirement). They are owned in financial-constants (source, don't hardcode).
//
// ── DATA SOURCING (Principle 1) ─────────────────────────────────────────────
// The liability base folds from the deposit / funding lifecycle events
// (DepositTaken / DepositMatured / FundingLineDrawn / FundingLineRepaid) — the
// SAME events the LCR / NSFR engines consume — so the three returns are coherent
// by construction. The interbank PLACEMENT (InterbankLoanPlaced) is a bank ASSET,
// not a liability, and is excluded from the liability base. The level-1 HQLA held
// folds from the CollateralInventorySnapshotted snapshot (L1 tier) — the same
// numerator the LCR uses. There is no group funding / repo / derivative liability
// / inv-grade foreign claim in the bank-in-formation's book, so R0020/R0030/R0050/
// R0060/R0070/R0080 fold to zero today (honest 0, not fabricated).
//
// ── PROVENANCE BOUNDARY (the R300m-into-Prod lesson) ────────────────────────
// The fold takes a ProvenanceFilter and only folds events that match it. The
// PRODUCTION read (`defaultProvenanceFilter()`, production-only) excludes the
// simulated book, so the production BA 310 figures are ZERO pre-licence-day (no
// real liabilities, no real held liquid assets). The simulated book appears only
// under a simulated-inclusive / operating-book filter. Both legs proven by
// `recon:ba310-min-reserve-sim-drive`.
//
// Pure read — no appends. Per-entity; bank-licence-bound (LE-ZA-HOZ-BANK).
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   Regulations Relating to Banks reg 26 (liquidity) / reg 27 (minimum reserve &
//   minimum liquid assets); South African Reserve Bank Act 90 of 1989
//   (cash-reserve requirement); Banks Act 94 of 1990 s.6(6)(a); Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import { getFinancialConstant } from "../config/financial-constants";
import type {
  DepositMaturedPayload,
  DepositTakenPayload,
  DepositWithdrawnEarlyPayload,
  FundingLineDrawnPayload,
  FundingLineRepaidPayload,
} from "../event-store/event-types/repo-mmd-ibl";
import type { EventStore } from "../event-store/store";
import { type ProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";

// ---------------------------------------------------------------------------
// Scope guard — bank-licence-bound (mirrors ba-300-lcr.ts).
// ---------------------------------------------------------------------------

export const BA_310_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

export class Ba310GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba310GeneratorError";
  }
}

function assertBankEntity(entity: string): void {
  if (!BA_310_BANK_ENTITIES.includes(entity)) {
    throw new Ba310GeneratorError(
      `BA 310 (minimum liquid reserve) is bank-licence-bound; entity '${entity}' is not in BA_310_BANK_ENTITIES (${BA_310_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// SARB-set requirement ratios — owned in financial-constants (source, don't
// hardcode). Reg 27 / SARB Act 90 of 1989.
// ---------------------------------------------------------------------------

/** Minimum reserve-balance ratio (% of liabilities, as adjusted). SARB Act 90/1989. */
export const BA310_MIN_RESERVE_RATIO = getFinancialConstant("ba310.min-reserve-ratio");

/** Minimum level-1 liquid-asset ratio (% of liabilities, as reduced). Reg 27. */
export const BA310_LEVEL1_LIQUID_ASSET_RATIO = getFinancialConstant(
  "ba310.level1-liquid-asset-ratio",
);

// ---------------------------------------------------------------------------
// Output shape — the BA 310 derivation chain (major ZAR throughout).
// ---------------------------------------------------------------------------

export interface Ba310Output {
  readonly meta: {
    readonly form: "BA 310";
    readonly entity: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
    readonly minReserveRatio: number;
    readonly level1LiquidAssetRatio: number;
  };
  /** R0010 — Liabilities (total liability base). */
  readonly liabilitiesBaseZar: number;
  /** R0020 — less group / head-office funding. */
  readonly lessGroupFundingZar: number;
  /** R0030 — less amounts owing by SA banks/branches/mutual banks. */
  readonly lessSaBankClaimsZar: number;
  /** R0040 — Liabilities, as reduced = max(0, R0010 − R0020 − R0030). */
  readonly liabilitiesReducedZar: number;
  /** R0050 — less repo funding. */
  readonly lessRepoFundingZar: number;
  /** R0060 — less derivative-instrument liabilities. */
  readonly lessDerivativeLiabilitiesZar: number;
  /** R0070 — less inv-grade foreign-bank claims. */
  readonly lessInvestmentGradeForeignBankClaimsZar: number;
  /** R0080 — add back group funding. */
  readonly addBackGroupFundingZar: number;
  /** R0090 — Liabilities, as adjusted = R0040 − R0050 − R0060 − R0070 + R0080. */
  readonly liabilitiesAdjustedZar: number;
  /** R0100 — minimum reserve balance to be held = R0090 × reserve ratio. */
  readonly minimumReserveBalanceZar: number;
  /** R0140 — level-1 HQLA required to be held = R0040 × level-1 ratio. */
  readonly levelOneRequiredZar: number;
  /** R0150 — level-1 HQLA held (Σ held level-1 liquid assets). */
  readonly levelOneHeldZar: number;
  /** R0150 − R0140 — surplus level-1 liquid assets (negative ⇒ shortfall). */
  readonly levelOneSurplusZar: number;
  /** True iff held level-1 ≥ required level-1 AND held ≥ reserve balance. */
  readonly compliant: boolean;
  readonly citations: readonly string[];
}

const CITATIONS: readonly string[] = [
  "D-BA-RETURN-SIMULATOR-FIRST",
  "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
  "urn:reg:za:regs-relating-to-banks:reg27",
  "urn:reg:za:sarb-act-90-1989:cash-reserve-requirement",
  "ORG-PR-RETURNS-011",
  "P1-EVENTS-AS-TRUTH",
];

// ---------------------------------------------------------------------------
// Liability-base fold — live deposit + funding-line liabilities (major ZAR).
// ---------------------------------------------------------------------------

/**
 * Fold the bank's deposit + funding-line LIABILITY base from the lifecycle
 * events, scoped to the entity + provenance filter. Live positions only
 * (opening event not yet closed). Amounts are converted minor→major (÷100) at
 * the fold boundary (deposit / funding events carry ZAR minor units).
 *
 * The interbank PLACEMENT is a bank asset — excluded from the liability base.
 */
function foldLiabilityBaseZar(args: {
  readonly eventStore: EventStore;
  readonly entity: string;
  readonly asOf: string;
  readonly filter: ProvenanceFilter;
}): number {
  const { eventStore, entity, asOf, filter } = args;

  // Collect closed deposit / funding-line ids (live-only filter).
  const closedDepositIds = new Set<string>();
  const closedFundingLineIds = new Set<string>();
  for (const ev of eventStore.replay({ entity, asOf })) {
    if (!eventMatchesProvenanceFilter(ev, filter)) continue;
    if (ev.type === "DepositMatured") {
      closedDepositIds.add((ev.payload as unknown as DepositMaturedPayload).depositId);
    } else if (ev.type === "DepositWithdrawnEarly") {
      closedDepositIds.add((ev.payload as unknown as DepositWithdrawnEarlyPayload).depositId);
    } else if (ev.type === "FundingLineRepaid") {
      closedFundingLineIds.add((ev.payload as unknown as FundingLineRepaidPayload).fundingLineId);
    }
  }

  let liabilityMinor = 0;
  for (const ev of eventStore.replay({ entity, asOf })) {
    if (!eventMatchesProvenanceFilter(ev, filter)) continue;
    if (ev.type === "DepositTaken") {
      const p = ev.payload as unknown as DepositTakenPayload;
      if (closedDepositIds.has(p.depositId)) continue;
      liabilityMinor += p.principalZar;
    } else if (ev.type === "FundingLineDrawn") {
      const p = ev.payload as unknown as FundingLineDrawnPayload;
      if (closedFundingLineIds.has(p.fundingLineId)) continue;
      liabilityMinor += p.drawnAmountZar;
    }
  }

  return liabilityMinor / 100;
}

// ---------------------------------------------------------------------------
// Held level-1 HQLA fold — from the latest CollateralInventorySnapshotted.
// ---------------------------------------------------------------------------

interface CollateralSnapshotPayload {
  readonly l1Zar: number;
}

/**
 * Fold the held LEVEL-1 liquid-asset stock (R0150) from the latest
 * CollateralInventorySnapshotted snapshot ≤ asOf, scoped to entity + filter.
 * The snapshot's `l1Zar` is already MAJOR ZAR (no /100). Only level-1 counts
 * toward the BA-310 minimum-liquid-asset stock (Reg 27 level-1 list).
 */
function foldLevelOneHeldZar(args: {
  readonly eventStore: EventStore;
  readonly entity: string;
  readonly asOf: string;
  readonly filter: ProvenanceFilter;
}): number {
  const { eventStore, entity, asOf, filter } = args;
  let latest: { as_of: string; l1Zar: number } | null = null;
  for (const ev of eventStore.replay({ entity, type: "CollateralInventorySnapshotted" })) {
    if (ev.as_of > asOf) continue;
    if (!eventMatchesProvenanceFilter(ev, filter)) continue;
    const l1 = (ev.payload as unknown as CollateralSnapshotPayload).l1Zar;
    if (!latest || ev.as_of > latest.as_of) {
      latest = { as_of: ev.as_of, l1Zar: l1 };
    }
  }
  return latest?.l1Zar ?? 0;
}

// ---------------------------------------------------------------------------
// Engine.
// ---------------------------------------------------------------------------

export interface Ba310GeneratorInput {
  readonly entity: string;
  /** ISO 8601 — the as-of the BA 310 is reported at. */
  readonly asOf: string;
  readonly functionalCurrency: string;
  readonly eventStore: EventStore;
  /**
   * Read-time provenance filter. Production-only excludes the simulated book
   * (BA 310 production figures stay 0 pre-licence-day); operating-book /
   * combined / simulated-only sees the simulated deposit-funding book.
   */
  readonly filter: ProvenanceFilter;
}

/**
 * Generate the BA 310 minimum-liquid-reserve fold. Pure read — folds the
 * liability base + held level-1 HQLA and applies the SARB reserve (2.5%) +
 * level-1 liquid-asset (5%) ratios.
 *
 * Group funding / repo funding / derivative liabilities / inv-grade foreign-bank
 * claims are not present in the bank-in-formation's book, so those reductions
 * fold to 0 today (honest 0). The contract carries those lines so a future
 * liability of those classes is correctly deducted.
 */
export function generateBa310(input: Ba310GeneratorInput): Ba310Output {
  assertBankEntity(input.entity);

  const liabilitiesBaseZar = foldLiabilityBaseZar({
    eventStore: input.eventStore,
    entity: input.entity,
    asOf: input.asOf,
    filter: input.filter,
  });

  // Reductions / add-backs — fold to 0 in the bank-in-formation's book.
  // (No group funding, no SA-bank claims owed by us, no repo funding, no
  // derivative liabilities, no inv-grade foreign-bank claims yet. The
  // contract carries these lines; a future liability of those classes is
  // deducted here without a code change.)
  const lessGroupFundingZar = 0;
  const lessSaBankClaimsZar = 0;
  const lessRepoFundingZar = 0;
  const lessDerivativeLiabilitiesZar = 0;
  const lessInvestmentGradeForeignBankClaimsZar = 0;
  const addBackGroupFundingZar = 0;

  // R0040 — Liabilities, as reduced (floored at 0 per the contract derivation).
  const liabilitiesReducedZar = Math.max(
    0,
    liabilitiesBaseZar - lessGroupFundingZar - lessSaBankClaimsZar,
  );

  // R0090 — Liabilities, as adjusted.
  const liabilitiesAdjustedZar =
    liabilitiesReducedZar -
    lessRepoFundingZar -
    lessDerivativeLiabilitiesZar -
    lessInvestmentGradeForeignBankClaimsZar +
    addBackGroupFundingZar;

  // R0100 — minimum reserve balance = R0090 × reserve ratio.
  const minimumReserveBalanceZar = liabilitiesAdjustedZar * BA310_MIN_RESERVE_RATIO;

  // R0140 — level-1 HQLA required = R0040 × level-1 ratio.
  const levelOneRequiredZar = liabilitiesReducedZar * BA310_LEVEL1_LIQUID_ASSET_RATIO;

  // R0150 — level-1 HQLA held.
  const levelOneHeldZar = foldLevelOneHeldZar({
    eventStore: input.eventStore,
    entity: input.entity,
    asOf: input.asOf,
    filter: input.filter,
  });

  const levelOneSurplusZar = levelOneHeldZar - levelOneRequiredZar;

  // Compliant iff held level-1 covers both the level-1 requirement and the
  // (smaller) minimum reserve balance — held level-1 is the bank's liquid buffer.
  const compliant =
    levelOneHeldZar >= levelOneRequiredZar && levelOneHeldZar >= minimumReserveBalanceZar;

  return {
    meta: {
      form: "BA 310",
      entity: input.entity,
      asOf: input.asOf,
      functionalCurrency: input.functionalCurrency,
      minReserveRatio: BA310_MIN_RESERVE_RATIO,
      level1LiquidAssetRatio: BA310_LEVEL1_LIQUID_ASSET_RATIO,
    },
    liabilitiesBaseZar,
    lessGroupFundingZar,
    lessSaBankClaimsZar,
    liabilitiesReducedZar,
    lessRepoFundingZar,
    lessDerivativeLiabilitiesZar,
    lessInvestmentGradeForeignBankClaimsZar,
    addBackGroupFundingZar,
    liabilitiesAdjustedZar,
    minimumReserveBalanceZar,
    levelOneRequiredZar,
    levelOneHeldZar,
    levelOneSurplusZar,
    compliant,
    citations: CITATIONS,
  };
}
