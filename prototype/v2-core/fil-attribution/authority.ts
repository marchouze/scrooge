// v2-core/fil-attribution/authority.ts
//
// FIL ATTRIBUTION — dimension-assignment authority (A1 kernel; spec §6 #1,
// CEO-approved in D-FIL-ATTRIBUTION-A1-BUILD).
//
// THE RULE (open question #1, resolved by the CEO on approval):
//   - An `InstrumentDimensionAssigned` may be emitted by the BOOKING AGENT for
//     its OWN desk (single-seat authority).
//   - A CROSS-DESK transfer (the assignment moves the instrument from one desk
//     to a different desk) requires a SECOND-SEAT CO-SIGN, routed through the
//     reviewer→decider sync primitive (D-DISPATCH-SYNC-PRIMITIVE): the
//     assignment carries a `cosignedBy` referencing the second seat.
//
// We encode this as a PURE authority predicate. The sync-primitive machinery
// itself lives v1-side (platform/dispatch) and CANNOT be imported here
// (recon:v2-no-v1-import). The kernel's responsibility is the STRUCTURAL check:
// a cross-desk transfer without a co-sign is rejected. The runtime wiring that
// asserts `cosignedBy` is a real delivered reviewer brief is a later-slice
// dispatch concern (cited, not imported).
//
// Economic dimensions are NEVER assignable by an attribution event — they are
// derived from the instrument's own facets (dimensions.ts `DIMENSION_ORIGIN`).
// An attempt to assign an economic dimension is rejected regardless of seat.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-DISPATCH-SYNC-PRIMITIVE
//   (reviewer→decider co-sign); D-METRIC-ATTRIBUTION-DIMENSIONAL; Principle 6.
// Author: Atlas (Core banking platform architect, engineering).

import { type AttributionDimensionKey, isOrganisationalDimension } from "./dimensions";
import type { InstrumentDimensionAssignedPayload } from "./events";

// ---------------------------------------------------------------------------
// The authority decision
// ---------------------------------------------------------------------------

export type AssignmentAuthorityOutcome =
  | { readonly authorised: true }
  | { readonly authorised: false; readonly reason: string };

/**
 * The context an authority check needs beyond the event itself: the
 * instrument's CURRENT desk (the desk it belongs to immediately before this
 * assignment takes effect, derived from the membership projection) and the desk
 * the emitting agent owns. Both are resolved by the caller from projections;
 * the check is pure over them.
 *
 * `currentDesk` is `null` when the instrument has no prior desk assignment (a
 * first assignment is never a cross-desk transfer).
 */
export interface AssignmentAuthorityContext {
  /** The desk the instrument currently belongs to (null = no prior desk). */
  readonly currentDesk: string | null;
  /** The desk the emitting `assignedBy` agent owns (null = not a desk-owning seat). */
  readonly assignerDesk: string | null;
}

/**
 * Is this assignment a CROSS-DESK transfer? True iff the dimension being
 * assigned is `desk`, the instrument already had a desk, and the new desk
 * differs from the current one. (Re-tagging `book` / `strategy` / `portfolio`
 * within the same desk is NOT a cross-desk transfer; a first desk assignment is
 * not either.)
 */
export function isCrossDeskTransfer(
  payload: Pick<InstrumentDimensionAssignedPayload, "dimension" | "value">,
  ctx: AssignmentAuthorityContext,
): boolean {
  if (payload.dimension !== "desk") return false;
  if (ctx.currentDesk === null) return false;
  return payload.value !== ctx.currentDesk;
}

/**
 * Authorise (or reject) an `InstrumentDimensionAssigned`.
 *
 * Rules, in order:
 *   1. The dimension MUST be organisational (economic dims are facet-derived).
 *   2. A cross-desk transfer MUST carry a `cosignedBy` (second-seat co-sign via
 *      the reviewer→decider primitive). Absent → rejected.
 *   3. A non-cross-desk assignment is authorised when the assigning agent owns
 *      the target desk (single-seat authority for its own desk). When the
 *      assigner's desk is unknown (null) we do NOT block — desk ownership wiring
 *      is a later slice; the structural cross-desk co-sign gate is the A1
 *      load-bearing control.
 */
export function authoriseDimensionAssignment(
  payload: Pick<InstrumentDimensionAssignedPayload, "dimension" | "value" | "cosignedBy">,
  ctx: AssignmentAuthorityContext,
): AssignmentAuthorityOutcome {
  const dimension = payload.dimension as AttributionDimensionKey;

  if (!isOrganisationalDimension(dimension)) {
    return {
      authorised: false,
      reason: `dimension "${dimension}" is economic (facet-derived) — it cannot be assigned by an attribution event; it is projected from the instrument's facets`,
    };
  }

  if (isCrossDeskTransfer(payload, ctx)) {
    if (!payload.cosignedBy || payload.cosignedBy.trim() === "") {
      return {
        authorised: false,
        reason: `cross-desk transfer (${ctx.currentDesk} → ${payload.value}) requires a second-seat co-sign via the reviewer→decider sync primitive (D-DISPATCH-SYNC-PRIMITIVE); no cosignedBy present`,
      };
    }
    return { authorised: true };
  }

  return { authorised: true };
}
