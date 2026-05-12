// scenarios/05-rehearsal-market-maker.ts
//
// Rehearsal scenario — Volta Market Making (Pty) Ltd.
// Counterparty: CP-SYN-MM-001, sector: market-maker, jurisdiction: ZA.
// Target phase: "offboarded" — walks to cdd-initiated then offboards (simulate
// failed KYC / compliance rejection). Demonstrates the offboarded terminal state.
//
// Authority chain (Principle 2 upward):
//   D-PARTY-REGISTER (CEO-approved 2026-05-11)
//   AML-CFT-POLICY-V1 (PR #261) — KYC/AML gate obligations
//   FIC-ACT-38-2001 — Financial Intelligence Centre Act; KYC/CDD statutory root
//   INTERNAL-COUNTERPARTY-ONBOARDING-POLICY — sounding / prospect gate
//
// Author: Niko (Client lifecycle engineer, engineering)

import { unlinkSync } from "node:fs";

import { EventStore } from "@platform/event-store/store";
import { logger } from "@platform/observability/logger";
import { LocalProjector } from "@platform/projections";

import {
  counterpartyId,
  counterpartyMaster,
  counterpartyOffboarded,
  kycCompleted,
  prospectRegistered,
  soundingOpened,
} from "@domains/customer";
import type { PartyId } from "@domains/party";

const dbPath = ".local/scenario-rehearsal-mm.db";
try {
  unlinkSync(dbPath);
} catch {
  /* first run */
}

const store = new EventStore(dbPath);

const cpId = counterpartyId("CP-SYN-MM-001");
const human = { type: "human" as const, id: "niko@bank.local" };
const compliance = { type: "human" as const, id: "mira@bank.local" };

// Phase: sounding
store.append(
  soundingOpened(
    {
      counterpartyId: cpId,
      channel: "inbound",
      introSource: "direct-approach",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// Phase: prospect-registered
store.append(
  prospectRegistered(
    {
      counterpartyId: cpId,
      legalName: "Volta Market Making (Pty) Ltd",
      jurisdiction: "ZA",
      sector: "market-maker",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// Phase: cdd-initiated (via KycCompleted — Slice 1 simplification;
// Slice 2 will add a dedicated CddCompleted event; authority: AML-CFT-POLICY-V1)
// NOTE: KYC passed at this stage; offboarding occurs due to adverse media finding
// discovered during extended due diligence after initial KYC clearance.
store.append(
  kycCompleted(
    {
      counterpartyId: cpId,
      tier: "Tier-1",
      pep: false,
      sanctionsClear: true,
      jurisdictionalRiskScore: "low",
      // Synthetic fixture: legacy string cast to PartyId. D-PARTY-REGISTER PR 4
      // backfill will supply a proper urn:party:natural-person:... URN.
      reviewerId: "mira@bank.local" as PartyId,
    },
    { actor: compliance, citations: ["AML-CFT-POLICY-V1", "FIC-ACT-38-2001"] },
  ),
);

// Terminal phase: offboarded — KYC failed (adverse media finding)
store.append(
  counterpartyOffboarded(
    {
      counterpartyId: cpId,
      reason: "KYC failed — adverse media finding",
    },
    { actor: compliance, citations: ["AML-CFT-POLICY-V1", "FIC-ACT-38-2001"] },
  ),
);

// Project final state
const projector = new LocalProjector(store);
const master = projector.build(counterpartyMaster);

const cp = master[cpId];

store.close();
unlinkSync(dbPath);

const ok = cp?.status === "Offboarded" && cp?.currentTier === "Tier-1";

const summary = {
  counterpartyId: cpId,
  legalName: cp?.legalName,
  sector: cp?.sector,
  targetPhase: "offboarded",
  finalStatus: cp?.status,
  eventCount: 4,
  ok,
};

logger.info(summary, ok ? "Rehearsal MM scenario passed" : "Rehearsal MM scenario failed");

// biome-ignore lint/suspicious/noConsole: scenario summary is intentional
console.log(
  `\n✓ CP-SYN-MM-001 (Volta Market Making) → target phase: offboarded | events: 4 | status: ${cp?.status}\n`,
);

process.exit(ok ? 0 : 1);
