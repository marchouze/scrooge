// runtime/agents/anya-projection-drift.ts
//
// Anya's daily projection-drift sweep. Snapshots the canonical-source
// counts that the bank's projections reduce over (CLAUDE.md principles,
// /Team/ persona files, /Procedures/ files, /Regulations/ instruments,
// the obligations register, /Owner Inbox/ deliverables) and compares
// them against the dashboard cache to detect drift.
//
// Per Anya's spec § 6: hourly projection-health sweep + daily drift
// check. The MVP runs daily on cron; hourly is V2 once event-triggered
// runs land.
//
// Different shape from Vera (recon assertions) and Atlas (substrate
// state): Anya snapshots the *data layer* — the counts that every
// projection ultimately rolls up to. Drift is a Vera-style finding when
// it occurs, but the snapshot itself is the deliverable.
//
// Author: Anya (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { defaultSourcePaths, deriveState, eventSourceFromStore } from "../../dashboard/derive";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const ANYA_NARRATIVE_SYSTEM = `You are Anya, the bank's data / analytics engineer — owner of the projection runtime, master data, semantic layer, regulatory and MI marts, data contracts, and the ML platform. Your operating spec is at \`Team/Anya.md\`. You report through Devon (COO) at the governance level.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your daily projection-drift sweep — a snapshot of canonical-source counts (CLAUDE.md principles, /Team/ persona files, /Procedures/ files, /Regulations/ instruments and obligations, /Owner Inbox/ deliverables, /Team Inbox/ items) and a cross-check against the dashboard cache to detect drift.

Your voice is precise, projection-grounded, and unsentimental. You distinguish *canonical* (the file system / event store, authoritative) from *cached* (the dashboard projection, derived). Drift is not pathological by itself — it can mean the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. You name which.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how the canonical-source counts moved versus the cache, whether the dashboard reaches this run, and whether there's drift to call out.
- Picks the 1–3 most consequential observations: a metric whose drift signals a stale cache, a metric where canonical has grown but the cache hasn't, an unreachable dashboard cache that should be diagnosed.
- Names what to do: refresh the dashboard projection, raise a Vera dashboard-derivation finding, or note that drift is expected (e.g. fresh runner without the cache present).

Cite metric names by their JSON keys (\`principles\`, \`obligations\`, \`instruments\`, \`instrumentsAnalysed\`, \`proceduresPopulated\`). The canonical files are the canonical authoring location; your narrative is interpretation, not new substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Anya's narrative". Just produce the prose.

If the dashboard cache is unreachable on the runner (the common case on a fresh GitHub Actions runner), say so plainly and characterise the canonical-source counts on their own.`;

// CLAUDE.md lists principles as bullet points under "## Architectural principles":
//   - **Principle 1 — Events are the only source of truth.** ...
// The previous pattern matched `### Principle N —` (heading form) which returns 0.
// The correct pattern matches the bullet form used in the live CLAUDE.md.
const PRINCIPLE_HEADING = /^- \*\*Principle \d+ —/;
const ORG_OBLIGATION_ID = /^\|\s*ORG-/i;
const REG_INDEX_POPULATED = /\*\*POPULATED\*\*/;

interface CanonicalSourceCounts {
  principlesInClaudeMd: number;
  personaFiles: number; // /Team/*.md (excluding _-prefixed)
  procedureFiles: number; // /Procedures/by-policy/*.md
  obligationsRegisterRows: number; // ORG-* rows in obligations register
  regulationsTotal: number; // rows in Regulations/_index.md
  regulationsPopulated: number; // POPULATED-flagged rows
  ownerInboxFiles: number;
  teamInboxOpen: number;
  teamInboxActioned: number;
}

function countMatches(content: string, re: RegExp): number {
  let n = 0;
  for (const line of content.split(/\r?\n/)) if (re.test(line)) n++;
  return n;
}

function listMdFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("_") && !f.startsWith("."),
  );
}

function snapshotCounts(repoRoot: string): CanonicalSourceCounts {
  const claudeMdPath = resolve(repoRoot, "CLAUDE.md");
  const claudeMd = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, "utf8") : "";
  const obligationsPath = resolve(repoRoot, "Regulations", "_obligations-register.md");
  const obligations = existsSync(obligationsPath) ? readFileSync(obligationsPath, "utf8") : "";
  const regIndexPath = resolve(repoRoot, "Regulations", "_index.md");
  const regIndex = existsSync(regIndexPath) ? readFileSync(regIndexPath, "utf8") : "";

  const teamDir = resolve(repoRoot, "Team");
  const proceduresDir = resolve(repoRoot, "Procedures", "by-policy");
  const ownerInboxDir = resolve(repoRoot, "archive", "owner-inbox");
  const teamInboxDir = resolve(repoRoot, "archive", "team-inbox");
  const teamInboxActionedDir = resolve(teamInboxDir, "actioned");

  return {
    principlesInClaudeMd: countMatches(claudeMd, PRINCIPLE_HEADING),
    personaFiles: listMdFiles(teamDir).length,
    procedureFiles: listMdFiles(proceduresDir).length,
    obligationsRegisterRows: countMatches(obligations, ORG_OBLIGATION_ID),
    regulationsTotal: countMatches(regIndex, /^\|\s*[A-Z]/), // rough; counts table-ish rows
    regulationsPopulated: countMatches(regIndex, REG_INDEX_POPULATED),
    ownerInboxFiles: listMdFiles(ownerInboxDir).length,
    teamInboxOpen: existsSync(teamInboxDir)
      ? readdirSync(teamInboxDir).filter((f) => f.endsWith(".md")).length
      : 0,
    teamInboxActioned: existsSync(teamInboxActionedDir)
      ? readdirSync(teamInboxActionedDir).filter((f) => f.endsWith(".md")).length
      : 0,
  };
}

interface DashboardSnapshot {
  reachable: boolean;
  metrics: Record<string, number> | undefined;
  asOf: string | undefined;
}

function readDashboardCache(repoRoot: string): DashboardSnapshot {
  // D-EVENT-STORE-SCALING Slice 3b (2026-05-10): the committed seed
  // `prototype/seeds/dashboard-state.json` is gone from the commit graph.
  // Read the runtime cache under `.local/` if present; otherwise derive on
  // the fly from canonical sources + the in-process event store. The
  // "unreachable" branch is now genuinely a "derivation threw" condition
  // rather than a "no cache file" one.
  const runtimeRel = process.env.BANK_DASHBOARD_RUNTIME_STATE ?? ".local/dashboard-state.json";
  const runtimePath = resolve(repoRoot, "prototype", runtimeRel);
  if (existsSync(runtimePath)) {
    try {
      const raw = JSON.parse(readFileSync(runtimePath, "utf8")) as {
        asOf?: string;
        bank?: { metrics?: Record<string, number> };
      };
      return {
        reachable: true,
        asOf: raw.asOf,
        metrics: raw.bank?.metrics,
      };
    } catch {
      // Fall through to derivation.
    }
  }
  try {
    const sources = defaultSourcePaths(repoRoot);
    const state = deriveState({
      sources,
      events: eventSourceFromStore(eventStore),
    });
    return {
      reachable: true,
      asOf: state.asOf,
      metrics: state.bank.metrics as unknown as Record<string, number>,
    };
  } catch {
    return { reachable: false, metrics: undefined, asOf: undefined };
  }
}

interface DriftRow {
  metric: string;
  canonical: number;
  cached: number | undefined;
  drift: number | undefined; // canonical - cached; undefined if not in cache
}

function computeDrift(counts: CanonicalSourceCounts, snapshot: DashboardSnapshot): DriftRow[] {
  const m = snapshot.metrics ?? {};
  const map: Record<string, number> = {
    principles: counts.principlesInClaudeMd,
    obligations: counts.obligationsRegisterRows,
    instruments: counts.regulationsTotal,
    instrumentsAnalysed: counts.regulationsPopulated,
    proceduresPopulated: counts.procedureFiles,
  };
  const out: DriftRow[] = [];
  for (const [metric, canonical] of Object.entries(map)) {
    const cached = m[metric];
    out.push({
      metric,
      canonical,
      cached,
      drift: cached === undefined ? undefined : canonical - cached,
    });
  }
  return out;
}

function buildNarrativeInput(
  ctx: AgentRunContext,
  counts: CanonicalSourceCounts,
  snapshot: DashboardSnapshot,
  drift: DriftRow[],
): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`dashboard cache reachable: ${snapshot.reachable}`);
  if (snapshot.asOf) lines.push(`dashboard asOf: ${snapshot.asOf}`);
  lines.push("");
  lines.push("canonical-source counts:");
  lines.push(`  - principlesInClaudeMd: ${counts.principlesInClaudeMd}`);
  lines.push(`  - personaFiles: ${counts.personaFiles}`);
  lines.push(`  - procedureFiles: ${counts.procedureFiles}`);
  lines.push(`  - obligationsRegisterRows: ${counts.obligationsRegisterRows}`);
  lines.push(`  - regulationsTotal: ${counts.regulationsTotal}`);
  lines.push(`  - regulationsPopulated: ${counts.regulationsPopulated}`);
  lines.push(`  - ownerInboxFiles: ${counts.ownerInboxFiles}`);
  lines.push(`  - teamInboxOpen: ${counts.teamInboxOpen}`);
  lines.push(`  - teamInboxActioned: ${counts.teamInboxActioned}`);
  lines.push("");
  lines.push("cross-check (canonical vs cached):");
  for (const d of drift) {
    const driftDisplay =
      d.drift === undefined
        ? "n/a"
        : d.drift === 0
          ? "0"
          : d.drift > 0
            ? `+${d.drift}`
            : `${d.drift}`;
    lines.push(
      `  - ${d.metric}: canonical=${d.canonical}, cached=${d.cached ?? "—"}, drift=${driftDisplay}`,
    );
  }
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by which drift is most likely load-bearing; close with a concrete next action.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  counts: CanonicalSourceCounts,
  snapshot: DashboardSnapshot,
  drift: DriftRow[],
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Anya", "projection-drift", ctx.asOf));
  lines.push(`# Anya — projection drift, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Anya's daily projection-drift sweep per `Team/Anya.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop.",
  );
  lines.push("");
  const driftCount = drift.filter((d) => (d.drift ?? 0) !== 0).length;
  lines.push(
    `**Headline:** ${snapshot.reachable ? "dashboard cache reachable" : "dashboard cache unreachable on this runner"}; ${driftCount} of ${drift.length} cross-checked metrics show drift between canonical sources and the cache.`,
  );
  lines.push("");

  lines.push("## Canonical-source snapshot");
  lines.push("");
  lines.push("| Source | Count |");
  lines.push("|---|---|");
  lines.push(`| Principles in CLAUDE.md | ${counts.principlesInClaudeMd} |`);
  lines.push(`| Persona files (/Team/*.md) | ${counts.personaFiles} |`);
  lines.push(`| Procedure files (/Procedures/by-policy/*.md) | ${counts.procedureFiles} |`);
  lines.push(`| Obligations register rows (ORG-*) | ${counts.obligationsRegisterRows} |`);
  lines.push(`| Regulations index — total | ${counts.regulationsTotal} |`);
  lines.push(`| Regulations index — POPULATED | ${counts.regulationsPopulated} |`);
  lines.push(`| Owner Inbox deliverables | ${counts.ownerInboxFiles} |`);
  lines.push(`| Team Inbox — open | ${counts.teamInboxOpen} |`);
  lines.push(`| Team Inbox — actioned | ${counts.teamInboxActioned} |`);
  lines.push("");

  lines.push("## Cross-check vs dashboard cache");
  lines.push("");
  if (!snapshot.reachable) {
    lines.push(
      "_Dashboard cache could not be read or derived from this runner. Cross-check skipped — likely a derivation throw on missing canonical sources. The canonical-source counts above stand on their own._",
    );
  } else {
    lines.push(`Cache asOf: \`${snapshot.asOf ?? "—"}\``);
    lines.push("");
    lines.push("| Metric | Canonical | Cached | Drift |");
    lines.push("|---|---|---|---|");
    for (const d of drift) {
      const driftDisplay =
        d.drift === undefined
          ? "n/a"
          : d.drift === 0
            ? "0"
            : d.drift > 0
              ? `+${d.drift}`
              : `${d.drift}`;
      lines.push(`| \`${d.metric}\` | ${d.canonical} | ${d.cached ?? "—"} | ${driftDisplay} |`);
    }
    lines.push("");
    if (driftCount === 0) {
      lines.push("No drift. Dashboard cache reconciles to canonical-source counts at run-time.");
    } else {
      lines.push(
        `${driftCount} metric${driftCount === 1 ? "" : "s"} drift. Either the cache is stale (dashboard server hasn't refreshed) or the canonical source has changed since the last derive. Vera's dashboard-derivation recon is the formal check; this is the lightweight daily heartbeat.`,
      );
    }
  }
  lines.push("");
  if (narrative) {
    lines.push("## Anya's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Anya's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Counts read directly from canonical files: CLAUDE.md, /Team/*.md, /Procedures/by-policy/*.md, /Regulations/_obligations-register.md, /Regulations/_index.md, /Owner Inbox/*, /Team Inbox/*. Dashboard cache read from `prototype/.local/dashboard-state.json` if present, else derived live (D-EVENT-STORE-SCALING Slice 3b).",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const counts = snapshotCounts(ctx.repoRoot);
  const snapshot = readDashboardCache(ctx.repoRoot);
  const drift = computeDrift(counts, snapshot);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "DataProjectionSnapshot",
      as_of: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:anya:projection-drift" },
      citations: EVENT_CITATIONS,
      payload: {
        counts,
        cacheReachable: snapshot.reachable,
        cacheAsOf: snapshot.asOf,
        driftCount: drift.filter((d) => (d.drift ?? 0) !== 0).length,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  // Narrative pass (degrades gracefully when ANTHROPIC_API_KEY is unset).
  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: ANYA_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, counts, snapshot, drift),
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
          "anya:projection-drift — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "anya narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) {
      mkdirSync(ctx.ownerInboxDir, { recursive: true });
    }
    const filename = `${fmtDateUTC(ctx.asOf)}_anya_projection-drift.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, counts, snapshot, drift, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  const driftCount = drift.filter((d) => (d.drift ?? 0) !== 0).length;
  logger.debug(
    { ...counts, driftCount, cacheReachable: snapshot.reachable },
    "anya:projection-drift — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: snapshot.reachable
      ? `${counts.personaFiles} personas / ${counts.obligationsRegisterRows} obligations / ${counts.ownerInboxFiles} deliverables; ${driftCount} drift.`
      : `${counts.personaFiles} personas / ${counts.obligationsRegisterRows} obligations / ${counts.ownerInboxFiles} deliverables; cache unreachable.`,
    ok: true,
  };
};

export default handler;

// Internal exports for tests.
// Run statSync at module load only when needed; keeps the surface minimal.
export { snapshotCounts as _snapshotCountsForTest };
void statSync; // keep node:fs import minimal — statSync may be useful for V2.
