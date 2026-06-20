// platform/simulation-v2/sim-modules/margin-call-response.ts
//
// M8 — margin-call response seam (SIMULATOR side). Models the OUTSIDE WORLD's
// response to a bank-issued variation-margin call: the counterparty posts the
// called collateral, disputes the call, or fails to meet it.
//
// This module emits ONLY the EXTERNAL party's response (`MarginCallResponded`),
// tagged `simulated`, born V2, scenario-bound. The bank's OWN recording of the
// posted collateral (`CollateralPosted` / `MarginCallSettled`) is SUT-internal
// (platform/markets/collateral/margin-call-engine.ts) — the boundary gate forbids
// this simulator module from emitting those.
//
// Determinism: the response is selected by the counterparty's CSA margin-
// behaviour profile (posts-in-full / disputes-once / fails) — a deterministic
// function of the manifest + the count of prior calls, never a random draw.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); ISDA CSA.
// Author: Atlas (Core banking platform architect, engineering).

import { makeMarginCallResponded } from "../../event-store/event-types/margin-call-response";
import { simulatedTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { ScenarioCsaTerms } from "../scenario-manifest";

const ENTITY = "LE-ZA-HOZ-BANK";
const SIM_ACTOR = { type: "service" as const, id: "agent:env:margin-call-response-sim" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

function simProvenance(scenarioId: string) {
  return simulatedTag({
    scenario: scenarioId,
    sourceLineage: "simulation-v2:margin-call-response",
  });
}

type MarginBehaviour = NonNullable<ScenarioCsaTerms["marginBehaviour"]>;

/**
 * SIMULATOR — respond to all OPEN margin calls (issued, not yet responded to) for
 * `counterpartyId`. Per call the response is decided by the CSA margin-behaviour
 * profile:
 *   "posts-in-full" → posts the full called amount;
 *   "disputes-once" → disputes the FIRST open call, posts the rest;
 *   "fails"         → fails every call.
 * The eligible collateral kind is the first declared in the CSA terms (cash by
 * default). Idempotent on the deterministic per-call response event id.
 *
 * Returns the number of responses emitted.
 */
export function respondToMarginCalls(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly counterpartyId: string;
  readonly reporting: string;
  readonly csaTerms: ScenarioCsaTerms;
}): number {
  const { store, scenarioId, asOf, counterpartyId, reporting, csaTerms } = args;
  const behaviour: MarginBehaviour = csaTerms.marginBehaviour ?? "posts-in-full";
  const collateralKind = csaTerms.eligibleCollateral[0] ?? "cash";
  const provenance = simProvenance(scenarioId);

  // Calls already responded to (by id).
  const respondedIds = new Set<string>();
  for (const e of store.replay({ type: "MarginCallResponded" })) {
    const id = (e.payload as { marginCallId?: string }).marginCallId;
    if (id) respondedIds.add(id);
  }

  // Open calls for this counterparty, in issue order (store order).
  const openCalls = [...store.replay({ type: "MarginCallIssued" })]
    .map((e) => e.payload as { marginCallId: string; counterpartyId: string; callAmountMajor: number })
    .filter((p) => p.counterpartyId === counterpartyId && !respondedIds.has(p.marginCallId));

  // How many calls this counterparty has ALREADY responded to (for disputes-once).
  let priorResponses = 0;
  for (const e of store.replay({ type: "MarginCallResponded" })) {
    const p = e.payload as { counterpartyId?: string };
    if (p.counterpartyId === counterpartyId) priorResponses += 1;
  }

  let emitted = 0;
  for (const call of openCalls) {
    const responseIndex = priorResponses + emitted;
    let response: "post" | "dispute" | "fail";
    if (behaviour === "fails") {
      response = "fail";
    } else if (behaviour === "disputes-once") {
      response = responseIndex === 0 ? "dispute" : "post";
    } else {
      response = "post";
    }

    const postedAmountMajor = response === "post" ? call.callAmountMajor : 0;
    store.append(
      makeMarginCallResponded({
        asOf,
        entity: ENTITY,
        actor: SIM_ACTOR,
        citations: CITATIONS,
        eventId: `${call.marginCallId}:responded`,
        provenance,
        payload: {
          marginCallId: call.marginCallId,
          nettingSetId: `NS-${counterpartyId}-${reporting}`,
          counterpartyId,
          response,
          postedAmountMajor,
          collateralKind,
          currency: reporting,
          ...(response !== "post"
            ? { reason: response === "dispute" ? "valuation-dispute" : "collateral-shortfall" }
            : {}),
          respondedAt: asOf,
        },
      }),
    );
    emitted += 1;
  }
  return emitted;
}
