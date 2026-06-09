// platform/returns/ba300/period-close-subscriber.test.ts
//
// M2 Slice 3 — Unit tests for the AccountingPeriodClosed → BA 300 subscriber.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10),
//   pack §6 Slice 3; D-HQLA-CASH-CUSTODIAN-DERIVED (CEO-approved 2026-05-29).
//
// Asserts:
//   1. Cash HQLA tier is DERIVED from the cash account's custodian Party
//      classification (`central-bank` → Level-1), not an authored COA tag.
//      Same store, same posting: classify the custodian and the cash counts;
//      leave it unclassified and the cash is dropped (positive-balance and
//      functional-currency rules still apply).
//   2. Non-bank entity is silently skipped (LE-ZA-HOZ-SECURITIES).
//   3. Subscriber reads trial-balance rows from TrialBalanceSnapshotted event.
//   4. BA 300 output is compliant (lcr ≥ 1.0) with custodian-derived SARB cash.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering) +
//   Eitan (Treasury & liquidity engineer, engineering) +
//   Anya (Projection Engineer, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { makePartyClassified, makePartyRegistered } from "../../../domains/party";
import { closePeriod, openPeriod } from "../../accounting/period-close";
import { newEventId } from "../../core/types";
import { EventStore } from "../../event-store/store";
import { makeFxSettlementInstructed } from "../../markets/cdm/fx";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { ba110PeriodCloseSubscriber } from "./period-close-subscriber";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ACTOR = { type: "service" as const, id: "agent:Bea" };
const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "D-REPORTING-CAPABILITY-SLICE-3"];

// ACC-1100-001's custodian per the COA registry (asset-cash + custodianPartyId).
const SARB_PARTY_URN = "urn:party:legal-entity:sarb";

const PERIOD_OPEN = {
  periodId: "period:hoz-bank:month:2026-05",
  periodKind: "month" as const,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.999Z",
  openedAt: "2026-05-01T00:00:00.000Z",
  functionalCurrency: "ZAR",
};

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Seed the SARB custodian Party with a `central-bank` classification — the
// SOURCE FACT the cash-HQLA derivation queries (mirrors the production
// party-register seed loaded by runPartyBackfill). Without this seed the
// custodian confers no HQLA status and the cash line is dropped.
// ---------------------------------------------------------------------------

function seedSarbCentralBankParty(store: EventStore): void {
  store.append(
    makePartyRegistered({
      asOf: "2026-05-01T00:00:00.000Z",
      entity: ENTITY_BANK,
      actor: { type: "system", id: "system:party-backfill:test" },
      citations: ["D-PARTY-REGISTER", "D-HQLA-CASH-CUSTODIAN-DERIVED"],
      payload: {
        partyId: SARB_PARTY_URN,
        kind: "legal-entity",
        displayName: "South African Reserve Bank",
        legalName: "South African Reserve Bank",
        jurisdictions: ["ZA"],
        kindAttributes: {
          kind: "legal-entity",
          entityForm: "RF",
          parentPartyId: null,
          primaryRegulator: "other",
          regimeAnchor: ["South African Reserve Bank Act 90 of 1989 — the central bank"],
        },
        citations: ["[citation: South African Reserve Bank Act 90 of 1989]"],
      },
    }),
  );
  store.append(
    makePartyClassified({
      asOf: "2026-05-01T00:00:00.000Z",
      entity: ENTITY_BANK,
      actor: { type: "system", id: "system:party-backfill:test" },
      citations: ["D-PARTY-REGISTER", "D-HQLA-CASH-CUSTODIAN-DERIVED"],
      payload: {
        partyId: SARB_PARTY_URN,
        classification: "central-bank",
        scopeJson: { source: "test-seed" },
        citations: [
          "[citation: BCBS D295 §50(a); Reg 26(7)(a)(i) — central-bank cash is Level-1 HQLA]",
        ],
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Build a bank-entity store with an open→posted→closed period.
//   seedCentralBank: when true, register + classify the SARB custodian so the
//   cash at ACC-1100-001 qualifies as Level-1 HQLA. When false, the custodian
//   is unknown and the cash is dropped from the HQLA stock.
// ---------------------------------------------------------------------------

function buildStoreWithPeriod(opts: { seedCentralBank: boolean }): {
  store: EventStore;
  closedPayload: {
    periodId: string;
    closedAt: string;
    trialBalanceSnapshotEventId: string;
    uptoSequence: number;
  };
} {
  const store = new EventStore(":memory:");

  if (opts.seedCentralBank) {
    seedSarbCentralBankParty(store);
  }

  // Open the period.
  openPeriod({
    eventStore: store,
    entity: ENTITY_BANK,
    actor: ACTOR,
    citations: CITATIONS,
    payload: PERIOD_OPEN,
  });

  // Post cash to ACC-1100-001 (the SARB-custodied nostro).
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: "2026-05-05T00:00:00.000Z",
    entity: ENTITY_BANK,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: [
        {
          debit: "ACC-1100-001",
          credit: "ACC-equity-stub",
          currency: "ZAR",
          amountMinor: 5_000_000,
          memo: "initial-capitalisation",
        },
      ],
      asOfDate: "2026-05-05T00:00:00.000Z",
      citations: CITATIONS,
    },
  });

  // Append a settlement outflow event (50,000 ZAR) for the LCR denominator.
  store.append(
    makeFxSettlementInstructed({
      asOf: "2026-05-10T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: { scheme: "INTERNAL", value: "TRADE-SUB-001" },
        legKind: "near",
        settlementId: { scheme: "INTERNAL", value: "STL-SUB-001-OUT" },
        settlementPath: "correspondent",
        settlementForm: "physical",
        correspondent: {
          partyId: "CP-001",
          name: "Test Correspondent",
          role: "settlement-agent",
          jurisdiction: "ZA",
        },
        counterparty: {
          partyId: "CP-001",
          name: "Test Counterparty",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        netCash: { currency: "ZAR", amountMinor: -50_000 },
        settlementDate: { iso: "2026-05-10", calendar: "JIHCAL" },
        messageStandard: "ISO-20022-pacs.009",
      },
    }),
  );

  // Close the period.
  const close = closePeriod({
    eventStore: store,
    entity: ENTITY_BANK,
    periodId: PERIOD_OPEN.periodId,
    closedAt: "2026-06-01T00:00:00.000Z",
    actor: ACTOR,
    citations: CITATIONS,
  });

  return {
    store,
    closedPayload: {
      periodId: PERIOD_OPEN.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      trialBalanceSnapshotEventId: close.trialBalanceSnapshotEvent.event_id,
      uptoSequence: close.trialBalance.uptoSequence,
    },
  };
}

// =====================================================================
// 1. Custodian-derived cash HQLA — tier from the Party, not a COA tag
// =====================================================================

describe("BA300 period-close subscriber — custodian-derived cash HQLA", () => {
  it("counts SARB cash as Level-1 HQLA when the custodian is classified central-bank", () => {
    const { store, closedPayload } = buildStoreWithPeriod({ seedCentralBank: true });

    const result = ba110PeriodCloseSubscriber({
      closedPayload,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_OPEN.periodStart,
    });

    expect(result.skipped).toBe(false);
    // ACC-1100-001 balance (5,000,000 ZAR), tier derived from the central-bank custodian.
    expect(result.ba110Output.hqla.level1.stockMinor).toBe(5_000_000);
  });

  it("drops the cash line when the custodian confers no HQLA status (derived, not authored)", () => {
    // Same posting, same account — but the custodian is NOT classified
    // central-bank. The cash must NOT become phantom Level-1 stock: this is
    // exactly the authored-tag failure mode the custodian derivation removes.
    const { store, closedPayload } = buildStoreWithPeriod({ seedCentralBank: false });

    const result = ba110PeriodCloseSubscriber({
      closedPayload,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_OPEN.periodStart,
    });

    expect(result.skipped).toBe(false);
    // No securities + custodian confers nothing → zero HQLA stock.
    expect(result.ba110Output.hqla.level1.stockMinor).toBe(0);
    expect(result.ba110Output.hqla.totalStockHqlaMinor).toBe(0);
    // 0 HQLA against a 50,000 outflow → not LCR-compliant.
    expect(result.ba110Output.lcrCompliant).toBe(false);
  });
});

// =====================================================================
// 2. Non-bank entity is skipped
// =====================================================================

describe("BA300 period-close subscriber — entity guard", () => {
  it("skips LE-ZA-HOZ-SECURITIES (not bank-licence-bound)", () => {
    const store = new EventStore(":memory:");
    const result = ba110PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-sec:month:2026-05",
        closedAt: "2026-06-01T00:00:00.000Z",
        trialBalanceSnapshotEventId: newEventId(),
        uptoSequence: 0,
      },
      entity: ENTITY_SECURITIES,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-05-01T00:00:00.000Z",
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain("not in BA_110_BANK_ENTITIES");
  });
});

// =====================================================================
// 3. End-to-end: period close → subscriber → compliant BA 300
// =====================================================================

describe("BA300 period-close subscriber — end-to-end", () => {
  it("generates a compliant BA 300 for LE-ZA-HOZ-BANK on period close", () => {
    const { store, closedPayload } = buildStoreWithPeriod({ seedCentralBank: true });

    const result = ba110PeriodCloseSubscriber({
      closedPayload,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_OPEN.periodStart,
    });

    expect(result.skipped).toBe(false);
    expect(result.ba110Output).toBeDefined();

    // Custodian-derived Level-1 cash stock from ACC-1100-001 (5,000,000 ZAR).
    expect(result.ba110Output.hqla.level1.stockMinor).toBe(5_000_000);
    expect(result.ba110Output.hqla.totalStockHqlaMinor).toBeGreaterThan(0);

    // Cash outflows from FxSettlementInstructed (50,000 ZAR).
    expect(result.ba110Output.cashFlows.outflows.grossMinor).toBe(50_000);

    // LCR = 5,000,000 / 50,000 = 100 → compliant.
    expect(result.ba110Output.lcrRatio).toBeGreaterThan(1);
    expect(result.ba110Output.lcrCompliant).toBe(true);

    // Provenance chain: trialBalanceSnapshotEventId flows into meta.
    expect(result.ba110Output.meta.trialBalanceSnapshotEventId).toBe(
      closedPayload.trialBalanceSnapshotEventId,
    );

    // Required cells present and non-NaN.
    expect(Number.isNaN(result.ba110Output.lcrRatio)).toBe(false);
    expect(Number.isNaN(result.ba110Output.hqla.totalStockHqlaMinor)).toBe(false);
    expect(Number.isNaN(result.ba110Output.cashFlows.netCashOutflowsMinor)).toBe(false);
  });

  it("reads trial-balance rows from TrialBalanceSnapshotted event", () => {
    const { store, closedPayload } = buildStoreWithPeriod({ seedCentralBank: true });

    const result = ba110PeriodCloseSubscriber({
      closedPayload,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_OPEN.periodStart,
    });

    // Trial balance rows must be non-empty (we posted to ACC-1100-001).
    expect(result.trialBalanceRows.length).toBeGreaterThan(0);
    const sarbCashRow = result.trialBalanceRows.find(
      (r) => r.leafAccountId === "ACC-1100-001" && r.currency === "ZAR",
    );
    expect(sarbCashRow).toBeDefined();
    expect(sarbCashRow?.amountMinor).toBe(5_000_000);
  });

  it("placeholders are populated (rehearsal-grade marker)", () => {
    const { store, closedPayload } = buildStoreWithPeriod({ seedCentralBank: true });

    const result = ba110PeriodCloseSubscriber({
      closedPayload,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_OPEN.periodStart,
    });

    expect(result.ba110Output.placeholders.length).toBeGreaterThanOrEqual(1);
    expect(result.ba110Output.placeholders.some((p) => p.includes("[citation: TBC"))).toBe(true);
  });
});
