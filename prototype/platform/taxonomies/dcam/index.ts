// platform/taxonomies/dcam/index.ts — DCAM three-layer alignment barrel
//
// EDM Council DCAM (Data Capabilities Assessment Model) framework.
// Three independent layers, each independently maintainable:
//
//   Layer 1 (layer1-conceptual.ts) — Business concepts anchored to FIBO
//   Layer 2 (layer2-logical.ts)    — CDM, ESMA-CFI, BCBS, FATF, ISO17442 mappings
//   Layer 3 (layer3-physical.ts)   — Bank codes + ISO 20022 message mappings
//
// Cross-layer assembly is performed by utility functions in the parent index.ts.
// Do not embed layer data in layer definitions — reference by stable key.
//
// Author: Atlas (Core banking platform architect, engineering)

export { CONCEPTUAL_REGISTRY } from "./layer1-conceptual";
export type { ConceptualConcept } from "./layer1-conceptual";

export { LOGICAL_MAPPINGS, getLogicalMappings } from "./layer2-logical";
export type { LogicalMapping } from "./layer2-logical";

export {
  PHYSICAL_PRODUCT_SCOPE,
  PHYSICAL_RISK_L1,
  PHYSICAL_DOMAIN,
  PHYSICAL_ACTIVITY,
  PHYSICAL_PARTY_KIND,
} from "./layer3-physical";
export type { PhysicalProductMapping } from "./layer3-physical";
