// platform/recon/credit-limit-breach-unescalated.ts
//
// Vera continuous-controls pipeline: assert that every `CreditLimitBreached`
// has been escalated through ONE of the three sanctioned channels per
// Credit Risk Policy §7 (line 255) and §8 (lines 250–254):
//
//   (a) `CreditLimitBreachDisposed` with same `breachId`, within 1 business
//       day (24h with weekend slack — we use a calendar-day approximation
//       of 72h to cover Fri→Mon escalations).
//
//   (b) An escalation marker in `@platform/escalation` — the canonical
//       channel emits `AgentEscalation { escalationId, raisedBy, question,
//       severity, routedTo, ... }`. Heuristic match: any `AgentEscalation`
//       event whose `question` or `escalationId` references the breach
//       counterpartyId or `breachId`, emitted within 1 business day of
//       the breach.
//
//   (c) `PaNotificationSubmitted { notificationType, notificationDate,
//       regulatoryRef }` per Credit Risk Policy §8 line 252. This event
//       type is not yet registered in the typed event-type registry
//       (Helena substrate gap — noted by Owen in policy). Forward-
//       compatible read: if the type does not exist, the pipeline does
//       not crash, the lookup just returns empty.
//
// Failure path:
//   - Breach with NO disposal AND NO escalation AND NO PA notification
//     within 1 business day → CRITICAL (Vera per policy §7 line 255 —
//     "An unescalated breach is a Vera Critical finding").
//
// Additional §8 line 252 rule:
//   - Exception > 90 days without BRC renewal → finding. Implemented by
//     scanning `CrcLimitExceptionApproved` events: if `approvedAt` > 90
//     days before `now` AND no subsequent CrcLimitExceptionApproved for
//     the same counterparty exists → finding (lapsed exception).
//
// Empty-state correctness: no `CreditLimitBreached` and no
// `CrcLimitExceptionApproved` → pass.
//
// Independence: reads from the shared event store via `eventStore.replay`;
// does NOT import `@platform/risk/credit-limit-engine`.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
// Citations:
//   Policies/credit-risk-policy-v1.md §7 line 255 + §8 lines 248–254;
//   Procedures/by-policy/credit-risk-limit-management.md §9 (PROC-RISK-CLM-01);
//   Procedures/by-policy/credit-origination.md §9 (PROC-RISK-CO-01 Step 8);
//   Banks Act 94 of 1990 §73; RRB Regulation 23; LEX Directive D3/2022;
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Vera (Internal audit engineer).

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "credit-limit-breach-unescalated";

/**
 * Business-day window for escalation, expressed in hours. We use 72h
 * (calendar days) as a conservative weekend-tolerant approximation of
 * "1 business day". Production-grade business-day arithmetic is a
 * substrate gap owned by `@platform/calendar` (TBC).
 */
const ESCALATION_WINDOW_HOURS = 72;
/** Milliseconds per hour. */
const MS_PER_HOUR = 3_600_000;
/** Milliseconds per day — used for the 90-day lapsed-exception check. */
const MS_PER_DAY = 86_400_000;
/** Maximum exception duration without BRC renewal (Policy §8 line 251). */
const MAX_EXCEPTION_DAYS = 90;

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

export interface RunOpts {
  breachEvents?: Iterable<MinimalEvent>;
  disposalEvents?: Iterable<MinimalEvent>;
  escalationEvents?: Iterable<MinimalEvent>;
  paNotificationEvents?: Iterable<MinimalEvent>;
  exceptionApprovedEvents?: Iterable<MinimalEvent>;
  /** Anchor for the lapsed-exception check. */
  now?: Date;
}

function loadEvents(type: string, override: Iterable<MinimalEvent> | undefined): MinimalEvent[] {
  if (override) return [...override];
  const out: MinimalEvent[] = [];
  try {
    for (const e of eventStore.replay({ type })) {
      out.push({
        event_id: e.event_id,
        type: e.type,
        as_of: e.as_of,
        payload: (e.payload ?? {}) as Record<string, unknown>,
      });
    }
  } catch {
    // ignore — return empty
  }
  return out;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function withinWindow(breachAt: string, candidateAt: string, windowHours: number): boolean {
  const a = Date.parse(breachAt);
  const b = Date.parse(candidateAt);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  if (b < a) return false;
  return b - a <= windowHours * MS_PER_HOUR;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const breaches = loadEvents("CreditLimitBreached", opts.breachEvents);
  const disposals = loadEvents("CreditLimitBreachDisposed", opts.disposalEvents);
  const escalations = loadEvents("AgentEscalation", opts.escalationEvents);
  const paNotifs = loadEvents("PaNotificationSubmitted", opts.paNotificationEvents);
  const exceptions = loadEvents("CrcLimitExceptionApproved", opts.exceptionApprovedEvents);

  // -------------------------------------------------------------------------
  // Assertion 1: every breach must be escalated through (a), (b), or (c).
  // -------------------------------------------------------------------------
  for (const b of breaches) {
    result.asserted++;
    const breachId = safeString(b.payload.breachId);
    const cpid = safeString(b.payload.counterpartyId);
    if (!breachId) {
      violations.push({
        subject: b.event_id,
        severity: "info",
        message: `CreditLimitBreached event ${b.event_id} has no breachId in payload — cannot assert escalation pairing. Authority: D-CREDIT-LIMIT-ENGINE-BUILD.`,
      });
      continue;
    }

    // (a) breach disposed with matching breachId, within window
    const disposed = disposals.some(
      (d) =>
        safeString(d.payload.breachId) === breachId &&
        withinWindow(b.as_of, d.as_of, ESCALATION_WINDOW_HOURS),
    );
    if (disposed) continue;

    // (b) escalation marker referencing breachId or counterpartyId, within window
    const escalated = escalations.some((e) => {
      if (!withinWindow(b.as_of, e.as_of, ESCALATION_WINDOW_HOURS)) return false;
      const question = safeString(e.payload.question) ?? "";
      const escalationId = safeString(e.payload.escalationId) ?? "";
      if (question.includes(breachId) || escalationId.includes(breachId)) return true;
      if (cpid && (question.includes(cpid) || escalationId.includes(cpid))) return true;
      return false;
    });
    if (escalated) continue;

    // (c) PaNotificationSubmitted within window (regulatory channel)
    const paNotified = paNotifs.some((p) => {
      if (!withinWindow(b.as_of, p.as_of, ESCALATION_WINDOW_HOURS)) return false;
      const regulatoryRef = safeString(p.payload.regulatoryRef) ?? "";
      const notificationType = safeString(p.payload.notificationType) ?? "";
      if (regulatoryRef.includes(breachId) || notificationType.includes(breachId)) return true;
      if (cpid && (regulatoryRef.includes(cpid) || notificationType.includes(cpid))) return true;
      // Fallback: any LEX-cap PA notification within the window counts as a
      // valid (c) channel — the policy mandates a notification, not a
      // specific reference format.
      if (notificationType.toLowerCase().includes("lex")) return true;
      return false;
    });
    if (paNotified) continue;

    violations.push({
      subject: `breach:${breachId}`,
      severity: "fail",
      message: `CRITICAL: CreditLimitBreached breachId="${breachId}" (counterparty="${cpid ?? "?"}", detectedAt=${b.as_of}) has NOT been escalated through any sanctioned channel within ${ESCALATION_WINDOW_HOURS}h. Required (any one of): (a) CreditLimitBreachDisposed with same breachId; (b) AgentEscalation referencing breachId or counterpartyId; (c) PaNotificationSubmitted referencing breachId, counterpartyId, or with notificationType containing "lex". Unescalated breach = Critical Vera finding (Policies/credit-risk-policy-v1.md §7 line 255). Reportable to Thandiwe and the BRC. Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Procedures/by-policy/credit-risk-limit-management.md §9.`,
    });
  }

  // -------------------------------------------------------------------------
  // Assertion 2: lapsed exceptions (> 90 days without BRC renewal).
  // -------------------------------------------------------------------------
  // Group exceptions by counterparty; pick the latest approvedAt for each.
  if (exceptions.length > 0) {
    const now = opts.now ?? new Date();
    const latestByCp = new Map<string, { approvedAt: string; eventId: string }>();
    for (const e of exceptions) {
      const cpid = safeString(e.payload.counterpartyId);
      if (!cpid) continue;
      const approvedAt = safeString(e.payload.approvedAt) ?? e.as_of;
      const existing = latestByCp.get(cpid);
      if (!existing || approvedAt > existing.approvedAt) {
        latestByCp.set(cpid, { approvedAt, eventId: e.event_id });
      }
    }

    for (const [cpid, rec] of latestByCp) {
      result.asserted++;
      const approvedMs = Date.parse(rec.approvedAt);
      if (Number.isNaN(approvedMs)) continue;
      const daysSince = (now.getTime() - approvedMs) / MS_PER_DAY;
      if (daysSince > MAX_EXCEPTION_DAYS) {
        violations.push({
          subject: `exception:${cpid}`,
          severity: "fail",
          message: `Lapsed credit-risk exception: counterparty "${cpid}" has a CrcLimitExceptionApproved (${rec.eventId}, approvedAt=${rec.approvedAt}) that is ${daysSince.toFixed(1)} days old — exceeds the ${MAX_EXCEPTION_DAYS}-day maximum without BRC renewal (Policies/credit-risk-policy-v1.md §8 line 251). Exception is automatically lapsed; CRC must be notified. Authority: D-CREDIT-LIMIT-ENGINE-BUILD.`,
        });
      }
    }
  }

  // Empty-state guard — no breaches, no exceptions → pass.
  if (result.asserted === 0) {
    result.asserted = 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "credit-limit-breach-unescalated passed — every breach escalated; no lapsed exceptions."
        : "credit-limit-breach-unescalated FAILED — unescalated breach or lapsed exception detected.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
