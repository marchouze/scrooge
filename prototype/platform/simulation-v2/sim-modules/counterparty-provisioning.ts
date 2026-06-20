// platform/simulation-v2/sim-modules/counterparty-provisioning.ts
//
// M2 — counterparty provisioning seam (SIMULATOR side). Stands up a scenario
// counterparty + its ISDA/CSA agreement FROM THE MANIFEST (not ad-hoc seed
// events). This module emits ONLY the EXTERNAL party's side of the clean Niko
// lifecycle:
//
//   sounding → prospect (implied) → KYC documents → mandate accepted →
//   ISDA/CSA agreement accepted
//
// Each step is an external-party fact tagged `simulated`, born V2, scenario-
// bound. The bank's OWN onboarding / KYC-clearance / ISDA-CSA election + netting-
// set readiness is SUT-internal and lives OUTSIDE this package, in
// platform/markets/counterparty/provision-counterparty.ts. The simulator↔SUT
// boundary gate forbids this module from emitting the SUT-internal election
// events (IsdaCsaElected etc.).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20). Every new event
// born V2 — never v1-only (D-V1-REMOVAL-PHASE-1).
// Author: Atlas (Core banking platform architect, engineering).

import {
  makeCounterpartyAgreementAccepted,
  makeCounterpartyKycDocumentsSubmitted,
  makeCounterpartyMandateAccepted,
  makeCounterpartySoundingMade,
} from "../../event-store/event-types/counterparty-provisioning";
import { simulatedTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { ScenarioCounterparty } from "../scenario-manifest";

const ENTITY = "LE-ZA-HOZ-BANK";
const SIM_ACTOR = { type: "service" as const, id: "agent:env:counterparty-provisioning-sim" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

function simProvenance(scenarioId: string) {
  return simulatedTag({
    scenario: scenarioId,
    sourceLineage: "simulation-v2:counterparty-provisioning",
  });
}

/** Standard KYC document pack a provisioning counterparty submits. */
const KYC_DOCUMENT_PACK = [
  "constitutional-documents",
  "lei-confirmation",
  "ultimate-beneficial-owner-register",
  "authorised-signatory-list",
] as const;

/**
 * SIMULATOR — emit the external counterparty's full provisioning lifecycle for
 * `cp`: sounding, KYC document submission, mandate acceptance, and (when the
 * manifest declares an agreement) ISDA/CSA agreement acceptance. The bank's SUT
 * recording is a separate step (provision-counterparty.ts). Idempotent on the
 * deterministic per-step event ids.
 *
 * Returns the terminal lifecycle event type reached.
 */
export function emitCounterpartyProvisioning(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly counterparty: ScenarioCounterparty;
  /** Reporting/base currency the dealing mandate covers. */
  readonly reporting: string;
}): "CounterpartyMandateAccepted" | "CounterpartyAgreementAccepted" {
  const { store, scenarioId, asOf, counterparty, reporting } = args;
  const provenance = simProvenance(scenarioId);
  const cpId = counterparty.counterpartyId;

  // 1. Sounding — the counterparty expresses dealing interest (implies prospect).
  store.append(
    makeCounterpartySoundingMade({
      asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: cpId,
        name: counterparty.name,
        bic: counterparty.bic,
        eligiblePairs: [...counterparty.eligiblePairs],
      },
      eventId: `${scenarioId}:${cpId}:sounding`,
      provenance,
    }),
  );

  // 2. KYC documents — the counterparty submits its KYC pack.
  store.append(
    makeCounterpartyKycDocumentsSubmitted({
      asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      payload: { counterpartyId: cpId, documents: [...KYC_DOCUMENT_PACK] },
      eventId: `${scenarioId}:${cpId}:kyc-submitted`,
      provenance,
    }),
  );

  // 3. Mandate — the counterparty accepts the dealing mandate.
  store.append(
    makeCounterpartyMandateAccepted({
      asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      payload: { counterpartyId: cpId, baseCurrency: reporting },
      eventId: `${scenarioId}:${cpId}:mandate-accepted`,
      provenance,
    }),
  );

  // 4. Agreement — the counterparty accepts the ISDA/CSA terms (when declared).
  const agreement = counterparty.agreement;
  if (agreement) {
    store.append(
      makeCounterpartyAgreementAccepted({
        asOf,
        entity: ENTITY,
        actor: SIM_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: cpId,
          agreementType: agreement.agreementType,
          csaInScope: agreement.csaInScope,
          ...(agreement.csaInScope
            ? { csaCurrency: agreement.csaCurrency ?? reporting }
            : {}),
        },
        eventId: `${scenarioId}:${cpId}:agreement-accepted`,
        provenance,
      }),
    );
    return "CounterpartyAgreementAccepted";
  }
  return "CounterpartyMandateAccepted";
}
