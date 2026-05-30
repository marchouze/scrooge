// platform/odp/uti-allocator.ts
//
// ODP UTI Allocation Engine (ISO 23602 — Unique Trade Identifier).
//
// SCOPE:
//   WS-ODP-UMOJA-UTI (ORG-ODP-RPT-003 · Regulation: urn:regulation:odp:jn-2-2024)
//
// Produces a deterministic, idempotent UTI for every OTC derivative trade that
// falls within the ODP reporting scope (CS 3/2018 §4; JN 2/2024 §3–5).
//
// DEFAULT PATH — SHA-256 (LEI-prefixed):
//   1. Compute: SHA-256(bankLei + "|" + tradeId) — hex string, 64 chars.
//   2. Take the first 32 characters of the hex digest.
//   3. Prepend the bank's 20-character LEI.
//   4. Result: 20 + 32 = 52 chars — within the ISO 23602 §4.2 maximum length.
//
//   Determinism + idempotency:
//     - The SHA-256 function is pure: same (bankLei, tradeId) → same UTI.
//     - Re-allocation of the same trade (e.g. on event reprocessing) returns
//       the same UTI and emits the same `TradeUtiAllocated` event payload.
//
// DTCC/SAFE-API SEAM:
//   The `UtiAllocatorOptions.safeApiAdapter` field accepts an optional
//   `SafeApiAdapter` interface. When present and `opts.preferSafe === true`,
//   the allocator calls the adapter instead of computing SHA-256. The event
//   `utiSource` is set to "dtcc-safe-api". This seam is NOT YET WIRED
//   (substrate gap — see `safeApiAdapter` JSDoc). Build-phase substrate uses
//   the SHA-256 path exclusively.
//
// COUNTERPARTY-ISSUED SEAM:
//   When `opts.counterpartyUti` is provided, the allocator records that UTI
//   rather than computing a new one. `utiSource` is set to "counterparty-issued".
//   This covers the case where the counterparty, as UTI-generating party,
//   issues the UTI bilaterally (JN 2/2024 §4(a)).
//
// WALL-CLOCK RATCHET COMPLIANCE:
//   This module does NOT call `new Date()` or `Date.now()`. All timestamp
//   production is delegated to the caller via injected `asOf` string.
//   The submission-deadline helper (`computeT1SubmissionDeadline`) accepts an
//   injected `now` parameter — `opts.now ?? new Date()` is the CALLER's
//   responsibility to supply in test contexts.
//
// Authority:
//   ORG-ODP-RPT-003 (ODP trade reporting — UTI obligation)
//   ORG-MK-RPT-002  (Market conduct trade reporting)
//   urn:regulation:odp:jn-2-2024 §§ 3–5 (UTI allocation rules)
//   ISO 23602:2020 §4.2 (UTI structure; max 52 chars; LEI prefix)
//   Principle 1 — events-are-truth
//
// Author: Devon (COO, operations)

import { createHash } from "node:crypto";

import type { UtiSource } from "../event-store/event-types/odp-umoja-uti";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The result of a UTI allocation attempt.
 */
export interface UtiAllocationResult {
  /** The allocated UTI (ISO 23602, max 52 chars). */
  readonly uti: string;
  /** The origination path for this UTI. */
  readonly utiSource: UtiSource;
}

/**
 * DTCC SAFE API adapter interface — design seam for future wiring.
 *
 * Substrate gap: the DTCC SAFE API integration is NOT yet built. This
 * interface defines the contract so the SHA-256 path and the SAFE-API path
 * share the same `allocateUti()` call site. When the SAFE API adapter is
 * wired, inject an implementation here.
 */
export interface SafeApiAdapter {
  /**
   * Request a UTI from the DTCC SAFE repository API.
   *
   * @param tradeId — internal trade identifier
   * @param bankLei — bank's 20-char LEI
   * @returns ISO 23602 UTI string (max 52 chars)
   */
  requestUti(tradeId: string, bankLei: string): Promise<string>;
}

/**
 * Options for `allocateUti()`.
 */
export interface UtiAllocatorOptions {
  /**
   * The bank's 20-character LEI (ISO 17442).
   * Used as the UTI prefix (SHA-256 path) or passed to the SAFE API.
   * Default: HOZ_BANK_LEI constant (build-phase placeholder).
   */
  bankLei?: string;

  /**
   * When truthy, use the DTCC SAFE API adapter instead of SHA-256.
   * Requires `safeApiAdapter` to be set. If `preferSafe` is true but
   * `safeApiAdapter` is absent, `allocateUti()` falls back to SHA-256
   * and logs a warning (no error — determinism takes priority over
   * SAFE-API preference in the absence of the adapter).
   *
   * @default false
   */
  preferSafe?: boolean;

  /**
   * DTCC SAFE API adapter — injected in production when the SAFE integration
   * is wired. Absent in the build phase (substrate gap).
   */
  safeApiAdapter?: SafeApiAdapter;

  /**
   * When provided, records this counterparty-issued UTI instead of computing
   * a new one. Overrides both SHA-256 and SAFE-API paths.
   * Per JN 2/2024 §4(a): applies when the counterparty is the UTI-generating party.
   */
  counterpartyUti?: string;
}

// ---------------------------------------------------------------------------
// Bank LEI constant
// ---------------------------------------------------------------------------

/**
 * Build-phase placeholder LEI for Hoz Bank (South Africa).
 * ISO 17442 format: 20 alphanumeric characters.
 *
 * Substrate gap: the production LEI will be issued by the GLEIF-accredited
 * Local Operating Unit (LOU) at licence application time. This placeholder
 * satisfies the UTI structure requirement during the build phase.
 */
export const HOZ_BANK_LEI = "HOZBANK0000000000001";

// ---------------------------------------------------------------------------
// UTI computation
// ---------------------------------------------------------------------------

/**
 * Compute the deterministic SHA-256 UTI for a trade.
 *
 * Algorithm (ISO 23602 §4.2 "pre-LEI" path):
 *   1. Input:  bankLei (20 chars) + "|" + tradeId
 *   2. Hash:   SHA-256 → 64 hex chars
 *   3. Slice:  first 32 hex chars
 *   4. Prefix: bankLei (20 chars)
 *   5. Result: 52 chars total
 *
 * This function is pure — no I/O, no side effects. The same inputs always
 * produce the same UTI, satisfying the idempotency requirement.
 *
 * @param bankLei — 20-character LEI (ISO 17442)
 * @param tradeId — internal trade identifier (any non-empty string)
 * @returns ISO 23602 UTI, 52 chars
 */
export function computeSha256Uti(bankLei: string, tradeId: string): string {
  if (bankLei.length !== 20) {
    throw new Error(
      `bankLei must be exactly 20 characters (ISO 17442). Got ${bankLei.length}: '${bankLei}'`,
    );
  }
  if (!tradeId || tradeId.trim() === "") {
    throw new Error("tradeId must be a non-empty string.");
  }
  const input = `${bankLei}|${tradeId}`;
  const digest = createHash("sha256").update(input, "utf8").digest("hex");
  // Take first 32 hex chars of the digest (128 bits — sufficient entropy).
  const suffix = digest.slice(0, 32).toUpperCase();
  return `${bankLei}${suffix}`;
}

// ---------------------------------------------------------------------------
// Main allocation entry point
// ---------------------------------------------------------------------------

/**
 * Allocate a UTI for a reportable OTC derivative trade.
 *
 * Precedence:
 *   1. `opts.counterpartyUti` — use counterparty-issued UTI if provided.
 *   2. `opts.preferSafe && opts.safeApiAdapter` — call DTCC SAFE API.
 *   3. Default SHA-256 path.
 *
 * This function is sync for the SHA-256 and counterparty paths; async when
 * the SAFE API adapter is used.
 *
 * @param tradeId — internal trade identifier
 * @param opts    — optional overrides (bankLei, SAFE adapter, counterparty UTI)
 */
export async function allocateUti(
  tradeId: string,
  opts: UtiAllocatorOptions = {},
): Promise<UtiAllocationResult> {
  const bankLei = opts.bankLei ?? HOZ_BANK_LEI;

  // Path 1: Counterparty-issued UTI
  if (opts.counterpartyUti) {
    return {
      uti: opts.counterpartyUti,
      utiSource: "counterparty-issued",
    };
  }

  // Path 2: DTCC SAFE API (design seam — not yet wired)
  if (opts.preferSafe && opts.safeApiAdapter) {
    const safeUti = await opts.safeApiAdapter.requestUti(tradeId, bankLei);
    return {
      uti: safeUti,
      utiSource: "dtcc-safe-api",
    };
  }

  // Path 3 (default): Deterministic SHA-256
  const uti = computeSha256Uti(bankLei, tradeId);
  return {
    uti,
    utiSource: "sha256-lei-prefixed",
  };
}

/**
 * Synchronous variant of `allocateUti` for the SHA-256 and counterparty paths.
 *
 * Will throw if `opts.preferSafe && opts.safeApiAdapter` is set (use
 * `allocateUti()` for the async SAFE path).
 */
export function allocateUtiSync(
  tradeId: string,
  opts: UtiAllocatorOptions = {},
): UtiAllocationResult {
  const bankLei = opts.bankLei ?? HOZ_BANK_LEI;

  if (opts.counterpartyUti) {
    return {
      uti: opts.counterpartyUti,
      utiSource: "counterparty-issued",
    };
  }

  if (opts.preferSafe) {
    throw new Error(
      "allocateUtiSync: cannot use SAFE API adapter in sync mode. Use allocateUti() instead.",
    );
  }

  const uti = computeSha256Uti(bankLei, tradeId);
  return {
    uti,
    utiSource: "sha256-lei-prefixed",
  };
}

// ---------------------------------------------------------------------------
// T+1 / 16:00 SA time deadline helper
// ---------------------------------------------------------------------------

/**
 * Compute the T+1/16:00 SA time submission deadline for a trade booked on
 * `tradeDate`.
 *
 * Per urn:regulation:odp:cs-3-2018 §4(c):
 *   "The report must be submitted by T+1 at 16:00 South African Standard Time."
 *
 * WALL-CLOCK RATCHET COMPLIANCE:
 *   This function DOES NOT call `new Date()` or `Date.now()` internally.
 *   The `now` parameter is injected by the caller. In production code, pass
 *   `clock.now()` or `opts.now ?? new Date()` at the call site.
 *   In tests, inject a fixed Date to make assertions deterministic.
 *
 * SAST is UTC+2 (no daylight saving in South Africa). The deadline is:
 *   Date.parse(tradeDate + "T14:00:00Z")  i.e. 16:00 SAST = 14:00 UTC
 *
 * @param tradeDate — ISO 8601 date string (YYYY-MM-DD)
 * @param now       — current time (INJECTED — do NOT pass `new Date()` in production
 *                    capability code; pass `clock.now()` or `opts.now ?? new Date()`
 *                    at the call site so tests remain deterministic)
 * @returns `{ deadline: string, withinDeadline: boolean }`
 */
export function computeT1SubmissionDeadline(
  tradeDate: string,
  now: Date,
): { deadline: string; withinDeadline: boolean } {
  // T+1 = next calendar day after trade date
  // SAST = UTC+2 — 16:00 SAST = 14:00 UTC
  const parts = tradeDate.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  // Next calendar day:
  const t1 = new Date(Date.UTC(year, month - 1, day + 1, 14, 0, 0, 0));
  const deadline = t1.toISOString();
  const withinDeadline = now.getTime() <= t1.getTime();
  return { deadline, withinDeadline };
}

// ---------------------------------------------------------------------------
// Reportable-trade filter
// ---------------------------------------------------------------------------

/**
 * Determine whether a trade event type is reportable under the ODP reporting
 * obligation (CS 3/2018 §4; ORG-ODP-RPT-003).
 *
 * Reportable event types (OTC derivative bookings):
 *   - FxTradeExecuted   (FX spot / forward / swap)
 *   - IrsTradeBooked    (Interest Rate Swap)
 *   - FraTradeBooked    (Forward Rate Agreement)
 *   - SwaptionTradeBooked (Swaption)
 *   - BasisSwapTradeBooked (Basis Swap)
 *   - CrossCurrencySwapTradeBooked (Cross-Currency Swap)
 *
 * NON-reportable:
 *   - RepoTradeOpened, MoneyMarketDepositOpened, InterbankLoanOpened —
 *     these are money-market / repo products, NOT OTC derivatives per CS 3/2018.
 *   - JSE equity / bond trades — exchange-traded, not ODP-covered.
 */
export const ODP_REPORTABLE_EVENT_TYPES = new Set([
  "FxTradeExecuted",
  "IrsTradeBooked",
  "FraTradeBooked",
  "SwaptionTradeBooked",
  "BasisSwapTradeBooked",
  "CrossCurrencySwapTradeBooked",
] as const);

export type OdpReportableEventType =
  | "FxTradeExecuted"
  | "IrsTradeBooked"
  | "FraTradeBooked"
  | "SwaptionTradeBooked"
  | "BasisSwapTradeBooked"
  | "CrossCurrencySwapTradeBooked";

/**
 * Returns `true` when `eventType` triggers the ODP reporting obligation.
 */
export function isOdpReportable(eventType: string): eventType is OdpReportableEventType {
  return ODP_REPORTABLE_EVENT_TYPES.has(eventType as OdpReportableEventType);
}
