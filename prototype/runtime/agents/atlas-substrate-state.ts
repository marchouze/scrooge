// runtime/agents/atlas-substrate-state.ts
//
// Atlas's weekly substrate-state report. Snapshots the engineering
// substrate's own state — event types in the store, event counts, agents
// with operating specs, persona-spec coverage, registered runtime handlers,
// and known substrate gaps — and writes a CEO-readable report.
//
// Per Atlas's operating spec § 6 (Cadence): weekly substrate-state report;
// § 11 (Outputs): platform-state event + report.
//
// Different shape from Vera's recon — Vera asserts; Atlas observes. Both
// are read-only over canonical sources and produce events + a deliverable.
//
// Author: Atlas (handler) · runtime infrastructure shared with Vera.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

// Headings that indicate a persona file declares an operating spec —
// matches the detector in dashboard/derive.ts so the two views agree.
// Applied line-by-line (no `m` flag) for consistency with the dashboard.
const OPERATING_SPEC_HEADINGS: readonly RegExp[] = [
  /^##\s+(?:\d+\.\s+)?Cadence\s*$/i,
  /^##\s+(?:\d+\.\s+)?Triggers\s*$/i,
  /^##\s+(?:\d+\.\s+)?Decisions in scope\s*$/i,
  /^##\s+Operating spec\b/i,
];

interface EventTypeStat {
  type: string;
  count: number;
  earliestAsOf: string | undefined;
  latestAsOf: string | undefined;
}

interface PersonaCoverage {
  total: number;
  withOperatingSpec: number;
  withoutOperatingSpec: string[]; // names
}

interface RuntimeHandlerStat {
  agent: string;
  trigger: string;
}

interface SubstrateState {
  asOf: string;
  eventStorePath: string;
  totalEvents: number;
  eventTypes: EventTypeStat[];
  personas: PersonaCoverage;
  runtimeHandlers: RuntimeHandlerStat[];
  recentDeliverablesCount: number; // /Owner Inbox/ count of *.md
  knownSubstrateGaps: string[];
}

function listPersonaFiles(teamDir: string): string[] {
  if (!existsSync(teamDir)) return [];
  return readdirSync(teamDir).filter(
    (n) => n.endsWith(".md") && !n.startsWith("_") && !n.startsWith("."),
  );
}

function detectOperatingSpec(content: string): boolean {
  for (const line of content.split(/\r?\n/)) {
    for (const re of OPERATING_SPEC_HEADINGS) {
      if (re.test(line)) return true;
    }
  }
  return false;
}

function personaCoverage(teamDir: string): PersonaCoverage {
  const files = listPersonaFiles(teamDir);
  const withoutOperatingSpec: string[] = [];
  let withOperatingSpec = 0;
  for (const f of files) {
    const path = resolve(teamDir, f);
    let content = "";
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    if (detectOperatingSpec(content)) {
      withOperatingSpec++;
    } else {
      withoutOperatingSpec.push(f.replace(/\.md$/, ""));
    }
  }
  return {
    total: files.length,
    withOperatingSpec,
    withoutOperatingSpec,
  };
}

function snapshotEventStore(): { totalEvents: number; eventTypes: EventTypeStat[] } {
  const total = eventStore.count();
  const byType = new Map<string, EventTypeStat>();
  for (const e of eventStore.replay()) {
    const stat = byType.get(e.type) ?? {
      type: e.type,
      count: 0,
      earliestAsOf: undefined,
      latestAsOf: undefined,
    };
    stat.count++;
    if (!stat.earliestAsOf || e.as_of < stat.earliestAsOf) stat.earliestAsOf = e.as_of;
    if (!stat.latestAsOf || e.as_of > stat.latestAsOf) stat.latestAsOf = e.as_of;
    byType.set(e.type, stat);
  }
  return {
    totalEvents: total,
    eventTypes: [...byType.values()].sort((a, b) => b.count - a.count),
  };
}

// Best-effort enumeration of registered runtime handlers — mirrors the
// static registry in runtime/run.ts. Hard-coded for now; V2 will read the
// registry from a single source of truth.
function knownRuntimeHandlers(): RuntimeHandlerStat[] {
  return [
    { agent: "Vera", trigger: "overnight-recon" },
    { agent: "Atlas", trigger: "substrate-state" },
  ];
}

function recentDeliverablesCount(ownerInboxDir: string): number {
  if (!existsSync(ownerInboxDir)) return 0;
  let n = 0;
  for (const f of readdirSync(ownerInboxDir)) {
    if (!f.endsWith(".md")) continue;
    const path = resolve(ownerInboxDir, f);
    try {
      if (statSync(path).isFile()) n++;
    } catch {
      // ignore
    }
  }
  return n;
}

// Known substrate gaps that Atlas tracks as ongoing engineering items.
// Curated rather than derived; V2 reads them from a substrate-gap register
// once one exists (per Vera spec § 16, planned recon pipeline #13).
const KNOWN_SUBSTRATE_GAPS: readonly string[] = [
  "Event store is host-local (.local/event.db, gitignored). GitHub Actions runners see a fresh empty store; recon shows registry-only resolved decisions as missing-event findings. Cloud-substrate at M8 (Azure) closes this.",
  "AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised event types not yet defined. Vera pipelines #14/#15 and the dashboard's curated-seed retirement are gated on these.",
  "Event-driven and on-request triggers not yet implemented in the runtime — only scheduled. V2 of the runtime work.",
  "Claude API integration for agent-narrative output: PARTIAL. Wired into Vera's overnight handler (`runtime/claude.ts` + `tryGenerateNarrative` call in vera-overnight-recon.ts). Other handlers still mechanical; rolling out per agent. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.",
  "Projection-cache persistence is partial; Anya's daily projection-drift sweep is not yet a runtime handler.",
  "Citation gate runs as a separate script (bun run citation-gate) outside the runtime; not yet wrapped as an agent run.",
];

function buildState(ctx: AgentRunContext): SubstrateState {
  const teamDir = resolve(ctx.repoRoot, "Team");
  const { totalEvents, eventTypes } = snapshotEventStore();
  return {
    asOf: ctx.asOf,
    eventStorePath: process.env.BANK_EVENT_DB ?? ".local/event.db",
    totalEvents,
    eventTypes,
    personas: personaCoverage(teamDir),
    runtimeHandlers: knownRuntimeHandlers(),
    recentDeliverablesCount: recentDeliverablesCount(ctx.ownerInboxDir),
    knownSubstrateGaps: [...KNOWN_SUBSTRATE_GAPS],
  };
}

function fmtDateUTC(iso: string): string {
  return iso.slice(0, 10);
}

function buildReportMarkdown(ctx: AgentRunContext, s: SubstrateState): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push("---");
  lines.push("agent: Atlas");
  lines.push("trigger: substrate-state");
  lines.push(`asOf: ${ctx.asOf}`);
  lines.push("decision-required: false");
  lines.push("---");
  lines.push("");
  lines.push(`# Atlas — substrate state, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${s.totalEvents} events across ${s.eventTypes.length} types; ${s.personas.withOperatingSpec}/${s.personas.total} personas have operating specs; ${s.runtimeHandlers.length} runtime handlers registered; ${s.recentDeliverablesCount} files in /Owner Inbox/; ${s.knownSubstrateGaps.length} substrate gaps tracked.`,
  );
  lines.push("");

  lines.push("## Event store");
  lines.push("");
  lines.push(`Path: \`${s.eventStorePath}\` · Total events: ${s.totalEvents}`);
  lines.push("");
  if (s.eventTypes.length === 0) {
    lines.push(
      "_No events in the store. This is expected on a fresh GitHub Actions runner (the event store is host-local until M8 cloud lift)._",
    );
  } else {
    lines.push("| Event type | Count | Earliest | Latest |");
    lines.push("|---|---|---|---|");
    for (const t of s.eventTypes) {
      lines.push(
        `| \`${t.type}\` | ${t.count} | ${t.earliestAsOf?.slice(0, 10) ?? "—"} | ${t.latestAsOf?.slice(0, 10) ?? "—"} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Personas — operating-spec coverage");
  lines.push("");
  lines.push(
    `${s.personas.withOperatingSpec} of ${s.personas.total} persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).`,
  );
  lines.push("");
  if (s.personas.withoutOperatingSpec.length > 0) {
    lines.push(
      `**Without operating spec:** ${s.personas.withoutOperatingSpec.map((n) => `\`${n}\``).join(", ")}.`,
    );
    lines.push("");
  }

  lines.push("## Runtime handlers");
  lines.push("");
  lines.push(
    `${s.runtimeHandlers.length} agent run handlers registered in \`runtime/run.ts\`. Each can be invoked locally via \`bun run agent:<slug>\` and on cron via \`.github/workflows/agent-runtime-*.yml\`.`,
  );
  lines.push("");
  lines.push("| Agent | Trigger |");
  lines.push("|---|---|");
  for (const h of s.runtimeHandlers) {
    lines.push(`| ${h.agent} | \`${h.trigger}\` |`);
  }
  lines.push("");

  lines.push("## Substrate gaps");
  lines.push("");
  lines.push(
    "Tracked engineering items that block agents from running fully autonomously. Each closes when the corresponding substrate work lands.",
  );
  lines.push("");
  for (const g of s.knownSubstrateGaps) {
    lines.push(`- ${g}`);
  }
  lines.push("");

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    `Event-store snapshot via \`@platform/composition\`'s \`eventStore.replay()\`. Persona coverage by reading \`/Team/*.md\`. Runtime handlers from \`runtime/run.ts\`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).`,
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const state = buildState(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "SubstrateStateSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:atlas:substrate-state" },
      citations: EVENT_CITATIONS,
      payload: {
        totalEvents: state.totalEvents,
        eventTypeCount: state.eventTypes.length,
        personaCoverage: {
          total: state.personas.total,
          withSpec: state.personas.withOperatingSpec,
          withoutSpec: state.personas.withoutOperatingSpec.length,
        },
        runtimeHandlerCount: state.runtimeHandlers.length,
        substrateGapCount: state.knownSubstrateGaps.length,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${fmtDateUTC(ctx.asOf)}_atlas_substrate-state.md`;
    const path = resolve(ctx.ownerInboxDir, filename);
    writeFileSync(path, buildReportMarkdown(ctx, state), "utf8");
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      totalEvents: state.totalEvents,
      eventTypes: state.eventTypes.length,
      personasWithSpec: state.personas.withOperatingSpec,
      personasTotal: state.personas.total,
    },
    "atlas:substrate-state — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${state.totalEvents} events / ${state.eventTypes.length} types; ${state.personas.withOperatingSpec}/${state.personas.total} personas spec-ready; ${state.runtimeHandlers.length} handlers; ${state.knownSubstrateGaps.length} gaps tracked.`,
    ok: true,
  };
};

export default handler;
