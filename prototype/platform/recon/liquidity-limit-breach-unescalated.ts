// platform/recon/liquidity-limit-breach-unescalated.ts
//
// Vera continuous-controls pipeline: assert that every `LiquidityLimit-
// Breached` event with severity `critical` or `high` has been escalated
// through ONE of the three sanctioned channels per LRM Policy v1 §9.3:
//
//   (a) `LiquidityLimitBreachDisposed` with same `breachId`, within the
//       SLA window (24h critical; 72h high — calendar-day approximations
//       of "1 business day" / "3 business days" per LRM Policy v1 §9.3).
//
//   (b) An escalation marker — any `AgentEscalation` event whose
//       `question` or `escalationId` references the `breachId`, emitted
//       within the SLA window.
//
//   (c) `PaNotificationSubmitted` per LRM Policy v1 §9.1 (PA notification
//       under Reg 26 on PA-minimum breach). The notification can reference
//       the breach explicitly or carry `notificationType` containing
//       "lcr" / "nsfr" / "liquidity" for tier-1 PA-minimum breaches.
//
// Failure path:
//   - Critical / high breach with NO disposal, NO escalation, AND NO PA
//     notification within the SLA → Vera Critical finding (LRM Policy
//     v1 §9.3 step 1; reportable to Thandiwe (Chief Audit Executive,
//     governance) and BRC).
//
// Lower-severity breaches (medium, low) are not asserted — they are
// first-line-document-only per LRM Policy v1 §9.1.
//
// Empty-state correctness: no `LiquidityLimitBreached` events → pass.
//
// Independence: reads from the shared event store via `eventStore.replay`;
// does NOT import `@platform/risk/liquidity-limit-engine` (Ravi's
// concurrent engine build).
//
// Standing authority:
//   - D-RAS; LRM Policy v1; brief:ravi:liquidity-limit-engine-mirroring-
//     credit-limit-en:2026-05-21.
//
// Citations:
//   Policies/liquidity-risk-management-policy-v1.md §9.1 + §9.3;
//   Procedures/by-policy/liquidity-limit-management.md (PROC-RISK-LLM-01) §9;
//   Banks Act 94 of 1990 §§ 60-72; RRB Reg 26; RRB Reg 26A;
//   PA D6/2015; PA D1/2023; BCBS D295; BCBS D335;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Vera (Internal audit engineer, third-line — functionally to
//   Thandiwe (Chief Audit Executive, governance); administratively
//   through the CEO).

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "liquidity-limit-breach-unescalated";

/**
 * SLA windows per LRM Policy v1 §9.3:
 *   Critical → 24h (calendar-day approximation of "1 business day").
 *   High     → 72h (calendar-day approximation of "3 business days";
 *              weekend-tolerant).
 */
const CRITICAL_WINDOW_HOURS = 24;
const HIGH_WINDOW_HOURS = 72;
const MS_PER_HOUR = 3_600_000;

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

  const breaches = loadEvents("LiquidityLimitBreached", opts.breachEvents);
  const disposals = loadEvents("LiquidityLimitBreachDisposed", opts.disposalEvents);
  const escalations = loadEvents("AgentEscalation", opts.escalationEvents);
  const paNotifs = loadEvents("PaNotificationSubmitted", opts.paNotificationEvents);

  for (const b of breaches) {
    const severity = safeString(b.payload.severity);
    if (severity !== "critical" && severity !== "high") continue; // medium/low not asserted
    result.asserted++;

    const breachId = safeString(b.payload.breachId);
    const line = safeString(b.payload.line) ?? "?";
    const tier = safeString(b.payload.tier) ?? "?";
    if (!breachId) {
      violations.push({
        subject: b.event_id,
        severity: "info",
        message: `LiquidityLimitBreached event ${b.event_id} has no breachId in payload — cannot assert escalation pairing. Authority: D-RAS; LRM Policy v1 §9.3.`,
      });
      continue;
    }

    const windowHours = severity === "critical" ? CRITICAL_WINDOW_HOURS : HIGH_WINDOW_HOURS;

    // (a) disposal within SLA
    const disposed = disposals.some(
      (d) =>
        safeString(d.payload.breachId) === breachId && withinWindow(b.as_of, d.as_of, windowHours),
    );
    if (disposed) continue;

    // (b) escalation referencing breachId
    const escalated = escalations.some((e) => {
      if (!withinWindow(b.as_of, e.as_of, windowHours)) return false;
      const question = safeString(e.payload.question) ?? "";
      const escalationId = safeString(e.payload.escalationId) ?? "";
      return question.includes(breachId) || escalationId.includes(breachId);
    });
    if (escalated) continue;

    // (c) PA notification for tier-1 PA-minimum breaches
    const paNotified = paNotifs.some((p) => {
      if (!withinWindow(b.as_of, p.as_of, windowHours)) return false;
      const regulatoryRef = safeString(p.payload.regulatoryRef) ?? "";
      const notificationType = safeString(p.payload.notificationType) ?? "";
      if (regulatoryRef.includes(breachId) || notificationType.includes(breachId)) return true;
      const ntLower = notificationType.toLowerCase();
      if (ntLower.includes("lcr") || ntLower.includes("nsfr") || ntLower.includes("liquidity")) {
        return true;
      }
      return false;
    });
    if (paNotified) continue;

    violations.push({
      subject: `breach:${breachId}`,
      severity: "fail",
      message: `CRITICAL: LiquidityLimitBreached breachId="${breachId}" (tier=${tier}, line=${line}, severity=${severity}, detectedAt=${b.as_of}) has NOT been escalated through any sanctioned channel within ${windowHours}h. Required (any one of): (a) LiquidityLimitBreachDisposed with same breachId; (b) AgentEscalation referencing breachId; (c) PaNotificationSubmitted referencing breachId or with notificationType containing "lcr"/"nsfr"/"liquidity". Unescalated critical/high breach = Critical Vera finding (LRM Policy v1 §9.3 step 1). Reportable to Thandiwe (Chief Audit Executive, governance) and the BRC. Authority: D-RAS; Procedures/by-policy/liquidity-limit-management.md §9 (PROC-RISK-LLM-01).`,
    });
  }

  if (result.asserted === 0) {
    result.asserted = 1; // empty-state guard
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
        ? "liquidity-limit-breach-unescalated passed — every critical/high breach escalated."
        : "liquidity-limit-breach-unescalated FAILED — unescalated breach detected.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
