// platform/semantic/index.ts
//
// Public surface of the semantic-layer registry. Slice 1 of D-REPORTING-
// CAPABILITY-M2-M3-BUILD-PLAN. Downstream consumers (Slice 2 period-close
// events; Slice 3 BA 325 LCR generator harness; Slice 4+ M2/M3 generators)
// import from `@platform/semantic` and never reach into the sub-modules.
//
// Author: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)

export type {
  CitationCoverageRow,
  IfrsClassification,
  IfrsLineMapping,
  RegulatoryCellMapping,
  SemanticCitation,
  SemanticDimension,
  SemanticEntry,
  SemanticEntryId,
  SemanticEntryRef,
  SemanticEntryStatus,
  SemanticSigner,
  SemanticUnit,
} from "./types";

export { SemanticRegistry, SemanticRegistryError } from "./registry";

export { SLICE_1_ENTRIES, balance, cashAndBalancesAtSARB, exposure } from "./entries";
