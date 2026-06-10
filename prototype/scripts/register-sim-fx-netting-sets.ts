// scripts/register-sim-fx-netting-sets.ts
//
// Build-phase-sim activation (D-FX-SA-CCR-BUILD-PHASE-ACTIVATION, CEO-approved):
// registers a ZAR netting set per counterparty that has live FX trades, by
// emitting build-phase-fixture ISDACSAAssessmentCompleted events. This is a
// SIMULATED netting-enforceability assertion for end-to-end build-phase testing
// of the SA-CCR → CreditRWA path — NOT a production legal claim. Real ISDA/CSA
// execution + jurisdiction netting-enforceability opinions replace these at
// licence-day (legal/Imani).
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/register-sim-fx-netting-sets.ts
// Authority: D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL; D-CREDIT-LIMIT-ENGINE-BUILD Phase 5.

import { clock, eventStore } from "../platform/composition";
import { makeISDACSAAssessmentCompleted } from "../platform/event-store/event-types/credit-limit";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { resolveNettingSet } from "../platform/markets/netting-sets";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-11T00:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";

recordDecision(
  {
    decisionId: "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Build-phase-sim activation of SA-CCR for FX (simulated netting sets)",
    category: "risk",
    recommendation:
      "Register build-phase-fixture ZAR netting sets (ISDACSAAssessmentCompleted, nettingEnforceable=true) per live-FX counterparty so SA-CCR runs end-to-end in build-phase and FX counterparty credit RWA flows via D-FX-CCR-INTERIM-CONSERVATIVE-RWA. These are SIMULATED netting-enforceability assertions (build-phase-fixture provenance), NOT production legal claims; real ISDA/CSA + opinions (legal/Imani) replace them at licence-day.",
    rationale:
      "Consistent with the existing sim-trade / sim-counterparty substrate. Unblocks the SA-CCR emission gap so the credit-limit gate and the interim CreditRWA wiring stop being inert in build-phase.",
    citations: ["D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL", "D-FX-CCR-INTERIM-CONSERVATIVE-RWA"],
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

const counterparties = new Set<string>();
for (const ev of eventStore.replay({ type: "FxTradeExecuted" })) {
  const p = ev.payload as { counterparty?: { partyId?: string } };
  if (p.counterparty?.partyId) counterparties.add(p.counterparty.partyId);
}

let registered = 0;
let skipped = 0;
for (const counterpartyId of counterparties) {
  if (resolveNettingSet(counterpartyId, "ZAR", AS_OF)) {
    skipped++;
    continue;
  }
  eventStore.append({
    ...makeISDACSAAssessmentCompleted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service", id: "agent:imani:legal" },
      citations: ["D-FX-SA-CCR-BUILD-PHASE-ACTIVATION", "D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL"],
      payload: {
        counterpartyId,
        isdaStatus: "executed",
        csaThreshold: 0,
        mta: 0,
        currency: "ZAR",
        nettingEnforceable: true,
        assessedBy: "agent:imani:legal (build-phase-fixture)",
        assessedAt: AS_OF,
      },
    }),
    provenance: buildPhaseFixtureTag({
      sourceLineage: "script:register-sim-fx-netting-sets",
      variant: `netting-set:${counterpartyId}:ZAR`,
      tags: ["sa-ccr", "netting-set", "build-phase-fixture"],
    }),
  });
  registered++;
}

logger.info(
  { registered, skipped, at: clock.now() },
  "registered sim FX netting sets (build-phase-fixture)",
);
process.exit(0);
