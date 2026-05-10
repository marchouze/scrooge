// One-shot: regenerate the dashboard cache from canonical sources for
// human inspection. Per D-EVENT-STORE-SCALING Slice 3b (2026-05-10) the
// committed seed `prototype/seeds/dashboard-state.json` is gone from the
// commit graph; this script writes to the runtime cache under `.local/`
// (gitignored). Useful when the dashboard server isn't running and
// someone wants a fresh snapshot to eyeball.
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { defaultSourcePaths, deriveState, eventSourceFromStore } from "../dashboard/derive";
import { eventStore } from "../platform/composition";

const repoRoot = resolve(import.meta.dir, "..", "..");
const sources = defaultSourcePaths(repoRoot);
const state = deriveState({ sources, events: eventSourceFromStore(eventStore) });

const runtimeRel = process.env.BANK_DASHBOARD_RUNTIME_STATE ?? ".local/dashboard-state.json";
const cachePath = isAbsolute(runtimeRel) ? runtimeRel : resolve(repoRoot, "prototype", runtimeRel);
const cacheDir = dirname(cachePath);
if (!existsSync(cacheDir)) {
  mkdirSync(cacheDir, { recursive: true });
}
writeFileSync(cachePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log("wrote", cachePath);
console.log("metrics:", state.bank.metrics);
