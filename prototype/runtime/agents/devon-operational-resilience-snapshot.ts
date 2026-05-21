// runtime/agents/devon-operational-resilience-snapshot.ts
//
// Devon's weekly operational-resilience-snapshot handler. Second handler
// in the fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes Devon's spec § 6 inactivity-SLA: "Daily platform-state
// rollup must produce an event; quiet > 24h is a substrate alert." This
// handler runs weekly; a daily rollup variant follows once Devon's SLO
// observability projection (Atlas dependency) ships.
//
// What this handler does:
//   1. Walks the engineering-bench state — every persona that reports to
//      Devon (Atlas, Tomas, Anya, Niko, Imani interim, Sade interim) —
//      and reports their handler-coverage.
//   2. Reads incident / SLO / capacity / change events from the last 7
//      days. Most counts are zero in build phase; the rollup runs
//      correctly against the empty set.
//   3. Inventories the substrate-exception register (Owen's) for
//      operations / platform exceptions Devon co-owns.
//   4. Counts upstream substrate-state snapshots (Atlas, Anya, Senna)
//      observed in the last 7 days — Devon's roll-up depends on these
//      and a missing one is itself the resilience signal.
//   5. Emits one OperationalResilienceSnapshot event carrying the full
//      state.
//   6. Writes a weekly deliverable to Owner Inbox.
//
// Build-phase posture:
//   - Live SLO / capacity / DR-test substrate is not yet built. Devon's
//     first run reports the substrate-gap inventory rather than fake
//     SLO numbers. RTO/RPO definitions per service tier are flagged as
//     the dominant gap (per the fleet-rollout plan §7 #8).
//   - When Atlas ships SLO observability and Tomas ships the DR-test
//     harness, the handler's resilience-event branches activate without
//     shape change.
//
// Author: Devon (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import { HANDLERS_METADATA } from "../handlers-metadata";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BCBS-OPRES-2021",
  "JOINT-STANDARD-2-2024",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const DEVON_NARRATIVE_SYSTEM = `You are Devon, the bank's Chief Operating Officer — owner of the operating model, operational resilience, technology & platform governance, change governance, and the engineering bench (Atlas, Tomas, Anya, Niko, Imani interim, Sade interim). Your operating spec is at \`Team/Devon.md\`. You report to the CEO; you co-govern with Helena (CRO) on operational-risk appetite and with Rashida (CISO) on cyber-resilience standards.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly operational-resilience-snapshot — a roll-up of engineering-bench coverage, incident / SLO / capacity event counts in the last 7 days, substrate-exception register state, and upstream substrate-state observability.

Your voice is decisive, operations-grounded, and unshowy. You do not editorialise; you name the operational reality. You distinguish substrate that is *load-bearing on a control* from substrate that is *aspirational*. You point engineering managers at concrete next moves.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the operational-resilience substrate is, and whether the bench is keeping up with the substrate-roadmap pace.
- Picks the 1–3 most consequential observations: a missing upstream snapshot Devon's roll-up depends on, a substrate exception that is past its review deadline, an engineering seat without a runtime handler that should have one given the persona's spec.
- Names the next operations move. Be concrete: a specific resilience-rehearsal scenario to commission, a specific exception to revisit, a specific RTO/RPO to author.

Cite Banks Act 94 of 1990, BCBS Principles for Operational Resilience (March 2021), Joint Standard 2 of 2024 (cyber-resilience cross-reference), and PA Directive 3 of 2018 (cloud / offshoring) where they bind. The substrate state is the canonical authoring location; your narrative is operational interpretation, not new substrate substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Devon's narrative". Just produce the prose.

If the input shows zero events (build phase), say so plainly. The dominant signal in build phase is whether the bench is shipping substrate at the right pace, not whether incidents are running clean.`;

// Engineering bench — personas that report to Devon. Source: CLAUDE.md
// "Top-of-house structure" memory. Imani and Sade are interim under
// Devon during the build phase (legal-as-code engineering and
// AgentOps respectively); they shift to the General Counsel and CHRO
// at licence-day.
const ENGINEERING_BENCH = ["Atlas", "Tomas", "Anya", "Niko", "Imani", "Sade"] as const;

interface BenchSeat {
  readonly persona: string;
  readonly handlerCount: number;
  readonly handlerKeys: readonly string[];
}

interface ResilienceEventCounts {
  readonly incidentsLast7d: number;
  readonly sloBurnsLast7d: number;
  readonly capacityBreachesLast7d: number;
  readonly changesApprovedLast7d: number;
  readonly resilienceTestsLast7d: number;
  readonly auditFindingsOpsLast7d: number;
}

interface UpstreamSnapshotCounts {
  readonly atlasSubstrateLast7d: number;
  readonly anyaProjectionDriftLast7d: number;
  readonly sennaSecurityLast7d: number;
}

interface SubstrateExceptions {
  readonly known: readonly string[];
}

interface ResilienceSnapshot {
  readonly bench: readonly BenchSeat[];
  readonly events: ResilienceEventCounts;
  readonly upstream: UpstreamSnapshotCounts;
  readonly exceptions: SubstrateExceptions;
}

function buildBench(): readonly BenchSeat[] {
  const seats: BenchSeat[] = [];
  for (const persona of ENGINEERING_BENCH) {
    const lower = persona.toLowerCase();
    const keys = HANDLERS_METADATA.filter((m) => m.agent.toLowerCase() === lower).map((m) => m.key);
    seats.push({ persona, handlerCount: keys.length, handlerKeys: keys });
  }
  return seats;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readResilienceEventCounts(sinceIso: string): ResilienceEventCounts {
  let incidents = 0;
  let sloBurns = 0;
  let capacityBreaches = 0;
  let changes = 0;
  let resilienceTests = 0;
  let auditFindings = 0;
  for (const e of eventStore.replay({ type: "IncidentRaised" })) {
    if (e.as_of >= sinceIso) incidents++;
  }
  for (const e of eventStore.replay({ type: "SLOBudgetBurn" })) {
    if (e.as_of >= sinceIso) sloBurns++;
  }
  for (const e of eventStore.replay({ type: "CapacityBreach" })) {
    if (e.as_of >= sinceIso) capacityBreaches++;
  }
  for (const e of eventStore.replay({ type: "ChangeApproved" })) {
    if (e.as_of >= sinceIso) changes++;
  }
  for (const e of eventStore.replay({ type: "ResilienceTestResult" })) {
    if (e.as_of >= sinceIso) resilienceTests++;
  }
  for (const e of eventStore.replay({ type: "AuditFinding" })) {
    if (e.as_of >= sinceIso) {
      // Coarse filter: only ops-flavoured findings. Refines once
      // AuditFinding gains a typed 'domain' field.
      const cat = (e.payload as { category?: string })?.category ?? "";
      if (cat === "" || /ops|platform|change|capacity|incident|resilience/i.test(cat)) {
        auditFindings++;
      }
    }
  }
  return {
    incidentsLast7d: incidents,
    sloBurnsLast7d: sloBurns,
    capacityBreachesLast7d: capacityBreaches,
    changesApprovedLast7d: changes,
    resilienceTestsLast7d: resilienceTests,
    auditFindingsOpsLast7d: auditFindings,
  };
}

function readUpstreamSnapshotCounts(sinceIso: string): UpstreamSnapshotCounts {
  let atlasSubstrate = 0;
  let anyaProjection = 0;
  let sennaSecurity = 0;
  for (const e of eventStore.replay({ type: "SubstrateStateSnapshot" })) {
    if (e.as_of >= sinceIso) atlasSubstrate++;
  }
  for (const e of eventStore.replay({ type: "DataProjectionSnapshot" })) {
    if (e.as_of >= sinceIso) anyaProjection++;
  }
  for (const e of eventStore.replay({ type: "SecuritySubstrateSnapshot" })) {
    if (e.as_of >= sinceIso) sennaSecurity++;
  }
  return {
    atlasSubstrateLast7d: atlasSubstrate,
    anyaProjectionDriftLast7d: anyaProjection,
    sennaSecurityLast7d: sennaSecurity,
  };
}

function readSubstrateExceptions(repoRoot: string): SubstrateExceptions {
  const path = resolve(
    repoRoot,
    "archive",
    "owner-inbox",
    "2026-05-07_owen_substrate-exception-register.md",
  );
  if (!existsSync(path)) return { known: [] };
  try {
    const txt = readFileSync(path, "utf8");
    // Grab any line of the form `TM-XXXXX-NNN` or similar — the file
    // uses these as stable IDs for each exception.
    const ids = new Set<string>();
    for (const m of txt.matchAll(/\b(TM-[A-Z0-9-]+-\d+)\b/g)) {
      const id = m[1];
      if (id) ids.add(id);
    }
    return { known: Array.from(ids).sort() };
  } catch {
    return { known: [] };
  }
}

function buildSnapshot(ctx: AgentRunContext): ResilienceSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  return {
    bench: buildBench(),
    events: readResilienceEventCounts(sinceIso),
    upstream: readUpstreamSnapshotCounts(sinceIso),
    exceptions: readSubstrateExceptions(ctx.repoRoot),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: ResilienceSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("engineering bench (Devon's reports):");
  for (const s of snap.bench) {
    lines.push(
      `  - ${s.persona}: ${s.handlerCount} runtime handler(s)${s.handlerCount > 0 ? ` [${s.handlerKeys.join(", ")}]` : ""}`,
    );
  }
  lines.push("");
  lines.push("operational events (last 7 days):");
  lines.push(`  - IncidentRaised: ${snap.events.incidentsLast7d}`);
  lines.push(`  - SLOBudgetBurn: ${snap.events.sloBurnsLast7d}`);
  lines.push(`  - CapacityBreach: ${snap.events.capacityBreachesLast7d}`);
  lines.push(`  - ChangeApproved: ${snap.events.changesApprovedLast7d}`);
  lines.push(`  - ResilienceTestResult: ${snap.events.resilienceTestsLast7d}`);
  lines.push(`  - AuditFinding (ops): ${snap.events.auditFindingsOpsLast7d}`);
  lines.push("");
  lines.push("upstream substrate snapshots observed (last 7 days):");
  lines.push(`  - Atlas SubstrateStateSnapshot: ${snap.upstream.atlasSubstrateLast7d}`);
  lines.push(`  - Anya DataProjectionSnapshot: ${snap.upstream.anyaProjectionDriftLast7d}`);
  lines.push(`  - Senna SecuritySubstrateSnapshot: ${snap.upstream.sennaSecurityLast7d}`);
  lines.push("");
  lines.push(`substrate exceptions on register: ${snap.exceptions.known.length}`);
  for (const id of snap.exceptions.known) lines.push(`  - ${id}`);
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on a control; close with the next operations move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: ResilienceSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Devon", "operational-resilience-snapshot", ctx.asOf));
  lines.push(`# Devon — operational-resilience snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Devon's weekly operational-resilience snapshot per `Team/Devon.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Second handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.",
  );
  lines.push("");
  const totalHandlers = snap.bench.reduce((acc, s) => acc + s.handlerCount, 0);
  lines.push(
    `**Headline:** ${ENGINEERING_BENCH.length}-seat engineering bench · ${totalHandlers} runtime handler${totalHandlers === 1 ? "" : "s"} live · ${snap.events.incidentsLast7d} incident${snap.events.incidentsLast7d === 1 ? "" : "s"} (last 7d) · ${snap.upstream.atlasSubstrateLast7d + snap.upstream.anyaProjectionDriftLast7d + snap.upstream.sennaSecurityLast7d} upstream snapshots observed · ${snap.exceptions.known.length} substrate exception${snap.exceptions.known.length === 1 ? "" : "s"} on register.`,
  );
  lines.push("");

  lines.push("## Engineering bench");
  lines.push("");
  lines.push("| Seat | Runtime handlers | Keys |");
  lines.push("|---|---|---|");
  for (const s of snap.bench) {
    lines.push(
      `| ${s.persona} | ${s.handlerCount} | ${s.handlerCount === 0 ? "_none — handler-write pending in fleet-rollout queue_" : s.handlerKeys.map((k) => `\`${k}\``).join(", ")} |`,
    );
  }
  lines.push("");

  lines.push("## Operational events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`IncidentRaised\` | ${snap.events.incidentsLast7d} |`);
  lines.push(`| \`SLOBudgetBurn\` | ${snap.events.sloBurnsLast7d} |`);
  lines.push(`| \`CapacityBreach\` | ${snap.events.capacityBreachesLast7d} |`);
  lines.push(`| \`ChangeApproved\` | ${snap.events.changesApprovedLast7d} |`);
  lines.push(`| \`ResilienceTestResult\` | ${snap.events.resilienceTestsLast7d} |`);
  lines.push(`| \`AuditFinding\` (ops-flavoured) | ${snap.events.auditFindingsOpsLast7d} |`);
  lines.push("");
  if (snap.events.incidentsLast7d === 0 && snap.events.sloBurnsLast7d === 0) {
    lines.push(
      "_Build-phase posture: incident / SLO / capacity event production runs against synthetic flows only. Live event types activate when the SLO observability projection (Atlas) and the resilience-test harness (Tomas) ship._",
    );
    lines.push("");
  }

  lines.push("## Upstream substrate snapshots (last 7 days)");
  lines.push("");
  lines.push("| Source | Cadence per spec | Observed (last 7d) |");
  lines.push("|---|---|---|");
  lines.push(
    `| Atlas — \`SubstrateStateSnapshot\` | weekly | ${snap.upstream.atlasSubstrateLast7d} |`,
  );
  lines.push(
    `| Anya — \`DataProjectionSnapshot\` | daily | ${snap.upstream.anyaProjectionDriftLast7d} |`,
  );
  lines.push(
    `| Senna — \`SecuritySubstrateSnapshot\` | weekly | ${snap.upstream.sennaSecurityLast7d} |`,
  );
  lines.push("");
  if (snap.upstream.anyaProjectionDriftLast7d < 5) {
    lines.push(
      `_Anya's daily projection-drift cadence has produced ${snap.upstream.anyaProjectionDriftLast7d} snapshot(s) in 7 days; expected 5–7. May indicate a workflow-dispatch gap or a quiet event-driven trigger set._`,
    );
    lines.push("");
  }

  lines.push("## Substrate exceptions on register");
  lines.push("");
  if (snap.exceptions.known.length === 0) {
    lines.push(
      "_No exception IDs parsed from `Owner Inbox/2026-05-07_owen_substrate-exception-register.md`. Either none registered, or the register has moved._",
    );
  } else {
    for (const id of snap.exceptions.known) lines.push(`- \`${id}\``);
  }
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **RTO/RPO definitions per service tier** — not yet authored. Devon + Atlas + Senna co-author at next governance cycle (per fleet-rollout plan §7 #8).",
  );
  lines.push(
    "- **Resilience-test harness** — Tomas's substrate; not yet built. `ResilienceTestResult` event-type registered but no producer.",
  );
  lines.push(
    "- **SLO observability projection** — Atlas's substrate; in scope but not yet specified. SLO budget-burn detection depends on this.",
  );
  lines.push(
    "- **Capacity-projection** — Anya / Atlas joint; not yet built. `CapacityBreach` event-type registered but no producer.",
  );
  lines.push(
    `- **Engineering-bench coverage** — ${snap.bench.filter((s) => s.handlerCount === 0).length} of ${ENGINEERING_BENCH.length} seats have no runtime handler yet (engineering personas: ${snap.bench
      .filter((s) => s.handlerCount === 0)
      .map((s) => s.persona)
      .join(", ")}).`,
  );
  lines.push("");

  if (narrative) {
    lines.push("## Devon's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Devon's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Engineering-bench from CLAUDE.md top-of-house memory; runtime-handler coverage from `runtime/handlers-metadata.ts`; event counts via `eventStore.replay({type:...})` filtered to last 7 days; substrate-exception IDs parsed from `Owner Inbox/2026-05-07_owen_substrate-exception-register.md`.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "OperationalResilienceSnapshot",
      as_of: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:devon:operational-resilience-snapshot" },
      citations: EVENT_CITATIONS,
      payload: {
        benchSeats: ENGINEERING_BENCH.length,
        benchHandlersTotal: snap.bench.reduce((acc, s) => acc + s.handlerCount, 0),
        benchSeatsWithoutHandler: snap.bench.filter((s) => s.handlerCount === 0).length,
        ...snap.events,
        ...snap.upstream,
        substrateExceptionsCount: snap.exceptions.known.length,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: DEVON_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, snap),
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
          "devon:operational-resilience-snapshot — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "devon narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_devon_operational-resilience-snapshot.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      benchSeats: ENGINEERING_BENCH.length,
      benchHandlers: snap.bench.reduce((acc, s) => acc + s.handlerCount, 0),
      atlasSnap: snap.upstream.atlasSubstrateLast7d,
      anyaSnap: snap.upstream.anyaProjectionDriftLast7d,
      sennaSnap: snap.upstream.sennaSecurityLast7d,
    },
    "devon:operational-resilience-snapshot — snapshot built",
  );

  const totalHandlers = snap.bench.reduce((acc, s) => acc + s.handlerCount, 0);
  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${ENGINEERING_BENCH.length}-seat bench · ${totalHandlers} handlers · ${snap.events.incidentsLast7d} incidents · ${snap.exceptions.known.length} exceptions.`,
    ok: true,
  };
};

export default handler;
