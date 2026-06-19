// v2-core/fx-gateway/events.ts
//
// V2-native FX pre-trade gateway-rejection event family — the V2/FIL-world
// representation of a pre-trade gate outcome (WS-FX-OTC-CLOSURE FU3).
//
// ## Why this exists
//
// The legacy FX desk "rejections" panel (`/api/markets/fx/rejections`) reads the
// V1 pre-trade gateway family (`OrderRejectedAtGateway`). That family is a V1
// control-plane mechanism: an order is gated BEFORE execution, and a REJECTED
// order never reaches execution, so it never materialises a FIL instance. The
// FIL register (which the V2 FX surface reads) therefore has no record of a
// rejected order — there is genuinely no FIL-derived source for this panel.
//
// To take the V2 FX surface fully V2-fed WITHOUT reading the V1 store, this
// slice declares a V2-NATIVE gateway-rejection event. It is the V2/FIL-world
// shape a pre-trade gate outcome takes when the gateway emits into the V2
// control-plane store directly (the target state of the gateway's own V2
// cutover). It is `migrationStatus: "v2-parallel"`: v1 `OrderRejectedAtGateway`
// remains the authoritative emitter today; this V2 family is the parallel V2
// representation the V2 surface reads.
//
// ## Name-free (standing policy; feedback_no_agent_names_in_ui)
//
// The payload carries NO persona names. It identifies the rejecting GATE by its
// `rejectingCheck` kind (a typed enum, not a seat), the order by id, the
// counterparty by party-id, and the rule by a citation token. The dashboard
// boundary additionally maps any seat reference to a Title via `seatTitle` — but
// this payload holds none to begin with.
//
// ## Build-phase honesty (Engineering Charter cmd 3)
//
// No V2 gateway-rejection EMITTER ships in this slice (the gateway aggregator
// still emits V1 `OrderRejectedAtGateway`; the V1→V2 emitter cutover is the
// tracked substrate gap — see the FU3 PR body / projection header). On the clean
// build-phase store there are therefore ZERO V2 gateway-rejection events, and
// the panel shows an honest EMPTY state with that reason — never a silent zero,
// and never a fall-back read of the V1 store.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory (`platform/`, `runtime/`, `domains/`, etc.).
// See `recon:v2-no-v1-import`. Only bare `zod` is imported.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO scope-extension 2026-06-19);
//   D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

/**
 * The eight pre-trade gateway check kinds (mirrors the V1 gateway pipeline's
 * `CHECK_KINDS`). Re-declared here verbatim because the v2 package cannot import
 * the V1 enum (no-v1-import boundary). A V2 gateway-rejection names the check
 * that rejected the order — a typed gate identity, never a persona name.
 */
export const v2GatewayCheckKindSchema = z.enum([
  "sanctions",
  "counterparty-eligibility",
  "market-risk",
  "identity",
  "suitability",
  "credit-limit",
  "capital-impact",
  "funding",
]);

export type V2GatewayCheckKind = z.infer<typeof v2GatewayCheckKindSchema>;

/**
 * `V2FxOrderRejectedAtGateway` — a pre-trade FX order rejected at the gateway,
 * recorded V2-natively. The V2/FIL-world analogue of the V1
 * `OrderRejectedAtGateway`. Name-free by construction.
 */
export interface V2FxOrderRejectedAtGatewayPayload {
  /** Discriminator literal — the registry `type` and payload `kind` agree by construction. */
  readonly kind: "V2FxOrderRejectedAtGateway";
  /** The pre-trade order identity (not a trade — the order never executed). */
  readonly orderId: string;
  /** The currency pair the order was for (e.g. "USD/ZAR"). */
  readonly currencyPair: string;
  /** Counterparty PARTY-ID (a counterparty identity, never an agent name). */
  readonly counterpartyId: string;
  /** Which gate kind rejected the order (typed gate identity, not a seat). */
  readonly rejectingCheck: V2GatewayCheckKind;
  /** Human-readable rejection reason (prose; carries no persona name). */
  readonly rejectionReason: string;
  /** Citation token for the rule the rejection enforces (Principle 2). */
  readonly citationToRule: string;
  /** ISO-8601 UTC instant the order was rejected. */
  readonly rejectedAt: string;
}

export const v2FxOrderRejectedAtGatewayPayloadSchema = z
  .object({
    kind: z.literal("V2FxOrderRejectedAtGateway"),
    orderId: z.string().min(1),
    currencyPair: z.string().min(1),
    counterpartyId: z.string().min(1),
    rejectingCheck: v2GatewayCheckKindSchema,
    rejectionReason: z.string().min(1),
    citationToRule: z.string().min(1),
    rejectedAt: z.string().min(1),
  })
  .strict();

// A compile-time check that the schema's inferred type matches the interface.
type _AssertSchemaMatches = z.infer<typeof v2FxOrderRejectedAtGatewayPayloadSchema>;
const _typecheck: _AssertSchemaMatches = {} as V2FxOrderRejectedAtGatewayPayload;
void _typecheck;
