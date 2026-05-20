// platform/risk/sa-ccr/compute-and-emit.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 4 — only event-emitting boundary of the
// SA-CCR engine. All other modules in `@platform/risk/sa-ccr` are pure
// computations; this module composes them, resolves the inputs, and
// emits the `CcrReplacementCostComputed` event registered in PR #612.
//
// Inputs are threaded by the caller in this v0 because there is no
// canonical netting-set register yet — that gap is documented below.
// Once a register lands, `computeAndEmit` should accept `(nettingSetId,
// asOf)` and pull config + trades from the register, MTM from
// market-data, collateral from `@platform/collateral`.
//
// Substrate gap (queued, follow-on slice under D-CREDIT-LIMIT-ENGINE-
// BUILD Phase 4):
//   - Canonical netting-set register. v0 takes the `NettingSet` config
//     directly on the call to keep this engine usable today; the future
//     register will be a projection over `ISDACSAAssessmentCompleted` +
//     `NettingAgreementValidated` events (per Credit Risk Policy §3
//     line 136). Once the register lands, this module's signature
//     simplifies to (nettingSetId, asOf).
//   - MTM source. v0 takes `vMtm` directly; future iteration pulls from
//     Bea's MTM engine / forward-obligations projection.
//   - Collateral source. v0 takes `collateralHeld` directly; future
//     iteration pulls per-netting-set net-collateral from
//     `@platform/collateral`.
//
// Citations:
//   BCBS d317 §136 (RC formula);
//   BCBS d317 §10 (EAD = α × (RC + PFE));
//   Policies/credit-risk-policy-v1.md §3 line 129 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md.
//
// Author: Rohan (Market risk quantitative engineer, engineering).

import { eventStore } from "../../composition";
import type { Money } from "../../core/money";
import { type Actor, BANK_ZA_001, newEventId } from "../../core/types";
import { makeCcrReplacementCostComputed } from "../../event-store/event-types/counterparty-credit-risk";
import type { Event } from "../../event-store/types";
import { utcNow } from "../../types/time";
import { computeEad } from "./ead";
import { computeAddOn } from "./pfe-addon";
import { computeReplacementCost } from "./replacement-cost";
import type { EadComputation, NettingSet, ReplacementCost, TradeSummary } from "./types";

// ---------------------------------------------------------------------------
// Default citations for engine-emitted events. Includes the standing
// authority + the canonical SA-CCR / policy references.
// ---------------------------------------------------------------------------

const DEFAULT_CITATIONS = ["D-CREDIT-LIMIT-ENGINE-BUILD", "Policies/credit-risk-policy-v1.md#3"];

// ---------------------------------------------------------------------------
// ComputeAndEmitInput — caller-threaded inputs (see substrate-gap notes
// in the file header). All Money values must share the netting-set
// currency.
// ---------------------------------------------------------------------------

export interface ComputeAndEmitInput {
  nettingSet: NettingSet;
  /** Net mark-to-market of the netting set. Signed Money in netting-set ccy. */
  vMtm: Money;
  /** Net collateral held against the netting set. Non-negative Money. */
  collateralHeld: Money;
  /** Trades in the netting set — feeds the PFE add-on aggregation. */
  trades: TradeSummary[];
  /** ISO 8601 — overrides current time for the RC computationDate /
   * EAD asOf / event as_of. */
  asOf?: string;
  /** Optional actor override for the emitted event. Defaults to a service
   * actor identifying the SA-CCR engine. */
  actor?: Actor;
  /** Optional citation override. Defaults to DEFAULT_CITATIONS. */
  citations?: string[];
}

// ---------------------------------------------------------------------------
// ComputeAndEmitResult — composite result, plus the emitted event handle
// for caller-side assertions / Vera recon symmetry checks.
// ---------------------------------------------------------------------------

export interface ComputeAndEmitResult {
  rc: ReplacementCost;
  ead: EadComputation;
  event: Event;
}

// ---------------------------------------------------------------------------
// computeAndEmit — top-level engine entry. Pure function up to the single
// `eventStore.append` call.
//
// Returns the RC, the EAD, and the emitted event so callers + tests can
// observe the engine's output without re-reading from the event store.
//
// Note: the emitted event carries only RC (per the event-type registered
// in PR #612 — `CcrReplacementCostComputed`). EAD + PFE composition is
// returned in-memory and currently consumed by `pre-deal-check.ts`
// indirectly via RC; a dedicated `CcrEadComputed` event-type is queued
// for the follow-on slice (Credit Risk Policy §3 line 131 already names
// the future event).
// ---------------------------------------------------------------------------

export function computeAndEmit(input: ComputeAndEmitInput): ComputeAndEmitResult {
  const asOf = input.asOf ?? utcNow();

  // 1. Pure RC.
  const rc = computeReplacementCost(input.nettingSet, input.vMtm, input.collateralHeld, asOf);

  // 2. Pure add-on aggregation. Trades may be empty (zero PFE).
  const addOns = computeAddOn(input.trades);

  // 3. Pure EAD composition.
  const ead = computeEad(rc, addOns, {
    counterpartyId: input.nettingSet.counterpartyId,
    asOf,
  });

  // 4. Emit. computationDate is the date portion of asOf (per the event
  //    schema — `computationDate` is the T-0 close-of-business date).
  const computationDate = asOf.slice(0, 10);
  const actor: Actor = input.actor ?? { type: "service", id: "platform:risk:sa-ccr" };

  const event = makeCcrReplacementCostComputed({
    asOf,
    entity: String(BANK_ZA_001),
    actor,
    citations: input.citations ?? DEFAULT_CITATIONS,
    payload: {
      nettingSetId: input.nettingSet.nettingSetId,
      counterpartyId: input.nettingSet.counterpartyId,
      rc: Number(rc.rc.amount),
      currency: input.nettingSet.currency,
      computationDate,
      methodology: "sa-ccr",
      vMtm: Number(input.vMtm.amount),
      collateralHeld: Number(input.collateralHeld.amount),
    },
    eventId: newEventId(),
  });

  eventStore.append(event);

  return { rc, ead, event };
}
