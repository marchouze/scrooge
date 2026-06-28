// dashboard/v2-finance-returns-view.ts
//
// V2 boundary DTO for the Finance → Regulatory-Returns page
// (`GET /api/v2/finance/returns`). Surfaces the full SARB BA-return register —
// every canonical return, its verbatim official name, a build/data status, and
// live figures for the two returns that already compute on demand (BA 700, BA
// 320).
//
// ## SOURCE, don't hardcode (Engineering Charter cmd 4)
//
// The register is DERIVED, never re-keyed. Two typed, recon-backed sources are
// reused:
//
//   1. The form schedule + verbatim official names come from the typed
//      RETURN_CONTRACT_REGISTRY (v2-core/regulatory-returns/return-contracts.ts)
//      and each contract's `formName` field. Every contract `formName` is
//      sourced from the SARB Excel A1 header transcribed verbatim in
//      Regulations/SARB-PA/ba-returns/_canonical-register.md §1, and the form
//      NUMBERING is gated by `recon:ba-form-numbering`. So no BA-return name or
//      number is written by hand in this module or on the page.
//
//   2. The live figures come DIRECTLY from the V2 projections (computeBA700V2,
//      computeBA320V2, computeTrialBalanceV2) — NOT the flag-gated
//      `selectRegulatoryReturn` dual-read, which falls back to the V1 generators
//      when `useV2Store` is off. This page is V2-only: no V1 data reaches it
//      (D-V1-REMOVAL-PHASE-1; the CLAUDE.md V1-retirement directive).
//
// ## STATUS — `live` vs `planned` (honest; Charter cmd 3 / cmd 5)
//
// The brief offered three statuses (live / built / planned) but warned that the
// reporting-code generators (platform/reporting/ba-*.ts) are STILL numbered
// against the FABRICATED numbering scheme (see _canonical-register.md §4 — a
// separate Bea/Atlas replay-safe re-number track). A generator FILENAME
// therefore cannot be mapped to a canonical form number without resolving that
// in-flight remediation, so a `built` status cannot be cleanly sourced for the
// non-live forms. Rather than ASSERT a status I cannot source, this view
// COLLAPSES to `live` vs `planned`:
//   - `live`    — BA 700, BA 320 and BA 100 ONLY (served on demand by the V2
//                 projections; figures populated below).
//   - `planned` — every other canonical return: a typed cell-data contract
//                 exists (the form is data-modelled) but no on-demand
//                 figure-producing route does.
// The `built` value is part of the DTO union for forward-compatibility but is
// not emitted until the numbering remediation lands and a generator can be
// soundly attributed to a canonical form.
//
// ## SUBSTRATE GAP (Charter cmd 5 — no silent deferral)
//
// There is NO ReportFiled / filing-lifecycle event in the substrate, so
// "Last Filed" / "Reporting period" / "Overdue" CANNOT be sourced. They are
// rendered "—" / "N/A", never fabricated. The gap is tracked in the canonical
// substrate-gap register as `ba-returns-filing-lifecycle`
// (platform/substrate/gap-register.ts) and sourced from there below.
//
// ## NAME-FREE (standing policy; feedback_no_agent_names_in_ui)
//
// This DTO carries NO agent personal names — only form numbers, verbatim form
// names, statuses, and sourced figures. The owning seat is referenced by Title
// only where surfaced.
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
//   D-BA-RETURN-DATA-CONTRACT. Backing brief:
//   brief:mira:wire-ba-returns-register-onto-v2-finance-regulat:2026-06-20.
// Author: Mira (Compliance / RegTech engineer, engineering — reports to Zara
//   (Chief Compliance Officer)).

import { type Money, moneyFromMinorUnits } from "../platform/core/decimal-money";
import type { Currency } from "../platform/core/types";
import type { EventStore } from "../platform/event-store/store";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import type { MarketDataStore } from "../platform/market-data/store";
import { computeBA320V2 } from "../platform/projections/ba320-fx-v2";
import { computeBA700V2 } from "../platform/projections/ba700-v2";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
  setDefaultProvenanceModeOverride,
} from "../platform/projections/filter";
import { computeTrialBalanceV2 } from "../platform/projections/gl-projection-v2";
import {
  type Ba100LineClassification,
  generateBa100BalanceSheet,
  isOffBalanceSheetAccountId,
} from "../platform/reporting/ba-100-balance-sheet";
import { leafFoldFor } from "../platform/reporting/cell-value/leaf-fold-registry";
import { getSubstrateGap } from "../platform/substrate/gap-register";
// Side-effect import: registers every seat-authored per-form leaf fold so the
// cell-value engine can fill granular cells (D-BA-RETURN-CELL-VALUE-ENGINE).
import "../platform/reporting/cell-value/registrations";
import { COA_ACCOUNTS } from "../v2-core/accounting/chart-of-accounts";
import { CANONICAL_LEGAL_ENTITY_ID } from "../v2-core/reference-data/legal-entity";
import type { ReturnForm } from "../v2-core/regulatory-returns/cell-contract";
import { computeDerivedCells } from "../v2-core/regulatory-returns/cell-value/engine";
import {
  RETURN_CONTRACT_REGISTRY,
  loadReturnContract,
} from "../v2-core/regulatory-returns/return-contracts";

// ---------------------------------------------------------------------------
// View shapes — the V2 boundary DTO.
// ---------------------------------------------------------------------------

export type ReturnBuildStatus = "live" | "built" | "planned";

// ---------------------------------------------------------------------------
// Page-facing figures — DECIMAL-NATIVE money (Charter cmd 4; feedback_no_minor_
// money_decimal_native). Money is carried as the canonical major-unit `Money`
// type ({amount: "73750000.00", currency: "ZAR"}) — NEVER a minor-unit integer
// and NEVER divided by 100 on the page. The underlying V2 projections still
// expose `*Minor` integers internally; they are lifted
// to `Money` here, at the V2 boundary, exactly once via moneyFromMinorUnits.
// ---------------------------------------------------------------------------

/** BA 700 capital-adequacy page figures (decimal-native major-unit money). */
export interface Ba700PageFigures {
  readonly kind: "ba700";
  readonly tier1Capital: Money<Currency>;
  readonly tier2Capital: Money<Currency>;
  readonly totalRwa: Money<Currency>;
  /** Total capital ratio = (T1 + T2) / RWA; `null` when RWA is zero. A pure ratio, not money. */
  readonly carRatio: number | null;
  readonly coverageStatus: string;
  readonly gaps: readonly string[];
}

/** One BA 320 net-open-position row (functional-currency money; null = no rate). */
export interface Ba320PagePosition {
  readonly baseCurrency: string;
  readonly netPositionFunctional: Money<Currency> | null;
  readonly rateAvailable: boolean;
}

/** BA 320 FX market-risk page figures (decimal-native major-unit money). */
export interface Ba320PageFigures {
  readonly kind: "ba320";
  readonly positions: readonly Ba320PagePosition[];
  /** Reg 28(5) FX open-position charge; `null` when a rate is missing (fail-closed). */
  readonly openPositionCharge: Money<Currency> | null;
  readonly coverageStatus: string;
  readonly gaps: readonly string[];
}

/** One BA 100 balance-sheet line (decimal-native major-unit money). */
export interface Ba100PageLine {
  readonly section: "assets" | "liabilities" | "equity";
  readonly label: string;
  readonly amount: Money<Currency>;
}

/** BA 100 balance-sheet page figures (decimal-native major-unit money). */
export interface Ba100PageFigures {
  readonly kind: "ba100";
  readonly assets: Money<Currency>;
  readonly liabilities: Money<Currency>;
  readonly equity: Money<Currency>;
  /** assets ≡ liabilities + equity (per the generator's balance check). */
  readonly balanced: boolean;
  readonly lines: readonly Ba100PageLine[];
  /** Trial-balance rows with no on-balance-sheet classification this run (surfaced, not hidden). */
  readonly classificationGapCount: number;
  readonly coverageStatus: string;
}

export type FinanceReturnFigures = Ba700PageFigures | Ba320PageFigures | Ba100PageFigures;

/** One row in the BA-return register. */
export interface FinanceReturnRow {
  /** Registry form key, e.g. "BA700" / "BA94x" — the id used to drill into the detail page. */
  readonly formId: ReturnForm;
  /** Display form number, e.g. "BA 700" or "BA 941–944" (sourced, never hand-keyed). */
  readonly form: string;
  /** Official form name (Excel A1), verbatim from the typed contract. */
  readonly name: string;
  /** Build/data status — `live` for the on-demand returns, else `planned`. */
  readonly status: ReturnBuildStatus;
  /** One-line headline for a live return (e.g. the CAR ratio or FX charge). */
  readonly summary?: string;
  /** The sourced, decimal-native figures for a live return. */
  readonly figures?: FinanceReturnFigures;
  /** Which read path produced a live return's figures ("v1" | "v2"). */
  readonly readPath?: "v1" | "v2";
  /** Advisory gap markers carried through from the live return's projection. */
  readonly gaps?: readonly string[];
  /**
   * Filing lifecycle, folded from the BORN-V2 return-of-record + filing events
   * (ReportGenerated / ReportFiled; D-BA-RETURN-OF-RECORD-EVENT-FAMILY). Present
   * for a form once at least one ReportGenerated/ReportFiled exists; otherwise
   * absent and the page renders "—" / "N/A" (honest, never fabricated).
   */
  readonly filing?: FinanceReturnFiling;
}

/** Filing-lifecycle render for one return, folded from the typed events. */
export interface FinanceReturnFiling {
  /** Reporting period of the latest return-of-record (e.g. period:...:2026-05). */
  readonly reportingPeriod: string;
  /** ISO 8601 — when the latest filing was filed; null when generated-not-filed. */
  readonly lastFiled: string | null;
  /** Submission mode of the latest filing ("simulator" | "live"); null if unfiled. */
  readonly mode: "simulator" | "live" | null;
  /** BLAKE3 content hash of the latest return-of-record. */
  readonly contentHash: string;
}

export interface FinanceReturnsView {
  readonly asOf: string;
  /** ISO-4217 functional (reporting) currency — sourced from the LE tree. */
  readonly functionalCurrency: string;
  /** Anchor legal-entity short-id. */
  readonly entity: string;
  /** Count of returns that are live (for the "Returns Built" tile). */
  readonly liveCount: number;
  /** Total canonical returns in the register. */
  readonly totalCount: number;
  /**
   * The filing-lifecycle substrate gap (Charter cmd 5). Surfaced so the page
   * can render "Last Filed"/"Overdue" as the honest "—"/"N/A" with the reason.
   */
  readonly filingLifecycleGap: {
    readonly id: string;
    readonly reason: string;
  };
  readonly returns: readonly FinanceReturnRow[];
}

// ---------------------------------------------------------------------------
// Canonical-register membership — the 28 §1 returns (the BA-numbered schedule).
//
// RETURN_CONTRACT_REGISTRY also carries the SUPPLEMENTARY market-risk returns
// CVA and FRTB, which are NOT part of the §1 28-row BA-return schedule (they are
// standalone supplementary returns on their own identity). The register page
// surfaces the 28 canonical BA returns the brief specifies, so CVA / FRTB are
// excluded here. They remain in the contract registry for the NPA / cell-
// contract framework.
// ---------------------------------------------------------------------------

const SUPPLEMENTARY_FORMS: ReadonlySet<ReturnForm> = new Set<ReturnForm>(["CVA", "FRTB"]);

// ---------------------------------------------------------------------------
// Form display-number derivation. The registry key is e.g. "BA700" or "BA94x";
// the human display form number is "BA 700" / "BA 941–944". The "BA94x" key is
// the single canonical-register §1 row for the BA 941–944 series.
// ---------------------------------------------------------------------------

function displayFormNumber(form: ReturnForm): string {
  if (form === "BA94x") return "BA 941–944";
  // "BA700" → "BA 700"; the numeric suffix is the canonical form number.
  const m = form.match(/^BA(\d+)$/);
  if (m !== null) return `BA ${m[1]}`;
  // CVA / FRTB and any non-BA key render as-is.
  return form;
}

// ---------------------------------------------------------------------------
// The filing-lifecycle substrate gap (no ReportFiled event exists). SOURCED
// from the canonical substrate-gap register (Principle 2 — single source), not
// re-described here. The register entry `ba-returns-filing-lifecycle` is the
// tracked obligation to build the event family (Charter cmd 5).
// ---------------------------------------------------------------------------

const FILING_LIFECYCLE_GAP_ID = "ba-returns-filing-lifecycle";

function filingLifecycleGap(): { id: string; reason: string } {
  const record = getSubstrateGap(FILING_LIFECYCLE_GAP_ID);
  if (record === undefined) {
    // Fail-closed (Charter cmd 2): the register entry MUST exist — a missing
    // tracked gap is a silent deferral, not an empty string.
    throw new Error(
      `substrate-gap register is missing required entry '${FILING_LIFECYCLE_GAP_ID}'`,
    );
  }
  return { id: record.id, reason: record.description };
}

// ---------------------------------------------------------------------------
// Filing-lifecycle fold (D-BA-RETURN-OF-RECORD-EVENT-FAMILY). For a given form,
// fold the born-V2 ReportGenerated (return-of-record) + ReportFiled events into
// the reporting-period / last-filed / mode the page renders. The latest
// (entity, form, period) wins; absent events ⇒ undefined ⇒ page renders "—".
// SOURCE, don't fabricate (Charter cmd 4 / cmd 2).
// ---------------------------------------------------------------------------

function foldFiling(
  eventStore: EventStore,
  entity: string,
  formId: string,
): FinanceReturnFiling | undefined {
  const provenanceFilter = defaultProvenanceFilter();

  // Latest return-of-record (append-only; last wins) for this form.
  let latestGenerated:
    | { reportingPeriod: string; contentHash: string; generatedAt: string }
    | undefined;
  for (const ev of eventStore.replay({ entity, type: "ReportGenerated" })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as {
      formId?: string;
      reportingPeriod?: string;
      contentHash?: string;
      generatedAt?: string;
    };
    if (p.formId !== formId || !p.reportingPeriod || !p.contentHash) continue;
    latestGenerated = {
      reportingPeriod: p.reportingPeriod,
      contentHash: p.contentHash,
      generatedAt: p.generatedAt ?? ev.as_of,
    };
  }
  if (latestGenerated === undefined) return undefined;

  // Latest filing for the SAME reporting period (the return-of-record's period).
  let lastFiled: string | null = null;
  let mode: "simulator" | "live" | null = null;
  for (const ev of eventStore.replay({ entity, type: "ReportFiled" })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as {
      formId?: string;
      reportingPeriod?: string;
      filedAt?: string;
      mode?: "simulator" | "live";
    };
    if (p.formId !== formId || p.reportingPeriod !== latestGenerated.reportingPeriod) continue;
    lastFiled = p.filedAt ?? ev.as_of;
    mode = p.mode ?? null;
  }

  return {
    reportingPeriod: latestGenerated.reportingPeriod,
    lastFiled,
    mode,
    contentHash: latestGenerated.contentHash,
  };
}

// ---------------------------------------------------------------------------
// V2-ONLY sourcing. This page reads the V2 projections DIRECTLY — never the
// flag-gated `selectRegulatoryReturn` dual-read (which falls back to the V1
// generators when `useV2Store` is off). No V1 data reaches this surface
// (D-V1-REMOVAL-PHASE-1; the CLAUDE.md V1-retirement directive — new code routes
// through v2-core / V2 projections, never V1):
//   - BA 700 → computeBA700V2 (GlPostingEmitted capital + CcrEadComputed credit
//              RWA + market RWA from the BA-320 V2 charge).
//   - BA 320 → computeBA320V2 (FilInstrumentCreated/Terminated FIL FX).
//   - BA 100 → computeTrialBalanceV2 (pure fold over GlPostingEmitted — the V2
//              GL posting event — NOT the V1 SubLedgerPostingEmitted).
//
// Entity is the sourced canonical anchor (CANONICAL_LEGAL_ENTITY_ID), never a
// literal; the as-of bound captures the whole build-phase window (mirrors the
// V2 parity gates). Charter cmd 4 (source, don't hardcode) / cmd 2 (fail-closed).
// ---------------------------------------------------------------------------

const RETURNS_ENTITY = CANONICAL_LEGAL_ENTITY_ID;
const RETURNS_AS_OF = "2099-12-31"; // broad window capturing all build-phase events
const BA100_PERIOD_START = "2026-01-01";
const BA100_PERIOD_END = "2099-12-31";
const BA100_PERIOD_ID = "period:hoz-bank:build-phase";

// Minor → decimal-native Money. The V2 projections expose `*Minor` integers
// internally; they are lifted to the canonical major-unit Money type EXACTLY
// ONCE here, at the V2 boundary. The page never sees a minor-unit integer and
// never divides by 100 (Charter cmd 4; feedback_no_minor_money_decimal_native).
function liftMoney(minor: number, ccy: string): Money<Currency> {
  // The source figures are minor-unit INTEGERS (toMinorUnits output); BigInt is
  // exact and fail-closed if a non-integer ever leaks (no float rounding here —
  // D-DECIMAL-NATIVE-MONEY-ARITHMETIC).
  return moneyFromMinorUnits(BigInt(minor), ccy as Currency);
}

function liftMoneyOrNull(minor: number | null | undefined, ccy: string): Money<Currency> | null {
  return minor === null || minor === undefined ? null : liftMoney(minor, ccy);
}

/** BA 700 capital-adequacy page figures, sourced from the V2 projection. */
function ba700PageFromV2(
  eventStore: EventStore,
  marketData: MarketDataStore,
  ccy: string,
): Ba700PageFigures {
  const v2 = computeBA700V2({
    eventStore,
    asOf: RETURNS_AS_OF,
    entity: RETURNS_ENTITY,
    functionalCurrency: ccy,
    marketDataStore: marketData,
  });
  const ca = v2.capitalAdequacy;
  return {
    kind: "ba700",
    tier1Capital: liftMoney(ca.tier1Capital, ccy),
    tier2Capital: liftMoney(ca.tier2Capital, ccy),
    totalRwa: liftMoney(ca.totalRwa, ccy),
    carRatio: ca.carRatio,
    coverageStatus: v2.meta.coverageStatus,
    gaps: v2.gaps,
  };
}

/** BA 320 FX market-risk page figures, sourced from the V2 projection. */
function ba320PageFromV2(
  eventStore: EventStore,
  marketData: MarketDataStore,
  ccy: string,
): Ba320PageFigures {
  const v2 = computeBA320V2({
    eventStore,
    asOf: RETURNS_AS_OF,
    entity: RETURNS_ENTITY,
    functionalCurrency: ccy,
    marketDataStore: marketData,
  });
  return {
    kind: "ba320",
    positions: v2.fx.positions.map((p) => ({
      baseCurrency: p.baseCurrency,
      netPositionFunctional: liftMoneyOrNull(p.netPositionFunctionalMinor, ccy),
      rateAvailable: p.rateAvailable,
    })),
    openPositionCharge: liftMoneyOrNull(v2.fx.openPositionChargeMinor, ccy),
    coverageStatus: v2.meta.coverageStatus,
    gaps: v2.gaps,
  };
}

// ---------------------------------------------------------------------------
// BA 100 (Balance Sheet) — on-demand V2 read-path live figures. A pure
// projection over the event log, no event side-effects:
//
//   computeTrialBalanceV2 (pure fold over GlPostingEmitted — the V2 GL posting
//      event, NOT the V1 SubLedgerPostingEmitted) → generateBa100BalanceSheet
//      with a CoA-derived classification map → decimal-native section totals.
//
// The classification map is DERIVED from the CoA registry category prefix
// (Charter cmd 4 — source, don't hand-key); income/expense, memorandum and
// off-balance-sheet accounts are excluded (not balance-sheet sections). On a
// store with no GL postings the balance sheet is honestly empty/zero rather
// than fabricated.
// ---------------------------------------------------------------------------

function ba100SectionForCategory(category: string): "assets" | "liabilities" | "equity" | null {
  if (category.startsWith("asset")) return "assets";
  if (category.startsWith("liability")) return "liabilities";
  if (category.startsWith("equity")) return "equity";
  // income / expense (close to retained earnings) / memorandum / unknown — not a
  // balance-sheet section.
  return null;
}

function deriveBa100Classifications(): readonly Ba100LineClassification[] {
  const out: Ba100LineClassification[] = [];
  for (const a of COA_ACCOUNTS) {
    if (isOffBalanceSheetAccountId(a.id)) continue;
    const section = ba100SectionForCategory(a.category);
    if (section === null) continue;
    out.push({ leafAccountId: a.id, section, lineLabel: `${section}.${a.name}` });
  }
  return out;
}

function buildBa100PageFigures(eventStore: EventStore, ccy: string): Ba100PageFigures {
  const tb = computeTrialBalanceV2({
    eventStore,
    entity: RETURNS_ENTITY,
    periodStart: BA100_PERIOD_START,
    periodEnd: BA100_PERIOD_END,
  });
  const sheet = generateBa100BalanceSheet({
    entity: RETURNS_ENTITY,
    asOf: RETURNS_AS_OF,
    periodId: BA100_PERIOD_ID,
    functionalCurrency: ccy,
    trialBalance: tb.rows,
    classifications: deriveBa100Classifications(),
    // This read-path fold does NOT close P&L to retained earnings, so the strict
    // `assets ≡ liabilities + equity` invariant can legitimately not hold. We
    // tolerate the imbalance and surface `balanced` honestly rather than throwing
    // (Charter cmd 2 — fail-closed becomes surface-honestly here, never fabricate).
    tolerateImbalanceMinor: Number.MAX_SAFE_INTEGER,
  });

  const lines: Ba100PageLine[] = [];
  for (const sec of [sheet.assets, sheet.liabilities, sheet.equity] as const) {
    for (const li of sec.lineItems) {
      // li.amount is already decimal-native Money from the generator.
      lines.push({ section: sec.section, label: li.lineLabel, amount: li.amount });
    }
  }

  return {
    kind: "ba100",
    assets: liftMoney(sheet.assets.totalMinor, ccy),
    liabilities: liftMoney(sheet.liabilities.totalMinor, ccy),
    equity: liftMoney(sheet.equity.totalMinor, ccy),
    balanced: sheet.balanceCheck.balanced,
    lines,
    classificationGapCount: sheet.classificationGaps.length,
    coverageStatus: tb.rows.length === 0 ? "no-data" : "v2-trial-balance",
  };
}

// ---------------------------------------------------------------------------
// Headline summaries for the live returns (decimal-native; sourced figures).
// ---------------------------------------------------------------------------

function ba700Summary(f: Ba700PageFigures): string {
  if (f.carRatio === null) {
    return "Total capital ratio — (RWA is zero on the build store; no real capital pre-licence-day)";
  }
  return `Total capital ratio ${(f.carRatio * 100).toFixed(2)}%`;
}

function ba320Summary(f: Ba320PageFigures): string {
  if (f.openPositionCharge === null) {
    return "FX open-position charge — (no production FX rate; fail-closed)";
  }
  return `FX open-position charge ${f.openPositionCharge.currency} ${f.openPositionCharge.amount}`;
}

function ba100Summary(f: Ba100PageFigures): string {
  const head = `Total assets ${f.assets.currency} ${f.assets.amount}`;
  return f.balanced ? head : `${head} (unbalanced — P&L not yet closed)`;
}

// ---------------------------------------------------------------------------
// Provenance lens. The page's Prod / +Sim toggle arrives as a ProvenanceFilter
// (`production-only` for Prod, `combined` for +Sim). The V2 projections read the
// active lens through `defaultProvenanceFilter()`, so we pin it for the duration
// of the SYNCHRONOUS fold via the process-local override (the SAME mechanism
// buildBa320MarketRiskCharge documents). No await runs between set and reset, so
// concurrent requests cannot interleave. This is what makes the simulated
// trading book + R300m capital injection visible under +Sim and absent under
// Prod (D-V2-UI-VISIBILITY-REMEDIATION).
// ---------------------------------------------------------------------------

function withProvenance<T>(filter: ProvenanceFilter, fn: () => T): T {
  setDefaultProvenanceModeOverride(filter.mode);
  try {
    return fn();
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }
}

// ---------------------------------------------------------------------------
// buildFinanceReturnsView — the route-boundary view builder.
// ---------------------------------------------------------------------------

export function buildFinanceReturnsView(
  eventStore: EventStore,
  marketData: MarketDataStore,
  filter: ProvenanceFilter,
): FinanceReturnsView {
  return withProvenance(filter, () => buildFinanceReturnsViewInner(eventStore, marketData));
}

function buildFinanceReturnsViewInner(
  eventStore: EventStore,
  marketData: MarketDataStore,
): FinanceReturnsView {
  const functionalCurrency = anchorFunctionalCurrency();

  // The live returns, sourced DIRECTLY from the V2 projections (no V1 fallback).
  const liveByForm = new Map<string, FinanceReturnRow>();

  const ba700Figures = ba700PageFromV2(eventStore, marketData, functionalCurrency);
  const ba700Filing = foldFiling(eventStore, RETURNS_ENTITY, "BA700");
  liveByForm.set("BA700", {
    formId: "BA700",
    form: "BA 700",
    name: loadReturnContract("BA700").formName,
    status: "live",
    summary: ba700Summary(ba700Figures),
    figures: ba700Figures,
    readPath: "v2",
    gaps: ba700Figures.gaps,
    ...(ba700Filing !== undefined ? { filing: ba700Filing } : {}),
  });

  const ba320Figures = ba320PageFromV2(eventStore, marketData, functionalCurrency);
  const ba320Filing = foldFiling(eventStore, RETURNS_ENTITY, "BA320");
  liveByForm.set("BA320", {
    formId: "BA320",
    form: "BA 320",
    name: loadReturnContract("BA320").formName,
    status: "live",
    summary: ba320Summary(ba320Figures),
    figures: ba320Figures,
    readPath: "v2",
    gaps: ba320Figures.gaps,
    ...(ba320Filing !== undefined ? { filing: ba320Filing } : {}),
  });

  // BA 100 (Balance Sheet) — on-demand V2 read-path figures, folded from the V2
  // trial balance over the event log (pure; no event side-effects).
  const ba100Figures = buildBa100PageFigures(eventStore, functionalCurrency);
  const ba100Filing = foldFiling(eventStore, RETURNS_ENTITY, "BA100");
  liveByForm.set("BA100", {
    formId: "BA100",
    form: "BA 100",
    name: loadReturnContract("BA100").formName,
    status: "live",
    summary: ba100Summary(ba100Figures),
    figures: ba100Figures,
    readPath: "v2",
    gaps: [],
    ...(ba100Filing !== undefined ? { filing: ba100Filing } : {}),
  });

  // Build one row per canonical §1 return, in registry order. Live rows reuse
  // the populated entries; everything else is `planned` (a typed contract
  // exists, but no on-demand figure-producing route).
  const returns: FinanceReturnRow[] = [];
  for (const entry of RETURN_CONTRACT_REGISTRY) {
    if (SUPPLEMENTARY_FORMS.has(entry.form)) continue;
    const live = liveByForm.get(entry.form);
    if (live !== undefined) {
      returns.push(live);
      continue;
    }
    returns.push({
      formId: entry.form,
      form: displayFormNumber(entry.form),
      name: loadReturnContract(entry.form).formName,
      status: "planned",
    });
  }

  const liveCount = returns.filter((r) => r.status === "live").length;

  return {
    asOf: RETURNS_AS_OF,
    functionalCurrency,
    entity: RETURNS_ENTITY,
    liveCount,
    totalCount: returns.length,
    filingLifecycleGap: filingLifecycleGap(),
    returns,
  };
}

// ---------------------------------------------------------------------------
// Per-form live figures — the SINGLE source the list view and the detail view
// both reuse (Principle 2 — no duplicated derivation). Returns `undefined` for
// forms with no on-demand figure-producing route.
// ---------------------------------------------------------------------------

export function liveFiguresForForm(
  formId: ReturnForm,
  eventStore: EventStore,
  marketData: MarketDataStore,
): FinanceReturnFigures | undefined {
  const ccy = anchorFunctionalCurrency();
  if (formId === "BA700") return ba700PageFromV2(eventStore, marketData, ccy);
  if (formId === "BA320") return ba320PageFromV2(eventStore, marketData, ccy);
  if (formId === "BA100") return buildBa100PageFigures(eventStore, ccy);
  return undefined;
}

// ---------------------------------------------------------------------------
// SOUND per-cell values — the form-level AGGREGATE cells only.
//
// A granular per-line value cannot be produced soundly from today's substrate:
//   - the chart-of-accounts is COARSER than the SARB form lines (e.g. BA 100
//     rows R0040/R0050/R0060 all fold to `category:asset-cash`), so splitting a
//     category across its form rows would double-count in the subtotals; and
//   - GL postings carry no banking/trading book dimension, so the per-book
//     columns (Banking / Trading) cannot be filled.
// What IS sound is the GRAND-TOTAL cell of a section — it equals the validated,
// provenance-aware figure the page already computes (assets / liabilities /
// equity totals; the aggregate RWA). Each mapping below is pinned to an explicit
// (row, column) coordinate and GUARDED by a rowLabel keyword so a contract edit
// that moves the line silently drops the value rather than mis-placing it
// (fail-safe). Filling the rest awaits finer CoA→line mapping + book/entity
// dimensioning on postings (a finance/risk-seat substrate programme), not a
// dashboard guess. Charter cmd 2 (fail-closed) / cmd 4 (source, don't fabricate).
// ---------------------------------------------------------------------------

interface HeadlineCellMap {
  readonly row: string;
  readonly column: string;
  /** Lowercased keyword the target cell's rowLabel must contain (drift guard). */
  readonly keyword: string;
  readonly pick: (figures: FinanceReturnFigures) => Money<Currency> | null;
}

const HEADLINE_CELLS: Partial<Record<ReturnForm, readonly HeadlineCellMap[]>> = {
  BA100: [
    {
      row: "R0540",
      column: "C0040",
      keyword: "total assets",
      pick: (f) => (f.kind === "ba100" ? f.assets : null),
    },
    {
      row: "R0790",
      column: "C0040",
      keyword: "total liabilities",
      pick: (f) => (f.kind === "ba100" ? f.liabilities : null),
    },
    {
      row: "R0870",
      column: "C0040",
      keyword: "total equity",
      pick: (f) => (f.kind === "ba100" ? f.equity : null),
    },
  ],
  BA700: [
    {
      row: "R0030",
      column: "C0080",
      keyword: "aggregate risk weighted",
      pick: (f) => (f.kind === "ba700" ? f.totalRwa : null),
    },
  ],
};

/** Resolve the sound headline cell values, keyed by xsdElement. */
export function headlineValuesByXsd(
  formId: ReturnForm,
  contract: ReturnType<typeof loadReturnContract>,
  figures: FinanceReturnFigures | undefined,
): Map<string, FinanceReturnCellValue> {
  const out = new Map<string, FinanceReturnCellValue>();
  if (figures === undefined) return out;
  for (const h of HEADLINE_CELLS[formId] ?? []) {
    const cell = contract.cells.find(
      (c) => c.cellRef.row === h.row && c.cellRef.column === h.column,
    );
    // Drift guard: the coordinate must still carry the expected line (else skip —
    // never place a value on the wrong cell).
    if (cell === undefined) continue;
    if (!(cell.cellRef.rowLabel ?? "").toLowerCase().includes(h.keyword)) continue;
    const money = h.pick(figures);
    if (money === null) continue;
    out.set(cell.cellRef.xsdElement, {
      amount: money.amount,
      valueType: "money",
      currency: money.currency,
      source: "headline",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Return DETAIL view — the full per-return cell spreadsheet.
//
// Surfaces EVERY cell of the typed per-cell data-requirement contract
// (v2-core/regulatory-returns/<form>-contract.json — the SARB Excel/XSD form
// transcribed verbatim, gated by recon:ba-return-cell-contract) plus the live
// computed figures where a figure-producing route exists. Source, don't
// hardcode (Charter cmd 4): the grid is the loaded contract, never re-keyed.
// ---------------------------------------------------------------------------

/** One cell of a return's contract, flattened for the spreadsheet grid. */
export interface FinanceReturnCell {
  /** XSD/upload-schema element id (e.g. "BA01015768"). */
  readonly xsdElement: string;
  /** Grid row coordinate (e.g. "R0010") — null for form-level meta cells. */
  readonly row: string | null;
  readonly rowLabel: string | null;
  /** Grid column coordinate (e.g. "C0010") — null for meta cells. */
  readonly column: string | null;
  readonly columnLabel: string | null;
  /** Official composed cell label. */
  readonly label: string;
  /** What the cell means — its regulatory definition (verbatim from the XSD). */
  readonly regulatoryDefinition: string;
  readonly valueType: string;
  readonly unit: string;
  /** sourced | counsel-gated-TBC | licence-day-data. */
  readonly status: string;
  /** Honest reason when status !== "sourced". */
  readonly statusReason: string | null;
  readonly derivationKind: string;
  readonly derivationExpression: string;
  /** Primary clause citation (P2 upward link). */
  readonly citation: string;
  /**
   * The cell's computed numeric value, where the substrate can source it SOUNDLY:
   * the form-level aggregate cells (HEADLINE_CELLS) always, PLUS the full per-line
   * value engine for any form whose owning seat has authored a line attribution
   * (D-BA-RETURN-CELL-VALUE-ENGINE; Phase 1, per return). null for cells with no
   * sound source yet — honest, never a guessed number (Charter cmd 2 / cmd 4).
   */
  readonly value: FinanceReturnCellValue | null;
}

/**
 * Where a soundly-sourced cell value came from — surfaced so the overseer can see
 * WHICH cells the per-cell leaf-fold engine resolved directly from the events,
 * vs the form-level aggregate roll-ups, vs the engine's own subtotal arithmetic:
 *   - `leaf-fold`  — folded DIRECTLY from the underlying events by the seat-owned
 *                    per-cell leaf fold (D-BA-RETURN-CELL-VALUE-ENGINE). The
 *                    granular, event-sourced per-line value the brief asks the page
 *                    to surface (e.g. BA 100 capital R0040/R0810, deposit detail
 *                    R0570–R0620, R1010 sector analysis once that data is in store).
 *   - `derived`    — computed by the generic engine's own sum/formula arithmetic
 *                    over the resolved leaves (a subtotal / total line).
 *   - `headline`   — a form-level AGGREGATE figure from the legacy on-demand
 *                    projection (HEADLINE_CELLS), placed on its section-total cell.
 * The page styles + legends each source distinctly. This is GENERIC: any form's
 * leaf fold marks its own leaves, so loan-advances / FX-residency rows light up as
 * `leaf-fold` automatically once those folds + their data land — no per-row list.
 */
export type FinanceReturnCellValueSource = "leaf-fold" | "derived" | "headline";

/** A soundly-sourced cell value: decimal-native, provenance-aware. */
export interface FinanceReturnCellValue {
  /** Decimal-native major-unit amount (money) or percentage value (ratio). */
  readonly amount: string;
  readonly valueType: "money" | "ratio";
  /** ISO-4217 currency for money values; null for ratios. */
  readonly currency: string | null;
  /** Provenance of the value within the cell-value pipeline (see the type doc). */
  readonly source: FinanceReturnCellValueSource;
}

export interface FinanceReturnDetailView {
  readonly formId: string;
  /** Display form number, e.g. "BA 700". */
  readonly form: string;
  /** Official form name (Excel A1), verbatim from the contract. */
  readonly name: string;
  readonly functionalCurrency: string;
  readonly cellCount: number;
  readonly statusCounts: {
    readonly sourced: number;
    readonly counselGatedTbc: number;
    readonly licenceDayData: number;
  };
  /** Distinct grid columns (coordinate + label), in coordinate order. */
  readonly columns: readonly { readonly column: string; readonly label: string }[];
  /** Computed live figures, where a figure-producing route exists (else absent). */
  readonly figures?: FinanceReturnFigures;
  readonly cells: readonly FinanceReturnCell[];
}

/**
 * Build the full cell-spreadsheet detail view for one return form. Throws (→ the
 * route returns 404) when `formId` is not a registered contract.
 */
export function buildFinanceReturnDetailView(
  formId: ReturnForm,
  eventStore: EventStore,
  marketData: MarketDataStore,
  filter: ProvenanceFilter,
): FinanceReturnDetailView {
  return withProvenance(filter, () =>
    buildFinanceReturnDetailViewInner(formId, eventStore, marketData),
  );
}

function buildFinanceReturnDetailViewInner(
  formId: ReturnForm,
  eventStore: EventStore,
  marketData: MarketDataStore,
): FinanceReturnDetailView {
  const contract = loadReturnContract(formId);
  const functionalCurrency = anchorFunctionalCurrency();

  // Figures first — the sound headline cell values are derived from them.
  const figures = liveFiguresForForm(formId, eventStore, marketData);

  // Per-cell values: the headline aggregate cells always; PLUS the full per-line
  // engine for any form whose owning seat has authored a LEAF FOLD (none yet —
  // Phase 1). The leaf fold reads the underlying EVENTS directly (a return and the
  // CoA are sibling folds of the same log — granularity comes from the events, not
  // the CoA). It runs under the active provenance lens (pinned by withProvenance),
  // then the generic engine computes the form's subtotals/totals via the form's
  // own arithmetic. Engine values win on overlap (they compute the totals too).
  const valueByXsd = new Map<string, FinanceReturnCellValue>(
    headlineValuesByXsd(formId, contract, figures),
  );
  const leafFold = leafFoldFor(formId);
  if (leafFold !== undefined) {
    const leafValues = leafFold({
      eventStore,
      marketData,
      entity: RETURNS_ENTITY,
      asOf: RETURNS_AS_OF,
      functionalCurrency,
    });
    // The set of cell COORDINATES (`"<row> <column>"`) the leaf fold resolved
    // DIRECTLY from the events — these are the granular, event-sourced per-line
    // values (`source:"leaf-fold"`); every other cell the engine fills is a
    // computed subtotal/total (`source:"derived"`). The distinction is GENERIC:
    // it falls out of which coordinates the fold returned, so any form's leaves are
    // marked without a per-row list. We resolve each xsdElement back to its
    // coordinate via the contract to classify.
    const leafCoords = new Set(leafValues.keys());
    const coordByXsd = new Map<string, string>();
    for (const c of contract.cells) {
      if (c.cellRef.row !== undefined && c.cellRef.column !== undefined) {
        coordByXsd.set(c.cellRef.xsdElement, `${c.cellRef.row} ${c.cellRef.column}`);
      }
    }
    for (const [xsd, v] of computeDerivedCells({ contract, leafValues, functionalCurrency })) {
      const coord = coordByXsd.get(xsd);
      const source: FinanceReturnCellValueSource =
        coord !== undefined && leafCoords.has(coord) ? "leaf-fold" : "derived";
      // Engine values win on overlap (they compute the totals too) — including over
      // a legacy headline placement on the same cell, which the leaf-fold/derived
      // value supersedes with its sourced provenance.
      valueByXsd.set(xsd, { ...v, source });
    }
  }

  const counts = { sourced: 0, counselGatedTbc: 0, licenceDayData: 0 };
  const columnMap = new Map<string, string>();
  const cells: FinanceReturnCell[] = contract.cells.map((c) => {
    if (c.status === "sourced") counts.sourced += 1;
    else if (c.status === "counsel-gated-TBC") counts.counselGatedTbc += 1;
    else counts.licenceDayData += 1;
    if (c.cellRef.column !== undefined && !columnMap.has(c.cellRef.column)) {
      columnMap.set(c.cellRef.column, c.cellRef.columnLabel ?? c.cellRef.column);
    }
    const primary = c.citations[0];
    return {
      xsdElement: c.cellRef.xsdElement,
      row: c.cellRef.row ?? null,
      rowLabel: c.cellRef.rowLabel ?? null,
      column: c.cellRef.column ?? null,
      columnLabel: c.cellRef.columnLabel ?? null,
      label: c.label,
      regulatoryDefinition: c.regulatoryDefinition,
      valueType: c.valueType,
      unit: c.unit,
      status: c.status,
      statusReason: c.statusReason ?? null,
      derivationKind: c.derivation.kind,
      derivationExpression: c.derivation.expression,
      citation: primary !== undefined ? primary.clause : "",
      value: valueByXsd.get(c.cellRef.xsdElement) ?? null,
    };
  });

  const columns = [...columnMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([column, label]) => ({ column, label }));

  return {
    formId,
    form: displayFormNumber(formId),
    name: contract.formName,
    functionalCurrency,
    cellCount: cells.length,
    statusCounts: counts,
    columns,
    ...(figures !== undefined ? { figures } : {}),
    cells,
  };
}
