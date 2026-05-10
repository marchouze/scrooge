// platform/document-store/index.ts
//
// RMS Phase 1 Slice 1 — content-addressed document store, public surface.
//
// Spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §4–§5
// Standing authority: D-RMS-PHASE-1 → D-RMS-PHASE-1-SLICE-1.
//
// Author: Atlas (Core banking platform architect, engineering)
//         + Owen (Company Secretary, governance)

export { hashContent, parseHash } from "./hash";
export { LocalFsDocumentStore, defaultDocumentStore } from "./local-fs";
export type { LocalFsDocumentStoreOptions } from "./local-fs";
export {
  type DocumentHash,
  DocumentIntegrityError,
  type DocumentMetadata,
  type DocumentStore,
  DocumentStoreMissError,
  type HashAlgo,
  type PutOptions,
  type PutResult,
} from "./types";
