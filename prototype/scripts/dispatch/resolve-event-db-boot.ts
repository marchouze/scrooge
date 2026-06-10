// scripts/dispatch/resolve-event-db-boot.ts
//
// Side-effect-only import shim. Imported FIRST by each dispatch CLI so
// `process.env.BANK_EVENT_DB` is mutated before `platform/composition`
// resolves its dbPath at module-load time.
//
// Why a separate side-effect-only file. TypeScript/JS hoists all `import`
// statements to the top of the module body; a plain `apply…()` call sitting
// between two imports actually runs AFTER both imports resolve. The boot
// shim is the canonical idiom for "run this side-effect before any other
// import" — `import "./resolve-event-db-boot"` first guarantees the env
// mutation happens before `import { eventStore } from
// "../../platform/composition"` ever runs composition's module body.
//
// See `resolve-event-db.ts` for the dispatch-CLI wrapper and
// `../../platform/event-store/resolve-event-db.ts` for the underlying
// shared resolver.
//
// 2026-06-10 extension: the dispatch CLIs now also resolve the shared
// document store here (`--document-store` flag > `BANK_DOCUMENT_STORE` >
// `BANK_DOCUMENT_STORE_PATH` legacy alias > `BANK_HOME_DOCUMENT_STORE` >
// `$HOME/.local/share/bank/documents`), so the brief-body / deliverable
// blobs land in the SAME shared store the `AgentBriefIssued` /
// `RecordFiled` events go to. Event store and document store travel
// together — splitting them is the dangling-record gap Vera (Internal
// audit engineer, third line) surfaced in PR #1194.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21);
//            brief:atlas:extend-cross-worktree-sync-to-document-store-blo:2026-06-10.
// Author: Atlas (Core banking platform architect, engineering)

import { applyDispatchDocumentStoreResolution } from "./resolve-document-store";
import { applyDispatchEventDbResolution } from "./resolve-event-db";

applyDispatchEventDbResolution();
applyDispatchDocumentStoreResolution();
