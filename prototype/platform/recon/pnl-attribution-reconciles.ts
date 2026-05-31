// platform/recon/pnl-attribution-reconciles.ts
//
// Vera continuous-controls pipeline: pnl-attribution-reconciles.
//
// Asserts, for every PnLAttributionGenerated event in the store:
//   (a) Additive reconciliation EXACT — actualMoveZarMinor equals the sum of
//       the five component amounts (newTrade + marketMove + carry + realised +
//       residual). This is the structural invariant the engine's zod .refine
//       enforces at construction; the recon re-asserts it in retrospect so a
//       hand-emitted or replayed event that violates it is caught.
//   (b) Residual within tolerance — |residual| ≤ toleranceZarMinor, AND the
//       payload's `residualWithinTolerance` flag agrees with that arithmetic.
//   (c) Exception pairing — every PnLAttributionGenerated with
//       residualWithinTolerance:false OR any component complete:false MUST have
//       a paired PnLAttributionExceptionRaised for the same attributionId.
//       Models on recon:mtm-reversal-paired-with-reval (a control event must
//       pair with the figure it qualifies).
//
// Empty-store posture: on a fresh runner with no PnLAttributionGenerated events
// (GitHub Actions first boot), missing-event findings are downgraded to
// `info` and `ok` stays true — an empty bench has never run the engine, not a
// drift. Mirrors platform/recon/document-registration.ts.
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R1)
//   - IFRS-9 §5.7.1 (FVTPL P&L recognition)
//   - FRTB-PLA (P&L attribution test analogue)
//   - brief:bea:p-l-attribution-engine-fx-spot-mvp:2026-05-31
//
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   — pipeline contract per Vera (Internal audit engineer, engineering).

import { eventStore as defaultEventStore } from "../composition";
import type {
  AttributionComponent,
  PnLAttributionExceptionRaisedPayload,
  PnLAttributionGeneratedPayload,
} from "../event-store/event-types/product-control";
import type { EventStore } from "../event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "pnl-attribution-reconciles";

export interface RunOpts {
  /** Override the event store (tests pre-seed their own in-memory store). */
  store?: EventStore;
}

function componentSum(p: PnLAttributionGeneratedPayload): number {
  return (
    p.newTrade.amountZarMinor +
    p.marketMove.amountZarMinor +
    p.carry.amountZarMinor +
    p.realised.amountZarMinor +
    p.residual.amountZarMinor
  );
}

function anyComponentIncomplete(p: PnLAttributionGeneratedPayload): boolean {
  const comps: AttributionComponent[] = [
    p.newTrade,
    p.marketMove,
    p.carry,
    p.realised,
    p.residual,
  ];
  return comps.some((c) => !c.complete);
}

export function run(opts: RunOpts = {}): ReconResult {
  const store = opts.store ?? defaultEventStore;
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Collect attribution events + exception pairings.
  const attributions: PnLAttributionGeneratedPayload[] = [];
  for (const e of store.replay({ type: "PnLAttributionGenerated" })) {
    attributions.push(e.payload as unknown as PnLAttributionGeneratedPayload);
  }
  const exceptionsByAttribution = new Set<string>();
  for (const e of store.replay({ type: "PnLAttributionExceptionRaised" })) {
    const p = e.payload as unknown as PnLAttributionExceptionRaisedPayload;
    exceptionsByAttribution.add(p.attributionId);
  }

  // Empty-store posture: no attribution events on a fresh bench → info, ok.
  if (attributions.length === 0) {
    return {
      pipeline: PIPELINE,
      ok: true,
      asserted: 0,
      violations: [
        {
          subject: PIPELINE,
          message:
            "No PnLAttributionGenerated events in the store — the P&L attribution engine has not run on this bench yet (fresh-runner posture). Run runPnLAttribution() to populate.",
          severity: "info",
        },
      ],
      asOf: new Date().toISOString(), // wall-clock: recon pipeline infrastructure timestamp
    };
  }

  result.asserted = attributions.length;

  for (const p of attributions) {
    // (a) Additive reconciliation — EXACT.
    const sum = componentSum(p);
    if (sum !== p.actualMoveZarMinor) {
      violations.push({
        subject: p.attributionId,
        message: `additive reconciliation broken: actualMoveZarMinor=${p.actualMoveZarMinor} but newTrade+marketMove+carry+realised+residual=${sum} (Δ=${p.actualMoveZarMinor - sum}). The components MUST sum exactly to the actual clean-P&L move (residual absorbs the gap).`,
        severity: "fail",
      });
    }

    // (b) Residual within tolerance — arithmetic must agree with the flag.
    const withinByArithmetic = Math.abs(p.residual.amountZarMinor) <= p.toleranceZarMinor;
    if (withinByArithmetic !== p.residualWithinTolerance) {
      violations.push({
        subject: p.attributionId,
        message: `residualWithinTolerance flag (${p.residualWithinTolerance}) disagrees with arithmetic: |residual=${p.residual.amountZarMinor}| <= tolerance=${p.toleranceZarMinor} is ${withinByArithmetic}.`,
        severity: "fail",
      });
    }

    // (c) Exception pairing — an unclean attribution must pair with an exception.
    const unclean = !p.residualWithinTolerance || anyComponentIncomplete(p);
    if (unclean && !exceptionsByAttribution.has(p.attributionId)) {
      violations.push({
        subject: p.attributionId,
        message: `attribution is unclean (residualWithinTolerance=${p.residualWithinTolerance}, anyComponentIncomplete=${anyComponentIncomplete(p)}) but has no paired PnLAttributionExceptionRaised event. Every unclean attribution must emit a typed exception (residual-breach or incomplete-inputs).`,
        severity: "fail",
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = run();
  const statusLabel = result.ok ? "PASS" : "FAIL";
  console.log(
    `[${PIPELINE}] ${statusLabel} — ${result.asserted} attribution(s) asserted, ${result.violations.length} violation(s)`,
  );
  for (const v of result.violations) {
    const prefix = v.severity === "fail" ? "  FAIL" : v.severity === "warn" ? "  WARN" : "  INFO";
    console.log(`${prefix}  ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
