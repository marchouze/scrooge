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
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21).
// Brief: brief:atlas:shared-event-db-resolution-across-dispatch-clis-:2026-05-21.
// Author: Atlas (Core banking platform architect, engineering)

import { applySharedEventDbResolution } from "./resolve-event-db";

applySharedEventDbResolution();
