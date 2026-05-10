// tests/scheduler.test.ts
//
// Unit tests for A2.1 — the scheduler substrate.
//
// Asserts:
//   - The cron parser handles the 16 expressions currently in use across
//     `.github/workflows/agent-runtime-*.yml`, plus standard edge cases
//     (literals, wildcards, steps, ranges, lists, textual day-of-week).
//   - `nextFireAfter` produces sensible next-fire times: end-of-month
//     wrap, day-of-week filter, hour/minute granularity.
//   - Inactivity-SLA parser handles the persona §6 free-text shapes.
//   - SA holiday calendar honours the fixed-date list and the Sunday-
//     shift rule.
//   - `LocalScheduler.tick()` is idempotent across re-invocation (no
//     duplicate ScheduledTrigger events).
//   - `LocalScheduler.inactivityCheck()` alerts when no events recorded.
//
// Author: Atlas (A2.1)

import { describe, expect, it } from "bun:test";

import {
  makeSubstrateAgentRunCompleted,
  makeSubstrateAgentRunFailed,
  makeSubstrateAgentRunStarted,
  makeSubstrateAlert,
} from "../platform/event-store/event-types";
import { EventStore } from "../platform/event-store/store";
import {
  easterSunday,
  isPublicHoliday,
  resolveHolidaysForYear,
  saVariableHolidays,
  shiftPastHolidays,
} from "../platform/scheduler/calendar";
import { nextFireAfter, parseCron } from "../platform/scheduler/cron-parse";
import {
  LocalScheduler,
  inMemorySchedulerSource,
  parseInactivitySlaHours,
} from "../platform/scheduler/scheduler";

describe("cron-parse — workflow expressions", () => {
  // Mirror of the 16 cron expressions across .github/workflows/agent-runtime-*.yml
  // as of 2026-05-08. These MUST parse without exception.
  const WORKFLOW_CRONS: string[] = [
    "13 2 * * *", // Vera
    "17 3 * * *", // Anya
    "19 6 * * 1", // Atlas (Monday)
    "23 5 * * MON", // Devon (Monday textual)
    "27 4 * * *", // Scrooge inbox-hygiene
    "29 7 * * 3", // Mira obligations
    "30 4 * * *", // Helena
    "30 5 * * MON", // Zara
    "31 7 * * 2", // Owen
    "37 7 * * 4", // Senna
    "41 6 * * MON", // Camille
    "43 3 * * *", // Rohan
    "47 7 * * 2", // Thandiwe
    "49 7 * * 4", // Rashida
    "51 7 * * 3", // Iris
    "53 6 * * *", // Eitan
  ];

  it("parses every workflow cron expression", () => {
    for (const expr of WORKFLOW_CRONS) {
      const parsed = parseCron(expr);
      expect(parsed.raw).toBe(expr);
      // Sanity: the next fire after 'now' is in the future.
      const next = nextFireAfter(parsed, new Date("2026-05-08T00:00:00Z"));
      expect(next.getTime()).toBeGreaterThan(Date.parse("2026-05-08T00:00:00Z"));
    }
  });
});

describe("cron-parse — syntax", () => {
  it("supports literals", () => {
    const p = parseCron("13 2 * * *");
    expect(p.minute.values).toEqual([13]);
    expect(p.hour.values).toEqual([2]);
    expect(p.dayOfMonthIsWildcard).toBe(true);
  });

  it("supports wildcards", () => {
    const p = parseCron("* * * * *");
    expect(p.minute.values.length).toBe(60);
    expect(p.dayOfMonthIsWildcard).toBe(true);
    expect(p.dayOfWeekIsWildcard).toBe(true);
  });

  it("supports step values", () => {
    const p = parseCron("*/5 * * * *");
    expect(p.minute.values).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  it("supports ranges", () => {
    const p = parseCron("0 9-17 * * *");
    expect(p.hour.values).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it("supports lists", () => {
    const p = parseCron("0 9,12,17 * * *");
    expect(p.hour.values).toEqual([9, 12, 17]);
  });

  it("supports textual day-of-week", () => {
    const p = parseCron("0 0 * * MON");
    expect(p.dayOfWeek.values).toEqual([1]);
  });

  it("supports textual month aliases", () => {
    const p = parseCron("0 0 1 JAN *");
    expect(p.month.values).toEqual([1]);
  });

  it("rejects expressions with the wrong field count", () => {
    expect(() => parseCron("0 0 * *")).toThrow();
    expect(() => parseCron("0 0 * * * *")).toThrow();
  });

  it("rejects out-of-range values", () => {
    expect(() => parseCron("60 0 * * *")).toThrow(); // minute > 59
    expect(() => parseCron("0 24 * * *")).toThrow(); // hour > 23
  });
});

describe("cron-parse — nextFireAfter", () => {
  it("produces the next minute boundary for daily schedules", () => {
    const p = parseCron("13 2 * * *");
    // From 2026-05-08T01:00:00Z, the next is 2026-05-08T02:13:00Z.
    const next = nextFireAfter(p, new Date("2026-05-08T01:00:00Z"));
    expect(next.toISOString()).toBe("2026-05-08T02:13:00.000Z");
  });

  it("rolls to next day when current day's slot has passed", () => {
    const p = parseCron("13 2 * * *");
    const next = nextFireAfter(p, new Date("2026-05-08T03:00:00Z"));
    expect(next.toISOString()).toBe("2026-05-09T02:13:00.000Z");
  });

  it("respects day-of-week constraints", () => {
    const p = parseCron("19 6 * * 1"); // Mondays only
    // 2026-05-08 is a Friday; the next Monday is 2026-05-11.
    const next = nextFireAfter(p, new Date("2026-05-08T00:00:00Z"));
    expect(next.getUTCDay()).toBe(1);
    expect(next.toISOString()).toBe("2026-05-11T06:19:00.000Z");
  });

  it("respects textual day-of-week (MON)", () => {
    const p = parseCron("23 5 * * MON");
    const next = nextFireAfter(p, new Date("2026-05-08T00:00:00Z"));
    expect(next.toISOString()).toBe("2026-05-11T05:23:00.000Z");
  });

  it("crosses month boundaries", () => {
    const p = parseCron("0 0 1 * *");
    const next = nextFireAfter(p, new Date("2026-05-15T12:00:00Z"));
    expect(next.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("strictly greater-than: a fire-time exactly equal to from is not returned", () => {
    const p = parseCron("13 2 * * *");
    const exact = new Date("2026-05-08T02:13:00Z");
    const next = nextFireAfter(p, exact);
    expect(next.getTime()).toBeGreaterThan(exact.getTime());
  });
});

describe("calendar — SA holidays", () => {
  it("identifies fixed-date public holidays", () => {
    expect(isPublicHoliday(new Date("2026-01-01T00:00:00Z"))).toBe(true); // New Year
    expect(isPublicHoliday(new Date("2026-04-27T00:00:00Z"))).toBe(true); // Freedom Day
    expect(isPublicHoliday(new Date("2026-12-25T00:00:00Z"))).toBe(true); // Christmas
  });

  it("returns false for ordinary weekdays", () => {
    expect(isPublicHoliday(new Date("2026-05-08T00:00:00Z"))).toBe(false);
  });

  it("Sunday-shift: Day of Goodwill 2027 falls on Sunday — observed Monday", () => {
    // Dec 25 2027 is Saturday (Christmas); Dec 26 is Sunday (Day of
    // Goodwill — falls on Sunday, observed on Monday); Dec 27 is Monday
    // (the observed-on day).
    expect(isPublicHoliday(new Date("2027-12-25T00:00:00Z"))).toBe(true); // Christmas
    expect(isPublicHoliday(new Date("2027-12-27T00:00:00Z"))).toBe(true); // observed shift
  });

  it("a Sunday-on-holiday itself is not a public holiday", () => {
    // 2027-12-26 (Sunday) — Day of Goodwill on its statutory date. The
    // function returns false on the Sunday itself (Sundays aren't
    // business days; the public-holiday observation moves to Monday).
    expect(isPublicHoliday(new Date("2027-12-26T00:00:00Z"))).toBe(false);
  });

  it("shiftPastHolidays moves a holiday-stamped date forward", () => {
    const shifted = shiftPastHolidays(new Date("2026-12-25T06:00:00Z"));
    // 2026-12-25 (Friday) is Christmas; 2026-12-26 (Saturday) is Day of Goodwill.
    // So shift jumps to 2026-12-27 (Sunday). Sunday is not a public-holiday
    // unless the calendar declares it (we don't skip weekends in the
    // default skipWeekends=false call), so this lands on Sunday 27.
    expect(shifted.toISOString()).toBe("2026-12-27T06:00:00.000Z");
  });

  // -- variable-date holidays (extended slice) --------------------------

  it("Easter algorithm matches canonical almanac dates", () => {
    // Reference: USNO / Wikipedia Computus tables.
    expect(easterSunday(2024).toISOString()).toBe("2024-03-31T00:00:00.000Z");
    expect(easterSunday(2025).toISOString()).toBe("2025-04-20T00:00:00.000Z");
    expect(easterSunday(2026).toISOString()).toBe("2026-04-05T00:00:00.000Z");
    expect(easterSunday(2027).toISOString()).toBe("2027-03-28T00:00:00.000Z");
  });

  it("saVariableHolidays computes Good Friday and Family Day from Easter", () => {
    // 2025: Easter = 2025-04-20 (Sun). GF = 2025-04-18 (Fri). FD = 2025-04-21 (Mon).
    const v25 = saVariableHolidays(2025);
    expect(v25.goodFriday.toISOString()).toBe("2025-04-18T00:00:00.000Z");
    expect(v25.familyDay.toISOString()).toBe("2025-04-21T00:00:00.000Z");
    // 2026: Easter = 2026-04-05 (Sun). FD = 2026-04-06 (Mon).
    const v26 = saVariableHolidays(2026);
    expect(v26.familyDay.toISOString()).toBe("2026-04-06T00:00:00.000Z");
  });

  it("isPublicHoliday recognises 2025 Good Friday (variable-date)", () => {
    // 2025-04-18 — the Friday before Easter Sunday 2025-04-20.
    expect(isPublicHoliday(new Date("2025-04-18T00:00:00Z"))).toBe(true);
    // The day before is not a holiday.
    expect(isPublicHoliday(new Date("2025-04-17T00:00:00Z"))).toBe(false);
  });

  it("isPublicHoliday recognises 2026 Family Day (variable-date)", () => {
    // 2026-04-06 — the Monday after Easter Sunday 2026-04-05.
    expect(isPublicHoliday(new Date("2026-04-06T00:00:00Z"))).toBe(true);
    // Easter Sunday itself is NOT a SA public holiday.
    expect(isPublicHoliday(new Date("2026-04-05T00:00:00Z"))).toBe(false);
  });

  it("Sunday-shift: Workers' Day 2022 falls on Sunday — observed on Monday 2022-05-02", () => {
    // 2022-05-01 was a Sunday; per Public Holidays Act §2(1) the
    // following Monday is the public holiday.
    expect(isPublicHoliday(new Date("2022-05-01T00:00:00Z"))).toBe(false); // the Sunday itself
    expect(isPublicHoliday(new Date("2022-05-02T00:00:00Z"))).toBe(true); // observed Monday
  });

  it("Sunday-shift does NOT trigger when Workers' Day falls on a weekday", () => {
    // 2027-05-01 is a Saturday — no shift to Monday under the Act §2(1)
    // rule (the Act shifts only Sunday-falling holidays). A Saturday-
    // falling holiday simply lapses for the bank; it is the holiday
    // itself only on the calendar day.
    expect(isPublicHoliday(new Date("2027-05-01T00:00:00Z"))).toBe(true); // Saturday holiday
    expect(isPublicHoliday(new Date("2027-05-03T00:00:00Z"))).toBe(false); // Monday — not shifted
  });

  it("resolveHolidaysForYear includes variable-date and Sunday-shifted entries", () => {
    const list = resolveHolidaysForYear(2025);
    const names = list.map((h) => h.name);
    expect(names).toContain("Good Friday");
    expect(names).toContain("Family Day");
    expect(names).toContain("Workers' Day");
    // List is chronologically ordered.
    for (let i = 1; i < list.length; i++) {
      const prevItem = list[i - 1];
      const curItem = list[i];
      if (!prevItem || !curItem) throw new Error("unreachable: loop indices in-bounds");
      expect(curItem.date.getTime() >= prevItem.date.getTime()).toBe(true);
    }
    // 2022 list contains the observed Workers' Day (Mon 2022-05-02), not the Sunday.
    const list22 = resolveHolidaysForYear(2022);
    const observed = list22.find((h) => h.name.startsWith("Workers' Day"));
    expect(observed?.date.toISOString()).toBe("2022-05-02T00:00:00.000Z");
    expect(observed?.name).toBe("Workers' Day (observed)");
  });
});

describe("inactivity-SLA parser", () => {
  it("parses 'every 24h'", () => {
    expect(parseInactivitySlaHours("Daily run; quiet > 24h is a substrate alert.")).toBe(24);
  });

  it("parses 'every 7 days'", () => {
    expect(
      parseInactivitySlaHours("Weekly attestation; quiet > 7 days is a substrate alert."),
    ).toBe(168);
  });

  it("parses 'every 8 days' as the larger of two values", () => {
    // Persona text often has both "every 7 days" and "quiet > 8 days";
    // we take the larger.
    expect(
      parseInactivitySlaHours(
        "Weekly snapshot must produce event every 7 days; quiet > 8 days is a substrate alert.",
      ),
    ).toBe(192);
  });

  it("parses 'every 30 minutes'", () => {
    expect(parseInactivitySlaHours("Checkpoint every 30 minutes during trading hours.")).toBe(0.5);
  });

  it("returns undefined when no parseable token", () => {
    expect(
      parseInactivitySlaHours("No hard inactivity SLA — legitimately silent."),
    ).toBeUndefined();
  });
});

describe("LocalScheduler — tick", () => {
  function newStore(): EventStore {
    return new EventStore(":memory:");
  }

  it("emits ScheduledTrigger events for due fire-times", () => {
    const store = newStore();
    const source = inMemorySchedulerSource({
      cronMap: { "vera:overnight-recon": "13 2 * * *" },
      handlers: [{ agent: "Vera", trigger: "overnight-recon", cadenceHours: 24 }],
    });
    const sched = new LocalScheduler({ eventStore: store, source });
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    // Tick at 03:00Z. The scheduler look-back window is 7 days, so on
    // first invocation it catches up on the 7 daily fire-times that
    // pre-date the tick. That's the expected catch-up behaviour after
    // a substrate gap; in steady-state the tick runs frequently and
    // this lands on 0–1 firings per tick.
    const result = sched.tick(new Date("2026-05-08T03:00:00Z"));
    expect(result.firings.length).toBe(7);
    // Most recent firing is today's 02:13Z slot.
    const today = result.firings.find((f) => f.scheduledFor === "2026-05-08T02:13:00.000Z");
    expect(today).toBeDefined();
    expect(today?.agentUrn).toBe("agent:vera");
    expect(today?.delayMs).toBeGreaterThan(0);
  });

  it("subsequent tick (no new fire-times) emits zero firings — steady-state idempotent", () => {
    const store = newStore();
    const source = inMemorySchedulerSource({
      cronMap: { "vera:overnight-recon": "13 2 * * *" },
      handlers: [{ agent: "Vera", trigger: "overnight-recon", cadenceHours: 24 }],
    });
    const sched = new LocalScheduler({ eventStore: store, source });
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    const at = new Date("2026-05-08T03:00:00Z");
    const first = sched.tick(at);
    expect(first.firings.length).toBe(7);
    const second = sched.tick(at);
    expect(second.firings.length).toBe(0);
    // No duplicate ScheduledTriggers were appended.
    let count = 0;
    for (const _e of store.replay({ type: "ScheduledTrigger" })) count++;
    expect(count).toBe(7);
  });

  it("skips public holidays — emits with holidayShiftedFrom", () => {
    const store = newStore();
    // Daily 06:00Z. New Year's Day 2027 is a Friday.
    const source = inMemorySchedulerSource({
      cronMap: { "atlas:test-trigger": "0 6 * * *" },
      handlers: [{ agent: "Atlas", trigger: "test-trigger", cadenceHours: 24 }],
    });
    const sched = new LocalScheduler({ eventStore: store, source });
    sched.syncRegistry(new Date("2027-01-01T00:00:00Z"));
    // Tick well into Jan 2 (so any shifted fire from Jan 1 would have
    // landed already).
    const result = sched.tick(new Date("2027-01-02T12:00:00Z"));
    // The Jan 1 fire should have shifted to Jan 2.
    const shifted = result.firings.find((f) => f.holidayShiftedFrom !== undefined);
    expect(shifted).toBeDefined();
    expect(shifted?.holidayShiftedFrom).toBe("2027-01-01T06:00:00.000Z");
  });
});

describe("LocalScheduler — inactivityCheck (lifecycle-pair fold)", () => {
  // Helper — append a typed SubstrateAgentRunStarted event.
  function appendStarted(
    store: EventStore,
    args: {
      agent: string;
      trigger: string;
      runId: string;
      startedAt: string;
    },
  ): void {
    store.append(
      makeSubstrateAgentRunStarted({
        asOf: args.startedAt,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:atlas:substrate-runner" },
        citations: ["D-AGENT-RUNTIME-AUTHORIZE", "GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-09"],
        payload: {
          runId: args.runId,
          agent: args.agent,
          trigger: { kind: "scheduled", id: args.trigger },
          startedAt: args.startedAt,
          dryRun: false,
          substrate: "agent-runtime",
          sequenceAtStart: 0,
        },
      }),
    );
  }

  function appendCompleted(
    store: EventStore,
    args: {
      agent: string;
      runId: string;
      completedAt: string;
      ok?: boolean;
    },
  ): void {
    store.append(
      makeSubstrateAgentRunCompleted({
        asOf: args.completedAt,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:atlas:substrate-runner" },
        citations: ["D-AGENT-RUNTIME-AUTHORIZE", "GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-09"],
        payload: {
          runId: args.runId,
          agent: args.agent,
          completedAt: args.completedAt,
          durationMs: 100,
          ok: args.ok ?? true,
          eventsEmitted: 0,
          decisionsEmitted: 0,
          escalationsEmitted: 0,
          sequenceAtCompletion: 1,
          summary: "test run completed",
        },
      }),
    );
  }

  function appendFailed(
    store: EventStore,
    args: {
      agent: string;
      runId: string;
      failedAt: string;
    },
  ): void {
    store.append(
      makeSubstrateAgentRunFailed({
        asOf: args.failedAt,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:atlas:substrate-runner" },
        citations: ["D-AGENT-RUNTIME-AUTHORIZE", "GOV-FRAMEWORK-CEO-RESERVED", "ORG-CY-09"],
        payload: {
          runId: args.runId,
          agent: args.agent,
          failedAt: args.failedAt,
          durationMs: 100,
          errorClass: "exception",
          errorMessage: "test failure",
          sequenceAtFailure: 1,
        },
      }),
    );
  }

  function veraSched(store: EventStore): LocalScheduler {
    const source = inMemorySchedulerSource({
      cronMap: { "vera:overnight-recon": "13 2 * * *" },
      handlers: [{ agent: "Vera", trigger: "overnight-recon", cadenceHours: 24 }],
      slaForAgent: (a) => (a === "vera" ? 24 : undefined),
    });
    return new LocalScheduler({ eventStore: store, source });
  }

  it("no-runs: emits a no-runs SubstrateAlert when agent has never run", () => {
    const store = new EventStore(":memory:");
    const sched = veraSched(store);
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    const result = sched.inactivityCheck(new Date("2026-05-08T12:00:00Z"));
    expect(result.findings.length).toBe(1);
    expect(result.findings[0]?.findingClass).toBe("no-runs");
    expect(result.findings[0]?.agentUrn).toBe("agent:vera");
    expect(result.findings[0]?.alertId.endsWith("-no-runs")).toBe(true);
    let count = 0;
    for (const _e of store.replay({ type: "SubstrateAlert" })) count++;
    expect(count).toBe(1);
  });

  it("idempotent: re-running inactivityCheck does not duplicate alerts", () => {
    const store = new EventStore(":memory:");
    const sched = veraSched(store);
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    const at = new Date("2026-05-08T12:00:00Z");
    sched.inactivityCheck(at);
    sched.inactivityCheck(at);
    let count = 0;
    for (const _e of store.replay({ type: "SubstrateAlert" })) count++;
    expect(count).toBe(1);
  });

  it("recent paired Started+Completed: no alert", () => {
    const store = new EventStore(":memory:");
    const sched = veraSched(store);
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    appendStarted(store, {
      agent: "Vera",
      trigger: "overnight-recon",
      runId: "run:vera:20260508T020000000Z:abc12345",
      startedAt: "2026-05-08T02:00:00.000Z",
    });
    appendCompleted(store, {
      agent: "Vera",
      runId: "run:vera:20260508T020000000Z:abc12345",
      completedAt: "2026-05-08T02:00:01.000Z",
    });
    // 2h after the most recent close — well inside the 24h SLA.
    const result = sched.inactivityCheck(new Date("2026-05-08T04:00:00Z"));
    expect(result.findings.length).toBe(0);
    let count = 0;
    for (const _e of store.replay({ type: "SubstrateAlert" })) count++;
    expect(count).toBe(0);
  });

  it("stale-runs: paired Started+Completed older than SLA → stale-runs alert", () => {
    const store = new EventStore(":memory:");
    const sched = veraSched(store);
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    appendStarted(store, {
      agent: "Vera",
      trigger: "overnight-recon",
      runId: "run:vera:20260506T020000000Z:abc12345",
      startedAt: "2026-05-06T02:00:00.000Z",
    });
    appendCompleted(store, {
      agent: "Vera",
      runId: "run:vera:20260506T020000000Z:abc12345",
      completedAt: "2026-05-06T02:00:01.000Z",
    });
    // 48h after the most recent close — past the 24h SLA.
    const result = sched.inactivityCheck(new Date("2026-05-08T02:00:01Z"));
    expect(result.findings.length).toBe(1);
    expect(result.findings[0]?.findingClass).toBe("stale-runs");
    expect(result.findings[0]?.alertId.endsWith("-stale-runs")).toBe(true);
    expect(result.findings[0]?.hoursSinceLastEvent).toBeGreaterThan(24);
    expect(result.findings[0]?.hoursSinceLastEvent).toBeLessThan(72);
  });

  it("Failed close also resets stale-runs (treated as a closed run)", () => {
    const store = new EventStore(":memory:");
    const sched = veraSched(store);
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    appendStarted(store, {
      agent: "Vera",
      trigger: "overnight-recon",
      runId: "run:vera:20260508T020000000Z:abc12345",
      startedAt: "2026-05-08T02:00:00.000Z",
    });
    appendFailed(store, {
      agent: "Vera",
      runId: "run:vera:20260508T020000000Z:abc12345",
      failedAt: "2026-05-08T02:00:01.000Z",
    });
    // 4h after a Failed close — well inside the 24h SLA.
    const result = sched.inactivityCheck(new Date("2026-05-08T06:00:01Z"));
    expect(result.findings.length).toBe(0);
  });

  it("orphaned-run: Started without close past SLA → orphaned-run alert", () => {
    const store = new EventStore(":memory:");
    const sched = veraSched(store);
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    // A run started 36h ago, never closed.
    appendStarted(store, {
      agent: "Vera",
      trigger: "overnight-recon",
      runId: "run:vera:20260506T140000000Z:orph0001",
      startedAt: "2026-05-06T14:00:00.000Z",
    });
    const result = sched.inactivityCheck(new Date("2026-05-08T02:00:00Z"));
    // We expect both a stale-runs (no closed-run ever, so no-runs)
    // alert AND an orphaned-run alert — distinct alertIds.
    const orphan = result.findings.find((f) => f.findingClass === "orphaned-run");
    expect(orphan).toBeDefined();
    expect(orphan?.orphanedRunId).toBe("run:vera:20260506T140000000Z:orph0001");
    expect(orphan?.alertId).toContain("-orphan-");
    // Counterpart no-runs (no successful close ever).
    const noRuns = result.findings.find((f) => f.findingClass === "no-runs");
    expect(noRuns).toBeDefined();
    // Two distinct SubstrateAlert events.
    let count = 0;
    for (const _e of store.replay({ type: "SubstrateAlert" })) count++;
    expect(count).toBe(2);
  });

  it("orphaned-run: distinct runIds → distinct alerts (per-run idempotency)", () => {
    const store = new EventStore(":memory:");
    const sched = veraSched(store);
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    appendStarted(store, {
      agent: "Vera",
      trigger: "overnight-recon",
      runId: "run:vera:20260506T140000000Z:orph0001",
      startedAt: "2026-05-06T14:00:00.000Z",
    });
    appendStarted(store, {
      agent: "Vera",
      trigger: "overnight-recon",
      runId: "run:vera:20260506T150000000Z:orph0002",
      startedAt: "2026-05-06T15:00:00.000Z",
    });
    const result = sched.inactivityCheck(new Date("2026-05-08T02:00:00Z"));
    const orphans = result.findings.filter((f) => f.findingClass === "orphaned-run");
    expect(orphans.length).toBe(2);
    const orphanIds = new Set(orphans.map((o) => o.orphanedRunId));
    expect(orphanIds.has("run:vera:20260506T140000000Z:orph0001")).toBe(true);
    expect(orphanIds.has("run:vera:20260506T150000000Z:orph0002")).toBe(true);
    // Re-run is idempotent.
    const result2 = sched.inactivityCheck(new Date("2026-05-08T02:00:00Z"));
    expect(result2.findings.filter((f) => f.findingClass === "orphaned-run").length).toBe(2);
    let alertCount = 0;
    for (const _e of store.replay({ type: "SubstrateAlert" })) alertCount++;
    // 2 orphaned-run + 1 no-runs = 3 alerts; not duplicated on re-run.
    expect(alertCount).toBe(3);
  });

  it("regression: SubstrateAlert by the agent's URN does NOT mask inactivity (false-green guard)", () => {
    // Pre-#189 the inactivityCheck folded "any event by agent". The
    // scheduler's own SubstrateAlert by `agent:atlas:scheduler`
    // attributed to `agent:atlas` and false-greened Atlas's inactivity.
    // The lifecycle-pair fold ignores non-lifecycle events entirely.
    const store = new EventStore(":memory:");
    const source = inMemorySchedulerSource({
      cronMap: { "atlas:substrate-state": "19 6 * * 1" },
      handlers: [{ agent: "Atlas", trigger: "substrate-state", cadenceHours: 24 * 7 }],
      slaForAgent: (a) => (a === "atlas" ? 24 * 7 : undefined),
    });
    const sched = new LocalScheduler({ eventStore: store, source });
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    // Atlas has never closed a run, but the scheduler emits a
    // SubstrateAlert (sub-actor `agent:atlas:scheduler`). Under the old
    // heuristic this would mask inactivity; under the new fold it's
    // ignored.
    store.append(
      makeSubstrateAlert({
        asOf: "2026-05-08T01:00:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:atlas:scheduler" },
        citations: ["GOV-FRAMEWORK-CEO-RESERVED", "JOINT-STANDARD-2-2024", "ORG-CY-01"],
        payload: {
          alertId: "alert:integrity:test-noise",
          alertClass: "integrity",
          agentUrn: "agent:atlas:scheduler",
          details: "noise event",
          severity: "low",
        },
      }),
    );
    const result = sched.inactivityCheck(new Date("2026-05-08T02:00:00Z"));
    // Atlas should still be flagged as no-runs — the noise SubstrateAlert
    // does not count as a closed run.
    const noRuns = result.findings.find(
      (f) => f.agentUrn === "agent:atlas" && f.findingClass === "no-runs",
    );
    expect(noRuns).toBeDefined();
  });

  it("two agents in parallel: per-(agent,trigger) alertId scoping", () => {
    const store = new EventStore(":memory:");
    const source = inMemorySchedulerSource({
      cronMap: {
        "vera:overnight-recon": "13 2 * * *",
        "atlas:substrate-state": "19 6 * * 1",
      },
      handlers: [
        { agent: "Vera", trigger: "overnight-recon", cadenceHours: 24 },
        { agent: "Atlas", trigger: "substrate-state", cadenceHours: 24 * 7 },
      ],
      slaForAgent: (a) => (a === "vera" ? 24 : a === "atlas" ? 24 * 7 : undefined),
    });
    const sched = new LocalScheduler({ eventStore: store, source });
    sched.syncRegistry(new Date("2026-05-08T00:00:00Z"));
    // Vera ran fine recently; Atlas never ran.
    appendStarted(store, {
      agent: "Vera",
      trigger: "overnight-recon",
      runId: "run:vera:20260508T020000000Z:abc12345",
      startedAt: "2026-05-08T02:00:00.000Z",
    });
    appendCompleted(store, {
      agent: "Vera",
      runId: "run:vera:20260508T020000000Z:abc12345",
      completedAt: "2026-05-08T02:00:01.000Z",
    });
    const result = sched.inactivityCheck(new Date("2026-05-08T04:00:00Z"));
    // Atlas should be no-runs; Vera should be silent.
    expect(result.findings.length).toBe(1);
    expect(result.findings[0]?.agentUrn).toBe("agent:atlas");
    expect(result.findings[0]?.findingClass).toBe("no-runs");
  });
});
