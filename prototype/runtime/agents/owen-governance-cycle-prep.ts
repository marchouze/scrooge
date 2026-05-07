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
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["COMPANIES-ACT-71-2008", "GOV-FRAMEWORK-CEO-RESERVED"];

interface DashboardSlice {
  reachable: boolean;
  asOf?: string;
  decisionsOpen: { id: string; title: string; owner: string; decisionForCEO?: string }[];
  openSeats: { role: string; status: string }[];
}

function readDashboard(repoRoot: string): DashboardSlice {
  const path = resolve(repoRoot, "prototype", "seeds", "dashboard-state.json");
  if (!existsSync(path)) {
    return { reachable: false, decisionsOpen: [], openSeats: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
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

function buildReportMarkdown(
  ctx: AgentRunContext,
  d: DashboardSlice,
  recent: readonly RecentDecision[],
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
    lines.push("_No CeoDecision events in the last 7 days. (Note: event store is host-local; runner sees only events emitted on this host.)_");
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

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `prototype/seeds/dashboard-state.json` for open decisions + seats; replayed `CeoDecision` events from the host event store for the last 7 days.",
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

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_owen_governance-cycle-prep.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, dash, recent),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    { decisionsOpen: dash.decisionsOpen.length, openSeats: dash.openSeats.length, recent7d: recent.length },
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
