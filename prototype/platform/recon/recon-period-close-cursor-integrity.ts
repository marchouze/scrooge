// platform/recon/recon-period-close-cursor-integrity.ts
//
// Asserts that all AccountingPeriodClosed events carry an eventSequence field.
// Once all emitter call-sites are wired (D-DATA-QUALITY-CROSS-DOMAIN-V1),
// events without eventSequence are a finding.
//
// Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";

const events = eventStore.replay({ type: "AccountingPeriodClosed" });
let checked = 0;
let findings = 0;

for (const ev of events) {
  checked++;
  const payload = ev.payload as { eventSequence?: unknown; periodId?: unknown; period?: unknown };
  if (payload.eventSequence == null) {
    console.error(
      `FINDING: AccountingPeriodClosed ${ev.event_id} (period ${payload.periodId ?? payload.period ?? "?"}) missing eventSequence`,
    );
    findings++;
  }
}

console.log(`period-close-cursor-integrity: ${checked} events checked, ${findings} findings`);
process.exit(findings > 0 ? 1 : 0);
