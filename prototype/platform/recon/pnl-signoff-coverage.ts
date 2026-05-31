// platform/recon/pnl-signoff-coverage.ts
//
// Vera continuous-controls pipeline: pnl-signoff-coverage.
//
// Asserts, for every DailyPnLReportGenerated event in the store:
//   (a) A PnLSignedOff event exists for the same reportDate (sign-off
//       coverage). Every EOD report must be formally signed off by either
//       a trader or product control before the day closes.
//   (b) If a PnLAttributionExceptionRaised event exists for any attribution
//       on that reportDate, a PnLCommentaryRecorded event must be paired to it
//       (same linkedAttributionId). An unresolved exception with no commentary
//       is a control gap — commentary is a mandatory response to a breach.
//
// Empty-store posture: on a fresh runner with no DailyPnLReportGenerated
// events (GitHub Actions first boot), missing-event findings are downgraded to
// `info` and `ok` stays true — an empty bench has never run the P&L engine,
// not a control drift. Mirrors platform/recon/pnl-attribution-reconciles.ts.
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R4)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - FIN-BSS-01 (balance sheet substantiation policy)
//   - brief:bea:p-l-sign-off-commentary-slice-4:2026-05-31
//
// Author: Bea (Accounting & financial reporting engineer, engineering)
//   — pipeline contract per Vera (Internal audit engineer, engineering).

import { eventStore as defaultEventStore } from "../composition";
import type {
  PnLAttributionExceptionRaisedPayload,
  PnLCommentaryRecordedPayload,
  PnLSignedOffPayload,
} from "../event-store/event-types/product-control";
import type { EventStore } from "../event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "pnl-signoff-coverage";

export interface RunOpts {
  /** Override the event store (tests pre-seed their own in-memory store). */
  store?: EventStore;
}

export function run(opts: RunOpts = {}): ReconResult {
  const store = opts.store ?? defaultEventStore;
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // ---- Collect DailyPnLReportGenerated events by reportDate ---------------
  // We deduplicate to the set of distinct reportDates that have been reported.
  const reportDates = new Set<string>();
  for (const e of store.replay({ type: "DailyPnLReportGenerated" })) {
    const p = e.payload as { reportDate?: unknown };
    if (typeof p.reportDate === "string") reportDates.add(p.reportDate);
  }

  // Empty-store posture: no DailyPnLReportGenerated events → info, ok.
  if (reportDates.size === 0) {
    result.violations = [
      {
        subject: PIPELINE,
        message:
          "No DailyPnLReportGenerated events in the store — the P&L engine has not run on this bench yet (fresh-runner posture). Run runDailyPnLReport() to populate.",
        severity: "info",
      },
    ];
    return result;
  }

  // ---- Collect PnLSignedOff events by reportDate --------------------------
  const signOffByDate = new Set<string>();
  for (const e of store.replay({ type: "PnLSignedOff" })) {
    const p = e.payload as unknown as PnLSignedOffPayload;
    signOffByDate.add(p.reportDate);
  }

  // ---- Collect PnLAttributionExceptionRaised by reportDate → attributionId --
  const exceptionsByDate = new Map<string, Set<string>>();
  for (const e of store.replay({ type: "PnLAttributionExceptionRaised" })) {
    const p = e.payload as unknown as PnLAttributionExceptionRaisedPayload;
    const set = exceptionsByDate.get(p.reportDate) ?? new Set<string>();
    set.add(p.attributionId);
    exceptionsByDate.set(p.reportDate, set);
  }

  // ---- Collect PnLCommentaryRecorded by linkedAttributionId ----------------
  const commentaryByAttributionId = new Set<string>();
  for (const e of store.replay({ type: "PnLCommentaryRecorded" })) {
    const p = e.payload as unknown as PnLCommentaryRecordedPayload;
    commentaryByAttributionId.add(p.linkedAttributionId);
  }

  result.asserted = reportDates.size;

  for (const reportDate of reportDates) {
    // (a) Sign-off coverage — every reportDate must have a PnLSignedOff.
    if (!signOffByDate.has(reportDate)) {
      violations.push({
        subject: reportDate,
        message: `DailyPnLReportGenerated exists for ${reportDate} but no PnLSignedOff event was found for the same reportDate. Every EOD P&L report must be formally signed off (trader or product-control role) before the day closes.`,
        severity: "fail",
      });
    }

    // (b) Commentary coverage — every PnLAttributionExceptionRaised on this
    //     reportDate must pair with a PnLCommentaryRecorded event.
    const exceptions = exceptionsByDate.get(reportDate);
    if (exceptions) {
      for (const attributionId of exceptions) {
        if (!commentaryByAttributionId.has(attributionId)) {
          violations.push({
            subject: attributionId,
            message: `PnLAttributionExceptionRaised exists for attribution ${attributionId} (reportDate ${reportDate}) but no paired PnLCommentaryRecorded event was found (same linkedAttributionId). Every P&L attribution exception must be formally commented on by product control.`,
            severity: "fail",
          });
        }
      }
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
    `[${PIPELINE}] ${statusLabel} — ${result.asserted} report date(s) asserted, ${result.violations.length} violation(s)`,
  );
  for (const v of result.violations) {
    const prefix = v.severity === "fail" ? "  FAIL" : v.severity === "warn" ? "  WARN" : "  INFO";
    console.log(`${prefix}  ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
