// simulators/dtcc-safe-api.ts
//
// DTCC SAFE UTI API adapter — concrete implementation of the `SafeApiAdapter`
// seam declared in platform/odp/uti-allocator.ts.
//
// WHAT THIS WIRES:
//   The build-phase UTI allocation uses the deterministic SHA-256 path
//   (HOZ_BANK_LEI + "|" + tradeId — see computeSha256Uti). That path needs no
//   external dependency and is the default. This module provides the SECOND
//   path: a UTI issued by the DTCC SAFE (Service Bureau / trade-repository)
//   UTI-generation API. When the allocator is invoked with `preferSafe: true`
//   and a `DtccSafeApiAdapter` instance, the UTI comes from DTCC instead of
//   the local SHA-256 computation, and `utiSource` is recorded as
//   "dtcc-safe-api".
//
// INJECTABLE HTTP CLIENT (no live calls in tests — Principle 3):
//   The adapter never calls `fetch` directly. It depends on the
//   `SafeApiHttpClient` interface, injected at construction. Tests pass a stub
//   client that returns canned responses; production passes
//   `createFetchSafeApiHttpClient()` which wraps the platform `fetch`. The
//   adapter's behaviour and the emitted `TradeUtiAllocated` event are identical
//   across stub and live clients — only the transport differs. At M8 (cloud
//   migration) the live client gains mutual-TLS + Key-Vault-sourced credentials
//   without touching this adapter or the allocator seam.
//
// EVENTS-FIRST (Principle 1):
//   `allocateAndEmit()` requests the UTI from DTCC and then appends a
//   `TradeUtiAllocated{ utiSource: "dtcc-safe-api" }` event to the shared
//   event store. The event is the canonical record of the allocation; the
//   returned value is a convenience render.
//
// SECURITY (Principle 4):
//   No bearer token or secret ever appears in an event payload or in any
//   thrown error message. The token is read from the injected config at call
//   time and placed only in the outbound HTTP `Authorization` header. Events
//   carry the opaque `authTokenRef` (a non-secret correlation handle) only.
//
// WALL-CLOCK RATCHET COMPLIANCE:
//   This module does NOT call `new Date()` or `Date.now()`. The caller injects
//   `asOf` (the event timestamp). The default fetch client also takes no clock.
//
// PLACEHOLDER LEI:
//   The build-phase bank LEI is HOZBANK0000000000001 (see HOZ_BANK_LEI). A real
//   GLEIF-issued LEI is substituted at licence application; the adapter passes
//   whatever LEI it is given straight through to DTCC as the UTI-generating
//   party identifier.
//
// Authority:
//   ORG-ODP-RPT-003 (ODP trade reporting — UTI obligation)
//   urn:regulation:odp:jn-2-2024 §§ 3–5 (UTI allocation rules; SAFE-API path)
//   ISO 23602:2020 §4.2 (UTI structure; max 52 chars; LEI prefix)
//   Principle 1 — events-are-truth
//   Principle 3 — cloud-native (injectable transport; stable build→live seam)
//   Principle 4 — security designed in (no secret in events/logs)
//
// Author: Devon (COO, operations)

import { newEventId } from "../platform/core/types";
import {
  type OdpReportableProductType,
  type UmojaMoneyAmount,
  makeTradeUtiAllocated,
} from "../platform/event-store/event-types/odp-umoja-uti";
import type { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import type { SafeApiAdapter } from "../platform/odp/uti-allocator";

// ---------------------------------------------------------------------------
// Injectable HTTP transport
// ---------------------------------------------------------------------------

/**
 * A minimal HTTP request envelope passed to the injected client.
 * The adapter serialises the body to JSON and sets the headers; the client is
 * responsible only for performing the transport and returning the raw response.
 */
export interface SafeApiHttpRequest {
  readonly method: "POST";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  /** JSON-serialised request body. */
  readonly body: string;
}

/**
 * The raw HTTP response returned by the injected client.
 */
export interface SafeApiHttpResponse {
  readonly status: number;
  /** Raw response body (expected to be JSON for the SAFE UTI endpoint). */
  readonly body: string;
}

/**
 * Injectable HTTP client. Production wraps `fetch`; tests pass a stub so no
 * live network call is ever made in the test suite (Principle 3).
 */
export interface SafeApiHttpClient {
  send(req: SafeApiHttpRequest): Promise<SafeApiHttpResponse>;
}

/**
 * Production HTTP client backed by the platform `fetch`.
 *
 * NOT used in tests — tests inject a stub `SafeApiHttpClient`. This factory is
 * the seam where M8 mutual-TLS / Key-Vault credential sourcing lands.
 */
export function createFetchSafeApiHttpClient(): SafeApiHttpClient {
  return {
    async send(req: SafeApiHttpRequest): Promise<SafeApiHttpResponse> {
      const res = await fetch(req.url, {
        method: req.method,
        headers: { ...req.headers },
        body: req.body,
      });
      return { status: res.status, body: await res.text() };
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter configuration
// ---------------------------------------------------------------------------

/**
 * Default DTCC SAFE UTI-generation endpoint (build-phase placeholder host).
 * Overridable via `DtccSafeApiConfig.baseUrl`. The real endpoint + tenant path
 * are provisioned with the DTCC GTR onboarding pack at licence application.
 */
export const DEFAULT_DTCC_SAFE_UTI_ENDPOINT = "https://safe.dtcc.com/uti/v1/generate";

export interface DtccSafeApiConfig {
  /** Injected transport. Required — there is no implicit default (Principle 3). */
  readonly httpClient: SafeApiHttpClient;

  /**
   * The DTCC SAFE UTI-generation endpoint.
   * @default DEFAULT_DTCC_SAFE_UTI_ENDPOINT
   */
  readonly baseUrl?: string;

  /**
   * Bearer token for the DTCC SAFE API. SECRET — placed ONLY in the outbound
   * `Authorization` header; never stored in an event or included in an error.
   * Absent in tests (the stub client ignores headers).
   */
  readonly bearerToken?: string;

  /**
   * Opaque, non-secret reference to the credential (e.g. a Key Vault secret
   * name). This — not the token itself — is the value recorded for audit
   * correlation. Per Principle 4.
   * @default "dtcc-safe-api:simulator"
   */
  readonly authTokenRef?: string;

  /**
   * Disambiguates a stubbed/simulator transport from a live DTCC call in the
   * audit trail. Does not change behaviour.
   * @default "simulator"
   */
  readonly mode?: "simulator" | "live";
}

/**
 * Thrown when the DTCC SAFE API call fails or returns a UTI that does not
 * conform to ISO 23602. Never carries the bearer token (Principle 4).
 */
export class DtccSafeApiError extends Error {
  constructor(
    message: string,
    readonly detail?: { status?: number; tradeId?: string },
  ) {
    super(message);
    this.name = "DtccSafeApiError";
  }
}

// ---------------------------------------------------------------------------
// ISO 23602 UTI conformance
// ---------------------------------------------------------------------------

/** ISO 23602 §4.2: 20-char LEI prefix + 1–32 alphanumeric suffix; ≤ 52 total. */
const UTI_RX = /^[A-Z0-9]{21,52}$/;

/** ISO 17442 LEI: exactly 20 uppercase alphanumerics. */
const LEI_RX = /^[A-Z0-9]{20}$/;

/**
 * The DTCC SAFE UTI-generation response envelope (the subset the adapter reads).
 * The live API returns additional metadata; only `uti` is load-bearing here.
 */
interface SafeApiUtiResponse {
  uti?: unknown;
  status?: unknown;
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

/**
 * Full context required to emit a `TradeUtiAllocated` event for a SAFE-issued
 * UTI. The bare `SafeApiAdapter.requestUti(tradeId, bankLei)` seam carries only
 * what the API needs; emitting the event requires the additional reportable
 * fields, which the caller supplies here.
 */
export interface SafeUtiAllocationContext {
  /** Internal trade identifier. */
  readonly tradeId: string;
  /** ISO 8601 trade date (YYYY-MM-DD). */
  readonly tradeDate: string;
  /** OTC derivative product type. */
  readonly productType: OdpReportableProductType;
  /** Party-register URN of the counterparty (`party:<scheme>:<id>`). */
  readonly counterpartyId: string;
  /** Whether the bank is the UTI-generating party (JN 2/2024 §4(a)). */
  readonly bankIsUtiGenerator: boolean;
  /** Optional reporting-currency notional (minor units, ISO 4217-tagged). */
  readonly reportingNotional?: UmojaMoneyAmount;

  /** Legal entity identifier for the event (e.g. "LE-ZA-HOZ-BANK"). */
  readonly entity: string;
  /** ISO 8601 event timestamp (injected — wall-clock ratchet compliance). */
  readonly asOf: string;
  /**
   * Bank LEI (ISO 17442). Passed to DTCC as the generating-party identifier
   * and recorded on the event for audit verification.
   * @default HOZ_BANK_LEI (the caller may override at licence application)
   */
  readonly bankLei: string;
  /** Optional actor override; defaults to the SAFE-API service actor. */
  readonly actor?: Actor;
}

/** Result of `allocateAndEmit`. */
export interface SafeUtiAllocationResult {
  readonly uti: string;
  readonly utiSource: "dtcc-safe-api";
  readonly eventId: string;
}

const SAFE_API_ACTOR: Actor = { type: "service", id: "dtcc-safe-api-adapter" };
const CITATIONS = ["ORG-ODP-RPT-003", "urn:regulation:odp:jn-2-2024"];

/**
 * DTCC SAFE API adapter.
 *
 * Implements `SafeApiAdapter` so it can be injected straight into
 * `allocateUti(tradeId, { preferSafe: true, safeApiAdapter })`. The richer
 * `allocateAndEmit()` performs the request AND records the canonical
 * `TradeUtiAllocated` event.
 */
export class DtccSafeApiAdapter implements SafeApiAdapter {
  private readonly httpClient: SafeApiHttpClient;
  private readonly baseUrl: string;
  private readonly bearerToken: string | undefined;
  private readonly authTokenRef: string;
  private readonly mode: "simulator" | "live";

  constructor(config: DtccSafeApiConfig) {
    this.httpClient = config.httpClient;
    this.baseUrl = config.baseUrl ?? DEFAULT_DTCC_SAFE_UTI_ENDPOINT;
    this.bearerToken = config.bearerToken;
    this.authTokenRef = config.authTokenRef ?? "dtcc-safe-api:simulator";
    this.mode = config.mode ?? "simulator";
  }

  /**
   * `SafeApiAdapter` seam — request a UTI from the DTCC SAFE API.
   *
   * Performs the HTTP call via the injected client, validates the returned
   * UTI against ISO 23602, and returns it. Throws `DtccSafeApiError` on a
   * non-2xx response, an unparseable body, a missing UTI, or a UTI that fails
   * the ISO 23602 / LEI-prefix conformance check.
   *
   * No event is emitted here — `requestUti` is the pure transport seam used by
   * `allocateUti()`. Use `allocateAndEmit()` to also record the event.
   */
  async requestUti(tradeId: string, bankLei: string): Promise<string> {
    if (!tradeId || tradeId.trim() === "") {
      throw new DtccSafeApiError("tradeId must be a non-empty string.", { tradeId });
    }
    if (!LEI_RX.test(bankLei)) {
      throw new DtccSafeApiError(
        `bankLei must be a valid 20-character ISO 17442 LEI. Got '${bankLei}'.`,
        { tradeId },
      );
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (this.bearerToken) {
      headers.authorization = `Bearer ${this.bearerToken}`;
    }

    const requestBody = JSON.stringify({
      // DTCC SAFE UTI-generation request envelope. The generating-party LEI
      // becomes the UTI namespace prefix per ISO 23602 §4.2.
      generatingPartyLei: bankLei,
      tradeReference: tradeId,
      namespace: "SAFE",
    });

    let response: SafeApiHttpResponse;
    try {
      response = await this.httpClient.send({
        method: "POST",
        url: this.baseUrl,
        headers,
        body: requestBody,
      });
    } catch {
      // Re-wrap transport failures WITHOUT leaking the bearer token.
      throw new DtccSafeApiError(`DTCC SAFE API transport error for trade '${tradeId}'.`, {
        tradeId,
      });
    }

    if (response.status < 200 || response.status >= 300) {
      throw new DtccSafeApiError(
        `DTCC SAFE API returned HTTP ${response.status} for trade '${tradeId}'.`,
        { status: response.status, tradeId },
      );
    }

    let parsed: SafeApiUtiResponse;
    try {
      parsed = JSON.parse(response.body) as SafeApiUtiResponse;
    } catch {
      throw new DtccSafeApiError(
        `DTCC SAFE API returned an unparseable (non-JSON) body for trade '${tradeId}'.`,
        { status: response.status, tradeId },
      );
    }

    const uti = parsed.uti;
    if (typeof uti !== "string" || uti.length === 0) {
      throw new DtccSafeApiError(
        `DTCC SAFE API response did not contain a UTI for trade '${tradeId}'.`,
        { status: response.status, tradeId },
      );
    }
    if (uti.length > 52 || !UTI_RX.test(uti)) {
      throw new DtccSafeApiError(
        `DTCC SAFE API returned a UTI that is not ISO 23602-conformant for trade '${tradeId}': '${uti}'.`,
        { status: response.status, tradeId },
      );
    }
    if (!uti.startsWith(bankLei)) {
      throw new DtccSafeApiError(
        `DTCC SAFE API returned a UTI not prefixed with the generating-party LEI for trade '${tradeId}'.`,
        { status: response.status, tradeId },
      );
    }

    return uti;
  }

  /**
   * Request a UTI from DTCC SAFE and emit the canonical `TradeUtiAllocated`
   * event with `utiSource: "dtcc-safe-api"` (Principle 1).
   *
   * @param ctx   — full reportable-trade context (the API needs only tradeId +
   *                bankLei; the event needs the remaining reportable fields)
   * @param store — the shared event store the event is appended to
   * @returns the allocated UTI + the emitted event-ID
   */
  async allocateAndEmit(
    ctx: SafeUtiAllocationContext,
    store: EventStore,
  ): Promise<SafeUtiAllocationResult> {
    const uti = await this.requestUti(ctx.tradeId, ctx.bankLei);

    const eventId = newEventId();
    const event = makeTradeUtiAllocated({
      asOf: ctx.asOf,
      entity: ctx.entity,
      actor: ctx.actor ?? SAFE_API_ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: ctx.tradeId,
        uti,
        utiSource: "dtcc-safe-api",
        tradeDate: ctx.tradeDate,
        productType: ctx.productType,
        counterpartyId: ctx.counterpartyId,
        bankLei: ctx.bankLei,
        bankIsUtiGenerator: ctx.bankIsUtiGenerator,
        ...(ctx.reportingNotional ? { reportingNotional: ctx.reportingNotional } : {}),
      },
      eventId,
    });

    store.append(event);

    return { uti, utiSource: "dtcc-safe-api", eventId };
  }

  /**
   * The opaque (non-secret) credential reference for audit correlation.
   * Exposed so callers can record it alongside higher-level workflow events
   * without ever touching the bearer token.
   */
  get credentialRef(): string {
    return this.authTokenRef;
  }

  /** Whether this adapter is wired to a simulator or a live transport. */
  get transportMode(): "simulator" | "live" {
    return this.mode;
  }
}
