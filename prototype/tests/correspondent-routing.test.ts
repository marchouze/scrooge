// tests/correspondent-routing.test.ts
//
// Tests for the correspondent-routing v0 projection + switch-test event
// family. Validates:
//   - Straight resolution of `primary` / `backup` intents to the named
//     parties (Standard Bank ZA primary; FirstRand-RMB ZA backup) when
//     no switch-test window is active.
//   - During an active switch-test window, a deterministic-by-hash
//     fraction of `primary`-tagged traffic overrides to backup; the
//     remainder still routes to primary.
//   - 0% fraction = no override; 100% fraction = full failover.
//   - `switch-test-live-traffic` intent always routes via backup.
//   - Switch-test event factories validate + envelope their payloads.
//
// Author: Saskia (Head of Global Markets, governance) + Kai (Trading-systems
//   engineer) + Atlas (Core banking platform architect).

import { describe, expect, it } from "bun:test";

import {
  makeSwitchTestActivated,
  makeSwitchTestEnded,
  makeSwitchTestReport,
} from "../platform/event-store/event-types";
import {
  type CorrespondentPairConfig,
  applySwitchTestActivated,
  applySwitchTestEnded,
  fractionBucket,
  makeRoutingState,
  resolveCorrespondent,
  shouldOverrideToBackup,
} from "../platform/markets/correspondent-routing";

// Match the seed at prototype/seeds/correspondent-pair.json.
const SEED_CONFIG: CorrespondentPairConfig = {
  asOf: "2026-05-09",
  source: "D-FX-CORRESPONDENT-PAIR-NAMING (PR #59)",
  primary: {
    tag: "primary",
    partyName: "Standard Bank of South Africa Ltd",
    lei: "[citation: TBC pending Tomas LEI registration]",
    correspondentBankCode: "[citation: TBC pending Tomas BIC registration]",
    jurisdiction: "ZA",
  },
  backup: {
    tag: "backup",
    partyName: "FirstRand Bank Ltd (RMB)",
    lei: "[citation: TBC pending Tomas LEI registration]",
    correspondentBankCode: "[citation: TBC pending Tomas BIC registration]",
    jurisdiction: "ZA",
  },
  reserve: [
    {
      tag: "reserve-1",
      partyName: "Absa Bank Ltd",
      lei: "[citation: TBC]",
      correspondentBankCode: "[citation: TBC]",
      jurisdiction: "ZA",
    },
    {
      tag: "reserve-2",
      partyName: "Nedbank Ltd",
      lei: "[citation: TBC]",
      correspondentBankCode: "[citation: TBC]",
      jurisdiction: "ZA",
    },
  ],
};

describe("correspondent-routing — straight resolution (no switch-test window)", () => {
  it("resolves `primary` to Standard Bank ZA", () => {
    const state = makeRoutingState(SEED_CONFIG);
    const resolved = resolveCorrespondent(state, {
      kind: "primary",
      correlationId: "trade-001",
      asOf: "2026-05-09",
    });
    expect(resolved.party.name).toBe("Standard Bank of South Africa Ltd");
    expect(resolved.party.jurisdiction).toBe("ZA");
    expect(resolved.resolvedTag).toBe("primary");
    expect(resolved.overriddenBySwitchTest).toBe(false);
    expect(resolved.party.role).toBe("settlement-agent");
  });

  it("resolves `backup` to FirstRand-RMB ZA", () => {
    const state = makeRoutingState(SEED_CONFIG);
    const resolved = resolveCorrespondent(state, {
      kind: "backup",
      correlationId: "trade-002",
      asOf: "2026-05-09",
    });
    expect(resolved.party.name).toBe("FirstRand Bank Ltd (RMB)");
    expect(resolved.party.jurisdiction).toBe("ZA");
    expect(resolved.resolvedTag).toBe("backup");
    expect(resolved.overriddenBySwitchTest).toBe(false);
  });

  it("resolution is deterministic — same intent + same state → same party", () => {
    const state = makeRoutingState(SEED_CONFIG);
    const a = resolveCorrespondent(state, {
      kind: "primary",
      correlationId: "trade-003",
      asOf: "2026-05-09",
    });
    const b = resolveCorrespondent(state, {
      kind: "primary",
      correlationId: "trade-003",
      asOf: "2026-05-09",
    });
    expect(a.party.partyId).toBe(b.party.partyId);
  });
});

describe("correspondent-routing — switch-test window override", () => {
  it("with 5% fraction, ~5% of primary traffic routes via backup (deterministic-by-hash)", () => {
    let state = makeRoutingState(SEED_CONFIG);
    state = applySwitchTestActivated(state, {
      windowId: "switch-test:2026-Q2:cycle-1",
      openedAt: "2026-05-09T08:00:00Z",
      fraction: 0.05,
    });
    let backupCount = 0;
    const N = 10_000;
    for (let i = 0; i < N; i += 1) {
      const resolved = resolveCorrespondent(state, {
        kind: "primary",
        correlationId: `trade-${i}`,
        asOf: "2026-05-09",
      });
      if (resolved.resolvedTag === "backup") backupCount += 1;
    }
    // Hash distribution should land within ±2pp of the configured fraction.
    expect(backupCount / N).toBeGreaterThan(0.03);
    expect(backupCount / N).toBeLessThan(0.07);
  });

  it("with 10% fraction, ~10% of primary traffic routes via backup", () => {
    let state = makeRoutingState(SEED_CONFIG);
    state = applySwitchTestActivated(state, {
      windowId: "switch-test:2026-Q2:cycle-2",
      openedAt: "2026-05-09T08:00:00Z",
      fraction: 0.1,
    });
    let backupCount = 0;
    const N = 10_000;
    for (let i = 0; i < N; i += 1) {
      const resolved = resolveCorrespondent(state, {
        kind: "primary",
        correlationId: `trade-${i}`,
        asOf: "2026-05-09",
      });
      if (resolved.resolvedTag === "backup") backupCount += 1;
    }
    expect(backupCount / N).toBeGreaterThan(0.08);
    expect(backupCount / N).toBeLessThan(0.12);
  });

  it("0% fraction = no override (sanity-test case)", () => {
    let state = makeRoutingState(SEED_CONFIG);
    state = applySwitchTestActivated(state, {
      windowId: "switch-test:2026-Q2:zero",
      openedAt: "2026-05-09T08:00:00Z",
      fraction: 0,
    });
    for (let i = 0; i < 200; i += 1) {
      const resolved = resolveCorrespondent(state, {
        kind: "primary",
        correlationId: `trade-${i}`,
        asOf: "2026-05-09",
      });
      expect(resolved.resolvedTag).toBe("primary");
      expect(resolved.overriddenBySwitchTest).toBe(false);
    }
  });

  it("100% fraction = full failover (allowed per proposal §4 trigger 1)", () => {
    let state = makeRoutingState(SEED_CONFIG);
    state = applySwitchTestActivated(state, {
      windowId: "switch-test:2026-Q2:full-failover",
      openedAt: "2026-05-09T08:00:00Z",
      fraction: 1,
    });
    for (let i = 0; i < 200; i += 1) {
      const resolved = resolveCorrespondent(state, {
        kind: "primary",
        correlationId: `trade-${i}`,
        asOf: "2026-05-09",
      });
      expect(resolved.resolvedTag).toBe("backup");
      expect(resolved.overriddenBySwitchTest).toBe(true);
      expect(resolved.switchTestWindowId).toBe("switch-test:2026-Q2:full-failover");
    }
  });

  it("override is deterministic by correlationId — same id always lands on same leg in same window", () => {
    let state = makeRoutingState(SEED_CONFIG);
    state = applySwitchTestActivated(state, {
      windowId: "switch-test:2026-Q2:determinism",
      openedAt: "2026-05-09T08:00:00Z",
      fraction: 0.5,
    });
    const intent = {
      kind: "primary" as const,
      correlationId: "trade-stable-id",
      asOf: "2026-05-09",
    };
    const a = resolveCorrespondent(state, intent);
    const b = resolveCorrespondent(state, intent);
    const c = resolveCorrespondent(state, intent);
    expect(a.resolvedTag).toBe(b.resolvedTag);
    expect(b.resolvedTag).toBe(c.resolvedTag);
  });

  it("after SwitchTestEnded, primary intents resolve to primary again", () => {
    let state = makeRoutingState(SEED_CONFIG);
    state = applySwitchTestActivated(state, {
      windowId: "switch-test:2026-Q2:closes",
      openedAt: "2026-05-09T08:00:00Z",
      fraction: 1,
    });
    state = applySwitchTestEnded(state, {
      windowId: "switch-test:2026-Q2:closes",
      closedAt: "2026-05-09T18:00:00Z",
    });
    const resolved = resolveCorrespondent(state, {
      kind: "primary",
      correlationId: "trade-after-close",
      asOf: "2026-05-09",
    });
    expect(resolved.resolvedTag).toBe("primary");
    expect(resolved.overriddenBySwitchTest).toBe(false);
  });

  it("`switch-test-live-traffic` intent always routes via backup", () => {
    const state = makeRoutingState(SEED_CONFIG);
    const resolved = resolveCorrespondent(state, {
      kind: "switch-test-live-traffic",
      correlationId: "trade-live-traffic",
      asOf: "2026-05-09",
    });
    expect(resolved.resolvedTag).toBe("backup");
    expect(resolved.party.name).toBe("FirstRand Bank Ltd (RMB)");
  });

  it("rejects activation with fraction > 1 or < 0", () => {
    const state = makeRoutingState(SEED_CONFIG);
    expect(() =>
      applySwitchTestActivated(state, {
        windowId: "bad",
        openedAt: "2026-05-09T08:00:00Z",
        fraction: 1.5,
      }),
    ).toThrow();
    expect(() =>
      applySwitchTestActivated(state, {
        windowId: "bad",
        openedAt: "2026-05-09T08:00:00Z",
        fraction: -0.1,
      }),
    ).toThrow();
  });

  it("idempotent — re-ending the same window is a no-op", () => {
    let state = makeRoutingState(SEED_CONFIG);
    state = applySwitchTestActivated(state, {
      windowId: "switch-test:2026-Q2:idem",
      openedAt: "2026-05-09T08:00:00Z",
      fraction: 0.5,
    });
    state = applySwitchTestEnded(state, {
      windowId: "switch-test:2026-Q2:idem",
      closedAt: "2026-05-09T18:00:00Z",
    });
    const stateAfter = applySwitchTestEnded(state, {
      windowId: "switch-test:2026-Q2:idem",
      closedAt: "2026-05-09T19:00:00Z",
    });
    const w = stateAfter.switchTestWindows.get("switch-test:2026-Q2:idem");
    expect(w?.closedAt).toBe("2026-05-09T18:00:00Z");
  });
});

describe("correspondent-routing — fractionBucket helper", () => {
  it("is deterministic", () => {
    expect(fractionBucket("w1", "trade-1")).toBe(fractionBucket("w1", "trade-1"));
  });

  it("is salted by windowId", () => {
    const a = fractionBucket("w1", "trade-1");
    const b = fractionBucket("w2", "trade-1");
    // Not strictly required to differ, but the FNV salting makes a
    // collision astronomically rare for short distinct prefixes.
    expect(a).not.toBe(b);
  });

  it("falls in [0, 1000)", () => {
    for (let i = 0; i < 200; i += 1) {
      const b = fractionBucket("w", `trade-${i}`);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(1000);
    }
  });

  it("shouldOverrideToBackup honours edge cases", () => {
    const window = {
      windowId: "w-edge",
      openedAt: "2026-05-09T08:00:00Z",
      fraction: 0,
    };
    expect(shouldOverrideToBackup(window, "any")).toBe(false);
    expect(shouldOverrideToBackup({ ...window, fraction: 1 }, "any")).toBe(true);
  });
});

describe("switch-test event family — typed factories", () => {
  it("makeSwitchTestActivated validates a well-formed payload", () => {
    const event = makeSwitchTestActivated({
      asOf: "2026-05-09T08:00:00Z",
      entity: "BANK-ZA-MAIN",
      actor: { type: "service", id: "agent:tomas" },
      citations: ["D-FX-CORRESPONDENT-PAIR-NAMING", "PR-58"],
      payload: {
        windowId: "switch-test:2026-Q2:cycle-1",
        openedAt: "2026-05-09T08:00:00Z",
        fraction: 0.07,
        rationale: "Quarterly cycle 1 — 7% live traffic via backup.",
        activatedBy: "agent:tomas",
      },
    });
    expect(event.type).toBe("SwitchTestActivated");
  });

  it("makeSwitchTestActivated rejects fraction outside [0, 1]", () => {
    expect(() =>
      makeSwitchTestActivated({
        asOf: "2026-05-09T08:00:00Z",
        entity: "BANK-ZA-MAIN",
        actor: { type: "service", id: "agent:tomas" },
        citations: ["D-FX-CORRESPONDENT-PAIR-NAMING"],
        payload: {
          windowId: "bad",
          openedAt: "2026-05-09T08:00:00Z",
          fraction: 1.5,
          rationale: "test",
          activatedBy: "agent:tomas",
        },
      }),
    ).toThrow();
  });

  it("makeSwitchTestEnded validates a well-formed payload", () => {
    const event = makeSwitchTestEnded({
      asOf: "2026-05-09T18:00:00Z",
      entity: "BANK-ZA-MAIN",
      actor: { type: "service", id: "agent:tomas" },
      citations: ["D-FX-CORRESPONDENT-PAIR-NAMING"],
      payload: {
        windowId: "switch-test:2026-Q2:cycle-1",
        closedAt: "2026-05-09T18:00:00Z",
        reason: "quarterly-cycle-complete",
        closedBy: "agent:tomas",
      },
    });
    expect(event.type).toBe("SwitchTestEnded");
  });

  it("makeSwitchTestReport validates a well-formed payload", () => {
    const event = makeSwitchTestReport({
      asOf: "2026-05-09T18:00:00Z",
      entity: "BANK-ZA-MAIN",
      actor: { type: "service", id: "agent:tomas" },
      citations: ["D-FX-CORRESPONDENT-PAIR-NAMING"],
      payload: {
        windowId: "switch-test:2026-Q2:cycle-1",
        primaryIntentCount: 1000,
        routedViaBackupCount: 72,
        observedFraction: 0.072,
        configuredFraction: 0.07,
        appetiteBandBreached: false,
        notes: "Within band.",
      },
    });
    expect(event.type).toBe("SwitchTestReport");
  });
});

// FX-settlement-instruction integration test deferred — the canonical
// `fxSettlementInstructedPayloadSchema` from PR #49 (`platform/markets/cdm/fx.ts`)
// uses a different field shape (`tradeId`, `legKind`, `settlementPath`,
// `settlementForm`, `netCash`, `messageStandard`) than this PR scaffolded
// against. The routing projection itself (resolveCorrespondent) is
// fully covered by the 20 tests above; the FX-settlement integration
// lands as a follow-on once Tomas (Operations & payments engineer) +
// Atlas (Core banking platform architect) reconcile the routing projection
// with main's canonical FX schema.
