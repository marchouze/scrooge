// scripts/register-sim-fx-counterparty-identity.ts
//
// Build-phase fixture identity-of-record for the FX counterparty-identity
// pre-trade gate (D-FX-HELD-DIMS-SEAT-SWEEP). For every authorised FX
// counterparty that has a build-phase netting set (ISDACSAAssessmentCompleted)
// and/or live FX trades, emits the two events the FAIL-CLOSED identity gateway
// check requires so the RFQ path still functions in build phase:
//
//   1. CounterpartyEligibilityScreened{outcome:"institutional-eligible"}
//      — the party-of-record (onboarding-existence) anchor.
//   2. SanctionsClearancePassed
//      — the KYC / CDD-and-sanctions acceptance of record (FIC Act 38/2001
//        s.21B/s.28A).
//
// These are SIMULATED onboarding records (build-phase-fixture provenance) — the
// identity counterpart of the simulated netting sets and simulated legal
// signings, NOT a production KYC claim. Real institutional onboarding (full
// Niko 21-phase lifecycle with hashed CDD evidence) replaces these at
// licence-day — tracked deferred gap `fx-real-counterparty-onboarding`, owner
// Niko (Client lifecycle, sales). The legacy customer onboarding terminal
// event (`ClientAccepted`) is the alternative KYC-acceptance anchor the gate
// also recognises.
//
// Idempotent: skips counterparties that already pass the identity check.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/register-sim-fx-counterparty-identity.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-SA-CCR-BUILD-PHASE-ACTIVATION; FIC-ACT-38-2001; FAIS-ACT-37-2002.
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  makeCounterpartyEligibilityScreened,
  makeSanctionsClearancePassed,
} from "../platform/event-store/event-types";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { checkCounterpartyIdentityOfRecord } from "../platform/markets/identity/counterparty-identity-gate";
import { logger } from "../platform/observability/logger";

const AS_OF = "2026-06-12T06:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";

// Population: the authorised FX counterparties — every counterparty with a
// build-phase netting set and every counterparty on the live FX book (the same
// population register-sim-fx-legal-documentation.ts derives its signings from).
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
  if (checkCounterpartyIdentityOfRecord(eventStore, counterpartyId).ok) {
    skipped++;
    continue;
  }
  const provenance = buildPhaseFixtureTag({
    sourceLineage: "script:register-sim-fx-counterparty-identity",
    variant: `identity:${counterpartyId}`,
    tags: ["counterparty-identity", "kyc-acceptance", "build-phase-fixture"],
  });
  eventStore.append({
    ...makeCounterpartyEligibilityScreened({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service", id: "agent:niko:counterparty-lifecycle" },
      citations: ["D-FX-HELD-DIMS-SEAT-SWEEP", "FAIS-ACT-37-2002"],
      payload: {
        counterpartyId,
        screeningId: `cp-eligibility:${counterpartyId}:2026-06-12`,
        criteria: ["SARB/foreign-regulator-licensed institution (SIMULATED build-phase fixture)"],
        outcome: "institutional-eligible",
        evidenceRefs: ["sim-onboarding-fixture"],
        asOf: AS_OF,
      },
    }),
    provenance,
  });
  eventStore.append({
    ...makeSanctionsClearancePassed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service", id: "agent:zara:mlro" },
      citations: ["D-FX-HELD-DIMS-SEAT-SWEEP", "FIC-ACT-38-2001"],
      payload: {
        counterpartyId,
        screeningProvider: "sim-screening-provider (build-phase fixture)",
        screeningRef: `sanctions-clearance:${counterpartyId}:2026-06-12`,
        clearedAt: AS_OF,
        screenedBy: "agent:zara:mlro",
      },
    }),
    provenance,
  });
  registered++;
}

logger.info(
  { registered, skipped, population: counterparties.size, at: clock.now() },
  "registered sim FX counterparty identity-of-record (build-phase-fixture; NOT a production KYC claim)",
);
process.exit(0);
