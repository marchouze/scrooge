// scripts/register-sim-fx-legal-documentation.ts
//
// Build-phase fixture signings for the FX legal-documentation pre-trade gate
// (D-FX-HELD-DIMS-SEAT-SWEEP). For every authorised FX counterparty that has a
// build-phase netting set (ISDACSAAssessmentCompleted, isdaStatus "executed",
// registered by scripts/register-sim-fx-netting-sets.ts under
// D-FX-SA-CCR-BUILD-PHASE-ACTIVATION) and/or live FX trades, emits the
// matching `LegalDocumentationSigned{agreementType:"isda-2002"}` event so the
// FAIL-CLOSED documentation gateway check has data and the RFQ path still
// functions in build phase.
//
// These are SIMULATED executions (build-phase-fixture provenance) — the
// documentary counterpart of the simulated netting sets, NOT a production
// legal claim. Real ISDA Master executions (with doc-store documentHash)
// replace these at licence-day counterparty legal onboarding — tracked
// deferred gap `fx-real-isda-execution`, owner Imani (Legal-as-code engineer,
// engineering). csaPresent stays FALSE: no CSA margining substrate exists yet
// (tracked deferred gap `fx-csa-margin-mechanics`; Imani G-9 §3).
//
// Idempotent: skips counterparties that already have a qualifying
// LegalDocumentationSigned of record.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/register-sim-fx-legal-documentation.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//            D-FX-SA-CCR-BUILD-PHASE-ACTIVATION; ORG-CS3-001.
// Author: Imani (Legal-as-code engineer, engineering) — governance owner
//         Devon (COO, interim, pending future GC).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { makeLegalDocumentationSigned } from "../platform/event-store/event-types/legal-documentation";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { checkLegalDocumentationOfRecord } from "../platform/markets/legal/legal-documentation-gate";
import { logger } from "../platform/observability/logger";

const AS_OF = "2026-06-12T06:00:00.000Z";
const SIGNED_DATE = "2026-06-12";
const ENTITY = "LE-ZA-HOZ-BANK";

// Population: the authorised FX counterparties — every counterparty with a
// build-phase netting set and every counterparty on the live FX book (the
// same population register-sim-fx-netting-sets.ts derived its sets from).
const counterparties = new Set<string>();
for (const ev of eventStore.replay({ type: "ISDACSAAssessmentCompleted" })) {
  const p = ev.payload as { counterpartyId?: string };
  if (p.counterpartyId) counterparties.add(p.counterpartyId);
}
for (const ev of eventStore.replay({ type: "FxTradeExecuted" })) {
  const p = ev.payload as { counterparty?: { partyId?: string } };
  if (p.counterparty?.partyId) counterparties.add(p.counterparty.partyId);
}

let registered = 0;
let skipped = 0;
for (const counterpartyId of [...counterparties].sort()) {
  if (checkLegalDocumentationOfRecord(eventStore, counterpartyId).ok) {
    skipped++;
    continue;
  }
  eventStore.append({
    ...makeLegalDocumentationSigned({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service", id: "agent:imani:legal" },
      citations: ["D-FX-HELD-DIMS-SEAT-SWEEP", "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION", "ORG-CS3-001"],
      payload: {
        counterpartyId,
        agreementType: "isda-2002",
        version: "2002-MA + SA Schedule (SIMULATED build-phase fixture)",
        signedDate: SIGNED_DATE,
        // documentHash omitted — permitted during the build phase (schema);
        // required from commencement-of-trading (fx-real-isda-execution gap).
        csaPresent: false,
        nettingEnforceable: true,
      },
    }),
    provenance: buildPhaseFixtureTag({
      sourceLineage: "script:register-sim-fx-legal-documentation",
      variant: `legal-doc:${counterpartyId}:isda-2002`,
      tags: ["legal-documentation", "isda-master", "build-phase-fixture"],
    }),
  });
  registered++;
}

logger.info(
  { registered, skipped, population: counterparties.size, at: clock.now() },
  "registered sim FX legal documentation signings (build-phase-fixture; NOT a production legal claim)",
);
process.exit(0);
