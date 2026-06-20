// platform/simulation-v2/sim-modules/credit-rating-feed.ts
//
// M6 — credit-rating feed seam (SIMULATOR side). Models the OUTSIDE WORLD's
// rating-agency feed: a rating agency (S&P / Moody's / Fitch) publishing or
// revising a counterparty's long-term issuer rating.
//
// This module emits ONLY the EXTERNAL party's rating facts
// (`ExternalCreditRatingReceived`), tagged `simulated`, born V2, scenario-bound.
// The bank's OWN mapping of that rating to a Basel class
// (`CounterpartyBaselClassAssigned`) is SUT-internal and lives in
// platform/markets/counterparty/assign-basel-class.ts — the simulator↔SUT
// boundary gate forbids this simulator module from emitting the bank's class.
//
// Determinism: the feed carries the manifest-declared rating verbatim (no random
// draw) — the scenario author chooses the rating + any mid-scenario revision.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20). BCBS CRE20.
// Author: Atlas (Core banking platform architect, engineering).

import { makeExternalCreditRatingReceived } from "../../event-store/event-types/external-credit-rating";
import { simulatedTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { ScenarioCreditRating } from "../scenario-manifest";

const ENTITY = "LE-ZA-HOZ-BANK";
const SIM_ACTOR = { type: "service" as const, id: "agent:env:credit-rating-agency-sim" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

function simProvenance(scenarioId: string) {
  return simulatedTag({
    scenario: scenarioId,
    sourceLineage: "simulation-v2:credit-rating-feed",
  });
}

/**
 * SIMULATOR — emit an external rating-agency fact for `counterpartyId`. `action`
 * distinguishes the initial publication (at provisioning) from a mid-scenario
 * `revision` (upgrade/downgrade). Idempotent on the deterministic event id
 * (scenarioId : counterpartyId : ratedAt) so a replay re-emits the same fact.
 */
export function emitExternalCreditRating(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly counterpartyId: string;
  readonly rating: ScenarioCreditRating;
  readonly action: "initial" | "revision";
}): void {
  const { store, scenarioId, asOf, counterpartyId, rating, action } = args;
  store.append(
    makeExternalCreditRatingReceived({
      asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      eventId: `${scenarioId}:${counterpartyId}:rating:${asOf}`,
      provenance: simProvenance(scenarioId),
      payload: {
        counterpartyId,
        agency: rating.agency,
        rating: rating.rating,
        counterpartyType: rating.counterpartyType,
        ratedAt: asOf,
        action,
      },
    }),
  );
}
