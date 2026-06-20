// platform/markets/counterparty/provision-counterparty.ts
//
// SUT-side counterparty provisioning — M2 (WS-FX-V2-SIMULATOR).
//
// The BANK's OWN internal action: it onboards a counterparty for FX dealing once
// the external party has completed the provisioning lifecycle (mandate accepted,
// and ISDA/CSA agreement accepted when a master agreement is in scope). It records
// a `CounterpartyProvisioned` event carrying the stood-up per-currency netting
// set (NS-<counterpartyId>-<ccy>) so SA-CCR can net the counterparty's exposures
// in Phase 2.
//
// This lives on the SUT side (NOT in the simulator package — the simulator↔SUT
// boundary gate forbids the simulator from emitting `CounterpartyProvisioned`).
// Provisioning is GATED on the external lifecycle: a counterparty whose mandate
// the simulator has NOT recorded as accepted is not provisioned (fail-closed). A
// counterparty that declares a master agreement is provisioned only once the
// agreement acceptance is recorded too.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import { makeCounterpartyProvisioned } from "../../event-store/event-types/counterparty-provisioned";
import type { EventStore } from "../../event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";
const SUT_ACTOR = { type: "service" as const, id: "agent:sut:counterparty-onboarding" };

/** The provisioning detail the SUT step needs (subset of ScenarioCounterparty). */
export interface ProvisionableCounterparty {
  readonly counterpartyId: string;
  readonly agreement?: {
    readonly agreementType: "ISDA-2002" | "ISDA-1992";
    readonly csaInScope: boolean;
  };
}

/** The canonical per-currency netting-set id for a counterparty (feeds SA-CCR). */
export function nettingSetIdFor(counterpartyId: string, reporting: string): string {
  return `NS-${counterpartyId}-${reporting}`;
}

/**
 * Provision a counterparty on the SUT side. Reads the simulator's external
 * lifecycle from the store:
 *   - requires `CounterpartyMandateAccepted` for this counterparty; and
 *   - when the counterparty declares a master agreement, requires
 *     `CounterpartyAgreementAccepted` too.
 * If the gate is not met books NOTHING and returns false (fail-closed).
 * Idempotent — a re-provision is a no-op.
 *
 * Returns true iff a new `CounterpartyProvisioned` event was emitted.
 */
export function provisionCounterparty(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly reporting: string;
  readonly counterparty: ProvisionableCounterparty;
}): boolean {
  const { store, scenarioId, asOf, reporting, counterparty } = args;
  const cpId = counterparty.counterpartyId;

  // Gate 1: the counterparty's dealing mandate must be accepted (external fact).
  const mandateAccepted = [...store.replay({ type: "CounterpartyMandateAccepted" })].some(
    (e) => (e.payload as { counterpartyId?: string }).counterpartyId === cpId,
  );
  if (!mandateAccepted) return false;

  // Gate 2: when a master agreement is declared, its acceptance is required too.
  const wantsAgreement = counterparty.agreement !== undefined;
  if (wantsAgreement) {
    const agreementAccepted = [...store.replay({ type: "CounterpartyAgreementAccepted" })].some(
      (e) => (e.payload as { counterpartyId?: string }).counterpartyId === cpId,
    );
    if (!agreementAccepted) return false;
  }

  // Idempotency: already provisioned?
  const already = [...store.replay({ type: "CounterpartyProvisioned" })].some(
    (e) => (e.payload as { counterpartyId?: string }).counterpartyId === cpId,
  );
  if (already) return false;

  store.append(
    makeCounterpartyProvisioned({
      asOf,
      entity: ENTITY,
      actor: SUT_ACTOR,
      citations: ["D-FX-V2-SIMULATOR-FIRST"],
      eventId: `${scenarioId}:${cpId}:provisioned`,
      payload: {
        counterpartyId: cpId,
        baseCurrency: reporting,
        nettingSetId: nettingSetIdFor(cpId, reporting),
        masterAgreementElected: wantsAgreement,
        ...(counterparty.agreement
          ? { agreementType: counterparty.agreement.agreementType }
          : {}),
        csaInScope: counterparty.agreement?.csaInScope ?? false,
      },
    }),
  );
  return true;
}
