// platform/markets/regulatory/finsurv-stub.test.ts
//
// Tests for the FinSurv TradeReportSubmitted schema + stub handler.
//
// Coverage:
//   - Schema validates correct TradeReportSubmitted payload
//   - Schema rejects empty citations array
//   - Schema rejects invalid status value
//   - Stub emits pending TradeReportSubmitted on a valid tradeId
//   - Stub includes finsurvCategory when provided

import { describe, expect, it } from "bun:test";

import { TradeReportSubmittedPayloadSchema } from "../../event-store/event-types/regulatory-reporting";
import { EventStore } from "../../event-store/store";
import { emitFinsuvPendingReport } from "./finsurv-stub";

// ---------------------------------------------------------------------------
// Schema tests
// ---------------------------------------------------------------------------

describe("TradeReportSubmittedPayloadSchema", () => {
  it("validates a correct TradeReportSubmitted payload", () => {
    const valid = {
      tradeId: "TRD-001",
      regulator: "SARB-FinSurv" as const,
      reportCategory: "FinSurv-FX-AD",
      submittedAt: "2026-05-16T16:00:00.000Z",
      status: "pending" as const,
      citations: ["D-FX-AD-STATUS", "EXCON-SARB-CIRC-3-2020"],
    };
    const parsed = TradeReportSubmittedPayloadSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("validates with optional fields", () => {
    const full = {
      tradeId: "TRD-002",
      regulator: "SARB-FinSurv" as const,
      reportCategory: "FinSurv-ODP-001",
      submittedAt: "2026-05-16T16:00:00.000Z",
      referenceNumber: "FINSURV-REF-12345",
      status: "accepted" as const,
      finsurvCategory: "ODP-001",
      citations: ["D-FX-AD-STATUS"],
    };
    const parsed = TradeReportSubmittedPayloadSchema.safeParse(full);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.referenceNumber).toBe("FINSURV-REF-12345");
      expect(parsed.data.finsurvCategory).toBe("ODP-001");
    }
  });

  it("validates DTCC-SAFE regulator", () => {
    const dtcc = {
      tradeId: "TRD-003",
      regulator: "DTCC-SAFE" as const,
      reportCategory: "SDR-NEW",
      submittedAt: "2026-05-16T16:00:00.000Z",
      status: "pending" as const,
      citations: ["D-FX-AD-STATUS"],
    };
    const parsed = TradeReportSubmittedPayloadSchema.safeParse(dtcc);
    expect(parsed.success).toBe(true);
  });

  it("rejects empty citations array", () => {
    const invalid = {
      tradeId: "TRD-004",
      regulator: "SARB-FinSurv" as const,
      reportCategory: "FinSurv-FX-AD",
      submittedAt: "2026-05-16T16:00:00.000Z",
      status: "pending" as const,
      citations: [], // ← empty — must fail
    };
    const parsed = TradeReportSubmittedPayloadSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const citationIssue = parsed.error.issues.find((i) => i.path.some((p) => p === "citations"));
      expect(citationIssue).toBeDefined();
    }
  });

  it("rejects invalid status value", () => {
    const invalid = {
      tradeId: "TRD-005",
      regulator: "SARB-FinSurv" as const,
      reportCategory: "FinSurv-FX-AD",
      submittedAt: "2026-05-16T16:00:00.000Z",
      status: "submitted" as unknown, // ← not in enum
      citations: ["D-FX-AD-STATUS"],
    };
    const parsed = TradeReportSubmittedPayloadSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const statusIssue = parsed.error.issues.find((i) => i.path.some((p) => p === "status"));
      expect(statusIssue).toBeDefined();
    }
  });

  it("rejects invalid regulator value", () => {
    const invalid = {
      tradeId: "TRD-006",
      regulator: "FSCA-REPORTS" as unknown, // ← not in enum
      reportCategory: "FinSurv-FX-AD",
      submittedAt: "2026-05-16T16:00:00.000Z",
      status: "pending" as const,
      citations: ["D-FX-AD-STATUS"],
    };
    const parsed = TradeReportSubmittedPayloadSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const invalid = {
      tradeId: "TRD-007",
      // regulator missing
      reportCategory: "FinSurv-FX-AD",
      submittedAt: "2026-05-16T16:00:00.000Z",
      status: "pending" as const,
      citations: ["D-FX-AD-STATUS"],
    };
    const parsed = TradeReportSubmittedPayloadSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Stub handler tests
// ---------------------------------------------------------------------------

describe("emitFinsuvPendingReport", () => {
  it("emits a pending TradeReportSubmitted event for a valid tradeId", () => {
    const store = new EventStore(":memory:");
    emitFinsuvPendingReport(store, "TRD-STUB-001");

    const events: Array<{
      type: string;
      payload: { tradeId: string; status: string; regulator: string };
    }> = [];
    for (const e of store.replay({ type: "TradeReportSubmitted" })) {
      events.push(
        e as unknown as {
          type: string;
          payload: { tradeId: string; status: string; regulator: string };
        },
      );
    }

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event?.type).toBe("TradeReportSubmitted");
    expect(event?.payload.tradeId).toBe("TRD-STUB-001");
    expect(event?.payload.status).toBe("pending");
    expect(event?.payload.regulator).toBe("SARB-FinSurv");
  });

  it("includes finsurvCategory when provided", () => {
    const store = new EventStore(":memory:");
    emitFinsuvPendingReport(store, "TRD-STUB-002", undefined, "ODP-001");

    const events: Array<{ payload: { finsurvCategory?: string } }> = [];
    for (const e of store.replay({ type: "TradeReportSubmitted" })) {
      events.push(e as unknown as { payload: { finsurvCategory?: string } });
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.payload.finsurvCategory).toBe("ODP-001");
  });

  it("does not include finsurvCategory when not provided", () => {
    const store = new EventStore(":memory:");
    emitFinsuvPendingReport(store, "TRD-STUB-003");

    const events: Array<{ payload: { finsurvCategory?: string } }> = [];
    for (const e of store.replay({ type: "TradeReportSubmitted" })) {
      events.push(e as unknown as { payload: { finsurvCategory?: string } });
    }

    expect(events).toHaveLength(1);
    // finsurvCategory should be absent or undefined.
    expect(events[0]?.payload.finsurvCategory).toBeUndefined();
  });

  it("emits with correct actor and citations", () => {
    const store = new EventStore(":memory:");
    emitFinsuvPendingReport(store, "TRD-STUB-004");

    const events: Array<{
      actor: { type: string; id: string };
      citations: string[];
    }> = [];
    for (const e of store.replay({ type: "TradeReportSubmitted" })) {
      events.push(
        e as unknown as {
          actor: { type: string; id: string };
          citations: string[];
        },
      );
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.actor.id).toBe("mira:finsurv-stub");
    expect(events[0]?.citations.length).toBeGreaterThan(0);
  });
});
