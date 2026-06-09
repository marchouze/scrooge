// platform/recon/recon-rwa-computed-sourcing.ts
//
// Vera recon: rwa-computed-sourcing — asserts that the BA 700 capital-adequacy
// RWA denominator is sourced from a `RwaComputed` event of record, not a bare
// fixture, with credit + market RWA event-sourced and operational RWA an
// explicit flagged placeholder.
//
// ## What it asserts
//
// For every `RwaComputed` event on a bank-licence entity (production /
// simulated provenance):
//
//   1. The credit + market composition is event-sourced — `source` carries the
//      canonical `RWA_COMPUTED_BUILD_PHASE_SOURCE` discriminator (credit+market
//      event-sourced; op-placeholder), NOT "fixture-rehearsal".
//   2. Operational RWA is the flagged placeholder — `operationalRwaIsPlaceholder
//      === true` AND `operationalRwaMinor === 0`. Operational RWA must NOT be
//      silently fabricated (gross-income-blocked until licence-day).
//   3. The decomposition is internally consistent —
//      totalRwaMinor === creditRwaMinor + marketRwaMinor + operationalRwaMinor.
//   4. The BA 700 return for the same (entity, periodId) threads the
//      RwaComputed event_id via `rwaComputationEventId` — chain-of-custody
//      (Principle 1). Generated on demand from the events-first BA 700 path.
//
// ## CI-store posture
//
// A fresh CI event store has no RwaComputed events → 0 asserted, 0 findings,
// PASS — the gate cannot false-positive before any period's RWA is computed.
// It bites the moment a RwaComputed event is emitted whose composition is a
// bare fixture, or whose op-RWA is not the flagged placeholder, or that BA 700
// fails to thread.
//
// Authority: D-RWA-ENGINE-W2-SLICE-3 (CEO session-delegation 2026-06-09).
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line-mapping owner).

import { eventStore } from "../composition";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { generateBA700Return } from "../returns/ba700/generator";
import { RWA_COMPUTED_BUILD_PHASE_SOURCE } from "../risk/rwa-computed-engine";
import { RWA_BANK_ENTITIES } from "../risk/rwa-engine";

const provenanceFilter = defaultProvenanceFilter();

interface RwaComputedShape {
  entityId?: string;
  periodId?: string;
  functionalCurrency?: string;
  creditRwaMinor?: number;
  marketRwaMinor?: number;
  operationalRwaMinor?: number;
  totalRwaMinor?: number;
  source?: string;
  operationalRwaIsPlaceholder?: boolean;
}

let asserted = 0;
let findings = 0;

for (const ev of eventStore.replay({ type: "RwaComputed" })) {
  if (!RWA_BANK_ENTITIES.includes(ev.entity)) continue;
  if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

  const p = ev.payload as RwaComputedShape;
  const periodId = p.periodId;
  if (!periodId) continue;

  asserted++;

  // 1. credit + market event-sourced (not a bare fixture).
  if (p.source !== RWA_COMPUTED_BUILD_PHASE_SOURCE) {
    console.error(
      `FINDING: RwaComputed ${ev.event_id} (period ${periodId}) carries source='${p.source}', expected the event-sourced discriminator '${RWA_COMPUTED_BUILD_PHASE_SOURCE}' — credit + market RWA must be event-sourced, not a bare fixture.`,
    );
    findings++;
  }

  // 2. operational RWA is the flagged placeholder.
  if (p.operationalRwaIsPlaceholder !== true || p.operationalRwaMinor !== 0) {
    console.error(
      `FINDING: RwaComputed ${ev.event_id} (period ${periodId}) operational RWA must be the flagged placeholder (operationalRwaIsPlaceholder=true, operationalRwaMinor=0); got isPlaceholder=${p.operationalRwaIsPlaceholder}, minor=${p.operationalRwaMinor}. Op-RWA is gross-income-blocked until licence-day and must NOT be fabricated.`,
    );
    findings++;
  }

  // 3. internal consistency.
  const credit = p.creditRwaMinor ?? 0;
  const market = p.marketRwaMinor ?? 0;
  const operational = p.operationalRwaMinor ?? 0;
  const total = p.totalRwaMinor ?? -1;
  if (total !== credit + market + operational) {
    console.error(
      `FINDING: RwaComputed ${ev.event_id} (period ${periodId}) total ${total} != credit ${credit} + market ${market} + operational ${operational}.`,
    );
    findings++;
  }

  // 4. BA 700 threads the RwaComputed event_id for the period.
  try {
    const reportingDate = ev.as_of;
    const { rawOutput } = generateBA700Return({
      entityId: ev.entity,
      reportingDate,
      periodId,
      functionalCurrency: p.functionalCurrency ?? "ZAR",
      eventStore,
      periodStart: reportingDate,
      periodEnd: reportingDate,
    });
    if (rawOutput.rwa.rwaComputationEventId !== ev.event_id) {
      console.error(
        `FINDING: BA 700 return for period ${periodId} threads rwaComputationEventId='${rawOutput.rwa.rwaComputationEventId}', expected the RwaComputed event_id '${ev.event_id}' — chain-of-custody broken (Principle 1).`,
      );
      findings++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `FINDING: BA 700 generation for period ${periodId} threw while asserting RwaComputed threading: ${msg}`,
    );
    findings++;
  }
}

console.log(
  `rwa-computed-sourcing: ${asserted} RwaComputed event(s) checked, ${findings} finding(s)`,
);
process.exit(findings > 0 ? 1 : 0);
