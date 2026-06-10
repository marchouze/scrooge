// platform/risk/credit-limit-engine/projection.ts
//
// WS-CREDIT-LIMIT-ENGINE — fold the credit-limit event family into live
// per-counterparty CreditLimit state. Pure projection over the event store
// (Principle 1).
//
// Fold rules (per PROC-RISK-CO-01 + Credit Risk Policy §1.4):
//   CreditLimitApplicationSubmitted  → status = "pending" (seed row)
//   CreditAnalysisCompleted          → (no status change; analysis recorded
//                                       elsewhere — projection only tracks
//                                       lifecycle gates)
//   ISDACSAAssessmentCompleted       → (no status change)
//   CreditLimitProposed              → (no status change; still pending)
//   CreditLimitApproved              → status = "approved"; capture limit /
//                                       currency / tenor / authority /
//                                       conditions / expiryDate.
//   CreditLimitLoaded                → status = "loaded" (the only state in
//                                       which `checkHeadroom` returns ok).
//   CreditLimitAnnualReviewCompleted → lastReviewDate updated; if
//                                       revisedLimit > 0, limit revised.
//                                       Status preserved (loaded → loaded).
//   CreditLimitBreached              → status = "breached".
//   CreditLimitBreachDisposed        → revert to "loaded" unless severity
//                                       was critical AND disposition was
//                                       "accepted" (then stay "breached").
//   CreditLimitWithdrawn             → status = "withdrawn" (terminal).
//                                      `listActiveLimits` excludes withdrawn
//                                      rows; `getCreditLimit` still returns
//                                      the materialised row so callers see
//                                      the lifecycle outcome.
//   CreditLimitExtensionRequested    → (no status change; tracked only)
//
// `expired` is computed on-demand from `expiryDate` when callers query
// `getCreditLimit` — keeps projection pure (no clock state baked in).
//
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../../composition";
import { type Money, minor } from "../../core/money";
import type { Currency } from "../../core/types";
import type {
  CreditApprovalAuthority,
  CreditLimitAnnualReviewCompletedPayload,
  CreditLimitApplicationSubmittedPayload,
  CreditLimitApprovedPayload,
  CreditLimitBreachDisposedPayload,
  CreditLimitBreachedPayload,
  CreditLimitLoadedPayload,
  CreditLimitWithdrawnPayload,
} from "../../event-store/event-types/credit-limit";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import { utcNow } from "../../types/time";
import type { CreditLimit, CreditLimitStatus } from "./types";

// ---------------------------------------------------------------------------
// CREDIT_LIMIT_LIFECYCLE_TYPES — the event-type names this projection folds.
//
// Listed in canonical order (lifecycle order). Used by `getLimitHistory`.
// ---------------------------------------------------------------------------

export const CREDIT_LIMIT_LIFECYCLE_TYPES = [
  "CreditLimitApplicationSubmitted",
  "CreditLimitExtensionRequested",
  "CreditAnalysisCompleted",
  "ISDACSAAssessmentCompleted",
  "CreditLimitProposed",
  "CreditLimitApproved",
  "CreditLimitLoaded",
  "CreditLimitAnnualReviewCompleted",
  "CreditLimitBreached",
  "CreditLimitBreachDisposed",
  "CreditLimitWithdrawn",
] as const;

// ---------------------------------------------------------------------------
// Internal: a mutable fold accumulator. The materialised `CreditLimit` is
// returned at fold-end with conditions / approvalAuthority defaulted when
// the lifecycle never reached approval.
// ---------------------------------------------------------------------------

interface FoldAcc {
  counterpartyId: string;
  status: CreditLimitStatus;
  limitMinor: bigint;
  currency: string;
  tenor: string;
  approvedAt?: string;
  loadedAt?: string;
  expiryDate?: string;
  lastReviewDate?: string;
  conditions: string[];
  approvalAuthority: CreditApprovalAuthority;
  /** The latest CreditLimitBreached severity — needed to decide whether a
   * CreditLimitBreachDisposed should drop the row back to `loaded`. */
  lastBreachSeverity: "amber" | "red" | "critical" | null;
}

function emptyAcc(counterpartyId: string): FoldAcc {
  return {
    counterpartyId,
    status: "pending",
    limitMinor: 0n,
    currency: "ZAR",
    tenor: "",
    conditions: [],
    approvalAuthority: "CRO",
    lastBreachSeverity: null,
  };
}

function materialise(acc: FoldAcc): CreditLimit {
  const limit: Money = minor(acc.limitMinor, acc.currency as Currency);
  const out: CreditLimit = {
    counterpartyId: acc.counterpartyId,
    limit,
    currency: acc.currency,
    tenor: acc.tenor,
    status: acc.status,
    conditions: acc.conditions.slice(),
    approvalAuthority: acc.approvalAuthority,
  };
  if (acc.approvedAt !== undefined) out.approvedAt = acc.approvedAt;
  if (acc.loadedAt !== undefined) out.loadedAt = acc.loadedAt;
  if (acc.expiryDate !== undefined) out.expiryDate = acc.expiryDate;
  if (acc.lastReviewDate !== undefined) out.lastReviewDate = acc.lastReviewDate;
  return out;
}

// ---------------------------------------------------------------------------
// Fold a single event into the accumulator. Returns the (possibly-mutated)
// accumulator. We never throw on a missing earlier event — partial folds are
// expected during build phase when applications haven't reached approval.
// ---------------------------------------------------------------------------

function applyEvent(acc: FoldAcc, event: Event): FoldAcc {
  switch (event.type) {
    case "CreditLimitApplicationSubmitted": {
      const p = event.payload as CreditLimitApplicationSubmittedPayload;
      // First sighting of the counterparty; status only moves to "pending"
      // when we haven't already seen an approval (later events can
      // legitimately come out-of-order in tests, so we don't downgrade).
      if (acc.status === "pending") {
        acc.tenor = p.tenor;
        acc.currency = p.currency;
      }
      return acc;
    }
    case "CreditLimitApproved": {
      const p = event.payload as CreditLimitApprovedPayload;
      acc.status = "approved";
      acc.limitMinor = BigInt(p.limit);
      acc.currency = p.currency;
      acc.tenor = p.tenor;
      acc.approvedAt = p.approvedAt;
      acc.approvalAuthority = p.approvalAuthority;
      acc.conditions = p.conditions.slice();
      if (p.expiryDate !== undefined) acc.expiryDate = p.expiryDate;
      return acc;
    }
    case "CreditLimitLoaded": {
      const p = event.payload as CreditLimitLoadedPayload;
      acc.status = "loaded";
      acc.limitMinor = BigInt(p.limit);
      acc.currency = p.currency;
      acc.loadedAt = p.loadedAt;
      return acc;
    }
    case "CreditLimitAnnualReviewCompleted": {
      const p = event.payload as CreditLimitAnnualReviewCompletedPayload;
      acc.lastReviewDate = p.reviewedAt;
      if (p.revisedLimit > 0) {
        acc.limitMinor = BigInt(p.revisedLimit);
        acc.currency = p.currency;
      }
      // Status is preserved — annual review does not by itself transition
      // a loaded limit. (If the review elected to withdraw, that requires a
      // dedicated event — a future slice.)
      return acc;
    }
    case "CreditLimitBreached": {
      const p = event.payload as CreditLimitBreachedPayload;
      acc.status = "breached";
      acc.lastBreachSeverity = p.severity;
      return acc;
    }
    case "CreditLimitBreachDisposed": {
      const p = event.payload as CreditLimitBreachDisposedPayload;
      // Revert to "loaded" — unless the latest breach was critical AND the
      // disposition is "accepted" (a CRC-approved standing exception that
      // explicitly tolerates ongoing breach).
      const sticky = acc.lastBreachSeverity === "critical" && p.dispositionType === "accepted";
      if (!sticky) {
        acc.status = "loaded";
      }
      acc.lastBreachSeverity = null;
      return acc;
    }
    case "CreditLimitWithdrawn": {
      // Withdrawal is terminal — limit no longer available for trading.
      // Payload reason is recorded on the event itself; the projection
      // tracks only the status transition (additional reason / actor
      // metadata is queryable via `getLimitHistory`).
      const _p = event.payload as CreditLimitWithdrawnPayload; // schema-validate via type import
      void _p;
      acc.status = "withdrawn";
      return acc;
    }
    default:
      // Lifecycle events not modelled (analysis, ISDA, proposed, extension)
      // are observed but don't change the fold state.
      return acc;
  }
}

// ---------------------------------------------------------------------------
// Internal helper: fold all credit-limit lifecycle events from the event
// store, returning a map keyed by counterpartyId.
// ---------------------------------------------------------------------------

function foldAll(asOf?: string, store?: Pick<EventStore, "replay">): Map<string, FoldAcc> {
  const es = store ?? eventStore;
  const byCounterparty = new Map<string, FoldAcc>();
  for (const type of CREDIT_LIMIT_LIFECYCLE_TYPES) {
    for (const event of es.replay(asOf !== undefined ? { type, asOf } : { type })) {
      const p = event.payload as { counterpartyId?: string };
      const cpId = p.counterpartyId;
      if (!cpId) continue;
      const acc = byCounterparty.get(cpId) ?? emptyAcc(cpId);
      byCounterparty.set(cpId, applyEvent(acc, event));
    }
  }
  return byCounterparty;
}

// ---------------------------------------------------------------------------
// Public projection API
// ---------------------------------------------------------------------------

/**
 * Returns the projected CreditLimit for `counterpartyId`, or `null` if no
 * credit-limit lifecycle event has ever referenced this counterparty.
 *
 * `expired` is computed on-demand from `expiryDate < now`. The asOf parameter
 * controls both the event-store cut-off and the expiry comparison (defaults
 * to current wall time).
 */
export function getCreditLimit(
  counterpartyId: string,
  asOf?: string,
  store?: Pick<EventStore, "replay">,
): CreditLimit | null {
  const all = foldAll(asOf, store);
  const acc = all.get(counterpartyId);
  if (!acc) return null;
  const limit = materialise(acc);
  return decorateExpiry(limit, asOf);
}

/**
 * Returns all counterparties with non-`pending` lifecycle progress. Used by
 * `breach-detector.ts` and downstream views. Sorted by counterpartyId for
 * stable rendering.
 *
 * Withdrawn counterparties are excluded — `CreditLimitWithdrawn` is a
 * terminal transition (policy §7); the limit is no longer "active" for
 * pre-deal headroom or for inclusion in periodic limit reviews. The full
 * lifecycle history remains queryable via `getLimitHistory`.
 */
export function listActiveLimits(asOf?: string): CreditLimit[] {
  const all = foldAll(asOf);
  const out: CreditLimit[] = [];
  for (const acc of all.values()) {
    if (acc.status === "withdrawn") continue;
    out.push(decorateExpiry(materialise(acc), asOf));
  }
  out.sort((a, b) => (a.counterpartyId < b.counterpartyId ? -1 : 1));
  return out;
}

/**
 * Returns the raw lifecycle event history for `counterpartyId`, in event-
 * store sequence order, filtered to the credit-limit lifecycle types. Used
 * by audit / breach-investigation views.
 */
export function getLimitHistory(counterpartyId: string, asOf?: string): readonly Event[] {
  const out: Event[] = [];
  for (const type of CREDIT_LIMIT_LIFECYCLE_TYPES) {
    for (const event of eventStore.replay(asOf !== undefined ? { type, asOf } : { type })) {
      const p = event.payload as { counterpartyId?: string };
      if (p.counterpartyId === counterpartyId) out.push(event);
    }
  }
  // event-store replay is in sequence order per type; merge by as_of for a
  // stable cross-type chronology.
  out.sort((a, b) => (a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0));
  return out;
}

// ---------------------------------------------------------------------------
// Expiry decoration — keeps `expired` computation centralised.
// ---------------------------------------------------------------------------

function decorateExpiry(limit: CreditLimit, asOf?: string): CreditLimit {
  if (!limit.expiryDate) return limit;
  const now = (asOf ?? utcNow()).slice(0, 10);
  if (limit.expiryDate < now && limit.status !== "withdrawn") {
    return { ...limit, status: "expired" };
  }
  return limit;
}
