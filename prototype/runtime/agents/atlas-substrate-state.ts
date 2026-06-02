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
import {
  makeAgentDecision,
  makeAgentEscalation,
  makeWorkstreamRegistered,
} from "../../platform/event-store/event-types";
import {
  SUBSTRATE_GAP_REGISTER,
  type SubstrateGapRecord,
} from "../../platform/substrate/gap-register";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import { HANDLERS_METADATA } from "../handlers-metadata";
import type { AgentRunContext, AgentRunOutput } from "../types";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

// Stable system prompt — KEEP BYTE-STABLE. See `shared/prompt-caching.md`.
const ATLAS_NARRATIVE_SYSTEM = `You are Atlas, the bank's core banking platform architect — owner of the event-sourced substrate, identity, IaC, observability, and projections runtime. Your operating spec is at \`Team/Atlas.md\`. You report through Devon (COO) at the governance level.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly substrate-state snapshot — a structured observation of the engineering substrate's own state: event types in the store, persona-spec coverage, registered runtime handlers, the Owner Inbox count, and the substrate-gap inventory you maintain.

Your voice is precise, unsentimental, engineering-led. You do not editorialise. You name the substrate's actual state — what is built, what is partial, what is not yet substrate at all — and you call gaps gaps. You do not pretend a simulated piece of the runtime is operational; the bank is AI-driven (per CLAUDE.md memory:project_ai_driven_bank.md), and dishonesty about substrate completeness defeats the operating model.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline state of the substrate at the top: how complete it is at a glance, what is closing, what is blocking.
- Picks out the 1–3 most consequential changes since the prior week's run (when there is one) — a new event type, a new runtime handler, a closed substrate gap. If this is a fresh runner with no event history visible, say so plainly and characterise the substrate from the snapshot alone.
- Names the substrate gaps that are *load-bearing* on something downstream — Vera's audit pipelines #14/#15 gated on \`AgentEscalation\` events, the dashboard's curated-seed retirement gated on \`WorkstreamRegistered\`, or any other dependency the snapshot makes visible. Do not list every gap; rank by impact.
- Closes with one line on what the substrate needs next.

Cite event types by their type literal (\`SubstrateStateSnapshot\`, \`AgentEscalation\`, \`WorkstreamCompleted\`) and agents by name. The host event store is gitignored and host-local until M8 (Azure cloud lift); a fresh GitHub Actions runner sees zero events. That is expected; characterise it explicitly when you see the snapshot show 0 events / 0 types.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Atlas's narrative". Just produce the prose.

If the input is empty or malformed, say so and decline to opine.`;

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

// Registered runtime handlers — derived from the canonical metadata
// registry at `runtime/handlers-metadata.ts` (A1 consolidation,
// 2026-05-07). No more drift between Atlas's snapshot, the dashboard
// view, and the runtime registry.
function knownRuntimeHandlers(): RuntimeHandlerStat[] {
  return HANDLERS_METADATA.map((h) => ({ agent: h.agent, trigger: h.trigger }));
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

/**
 * One substrate-status row in the SubstrateStateSnapshot `gaps[]` inventory —
 * a render of one `SubstrateGapRecord` (description truncated for the snapshot).
 */
export interface SubstrateGapInventoryRow {
  readonly index: number;
  readonly id: string;
  readonly description: string;
  readonly severity: SubstrateGapRecord["severity"];
  readonly status: SubstrateGapRecord["status"];
  readonly mitigation: SubstrateGapRecord["mitigation"];
}

/**
 * Renders the canonical substrate-gap register into the snapshot inventory.
 * Severity / status / mitigation are read straight from the register (no
 * regex heuristics — those decisions are made once, in the register).
 * Substrate gaps are forward engineering work, NOT risk-register findings
 * (WS-RISK-REGISTER-CLOSURE) — `severity` is a planning heuristic (blast
 * radius), not a risk-appetite measure. Pure: emits nothing; the handler
 * folds the result into the SubstrateStateSnapshot `gaps[]` field + per-gap
 * WorkstreamRegistered events.
 */
export function buildGapInventory(
  register: readonly SubstrateGapRecord[] = SUBSTRATE_GAP_REGISTER,
): SubstrateGapInventoryRow[] {
  return register.map((gap, i) => ({
    index: i + 1,
    id: gap.id,
    description:
      gap.description.length > 240 ? `${gap.description.slice(0, 237)}...` : gap.description,
    severity: gap.severity,
    status: gap.status,
    mitigation: gap.mitigation,
  }));
}

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
    knownSubstrateGaps: SUBSTRATE_GAP_REGISTER.map((g) => g.description),
  };
}

function fmtDateUTC(iso: string): string {
  return iso.slice(0, 10);
}

function buildNarrativeInput(ctx: AgentRunContext, s: SubstrateState): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Snapshot:");
  lines.push(`- event store path: ${s.eventStorePath}`);
  lines.push(`- total events: ${s.totalEvents}`);
  lines.push(`- event types in store: ${s.eventTypes.length}`);
  if (s.eventTypes.length > 0) {
    lines.push("");
    lines.push("event-type breakdown:");
    for (const t of s.eventTypes) {
      lines.push(
        `  - ${t.type}: count=${t.count}, earliest=${t.earliestAsOf?.slice(0, 10) ?? "—"}, latest=${t.latestAsOf?.slice(0, 10) ?? "—"}`,
      );
    }
  }
  lines.push("");
  lines.push(`personas: ${s.personas.withOperatingSpec}/${s.personas.total} have operating specs`);
  if (s.personas.withoutOperatingSpec.length > 0) {
    lines.push(`  without spec: ${s.personas.withoutOperatingSpec.join(", ")}`);
  }
  lines.push("");
  lines.push(`runtime handlers registered: ${s.runtimeHandlers.length}`);
  for (const h of s.runtimeHandlers) {
    lines.push(`  - ${h.agent}:${h.trigger}`);
  }
  lines.push("");
  lines.push(`/Owner Inbox/ deliverable count: ${s.recentDeliverablesCount}`);
  lines.push("");
  lines.push("Substrate gaps tracked:");
  for (const g of s.knownSubstrateGaps) {
    lines.push(`- ${g}`);
  }
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank gaps by downstream impact; close with what the substrate needs next.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  s: SubstrateState,
  narrative: string | null,
  narrativeNote: string | null,
): string {
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

  if (narrative) {
    lines.push("## Atlas's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Atlas's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

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
  // Per-gap substrate-status inventory. Substrate gaps are forward
  // engineering work, NOT risk-register findings (WS-RISK-REGISTER-CLOSURE):
  // they ride on the SubstrateStateSnapshot status surface + their own
  // WorkstreamRegistered events, never on RiskRaised.
  const gapInventory = buildGapInventory();

  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "SubstrateStateSnapshot",
      as_of: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
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
        gaps: gapInventory,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;

    // -------------------------------------------------------------------------
    // AgentEscalation — two highest-blast-radius substrate gaps.
    //
    // Gap 1: Bus is in-process only → Vera audit pipelines #14/#15 are gated.
    //   Escalate to Vera so the dependency is visible in her audit stream.
    // Gap 2: GH Actions cron drift (A2.1) → cross-host scheduler unreliability.
    //   Self-escalate to Atlas so it surfaces on Atlas's own inbound queue.
    //
    // Idempotency: emit only when no undecided escalation with the same stem
    // already exists. This prevents accumulation of date-stamped duplicates
    // when the question hasn't been answered yet.
    // -------------------------------------------------------------------------
    const atlasEscActor = { type: "service" as const, id: "agent:atlas:substrate-state" };

    // Build decided-escalation set once for both checks below.
    const decidedEscIds = new Set<string>();
    for (const e of eventStore.replay({ type: "AgentEscalationDecided" })) {
      const p = e.payload as Record<string, unknown>;
      const id = String(p.escalationId ?? "");
      if (id) decidedEscIds.add(id);
    }

    function hasOpenEscalation(stem: string): boolean {
      for (const e of eventStore.replay({ type: "AgentEscalation" })) {
        const p = e.payload as Record<string, unknown>;
        const id = String(p.escalationId ?? "");
        if (id.startsWith(stem) && !decidedEscIds.has(id)) return true;
      }
      return false;
    }

    // True if any date-variant of this escalation stem has already been decided.
    // Prevents re-raising a question that has already been answered, even after
    // the decided variant's date-stamped ID no longer matches an open escalation.
    function hasDecidedEscalation(stem: string): boolean {
      for (const id of decidedEscIds) {
        if (id.startsWith(stem)) return true;
      }
      return false;
    }

    if (
      !hasOpenEscalation("esc:atlas:bus-in-process-") &&
      !hasDecidedEscalation("esc:atlas:bus-in-process-")
    ) {
      eventStore.append(
        makeAgentEscalation({
          asOf: ctx.asOf,
          entity: "LE-ZA-HOZ-BANK",
          actor: atlasEscActor,
          citations: EVENT_CITATIONS,
          payload: {
            escalationId: `esc:atlas:bus-in-process-${fmtDateUTC(ctx.asOf)}`,
            raisedBy: "Atlas",
            question:
              "Event-driven dispatch is in-process only (no cross-process bus). " +
              "Vera audit pipelines #14 and #15 are gated on AgentEscalation events " +
              "flowing from a running handler to Vera's subscriber — which requires at " +
              "minimum in-process fan-out to be wired. Are pipelines #14/#15 now unblocked, " +
              "or does Vera need an explicit integration test before marking them green?",
            options: [
              "Confirm in-process fan-out satisfies pipelines #14/#15 for now; track cross-process bus as M8 work only.",
              "Vera runs integration test against the emitted AgentEscalation events before closing #14/#15.",
              "Defer: keep #14/#15 blocked until the full cross-process bus lands (M8 cloud lift).",
            ],
            blockedBy: "M8 cloud-lift (cross-process event bus)",
            severity: "medium",
            routedTo: "Vera",
          },
        }),
      );
      eventsEmitted++;
    }

    if (
      !hasOpenEscalation("esc:atlas:cron-drift-a2-1-") &&
      !hasDecidedEscalation("esc:atlas:cron-drift-a2-1-")
    ) {
      eventStore.append(
        makeAgentEscalation({
          asOf: ctx.asOf,
          entity: "LE-ZA-HOZ-BANK",
          actor: atlasEscActor,
          citations: EVENT_CITATIONS,
          payload: {
            escalationId: `esc:atlas:cron-drift-a2-1-${fmtDateUTC(ctx.asOf)}`,
            raisedBy: "Atlas",
            question:
              "GH Actions cron reliability is an ongoing substrate gap (A2.1). " +
              "Scheduled runs have been observed to drift by hours or be silently dropped. " +
              "Workaround (distinct off-the-hour minutes per workflow) is in place but is " +
              "not a permanent fix. Should Atlas prioritise the A2.1 substrate scheduler " +
              "(Bun process emitting typed ScheduledTrigger events) ahead of other " +
              "planned M-phase work, or continue with the workaround through the build phase?",
            options: [
              "Prioritise A2.1 substrate scheduler ahead of other M-phase items.",
              "Continue with the cron-minute workaround; revisit at M8 cloud lift.",
              "Accept residual drift risk and document it in Atlas's substrate-gap register.",
            ],
            blockedBy: "A2.1 substrate scheduler not yet built",
            severity: "medium",
            routedTo: "Atlas",
          },
        }),
      );
      eventsEmitted++;
    }

    // -------------------------------------------------------------------------
    // AgentDecision — classify the event bus as in-process-only.
    //
    // One-time stable architectural decision (not per-run). Guard with an
    // idempotency check so repeated handler invocations don't accumulate
    // duplicate events in the store.
    // -------------------------------------------------------------------------
    const BUS_DECISION_ID = "dec:atlas:bus-classification";
    const alreadyDecided = eventStore
      .replay({ type: "AgentDecision" })
      .some(
        (e) => (e as { payload?: { decisionId?: string } }).payload?.decisionId === BUS_DECISION_ID,
      );
    if (!alreadyDecided) {
      eventStore.append(
        makeAgentDecision({
          asOf: ctx.asOf,
          entity: "LE-ZA-HOZ-BANK",
          actor: atlasEscActor,
          citations: EVENT_CITATIONS,
          payload: {
            decisionId: BUS_DECISION_ID,
            decidedBy: "Atlas",
            what: "Classify event-driven dispatch bus as in-process-only for build phase",
            inScopeBy: "Approve bus architecture and event-routing design decisions",
            options: [
              "in-process-only (no cross-process bus; fan-out within a single agent run)",
              "cross-process bus via Redis/NATS (requires M8 cloud lift)",
              "deferred: no classification until M8 design is finalised",
            ],
            chosen: "in-process-only (no cross-process bus; fan-out within a single agent run)",
            rationale:
              "The cross-process event bus is an M8 cloud-lift deliverable. " +
              "For the build phase, in-process fan-out within a single agent run is " +
              "sufficient and keeps the substrate minimal. Vera audit pipelines #14/#15 " +
              "can consume AgentEscalation events emitted in-process; cross-process " +
              "delivery is tracked as substrate gap and escalated separately.",
          },
        }),
      );
      eventsEmitted++;
    }

    // -------------------------------------------------------------------------
    // WorkstreamRegistered — A2.1 substrate scheduler (dedicated entry).
    //
    // The generic gap-loop below emits a WorkstreamRegistered per gap line, but
    // A2.1 warrants a first-class registration with a stable workstreamId so
    // downstream subscribers (dashboard inFlight panel, Vera pipeline #15) can
    // reference it by a canonical ID rather than a positional index.
    // -------------------------------------------------------------------------
    eventStore.append(
      makeWorkstreamRegistered({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: atlasEscActor,
        citations: EVENT_CITATIONS,
        payload: {
          workstreamId: "A2.1-substrate-scheduler",
          title: "A2.1 — Substrate scheduler: Bun process emitting typed ScheduledTrigger events",
          owner: "atlas",
          status: "planned",
          summary:
            "Replace GitHub Actions cron with a Bun process that emits typed ScheduledTrigger " +
            "events on the configured schedule. Eliminates GH Actions cron drift (observed " +
            "silent drops + multi-hour delays). Cron workflow files become thin shims or " +
            "retire entirely. Dependency: none; blocks cross-host scheduler reliability.",
          scopedBy:
            "prototype/platform/substrate/gap-register.ts — SUBSTRATE_GAP_REGISTER[github-actions-cron]",
        },
      }),
    );
    eventsEmitted++;

    // Emit one WorkstreamRegistered per substrate gap. Each gap is a body of
    // engineering work the bank is committed to; it surfaces on the inFlight
    // panel of the dashboard. The gap is NOT a risk-register finding —
    // substrate-status now rides on the SubstrateStateSnapshot `gaps[]`
    // inventory above, not on RiskRaised (WS-RISK-REGISTER-CLOSURE). Status:
    // closed gaps register as "in-flight" with mitigation in place; open gaps
    // as "planned".
    const atlasActor = { type: "service" as const, id: "agent:atlas:substrate-state" };
    for (const gap of gapInventory) {
      eventStore.append(
        makeWorkstreamRegistered({
          asOf: ctx.asOf,
          entity: "LE-ZA-HOZ-BANK",
          actor: atlasActor,
          citations: EVENT_CITATIONS,
          payload: {
            workstreamId: `workstream:atlas:substrate-gap-${gap.index}`,
            title: gap.description.split(".")[0]?.slice(0, 80) ?? `Substrate gap ${gap.index}`,
            owner: "Atlas",
            status: gap.status,
            summary: gap.description,
            scopedBy: "Owner Inbox/2026-05-07_atlas_substrate-state.md",
          },
        }),
      );
      eventsEmitted++;
    }
  }

  // Narrative pass (degrades gracefully when ANTHROPIC_API_KEY is unset).
  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Substrate snapshot above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: ATLAS_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, state),
        maxTokens: 6_000,
        effort: "high",
        meta: { runId: ctx.runId ?? ctx.trigger.id, agent: ctx.agent, dryRun: ctx.dryRun },
      });
      if (r.ok) {
        narrative = r.result.text.trim();
        logger.info(
          {
            inputTokens: r.result.usage.inputTokens,
            cacheReadInputTokens: r.result.usage.cacheReadInputTokens,
            outputTokens: r.result.usage.outputTokens,
            model: r.result.model,
          },
          "atlas:substrate-state — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "atlas narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${fmtDateUTC(ctx.asOf)}_atlas_substrate-state.md`;
    const path = resolve(ctx.ownerInboxDir, filename);
    writeFileSync(path, buildReportMarkdown(ctx, state, narrative, narrativeNote), "utf8");
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
