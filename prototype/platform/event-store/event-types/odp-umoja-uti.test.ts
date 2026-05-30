// platform/event-store/event-types/odp-umoja-uti.test.ts
//
// Tests for WS-ODP-UMOJA-UTI event-type schemas, UTI allocator,
// trade-report serialiser, and Umoja portal simulator.
//
// Authority:
//   ORG-ODP-RPT-003; ORG-MK-RPT-002;
//   urn:regulation:odp:cs-3-2018; urn:regulation:odp:jn-2-2024;
//   ISO 23602:2020.
//
// Author: Devon (COO, operations)

import { describe, expect, it } from "bun:test";

import {
  HOZ_BANK_LEI,
  allocateUtiSync,
  computeSha256Uti,
  computeT1SubmissionDeadline,
  isOdpReportable,
} from "../../odp/uti-allocator";
import {
  makeOdpRepoReconBreakRaised,
  makeOdpRepoReconDisputeOpened,
  makeOdpRepoReconDisputeResolved,
  makeOdpRepoReconRun,
  makeOdpReportAmendmentRequested,
  makeOdpReportAmendmentSubmitted,
  makeOdpReportSubmissionAccepted,
  makeOdpReportSubmissionAttempted,
  makeOdpReportSubmissionRejected,
  makeOdpTradeReportPrepared,
  makeTradeUtiAllocated,
  makeUmojaPortalTokenRefreshed,
} from "./odp-umoja-uti";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const ACTOR = { type: "service" as const, id: "devon:test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["ORG-ODP-RPT-003", "urn:regulation:odp:jn-2-2024"];
const AS_OF = "2026-05-30T09:00:00.000Z";
const TRADE_ID = "TRADE-FX-001";
const UTI = `${HOZ_BANK_LEI}${"A".repeat(32)}`; // 52 chars
const REPORT_EVENT_ID = "11111111-1111-1111-1111-111111111111";
const SUBMISSION_EVENT_ID = "22222222-2222-2222-2222-222222222222";
const BREAK_EVENT_ID = "33333333-3333-3333-3333-333333333333";
const DISPUTE_EVENT_ID = "44444444-4444-4444-4444-444444444444";

// ---------------------------------------------------------------------------
// UTI Allocator — computeSha256Uti
// ---------------------------------------------------------------------------

describe("computeSha256Uti", () => {
  it("returns a 52-character UTI", () => {
    const uti = computeSha256Uti(HOZ_BANK_LEI, TRADE_ID);
    expect(uti.length).toBe(52);
  });

  it("prefixes with the bank LEI (first 20 chars)", () => {
    const uti = computeSha256Uti(HOZ_BANK_LEI, TRADE_ID);
    expect(uti.slice(0, 20)).toBe(HOZ_BANK_LEI);
  });

  it("is deterministic — same inputs, same UTI", () => {
    const uti1 = computeSha256Uti(HOZ_BANK_LEI, TRADE_ID);
    const uti2 = computeSha256Uti(HOZ_BANK_LEI, TRADE_ID);
    expect(uti1).toBe(uti2);
  });

  it("is idempotent — repeated calls return identical results", () => {
    const results = Array.from({ length: 5 }, () => computeSha256Uti(HOZ_BANK_LEI, TRADE_ID));
    expect(new Set(results).size).toBe(1);
  });

  it("produces different UTIs for different tradeIds", () => {
    const uti1 = computeSha256Uti(HOZ_BANK_LEI, "TRADE-001");
    const uti2 = computeSha256Uti(HOZ_BANK_LEI, "TRADE-002");
    expect(uti1).not.toBe(uti2);
  });

  it("suffix is uppercase hex (0–9, A–F)", () => {
    const uti = computeSha256Uti(HOZ_BANK_LEI, TRADE_ID);
    const suffix = uti.slice(20);
    expect(suffix).toMatch(/^[0-9A-F]{32}$/);
  });

  it("throws on LEI that is not 20 characters", () => {
    expect(() => computeSha256Uti("TOOSHORT", TRADE_ID)).toThrow(/20 characters/);
    expect(() => computeSha256Uti("A".repeat(21), TRADE_ID)).toThrow(/20 characters/);
  });

  it("throws on empty tradeId", () => {
    expect(() => computeSha256Uti(HOZ_BANK_LEI, "")).toThrow(/non-empty/);
    expect(() => computeSha256Uti(HOZ_BANK_LEI, "   ")).toThrow(/non-empty/);
  });
});

// ---------------------------------------------------------------------------
// UTI Allocator — allocateUtiSync
// ---------------------------------------------------------------------------

describe("allocateUtiSync", () => {
  it("defaults to SHA-256 path", () => {
    const result = allocateUtiSync(TRADE_ID);
    expect(result.utiSource).toBe("sha256-lei-prefixed");
    expect(result.uti.length).toBe(52);
  });

  it("uses counterparty UTI when provided", () => {
    const counterpartyUti = `${"B".repeat(20)}${"C".repeat(32)}`;
    const result = allocateUtiSync(TRADE_ID, { counterpartyUti });
    expect(result.utiSource).toBe("counterparty-issued");
    expect(result.uti).toBe(counterpartyUti);
  });

  it("accepts custom bankLei", () => {
    const customLei = "X".repeat(20);
    const result = allocateUtiSync(TRADE_ID, { bankLei: customLei });
    expect(result.uti.slice(0, 20)).toBe(customLei);
  });

  it("throws when preferSafe is set (sync mode)", () => {
    expect(() => allocateUtiSync(TRADE_ID, { preferSafe: true })).toThrow(/sync mode/);
  });
});

// ---------------------------------------------------------------------------
// T+1 submission deadline
// ---------------------------------------------------------------------------

describe("computeT1SubmissionDeadline", () => {
  it("deadline is T+1 at 14:00 UTC (16:00 SAST)", () => {
    const { deadline } = computeT1SubmissionDeadline(
      "2026-05-30",
      new Date("2026-05-30T09:00:00.000Z"),
    );
    // T+1 = 2026-05-31 14:00:00 UTC
    expect(deadline).toBe("2026-05-31T14:00:00.000Z");
  });

  it("withinDeadline = true when submitted before deadline", () => {
    const { withinDeadline } = computeT1SubmissionDeadline(
      "2026-05-30",
      new Date("2026-05-31T13:59:00.000Z"),
    );
    expect(withinDeadline).toBe(true);
  });

  it("withinDeadline = false when submitted after deadline", () => {
    const { withinDeadline } = computeT1SubmissionDeadline(
      "2026-05-30",
      new Date("2026-05-31T14:01:00.000Z"),
    );
    expect(withinDeadline).toBe(false);
  });

  it("withinDeadline = true when submitted exactly at deadline", () => {
    const { withinDeadline } = computeT1SubmissionDeadline(
      "2026-05-30",
      new Date("2026-05-31T14:00:00.000Z"),
    );
    expect(withinDeadline).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ODP-reportable filter
// ---------------------------------------------------------------------------

describe("isOdpReportable", () => {
  it("FxTradeExecuted is reportable", () => {
    expect(isOdpReportable("FxTradeExecuted")).toBe(true);
  });

  it("IrsTradeBooked is reportable", () => {
    expect(isOdpReportable("IrsTradeBooked")).toBe(true);
  });

  it("FraTradeBooked is reportable", () => {
    expect(isOdpReportable("FraTradeBooked")).toBe(true);
  });

  it("SwaptionTradeBooked is reportable", () => {
    expect(isOdpReportable("SwaptionTradeBooked")).toBe(true);
  });

  it("BasisSwapTradeBooked is reportable", () => {
    expect(isOdpReportable("BasisSwapTradeBooked")).toBe(true);
  });

  it("CrossCurrencySwapTradeBooked is reportable", () => {
    expect(isOdpReportable("CrossCurrencySwapTradeBooked")).toBe(true);
  });

  it("RepoTradeOpened is NOT reportable", () => {
    expect(isOdpReportable("RepoTradeOpened")).toBe(false);
  });

  it("MoneyMarketDepositOpened is NOT reportable", () => {
    expect(isOdpReportable("MoneyMarketDepositOpened")).toBe(false);
  });

  it("unknown event type is NOT reportable", () => {
    expect(isOdpReportable("SomeOtherEvent")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TradeUtiAllocated
// ---------------------------------------------------------------------------

describe("makeTradeUtiAllocated", () => {
  it("creates a valid TradeUtiAllocated event", () => {
    const event = makeTradeUtiAllocated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        uti: UTI,
        utiSource: "sha256-lei-prefixed",
        tradeDate: "2026-05-30",
        productType: "fx-spot",
        counterpartyId: "party:lei:ABCDEF12345678901234",
        bankLei: HOZ_BANK_LEI,
        bankIsUtiGenerator: true,
      },
    });
    expect(event.type).toBe("TradeUtiAllocated");
    expect(event.payload.uti).toBe(UTI);
    expect(event.payload.utiSource).toBe("sha256-lei-prefixed");
  });

  it("requires citations", () => {
    expect(() =>
      makeTradeUtiAllocated({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: {
          tradeId: TRADE_ID,
          uti: UTI,
          utiSource: "sha256-lei-prefixed",
          tradeDate: "2026-05-30",
          productType: "irs",
          counterpartyId: "party:lei:ABCDEF12345678901234",
          bankLei: HOZ_BANK_LEI,
          bankIsUtiGenerator: true,
        },
      }),
    ).toThrow(/citation/i);
  });

  it("rejects UTI longer than 52 chars", () => {
    expect(() =>
      makeTradeUtiAllocated({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: TRADE_ID,
          uti: "A".repeat(53), // 53 chars — too long
          utiSource: "sha256-lei-prefixed",
          tradeDate: "2026-05-30",
          productType: "fra",
          counterpartyId: "party:lei:ABCDEF12345678901234",
          bankLei: HOZ_BANK_LEI,
          bankIsUtiGenerator: true,
        },
      }),
    ).toThrow();
  });

  it("accepts optional reportingNotional", () => {
    const event = makeTradeUtiAllocated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        uti: UTI,
        utiSource: "sha256-lei-prefixed",
        tradeDate: "2026-05-30",
        productType: "irs",
        counterpartyId: "party:lei:ABCDEF12345678901234",
        bankLei: HOZ_BANK_LEI,
        bankIsUtiGenerator: true,
        reportingNotional: { currency: "ZAR", amountMinor: 100_000_000_00 },
      },
    });
    const notional = event.payload.reportingNotional as { currency: string } | undefined;
    expect(notional?.currency).toBe("ZAR");
  });
});

// ---------------------------------------------------------------------------
// OdpTradeReportPrepared
// ---------------------------------------------------------------------------

describe("makeOdpTradeReportPrepared", () => {
  it("creates a valid OdpTradeReportPrepared event", () => {
    const event = makeOdpTradeReportPrepared({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
      payload: {
        tradeId: TRADE_ID,
        uti: UTI,
        reportDate: "2026-05-30",
        actionType: "new",
        productType: "fx-spot",
        documentHash: "blake3:abc123def456",
        preparedAt: AS_OF,
        utiEventId: REPORT_EVENT_ID,
      },
    });
    expect(event.type).toBe("OdpTradeReportPrepared");
    expect(event.payload.actionType).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// OdpReportSubmissionAttempted
// ---------------------------------------------------------------------------

describe("makeOdpReportSubmissionAttempted", () => {
  it("creates a valid submission-attempted event", () => {
    const event = makeOdpReportSubmissionAttempted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        uti: UTI,
        reportEventId: REPORT_EVENT_ID,
        submittedAt: AS_OF,
        withinDeadline: true,
        portalSessionId: "UMOJA-SESSION-ABC12345",
        actionType: "new",
        mode: "simulator",
      },
    });
    expect(event.type).toBe("OdpReportSubmissionAttempted");
    expect(event.payload.mode).toBe("simulator");
    expect(event.payload.withinDeadline).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OdpReportSubmissionAccepted
// ---------------------------------------------------------------------------

describe("makeOdpReportSubmissionAccepted", () => {
  it("creates a valid accepted event", () => {
    const event = makeOdpReportSubmissionAccepted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        uti: UTI,
        submissionEventId: SUBMISSION_EVENT_ID,
        portalReferenceNumber: "UMOJA-SIM-SESSION-001",
        acceptedAt: AS_OF,
        portalSessionId: "UMOJA-SESSION-ABC12345",
      },
    });
    expect(event.type).toBe("OdpReportSubmissionAccepted");
    expect(event.payload.portalReferenceNumber).toBe("UMOJA-SIM-SESSION-001");
  });
});

// ---------------------------------------------------------------------------
// OdpReportSubmissionRejected
// ---------------------------------------------------------------------------

describe("makeOdpReportSubmissionRejected", () => {
  it("creates a valid rejected event", () => {
    const event = makeOdpReportSubmissionRejected({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        uti: "INVALID",
        submissionEventId: SUBMISSION_EVENT_ID,
        rejectedAt: AS_OF,
        portalSessionId: "UMOJA-SESSION-ABC12345",
        errorCodes: ["UTI-INVALID"],
        errorMessages: ["UTI does not match ISO 23602 format."],
        recoverable: true,
      },
    });
    expect(event.type).toBe("OdpReportSubmissionRejected");
    expect(event.payload.errorCodes).toEqual(["UTI-INVALID"]);
    expect(event.payload.recoverable).toBe(true);
  });

  it("requires at least one error code", () => {
    expect(() =>
      makeOdpReportSubmissionRejected({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: TRADE_ID,
          uti: UTI,
          submissionEventId: SUBMISSION_EVENT_ID,
          rejectedAt: AS_OF,
          portalSessionId: "UMOJA-SESSION-ABC12345",
          errorCodes: [], // invalid — must have at least one
          errorMessages: [],
          recoverable: false,
        },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// OdpReportAmendmentRequested / Submitted
// ---------------------------------------------------------------------------

describe("makeOdpReportAmendmentRequested", () => {
  it("creates a valid amendment-requested event", () => {
    const event = makeOdpReportAmendmentRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        uti: UTI,
        originalPortalRef: "UMOJA-SIM-SESSION-001",
        requestedBy: "counterparty",
        amendmentReason: "Incorrect notional on original report.",
        requestedAt: AS_OF,
      },
    });
    expect(event.type).toBe("OdpReportAmendmentRequested");
    expect(event.payload.requestedBy).toBe("counterparty");
  });
});

describe("makeOdpReportAmendmentSubmitted", () => {
  it("creates a valid amendment-submitted event", () => {
    const event = makeOdpReportAmendmentSubmitted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: TRADE_ID,
        uti: UTI,
        amendmentRequestEventId: REPORT_EVENT_ID,
        originalPortalRef: "UMOJA-SIM-SESSION-001",
        amendedReportEventId: SUBMISSION_EVENT_ID,
        submittedAt: AS_OF,
        portalSessionId: "UMOJA-SESSION-AMEND-001",
      },
    });
    expect(event.type).toBe("OdpReportAmendmentSubmitted");
  });
});

// ---------------------------------------------------------------------------
// OdpRepoReconRun
// ---------------------------------------------------------------------------

describe("makeOdpRepoReconRun", () => {
  it("creates a clean recon run", () => {
    const event = makeOdpRepoReconRun({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
      payload: {
        reconDate: "2026-05-30",
        submittedTradeCount: 12,
        repositoryTradeCount: 12,
        outcome: "clean",
        matchedCount: 12,
        breakCount: 0,
        pendingCount: 0,
        breakEventIds: [],
      },
    });
    expect(event.type).toBe("OdpRepoReconRun");
    expect(event.payload.outcome).toBe("clean");
    expect(event.payload.breakCount).toBe(0);
  });

  it("creates a breaks-found recon run with break event IDs", () => {
    const event = makeOdpRepoReconRun({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
      payload: {
        reconDate: "2026-05-30",
        submittedTradeCount: 10,
        repositoryTradeCount: 9,
        outcome: "breaks-found",
        matchedCount: 9,
        breakCount: 1,
        pendingCount: 0,
        breakEventIds: [BREAK_EVENT_ID],
      },
    });
    expect(event.payload.outcome).toBe("breaks-found");
    expect(event.payload.breakEventIds).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// OdpRepoReconBreakRaised
// ---------------------------------------------------------------------------

describe("makeOdpRepoReconBreakRaised", () => {
  it("creates a valid break event", () => {
    const event = makeOdpRepoReconBreakRaised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"],
      payload: {
        breakId: "REPO-BREAK-20260530-TRADE-FX-001-001",
        tradeId: TRADE_ID,
        uti: UTI,
        sourceRunEventId: REPORT_EVENT_ID,
        breakType: "missing-in-repo",
        description: "Trade TRADE-FX-001 submitted but not visible in Umoja repository view.",
        resolutionDeadline: "2026-06-03T14:00:00.000Z",
      },
    });
    expect(event.type).toBe("OdpRepoReconBreakRaised");
    expect(event.payload.breakType).toBe("missing-in-repo");
  });
});

// ---------------------------------------------------------------------------
// OdpRepoReconDisputeOpened / Resolved
// ---------------------------------------------------------------------------

describe("makeOdpRepoReconDisputeOpened", () => {
  it("creates a valid dispute-opened event", () => {
    const event = makeOdpRepoReconDisputeOpened({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        breakId: "REPO-BREAK-20260530-TRADE-FX-001-001",
        breakEventId: BREAK_EVENT_ID,
        tradeId: TRADE_ID,
        openedAt: AS_OF,
        resolutionDeadline: "2026-06-03T14:00:00.000Z",
        openedBy: "Devon (COO, operations)",
        note: "Trade not visible in Umoja after 24 hours.",
      },
    });
    expect(event.type).toBe("OdpRepoReconDisputeOpened");
  });
});

describe("makeOdpRepoReconDisputeResolved", () => {
  it("creates a valid dispute-resolved event (resubmitted-accepted)", () => {
    const event = makeOdpRepoReconDisputeResolved({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        breakId: "REPO-BREAK-20260530-TRADE-FX-001-001",
        disputeEventId: DISPUTE_EVENT_ID,
        tradeId: TRADE_ID,
        outcome: "resubmitted-accepted",
        resolvedAt: AS_OF,
        withinDeadline: true,
      },
    });
    expect(event.type).toBe("OdpRepoReconDisputeResolved");
    expect(event.payload.withinDeadline).toBe(true);
  });

  it("accepts escalated-to-cco outcome", () => {
    const event = makeOdpRepoReconDisputeResolved({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        breakId: "REPO-BREAK-20260530-TRADE-FX-001-001",
        disputeEventId: DISPUTE_EVENT_ID,
        tradeId: TRADE_ID,
        outcome: "escalated-to-cco",
        resolvedAt: AS_OF,
        withinDeadline: false,
        escalatedTo: "Zara (Chief Compliance Officer, governance)",
      },
    });
    expect(event.payload.outcome).toBe("escalated-to-cco");
    expect(event.payload.escalatedTo).toBe("Zara (Chief Compliance Officer, governance)");
  });
});

// ---------------------------------------------------------------------------
// UmojaPortalTokenRefreshed
// ---------------------------------------------------------------------------

describe("makeUmojaPortalTokenRefreshed", () => {
  it("creates a valid token-refreshed event", () => {
    const event = makeUmojaPortalTokenRefreshed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["ORG-ODP-RPT-003"],
      payload: {
        refreshedAt: AS_OF,
        expiresAt: "2026-05-30T10:00:00.000Z",
        tokenRef: "sim-token-abc123",
        mode: "simulator",
      },
    });
    expect(event.type).toBe("UmojaPortalTokenRefreshed");
    expect(event.payload.mode).toBe("simulator");
  });
});
