// platform/projections/issues-tracker.ts
//
// Issues-and-actions tracker projection.
//
// Derives the set of open audit issues from the event store by replaying
// `AuditIssueOpened` and `AuditIssueClosed` events. Each `AuditFinding`
// that passes through `vera:issues-tracker` spawns one `AuditIssueOpened`
// (if no issue for that findingId is already open). `AuditIssueClosed`
// removes the issue from the open set.
//
// Authority: Vera mandate (Team/Vera.md §9, §11); Thandiwe §16 gap closure.
// Author: Vera (Internal audit / continuous-assurance engineer)

import type {
  AuditIssueClosedPayload,
  AuditIssueOpenedPayload,
} from "../event-store/event-types/governance-extended";
import type { EventStore } from "../event-store/store";

export interface OpenIssue {
  readonly issueId: string;
  readonly findingId: string;
  readonly title: string;
  readonly severity: string;
  readonly category: string;
  readonly addressedTo: string;
  readonly agentId: string;
  readonly raisedBy: string;
  readonly remediationOwner?: string;
  readonly targetCloseDate?: string;
  readonly openedAt: string; // ISO 8601
}

export interface IssuesTrackerProjection {
  readonly open: readonly OpenIssue[];
  readonly openCount: number;
  readonly bySeverity: Readonly<Record<string, number>>;
}

export function buildOpenIssues(store: EventStore): IssuesTrackerProjection {
  const open = new Map<string, OpenIssue>();

  for (const e of store.replay({ type: "AuditIssueOpened" })) {
    const p = e.payload as AuditIssueOpenedPayload;
    open.set(p.issueId, {
      issueId: p.issueId,
      findingId: p.auditFindingRef ?? "",
      title: p.title,
      severity: p.severity,
      category: p.category ?? "other",
      addressedTo: p.addressedTo ?? p.agentId ?? "",
      agentId: p.agentId ?? "",
      raisedBy: p.openedBy,
      ...(p.remediationOwner !== undefined ? { remediationOwner: p.remediationOwner } : {}),
      ...(p.dueDate !== undefined ? { targetCloseDate: p.dueDate } : {}),
      openedAt: e.as_of,
    });
  }

  for (const e of store.replay({ type: "AuditIssueClosed" })) {
    const p = e.payload as AuditIssueClosedPayload;
    open.delete(p.issueId);
  }

  const openArr = Array.from(open.values()).sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));

  const bySeverity: Record<string, number> = {};
  for (const issue of openArr) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
  }

  return {
    open: openArr,
    openCount: openArr.length,
    bySeverity,
  };
}

/** Derive a deterministic issueId from a findingId + date. */
export function issueIdForFinding(findingId: string, asOf: string): string {
  const datePart = asOf.slice(0, 10).replace(/-/g, "");
  const tag = findingId.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 40);
  return `ISSUE-${tag}-${datePart}`;
}

/** Return true if an issue is already open for the given findingId. */
export function isIssueOpenForFinding(
  projection: IssuesTrackerProjection,
  findingId: string,
): boolean {
  return projection.open.some((i) => i.findingId === findingId);
}
