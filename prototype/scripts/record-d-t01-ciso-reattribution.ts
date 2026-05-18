// scripts/record-d-t01-ciso-reattribution.ts
//
// One-shot: emit a Decision(approved, authority:"CISO") event for
// D-T-01-PERMISSION-GATE-SECURE-DEFAULT, correcting the authority
// attribution from CEO to CISO (Rashida).
//
// Background: Owen's authority-gap brief (2026-05-17) identified
// D-T-01-PERMISSION-GATE-SECURE-DEFAULT as a CEO over-attribution.
// The cleanup script (cleanup-stale-open-decisions-2026-05-17.ts)
// withdrew the CEO-attributed event from the CEO queue. This script
// emits the canonical forward-looking CISO(approved) event,
// operationalising Rashida's authority surface per the brief §5
// recommendation: "no historical event amendment — re-attribute forward."
//
// Authority: Owen (Company Secretary, governance) — authority-gap
//   brief:owen:operationalise-decision-authority-routing-5-gove:2026-05-18
// Author: Owen (Company Secretary, governance)
//
// Run once; idempotent — checks whether a terminal Decision event for
// this ID already exists before appending.

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-T-01-PERMISSION-GATE-SECURE-DEFAULT";

function main(): number {
  // Idempotency check: skip if a terminal phase is already recorded.
  const source = decisionsSourceFromStore(eventStore);
  const register = buildDecisionsRegister(source);
  const existing = register.byId.get(DECISION_ID);

  if (existing) {
    const headPhase = existing.head?.phase;
    if (headPhase && headPhase !== "requested" && headPhase !== "open") {
      console.log(`[SKIP] ${DECISION_ID} already has terminal phase "${headPhase}" — skipping.`);
      return 0;
    }
  }

  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CISO",
      authorityRef: "rashida@bank",
      title: "T-01 permission-gate secure-default — CISO authority re-attribution",
      category: "engineering",
      recommendation:
        "Permission gate secure-default is a CISO-authority security architecture standard, not a CEO decision. The permission-gate enforce-by-default posture (all agent sub-calls denied unless an explicit PermissionPolicy grants access) is approved as the standing security standard under Rashida's CISO authority.",
      rationale:
        "Per Owen authority-gap brief 2026-05-17 §5: D-T-01-PERMISSION-GATE-SECURE-DEFAULT natural authority is CISO (Rashida). The CEO-attributed event was withdrawn from the CEO queue (cleanup-stale-open-decisions-2026-05-17.ts) per the authority-gap brief recommendation. This Decision(approved, authority:CISO) operationalises Rashida's authority surface for the security-architecture standard. Re-attributed forward per brief §4 recommendation (no historical event amendment). Authority operationalisation: brief:owen:operationalise-decision-authority-routing-5-gove:2026-05-18.",
      sourceDocHashes: [],
      citations: [
        "D-DECISIONS-FRAMEWORK-REDESIGN",
        "Owner Inbox/2026-05-17_owen_authority-gap-five-seats.md",
      ],
      recordedVia: "agent:autonomous",
      actor: { type: "service", id: "agent:owen" },
    },
    "2026-05-18T00:00:00.000Z",
  );

  console.log(`[OK] Decision(approved, authority:CISO) emitted for ${DECISION_ID}`);
  return 0;
}

process.exit(main());
