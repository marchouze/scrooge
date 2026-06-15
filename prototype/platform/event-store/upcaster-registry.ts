// platform/event-store/upcaster-registry.ts
//
// Version-explicit upcaster dispatch (D-EVENT-ENVELOPE-SCHEMA-VERSION).
//
// THE PROBLEM THIS REPLACES
// -------------------------
// Historically an event's version was INFERRED from incidental payload shape —
// e.g. `normalizeCcrEadPayload` used `typeof payload.ead === "number"` to detect
// a legacy V1 `CcrEadComputed`. That sniff is fragile and uncheckable: a miss
// crashed dashboard boot (#1352). It is non-uniform — every type that ever
// changed shape grew its own ad-hoc discriminator.
//
// THE GO-FORWARD MODEL
// --------------------
// 1. The go-forward V2 envelope carries an EXPLICIT `schemaVersion` (stamped at
//    append; persisted as a first-class `schema_version` column).
// 2. The event registry records the CURRENT version per event type
//    (`EventTypeMetadata.schemaVersion`).
// 3. This module is the central, version-KEYED upcaster registry: for each event
//    type that has had >1 version, a declared upcaster maps every prior version
//    forward to the current shape. Dispatch switches on the EXPLICIT version, not
//    a payload sniff.
//
// THE PERMANENT LEGACY FALLBACK
// -----------------------------
// Pre-existing, un-stamped legacy events in the immutable V1 store carry NO
// explicit version. For THOSE — and only those — a registered upcaster may carry
// a `legacyShapeSniff` discriminator: a predicate over the raw payload that
// decides whether an un-versioned row is the legacy V1 shape. This is the
// permanent fallback; it is NEVER used to discriminate a NEW (stamped) version.
//
// THE ENFORCING GATE
// ------------------
// `recon:v2-multi-version-type-upcaster` asserts (fail-closed): every event type
// whose registry `schemaVersion > 1` has a declared upcaster here covering every
// version from 1 up to current-1. A new version with no declared upcaster — i.e.
// a silent shape-sniff for a new version — fails CI.
//
// Authority: D-EVENT-ENVELOPE-SCHEMA-VERSION (CEO-approved, session-delegation
//   2026-06-15); D-ENGINEERING-INTEGRITY-CHARTER (Engineering Charter — #6 the
//   type system is a tool; #2 fail-closed; #9 replay-safe).
// Author: Atlas (Substrate Architect, engineering).

import {
  type CcrEadComputedPayloadV2Type,
  decodeCcrEadComputed,
  isLegacyCcrEadShape,
} from "./event-types/counterparty-credit-risk";
import type { CcrEadComputedPayload } from "./event-types/counterparty-credit-risk";

// ---------------------------------------------------------------------------
// Upcaster shapes
// ---------------------------------------------------------------------------

/**
 * A single version-step upcaster: takes a payload at version N and returns the
 * payload at version N+1. Pure; no I/O. The chain of steps composes V1 → current.
 */
export type VersionUpcaster = (payload: Record<string, unknown>) => Record<string, unknown>;

/**
 * A predicate over a RAW (un-versioned) payload that decides whether the row is
 * the legacy V1 shape. The PERMANENT fallback for pre-existing, un-stamped
 * events in the immutable V1 store. NEVER used to discriminate a stamped
 * version. Optional — a type whose legacy events are already stamped (or which
 * has no legacy events) omits it.
 */
export type LegacyShapeSniff = (payload: Record<string, unknown>) => boolean;

/**
 * The upcaster declaration for one event type that has had more than one
 * payload version.
 */
export interface TypeUpcasterDeclaration {
  /** The event type this declaration covers. */
  readonly type: string;
  /**
   * The current version (must equal the registry's `schemaVersion` for the type;
   * the recon gate asserts the equality).
   */
  readonly currentVersion: number;
  /**
   * Version-step upcasters, keyed by the SOURCE version. `steps[N]` upcasts a
   * version-N payload to version N+1. The gate asserts a step exists for every
   * version from 1 to currentVersion-1 (a complete chain).
   */
  readonly steps: ReadonlyMap<number, VersionUpcaster>;
  /**
   * The permanent legacy shape-sniff for pre-existing un-stamped V1 rows. When
   * present, an un-versioned payload that matches is treated as version 1;
   * otherwise it is treated as already-current. Optional.
   */
  readonly legacyShapeSniff?: LegacyShapeSniff;
}

// ---------------------------------------------------------------------------
// Declarations — one entry per multi-version event type.
// ---------------------------------------------------------------------------

/**
 * `CcrEadComputed`: V1 carried `rc`/`pfe`/`ead` as bare integer MINOR units; V2
 * carries them as `MoneyWire` decimal-native values. The version-1→2 step is
 * `decodeCcrEadComputed`. The legacy shape-sniff (`typeof ead === "number"`) is
 * retained as the PERMANENT fallback for the immutable, un-stamped V1 events
 * already in the store — exactly the discriminator the old
 * `normalizeCcrEadPayload` used, now confined to the legacy path.
 */
const CCR_EAD_COMPUTED_UPCASTER: TypeUpcasterDeclaration = {
  type: "CcrEadComputed",
  currentVersion: 2,
  steps: new Map<number, VersionUpcaster>([
    [
      1,
      (payload) =>
        decodeCcrEadComputed(payload as unknown as CcrEadComputedPayload) as unknown as Record<
          string,
          unknown
        >,
    ],
  ]),
  legacyShapeSniff: (payload) => isLegacyCcrEadShape(payload),
};

/**
 * The canonical version-keyed upcaster registry, keyed by event type. Every
 * event type whose registry `schemaVersion > 1` MUST appear here with a complete
 * version-step chain — enforced by `recon:v2-multi-version-type-upcaster`.
 */
export const UPCASTER_REGISTRY: ReadonlyMap<string, TypeUpcasterDeclaration> = new Map([
  [CCR_EAD_COMPUTED_UPCASTER.type, CCR_EAD_COMPUTED_UPCASTER],
]);

// ---------------------------------------------------------------------------
// Version-explicit dispatch
// ---------------------------------------------------------------------------

/**
 * Resolve the effective version of a (possibly un-stamped) payload for a type.
 *
 * - If `explicitVersion` is supplied (the go-forward path — read from the
 *   envelope's `schema_version` column), it is authoritative; no sniffing.
 * - Else (a pre-existing un-stamped legacy row), apply the declaration's
 *   `legacyShapeSniff` if present: a match means version 1; a non-match means the
 *   payload is already current. With no declaration / no sniff, the row is
 *   assumed current (version = `currentVersion`, defaulting to 1).
 */
export function resolveEffectiveVersion(
  type: string,
  payload: Record<string, unknown>,
  explicitVersion?: number,
): number {
  if (explicitVersion !== undefined) return explicitVersion;
  const decl = UPCASTER_REGISTRY.get(type);
  if (!decl) return 1;
  if (decl.legacyShapeSniff?.(payload)) return 1;
  return decl.currentVersion;
}

/**
 * Upcast a payload to the current version for its type, switching on the
 * EXPLICIT version (falling back to the legacy shape-sniff only for un-stamped
 * legacy rows). For a type with no multi-version declaration the payload passes
 * through unchanged. Fail-closed: a declared version with a missing upcaster
 * step throws (the recon gate prevents this reaching production, but the runtime
 * never silently mis-reads).
 *
 * @param type            - the event type
 * @param payload         - the raw payload (as stored)
 * @param explicitVersion - the envelope's `schema_version`, when present
 */
export function upcastPayload(
  type: string,
  payload: Record<string, unknown>,
  explicitVersion?: number,
): Record<string, unknown> {
  const decl = UPCASTER_REGISTRY.get(type);
  if (!decl) return payload;

  let version = resolveEffectiveVersion(type, payload, explicitVersion);
  let current = payload;
  while (version < decl.currentVersion) {
    const step = decl.steps.get(version);
    if (!step) {
      throw new Error(
        `upcaster-registry: event type "${type}" has no declared upcaster step for version ${version} → ${
          version + 1
        } (chain to current version ${decl.currentVersion} is incomplete). This is a fail-closed invariant — recon:v2-multi-version-type-upcaster must catch it before runtime.`,
      );
    }
    current = step(current);
    version += 1;
  }
  return current;
}

/**
 * Typed convenience for `CcrEadComputed`: upcast a raw payload to the V2
 * MoneyWire shape via the version-explicit registry. The drop-in replacement for
 * `normalizeCcrEadPayload`'s sniff — read-side consumers pass the envelope's
 * `schema_version` when they have it; legacy un-stamped rows fall back to the
 * retained shape-sniff.
 */
export function upcastCcrEadComputed(
  payload: Record<string, unknown>,
  explicitVersion?: number,
): CcrEadComputedPayloadV2Type {
  return upcastPayload("CcrEadComputed", payload, explicitVersion) as CcrEadComputedPayloadV2Type;
}
