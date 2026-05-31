// runtime/agents/vera-issues-tracker.ts
//
// Vera's issues-and-actions tracker handler.
//
// Subscribes to `AuditFinding` events. For each finding not already covered
// by an open issue, emits `AuditIssueOpened` — creating a durable,
// event-sourced record in the issues register. The open-issue register is
// the projection built by `platform/projections/issues-tracker.ts`.
//
// This handler closes the substrate gap listed in Team/Thandiwe.md §16
// ("Issues-and-actions tracker — exists in concept; no substrate") and
// Team/Vera.md §16 (same gap, Vera-side).
//
// Closure discipline:
//   Issues are closed by emitting `AuditIssueClosed` — either via this
//   handler when a subsequent recon run produces no violation for the same
//   subject, or manually via the `vera:issue-close` CLI (planned). The
//   projection in `issues-tracker.ts` is the sole read path.
//
// Authority: Vera mandate §9 (raise findings, open issues) + §11 (events
//   emitted: AuditIssueOpened, AuditIssueClosed).
//   Thandiwe §16 gap closure (2026-05-31).
// Author: Vera (Internal audit / continuous-assurance engineer)

import { clock, eventStore, logger } from "../../platform/composition";
import type { AuditFindingPayload } from "../../platform/event-store/event-types/audit";
import { makeAuditIssueOpened } from "../../platform/event-store/event-types/governance-extended";
import {
  buildOpenIssues,
  isIssueOpenForFinding,
  issueIdForFinding,
} from "../../platform/projections/issues-tracker";
import type { AgentRunContext, AgentRunOutput } from "../types";

const HANDLER_ID = "vera:issues-tracker";

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const findings = triggering.filter((e) => e.type === "AuditFinding");

  if (findings.length === 0) {
    logger.info({ handler: HANDLER_ID }, "no AuditFinding events in trigger batch — no-op");
    return { eventsEmitted: 0, summary: "no findings to triage", ok: true };
  }

  const projection = buildOpenIssues(eventStore);
  const asOf = clock.now();
  let opened = 0;
  let skipped = 0;

  for (const e of findings) {
    const p = e.payload as AuditFindingPayload;
    const findingId = p.findingId ?? e.event_id;

    if (isIssueOpenForFinding(projection, findingId)) {
      logger.info({ handler: HANDLER_ID, findingId }, "issue already open — skip");
      skipped++;
      continue;
    }

    const issueId = issueIdForFinding(findingId, asOf);
    const event = makeAuditIssueOpened({
      asOf,
      entity: "bank:vera:issues-tracker",
      actor: { type: "service", id: "agent:vera" },
      citations: ["D-AGENT-AUTONOMY-OPERATIONAL"],
      payload: {
        issueId,
        title: p.summary ?? "(no summary)",
        severity: p.severity,
        openedBy: p.raisedBy ?? "agent:vera",
        openedAt: asOf,
        auditFindingRef: findingId,
        category: p.category,
        addressedTo: p.addressedTo,
        agentId: p.agentId,
        ...(p.detail ? { remediationOwner: p.addressedTo } : {}),
      },
    });

    eventStore.append(event);
    opened++;

    logger.info(
      { handler: HANDLER_ID, issueId, findingId, severity: p.severity },
      "AuditIssueOpened emitted",
    );
  }

  return {
    eventsEmitted: opened,
    summary: `vera:issues-tracker — opened ${opened} issue(s), skipped ${skipped} already-open`,
    ok: true,
  };
};

export default handler;
