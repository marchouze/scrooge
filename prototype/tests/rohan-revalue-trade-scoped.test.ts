// tests/rohan-revalue-trade-scoped.test.ts
//
// Tests for `revalueTradeScoped` — the inline, single-trade revaluation that
// fires at booking time (D-FX-MTM-REVAL-ON-BOOKING, CEO session-delegation
// 2026-06-02). It marks a freshly-booked FX position immediately so it is not
// reported as "no mark" on the product-control dashboard until the next
// scheduled daily MTM run.
//
// Cases:
//   TC-1: a production tick exists → exactly one FxPositionRevalued is emitted
//         for the trade, and NO MtmRunCompleted / Owner-Inbox machinery fires.
//   TC-2: no usable mark → a trade-scoped SubstrateAlert is emitted and NO
//         FxPositionRevalued for that trade (no silent zero).
//
// The function operates on the composition-root `eventStore` singleton (which
// the test preload redirects to a per-process temp DB) and opens a
// MarketDataStore from BANK_MARKET_DATA_DB, set per-test to a fresh temp file.
//
// Authority: D-FX-MTM-REVAL-ON-BOOKING; D-MARKETS-SCHEMA-FOUNDATION; IFRS-9-§5.7.1.
// Author: Rohan (Market risk engineer, engineering).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { MarketDataStore } from "../platform/market-data/store";
import { type FxTradeExecutedPayload, makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import { revalueTradeScoped } from "../runtime/agents/rohan-daily-mtm";

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["IAS-21-§28", "D-FX-QUOTING-CONVENTION"];
const ACTOR = { id: "agent:rohan:test", type: "service" as const };
const AS_OF = "2026-06-02T08:00:00.000Z";

/** A live USD/ZAR buy trade payload (far-future settlement → stays open). */
function tradePayload(tradeId: string): FxTradeExecutedPayload {
  const evt = makeFxTradeExecuted({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: { scheme: "INTERNAL", value: tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      bookType: "trading",
      venue: "OTC",
      trader: "rohan@bank.local",
      tradeDate: { iso: AS_OF.slice(0, 10), calendar: "JIHCAL" },
      settlementPath: "correspondent",
      settlementForm: "physical",
      counterparty: {
        partyId: "CP-TEST-001",
        name: "Test Counterparty",
        role: "counterparty",
        jurisdiction: "ZA",
      },
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: 1_850_000_000 },
          counterNotional: { currency: "USD", amountMinor: 100_000_000 },
          rate: { amount: 18.5, currency: "ZAR" },
          settlementDate: { iso: "2026-12-31", calendar: "JIHCAL" },
        },
      ],
      bookId: "FX-SPOT-BOOK",
      clientFlowRef: `client-trade:rts-${tradeId}`,
    },
  });
  return evt.payload as FxTradeExecutedPayload;
}

/** Fresh temp MarketDataStore file; sets BANK_MARKET_DATA_DB to it. */
function freshMarketDb(): MarketDataStore {
  const dir = mkdtempSync(join(tmpdir(), "bank-test-marketdb-"));
  const path = join(dir, "market-data.db");
  process.env.BANK_MARKET_DATA_DB = path;
  return new MarketDataStore(path);
}

function revaluedFor(tradeId: string) {
  return [...eventStore.replay({ type: "FxPositionRevalued" })].filter(
    (e) => (e.payload as { tradeId?: string }).tradeId === tradeId,
  );
}

describe("revalueTradeScoped", () => {
  it("TC-1: marks the position inline and emits no MtmRunCompleted", async () => {
    const md = freshMarketDb();
    md.append({
      id: "twelve-data-USD/ZAR-2026-06-02",
      source: "twelve-data",
      instrument: "USD/ZAR",
      dataType: "fx-quote",
      provenance: "production",
      asOf: "2026-06-02T07:00:00.000Z",
      payload: { mid: 18.6 },
    });

    const tradeId = "RTS-MARK-001";
    await revalueTradeScoped(tradePayload(tradeId), AS_OF);

    const revals = revaluedFor(tradeId);
    expect(revals.length).toBe(1);
    const reval = revals[0];
    expect(reval).toBeDefined();
    expect((reval?.payload as { rateSource: string }).rateSource).toBe("twelve-data");

    // The scoped path must NOT fire the whole-portfolio run-boundary event.
    const runs = [...eventStore.replay({ type: "MtmRunCompleted" })];
    expect(runs.length).toBe(0);
  });

  it("TC-2: no usable mark → SubstrateAlert, no FxPositionRevalued", async () => {
    // Fresh (empty) market db — no tick for the pair.
    freshMarketDb();

    const tradeId = "RTS-NOMARK-002";
    await revalueTradeScoped(tradePayload(tradeId), AS_OF);

    expect(revaluedFor(tradeId).length).toBe(0);

    const alerts = [...eventStore.replay({ type: "SubstrateAlert" })].filter((e) =>
      String((e.payload as { alertId?: string }).alertId ?? "").startsWith(
        "alert:integrity:mtm-no-mark-",
      ),
    );
    const mine = alerts.find((e) =>
      String((e.payload as { details?: string }).details ?? "").includes(tradeId),
    );
    expect(mine).toBeDefined();
    expect((mine?.payload as { severity?: string }).severity).toBe("high");
  });
});
