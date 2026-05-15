// runtime/handler-callables.ts
//
// The agent → handler-callable map. Extracted from runtime/run.ts so
// other runtime modules (notably the follow-on-router) can dispatch by
// key without importing run.ts (which would create a circular import:
// run.ts imports the router, the router would import run.ts).
//
// Adding a new handler:
//   - Add a row to runtime/handlers-metadata.ts (canonical metadata).
//   - Create or edit runtime/agents/callables/<agent>.ts and add the entry there.
//   - Add one spread here (see assembly section below).
//   - The startup-validate in run.ts throws if either side is missing a key.
//
// Author: Atlas (Core Banking Platform Architect, engineering)

import { createHandler as createScroogeFollowOnRouter } from "./agents/scrooge-follow-on-router";
import { ANYA_CALLABLES } from "./agents/callables/anya";
import { ATLAS_CALLABLES } from "./agents/callables/atlas";
import { BEA_CALLABLES } from "./agents/callables/bea";
import { CAMILLE_CALLABLES } from "./agents/callables/camille";
import { DEVON_CALLABLES } from "./agents/callables/devon";
import { EITAN_CALLABLES } from "./agents/callables/eitan";
import { HELENA_CALLABLES } from "./agents/callables/helena";
import { IMANI_CALLABLES } from "./agents/callables/imani";
import { IRIS_CALLABLES } from "./agents/callables/iris";
import { KAI_CALLABLES } from "./agents/callables/kai";
import { LINNEA_CALLABLES } from "./agents/callables/linnea";
import { MIRA_CALLABLES } from "./agents/callables/mira";
import { NADIA_CALLABLES } from "./agents/callables/nadia";
import { NIKO_CALLABLES } from "./agents/callables/niko";
import { NOA_CALLABLES } from "./agents/callables/noa";
import { NOLAN_CALLABLES } from "./agents/callables/nolan";
import { OWEN_CALLABLES } from "./agents/callables/owen";
import { PAX_CALLABLES } from "./agents/callables/pax";
import { RASHIDA_CALLABLES } from "./agents/callables/rashida";
import { RAVI_CALLABLES } from "./agents/callables/ravi";
import { ROHAN_CALLABLES } from "./agents/callables/rohan";
import { SADE_CALLABLES } from "./agents/callables/sade";
import { SASKIA_CALLABLES } from "./agents/callables/saskia";
import { SCROOGE_CALLABLES } from "./agents/callables/scrooge";
import { SENNA_CALLABLES } from "./agents/callables/senna";
import { THANDIWE_CALLABLES } from "./agents/callables/thandiwe";
import { TOMAS_CALLABLES } from "./agents/callables/tomas";
import { VERA_CALLABLES } from "./agents/callables/vera";
import { YAEL_CALLABLES } from "./agents/callables/yael";
import { ZARA_CALLABLES } from "./agents/callables/zara";
import type { AgentRunHandler } from "./types";

// Two-phase init to break the cycle between handler-callables.ts and
// scrooge-follow-on-router.ts (F-019):
//   1. Build the map without the follow-on-router entry.
//   2. Create the router with the map injected, then insert it.
// The map is mutable during init, Readonly<> after export.
//
// F-019 resolved: `bunx madge --circular --extensions ts runtime/` reports
// "No circular dependency found!" — the two-phase init achieved the goal.
// Use `bun run check:circular` (package.json) to verify at any time.
//
// To add a new handler: create or edit runtime/agents/callables/<agent>.ts;
// add one spread here.
const _map: Record<string, AgentRunHandler> = {
  ...VERA_CALLABLES,
  ...ATLAS_CALLABLES,
  ...BEA_CALLABLES,
  ...HELENA_CALLABLES,
  ...DEVON_CALLABLES,
  ...CAMILLE_CALLABLES,
  ...ANYA_CALLABLES,
  ...SCROOGE_CALLABLES,
  // "scrooge:follow-on-router" inserted below after createHandler()
  ...OWEN_CALLABLES,
  ...ROHAN_CALLABLES,
  ...MIRA_CALLABLES,
  ...SENNA_CALLABLES,
  ...ZARA_CALLABLES,
  ...THANDIWE_CALLABLES,
  ...RASHIDA_CALLABLES,
  ...IRIS_CALLABLES,
  ...EITAN_CALLABLES,
  ...SASKIA_CALLABLES,
  ...KAI_CALLABLES,
  ...YAEL_CALLABLES,
  ...TOMAS_CALLABLES,
  ...IMANI_CALLABLES,
  ...RAVI_CALLABLES,
  ...SADE_CALLABLES,
  ...PAX_CALLABLES,
  ...NADIA_CALLABLES,
  ...NIKO_CALLABLES,
  ...NOA_CALLABLES,
  ...LINNEA_CALLABLES,
  ...NOLAN_CALLABLES,
  // ← new agent adds one spread here
};

// Phase 2: inject the map into the follow-on-router so it can look up
// callables without importing handler-callables.ts directly (F-019 fix).
_map["scrooge:follow-on-router"] = createScroogeFollowOnRouter(_map);

export const HANDLER_CALLABLES: Readonly<Record<string, AgentRunHandler>> = _map;
