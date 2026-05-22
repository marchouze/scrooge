// platform/regulatory/graph/run-seed.ts
//
// Entry-point for `bun run graph:seed`.
// Runs the seed projection and prints stats as JSON.
//
// This script is INTERACTIVE (user-invoked, not in `bun run ci`). It opts
// into the HOME-default shared event store via the boot shim, matching the
// pattern documented in `platform/event-store/resolve-event-db.ts` for
// interactive emission scripts. Without the shim, composition.ts defaults
// to `.local/event.db` (per-worktree fallback) and the seed sees zero
// `RegulatoryConceptExtracted` events emitted by Mira's dispatched runs in
// other worktrees.
//
// Author: Mira (Compliance / RegTech engineer, engineering)
//         Scrooge (Chief of Staff, HOME-store opt-in 2026-05-22)

import "../../event-store/resolve-event-db-boot";

import { runSeed } from "./seed-projection";

const stats = await runSeed();
console.log(JSON.stringify(stats, null, 2));
