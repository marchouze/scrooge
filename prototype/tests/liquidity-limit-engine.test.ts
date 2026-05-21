// tests/liquidity-limit-engine.test.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — Tests for the liquidity-limit engine substrate.
//
// Coverage:
//   - Event factories: LiquidityLimitBreached + LiquidityLimitBreachDisposed
//     payload validation; aggregateId derivation.
//   - breach-detector: tier-precedence (worst tier wins); floor vs ceiling
//     direction; multi-line; subjectRef + sourceEventId pass-through.
//   - tierStatus / checkLiquidityGate: gateway block on tier-1 red.
//   - Empty-state correctness: no observations → no breaches.
//   - Projection round-trip: emit + listOpenBreaches + dispose →
//     no longer open.
//
// Authority: D-RAS; LRM Policy v1; brief:ravi:liquidity-limit-engine-
//   mirroring-credit-limit-en:2026-05-21.
//
// Author: Ravi (Treasury and ALM engineer, engineering).

import { beforeEach, describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import {
  makeLiquidityLimitBreachDisposed,
  makeLiquidityLimitBreached,
} from "../platform/event-store/event-types/liquidity-limit";
import {
  DEFAULT_LIMIT_CONFIGS,
  checkLiquidityGate,
  detectBreaches,
  getBreachHistory,
  listOpenBreaches,
  observationBreachesConfig,
  resetBreachIdCounter,
  tierStatus,
} from "../platform/risk/liquidity-limit-engine";
import type { LiquidityLimitConfig } from "../platform/risk/liquidity-limit-engine/types";

const ENTITY = BANK_ZA_001;
const ACTOR = { type: "service" as const, id: "test:liquidity-limit-engine" };
const CITATIONS = ["D-RAS", "POLICY:liquidity-risk-management-policy-v1"];

function ts(year: number, month: number, day: number, hour = 10): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  return `${year}-${m}-${d}T${h}:00:00.000Z`;
}

// Counter to ensure unique IDs across tests, since the event store is
// process-singleton.
let testSeq = 0;
function uniqueId(prefix: string): string {
  testSeq += 1;
  return `${prefix}-${process.pid}-${testSeq}`;
}

beforeEach(() => {
  resetBreachIdCounter();
});

// ---------------------------------------------------------------------------
// Event factories
// ---------------------------------------------------------------------------

describe("liquidity-limit event factories", () => {
  it("builds a valid LiquidityLimitBreached event with full payload", () => {
    const asOf = ts(2026, 5, 21);
    const event = makeLiquidityLimitBreached({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        breachId: "LL-BREACH-2026-001",
        tier: "tier-1",
        line: "lcr-ratio",
        current: 95.5,
        threshold: 100,
        currentUnit: "percent",
        severity: "critical",
        detectedAt: asOf,
      },
    });
    expect(event.type).toBe("LiquidityLimitBreached");
    expect(event.aggregateLabel).toBe("liquidity-limit-breach:LL-BREACH-2026-001");
    const p = event.payload as { tier: string; line: string };
    expect(p.tier).toBe("tier-1");
    expect(p.line).toBe("lcr-ratio");
  });

  it("rejects an invalid tier enum value", () => {
    const asOf = ts(2026, 5, 21);
    expect(() =>
      makeLiquidityLimitBreached({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          breachId: "LL-BREACH-2026-XXX",
          // @ts-expect-error — exercising runtime schema validation
          tier: "tier-bogus",
          line: "lcr-ratio",
          current: 95,
          threshold: 100,
          currentUnit: "percent",
          severity: "critical",
          detectedAt: asOf,
        },
      }),
    ).toThrow();
  });

  it("builds a valid LiquidityLimitBreachDisposed event", () => {
    const asOf = ts(2026, 5, 22);
    const event = makeLiquidityLimitBreachDisposed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        breachId: "LL-BREACH-2026-001",
        disposition: "remediated",
        citation: "ALCO-DECISION-2026-05-22-001",
        finalValue: 122.0,
        disposedBy: "Eitan",
        disposedAt: asOf,
      },
    });
    expect(event.type).toBe("LiquidityLimitBreachDisposed");
    expect(event.aggregateLabel).toBe("liquidity-limit-breach:LL-BREACH-2026-001");
  });
});

// ---------------------------------------------------------------------------
// observationBreachesConfig — pure comparator
// ---------------------------------------------------------------------------

describe("observationBreachesConfig", () => {
  it("treats `floor` as 'below threshold = breach'", () => {
    const cfg: LiquidityLimitConfig = {
      tier: "tier-1",
      line: "lcr-ratio",
      threshold: 100,
      direction: "floor",
      severity: "critical",
      currentUnit: "percent",
    };
    expect(observationBreachesConfig({ line: "lcr-ratio", current: 99 }, cfg)).toBe(true);
    expect(observationBreachesConfig({ line: "lcr-ratio", current: 100 }, cfg)).toBe(false);
    expect(observationBreachesConfig({ line: "lcr-ratio", current: 101 }, cfg)).toBe(false);
  });

  it("treats `ceiling` as 'above threshold = breach'", () => {
    const cfg: LiquidityLimitConfig = {
      tier: "tier-2",
      line: "funding-concentration-counterparty",
      threshold: 15,
      direction: "ceiling",
      severity: "high",
      currentUnit: "percent",
    };
    expect(
      observationBreachesConfig({ line: "funding-concentration-counterparty", current: 16 }, cfg),
    ).toBe(true);
    expect(
      observationBreachesConfig({ line: "funding-concentration-counterparty", current: 15 }, cfg),
    ).toBe(false);
    expect(
      observationBreachesConfig({ line: "funding-concentration-counterparty", current: 14 }, cfg),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectBreaches — tier precedence, multi-line, empty-state
// ---------------------------------------------------------------------------

describe("detectBreaches", () => {
  it("returns no breaches when all observations are within tiers", () => {
    const result = detectBreaches({
      observations: [
        { line: "lcr-ratio", current: 135 },
        { line: "nsfr-ratio", current: 130 },
        { line: "funding-concentration-counterparty", current: 10 },
      ],
      asOf: ts(2026, 5, 21),
    });
    expect(result.newBreaches).toEqual([]);
  });

  it("returns one breach per observation, with worst-tier severity", () => {
    // LCR 95: breaches tier-1 (< 100), tier-2 (< 120), tier-3 (< 130).
    // Worst tier = tier-1, severity = critical.
    const result = detectBreaches({
      observations: [{ line: "lcr-ratio", current: 95 }],
      asOf: ts(2026, 5, 21),
    });
    expect(result.newBreaches.length).toBe(1);
    const b = result.newBreaches[0]!;
    expect(b.tier).toBe("tier-1");
    expect(b.severity).toBe("critical");
    expect(b.current).toBe(95);
    expect(b.threshold).toBe(100);
  });

  it("returns tier-2 severity when only tier-2 + tier-3 cross (above PA minimum)", () => {
    // LCR 110: passes tier-1 (>= 100), breaches tier-2 (< 120), tier-3 (< 130).
    // Worst tier = tier-2, severity = high.
    const result = detectBreaches({
      observations: [{ line: "lcr-ratio", current: 110 }],
      asOf: ts(2026, 5, 21),
    });
    expect(result.newBreaches.length).toBe(1);
    const b = result.newBreaches[0]!;
    expect(b.tier).toBe("tier-2");
    expect(b.severity).toBe("high");
    expect(b.threshold).toBe(120);
  });

  it("returns tier-3 severity when only tier-3 crosses", () => {
    // LCR 125: passes tier-1 + tier-2, breaches tier-3 (< 130).
    const result = detectBreaches({
      observations: [{ line: "lcr-ratio", current: 125 }],
      asOf: ts(2026, 5, 21),
    });
    expect(result.newBreaches.length).toBe(1);
    const b = result.newBreaches[0]!;
    expect(b.tier).toBe("tier-3");
    expect(b.severity).toBe("medium");
  });

  it("emits one breach per line when multiple lines breach", () => {
    const result = detectBreaches({
      observations: [
        { line: "lcr-ratio", current: 95 },
        { line: "nsfr-ratio", current: 95 },
        { line: "funding-concentration-counterparty", current: 30 },
      ],
      asOf: ts(2026, 5, 21),
    });
    expect(result.newBreaches.length).toBe(3);
    expect(result.newBreaches.map((b) => b.line).sort()).toEqual([
      "funding-concentration-counterparty",
      "lcr-ratio",
      "nsfr-ratio",
    ]);
    // All tier-1 / critical because all values cross the tier-1 floor / ceiling.
    expect(result.newBreaches.every((b) => b.severity === "critical")).toBe(true);
  });

  it("passes through subjectRef and sourceEventId to the breach payload", () => {
    const result = detectBreaches({
      observations: [
        {
          line: "funding-concentration-counterparty",
          current: 18,
          subjectRef: "PARTY-LEI-EXAMPLE-CP",
          sourceEventId: "src-event-id-123",
        },
      ],
      asOf: ts(2026, 5, 21),
    });
    expect(result.newBreaches.length).toBe(1);
    const b = result.newBreaches[0]!;
    expect(b.subjectRef).toBe("PARTY-LEI-EXAMPLE-CP");
    expect(b.sourceEventId).toBe("src-event-id-123");
    expect(b.tier).toBe("tier-2");
  });

  it("returns empty breaches on empty observation list (no-positions reality)", () => {
    const result = detectBreaches({ observations: [], asOf: ts(2026, 5, 21) });
    expect(result.newBreaches).toEqual([]);
  });

  it("ignores lines with no configured tiers", () => {
    const result = detectBreaches({
      observations: [
        // Line not in `liquidityLimitLineSchema` is type-rejected at the
        // payload level; here we test the engine's defensive filtering.
        { line: "contingent-liquidity", current: -1_000_000_000 },
      ],
      // No config rows for contingent-liquidity in DEFAULT_LIMIT_CONFIGS.
      asOf: ts(2026, 5, 21),
    });
    expect(result.newBreaches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// tierStatus + checkLiquidityGate — gateway block
// ---------------------------------------------------------------------------

describe("tierStatus + checkLiquidityGate", () => {
  it("returns ok when all observations are within tier-1", () => {
    const gate = checkLiquidityGate({
      observations: [
        { line: "lcr-ratio", current: 135 },
        { line: "nsfr-ratio", current: 130 },
      ],
      asOf: ts(2026, 5, 21),
    });
    expect(gate.ok).toBe(true);
    expect(gate.redLines).toEqual([]);
  });

  it("blocks on tier-1 LCR red with the LCR-specific reason", () => {
    const gate = checkLiquidityGate({
      observations: [{ line: "lcr-ratio", current: 95 }],
      asOf: ts(2026, 5, 21),
    });
    expect(gate.ok).toBe(false);
    expect(gate.blockReason).toBe("Tier1LiquidityRed");
    expect(gate.redLines.length).toBe(1);
    expect(gate.redLines[0]!.line).toBe("lcr-ratio");
    expect(gate.message).toContain("D-RAS");
    expect(gate.message).toContain("LRM Policy");
  });

  it("blocks on intraday-buffer red with the intraday-specific reason", () => {
    const gate = checkLiquidityGate({
      observations: [{ line: "intraday-liquidity-buffer", current: -100 }],
      asOf: ts(2026, 5, 21),
    });
    expect(gate.ok).toBe(false);
    expect(gate.blockReason).toBe("Tier1IntradayBreach");
  });

  it("blocks on counterparty concentration tier-1 red", () => {
    const gate = checkLiquidityGate({
      observations: [
        { line: "funding-concentration-counterparty", current: 30 },
      ],
      asOf: ts(2026, 5, 21),
    });
    expect(gate.ok).toBe(false);
    expect(gate.blockReason).toBe("Tier1ConcentrationBreach");
  });

  it("permits tier-2 / tier-3 only — no tier-1 red", () => {
    // LCR 110 = tier-2 (high), but the gateway only blocks on tier-1 red.
    const gate = checkLiquidityGate({
      observations: [{ line: "lcr-ratio", current: 110 }],
      asOf: ts(2026, 5, 21),
    });
    expect(gate.ok).toBe(true);
  });

  it("tierStatus reports red lines without making any gate decision", () => {
    const status = tierStatus({
      observations: [
        { line: "lcr-ratio", current: 95 },
        { line: "nsfr-ratio", current: 95 },
      ],
      asOf: ts(2026, 5, 21),
    });
    expect(status.tier1Red).toBe(true);
    expect(status.tier1RedLines.length).toBe(2);
    expect(status.observationsCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Default-config coverage assertion
// ---------------------------------------------------------------------------

describe("DEFAULT_LIMIT_CONFIGS coverage", () => {
  it("covers every RAS B3-family line with at least one tier", () => {
    const requiredLines = [
      "lcr-ratio",
      "nsfr-ratio",
      "intraday-liquidity-buffer",
      "funding-concentration-counterparty",
      "funding-concentration-depositor",
      "funding-concentration-tenor",
      "hqla-concentration",
    ];
    const coveredLines = new Set(DEFAULT_LIMIT_CONFIGS.map((c) => c.line));
    for (const line of requiredLines) {
      expect(coveredLines.has(line as never)).toBe(true);
    }
  });

  it("has tier-1 configured for the hard-line ratios + concentrations", () => {
    const tier1Lines = new Set(
      DEFAULT_LIMIT_CONFIGS.filter((c) => c.tier === "tier-1").map((c) => c.line),
    );
    expect(tier1Lines.has("lcr-ratio")).toBe(true);
    expect(tier1Lines.has("nsfr-ratio")).toBe(true);
    expect(tier1Lines.has("funding-concentration-counterparty")).toBe(true);
    expect(tier1Lines.has("hqla-concentration")).toBe(true);
  });

  it("threshold ladder is monotonic for floor lines (tier-1 < tier-2 < tier-3)", () => {
    // LCR: 100 (tier-1) < 120 (tier-2) < 130 (tier-3).
    const lcrTiers = DEFAULT_LIMIT_CONFIGS.filter((c) => c.line === "lcr-ratio");
    expect(lcrTiers.length).toBe(3);
    const byTier = Object.fromEntries(lcrTiers.map((c) => [c.tier, c.threshold]));
    expect(byTier["tier-1"]).toBeLessThan(byTier["tier-2"]!);
    expect(byTier["tier-2"]).toBeLessThan(byTier["tier-3"]!);
  });
});

// ---------------------------------------------------------------------------
// Round-trip via the event store: emit breach → listOpenBreaches → dispose
// → no longer open
// ---------------------------------------------------------------------------

describe("liquidity-limit projection round-trip via event store", () => {
  it("lists open breaches that have no matching disposal; excludes disposed", () => {
    const breachId = uniqueId("LL-BREACH-2026-RT");
    const detectedAt = ts(2026, 5, 21, 9);

    eventStore.append(
      makeLiquidityLimitBreached({
        asOf: detectedAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          breachId,
          tier: "tier-2",
          line: "lcr-ratio",
          current: 110,
          threshold: 120,
          currentUnit: "percent",
          severity: "high",
          detectedAt,
        },
      }),
    );

    // Before disposal — breach is open.
    const openBefore = listOpenBreaches();
    expect(openBefore.some((b) => b.breachId === breachId)).toBe(true);

    // Dispose.
    const disposedAt = ts(2026, 5, 22, 9);
    eventStore.append(
      makeLiquidityLimitBreachDisposed({
        asOf: disposedAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          breachId,
          disposition: "remediated",
          citation: "ALCO-DECISION-test-001",
          finalValue: 122.0,
          disposedBy: "Eitan",
          disposedAt,
        },
      }),
    );

    // After disposal — no longer open.
    const openAfter = listOpenBreaches();
    expect(openAfter.some((b) => b.breachId === breachId)).toBe(false);
  });

  it("getBreachHistory returns events in chronological order", () => {
    const breachId = uniqueId("LL-BREACH-2026-HIST");
    const detectedAt = ts(2026, 5, 23, 9);
    const disposedAt = ts(2026, 5, 24, 9);

    eventStore.append(
      makeLiquidityLimitBreached({
        asOf: detectedAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          breachId,
          tier: "tier-1",
          line: "lcr-ratio",
          current: 95,
          threshold: 100,
          currentUnit: "percent",
          severity: "critical",
          detectedAt,
        },
      }),
    );
    eventStore.append(
      makeLiquidityLimitBreachDisposed({
        asOf: disposedAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          breachId,
          disposition: "remediated",
          citation: "ALCO-test-2",
          finalValue: 122,
          disposedBy: "Eitan",
          disposedAt,
        },
      }),
    );

    const history = getBreachHistory(breachId);
    expect(history.length).toBe(2);
    expect(history[0]!.type).toBe("LiquidityLimitBreached");
    expect(history[1]!.type).toBe("LiquidityLimitBreachDisposed");
  });
});
