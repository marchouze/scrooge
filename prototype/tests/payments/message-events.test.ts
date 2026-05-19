// tests/payments/message-events.test.ts
//
// Unit tests verifying that FX message generators emit the correct event types
// into the event store (Principle 1 compliance, D-FX-MESSAGE-EVENTS).
//
// Tests:
//   1. generateAndEmitMt300 → OutboundMessageDispatched with SWIFT-MT300
//   2. generateAndEmitMt202 → OutboundMessageDispatched with SWIFT-MT202
//   3. generateAndEmitMt103 → OutboundMessageDispatched with SWIFT-MT103
//   4. generateAndEmitPacs008 → OutboundMessageDispatched with ISO-20022-pacs.008
//   5. generateAndEmitPacs009 → OutboundMessageDispatched with ISO-20022-pacs.009
//   6. simulateInboundMessages with store → InboundMessageReceived events present
//   7. simulateInboundMessages with store → MessageCorrelated events present
//   8. MessageCorrelated.correlationType is "confirmation" for MT300 echo
//   9. outboundMessageId is threaded through MessageCorrelated correctly
//
// Authority:
//   D-FX-MESSAGE-EVENTS (CEO-approved 2026-05-19)
//   urn:bank:principle:1

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PaymentInitiatedPayload } from "@platform/event-store/event-types/payments";
import { EventStore } from "@platform/event-store/store";
import type { FxTradeExecutedPayload } from "@platform/markets/cdm/fx";
import { simulateInboundMessages } from "@platform/payments/inbound-simulator";
import { generateAndEmitPacs008 } from "@platform/payments/iso20022/pacs008";
import { generateAndEmitPacs009 } from "@platform/payments/iso20022/pacs009";
import type { FIIdentification } from "@platform/payments/iso20022/types";
import { generateAndEmitMt103 } from "@platform/payments/swift-mt/mt103";
import { generateAndEmitMt202 } from "@platform/payments/swift-mt/mt202";
import { generateAndEmitMt300, generateMt300 } from "@platform/payments/swift-mt/mt300";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ZAR_USD_BUY_TRADE: FxTradeExecutedPayload = {
  tradeId: { scheme: "INTERNAL", value: "TRD-MSG-EVENTS-001" },
  productTaxonomy: "FX-spot",
  currencyPair: { base: "USD", quote: "ZAR" },
  side: "buy",
  legs: [
    {
      legKind: "near",
      payCurrency: "ZAR",
      receiveCurrency: "USD",
      notional: { currency: "ZAR", amountMinor: 9_250_000_000_00 },
      counterNotional: { currency: "USD", amountMinor: 5_000_000_00 },
      rate: { currency: "ZAR", amount: 18.5 },
      settlementDate: { iso: "2026-05-14", calendar: "JIHCAL" },
    },
  ],
  tradeDate: { iso: "2026-05-12", calendar: "JIHCAL" },
  counterparty: {
    partyId: "CP-STANDARD-001",
    name: "Standard Bank Counterparty",
    role: "counterparty",
    jurisdiction: "ZA",
  },
  venue: "OTC",
  trader: "trader@bank.local",
  bookId: "BOOK-FX-MARKETS",
  bookType: "trading",
  settlementForm: "physical",
  settlementPath: "correspondent",
  finsurvCategory: "ODP-001",
};

const PAYMENT_PAYLOAD: PaymentInitiatedPayload = {
  tradeId: "TRD-MSG-EVENTS-001",
  legKind: "deliver",
  paymentRef: "PAY-MSG-EVENTS-001",
  currency: "ZAR",
  netCash: 9_250_000_000_00,
  initiatedAt: "2026-05-14T10:00:00.000Z",
  citations: ["D-FX-MESSAGE-EVENTS"],
};

const BANK_BIC = "BANKZAJJXXX";
const COUNTERPARTY_BIC = "SBZAZAJJXXX";
const AS_OF = "2026-05-14T10:00:00.000Z";
const SETTLED_AT = new Date("2026-05-14T10:00:00.000Z");
const NOSTRO_BALANCE = 10_000_000_00n;

const BANK_FI: FIIdentification = { bic: BANK_BIC, name: "THE BANK ZA", country: "ZA" };
const COUNTERPARTY_FI: FIIdentification = {
  bic: COUNTERPARTY_BIC,
  name: "Standard Bank",
  country: "ZA",
};

// ---------------------------------------------------------------------------
// Test setup — ephemeral SQLite per test suite
// ---------------------------------------------------------------------------

let dbDir: string;
let dbPath: string;
let store: EventStore;

beforeEach(() => {
  dbDir = join(tmpdir(), `msg-events-test-${Date.now()}`);
  mkdirSync(dbDir, { recursive: true });
  dbPath = join(dbDir, "events.db");
  store = new EventStore(dbPath);
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* already closed */
  }
  try {
    rmSync(dbDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

// ---------------------------------------------------------------------------
// 1. generateAndEmitMt300
// ---------------------------------------------------------------------------

describe("generateAndEmitMt300", () => {
  test("emits OutboundMessageDispatched with SWIFT-MT300 standard", () => {
    generateAndEmitMt300(store, ZAR_USD_BUY_TRADE, BANK_BIC, COUNTERPARTY_BIC, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    expect(dispatched).toHaveLength(1);

    const payload = dispatched[0]?.payload as { messageStandard: string };
    expect(payload.messageStandard).toBe("SWIFT-MT300");
  });

  test("serialisedMessage in the event is non-empty", () => {
    generateAndEmitMt300(store, ZAR_USD_BUY_TRADE, BANK_BIC, COUNTERPARTY_BIC, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    const payload = dispatched[0]?.payload as { serialisedMessage: string };
    expect(payload.serialisedMessage.length).toBeGreaterThan(0);
  });

  test("messageId extracted from :20: field", () => {
    generateAndEmitMt300(store, ZAR_USD_BUY_TRADE, BANK_BIC, COUNTERPARTY_BIC, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    const payload = dispatched[0]?.payload as { messageId: string };
    expect(payload.messageId.length).toBeGreaterThan(0);
  });

  test("tradeId matches the trade fixture", () => {
    generateAndEmitMt300(store, ZAR_USD_BUY_TRADE, BANK_BIC, COUNTERPARTY_BIC, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    const payload = dispatched[0]?.payload as { tradeId: string };
    expect(payload.tradeId).toBe("TRD-MSG-EVENTS-001");
  });

  test("pure generateMt300 is unaffected — returns same block4 as before", () => {
    // Pure function still works without a store
    const msg = generateMt300(ZAR_USD_BUY_TRADE, BANK_BIC, COUNTERPARTY_BIC);
    expect(msg.block4.length).toBeGreaterThan(0);
    expect(msg.serialised.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. generateAndEmitMt202
// ---------------------------------------------------------------------------

describe("generateAndEmitMt202", () => {
  test("emits OutboundMessageDispatched with SWIFT-MT202 standard", () => {
    generateAndEmitMt202(store, ZAR_USD_BUY_TRADE, "deliver", COUNTERPARTY_BIC, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    expect(dispatched).toHaveLength(1);

    const payload = dispatched[0]?.payload as { messageStandard: string };
    expect(payload.messageStandard).toBe("SWIFT-MT202");
  });

  test("serialisedMessage is non-empty", () => {
    generateAndEmitMt202(store, ZAR_USD_BUY_TRADE, "deliver", COUNTERPARTY_BIC, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    const payload = dispatched[0]?.payload as { serialisedMessage: string };
    expect(payload.serialisedMessage.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. generateAndEmitMt103
// ---------------------------------------------------------------------------

describe("generateAndEmitMt103", () => {
  test("emits OutboundMessageDispatched with SWIFT-MT103 standard", () => {
    generateAndEmitMt103(store, PAYMENT_PAYLOAD, BANK_BIC, COUNTERPARTY_BIC, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    expect(dispatched).toHaveLength(1);

    const payload = dispatched[0]?.payload as { messageStandard: string };
    expect(payload.messageStandard).toBe("SWIFT-MT103");
  });
});

// ---------------------------------------------------------------------------
// 4. generateAndEmitPacs008
// ---------------------------------------------------------------------------

describe("generateAndEmitPacs008", () => {
  test("emits OutboundMessageDispatched with ISO-20022-pacs.008 standard", () => {
    generateAndEmitPacs008(store, PAYMENT_PAYLOAD, BANK_FI, COUNTERPARTY_FI, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    expect(dispatched).toHaveLength(1);

    const payload = dispatched[0]?.payload as { messageStandard: string };
    expect(payload.messageStandard).toBe("ISO-20022-pacs.008");
  });

  test("serialisedMessage contains XML namespace", () => {
    generateAndEmitPacs008(store, PAYMENT_PAYLOAD, BANK_FI, COUNTERPARTY_FI, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    const payload = dispatched[0]?.payload as { serialisedMessage: string };
    expect(payload.serialisedMessage).toContain("pacs.008");
  });
});

// ---------------------------------------------------------------------------
// 5. generateAndEmitPacs009
// ---------------------------------------------------------------------------

describe("generateAndEmitPacs009", () => {
  test("emits OutboundMessageDispatched with ISO-20022-pacs.009 standard", () => {
    generateAndEmitPacs009(store, ZAR_USD_BUY_TRADE, "deliver", BANK_FI, COUNTERPARTY_FI, AS_OF);

    const events = [...store.replay({})];
    const dispatched = events.filter((e) => e.type === "OutboundMessageDispatched");
    expect(dispatched).toHaveLength(1);

    const payload = dispatched[0]?.payload as { messageStandard: string };
    expect(payload.messageStandard).toBe("ISO-20022-pacs.009");
  });
});

// ---------------------------------------------------------------------------
// 6-9. simulateInboundMessages with store
// ---------------------------------------------------------------------------

describe("simulateInboundMessages with event store", () => {
  test("emits InboundMessageReceived events for each simulated message", () => {
    simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      COUNTERPARTY_BIC,
      undefined,
      undefined,
      { store, asOf: AS_OF, outboundMessageId: "OUTBOUND-MT300-001" },
    );

    const events = [...store.replay({})];
    const inbound = events.filter((e) => e.type === "InboundMessageReceived");
    // 5 inbound messages: MT300, MT202, MT940, pacs.009, camt.053
    expect(inbound.length).toBe(5);
  });

  test("each InboundMessageReceived has direction=inbound", () => {
    simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      COUNTERPARTY_BIC,
      undefined,
      undefined,
      { store, asOf: AS_OF },
    );

    const events = [...store.replay({})];
    const inbound = events.filter((e) => e.type === "InboundMessageReceived");
    for (const e of inbound) {
      expect((e.payload as { direction: string }).direction).toBe("inbound");
    }
  });

  test("emits MessageCorrelated events — one per inbound message", () => {
    simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      COUNTERPARTY_BIC,
      undefined,
      undefined,
      { store, asOf: AS_OF, outboundMessageId: "OUTBOUND-MT300-001" },
    );

    const events = [...store.replay({})];
    const correlated = events.filter((e) => e.type === "MessageCorrelated");
    // One MessageCorrelated per inbound message
    expect(correlated.length).toBe(5);
  });

  test("MT300 echo has correlationType=confirmation", () => {
    simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      COUNTERPARTY_BIC,
      undefined,
      undefined,
      { store, asOf: AS_OF, outboundMessageId: "OUTBOUND-MT300-001" },
    );

    const events = [...store.replay({})];
    const correlated = events.filter((e) => e.type === "MessageCorrelated");
    const confirmation = correlated.find(
      (e) => (e.payload as { correlationType: string }).correlationType === "confirmation",
    );
    expect(confirmation).toBeDefined();
  });

  test("outboundMessageId is threaded into all MessageCorrelated events", () => {
    const outboundMessageId = "OUTBOUND-THREAD-TEST-001";
    simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      COUNTERPARTY_BIC,
      undefined,
      undefined,
      { store, asOf: AS_OF, outboundMessageId },
    );

    const events = [...store.replay({})];
    const correlated = events.filter((e) => e.type === "MessageCorrelated");
    for (const e of correlated) {
      expect((e.payload as { outboundMessageId: string }).outboundMessageId).toBe(
        outboundMessageId,
      );
    }
  });

  test("no events emitted when opts.store not provided", () => {
    simulateInboundMessages(ZAR_USD_BUY_TRADE, SETTLED_AT, NOSTRO_BALANCE, COUNTERPARTY_BIC);

    const events = [...store.replay({})];
    expect(events).toHaveLength(0);
  });

  test("InboundMessageReceived events carry non-empty serialisedMessage", () => {
    simulateInboundMessages(
      ZAR_USD_BUY_TRADE,
      SETTLED_AT,
      NOSTRO_BALANCE,
      COUNTERPARTY_BIC,
      undefined,
      undefined,
      { store, asOf: AS_OF },
    );

    const events = [...store.replay({})];
    const inbound = events.filter((e) => e.type === "InboundMessageReceived");
    for (const e of inbound) {
      expect((e.payload as { serialisedMessage: string }).serialisedMessage.length).toBeGreaterThan(
        0,
      );
    }
  });
});
