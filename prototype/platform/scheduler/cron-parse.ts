// platform/scheduler/cron-parse.ts
//
// Minimal 5-field standard-cron parser for the scheduler substrate
// (A2.1; Atlas runtime spec §3.2). Sized to the patterns the agent-
// runtime workflow files currently use (`13 2 * * *`, `47 7 * * 2`,
// `19 6 * * 1`, `30 5 * * MON`, etc.).
//
// Field grammar (from left to right):
//
//     minute  hour  day-of-month  month  day-of-week
//     0-59    0-23  1-31          1-12   0-6 (Sun=0; MON-SUN textual aliases ok)
//
// Per-field syntax we support:
//
//   - literal:  13            - exactly that value
//   - wildcard: *             - every value in range
//   - step:     wildcard with /5 - every 5th from min (e.g. 0,5,10,...)
//   - range:    1-5           - inclusive
//   - list:     1,3,5         - explicit set
//   - text DOW: MON, mon      - Sun=0, Mon=1, ..., Sat=6
//
// What we deliberately do NOT support (named here as substrate gaps):
//
//   - `@hourly` / `@daily` / `@reboot` shorthands
//   - 6-field shape with seconds (Quartz / k8s extensions)
//   - `L` (last day-of-month) / `W` (nearest weekday) / `#` (nth weekday)
//   - Per-field step on a sub-range (e.g. `10-50/5` — accepted as range
//     `10-50` with step `5`; tighter validation deferred)
//
// Output: `nextFireAfter(parsed, fromDate, opts)` — the smallest
// strictly-greater-than `from` Date matching the expression. Iterative
// scan with a bounded look-ahead (4 years) — sufficient for the
// schedules in use, terminates on degenerate expressions.
//
// Author: Atlas (A2.1)

/** Parsed representation of one of the five fields. */
export interface CronField {
  /** The set of valid values for this field, sorted ascending. */
  readonly values: readonly number[];
}

export interface ParsedCron {
  readonly raw: string;
  readonly minute: CronField;
  readonly hour: CronField;
  readonly dayOfMonth: CronField;
  readonly month: CronField;
  readonly dayOfWeek: CronField;
  /** True if dayOfMonth was wildcard-only (`*`); used for the OR-rule below. */
  readonly dayOfMonthIsWildcard: boolean;
  /** True if dayOfWeek was wildcard-only (`*`). */
  readonly dayOfWeekIsWildcard: boolean;
}

/** Inclusive-min, inclusive-max bound for a field. */
interface FieldBounds {
  readonly min: number;
  readonly max: number;
  /** Optional textual aliases for this field, lowercased → numeric. */
  readonly aliases?: Readonly<Record<string, number>>;
}

const DOW_ALIASES: Readonly<Record<string, number>> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const MONTH_ALIASES: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const FIELD_BOUNDS: readonly FieldBounds[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day-of-month
  { min: 1, max: 12, aliases: MONTH_ALIASES }, // month
  { min: 0, max: 6, aliases: DOW_ALIASES }, // day-of-week (Sun=0)
];

/**
 * Parse one field of a cron expression against the given bounds.
 *
 * Returns the sorted, deduplicated value set. Throws on syntax error
 * with a useful field-tagged message (the caller adds the expression
 * context).
 */
function parseField(spec: string, bounds: FieldBounds): { values: number[]; isWildcard: boolean } {
  const trimmed = spec.trim();
  if (trimmed === "") {
    throw new Error("empty cron field");
  }
  const isWildcardOnly = trimmed === "*";

  // Comma-separated list — process each piece, union the results.
  const pieces = trimmed.split(",").map((s) => s.trim());
  const set = new Set<number>();

  for (const piece of pieces) {
    parsePiece(piece, bounds, set);
  }

  const values = [...set].sort((a, b) => a - b);
  if (values.length === 0) {
    throw new Error(`field "${spec}" yielded no values`);
  }
  return { values, isWildcard: isWildcardOnly };
}

/**
 * Parse one piece (no commas) and add its values to `set`. Pieces are
 * one of:
 *
 *   - wildcard:        the literal asterisk
 *   - wildcard + step: e.g. `* / 5` (without the spaces — every Nth)
 *   - range:           `<a>-<b>`
 *   - range + step:    `<a>-<b>/<step>`
 *   - literal:         `<n>`
 *   - alias token:     e.g. `MON`, resolved against bounds.aliases
 */
function parsePiece(piece: string, bounds: FieldBounds, set: Set<number>): void {
  // Step form: split on `/` first; the left side is either `*` or a range / literal.
  let stepStr: string | undefined;
  let body = piece;
  const slashIdx = piece.indexOf("/");
  if (slashIdx >= 0) {
    body = piece.slice(0, slashIdx);
    stepStr = piece.slice(slashIdx + 1);
    if (stepStr === "" || !/^\d+$/.test(stepStr)) {
      throw new Error(`invalid step in cron piece "${piece}"`);
    }
  }
  const step = stepStr ? Number.parseInt(stepStr, 10) : 1;
  if (step <= 0) {
    throw new Error(`step must be positive in cron piece "${piece}"`);
  }

  let from: number;
  let to: number;
  if (body === "*") {
    from = bounds.min;
    to = bounds.max;
  } else {
    const dashIdx = body.indexOf("-");
    if (dashIdx >= 0) {
      const a = body.slice(0, dashIdx);
      const b = body.slice(dashIdx + 1);
      from = resolveToken(a, bounds);
      to = resolveToken(b, bounds);
      if (from > to) {
        throw new Error(`range start > end in cron piece "${piece}"`);
      }
    } else {
      const single = resolveToken(body, bounds);
      // For pure literals (no slash), step is irrelevant — emit just the value.
      if (slashIdx < 0) {
        if (single < bounds.min || single > bounds.max) {
          throw new Error(
            `value ${single} out of range [${bounds.min},${bounds.max}] in cron piece "${piece}"`,
          );
        }
        set.add(single);
        return;
      }
      // `<n>/<step>` is interpreted as starting-at-n with step (matches
      // common usage `0/15` even though strict POSIX disallows it).
      from = single;
      to = bounds.max;
    }
  }
  if (from < bounds.min || from > bounds.max || to < bounds.min || to > bounds.max) {
    throw new Error(
      `range [${from},${to}] out of bounds [${bounds.min},${bounds.max}] in cron piece "${piece}"`,
    );
  }
  for (let v = from; v <= to; v += step) {
    set.add(v);
  }
}

/** Resolve a numeric token or textual alias to a number. */
function resolveToken(token: string, bounds: FieldBounds): number {
  if (/^\d+$/.test(token)) {
    return Number.parseInt(token, 10);
  }
  if (bounds.aliases) {
    const aliased = bounds.aliases[token.toLowerCase()];
    if (aliased !== undefined) return aliased;
  }
  throw new Error(`unrecognised token "${token}"`);
}

/**
 * Parse a 5-field cron expression. Throws with a tagged error on any
 * field-level problem.
 */
export function parseCron(expression: string): ParsedCron {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `cron expression must have 5 fields (minute hour day-of-month month day-of-week); got ${fields.length} in "${expression}"`,
    );
  }
  const [minStr, hourStr, domStr, monthStr, dowStr] = fields as [
    string,
    string,
    string,
    string,
    string,
  ];

  const minute = parseField(minStr, FIELD_BOUNDS[0] as FieldBounds);
  const hour = parseField(hourStr, FIELD_BOUNDS[1] as FieldBounds);
  const dayOfMonth = parseField(domStr, FIELD_BOUNDS[2] as FieldBounds);
  const month = parseField(monthStr, FIELD_BOUNDS[3] as FieldBounds);
  const dayOfWeek = parseField(dowStr, FIELD_BOUNDS[4] as FieldBounds);

  return {
    raw: expression,
    minute: { values: minute.values },
    hour: { values: hour.values },
    dayOfMonth: { values: dayOfMonth.values },
    month: { values: month.values },
    dayOfWeek: { values: dayOfWeek.values },
    dayOfMonthIsWildcard: dayOfMonth.isWildcard,
    dayOfWeekIsWildcard: dayOfWeek.isWildcard,
  };
}

/** Inclusive-or rule: when both DOM and DOW are constrained (neither
 *  wildcard), POSIX cron matches if EITHER field matches. When one is
 *  wildcard-only, both must match (the wildcard-only side trivially does). */
function dateMatchesDayRules(parsed: ParsedCron, day: number, dow: number): boolean {
  const domMatch = parsed.dayOfMonth.values.includes(day);
  const dowMatch = parsed.dayOfWeek.values.includes(dow);
  if (parsed.dayOfMonthIsWildcard && parsed.dayOfWeekIsWildcard) return true;
  if (parsed.dayOfMonthIsWildcard) return dowMatch;
  if (parsed.dayOfWeekIsWildcard) return domMatch;
  return domMatch || dowMatch; // both constrained → OR semantics
}

/**
 * Compute the next fire time strictly after `from`. Returns the matching
 * Date in UTC (the substrate is UTC-internal per P5; presentation
 * localises). Iterative minute-by-minute scan with month / day fast-skips
 * — bounded look-ahead at `lookAheadDays` (default 366 * 4 = 4 years).
 */
export function nextFireAfter(
  parsed: ParsedCron,
  from: Date,
  opts: { lookAheadDays?: number } = {},
): Date {
  const lookAhead = opts.lookAheadDays ?? 366 * 4;

  // Start at from + 1 minute, zeroed seconds / ms. The contract is
  // "strictly greater than from".
  let t = new Date(from.getTime());
  t.setUTCSeconds(0, 0);
  t = new Date(t.getTime() + 60 * 1000);

  const end = new Date(from.getTime() + lookAhead * 24 * 60 * 60 * 1000);

  while (t <= end) {
    const month = t.getUTCMonth() + 1; // JS months 0-11; cron uses 1-12
    if (!parsed.month.values.includes(month)) {
      // Skip to first day of next month (re-enter loop).
      t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1, 0, 0, 0, 0));
      continue;
    }
    const day = t.getUTCDate();
    const dow = t.getUTCDay();
    if (!dateMatchesDayRules(parsed, day, dow)) {
      // Skip to the next day (re-enter the loop and re-check month).
      t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1, 0, 0, 0, 0));
      continue;
    }
    const hour = t.getUTCHours();
    if (!parsed.hour.values.includes(hour)) {
      // Move to the next valid hour today, or roll to next day.
      const nextHour = parsed.hour.values.find((h) => h > hour);
      if (nextHour !== undefined) {
        t = new Date(
          Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), nextHour, 0, 0, 0),
        );
        continue;
      }
      t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1, 0, 0, 0, 0));
      continue;
    }
    const minute = t.getUTCMinutes();
    if (!parsed.minute.values.includes(minute)) {
      const nextMin = parsed.minute.values.find((m) => m > minute);
      if (nextMin !== undefined) {
        t = new Date(
          Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), hour, nextMin, 0, 0),
        );
        continue;
      }
      // Roll to next hour.
      t = new Date(
        Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), hour + 1, 0, 0, 0),
      );
      continue;
    }
    // All fields match — this is the next fire time.
    return t;
  }
  throw new Error(
    `cron "${parsed.raw}" produced no fire time within ${lookAhead}-day look-ahead from ${from.toISOString()}`,
  );
}
