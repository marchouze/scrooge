// platform/projections/index.ts
//
// Public surface of the projection runtime.

export type {
  Projection,
  ProjectionReplayOpts,
  ProjectionSnapshotOpts,
  Projector,
  Reducer,
  EventFilter,
  SnapshotEmissionResult,
  SnapshotProjectionOpts,
} from "./types";
export { acceptAll, acceptType } from "./types";
export { LocalProjector } from "./runtime";

// D-DATA-PROVENANCE-SUBSTRATE Slice 2 — provenance filter surface.
export type { ProvenanceFilter, ProvenanceMode } from "./filter";
export {
  defaultProvenanceFilter,
  defaultProvenanceMode,
  effectiveStreamKey,
  eventInOperatingBook,
  eventMatchesProvenanceFilter,
  isSandboxProvenance,
  operatingBookFilter,
  provenanceFilterDigest,
  SANDBOX_SCENARIO_PREFIXES,
  SANDBOX_TAG,
  setDefaultProvenanceModeOverride,
} from "./filter";
