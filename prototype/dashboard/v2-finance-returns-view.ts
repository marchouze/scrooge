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
// rendered "—" / "N/A", never fabricated. The gap is tracked as a
// ProductDeferredGap-style register TODO — see GAP-BA-RETURNS-FILING-LIFECYCLE
// below and the deliverable.
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

import type { EventStore } from "../platform/event-store/store";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import type { MarketDataStore } from "../platform/market-data/store";
import { getSubstrateGap } from "../platform/substrate/gap-register";
import {
  RETURN_CONTRACT_REGISTRY,
  loadReturnContract,
} from "../v2-core/regulatory-returns/return-contracts";
import type { ReturnForm } from "../v2-core/regulatory-returns/cell-contract";
import {
  type BA320ViewFigures,
  type BA700ViewFigures,
  selectRegulatoryReturn,
} from "./regulatory-returns-view";

// ---------------------------------------------------------------------------
// View shapes — the V2 boundary DTO.
// ---------------------------------------------------------------------------

export type ReturnBuildStatus = "live" | "built" | "planned";

/** One row in the BA-return register. */
export interface FinanceReturnRow {
  /** Display form number, e.g. "BA 700" or "BA 941–944" (sourced, never hand-keyed). */
  readonly form: string;
  /** Official form name (Excel A1), verbatim from the typed contract. */
  readonly name: string;
  /** Build/data status — `live` for the two on-demand returns, else `planned`. */
  readonly status: ReturnBuildStatus;
  /** One-line headline for a live return (e.g. the CAR ratio or FX charge). */
  readonly summary?: string;
  /** The sourced figures for a live return (BA 700 capital or BA 320 FX). */
  readonly figures?: BA700ViewFigures | BA320ViewFigures;
  /** Which read path produced a live return's figures ("v1" | "v2"). */
  readonly readPath?: "v1" | "v2";
  /** Advisory gap markers carried through from the live return's projection. */
  readonly gaps?: readonly string[];
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
// Headline summaries for the two live returns (sourced figures only).
// ---------------------------------------------------------------------------

function ba700Summary(figures: BA700ViewFigures): string {
  if (figures.carRatio === null) {
    return "Capital ratio — (RWA is zero on the build store; no real capital pre-licence-day)";
  }
  return `Total capital ratio ${(figures.carRatio * 100).toFixed(2)}%`;
}

function ba320Summary(figures: BA320ViewFigures, functionalCurrency: string): string {
  if (figures.openPositionChargeMinor === null) {
    return "FX open-position charge — (no production FX rate; fail-closed)";
  }
  // Present minor units honestly as a labelled figure; the page formats it.
  return `FX open-position charge ${functionalCurrency} ${figures.openPositionChargeMinor} (minor units)`;
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

  const ba700Figures = ba700.figures as BA700ViewFigures;
  liveByForm.set("BA700", {
    form: "BA 700",
    name: loadReturnContract("BA700").formName,
    status: "live",
    summary: ba700Summary(ba700Figures),
    figures: ba700Figures,
    readPath: ba700.readPath,
    gaps: ba700Figures.gaps,
  });

  const ba320Figures = ba320.figures as BA320ViewFigures;
  liveByForm.set("BA320", {
    form: "BA 320",
    name: loadReturnContract("BA320").formName,
    status: "live",
    summary: ba320Summary(ba320Figures, functionalCurrency),
    figures: ba320Figures,
    readPath: ba320.readPath,
    gaps: ba320Figures.gaps,
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
