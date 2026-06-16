// platform/risk/rwa-computed-engine-v2.ts
//
// Bucket A PILOT — the decimal-native V2 emitter for RwaComputed.
//
// `emitRwaComputedV2` is the V2 SOLE LIVE PATH for the Pillar-1 RWA
// decomposition (D-V1-REMOVAL-FLIP-BASIS-RBC condition 2). It reuses the pure
// `computeRwaComputed` projection (the same CRE20-over-readDebtExposures credit
// fold + 12.5×-BA-320 market fold + gross-income-blocked operational placeholder)
// and lifts the four minor-unit RWA figures to MoneyWire (MAJOR-unit decimal
// string) at the emit boundary via the shared `moneyWireFromMinor` codec.
//
// Why convert at the emit boundary rather than recompute decimal-native end to
// end: the upstream credit engine (`rwa-engine.ts:computeRwa`) and the BA 320
// market-risk return (`totalMarketRiskRwaMinor`) are still minor-unit integer
// projections. `moneyWireFromMinor` is the LOSSLESS exact-integer → decimal-
// string conversion (the same converter the credit-limit S4 V2 dual-run used);
// no float ever enters the path. Recomputing the credit/market engines fully
// decimal-native is a separate FIL track (the engines' minor figures are exact
// integers today, so the boundary lift is value-preserving). This is stated on
// the registry row and the recon gate, not concealed (Charter cmd 5).
//
// The V2 event is emitted into the SAME authoritative V1 event store (NOT the
// v2 control-plane store — money-bearing types stay decimal-native in the
// authoritative store; the control-plane mirror is the money-free reference-
// data pattern). It carries the SAME idempotency contract as V1: one
// RwaComputedV2 per (entity, periodId).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-RWA-ENGINE-W2-SLICE-3.
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Build spec: prototype/docs/bucket-a-money-bearing-nonfinancial-scope.md §5.2.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { decodeMoney } from "../core/money-codec";
import { moneyWireFromMinor } from "../core/money-codec";
import { makeRwaComputedV2 } from "../event-store/event-types/regulatory-reporting-v2";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../projections/filter";
import {
  type ComputeRwaComputedInput,
  type RwaComputedResult,
  computeRwaComputed,
} from "./rwa-computed-engine";

const ACTOR: Actor = { type: "service", id: "agent:bea:rwa-computed-engine" };

/** ISO 4217 currency the RWA MoneyWire figures are denominated in. */
const RWA_CURRENCY = "ZAR" as const;

// ---------------------------------------------------------------------------
// Decoded-decimal RWA decomposition — the parity comparison shape.
// ---------------------------------------------------------------------------

/**
 * A store-independent, decoded-decimal view of an RWA decomposition. Both the
 * V1 (minor-int) and V2 (MoneyWire) registers project onto this shape so
 * `recon:rwa-computed-v2-parity` can compare them on DECODED DECIMAL VALUE
 * (byte-comparison across a unit change is meaningless — precedent
 * recon:fx-v2-parity). The decimal strings are canonical (via decodeMoney /
 * moneyWireFromMinor → MoneyWire → decodeMoney), so equal economic figures
 * serialise identically regardless of source encoding.
 */
export interface RwaDecodedDecimal {
  readonly entityId: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  readonly creditRwa: string;
  readonly marketRwa: string;
  readonly operationalRwa: string;
  readonly totalRwa: string;
  readonly source: string;
  readonly operationalRwaIsPlaceholder: boolean;
  readonly creditExposureCount: number;
  /** The event_id of the underlying RwaComputed / RwaComputedV2 event. */
  readonly eventId: string;
}

// ---------------------------------------------------------------------------
// Emit — append a RwaComputedV2 event (decimal-native) for a computed period.
// ---------------------------------------------------------------------------

export interface EmitRwaComputedV2Result {
  /** True when a new RwaComputedV2 event was appended. */
  readonly emitted: boolean;
  /** The event_id of the (new or pre-existing) RwaComputedV2 event. */
  readonly eventId: string;
  readonly result: RwaComputedResult;
}

/**
 * True iff a `RwaComputedV2` event already exists for `(entity, periodId)`.
 * One RWA computation per closed period; a same-period re-run is a no-op.
 */
export function rwaComputedV2Exists(store: EventStore, entity: string, periodId: string): boolean {
  for (const ev of store.replay({ entity, type: "RwaComputedV2" })) {
    const p = ev.payload as { periodId?: string };
    if (p.periodId === periodId) return true;
  }
  return false;
}

/**
 * Compute + (idempotently) emit a `RwaComputedV2` event for a closed period.
 *
 * Decimal-native: the four RWA figures are carried as MoneyWire (MAJOR-unit
 * decimal string), lifted from the engine's exact minor-unit integers via
 * `moneyWireFromMinor`. If a `RwaComputedV2` already exists for `(entity,
 * periodId)`, this is a no-op (`emitted: false`).
 *
 * This is the V2 SOLE LIVE PATH (RBC condition 2): the period-close handler
 * calls this instead of the retired V1 `emitRwaComputed`.
 */
export function emitRwaComputedV2(
  store: EventStore,
  input: ComputeRwaComputedInput,
): EmitRwaComputedV2Result {
  const result = computeRwaComputed(store, input);

  // Idempotency: one RwaComputedV2 per (entity, periodId).
  for (const ev of store.replay({ entity: input.entityId, type: "RwaComputedV2" })) {
    const p = ev.payload as { periodId?: string };
    if (p.periodId === input.periodId) {
      return { emitted: false, eventId: ev.event_id, result };
    }
  }

  const event: Event = makeRwaComputedV2({
    asOf: input.asOf,
    entity: input.entityId,
    actor: ACTOR,
    citations: [...result.citations],
    payload: {
      entityId: result.entityId,
      asOf: result.asOf,
      periodId: result.periodId,
      functionalCurrency: result.functionalCurrency,
      creditRwa: moneyWireFromMinor(result.creditRwaMinor, RWA_CURRENCY),
      marketRwa: moneyWireFromMinor(result.marketRwaMinor, RWA_CURRENCY),
      operationalRwa: moneyWireFromMinor(result.operationalRwaMinor, RWA_CURRENCY),
      totalRwa: moneyWireFromMinor(result.totalRwaMinor, RWA_CURRENCY),
      source: result.source,
      operationalRwaIsPlaceholder: result.operationalRwaIsPlaceholder,
      sourceEventIds: [...result.sourceEventIds],
      creditExposureCount: result.creditExposureCount,
      citations: [...result.citations],
    },
  });
  store.append(event);

  return { emitted: true, eventId: event.event_id, result };
}

// ---------------------------------------------------------------------------
// Readers — decoded-decimal projection of each register, for parity.
// ---------------------------------------------------------------------------

/**
 * Read the latest V1 `RwaComputed` event per `(entity, periodId)` and project
 * it onto the decoded-decimal shape (minor-int → MoneyWire → canonical decimal
 * string). Returns one row per period; latest-wins (sequence-ordered replay).
 * Provenance-filtered (defaults to the production filter).
 */
export function readRwaComputedV1Decoded(
  store: EventStore,
  opts?: { readonly provenanceFilter?: ProvenanceFilter },
): RwaDecodedDecimal[] {
  const filter = opts?.provenanceFilter ?? defaultProvenanceFilter();
  const latestByKey = new Map<string, RwaDecodedDecimal>();
  for (const ev of store.replay({ type: "RwaComputed" })) {
    if (!eventMatchesProvenanceFilter(ev, filter)) continue;
    const p = ev.payload as Record<string, unknown>;
    const key = `${String(p.entityId)}::${String(p.periodId)}`;
    latestByKey.set(key, {
      entityId: String(p.entityId),
      periodId: String(p.periodId),
      functionalCurrency: String(p.functionalCurrency),
      creditRwa: decodeMoney(moneyWireFromMinor(Number(p.creditRwaMinor ?? 0), RWA_CURRENCY))
        .amount,
      marketRwa: decodeMoney(moneyWireFromMinor(Number(p.marketRwaMinor ?? 0), RWA_CURRENCY))
        .amount,
      operationalRwa: decodeMoney(
        moneyWireFromMinor(Number(p.operationalRwaMinor ?? 0), RWA_CURRENCY),
      ).amount,
      totalRwa: decodeMoney(moneyWireFromMinor(Number(p.totalRwaMinor ?? 0), RWA_CURRENCY)).amount,
      source: String(p.source ?? ""),
      operationalRwaIsPlaceholder: Boolean(p.operationalRwaIsPlaceholder),
      creditExposureCount: Number(p.creditExposureCount ?? 0),
      eventId: ev.event_id,
    });
  }
  return [...latestByKey.values()].sort((a, b) => a.periodId.localeCompare(b.periodId));
}

/**
 * Read the latest V2 `RwaComputedV2` event per `(entity, periodId)` and project
 * it onto the decoded-decimal shape (MoneyWire → canonical decimal string).
 * Provenance-filtered (defaults to the production filter).
 */
export function readRwaComputedV2Decoded(
  store: EventStore,
  opts?: { readonly provenanceFilter?: ProvenanceFilter },
): RwaDecodedDecimal[] {
  const filter = opts?.provenanceFilter ?? defaultProvenanceFilter();
  const latestByKey = new Map<string, RwaDecodedDecimal>();
  for (const ev of store.replay({ type: "RwaComputedV2" })) {
    if (!eventMatchesProvenanceFilter(ev, filter)) continue;
    const p = ev.payload as Record<string, unknown>;
    const key = `${String(p.entityId)}::${String(p.periodId)}`;
    latestByKey.set(key, {
      entityId: String(p.entityId),
      periodId: String(p.periodId),
      functionalCurrency: String(p.functionalCurrency),
      creditRwa: decodeMoney(p.creditRwa).amount,
      marketRwa: decodeMoney(p.marketRwa).amount,
      operationalRwa: decodeMoney(p.operationalRwa).amount,
      totalRwa: decodeMoney(p.totalRwa).amount,
      source: String(p.source ?? ""),
      operationalRwaIsPlaceholder: Boolean(p.operationalRwaIsPlaceholder),
      creditExposureCount: Number(p.creditExposureCount ?? 0),
      eventId: ev.event_id,
    });
  }
  return [...latestByKey.values()].sort((a, b) => a.periodId.localeCompare(b.periodId));
}
