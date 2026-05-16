// platform/semantic-layer/event-type.ts
//
// SHIM — F-032 relocation (Atlas, 2026-05-16).
//
// The `SemanticLayerQuantityRegistered` payload schema + factory were
// originally authored here. They have been relocated to
// `platform/event-store/event-types/analytics.ts` so the factory lives on a
// surface scanned by `platform/recon/event-type-registry-coverage.ts`
// (F-032 ratchet — registry coverage warns must be zero).
//
// This file re-exports the canonical symbols so existing imports continue to
// resolve without change. New code should import from
// `../event-store/event-types/analytics` or from `../event-store/event-types`
// (the barrel).
//
// Author: Anya (Data / analytics engineer, engineering)
// Relocated by: Atlas (Core banking platform architect, engineering)

export {
  ANALYTICS_TYPED_EVENT_TYPES,
  makeSemanticLayerQuantityRegistered,
  SEMANTIC_LAYER_TYPED_EVENT_TYPES,
  semanticLayerQuantityRegisteredPayloadSchema,
} from "../event-store/event-types/analytics";

export type {
  AnalyticsEventType,
  SemanticLayerEventType,
  SemanticLayerQuantityRegisteredPayload,
} from "../event-store/event-types/analytics";
