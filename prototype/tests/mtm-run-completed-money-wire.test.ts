// tests/mtm-run-completed-money-wire.test.ts
//
// WS-MONEY-DECIMAL-PURGE-REMEDIATION Wave 2 — assert the MtmRunCompleted
// emitter writes the decimal `MoneyWire` encoding (totalPnlDelta) and NOT the
// legacy integer `totalPnlDeltaMinor` field, so a fresh MTM scheduler run adds
// ZERO new `*Minor` events to the canonical store.
//
// Authority: D-MONEY-DECIMAL-PURGE-REMEDIATION; D-MONEY-DECIMAL-REDENOMINATION.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { isMoneyWire, moneyWireFromMinor } from "../platform/core/money-codec";
import { makeMtmRunCompleted } from "../platform/event-store/event-types/mtm";

const ACTOR = { type: "service" as const, id: "rohan:mtm-run" };
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION", "IFRS-9-§5.7.1"];

describe("MtmRunCompleted — MoneyWire emission (money-purge Wave 2)", () => {
  it("emits totalPnlDelta as a MoneyWire object, never a *Minor number", () => {
    const event = makeMtmRunCompleted({
      asOf: "2026-06-14",
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        runId: "run-test-1",
        runType: "eod",
        asOf: "2026-06-14",
        positionsValued: 3,
        positionsSkipped: 0,
        skippedReasons: [],
        totalPnlDelta: moneyWireFromMinor(123_45, "ZAR"),
      },
    });

    const payload = event.payload as Record<string, unknown>;

    // The money field is a well-formed MoneyWire (string amount, never a float).
    expect(isMoneyWire(payload.totalPnlDelta)).toBe(true);
    expect((payload.totalPnlDelta as { amount: string }).amount).toBe("123.45");
    expect((payload.totalPnlDelta as { currency: string }).currency).toBe("ZAR");

    // The legacy *Minor field is GONE from the emitted payload.
    expect(payload.totalPnlDeltaMinor).toBeUndefined();

    // No payload key ends in "Minor" with a numeric value (the
    // recon:no-residual-minor-encoding contract, applied at emit-site).
    for (const [key, value] of Object.entries(payload)) {
      if (key.endsWith("Minor")) {
        expect(typeof value).not.toBe("number");
      }
    }
  });

  it("rejects a legacy totalPnlDeltaMinor payload at the factory (schema enforces V2)", () => {
    // A legacy payload (integer *Minor, no MoneyWire) must fail the V2 Zod parse
    // inside makeMtmRunCompleted. Built untyped so the test exercises the runtime
    // schema guard, not just the compile-time type (the type also forbids it).
    const legacyPayload = {
      runId: "run-test-2",
      runType: "eod" as const,
      asOf: "2026-06-14",
      positionsValued: 0,
      positionsSkipped: 0,
      skippedReasons: [] as string[],
      totalPnlDeltaMinor: 5000,
    };
    expect(() =>
      makeMtmRunCompleted({
        asOf: "2026-06-14",
        entity: "LE-ZA-HOZ-BANK",
        actor: ACTOR,
        citations: CITATIONS,
        payload: legacyPayload as unknown as Parameters<typeof makeMtmRunCompleted>[0]["payload"],
      }),
    ).toThrow();
  });
});
