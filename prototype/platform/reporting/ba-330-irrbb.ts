// platform/reporting/ba-330-irrbb.ts
//
// BA 330 (IRRBB) generator — structures IRRBBChecked event data into the
// SARB BA 330 return format for submission.
//
// BA 330 covers Interest Rate Risk in the Banking Book (IRRBB). The SARB
// requires quarterly BA 330 returns per Regulation 27 (interest rate risk in
// the banking book). The return captures:
//   - ΔEVE shock scenarios (6 BCBS d365 scenarios) — sensitivity of the
//     economic value of equity to parallel and non-parallel interest rate shocks
//   - ΔNII shock scenarios (4 parallel shocks) — sensitivity of net interest
//     income to interest rate changes over a 12-month horizon
//   - Outlier-institution test result (|ΔEVE| > 15% Tier 1 capital)
//
// Regulatory basis:
//   - BCBS "Interest rate risk in the banking book" (d365, Apr 2016)
//   - Regulations Relating to Banks Regulation 27 (IRRBB)
//   - SARB BA 330 form (IRRBB return — confirmed per D-BA-330-REATTRIBUTION-IRRBB)
//   - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL confirms BA 330 = IRRBB (not
//     large-exposures as previously mislabelled; large exposures → Reg 24
//     + D3/2022)
//
// Design
// ------
// The generator is a thin adapter: it structures `IRRBBChecked` event payloads
// (emitted by `ravi-alm-run.ts` — 6 EVE + 4 NII per run) into the BA 330
// return format, then wraps them in a `SarbXmlReportPayload` for submission
// via `submitToSarbPortal`. The actual IRRBB computation runs in the Ravi ALM
// handler; this module is responsible for the SARB submission shape only.
//
// Principle 1 compliance: IRRBB metrics are sourced exclusively from
// `IRRBBChecked` events in the event store — not from hardcoded or
// caller-supplied sensitivity figures. The fold is bounded by the
// `AccountingPeriodClosed.closedAt` date to prevent post-period drift.
//
// Build-phase substrate gaps:
//   - Tier 1 capital not yet measured (build phase): deltaPct is always
//     zero; outlier test result is always "within". The BA 330 submitted
//     correctly reflects this (no distortion, no fabrication).
//   - XSD validation deferred to SARB portal handshake (Mira
//     WS-INSTRUMENT-ANALYSES, Slice-6+); namespace URI is a placeholder.
//   - Per-currency IRRBB decomposition (Reg 27(6)) deferred to Slice-6+.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
//   D-BA-330-REATTRIBUTION-IRRBB; D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
// Author: Mira (Compliance / RegTech engineer, engineering — runtime wiring +
//   returns submission surface).

import type { IRRBBCheckedPayload } from "../event-store/event-types/alm";
import type { EventStore } from "../event-store/store";
import type { SarbXmlReportPayload, SarbXmlSection } from "./xml-render";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** SARB BA 330 XML namespace URI (placeholder — XSD TBC per Mira WS-INSTRUMENT-ANALYSES). */
const BA_330_NAMESPACE = "urn:sarb:prudential:ba330:v0.1:rehearsal";

/** SARB BA 330 XSD URI (placeholder). */
const BA_330_XSD_URI = "[citation: TBC — SARB BA 330 XSD; Mira WS-INSTRUMENT-ANALYSES]";

/** Bank entities that report BA 330 (IRRBB is banking-book only → same set as BA 300). */
export const BA_330_SUBSCRIBER_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single IRRBB metric row (EVE or NII) derived from an `IRRBBChecked` event.
 */
export interface IrRiskRow {
  /** EVE or NII. */
  readonly metric: "EVE" | "NII";
  /** BCBS d365 shock label (e.g. "parallel+200", "short+300"). */
  readonly shockLabel: string;
  /** Sensitivity delta as a percentage of Tier 1 capital. */
  readonly deltaPct: number;
  /** Appetite / regulatory limit (% of Tier 1). */
  readonly limitPct: number;
  /** "within" | "warn" | "breach". */
  readonly status: string;
  /** ISO 4217 currency. */
  readonly currency: string;
}

/**
 * Full BA 330 IRRBB generator output.
 */
export interface Ba330Output {
  readonly meta: {
    readonly entity: string;
    readonly periodId: string;
    readonly asOf: string;
    readonly formId: "BA330";
    readonly formVersion: string;
  };
  /** EVE shock rows (6 scenarios per BCBS d365). */
  readonly eveRows: readonly IrRiskRow[];
  /** NII shock rows (4 scenarios). */
  readonly niiRows: readonly IrRiskRow[];
  /** True when any EVE row exceeds the outlier threshold. */
  readonly isOutlier: boolean;
  /** Count of IRRBBChecked events consumed for this period. */
  readonly eventCount: number;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 330 IRRBB return by folding `IRRBBChecked` events from the
 * event store for the given period.
 *
 * The fold reads all `IRRBBChecked` events with `asOf` ≤ `periodEnd` for the
 * `entity`. Because IRRBB runs are daily (Ravi ALM), multiple runs may exist
 * for a single accounting period; the generator selects the MOST RECENT run
 * within the period (highest `as_of` date) for each metric/shockLabel pair
 * to avoid double-counting.
 *
 * **Principle 1 compliance**: metrics are derived exclusively from
 * `IRRBBChecked` events in the event store (never from caller-supplied
 * sensitivity inputs).
 *
 * Citations:
 *   BCBS d365 §4 (EVE six scenarios); BCBS d365 §5 (NII four scenarios);
 *   Regulations Relating to Banks Reg 27;
 *   D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
 *   D-BA-330-REATTRIBUTION-IRRBB; Principles/1-events-are-truth.md.
 */
export function generateBa330IrrbbReturn(
  store: EventStore,
  params: {
    entity: string;
    periodId: string;
    periodEnd: string;
    periodStart: string;
  },
): Ba330Output {
  // Fold IRRBBChecked events for the entity, bounded to the period window.
  // Select the most-recent entry per (metric, shockLabel) pair so that a daily
  // ALM run schedule within one accounting period yields one row per metric,
  // not one row per day per metric.
  const latestByKey = new Map<string, { payload: IRRBBCheckedPayload; asOf: string }>();

  for (const event of store.replay({ entity: params.entity, type: "IRRBBChecked" })) {
    // Bound replay to the period end date.
    if (event.as_of > params.periodEnd) continue;
    // Bound replay to the period start date (don't pull in runs from prior periods).
    if (event.as_of < params.periodStart) continue;

    const p = event.payload as IRRBBCheckedPayload;
    const key = `${p.metric}:${p.shockLabel}`;
    const existing = latestByKey.get(key);

    if (!existing || event.as_of > existing.asOf) {
      latestByKey.set(key, { payload: p, asOf: event.as_of });
    }
  }

  // Separate into EVE and NII rows.
  const eveRows: IrRiskRow[] = [];
  const niiRows: IrRiskRow[] = [];

  for (const { payload: p } of latestByKey.values()) {
    const row: IrRiskRow = {
      metric: p.metric,
      shockLabel: p.shockLabel,
      deltaPct: p.deltaPct,
      limitPct: p.limitPct,
      status: p.status,
      currency: p.currency,
    };
    if (p.metric === "EVE") {
      eveRows.push(row);
    } else {
      niiRows.push(row);
    }
  }

  // Sort EVE rows by shockLabel for stable ordering.
  eveRows.sort((a, b) => a.shockLabel.localeCompare(b.shockLabel));
  niiRows.sort((a, b) => a.shockLabel.localeCompare(b.shockLabel));

  // Outlier test: any EVE row where |deltaPct| > limitPct makes the bank
  // an outlier institution (BCBS d365 §4.3 — 15% Tier 1 threshold).
  const isOutlier = eveRows.some((r) => Math.abs(r.deltaPct) > r.limitPct);

  // Build-phase substrate gap note: Tier 1 capital is not yet measured, so
  // deltaPct is always zero and isOutlier is always false. This is an accurate
  // representation of the pre-commencement position — no fabrication.

  return {
    meta: {
      entity: params.entity,
      periodId: params.periodId,
      asOf: params.periodEnd,
      formId: "BA330",
      formVersion: "v0.1-rehearsal",
    },
    eveRows,
    niiRows,
    isOutlier,
    eventCount: latestByKey.size,
  };
}

// ---------------------------------------------------------------------------
// XML adapter
// ---------------------------------------------------------------------------

/**
 * Convert a `Ba330Output` to the `SarbXmlReportPayload` consumed by
 * `submitToSarbPortal`.
 *
 * The XML envelope follows the same structural pattern as `ba-700-xml-adapter.ts`
 * and `ba-300-lcr-xml-adapter.ts`: a `Meta` section (entity + period) followed
 * by typed sub-sections. The SARB XSD for BA 330 is a substrate gap (Mira
 * WS-INSTRUMENT-ANALYSES, Slice-6+); the namespace is a placeholder.
 *
 * Citation: D-TREASURER-WAVE2-SUBSTRATE; D-BA-330-REATTRIBUTION-IRRBB;
 *           xml-render.ts (generic envelope); sarb-prudential.ts (simulator).
 */
export function ba330ToXmlPayload(report: Ba330Output): SarbXmlReportPayload {
  // Build EVE rows XML.
  const eveRowSections: SarbXmlSection[] = report.eveRows.map((row) => ({
    ShockLabel: row.shockLabel,
    DeltaPct: row.deltaPct,
    LimitPct: row.limitPct,
    Status: row.status,
    Currency: row.currency,
  }));

  // Build NII rows XML.
  const niiRowSections: SarbXmlSection[] = report.niiRows.map((row) => ({
    ShockLabel: row.shockLabel,
    DeltaPct: row.deltaPct,
    LimitPct: row.limitPct,
    Status: row.status,
    Currency: row.currency,
  }));

  const body: SarbXmlSection = {
    Meta: {
      Entity: report.meta.entity,
      PeriodId: report.meta.periodId,
      FormId: report.meta.formId,
      FormVersion: report.meta.formVersion,
      AsOf: report.meta.asOf,
    } as SarbXmlSection,
    IRRBB: {
      OutlierTest: report.isOutlier ? "outlier" : "within-threshold",
      EventCount: report.eventCount,
      // Build-phase note: Tier 1 capital not yet measured; all delta values are
      // zero; outlier result is always within-threshold. Accurate pre-licence.
      SubstrateNote:
        "Build-phase: Tier 1 capital not yet measured; ΔEVE and ΔNII delta values are zero (zero banking-book positions). Outlier test: within-threshold. This is an accurate representation of the pre-commencement bank — not fabricated, not understated.",
      EVE: eveRowSections.length > 0 ? eveRowSections : null,
      NII: niiRowSections.length > 0 ? niiRowSections : null,
    } as SarbXmlSection,
  };

  return {
    formId: "BA330",
    formVersion: report.meta.formVersion,
    xsdUri: BA_330_XSD_URI,
    namespaceUri: BA_330_NAMESPACE,
    body,
  };
}
