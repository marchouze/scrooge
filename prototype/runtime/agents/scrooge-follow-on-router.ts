// runtime/agents/scrooge-follow-on-router.ts
//
// Scrooge's event-driven follow-on-router.
//
// Closes the second half of the substrate gap Marc surfaced 2026-05-07.
// Half one (the scrooge:ceo-decision-record handler) made CEO approvals
// emit typed CeoDecision events. This handler reads the
// `followOnRoutes` field on those events and dispatches the chained
// agent runs.
//
// Pattern:
//   1. Subscribes to CeoDecision via the event-driven fan-out
//      (registered in runtime/handlers-metadata.ts).
//   2. The runtime populates ctx.trigger.triggeringEvents with the
//      CeoDecision events that fired this dispatch.
//   3. For each event with `followOnRoutes` and `action === "approve"`,
//      look up each route in the canonical handler map.
//   4. Resolved routes → invoke the handler with a fresh
//      AgentRunContext. Failures are non-fatal to the router; logged
//      and surfaced via SubstrateAlert.
//   5. Unresolved routes → emit AgentEscalation events (substrate-gap
//      signal: "follow-on target not yet a runtime handler"). These
//      surface on the dashboard and Vera's audit pipeline.
//
// What this handler does NOT do:
//   - It does NOT recurse into nested follow-ons. If a chained handler
//     itself emits a CeoDecision, the parent run's fan-out won't fire
//     the router again (the runtime explicitly avoids re-entering
//     event-driven dispatch from event-driven dispatch — A0 §6 anti-loop
//     rule). Multi-step follow-on chains require the next dispatch to
//     happen on a future runtime invocation, which is the right shape
//     for cross-run audit (Vera's continuous-controls programme can
//     observe the chain over time).
//   - It does NOT enforce permission policy. PermissionPolicyPublished
//     (A0 §4 #4 — Atlas A2 work) is the gate; this router assumes
//     resolved routes are pre-authorised by the policy that publishes
//     them.
//   - It does NOT validate that the CEO actually had authority to
//     declare the follow-on routes. The deliverable's frontmatter or
//     the decision-record JSON is the source of truth; if a malicious
//     actor inserted routes, that's an upstream integrity issue (Vera
//     audits the CeoDecision event chain itself).
//
// Author: Scrooge (handler) · Atlas (runtime substrate)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { makeAgentEscalation } from "../../platform/event-store/event-types";
import { lookupHandler } from "../handlers-metadata";
import type { AgentRunContext, AgentRunHandler, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

// HANDLER_CALLABLES is injected via `createHandler` to break the
// mutual import cycle:
//   handler-callables.ts → scrooge-follow-on-router.ts
//   scrooge-follow-on-router.ts → handler-callables.ts  ← cycle
// The composition root (handler-callables.ts) calls createHandler()
// after constructing the map; the router receives it via closure.
// F-019 fix — Atlas (Core banking platform architect, engineering).
type CallableMap = Readonly<Record<string, AgentRunHandler>>;

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

interface RouteOutcome {
  readonly route: string;
  readonly status: "dispatched" | "unresolved" | "failed" | "skipped";
  readonly reason?: string;
  readonly summary?: string;
  readonly eventsEmittedDownstream?: number;
}

async function dispatchOne(
  parentCtx: AgentRunContext,
  route: string,
  decisionId: string,
  callables: CallableMap,
): Promise<RouteOutcome> {
  // Route format: `agent:<lowercased-agent>:<trigger>` per A0 §4 #1's
  // identity convention. Strip the leading `agent:` and use the rest as
  // the canonical handler key.
  const m = route.match(/^agent:([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)$/i);
  if (!m) {
    return {
      route,
      status: "unresolved",
      reason: `Route format invalid (expected agent:<name>:<trigger>): ${route}`,
    };
  }
  const key = `${m[1]?.toLowerCase()}:${m[2]?.toLowerCase()}`;
  const meta = lookupHandler(key);
  if (!meta) {
    return {
      route,
      status: "unresolved",
      reason: `No runtime handler registered for ${key}. Substrate gap: target needs to become a registered handler before auto-fire.`,
    };
  }
  const callable = callables[key];
  if (!callable) {
    return {
      route,
      status: "unresolved",
      reason: `Handler metadata exists for ${key} but no callable registered.`,
    };
  }

  const tCtx: AgentRunContext = {
    agent: meta.agent,
    trigger: { kind: meta.kind, id: meta.trigger },
    asOf: new Date().toISOString(),
    repoRoot: parentCtx.repoRoot,
    ownerInboxDir: parentCtx.ownerInboxDir,
    dryRun: parentCtx.dryRun,
  };

  logger.info({ route, key, decisionId }, "scrooge:follow-on-router — dispatching");
  try {
    const result = await callable(tCtx);
    return {
      route,
      status: "dispatched",
      ...(result.summary ? { summary: result.summary } : {}),
      eventsEmittedDownstream: result.eventsEmitted,
    };
  } catch (e) {
    const reason = (e as Error).message;
    logger.error({ route, key, err: reason }, "scrooge:follow-on-router — handler threw");
    return { route, status: "failed", reason };
  }
}

function buildAuditMarkdown(
  ctx: AgentRunContext,
  outcomes: readonly { decisionId: string; routes: readonly RouteOutcome[] }[],
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Scrooge", "follow-on-router", ctx.asOf));
  lines.push(`# Scrooge — follow-on routing, ${date}`);
  lines.push("");
  lines.push(
    "Audit record of follow-on routes dispatched after CEO decision approvals. Each decision below names the routes declared in its CeoDecision payload and the dispatch outcome.",
  );
  lines.push("");
  for (const o of outcomes) {
    lines.push(`## ${o.decisionId}`);
    lines.push("");
    if (o.routes.length === 0) {
      lines.push("_No follow-on routes declared._");
      lines.push("");
      continue;
    }
    lines.push("| Route | Status | Detail |");
    lines.push("|---|---|---|");
    for (const r of o.routes) {
      const detail = r.summary ?? r.reason ?? "";
      const safeDetail = detail.replace(/\|/g, "\\|");
      lines.push(`| \`${r.route}\` | ${r.status} | ${safeDetail} |`);
    }
    lines.push("");
  }
  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Triggered event-driven from CeoDecision events appended in the parent run. Routes dispatched via the canonical handler map at `runtime/handler-callables.ts`. Unresolved routes surface as AgentEscalation events for substrate-gap visibility.",
  );
  lines.push("");
  return lines.join("\n");
}

/**
 * Create the scrooge:follow-on-router handler with an injected callable map.
 * Called from handler-callables.ts after the map is built to break the
 * mutual import cycle (F-019).
 */
export function createHandler(callables: CallableMap): AgentRunHandler {
  return async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
    return runHandler(ctx, callables);
  };
}

const runHandler = async (
  ctx: AgentRunContext,
  callables: CallableMap,
): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const ceoDecisions = triggering.filter((e) => e.type === "CeoDecision");

  if (ceoDecisions.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no CeoDecision events in triggering set; nothing to route",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  const outcomes: { decisionId: string; routes: RouteOutcome[] }[] = [];

  for (const e of ceoDecisions) {
    const p = e.payload as Record<string, unknown>;
    const decisionId = String(p.decisionId ?? "(unknown)");
    const action = String(p.action ?? "");
    const followOnRoutes = Array.isArray(p.followOnRoutes)
      ? (p.followOnRoutes as string[]).filter((s) => typeof s === "string")
      : [];

    // Only route on approve. Defer / modify / request-revision do not
    // fire follow-on work; the substantive next move belongs to whoever
    // raises the revised proposal.
    if (action !== "approve") {
      outcomes.push({
        decisionId,
        routes: followOnRoutes.map(
          (r): RouteOutcome => ({
            route: r,
            status: "skipped",
            reason: `parent decision action was "${action}" — follow-ons fire only on "approve"`,
          }),
        ),
      });
      continue;
    }

    if (followOnRoutes.length === 0) {
      outcomes.push({ decisionId, routes: [] });
      continue;
    }

    const routeOutcomes: RouteOutcome[] = [];
    for (const route of followOnRoutes) {
      const outcome = await dispatchOne(ctx, route, decisionId, callables);
      routeOutcomes.push(outcome);

      // Emit an AgentEscalation for unresolved routes so the substrate
      // gap surfaces on the dashboard's escalations panel and Vera's
      // pipeline #14 sees it as audit evidence.
      if (outcome.status === "unresolved" && !ctx.dryRun) {
        eventStore.append(
          makeAgentEscalation({
            asOf: ctx.asOf,
            entity: "BANK-ZA-001",
            actor: { type: "service", id: "agent:scrooge:follow-on-router" },
            citations: EVENT_CITATIONS,
            payload: {
              escalationId: `escalation:scrooge:unresolved-route:${decisionId}:${route}`,
              raisedBy: "Scrooge",
              question: `Follow-on route \`${route}\` for ${decisionId} has no registered runtime handler. ${outcome.reason ?? "Substrate gap."} Should this route be (a) made into a real handler, (b) re-targeted to an existing handler, or (c) struck from the deliverable's followOnRoutes?`,
              options: [
                "Build the missing handler",
                "Re-target to an existing handler",
                "Strike from followOnRoutes (decline to auto-fire)",
              ],
              blockedBy: "Target handler not registered in runtime/handlers-metadata.ts",
              severity: "medium",
              routedTo: "human:marc@tgv.co.za",
            },
          }),
        );
        eventsEmitted++;
      }
    }
    outcomes.push({ decisionId, routes: routeOutcomes });
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun && outcomes.some((o) => o.routes.length > 0)) {
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${fmtDateUTC(ctx.asOf)}_scrooge_follow-on-routing.md`;
    writeFileSync(resolve(ctx.ownerInboxDir, filename), buildAuditMarkdown(ctx, outcomes), "utf8");
    deliverable = `Owner Inbox/${filename}`;
  }

  // Total summary line.
  const totalRoutes = outcomes.reduce((s, o) => s + o.routes.length, 0);
  const dispatched = outcomes
    .flatMap((o) => o.routes)
    .filter((r) => r.status === "dispatched").length;
  const unresolved = outcomes
    .flatMap((o) => o.routes)
    .filter((r) => r.status === "unresolved").length;
  const failed = outcomes.flatMap((o) => o.routes).filter((r) => r.status === "failed").length;

  logger.info(
    { decisions: ceoDecisions.length, totalRoutes, dispatched, unresolved, failed },
    "scrooge:follow-on-router — done",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${ceoDecisions.length} decisions; ${dispatched}/${totalRoutes} routes dispatched, ${unresolved} unresolved, ${failed} failed.`,
    ok: true,
  };
};

// Default export: a handler with an empty stub map.
// handler-callables.ts calls createHandler(HANDLER_CALLABLES) and
// registers the result instead of using this default, so in production
// the callable map is always populated.  The default here keeps the
// module shape consistent with all other agent handlers.
export default createHandler({});
