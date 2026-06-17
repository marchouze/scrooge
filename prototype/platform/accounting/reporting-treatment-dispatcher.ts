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
  readonly ifrsCategory?: IfrsClassificationCategory;
  /** IFRS 13 fair-value hierarchy level (qualifies the classification). */
  readonly fairValueHierarchy?: FairValueHierarchy;
  /** IFRS 9 business model (qualifies the classification). */
  readonly businessModel?: BusinessModel;
  /** Prudential treatment (from the picked `prudential-treatment` module, if any). */
  readonly prudential?: PrudentialTreatment;
  /** Tax treatment (from the picked `tax-treatment` module, if any). */
  readonly tax?: TaxTreatment;
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
 * The minimal slice of a FIL instance this resolver reads — its originating v1
 * event reference (Principle 1 lineage). Structurally compatible with
 * `FilInstanceRow.originatingEvent` (`v2-core/fil-instances/projection.ts`).
 */
export interface InstanceTreatmentInput {
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

export type InstanceTreatmentResolution =
  | InstanceTreatmentResolved
  | InstanceTreatmentUnresolved;

/**
 * Resolve a FIL instance's reporting treatment via:
 *   instance.originatingEvent → originating trade event → trade.productId →
 *   product → resolveProductTreatments.
 *
 * The trade `productId` field does NOT exist on trade events yet — adding it
 * (and the booking-time NPA gate) is a DEFERRED slice (S0d). This resolver only
 * implements the OPTIONAL-READ path: it reads `productId` off the originating
 * trade event's payload IF present; if absent (the build-phase norm today) it
 * returns `{ resolved: false, reason: "no-product-binding" }` — never a silent
 * default. The originating event being missing, or the bound product not being
 * registered, are likewise explicit fail-closed reasons.
 */
export function resolveInstanceTreatment(
  instance: InstanceTreatmentInput,
  eventStore: TreatmentEventLookup,
  treatmentRegistry: ReportingTreatmentRegister,
): InstanceTreatmentResolution {
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

  // The DEFERRED `productId` field (S0d). Read it off the trade payload IF
  // present; fail-closed if absent — no default product, no default treatment.
  const productIdRaw = originating.payload.productId;
  if (typeof productIdRaw !== "string" || productIdRaw.length === 0) {
    return {
      resolved: false,
      reason: "no-product-binding",
      detail: `originating event ${eventType}#${eventId} carries no productId (S0d deferred — booking-time product binding not yet wired)`,
    };
  }

  const product = findProductById(productIdRaw, eventStore);
  if (product === undefined) {
    return {
      resolved: false,
      reason: "product-not-registered",
      detail: `trade-bound product ${productIdRaw} has no V2ProductRegistered event`,
    };
  }

  const composed = resolveProductTreatments(product, treatmentRegistry);
  return { resolved: true, productId: productIdRaw, ...composed };
}
