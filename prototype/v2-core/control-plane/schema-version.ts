// v2-core/control-plane/schema-version.ts
//
// Explicit V2 envelope schema-version constants (D-EVENT-ENVELOPE-SCHEMA-VERSION).
//
// A PURE module (no `bun:sqlite`, no I/O) so the V2 envelope type can carry the
// go-forward version without dragging a database dependency into every importer
// of the envelope. The anchor-store DDL/append helper (`./anchor-store.ts`) and
// the envelope (`./envelope.ts`) both source the constant here.
//
// WHY EXPLICIT VERSIONS
// ---------------------
// V2 stops inferring an event's version from incidental payload shape (the
// historical `typeof payload.ead === "number"` sniff, which crashed dashboard
// boot in #1352 when a miss cast a legacy row straight to V2). Going forward
// every V2 event carries an EXPLICIT, queryable `schemaVersion`; the per-type
// current version lives in the event registry; upcaster dispatch switches on the
// explicit version. The shape-sniff survives ONLY as the permanent legacy
// fallback for pre-existing, un-stamped events in the immutable V1 store.
//
// PACKAGE BOUNDARY: inside `v2-core/`; no v1 import. See `recon:v2-no-v1-import`.
//
// Authority: D-EVENT-ENVELOPE-SCHEMA-VERSION (CEO-approved, session-delegation
//   2026-06-15); D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Substrate Architect, engineering).

/**
 * The schema version stamped on every NEW V2 event. New event types start at
 * version 1; a type whose payload shape changes increments its per-type version
 * in the registry and ships a version-keyed upcaster (asserted by
 * `recon:v2-multi-version-type-upcaster`).
 */
export const V2_ENVELOPE_SCHEMA_VERSION = 1 as const;

/**
 * The version assumed for pre-existing, UN-stamped legacy rows. Rows written
 * before the schema-version slice carry no explicit version; on read they
 * default to this value, and (for the legacy V1 platform store only) the
 * permanent shape-sniff fallback remains the discriminator.
 */
export const LEGACY_IMPLIED_SCHEMA_VERSION = 1 as const;
