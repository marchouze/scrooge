// v2-core/context-pack/index.ts
//
// Public surface of the W8 Slice D context-pack module.
// Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.

export type { ContextPackBuiltPayload, ContextPackEventKind } from "./events";
export { contextPackBuiltPayloadSchema, CONTEXT_PACK_EVENT_KINDS } from "./events";
export type {
  ApplicableObligation,
  ContextPack,
  DecisionImpactEntry,
  OpenQueueEntry,
  PostureEntry,
  RawEvent,
} from "./builder";
export { buildContextPack, hashPack, packToEventPayload } from "./builder";
