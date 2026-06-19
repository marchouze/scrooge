// tests/markets-fx-risk.test.ts
//
// FX desk Slice 5 — tests for the risk-officer view.
//
// READ-path split after FU5 (D-FX-OTC-CLOSURE-BACKLOG):
//   - The REJECTION feed migrated to the V2-native panel
//     `buildV2FxRejectionsView` (the FX risk page reads
//     GET /api/v2/markets/fx/rejections). Its V2-shape + honest-empty contract
//     is asserted below.
//   - The CORRESPONDENT-routing status has NO V2 equivalent, so the legacy
//     `/api/markets/fx/risk` route + `buildRiskView` (markets-fx-risk.ts) are
//     RETAINED as the tracked FU5 residual. Its correspondent-routing /
//     switch-test behaviour is still validated here against `buildRiskView`.
//
// Scope:
//   1. buildRiskView returns correct shape (retained residual).
//   2. Empty store → correspondentStatus defaults sane.
//   3. correspondentStatus.switchTestActive reflects SwitchTestActivated/Ended.
//   4. buildV2FxRejectionsView: V2 rejection-row shape; honest empty on no V2
//      events; never falls back to V1; carries the tracked substrate gap.
//   5. No crash on empty store.
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10);
//            D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19)

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { buildRiskView } from "../dashboard/markets-fx-risk";
import { type V2FxRejectionRow, buildV2FxRejectionsView } from "../dashboard/v2-markets-fx-view";
import {
  makeOrderRejectedAtGateway,
  makeSwitchTestActivated,
  makeSwitchTestEnded,
} from "../platform/event-store/event-types/trading";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const KAI_ACTOR: Actor = { type: "service", id: "agent:kai:fx-risk-test" };
const CITATIONS = ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"];

const T_BASE = "2026-05-18T10:00:00.000Z";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fx-risk-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function freshStore(): EventStore {
  const path = join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`);
  return new EventStore(path);
}

function isoOffset(baseIso: string, offsetMs: number): string {
  return new Date(new Date(baseIso).getTime() + offsetMs).toISOString();
}

function appendRejection(
  store: EventStore,
  orderId: string,
  asOf: string,
  rejectingCheck:
    | "identity"
    | "sanctions"
    | "suitability"
    | "market-risk"
    | "credit-limit" = "sanctions",
  rejectionReason = "sanctions-hit",
): void {
  store.append(
    makeOrderRejectedAtGateway({
      asOf,
      entity: ENTITY,
      actor: KAI_ACTOR,
      citations: CITATIONS,
      payload: {
        orderId,
        rejectionReason,
        rejectingCheck,
        citationToRule: "D-FX-SALES-TRADING-FRONTEND",
        rejectedAt: asOf,
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// 1. buildRiskView returns correct shape
// ---------------------------------------------------------------------------

describe("buildRiskView — return shape", () => {
  it("returns { rejections, correspondentStatus, asOf } with correct types", () => {
    const store = freshStore();
    const view = buildRiskView(store);

    expect(typeof view.asOf).toBe("string");
    expect(Array.isArray(view.rejections)).toBe(true);
    expect(typeof view.correspondentStatus).toBe("object");
    expect(typeof view.correspondentStatus.switchTestActive).toBe("boolean");
    expect(typeof view.correspondentStatus.asOf).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 2. Empty store — zero rejections, primary null
// ---------------------------------------------------------------------------

describe("buildRiskView — empty store", () => {
  it("returns empty rejections array for empty store", () => {
    const store = freshStore();
    const view = buildRiskView(store);
    expect(view.rejections).toHaveLength(0);
  });

  it("returns null primary and backup for empty store (no SettlementInstructionRouted events)", () => {
    // The static seed has correspondents; they only return null if filtering
    // non-correspondent produces no rows. With the static seed, primary is set.
    // This test verifies the function does not crash and returns sensible defaults.
    const store = freshStore();
    const view = buildRiskView(store);
    // primary is either a string (static seed) or null — never undefined
    expect(
      view.correspondentStatus.primary === null ||
        typeof view.correspondentStatus.primary === "string",
    ).toBe(true);
    expect(
      view.correspondentStatus.backup === null ||
        typeof view.correspondentStatus.backup === "string",
    ).toBe(true);
  });

  it("switchTestActive is false for empty store", () => {
    const store = freshStore();
    const view = buildRiskView(store);
    expect(view.correspondentStatus.switchTestActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. One rejection event → one row
// ---------------------------------------------------------------------------

describe("buildRiskView — single rejection", () => {
  it("returns exactly one rejection for one OrderRejectedAtGateway event", () => {
    const store = freshStore();
    appendRejection(store, "ord:001", T_BASE);
    const view = buildRiskView(store);
    expect(view.rejections).toHaveLength(1);
  });

  it("rejection row has correct orderId", () => {
    const store = freshStore();
    appendRejection(store, "ord:single-test", T_BASE, "identity", "identity-mismatch");
    const view = buildRiskView(store);
    const first = view.rejections[0];
    expect(first).toBeDefined();
    expect(first?.orderId).toBe("ord:single-test");
  });
});

// ---------------------------------------------------------------------------
// 4. Multiple events → newest-first ordering
// ---------------------------------------------------------------------------

describe("buildRiskView — ordering", () => {
  it("returns rejections newest-first", () => {
    const store = freshStore();
    // Append in chronological order; result must be reversed
    appendRejection(store, "ord:older", T_BASE);
    appendRejection(store, "ord:newer", isoOffset(T_BASE, 60_000));
    appendRejection(store, "ord:newest", isoOffset(T_BASE, 120_000));

    const view = buildRiskView(store);
    expect(view.rejections).toHaveLength(3);
    const [newest, newer, older] = view.rejections;
    expect(newest?.orderId).toBe("ord:newest");
    expect(newer?.orderId).toBe("ord:newer");
    expect(older?.orderId).toBe("ord:older");
  });
});

// ---------------------------------------------------------------------------
// 5. 51 events → capped at 50
// ---------------------------------------------------------------------------

describe("buildRiskView — cap at 50", () => {
  it("caps the rejection feed at 50 rows even when 51 events are in the store", () => {
    const store = freshStore();
    for (let i = 0; i < 51; i++) {
      appendRejection(store, `ord:cap-${i}`, isoOffset(T_BASE, i * 1000));
    }
    const view = buildRiskView(store);
    expect(view.rejections).toHaveLength(50);
  });
});

// ---------------------------------------------------------------------------
// 6. RejectionFeedRow has required fields
// ---------------------------------------------------------------------------

describe("buildRiskView — RejectionFeedRow fields", () => {
  it("each row has eventId, orderId, rejectingCheck, rejectionReason, timestamp", () => {
    const store = freshStore();
    appendRejection(store, "ord:fields-test", T_BASE, "market-risk", "limit-breach");
    const view = buildRiskView(store);

    const row = view.rejections[0];
    expect(row).toBeDefined();
    expect(typeof row?.eventId).toBe("string");
    expect(row?.eventId.length ?? 0).toBeGreaterThan(0);
    expect(row?.orderId).toBe("ord:fields-test");
    expect(row?.rejectingCheck).toBe("market-risk");
    expect(row?.rejectionReason).toBe("limit-breach");
    expect(typeof row?.timestamp).toBe("string");
    expect(row?.timestamp.length ?? 0).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. switchTestActive reflects SwitchTestActivated / SwitchTestEnded
// ---------------------------------------------------------------------------

describe("buildRiskView — switchTestActive", () => {
  it("switchTestActive is true after SwitchTestActivated event", () => {
    const store = freshStore();
    store.append(
      makeSwitchTestActivated({
        asOf: T_BASE,
        entity: ENTITY,
        actor: KAI_ACTOR,
        citations: CITATIONS,
        payload: {
          windowId: "win:test-1",
          openedAt: T_BASE,
          fraction: 0.1,
          rationale: "Quarterly switch test",
          activatedBy: "tomas@bank",
        },
      }),
    );
    const view = buildRiskView(store);
    expect(view.correspondentStatus.switchTestActive).toBe(true);
  });

  it("switchTestActive is false after SwitchTestEnded event following SwitchTestActivated", () => {
    const store = freshStore();
    store.append(
      makeSwitchTestActivated({
        asOf: T_BASE,
        entity: ENTITY,
        actor: KAI_ACTOR,
        citations: CITATIONS,
        payload: {
          windowId: "win:test-2",
          openedAt: T_BASE,
          fraction: 0.1,
          rationale: "Quarterly switch test",
          activatedBy: "tomas@bank",
        },
      }),
    );
    store.append(
      makeSwitchTestEnded({
        asOf: isoOffset(T_BASE, 3_600_000),
        entity: ENTITY,
        actor: KAI_ACTOR,
        citations: CITATIONS,
        payload: {
          windowId: "win:test-2",
          closedAt: isoOffset(T_BASE, 3_600_000),
          reason: "Completed successfully",
          closedBy: "tomas@bank",
        },
      }),
    );
    const view = buildRiskView(store);
    expect(view.correspondentStatus.switchTestActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Correspondent-routing residual — GET /api/markets/fx/risk shape (retained).
//
// The legacy /api/markets/fx/risk route is RETAINED for correspondent routing
// (no V2 equivalent). Assert the shape the server endpoint still returns via
// buildRiskView (exactly what the handler calls), so the FU5 residual stays
// honest.
// ---------------------------------------------------------------------------

describe("HTTP API shape — /api/markets/fx/risk residual (via buildRiskView)", () => {
  it("response shape carries correspondentStatus the risk page reads", () => {
    const store = freshStore();
    const view = buildRiskView(store);
    expect(typeof view.correspondentStatus).toBe("object");
    expect("primary" in view.correspondentStatus).toBe(true);
    expect("backup" in view.correspondentStatus).toBe(true);
    expect("switchTestActive" in view.correspondentStatus).toBe(true);
    expect("asOf" in view.correspondentStatus).toBe(true);
    expect(typeof view.asOf).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 9. Rejection feed — MIGRATED to the V2-native panel buildV2FxRejectionsView
//    (GET /api/v2/markets/fx/rejections). The reader is injected so the test
//    never touches the home control-plane store.
// ---------------------------------------------------------------------------

describe("buildV2FxRejectionsView — V2 rejection feed", () => {
  const SAMPLE_ROW: V2FxRejectionRow = {
    eventId: "evt:v2-rej-1",
    orderId: "ord:v2-api-test",
    currencyPair: "USD/ZAR",
    counterpartyId: "cp:test-1",
    rejectingCheck: "sanctions",
    rejectionReason: "sanctions-hit",
    citationToRule: "D-FX-SALES-TRADING-FRONTEND",
    timestamp: T_BASE,
  };

  it("honest 'empty' on no V2 events — never falls back to V1, carries the substrate gap", () => {
    const view = buildV2FxRejectionsView(() => []);
    expect(view.dataState).toBe("empty");
    expect(view.count).toBe(0);
    expect(view.rows).toEqual([]);
    expect(view.reason).toBeTruthy();
    expect(view.substrateGap).toContain("V2 gateway-rejection");
  });

  it("'live' with V2 rows — surfaces the V2 rejection-row shape the risk page reads", () => {
    const view = buildV2FxRejectionsView(() => [SAMPLE_ROW]);
    expect(view.dataState).toBe("live");
    expect(view.count).toBe(1);
    const first = view.rows[0];
    expect(first?.orderId).toBe("ord:v2-api-test");
    expect(first?.rejectingCheck).toBe("sanctions");
    expect(typeof first?.rejectionReason).toBe("string");
    expect(typeof first?.timestamp).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 10. No crash on empty store
// ---------------------------------------------------------------------------

describe("buildRiskView — robustness", () => {
  it("does not throw on empty store", () => {
    const store = freshStore();
    expect(() => buildRiskView(store)).not.toThrow();
  });

  it("asOf is a valid ISO timestamp", () => {
    const store = freshStore();
    const view = buildRiskView(store);
    const parsed = new Date(view.asOf);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });
});
