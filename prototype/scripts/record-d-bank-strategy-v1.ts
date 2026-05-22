// scripts/record-d-bank-strategy-v1.ts
//
// Emit the D-BANK-STRATEGY-V1 decision request:
//   - CEO review and approval of the inaugural Hoz Bank institutional strategy
//   - Document: Policies/bank-strategy-v1.md (DocumentRegistered 2026-05-22)
//
// Idempotent: skips if 'requested' phase already in the register.
//
// How to run (from prototype/):
//   bun run scripts/record-d-bank-strategy-v1.ts
//
// Author: Scrooge (Chief of Staff, orchestration)

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(decisionId: string, phase: string): boolean {
  const history = register.byId.get(decisionId);
  if (!history) return false;
  return history.events.some((e) => e.phase === phase);
}

if (hasPhase("D-BANK-STRATEGY-V1", "requested")) {
  console.log(
    JSON.stringify({ level: "info", msg: "D-BANK-STRATEGY-V1: already requested — skip" }),
  );
} else {
  recordDecision(
    {
      decisionId: "D-BANK-STRATEGY-V1",
      phase: "requested",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "Inaugural Hoz Bank institutional strategy v1 — CEO approval",
      category: "governance",
      recommendation:
        "Approve the inaugural Hoz Bank institutional strategy v1 as filed at Policies/bank-strategy-v1.md. The strategy covers vision, business model, capital structure (R300m CET1), product scope (JSE bonds/equities + OTC IRD + FX), AI-native operating model, regulatory/licensing pathway, risk appetite framework, and build-phase milestones.",
      rationale:
        "The bank has operated through the build phase without a formally approved strategy document. Policies, procedures, the trading mandate, the RAS, and the capital plan are all live — but the governing strategic intent that ties them together has not been CEO-approved as a single artefact. This decision approves that artefact, making the bank's direction explicit and citable across all downstream governance work. The document was synthesised by Scrooge from inputs across Helena (RAS/capital), Camille (capital plan), Devon (operating model), Saskia (trading mandate), Owen (governance), Zara (compliance), and Eitan (treasury). It is consistent with all approved policies and decisions currently on the register.",
      sourceDocHashes: ["blake3:50b835073c022e229bcec0fbf69b602c34e426952f9d70b8135d599cd9b24059"],
      citations: [
        "D-RAS",
        "D-MARKETS-CAPITAL-TIME-SHAPE",
        "D-TRADE-LIFECYCLE-IFRS-CHAIN",
        "D-KYC-ONBOARDING-BUILD",
        "D-THIN-HUMAN-LAYER-MINIMUM",
        "D-POLICY-DOCUMENT-HOME",
      ],
      recordedVia: "agent:autonomous",
    },
    clock.now(),
  );
  console.log(
    JSON.stringify({
      level: "info",
      msg: "D-BANK-STRATEGY-V1: decision requested — added to open log",
    }),
  );
}

console.log(JSON.stringify({ level: "info", msg: "record-d-bank-strategy-v1: complete" }));
