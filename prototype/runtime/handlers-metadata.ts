// runtime/handlers-metadata.ts
//
// A1 — canonical handler-metadata registry.
//
// The single authoring location for the (agent, trigger) pairs the
// runtime knows about, with their kind / cadence / subscription /
// cron metadata. Closes the drift Marc surfaced when asking why fleet
// health was out of date — there were three diverging copies of this
// list:
//
//   - `HANDLERS` map in `runtime/run.ts` (with handler callables)
//   - `RUNTIME_HANDLERS` const in `dashboard/derive.ts` (metadata only)
//   - `knownRuntimeHandlers()` in `runtime/agents/atlas-substrate-state.ts`
//     (metadata only)
//
// They drifted silently when new handlers landed (mira:citation-gate,
// anya:projection-refresh) — the dashboard kept claiming agents were
// stale that were on a different cadence than its hardcoded map said.
//
// After A1: this file is canonical. `runtime/handler-callables.ts`
// owns the map from (agent, trigger) → handler callable; the metadata
// array here is what every other consumer reads. The handler-callable
// map lives separately to keep this module free of runtime side-effects
// (the dashboard imports it; the dashboard must NOT pull in
// composition.ts or the EventStore).
//
// CRON CONSOLIDATION (post-PR #193):
//   Adding a new scheduled handler used to require touching FOUR
//   authoring locations: this file, `handler-callables.ts`,
//   `SCHEDULER_CRON_MAP` in `platform/scheduler/scheduler.ts`, and
//   `.github/workflows/agent-runtime-<agent>-<trigger>.yml`. The
//   `cronExpression` field below collapses (this file ↔ scheduler.ts)
//   into a single source of truth — `SCHEDULER_CRON_MAP` is now a
//   derived projection (`derivedCronMap()`). The workflow YAML
//   remains an independent surface for now; `recon:cron-map-drift`
//   asserts they agree, and a future slice will template-generate
//   the YAMLs from this metadata too.
//
// Adding a new handler:
//   - Create or edit runtime/agents/metadata/<agent>.ts and add an entry there.
//   - Add one spread line here (see assembly section below).
//   - Add the callable in `handler-callables.ts` under the same key.
//   - For scheduled handlers, also add the workflow YAML at
//     `.github/workflows/agent-runtime-<agent>-<trigger>.yml` with
//     a `schedule.cron` matching `cronExpression`.
//   - Vera's `recon:runtime-handler-sync` and `recon:cron-map-drift`
//     assert these stay in sync.
//
// Author: Atlas (Core Banking Platform Architect, engineering)

// HandlerMetadata moved to ./types to break the handlers-metadata ↔
// agents/metadata/_entry circular import chain (Vera Wave-4 F-034).
import type { HandlerMetadata } from "./types";
export type { HandlerMetadata } from "./types";

// ---------------------------------------------------------------------------
// Per-agent metadata modules.
//
// To add a new handler: create or edit runtime/agents/metadata/<agent>.ts;
// add one spread here.
// ---------------------------------------------------------------------------

import { ANYA_HANDLER_METADATA } from "./agents/metadata/anya";
import { ATLAS_HANDLER_METADATA } from "./agents/metadata/atlas";
import { BEA_HANDLER_METADATA } from "./agents/metadata/bea";
import { CAMILLE_HANDLER_METADATA } from "./agents/metadata/camille";
import { DEVON_HANDLER_METADATA } from "./agents/metadata/devon";
import { EITAN_HANDLER_METADATA } from "./agents/metadata/eitan";
import { ENV_HANDLER_METADATA } from "./agents/metadata/env";
import { HELENA_HANDLER_METADATA } from "./agents/metadata/helena";
import { IMANI_HANDLER_METADATA } from "./agents/metadata/imani";
import { IRIS_HANDLER_METADATA } from "./agents/metadata/iris";
import { KAI_HANDLER_METADATA } from "./agents/metadata/kai";
import { LINNEA_HANDLER_METADATA } from "./agents/metadata/linnea";
import { MIRA_HANDLER_METADATA } from "./agents/metadata/mira";
import { NADIA_HANDLER_METADATA } from "./agents/metadata/nadia";
import { NIKO_HANDLER_METADATA } from "./agents/metadata/niko";
import { NOA_HANDLER_METADATA } from "./agents/metadata/noa";
import { NOLAN_HANDLER_METADATA } from "./agents/metadata/nolan";
import { OWEN_HANDLER_METADATA } from "./agents/metadata/owen";
import { PAX_HANDLER_METADATA } from "./agents/metadata/pax";
import { RASHIDA_HANDLER_METADATA } from "./agents/metadata/rashida";
import { RAVI_HANDLER_METADATA } from "./agents/metadata/ravi";
import { ROHAN_HANDLER_METADATA } from "./agents/metadata/rohan";
import { SADE_HANDLER_METADATA } from "./agents/metadata/sade";
import { SASKIA_HANDLER_METADATA } from "./agents/metadata/saskia";
import { SCROOGE_HANDLER_METADATA } from "./agents/metadata/scrooge";
import { SENNA_HANDLER_METADATA } from "./agents/metadata/senna";
import { THANDIWE_HANDLER_METADATA } from "./agents/metadata/thandiwe";
import { TOMAS_HANDLER_METADATA } from "./agents/metadata/tomas";
import { VERA_HANDLER_METADATA } from "./agents/metadata/vera";
import { YAEL_HANDLER_METADATA } from "./agents/metadata/yael";
import { ZARA_HANDLER_METADATA } from "./agents/metadata/zara";

/**
 * Canonical handler metadata. Order matches the fleet-health card
 * order (engineering-first, then on-request) but is not load-bearing —
 * consumers sort their own views.
 */
export const HANDLERS_METADATA: readonly HandlerMetadata[] = [
  ...VERA_HANDLER_METADATA,
  ...ATLAS_HANDLER_METADATA,
  ...BEA_HANDLER_METADATA,
  ...HELENA_HANDLER_METADATA,
  ...DEVON_HANDLER_METADATA,
  ...CAMILLE_HANDLER_METADATA,
  ...ANYA_HANDLER_METADATA,
  ...SCROOGE_HANDLER_METADATA,
  ...OWEN_HANDLER_METADATA,
  ...ROHAN_HANDLER_METADATA,
  ...MIRA_HANDLER_METADATA,
  ...SENNA_HANDLER_METADATA,
  ...ZARA_HANDLER_METADATA,
  ...THANDIWE_HANDLER_METADATA,
  ...RASHIDA_HANDLER_METADATA,
  ...IRIS_HANDLER_METADATA,
  ...EITAN_HANDLER_METADATA,
  ...ENV_HANDLER_METADATA,
  ...SASKIA_HANDLER_METADATA,
  ...KAI_HANDLER_METADATA,
  ...YAEL_HANDLER_METADATA,
  ...TOMAS_HANDLER_METADATA,
  ...IMANI_HANDLER_METADATA,
  ...RAVI_HANDLER_METADATA,
  ...SADE_HANDLER_METADATA,
  ...PAX_HANDLER_METADATA,
  ...NADIA_HANDLER_METADATA,
  ...NIKO_HANDLER_METADATA,
  ...NOA_HANDLER_METADATA,
  ...LINNEA_HANDLER_METADATA,
  ...NOLAN_HANDLER_METADATA,
  // ← new agent adds one spread here
];

/** Map from `<lowercased-agent>:<trigger>` to metadata. */
export const HANDLERS_METADATA_BY_KEY: ReadonlyMap<string, HandlerMetadata> = new Map(
  HANDLERS_METADATA.map((h) => [h.key, h]),
);

/** Look up metadata by composite key. */
export function lookupHandler(key: string): HandlerMetadata | undefined {
  return HANDLERS_METADATA_BY_KEY.get(key);
}

/** All registered keys, useful for error messages. */
export function handlerKeys(): readonly string[] {
  return HANDLERS_METADATA.map((h) => h.key);
}

/**
 * Derived projection of `(scheduled handlers) → cron expression`.
 *
 * This is the post-consolidation canonical source for cron expressions.
 * The historic `SCHEDULER_CRON_MAP` literal in
 * `platform/scheduler/scheduler.ts` is now derived from this function;
 * the runtime / scheduler / GH Actions surfaces all reconcile back here.
 *
 * Filters to `kind: "scheduled"` rows that have a `cronExpression` set.
 * A scheduled row WITHOUT a cronExpression is a substrate finding —
 * `recon:cron-map-drift` asserts every scheduled row has one.
 */
export function derivedCronMap(): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const h of HANDLERS_METADATA) {
    if (h.kind === "scheduled" && h.cronExpression !== undefined) {
      out[h.key] = h.cronExpression;
    }
  }
  return out;
}

/**
 * `kind: "scheduled"` handlers that are missing a `cronExpression`.
 * Empty when the registry is well-formed; populated when a scheduled
 * row was added without supplying the cron — `recon:cron-map-drift`
 * surfaces these as findings.
 */
export function scheduledHandlersMissingCron(): readonly HandlerMetadata[] {
  return HANDLERS_METADATA.filter((h) => h.kind === "scheduled" && h.cronExpression === undefined);
}
