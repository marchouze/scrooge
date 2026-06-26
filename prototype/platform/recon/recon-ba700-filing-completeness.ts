// platform/recon/recon-ba700-filing-completeness.ts
//
// Vera recon: ba700-filing-completeness — the BA 700 capital-adequacy
// filing-lifecycle completeness monitor.
//
// ## What it asserts
//
// For every CLOSED accounting period (`AccountingPeriodClosed`) of a
// bank-licence entity, a durable BA 700 filing-lifecycle record
// (`ReportFiled{formId:"BA700", reportingPeriod:<periodId>}`) AND a
// return-of-record (`ReportGenerated{formId:"BA700", reportingPeriod:<periodId>}`)
// must exist. The BA 700 period-close handler (`bea:ba700-period-close`,
// event-driven on `AccountingPeriodClosed`) generates the return-of-record and
// emits the filing-lifecycle event on every close, so a closed bank period with
// NO ReportFiled record means the return-of-record + filing path did not fire —
// a loud completeness gap, not a benign empty state.
//
// This is the durable, typed filing-lifecycle assertion (Principle 1) — distinct
// from the legacy `SarbSubmissionAttempted` submission-attempt audit record. The
// `ReportFiled` event is the bank's record that it FILED the return; the Finance
// returns register folds it for last-filed / overdue.
//
// ## Scope
//
//   - Only bank-licence entities (`BA_700_SUBSCRIBER_ENTITIES`, i.e.
//     `LE-ZA-HOZ-BANK`) are in scope.
//   - Build-phase-fixture closed periods are excluded via the default
//     provenance filter (seeded rehearsal periods are not real closes); only
//     production / simulated closes are asserted.
//
// ## CI-store posture
//
// A fresh CI event store has no closed periods → 0 asserted, 0 violations,
// PASS — the gate cannot false-positive before any period closes. It bites the
// moment a real (production/simulated) period closes without its BA 700
// return-of-record + filing-lifecycle records landing.
//
// Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-RMS-PHASE-1;
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN; Banks Act 94/1990 §70 + §73;
//   Principles/1-events-are-truth.md.
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille (Chief Financial Officer)).

import { eventStore } from "../composition";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { BA_700_SUBSCRIBER_ENTITIES } from "../returns/ba700/period-close-subscriber";

const provenanceFilter = defaultProvenanceFilter();

// 1. Collect the (entity, period) keys that have a BA 700 ReportFiled /
//    ReportGenerated record.
function collectKeys(type: "ReportFiled" | "ReportGenerated"): Set<string> {
  const keys = new Set<string>();
  for (const ev of eventStore.replay({ type })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === "BA700" && typeof p.reportingPeriod === "string") {
      keys.add(`${ev.entity}::${p.reportingPeriod}`);
    }
  }
  return keys;
}

const filedKeys = collectKeys("ReportFiled");
const generatedKeys = collectKeys("ReportGenerated");

// 2. For each in-scope (bank-licence) closed period, assert both a
//    return-of-record AND a filing-lifecycle record exist.
let asserted = 0;
let findings = 0;

for (const ev of eventStore.replay({ type: "AccountingPeriodClosed" })) {
  if (!BA_700_SUBSCRIBER_ENTITIES.includes(ev.entity)) continue;
  if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

  const payload = ev.payload as { periodId?: string };
  const periodId = payload.periodId;
  if (!periodId) continue;

  asserted++;
  const key = `${ev.entity}::${periodId}`;

  if (!generatedKeys.has(key)) {
    console.error(
      `FINDING: closed period ${periodId} (entity ${ev.entity}) has no BA 700 return-of-record (ReportGenerated{formId:BA700}) — the BA 700 return-of-record path did not fire for this close. Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY.`,
    );
    findings++;
  }
  if (!filedKeys.has(key)) {
    console.error(
      `FINDING: closed period ${periodId} (entity ${ev.entity}) has no BA 700 filing-lifecycle record (ReportFiled{formId:BA700}) — the BA 700 filing path did not fire for this close. Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY.`,
    );
    findings++;
  }
}

console.log(
  `ba700-filing-completeness: ${asserted} closed bank period(s) checked, ${findings} finding(s)`,
);
process.exit(findings > 0 ? 1 : 0);
