// platform/projections/index.ts
//
// Public surface of the projection runtime.

export type {
  Projection,
  ProjectionReplayOpts,
  Projector,
  Reducer,
  EventFilter,
} from "./types";
export { acceptAll, acceptType } from "./types";
export { LocalProjector } from "./runtime";
