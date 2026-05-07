// runtime/agents/anya-projection-refresh.ts
//
// Anya's event-driven projection-refresh handler. Closes Atlas
// substrate-gap #5: the dashboard projection cache (`seeds/dashboard-state.json`)
// was previously refreshed only by the live dashboard server; on a
// headless GitHub Actions runner the cache went stale because no derive
// pass was tied to the runtime.
//
// This handler subscribes to the event types that change projection
// inputs — SubstrateStateSnapshot, WorkstreamRegistered, WorkstreamCompleted,
// CeoDecision — and re-derives the projection from canonical sources +
// the in-process event store, then writes the result to disk.
//
// Trigger kind: event-driven. Fans out from any parent run that appends
// one of the subscribed event types. The runtime takes care of
// dispatching; this handler just does the work.
//
// Author: Anya (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import {
  defaultSourcePaths,
  deriveState,
  eventSourceFromStore,
} from "../../dashboard/derive";
import type { AgentRunContext, AgentRunOutput } from "../types";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const sources = defaultSourcePaths(ctx.repoRoot);
  const cachePath = resolve(ctx.repoRoot, "prototype", "seeds", "dashboard-state.json");

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
    if (!existsSync(resolve(ctx.repoRoot, "prototype", "seeds"))) {
      mkdirSync(resolve(ctx.repoRoot, "prototype", "seeds"), { recursive: true });
    }
    const json = `${JSON.stringify(state, null, 2)}\n`;
    writeFileSync(cachePath, json, "utf8");
    bytesWritten = Buffer.byteLength(json, "utf8");
  }

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "DashboardProjectionRefreshed",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:anya:projection-refresh" },
      citations: EVENT_CITATIONS,
      payload: {
        cachePath: "prototype/seeds/dashboard-state.json",
        bytesWritten,
        triggerKind: ctx.trigger.kind,
        triggerId: ctx.trigger.id,
        // Snapshot of the headline metrics for run-log purposes (cheap).
        metrics: state.bank.metrics,
      },
    });
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
