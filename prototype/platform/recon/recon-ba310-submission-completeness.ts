// platform/recon/recon-ba310-submission-completeness.ts
//
// Vera recon: ba310-submission-completeness — the reporting-submission
// completeness monitor flagged by the FX functionality domain review
// (gap #1 / §7 monitoring gap: "no recon on reporting-submission
// completeness").
//
// ## What it asserts
//
// For every CLOSED accounting period (`AccountingPeriodClosed`) of a
// bank-licence entity, a BA-310 (market / position risk — FX-NOP) submission
// record (`SarbSubmissionAttempted{formId:"BA310", reportingPeriod:<periodId>}`)
// must exist. The BA-310 period-close handler (`bea:ba310-period-close`,
// event-driven on `AccountingPeriodClosed`) generates the return and records
// the submission attempt via the local SARB simulator on every close, so a
// closed bank period with NO BA-310 record means the generation/submission
// path did not fire — a loud completeness gap, not a benign empty state.
//
// ## Scope
//
//   - Only bank-licence entities (`BA_310_SUBSCRIBER_ENTITIES`, i.e.
//     `LE-ZA-HOZ-BANK`) are in scope; non-bank entities do not file BA 310.
//   - Build-phase-fixture closed periods are excluded via the default
//     provenance filter (seeded rehearsal periods are not real closes); only
//     production / simulated closes are asserted.
//
// ## CI-store posture
//
// A fresh CI event store has no closed periods → 0 asserted, 0 violations,
// PASS — the gate cannot false-positive before any period closes. It bites
// the moment a real (production/simulated) period closes without its BA-310
// submission record landing.
//
// Form numbering: BA 310 (Reg 28(5)); FX daily-return NOP rides BA 110
// (Reg 29(3)); there is NO BA 320 / BA 325.
// Authority: D-BA-RETURN-FORM-NUMBERING-RECON;
//            D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
// Brief: brief:mira:close-fx-gap-wire-ba-310-fx-nop-return-into-runt:2026-06-08.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { eventStore } from "../composition";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { BA_310_SUBSCRIBER_ENTITIES } from "../returns/ba310/period-close-subscriber";

const provenanceFilter = defaultProvenanceFilter();

// 1. Collect the set of periodIds that have a BA-310 submission record.
const ba310Periods = new Set<string>();
for (const ev of eventStore.replay({ type: "SarbSubmissionAttempted" })) {
  const p = ev.payload as { formId?: string; reportingPeriod?: string };
  if (p.formId === "BA310" && typeof p.reportingPeriod === "string") {
    ba310Periods.add(p.reportingPeriod);
  }
}

// 2. For each in-scope (bank-licence) closed period without a BA-310 record,
//    raise a completeness finding.
let asserted = 0;
let findings = 0;

for (const ev of eventStore.replay({ type: "AccountingPeriodClosed" })) {
  // Only bank-licence entities file BA 310.
  if (!BA_310_SUBSCRIBER_ENTITIES.includes(ev.entity)) continue;
  // Exclude seeded build-phase-fixture closes — only real closes are asserted.
  if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

  const payload = ev.payload as { periodId?: string };
  const periodId = payload.periodId;
  if (!periodId) continue;

  asserted++;
  if (!ba310Periods.has(periodId)) {
    console.error(
      `FINDING: closed period ${periodId} (entity ${ev.entity}) has no BA-310 submission record (SarbSubmissionAttempted{formId:BA310}) — the BA-310 FX-NOP generation/submission path did not fire for this close.`,
    );
    findings++;
  }
}

console.log(
  `ba310-submission-completeness: ${asserted} closed bank period(s) checked, ${findings} finding(s)`,
);
process.exit(findings > 0 ? 1 : 0);
