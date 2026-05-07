// runtime/agents/scrooge-ceo-decision-record.ts
//
// Scrooge's on-request CEO-decision-record handler.
//
// Closes the substrate gap Marc surfaced 2026-05-07: when the CEO
// approves a decision in chat, Scrooge writes a markdown record file
// but does NOT emit the typed `CeoDecision` event. Without that event:
//   - the dashboard's resolution mechanism (decisionStatus = "resolved"
//     iff a CeoDecision event with the decisionId exists) doesn't fire
//   - event-driven fan-out can't route follow-on work
//   - Vera can't audit the decision-resolution chain
//
// This handler is the canonical event-emitting path. Invocation:
//
//   bun run agent:scrooge-ceo-decision-record \
//     --decisionId D-BRAND-DESIGN-HIRE \
//     --action approve \
//     --title "PAX role brief — Brand & design lead" \
//     --outcome "Approved as drafted." \
//     --actor "marc@tgv.co.za" \
//     [--comment "..."]
//     [--follow-on-routes "agent:nolan,agent:linnea:inaugural-brand-package"]
//
// What it does:
//   - Validates the action is one of approve / defer / modify /
//     request-revision (per dashboard/types.ts DecisionAction).
//   - Emits a typed CeoDecision event with citations
//     GOV-FRAMEWORK-CEO-RESERVED + COMPANIES-ACT-71-2008 (per
//     `Procedures/by-policy/ceo-decision-review.md`).
//   - The runtime's event-driven fan-out then dispatches to any
//     handler subscribed to CeoDecision (anya:projection-refresh
//     today; future scrooge:follow-on-router will read the
//     follow-on-routes payload and chain the actual work).
//   - Optional `--follow-on-routes` is recorded in the event payload;
//     the follow-on-router handler (next slice) consumes it.
//   - Writes a brief Owner Inbox audit deliverable so the CEO record
//     remains human-readable; the EVENT is the canonical authority.
//
// Build-phase posture:
//   - The follow-on-router handler is a separate next-slice item; this
//     handler emits the event and records the routing intent. Without
//     the router, follow-on work still requires Scrooge in-chat to
//     spawn the follow-on agents — but the event is now in the right
//     place for the router (when it lands) to pick up.
//
// Author: Scrooge (handler) · Atlas (runtime substrate)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"];

type DecisionAction = "approve" | "defer" | "modify" | "request-revision";
const VALID_ACTIONS: readonly DecisionAction[] = [
  "approve",
  "defer",
  "modify",
  "request-revision",
];

interface DecisionRecordInput {
  readonly decisionId: string;
  readonly action: DecisionAction;
  readonly title: string;
  readonly outcome: string;
  readonly actor: string;
  readonly comment?: string;
  readonly followOnRoutes?: readonly string[];
  readonly sourceDoc?: string;
}

/**
 * Parse decision-record arguments from the agent-run context.
 *
 * The runtime's CLI (bun run agent:<slug> --agent ... --trigger ...)
 * doesn't pass arbitrary fields. Decision-record args ride on the
 * environment via BANK_CEO_DECISION_RECORD_JSON — the caller stringifies
 * a JSON DecisionRecordInput and sets it. Keeps the runtime CLI shape
 * stable and lets Scrooge pass arbitrary structured input.
 */
function readInput(): DecisionRecordInput {
  const raw = process.env.BANK_CEO_DECISION_RECORD_JSON;
  if (!raw) {
    throw new Error(
      "scrooge:ceo-decision-record requires BANK_CEO_DECISION_RECORD_JSON env (JSON-encoded DecisionRecordInput).",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`BANK_CEO_DECISION_RECORD_JSON is not valid JSON: ${(e as Error).message}`);
  }
  const obj = parsed as Record<string, unknown>;
  const action = String(obj.action ?? "");
  if (!VALID_ACTIONS.includes(action as DecisionAction)) {
    throw new Error(
      `Invalid action "${action}" — must be one of ${VALID_ACTIONS.join(" | ")}`,
    );
  }
  const decisionId = String(obj.decisionId ?? "");
  if (!decisionId) throw new Error("decisionId is required");
  const title = String(obj.title ?? decisionId);
  const outcome = String(obj.outcome ?? "");
  const actor = String(obj.actor ?? "marc@tgv.co.za");
  return {
    decisionId,
    action: action as DecisionAction,
    title,
    outcome,
    actor,
    ...(typeof obj.comment === "string" ? { comment: obj.comment } : {}),
    ...(Array.isArray(obj.followOnRoutes)
      ? { followOnRoutes: (obj.followOnRoutes as string[]).filter((s) => typeof s === "string") }
      : {}),
    ...(typeof obj.sourceDoc === "string" ? { sourceDoc: obj.sourceDoc } : {}),
  };
}

function buildAuditMarkdown(ctx: AgentRunContext, input: DecisionRecordInput): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Scrooge", "ceo-decision-record", ctx.asOf));
  lines.push(`# Scrooge — CEO decision record: ${input.decisionId}, ${date}`);
  lines.push("");
  lines.push(
    "Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.",
  );
  lines.push("");
  lines.push(`- **Decision ID:** \`${input.decisionId}\``);
  lines.push(`- **Title:** ${input.title}`);
  lines.push(`- **Action:** ${input.action}`);
  lines.push(`- **Outcome:** ${input.outcome}`);
  lines.push(`- **Actor:** \`${input.actor}\``);
  if (input.comment) lines.push(`- **Comment:** ${input.comment}`);
  if (input.sourceDoc) lines.push(`- **Source proposal:** \`${input.sourceDoc}\``);
  if (input.followOnRoutes && input.followOnRoutes.length > 0) {
    lines.push(`- **Follow-on routes recorded:** ${input.followOnRoutes.map((r) => `\`${r}\``).join(", ")}`);
  }
  lines.push("");
  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = \"resolved\"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const input = readInput();

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "CeoDecision",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "human", id: input.actor },
      citations: EVENT_CITATIONS,
      payload: {
        decisionId: input.decisionId,
        title: input.title,
        action: input.action,
        outcome: input.outcome,
        ...(input.comment ? { comment: input.comment } : {}),
        ...(input.sourceDoc ? { sourceDoc: input.sourceDoc } : {}),
        ...(input.followOnRoutes ? { followOnRoutes: input.followOnRoutes } : {}),
        recordedVia: "agent:scrooge:ceo-decision-record",
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
    // Filename includes the decisionId so multiple records on the same
    // day don't collide.
    const safeId = input.decisionId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const filename = `${fmtDateUTC(ctx.asOf)}_scrooge_ceo-decision-record_${safeId}.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildAuditMarkdown(ctx, input),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.info(
    {
      decisionId: input.decisionId,
      action: input.action,
      followOnRoutes: input.followOnRoutes ?? [],
    },
    "scrooge:ceo-decision-record — CeoDecision event emitted",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${input.decisionId} ${input.action}: ${input.outcome.slice(0, 60)}${input.outcome.length > 60 ? "..." : ""}`,
    ok: true,
  };
};

export default handler;
