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
