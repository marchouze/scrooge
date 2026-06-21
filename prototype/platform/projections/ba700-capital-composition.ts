// platform/projections/ba700-capital-composition.ts
//
// BA-700 / BA-100 CAPITAL-COMPOSITION FOLD (D-CAPITAL-ASSET-CLASS-V1).
//
// The own-funds composition — CET1, AT1, Tier 2, Tier 1 = CET1+AT1, Total own
// funds = Tier1+Tier2 — computed as a PURE FOLD over the `capital` asset-class FIL
// instance lifecycle events (FilInstrumentCreated / FilInstrumentAmended /
// FilInstrumentTerminated) through the lifted Capital posting rules in
// `v2-core/posting-rules/capital.ts`, with NO stored `GlPostingEmitted` in the
// capital read path (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
// D-DERIVED-EVENT-IRREDUCIBILITY-TEST).
//
// This is the read-side engine that makes the BA-700 V2 capital numerator
// non-zero: `ba700-v2.ts` previously folded `GlPostingEmitted` for capital-
// classified accounts and ALWAYS got zero (no capital GL rules existed —
// GAP-3E-001). This fold derives the own-funds composition from the primary
// capital FIL events instead.
//
// TIER ATTRIBUTION: each capital FIL instance carries its qualifying-capital tier
// on `economicTerms.qualifyingCapital`; the posting rules carry the tier +
// sub-category onto every leg. The own-funds CREDIT leg (the issuance) increases
// the tier's stock; a redemption DEBIT leg decreases it. The composition sums the
// signed net per tier (credit-positive convention for own funds, a credit-side
// balance).
//
// MULTI-CURRENCY: the composition is reported in the entity's functional currency.
// A leg whose currency differs from the functional currency is excluded from the
// summed composition (the cross-currency own-funds translation is a licence-day
// refinement — tracked, not silently mixed). The build-phase anchor capital is ZAR.
//
// PROVENANCE: applies the same `defaultProvenanceFilter` as the GL fold —
// EXCEPT the caller may opt to include simulated events (the R300m injection sim
// is `provenance.kind:"simulated"`, so the demonstration path includes them
// explicitly; the production projection excludes them).
//
// BOUNDARY: v1-side projection (`platform/`) — MAY import from `v2-core/`.
//
// Authority: D-CAPITAL-ASSET-CLASS-V1; D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD;
//   urn:reg:za:regs-relating-to-banks:reg38; Banks Act 94 of 1990 §70;
//   urn:reg:bcbs:rbc:20.2; urn:reg:bcbs:rbc:30.2; D5/2025 §2.1.3 (form BA 100);
//   Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type {
  FilCapitalSubCategory,
  FilCapitalTier,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../v2-core/fil-instances/events";
import {
  type CapitalPostingLeg,
  postCapitalIssuanceLegs,
  postCapitalRedemptionLegs,
} from "../../v2-core/posting-rules/capital";
import { isCapitalPostingInstance } from "../../v2-core/posting-rules/capital";
import { amountToMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "./filter";

// ---------------------------------------------------------------------------
// Output shape — the own-funds composition (minor units, functional currency).
// ---------------------------------------------------------------------------

/** One own-funds sub-category line (BA-100 line render). */
export interface CapitalCompositionLine {
  readonly tier: FilCapitalTier;
  readonly subCategory: FilCapitalSubCategory;
  /** Net own-funds stock for this sub-category in minor units (credit-positive). */
  readonly amountMinor: number;
}

export interface CapitalComposition {
  readonly functionalCurrency: string;
  /** Per-(tier, sub-category) own-funds lines, sorted for deterministic render. */
  readonly lines: readonly CapitalCompositionLine[];
  /** CET1 own funds (paid-up shares + premium + retained earnings + OCI), minor units. */
  readonly cet1Minor: number;
  /** AT1 own funds (perpetual non-cumulative), minor units. */
  readonly at1Minor: number;
  /** Tier 2 own funds (subordinated debt + qualifying provisions), minor units. */
  readonly tier2Minor: number;
  /** Tier 1 = CET1 + AT1, minor units (Reg 38(8) / BCBS RBC20.2). */
  readonly tier1Minor: number;
  /** Total own funds = Tier 1 + Tier 2, minor units. */
  readonly totalOwnFundsMinor: number;
  /** Count of capital FIL legs folded (0 ⇒ no capital instruments). */
  readonly legCount: number;
}

// ---------------------------------------------------------------------------
// The minimal FIL lifecycle payload the fold reads off each event.
// ---------------------------------------------------------------------------

interface CapitalFilEvent {
  readonly type: string;
  readonly payload: unknown;
}

interface FilLifecyclePayloadMinimal {
  readonly kind?: string;
  readonly type?: string;
}

// ---------------------------------------------------------------------------
// Pure composition over capital posting legs.
// ---------------------------------------------------------------------------

/**
 * Fold a sequence of capital FIL lifecycle events into the own-funds composition.
 * Pure: takes the events (already provenance-filtered by the caller) + the
 * functional currency, produces the tier composition. Only `capital`-asset-class
 * instances (by taxonomy type guard) are processed; non-capital events are skipped.
 *
 * Sign convention: an own-funds CREDIT leg adds to the tier stock; a DEBIT leg
 * (redemption / derecognition) subtracts. The bare-terminal memo posts zero, so a
 * redemption with no economic terms is net-neutral (its substrate gap is tracked).
 */
export function foldCapitalComposition(
  events: Iterable<CapitalFilEvent>,
  functionalCurrency: string,
): CapitalComposition {
  // Per-(tier, sub-category) signed net in minor units (credit-positive).
  const byLine = new Map<
    string,
    { tier: FilCapitalTier; sub: FilCapitalSubCategory; minor: number }
  >();
  let legCount = 0;

  for (const ev of events) {
    const p = ev.payload as FilLifecyclePayloadMinimal;
    const kind = p.kind ?? ev.type;

    // Resolve the capital posting legs for this lifecycle event.
    let legs: CapitalPostingLeg[];
    if (kind === "FilInstrumentCreated") {
      const created = ev.payload as FilInstrumentCreatedPayload;
      // Only capital-asset-class instances are this fold's concern.
      if (typeof created.type !== "string" || !isCapitalPostingInstance(created.type)) continue;
      legs = postCapitalIssuanceLegs(created);
    } else if (kind === "FilInstrumentTerminated") {
      const terminated = ev.payload as FilInstrumentTerminatedPayload;
      if (typeof terminated.type !== "string" || !isCapitalPostingInstance(terminated.type))
        continue;
      legs = postCapitalRedemptionLegs(terminated);
    } else {
      // FilInstrumentAmended (Tier 2 amortisation) carries the re-stamped notional
      // but the build-phase rule has no amortisation arithmetic yet (tracked gap);
      // it contributes no composition delta. Non-lifecycle events are skipped.
      continue;
    }

    for (const leg of legs) {
      // The composition sums ONLY the own-funds (capital-tier) legs — the
      // settlement-cash (nostro) DEBIT leg is an asset, not own funds. An
      // own-funds leg is identified by its CoA capital tier carried on the leg
      // AND being booked to a capital own-funds account (the credit side of
      // issuance / the debit side of redemption). We sum the leg signed by side:
      // a CREDIT to an own-funds account increases the tier; a DEBIT decreases it.
      // The settlement-cash leg carries the same tier tag (for traceability) but
      // is booked to a nostro (asset) account — exclude it by account prefix.
      if (!isOwnFundsAccount(leg.accountCode)) continue;
      if (leg.amount.currency !== functionalCurrency) continue; // multi-currency at licence-day

      const minor = Number(
        amountToMinorUnits(legAmountMoney({ amount: leg.amount, currency: leg.amount.currency })),
      );
      const signed = leg.creditDebit === "credit" ? minor : -minor;
      const key = `${leg.capitalTier}::${leg.capitalSubCategory}`;
      const cur = byLine.get(key);
      if (cur) cur.minor += signed;
      else byLine.set(key, { tier: leg.capitalTier, sub: leg.capitalSubCategory, minor: signed });
      legCount += 1;
    }
  }

  const lines: CapitalCompositionLine[] = [...byLine.values()]
    .map((l) => ({ tier: l.tier, subCategory: l.sub, amountMinor: l.minor }))
    .sort((a, b) =>
      a.tier !== b.tier
        ? a.tier < b.tier
          ? -1
          : 1
        : a.subCategory < b.subCategory
          ? -1
          : a.subCategory > b.subCategory
            ? 1
            : 0,
    );

  let cet1Minor = 0;
  let at1Minor = 0;
  let tier2Minor = 0;
  for (const l of lines) {
    if (l.tier === "cet1") cet1Minor += l.amountMinor;
    else if (l.tier === "at1") at1Minor += l.amountMinor;
    else tier2Minor += l.amountMinor;
  }
  const tier1Minor = cet1Minor + at1Minor;
  const totalOwnFundsMinor = tier1Minor + tier2Minor;

  return {
    functionalCurrency,
    lines,
    cet1Minor,
    at1Minor,
    tier2Minor,
    tier1Minor,
    totalOwnFundsMinor,
    legCount,
  };
}

/**
 * True iff `accountCode` is a capital own-funds account (the 5000 equity block or
 * the 5050 AT1 / 5200 Tier 2 blocks). The settlement-cash (1200 nostro) leg is
 * NOT own funds and is excluded from the composition. Sourced from the account
 * numbering convention; the recon gate cross-checks each own-funds leg lands in a
 * capital-tier-tagged CoA account (no own-funds leg in a suspense account).
 */
export function isOwnFundsAccount(accountCode: string): boolean {
  return (
    accountCode.startsWith("ACC-5000-") ||
    accountCode.startsWith("ACC-5050-") ||
    accountCode.startsWith("ACC-5200-")
  );
}

// ---------------------------------------------------------------------------
// Store-backed reader — folds the capital composition from a v2 FIL event store.
// ---------------------------------------------------------------------------

export interface ComputeCapitalCompositionArgs {
  /** Store holding the capital FIL lifecycle events. */
  readonly eventStore: EventStore;
  /** Entity short-id. */
  readonly entity: string;
  /** ISO 8601 — as-of upper bound for the fold. */
  readonly asOf: string;
  /** Functional currency the composition is reported in. */
  readonly functionalCurrency: string;
  /**
   * When TRUE, include `provenance.kind:"simulated"` events (the R300m injection
   * demonstration path). DEFAULT FALSE — the production projection excludes them.
   */
  readonly includeSimulated?: boolean;
}

const CAPITAL_FIL_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
] as const;

/**
 * Fold the own-funds composition from the capital FIL events in `eventStore`.
 * Applies the as-of bound + provenance filter (optionally admitting simulated
 * events). Pure read; no events written (Principle 1: composition is a query).
 */
export function computeCapitalComposition(args: ComputeCapitalCompositionArgs): CapitalComposition {
  const filter = defaultProvenanceFilter();
  const collected: CapitalFilEvent[] = [];
  for (const t of CAPITAL_FIL_EVENT_TYPES) {
    for (const ev of args.eventStore.replay({ entity: args.entity, type: t, asOf: args.asOf })) {
      if (!args.includeSimulated && !eventMatchesProvenanceFilter(ev, filter)) continue;
      collected.push({ type: ev.type, payload: ev.payload });
    }
  }
  return foldCapitalComposition(collected, args.functionalCurrency);
}
