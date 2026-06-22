// v2-core/client-onboarding/fx-counterparties.ts
//
// Onboarded-client → FX-counterparty resolver (the COHERENCE RULE of the
// simulated outside world: a client exists ONLY by being onboarded, and is an
// eligible FX counterparty ONLY once it has reached the terminal `activated`
// phase AND declared an FX-spot eligibility at prospect registration).
//
// This is the V2-native replacement for deriving the FX-sim counterparty list
// from a static seed / the party register. It folds the born-V2 client-
// onboarding register (the canonical onboarding truth) and emits the FX-eligible
// subset — fail-closed: an onboarded client with no BIC or no FX-eligible pairs
// is NOT returned, and a client that has not reached `activated` is NOT returned.
//
// PACKAGE BOUNDARY: no v1 imports (D-V1-REMOVAL-PHASE-1; recon:v2-no-v1-import).
// Returns a plain, V1-agnostic shape (`OnboardedFxCounterparty`); the V1-side
// adapter (platform/simulation/onboarded-fx-counterparty-resolver.ts) maps it
// onto the sim engine's `SimCounterparty`.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-V1-REMOVAL-PHASE-1; WS-FX-V2-SIMULATOR-FIRST;
//   brief:atlas:fx-simulator-transacts-with-in-sim-onboarded-cli:2026-06-22.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type ClientOnboardingRecord,
  type ClientOnboardingRegister,
  foldClientOnboardingRegister,
} from "./projection";

/**
 * An FX-eligible counterparty derived from a terminal-`activated` onboarded
 * client. Plain shape — no V1 `Party` coupling (the V1 adapter enriches it).
 */
export interface OnboardedFxCounterparty {
  /** The onboarding counterparty id (the canonical client identity). */
  readonly counterpartyId: string;
  /** Display / legal name (falls back to the id when unregistered). */
  readonly name: string;
  /** ISO 3166-1 alpha-2 jurisdiction (from prospect registration). */
  readonly jurisdiction: string;
  /** SWIFT BIC — required to be an FX counterparty (fail-closed if absent). */
  readonly bic: string;
  /** FX-spot pairs this counterparty may trade (`BASE/QUOTE`). Non-empty. */
  readonly eligiblePairs: readonly string[];
}

/**
 * Is this onboarded record an eligible FX counterparty?
 *
 * Fail-closed coherence: TRUE iff the client has reached the terminal
 * `activated` phase AND carries a BIC AND declared at least one FX-eligible
 * pair. Any client short of `activated`, or missing BIC / FX pairs, is excluded
 * — there is NO fallback to seed data.
 */
export function isFxEligibleOnboardedClient(record: ClientOnboardingRecord): boolean {
  if (record.phase !== "activated") return false;
  if (typeof record.bic !== "string" || record.bic.length === 0) return false;
  if (record.fxEligiblePairs === undefined || record.fxEligiblePairs.length === 0) return false;
  return true;
}

/**
 * Resolve the FX-eligible counterparties from a folded onboarding register.
 * Returns ONLY clients that {@link isFxEligibleOnboardedClient}. Deterministic
 * order (sorted by counterpartyId) so downstream selection is replay-stable.
 */
export function fxCounterpartiesFromOnboardingRegister(
  register: ClientOnboardingRegister,
): OnboardedFxCounterparty[] {
  const out: OnboardedFxCounterparty[] = [];
  for (const record of register.listActiveClients()) {
    if (!isFxEligibleOnboardedClient(record)) continue;
    // Narrowed by isFxEligibleOnboardedClient — bic + fxEligiblePairs present.
    const bic = record.bic;
    const pairs = record.fxEligiblePairs;
    if (bic === undefined || pairs === undefined) continue; // type-narrow guard.
    out.push({
      counterpartyId: record.counterpartyId,
      name: record.legalName ?? record.counterpartyId,
      jurisdiction: record.jurisdiction ?? "ZA",
      bic,
      eligiblePairs: [...pairs],
    });
  }
  out.sort((a, b) => a.counterpartyId.localeCompare(b.counterpartyId));
  return out;
}

/**
 * Convenience: fold a raw onboarding-event stream straight into the FX-eligible
 * set. Used by the V1-side resolver, which supplies the store replay.
 */
export function fxCounterpartiesFromOnboardingEvents(
  rawEvents: Iterable<unknown>,
): OnboardedFxCounterparty[] {
  return fxCounterpartiesFromOnboardingRegister(foldClientOnboardingRegister(rawEvents));
}
