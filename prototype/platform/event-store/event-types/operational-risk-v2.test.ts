// platform/event-store/event-types/operational-risk-v2.test.ts
//
// Bucket A batch A3 (FINAL) — OperationalLossEventV2 round-trip + the
// positive-figure emit proof (D-V1-REMOVAL-FLIP-BASIS-RBC condition 2).
//
// The op-loss data set is legitimately empty in the build phase (capture-only),
// so recon:operational-loss-v2-parity is PASS-on-empty on the production store.
// THIS test is the honest place to prove the V2 sole-live capture path actually
// produces a decoded positive figure: it captures an OperationalLossEventV2 with
// grossLoss R500.00 into an isolated tmp store and asserts (a) the projection
// reads it (R500.00 = 50_000 minor), and (b) a V1 decode and the V2 decode of
// the SAME loss are byte-identical on decoded decimal value (the parity gate's
// C3 invariant).
//
// Author: Atlas (Core banking platform architect, engineering).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { moneyWireFromMinor } from "../../core/money-codec";
import { buildOperationalLossProjection } from "../../reporting/operational-loss-projection";
import { EventStore } from "../store";
import {
  type OperationalLossEventPayload,
  decodeOperationalLossV1Decimal,
  decodeOperationalLossV2Decimal,
  makeOperationalLossEventV2,
  operationalLossEventV2PayloadSchema,
} from "./operational-risk";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:tomas:oprisk-test" };

describe("OperationalLossEventV2 — decimal-native capture", () => {
  it("captures a positive grossLoss and the projection reads it (R500.00)", () => {
    const dir = mkdtempSync(join(tmpdir(), "op-loss-v2-test-"));
    try {
      const store = new EventStore(join(dir, "loss.db"));
      store.append(
        makeOperationalLossEventV2({
          asOf: "2026-06-16T00:00:00.000Z",
          entity: ENTITY,
          actor: ACTOR,
          citations: ["D-FX-HELD-DIMS-SEAT-SWEEP", "BCBS-D196-§644"],
          payload: {
            lossEventId: "OLE-V2-001",
            eventDate: "2026-06-14",
            discoveryDate: "2026-06-15",
            grossLoss: moneyWireFromMinor(500_00, "ZAR"),
            recovery: moneyWireFromMinor(100_00, "ZAR"),
            businessLine: "trading-and-sales",
            eventTypeCategory: "execution-delivery-and-process-management",
            status: "open",
            description: "test loss",
          },
        }),
      );
      const proj = buildOperationalLossProjection(store);
      store.close();

      expect(proj.totals.count).toBe(1);
      expect(proj.totals.grossLossMinor).toBe(500_00);
      expect(proj.totals.recoveryMinor).toBe(100_00);
      expect(proj.totals.netLossMinor).toBe(400_00);
      expect(proj.openRecords.length).toBe(1);
      const rec = proj.records[0];
      expect(rec?.currency).toBe("ZAR");
      expect(rec?.businessLine).toBe("trading-and-sales");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is currency-agnostic — no ?? ZAR fallback (captures USD)", () => {
    const parsed = operationalLossEventV2PayloadSchema.parse({
      lossEventId: "OLE-V2-USD",
      eventDate: "2026-06-14",
      discoveryDate: "2026-06-15",
      grossLoss: moneyWireFromMinor(250_00, "USD"),
      recovery: moneyWireFromMinor(0, "USD"),
      businessLine: "corporate-finance",
      eventTypeCategory: "internal-fraud",
      status: "open",
      description: "usd loss",
    });
    expect(parsed.grossLoss.currency).toBe("USD");
    expect(parsed.recovery.currency).toBe("USD");
  });

  it("V1 decode and V2 decode of the same loss agree on decoded decimal value", () => {
    const v1: OperationalLossEventPayload = {
      lossEventId: "OLE-PARITY-001",
      eventDate: "2026-06-14",
      discoveryDate: "2026-06-15",
      grossLossMinor: 777_55,
      currency: "ZAR",
      businessLine: "retail-banking",
      eventTypeCategory: "external-fraud",
      recoveryMinor: 123_45,
      status: "under-investigation",
      description: "card fraud",
    };
    const v1Decoded = decodeOperationalLossV1Decimal(v1, "ev-v1");
    const v2Decoded = decodeOperationalLossV2Decimal(
      {
        lossEventId: v1.lossEventId,
        eventDate: v1.eventDate,
        discoveryDate: v1.discoveryDate,
        grossLoss: moneyWireFromMinor(777_55, "ZAR"),
        recovery: moneyWireFromMinor(123_45, "ZAR"),
        businessLine: v1.businessLine,
        eventTypeCategory: v1.eventTypeCategory,
        status: v1.status,
        description: v1.description,
      },
      "ev-v2",
    );

    expect(v1Decoded.grossLoss).toBe("777.55");
    expect(v1Decoded.grossLoss).toBe(v2Decoded.grossLoss);
    expect(v1Decoded.recovery).toBe(v2Decoded.recovery);
    expect(v1Decoded.grossLossCurrency).toBe(v2Decoded.grossLossCurrency);
    expect(v1Decoded.businessLine).toBe(v2Decoded.businessLine);
    expect(v1Decoded.eventTypeCategory).toBe(v2Decoded.eventTypeCategory);
    expect(v1Decoded.status).toBe(v2Decoded.status);
  });
});
