// platform/simulation-v2-live/onboarded-counterparty-source.ts
//
// LIVE-DRIVER counterparty source — resolves the V2LiveFxDriver's trading
// counterparties from the IN-SIM ONBOARDED client set (the born-V2 client-
// onboarding register), NOT from a hardcoded seed list.
//
// THE COHERENCE RULE (D-FX-V2-SIMULATOR-FIRST): a client of the simulated
// outside world exists ONLY by being onboarded through the KYC → activated
// flow, and is an eligible FX counterparty ONLY once it reaches the terminal
// `activated` phase with a BIC + FX-spot eligibility. No onboarding → no
// trading. This module reads that truth (simulated provenance only — the
// simulator deals with its OWN clients) and maps each onboarded FX counterparty
// onto the live driver's `ScenarioCounterparty` shape.
//
// FAIL-CLOSED: an empty onboarded set yields ZERO counterparties → the driver
// generates ZERO trades. There is NO fallback to a static seed list (the
// DEFAULT_SIM_COUNTERPARTIES export remains an explicit, injected opt-in used by
// the existing replay-determinism tests only).
//
// SIM-ONLY ATTRIBUTES: the onboarding register records the counterparty's
// identity + FX eligibility but not the simulator's behaviour-profile / master-
// agreement knobs. Those are deterministic sim-only defaults applied here
// (`reliable`; ISDA-2002 with a ZAR CSA in scope) so the mapping is replay-
// stable. They are simulator dialing, not bank truth.
//
// COVERAGE: every FX instrument the live driver books carries the
// counterpartyId resolved here, so `recon:fx-sim-counterparty-onboarded`
// (extended to the live `FilInstrumentCreated` path) asserts the live driver's
// counterparties against this same onboarded set.
//
// Authority: D-FX-SIM-LIVE-REALTIME-ONBOARDED (CEO-approved 2026-06-27) under
//   D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Env (External environment simulator, simulation).

import {
  CLIENT_ONBOARDING_EVENT_KINDS,
  type OnboardedFxCounterparty,
  fxCounterpartiesFromOnboardingEvents,
} from "../../v2-core/client-onboarding";
import type { EventStore } from "../event-store/store";
import type { ScenarioAgreement, ScenarioCounterparty } from "../simulation-v2/scenario-manifest";

/** The onboarding event kinds — replayed to fold the onboarding register. */
const ONBOARDING_FAMILY: ReadonlySet<string> = new Set(CLIENT_ONBOARDING_EVENT_KINDS);

/**
 * Deterministic sim-only master agreement applied to every onboarded
 * counterparty (the onboarding register does not carry it). ISDA-2002 with a
 * ZAR CSA in scope — the standard scenario form (mirrors the prior
 * DEFAULT_SIM_COUNTERPARTIES reliable counterparty).
 */
const DEFAULT_SIM_AGREEMENT: ScenarioAgreement = Object.freeze({
  agreementType: "ISDA-2002",
  csaInScope: true,
  csaCurrency: "ZAR",
});

/** True when the event carries a `simulated` provenance tag. */
function isSimulated(ev: { provenance?: unknown }): boolean {
  const prov = ev.provenance;
  if (typeof prov !== "object" || prov === null) return false;
  return (prov as { kind?: unknown }).kind === "simulated";
}

/**
 * Replay the onboarding family (simulated provenance only) from the store,
 * mapped onto the projection's `{ kind, payload, asOf }` shape.
 */
function* collectOnboardingEvents(
  store: Pick<EventStore, "replay">,
): Generator<{ kind: string; payload: Record<string, unknown>; asOf: string }> {
  for (const ev of store.replay()) {
    if (!ONBOARDING_FAMILY.has(ev.type)) continue;
    if (!isSimulated(ev)) continue;
    yield { kind: ev.type, payload: ev.payload, asOf: ev.as_of };
  }
}

/**
 * Map an `OnboardedFxCounterparty` onto the live driver's `ScenarioCounterparty`.
 * The behaviour profile + ISDA/CSA agreement are deterministic sim-only defaults
 * (the onboarding register does not record them).
 */
export function onboardedToScenarioCounterparty(cp: OnboardedFxCounterparty): ScenarioCounterparty {
  return {
    counterpartyId: cp.counterpartyId,
    name: cp.name,
    bic: cp.bic,
    eligiblePairs: [...cp.eligiblePairs],
    behaviourProfile: "reliable",
    agreement: DEFAULT_SIM_AGREEMENT,
  };
}

/**
 * Resolve the live driver's FX counterparties from the IN-SIM ONBOARDED client
 * set. Returns ONLY simulated clients that reached terminal `activated` with a
 * BIC + FX-spot eligibility — the ONLY parties the live FX simulator may trade
 * with. Deterministic order (the resolver sorts by counterpartyId).
 *
 * Returns an EMPTY array when no client has been onboarded to that state yet;
 * the driver then generates NO trade (fail-closed — never a seed fallback).
 */
export function onboardedFxCounterparties(
  store: Pick<EventStore, "replay">,
): ScenarioCounterparty[] {
  return fxCounterpartiesFromOnboardingEvents(collectOnboardingEvents(store)).map(
    onboardedToScenarioCounterparty,
  );
}
