// platform/scheduler/calendar.ts
//
// Jurisdiction-aware calendar primitives for the scheduler substrate
// (A2.1; Atlas runtime spec §3.2 — calendar awareness, P5 — multi-
// jurisdiction from day one).
//
// Today the bank operates a single SA legal entity (BANK-ZA-001) and a
// single ZA jurisdictional context. Per P5 the substrate is built as if
// jurisdictions were already plural — the public API is keyed on
// jurisdiction code, and adding a second is a config change. The
// hardcoded list below is the SA fixed-date public-holiday set per the
// Public Holidays Act 36 of 1994.
//
// Substrate gaps surfaced (deferred slices):
//
//   1. **Variable-date holidays.** Good Friday and Family Day shift each
//      year (computed via Easter algorithms). The Act sets them but the
//      shift is an algorithm, not a fixed date. This slice does NOT
//      include them — listed in §3 as a substrate gap; add in A2.x with
//      the Easter-algorithm pull.
//
//   2. **Holiday-shifted-Monday rule.** Section 2(1) of the Act provides
//      that when a public holiday falls on a Sunday, the following
//      Monday is observed as the public holiday. We DO honour the
//      shift in the holiday set (the Sunday's date is observed-on
//      Monday), but the implementation here is the simplified "fixed
//      date + Sunday-shift" — sufficient for scheduler skip semantics.
//
//   3. **Multi-jurisdiction calendars.** Today only ZA is wired. Adding
//      US/UK/EU calendars is a constant-table addition; the API surface
//      already accepts a jurisdiction code.
//
// Author: Atlas (A2.1)

import type { Jurisdiction } from "../core/types";

export interface PublicHoliday {
  /** Month, 1-12 (JS dates use 0-11; we use 1-12 to mirror cron). */
  readonly month: number;
  /** Day-of-month, 1-31. */
  readonly day: number;
  /** Statutory name. */
  readonly name: string;
}

/**
 * SA fixed-date public holidays per the Public Holidays Act 36 of 1994
 * (Schedule 1). Variable-date holidays (Good Friday, Family Day) are a
 * substrate gap.
 */
const SA_FIXED_HOLIDAYS: readonly PublicHoliday[] = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 3, day: 21, name: "Human Rights Day" },
  { month: 4, day: 27, name: "Freedom Day" },
  { month: 5, day: 1, name: "Workers' Day" },
  { month: 6, day: 16, name: "Youth Day" },
  { month: 8, day: 9, name: "National Women's Day" },
  { month: 9, day: 24, name: "Heritage Day" },
  { month: 12, day: 16, name: "Day of Reconciliation" },
  { month: 12, day: 25, name: "Christmas Day" },
  { month: 12, day: 26, name: "Day of Goodwill" },
];

/** Jurisdictions wired today. P5 — extend by adding a row. */
const HOLIDAYS_BY_JURISDICTION: Readonly<Record<string, readonly PublicHoliday[]>> = {
  ZA: SA_FIXED_HOLIDAYS,
};

/**
 * Return true iff `date` (UTC) is a public holiday in the given
 * jurisdiction. Implements the Sunday-shift rule for SA: a holiday
 * falling on Sunday is observed on the following Monday.
 */
export function isPublicHoliday(date: Date, jurisdiction: Jurisdiction | string = "ZA"): boolean {
  const set = HOLIDAYS_BY_JURISDICTION[jurisdiction];
  if (!set) return false;

  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const dow = date.getUTCDay();

  // Direct match: this date is a fixed-date holiday and not a Sunday
  // (Sundays-of-holidays are observed on the next Monday; the Sunday
  // itself is a Sunday — no business day either way).
  for (const h of set) {
    if (h.month === month && h.day === day && dow !== 0) return true;
  }

  // Sunday-shift rule: when a holiday falls on Sunday, the *following*
  // Monday is observed as a public holiday. Check whether yesterday's
  // date (the Sunday) was a holiday and today is Monday.
  if (dow === 1) {
    const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    const ymonth = yesterday.getUTCMonth() + 1;
    const yday = yesterday.getUTCDate();
    for (const h of set) {
      if (h.month === ymonth && h.day === yday) return true;
    }
  }

  return false;
}

/**
 * Shift `candidate` forward to the next non-holiday weekday in `jurisdiction`.
 * If `candidate` is already a non-holiday weekday, returns it unchanged.
 *
 * The shift moves day-by-day; weekends count as non-business but are
 * NOT shifted by this function unless `skipWeekends` is true (the
 * substrate's daily / weekday schedules are typically defined to
 * already-skip weekends in the cron expression's day-of-week field —
 * we don't want to double-shift).
 */
export function shiftPastHolidays(
  candidate: Date,
  jurisdiction: Jurisdiction | string = "ZA",
  opts: { skipWeekends?: boolean } = {},
): Date {
  let t = new Date(candidate.getTime());
  // Bound the shift loop so a misconfiguration doesn't loop forever.
  for (let guard = 0; guard < 30; guard++) {
    const dow = t.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    if (isPublicHoliday(t, jurisdiction) || (opts.skipWeekends && isWeekend)) {
      // Roll to next day at midnight UTC, preserving the original time
      // of day. (The scheduler decides whether to keep the time of day
      // or normalise to start-of-day; we preserve.)
      t = new Date(
        Date.UTC(
          t.getUTCFullYear(),
          t.getUTCMonth(),
          t.getUTCDate() + 1,
          t.getUTCHours(),
          t.getUTCMinutes(),
          t.getUTCSeconds(),
          t.getUTCMilliseconds(),
        ),
      );
      continue;
    }
    return t;
  }
  // Bounded fallthrough — return the last candidate (caller decides
  // whether to log this as a substrate alert).
  return t;
}

/** List of holidays the scheduler knows about, for diagnostic logging. */
export function listHolidays(jurisdiction: Jurisdiction | string = "ZA"): readonly PublicHoliday[] {
  return HOLIDAYS_BY_JURISDICTION[jurisdiction] ?? [];
}
