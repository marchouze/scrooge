// tests/period-close.test.ts
//
// D-REPORTING-CAPABILITY-SLICE-2 — exit-criterion test for the period-
// close event family + orchestration helper.
//
// Asserts:
//   - Three new event types registered with typed Zod payload schemas +
//     RETENTION_ACCOUNTING_7Y in EVENT_TYPE_REGISTRY.
//   - Each typed Zod schema accepts canonical payloads (positive parse).
//   - Each typed Zod schema rejects boundary violations (negative parse):
//       - AccountingPeriodOpened: inverted period dates;
//         reopen-without-reason; reason-without-reopenOf.
//       - TrialBalanceSnapshotted: per-currency unbalanced; rows-vs-totals
//         mismatch.
//   - openPeriod is idempotent on identical (entity, periodId) payload
//     and refuses to re-open already-closed periods without reopen chain.
//   - closePeriod end-to-end:
//       - Computes a balanced trial balance from M1 SubLedgerPostingEmitted.
//       - Writes to optional document-store with BLAKE3 content hash.
//       - Emits TrialBalanceSnapshotted with the rows + totals + hash.
//       - Triggers EvSS Slice 2 snapshot under per-entity stream-key
//         `<entity>|accounting-period`.
//       - Appends AccountingPeriodClosed referencing the snapshot
//         event_id.
//   - Per-entity isolation: two entities each open + close their own
//     period; postings on entity A do not flow into entity B's TB.
//   - Reopen-then-reclose chain: forensic open → close → reopen → close
//     audit chain readable via periodAuditChain().
//
// Authority: D-REPORTING-CAPABILITY-SLICE-2 (under standing approval of
//            D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-approved 2026-05-10).
// Source spec: Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-
//              build-proposal.md §6 Slice 2.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; close orchestration owner) + Atlas (Core
//   banking platform architect, engineering — substrate consult).

import { describe, expect, it } from "bun:test";

import {
  closePeriod,
  computeTrialBalance,
  openPeriod,
  periodAuditChain,
  periodCloseStreamKey,
} from "../platform/accounting/period-close";
import { newEventId } from "../platform/core/types";
import type {
  DocumentHash,
  DocumentMetadata,
  DocumentStore,
  PutOptions,
  PutResult,
} from "../platform/document-store";
import {
  accountingPeriodClosedPayloadSchema,
  accountingPeriodOpenedPayloadSchema,
  makeAccountingPeriodClosed,
  makeAccountingPeriodOpened,
  makeTrialBalanceSnapshotted,
  trialBalanceSnapshottedPayloadSchema,
} from "../platform/event-store/event-types";
import { simulatedTag } from "../platform/event-store/provenance";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";
import { EventStore } from "../platform/event-store/store";

const PERIOD_CLOSE_EVENT_NAMES = [
  "AccountingPeriodOpened",
  "AccountingPeriodClosed",
  "TrialBalanceSnapshotted",
] as const;

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";

const ACTOR = { type: "service" as const, id: "agent:Bea" };

const CITATIONS = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "D-REPORTING-CAPABILITY-SLICE-2",
  "IAS-1",
  "COMPANIES-ACT-71-2008-S24",
];

const PROVENANCE = simulatedTag({
  scenario: "slice-2-period-close-tests",
  sourceLineage: "agent:bea:period-close",
});

const VALID_OPEN_PAYLOAD = {
  periodId: "period:hoz-bank:month:2026-05",
  periodKind: "month" as const,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.999Z",
  openedAt: "2026-05-01T00:00:00.000Z",
  functionalCurrency: "ZAR",
};

// Helper: append an M1-style SubLedgerPostingEmitted event.
function appendPosting(
  store: EventStore,
  args: {
    entity: string;
    asOf: string;
    legs: ReadonlyArray<{
      debit: string;
      credit: string;
      currency: string;
      amountMinor: number;
    }>;
  },
): void {
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: ACTOR,
    citations: ["D-REPORTING-CAPABILITY-SLICE-2"],
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: args.legs.map((l) => ({ ...l, memo: "test posting" })),
      asOfDate: args.asOf,
      citations: ["D-REPORTING-CAPABILITY-SLICE-2"],
    },
    provenance: PROVENANCE,
  });
}

// In-memory document store for tests.
class InMemoryDocumentStore implements DocumentStore {
  private store = new Map<string, Uint8Array>();

  put(content: Uint8Array | string, _opts?: PutOptions): PutResult {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    // Trivial deterministic hash — not real BLAKE3, just fixture-stable.
    const digest = `${bytes.length.toString(16)}-${simpleHash(bytes)}`;
    const hash = `blake3:${digest}` as DocumentHash;
    const isNew = !this.store.has(hash);
    if (isNew) this.store.set(hash, bytes);
    return { hash, path: `/mem/${hash}`, isNew, size: bytes.length, algo: "blake3" };
  }

  get(hash: DocumentHash): Uint8Array {
    const v = this.store.get(hash);
    if (!v) throw new Error("miss");
    return v;
  }

  exists(hash: DocumentHash): boolean {
    return this.store.has(hash);
  }

  metadata(hash: DocumentHash): DocumentMetadata {
    const v = this.store.get(hash);
    if (!v) throw new Error("miss");
    return {
      hash,
      path: `/mem/${hash}`,
      size: v.length,
      algo: "blake3",
      firstSeenAt: "2026-05-10T00:00:00.000Z",
    };
  }
}

function simpleHash(bytes: Uint8Array): string {
  let h = 0;
  for (const b of bytes) h = ((h << 5) - h + b) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}

describe("D-REPORTING-CAPABILITY-SLICE-2 — registry coverage", () => {
  it("all three period-close event types are registered in EVENT_TYPE_REGISTRY", () => {
    const missing = PERIOD_CLOSE_EVENT_NAMES.filter((t) => !lookupEventType(t));
    expect(missing).toEqual([]);
  });

  it("each registry row carries a typed Zod payload schema", () => {
    for (const name of PERIOD_CLOSE_EVENT_NAMES) {
      const meta = lookupEventType(name);
      expect(meta?.payloadSchema).toBeDefined();
    }
  });

  it("each row carries the accounting-7y retention floor (Companies Act 71/2008 s.24)", () => {
    for (const name of PERIOD_CLOSE_EVENT_NAMES) {
      const meta = lookupEventType(name);
      expect(meta?.retention.minimumYears).toBe(7);
      expect(meta?.retention.citationRef).toBe("COMPANIES-ACT-71-2008-S24");
    }
  });

  it("registry includes period-close family in the flat registry", () => {
    const types = new Set(EVENT_TYPE_REGISTRY.map((m) => m.type));
    for (const name of PERIOD_CLOSE_EVENT_NAMES) {
      expect(types.has(name)).toBe(true);
    }
  });
});

describe("D-REPORTING-CAPABILITY-SLICE-2 — Zod payload validation", () => {
  describe("AccountingPeriodOpened", () => {
    it("accepts a canonical payload", () => {
      expect(() => accountingPeriodOpenedPayloadSchema.parse(VALID_OPEN_PAYLOAD)).not.toThrow();
    });

    it("rejects inverted period dates", () => {
      const bad = {
        ...VALID_OPEN_PAYLOAD,
        periodStart: "2026-05-31T23:59:59.999Z",
        periodEnd: "2026-05-01T00:00:00.000Z",
      };
      expect(() => accountingPeriodOpenedPayloadSchema.parse(bad)).toThrow(
        /periodEnd must be after periodStart/,
      );
    });

    it("rejects reopenOf without reopenReason", () => {
      const bad = {
        ...VALID_OPEN_PAYLOAD,
        reopenOf: "evt-prior-close-id",
      };
      expect(() => accountingPeriodOpenedPayloadSchema.parse(bad)).toThrow(
        /reopenReason is required when reopenOf is set/,
      );
    });

    it("rejects reopenReason without reopenOf", () => {
      const bad = {
        ...VALID_OPEN_PAYLOAD,
        reopenReason: "audit-finding" as const,
      };
      expect(() => accountingPeriodOpenedPayloadSchema.parse(bad)).toThrow(
        /reopenReason is forbidden without reopenOf/,
      );
    });

    it("accepts a valid reopen payload (reopenOf + reopenReason)", () => {
      const good = {
        ...VALID_OPEN_PAYLOAD,
        openedAt: "2026-06-15T00:00:00.000Z",
        reopenOf: "evt-prior-close-id",
        reopenReason: "audit-finding" as const,
      };
      expect(() => accountingPeriodOpenedPayloadSchema.parse(good)).not.toThrow();
    });

    it("rejects a non-3-letter currency", () => {
      const bad = { ...VALID_OPEN_PAYLOAD, functionalCurrency: "ZARS" };
      expect(() => accountingPeriodOpenedPayloadSchema.parse(bad)).toThrow();
    });
  });

  describe("AccountingPeriodClosed", () => {
    it("accepts a canonical payload", () => {
      const good = {
        periodId: "period:hoz-bank:month:2026-05",
        closedAt: "2026-06-01T00:00:00.000Z",
        trialBalanceSnapshotEventId: "evt-tb-snapshot-id",
        uptoSequence: 42,
      };
      expect(() => accountingPeriodClosedPayloadSchema.parse(good)).not.toThrow();
    });

    it("rejects negative uptoSequence", () => {
      const bad = {
        periodId: "period:hoz-bank:month:2026-05",
        closedAt: "2026-06-01T00:00:00.000Z",
        trialBalanceSnapshotEventId: "evt-tb-snapshot-id",
        uptoSequence: -1,
      };
      expect(() => accountingPeriodClosedPayloadSchema.parse(bad)).toThrow();
    });
  });

  describe("TrialBalanceSnapshotted", () => {
    const baseRows = [
      { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 100000 },
      { leafAccountId: "ACC-pending-settlement-stub", currency: "ZAR", amountMinor: -100000 },
    ];

    it("accepts a balanced canonical payload", () => {
      const good = {
        periodId: "period:hoz-bank:month:2026-05",
        snapshotKind: "close" as const,
        snapshotAsOf: "2026-06-01T00:00:00.000Z",
        uptoSequence: 1,
        rows: baseRows,
        perCurrencyTotals: [{ currency: "ZAR", debitMinor: 100000, creditMinor: 100000 }],
      };
      expect(() => trialBalanceSnapshottedPayloadSchema.parse(good)).not.toThrow();
    });

    it("rejects per-currency unbalanced totals", () => {
      const bad = {
        periodId: "period:hoz-bank:month:2026-05",
        snapshotKind: "close" as const,
        snapshotAsOf: "2026-06-01T00:00:00.000Z",
        uptoSequence: 1,
        rows: baseRows,
        perCurrencyTotals: [{ currency: "ZAR", debitMinor: 100000, creditMinor: 50000 }],
      };
      expect(() => trialBalanceSnapshottedPayloadSchema.parse(bad)).toThrow(/unbalanced/);
    });

    it("rejects rows-vs-totals mismatch", () => {
      const bad = {
        periodId: "period:hoz-bank:month:2026-05",
        snapshotKind: "close" as const,
        snapshotAsOf: "2026-06-01T00:00:00.000Z",
        uptoSequence: 1,
        rows: baseRows,
        perCurrencyTotals: [{ currency: "ZAR", debitMinor: 999999, creditMinor: 999999 }],
      };
      expect(() => trialBalanceSnapshottedPayloadSchema.parse(bad)).toThrow(
        /do not match perCurrencyTotals/,
      );
    });

    it("rejects an account-id that does not start with ACC-", () => {
      const bad = {
        periodId: "period:hoz-bank:month:2026-05",
        snapshotKind: "close" as const,
        snapshotAsOf: "2026-06-01T00:00:00.000Z",
        uptoSequence: 1,
        rows: [{ leafAccountId: "1100", currency: "ZAR", amountMinor: 0 }],
        perCurrencyTotals: [{ currency: "ZAR", debitMinor: 0, creditMinor: 0 }],
      };
      expect(() => trialBalanceSnapshottedPayloadSchema.parse(bad)).toThrow();
    });
  });
});

describe("D-REPORTING-CAPABILITY-SLICE-2 — make…() constructors", () => {
  it("makeAccountingPeriodOpened produces a parseable Event", () => {
    const ev = makeAccountingPeriodOpened({
      asOf: VALID_OPEN_PAYLOAD.openedAt,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });
    expect(ev.type).toBe("AccountingPeriodOpened");
    expect(ev.entity).toBe(ENTITY_BANK);
    expect(ev.provenance?.kind).toBe("simulated");
  });

  it("makeAccountingPeriodClosed produces a parseable Event", () => {
    const ev = makeAccountingPeriodClosed({
      asOf: "2026-06-01T00:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        periodId: VALID_OPEN_PAYLOAD.periodId,
        closedAt: "2026-06-01T00:00:00.000Z",
        trialBalanceSnapshotEventId: "evt-tb-snapshot-id",
        uptoSequence: 0,
      },
    });
    expect(ev.type).toBe("AccountingPeriodClosed");
  });

  it("makeTrialBalanceSnapshotted produces a parseable Event", () => {
    const ev = makeTrialBalanceSnapshotted({
      asOf: "2026-06-01T00:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        periodId: VALID_OPEN_PAYLOAD.periodId,
        snapshotKind: "close",
        snapshotAsOf: "2026-06-01T00:00:00.000Z",
        uptoSequence: 0,
        rows: [],
        perCurrencyTotals: [],
      },
    });
    expect(ev.type).toBe("TrialBalanceSnapshotted");
  });
});

describe("D-REPORTING-CAPABILITY-SLICE-2 — openPeriod orchestration", () => {
  it("appends AccountingPeriodOpened on first open and is idempotent on identical re-open", () => {
    const store = new EventStore(":memory:");
    const r1 = openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });
    expect(r1.appended).toBe(true);
    const r2 = openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });
    expect(r2.appended).toBe(false);
    expect(r2.event.event_id).toBe(r1.event.event_id);

    // Only one open event in the log.
    let count = 0;
    for (const _ of store.replay({ entity: ENTITY_BANK, type: "AccountingPeriodOpened" })) count++;
    expect(count).toBe(1);
  });

  it("rejects re-open of a closed period without reopenOf", () => {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });
    closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: VALID_OPEN_PAYLOAD.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
      provenance: PROVENANCE,
    });
    expect(() =>
      openPeriod({
        eventStore: store,
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: { ...VALID_OPEN_PAYLOAD, openedAt: "2026-06-15T00:00:00.000Z" },
        provenance: PROVENANCE,
      }),
    ).toThrow(/closed.*reopen requires/);
  });

  it("rejects identical-id open with a different payload", () => {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });
    expect(() =>
      openPeriod({
        eventStore: store,
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: { ...VALID_OPEN_PAYLOAD, functionalCurrency: "USD" },
        provenance: PROVENANCE,
      }),
    ).toThrow(/already open.*different payload/);
  });
});

describe("D-REPORTING-CAPABILITY-SLICE-2 — closePeriod end-to-end", () => {
  it("computes a balanced trial balance, snapshots, and emits the close chain", () => {
    const store = new EventStore(":memory:");
    const docStore = new InMemoryDocumentStore();

    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });

    // Two M1-style sub-ledger postings during the period.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-equity-position-stub",
          credit: "ACC-pending-settlement-stub",
          currency: "ZAR",
          amountMinor: 5_000_000,
        },
      ],
    });
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-15T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-1100-001",
          credit: "ACC-pending-settlement-stub",
          currency: "ZAR",
          amountMinor: 2_000_000,
        },
      ],
    });

    const result = closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: VALID_OPEN_PAYLOAD.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
      documentStore: docStore,
      provenance: PROVENANCE,
    });

    // Trial balance balanced per currency.
    const zarTotal = result.trialBalance.perCurrencyTotals.find((t) => t.currency === "ZAR");
    expect(zarTotal).toBeDefined();
    expect(zarTotal?.debitMinor).toBe(zarTotal?.creditMinor);
    expect(zarTotal?.debitMinor).toBe(7_000_000);

    // Two debit rows (5m + 2m) and one credit row of -7m.
    const debits = result.trialBalance.rows.filter((r) => r.amountMinor > 0);
    const credits = result.trialBalance.rows.filter((r) => r.amountMinor < 0);
    expect(debits.length).toBe(2);
    expect(credits.length).toBe(1);
    expect(credits[0]?.amountMinor).toBe(-7_000_000);

    // Document hash propagated through to both events.
    expect(result.documentHash).toBeDefined();
    const tbPayload = result.trialBalanceSnapshotEvent.payload as Record<string, unknown>;
    expect(tbPayload.documentHash).toBe(result.documentHash);
    const closePayload = result.accountingPeriodClosedEvent.payload as Record<string, unknown>;
    expect(closePayload.trialBalanceDocumentHash).toBe(result.documentHash);
    expect(closePayload.trialBalanceSnapshotEventId).toBe(
      result.trialBalanceSnapshotEvent.event_id,
    );

    // EvSS Slice 2 snapshot row exists under per-entity stream-key.
    const streamKey = periodCloseStreamKey(ENTITY_BANK);
    const snap = store.loadSnapshot(streamKey, "2026-06-01T00:00:00.000Z");
    expect(snap).toBeDefined();
    expect(snap?.id).toBe(result.snapshotRowId);
    const snapPayload = JSON.parse(snap?.payload ?? "{}") as Record<string, unknown>;
    expect(snapPayload.trialBalanceSnapshotEventId).toBe(result.trialBalanceSnapshotEvent.event_id);
  });

  it("refuses to close a period twice", () => {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });
    closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: VALID_OPEN_PAYLOAD.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
      provenance: PROVENANCE,
    });
    expect(() =>
      closePeriod({
        eventStore: store,
        entity: ENTITY_BANK,
        periodId: VALID_OPEN_PAYLOAD.periodId,
        closedAt: "2026-06-02T00:00:00.000Z",
        actor: ACTOR,
        citations: CITATIONS,
        provenance: PROVENANCE,
      }),
    ).toThrow(/already closed/);
  });

  it("refuses to close a period that was never opened", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      closePeriod({
        eventStore: store,
        entity: ENTITY_BANK,
        periodId: "period:hoz-bank:month:2026-05",
        closedAt: "2026-06-01T00:00:00.000Z",
        actor: ACTOR,
        citations: CITATIONS,
        provenance: PROVENANCE,
      }),
    ).toThrow(/no AccountingPeriodOpened/);
  });
});

describe("D-REPORTING-CAPABILITY-SLICE-2 — per-entity isolation", () => {
  it("two entities each open + close their own period without cross-talk", () => {
    const store = new EventStore(":memory:");

    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });
    openPeriod({
      eventStore: store,
      entity: ENTITY_SECURITIES,
      actor: ACTOR,
      citations: CITATIONS,
      payload: { ...VALID_OPEN_PAYLOAD, periodId: "period:hoz-securities:month:2026-05" },
      provenance: PROVENANCE,
    });

    // Postings on ENTITY_BANK only.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-equity-position-stub",
          credit: "ACC-pending-settlement-stub",
          currency: "ZAR",
          amountMinor: 1_000_000,
        },
      ],
    });

    // Postings on ENTITY_SECURITIES only.
    appendPosting(store, {
      entity: ENTITY_SECURITIES,
      asOf: "2026-05-12T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-equity-position-stub",
          credit: "ACC-pending-settlement-stub",
          currency: "USD",
          amountMinor: 50_000,
        },
      ],
    });

    const bankClose = closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: VALID_OPEN_PAYLOAD.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
      provenance: PROVENANCE,
    });
    const secClose = closePeriod({
      eventStore: store,
      entity: ENTITY_SECURITIES,
      periodId: "period:hoz-securities:month:2026-05",
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
      provenance: PROVENANCE,
    });

    // Bank's TB has only ZAR; Securities' TB has only USD.
    expect(bankClose.trialBalance.perCurrencyTotals.length).toBe(1);
    expect(bankClose.trialBalance.perCurrencyTotals[0]?.currency).toBe("ZAR");
    expect(secClose.trialBalance.perCurrencyTotals.length).toBe(1);
    expect(secClose.trialBalance.perCurrencyTotals[0]?.currency).toBe("USD");

    // Per-entity snapshot streams are distinct.
    const bankStreamKey = periodCloseStreamKey(ENTITY_BANK);
    const secStreamKey = periodCloseStreamKey(ENTITY_SECURITIES);
    expect(bankStreamKey).not.toBe(secStreamKey);
    expect(store.loadSnapshot(bankStreamKey, "2026-06-01T00:00:00.000Z")).toBeDefined();
    expect(store.loadSnapshot(secStreamKey, "2026-06-01T00:00:00.000Z")).toBeDefined();
  });
});

describe("D-REPORTING-CAPABILITY-SLICE-2 — reopen audit trail", () => {
  it("reopen-then-reclose chain is forensically readable", () => {
    const store = new EventStore(":memory:");

    const r1Open = openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: VALID_OPEN_PAYLOAD,
      provenance: PROVENANCE,
    });
    expect(r1Open.appended).toBe(true);

    const r1Close = closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: VALID_OPEN_PAYLOAD.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
      provenance: PROVENANCE,
    });

    // Reopen with explicit reopenOf + reopenReason.
    const r2Open = openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        ...VALID_OPEN_PAYLOAD,
        openedAt: "2026-06-15T00:00:00.000Z",
        reopenOf: r1Close.accountingPeriodClosedEvent.event_id,
        reopenReason: "audit-finding",
      },
      provenance: PROVENANCE,
    });
    expect(r2Open.appended).toBe(true);

    // Reclose.
    const r2Close = closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: VALID_OPEN_PAYLOAD.periodId,
      closedAt: "2026-06-20T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
      provenance: PROVENANCE,
    });

    // Audit chain: open, tb-snapshot, close, reopen, tb-snapshot, close.
    const chain = periodAuditChain({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: VALID_OPEN_PAYLOAD.periodId,
    });
    const types = chain.map((e) => e.type);
    expect(types).toEqual([
      "AccountingPeriodOpened",
      "TrialBalanceSnapshotted",
      "AccountingPeriodClosed",
      "AccountingPeriodOpened",
      "TrialBalanceSnapshotted",
      "AccountingPeriodClosed",
    ]);

    // Second open carries reopenOf chain to first close; second close
    // references the second tb-snapshot.
    const reopenPayload = chain[3]?.payload as Record<string, unknown>;
    expect(reopenPayload.reopenOf).toBe(r1Close.accountingPeriodClosedEvent.event_id);
    expect(reopenPayload.reopenReason).toBe("audit-finding");
    const recloseTbId = (chain[5]?.payload as Record<string, unknown>).trialBalanceSnapshotEventId;
    expect(recloseTbId).toBe(r2Close.trialBalanceSnapshotEvent.event_id);
  });
});

describe("D-REPORTING-CAPABILITY-SLICE-2 — computeTrialBalance round-trip", () => {
  it("filters postings by [periodStart, periodEnd] window", () => {
    const store = new EventStore(":memory:");

    // Posting before window — excluded.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-04-30T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-equity-position-stub",
          credit: "ACC-pending-settlement-stub",
          currency: "ZAR",
          amountMinor: 999_999,
        },
      ],
    });
    // Posting in window — included.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-15T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-equity-position-stub",
          credit: "ACC-pending-settlement-stub",
          currency: "ZAR",
          amountMinor: 100_000,
        },
      ],
    });
    // Posting after window — excluded.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-06-15T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-equity-position-stub",
          credit: "ACC-pending-settlement-stub",
          currency: "ZAR",
          amountMinor: 999_999,
        },
      ],
    });

    const tb = computeTrialBalance({
      eventStore: store,
      entity: ENTITY_BANK,
      periodStart: VALID_OPEN_PAYLOAD.periodStart,
      periodEnd: VALID_OPEN_PAYLOAD.periodEnd,
    });

    const zarTotal = tb.perCurrencyTotals.find((t) => t.currency === "ZAR");
    expect(zarTotal?.debitMinor).toBe(100_000);
    expect(zarTotal?.creditMinor).toBe(100_000);
    expect(tb.uptoSequence).toBe(1);
  });

  it("drops zero-net rows so cancelling debits/credits do not pollute the TB", () => {
    const store = new EventStore(":memory:");

    // Two postings: same debit/credit pair, opposite sides — net to zero on both accounts.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-equity-position-stub",
          credit: "ACC-pending-settlement-stub",
          currency: "ZAR",
          amountMinor: 50_000,
        },
      ],
    });
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-12T12:00:00.000Z",
      legs: [
        {
          debit: "ACC-pending-settlement-stub",
          credit: "ACC-equity-position-stub",
          currency: "ZAR",
          amountMinor: 50_000,
        },
      ],
    });

    const tb = computeTrialBalance({
      eventStore: store,
      entity: ENTITY_BANK,
      periodStart: VALID_OPEN_PAYLOAD.periodStart,
      periodEnd: VALID_OPEN_PAYLOAD.periodEnd,
    });

    // Both accounts net to zero — no rows; no per-currency totals row
    // (totals derive from surviving rows; zero-net currencies drop out).
    expect(tb.rows.length).toBe(0);
    expect(tb.perCurrencyTotals.length).toBe(0);
  });
});
