// platform/reporting/ba-210-large-exposures.ts
//
// WS-BA-RETURNS-FOLLOWON — BA 210 (Credit Concentration Risk / Large Exposures,
// LEX) events-first generator. The first BA 210 generator in the corpus.
//
// Form-number authority: the SARB Excel form set — BA 210 = "Credit
// Concentration Risk / Large Exposures (LEX); incl. watch-list" (workbook tab
// A1, Regulations/SARB-PA/ba-returns/schemas/BA210.zip), consolidated in
// Regulations/SARB-PA/ba-returns/_canonical-register.md. The large-exposures
// regime was historically mis-pinned to "BA 330" across several legacy
// artefacts; BA 330 is the IRRBB return — large exposures is BA 210 (see
// Regulations/SARB-PA/large-exposures.md §7). This module uses the canonical
// BA 210 number from the start.
//
// Regulatory substance (verified against the in-corpus primary text at
// Regulations/SARB-PA/large-exposures.md, sourced from the BCBS RCAP
// *Assessment of Basel large exposures regulations — South Africa*, April 2023):
//
//   - **Large-exposure REPORTING THRESHOLD = ≥ 10% of the bank's eligible
//     capital base.** South Africa has no stand-alone domestic definition; the
//     RCAP assesses Regulation 24(7)(a) read with Regulation 24(6)(f) of the
//     Regulations relating to Banks (issued under Banks Act 94 of 1990 §90) as
//     "equivalent in all material respects" to the Basel LEX definition
//     (Basel LEX para 14). The 10% threshold binds through those sub-regulations.
//
//   - **Single- / connected-counterparty HARD LIMIT = ≤ 25% of the eligible
//     Tier-1 capital base.** SA Reg 24(6)–(8); Basel LEX para 10.8. Hoz Bank is
//     not a D-SIB or G-SIB, so the tighter 15%/18% D-SIB-to-D-SIB schedule
//     (D3/2022 Annexure 1) does not bind; the general 25% ceiling applies as a
//     maximum on any day. Eligible capital base = Tier 1.
//
//   - **Sovereign exemption — Reg 24(8)(a):** exposures to sovereigns and their
//     central banks (and PSEs treated as sovereigns) are EXEMPT from the LEX
//     limit. The bank's build-phase bond book is SA government (ZAG ISINs); those
//     issuer exposures are flagged exempt and excluded from the breach test (but
//     are still surfaced for transparency).
//
//   Authority for D3/2022: SARB Prudential Authority Directive 3 of 2022
//   ("D3/2022 — Large exposure requirements", Government Gazette No 46159,
//   31 March 2022, effective 1 April 2022).
//
// Exposure grain — events-first, reusing the canonical ECL substrate:
//   - `readDebtExposures` (platform/accounting/ecl-engine) supplies the EAD base:
//     live bonds (folded per ISIN) + live interbank placements (deposits
//     excluded — a deposit is a liability where the bank is the obligor, never a
//     debt asset the bank concentrates credit risk on).
//   - Exposures are aggregated by **obligor / issuer party id** (the LEX
//     connected-counterparty grain): bonds → issuer (all SA-government ISINs
//     collapse to the single RSA sovereign issuer); IBL → borrowing-counterparty
//     LEI. Where an exposure carries no `obligorPartyId` the per-instrument
//     `instrumentId` is the grain — never silently nets unrelated obligors.
//
// Capital base: this generator accepts `capitalBaseMinor` as an optional input.
// When omitted it derives the eligible Tier-1 base from `getEligibleCapital`
// (platform/projections/capital-metrics) — the SAME canonical LEX denominator
// the `recon:lex-cap-utilisation` pipeline and the credit-limit engine use, so
// the BA 210 % figures reconcile with the live LEX utilisation. In the v0
// build-phase substrate that helper returns the single capital envelope (no
// Tier-1/Tier-2 split yet); it refines to true Tier-1 without an API change when
// the BA 100/BA 700 capital-adequacy split lands.
//
// NO SILENT ZEROS / NO SILENT BREACH: an empty or wholly-under-threshold book
// yields an empty large-exposure list and `breach = false`, with a placeholder
// note explaining the absence is reasoned, not a computed 0.
//
// Per-entity. BA 210 is bank-licence-bound — only LE-ZA-HOZ-BANK at v0; group-
// consolidated LEX deferred under D-REGULATORY-PERIMETER.
//
// P1 — pure projection over the event log; no event side-effects, no document-
// store writes. P2 — every figure carries a typed regulatory citation upward.
//
// Authority: D-BA-RETURNS-FOLLOWON-BATCH;
//   brief:mira:ws-ba-returns-followon-ba-210-large-exposures-le:2026-06-09.
//
// Author: Mira (Regulatory reporting engineer, engineering).

import { z } from "zod";

import type { DebtExposure } from "../accounting/ecl-engine";
import { readDebtExposures } from "../accounting/ecl-engine";
import type { EventStore } from "../event-store/store";
import { getEligibleCapital } from "../projections/capital-metrics";
import { defaultProvenanceFilter } from "../projections/filter";

// ---------------------------------------------------------------------------
// Regulatory constants (verified — see module header)
// ---------------------------------------------------------------------------

/**
 * Large-exposure reporting threshold as a fraction of the eligible capital
 * base. An aggregate obligor exposure ≥ this fraction is a "large exposure".
 *
 * 10% — Basel LEX para 14; SA Reg 24(7)(a) read with Reg 24(6)(f) (RCAP
 * April 2023, §2.2.1 / §2.3.1 — assessed materially equivalent).
 */
export const LEX_LARGE_EXPOSURE_THRESHOLD_PCT = 0.1;

/**
 * Single- / connected-counterparty hard limit as a fraction of the eligible
 * Tier-1 capital base. An aggregate obligor exposure > this fraction breaches
 * the LEX cap.
 *
 * 25% — Basel LEX para 10.8; SA Reg 24(6)–(8); D3/2022. (Hoz Bank is neither a
 * D-SIB nor a G-SIB, so the tighter 15%/18% D-SIB schedule does not bind.)
 */
export const LEX_HARD_LIMIT_PCT = 0.25;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface Ba210GeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank entities. */
  readonly entity: string;
  /** ISO 8601 as-of date (period-end). */
  readonly asOf: string;
  /** ISO 4217 functional currency for totals (ZAR at v0). */
  readonly functionalCurrency: string;
  /** Debt exposures (EAD grain). Supplied by `readDebtExposures` in the events path. */
  readonly exposures: readonly DebtExposure[];
  /**
   * Eligible Tier-1 capital base in minor units — the LEX %-of-capital
   * denominator. Must be positive. The events-first generator sources this from
   * `getEligibleCapital` when not supplied.
   */
  readonly capitalBaseMinor: number;
  /** Provenance label for the capital base (forensic record). */
  readonly capitalBaseSource?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** One obligor's aggregated exposure on the BA 210 large-exposures view. */
export interface Ba210ObligorExposure {
  /** Obligor / issuer party id (the connected-counterparty grain). */
  readonly obligorPartyId: string;
  /** Obligor exposure class (sovereign / bank / corporate / retail). */
  readonly exposureClass: string;
  /** Aggregate exposure-at-default across this obligor's instruments, minor units. */
  readonly exposureMinor: number;
  /** Aggregate exposure as a fraction of the eligible capital base. */
  readonly exposurePctOfCapital: number;
  /** Constituent instrument ids that fold into this obligor (audit aid). */
  readonly contributingInstruments: readonly string[];
  /** True when exposurePctOfCapital ≥ 10% — a "large exposure" (Reg 24(7)(a)). */
  readonly isLargeExposure: boolean;
  /**
   * True when this obligor is exempt from the LEX limit (sovereign / central
   * bank — Reg 24(8)(a)). Exempt obligors never set `breach`.
   */
  readonly isExempt: boolean;
  /** True when exposurePctOfCapital > 25% AND not exempt — a LEX limit breach. */
  readonly isBreach: boolean;
  readonly currency: string;
}

export interface Ba210Output {
  readonly meta: {
    readonly form: "BA 210";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly capitalBaseMinor: number;
    readonly capitalBaseSource: string;
    readonly exposuresFingerprint: string;
  };
  /** Obligors at or above the 10% large-exposure threshold, descending by size. */
  readonly largeExposures: readonly Ba210ObligorExposure[];
  /**
   * Aggregate of all (non-exempt) large exposures in minor units. The Basel /
   * SA framework also caps the SUM of large exposures; this total surfaces it.
   */
  readonly aggregateLargeExposureMinor: number;
  /** Aggregate large exposures as a fraction of the eligible capital base. */
  readonly aggregateLargeExposurePctOfCapital: number;
  /** Number of distinct obligors at/above the large-exposure threshold. */
  readonly largeExposureCount: number;
  /** True when ≥1 non-exempt obligor exceeds the 25% hard limit. */
  readonly breach: boolean;
  /** Obligor party ids that breach the 25% hard limit (non-exempt). */
  readonly breachedObligors: readonly string[];
  readonly thresholdPct: number;
  readonly hardLimitPct: number;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba210GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba210GeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

/** Bank-licence-bound entity short-ids in scope for BA 210. */
export const BA_210_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_210_BANK_ENTITIES.includes(entity)) {
    throw new Ba210GeneratorError(
      `BA 210 (Large Exposures / LEX) is bank-licence-bound; entity '${entity}' is not in BA_210_BANK_ENTITIES (${BA_210_BANK_ENTITIES.join(", ")}). Group-consolidated LEX is deferred under D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sovereign / central-bank exposures are exempt from the LEX limit per
 * Reg 24(8)(a). We key the exemption off the BA-200 exposure class so it tracks
 * the obligor classification rather than a brittle id-prefix match.
 */
function isExemptExposureClass(exposureClass: string): boolean {
  return exposureClass === "sovereign";
}

/** Stable fingerprint of the exposure set for forensic reproducibility. */
function fingerprintExposures(exposures: readonly DebtExposure[]): string {
  const sorted = [...exposures]
    .map((e) => ({
      instrumentId: e.instrumentId,
      obligorPartyId: e.obligorPartyId ?? e.instrumentId,
      exposureClass: e.exposureClass,
      eadMinor: e.eadMinor,
      currency: e.currency,
    }))
    .sort((a, b) =>
      a.instrumentId < b.instrumentId ? -1 : a.instrumentId > b.instrumentId ? 1 : 0,
    );
  return JSON.stringify(sorted);
}

interface ObligorAccum {
  obligorPartyId: string;
  exposureClass: string;
  exposureMinor: number;
  instruments: string[];
  currency: string;
  exempt: boolean;
}

// ---------------------------------------------------------------------------
// Core generator (pure)
// ---------------------------------------------------------------------------

/**
 * Generate the BA 210 (Large Exposures / LEX) projection from a set of debt
 * exposures + an eligible-capital base. Pure function; deterministic.
 *
 * Aggregation is by obligor/issuer party id. Each obligor's aggregate exposure
 * is expressed as a % of the eligible capital base and tested against the two
 * regulatory bands:
 *   - ≥ 10% → flagged a "large exposure" (Reg 24(7)(a)) — reportable;
 *   - > 25% AND not exempt → a LEX limit breach (Reg 24(6)–(8); D3/2022).
 *
 * Sovereign / central-bank obligors are exempt from the limit (Reg 24(8)(a));
 * they may still be flagged "large" for transparency but never set `breach`.
 */
export function generateBa210LargeExposures(input: Ba210GeneratorInput): Ba210Output {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba210GeneratorError(
      `BA 210 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  if (!Number.isFinite(input.capitalBaseMinor) || input.capitalBaseMinor <= 0) {
    throw new Ba210GeneratorError(
      `BA 210 generator: capitalBaseMinor must be a positive finite amount (the LEX %-of-capital denominator), got ${input.capitalBaseMinor}. A non-positive capital base cannot anchor a large-exposure ratio.`,
    );
  }

  const ccy = input.functionalCurrency;
  const capital = input.capitalBaseMinor;

  // Aggregate by obligor party id (the connected-counterparty LEX grain).
  const byObligor = new Map<string, ObligorAccum>();
  for (const exp of input.exposures) {
    if (exp.eadMinor <= 0) continue;
    const obligorId = exp.obligorPartyId ?? exp.instrumentId;
    const existing = byObligor.get(obligorId);
    if (existing) {
      existing.exposureMinor += exp.eadMinor;
      existing.instruments.push(exp.instrumentId);
      // exempt is sticky once true (a sovereign-classed leg keeps the obligor exempt).
      existing.exempt = existing.exempt || isExemptExposureClass(exp.exposureClass);
    } else {
      byObligor.set(obligorId, {
        obligorPartyId: obligorId,
        exposureClass: exp.exposureClass,
        exposureMinor: exp.eadMinor,
        instruments: [exp.instrumentId],
        currency: exp.currency,
        exempt: isExemptExposureClass(exp.exposureClass),
      });
    }
  }

  // Build the large-exposure rows (≥ 10% of capital), descending by exposure.
  const largeExposures: Ba210ObligorExposure[] = [];
  for (const acc of byObligor.values()) {
    const pct = acc.exposureMinor / capital;
    if (pct < LEX_LARGE_EXPOSURE_THRESHOLD_PCT) continue;
    const isBreach = !acc.exempt && pct > LEX_HARD_LIMIT_PCT;
    largeExposures.push({
      obligorPartyId: acc.obligorPartyId,
      exposureClass: acc.exposureClass,
      exposureMinor: acc.exposureMinor,
      exposurePctOfCapital: pct,
      contributingInstruments: [...acc.instruments].sort(),
      isLargeExposure: true,
      isExempt: acc.exempt,
      isBreach,
      currency: acc.currency,
    });
  }

  largeExposures.sort((a, b) => {
    if (b.exposureMinor !== a.exposureMinor) return b.exposureMinor - a.exposureMinor;
    return a.obligorPartyId < b.obligorPartyId ? -1 : a.obligorPartyId > b.obligorPartyId ? 1 : 0;
  });

  // Aggregate of large exposures — the framework also caps the SUM. Exclude
  // exempt obligors from the aggregate cap base (consistent with the breach test).
  const aggregateLargeExposureMinor = largeExposures
    .filter((l) => !l.isExempt)
    .reduce((s, l) => s + l.exposureMinor, 0);
  const aggregateLargeExposurePctOfCapital = aggregateLargeExposureMinor / capital;

  const breachedObligors = largeExposures.filter((l) => l.isBreach).map((l) => l.obligorPartyId);
  const breach = breachedObligors.length > 0;

  const placeholders: string[] = [];
  if (input.exposures.length === 0) {
    placeholders.push(
      "[citation: TBC — no in-scope debt exposures supplied; the empty large-exposure list and breach=false are a reasoned absence, NOT a computed 0]",
    );
  } else if (largeExposures.length === 0) {
    placeholders.push(
      `[citation: TBC — no obligor reaches the ${(LEX_LARGE_EXPOSURE_THRESHOLD_PCT * 100).toFixed(0)}% large-exposure threshold against the eligible capital base; book is diversified within LEX bands]`,
    );
  }
  placeholders.push(
    "[citation: TBC — connected-counterparty grouping uses the obligor/issuer party id from the event log; full Reg 24(6)(f) control / economic-interdependence linkage walk lands with the Party-register connected-group projection]",
  );
  placeholders.push(
    "[citation: TBC — eligible capital base is the build-phase single envelope (getEligibleCapital); refines to true Tier-1 when the BA 100 / BA 700 capital-adequacy Tier split lands — no generator API change]",
  );

  return {
    meta: {
      form: "BA 210",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: `period:${input.entity}:asof:${input.asOf.slice(0, 10)}`,
      functionalCurrency: ccy,
      generatorVersion: "v0.1",
      capitalBaseMinor: capital,
      capitalBaseSource: input.capitalBaseSource ?? "caller-supplied",
      exposuresFingerprint: fingerprintExposures(input.exposures),
    },
    largeExposures,
    aggregateLargeExposureMinor,
    aggregateLargeExposurePctOfCapital,
    largeExposureCount: largeExposures.length,
    breach,
    breachedObligors,
    thresholdPct: LEX_LARGE_EXPOSURE_THRESHOLD_PCT,
    hardLimitPct: LEX_HARD_LIMIT_PCT,
    citations: [
      "D-BA-RETURNS-FOLLOWON-BATCH",
      "Banks Act 94 of 1990 §90",
      "Regulations relating to Banks Reg 24(7)(a)",
      "Regulations relating to Banks Reg 24(6)(f)",
      "Regulations relating to Banks Reg 24(6)–(8)",
      "Regulations relating to Banks Reg 24(8)(a)",
      "SARB PA Directive 3 of 2022 (Large exposure requirements)",
      "BCBS LEX framework para 14",
      "BCBS LEX framework para 10.8",
      "Regulations/SARB-PA/ba-returns/_canonical-register.md",
    ],
    placeholders,
  };
}

// ---------------------------------------------------------------------------
// Events-first generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 210 (Large Exposures / LEX) projection directly from the
 * event store. Sources EAD from `readDebtExposures` (live bonds + interbank
 * placements, deposits excluded), aggregates by obligor/issuer party id, and
 * anchors the %-of-capital ratios on the eligible Tier-1 capital base.
 *
 * Capital base: `capitalBaseMinor` is taken from the caller when supplied;
 * otherwise it is derived from `getEligibleCapital(store, asOf)` — the same
 * canonical LEX denominator the `recon:lex-cap-utilisation` pipeline uses, so
 * the BA 210 figures reconcile with live LEX utilisation.
 *
 * Provenance: exposures are read through the default operating-book provenance
 * filter (`defaultProvenanceFilter`) — build-phase fixtures admitted, sandbox
 * scaffolding excluded.
 *
 * @param store               the event store to read.
 * @param asOf                ISO 8601 period-end date.
 * @param entity              bank legal-entity short-id (must be a BA-210 bank).
 * @param functionalCurrency  ISO-4217 functional currency for totals.
 * @param capitalBaseMinor    optional eligible Tier-1 capital base (minor units);
 *                            derived from `getEligibleCapital` when omitted.
 */
export function generateBa210LargeExposuresFromEvents(
  store: EventStore,
  asOf: string,
  entity: string,
  functionalCurrency: string,
  capitalBaseMinor?: number,
): Ba210Output {
  const provenanceFilter = defaultProvenanceFilter();
  const exposures = readDebtExposures(store, provenanceFilter);

  let capital: number;
  let capitalBaseSource: string;
  if (capitalBaseMinor !== undefined) {
    capital = capitalBaseMinor;
    capitalBaseSource = "caller-supplied";
  } else {
    capital = Number(getEligibleCapital(store, asOf).amount);
    capitalBaseSource = "getEligibleCapital (eligible Tier-1 base, build-phase envelope)";
  }

  return generateBa210LargeExposures({
    entity,
    asOf,
    functionalCurrency,
    exposures,
    capitalBaseMinor: capital,
    capitalBaseSource,
  });
}

// ---------------------------------------------------------------------------
// Zod schemas for the output (used by the render layer)
// ---------------------------------------------------------------------------

export const ba210ObligorExposureSchema = z.object({
  obligorPartyId: z.string().min(1),
  exposureClass: z.string().min(1),
  exposureMinor: z.number().int().nonnegative(),
  exposurePctOfCapital: z.number(),
  contributingInstruments: z.array(z.string().min(1)),
  isLargeExposure: z.boolean(),
  isExempt: z.boolean(),
  isBreach: z.boolean(),
  currency: z.string().length(3),
});
