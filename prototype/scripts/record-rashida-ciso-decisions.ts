// prototype/scripts/record-rashida-ciso-decisions.ts
//
// Operationalise Rashida (CISO)'s first own-authority Decision event.
// Authority: brief:owen:first-ciso-cae-own-authority-decision-events-ope:2026-05-18
//
// Run once from prototype/: bun run scripts/record-rashida-ciso-decisions.ts
// This script stays in the repo as an audit record.

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-CISO-NEON-EVENT-STORE-EXCEPTION-001",
    phase: "approved",
    authority: "CISO",
    authorityRef: "rashida@bank",
    title: "CISO approval: Neon event-store build-phase exception TM-NEON-EVENT-STORE-001",
    category: "risk",
    recommendation:
      "Approve Neon Postgres as the shared event store for the build phase under exception TM-NEON-EVENT-STORE-001, pending §5.1 role downgrade and §5.2 IP allowlist before any sensitive-data event flows.",
    rationale:
      "Senna's threat model (approved) identified two hardening conditions. Until those land, only non-sensitive events flow. The risk is accepted and tracked as a substrate gap.",
    sourceDocHashes: [],
    citations: ["TM-NEON-EVENT-STORE-001"],
    recordedVia: "agent:autonomous",
  },
  clock.now(),
);
