// scenarios/03-rehearsal-asset-manager.ts
//
// Rehearsal scenario — Helios Asset Management (Pty) Ltd.
// Counterparty: CP-SYN-AM-001, sector: asset-manager, jurisdiction: ZA.
// Target terminal phase: "activated" — walks every reachable Slice-1 phase in
// sequence:
//   sounding → prospect-registered → cdd-initiated (via KycCompleted)
//   → documentation-drafted → documentation-ready → signatories-registered
//   → mandate-assigned → activated
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
  counterpartyActivated,
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

const dbPath = ".local/scenario-rehearsal-am.db";
try {
  unlinkSync(dbPath);
} catch {
  /* first run */
}

const store = new EventStore(dbPath);

const cpId = counterpartyId("CP-SYN-AM-001");
const human = { type: "human" as const, id: "niko@bank.local" };
const compliance = { type: "human" as const, id: "mira@bank.local" };

// Phase: sounding
store.append(
  soundingOpened(
    {
      counterpartyId: cpId,
      channel: "introduction",
      introSource: "institutional-asset-management-conference",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// Phase: prospect-registered
store.append(
  prospectRegistered(
    {
      counterpartyId: cpId,
      legalName: "Helios Asset Management (Pty) Ltd",
      jurisdiction: "ZA",
      sector: "asset-manager",
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
      packageHash: "synthetic-hash-ISDA-helios-001",
    },
    { actor: human, citations: ["ISDA-MASTER-2002"] },
  ),
);

// Phase: signatories-registered
store.append(
  authorisedSignatoryAdded(
    {
      counterpartyId: cpId,
      // Synthetic fixture: legacy string cast to PartyId. D-PARTY-REGISTER PR 4
      // backfill will supply a proper urn:party:natural-person:... URN.
      personId: "SYN-PERSON-AM-001" as PartyId,
      scope: "both",
      evidenceRef: "REHEARSAL-KYC-REF",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// Phase: mandate-assigned
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

// Phase: activated
store.append(
  counterpartyActivated(
    {
      counterpartyId: cpId,
      configSwitchEventId: "REHEARSAL-CONFIG-SWITCH-001",
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
  cp?.status === "Active" &&
  cp?.currentTier === "Tier-1" &&
  isdaStatus === "Executed" &&
  sigCount === 1;

const summary = {
  counterpartyId: cpId,
  legalName: cp?.legalName,
  sector: cp?.sector,
  targetPhase: "activated",
  finalStatus: cp?.status,
  isdaStatus,
  signatoryCount: sigCount,
  eventCount: 8,
  ok,
};

logger.info(summary, ok ? "Rehearsal AM scenario passed" : "Rehearsal AM scenario failed");

console.log(
  `\n✓ CP-SYN-AM-001 (Helios Asset Management) → target phase: activated | events: 8 | status: ${cp?.status}\n`,
);

process.exit(ok ? 0 : 1);
