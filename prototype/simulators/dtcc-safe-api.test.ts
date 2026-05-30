// simulators/dtcc-safe-api.test.ts
//
// Tests for the DTCC SAFE UTI API adapter. The HTTP transport is stubbed —
// NO live network call is made (Principle 3). Covers:
//   - requestUti happy path (UTI returned + ISO 23602 conformance)
//   - request envelope shape (LEI as generating party; trade reference)
//   - bearer token placed in header only, never in events/errors (Principle 4)
//   - allocateAndEmit emits TradeUtiAllocated{ utiSource: "dtcc-safe-api" }
//   - failure modes: non-2xx, non-JSON, missing UTI, non-conformant UTI,
//     wrong LEI prefix, transport throw, bad LEI / empty tradeId
//
// Authority: ORG-ODP-RPT-003; urn:regulation:odp:jn-2-2024; ISO 23602:2020.
// Author: Devon (COO, operations)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { HOZ_BANK_LEI, allocateUti } from "../platform/odp/uti-allocator";
import {
  DEFAULT_DTCC_SAFE_UTI_ENDPOINT,
  DtccSafeApiAdapter,
  DtccSafeApiError,
  type SafeApiHttpClient,
  type SafeApiHttpRequest,
  type SafeApiHttpResponse,
  type SafeUtiAllocationContext,
} from "./dtcc-safe-api";

// ---------------------------------------------------------------------------
// Stub HTTP client — records the request, returns a scripted response.
// ---------------------------------------------------------------------------

interface CapturedRequest {
  req: SafeApiHttpRequest;
}

/** Index helper that narrows away `T | undefined` without a non-null assertion. */
function first<T>(arr: readonly T[]): T {
  const v = arr[0];
  if (v === undefined) {
    throw new Error("expected at least one element, got none");
  }
  return v;
}

function stubClient(
  responder: (req: SafeApiHttpRequest) => SafeApiHttpResponse | Promise<SafeApiHttpResponse>,
): { client: SafeApiHttpClient; captured: CapturedRequest[] } {
  const captured: CapturedRequest[] = [];
  const client: SafeApiHttpClient = {
    async send(req) {
      captured.push({ req });
      return responder(req);
    },
  };
  return { client, captured };
}

const SAFE_UTI = `${HOZ_BANK_LEI}SAFE0000000000000000000000AB`; // 52 chars, LEI-prefixed
const TRADE_ID = "TRADE-FX-001";

function okResponse(uti: string = SAFE_UTI): SafeApiHttpResponse {
  return { status: 200, body: JSON.stringify({ uti, status: "GENERATED" }) };
}

function baseContext(over: Partial<SafeUtiAllocationContext> = {}): SafeUtiAllocationContext {
  return {
    tradeId: TRADE_ID,
    tradeDate: "2026-05-30",
    productType: "fx-forward",
    counterpartyId: "party:lei:5493001KJTIIGC8Y1R12",
    bankIsUtiGenerator: true,
    entity: "LE-ZA-HOZ-BANK",
    asOf: "2026-05-30T09:00:00.000Z",
    bankLei: HOZ_BANK_LEI,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// requestUti — happy path + request shape
// ---------------------------------------------------------------------------

describe("DtccSafeApiAdapter.requestUti", () => {
  it("returns the SAFE-issued UTI on a 200 response", async () => {
    const { client } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    const uti = await adapter.requestUti(TRADE_ID, HOZ_BANK_LEI);
    expect(uti).toBe(SAFE_UTI);
    expect(uti.length).toBeLessThanOrEqual(52);
  });

  it("POSTs the generating-party LEI + trade reference to the default endpoint", async () => {
    const { client, captured } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await adapter.requestUti(TRADE_ID, HOZ_BANK_LEI);

    expect(captured).toHaveLength(1);
    const req = first(captured).req;
    expect(req.method).toBe("POST");
    expect(req.url).toBe(DEFAULT_DTCC_SAFE_UTI_ENDPOINT);
    const body = JSON.parse(req.body);
    expect(body.generatingPartyLei).toBe(HOZ_BANK_LEI);
    expect(body.tradeReference).toBe(TRADE_ID);
    expect(body.namespace).toBe("SAFE");
  });

  it("uses an overridden baseUrl when provided", async () => {
    const { client, captured } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({
      httpClient: client,
      baseUrl: "https://sandbox.dtcc.test/uti",
    });
    await adapter.requestUti(TRADE_ID, HOZ_BANK_LEI);
    expect(first(captured).req.url).toBe("https://sandbox.dtcc.test/uti");
  });

  it("places the bearer token in the Authorization header only — never in events or errors", async () => {
    const SECRET = "super-secret-bearer-token-xyz";
    const { client, captured } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client, bearerToken: SECRET });
    const store = new EventStore(":memory:");

    await adapter.allocateAndEmit(baseContext(), store);

    // Header carries the secret...
    expect(first(captured).req.headers.authorization).toBe(`Bearer ${SECRET}`);

    // ...but no event payload anywhere contains it.
    const events = [...store.replay()];
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain(SECRET);
  });

  it("omits the Authorization header when no bearer token is configured", async () => {
    const { client, captured } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await adapter.requestUti(TRADE_ID, HOZ_BANK_LEI);
    expect(first(captured).req.headers.authorization).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// requestUti — input validation + failure modes
// ---------------------------------------------------------------------------

describe("DtccSafeApiAdapter.requestUti failure modes", () => {
  it("rejects an empty tradeId without calling the transport", async () => {
    const { client, captured } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await expect(adapter.requestUti("  ", HOZ_BANK_LEI)).rejects.toBeInstanceOf(DtccSafeApiError);
    expect(captured).toHaveLength(0);
  });

  it("rejects a malformed LEI without calling the transport", async () => {
    const { client, captured } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await expect(adapter.requestUti(TRADE_ID, "TOO-SHORT")).rejects.toBeInstanceOf(
      DtccSafeApiError,
    );
    expect(captured).toHaveLength(0);
  });

  it("throws on a non-2xx response", async () => {
    const { client } = stubClient(() => ({ status: 503, body: "service unavailable" }));
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await expect(adapter.requestUti(TRADE_ID, HOZ_BANK_LEI)).rejects.toThrow(/HTTP 503/);
  });

  it("throws on an unparseable (non-JSON) body", async () => {
    const { client } = stubClient(() => ({ status: 200, body: "<html>not json</html>" }));
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await expect(adapter.requestUti(TRADE_ID, HOZ_BANK_LEI)).rejects.toThrow(/unparseable/);
  });

  it("throws when the response contains no UTI", async () => {
    const { client } = stubClient(() => ({ status: 200, body: JSON.stringify({ status: "OK" }) }));
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await expect(adapter.requestUti(TRADE_ID, HOZ_BANK_LEI)).rejects.toThrow(
      /did not contain a UTI/,
    );
  });

  it("throws when the UTI exceeds the ISO 23602 length limit", async () => {
    const tooLong = `${HOZ_BANK_LEI}${"A".repeat(40)}`; // 60 chars
    const { client } = stubClient(() => okResponse(tooLong));
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await expect(adapter.requestUti(TRADE_ID, HOZ_BANK_LEI)).rejects.toThrow(/not ISO 23602/);
  });

  it("throws when the UTI is not prefixed with the generating-party LEI", async () => {
    const wrongPrefix = `OTHERLEI000000000001${"A".repeat(20)}`;
    const { client } = stubClient(() => okResponse(wrongPrefix));
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    await expect(adapter.requestUti(TRADE_ID, HOZ_BANK_LEI)).rejects.toThrow(/not prefixed/);
  });

  it("wraps a transport throw without leaking the bearer token", async () => {
    const SECRET = "leaky-token-should-not-appear";
    const client: SafeApiHttpClient = {
      async send() {
        throw new Error(`connection refused (token=${SECRET})`);
      },
    };
    const adapter = new DtccSafeApiAdapter({ httpClient: client, bearerToken: SECRET });
    try {
      await adapter.requestUti(TRADE_ID, HOZ_BANK_LEI);
      throw new Error("expected requestUti to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DtccSafeApiError);
      expect((err as Error).message).not.toContain(SECRET);
    }
  });
});

// ---------------------------------------------------------------------------
// allocateAndEmit — event emission (Principle 1)
// ---------------------------------------------------------------------------

describe("DtccSafeApiAdapter.allocateAndEmit", () => {
  it("emits a TradeUtiAllocated event with utiSource='dtcc-safe-api'", async () => {
    const { client } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    const store = new EventStore(":memory:");

    const result = await adapter.allocateAndEmit(baseContext(), store);

    expect(result.uti).toBe(SAFE_UTI);
    expect(result.utiSource).toBe("dtcc-safe-api");

    const events = [...store.replay({ type: "TradeUtiAllocated" })];
    expect(events).toHaveLength(1);
    const ev = first(events);
    expect(ev.event_id).toBe(result.eventId);
    expect(ev.payload.utiSource).toBe("dtcc-safe-api");
    expect(ev.payload.uti).toBe(SAFE_UTI);
    expect(ev.payload.tradeId).toBe(TRADE_ID);
    expect(ev.payload.bankLei).toBe(HOZ_BANK_LEI);
    expect(ev.payload.productType).toBe("fx-forward");
    expect(ev.citations).toContain("ORG-ODP-RPT-003");
    expect(ev.citations).toContain("urn:regulation:odp:jn-2-2024");
  });

  it("carries the optional reportingNotional onto the event when supplied", async () => {
    const { client } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    const store = new EventStore(":memory:");

    await adapter.allocateAndEmit(
      baseContext({ reportingNotional: { currency: "ZAR", amountMinor: 1_000_000_00 } }),
      store,
    );

    const ev = first([...store.replay({ type: "TradeUtiAllocated" })]);
    expect(ev.payload.reportingNotional).toEqual({ currency: "ZAR", amountMinor: 1_000_000_00 });
  });

  it("does NOT emit an event when the SAFE API call fails", async () => {
    const { client } = stubClient(() => ({ status: 500, body: "boom" }));
    const adapter = new DtccSafeApiAdapter({ httpClient: client });
    const store = new EventStore(":memory:");

    await expect(adapter.allocateAndEmit(baseContext(), store)).rejects.toBeInstanceOf(
      DtccSafeApiError,
    );
    expect([...store.replay({ type: "TradeUtiAllocated" })]).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration with the allocateUti() seam
// ---------------------------------------------------------------------------

describe("allocateUti() with the DTCC SAFE adapter injected", () => {
  it("routes through the adapter and reports utiSource='dtcc-safe-api'", async () => {
    const { client, captured } = stubClient(() => okResponse());
    const adapter = new DtccSafeApiAdapter({ httpClient: client });

    const result = await allocateUti(TRADE_ID, { preferSafe: true, safeApiAdapter: adapter });

    expect(result.uti).toBe(SAFE_UTI);
    expect(result.utiSource).toBe("dtcc-safe-api");
    expect(captured).toHaveLength(1); // the adapter was actually called
  });

  it("falls back to SHA-256 when preferSafe is set but no adapter is supplied", async () => {
    const result = await allocateUti(TRADE_ID, { preferSafe: true });
    expect(result.utiSource).toBe("sha256-lei-prefixed");
  });
});
