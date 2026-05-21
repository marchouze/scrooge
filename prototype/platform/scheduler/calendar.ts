// platform/scheduler/calendar.ts
//
// Jurisdiction-aware calendar primitives for the scheduler substrate
// (A2.1; Atlas runtime spec §3.2 — calendar awareness, P5 — multi-
// jurisdiction from day one).
//
// Today the bank operates a single SA legal entity (LE-ZA-HOZ-BANK) and a
// single ZA jurisdictional context. Per P5 the substrate is built as if
// jurisdictions were already plural — the public API is keyed on
// jurisdiction code, and adding a second is a config change. The
// hardcoded list below is the SA fixed-date public-holiday set per the
// Public Holidays Act 36 of 1994.
//
// Substrate gaps surfaced (deferred slices):
//
//   1. **Holiday-shifted-Monday rule.** Section 2(1) of the Act provides
//      that when a public holiday falls on a Sunday, the following
//      Monday is observed as the public holiday. We DO honour the
//      shift in the holiday set (the Sunday's date is observed-on
//      Monday), but the implementation here is the simplified "fixed
//      date + Sunday-shift" — sufficient for scheduler skip semantics.
//      Variable-date holidays (Good Friday Friday-by-construction,
//      Family Day Monday-by-construction) do not need the Sunday-shift
//      since they never fall on Sunday.
//
//   2. **Multi-jurisdiction calendars.** Today only ZA is wired. Adding
//      US/UK/EU calendars is a constant-table addition; the API surface
//      already accepts a jurisdiction code.
//
//   3. **Christian-holiday entanglement.** Good Friday and Family Day
//      are computed from Easter (Anonymous Gregorian / Computus
//      algorithm). The Act stipulates the dates by name, not by
//      religious framing — but the underlying computation is
//      ecclesiastical. If Parliament redefines either holiday on a
//      non-Easter basis the algorithm here must be retired in favour
//      of an explicit per-year date table.
//
// Closed in this slice (was §1 above):
//
//   - **Variable-date holidays.** Good Friday and Family Day are now
//     computed via the Easter algorithm. Workers' Day stays a fixed-
//     date entry (May 1) and continues to use the Sunday-shift path.
//
// Author: Atlas (A2.1, extended for variable-date holidays)

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
 * Compute the date of Easter Sunday (Western / Gregorian) for a given
 * year using the Anonymous Gregorian algorithm (a.k.a. Meeus / Jones /
 * Butcher / Computus). Returns a UTC midnight Date.
 *
 * Reference: Jean Meeus, "Astronomical Algorithms" (1991), ch. 8.
 * Also documented at <https://en.wikipedia.org/wiki/Computus>.
 *
 * Spot-check (canonical Easter dates):
 *   - 2024 → 2024-03-31
 *   - 2025 → 2025-04-20
 *   - 2026 → 2026-04-05
 *   - 2027 → 2027-03-28
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Variable-date SA public holidays for a given year, derived from
 * Easter Sunday:
 *   - Good Friday — the Friday immediately preceding Easter Sunday
 *     (Easter − 2 days).
 *   - Family Day — the Monday immediately following Easter Sunday
 *     (Easter + 1 day).
 *
 * Returns UTC-midnight Date objects.
 */
export function saVariableHolidays(year: number): {
  readonly goodFriday: Date;
  readonly familyDay: Date;
} {
  const easter = easterSunday(year);
  const day = 24 * 60 * 60 * 1000;
  return {
    goodFriday: new Date(easter.getTime() - 2 * day),
    familyDay: new Date(easter.getTime() + 1 * day),
  };
}

/** Same-UTC-day equality check. */
function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Return true iff `date` (UTC) is a public holiday in the given
 * jurisdiction. Implements the Sunday-shift rule for SA: a holiday
 * falling on Sunday is observed on the following Monday. Also consults
 * the variable-date set (Good Friday, Family Day) for ZA.
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

  // Variable-date holidays (ZA only today): Good Friday + Family Day,
  // computed from the Easter date for `date`'s year. Both fall on
  // weekdays by construction (Friday and Monday respectively), so the
  // Sunday-shift rule does not apply.
  if (jurisdiction === "ZA") {
    const { goodFriday, familyDay } = saVariableHolidays(date.getUTCFullYear());
    if (sameUtcDay(date, goodFriday) || sameUtcDay(date, familyDay)) return true;
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

/** List of fixed-date holidays the scheduler knows about, for diagnostic logging. */
export function listHolidays(jurisdiction: Jurisdiction | string = "ZA"): readonly PublicHoliday[] {
  return HOLIDAYS_BY_JURISDICTION[jurisdiction] ?? [];
}

/**
 * Resolved holiday dates (fixed + variable + Sunday-shifted observed
 * dates) for `year` in `jurisdiction`. Useful for diagnostic dumps and
 * for downstream callers (e.g. ALCO calendars, settlement calendars)
 * that want a concrete per-year date list rather than the rule set.
 *
 * Order: returned in chronological order. Each entry is the *observed*
 * date — i.e. for a Sunday-on-holiday, the entry is the following
 * Monday, not the Sunday.
 */
export function resolveHolidaysForYear(
  year: number,
  jurisdiction: Jurisdiction | string = "ZA",
): readonly { readonly date: Date; readonly name: string }[] {
  const set = HOLIDAYS_BY_JURISDICTION[jurisdiction];
  if (!set) return [];

  const out: { date: Date; name: string }[] = [];
  for (const h of set) {
    const candidate = new Date(Date.UTC(year, h.month - 1, h.day));
    if (candidate.getUTCDay() === 0) {
      // Observed on Monday.
      out.push({
        date: new Date(candidate.getTime() + 24 * 60 * 60 * 1000),
        name: `${h.name} (observed)`,
      });
    } else {
      out.push({ date: candidate, name: h.name });
    }
  }
  if (jurisdiction === "ZA") {
    const { goodFriday, familyDay } = saVariableHolidays(year);
    out.push({ date: goodFriday, name: "Good Friday" });
    out.push({ date: familyDay, name: "Family Day" });
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}
