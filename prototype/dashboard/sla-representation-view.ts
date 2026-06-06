// dashboard/sla-representation-view.ts
//
// SLA parallel-representation PREVIEW API (read-only / dry-run) — Phase-0 spec
// §9.2. The inspection surface that demonstrates the parallel-basis fan-out:
// one FX event → the IFRS book entry AND the SARB-BA-RETURN regulatory NOP
// memorandum entry, side by side.
//
//   GET /api/sla/representation-preview            — preview a built-in sample
//                                                    FxTradeExecuted (buy USD/ZAR)
//   GET /api/sla/representation-preview?side=sell&base=EUR&quote=ZAR
//       &payCurrency=ZAR&receiveCurrency=EUR&payMinor=...&receiveMinor=...&rate=...
//                                                    — preview a custom FX-spot
//                                                    trade booking
//
// READ-ONLY: this route NEVER emits an event and NEVER posts to the GL. It calls
// the pure `buildRepresentationPreview` (which calls the pure interpreter) and
// returns the proposed journals. SARB-BA-RETURN is NOT activated in the
// production posting path — this preview is the dry-run demonstration only.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4, CEO-approved 2026-06-06);
//            D-SLA-FIRST-REPRESENTATION-SARB-BA (CFO Camille).

import { nowUtc } from "../platform/core/types";
import {
  type RepresentationPreviewResult,
  buildRepresentationPreview,
} from "../platform/accounting/sla/representation-preview";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";

const PREVIEW_ENTITY = "LE-ZA-HOZ-BANK";

interface FxSampleSpec {
  readonly side: "buy" | "sell";
  readonly base: string;
  readonly quote: string;
  readonly payCurrency: string;
  readonly receiveCurrency: string;
  readonly payMinor: number;
  readonly receiveMinor: number;
  readonly rate: number;
}

/** The built-in demonstration trade: buy USD / sell ZAR (the spec §3.2 example). */
const DEFAULT_SAMPLE: FxSampleSpec = {
  side: "buy",
  base: "USD",
  quote: "ZAR",
  payCurrency: "ZAR",
  receiveCurrency: "USD",
  payMinor: 1_900_000_000, // R19,000,000.00
  receiveMinor: 100_000_000, // $1,000,000.00
  rate: 19.0,
};

function buildFxPayload(spec: FxSampleSpec): FxTradeExecutedPayload {
  return {
    tradeId: { value: "PREVIEW-SAMPLE", scheme: "urn:bank:trade-id" },
    productTaxonomy: "FX-spot",
    currencyPair: { base: spec.base, quote: spec.quote },
    side: spec.side,
    legs: [
      {
        legKind: "near",
        payCurrency: spec.payCurrency,
        receiveCurrency: spec.receiveCurrency,
        notional: { currency: spec.payCurrency, amountMinor: spec.payMinor },
        counterNotional: { currency: spec.receiveCurrency, amountMinor: spec.receiveMinor },
        rate: { currency: spec.quote, amount: spec.rate },
        settlementDate: { iso: "2026-06-09", calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: "2026-06-06", calendar: "JIHCAL" },
    counterparty: {
      partyId: "CP-PREVIEW-001",
      name: "Preview Bank",
      role: "counterparty",
      jurisdiction: "ZA",
    },
    venue: "OTC",
    trader: "preview",
    bookId: "FX-SPOT-BOOK",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    clientFlowRef: "sla-representation-preview",
  } as FxTradeExecutedPayload;
}

function intParam(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function strParam(params: URLSearchParams, key: string, fallback: string): string {
  return params.get(key) ?? fallback;
}

/** Build the preview from query params (falling back to the default sample). */
export function buildPreviewFromParams(params: URLSearchParams): RepresentationPreviewResult {
  const sideRaw = params.get("side");
  const spec: FxSampleSpec = {
    side: sideRaw === "sell" ? "sell" : DEFAULT_SAMPLE.side,
    base: strParam(params, "base", DEFAULT_SAMPLE.base),
    quote: strParam(params, "quote", DEFAULT_SAMPLE.quote),
    payCurrency: strParam(params, "payCurrency", DEFAULT_SAMPLE.payCurrency),
    receiveCurrency: strParam(params, "receiveCurrency", DEFAULT_SAMPLE.receiveCurrency),
    payMinor: intParam(params, "payMinor", DEFAULT_SAMPLE.payMinor),
    receiveMinor: intParam(params, "receiveMinor", DEFAULT_SAMPLE.receiveMinor),
    rate: intParam(params, "rate", DEFAULT_SAMPLE.rate),
  };

  const asOf = nowUtc();
  return buildRepresentationPreview(
    {
      type: "FxTradeExecuted",
      entity: PREVIEW_ENTITY,
      as_of: asOf,
      payload: buildFxPayload(spec),
    },
    asOf,
  );
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Register the SLA representation-preview routes. Returns a Response when the
 * path matches, else null (so the server falls through to the next handler).
 * READ-ONLY: GET only; never emits.
 */
export function registerSlaRepresentationRoutes(
  pathname: string,
  method: string,
  params: URLSearchParams,
): Response | null {
  if (method === "GET" && pathname === "/api/sla/representation-preview") {
    try {
      const preview = buildPreviewFromParams(params);
      return jsonResponse({ ok: true, preview });
    } catch (e) {
      return jsonResponse({ ok: false, error: (e as Error).message }, 400);
    }
  }
  return null;
}
