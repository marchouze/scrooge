// scenarios/02-onboard-counterparty.ts
//
// End-to-end synthetic onboarding of an institutional counterparty under
// the build-only posture. Stages 1–6 + documentation flow run; stage 7
// (activation) is intentionally NOT reached during the build phase — it is
// the licence-day configuration switch.
//
// Author: Niko

import { unlinkSync } from "node:fs";

import { EventStore } from "@platform/event-store/store";
import { logger } from "@platform/observability/logger";
import { LocalProjector } from "@platform/projections";

import type { PartyId } from "@domains/party";
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

const dbPath = ".local/scenario-onboard.db";
try {
  unlinkSync(dbPath);
} catch {
  /* first run */
}

const store = new EventStore(dbPath);

const cpId = counterpartyId("CP-SYN-0001");
const human = { type: "human" as const, id: "niko@bank.local" };
const compliance = { type: "human" as const, id: "mira@bank.local" };
const sales = { type: "human" as const, id: "saskia@bank.local" };

// 1. Sounding
store.append(
  soundingOpened(
    { counterpartyId: cpId, channel: "introduction", introSource: "industry-conference" },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// 2. Prospect registration
store.append(
  prospectRegistered(
    {
      counterpartyId: cpId,
      legalName: "Synthetic Capital Holdings (Pty) Ltd",
      jurisdiction: "ZA",
      sector: "non-bank-financial-institution",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// 3. Tier-1 KYC
store.append(
  kycCompleted(
    {
      counterpartyId: cpId,
      tier: "Tier-1",
      pep: false,
      sanctionsClear: true,
      jurisdictionalRiskScore: "low",
      // Synthetic fixture: legacy string cast to PartyId. D-PARTY-REGISTER PR 2
      // backfill will supply a proper urn:party:natural-person:... URN.
      reviewerId: "mira@bank.local" as PartyId,
    },
    { actor: compliance, citations: ["FIC-S21", "FIC-GN7-RBA"] },
  ),
);

// 4. Documentation programme
for (const at of ["ISDA", "CSA"] as const) {
  store.append(
    documentationDrafted(
      { counterpartyId: cpId, agreementType: at, version: "2002-2016" },
      { actor: human, citations: ["ISDA-MASTER-2002"] },
    ),
  );
  store.append(
    documentationReadyToExecute(
      {
        counterpartyId: cpId,
        agreementType: at,
        version: "2002-2016",
        packageHash: `synthetic-hash-${at}`,
      },
      { actor: human, citations: ["ISDA-MASTER-2002"] },
    ),
  );
}

// 5. Authorised signatories
store.append(
  authorisedSignatoryAdded(
    {
      counterpartyId: cpId,
      // Synthetic fixture: legacy string cast to PartyId. D-PARTY-REGISTER PR 2
      // backfill will supply a proper urn:party:natural-person:... URN.
      personId: "person-001" as PartyId,
      scope: "signatory",
      evidenceRef: "synthetic-resolution-001",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);
store.append(
  authorisedSignatoryAdded(
    {
      counterpartyId: cpId,
      // Synthetic fixture: legacy string cast to PartyId. D-PARTY-REGISTER PR 2
      // backfill will supply a proper urn:party:natural-person:... URN.
      personId: "person-002" as PartyId,
      scope: "authorised-trader",
      evidenceRef: "synthetic-resolution-002",
    },
    { actor: human, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
  ),
);

// 6. Mandate assignment (within Helena's RAS envelope; Saskia signs)
store.append(
  mandateAssigned(
    {
      counterpartyId: cpId,
      products: ["JSE-bonds", "OTC-IRS-ZAR"],
      limits: { ccr_eepe_zar: 50_000_000_00 }, // R50m EEPE in cents
      rasReference: "RAS-2026-CCR-INSTITUTIONAL",
    },
    { actor: sales, citations: ["RAS-2026", "COUNTERPARTY-CREDIT-POLICY"] },
  ),
);

// 7. Activation — DELIBERATELY OMITTED under build-only posture.

// Project final state
const projector = new LocalProjector(store);
const master = projector.build(counterpartyMaster);
const isda = projector.build(isdaTracker);
const sig = projector.build(signatoryBook);

const cp = master[cpId];
const isdaStatus = isda[`${cpId}::ISDA`];
const csaStatus = isda[`${cpId}::CSA`];
const sigCount = sig[cpId]?.length ?? 0;

store.close();
unlinkSync(dbPath);

const ok =
  cp?.status === "MandateAssigned" &&
  cp?.currentTier === "Tier-1" &&
  isdaStatus === "ReadyToExecute" &&
  csaStatus === "ReadyToExecute" &&
  sigCount === 2;

logger.info(
  {
    counterparty: cp,
    isdaStatus,
    csaStatus,
    signatoryCount: sigCount,
    ok,
  },
  ok ? "Onboarding scenario passed" : "Onboarding scenario failed",
);

process.exit(ok ? 0 : 1);
