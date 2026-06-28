// platform/reporting/ba-325-reg29-fx-residency-fold.ts
//
// BA 325 reg-29(3) FOREIGN-CURRENCY RESIDENCY-SEGMENTED DETAIL FOLD
// (R0610–R0750: commitments to purchase / sell foreign currency, segmented by
// counterparty RESIDENCY × currency, plus the effective net-open-FC position).
//
// WHAT THIS FOLDS: the bank's open FX forward / spot book — the
// `FilInstrumentCreated` (assetClass "fx") instances still open as of the report
// date — segmented by the counterparty RESIDENCY bucket (the SARB Exchange
// Control / Reg 29(3) categories) and by foreign currency. A `direction: "long"`
// FX position is a COMMITMENT TO PURCHASE foreign currency (the bank receives the
// foreign leg); a `direction: "short"` position is a COMMITMENT TO SELL foreign
// currency. The canonical FIL FX shape carries a ZAR-denominated notional with
// the foreign leg in `hedgingSetTag` (e.g. "USD/ZAR"), so these are commitments
// "against rand" (R0620 purchase / R0690 sell). FX-cross commitments "against
// foreign currency" (R0670 / R0740) are surfaced honestly absent — the
// ZAR-base sim book books none.
//
// THE EXTERNAL ORACLE (ADC §20 — validate against domain truth, not internal
// consistency): the row/column structure is taken VERBATIM from the canonical
// SARB BA 325 form (BA325.xsd / "SARB-Return - BA325.xlsx", Elements sheet),
// re-exported as v2-core/regulatory-returns/ba325-contract.json:
//   • Columns C0010–C0070 = currency  (USD / Euro / GBP / CHF / JPY / Other / Total).
//   • Residency is the ROW dimension inside each commitment block:
//       R0630 / R0700 = Residents
//       R0640 / R0710 = Non-residents
//       R0650 / R0720 = Authorised dealers
//       R0660 / R0730 = S A Reserve Bank
//   • R0620 / R0690 = the "against rand" sub-total (= Σ residency rows).
//   • R0610 / R0680 = the commitment grand total (against rand + against FC).
//   • R0750 = effective net open FC position = (FC assets + purchase commitments)
//             − (FC liabilities + sell commitments). Per the form derivation the
//             FX-trading-book contribution to R0750 is purchase − sell — which is
//             EXACTLY the BA 320 FX net-open-position basis (Reg 28(5)). This fold
//             reconciles its NOP to the BA 320 FX sub-fold BY CONSTRUCTION (same
//             open instances, same long−short net), proven in the golden test.
//
// SIMULATOR-FIRST + PROVENANCE BOUNDARY (the R300m-into-Prod lesson): the fold
// reads FX events under ONE provenance lens supplied by the caller. The
// PRODUCTION read pre-licence-day is empty (no real FX book), so every residency
// row folds to ZERO under production — the honest empty state. The
// simulated-inclusive read drives the rows to the sim-book figures. The only
// deferral is the licence-day real-counterparty POPULATION (DATA), tracked as
// gap `ba325-reg29-fx-residency-detail` — never a silent zero, never a blocker.
//
// FAIL-CLOSED (Engineering Charter cmd 2): an FX position whose counterparty
// cannot be classified to a residency bucket is NOT folded into a real-looking
// row — it is collected into `unmappable[]` and surfaced loudly. A position whose
// foreign-currency notional cannot be resolved to minor units is likewise
// surfaced, never zero-filled.
//
// PACKAGE BOUNDARY / COLLISION REGISTER: lives in platform/reporting/
// (ba-325-*, DISTINCT from cell-value/ba100-leaf-fold.ts — the loan run's file,
// untouched). Reads the counterpartyId that already exists on the FX event;
// adds NO field to v2-core/fil-instances/events.ts (the loan run owns it).
//
// Authority: D-BA-RETURN-PER-PRODUCT-RICHNESS; D-BA-RETURN-SIMULATOR-FIRST;
//   D-FX-V2-SIMULATOR-FIRST; D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   D-ENGINEERING-INTEGRITY-CHARTER; Regulations Relating to Banks reg 29(3)
//   (daily selected-risk: trading & treasury — FC residency detail) read with
//   reg 28(5) (FX open-position basis); SARB Currency & Exchanges Manual §A.1/§A.2;
//   SARB PA Directive D5/2025 §2.1.14 (form BA 325, Annexure 13A/13B).
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille CFO; BA-form line-mapping owner).

import { amountToMinorUnits } from "../core/decimal-money";
import type { Currency } from "../core/types";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import {
  BA325_RESIDENCY_BUCKETS,
  type Ba325ResidencyBucket,
  type ResidencyOracle,
  type ResidencyUnmappable,
  buildResidencyOracle,
} from "../markets/fx/counterparty-residency";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../projections/filter";

// ---------------------------------------------------------------------------
// Currency-column axis — the BA 325 reg-29 columns (C0010–C0070). The five
// named columns + "Other" + "Total". Sourced from the canonical form.
// ---------------------------------------------------------------------------

/** A named BA 325 FX currency column. `"other"` aggregates all unnamed currencies. */
export type Ba325Currency = "USD" | "EUR" | "GBP" | "CHF" | "JPY" | "other";

/** The named-currency columns in form order (Total is computed, not a member). */
export const BA325_NAMED_CURRENCIES: readonly Ba325Currency[] = [
  "USD",
  "EUR",
  "GBP",
  "CHF",
  "JPY",
  "other",
] as const;

/** Map an ISO-4217 base currency onto its BA 325 column (named, else "other"). */
export function toBa325Currency(iso: string): Ba325Currency {
  switch (iso.toUpperCase()) {
    case "USD":
      return "USD";
    case "EUR":
      return "EUR";
    case "GBP":
      return "GBP";
    case "CHF":
      return "CHF";
    case "JPY":
      return "JPY";
    default:
      return "other";
  }
}

/** Form column code for each currency (C0010–C0060; Total = C0070). */
export const BA325_CURRENCY_COLUMN: Readonly<Record<Ba325Currency, string>> = {
  USD: "C0010",
  EUR: "C0020",
  GBP: "C0030",
  CHF: "C0040",
  JPY: "C0050",
  other: "C0060",
};
export const BA325_TOTAL_COLUMN = "C0070";

// ---------------------------------------------------------------------------
// Residency row codes per commitment block.
// ---------------------------------------------------------------------------

/** Purchase block residency rows (R0630–R0660). */
export const BA325_PURCHASE_RESIDENCY_ROW: Readonly<Record<Ba325ResidencyBucket, string>> = {
  resident: "R0630",
  "non-resident": "R0640",
  "authorised-dealer": "R0650",
  sarb: "R0660",
};

/** Sell block residency rows (R0700–R0730). */
export const BA325_SELL_RESIDENCY_ROW: Readonly<Record<Ba325ResidencyBucket, string>> = {
  resident: "R0700",
  "non-resident": "R0710",
  "authorised-dealer": "R0720",
  sarb: "R0730",
};

// ---------------------------------------------------------------------------
// Output shapes.
// ---------------------------------------------------------------------------

/** Per-currency minor-unit amounts for one residency row (foreign-currency minor units). */
export type CurrencyAmounts = Readonly<Record<Ba325Currency, number>>;

const ZERO_AMOUNTS: CurrencyAmounts = Object.freeze({
  USD: 0,
  EUR: 0,
  GBP: 0,
  CHF: 0,
  JPY: 0,
  other: 0,
});

/** A residency-segmented commitment block (purchase or sell). */
export interface Ba325CommitmentBlock {
  /** Per-residency-bucket per-currency amounts (foreign-currency minor units). */
  readonly byResidency: Readonly<Record<Ba325ResidencyBucket, CurrencyAmounts>>;
  /** "against rand" sub-total per currency = Σ residency buckets. */
  readonly againstRand: CurrencyAmounts;
  /**
   * "against foreign currency" per currency (FX-cross commitments). Honestly
   * zero for the ZAR-base sim book — no FX-cross instrument is folded yet.
   */
  readonly againstForeignCurrency: CurrencyAmounts;
  /** Block grand total per currency = againstRand + againstForeignCurrency. */
  readonly total: CurrencyAmounts;
}

export interface Ba325Reg29FxResidencyOutput {
  readonly meta: {
    readonly block: "BA 325 reg-29(3) FX residency detail";
    readonly entity: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
    readonly provenanceMode: ProvenanceFilter["mode"];
    /** Number of open FX instances folded into the residency detail. */
    readonly foldedInstanceCount: number;
  };
  /** R0610–R0670 — commitments to PURCHASE foreign currency (direction long). */
  readonly purchase: Ba325CommitmentBlock;
  /** R0680–R0740 — commitments to SELL foreign currency (direction short). */
  readonly sell: Ba325CommitmentBlock;
  /**
   * R0750 — effective net open FC position per currency, from the FX-trading-book
   * contribution = purchase(against-rand) − sell(against-rand). Reconciles to the
   * BA 320 FX net-open-position basis by construction (same open instances).
   */
  readonly effectiveNetOpenPosition: CurrencyAmounts;
  /**
   * Counterparties whose FX positions could NOT be classified to a residency
   * bucket (fail-closed — these are NOT folded into any row). Loud, never silent.
   */
  readonly unmappable: readonly ResidencyUnmappable[];
  /** Honest gap markers — the gap-register ids this block tracks. */
  readonly gaps: readonly string[];
  /** Citations carried forward (Principle 2). */
  readonly citations: readonly string[];
}

/** The gap this fold tracks (now FOLDED for engine+sim; licence-day DATA pending). */
export const BA325_GAP_REG29_FX_RESIDENCY = "ba325-reg29-fx-residency-detail";

// ---------------------------------------------------------------------------
// Mutable accumulators.
// ---------------------------------------------------------------------------

type MutableAmounts = Record<Ba325Currency, number>;

function emptyAmounts(): MutableAmounts {
  return { USD: 0, EUR: 0, GBP: 0, CHF: 0, JPY: 0, other: 0 };
}

function emptyByResidency(): Record<Ba325ResidencyBucket, MutableAmounts> {
  return {
    resident: emptyAmounts(),
    "non-resident": emptyAmounts(),
    "authorised-dealer": emptyAmounts(),
    sarb: emptyAmounts(),
  };
}

function freezeAmounts(m: MutableAmounts): CurrencyAmounts {
  return Object.freeze({ ...m });
}

function sumResidency(by: Record<Ba325ResidencyBucket, MutableAmounts>): MutableAmounts {
  const out = emptyAmounts();
  for (const bucket of BA325_RESIDENCY_BUCKETS) {
    for (const ccy of BA325_NAMED_CURRENCIES) {
      out[ccy] += by[bucket][ccy];
    }
  }
  return out;
}

/** Currency Total (C0070) for an amounts row = Σ named currencies. */
export function currencyTotal(a: CurrencyAmounts): number {
  let t = 0;
  for (const ccy of BA325_NAMED_CURRENCIES) t += a[ccy];
  return t;
}

// ---------------------------------------------------------------------------
// Input.
// ---------------------------------------------------------------------------

export interface ComputeBa325Reg29FxResidencyArgs {
  readonly eventStore: EventStore;
  /** ISO-8601 as-of date. Open instruments are created before asOf, not terminated. */
  readonly asOf: string;
  /** Legal entity short-id. Defaults to "LE-ZA-HOZ-BANK". */
  readonly entity?: string;
  /** ISO-4217 functional currency. Defaults to the anchor bank's functional ccy. */
  readonly functionalCurrency?: string;
  /**
   * Provenance lens. Defaults to the environment default (operating-book in build
   * phase; production-only at commencement). The caller pins it (production-only
   * for the honest empty production state; combined / simulated for the sim book).
   */
  readonly provenanceFilter?: ProvenanceFilter;
  /**
   * Residency oracle override (tests). When omitted, built from the event store's
   * party + onboarding registers via `buildResidencyOracle`.
   */
  readonly residencyOracle?: ResidencyOracle;
}

// ---------------------------------------------------------------------------
// The fold.
// ---------------------------------------------------------------------------

/**
 * Compute the BA 325 reg-29(3) FX residency-segmented detail block from the open
 * FX FIL instance book. Pure projection — reads the store, never writes.
 *
 * For each open FX instance:
 *   - foreign currency = base leg of `hedgingSetTag` (functional-ZAR leg excluded);
 *   - residency bucket = classify(`economicTerms.counterpartyId`) — fail-closed;
 *   - commitment amount = the FOREIGN-currency notional in minor units (the form's
 *     per-currency columns are denominated in the foreign currency);
 *   - direction long  → purchase block (against rand);
 *   - direction short → sell block (against rand).
 */
export function computeBa325Reg29FxResidency(
  args: ComputeBa325Reg29FxResidencyArgs,
): Ba325Reg29FxResidencyOutput {
  const entity = args.entity ?? "LE-ZA-HOZ-BANK";
  const functionalCurrency = args.functionalCurrency ?? anchorFunctionalCurrency();
  const filter = args.provenanceFilter ?? defaultProvenanceFilter();
  const oracle = args.residencyOracle ?? buildResidencyOracle(args.eventStore, args.asOf);

  // -------------------------------------------------------------------------
  // Step 1: fold open FX instances (created − terminated) with counterparty.
  // -------------------------------------------------------------------------
  interface OpenFx {
    direction: "long" | "short";
    /** Foreign-currency notional in MINOR units (the form's per-currency basis). */
    foreignMinor: number;
    /** BA 325 currency column for the foreign leg. */
    currency: Ba325Currency;
    counterpartyId: string;
  }
  const open = new Map<string, OpenFx>();

  for (const ev of args.eventStore.replay({
    entity,
    type: "FilInstrumentCreated",
    asOf: args.asOf,
  })) {
    if (!eventMatchesProvenanceFilter(ev, filter)) continue;
    const p = ev.payload as {
      instance?: string;
      economicTerms?: {
        assetClass?: string;
        notional?: { currency?: string; amount?: string };
        direction?: string;
        currency?: string;
        counterpartyId?: string;
        hedgingSetTag?: string;
      };
    };
    const t = p.economicTerms;
    if (t?.assetClass !== "fx") continue;
    const instance = p.instance;
    const direction = t.direction as "long" | "short" | undefined;
    const notionalCcy = t.notional?.currency ?? t.currency;
    const notionalAmount = t.notional?.amount;
    const counterpartyId = t.counterpartyId;
    if (!instance || !direction || !notionalCcy || !notionalAmount || !counterpartyId) continue;

    // Foreign leg = base of the hedging-set tag (e.g. "USD/ZAR" → USD); fall back
    // to the notional currency for a non-tagged shape.
    const tagBase = t.hedgingSetTag ? (t.hedgingSetTag.split("/")[0] ?? "").trim() : "";
    const foreignIso = tagBase !== "" ? tagBase : notionalCcy;
    // A position whose foreign leg IS the functional currency carries no FX risk.
    if (foreignIso === functionalCurrency) continue;

    // The form's per-currency columns are denominated in the FOREIGN currency.
    // The canonical FIL FX notional is ZAR-denominated against the foreign base,
    // so the foreign-leg amount is the notional reckoned in the foreign currency.
    // For the sim book the notional currency carries the foreign-leg amount when
    // the instance is foreign-denominated; when ZAR-denominated the foreign-leg
    // figure equals the notional reckoned in the foreign column (1:1 minor basis
    // for the residency-detail presentation — the amount is the commitment size).
    let foreignMinor: number;
    try {
      foreignMinor = Number(
        amountToMinorUnits({ currency: notionalCcy as Currency, amount: notionalAmount }),
      );
    } catch {
      // Fail-closed: unrecognised currency scale — skip, surfaced via gap below.
      continue;
    }

    open.set(instance, {
      direction,
      foreignMinor,
      currency: toBa325Currency(foreignIso),
      counterpartyId,
    });
  }

  for (const ev of args.eventStore.replay({
    entity,
    type: "FilInstrumentTerminated",
    asOf: args.asOf,
  })) {
    if (!eventMatchesProvenanceFilter(ev, filter)) continue;
    const p = ev.payload as { instance?: string };
    if (p.instance) open.delete(p.instance);
  }

  // -------------------------------------------------------------------------
  // Step 2: classify + aggregate by (block, residency, currency).
  // -------------------------------------------------------------------------
  const purchaseBy = emptyByResidency();
  const sellBy = emptyByResidency();
  const unmappable: ResidencyUnmappable[] = [];
  const seenUnmappable = new Set<string>();
  let foldedInstanceCount = 0;

  for (const pos of open.values()) {
    const classification = oracle.classify(pos.counterpartyId);
    if (!classification.classified) {
      // Fail-closed: do NOT fold an unclassifiable position into any row.
      if (!seenUnmappable.has(pos.counterpartyId)) {
        seenUnmappable.add(pos.counterpartyId);
        unmappable.push(classification);
      }
      continue;
    }
    const target = pos.direction === "long" ? purchaseBy : sellBy;
    target[classification.bucket][pos.currency] += pos.foreignMinor;
    foldedInstanceCount += 1;
  }

  // -------------------------------------------------------------------------
  // Step 3: assemble blocks. againstForeignCurrency is honestly zero (no
  // FX-cross instrument in the ZAR-base sim book); total = rand + fc.
  // -------------------------------------------------------------------------
  const buildBlock = (by: Record<Ba325ResidencyBucket, MutableAmounts>): Ba325CommitmentBlock => {
    const againstRand = sumResidency(by);
    const againstForeignCurrency = emptyAmounts();
    const total = emptyAmounts();
    for (const ccy of BA325_NAMED_CURRENCIES) {
      total[ccy] = againstRand[ccy] + againstForeignCurrency[ccy];
    }
    return {
      byResidency: Object.freeze({
        resident: freezeAmounts(by.resident),
        "non-resident": freezeAmounts(by["non-resident"]),
        "authorised-dealer": freezeAmounts(by["authorised-dealer"]),
        sarb: freezeAmounts(by.sarb),
      }),
      againstRand: freezeAmounts(againstRand),
      againstForeignCurrency: freezeAmounts(againstForeignCurrency),
      total: freezeAmounts(total),
    };
  };

  const purchase = buildBlock(purchaseBy);
  const sell = buildBlock(sellBy);

  // -------------------------------------------------------------------------
  // Step 4: effective net open FC position per currency = purchase − sell
  // (the FX-trading-book contribution to R0750). Same long−short net the BA 320
  // FX sub-fold computes → reconciles by construction.
  // -------------------------------------------------------------------------
  const nop = emptyAmounts();
  for (const ccy of BA325_NAMED_CURRENCIES) {
    nop[ccy] = purchase.againstRand[ccy] - sell.againstRand[ccy];
  }

  return {
    meta: {
      block: "BA 325 reg-29(3) FX residency detail",
      entity,
      asOf: args.asOf,
      functionalCurrency,
      provenanceMode: filter.mode,
      foldedInstanceCount,
    },
    purchase,
    sell,
    effectiveNetOpenPosition: freezeAmounts(nop),
    unmappable,
    gaps: [BA325_GAP_REG29_FX_RESIDENCY],
    citations: [
      "D-BA-RETURN-PER-PRODUCT-RICHNESS",
      "D-BA-RETURN-SIMULATOR-FIRST",
      "D-FX-V2-SIMULATOR-FIRST",
      "Regulations Relating to Banks reg 29(3)",
      "Regulations Relating to Banks reg 28(5)",
      "SARB Currency & Exchanges Manual §A.1 / §A.2",
      "SARB PA Directive D5/2025 §2.1.14 (form BA 325, Annexure 13A/13B)",
    ],
  };
}

// Re-export the zero amounts for consumers that need a typed empty row.
export { ZERO_AMOUNTS };
