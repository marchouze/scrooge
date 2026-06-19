// v2-core/registry/types.ts
//
// V2 event-type registry — shared types (Wave 0).
//
// This module is the v2-native MIRROR of the v1 registry's
// `platform/event-store/registry/types.ts`. It defines `V2EventTypeMetadata`
// — the per-event-type record the control-plane store consults to validate a
// payload against a registered Zod schema and to drive the same archive /
// cold-partition / recon tooling against the v2 store.
//
// WHY A V2-NATIVE COPY (not a re-use of the v1 types):
//   The v2 package has a HARD no-v1-import boundary (`recon:v2-no-v1-import`):
//   no file under `v2-core/` may import from `platform/`, `runtime/`, etc.
//   The v1 registry types live under `platform/`, so they cannot be imported
//   here. This module re-declares the small, stable subset the v2 host needs.
//   The two stay deliberately structurally compatible so the same operators,
//   recon tooling, and mental model transfer across both code-lines.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory. The only external dependency permitted is bare `zod`
// (and Node/Bun builtins). See `recon:v2-no-v1-import`.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
// D-EVENT-ENVELOPE-SCHEMA-VERSION; D-EVENT-STORE-SCALING (retention/archival
// tiers). Brief: brief:atlas:wave-0-v2-general-host-foundation-schemaversion-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import type { z } from "zod";

// ---------------------------------------------------------------------------
// Archival tier + retention class
// ---------------------------------------------------------------------------

/**
 * Archival-tier policy per event type. Structurally identical to the v1
 * `ArchivalTier` (platform/event-store/registry/types.ts §4.2). The control-
 * plane store persists this onto each row's `retention_class` column so the
 * shared archive / cold-partition tooling (Wave 5 deletion, Phase-5
 * retire-to-cold) can target the v2 store the same way it targets v1.
 *
 *   - "hot-only"         — never tiers down.
 *   - "hot-cool"         — hot 90 days then Cool indefinitely.
 *   - "hot-cool-archive" — hot 90 days, Cool 90 days, Archive thereafter.
 */
export type V2ArchivalTier = "hot-only" | "hot-cool" | "hot-cool-archive";

/**
 * Per-event-type retention metadata. Mirrors the v1 `RetentionMetadata` shape.
 *   - `minimumYears` — regulator-mandated retention floor.
 *   - `archivalTier` — cold-storage tier policy (the value persisted to the
 *                      store's `retention_class` column).
 *   - `citationRef`  — obligations-register URN / governance token grounding
 *                      the retention floor.
 */
export interface V2RetentionMetadata {
  readonly minimumYears: number;
  readonly archivalTier: V2ArchivalTier;
  readonly citationRef: string;
}

/**
 * Pre-canned retention class for v2 control-plane / substrate-infrastructure
 * event types. Internal platform events, 1-year minimum, hot→cool (no archive
 * tier — these are operational metadata, not regulated transaction records).
 * The 10 v2-parallel footholds are platform/substrate events, so they ride
 * this class until a domain-specific retention is classified.
 *
 * Mirrors v1 `RETENTION_RUNTIME_1Y`. The citation handle resolves into the
 * obligations register via the v1-side `recon:retention-citation-coverage`
 * gate (the v1 control-plane registry row already carries this same URN).
 */
export const V2_RETENTION_RUNTIME_1Y: V2RetentionMetadata = {
  minimumYears: 1,
  archivalTier: "hot-cool",
  citationRef: "urn:policy:bank:records-management:operational-substrate-retention:v1",
};

/**
 * Conservative default retention — Banks Act + SARB CS 3/2018 §12 5-year
 * floor; full tier-down. Any row using this default is an explicit "use the
 * strongest applicable floor pending classification" and is a follow-on to
 * refine. Mirrors v1 `RETENTION_CONSERVATIVE_DEFAULT`.
 */
export const V2_RETENTION_CONSERVATIVE_DEFAULT: V2RetentionMetadata = {
  minimumYears: 5,
  archivalTier: "hot-cool-archive",
  citationRef: "ORG-CS3-009",
};

/**
 * JSE-trade record retention — 7-year floor per the JSE Integrated Risk
 * Controls record-retention obligation (ORG-JSE-IRC-01); full tier-down. The
 * V2 mirror of the v1 `RETENTION_JSE_TRADE_7Y`, for V2-native trading /
 * pre-trade gateway records that carry the same 7-year market-record floor.
 */
export const V2_RETENTION_JSE_TRADE_7Y: V2RetentionMetadata = {
  minimumYears: 7,
  archivalTier: "hot-cool-archive",
  citationRef: "ORG-JSE-IRC-01",
};

// ---------------------------------------------------------------------------
// Event-type metadata
// ---------------------------------------------------------------------------

/**
 * Event class — the v2-native analogue of the v1 `EventTypeMetadata.class`.
 * Kept identical so the two registries stay legible to the same operators.
 */
export type V2EventClass = "runtime" | "markets" | "governance" | "audit";

/**
 * Migration status of a v2-hosted event type relative to v1 authority.
 * Mirrors the v1 `V2CutoverStatus`, with the v2 host's perspective:
 *
 *   - "v2-parallel" — a v2 model/projection runs in parallel; v1 is still the
 *                     authoritative emitter (the 10 footholds today).
 *   - "v2-canonical" — the v2 store is the SOLE authority for this type; no v1
 *                     equivalent emits (the target state once a domain flips,
 *                     and the natural state for v2-only / non-financial types
 *                     migrated in Waves 2-4).
 *   - "v1-only"     — declared on the v2 side ahead of its v2 model landing;
 *                     v1 remains the authority. (Reserved; no foothold uses it.)
 */
export type V2MigrationStatus = "v2-parallel" | "v2-canonical" | "v1-only";

/**
 * A payload codec applied by the generic V1→v2 store-tee when mirroring a V1
 * event into the v2 control-plane store. The tee passes the V1 event's payload
 * through this function and stores the result on the v2 row.
 *
 *   - Money-FREE types declare no codec → the tee mirrors the payload VERBATIM
 *     (`VERBATIM_CODEC`, the default).
 *   - Money-BEARING types declare a codec that upcasts `*Minor` integer fields
 *     into decimal-native `{currency, amount}` MoneyWire shapes (the same
 *     transform the V2 decimal-native cutover applies), so the v2 store holds
 *     the canonical decimal shape while the V1 source row stays minor-encoded.
 *
 * The codec is a PURE function of the V1 payload. It must be deterministic and
 * idempotent-compatible (the tee reuses the V1 event_id as the v2 idempotency
 * key, so re-mirroring re-applies the codec to the same input → same output).
 *
 * Authority: D-BANK-WIDE-V2-MIGRATION; D-V2-CORE-MONEY-DECIMAL-NATIVE.
 */
export type V2TeeCodec = (v1Payload: Record<string, unknown>) => Record<string, unknown>;

/**
 * Verbatim codec — the default for money-free types. The tee mirrors the V1
 * payload unchanged. Returns the SAME reference (the tee JSON-serialises it
 * downstream; no defensive copy is needed for a read-only pass-through).
 */
export const VERBATIM_CODEC: V2TeeCodec = (p) => p;

/**
 * Opt-in tee declaration on a v2 registry row. A type is mirrored by the
 * generic store-tee ONLY when its registry row carries a `tee` block — adding a
 * type to the rollout is a REGISTRY EDIT, never a callsite edit. Unregistered
 * types and registered-but-tee-less types are untouched by the tee.
 *
 *   - `codec` — payload transform applied on mirror (defaults to
 *     `VERBATIM_CODEC` when omitted, i.e. `tee: {}` mirrors verbatim).
 *
 * Authority: D-BANK-WIDE-V2-MIGRATION (Wave 2 generic store-tee).
 */
export interface V2TeeDeclaration {
  readonly codec?: V2TeeCodec;
}

/**
 * The per-event-type record the v2 host consults. The required `payloadSchema`
 * is the load-bearing field — `validateV2Payload` parses against it, so the
 * control-plane store fails closed on an invalid payload for a REGISTERED type
 * (and accepts an UNREGISTERED type until it is registered — the build-phase
 * forward-compat seam, identical to the v1 registry's behaviour).
 */
export interface V2EventTypeMetadata {
  /** Canonical type name. Matches the appended event's `type` literal. */
  readonly type: string;
  /** Event class — runtime / markets / governance / audit. */
  readonly class: V2EventClass;
  /**
   * Zod schema for the payload. REQUIRED on every v2 registry row — unlike the
   * v1 registry (where it is optional for legacy rows), the v2 host requires a
   * schema so a registered type is always validatable. Typed as
   * `z.ZodType<Record<string, unknown>>` so the registry array is homogeneous;
   * each row casts its concrete schema at the declaration site.
   */
  readonly payloadSchema: z.ZodType<Record<string, unknown>>;
  /**
   * Envelope schema version this row's payload shape corresponds to. Aligns
   * with `V2Envelope.schemaVersion`. The 10 footholds are all version 1.
   * A payload-shape change bumps this and adds an upcaster keyed on
   * `(type, schemaVersion)`. Authority: D-EVENT-ENVELOPE-SCHEMA-VERSION.
   */
  readonly schemaVersion: number;
  /** Per-type retention floor + archival-tier policy. */
  readonly retention: V2RetentionMetadata;
  /** Migration status relative to v1 authority. */
  readonly migrationStatus: V2MigrationStatus;
  /**
   * Opt-in store-tee declaration. When PRESENT, the generic V1→v2 store-tee
   * (wired at the composition seam) mirrors every V1 append of this type into
   * the v2 control-plane store, applying `tee.codec` (verbatim by default). When
   * ABSENT, the type is NOT mirrored — onboarding a type to the rollout is
   * adding this field, not editing any callsite. Authority:
   * D-BANK-WIDE-V2-MIGRATION (Wave 2 generic store-tee).
   */
  readonly tee?: V2TeeDeclaration;
  /** Source-spec reference (decision id, brief id, or slice note). */
  readonly source: string;
}
