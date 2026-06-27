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
//   2. The live figures come from `selectRegulatoryReturn(...)`
//      (dashboard/regulatory-returns-view.ts) — the existing route-boundary
//      dual-read for BA 700 / BA 320. It is REUSED, not duplicated.
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
//   - `live`    — BA 700 and BA 320 ONLY (served on demand by
//                 selectRegulatoryReturn; figures populated below).
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

import { computeTrialBalance } from "../platform/accounting/period-close";
import { type Money, moneyFromMinorUnits } from "../platform/core/decimal-money";
import type { Currency } from "../platform/core/types";
import type { EventStore } from "../platform/event-store/store";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import type { MarketDataStore } from "../platform/market-data/store";
import {
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../platform/projections/filter";
import {
  type Ba100LineClassification,
  generateBa100BalanceSheet,
  isOffBalanceSheetAccountId,
} from "../platform/reporting/ba-100-balance-sheet";
import { getSubstrateGap } from "../platform/substrate/gap-register";
import { COA_ACCOUNTS } from "../v2-core/accounting/chart-of-accounts";
import type { ReturnForm } from "../v2-core/regulatory-returns/cell-contract";
import {
  RETURN_CONTRACT_REGISTRY,
  loadReturnContract,
} from "../v2-core/regulatory-returns/return-contracts";
import {
  type BA320ViewFigures,
  type BA700ViewFigures,
  selectRegulatoryReturn,
} from "./regulatory-returns-view";

// ---------------------------------------------------------------------------
// View shapes — the V2 boundary DTO.
// ---------------------------------------------------------------------------

export type ReturnBuildStatus = "live" | "built" | "planned";

// ---------------------------------------------------------------------------
// Page-facing figures — DECIMAL-NATIVE money (Charter cmd 4; feedback_no_minor_
// money_decimal_native). Money is carried as the canonical major-unit `Money`
// type ({amount: "73750000.00", currency: "ZAR"}) — NEVER a minor-unit integer
// and NEVER divided by 100 on the page. The underlying selectRegulatoryReturn /
// BA-100 generators still expose `*Minor` integers internally; they are lifted
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
// Minor → decimal-native Money lifters. The selectRegulatoryReturn / BA-100
// generators still expose `*Minor` integers internally; they are lifted to the
// canonical major-unit Money type EXACTLY ONCE here, at the V2 boundary. The
// page never sees a minor-unit integer and never divides by 100 (Charter cmd 4;
// feedback_no_minor_money_decimal_native).
// ---------------------------------------------------------------------------

function liftMoney(minor: number, ccy: string): Money<Currency> {
  // The source figures are minor-unit INTEGERS (toMinorUnits output); BigInt is
  // exact and fail-closed if a non-integer ever leaks (no float rounding here —
  // D-DECIMAL-NATIVE-MONEY-ARITHMETIC).
  return moneyFromMinorUnits(BigInt(minor), ccy as Currency);
}

function liftMoneyOrNull(minor: number | null | undefined, ccy: string): Money<Currency> | null {
  return minor === null || minor === undefined ? null : liftMoney(minor, ccy);
}

function toBa700Page(f: BA700ViewFigures, ccy: string): Ba700PageFigures {
  return {
    kind: "ba700",
    tier1Capital: liftMoney(f.tier1Capital, ccy),
    tier2Capital: liftMoney(f.tier2Capital, ccy),
    totalRwa: liftMoney(f.totalRwa, ccy),
    carRatio: f.carRatio,
    coverageStatus: f.coverageStatus,
    gaps: f.gaps,
  };
}

function toBa320Page(f: BA320ViewFigures, ccy: string): Ba320PageFigures {
  return {
    kind: "ba320",
    positions: f.positions.map((p) => ({
      baseCurrency: p.baseCurrency,
      netPositionFunctional: liftMoneyOrNull(p.netPositionFunctionalMinor, ccy),
      rateAvailable: p.rateAvailable,
    })),
    openPositionCharge: liftMoneyOrNull(f.openPositionChargeMinor, ccy),
    coverageStatus: f.coverageStatus,
    gaps: f.gaps,
  };
}

// ---------------------------------------------------------------------------
// BA 100 (Balance Sheet) — on-demand read-path live figures. Mirrors the
// BA 700 / BA 320 dual-read shape: a pure projection over the event log, no
// event side-effects.
//
//   computeTrialBalance (pure fold over SubLedgerPostingEmitted — NOT the
//      event-emitting closePeriod) → generateBa100BalanceSheet with a CoA-
//      derived classification map → decimal-native section totals + lines.
//
// The classification map is DERIVED from the CoA registry category prefix
// (Charter cmd 4 — source, don't hand-key); income/expense, memorandum and
// off-balance-sheet accounts are excluded (not balance-sheet sections). On a
// store with no GL postings the balance sheet is honestly empty/zero rather
// than fabricated.
// ---------------------------------------------------------------------------

const BA100_PERIOD_START = "2026-01-01";
const BA100_PERIOD_END = "2099-12-31";
const BA100_PERIOD_ID = "period:hoz-bank:build-phase";

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

function buildBa100PageFigures(
  eventStore: EventStore,
  entity: string,
  asOf: string,
  ccy: string,
): Ba100PageFigures {
  const tb = computeTrialBalance({
    eventStore,
    entity,
    periodStart: BA100_PERIOD_START,
    periodEnd: BA100_PERIOD_END,
  });
  const sheet = generateBa100BalanceSheet({
    entity,
    asOf,
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
    coverageStatus: tb.rows.length === 0 ? "no-data" : "v1-trial-balance",
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
// buildFinanceReturnsView — the route-boundary view builder.
// ---------------------------------------------------------------------------

export function buildFinanceReturnsView(
  eventStore: EventStore,
  marketData: MarketDataStore,
): FinanceReturnsView {
  const functionalCurrency = anchorFunctionalCurrency();

  // The live returns, sourced via the SHARED selectRegulatoryReturn dual-read.
  const ba700 = selectRegulatoryReturn("ba700", eventStore, marketData);
  const ba320 = selectRegulatoryReturn("ba320", eventStore, marketData);

  const liveByForm = new Map<string, FinanceReturnRow>();

  const ba700Figures = toBa700Page(ba700.figures as BA700ViewFigures, functionalCurrency);
  const ba700Filing = foldFiling(eventStore, ba700.entity, "BA700");
  liveByForm.set("BA700", {
    form: "BA 700",
    name: loadReturnContract("BA700").formName,
    status: "live",
    summary: ba700Summary(ba700Figures),
    figures: ba700Figures,
    readPath: ba700.readPath,
    gaps: ba700Figures.gaps,
    ...(ba700Filing !== undefined ? { filing: ba700Filing } : {}),
  });

  const ba320Figures = toBa320Page(ba320.figures as BA320ViewFigures, functionalCurrency);
  const ba320Filing = foldFiling(eventStore, ba320.entity, "BA320");
  liveByForm.set("BA320", {
    form: "BA 320",
    name: loadReturnContract("BA320").formName,
    status: "live",
    summary: ba320Summary(ba320Figures),
    figures: ba320Figures,
    readPath: ba320.readPath,
    gaps: ba320Figures.gaps,
    ...(ba320Filing !== undefined ? { filing: ba320Filing } : {}),
  });

  // BA 100 (Balance Sheet) — on-demand read-path live figures, folded from the
  // trial balance over the event log (pure; no event side-effects).
  const ba100Figures = buildBa100PageFigures(
    eventStore,
    ba700.entity,
    ba700.asOf,
    functionalCurrency,
  );
  const ba100Filing = foldFiling(eventStore, ba700.entity, "BA100");
  liveByForm.set("BA100", {
    form: "BA 100",
    name: loadReturnContract("BA100").formName,
    status: "live",
    summary: ba100Summary(ba100Figures),
    figures: ba100Figures,
    readPath: "v1",
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
      form: displayFormNumber(entry.form),
      name: loadReturnContract(entry.form).formName,
      status: "planned",
    });
  }

  const liveCount = returns.filter((r) => r.status === "live").length;

  return {
    asOf: ba700.asOf,
    functionalCurrency,
    entity: ba700.entity,
    liveCount,
    totalCount: returns.length,
    filingLifecycleGap: filingLifecycleGap(),
    returns,
  };
}
