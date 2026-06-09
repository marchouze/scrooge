// platform/risk/sa-ccr/compute-and-emit.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 (v1) — only event-emitting boundary of
// the SA-CCR engine. All other modules in `@platform/risk/sa-ccr` are
// pure computations; this module composes them, resolves the inputs,
// and emits both `CcrReplacementCostComputed` and `CcrEadComputed`
// (event types registered in PR #612 / PR #622).
//
// A `(counterpartyId, currency)` convenience entry — `computeAndEmitFor`
// — looks up the netting set from the Phase-5 netting-set register
// (`@platform/markets/netting-sets`, Imani's slice) and forwards to
// `computeAndEmit`. That closes the canonical netting-set substrate gap.
//
// v1 also closes the MTM + collateral substrate gaps that v0 left as
// caller-threaded parameters:
//   - `resolveMtm(nettingSetId, asOf)` walks `IrsTradeBooked` /
//     `FxTradeExecuted` events for the netting set's counterparty, finds
//     the latest `IrdSwapPositionRevalued` / `FxPositionRevalued` per trade
//     as-of `asOf`, and sums them in the netting-set currency. The MTM
//     event-type shape comes from Bea's MTM engine slice — the contract
//     decision (`IrdSwapPositionRevalued.npvClosingMinor`, `FxPositionRevalued
//     .unrealisedPnlZarMinor`) is attributed to **Bea (Accounting and
//     financial reporting engineer, engineering)**. IRS MTM was repointed from
//     the trade-domain `IrsPositionRevalued.markToMarket` to the accounting
//     family per D-IRS-FAMILY-CONVERGE-ACCOUNTING.
//   - `resolveCollateral(nettingSetId, asOf)` queries
//     `getCollateralInventory()` (Atlas's projection) and sums the
//     haircut-adjusted ZAR values. v1 does not yet associate inventory
//     positions to specific netting sets — the build-phase inventory is
//     a bank-level pool. When the per-netting-set CSA breakdown lands
//     (D-CSA-COLLATERAL-ALLOCATION, future), this helper switches to a
//     netting-set-keyed lookup.
//
// Both helpers are exported so callers can pre-flight the auto-resolution
// before computing. The legacy `vMtm` + `collateralHeld` parameters are
// retained as test seams on `ComputeAndEmitInput` — when not passed, the
// helpers resolve them; when passed, they bypass the helpers.
//
// Citations:
//   BCBS d317 §136 (RC formula);
//   BCBS d317 §10 (EAD = α × (RC + PFE));
//   BCBS d317 §149 / CRE52 §52.5 (PFE multiplier);
//   Policies/credit-risk-policy-v1.md §3 line 129 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD Phase 5;
//   Principles/1-events-are-truth.md.
//
// Author: Rohan (Market risk quantitative engineer, engineering).
// MTM event-type contract: Bea (Accounting and financial reporting
// engineer, engineering) — see `IrdSwapPositionRevalued` / `FxPositionRevalued`
// schemas.

import { getCollateralInventory } from "../../collateral/inventory";
import { eventStore } from "../../composition";
import { type Money, minor } from "../../core/money";
import { type Actor, BANK_ZA_001, newEventId } from "../../core/types";
import {
  makeCcrEadComputed,
  makeCcrReplacementCostComputed,
} from "../../event-store/event-types/counterparty-credit-risk";
import type { Event } from "../../event-store/types";
import { resolveNettingSet as resolveNsFromRegister } from "../../markets/netting-sets";
import { utcNow } from "../../types/time";
import { computeEad } from "./ead";
import { computeAddOn } from "./pfe-addon";
import { computeReplacementCost } from "./replacement-cost";
import type { EadComputation, NettingSet, ReplacementCost, TradeSummary } from "./types";

// ---------------------------------------------------------------------------
// Default citations for engine-emitted events.
// ---------------------------------------------------------------------------

const DEFAULT_CITATIONS = ["D-CREDIT-LIMIT-ENGINE-BUILD", "Policies/credit-risk-policy-v1.md#3"];

// ---------------------------------------------------------------------------
// resolveMtm — auto-resolve the netting set's net MTM by summing the
// latest IrdSwapPositionRevalued + FxPositionRevalued per trade owned by the
// netting set's counterparty.
//
// **MTM event-type contract owned by Bea.** This helper reads from those
// events; Bea owns the schema, so any change to the MTM shape (e.g.
// signed/unsigned, minor-unit currency tag) must be coordinated via Bea.
// v1 reads:
//   - `IrdSwapPositionRevalued.npvClosingMinor` (signed minor units) + `.currency`
//   - `FxPositionRevalued.unrealisedPnlZarMinor` (ZAR minor units, signed)
//
// Caller passes the netting-set currency. Cross-currency trades within
// the netting set are skipped (P5 — a netting set is single-currency by
// Credit Risk Policy §3 line 132).
// ---------------------------------------------------------------------------

interface NettingSetMtmInputs {
  counterpartyId: string;
  currency: string;
  asOf: string;
}

export function resolveMtm(inputs: NettingSetMtmInputs): Money {
  const { counterpartyId, currency, asOf } = inputs;

  // Step 1: collect trade IDs for the counterparty (across IRS + FX
  // booking events). counterparty.partyId is the canonical key.
  const tradeIds = new Set<string>();

  for (const ev of eventStore.replay({ type: "IrsTradeBooked", asOf })) {
    const payload = ev.payload as {
      tradeId?: { value?: string } | string;
      counterparty?: { partyId?: string };
    };
    if (payload.counterparty?.partyId !== counterpartyId) continue;
    const tid =
      typeof payload.tradeId === "string" ? payload.tradeId : (payload.tradeId?.value ?? undefined);
    if (tid) tradeIds.add(tid);
  }
  for (const ev of eventStore.replay({ type: "FxTradeExecuted", asOf })) {
    const payload = ev.payload as {
      tradeId?: { value?: string } | string;
      counterparty?: { partyId?: string };
    };
    if (payload.counterparty?.partyId !== counterpartyId) continue;
    const tid =
      typeof payload.tradeId === "string" ? payload.tradeId : (payload.tradeId?.value ?? undefined);
    if (tid) tradeIds.add(tid);
  }

  if (tradeIds.size === 0) return minor(0n, currency as never);

  // Step 2: find the latest revaluation per trade.
  // Strategy: streaming replay in sequence order; last-write-wins per
  // tradeId. (replay is sequence-ordered which monotonically tracks
  // as_of for revaluations.)
  // IRS MTM is sourced from the accounting IrdSwapPositionRevalued family — the
  // single canonical revaluation fact post D-IRS-FAMILY-CONVERGE-ACCOUNTING.
  // npvClosingMinor is the signed mark-to-market (positive = net asset to bank).
  const latestIrsMtmMinor = new Map<string, bigint>();
  for (const ev of eventStore.replay({ type: "IrdSwapPositionRevalued", asOf })) {
    const payload = ev.payload as {
      tradeId?: string;
      npvClosingMinor?: number;
      currency?: string;
    };
    const tid = typeof payload.tradeId === "string" ? payload.tradeId : undefined;
    if (!tid || !tradeIds.has(tid)) continue;
    if (typeof payload.npvClosingMinor !== "number") continue;
    // Skip cross-currency trades — netting set is single-currency.
    if (payload.currency !== currency) continue;
    latestIrsMtmMinor.set(tid, BigInt(Math.round(payload.npvClosingMinor)));
  }

  const latestFxMtmMinor = new Map<string, bigint>();
  for (const ev of eventStore.replay({ type: "FxPositionRevalued", asOf })) {
    const payload = ev.payload as {
      tradeId?: string;
      unrealisedPnlZarMinor?: number;
    };
    const tid = typeof payload.tradeId === "string" ? payload.tradeId : undefined;
    if (!tid || !tradeIds.has(tid)) continue;
    if (typeof payload.unrealisedPnlZarMinor !== "number") continue;
    // FxPositionRevalued.unrealisedPnlZarMinor is the *delta* P&L for the
    // revaluation period — to obtain the cumulative MTM since trade
    // inception, sum the deltas. We hold the running total per tradeId.
    const prev = latestFxMtmMinor.get(tid) ?? 0n;
    latestFxMtmMinor.set(tid, prev + BigInt(Math.round(payload.unrealisedPnlZarMinor)));
    // FX MTM is by convention ZAR-denominated — only contribute when the
    // netting set currency is ZAR.
  }

  // Step 3: sum.
  let total = 0n;
  for (const v of latestIrsMtmMinor.values()) total += v;
  // FX P&L only contributes to ZAR netting sets (FxPositionRevalued is
  // ZAR-denominated by schema).
  if (currency === "ZAR") {
    for (const v of latestFxMtmMinor.values()) total += v;
  }

  return minor(total, currency as never);
}

// ---------------------------------------------------------------------------
// resolveCollateral — auto-resolve the netting set's haircut-adjusted
// collateral by querying `getCollateralInventory()`.
//
// v1 limitation: the collateral inventory is a bank-level pool, not yet
// allocated to specific netting sets. This helper returns the total
// haircut-adjusted ZAR pool when the netting set currency = ZAR; zero
// otherwise. When `D-CSA-COLLATERAL-ALLOCATION` lands (future), this
// helper switches to a netting-set-keyed lookup.
//
// Build-phase status: with zero positions in the inventory the helper
// returns zero — matches the v0 default of caller passing zero collateral.
// ---------------------------------------------------------------------------

interface NettingSetCollateralInputs {
  nettingSetId: string;
  currency: string;
  asOf: string;
}

export function resolveCollateral(inputs: NettingSetCollateralInputs): Money {
  const { currency, asOf } = inputs;
  // Build-phase: per-netting-set allocation not yet wired. Return zero
  // for non-ZAR netting sets (the inventory is ZAR-denominated).
  if (currency !== "ZAR") return minor(0n, currency as never);
  const inv = getCollateralInventory(asOf);
  const totalZar = inv.totalHQLAZar; // already haircut-adjusted
  // Convert ZAR major (rand) → minor (cents). The inventory carries
  // major-currency units (number); SA-CCR everywhere uses minor BigInt.
  const minorAmount = BigInt(Math.round(totalZar * 100));
  return minor(minorAmount, currency as never);
}

// ---------------------------------------------------------------------------
// ComputeAndEmitInput — caller-threaded inputs. `vMtm` + `collateralHeld`
// are now optional (auto-resolve when omitted). All Money values must
// share the netting-set currency.
// ---------------------------------------------------------------------------

export interface ComputeAndEmitInput {
  nettingSet: NettingSet;
  /** Net mark-to-market of the netting set. Signed Money in netting-set
   * ccy. Optional — when omitted, `resolveMtm` queries the event store. */
  vMtm?: Money;
  /** Net collateral held against the netting set. Non-negative Money.
   * Optional — when omitted, `resolveCollateral` queries the inventory. */
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
// Returns the RC, the EAD, and the emitted RC event so callers + tests
// can observe the engine's output without re-reading from the event store.
//
// Emits two events on the same call:
//   1. `CcrReplacementCostComputed` — RC component (BCBS d317 §136);
//      preserved at the netting-set level for audit + Vera recon.
//   2. `CcrEadComputed` — composed EAD = α × (RC + PFE) (BCBS d317 §10 /
//      Credit Risk Policy §3 line 131). Carries the chain back to the RC
//      event via `sourceEvents.rcEventId`.
//
// The credit-limit engine (`pre-deal-check.ts`) prefers `CcrEadComputed`
// over `CcrReplacementCostComputed` when both are present. The RC-only
// fallback remains for back-compat with seeded fixtures and any path
// that emits RC without composing an EAD.
// ---------------------------------------------------------------------------

export function computeAndEmit(input: ComputeAndEmitInput): ComputeAndEmitResult {
  const asOf = input.asOf ?? utcNow();

  // 1. Resolve MTM (caller-supplied or auto-resolved from event store).
  const vMtm =
    input.vMtm ??
    resolveMtm({
      counterpartyId: input.nettingSet.counterpartyId,
      currency: input.nettingSet.currency,
      asOf,
    });

  // 2. Resolve collateral (caller-supplied or auto-resolved from inventory).
  const collateralHeld =
    input.collateralHeld ??
    resolveCollateral({
      nettingSetId: input.nettingSet.nettingSetId,
      currency: input.nettingSet.currency,
      asOf,
    });

  // 3. Pure RC.
  const rc = computeReplacementCost(input.nettingSet, vMtm, collateralHeld, asOf);

  // 4. Pure add-on aggregation. Trades may be empty (zero PFE).
  //    `margined` flag is forwarded from the netting set config — drives
  //    the maturity-factor schedule choice (BCBS d317 §164).
  const addOns = computeAddOn(input.trades, { margined: input.nettingSet.csaPresent });

  // 5. Pure EAD composition (applies BCBS d317 §149 multiplier).
  const ead = computeEad(rc, addOns, {
    counterpartyId: input.nettingSet.counterpartyId,
    asOf,
  });

  // 6. Emit. computationDate is the date portion of asOf (per the event
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
      vMtm: Number(vMtm.amount),
      collateralHeld: Number(collateralHeld.amount),
    },
    eventId: newEventId(),
  });

  eventStore.append(event);

  // 5. Emit CcrEadComputed alongside RC. Composes EAD = α × (RC + PFE).
  //    Chain link back to the RC event via sourceEvents.rcEventId, and
  //    record the number of AddOnComponent rows feeding PFE.
  const eadEvent = makeCcrEadComputed({
    asOf,
    entity: String(BANK_ZA_001),
    actor,
    citations: input.citations ?? DEFAULT_CITATIONS,
    payload: {
      nettingSetId: input.nettingSet.nettingSetId,
      counterpartyId: input.nettingSet.counterpartyId,
      rc: Number(rc.rc.amount),
      pfe: Number(ead.pfe.amount),
      alpha: 1.4,
      ead: Number(ead.ead.amount),
      currency: input.nettingSet.currency,
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

  return { rc, ead, event };
}

// ---------------------------------------------------------------------------
// computeAndEmitFor — register-resolved entry. Looks up the active
// netting set for `(counterpartyId, currency)` from the Phase-5
// netting-set register (`@platform/markets/netting-sets`) and forwards
// to `computeAndEmit`. Returns `null` when the register holds no active
// assessment for the pair — callers decide whether to fall back to a
// trade-by-trade computation or to refuse the trade pending ISDA / CSA
// onboarding.
//
// Citations:
//   Policies/credit-risk-policy-v1.md §3 line 136 (netting-enforceability
//     prerequisite);
//   D-CREDIT-LIMIT-ENGINE-BUILD Phase 5.
// ---------------------------------------------------------------------------

export interface ComputeAndEmitForInput {
  counterpartyId: string;
  currency: string;
  /** Optional — when omitted, `resolveMtm` queries the event store. */
  vMtm?: Money;
  /** Optional — when omitted, `resolveCollateral` queries the inventory. */
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
