// v2-core/registry/index.ts
//
// V2 event-type registry (Wave 0) — the v2-native type registry + payload
// validation that lets non-financial (governance / records / reference) events
// become canonical on the v2 control-plane store.
//
// This is the v2 MIRROR of the v1 registry barrel
// (platform/event-store/registry/index.ts). It assembles every v2-core event
// type into `V2_EVENT_TYPE_REGISTRY`, indexes them by type, and exposes:
//   - `lookupV2EventType(type)` — registered metadata, or undefined.
//   - `validateV2Payload(type, payload)` — fail-closed on a REGISTERED type's
//     bad payload; no-op on an UNREGISTERED type (build-phase forward compat,
//     so footholds keep appending until registered). The control-plane store's
//     `append()` calls this before persisting.
//
// THE 10 V2-PARALLEL FOOTHOLDS — every v2-core slice that has a v1-side
// registry row referencing its schemas (the existing parallel registration)
// is registered here as a first-class v2-native entry:
//
//   1.  control-plane  — TenantRegistered, TenantSurfaceGranted,
//                        TenantUpgradeLedgerEntry, TenantMeterEvent,
//                        FunctionalSeatRegistered
//   2.  banking        — V2ProductRegistered, V2ProductDeprecated,
//                        V2AccountTypeRegistered, V2RiskAppetiteSet
//   3.  fil-instances  — FilInstrumentCreated/Amended/Terminated
//   4.  fil-attribution— InstrumentDimensionAssigned, SliceDefined,
//                        OrgHierarchyEdgeAssigned
//   5.  posture        — PostureRegistered/Activated/Deactivated/Revised
//   6.  applicability  — ApplicabilityAssessmentRequested/Performed/Concluded
//   7.  decision-impact— DecisionImpactSweepRequested, DecisionImpactAssessed
//   8.  eval           — ExamSetRegistered, EvalRunCompleted
//   9.  context-pack   — ContextPackBuilt
//   10. cross-tenant   — CsiCategoryRegistered, CsiCategoryRetired,
//                        CrossTenantLearningScreened, CrossTenantLearningBlocked
//
// All 10 are `schemaVersion 1` and `migrationStatus "v2-parallel"` (v1 is still
// the authoritative emitter; the v2 model runs in parallel). Waves 2-4 add
// non-financial types with `migrationStatus "v2-canonical"`.
//
// BANKING NOTE: the banking slice (`v2-core/banking/events.ts`) carries a
// `kind` discriminator literal IN its payload schema (e.g.
// `kind: z.literal("V2ProductRegistered")`). The registry's `type` field and
// the payload's `kind` field therefore agree by construction — the schema
// validates the full stored payload object including the `kind` literal.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory. See `recon:v2-no-v1-import`.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16).
// Brief: brief:atlas:wave-0-v2-general-host-foundation-schemaversion-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import type { z } from "zod";

import {
  applicabilityAssessmentConcludedPayloadSchema,
  applicabilityAssessmentPerformedPayloadSchema,
  applicabilityAssessmentRequestedPayloadSchema,
} from "../applicability/events";
import {
  v2AccountTypeRegisteredSchema,
  v2ProductDeprecatedSchema,
  v2ProductRegisteredSchema,
  v2RiskAppetiteSetSchema,
} from "../banking/events";
import { contextPackBuiltPayloadSchema } from "../context-pack/events";
import {
  functionalSeatRegisteredPayloadSchema,
  tenantMeterEventPayloadSchema,
  tenantRegisteredPayloadSchema,
  tenantSurfaceGrantedPayloadSchema,
  tenantUpgradeLedgerEntryPayloadSchema,
} from "../control-plane/events";
import {
  csiCategoryRegisteredPayloadSchema,
  csiCategoryRetiredPayloadSchema,
} from "../cross-tenant/csi-blocklist";
import {
  crossTenantLearningBlockedPayloadSchema,
  crossTenantLearningScreenedPayloadSchema,
} from "../cross-tenant/gate";
import {
  decisionImpactAssessedPayloadSchema,
  decisionImpactSweepRequestedPayloadSchema,
} from "../decision-impact/events";
import { evalRunCompletedPayloadSchema, examSetRegisteredPayloadSchema } from "../eval/events";
import {
  instrumentDimensionAssignedPayloadSchema,
  orgHierarchyEdgeAssignedPayloadSchema,
  sliceDefinedPayloadSchema,
} from "../fil-attribution/events";
import {
  filInstrumentAmendedPayloadSchema,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../fil-instances/events";
import {
  postureActivatedPayloadSchema,
  postureDeactivatedPayloadSchema,
  postureRegisteredPayloadSchema,
  postureRevisedPayloadSchema,
} from "../posture/events";
import {
  type V2EventTypeMetadata,
  type V2TeeCodec,
  type V2TeeDeclaration,
  V2_RETENTION_RUNTIME_1Y,
  VERBATIM_CODEC,
} from "./types";

export * from "./types";

// ---------------------------------------------------------------------------
// Schema-cast helper.
//
// Each slice's payload schema is typed `z.ZodType<ConcretePayload>`. The
// registry array is homogeneous (`z.ZodType<Record<string, unknown>>`), so each
// row casts at the declaration site. This is the same `as unknown as` bridge
// the v1-side adapter rows use (e.g. registry/v2-control-plane.ts) — payloads
// ARE `Record<string, unknown>` at the JSON-storage boundary; the concrete
// branded type is a compile-time refinement the homogeneous array cannot carry.
// ---------------------------------------------------------------------------

function asPayloadSchema(schema: z.ZodTypeAny): z.ZodType<Record<string, unknown>> {
  return schema as unknown as z.ZodType<Record<string, unknown>>;
}

const FOOTHOLD_SOURCE =
  "brief:atlas:wave-0-v2-general-host-foundation-schemaversion-:2026-06-16 — v2-parallel foothold";

/**
 * Shared field set for every foothold row (all v2-parallel, schemaVersion 1).
 * `tee` is optional: pass a declaration (`{}` for verbatim, or `{ codec }` for a
 * money-bearing transform) to opt the type into the generic store-tee. Omit it
 * to leave the type un-mirrored.
 */
function foothold(
  type: string,
  cls: V2EventTypeMetadata["class"],
  schema: z.ZodTypeAny,
  tee?: V2TeeDeclaration,
): V2EventTypeMetadata {
  return {
    type,
    class: cls,
    payloadSchema: asPayloadSchema(schema),
    schemaVersion: 1,
    retention: V2_RETENTION_RUNTIME_1Y,
    migrationStatus: "v2-parallel",
    ...(tee !== undefined ? { tee } : {}),
    source: FOOTHOLD_SOURCE,
  };
}

// ---------------------------------------------------------------------------
// The registry — every foothold event type with its Zod schema.
// ---------------------------------------------------------------------------

export const V2_EVENT_TYPE_REGISTRY: readonly V2EventTypeMetadata[] = [
  // 1. control-plane
  foothold("TenantRegistered", "runtime", tenantRegisteredPayloadSchema),
  foothold("TenantSurfaceGranted", "runtime", tenantSurfaceGrantedPayloadSchema),
  foothold("TenantUpgradeLedgerEntry", "runtime", tenantUpgradeLedgerEntryPayloadSchema),
  foothold("TenantMeterEvent", "runtime", tenantMeterEventPayloadSchema),
  foothold("FunctionalSeatRegistered", "governance", functionalSeatRegisteredPayloadSchema),

  // 2. banking (slice's own schemas — payload carries a `kind` discriminator)
  foothold("V2ProductRegistered", "governance", v2ProductRegisteredSchema),
  foothold("V2ProductDeprecated", "governance", v2ProductDeprecatedSchema),
  foothold("V2AccountTypeRegistered", "governance", v2AccountTypeRegisteredSchema),
  foothold("V2RiskAppetiteSet", "governance", v2RiskAppetiteSetSchema),

  // 3. fil-instances
  foothold("FilInstrumentCreated", "markets", filInstrumentCreatedPayloadSchema),
  foothold("FilInstrumentAmended", "markets", filInstrumentAmendedPayloadSchema),
  foothold("FilInstrumentTerminated", "markets", filInstrumentTerminatedPayloadSchema),

  // 4. fil-attribution
  foothold("InstrumentDimensionAssigned", "markets", instrumentDimensionAssignedPayloadSchema),
  foothold("SliceDefined", "markets", sliceDefinedPayloadSchema),
  foothold("OrgHierarchyEdgeAssigned", "markets", orgHierarchyEdgeAssignedPayloadSchema),

  // 5. posture — TEE-ENABLED (verbatim; money-free). The generic store-tee
  // mirrors these into the v2 control-plane store on every V1 append; the
  // generic backfill replays history. This is the same set the Wave-2 pilot
  // mirrored via the bespoke posture backfill (now delegating to the generic
  // mechanism), and `recon:posture-v2-parity` remains the byte-clean evidence.
  foothold("PostureRegistered", "governance", postureRegisteredPayloadSchema, {}),
  foothold("PostureActivated", "governance", postureActivatedPayloadSchema, {}),
  foothold("PostureDeactivated", "governance", postureDeactivatedPayloadSchema, {}),
  foothold("PostureRevised", "governance", postureRevisedPayloadSchema, {}),

  // 6. applicability
  foothold(
    "ApplicabilityAssessmentRequested",
    "governance",
    applicabilityAssessmentRequestedPayloadSchema,
  ),
  foothold(
    "ApplicabilityAssessmentPerformed",
    "governance",
    applicabilityAssessmentPerformedPayloadSchema,
  ),
  foothold(
    "ApplicabilityAssessmentConcluded",
    "governance",
    applicabilityAssessmentConcludedPayloadSchema,
  ),

  // 7. decision-impact
  foothold("DecisionImpactSweepRequested", "governance", decisionImpactSweepRequestedPayloadSchema),
  foothold("DecisionImpactAssessed", "governance", decisionImpactAssessedPayloadSchema),

  // 8. eval
  foothold("ExamSetRegistered", "audit", examSetRegisteredPayloadSchema),
  foothold("EvalRunCompleted", "audit", evalRunCompletedPayloadSchema),

  // 9. context-pack
  foothold("ContextPackBuilt", "runtime", contextPackBuiltPayloadSchema),

  // 10. cross-tenant
  foothold("CsiCategoryRegistered", "governance", csiCategoryRegisteredPayloadSchema),
  foothold("CsiCategoryRetired", "governance", csiCategoryRetiredPayloadSchema),
  foothold("CrossTenantLearningScreened", "governance", crossTenantLearningScreenedPayloadSchema),
  foothold("CrossTenantLearningBlocked", "governance", crossTenantLearningBlockedPayloadSchema),
];

// ---------------------------------------------------------------------------
// Lookup + validation surface.
// ---------------------------------------------------------------------------

const V2_REGISTRY_BY_TYPE: ReadonlyMap<string, V2EventTypeMetadata> = new Map(
  V2_EVENT_TYPE_REGISTRY.map((m) => [m.type, m]),
);

/**
 * Look up a type's registered v2 metadata. Returns `undefined` for an
 * unregistered type — the control-plane store treats that as "accept the
 * append" (build-phase forward compat) so the 10 footholds keep working before
 * they were registered, and so a Wave-2 type can be appended for a tick before
 * its registry row lands. The `recon:v2-type-registry-coverage` gate surfaces
 * appended-but-unregistered types as advisory findings.
 */
export function lookupV2EventType(type: string): V2EventTypeMetadata | undefined {
  return V2_REGISTRY_BY_TYPE.get(type);
}

/** True iff `type` is registered. */
export function isV2EventTypeRegistered(type: string): boolean {
  return V2_REGISTRY_BY_TYPE.has(type);
}

/** Every registered v2 event-type name (sorted). */
export function registeredV2EventTypes(): readonly string[] {
  return [...V2_REGISTRY_BY_TYPE.keys()].sort();
}

/**
 * True iff `type` is registered AND carries a `tee` declaration — i.e. the
 * generic store-tee mirrors its V1 appends into the v2 control-plane store. This
 * is the single source of truth for "is this type mirrored"; the composition
 * tee, the generic backfill, and the coverage recon all read it.
 */
export function isV2TeeEnabled(type: string): boolean {
  return V2_REGISTRY_BY_TYPE.get(type)?.tee !== undefined;
}

/** Every tee-enabled (mirrored) v2 event-type name (sorted). */
export function teeEnabledV2EventTypes(): readonly string[] {
  return V2_EVENT_TYPE_REGISTRY.filter((m) => m.tee !== undefined)
    .map((m) => m.type)
    .sort();
}

/**
 * Resolve the codec the tee applies when mirroring `type`. Returns the row's
 * declared `tee.codec`, falling back to `VERBATIM_CODEC` when the row is
 * tee-enabled with no explicit codec, and `undefined` when the type is not
 * tee-enabled (caller must not mirror it).
 */
export function v2TeeCodecFor(type: string): V2TeeCodec | undefined {
  const meta = V2_REGISTRY_BY_TYPE.get(type);
  if (!meta?.tee) return undefined;
  return meta.tee.codec ?? VERBATIM_CODEC;
}

/**
 * Validate a payload against the registered schema for `type`.
 *
 *   - Type registered → `schema.parse(payload)` throws on a bad payload
 *     (FAIL-CLOSED; the store propagates the throw as an append failure).
 *   - Type NOT registered → no-op (build-phase forward compat).
 *
 * This is the type-dispatched validation layer; the envelope itself is
 * validated separately by `v2EnvelopeSchema`.
 */
export function validateV2Payload(type: string, payload: Record<string, unknown>): void {
  const meta = V2_REGISTRY_BY_TYPE.get(type);
  if (!meta) return;
  meta.payloadSchema.parse(payload);
}
