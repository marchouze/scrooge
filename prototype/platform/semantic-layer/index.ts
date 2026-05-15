// platform/semantic-layer/index.ts
//
// Public surface of the semantic-layer quantity registry.
//
// Downstream consumers (analytics pipelines, ALCO pack generator, risk
// dashboards, BA-return generators) import from `@platform/semantic-layer`
// and never reach into the sub-modules.
//
// Author: Anya (Data / analytics engineer, engineering)

export type {
  QuantityCode,
  QuantityDefinition,
  QuantityDomain,
  QuantityUnit,
  ReportingFrequency,
} from "./quantities";

export { QUANTITY_REGISTRY, TYPED_QUANTITY_CODES } from "./quantities";

export {
  getQuantity,
  listByDomain,
  listQuantities,
} from "./registry-helpers";

export type { SemanticLayerQuantityRegisteredPayload } from "./event-type";

export {
  makeSemanticLayerQuantityRegistered,
  semanticLayerQuantityRegisteredPayloadSchema,
} from "./event-type";

export { registerAllQuantities } from "./seed";
