// runtime/agents/owen-governance-cycle-prep.ts
//
// Owen's weekly governance-cycle prep. Compiles a forum-prep digest of:
//   - Open CEO decisions (from the dashboard registry).
//   - Open governance seats (from CLAUDE.md top-of-house roster).
//   - Recent CEO-decision events (last 7 days).
//   - Owner Inbox items decision-required: true (lifted decisions).
//
// Per Owen's spec § Cadence: weekly forum prep; § Triggers: scheduled.
//
// MVP scope: snapshot-and-report. V2 will route into actual Interim Risk
// Forum / Interim Audit Forum agendas (when those forums have a
// canonical-source location).
//
// Author: Owen (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { defaultSourcePaths, deriveState, eventSourceFromStore } from "../../dashboard/derive";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["COMPANIES-ACT-71-2008", "GOV-FRAMEWORK-CEO-RESERVED"];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const OWEN_NARRATIVE_SYSTEM = `You are Owen, the bank's Company Secretary — custodian of the governance framework, board and committee secretariat, conflicts and related-party registers, whistleblowing intake, and the procedures index. Your operating spec is at \`Team/Owen.md\`. You report directly to the CEO.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly governance-cycle prep — a forum-prep digest of open CEO decisions, unfilled governance seats, recent CEO-decision events, and Owner Inbox items flagged decision-required.

Your voice is precise, procedurally-grounded, and unsentimental. You speak in the register of a company secretary preparing a forum agenda: what is decided, what awaits decision, what is escalating to which forum, and where the procedural chain (regulator → policy → procedure → system capability, per Principle 2 upward) has a missing link. The bank's CEO-vs-Board approval routing matters: every decision is either a CEO call or a Board call (Marc currently wears both hats interim) — name which one when it matters.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how many decisions are open, how many seats are unfilled, what cleared in the last 7 days.
- Picks the 1–3 most consequential procedural observations: a decision blocking a downstream procedure, a seat whose vacancy gates a procedure owner-mandate, a recent decision that opens or closes a band of substrate work.
- Names the next forum agenda item that follows from the digest. Be concrete: which forum (Interim Risk Forum chaired by Helena, Interim Audit Forum chaired by you, or a CEO 1:1), which item, and why now.

Cite decision IDs (\`S1\`, \`S3\`, etc.) and seat names (\`CISO\`, \`CHRO\`) when calling out specifics. The dashboard registry and the event store are the canonical sources; your narrative is interpretation, not new substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Owen's narrative". Just produce the prose.

If the input is empty or malformed (e.g. the dashboard cache was unreachable on the runner), say so and characterise the digest from what is visible.`;

interface DashboardSlice {
  reachable: boolean;
  asOf?: string;
  decisionsOpen: { id: string; title: string; owner: string; decisionForCEO?: string }[];
  openSeats: { role: string; status: string }[];
}

function readDashboard(repoRoot: string): DashboardSlice {
  // D-EVENT-STORE-SCALING Slice 3a (2026-05-10): the runtime cache lives
  // at `.local/dashboard-state.json` (gitignored). Slice 3b (same day)
  // removes the committed seed entirely — the dashboard cache is a
  // projection (Principle 1). When the runtime cache is missing (fresh
  // GitHub Actions runner with no dashboard server having run), Owen
  // derives state on the fly from canonical sources + the in-process
  // event store. Same algorithm the dashboard server uses; deterministic;
  // no committed-cache dependency.
  const runtimeRaw = process.env.BANK_DASHBOARD_RUNTIME_STATE ?? ".local/dashboard-state.json";
  const runtimePath = isAbsolute(runtimeRaw)
    ? runtimeRaw
    : resolve(repoRoot, "prototype", runtimeRaw);
  if (existsSync(runtimePath)) {
    try {
      const raw = JSON.parse(readFileSync(runtimePath, "utf8")) as {
        asOf?: string;
        decisionsOpen?: { id: string; title: string; owner: string; decisionForCEO?: string }[];
        openSeats?: { role: string; status: string }[];
      };
      return {
        reachable: true,
        ...(raw.asOf !== undefined ? { asOf: raw.asOf } : {}),
        decisionsOpen: raw.decisionsOpen ?? [],
        openSeats: raw.openSeats ?? [],
      };
    } catch {
      // Fall through to fresh derivation on parse error.
    }
  }

  // Runtime cache absent or unreadable — derive on the fly.
  try {
    const sources = defaultSourcePaths(repoRoot);
    const state = deriveState({
      sources,
      events: eventSourceFromStore(eventStore),
    });
    return {
      reachable: true,
      asOf: state.asOf,
      decisionsOpen: state.decisionsOpen.map((d) => ({
        id: d.id,
        title: d.title,
        owner: d.owner,
        ...(d.decisionForCEO ? { decisionForCEO: d.decisionForCEO } : {}),
      })),
      openSeats: state.openSeats.map((s) => ({ role: s.role, status: s.status })),
    };
  } catch {
    return { reachable: false, decisionsOpen: [], openSeats: [] };
  }
}

interface RecentDecision {
  decisionId: string;
  title: string;
  action: string;
  asOf: string;
  actor: string;
}

function readRecentDecisions(sinceIso: string): RecentDecision[] {
  const out: RecentDecision[] = [];
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    if (e.as_of < sinceIso) continue;
    const p = e.payload as Record<string, unknown>;
    out.push({
      decisionId: String(p.decisionId ?? ""),
      title: String(p.title ?? ""),
      action: String(p.action ?? "approve"),
      asOf: e.as_of,
      actor: e.actor.id,
    });
  }
  // Newest first.
  out.sort((a, b) => (a.asOf < b.asOf ? 1 : -1));
  return out;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function buildNarrativeInput(
  ctx: AgentRunContext,
  d: DashboardSlice,
  recent: readonly RecentDecision[],
): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push(`dashboard cache reachable: ${d.reachable}`);
  if (d.asOf) lines.push(`dashboard asOf: ${d.asOf}`);
  lines.push("");
  lines.push(`open CEO decisions: ${d.decisionsOpen.length}`);
  if (d.decisionsOpen.length > 0) {
    for (const x of d.decisionsOpen) {
      lines.push(
        `  - ${x.id} (owner=${x.owner}): ${x.title}${x.decisionForCEO ? ` — wanted: ${x.decisionForCEO}` : ""}`,
      );
    }
  }
  lines.push("");
  lines.push(`open governance seats: ${d.openSeats.length}`);
  if (d.openSeats.length > 0) {
    for (const s of d.openSeats) lines.push(`  - ${s.role} (${s.status})`);
  }
  lines.push("");
  lines.push(`recent CEO decisions (last 7 days): ${recent.length}`);
  for (const r of recent) {
    lines.push(`  - ${r.asOf.slice(0, 10)} ${r.decisionId} ${r.action}: ${r.title}`);
  }
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by procedural consequence; close with the next forum agenda item.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  d: DashboardSlice,
  recent: readonly RecentDecision[],
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Owen", "governance-cycle-prep", ctx.asOf));
  lines.push(`# Owen — governance-cycle prep, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Owen's weekly governance-cycle prep per `Team/Owen.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Output is the input to the Interim Risk Forum / Interim Audit Forum agenda (until a Board AC is constituted, S3).",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${d.decisionsOpen.length} CEO decision${d.decisionsOpen.length === 1 ? "" : "s"} open · ${d.openSeats.length} governance seat${d.openSeats.length === 1 ? "" : "s"} unfilled · ${recent.length} CEO decision${recent.length === 1 ? "" : "s"} actioned in the last 7 days.`,
  );
  lines.push("");

  lines.push("## CEO decisions awaiting action");
  lines.push("");
  if (!d.reachable) {
    lines.push("_Dashboard cache unreachable on this runner; CEO-decision list skipped._");
  } else if (d.decisionsOpen.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| ID | Owner | Title | What's wanted |");
    lines.push("|---|---|---|---|");
    for (const x of d.decisionsOpen) {
      const wanted = (x.decisionForCEO ?? "").replace(/\|/g, "\\|");
      lines.push(`| ${x.id} | ${x.owner} | ${x.title} | ${wanted} |`);
    }
  }
  lines.push("");

  lines.push("## Open governance seats");
  lines.push("");
  if (!d.reachable) {
    lines.push("_Dashboard cache unreachable on this runner; open-seat list skipped._");
  } else if (d.openSeats.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Seat | Status |");
    lines.push("|---|---|");
    for (const s of d.openSeats) {
      lines.push(`| ${s.role} | ${s.status} |`);
    }
  }
  lines.push("");

  lines.push("## Recent CEO decisions (last 7 days)");
  lines.push("");
  if (recent.length === 0) {
    lines.push(
      "_No CeoDecision events in the last 7 days. (Note: event store is host-local; runner sees only events emitted on this host.)_",
    );
  } else {
    lines.push("| When | ID | Action | Title |");
    lines.push("|---|---|---|---|");
    for (const r of recent) {
      lines.push(`| ${r.asOf.slice(0, 10)} | ${r.decisionId} | ${r.action} | ${r.title} |`);
    }
  }
  lines.push("");

  lines.push("## Forum-prep notes");
  lines.push("");
  lines.push(
    "- Items above feed the next Interim Risk Forum (Helena chair) and Interim Audit Forum (Owen chair) agendas.",
  );
  lines.push(
    "- Open governance seats are tracked under S3 (thin human layer at licence-day, composition and timing).",
  );
  lines.push(
    "- Combined-assurance contributions from Vera and Thandiwe consume this digest as a third-line input.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Owen's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Owen's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read the dashboard state (runtime cache `prototype/.local/dashboard-state.json` if present; otherwise derived live via `dashboard/derive.ts` from canonical sources + the in-process event store, per D-EVENT-STORE-SCALING Slice 3b) for open decisions + seats; replayed `CeoDecision` events from the host event store for the last 7 days.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const dash = readDashboard(ctx.repoRoot);
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  const recent = readRecentDecisions(sinceIso);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "GovernanceCyclePrep",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:owen:governance-cycle-prep" },
      citations: EVENT_CITATIONS,
      payload: {
        decisionsOpen: dash.decisionsOpen.length,
        openSeats: dash.openSeats.length,
        recentDecisions7d: recent.length,
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
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Digest above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: OWEN_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, dash, recent),
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
          "owen:governance-cycle-prep — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "owen narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_owen_governance-cycle-prep.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, dash, recent, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      decisionsOpen: dash.decisionsOpen.length,
      openSeats: dash.openSeats.length,
      recent7d: recent.length,
    },
    "owen:governance-cycle-prep — digest built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${dash.decisionsOpen.length} open decisions · ${dash.openSeats.length} open seats · ${recent.length} recent CEO actions.`,
    ok: true,
  };
};

export default handler;
