// platform/projections/credit-limit-registry-v2.ts
//
// Phase 3d — V2 credit-limit approval-registry projection.
//
// Folds `CreditLimitApprovedV2`, `CreditLimitLoadedV2`, and
// `CreditLimitWithdrawnV2` events into the approval-registry:
//
//   Map<counterpartyId, CreditLimitV2RegistryEntry>
//
// where `CreditLimitV2RegistryEntry` is defined in
// `platform/credit-risk/credit-limit-engine-v2.ts`.
//
// ## Fold rules
//
//   CreditLimitApprovedV2  — upsert by counterpartyId.
//     Sets: approvedLimit, approvalAuthority, approvedAt, expiryDate, tenantId.
//     Resets: loadedLimit → null, effectiveFrom → null, breachStatus → null.
//     (A fresh approval supersedes any prior load state; the operator must
//     re-load after a new approval.)
//
//   CreditLimitLoadedV2    — update existing entry by counterpartyId.
//     Sets: loadedLimit, effectiveFrom.
//     Sets breachStatus to "active" if currently null.
//     No-op if no prior CreditLimitApprovedV2 for this counterparty
//     (guards against out-of-order replay).
//
//   CreditLimitWithdrawnV2 — update existing entry by counterpartyId.
//     Sets breachStatus to "withdrawn".
//     No-op if no prior entry.
//
// ## Snapshot caching
//
// Uses `readWithOutputSnapshot` (same pattern as `gl-projection-v2.ts`) with
// stream key "credit-limit-registry-v2:<asOf>".
//
// The `asOf` parameter defaults to "2099-12-31" (fold all events in the log
// up to and including the current state) — consistent with the approval
// registry being a current-state projection, not a point-in-time slice.
// Pass an explicit `asOf` to get the registry state as-of a past date.
//
// ## Provenance discipline
//
// Applies the default provenance filter (excludes simulated events from
// production reads). The approval-registry should reflect only governance-
// acknowledged approvals, not simulation seeds.
//
// Authority: D-V1-REMOVAL-PHASE-3D (CEO-approved 2026-06-15).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Citations: Banks Act 94 of 1990 §73; RRB Regulation 23; LEX Directive D3/2022;
//   BCBS 283; Policies/credit-risk-policy-v1.md; D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Author: Atlas (Substrate Architect, engineering).

import { moneyWireFromMinor } from "../core/money-codec";
import type { MoneyWire } from "../core/money-codec";
import type { CreditLimitV2RegistryEntry } from "../credit-risk/credit-limit-engine-v2";
import type {
  CreditLimitApprovedV2Payload,
  CreditLimitLoadedV2Payload,
  CreditLimitWithdrawnV2Payload,
  TenantId,
} from "../event-store/event-types/credit-limit";
import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "./filter";
import { readWithOutputSnapshot } from "./output-snapshot-cache";

// ---------------------------------------------------------------------------
// CreditLimitRegistry — the type returned by the projection.
// ---------------------------------------------------------------------------

export type CreditLimitRegistry = Map<string, CreditLimitV2RegistryEntry>;

// ---------------------------------------------------------------------------
// sortedByAsOf — gather provenance-filtered, as_of-bounded credit-limit
// lifecycle events and return them in as_of order (stable on sequence).
//
// Both the V1 and V2 folds use this so a `CreditLimitLoaded`/`Withdrawn`
// folds after its `CreditLimitApproved` regardless of physical append order
// — the events-truth invariant is that `as_of` is the logical clock, not the
// store sequence. A stable sort preserves replay (sequence) order for equal
// as_of values, keeping the fold deterministic and replay-safe.
// ---------------------------------------------------------------------------

const CREDIT_LIMIT_LIFECYCLE_TYPES = new Set<string>([
  "CreditLimitApproved",
  "CreditLimitLoaded",
  "CreditLimitWithdrawn",
  "CreditLimitApprovedV2",
  "CreditLimitLoadedV2",
  "CreditLimitWithdrawnV2",
]);

function sortedByAsOf(store: EventStore, filter: ProvenanceFilter, asOf: string): Event[] {
  const events: Event[] = [];
  for (const e of store.replay({})) {
    if (!CREDIT_LIMIT_LIFECYCLE_TYPES.has(e.type)) continue;
    if (!eventMatchesProvenanceFilter(e, filter)) continue;
    if (e.as_of > asOf) continue;
    events.push(e);
  }
  // Stable sort by as_of; replay already yields sequence order for ties.
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.as_of < b.e.as_of ? -1 : a.e.as_of > b.e.as_of ? 1 : a.i - b.i))
    .map(({ e }) => e);
}

// ---------------------------------------------------------------------------
// computeCreditLimitRegistryV2Uncached — pure fold (no snapshot cache).
//
// Used directly by `recon:credit-limit-v2-parity` to bypass snapshot
// cross-contamination (mirrors the V1 uncached path pattern).
// ---------------------------------------------------------------------------

export function computeCreditLimitRegistryV2Uncached(
  store: EventStore,
  asOf = "2099-12-31",
): CreditLimitRegistry {
  const registry = new Map<string, CreditLimitV2RegistryEntry>();
  const provenanceFilter = defaultProvenanceFilter();

  // Fold Approved → Loaded → Withdrawn in chronological (as_of) order.
  //
  // We gather the relevant events first and sort by `as_of` (stable — the
  // store replays in sequence order, so a stable sort yields as_of-primary,
  // sequence-secondary). This makes the fold independent of physical append
  // order: a `CreditLimitLoaded`/`Withdrawn` whose source approval was
  // appended LATER (e.g. a dual-run / Step-5 backfill) still folds after its
  // approval, as the events-truth logical order (as_of) dictates. Relying on
  // append order alone silently dropped out-of-order loads.
  const events = sortedByAsOf(store, provenanceFilter, asOf);

  for (const e of events) {
    if (e.type === "CreditLimitApprovedV2") {
      const p = e.payload as unknown as CreditLimitApprovedV2Payload;
      registry.set(p.counterpartyId, {
        approvedLimit: p.limit,
        loadedLimit: null,
        currentUtilisation: null,
        breachStatus: null,
        approvedAt: p.approvedAt,
        approvalAuthority: p.approvalAuthority,
        effectiveFrom: null,
        expiryDate: p.expiryDate ?? null,
        tenantId: p.tenantId,
      });
      continue;
    }

    if (e.type === "CreditLimitLoadedV2") {
      const p = e.payload as unknown as CreditLimitLoadedV2Payload;
      const existing = registry.get(p.counterpartyId);
      if (!existing) {
        // Out-of-order load with no prior approval — guard, skip.
        continue;
      }
      registry.set(p.counterpartyId, {
        ...existing,
        loadedLimit: p.limit,
        effectiveFrom: p.effectiveFrom,
        // Activate only if not already withdrawn.
        breachStatus: existing.breachStatus === "withdrawn" ? "withdrawn" : "active",
      });
      continue;
    }

    if (e.type === "CreditLimitWithdrawnV2") {
      const p = e.payload as unknown as CreditLimitWithdrawnV2Payload;
      const existing = registry.get(p.counterpartyId);
      if (!existing) {
        // No prior approval — nothing to withdraw, skip.
        continue;
      }
      registry.set(p.counterpartyId, {
        ...existing,
        breachStatus: "withdrawn",
      });
    }
  }

  return registry;
}

// ---------------------------------------------------------------------------
// computeCreditLimitRegistryV2 — snapshot-cached entry point.
// ---------------------------------------------------------------------------

/**
 * Compute the V2 credit-limit approval registry.
 *
 * Uses the output-snapshot cache with stream key
 * `"credit-limit-registry-v2:<asOf>"`.
 *
 * For parity gate use: call `computeCreditLimitRegistryV2Uncached` directly
 * to bypass the cache and compare against the V1 fold.
 *
 * @param store  Event store to read from.
 * @param asOf   ISO date upper bound for the fold. Defaults to "2099-12-31"
 *               (current-state / all events).
 */
export function computeCreditLimitRegistryV2(
  store: EventStore,
  asOf = "2099-12-31",
): CreditLimitRegistry {
  // Map<string, CreditLimitV2RegistryEntry> is not directly JSON-serialisable
  // because Map.prototype is not a plain object. We encode to an array of
  // [key, value] pairs and decode back.
  const { output } = readWithOutputSnapshot<CreditLimitRegistry>({
    store,
    streamKey: `credit-limit-registry-v2:${asOf}`,
    asOf,
    compute: () => computeCreditLimitRegistryV2Uncached(store, asOf),
    encode: (m) => JSON.stringify([...m.entries()]),
    decode: (payload) => {
      const entries = JSON.parse(payload) as Array<[string, CreditLimitV2RegistryEntry]>;
      return new Map(entries);
    },
  });
  return output;
}

// ---------------------------------------------------------------------------
// Helpers used by the parity gate.
// ---------------------------------------------------------------------------

/**
 * Build a V1 approval registry from the platform store.
 *
 * Folds `CreditLimitApproved`, `CreditLimitLoaded`, and
 * `CreditLimitWithdrawn` (V1 integer-payload events) into the same
 * `Map<counterpartyId, CreditLimitV2RegistryEntry>` shape, converting
 * minor-unit integers to MoneyWire on the fly. This lets the parity gate
 * compare V1 and V2 registries in a uniform shape.
 */
export function computeCreditLimitRegistryV1(
  store: EventStore,
  asOf = "2099-12-31",
): CreditLimitRegistry {
  const registry = new Map<string, CreditLimitV2RegistryEntry>();
  const provenanceFilter = defaultProvenanceFilter();

  // Inline V1 payload shapes to avoid pulling the full Zod schema here —
  // we only need the fields we fold on.
  interface V1ApprovedPayload {
    readonly applicationId: string;
    readonly counterpartyId: string;
    readonly limit: number;
    readonly currency: string;
    readonly tenor: string;
    readonly approvedBy: string;
    readonly approvalAuthority: CreditLimitV2RegistryEntry["approvalAuthority"];
    readonly approvedAt: string;
    readonly conditions: readonly string[];
    readonly expiryDate?: string;
  }
  interface V1LoadedPayload {
    readonly counterpartyId: string;
    readonly limit: number;
    readonly currency: string;
    readonly loadedAt: string;
    readonly effectiveFrom: string;
    readonly loadedBy: string;
  }
  interface V1WithdrawnPayload {
    readonly counterpartyId: string;
    readonly withdrawnReason: string;
    readonly withdrawnAt: string;
    readonly withdrawnBy: string;
  }

  // Fold in as_of order (see computeCreditLimitRegistryV2Uncached for the
  // rationale — append order is not a safe proxy after dual-run backfills).
  for (const e of sortedByAsOf(store, provenanceFilter, asOf)) {
    if (e.type === "CreditLimitApproved") {
      const p = e.payload as unknown as V1ApprovedPayload;
      const limit: MoneyWire = minorIntToMoneyWire(p.limit, p.currency);
      registry.set(p.counterpartyId, {
        approvedLimit: limit,
        loadedLimit: null,
        currentUtilisation: null,
        breachStatus: null,
        approvedAt: p.approvedAt,
        approvalAuthority: p.approvalAuthority,
        effectiveFrom: null,
        expiryDate: p.expiryDate ?? null,
        // V1 events carry no tenantId; use the anchor value as a proxy so
        // the parity comparison can exclude this field with `ignore`.
        // Two-step cast (string → unknown → TenantId) is necessary because
        // TenantId is a branded string — the value satisfies the Zod schema
        // at runtime; the cast only widens the TypeScript type.
        tenantId: "tenant:za-bank" as unknown as TenantId,
      });
      continue;
    }

    if (e.type === "CreditLimitLoaded") {
      const p = e.payload as unknown as V1LoadedPayload;
      const existing = registry.get(p.counterpartyId);
      if (!existing) continue;
      registry.set(p.counterpartyId, {
        ...existing,
        loadedLimit: minorIntToMoneyWire(p.limit, p.currency),
        effectiveFrom: p.effectiveFrom,
        breachStatus: existing.breachStatus === "withdrawn" ? "withdrawn" : "active",
      });
      continue;
    }

    if (e.type === "CreditLimitWithdrawn") {
      const p = e.payload as unknown as V1WithdrawnPayload;
      const existing = registry.get(p.counterpartyId);
      if (!existing) continue;
      registry.set(p.counterpartyId, {
        ...existing,
        breachStatus: "withdrawn",
      });
    }
  }

  return registry;
}

// ---------------------------------------------------------------------------
// Internal helper: convert a minor-unit integer to MoneyWire for V1 fold.
// ---------------------------------------------------------------------------

/**
 * Convert a minor-unit integer to a canonical MoneyWire.
 *
 * Delegates to `moneyWireFromMinor` from `platform/core/money-codec` which
 * uses the ISO 4217 exponent table and the Decimal engine (HALF_UP, no
 * IEEE-754 drift). This is the same function used by the V2 dual-run emitters
 * in `credit-limit-engine-v2.ts`, so the V1-fold MoneyWire values produced
 * here are byte-identical to the V2-emitted values — guaranteeing that the
 * parity comparison is a true equivalence check, not a format mismatch.
 */
function minorIntToMoneyWire(minor: number, currency: string): MoneyWire {
  return moneyWireFromMinor(minor, currency);
}
