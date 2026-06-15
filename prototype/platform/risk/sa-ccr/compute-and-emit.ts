// platform/risk/sa-ccr/compute-and-emit.ts
//
// WS-V2-BBAAS — SA-CCR ALIAS-FLIP. This is now the V2-SOURCED, single live
// CCR emitting boundary. After the flip (brief
// `brief:rohan:sa-ccr-alias-flip-v2-sole-live-emitter-v1-retire:2026-06-13`,
// authority D-SACCR-V2-CUTOVER-ACCELERATE / D-W4-MODEL-LIBRARY-PILOT /
// D-MODEL-BINDING-CONTRACT-V1) the live `CcrReplacementCostComputed` +
// `CcrEadComputed` events are computed by the VALIDATED v2 SA-CCR FIL-Model
// (`v2-core/fil-models/sa-ccr` — `computeSaCcr`), sourced END-TO-END from
// FIL-mediated reads, NOT by the v1 engine's input-resolution layer:
//
//   - vMtm     ← `sourceVMtmFromValuableFeed` — the LATEST `*Revalued`
//                EVENT-OF-RECORD per trade, as-of the RC date, through the
//                `Valuable` facet's `RevaluationRecord` shape (last-write-wins
//                per trade, summed ONLY across trades). This is the Principle-1
//                reading and the CORRECT d317/CRE52.10 RC `V` basis (the current
//                net mark, exactly one mark per trade). It REPLACES the v1
//                `resolveMtm` cumulative-delta walk, whose FX arm summed
//                `FxPositionRevalued.unrealisedPnlZarMinor` across revaluations
//                as if it were a per-period delta — it is the FULL cumulative
//                mark recomputed each EOD, so summing N revals N-counted V (the
//                recorded Investec RC ~R55.5m vs correct ~R0). That defect is
//                RETIRED by this flip: `resolveMtm` no longer exists and there
//                is no live fallback to it (Nadia MV-SACCR-V2-003).
//   - collateral ← `sourceCollateralFromRegister` — the collateral-inventory
//                register, as-of the RC date (haircut-adjusted ZAR pool;
//                per-netting-set CSA allocation is D-CSA-COLLATERAL-ALLOCATION,
//                future). Mirrors the prior v1 `resolveCollateral` semantics.
//
// The CCR event SCHEMAS are UNCHANGED — consumers (ba-700-leverage-ratio,
// rwa-from-positions, leverage-ratio-metrics, cva-engine) read the event-of-
// record and are untouched. The v1 pure methodology functions
// (`replacement-cost.ts`, `pfe-addon.ts`, `ead.ts`) are RETAINED — they are the
// ORACLE side of `recon:v2-saccr-parity` (v1-recompute vs v2 byte-equivalence),
// not a live emission path.
//
// A `(counterpartyId, currency)` convenience entry — `computeAndEmitFor` —
// looks up the netting set from the Phase-5 netting-set register and forwards
// to `computeAndEmit`; returns `null` when no active assessment exists.
//
// Citations:
//   BCBS d317 §136 (RC formula); BCBS d317 §10 (EAD = α × (RC + PFE));
//   BCBS d317 §149 / CRE52 §52.5 (PFE multiplier);
//   CRE52 §52.10 (RC V = current net mark-to-market);
//   Policies/credit-risk-policy-v1.md §3 line 129 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD Phase 5; D-SACCR-V2-CUTOVER-ACCELERATE;
//   D-MODEL-BINDING-CONTRACT-V1; Principles/1-events-are-truth.md.
//
// Author: Rohan (Risk Engineer, engineering).
// v2 FIL-Model methodology: validated-with-conditions by Nadia (Model
//   validation, risk) — `record:documents:nadia:v2-saccr-model-validation:
//   2026-06-13`.

import type { Money as V2Money } from "../../../v2-core/fil-core/primitives";
import { v1ToV2Money, v2MoneyToMinor, v2ToV1Money } from "./v2-money-bridge";
import {
  type SaCcrEadComputation as V2Ead,
  type SaCcrNettingSet as V2NettingSet,
  type SaCcrReplacementCost as V2Rc,
  type SaCcrTradeSummary as V2TradeSummary,
  computeSaCcrViaAlias,
} from "../../../v2-core/fil-models/sa-ccr";
import { eventStore } from "../../composition";
import { type Money } from "../../core/money";
import { moneyWireFromMinor } from "../../core/money-codec";
import { type Actor, BANK_ZA_001, newEventId } from "../../core/types";
import {
  makeCcrEadComputed,
  makeCcrReplacementCostComputed,
} from "../../event-store/event-types/counterparty-credit-risk";
import type { Event } from "../../event-store/types";
import { resolveNettingSet as resolveNsFromRegister } from "../../markets/netting-sets";
import { utcNow } from "../../types/time";
import {
  sourceCollateralFromRegister,
  sourceVMtmFromValuableFeed,
} from "./fil-valuable-collateral-feed";
import type { EadComputation, NettingSet, ReplacementCost, TradeSummary } from "./types";

// ---------------------------------------------------------------------------
// Default citations for engine-emitted events.
// ---------------------------------------------------------------------------

const DEFAULT_CITATIONS = ["D-CREDIT-LIMIT-ENGINE-BUILD", "Policies/credit-risk-policy-v1.md#3"];

// ---------------------------------------------------------------------------
// v1 ↔ v2 Money + shape conversions at the v2-model boundary.
//
// v1 Money is `{ amount: bigint, currency }` (INTEGER MINOR units). v2 Money is
// now DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE): `{ amount: string }` in
// MAJOR units. The shared `v2-money-bridge` converts between the two. The emitted
// CCR event payloads still coerce the minor-unit value to Number EXACTLY as
// before (schema unchanged) via `v2MoneyToMinor`; the v1-shaped return value is
// rebuilt via `v2ToV1Money` so existing callers / tests observe an unchanged
// result contract.
// ---------------------------------------------------------------------------

function v1ToV2NettingSet(ns: NettingSet): V2NettingSet {
  return {
    nettingSetId: ns.nettingSetId,
    counterpartyId: ns.counterpartyId,
    csaPresent: ns.csaPresent,
    currency: ns.currency,
    ...(ns.threshold !== undefined ? { threshold: v1ToV2Money(ns.threshold) } : {}),
    ...(ns.mta !== undefined ? { mta: v1ToV2Money(ns.mta) } : {}),
  };
}

function v1ToV2Trade(t: TradeSummary): V2TradeSummary {
  return {
    ...(t.tradeId !== undefined ? { tradeId: t.tradeId } : {}),
    counterpartyId: t.counterpartyId,
    nettingSetId: t.nettingSetId,
    assetClass: t.assetClass,
    notional: v1ToV2Money(t.notional),
    ...(t.direction !== undefined ? { direction: t.direction } : {}),
    ...(t.remainingYears !== undefined ? { remainingYears: t.remainingYears } : {}),
    ...(t.currency !== undefined ? { currency: t.currency } : {}),
    ...(t.hedgingSetTag !== undefined ? { hedgingSetTag: t.hedgingSetTag } : {}),
    ...(t.optionType !== undefined ? { optionType: t.optionType } : {}),
  };
}

function v2RcToV1(rc: V2Rc): ReplacementCost {
  return {
    nettingSetId: rc.nettingSetId,
    rc: v2ToV1Money(rc.rc),
    vMtm: v2ToV1Money(rc.vMtm),
    collateralHeld: v2ToV1Money(rc.collateralHeld),
    computedAt: rc.computedAt,
  };
}

function v2EadToV1(ead: V2Ead): EadComputation {
  return {
    nettingSetId: ead.nettingSetId,
    counterpartyId: ead.counterpartyId,
    rc: v2ToV1Money(ead.rc),
    pfe: v2ToV1Money(ead.pfe),
    alpha: 1.4,
    multiplier: ead.multiplier,
    aggregatedAddOn: v2ToV1Money(ead.aggregatedAddOn),
    ead: v2ToV1Money(ead.ead),
    asOf: ead.asOf,
  };
}

// ---------------------------------------------------------------------------
// ComputeAndEmitInput — caller-threaded inputs. `vMtm` + `collateralHeld` are
// optional test seams: when omitted, the FIL-mediated feeds resolve them (the
// production path); when passed, they bypass the feeds (tests / pre-flight).
// All Money values must share the netting-set currency.
// ---------------------------------------------------------------------------

export interface ComputeAndEmitInput {
  nettingSet: NettingSet;
  /** Net mark-to-market of the netting set. Signed Money in netting-set ccy.
   * Optional — when omitted, the `Valuable` feed (latest `*Revalued`
   * event-of-record per trade) resolves it. */
  vMtm?: Money;
  /** Net collateral held against the netting set. Non-negative Money.
   * Optional — when omitted, the collateral register resolves it. */
  collateralHeld?: Money;
  /** Trades in the netting set — feeds the PFE add-on aggregation. */
  trades: TradeSummary[];
  /** ISO 8601 — overrides current time for the RC computationDate /
   * EAD asOf / event as_of. */
  asOf?: string;
  /** Optional actor override for the emitted event. */
  actor?: Actor;
  /** Optional citation override. Defaults to DEFAULT_CITATIONS. */
  citations?: string[];
}

// ---------------------------------------------------------------------------
// ComputeAndEmitResult — composite result, plus the emitted RC event handle
// for caller-side assertions / Vera recon symmetry checks.
// ---------------------------------------------------------------------------

export interface ComputeAndEmitResult {
  rc: ReplacementCost;
  ead: EadComputation;
  event: Event;
}

// ---------------------------------------------------------------------------
// computeAndEmit — top-level engine entry. The COMPUTATION runs through the
// validated v2 SA-CCR FIL-Model (`computeSaCcr`); the RC inputs are sourced from
// the FIL-mediated feeds (vMtm ← Valuable feed; collateral ← register) unless a
// caller threads them in (test seam). Pure up to the two `eventStore.append`
// calls.
//
// Emits two events on the same call (schemas UNCHANGED):
//   1. `CcrReplacementCostComputed` — RC component (BCBS d317 §136).
//   2. `CcrEadComputed` — composed EAD = α × (RC + PFE) (BCBS d317 §10). Carries
//      the chain back to the RC event via `sourceEvents.rcEventId`.
// ---------------------------------------------------------------------------

export function computeAndEmit(input: ComputeAndEmitInput): ComputeAndEmitResult {
  const asOf = input.asOf ?? utcNow();
  const ccy = input.nettingSet.currency;

  // 1. Resolve MTM via the Valuable feed (latest `*Revalued` event-of-record
  //    per trade, as-of the RC date) unless the caller threads it in. This is
  //    the correct d317/CRE52.10 `V` basis — NOT the retired v1 `resolveMtm`
  //    cumulative-delta walk.
  const vMtmV2: V2Money =
    input.vMtm !== undefined
      ? v1ToV2Money(input.vMtm)
      : sourceVMtmFromValuableFeed(eventStore, {
          counterpartyId: input.nettingSet.counterpartyId,
          currency: ccy,
          asOf,
        });

  // 2. Resolve collateral via the register unless the caller threads it in.
  const collateralV2: V2Money =
    input.collateralHeld !== undefined
      ? v1ToV2Money(input.collateralHeld)
      : sourceCollateralFromRegister({ currency: ccy, asOf });

  // 3. v2 FIL-Model computation — RC + PFE add-on + EAD over the netting set.
  //    Resolved through the SA-CCR model alias (the shared FIL alias-registry
  //    seam): the selection of WHICH validated model computes is swappable
  //    behind this boundary; the default is the validated v2 `computeSaCcr`, so
  //    behaviour is unchanged (recon:v2-saccr-parity).
  const v2Ns = v1ToV2NettingSet(input.nettingSet);
  const v2Trades = input.trades.map(v1ToV2Trade);
  const { rc, ead, addOns } = computeSaCcrViaAlias({
    nettingSet: v2Ns,
    vMtm: vMtmV2,
    collateralHeld: collateralV2,
    trades: v2Trades,
    asOf,
  });

  // 4. Emit. computationDate is the date portion of asOf (the T-0 close-of-
  //    business date per the event schema).
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
      rc: Number(v2MoneyToMinor(rc.rc)),
      currency: ccy,
      computationDate,
      methodology: "sa-ccr",
      vMtm: Number(v2MoneyToMinor(vMtmV2)),
      collateralHeld: Number(v2MoneyToMinor(collateralV2)),
    },
    eventId: newEventId(),
  });

  eventStore.append(event);

  // 5. Emit CcrEadComputed alongside RC. Composes EAD = α × (RC + PFE).
  // DECIMAL-MIGRATION (slice 2): rc / pfe / ead are emitted as MoneyWire
  // (HALF_UP rounding — SA-CCR regulatory convention, BCBS d317 §10).
  // moneyWireFromMinor converts the BigInt minor-unit values from the v2 model
  // to canonical decimal strings without any IEEE-754 float arithmetic.
  const eadEvent = makeCcrEadComputed({
    asOf,
    entity: String(BANK_ZA_001),
    actor,
    citations: input.citations ?? DEFAULT_CITATIONS,
    payload: {
      nettingSetId: input.nettingSet.nettingSetId,
      counterpartyId: input.nettingSet.counterpartyId,
      // HALF_UP: SA-CCR regulatory rounding convention (BCBS d317 §10).
      rc: moneyWireFromMinor(Number(v2MoneyToMinor(rc.rc)), ccy),
      pfe: moneyWireFromMinor(Number(v2MoneyToMinor(ead.pfe)), ccy),
      alpha: 1.4,
      ead: moneyWireFromMinor(Number(v2MoneyToMinor(ead.ead)), ccy),
      currency: ccy,
      computationDate,
      methodology: "sa-ccr",
      sourceEvents: {
        rcEventId: event.event_id,
        pfeComponents: addOns.length,
      },
    },
    eventId: newEventId(),
  });

  eventStore.append(eadEvent);

  return { rc: v2RcToV1(rc), ead: v2EadToV1(ead), event };
}

// ---------------------------------------------------------------------------
// computeAndEmitFor — register-resolved entry. Looks up the active netting set
// for `(counterpartyId, currency)` from the Phase-5 netting-set register and
// forwards to `computeAndEmit`. Returns `null` when the register holds no
// active assessment for the pair — callers decide whether to fall back to a
// trade-by-trade computation or to refuse the trade pending ISDA / CSA
// onboarding.
//
// Citations:
//   Policies/credit-risk-policy-v1.md §3 line 136 (netting-enforceability
//     prerequisite); D-CREDIT-LIMIT-ENGINE-BUILD Phase 5.
// ---------------------------------------------------------------------------

export interface ComputeAndEmitForInput {
  counterpartyId: string;
  currency: string;
  /** Optional — when omitted, the `Valuable` feed resolves vMtm. */
  vMtm?: Money;
  /** Optional — when omitted, the collateral register resolves collateral. */
  collateralHeld?: Money;
  trades: TradeSummary[];
  asOf?: string;
  actor?: Actor;
  citations?: string[];
}

export function computeAndEmitFor(input: ComputeAndEmitForInput): ComputeAndEmitResult | null {
  const ns = resolveNsFromRegister(input.counterpartyId, input.currency, input.asOf);
  if (!ns) return null;
  return computeAndEmit({
    nettingSet: ns,
    trades: input.trades,
    ...(input.vMtm !== undefined ? { vMtm: input.vMtm } : {}),
    ...(input.collateralHeld !== undefined ? { collateralHeld: input.collateralHeld } : {}),
    ...(input.asOf !== undefined ? { asOf: input.asOf } : {}),
    ...(input.actor !== undefined ? { actor: input.actor } : {}),
    ...(input.citations !== undefined ? { citations: input.citations } : {}),
  });
}
