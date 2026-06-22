// dashboard/v2-finance-view.ts
//
// V2 boundary DTOs for the Finance oversight surface (`/api/v2/finance/*`).
// Slice 1 of D-V2-UI-VISIBILITY-REMEDIATION is the CAPITAL position — the
// own-funds composition (CET1 / AT1 / Tier 2 / Tier 1 / Total own funds) plus
// the capital-adequacy ratios (CET1 ratio, Total capital ratio) and headroom.
//
// This is the reference implementation for the financial-metrics slices that
// follow it. It is built to the V2 UI human-oversight standard
// (docs/v2-ui-oversight-standard.md, D-V2-UI-OVERSIGHT-STANDARD): a clean
// `/api/v2/*` boundary reading canonical sources directly, an explicit
// `pageProvenance`, and an HONEST data state (never a silent zero — Engineering
// Charter cmd 3 + the standard's "no silent gaps").
//
// CANONICAL SOURCES (read directly — Charter cmd 4 source-don't-hardcode):
//   - Own-funds composition → `computeCapitalComposition`
//     (platform/projections/ba700-capital-composition.ts) — the pure fold over
//     the `capital` asset-class FIL lifecycle events through the lifted capital
//     posting rules. The R300m demonstration injection is a `provenance:
//     simulated` FilInstrumentCreated, so it appears ONLY when simulated events
//     are admitted (the +Sim lens) and is correctly absent under Prod.
//   - Capital-adequacy ratios + headroom + RAS status → `computeCapitalMetrics`
//     (platform/projections/capital-metrics.ts) — provides the RWA denominator
//     and the RAS §B3 appetite status. As of slice 3 (D-V2-UI-VISIBILITY-
//     REMEDIATION gap #1) it is PROVENANCE-AWARE: the SAME `filter` drives it, so
//     under Prod the simulated R300m injection is excluded AND its ICAAP build-
//     phase baseline is suppressed (an empty production book has no capital and
//     no RWA baseline) — the ratios / headroom / status reflect the honest empty
//     production state, consistent with the empty COMPOSITION fold. Under +Sim
//     the injection + the build-phase RWA baseline show. This view still drives
//     the visible OWN-FUNDS numbers (and the ratio numerator) from the
//     provenance-correct COMPOSITION fold; the metrics give the denominator +
//     status context under the matching lens.
//
// PROVENANCE: the provenance filter mode → `includeSimulated` for the
// composition fold. `production-only` ⇒ exclude simulated ⇒ empty composition
// (no real capital pre-licence — the honest empty state). `combined` ⇒ admit
// simulated ⇒ the R300m injection shows. `pageProvenance` is the same filter so
// the badge matches exactly what the human is viewing.
//
// NAME-FREE (standing policy; feedback_no_agent_names_in_ui): the capital
// composition carries no agent personal names — it is a numeric fold. There is
// no name-bearing field in the response. (No `seatTitle` mapping is required
// because no owner/issuer/attester name is surfaced; if a future capital panel
// adds an owning-seat field it MUST route through `seatTitle` here.)
//
// BOUNDARY: dashboard layer — MAY import platform projections + v2-core types.
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION (CEO 2026-06-22) under
//   D-V2-UI-OVERSIGHT-STANDARD (CEO 2026-06-17); D-CAPITAL-ASSET-CLASS-V1;
//   urn:reg:za:regs-relating-to-banks:reg38; Banks Act 94 of 1990 §70;
//   urn:reg:bcbs:rbc:20.2; D5/2025 §2.1.3 (form BA 100); Principle 1; Principle 6.
// Author: Atlas (Core banking platform architect, engineering).

import {
  divD,
  fromMinorUnits,
  mulD,
  roundDecimal,
  toCanonicalString,
  toDecimal,
} from "../platform/core/decimal-engine";
import type { EventStore } from "../platform/event-store/store";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import {
  type CapitalComposition,
  type CapitalCompositionLine,
  computeCapitalComposition,
} from "../platform/projections/ba700-capital-composition";
import { computeCapitalMetrics } from "../platform/projections/capital-metrics";
import type { ProvenanceFilter } from "../platform/projections/filter";

// ---------------------------------------------------------------------------
// The anchor bank whose capital position this surface reports.
// ---------------------------------------------------------------------------

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Output DTOs (name-free; minor units + formatted display).
// ---------------------------------------------------------------------------

/**
 * The serving state of the capital surface.
 *   - "live"  — the composition fold returned own-funds lines (under the active
 *               provenance lens).
 *   - "empty" — the composition is authoritative but data-empty under this lens
 *               (the honest absent state — e.g. Prod pre-licence, no real
 *               capital). Carries a `reason`; never presented as a real zero.
 */
export type CapitalDataState = "live" | "empty";

/** One own-funds composition line, formatted for the V2 table render. */
export interface CapitalCompositionRow {
  /** Tier key (`cet1` | `at1` | `t2`). */
  readonly tier: string;
  /** Tier display label (e.g. "CET1", "Additional Tier 1", "Tier 2"). */
  readonly tierLabel: string;
  /** CAP sub-category key (e.g. `cet1.retained-earnings`). */
  readonly subCategory: string;
  /** Sub-category display label (e.g. "Retained earnings"). */
  readonly subCategoryLabel: string;
  /** Net own-funds stock for this sub-category, minor units (credit-positive). */
  readonly amountMinor: number;
  /** Formatted amount (e.g. "R300,000,000"). */
  readonly amountFmt: string;
}

/** A single headline capital metric tile + its formula/constituent linkage. */
export interface CapitalMetricTile {
  /** Stable metric key, used to parameterise the detail page (`?metric=`). */
  readonly key: string;
  /** Tile label. */
  readonly label: string;
  /** Raw value in minor units (for ratios this is null — ratios are unit-less). */
  readonly valueMinor: number | null;
  /** Formatted display value (currency or percentage). */
  readonly valueFmt: string;
  /** Tile sub-unit caption. */
  readonly unit: string;
}

/** The decomposition behind one metric — formula + constituents (drill target). */
export interface CapitalMetricDetail {
  readonly key: string;
  readonly label: string;
  /** Numerator label + formatted value. */
  readonly numLabel: string;
  readonly numFmt: string;
  /** Denominator label + formatted value (null ⇒ a pure sum, no denominator). */
  readonly denLabel: string | null;
  readonly denFmt: string | null;
  /** Result label + formatted value. */
  readonly resultLabel: string;
  readonly resultFmt: string;
  /** Regulatory reference for the formula. */
  readonly reference: string;
  /** The constituent composition lines that make up the numerator. */
  readonly constituents: readonly CapitalCompositionRow[];
}

export interface CapitalView {
  readonly entity: string;
  readonly functionalCurrency: string;
  /** Honest data state under the active provenance lens. */
  readonly dataState: CapitalDataState;
  /** When `empty`, why (never a silent zero). Empty string when `live`. */
  readonly reason: string;
  /** Whether the capital-metrics projection is on its build-phase baseline. */
  readonly buildPhase: boolean;
  /**
   * Honest one-line description of where the served ratio context comes from
   * under the active lens. Replaces the page's `buildPhase ? … : …` inference,
   * which mislabels the strict-production empty state as "live" (gap #1).
   */
  readonly sourcePosture: string;
  /** Headline metric tiles (each drills to its `CapitalMetricDetail`). */
  readonly tiles: readonly CapitalMetricTile[];
  /** Per-metric decomposition (formula + constituents) keyed by metric key. */
  readonly metrics: readonly CapitalMetricDetail[];
  /** The own-funds composition rows (one per tier/sub-category). */
  readonly composition: readonly CapitalCompositionRow[];
  /** RAS §B3 appetite status (green | amber | red). */
  readonly status: string;
  /** True when capital headroom is below the TICR floor (critical breach). */
  readonly critical: boolean;
  /** Total RWA denominator (minor units) used for the ratios. */
  readonly totalRwaMinor: number;
  readonly totalRwaFmt: string;
  /** Capital headroom (available capital − TICR − accrued charges), minor units. */
  readonly headroomMinor: number;
  readonly headroomFmt: string;
}

// ---------------------------------------------------------------------------
// Display helpers (ZAR-centric; the build-phase anchor capital is ZAR).
// ---------------------------------------------------------------------------

const TIER_LABELS: Record<string, string> = {
  cet1: "CET1",
  at1: "Additional Tier 1",
  t2: "Tier 2",
};

const SUB_CATEGORY_LABELS: Record<string, string> = {
  "cet1.paid-up-ordinary-shares": "Paid-up ordinary shares",
  "cet1.share-premium": "Share premium",
  "cet1.retained-earnings": "Retained earnings",
  "cet1.oci-reserve": "OCI reserve",
  "at1.perpetual-noncumulative": "Perpetual non-cumulative instruments",
  "t2.subordinated-debt": "Subordinated debt (≥5yr)",
  "t2.qualifying-general-provisions": "Qualifying general provisions",
};

function tierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? tier;
}

function subCategoryLabel(sub: string): string {
  return SUB_CATEGORY_LABELS[sub] ?? sub;
}

/** Group an integer string with thousands separators (display only, not money
 *  arithmetic). e.g. "300000000" → "300,000,000". */
function groupThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a minor-unit ZAR amount as "R1,234,567" (rands, no cents). Uses the
 * exact decimal engine for the minor→major conversion (Charter cmd 6 — no IEEE
 * float money arithmetic); the thousands grouping is a pure display transform on
 * the integer digit string, not arithmetic.
 */
function fmtMinor(minor: number, currency: string): string {
  const major = roundDecimal(fromMinorUnits(BigInt(Math.trunc(minor)), 2), 0, "DOWN");
  const canonical = toCanonicalString(major); // plain, no exponent
  const negative = canonical.startsWith("-");
  const digits = negative ? canonical.slice(1) : canonical;
  const symbol = currency === "ZAR" ? "R" : `${currency} `;
  return `${negative ? "−" : ""}${symbol}${groupThousands(digits)}`;
}

/**
 * Format a ratio (numerator/denominator minor units) as a percentage string.
 * Computed with the exact decimal engine — never IEEE float money division.
 * A zero (or negative) denominator yields "n/a" rather than Infinity — an
 * honest non-value (the bank has no RWA denominator yet under this lens).
 */
function fmtRatioPct(numeratorMinor: number, denominatorMinor: number): string {
  if (denominatorMinor <= 0) return "n/a";
  const num = fromMinorUnits(BigInt(Math.trunc(numeratorMinor)), 2);
  const den = fromMinorUnits(BigInt(Math.trunc(denominatorMinor)), 2);
  const pct = roundDecimal(mulD(divD(num, den), toDecimal("100")), 2, "HALF_UP");
  return `${toCanonicalString(pct)}%`;
}

function toCompositionRow(line: CapitalCompositionLine, currency: string): CapitalCompositionRow {
  return {
    tier: line.tier,
    tierLabel: tierLabel(line.tier),
    subCategory: line.subCategory,
    subCategoryLabel: subCategoryLabel(line.subCategory),
    amountMinor: line.amountMinor,
    amountFmt: fmtMinor(line.amountMinor, currency),
  };
}

// ---------------------------------------------------------------------------
// View builder.
// ---------------------------------------------------------------------------

export interface BuildCapitalViewArgs {
  readonly eventStore: EventStore;
  readonly filter: ProvenanceFilter;
  readonly asOf: string;
}

/**
 * Build the V2 capital-position view. The composition fold is provenance-aware
 * (the +Sim lens admits the R300m demonstration injection; Prod excludes it,
 * yielding the honest empty state). The ratios pair the composition numerator
 * with the capital-metrics RWA denominator. `pageProvenance` is attached by the
 * route handler so the badge matches the lens.
 */
export function buildCapitalView(args: BuildCapitalViewArgs): CapitalView {
  const { eventStore, filter, asOf } = args;
  const functionalCurrency = anchorFunctionalCurrency();
  // Provenance lens drives the composition fold directly via the EXPLICIT
  // filter (authoritative): `production-only` rejects the simulated R300m
  // injection in both lifecycle phases → the honest empty state pre-licence;
  // `combined` admits it → the demonstration figure shows. We do NOT use the
  // fold's `includeSimulated` boolean, because that only WIDENS the operating-
  // book default (which already admits simulated in build phase) and so would
  // paint R300m under Prod too — the exact silent-zero-inverse the standard
  // forbids. The page filter is `{ mode: "production-only" | "combined" }`.
  const includeSimulated = filter.mode === "combined";

  const composition: CapitalComposition = computeCapitalComposition({
    eventStore,
    entity: ANCHOR_ENTITY,
    asOf,
    functionalCurrency,
    filter,
  });

  // Capital-adequacy ratios + RWA denominator + RAS status. As of slice 3
  // (D-V2-UI-VISIBILITY-REMEDIATION gap #1) this projection is PROVENANCE-AWARE:
  // the SAME `filter` drives it, so under Prod the simulated R300m injection is
  // excluded AND the ICAAP build-phase baseline is suppressed — the ratios /
  // headroom / RAS status reflect the honest empty production book, consistent
  // with the empty composition fold. Under +Sim the injection + baseline RWA
  // show. We still drive the visible own-funds NUMBERS and the ratio NUMERATOR
  // from the composition fold above; the metrics give the RWA denominator +
  // status context under the matching lens.
  const metrics = computeCapitalMetrics(eventStore, asOf, filter);

  // Honest source-posture line under the active lens (gap #1): the strict-
  // production empty state is NOT "live capital events" — it is an empty
  // production book with no ICAAP baseline applied.
  const sourcePosture = metrics.buildPhase
    ? "Build-phase baseline (ICAAP v1 — no live capital events)"
    : includeSimulated
      ? metrics.availableCapitalMinor > 0
        ? "+ Sim lens — simulated capital injection + build-phase RWA baseline"
        : "+ Sim lens — no capital events folded"
      : metrics.availableCapitalMinor > 0
        ? "Live capital events (production)"
        : "Empty production book — no real capital (ICAAP baseline suppressed under Prod)";

  const compositionRows = composition.lines.map((l) => toCompositionRow(l, functionalCurrency));
  const dataState: CapitalDataState = composition.legCount > 0 ? "live" : "empty";
  const reason =
    dataState === "empty"
      ? includeSimulated
        ? "No capital instruments folded under the +Sim lens — no simulated own-funds events in this store."
        : "No real capital in the build phase (no R300m sits anywhere yet — it is a licence-day target). Switch to + Sim to view the demonstration injection. This is an honest empty state, not a clean zero."
      : "";

  const cet1Minor = composition.cet1Minor;
  const at1Minor = composition.at1Minor;
  const tier2Minor = composition.tier2Minor;
  const tier1Minor = composition.tier1Minor;
  const totalOwnFundsMinor = composition.totalOwnFundsMinor;
  const totalRwaMinor = metrics.totalRwaMinor;

  // ---- Headline tiles (each drills to a CapitalMetricDetail) ----
  const tiles: CapitalMetricTile[] = [
    {
      key: "total-own-funds",
      label: "Total own funds",
      valueMinor: totalOwnFundsMinor,
      valueFmt: fmtMinor(totalOwnFundsMinor, functionalCurrency),
      unit: "Tier 1 + Tier 2",
    },
    {
      key: "cet1",
      label: "CET1 capital",
      valueMinor: cet1Minor,
      valueFmt: fmtMinor(cet1Minor, functionalCurrency),
      unit: "Common Equity Tier 1",
    },
    {
      key: "tier1",
      label: "Tier 1 capital",
      valueMinor: tier1Minor,
      valueFmt: fmtMinor(tier1Minor, functionalCurrency),
      unit: "CET1 + AT1",
    },
    {
      key: "cet1-ratio",
      label: "CET1 ratio",
      valueMinor: null,
      valueFmt: fmtRatioPct(cet1Minor, totalRwaMinor),
      unit: "CET1 / RWA",
    },
    {
      key: "total-capital-ratio",
      label: "Total capital ratio",
      valueMinor: null,
      valueFmt: fmtRatioPct(totalOwnFundsMinor, totalRwaMinor),
      unit: "Total own funds / RWA",
    },
  ];

  // ---- Per-metric decomposition (formula + constituents) ----
  const cet1Lines = compositionRows.filter((r) => r.tier === "cet1");
  const at1Lines = compositionRows.filter((r) => r.tier === "at1");
  const tier1Lines = [...cet1Lines, ...at1Lines];

  const metricDetails: CapitalMetricDetail[] = [
    {
      key: "total-own-funds",
      label: "Total own funds",
      numLabel: "Tier 1 capital",
      numFmt: fmtMinor(tier1Minor, functionalCurrency),
      denLabel: "Tier 2 capital",
      denFmt: fmtMinor(tier2Minor, functionalCurrency),
      resultLabel: "Total own funds (Tier 1 + Tier 2)",
      resultFmt: fmtMinor(totalOwnFundsMinor, functionalCurrency),
      reference: "Reg 38(8); BCBS RBC20.2; D-CAPITAL-ASSET-CLASS-V1",
      constituents: compositionRows,
    },
    {
      key: "cet1",
      label: "CET1 capital",
      numLabel: "Sum of CET1 own-funds components",
      numFmt: fmtMinor(cet1Minor, functionalCurrency),
      denLabel: null,
      denFmt: null,
      resultLabel: "CET1 capital",
      resultFmt: fmtMinor(cet1Minor, functionalCurrency),
      reference: "Reg 38(8); Banks Act §70; BCBS CAP (definition of capital)",
      constituents: cet1Lines,
    },
    {
      key: "tier1",
      label: "Tier 1 capital",
      numLabel: "CET1 capital",
      numFmt: fmtMinor(cet1Minor, functionalCurrency),
      denLabel: "Additional Tier 1 capital",
      denFmt: fmtMinor(at1Minor, functionalCurrency),
      resultLabel: "Tier 1 capital (CET1 + AT1)",
      resultFmt: fmtMinor(tier1Minor, functionalCurrency),
      reference: "Reg 38(8); BCBS RBC20.2",
      constituents: tier1Lines,
    },
    {
      key: "cet1-ratio",
      label: "CET1 ratio",
      numLabel: "CET1 capital",
      numFmt: fmtMinor(cet1Minor, functionalCurrency),
      denLabel: "Risk-weighted assets",
      denFmt: fmtMinor(totalRwaMinor, functionalCurrency),
      resultLabel: "CET1 ratio",
      resultFmt: fmtRatioPct(cet1Minor, totalRwaMinor),
      reference: "Reg 38(1)(a); BA-700 Part B; BCBS RBC20.1",
      constituents: cet1Lines,
    },
    {
      key: "total-capital-ratio",
      label: "Total capital ratio",
      numLabel: "Total own funds",
      numFmt: fmtMinor(totalOwnFundsMinor, functionalCurrency),
      denLabel: "Risk-weighted assets",
      denFmt: fmtMinor(totalRwaMinor, functionalCurrency),
      resultLabel: "Total capital ratio",
      resultFmt: fmtRatioPct(totalOwnFundsMinor, totalRwaMinor),
      reference: "Reg 38(1)(c); BA-700 Part B; BCBS RBC20.1",
      constituents: compositionRows,
    },
  ];

  return {
    entity: ANCHOR_ENTITY,
    functionalCurrency,
    dataState,
    reason,
    buildPhase: metrics.buildPhase,
    sourcePosture,
    tiles,
    metrics: metricDetails,
    composition: compositionRows,
    status: metrics.status,
    critical: metrics.critical,
    totalRwaMinor,
    totalRwaFmt: fmtMinor(totalRwaMinor, functionalCurrency),
    headroomMinor: metrics.headroomMinor,
    headroomFmt: fmtMinor(metrics.headroomMinor, functionalCurrency),
  };
}
