// platform/event-store/registry.ts
//
// SHIM — F-021 split (Atlas, 2026-05-12).
//
// The event-type registry has been split into per-domain modules under
// `./registry/`:
//
//   types.ts       — ArchivalTier, RetentionMetadata, RETENTION_* constants,
//                    SnapshotCadence, ReplayFold, EventTypeStatus,
//                    EventTypeMetadata
//   runtime.ts     — RUNTIME_EVENT_TYPES, GOAL_LOOP_EVENT_TYPES
//   model-risk.ts  — MODEL_REGISTRY_EVENT_TYPES
//   markets.ts     — MARKETS_EVENT_TYPES, BANK_ACCOUNT_EVENT_TYPES,
//                    PERIOD_CLOSE_EVENT_TYPES, CUSTOMER_LIFECYCLE_EVENT_TYPES
//   governance.ts  — GOVERNANCE_EVENT_TYPES, AUDIT_EVENT_TYPES,
//                    LEGAL_ENTITY_EVENT_TYPES, PARTY_EVENT_TYPES_REGISTRY,
//                    PRODUCT_LIFECYCLE_EVENT_TYPES, RMS_EVENT_TYPES,
//                    RAS_EVENT_TYPES, READINESS_SNAPSHOT_EVENT_TYPES
//   index.ts       — EVENT_TYPE_REGISTRY (flat combined list),
//                    lookupEventType, validatePayload, issuerMatrix,
//                    subscriberMatrix
//
// This file re-exports everything from the barrel so existing imports of
// `../event-store/registry` continue to resolve without change. New code
// should import from the per-domain module or from
// `../event-store/registry/index` directly.

export * from "./registry/index";
