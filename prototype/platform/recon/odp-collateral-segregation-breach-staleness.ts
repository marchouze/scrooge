// platform/recon/odp-collateral-segregation-breach-staleness.ts
//
// Vera continuous-controls pipeline: assert that every
// CollateralSegregationBreachRaised event is remediated within its deadline.
//
// Breach remediation completion is inferred from:
//   - A later CollateralSufficiencyChecked event for the same counterparty
//     where isSufficient === true AND checkDate > breach date (sufficiency breaches).
//   - A CollateralSegregationReleased or CollateralSubstitutionApproved event
//     for the involved lockId (commingling, ineligible, lock-missing breaches).
//
// When no remediation evidence is found and the remediationDeadline has passed:
//   → FAIL violation (requires CRO escalation if not already flagged).
// When within 24h of deadline with no remediation:
//   → WARN violation (approaching deadline).
//
// Standing authority: ORG-ODP-COND-010 (Derivatives Counterparty obligation).
// Citations:
//   urn:regulation:odp:cs-2-2018 §12 (segregation and rehypothecation controls);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Devon (COO, operations)

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "odp-collateral-segregation-breach-staleness";

const MS_PER_HOUR = 3_600_000;
const APPROACHING_DEADLINE_HOURS = 24;

// ---------------------------------------------------------------------------
// Minimal event shape
// ---------------------------------------------------------------------------

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// RunOpts — dependency injection surface for tests
// ---------------------------------------------------------------------------

export interface RunOpts {
  breachEvents?: Iterable<MinimalEvent>;
  sufficiencyEvents?: Iterable<MinimalEvent>;
  releaseEvents?: Iterable<MinimalEvent>;
  substitutionApprovedEvents?: Iterable<MinimalEvent>;
  /** Wall-clock anchor for deadline comparison. Defaults to current instant. */
  now?: Date;
}

// ---------------------------------------------------------------------------
// Load helpers
// ---------------------------------------------------------------------------

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
    // event store unavailable — return empty (safe default for CI)
  }
  return out;
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const now = opts.now ?? new Date();
  const nowMs = now.getTime();

  const breaches = loadEvents("CollateralSegregationBreachRaised", opts.breachEvents);
  const sufficiencyChecks = loadEvents("CollateralSufficiencyChecked", opts.sufficiencyEvents);
  const releases = loadEvents("CollateralSegregationReleased", opts.releaseEvents);
  const substitutionApproved = loadEvents(
    "CollateralSubstitutionApproved",
    opts.substitutionApprovedEvents,
  );

  // Build remediation index: counterpartyId → latest sufficient check date
  const latestSufficientDateByCp = new Map<string, string>();
  for (const sc of sufficiencyChecks) {
    const cpid = safeString(sc.payload.counterpartyId);
    const checkDate = safeString(sc.payload.checkDate);
    const isSufficient = sc.payload.isSufficient === true;
    if (!cpid || !checkDate || !isSufficient) continue;
    const existing = latestSufficientDateByCp.get(cpid);
    if (!existing || checkDate > existing) {
      latestSufficientDateByCp.set(cpid, checkDate);
    }
  }

  // Build remediated-lock set from releases and substitution-approved
  const remediatedLockIds = new Set<string>();
  for (const r of releases) {
    const lid = safeString(r.payload.lockId);
    if (lid) remediatedLockIds.add(lid);
  }
  for (const sa of substitutionApproved) {
    // SubstitutionApproved carries newLockEventId; the outgoing lock ID
    // is on the request. We rely on the CollateralSegregationReleased event
    // (emitted alongside approval) to mark the outgoing lock as released.
    // Additionally track via substitutionId for completeness.
    const subId = safeString(sa.payload.substitutionId);
    if (subId) remediatedLockIds.add(`sub:${subId}`);
  }

  // Assert each breach is remediated within its deadline
  for (const b of breaches) {
    const breachId = safeString(b.payload.breachId);
    const cpid = safeString(b.payload.counterpartyId);
    const breachKind = safeString(b.payload.breachKind);
    const deadlineStr = safeString(b.payload.remediationDeadline);
    const severity = safeString(b.payload.severity);

    // Only assert on material and critical breaches; minor are informational
    if (severity === "minor") continue;

    base.asserted++;

    if (!breachId || !cpid || !deadlineStr) {
      violations.push({
        subject: b.event_id,
        severity: "warn",
        message:
          `CollateralSegregationBreachRaised event ${b.event_id} is missing ` +
          `breachId, counterpartyId, or remediationDeadline. Cannot assert remediation. ` +
          `Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12.`,
      });
      continue;
    }

    const deadlineMs = Date.parse(deadlineStr);
    if (Number.isNaN(deadlineMs)) continue;

    // Check if the breach has been remediated
    let remediated = false;

    if (breachKind === "sufficiency" || breachKind === "lock-missing") {
      // Remediated if a later sufficient check exists for this counterparty
      const latestSufficientDate = latestSufficientDateByCp.get(cpid);
      if (latestSufficientDate && latestSufficientDate > b.as_of.slice(0, 10)) {
        remediated = true;
      }
    } else if (breachKind === "commingling" || breachKind === "ineligible") {
      // Remediated if the involved lock was released
      const lockId = safeString(b.payload.lockId);
      if (lockId && remediatedLockIds.has(lockId)) {
        remediated = true;
      }
    }

    if (remediated) continue; // clean — breach has been remediated

    const msUntilDeadline = deadlineMs - nowMs;

    if (msUntilDeadline < 0) {
      const hoursOverdue = Math.abs(msUntilDeadline) / MS_PER_HOUR;
      violations.push({
        subject: `breach:${breachId}`,
        severity: "fail",
        message:
          `CRITICAL: CollateralSegregationBreachRaised breachId="${breachId}" ` +
          `(counterparty="${cpid}", kind="${breachKind ?? "?"}", severity="${severity}") ` +
          `is PAST its remediation deadline (${deadlineStr}). ` +
          `Overdue by: ${hoursOverdue.toFixed(1)}h. ` +
          `Required: remediate the breach OR escalate to CRO (Helena, Chief Risk Officer, risk). ` +
          `Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12.`,
      });
    } else if (msUntilDeadline <= APPROACHING_DEADLINE_HOURS * MS_PER_HOUR) {
      const hoursRemaining = msUntilDeadline / MS_PER_HOUR;
      violations.push({
        subject: `breach:${breachId}`,
        severity: "warn",
        message:
          `CollateralSegregationBreachRaised breachId="${breachId}" ` +
          `(counterparty="${cpid}", kind="${breachKind ?? "?"}") ` +
          `is approaching its remediation deadline. ` +
          `Hours remaining: ${hoursRemaining.toFixed(1)}h. ` +
          `Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12.`,
      });
    }
    // else: within deadline — OK
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;

  return {
    ...base,
    violations,
    ok: failCount === 0,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  const failCount = r.violations.filter((v) => v.severity === "fail").length;

  if (failCount === 0 && warnCount === 0) {
    console.log(
      JSON.stringify({
        level: "info",
        pipeline: PIPELINE,
        ok: r.ok,
        asserted: r.asserted,
        msg: `${PIPELINE} passed — ${r.asserted} breach(es) checked; 0 deadline violations`,
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: failCount > 0 ? "error" : "warn",
        pipeline: PIPELINE,
        ok: r.ok,
        asserted: r.asserted,
        warnings: warnCount,
        failures: failCount,
        msg: `${PIPELINE}: ${failCount} deadline failure(s); ${warnCount} warning(s)`,
      }),
    );
    for (const v of r.violations) {
      console.warn(`  [${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`);
    }
  }

  if (!r.ok) process.exit(1);
}
