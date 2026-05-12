// platform/event-store/registry/index.ts
//
// F-021 (Atlas, 2026-05-12): thin barrel re-exporting all registry types,
// constants, domain arrays, and utility functions.
//
// This barrel preserves the original `registry.ts` public surface so no
// callers need to change their import paths. The monolithic `registry.ts`
// becomes a shim that re-exports from here.
//
// Domain modules:
//   - types.ts       — shared interfaces and retention constants
//   - runtime.ts     — RUNTIME_EVENT_TYPES, GOAL_LOOP_EVENT_TYPES
//   - model-risk.ts  — MODEL_REGISTRY_EVENT_TYPES
//   - markets.ts     — MARKETS_EVENT_TYPES, BANK_ACCOUNT_EVENT_TYPES,
//                      PERIOD_CLOSE_EVENT_TYPES, CUSTOMER_LIFECYCLE_EVENT_TYPES
//   - governance.ts  — GOVERNANCE_EVENT_TYPES, AUDIT_EVENT_TYPES,
//                      LEGAL_ENTITY_EVENT_TYPES, PARTY_EVENT_TYPES_REGISTRY,
//                      PRODUCT_LIFECYCLE_EVENT_TYPES, RMS_EVENT_TYPES,
//                      RAS_EVENT_TYPES, READINESS_SNAPSHOT_EVENT_TYPES

export type {
  ArchivalTier,
  EventTypeMetadata,
  EventTypeStatus,
  ReplayFold,
  RetentionMetadata,
  SnapshotCadence,
} from "./types";

export {
  DEFAULT_SNAPSHOT_CADENCE,
  RETENTION_ACCOUNTING_7Y,
  RETENTION_BANKING_5Y,
  RETENTION_CONSERVATIVE_DEFAULT,
  RETENTION_FIC_5Y,
  RETENTION_GOVERNANCE_7Y,
  RETENTION_JSE_TRADE_7Y,
  RETENTION_RUNTIME_1Y,
} from "./types";

export { GOAL_LOOP_EVENT_TYPES, RUNTIME_EVENT_TYPES } from "./runtime";
export { MODEL_REGISTRY_EVENT_TYPES } from "./model-risk";
export {
  BANK_ACCOUNT_EVENT_TYPES,
  CUSTOMER_LIFECYCLE_EVENT_TYPES,
  MARKETS_EVENT_TYPES,
  PERIOD_CLOSE_EVENT_TYPES,
} from "./markets";
export {
  AUDIT_EVENT_TYPES,
  GOVERNANCE_EVENT_TYPES,
  LEGAL_ENTITY_EVENT_TYPES,
  PARTY_EVENT_TYPES_REGISTRY,
  PRODUCT_LIFECYCLE_EVENT_TYPES,
  RAS_EVENT_TYPES,
  READINESS_SNAPSHOT_EVENT_TYPES,
  RMS_EVENT_TYPES,
} from "./governance";

// ---------------------------------------------------------------------------
// Combined registry — re-assembly of all domain arrays into the flat list
// that the original registry.ts exported as EVENT_TYPE_REGISTRY.
// ---------------------------------------------------------------------------

import {
  AUDIT_EVENT_TYPES,
  GOVERNANCE_EVENT_TYPES,
  LEGAL_ENTITY_EVENT_TYPES,
  PARTY_EVENT_TYPES_REGISTRY,
  PRODUCT_LIFECYCLE_EVENT_TYPES,
  RAS_EVENT_TYPES,
  READINESS_SNAPSHOT_EVENT_TYPES,
  RMS_EVENT_TYPES,
} from "./governance";
import {
  BANK_ACCOUNT_EVENT_TYPES,
  CUSTOMER_LIFECYCLE_EVENT_TYPES,
  MARKETS_EVENT_TYPES,
  PERIOD_CLOSE_EVENT_TYPES,
} from "./markets";
import { MODEL_REGISTRY_EVENT_TYPES } from "./model-risk";
import { GOAL_LOOP_EVENT_TYPES, RUNTIME_EVENT_TYPES } from "./runtime";
import type { EventTypeMetadata, EventTypeStatus } from "./types";

/**
 * Full registry — flat list. Keep RUNTIME / GOVERNANCE / AUDIT split
 * above for readability; the consumer-facing surface is this combined
 * array.
 */
export const EVENT_TYPE_REGISTRY: readonly EventTypeMetadata[] = [
  ...RUNTIME_EVENT_TYPES,
  ...MODEL_REGISTRY_EVENT_TYPES,
  ...MARKETS_EVENT_TYPES,
  ...GOVERNANCE_EVENT_TYPES,
  ...AUDIT_EVENT_TYPES,
  ...LEGAL_ENTITY_EVENT_TYPES,
  ...PARTY_EVENT_TYPES_REGISTRY,
  ...PRODUCT_LIFECYCLE_EVENT_TYPES,
  ...RMS_EVENT_TYPES,
  ...BANK_ACCOUNT_EVENT_TYPES,
  ...PERIOD_CLOSE_EVENT_TYPES,
  ...RAS_EVENT_TYPES,
  ...READINESS_SNAPSHOT_EVENT_TYPES,
  ...GOAL_LOOP_EVENT_TYPES,
  ...CUSTOMER_LIFECYCLE_EVENT_TYPES,
];

const REGISTRY_BY_TYPE: ReadonlyMap<string, EventTypeMetadata> = new Map(
  EVENT_TYPE_REGISTRY.map((m) => [m.type, m]),
);

/**
 * Look up a type's registered metadata. Returns undefined for types
 * that aren't in the registry (which is fine in build phase — the
 * envelope-only path still validates and appends them).
 *
 * The returned record normalises `status` to `"active"` when the row
 * was authored before the `status` field was introduced (D-PARTY-REGISTER
 * PR 4, 2026-05-11) so callers can always compare
 * `meta.status === "deprecated"` without an undefined guard.
 */
export function lookupEventType(
  type: string,
): (EventTypeMetadata & { status: EventTypeStatus }) | undefined {
  const meta = REGISTRY_BY_TYPE.get(type);
  if (!meta) return undefined;
  return { ...meta, status: meta.status ?? "active" };
}

/**
 * Validate a payload against the registered schema for `type`.
 *
 * Behaviour:
 *   - Type registered with payloadSchema → schema.parse() throws on bad
 *     payload (caller propagates as append failure).
 *   - Type registered without payloadSchema → no-op (envelope-only).
 *   - Type not in registry → no-op (build-phase forward compat). Will
 *     tighten to fail-closed once Vera's #11 / #12 pipelines assert
 *     the registry is complete.
 *
 * The top-level `eventSchema` envelope is validated separately by the
 * EventStore's append; this is the type-dispatched layer on top.
 */
export function validatePayload(type: string, payload: Record<string, unknown>): void {
  const meta = REGISTRY_BY_TYPE.get(type);
  if (!meta || !meta.payloadSchema) return;
  meta.payloadSchema.parse(payload);
}

/**
 * Issuer/subscriber matrix view — used by the dashboard health page,
 * Atlas's permission-policy generator (A2), and Vera's coverage recon.
 *
 * Returns an array of {issuer, eventTypes} groups. Stable sort: issuer
 * name then event-type name.
 */
export function issuerMatrix(): ReadonlyArray<{
  readonly issuer: string;
  readonly eventTypes: readonly string[];
}> {
  const grouped = new Map<string, string[]>();
  for (const m of EVENT_TYPE_REGISTRY) {
    const arr = grouped.get(m.issuer) ?? [];
    arr.push(m.type);
    grouped.set(m.issuer, arr);
  }
  return [...grouped.entries()]
    .map(([issuer, eventTypes]) => ({ issuer, eventTypes: eventTypes.slice().sort() }))
    .sort((a, b) => a.issuer.localeCompare(b.issuer));
}

/**
 * Per-subscriber view — every event type a given subscriber agent (or
 * "external" / "audit" / "dashboard") consumes. Symmetric to
 * issuerMatrix(); needed for permission-policy event-subscribe
 * allow-lists.
 */
export function subscriberMatrix(): ReadonlyArray<{
  readonly subscriber: string;
  readonly eventTypes: readonly string[];
}> {
  const grouped = new Map<string, string[]>();
  for (const m of EVENT_TYPE_REGISTRY) {
    for (const s of m.subscribers) {
      const arr = grouped.get(s) ?? [];
      arr.push(m.type);
      grouped.set(s, arr);
    }
  }
  return [...grouped.entries()]
    .map(([subscriber, eventTypes]) => ({ subscriber, eventTypes: eventTypes.slice().sort() }))
    .sort((a, b) => a.subscriber.localeCompare(b.subscriber));
}
