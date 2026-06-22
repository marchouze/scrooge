// platform/simulation/onboarded-fx-counterparty-resolver.ts
//
// V1-SIDE adapter — resolves the FX-sim counterparty list from the IN-SIM
// ONBOARDED client set (the born-V2 client-onboarding register), NOT from a
// static seed or the party register.
//
// THE COHERENCE RULE (D-FX-V2-SIMULATOR-FIRST): a client of the simulated
// outside world exists ONLY by being onboarded through the KYC → activated
// flow, and is an eligible FX counterparty ONLY once it reaches the terminal
// `activated` phase with a BIC + FX-spot eligibility. No onboarding → no
// trading. This module reads that truth and hands the sim engine its
// counterparty list; if no client has been onboarded yet it returns an empty
// list and the engine emits NO trade (fail-closed — never a seed fallback).
//
// SCOPING: the simulator deals only with its OWN simulated clients, so this
// resolver filters to clients onboarded under `simulated` provenance. The
// production / real-bank counterparty path (getActiveFxCounterparties → party
// register) is untouched — this governs the SIMULATOR's source only.
//
// Reads the V1 canonical event store via the permitted v1→v2 direction (imports
// the v2-core onboarding projection + resolver; v2-core never reaches back —
// recon:v2-no-v1-import).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   WS-FX-V2-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1;
//   brief:atlas:fx-simulator-transacts-with-in-sim-onboarded-cli:2026-06-22.
// Author: Atlas (Core banking platform architect, engineering).

import {
  CLIENT_ONBOARDING_EVENT_KINDS,
  type OnboardedFxCounterparty,
  fxCounterpartiesFromOnboardingEvents,
} from "../../v2-core/client-onboarding";
import type { EventStore } from "../event-store/store";
import type { SimCounterparty } from "./fx-sim-counterparties";

/** The onboarding event kinds — replayed to fold the onboarding register. */
const ONBOARDING_FAMILY: ReadonlySet<string> = new Set(CLIENT_ONBOARDING_EVENT_KINDS);

/**
 * Replay the onboarding family from the store, mapped onto the projection's
 * `{ kind, payload, asOf }` shape — and ONLY simulated-provenance events when
 * `simulatedOnly` is set (the simulator deals only with its own clients).
 */
function* collectOnboardingEvents(
  store: Pick<EventStore, "replay">,
  simulatedOnly: boolean,
): Generator<{ kind: string; payload: Record<string, unknown>; asOf: string }> {
  for (const ev of store.replay()) {
    if (!ONBOARDING_FAMILY.has(ev.type)) continue;
    if (simulatedOnly && !isSimulated(ev)) continue;
    yield { kind: ev.type, payload: ev.payload, asOf: ev.as_of };
  }
}

/** True when the event carries a `simulated` provenance tag. */
function isSimulated(ev: { provenance?: unknown }): boolean {
  const prov = ev.provenance;
  if (typeof prov !== "object" || prov === null) return false;
  return (prov as { kind?: unknown }).kind === "simulated";
}

/**
 * The default FX notional band (minor units) — legacy fields ignored by the
 * engine when `notionalUsdMin/Max` are set on it; kept for the `SimCounterparty`
 * contract.
 */
const DEFAULT_MIN_NOTIONAL_MINOR = 0;
const DEFAULT_MAX_NOTIONAL_MINOR = 0;

/** Map an `OnboardedFxCounterparty` onto the sim engine's `SimCounterparty`. */
function toSimCounterparty(cp: OnboardedFxCounterparty): SimCounterparty {
  // ISO 3166-1 alpha-2 — the CDM `Party.jurisdiction` is exactly 2 chars; the
  // onboarding family records a 2-letter jurisdiction. Defensive slice keeps the
  // type contract even if a longer string slipped through.
  const jurisdiction = cp.jurisdiction.slice(0, 2).toUpperCase();
  return {
    partyId: cp.counterpartyId,
    name: cp.name,
    role: "counterparty",
    jurisdiction,
    bic: cp.bic,
    isSim: true,
    eligiblePairs: [...cp.eligiblePairs],
    minNotionalMinor: DEFAULT_MIN_NOTIONAL_MINOR,
    maxNotionalMinor: DEFAULT_MAX_NOTIONAL_MINOR,
  };
}

/**
 * Resolve the FX-sim counterparties from the IN-SIM ONBOARDED client set.
 *
 * Returns the simulated clients that have reached terminal `activated` with a
 * BIC + FX-spot eligibility — the ONLY parties the FX simulator may transact
 * with. Returns an empty array when no client has been onboarded to that state
 * yet; the caller (`fireTrade`) emits no trade in that case (fail-closed).
 *
 * NEVER falls back to a static seed list.
 */
export function getOnboardedFxCounterparties(
  store: Pick<EventStore, "replay">,
): SimCounterparty[] {
  const onboarded = fxCounterpartiesFromOnboardingEvents(
    collectOnboardingEvents(store, /* simulatedOnly */ true),
  );
  return onboarded.map(toSimCounterparty);
}
