// scenarios/04-rehearsal-hedge-fund.ts
//
// Rehearsal scenario — Meridian Opportunities Fund (RF) (Pty) Ltd.
// Counterparty: CP-SYN-HF-001, sector: hedge-fund, jurisdiction: ZA.
// Target phase: "mandate-assigned" — walks to mandate-assigned then stops
// (not yet activated). Demonstrates an in-progress counterparty.
//
// Authority chain (Principle 2 upward):
//   D-PARTY-REGISTER (CEO-approved 2026-05-11)
//   AML-CFT-POLICY-V1 (PR #261) — KYC/AML gate obligations
//   FIC-ACT-38-2001 — Financial Intelligence Centre Act; KYC/CDD statutory root
//   TRADING-MANDATE-V1 (PR #256) — mandate gate obligations
//   INTERNAL-COUNTERPARTY-ONBOARDING-POLICY — sounding / prospect gate
//
// Author: Niko (Client lifecycle engineer, engineering)

import { unlinkSync } from "node:fs";

import { EventStore } from "@platform/event-store/store";
import { logger } from "@platform/observability/logger";
import { LocalProjector } from "@platform/projections";

import {
  authorisedSignatoryAdded,
  counterpartyId,
  counterpartyMaster,
  documentationDrafted,
  documentationReadyToExecute,
  isdaTracker,
  kycCompleted,
  mandateAssigned,
  prospectRegistered,
  signatoryBook,
  soundingOpened,
} from "@domains/customer";
import type { PartyId } from "@domains/party";

const dbPath = ".local/scenario-rehearsal-hf.db";
try {
  unlinkSync(dbPath);
} catch {
  /* first run */
}

const store = new EventStore(dbPath);

const cpId = counterpartyId("CP-SYN-HF-001");
const human = { type: "human" as const, id: "niko@bank.local" };
const compliance = { type: "human" as const, id: "mira@bank.local" };

// Phase: sounding
store.append(
  soundingOpened(
    {
      counterpartyId: cpId,
      channel: "outbound",
      introSource: "prime-brokerage-referral",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// Phase: prospect-registered
store.append(
  prospectRegistered(
    {
      counterpartyId: cpId,
      legalName: "Meridian Opportunities Fund (RF) (Pty) Ltd",
      jurisdiction: "ZA",
      sector: "hedge-fund",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// Phase: cdd-initiated (via KycCompleted — Slice 1 simplification;
// Slice 2 will add a dedicated CddCompleted event; authority: AML-CFT-POLICY-V1)
store.append(
  kycCompleted(
    {
      counterpartyId: cpId,
      tier: "Tier-2",
      pep: false,
      sanctionsClear: true,
      jurisdictionalRiskScore: "medium",
      // Synthetic fixture URN — D-PARTY-REGISTER PR 4 tightening.
      reviewerId: "urn:party:natural-person:mira-compliance" as PartyId,
    },
    { actor: compliance, citations: ["AML-CFT-POLICY-V1", "FIC-ACT-38-2001"] },
  ),
);

// Phase: documentation-drafted
store.append(
  documentationDrafted(
    { counterpartyId: cpId, agreementType: "ISDA", version: "2002" },
    { actor: human, citations: ["ISDA-MASTER-2002"] },
  ),
);

// Phase: documentation-ready
store.append(
  documentationReadyToExecute(
    {
      counterpartyId: cpId,
      agreementType: "ISDA",
      version: "2002",
      packageHash: "synthetic-hash-ISDA-meridian-001",
    },
    { actor: human, citations: ["ISDA-MASTER-2002"] },
  ),
);

// Phase: signatories-registered
store.append(
  authorisedSignatoryAdded(
    {
      counterpartyId: cpId,
      // Synthetic fixture URN — D-PARTY-REGISTER PR 4 tightening.
      personId: "urn:party:natural-person:signatory-hf-001" as PartyId,
      scope: "both",
      evidenceRef: "REHEARSAL-KYC-REF",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// Phase: mandate-assigned — stops here; counterparty is in-progress (not yet activated)
store.append(
  mandateAssigned(
    {
      counterpartyId: cpId,
      products: ["ZAR-IRS", "ZAR-BOND"],
      limits: { "notional-cap": 50_000_000 },
      rasReference: "RAS-B01",
    },
    { actor: human, citations: ["TRADING-MANDATE-V1"] },
  ),
);

// Project final state
const projector = new LocalProjector(store);
const master = projector.build(counterpartyMaster);
const isda = projector.build(isdaTracker);
const sig = projector.build(signatoryBook);

const cp = master[cpId];
const isdaStatus = isda[`${cpId}::ISDA`];
const sigCount = sig[cpId]?.length ?? 0;

store.close();
unlinkSync(dbPath);

const ok =
  cp?.status === "MandateAssigned" &&
  cp?.currentTier === "Tier-2" &&
  isdaStatus === "ReadyToExecute" &&
  sigCount === 1;

const summary = {
  counterpartyId: cpId,
  legalName: cp?.legalName,
  sector: cp?.sector,
  targetPhase: "mandate-assigned",
  finalStatus: cp?.status,
  isdaStatus,
  signatoryCount: sigCount,
  eventCount: 7,
  ok,
};

logger.info(summary, ok ? "Rehearsal HF scenario passed" : "Rehearsal HF scenario failed");

console.log(
  `\n✓ CP-SYN-HF-001 (Meridian Opportunities Fund) → target phase: mandate-assigned | events: 7 | status: ${cp?.status}\n`,
);

process.exit(ok ? 0 : 1);
