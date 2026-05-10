// tests/bank-account-events.test.ts
//
// D-BANK-ACCOUNT-SUBSTRATE — exit-criterion test for the bank-account event
// family + master/balance projections.
//
// Asserts:
//   - All three bank-account event types are registered in EVENT_TYPE_REGISTRY.
//   - Each carries a typed Zod payload schema + retention metadata.
//   - The typed Zod schemas accept canonical payloads (positive parse).
//   - The typed Zod schemas reject boundary violations (negative parse).
//   - The account-master projection round-trips via replay (P1).
//   - The account-balance projection sums signed postings correctly.
//   - As-of replay propagates correctly (P1).
//
// Authority: D-BANK-ACCOUNT-SUBSTRATE (under standing approval of
//            D-FIRST-DRY-RUN-SCENARIO, CEO-approved 2026-05-10).
// Source spec: Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-
//              scenario-design.md §6 #A1.
//
// Authors: Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; lead) · Atlas (Core banking platform architect, engineering
//   — substrate consult) · Bea (Accounting & financial reporting engineer,
//   engineering — reports to Camille CFO).

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId } from "../platform/core/types";
import {
  bankAccountClosedPayloadSchema,
  bankAccountConfiguredPayloadSchema,
  bankAccountOpenedPayloadSchema,
  makeBankAccountClosed,
  makeBankAccountConfigured,
  makeBankAccountOpened,
} from "../platform/event-store/event-types";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";
import { simulatedTag } from "../platform/event-store/provenance";
import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import { LocalProjector } from "../platform/projections";
import {
  accountBalanceProjection,
  accountMasterProjection,
} from "../platform/projections/accounts";

const BANK_ACCOUNT_EVENT_NAMES = [
  "BankAccountOpened",
  "BankAccountConfigured",
  "BankAccountClosed",
] as const;

const ENVELOPE = {
  asOf: "2026-05-10T09:00:00.000Z",
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "service" as const, id: "agent:Tomas" },
  citations: [
    "D-FIRST-DRY-RUN-SCENARIO",
    "D-BANK-ACCOUNT-SUBSTRATE",
    "INTERNAL-FINANCE-CHART-OF-ACCOUNTS",
  ],
};

const SCENARIO_PROVENANCE = simulatedTag({
  scenario: "first-dry-run-2026-Q1",
  sourceLineage: "agent:tomas:bank-account",
});

const VALID_OPENED_PAYLOAD = {
  accountId: "account:hoz-bank:nostro:usd:01",
  accountType: "nostro" as const,
  currency: "USD",
  counterpartyId: "CP-SYN-DRYRUN-001",
  chartOfAccounts: { leafAccountId: "ACC-1100-002", note: "USD nostro at SimulatedBank Co." },
  openedAt: "2026-05-10T09:00:00.000Z",
  displayName: "Nostro USD — SimulatedBank Co.",
};

describe("D-BANK-ACCOUNT-SUBSTRATE — registry coverage", () => {
  it("all three bank-account event types are registered in EVENT_TYPE_REGISTRY", () => {
    const missing = BANK_ACCOUNT_EVENT_NAMES.filter((t) => !lookupEventType(t));
    expect(missing).toEqual([]);
  });

  it("each carries a typed Zod payload schema + retention metadata", () => {
    for (const name of BANK_ACCOUNT_EVENT_NAMES) {
      const meta = lookupEventType(name);
      expect(meta).toBeDefined();
      expect(meta?.payloadSchema).toBeDefined();
      expect(meta?.retention).toBeDefined();
      expect(meta?.retention.minimumYears).toBeGreaterThanOrEqual(7);
      expect(meta?.class).toBe("governance");
    }
  });

  it("the registry surface is consistent — the three types appear once each", () => {
    for (const name of BANK_ACCOUNT_EVENT_NAMES) {
      const matches = EVENT_TYPE_REGISTRY.filter((m) => m.type === name);
      expect(matches.length).toBe(1);
    }
  });
});

describe("D-BANK-ACCOUNT-SUBSTRATE — Zod payload validation", () => {
  it("BankAccountOpened — accepts a canonical payload", () => {
    const parsed = bankAccountOpenedPayloadSchema.parse(VALID_OPENED_PAYLOAD);
    expect(parsed.accountId).toBe(VALID_OPENED_PAYLOAD.accountId);
  });

  it("BankAccountOpened — rejects bad chart-of-accounts ID format", () => {
    expect(() =>
      bankAccountOpenedPayloadSchema.parse({
        ...VALID_OPENED_PAYLOAD,
        chartOfAccounts: { leafAccountId: "BAD-FORMAT" },
      }),
    ).toThrow();
  });

  it("BankAccountOpened — rejects non-3-char currency", () => {
    expect(() =>
      bankAccountOpenedPayloadSchema.parse({
        ...VALID_OPENED_PAYLOAD,
        currency: "USDOLLAR",
      }),
    ).toThrow();
  });

  it("BankAccountOpened — accepts null counterpartyId for internal accounts", () => {
    const parsed = bankAccountOpenedPayloadSchema.parse({
      ...VALID_OPENED_PAYLOAD,
      accountType: "capital",
      counterpartyId: null,
    });
    expect(parsed.counterpartyId).toBeNull();
  });

  it("BankAccountOpened — rejects unknown accountType", () => {
    expect(() =>
      bankAccountOpenedPayloadSchema.parse({
        ...VALID_OPENED_PAYLOAD,
        accountType: "savings",
      }),
    ).toThrow();
  });

  it("BankAccountConfigured — accepts a canonical payload", () => {
    const parsed = bankAccountConfiguredPayloadSchema.parse({
      accountId: VALID_OPENED_PAYLOAD.accountId,
      configKey: "daily-debit-limit",
      configValue: { amountMinor: 10_000_000_00, currency: "USD" },
      effectiveAt: "2026-05-10T10:00:00.000Z",
      rationale: "Initial limit per Eitan treasury sign-off",
    });
    expect(parsed.configKey).toBe("daily-debit-limit");
  });

  it("BankAccountConfigured — rejects missing rationale", () => {
    expect(() =>
      bankAccountConfiguredPayloadSchema.parse({
        accountId: VALID_OPENED_PAYLOAD.accountId,
        configKey: "daily-debit-limit",
        configValue: 10_000_000_00,
        effectiveAt: "2026-05-10T10:00:00.000Z",
      }),
    ).toThrow();
  });

  it("BankAccountClosed — accepts a canonical payload", () => {
    const parsed = bankAccountClosedPayloadSchema.parse({
      accountId: VALID_OPENED_PAYLOAD.accountId,
      closedAt: "2026-06-10T09:00:00.000Z",
      reason: "consolidation",
      note: "merged into account:hoz-bank:nostro:usd:02",
    });
    expect(parsed.reason).toBe("consolidation");
  });

  it("BankAccountClosed — rejects unknown reason", () => {
    expect(() =>
      bankAccountClosedPayloadSchema.parse({
        accountId: VALID_OPENED_PAYLOAD.accountId,
        closedAt: "2026-06-10T09:00:00.000Z",
        reason: "boredom",
      }),
    ).toThrow();
  });
});

describe("D-BANK-ACCOUNT-SUBSTRATE — make…() constructors and provenance", () => {
  it("makeBankAccountOpened produces a parsed Event carrying the typed payload", () => {
    const e = makeBankAccountOpened({
      ...ENVELOPE,
      payload: VALID_OPENED_PAYLOAD,
      provenance: SCENARIO_PROVENANCE,
    });
    expect(e.type).toBe("BankAccountOpened");
    expect(e.entity).toBe("LE-ZA-HOZ-BANK");
    expect(e.provenance?.kind).toBe("simulated");
    expect(e.provenance?.scenario).toBe("first-dry-run-2026-Q1");
  });

  it("make…() constructors tolerate omitted provenance for legacy callers", () => {
    const e = makeBankAccountClosed({
      ...ENVELOPE,
      payload: {
        accountId: VALID_OPENED_PAYLOAD.accountId,
        closedAt: "2026-06-10T09:00:00.000Z",
        reason: "consolidation",
      },
    });
    expect(e.provenance).toBeUndefined();
  });
});

describe("D-BANK-ACCOUNT-SUBSTRATE — account-master projection", () => {
  function makeStore(): EventStore {
    return new EventStore();
  }

  it("Opened event creates a master row with status open", () => {
    const store = makeStore();
    store.append(
      makeBankAccountOpened({
        ...ENVELOPE,
        payload: VALID_OPENED_PAYLOAD,
        provenance: SCENARIO_PROVENANCE,
      }),
    );
    const projector = new LocalProjector(store);
    const state = projector.build(accountMasterProjection);
    const row = state.accounts.get(VALID_OPENED_PAYLOAD.accountId);
    expect(row).toBeDefined();
    expect(row?.status).toBe("open");
    expect(row?.currency).toBe("USD");
    expect(row?.accountType).toBe("nostro");
    expect(row?.chartOfAccounts.leafAccountId).toBe("ACC-1100-002");
    expect(row?.entity).toBe("LE-ZA-HOZ-BANK");
    expect(Object.keys(row?.configurations ?? {})).toEqual([]);
    store.close();
  });

  it("a second Opened event with the same accountId is dropped (idempotent-terminal)", () => {
    const store = makeStore();
    store.append(
      makeBankAccountOpened({
        ...ENVELOPE,
        payload: VALID_OPENED_PAYLOAD,
        provenance: SCENARIO_PROVENANCE,
      }),
    );
    store.append(
      makeBankAccountOpened({
        ...ENVELOPE,
        asOf: "2026-05-11T09:00:00.000Z",
        payload: { ...VALID_OPENED_PAYLOAD, displayName: "DUPLICATE — should be dropped" },
        provenance: SCENARIO_PROVENANCE,
      }),
    );
    const projector = new LocalProjector(store);
    const state = projector.build(accountMasterProjection);
    const row = state.accounts.get(VALID_OPENED_PAYLOAD.accountId);
    expect(row?.displayName).toBe(VALID_OPENED_PAYLOAD.displayName);
    expect(state.accounts.size).toBe(1);
    store.close();
  });

  it("Configured events fold latest-wins per configKey", () => {
    const store = makeStore();
    store.append(makeBankAccountOpened({ ...ENVELOPE, payload: VALID_OPENED_PAYLOAD }));
    store.append(
      makeBankAccountConfigured({
        ...ENVELOPE,
        asOf: "2026-05-10T10:00:00.000Z",
        payload: {
          accountId: VALID_OPENED_PAYLOAD.accountId,
          configKey: "daily-debit-limit",
          configValue: 10_000_000_00,
          effectiveAt: "2026-05-10T10:00:00.000Z",
          rationale: "Initial limit",
        },
      }),
    );
    store.append(
      makeBankAccountConfigured({
        ...ENVELOPE,
        asOf: "2026-05-12T10:00:00.000Z",
        payload: {
          accountId: VALID_OPENED_PAYLOAD.accountId,
          configKey: "daily-debit-limit",
          configValue: 25_000_000_00,
          effectiveAt: "2026-05-12T10:00:00.000Z",
          rationale: "Limit raised after stress test",
        },
      }),
    );
    store.append(
      makeBankAccountConfigured({
        ...ENVELOPE,
        asOf: "2026-05-13T10:00:00.000Z",
        payload: {
          accountId: VALID_OPENED_PAYLOAD.accountId,
          configKey: "restriction:outbound-suspended",
          configValue: false,
          effectiveAt: "2026-05-13T10:00:00.000Z",
          rationale: "Default state",
        },
      }),
    );
    const projector = new LocalProjector(store);
    const state = projector.build(accountMasterProjection);
    const row = state.accounts.get(VALID_OPENED_PAYLOAD.accountId);
    expect(row?.configurations["daily-debit-limit"]?.configValue).toBe(25_000_000_00);
    expect(row?.configurations["daily-debit-limit"]?.rationale).toBe(
      "Limit raised after stress test",
    );
    expect(row?.configurations["restriction:outbound-suspended"]?.configValue).toBe(false);
    store.close();
  });

  it("Closed event marks the row closed and records closedAt + reason", () => {
    const store = makeStore();
    store.append(makeBankAccountOpened({ ...ENVELOPE, payload: VALID_OPENED_PAYLOAD }));
    store.append(
      makeBankAccountClosed({
        ...ENVELOPE,
        asOf: "2026-06-10T09:00:00.000Z",
        payload: {
          accountId: VALID_OPENED_PAYLOAD.accountId,
          closedAt: "2026-06-10T09:00:00.000Z",
          reason: "operational-cleanup",
        },
      }),
    );
    const projector = new LocalProjector(store);
    const state = projector.build(accountMasterProjection);
    const row = state.accounts.get(VALID_OPENED_PAYLOAD.accountId);
    expect(row?.status).toBe("closed");
    expect(row?.closedAt).toBe("2026-06-10T09:00:00.000Z");
    expect(row?.closureReason).toBe("operational-cleanup");
    store.close();
  });

  it("Closed event before Opened is dropped (substrate-integrity)", () => {
    const store = makeStore();
    store.append(
      makeBankAccountClosed({
        ...ENVELOPE,
        payload: {
          accountId: "account:never-opened",
          closedAt: "2026-06-10T09:00:00.000Z",
          reason: "incorrectly-opened",
        },
      }),
    );
    const projector = new LocalProjector(store);
    const state = projector.build(accountMasterProjection);
    expect(state.accounts.size).toBe(0);
    store.close();
  });

  it("as-of replay isolates the master state to the cutoff (P1)", () => {
    const store = makeStore();
    store.append(
      makeBankAccountOpened({
        ...ENVELOPE,
        asOf: "2026-05-10T09:00:00.000Z",
        payload: VALID_OPENED_PAYLOAD,
      }),
    );
    store.append(
      makeBankAccountClosed({
        ...ENVELOPE,
        asOf: "2026-06-10T09:00:00.000Z",
        payload: {
          accountId: VALID_OPENED_PAYLOAD.accountId,
          closedAt: "2026-06-10T09:00:00.000Z",
          reason: "consolidation",
        },
      }),
    );
    const projector = new LocalProjector(store);

    const before = projector.build(accountMasterProjection, {
      asOf: "2026-05-15T00:00:00.000Z",
    });
    expect(before.accounts.get(VALID_OPENED_PAYLOAD.accountId)?.status).toBe("open");

    const after = projector.build(accountMasterProjection, {
      asOf: "2026-06-15T00:00:00.000Z",
    });
    expect(after.accounts.get(VALID_OPENED_PAYLOAD.accountId)?.status).toBe("closed");
    store.close();
  });

  it("the projection is deterministic — same events yield same state on replay", () => {
    const store = makeStore();
    store.append(makeBankAccountOpened({ ...ENVELOPE, payload: VALID_OPENED_PAYLOAD }));
    store.append(
      makeBankAccountConfigured({
        ...ENVELOPE,
        payload: {
          accountId: VALID_OPENED_PAYLOAD.accountId,
          configKey: "x",
          configValue: 1,
          effectiveAt: "2026-05-10T10:00:00.000Z",
          rationale: "r",
        },
      }),
    );
    const projector = new LocalProjector(store);
    const a = projector.build(accountMasterProjection);
    const b = projector.build(accountMasterProjection);
    expect(JSON.stringify(Array.from(a.accounts.entries()))).toBe(
      JSON.stringify(Array.from(b.accounts.entries())),
    );
    store.close();
  });
});

describe("D-BANK-ACCOUNT-SUBSTRATE — account-balance projection", () => {
  // Synthetic posting event satisfying the AccountPostingConvention shape.
  // Drops the eventSchema parse via a direct cast — the balance projection
  // doesn't care about envelope provenance, only the convention triple.
  function postingEvent(args: {
    accountId: string;
    cashAmountMinor: number;
    currency: string;
    asOf?: string;
    eventType?: string;
  }): Event {
    return {
      event_id: newEventId(),
      type: args.eventType ?? "FXSettlementLegPosted",
      as_of: args.asOf ?? "2026-05-10T12:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:Tomas" },
      citations: ["D-BANK-ACCOUNT-SUBSTRATE"],
      payload: {
        accountId: args.accountId,
        cashAmountMinor: args.cashAmountMinor,
        currency: args.currency,
        // extra fields ignored by the projection
        narration: "synthetic test posting",
      },
    } as Event;
  }

  it("sums signed postings per account", () => {
    const store = new EventStore();
    const accountId = "account:hoz-bank:nostro:usd:01";
    store.append(postingEvent({ accountId, cashAmountMinor: 5_000_000_00, currency: "USD" }));
    store.append(postingEvent({ accountId, cashAmountMinor: -1_500_000_00, currency: "USD" }));
    store.append(postingEvent({ accountId, cashAmountMinor: 200_000_00, currency: "USD" }));
    const projector = new LocalProjector(store);
    const state = projector.build(accountBalanceProjection);
    const row = state.balances.get(accountId);
    expect(row?.balanceMinor).toBe(3_700_000_00);
    expect(row?.postingCount).toBe(3);
    expect(row?.currency).toBe("USD");
    store.close();
  });

  it("ignores the bank-account lifecycle events themselves", () => {
    const store = new EventStore();
    store.append(makeBankAccountOpened({ ...ENVELOPE, payload: VALID_OPENED_PAYLOAD }));
    store.append(
      makeBankAccountConfigured({
        ...ENVELOPE,
        payload: {
          accountId: VALID_OPENED_PAYLOAD.accountId,
          configKey: "x",
          configValue: 1,
          effectiveAt: ENVELOPE.asOf,
          rationale: "r",
        },
      }),
    );
    const projector = new LocalProjector(store);
    const state = projector.build(accountBalanceProjection);
    expect(state.balances.size).toBe(0);
    store.close();
  });

  it("ignores events that don't satisfy the convention triple", () => {
    const store = new EventStore();
    // An event whose payload lacks accountId / cashAmountMinor.
    store.append({
      event_id: newEventId(),
      type: "RandomEvent",
      as_of: "2026-05-10T12:00:00.000Z",
      entity: BANK_ZA_001,
      actor: { type: "system", id: "test" },
      citations: ["TEST"],
      payload: { foo: "bar" },
    } as Event);
    const projector = new LocalProjector(store);
    const state = projector.build(accountBalanceProjection);
    expect(state.balances.size).toBe(0);
    store.close();
  });

  it("rejects currency-mismatched postings (substrate-integrity)", () => {
    const store = new EventStore();
    const accountId = "account:hoz-bank:nostro:usd:01";
    store.append(postingEvent({ accountId, cashAmountMinor: 5_000_000_00, currency: "USD" }));
    // ZAR posting against USD account — dropped, not folded.
    store.append(postingEvent({ accountId, cashAmountMinor: 100_000_00, currency: "ZAR" }));
    const projector = new LocalProjector(store);
    const state = projector.build(accountBalanceProjection);
    expect(state.balances.get(accountId)?.balanceMinor).toBe(5_000_000_00);
    expect(state.balances.get(accountId)?.postingCount).toBe(1);
    store.close();
  });

  it("supports multi-account balances simultaneously", () => {
    const store = new EventStore();
    store.append(postingEvent({ accountId: "acct:a", cashAmountMinor: 100, currency: "USD" }));
    store.append(postingEvent({ accountId: "acct:b", cashAmountMinor: 200, currency: "ZAR" }));
    store.append(postingEvent({ accountId: "acct:a", cashAmountMinor: 50, currency: "USD" }));
    const projector = new LocalProjector(store);
    const state = projector.build(accountBalanceProjection);
    expect(state.balances.get("acct:a")?.balanceMinor).toBe(150);
    expect(state.balances.get("acct:b")?.balanceMinor).toBe(200);
    expect(state.balances.size).toBe(2);
    store.close();
  });

  it("as-of replay propagates to balance state (P1)", () => {
    const store = new EventStore();
    const accountId = "acct:asof";
    store.append(
      postingEvent({
        accountId,
        cashAmountMinor: 100,
        currency: "USD",
        asOf: "2026-05-10T00:00:00.000Z",
      }),
    );
    store.append(
      postingEvent({
        accountId,
        cashAmountMinor: 200,
        currency: "USD",
        asOf: "2026-05-20T00:00:00.000Z",
      }),
    );
    const projector = new LocalProjector(store);
    const before = projector.build(accountBalanceProjection, {
      asOf: "2026-05-15T00:00:00.000Z",
    });
    const after = projector.build(accountBalanceProjection, {
      asOf: "2026-05-25T00:00:00.000Z",
    });
    expect(before.balances.get(accountId)?.balanceMinor).toBe(100);
    expect(after.balances.get(accountId)?.balanceMinor).toBe(300);
    store.close();
  });
});
