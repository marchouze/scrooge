// platform/recon/risk-register-closure.ts
//
// Vera continuous-controls pipeline: assert that the risk register is
// resolvable — every GENUINE (production-provenance) `RiskRaised` finding is
// eventually paired with a closure event from the closure family
// (`RiskResolved` / `RiskAccepted` / `RiskMitigated` —
// `RISK_CLOSURE_EVENT_TYPES`). Pairing is by `riskId`.
//
// Why this exists (WS-RISK-REGISTER-CLOSURE):
//   `RiskRaised` was write-only until the closure family landed. With no
//   closure event, any production finding stayed "open" forever and jammed
//   the risk-cycle goal-loops (PR #983 / #989). This recon makes the inverse
//   audit-checkable: it surfaces production findings that have NOT been closed
//   so an unclosed register is visible rather than silent.
//
// Tally rules:
//   - **warn.** A production-provenance `RiskRaised` whose `riskId` has no
//     closure event. Open findings are a normal operating state (they await
//     remediation / acceptance / mitigation), so this is advisory, not a CI
//     failure — it is the signal Rohan's goal-loop also acts on.
//   - **fail.** A production-provenance `RiskRaised` with a missing/empty
//     `riskId`. Such a finding can NEVER be paired with a closure — it is a
//     data-integrity defect, not merely an open risk.
//
// Provenance guard (mandatory for any fold over RiskRaised): build-phase-fixture
// and simulated events are synthetic test / backtest-harness data, not live
// findings — excluded. Mirrors `hasOpenRiskFindings()` in
// `runtime/agents/rohan-goal-loop.ts`.
//
// Empty-state correctness: no production RiskRaised → pass.
//
// Independence: reads the shared event store via `eventStore.replay`; does not
// import any risk-engine capability code.
//
// Citations:
//   WS-RISK-REGISTER-CLOSURE;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Vera (Internal audit engineer).

import { eventStore } from "../composition";
import { RISK_CLOSURE_EVENT_TYPES } from "../event-store/event-types/risk";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "risk-register-closure";

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
  readonly provenance?: { kind?: string } | null;
}

export interface RunOpts {
  /** Override RiskRaised events (testing). */
  raisedEvents?: Iterable<MinimalEvent>;
  /** Override closure events keyed by type (testing). */
  closureEvents?: Partial<
    Record<(typeof RISK_CLOSURE_EVENT_TYPES)[number], Iterable<MinimalEvent>>
  >;
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
        provenance: (e.provenance ?? null) as { kind?: string } | null,
      });
    }
  } catch {
    // ignore — return empty
  }
  return out;
}

/** Synthetic provenance is excluded — only production findings are audited. */
function isSynthetic(e: MinimalEvent): boolean {
  const kind = e.provenance?.kind;
  return kind === "build-phase-fixture" || kind === "simulated";
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Closed riskIds across the whole closure family.
  const closedRiskIds = new Set<string>();
  for (const closureType of RISK_CLOSURE_EVENT_TYPES) {
    for (const e of loadEvents(closureType, opts.closureEvents?.[closureType])) {
      const riskId = typeof e.payload.riskId === "string" ? e.payload.riskId : "";
      if (riskId) closedRiskIds.add(riskId);
    }
  }

  const raised = loadEvents("RiskRaised", opts.raisedEvents);

  // Track which distinct riskIds we've already reported open (a riskId may be
  // raised many times — report it once).
  const reportedOpen = new Set<string>();

  for (const e of raised) {
    if (isSynthetic(e)) continue;
    result.asserted++;
    const riskId = typeof e.payload.riskId === "string" ? e.payload.riskId : "";

    if (!riskId) {
      violations.push({
        subject: `risk-register-closure:no-risk-id:${e.event_id}`,
        message: `Production-provenance RiskRaised event ${e.event_id} has no riskId — it can never be paired with a closure event (RiskResolved/RiskAccepted/RiskMitigated). A finding without a stable riskId is a data-integrity defect. Citations: WS-RISK-REGISTER-CLOSURE; Principles/1-events-are-truth.md.`,
        severity: "fail",
      });
      continue;
    }

    if (!closedRiskIds.has(riskId) && !reportedOpen.has(riskId)) {
      reportedOpen.add(riskId);
      violations.push({
        subject: `risk-register-closure:open:${riskId}`,
        message: `Production risk finding ${riskId} has no closure event (${RISK_CLOSURE_EVENT_TYPES.join(" / ")}). It is open and awaiting resolution / acceptance / mitigation. Advisory — this is the signal Rohan's risk-cycle goal-loop also acts on. Citations: WS-RISK-REGISTER-CLOSURE.`,
        severity: "warn",
      });
    }
  }

  // Empty-state guard — no production findings → pass.
  if (result.asserted === 0) {
    result.asserted = 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  const openCount = r.violations.filter((v) => v.severity === "warn").length;
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      openFindings: openCount,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? `risk-register-closure passed — ${openCount} open production finding(s), 0 data-integrity defect(s).`
        : `risk-register-closure FAILED — ${failCount} RiskRaised event(s) with no riskId (uncloseable).`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
