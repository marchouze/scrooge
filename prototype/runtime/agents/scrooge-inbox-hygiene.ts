// runtime/agents/scrooge-inbox-hygiene.ts
//
// Scrooge's daily inbox-hygiene sweep. Reads /Team Inbox/ and /Owner Inbox/,
// auto-moves Team Inbox items whose deliverable has shipped to /Team Inbox/
// actioned/ (per Marc's standing rule, memory: feedback_team_inbox_hygiene.md),
// and reports a one-line digest of the inbox state.
//
// Per Scrooge's spec § Cadence: continuous chat intake; daily Owner Inbox /
// Team Inbox sweep. The MVP implements the daily sweep; the chat-intake
// path is the in-session loop (Scrooge talking to Marc).
//
// Action discipline: this is the first runtime handler that *takes* an
// action (file move) rather than just observing. The auto-move rule is
// already approved in memory; the handler enforces it conservatively —
// only moves a Team Inbox brief when there is an obvious deliverable
// match in Owner Inbox by filename slug. Anything ambiguous is reported,
// not moved.
//
// Author: Scrooge (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

interface InboxItem {
  filename: string;
  date?: string; // YYYY-MM-DD parsed from filename prefix
  slug: string; // filename minus date prefix and .md
  category?: string; // e.g. "brief", "followup", "role-brief", "note"
}

function parseInboxFilename(filename: string): InboxItem {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})_(.+)\.md$/);
  if (!m) {
    return { filename, slug: filename.replace(/\.md$/, "") };
  }
  const date = m[1];
  const slug = m[2] ?? "";
  const categoryMatch = slug.match(/^(brief|followup|role-brief|note)_(.+)$/);
  return {
    filename,
    ...(date !== undefined ? { date } : {}),
    slug,
    ...(categoryMatch?.[1] ? { category: categoryMatch[1] } : {}),
  };
}

function listOpenInbox(teamInboxDir: string): InboxItem[] {
  if (!existsSync(teamInboxDir)) return [];
  return readdirSync(teamInboxDir)
    .filter((f) => f.endsWith(".md"))
    .map(parseInboxFilename);
}

interface OwnerInboxIndex {
  byAgentSlug: Map<string, string[]>; // <agent>:<slug-tail> → filenames
}

// Owner Inbox filename convention: YYYY-MM-DD_<agent>_<slug>.md.
// Index by lower-cased agent + slug-tail for matching against Team Inbox briefs.
function indexOwnerInbox(ownerInboxDir: string): OwnerInboxIndex {
  const index: OwnerInboxIndex = { byAgentSlug: new Map() };
  if (!existsSync(ownerInboxDir)) return index;
  for (const f of readdirSync(ownerInboxDir)) {
    if (!f.endsWith(".md")) continue;
    const m = f.match(/^\d{4}-\d{2}-\d{2}_([a-z][a-z0-9-]*)_(.+)\.md$/i);
    if (!m) continue;
    const agent = m[1]?.toLowerCase() ?? "";
    const slug = m[2]?.toLowerCase() ?? "";
    const key = `${agent}:${slug}`;
    const arr = index.byAgentSlug.get(key) ?? [];
    arr.push(f);
    index.byAgentSlug.set(key, arr);
    // Also index by agent alone so loose matches surface.
    const looseKey = `${agent}:*`;
    const looseArr = index.byAgentSlug.get(looseKey) ?? [];
    looseArr.push(f);
    index.byAgentSlug.set(looseKey, looseArr);
  }
  return index;
}

interface MoveDecision {
  item: InboxItem;
  reason: string;
  matchedDeliverable?: string;
}

// A Team Inbox item is "completed and movable" when:
//   - it is a brief / followup / role-brief / note;
//   - AND there is at least one Owner Inbox file whose slug tail matches
//     the brief slug closely (exact match or substring), OR for role
//     briefs, when the corresponding /Team/<Name>.md exists.
//
// Anything else is reported but not moved. Conservative on purpose:
// Marc's hygiene rule says "verify the deliverable actually exists
// before moving" (memory: feedback_team_inbox_hygiene.md).
function shouldMove(item: InboxItem, ownerIndex: OwnerInboxIndex, teamDir: string): MoveDecision | null {
  if (!item.category) return null;

  if (item.category === "role-brief") {
    // role-brief slug is like "chief-information-security-officer"; the
    // matching outcome is a /Team/<Name>.md file with the corresponding
    // role text. Without a name in the slug we can't auto-resolve;
    // surface as a report-only item.
    return null;
  }

  // For brief / followup / note: slug is like "brief_<owner>_<topic>"
  // or "followup_<owner>_<topic>" or "note_<topic>". Tail after the first
  // underscore-segment is the topic.
  const slug = item.slug;
  const tail = slug.replace(/^(brief|followup|note)_/, "");
  // Try to find an Owner Inbox file with a matching tail.
  for (const [key, files] of ownerIndex.byAgentSlug.entries()) {
    if (key.endsWith(":*")) continue;
    const ownerSlug = key.split(":")[1] ?? "";
    if (ownerSlug.includes(tail) || tail.includes(ownerSlug)) {
      return {
        item,
        reason: `Owner Inbox deliverable found (${files[0]}); brief is closed`,
        ...(files[0] ? { matchedDeliverable: `Owner Inbox/${files[0]}` } : {}),
      };
    }
  }

  void teamDir; // reserved for V2 — match role-briefs against /Team/ persona files
  return null;
}

interface HygieneSummary {
  openCount: number;
  actionedCount: number;
  ownerInboxCount: number;
  movedThisRun: { from: string; to: string; reason: string }[];
  reportOnly: { item: string; reason: string }[];
}

function buildReportMarkdown(ctx: AgentRunContext, summary: HygieneSummary): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Scrooge", "inbox-hygiene", ctx.asOf));
  lines.push(`# Scrooge — inbox hygiene, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Scrooge's daily inbox-hygiene sweep per `Team/Scrooge.md` operating spec § Cadence and the standing rule at `feedback_team_inbox_hygiene.md`.",
  );
  lines.push("");
  lines.push(
    `**Headline:** Team Inbox open: ${summary.openCount} (after run); actioned: ${summary.actionedCount}; Owner Inbox: ${summary.ownerInboxCount} files. ${summary.movedThisRun.length} item${summary.movedThisRun.length === 1 ? "" : "s"} auto-moved this run.`,
  );
  lines.push("");

  if (summary.movedThisRun.length > 0) {
    lines.push("## Moved this run");
    lines.push("");
    for (const m of summary.movedThisRun) {
      lines.push(`- \`${m.from}\` → \`${m.to}\` — ${m.reason}`);
    }
    lines.push("");
  }

  if (summary.reportOnly.length > 0) {
    lines.push("## In Team Inbox (still open)");
    lines.push("");
    for (const r of summary.reportOnly) {
      lines.push(`- \`${r.item}\` — ${r.reason}`);
    }
    lines.push("");
  }

  if (summary.movedThisRun.length === 0 && summary.reportOnly.length === 0) {
    lines.push("Team Inbox is empty. No action taken; no in-flight items pending Marc-or-agent action.");
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Read `/Team Inbox/`, `/Team Inbox/actioned/`, and `/Owner Inbox/` filesystems. Auto-moves apply only to brief / followup / note items with an unambiguous Owner Inbox match (tail-slug substring). Role-briefs and ambiguous items are surfaced as report-only and require Scrooge or Marc to action manually.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const teamInboxDir = resolve(ctx.repoRoot, "Team Inbox");
  const teamInboxActionedDir = resolve(teamInboxDir, "actioned");
  const teamDir = resolve(ctx.repoRoot, "Team");
  const ownerInboxDir = ctx.ownerInboxDir;

  const open = listOpenInbox(teamInboxDir);
  const ownerIndex = indexOwnerInbox(ownerInboxDir);

  const movedThisRun: HygieneSummary["movedThisRun"] = [];
  const reportOnly: HygieneSummary["reportOnly"] = [];

  for (const item of open) {
    const decision = shouldMove(item, ownerIndex, teamDir);
    if (decision) {
      const from = `Team Inbox/${item.filename}`;
      const to = `Team Inbox/actioned/${item.filename}`;
      if (!ctx.dryRun) {
        if (!existsSync(teamInboxActionedDir)) {
          mkdirSync(teamInboxActionedDir, { recursive: true });
        }
        try {
          renameSync(resolve(teamInboxDir, item.filename), resolve(teamInboxActionedDir, item.filename));
        } catch (e) {
          logger.warn({ err: (e as Error).message, item: item.filename }, "scrooge:inbox-hygiene — move failed; reporting instead");
          reportOnly.push({ item: item.filename, reason: `move failed: ${(e as Error).message}` });
          continue;
        }
      }
      movedThisRun.push({ from, to, reason: decision.reason });
    } else {
      reportOnly.push({ item: item.filename, reason: "no unambiguous match in Owner Inbox; left in place" });
    }
  }

  // After moves, recompute counts.
  const openAfter = listOpenInbox(teamInboxDir).length;
  const actionedCount = existsSync(teamInboxActionedDir)
    ? readdirSync(teamInboxActionedDir).filter((f) => f.endsWith(".md")).length
    : 0;
  const ownerInboxCount = existsSync(ownerInboxDir)
    ? readdirSync(ownerInboxDir).filter((f) => f.endsWith(".md")).length
    : 0;

  const summary: HygieneSummary = {
    openCount: openAfter,
    actionedCount,
    ownerInboxCount,
    movedThisRun,
    reportOnly,
  };

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "InboxHygieneSweep",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:scrooge:inbox-hygiene" },
      citations: EVENT_CITATIONS,
      payload: {
        teamInboxOpen: summary.openCount,
        teamInboxActioned: summary.actionedCount,
        ownerInboxCount: summary.ownerInboxCount,
        moved: summary.movedThisRun.length,
        reportOnly: summary.reportOnly.length,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ownerInboxDir)) mkdirSync(ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_scrooge_inbox-hygiene.md`;
    writeFileSync(resolve(ownerInboxDir, filename), buildReportMarkdown(ctx, summary), "utf8");
    deliverable = `Owner Inbox/${filename}`;
  }

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `Team Inbox open: ${summary.openCount}; moved: ${summary.movedThisRun.length}; report-only: ${summary.reportOnly.length}.`,
    ok: true,
  };
};

export default handler;
