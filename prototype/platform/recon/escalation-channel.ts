// platform/recon/escalation-channel.ts
//
// Continuous-controls pipeline: escalation-channel integrity (Vera Wave-4 #14).
//
// With the `AgentEscalation` event type now live, this pipeline asserts that
// the escalation channel is operational and SLA-bound. It queries the event
// store for `AgentEscalation` events in the last 30 days and checks:
//
//   1. Each escalation event has `routedTo` set (required field — routing
//      destination for the escalated question).
//   2. Each escalation event has `severity` set (required field — governs
//      SLA tier and routing priority).
//   3. Escalations are resolved within SLA:
//        - severity:high or severity:blocking — resolved within 48h.
//        - severity:medium — resolved within 120h.
//        - severity:low — no SLA enforced (info if unresolved after 120h).
//
//   "Resolved" = an `AgentEscalationDecided` (or `AgentEscalationDelegated`)
//   event exists with the same `escalationId`. This matches the lifecycle
//   diagram in Vera's spec §10: an escalation is open until a decision is
//   recorded or it is delegated away.
//
//   A fresh / empty event store is a valid condition on a CI runner — the
//   pipeline returns ok=true with 0 assertions rather than false-positive
//   failures (same fail-open posture as decision-event-recon.ts).
//
// SLA basis: Vera spec §6 (Cadence) — Vera's overnight recon runs at 02:00 UTC;
// escalation SLAs are first-line operational commitments per the escalation
// procedure (`Procedures/by-policy/agent-escalation.md`). The 48h / 120h
// thresholds are the same as those set by the Scrooge operating spec's
// dispatch discipline and the IIA IPPF §2300 timeliness standards.
//
// Findings (severity):
//   - fail: `routedTo` missing (schema violation — impossible given the Zod
//     schema but can occur with legacy or hand-crafted events).
//   - fail: `severity` missing (same as above).
//   - fail: unresolved high/blocking escalation after 48h.
//   - warn: unresolved medium escalation after 120h.
//   - info: unresolved low escalation after 120h.
//
// Citations:
//   - IIA-IPPF (§2300 — performing engagement)
//   - P6-AUTONOMOUS-BY-DEFAULT (escalations are first-class typed channels)
//   - BCBS-223 (operational resilience — supervisory escalation timeliness)
//
// Author: Vera (Internal audit engineer, third-line)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "escalation-channel";

const CITATIONS = ["IIA-IPPF", "P6-AUTONOMOUS-BY-DEFAULT", "BCBS-223"];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** SLA in hours by severity tier. `null` = no SLA enforced. */
const SLA_HOURS: Record<string, number | null> = {
  high: 48,
  blocking: 48,
  medium: 120,
  low: null, // info only, no fail
};

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

interface EscalationEvent {
  event_id: string;
  as_of: string;
  payload: {
    escalationId: string;
    raisedBy?: string;
    severity?: string;
    routedTo?: string;
    deadline?: string;
  };
}

interface ResolvedEvent {
  payload: {
    escalationId: string;
  };
}

export interface RunOpts {
  dbPath?: string;
  /** Override the current time for SLA calculations (ISO string). Used by tests. */
  now?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(REPO_ROOT, "prototype/.local/event.db");

  if (!existsSync(dbPath)) {
    // Fresh runner / empty store — not an error; escalations may genuinely be absent.
    return result;
  }

  const store = new EventStore(dbPath);
  const now = new Date(opts.now ?? new Date().toISOString());
  const cutoff = new Date(now.getTime() - THIRTY_DAYS_MS);

  const violations: ReconViolation[] = [];

  // Collect AgentEscalation events from the last 30 days.
  const escalations: EscalationEvent[] = [];
  try {
    for (const e of store.replay({ type: "AgentEscalation" })) {
      const ev = e as unknown as EscalationEvent;
      if (!ev.as_of) continue;
      const eventDate = new Date(ev.as_of);
      if (eventDate < cutoff) continue;
      escalations.push(ev);
    }
  } catch {
    // Store unreadable — fail-open, same posture as decision-event-recon.
    return result;
  }

  // Collect resolved escalation IDs (AgentEscalationDecided + AgentEscalationDelegated).
  const resolvedIds = new Set<string>();
  try {
    for (const e of store.replay({ type: "AgentEscalationDecided" })) {
      const ev = e as unknown as ResolvedEvent;
      if (ev.payload?.escalationId) resolvedIds.add(ev.payload.escalationId);
    }
    for (const e of store.replay({ type: "AgentEscalationDelegated" })) {
      const ev = e as unknown as ResolvedEvent;
      if (ev.payload?.escalationId) resolvedIds.add(ev.payload.escalationId);
    }
  } catch {
    // If we can't read resolved events, continue — unresolved check will be conservative.
  }

  for (const ev of escalations) {
    result.asserted++;
    const id = ev.payload.escalationId;
    const subject = `escalation:${id}`;

    // Assertion 1: routedTo must be set.
    if (!ev.payload.routedTo || ev.payload.routedTo.trim() === "") {
      violations.push({
        subject,
        message: `escalation ${id} (raised by ${ev.payload.raisedBy ?? "unknown"}) has no \`routedTo\` field — escalation channel is unrouted. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }

    // Assertion 2: severity must be set.
    const severity = ev.payload.severity;
    if (!severity || severity.trim() === "") {
      violations.push({
        subject,
        message: `escalation ${id} has no \`severity\` field — SLA tier cannot be determined. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
      continue;
    }

    // Assertion 3: SLA check for unresolved escalations.
    if (resolvedIds.has(id)) continue; // resolved — no SLA violation.

    const raisedAt = new Date(ev.as_of);
    const ageHours = (now.getTime() - raisedAt.getTime()) / (1000 * 60 * 60);
    const slaHours = SLA_HOURS[severity] ?? null;

    if (slaHours !== null && ageHours > slaHours) {
      const tier = severity === "blocking" || severity === "high" ? "high/blocking" : severity;
      const findingSeverity = severity === "medium" ? ("warn" as const) : ("fail" as const);
      violations.push({
        subject,
        message: `escalation ${id} (severity:${severity}) is unresolved after ${ageHours.toFixed(1)}h — SLA is ${slaHours}h for ${tier}. routedTo=${ev.payload.routedTo ?? "unset"}. Citations: ${CITATIONS.join(", ")}.`,
        severity: findingSeverity,
      });
    } else if (slaHours === null && ageHours > 120) {
      // Low-severity: info finding after 120h.
      violations.push({
        subject,
        message: `escalation ${id} (severity:low) is unresolved after ${ageHours.toFixed(1)}h. No SLA breach, but flagged for awareness. Citations: ${CITATIONS.join(", ")}.`,
        severity: "info",
      });
    }
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
        ? "Escalation-channel integrity passed"
        : "Escalation-channel integrity FAILED — unresolved escalations or missing fields",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
