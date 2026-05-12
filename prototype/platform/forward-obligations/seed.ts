// platform/forward-obligations/seed.ts
//
// Seed obligations for the Forward Obligations projection.
//
// These provide realistic items for sources that are not yet wired to live
// data (policy-review cycle triggers; manual ad-hoc items). Regulatory-filing
// and trade-settlement items are derived dynamically in projection.ts —
// seeds here are supplementary for policy-review and any stub items needed
// while the live substrates are being built.
//
// All dates are computed relative to a provided `asOf` so the seeds stay
// current across projection runs rather than going stale.
//
// Author: Atlas (Core banking platform architect, engineering)

import type { ForwardObligation } from "./types";

// ---------------------------------------------------------------------------
// Business-day helpers (ZA public holidays not modelled here — simplified
// calendar for build-phase; full JIHCAL integration is a Tomas substrate gap).
// ---------------------------------------------------------------------------

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function addBusinessDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  let remaining = n;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isWeekend(d)) remaining--;
  }
  return d.toISOString().slice(0, 10);
}

export function nextBusinessDay(dateStr: string): string {
  return addBusinessDays(dateStr, 1);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Next occurrence of a given day-of-month (1-31) on or after `asOf`. */
function nextMonthlyDate(asOf: string, dayOfMonth: number): string {
  const base = new Date(`${asOf}T00:00:00Z`);
  const candidate = new Date(base);
  candidate.setUTCDate(dayOfMonth);
  if (candidate <= base) {
    // advance one month
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
    candidate.setUTCDate(dayOfMonth);
  }
  return toIsoDate(candidate);
}

/** Next occurrence of a given month (0-11) and day-of-month on or after `asOf`. */
function nextAnnualDate(asOf: string, month: number, day: number): string {
  const base = new Date(`${asOf}T00:00:00Z`);
  const candidate = new Date(base);
  candidate.setUTCMonth(month, day);
  if (candidate <= base) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return toIsoDate(candidate);
}

/** Next end-of-quarter (Mar 31 / Jun 30 / Sep 30 / Dec 31) on or after `asOf` + offset days. */
function nextQuarterEnd(asOf: string, offsetDays = 21): string {
  const base = new Date(`${asOf}T00:00:00Z`);
  const quarterEnds = [
    new Date(Date.UTC(base.getUTCFullYear(), 2, 31)), // Mar 31
    new Date(Date.UTC(base.getUTCFullYear(), 5, 30)), // Jun 30
    new Date(Date.UTC(base.getUTCFullYear(), 8, 30)), // Sep 30
    new Date(Date.UTC(base.getUTCFullYear(), 11, 31)), // Dec 31
    new Date(Date.UTC(base.getUTCFullYear() + 1, 2, 31)),
  ];
  for (const qe of quarterEnds) {
    // Due date = quarter-end + offsetDays
    const due = new Date(qe);
    due.setUTCDate(due.getUTCDate() + offsetDays);
    if (due > base) return toIsoDate(due);
  }
  return toIsoDate(quarterEnds[quarterEnds.length - 1] as Date);
}

// ---------------------------------------------------------------------------
// Seed builder
// ---------------------------------------------------------------------------

/**
 * Build the static seed obligations relative to `asOf`.
 * These are items where live event-sourced data is not yet wired.
 *
 * Current seed set:
 *   1. POPIA annual compliance report (Iris, certain)
 *   2. CIPC annual return (Owen, certain)
 *   3. Policy review — AML/CFT Policy V1 (next 6-month cycle, estimated)
 *   4. Policy review — Trading Mandate V1 (next annual cycle, estimated)
 */
export function buildSeedObligations(asOf: string): ForwardObligation[] {
  const seeds: ForwardObligation[] = [];

  // 1. POPIA annual compliance report — due 30 June each year
  //    (Information Officer annual report per POPIA s.22 and PoPI GN 1360)
  seeds.push({
    id: "seed:popia-annual-report",
    title: "POPIA annual compliance report",
    source: "regulatory-filing",
    dueDate: nextAnnualDate(asOf, 5, 30), // June = month 5 (0-indexed), day 30
    certainty: "certain",
    owner: "Iris (Information Officer, governance)",
    relatedRef: "ORG-POPIA-IO-001",
    description:
      "Annual report to the Information Regulator per POPIA s.22. " +
      "Iris (Information Officer) coordinates; Scrooge dispatches the filing agent tick.",
  });

  // 2. CIPC annual return — due within 30 days of financial year-end (March 31)
  //    Financial year-end assumed 28 Feb; 30-day window = 30 March
  seeds.push({
    id: "seed:cipc-annual-return",
    title: "CIPC annual return (Companies Act)",
    source: "regulatory-filing",
    dueDate: nextAnnualDate(asOf, 2, 30), // March = month 2, day 30
    certainty: "certain",
    owner: "Owen (Company Secretary, governance)",
    relatedRef: "ORG-COMPANIES-ACT-AR-001",
    description:
      "Annual return to CIPC per Companies Act 71 of 2008 s.33. " +
      "Owen (Company Secretary) files; deadline 30 days after financial year-end.",
  });

  // 3. AML/CFT Policy V1 review — 6-monthly cycle, estimated (substrate gap:
  //    policy-review trigger events not yet emitted)
  seeds.push({
    id: "seed:policy-review-aml-cft",
    title: "AML/CFT Policy V1 — periodic review",
    source: "policy-review",
    dueDate: nextMonthlyDate(asOf, 1), // first of next month as placeholder
    certainty: "estimated",
    owner: "Zara (MLRO / Chief Compliance Officer, governance)",
    relatedRef: "AML-CFT-POLICY-V1",
    description:
      "6-monthly policy review per the AML/CFT Policy review schedule. " +
      "Substrate gap: policy-review-trigger events not yet emitted; date is estimated.",
  });

  // 4. Trading Mandate V1 review — annual cycle, estimated
  seeds.push({
    id: "seed:policy-review-trading-mandate",
    title: "Trading Mandate V1 — annual review",
    source: "policy-review",
    dueDate: nextAnnualDate(asOf, 0, 15), // Jan 15 each year
    certainty: "estimated",
    owner: "Saskia (Head of trading, governance)",
    relatedRef: "TRADING-MANDATE-V1",
    description:
      "Annual review of the Trading Mandate per the policy review schedule. " +
      "Substrate gap: policy-review-trigger events not yet emitted; date is estimated.",
  });

  return seeds;
}

// Re-export helpers for use in projection.ts
export { nextMonthlyDate, nextQuarterEnd };
