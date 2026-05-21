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
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21).
// Author: Atlas (Core banking platform architect, engineering)

import { applyDispatchEventDbResolution } from "./resolve-event-db";

applyDispatchEventDbResolution();
