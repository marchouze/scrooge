// platform/document-store/resolve-document-store-boot.ts
//
// Side-effect-only import shim — the document-store twin of
// `platform/event-store/resolve-event-db-boot.ts`. Importing this file
// FIRST opts the process into the shared HOME document store
// (`$HOME/.local/share/bank/documents` by default) by mutating
// `process.env.BANK_DOCUMENT_STORE` BEFORE `platform/document-store`
// constructs its `defaultDocumentStore` singleton at module-load time.
//
// Why a separate side-effect-only file: TypeScript/JS hoists all `import`
// statements to the top of the module body; a plain
// `applySharedDocumentStoreResolution()` call sitting between two imports
// actually runs AFTER both imports resolve. The boot shim is the
// canonical idiom for "run this side-effect before any other import".
//
// NOTE: most callers should NOT import this directly — the event-store
// boot shim (`platform/event-store/resolve-event-db-boot.ts`) chains into
// this one, so every surface that opts into the shared event store gets
// the shared document store with it. The pairing is the invariant that
// prevents dangling `RecordFiled.documentHash` references (an event in
// the shared store whose blob landed in a pruned worktree).
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21) — design
//            precedent, extended to blob roots.
// Brief: brief:atlas:extend-cross-worktree-sync-to-document-store-blo:2026-06-10.
// Author: Atlas (Core banking platform architect, engineering)

import { applySharedDocumentStoreResolution } from "./resolve-document-store";

applySharedDocumentStoreResolution();
