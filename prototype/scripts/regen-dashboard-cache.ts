// One-shot: regenerate seeds/dashboard-state.json from canonical sources.
// Used after Owner Inbox / register edits land new decisions.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultSourcePaths, deriveState, eventSourceFromStore } from "../dashboard/derive";
import { eventStore } from "../platform/composition";

const repoRoot = resolve(import.meta.dir, "..", "..");
const sources = defaultSourcePaths(repoRoot);
const state = deriveState({ sources, events: eventSourceFromStore(eventStore) });
const cachePath = resolve(repoRoot, "prototype", "seeds", "dashboard-state.json");
writeFileSync(cachePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log("wrote", cachePath);
console.log("metrics:", state.bank.metrics);
