// platform/event-store/resolve-event-db-boot.ts
//
// Side-effect-only import shim for emission scripts (`approve-d-*.ts`,
// `record-d-*.ts`, `file-*.ts`) and anyone else who needs to opt into
// the shared HOME event-store BEFORE `platform/composition.ts` resolves
// its dbPath at module-load time.
//
// Why a separate side-effect-only file. TypeScript/JS hoists all
// `import` statements to the top of the module body; a plain
// `applySharedEventDbResolution()` call sitting between two imports
// actually runs AFTER both imports resolve. The boot shim is the
// canonical idiom for "run this side-effect before any other import" —
// `import "../platform/event-store/resolve-event-db-boot"` first
// guarantees the env mutation happens before
// `import { eventStore } from "../platform/composition"` ever runs
// composition's module body.
//
// 2026-06-10 extension: this shim now ALSO opts the process into the
// shared HOME document store (chained import below). Opting into the
// shared event store without the shared document store is exactly the
// dangling-record gap Vera (Internal audit engineer, third line)
// surfaced in PR #1194 — a `RecordFiled` event in the shared store whose
// `documentHash` blob landed in a pruned worktree's local store. The two
// stores travel together. (The CI-chained `record-d-*` scripts in
// `migrate:decisions-backfill` deliberately import NEITHER shim — their
// events AND blobs both stay per-worktree, so the pairing holds there
// too.)
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21);
//            brief:atlas:extend-cross-worktree-sync-to-document-store-blo:2026-06-10.
// Brief: brief:atlas:shared-event-db-resolution-across-dispatch-clis-:2026-05-21.
// Author: Atlas (Core banking platform architect, engineering)

import "../document-store/resolve-document-store-boot";

import { applySharedEventDbResolution } from "./resolve-event-db";

applySharedEventDbResolution();
