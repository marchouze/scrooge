// v2-core/fx-gateway/fold.ts
//
// Pure fold of V2-native FX gateway-rejection events into the rejection-feed
// rows the dashboard's V2 FX rejections panel renders (WS-FX-OTC-CLOSURE FU3).
//
// The fold is pure over the supplied event list (Principle 1 — the event log is
// truth; the feed is a derived query, never stored state). It is package-
// boundary-safe (`v2-core/` only; bare `zod` + this slice's own schema). The
// dashboard wires it to the V2 control-plane store via the platform-side
// projection reader (`platform/projections/markets/v2-fx-gateway-rejections.ts`)
// so the v2 package never imports v1 store code.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG; D-BANK-WIDE-V2-MIGRATION.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type V2FxOrderRejectedAtGatewayPayload,
  type V2GatewayCheckKind,
  v2FxOrderRejectedAtGatewayPayloadSchema,
} from "./events";

/** The V2 registry/event type name for the gateway-rejection family. */
export const V2_FX_ORDER_REJECTED_AT_GATEWAY_TYPE = "V2FxOrderRejectedAtGateway" as const;

/**
 * A minimal event shape the fold reads. A structural subset of both the v1
 * `Event` and the v2 `CpEvent` — so the same fold serves the control-plane
 * store read AND a test that passes plain objects. Kept local to avoid a
 * v1-store import across the package boundary.
 */
export interface V2FxGatewayEventLike {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

/** One row of the V2 FX rejection feed — name-free. */
export interface V2FxRejectionRow {
  /** The V2 event id of record. */
  readonly eventId: string;
  /** The rejected pre-trade order id. */
  readonly orderId: string;
  /** The currency pair the order was for. */
  readonly currencyPair: string;
  /** Counterparty party-id (not an agent name). */
  readonly counterpartyId: string;
  /** Typed gate kind that rejected the order (not a seat). */
  readonly rejectingCheck: V2GatewayCheckKind;
  /** Rejection reason prose (carries no persona name). */
  readonly rejectionReason: string;
  /** Citation token for the enforced rule. */
  readonly citationToRule: string;
  /** ISO-8601 UTC rejection instant. */
  readonly timestamp: string;
}

/** Newest-first cap, mirroring the V1 risk-view feed cap. */
export const MAX_V2_REJECTIONS = 50;

function parsePayload(payload: Record<string, unknown>): V2FxOrderRejectedAtGatewayPayload | null {
  const parsed = v2FxOrderRejectedAtGatewayPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Fold a list of V2-store events into the rejection feed (newest-first, capped).
 * Non-gateway-rejection types are ignored; a gateway-rejection event whose
 * payload fails the schema is skipped (fail-closed — a malformed row never
 * masquerades as a valid rejection).
 */
export function foldV2FxRejections(events: readonly V2FxGatewayEventLike[]): V2FxRejectionRow[] {
  const rows: V2FxRejectionRow[] = [];
  for (const e of events) {
    if (e.type !== V2_FX_ORDER_REJECTED_AT_GATEWAY_TYPE) continue;
    const p = parsePayload(e.payload);
    if (p === null) continue;
    rows.push({
      eventId: e.event_id,
      orderId: p.orderId,
      currencyPair: p.currencyPair,
      counterpartyId: p.counterpartyId,
      rejectingCheck: p.rejectingCheck,
      rejectionReason: p.rejectionReason,
      citationToRule: p.citationToRule,
      timestamp: p.rejectedAt,
    });
  }
  // Newest-first by rejection instant; tie-break on event id for determinism.
  rows.sort((a, b) => {
    const t = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return t !== 0 ? t : a.eventId.localeCompare(b.eventId);
  });
  return rows.slice(0, MAX_V2_REJECTIONS);
}
