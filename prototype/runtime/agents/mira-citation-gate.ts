// runtime/agents/mira-citation-gate.ts
//
// Mira's on-request citation-gate handler. Closes Atlas substrate-gap #6:
// the citation gate previously ran only as a separate `bun run
// citation-gate` script invoked from CI; this is the agent shape so the
// gate can be:
//   - dispatched on-request from a workflow_dispatch (no schedule) when
//     Marc or another automation wants to verify citation discipline now;
//   - chained from event-driven dispatch when high-cardinality append
//     workloads land (M8 / event bus);
//   - included in Atlas's runtime-handler inventory rather than as a
//     parallel CI script that drifts out of view.
//
// Per CLAUDE.md Principle 2 (every action carries a citation) — the gate
// is the runtime check that no event slipped through without one. The
// underlying logic lives at `platform/citation/gate.ts`; this handler
// wraps it as an AgentRunHandler with proper event emission and an Owner
// Inbox deliverable for evidence. Vera's continuous-controls programme
// consumes the AuditFinding stream as third-line evidence.
//
// Author: Mira (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["P2-CITATION-DISCIPLINE", "FIC-ACT-38-2001"];

interface GateResult {
  total: number;
  violations: Array<{ event_id: string; type: string }>;
}

function runCitationGate(): GateResult {
  // Walk the same store the runtime composes (in-process, not via subprocess).
  let total = 0;
  const violations: GateResult["violations"] = [];
  for (const e of eventStore.replay()) {
    total++;
    if (!e.citations || e.citations.length === 0) {
      violations.push({ event_id: e.event_id, type: e.type });
    }
  }
  return { total, violations };
}

function buildReportMarkdown(ctx: AgentRunContext, gate: GateResult): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Mira", "citation-gate", ctx.asOf));
  lines.push(`# Mira — citation gate, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous (or on-request) run of Mira's citation-gate per CLAUDE.md Principle 2 (every action traces to a source). Verifies that every event in the store carries at least one citation — the append path enforces it via Zod, so a violation here would indicate corruption or an out-of-band write.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${gate.total} event${gate.total === 1 ? "" : "s"} scanned · ${gate.violations.length} P2 violation${gate.violations.length === 1 ? "" : "s"}.`,
  );
  lines.push("");

  lines.push("## Result");
  lines.push("");
  if (gate.violations.length === 0) {
    lines.push("Gate passed. Every event carries at least one citation.");
  } else {
    lines.push("**Gate failed.** The following events have no citations:");
    lines.push("");
    lines.push("| event_id | type |");
    lines.push("|---|---|");
    for (const v of gate.violations) {
      lines.push(`| \`${v.event_id}\` | \`${v.type}\` |`);
    }
    lines.push("");
    lines.push(
      "Action: trace each event back to its writer. The append path validates citations at write-time, so a missing-citation event implies either schema bypass or a corrupt store. Both are substrate-gap items requiring engineering escalation.",
    );
  }
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Walked the in-process event store via `eventStore.replay()`. No Postgres write paths in this handler; the gate is read-only. AuditFinding event emitted on each violation; CitationGatePassed / CitationGateFailed event emitted at the end.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const gate = runCitationGate();

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    // Top-level summary event.
    eventStore.append({
      event_id: newEventId(),
      type: gate.violations.length === 0 ? "CitationGatePassed" : "CitationGateFailed",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:mira:citation-gate" },
      citations: EVENT_CITATIONS,
      payload: {
        eventsScanned: gate.total,
        violationCount: gate.violations.length,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;

    // One AuditFinding per violation. Each carries the offending event_id
    // so Vera's third-line pipeline can reconcile back to the source.
    for (const v of gate.violations) {
      eventStore.append({
        event_id: newEventId(),
        type: "AuditFinding",
        as_of: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:mira:citation-gate" },
        citations: EVENT_CITATIONS,
        payload: {
          findingId: `finding:mira:citation-gate:${v.event_id}`,
          source: "agent:mira:citation-gate",
          severity: "high",
          principle: "P2",
          description: `Event ${v.event_id} (type=${v.type}) has no citations.`,
          offendingEventId: v.event_id,
          offendingEventType: v.type,
        },
      });
      eventsEmitted++;
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${fmtDateUTC(ctx.asOf)}_mira_citation-gate.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, gate),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    { eventsScanned: gate.total, violations: gate.violations.length },
    "mira:citation-gate — gate run complete",
  );

  // Exit semantics: a failed gate is a *finding*, not a runtime error.
  // The runtime exit code is 0 (handler completed); the deliverable + the
  // CitationGateFailed event are the surfacing channel. Workflows can
  // parse the deliverable / event stream to decide whether to escalate.
  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${gate.total} events scanned · ${gate.violations.length} P2 violations.`,
    ok: true,
  };
};

export default handler;
