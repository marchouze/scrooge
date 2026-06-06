// dashboard/sla-approval-view.ts
//
// SLA rule approval workflow surface (Phase 4c — minimal approve/withhold).
// D-SLA-ENGINE-RULES-AS-DATA Phase 4c; D-SLA-APPROVAL-WORKFLOW-SEGREGATION.
//
//   GET  /api/sla/approvals              — every rule/version + its approval
//                                          status (eligible / published-pending /
//                                          withheld / unpublished), plus
//                                          publisher/approver attribution.
//   POST /api/sla/approvals/publish      — emit SlaRulePublished for a rule/version
//   POST /api/sla/approvals/approve      — emit SlaRuleApproved (four-eyes enforced)
//   POST /api/sla/approvals/withhold     — emit SlaRuleWithheld (reason required)
//
// The EVENTS are canonical; this surface is a render + an action that emits the
// attested event. Owen control i (author ≠ approver) is enforced server-side
// before emitting an approval — a self-approval is a 400, never written.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4c); D-SLA-APPROVAL-WORKFLOW-SEGREGATION.

import {
  type ApprovalCorpus,
  computeEligibility,
  ruleApprovalKey,
  ruleContentHash,
} from "../platform/accounting/sla/approval";
import { loadApprovalCorpus } from "../platform/accounting/sla/approval-loader";
import type { SlaRule } from "../platform/accounting/sla/generated/sla-types";
import { ALL_SLA_RULES } from "../platform/accounting/sla/rules/all-rules";
import { eventStore } from "../platform/composition";
import { nowUtc } from "../platform/core/types";
import {
  makeSlaRuleApproved,
  makeSlaRulePublished,
  makeSlaRuleWithheld,
} from "../platform/event-store/event-types/sla-approval";
import type { Actor } from "../platform/event-store/types";

const APPROVAL_ENTITY = "LE-ZA-HOZ-BANK";
const UI_ACTOR: Actor = { type: "service", id: "sla-approval-ui" };
const CITATIONS = [
  "D-SLA-ENGINE-RULES-AS-DATA",
  "D-SLA-APPROVAL-WORKFLOW-SEGREGATION",
  "Principles/1-events-are-truth.md",
];

type RuleStatus = "eligible" | "published-pending" | "withheld" | "unpublished";

interface ApprovalRow {
  readonly key: string;
  readonly representation: string;
  readonly ruleId: string;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly contentHash: string;
  readonly status: RuleStatus;
  readonly publisher: { name: string; position: string } | null;
  readonly approver: { name: string; position: string } | null;
  readonly grandfather: boolean;
  readonly withheldReason: string | null;
}

function loadCorpus(): ApprovalCorpus {
  return loadApprovalCorpus([
    ...eventStore.replay({ type: "SlaRulePublished" }),
    ...eventStore.replay({ type: "SlaRuleApproved" }),
    ...eventStore.replay({ type: "SlaRuleWithheld" }),
  ]);
}

/** Build the per-rule status table — the read surface. */
export function buildApprovalRows(rules: readonly SlaRule[] = ALL_SLA_RULES): ApprovalRow[] {
  const corpus = loadCorpus();
  const { eligible } = computeEligibility(corpus);

  const publishByKey = new Map<string, ApprovalCorpus["published"][number]>();
  for (const p of corpus.published) {
    publishByKey.set(
      ruleApprovalKey({ representation: p.representation, rule_id: p.ruleId, version: p.version }),
      p,
    );
  }
  // Latest approve / withhold per key (corpus.decisions is append-ordered).
  const latestDecisionByKey = new Map<string, ApprovalCorpus["decisions"][number]>();
  for (const d of corpus.decisions) {
    latestDecisionByKey.set(
      ruleApprovalKey({ representation: d.representation, rule_id: d.ruleId, version: d.version }),
      d,
    );
  }

  return rules.map((r) => {
    const key = ruleApprovalKey(r);
    const publish = publishByKey.get(key) ?? null;
    const decision = latestDecisionByKey.get(key);
    let status: RuleStatus;
    if (eligible.has(key)) status = "eligible";
    else if (decision?.kind === "withhold") status = "withheld";
    else if (publish) status = "published-pending";
    else status = "unpublished";

    return {
      key,
      representation: r.representation,
      ruleId: r.rule_id,
      version: r.version,
      effectiveFrom: r.effective_from,
      effectiveTo: r.effective_to ?? null,
      contentHash: ruleContentHash(r),
      status,
      publisher: publish
        ? { name: publish.publisherName, position: publish.publisherPosition }
        : null,
      approver:
        decision?.kind === "approve"
          ? { name: decision.approverName, position: decision.approverPosition }
          : null,
      grandfather: decision?.kind === "approve" ? decision.grandfather : false,
      withheldReason: decision?.kind === "withhold" ? decision.reason : null,
    };
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function findRule(representation: string, ruleId: string, version: number): SlaRule | undefined {
  return ALL_SLA_RULES.find(
    (r) => r.representation === representation && r.rule_id === ruleId && r.version === version,
  );
}

/**
 * Handle the SLA approval routes. GET is sync; POST routes read the JSON body
 * (the server passes the already-parsed body). Returns null when the path does
 * not match (server falls through).
 */
export async function registerSlaApprovalRoutes(
  pathname: string,
  method: string,
  req: Request,
): Promise<Response | null> {
  if (method === "GET" && pathname === "/api/sla/approvals") {
    return jsonResponse({ ok: true, rows: buildApprovalRows() });
  }

  if (method === "POST" && pathname === "/api/sla/approvals/publish") {
    const body = (await req.json().catch(() => null)) as {
      representation?: string;
      ruleId?: string;
      version?: number;
      publisherName?: string;
      publisherPosition?: string;
    } | null;
    if (!body?.representation || !body.ruleId || typeof body.version !== "number") {
      return jsonResponse({ ok: false, error: "representation, ruleId, version required" }, 400);
    }
    const rule = findRule(body.representation, body.ruleId, body.version);
    if (!rule) return jsonResponse({ ok: false, error: "no such rule/version in registry" }, 404);
    eventStore.append(
      makeSlaRulePublished({
        asOf: nowUtc(),
        entity: APPROVAL_ENTITY,
        actor: UI_ACTOR,
        citations: CITATIONS,
        payload: {
          representation: body.representation,
          ruleId: body.ruleId,
          version: body.version,
          publisher: {
            name: body.publisherName ?? "Bea",
            position:
              body.publisherPosition ?? "Accounting & financial reporting engineer, engineering",
          },
          ruleContentHash: ruleContentHash(rule),
        },
      }),
    );
    return jsonResponse({ ok: true });
  }

  if (method === "POST" && pathname === "/api/sla/approvals/approve") {
    const body = (await req.json().catch(() => null)) as {
      representation?: string;
      ruleId?: string;
      version?: number;
      approverName?: string;
      approverPosition?: string;
    } | null;
    if (
      !body?.representation ||
      !body.ruleId ||
      typeof body.version !== "number" ||
      !body.approverName
    ) {
      return jsonResponse(
        { ok: false, error: "representation, ruleId, version, approverName required" },
        400,
      );
    }
    const rule = findRule(body.representation, body.ruleId, body.version);
    if (!rule) return jsonResponse({ ok: false, error: "no such rule/version in registry" }, 404);
    const corpus = loadCorpus();
    const publish = corpus.published.find(
      (p) =>
        p.representation === body.representation &&
        p.ruleId === body.ruleId &&
        p.version === body.version,
    );
    if (!publish) {
      return jsonResponse(
        { ok: false, error: "rule/version is not published — publish it first" },
        400,
      );
    }
    // Owen control i — author ≠ approver. Reject a self-approval BEFORE emitting.
    if (publish.publisherName === body.approverName) {
      return jsonResponse(
        {
          ok: false,
          error: `self-approval forbidden: approver and publisher are both '${body.approverName}'`,
        },
        400,
      );
    }
    eventStore.append(
      makeSlaRuleApproved({
        asOf: nowUtc(),
        entity: APPROVAL_ENTITY,
        actor: UI_ACTOR,
        citations: CITATIONS,
        payload: {
          representation: body.representation,
          ruleId: body.ruleId,
          version: body.version,
          approver: {
            name: body.approverName,
            position: body.approverPosition ?? "approver",
          },
          reviewedRuleHash: publish.ruleContentHash,
          reviewedPreviewHash: `preview:${ruleContentHash(rule)}`,
        },
      }),
    );
    return jsonResponse({ ok: true });
  }

  if (method === "POST" && pathname === "/api/sla/approvals/withhold") {
    const body = (await req.json().catch(() => null)) as {
      representation?: string;
      ruleId?: string;
      version?: number;
      approverName?: string;
      reason?: string;
    } | null;
    if (
      !body?.representation ||
      !body.ruleId ||
      typeof body.version !== "number" ||
      !body.approverName ||
      !body.reason
    ) {
      return jsonResponse(
        { ok: false, error: "representation, ruleId, version, approverName, reason required" },
        400,
      );
    }
    eventStore.append(
      makeSlaRuleWithheld({
        asOf: nowUtc(),
        entity: APPROVAL_ENTITY,
        actor: UI_ACTOR,
        citations: CITATIONS,
        payload: {
          representation: body.representation,
          ruleId: body.ruleId,
          version: body.version,
          approver: { name: body.approverName, position: "approver" },
          reason: body.reason,
        },
      }),
    );
    return jsonResponse({ ok: true });
  }

  return null;
}
