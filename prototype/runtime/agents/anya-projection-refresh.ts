// runtime/agents/anya-projection-refresh.ts
//
// Anya's event-driven projection-refresh handler. Closes Atlas
// substrate-gap #5: the dashboard projection cache was previously
// refreshed only by the live dashboard server; on a headless GitHub
// Actions runner the cache went stale because no derive pass was tied
// to the runtime.
//
// This handler subscribes to the event types that change projection
// inputs — SubstrateStateSnapshot, WorkstreamRegistered, WorkstreamCompleted,
// CeoDecision — and re-derives the projection from canonical sources +
// the in-process event store, then writes the result to the runtime
// cache path (default `prototype/.local/dashboard-state.json`,
// overridable via `BANK_DASHBOARD_RUNTIME_STATE`).
//
// As of D-EVENT-STORE-SCALING Slice 3a (2026-05-10) this handler writes
// only to the runtime path. Slice 3b (same day) removes the committed seed
// `prototype/seeds/dashboard-state.json` from the commit graph entirely —
// the dashboard cache is a *projection* (Principle 1) and the recon
// harness now derives + asserts internal consistency at recon time rather
// than comparing against a stored cache. Anya's job is to keep the
// *runtime* cache fresh for the dashboard server's reads.
//
// Trigger kind: event-driven. Fans out from any parent run that appends
// one of the subscribed event types. The runtime takes care of
// dispatching; this handler just does the work.
//
// Author: Anya (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { defaultSourcePaths, deriveState, eventSourceFromStore } from "../../dashboard/derive";
import { eventStore, logger } from "../../platform/composition";
import { makeDashboardProjectionRefreshed } from "../../platform/event-store/event-types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];
const DEFAULT_RUNTIME_REL = ".local/dashboard-state.json";

function resolveRuntimePath(repoRoot: string): { abs: string; rel: string } {
  // BANK_DASHBOARD_RUNTIME_STATE may be absolute or prototype-relative.
  // Default is `prototype/.local/dashboard-state.json` (gitignored).
  const raw = process.env.BANK_DASHBOARD_RUNTIME_STATE ?? DEFAULT_RUNTIME_REL;
  const abs = isAbsolute(raw) ? raw : resolve(repoRoot, "prototype", raw);
  const rel = isAbsolute(raw) ? raw : `prototype/${raw}`;
  return { abs, rel };
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const sources = defaultSourcePaths(ctx.repoRoot);
  const { abs: cachePath } = resolveRuntimePath(ctx.repoRoot);

  // Re-derive from canonical sources + the live event store. This is the
  // same function the dashboard server calls; running it from the runtime
  // gives the cache a second refresh path that's not gated on a long-
  // running server process.
  const state = deriveState({
    sources,
    events: eventSourceFromStore(eventStore),
  });

  let bytesWritten = 0;
  if (!ctx.dryRun) {
    const cacheDir = dirname(cachePath);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    const json = `${JSON.stringify(state, null, 2)}\n`;
    writeFileSync(cachePath, json, "utf8");
    bytesWritten = Buffer.byteLength(json, "utf8");
  }

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append(
      makeDashboardProjectionRefreshed({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:anya:projection-refresh" },
        citations: EVENT_CITATIONS,
        payload: {
          refreshId: `refresh:dashboard-state:${ctx.asOf}`,
          projectionName: "dashboard-state",
          refreshedAt: ctx.asOf,
          triggeredBy: `${ctx.trigger.kind}:${ctx.trigger.id}`,
          durationMs: 0,
          rowsRefreshed: bytesWritten > 0 ? 1 : 0,
        },
      }),
    );
    eventsEmitted = 1;
  }

  logger.debug(
    { bytesWritten, metrics: state.bank.metrics },
    "anya:projection-refresh — dashboard cache refreshed",
  );

  return {
    eventsEmitted,
    summary: `dashboard cache refreshed (${bytesWritten}B; ${state.bank.metrics.obligations} obligations · ${state.bank.metrics.principles} principles).`,
    ok: true,
  };
};

export default handler;
