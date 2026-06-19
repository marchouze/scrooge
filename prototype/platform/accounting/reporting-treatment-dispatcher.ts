// platform/accounting/reporting-treatment-dispatcher.ts
//
// Pure resolver helpers for the reporting-treatment menu (S0c,
// D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD). Given an approved Product's
// treatment-menu pick (`reportingTreatmentModuleIds`) and a folded
// reporting-treatment registry, these functions resolve the composed treatment
// the Product applies — its IFRS classification, the posting-rule ids it
// references, and its prudential / tax treatment, with the citations carried up.
//
// SCOPE: PURE FUNCTIONS, NO EMISSION. These helpers read the registry and an
// optional event lookup; they emit NOTHING. They DO NOT touch GL posting engines,
// `gl-projection-v2.ts`, or `GlPostingEmitted` (brief §"Out of scope").
//
// This file lives on the V1 side (`platform/`) so it MAY import from `v2-core/`
// (the permitted v1→v2 direction; v2-core never reaches back). The resolver
// takes a NARROW structural event-store interface (`TreatmentEventLookup`) rather
// than the concrete `EventStore` class so it stays pure and unit-testable with a
// fixture store, and so it never reaches into live `composition`.
//
// FAIL-CLOSED (Engineering Charter cmd 2/5): when a FIL instance has no product
// binding yet (the trade `productId` field is a DEFERRED slice, S0d), the
// instance resolver returns an explicit typed `{ resolved: false,
// reason: "no-product-binding" }` — never a silent default treatment.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Atlas (Substrate Architect, engineering).

import type { V2ProductRegistered } from "../../v2-core/banking/events";
import type {
  BusinessModel,
  FairValueHierarchy,
  IfrsClassificationCategory,
  PrudentialTreatment,
  TaxTreatment,
} from "../../v2-core/reporting-treatments/declaration";
import {
  type ReportingTreatmentRegister,
  findTreatmentById,
} from "../../v2-core/reporting-treatments/registry";

// ---------------------------------------------------------------------------
// resolveProductTreatments — fold a product's treatment-menu pick into the
// composed treatment.
// ---------------------------------------------------------------------------

/**
 * The composed treatment for a Product, resolved from its
 * `reportingTreatmentModuleIds` pick against the registry. Each treatment
 * dimension contributes its typed fields; posting-rule ids and citations are
 * unioned across the picked modules.
 */
export interface ResolvedProductTreatments {
  /** IFRS classification (from the picked `ifrs-classification` module, if any). */
  readonly ifrsCategory: IfrsClassificationCategory | undefined;
  /** IFRS 13 fair-value hierarchy level (qualifies the classification). */
  readonly fairValueHierarchy: FairValueHierarchy | undefined;
  /** IFRS 9 business model (qualifies the classification). */
  readonly businessModel: BusinessModel | undefined;
  /** Prudential treatment (from the picked `prudential-treatment` module, if any). */
  readonly prudential: PrudentialTreatment | undefined;
  /** Tax treatment (from the picked `tax-treatment` module, if any). */
  readonly tax: TaxTreatment | undefined;
  /** Union of every picked module's posting-rule ids, deduplicated + sorted. */
  readonly postingRuleIds: readonly string[];
  /** Union of every picked module's citations, deduplicated + sorted. */
  readonly citations: readonly string[];
  /**
   * Treatment-module ids that were picked but did NOT resolve against the
   * registry. Empty on a fully-resolved product. Surfaced (not swallowed) so the
   * caller can fail-closed on an unresolved pick (Charter cmd 5 — no silent
   * deferral; cmd 6 — errors handled, never swallowed).
   */
  readonly unresolvedModuleIds: readonly string[];
}

/**
 * Resolve a Product's composed reporting treatment by resolving each
 * `reportingTreatmentModuleIds` entry against the registry. Unknown picks are
 * reported in `unresolvedModuleIds` rather than silently dropped.
 *
 * A product with no `reportingTreatmentModuleIds` (the additive default — S0b)
 * resolves to an empty treatment (no dimensions composed yet), with empty
 * posting-rule / citation sets and no unresolved ids.
 */
export function resolveProductTreatments(
  product: Pick<V2ProductRegistered, "reportingTreatmentModuleIds">,
  treatmentRegistry: ReportingTreatmentRegister,
): ResolvedProductTreatments {
  const picks = product.reportingTreatmentModuleIds ?? [];

  let ifrsCategory: IfrsClassificationCategory | undefined;
  let fairValueHierarchy: FairValueHierarchy | undefined;
  let businessModel: BusinessModel | undefined;
  let prudential: PrudentialTreatment | undefined;
  let tax: TaxTreatment | undefined;
  const postingRuleIds = new Set<string>();
  const citations = new Set<string>();
  const unresolvedModuleIds: string[] = [];

  for (const treatmentId of picks) {
    const row = findTreatmentById(treatmentRegistry, treatmentId);
    if (row === undefined) {
      unresolvedModuleIds.push(treatmentId);
      continue;
    }
    // Each module owns one dimension; copy through the fields it carries. A
    // product is expected to pick at most one module per dimension (the registry
    // conflict gate enforces single-ownership per scope+version), so last-write
    // here is benign for a well-formed pick.
    if (row.ifrsCategory !== undefined) ifrsCategory = row.ifrsCategory;
    if (row.fairValueHierarchy !== undefined) fairValueHierarchy = row.fairValueHierarchy;
    if (row.businessModel !== undefined) businessModel = row.businessModel;
    if (row.prudential !== undefined) prudential = row.prudential;
    if (row.tax !== undefined) tax = row.tax;
    for (const id of row.applicablePostingRuleIds) postingRuleIds.add(id);
    for (const c of row.cites) citations.add(c);
  }

  return {
    ifrsCategory,
    fairValueHierarchy,
    businessModel,
    prudential,
    tax,
    postingRuleIds: [...postingRuleIds].sort(),
    citations: [...citations].sort(),
    unresolvedModuleIds,
  };
}

// ---------------------------------------------------------------------------
// resolveInstanceTreatment — resolve a FIL instance's treatment via its
// originating trade event → productId → product → resolveProductTreatments.
// ---------------------------------------------------------------------------

/**
 * The minimal slice of a FIL instance this resolver reads.
 *
 * - `productId` (PREFERRED, S0d): the booking-time product binding stamped on the
 *   FIL instance's economic terms (`FilEconomicTerms.productId`). When present the
 *   resolver binds DIRECTLY to this product — the instance carries its own
 *   determination, no reach-back required. This is the D-ACCT-MODULAR-PRODUCT-
 *   COMPOSED-FOLD steady-state path.
 * - `originatingEvent` (LEGACY fallback): the originating v1 trade event reference
 *   (Principle 1 lineage). When no `productId` is bound on the instance, the
 *   resolver reads `productId` off the originating trade event's payload — the
 *   pre-S0d optional-read path, retained for un-migrated instances and the
 *   trade-event-carried-productId contract. Structurally compatible with
 *   `FilInstanceRow.originatingEvent` (`v2-core/fil-instances/projection.ts`).
 */
export interface InstanceTreatmentInput {
  /** Booking-time product binding off the FIL instance (S0d) — preferred. */
  readonly productId?: string;
  readonly originatingEvent: {
    readonly eventType: string;
    readonly eventId: string;
  };
}

/** A registered event as seen by the resolver — envelope + opaque payload. */
export interface TreatmentLookupEvent {
  readonly event_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/**
 * The NARROW structural store interface the instance resolver needs: replay
 * events filtered by type (so it can locate the originating trade event by id
 * within its type stream). The concrete `EventStore.replay` satisfies this.
 */
export interface TreatmentEventLookup {
  replay(opts: { type?: string }): Iterable<TreatmentLookupEvent>;
}

/**
 * Resolve a Product registration by id from the event store. `V2ProductRegistered`
 * is latest-wins per `productId`; the last matching event wins.
 */
function findProductById(
  productId: string,
  eventStore: TreatmentEventLookup,
): V2ProductRegistered | undefined {
  let found: V2ProductRegistered | undefined;
  for (const ev of eventStore.replay({ type: "V2ProductRegistered" })) {
    const p = ev.payload as Partial<V2ProductRegistered>;
    if (p.productId === productId) {
      found = p as V2ProductRegistered;
    }
  }
  return found;
}

/** Resolved instance treatment — the originating product was found + composed. */
export interface InstanceTreatmentResolved extends ResolvedProductTreatments {
  readonly resolved: true;
  /** The product id the instance's trade bound to. */
  readonly productId: string;
}

/**
 * Unresolved instance treatment — fail-closed. `reason` names WHY, so the caller
 * never silently applies a default (Charter cmd 2 — fail-closed; cmd 5 — no
 * silent deferral).
 */
export interface InstanceTreatmentUnresolved {
  readonly resolved: false;
  readonly reason: "no-product-binding" | "originating-event-missing" | "product-not-registered";
  /** Human-readable detail for surfacing in recon / logs. */
  readonly detail: string;
}

export type InstanceTreatmentResolution = InstanceTreatmentResolved | InstanceTreatmentUnresolved;

/**
 * Resolve a FIL instance's reporting treatment.
 *
 * Two binding paths, preferred order:
 *
 *   1. PREFERRED — booking-time instance binding (S0d): if the instance carries a
 *      `productId` (stamped on `FilEconomicTerms.productId` at booking, NPA-gated),
 *      bind directly to that product. No originating-event reach-back is needed —
 *      the instance carries its own determination.
 *
 *   2. LEGACY fallback — originating-trade read: when the instance has no bound
 *      `productId` (un-migrated / pre-S0d), read `productId` off the originating
 *      trade event's payload IF present.
 *
 * In BOTH paths, an absent product binding returns
 * `{ resolved: false, reason: "no-product-binding" }` — never a silent default
 * (Engineering Charter cmd 2). The originating event being missing (only reached
 * in the legacy path), or the bound product not being registered, are likewise
 * explicit fail-closed reasons.
 */
export function resolveInstanceTreatment(
  instance: InstanceTreatmentInput,
  eventStore: TreatmentEventLookup,
  treatmentRegistry: ReportingTreatmentRegister,
): InstanceTreatmentResolution {
  // Path 1 — PREFERRED: the instance carries its own booking-time product binding
  // (S0d). Bind directly; the originating trade event need not even be reachable.
  if (typeof instance.productId === "string" && instance.productId.length > 0) {
    return resolveBoundProduct(
      instance.productId,
      eventStore,
      treatmentRegistry,
      "instance-binding",
    );
  }

  // Path 2 — LEGACY: read productId off the originating trade event.
  const { eventType, eventId } = instance.originatingEvent;

  // Locate the originating trade event by id within its type stream.
  let originating: TreatmentLookupEvent | undefined;
  for (const ev of eventStore.replay({ type: eventType })) {
    if (ev.event_id === eventId) {
      originating = ev;
      break;
    }
  }
  if (originating === undefined) {
    return {
      resolved: false,
      reason: "originating-event-missing",
      detail: `originating event ${eventType}#${eventId} not found in store`,
    };
  }

  // The trade-carried `productId` (legacy optional-read path). Read it off the
  // trade payload IF present; fail-closed if absent — no default product, no
  // default treatment.
  const productIdRaw = originating.payload.productId;
  if (typeof productIdRaw !== "string" || productIdRaw.length === 0) {
    return {
      resolved: false,
      reason: "no-product-binding",
      detail: `instance has no booking-time productId and originating event ${eventType}#${eventId} carries no productId either`,
    };
  }

  return resolveBoundProduct(
    productIdRaw,
    eventStore,
    treatmentRegistry,
    `trade ${eventType}#${eventId}`,
  );
}

/**
 * Resolve a bound `productId` to its composed treatment, fail-closed if the
 * product is not registered. Shared by both binding paths above. `source` names
 * where the binding came from (for the fail-closed detail string).
 */
function resolveBoundProduct(
  productId: string,
  eventStore: TreatmentEventLookup,
  treatmentRegistry: ReportingTreatmentRegister,
  source: string,
): InstanceTreatmentResolution {
  const product = findProductById(productId, eventStore);
  if (product === undefined) {
    return {
      resolved: false,
      reason: "product-not-registered",
      detail: `product ${productId} bound via ${source} has no V2ProductRegistered event`,
    };
  }

  const composed = resolveProductTreatments(product, treatmentRegistry);
  return { resolved: true, productId, ...composed };
}
