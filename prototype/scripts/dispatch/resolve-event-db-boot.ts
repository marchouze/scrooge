// scripts/dispatch/resolve-event-db-boot.ts
//
// Side-effect-only import shim. Imported FIRST by each dispatch CLI so
// `process.env.BANK_EVENT_DB` is mutated before `platform/composition`
// resolves its dbPath at module-load time.
//
// See `resolve-event-db.ts` for the resolution rules and rationale.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21).
// Author: Atlas (Core banking platform architect, engineering)

import { applyDispatchEventDbResolution } from "./resolve-event-db";

applyDispatchEventDbResolution();
