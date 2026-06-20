// platform/risk/sa-ccr/eod-saccr-ead-v2.ts
//
// M7 — EOD-driven SA-CCR EAD over the SIMULATED FX cohort. SUT side.
//
// This is a SUT cadence job (Counterparty Credit Risk): at each EOD boundary the
// Phase-0 bus fires it; it folds the bank's OWN booked FIL FX instruments
// (`FilInstrumentCreated`, assetClass "fx") into SA-CCR netting-set groups,
// resolves each netting set's CSA terms + posted collateral from the SUT's own
// events (CounterpartyProvisioned for csaPresent; the day's net MtM for vMtm; the
// collateral register for posted collateral — M8), runs the VALIDATED v2 SA-CCR
// FIL-Model (`computeSaCcr`, V1-free, store-agnostic, decimal-native), and emits
// the SUT-internal CCR events (`CcrReplacementCostComputed` + `CcrEadComputed`)
// to the SCENARIO store — feeding RWA.
//
// WHY NOT `compute-and-emit.ts` DIRECTLY: that emitter imports the GLOBAL
// `eventStore` singleton from `platform/composition` and reads vMtm/collateral
// from production FIL-mediated feeds bound to that store. The simulator runs over
// an ISOLATED in-memory scenario store; coupling to the global store would break
// the scenario boundary AND read a flat book. This SUT job folds the SCENARIO
// cohort and threads the scenario store explicitly — reusing ONLY the pure,
// store-agnostic `computeSaCcr` methodology (the same one `compute-and-emit`
// runs), so the SA-CCR arithmetic is identical; only the data-access path differs.
//
// CORRECTNESS is judged AGAINST THE SIMULATOR (known exposures + collateral →
// expected EAD), NOT a V1 parity gate (D-FX-V2-SIMULATOR-FIRST).
//
// CURRENCY: the FX FIL notional is in the BASE currency (e.g. USD); the netting
// set is reporting-currency (ZAR) denominated. The notional is translated to the
// reporting currency at the day's PRODUCTION spot mark (the same mark the daily
// P&L / VaR hooks read) — a simulated tick never leaks into this SUT read.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CREDIT-LIMIT-ENGINE-BUILD Phase 5; D-FIL-FRAMEWORK-UNIFICATION;
//   BCBS d317 §10/§136 / CRE52 (SA-CCR). Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import { type Money as V2Money, money as v2Money } from "../../../v2-core/fil-core/primitives";
import {
  type SaCcrNettingSet,
  type SaCcrTradeSummary,
  computeSaCcr,
} from "../../../v2-core/fil-models/sa-ccr";
import { remainingYears } from "../../../v2-core/fil-instances";
import { moneyWireFromMinor } from "../../core/money-codec";
import {
  makeCcrEadComputed,
  makeCcrReplacementCostComputed,
} from "../../event-store/event-types/counterparty-credit-risk";
import type { EventStore } from "../../event-store/store";
import { type MarketDataStore, lookupQuoteWithInverse } from "../../market-data/store";
import { computeCohortPnL } from "../../product-control/eod-cohort-pnl-v2";

const ENTITY = "LE-ZA-HOZ-BANK";
const SUT_ACTOR = { type: "service" as const, id: "agent:sut:sa-ccr-engine" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST", "D-CREDIT-LIMIT-ENGINE-BUILD"];

/** v2 decimal-native Money in MAJOR units from a major-unit number (2dp). */
function reportingMoney(majorUnits: number, currency: string): V2Money {
  // round to 2dp via fixed; the SA-CCR model re-rounds HALF_EVEN at its boundary.
  return v2Money(currency, majorUnits.toFixed(2));
}

/** Convert a v2 decimal-native Money (MAJOR units) to integer minor units for the
 *  legacy CCR `rc`/`vMtm`/`collateralHeld` integer fields (2dp ⇒ × 100). */
function v2MoneyToMinorNumber(m: V2Money): number {
  // amount is a 2dp-or-less decimal string; × 100 with rounding is exact.
  return Math.round(Number(m.amount) * 100);
}

interface CohortNettingGroup {
  readonly nettingSetId: string;
  readonly counterpartyId: string;
  readonly csaPresent: boolean;
  readonly trades: SaCcrTradeSummary[];
}

export interface SaCcrEadCohortResult {
  readonly reportDate: string;
  readonly reporting: string;
  /** Netting sets that EMITTED CcrReplacementCostComputed + CcrEadComputed. */
  readonly emitted: readonly string[];
  /** Netting sets skipped because already computed for this date (idempotent). */
  readonly skippedAlreadyComputed: readonly string[];
  /** Per-netting-set EAD figures (reporting minor units) — for the oracle assertion. */
  readonly figures: ReadonlyMap<string, { rc: number; pfe: number; ead: number }>;
}

/**
 * Resolve the posted-collateral amount (reporting MAJOR units) held against a
 * netting set as-of `asOf`, from the M8 collateral register events
 * (`CollateralPosted` net of `CollateralReturned`). RC = max(V − C, …). Returns 0
 * when no collateral has been posted (the M7-only path). Non-negative.
 */
function resolvePostedCollateralMajor(
  store: EventStore,
  nettingSetId: string,
  asOf: string,
): number {
  let net = 0;
  for (const e of store.replay({ type: "CollateralPosted" })) {
    const p = e.payload as { nettingSetId?: string; amountMajor?: number; postedAt?: string };
    if (p.nettingSetId !== nettingSetId) continue;
    if (p.postedAt && p.postedAt > asOf) continue;
    net += Math.abs(p.amountMajor ?? 0);
  }
  for (const e of store.replay({ type: "CollateralReturned" })) {
    const p = e.payload as { nettingSetId?: string; amountMajor?: number; returnedAt?: string };
    if (p.nettingSetId !== nettingSetId) continue;
    if (p.returnedAt && p.returnedAt > asOf) continue;
    net -= Math.abs(p.amountMajor ?? 0);
  }
  return Math.max(0, net);
}

/**
 * Fold the bank's live FX FIL cohort into SA-CCR netting-set groups, as of
 * `asOf`. Notional is translated BASE→reporting at the day's PRODUCTION spot mark.
 * csaPresent is resolved from the SUT's `CounterpartyProvisioned` record. A
 * terminated FX instrument is dropped (its exposure has settled into cash, which
 * is NOT a SA-CCR add-on — D-CASH-ASSET-CLASS-V1).
 */
function foldCohortNettingGroups(
  eventStore: EventStore,
  marketDataStore: MarketDataStore,
  reporting: string,
  asOf: string,
): CohortNettingGroup[] {
  // CSA presence per counterparty (SUT provisioning record).
  const csaByCounterparty = new Map<string, boolean>();
  for (const e of eventStore.replay({ type: "CounterpartyProvisioned" })) {
    const p = e.payload as { counterpartyId?: string; csaInScope?: boolean };
    if (p.counterpartyId) csaByCounterparty.set(p.counterpartyId, p.csaInScope === true);
  }

  const terminated = new Set<string>();
  for (const e of eventStore.replay({ type: "FilInstrumentTerminated" })) {
    const inst = (e.payload as { instance?: string }).instance;
    if (inst) terminated.add(inst);
  }

  const groups = new Map<string, CohortNettingGroup>();
  for (const e of eventStore.replay({ type: "FilInstrumentCreated" })) {
    const p = e.payload as Record<string, unknown>;
    const economic = p.economicTerms as Record<string, unknown> | undefined;
    if (!economic || economic.assetClass !== "fx") continue;
    const instance = p.instance as string | undefined;
    if (!instance || terminated.has(instance)) continue;
    if (new Date(e.as_of).getTime() > new Date(asOf).getTime()) continue;

    const counterpartyId = (economic.counterpartyId as string | undefined) ?? "";
    const nettingSetId = (economic.nettingSetId as string | undefined) ?? "";
    const base = (economic.currency as string | undefined) ?? "";
    const direction = (economic.direction as "long" | "short" | undefined) ?? "long";
    const notional = economic.notional as { amount?: string } | undefined;
    const settlementDate = (economic.settlementDate as string | undefined) ?? "";
    const hedgingSetTag = (economic.hedgingSetTag as string | undefined) ?? "";
    if (!counterpartyId || !nettingSetId || !base || !notional?.amount) continue;

    // Translate the BASE notional to the reporting currency at the production spot.
    const baseNotional = Number(notional.amount);
    if (!Number.isFinite(baseNotional) || baseNotional <= 0) continue;
    let reportingNotional = baseNotional;
    if (base !== reporting) {
      const quote = lookupQuoteWithInverse(marketDataStore, `${base}/${reporting}`, {
        provenance: "production",
      });
      if (!quote || quote.rate <= 0) continue; // no usable mark — fail-closed (skip)
      reportingNotional = baseNotional * quote.rate;
    }

    const trade: SaCcrTradeSummary = {
      tradeId: instance.split(":").pop() ?? instance,
      counterpartyId,
      nettingSetId,
      assetClass: "fx",
      notional: reportingMoney(reportingNotional, reporting),
      direction,
      remainingYears: remainingYears(settlementDate, asOf),
      currency: reporting,
      hedgingSetTag: hedgingSetTag || `${base}/${reporting}`,
    };

    const grp = groups.get(nettingSetId);
    if (grp) grp.trades.push(trade);
    else
      groups.set(nettingSetId, {
        nettingSetId,
        counterpartyId,
        csaPresent: csaByCounterparty.get(counterpartyId) === true,
        trades: [trade],
      });
  }

  return [...groups.values()];
}

/**
 * Compute + emit SA-CCR RC + EAD for the simulated FX cohort as of the EOD
 * boundary `asOf` (reportDate = its date). Idempotent per (nettingSetId,
 * computationDate). Emits to the SCENARIO `eventStore`. Returns the per-netting-
 * set figures (reporting minor units) for the simulator-oracle assertion.
 */
export function computeAndEmitCohortSaCcrEad(args: {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
  readonly reporting: string;
  readonly reportDate: string;
  readonly asOf: string;
  /** Booked rate per FX instance URN — the simulator's known input (for vMtm). */
  readonly bookedRateByInstance: ReadonlyMap<string, number>;
}): SaCcrEadCohortResult {
  const { eventStore, marketDataStore, reporting, reportDate, asOf, bookedRateByInstance } = args;

  const groups = foldCohortNettingGroups(eventStore, marketDataStore, reporting, asOf);

  // Per-netting-set net MtM (vMtm) from the day's cohort P&L. The P&L row is
  // keyed by instance URN; we re-group it by netting set via the FX cohort.
  const pnl = computeCohortPnL({
    eventStore,
    marketDataStore,
    reporting,
    reportDate,
    bookedRateByInstance,
  });
  const vMtmByNettingSet = vMtmByNettingSetFromPnl(eventStore, pnl);

  // Idempotency: netting sets already EAD-computed for this date.
  const computationDate = asOf.slice(0, 10);
  const alreadyComputed = new Set<string>();
  for (const ev of eventStore.replay({ type: "CcrEadComputed" })) {
    const p = ev.payload as { computationDate?: string; nettingSetId?: string };
    if (p.computationDate === computationDate && p.nettingSetId) alreadyComputed.add(p.nettingSetId);
  }

  const emitted: string[] = [];
  const skippedAlreadyComputed: string[] = [];
  const figures = new Map<string, { rc: number; pfe: number; ead: number }>();

  for (const grp of groups) {
    if (alreadyComputed.has(grp.nettingSetId)) {
      skippedAlreadyComputed.push(grp.nettingSetId);
      continue;
    }

    const vMtmMajor = vMtmByNettingSet.get(grp.nettingSetId) ?? 0;
    const collateralMajor = resolvePostedCollateralMajor(eventStore, grp.nettingSetId, asOf);

    const nettingSet: SaCcrNettingSet = grp.csaPresent
      ? {
          nettingSetId: grp.nettingSetId,
          counterpartyId: grp.counterpartyId,
          csaPresent: true,
          currency: reporting,
          // CSA terms — threshold + MTA. Zero-threshold CSA is the common IG case
          // (Credit Risk Policy §3 line 137); M8 enriches these from CSA elections.
          threshold: reportingMoney(0, reporting),
          mta: reportingMoney(0, reporting),
        }
      : {
          nettingSetId: grp.nettingSetId,
          counterpartyId: grp.counterpartyId,
          csaPresent: false,
          currency: reporting,
        };

    const { rc, ead, addOns } = computeSaCcr({
      nettingSet,
      vMtm: reportingMoney(vMtmMajor, reporting),
      collateralHeld: reportingMoney(collateralMajor, reporting),
      trades: grp.trades,
      asOf,
    });

    const rcMinor = v2MoneyToMinorNumber(rc.rc);
    const pfeMinor = v2MoneyToMinorNumber(ead.pfe);
    const eadMinor = v2MoneyToMinorNumber(ead.ead);
    const vMtmMinor = v2MoneyToMinorNumber(reportingMoney(vMtmMajor, reporting));
    const collateralMinor = v2MoneyToMinorNumber(reportingMoney(collateralMajor, reporting));

    const rcEvent = makeCcrReplacementCostComputed({
      asOf,
      entity: ENTITY,
      actor: SUT_ACTOR,
      citations: CITATIONS,
      eventId: `${grp.nettingSetId}:${computationDate}:rc`,
      payload: {
        nettingSetId: grp.nettingSetId,
        counterpartyId: grp.counterpartyId,
        rc: Math.max(0, rcMinor),
        currency: reporting,
        computationDate,
        methodology: "sa-ccr",
        vMtm: vMtmMinor,
        collateralHeld: Math.max(0, collateralMinor),
      },
    });
    eventStore.append(rcEvent);

    eventStore.append(
      makeCcrEadComputed({
        asOf,
        entity: ENTITY,
        actor: SUT_ACTOR,
        citations: CITATIONS,
        eventId: `${grp.nettingSetId}:${computationDate}:ead`,
        payload: {
          nettingSetId: grp.nettingSetId,
          counterpartyId: grp.counterpartyId,
          rc: moneyWireFromMinor(Math.max(0, rcMinor), reporting),
          pfe: moneyWireFromMinor(Math.max(0, pfeMinor), reporting),
          alpha: 1.4,
          ead: moneyWireFromMinor(Math.max(0, eadMinor), reporting),
          currency: reporting,
          computationDate,
          methodology: "sa-ccr",
          sourceEvents: { rcEventId: rcEvent.event_id, pfeComponents: addOns.length },
        },
      }),
    );

    emitted.push(grp.nettingSetId);
    figures.set(grp.nettingSetId, {
      rc: Math.max(0, rcMinor),
      pfe: Math.max(0, pfeMinor),
      ead: Math.max(0, eadMinor),
    });
  }

  return { reportDate, reporting, emitted, skippedAlreadyComputed, figures };
}

/** Re-group the daily-P&L rows (keyed by instance) into per-netting-set net MtM
 *  (reporting major units), via the FX cohort's instance → netting-set map. */
function vMtmByNettingSetFromPnl(
  eventStore: EventStore,
  pnl: ReturnType<typeof computeCohortPnL>,
): Map<string, number> {
  const nettingSetByInstance = new Map<string, string>();
  for (const e of eventStore.replay({ type: "FilInstrumentCreated" })) {
    const p = e.payload as Record<string, unknown>;
    const economic = p.economicTerms as Record<string, unknown> | undefined;
    if (!economic || economic.assetClass !== "fx") continue;
    const instance = p.instance as string | undefined;
    const nettingSetId = economic.nettingSetId as string | undefined;
    if (instance && nettingSetId) nettingSetByInstance.set(instance, nettingSetId);
  }

  const byNettingSet = new Map<string, number>();
  for (const row of pnl.rows) {
    if (row.markStatus !== "live") continue;
    const nsId = nettingSetByInstance.get(row.instance);
    if (!nsId) continue;
    byNettingSet.set(nsId, (byNettingSet.get(nsId) ?? 0) + row.unrealisedReporting);
  }
  return byNettingSet;
}
