// platform/market-risk/cva-engine.ts
//
// Counterparty Credit Valuation Adjustment (CVA) engine — a standardised CVA
// over the bank's uncollateralised OTC derivative book (IRS + FX
// forward/swap). Closes the final declared model-scope gap in RISK-MRP-01
// (Model Risk Policy v1) §1.1: counterparty-credit-risk / CVA is in declared
// model scope but was ungoverned and uncomputed — CVA was referenced only as
// an optional passthrough input `cvaRwaMinor` to the `rwa` binding (BA 600 owns
// the regulatory RWA charge). This module governs the CVA *figure* itself.
//
// METHODOLOGY (documented + chosen standard):
//   The bank elects a STANDARDISED / accounting-CVA formula, the build-phase
//   analogue of the Basel BA-CVA standardised approach (BCBS d424 MAR50) and the
//   IFRS 13 fair-value CVA: per counterparty,
//
//     CVA_cp = LGD × EAD_cp × PD_cp × discount
//
//   aggregated across counterparties as a simple (no-hedge, no-correlation) sum.
//   This is conservative — it ignores the BA-CVA correlation/hedge offsets — and
//   is the most defensible method when the OTC book is small and a full SA-CVA
//   sensitivity engine is not yet built.
//
//   - EAD_cp (Exposure At Default): a current-exposure + add-on, computed
//     instrument-by-instrument over the COUNTERPARTY's uncollateralised OTC
//     positions, then netted to the counterparty level (a single netting set
//     per counterparty in the build phase — no cross-counterparty netting):
//       * IRS: positive mark-to-market (current exposure; CVA applies to
//         positive exposure only — a negative MTM is the counterparty's
//         exposure to us, not ours to them) PLUS a notional-based
//         potential-future-exposure (PFE) add-on (IRS_PFE_ADDON_FRACTION ×
//         notional, a documented build-phase add-on; the SA-CCR supervisory
//         factors that would normally drive the add-on are PRESCRIBED INPUTS
//         and explicitly OUT OF SCOPE per the Slice-5 exclusions).
//       * FX forward / swap: positive net ZAR exposure on the open
//         (unsettled) legs PLUS an FX PFE add-on (FX_PFE_ADDON_FRACTION ×
//         |net ZAR notional|). FX spot is excluded — it settles T+2 and carries
//         settlement risk, not the term counterparty-credit-risk CVA addresses.
//   - PD_cp (Probability of Default over the exposure horizon): derived from a
//     live credit spread for the counterparty where the market-data
//     infrastructure (Ravi) carries one (credit-default-swap / bond-spread
//     instrument `cds:<partyId>` or `credit-spread:<partyId>`), via the standard
//     credit-triangle approximation PD ≈ 1 − exp(−spread × horizon / LGD).
//     Where no live spread exists, PD falls back to a DOCUMENTED standardised
//     counterparty weight by counterparty class (a loud requireWeight lookup —
//     an unknown class fails, never a silent 0% PD).
//   - LGD (Loss Given Default): the Basel-CVA standard 60% for senior
//     uncollateralised derivative exposure (CVA_LGD_DEFAULT).
//   - discount: a single build-phase discount factor over the average exposure
//     horizon (CVA_DISCOUNT_FACTOR); a full discounted-EPE profile is a
//     licence-day extension.
//
// NO SILENT ZEROS (objective 4 of D-TRUSTED-FIGURES-PROGRAM-V1): a CVA figure is
// surfaced ONLY when there is genuine uncollateralised OTC exposure AND a
// resolvable PD (live spread or a documented fallback weight) for every
// exposed counterparty. Otherwise the report carries a loud, reasoned `status`:
//   - `no-otc-exposure`        — the OTC book carries no uncollateralised
//                                positive exposure (no IRS/FX-forward positions,
//                                or every position is net-negative MTM to us).
//                                CVA is 0 by absence of exposure, surfaced
//                                loudly, never an unexplained 0.
//   - `insufficient-credit-inputs` — there IS uncollateralised OTC exposure but
//                                one or more exposed counterparties has neither a
//                                live credit spread nor a resolvable fallback
//                                weight. A CVA derived from a missing PD would be
//                                a silent under-statement → degraded, output
//                                null, surfaced on the /api/data-failures banner.
//   - `computed`               — genuine exposure + resolvable PD for every
//                                exposed counterparty → real figure.
//
// GOVERNANCE (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5 — workstream close): the
// surfaced figure binds in CALC_BINDINGS (calcKey `cva`; model:cva-engine-v1;
// owned by Helena (Chief Risk Officer, governance)). It consumes the CVA
// exposure / EPE sub-model (model:cva-exposure-epe-v1) that derives the
// counterparty-level EAD from the live OTC book. This is the LAST open class in
// RISK-MRP-01 §1.1 — landing it makes the policy's declared model scope and the
// enforced CALC_BINDINGS registry fully coherent.
//
// Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (Slice 5, CEO session-delegation
//   2026-05-29); RISK-MRP-01 §1.1, §2; BCBS d424 (BA-CVA) MAR50; IFRS 13.
// Author: Rohan (Risk systems engineer, engineering), built under
//   D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5 coordinated by Helena (Chief Risk
//   Officer, governance — model-risk-policy owner + methodology accountability),
//   validated by Nadia (Independent-validation engineer), with counterparty
//   credit-spread inputs supplied by Ravi (market-data infrastructure engineer).

import type { IrdSwapPositionRevaluedPayload } from "../event-store/event-types/ird-accounting";
import type { EventStore } from "../event-store/store";
import type { MarketDataStore } from "../market-data/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import type { IrsTradeBookedPayload } from "../markets/cdm/ird";
import { type FinancialInput, absent, present, requireWeight } from "../types/financial-input";

// ---------------------------------------------------------------------------
// Constants — documented build-phase CVA parameters.
// ---------------------------------------------------------------------------

/**
 * Loss Given Default for senior uncollateralised derivative exposure. The
 * Basel CVA standard (BCBS d424 MAR50) and IFRS 13 fair-value CVA both use a
 * 60% LGD for uncollateralised counterparty exposure where no recovery
 * estimate is modelled. Held as a named constant so the assumption is explicit.
 */
export const CVA_LGD_DEFAULT = 0.6;

/**
 * Single build-phase discount factor applied over the average exposure horizon.
 * A full discounted expected-positive-exposure (EPE) profile is a licence-day
 * extension; this is the documented approximation, not a silent 1.0.
 */
export const CVA_DISCOUNT_FACTOR = 0.97;

/**
 * Exposure horizon (years) the PD is taken over. Build-phase OTC book is
 * short-dated; the credit-triangle PD is computed over this horizon.
 */
export const CVA_EXPOSURE_HORIZON_YEARS = 1;

/**
 * IRS potential-future-exposure add-on as a fraction of notional. A documented
 * build-phase substitute for the SA-CCR supervisory factor (which is a
 * PRESCRIBED input, explicitly OUT OF SCOPE per the Slice-5 exclusions). 0.5%
 * of notional is a conservative interest-rate add-on for short-dated swaps.
 */
export const IRS_PFE_ADDON_FRACTION = 0.005;

/**
 * FX forward/swap PFE add-on as a fraction of |net ZAR notional|. Documented
 * build-phase substitute for the SA-CCR FX supervisory factor (out of scope).
 * 1% of notional is a conservative FX add-on.
 */
export const FX_PFE_ADDON_FRACTION = 0.01;

/**
 * Fallback standardised PD-equivalent weight by counterparty class, used ONLY
 * when no live credit spread exists for the counterparty. A loud requireWeight
 * lookup — an unknown class FAILS (never a silent 0% PD that would zero the CVA
 * contribution). These are documented build-phase weights consistent with the
 * pre-licence risk appetite (bank/sovereign counterparties carry a low default
 * weight; corporate higher; an unrated/other class is the most conservative).
 */
const FALLBACK_PD_BY_CLASS: Readonly<Record<string, number>> = {
  bank: 0.005, // 50 bps — investment-grade bank counterparty
  sovereign: 0.003, // 30 bps — sovereign / central-bank
  corporate: 0.02, // 200 bps — corporate counterparty
  other: 0.03, // 300 bps — unrated / other (most conservative)
};

/** Resolve a counterparty's class from its Party role + jurisdiction heuristics. */
export function counterpartyClass(party: {
  partyId: string;
  name?: string;
  role?: string;
  jurisdiction?: string;
}): string {
  const id = party.partyId.toLowerCase();
  const name = (party.name ?? "").toLowerCase();
  if (id.includes("sovereign") || id.includes("sarb") || name.includes("reserve bank")) {
    return "sovereign";
  }
  if (id.includes("bank") || name.includes("bank")) return "bank";
  if (id.includes("corp") || name.includes("corp") || name.includes("ltd")) return "corporate";
  return "other";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CvaStatus = "computed" | "no-otc-exposure" | "insufficient-credit-inputs";

export type PdSource = "live-spread" | "fallback-weight";

/** One counterparty's CVA building blocks. */
export interface CounterpartyExposure {
  /** Stable counterparty Party id. */
  readonly counterpartyId: string;
  readonly counterpartyName: string;
  /** Counterparty class used for the fallback PD lookup. */
  readonly counterpartyClass: string;
  /** Netted positive EAD over the counterparty's uncollateralised OTC book, ZAR. */
  readonly eadZar: number;
  /** PD over the exposure horizon (decimal). null when neither spread nor fallback resolved. */
  readonly pd: number | null;
  /** Where the PD came from. */
  readonly pdSource: PdSource | null;
  /** This counterparty's CVA contribution, ZAR (null when PD unresolved). */
  readonly cvaZar: number | null;
}

export interface CvaReport {
  readonly asOf: string;
  readonly currency: string;
  readonly status: CvaStatus;
  /** Per-counterparty exposure breakdown the figure was (or would be) derived from. */
  readonly counterparties: readonly CounterpartyExposure[];
  /** Number of counterparties with positive uncollateralised OTC exposure. */
  readonly exposedCounterparties: number;
  /**
   * CVA — total counterparty credit valuation adjustment, ZAR positive
   * magnitude. `present` only when status is `computed`.
   */
  readonly cva: FinancialInput<number>;
}

// ---------------------------------------------------------------------------
// PD sourcing
// ---------------------------------------------------------------------------

/**
 * The live credit spread (decimal, e.g. 0.012 = 120 bps) for a counterparty
 * from the MarketDataStore, if one is carried. Looks for a credit-spread tick
 * keyed by `credit-spread:<partyId>` or `cds:<partyId>` (production provenance —
 * a simulation spread must never contaminate a live CVA). Returns null when no
 * usable spread exists.
 */
export function counterpartyCreditSpread(
  marketData: MarketDataStore,
  counterpartyId: string,
  asOf: string,
): number | null {
  for (const instrument of [`credit-spread:${counterpartyId}`, `cds:${counterpartyId}`]) {
    const ticks = marketData.query({
      provenance: "production",
      instrument,
      dataType: "credit-spread",
      to: asOf,
      limit: 1,
    });
    const latest = ticks[0];
    if (!latest) continue;
    const payload = latest.payload as Record<string, unknown>;
    const raw = payload.spread ?? payload.value ?? payload.mid;
    const spread = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(spread) && spread > 0) return spread;
  }
  return null;
}

/**
 * PD over the exposure horizon for a counterparty. Prefers a live credit spread
 * via the standard credit-triangle approximation PD ≈ 1 − exp(−spread × T / LGD);
 * falls back to the documented standardised weight by counterparty class. The
 * fallback is a LOUD requireWeight lookup — an unknown class throws, never a
 * silent 0% PD. Returns the PD + its source, or null when neither resolves
 * (an unrecognised class with no spread → caller degrades the figure).
 */
export function resolvePd(
  marketData: MarketDataStore,
  party: { counterpartyId: string; counterpartyClass: string },
  asOf: string,
): { pd: number; source: PdSource } | null {
  const spread = counterpartyCreditSpread(marketData, party.counterpartyId, asOf);
  if (spread !== null) {
    // Credit triangle: PD over horizon T = 1 − exp(−s·T / LGD).
    const pd = 1 - Math.exp((-spread * CVA_EXPOSURE_HORIZON_YEARS) / CVA_LGD_DEFAULT);
    return { pd: Math.min(Math.max(pd, 0), 1), source: "live-spread" };
  }
  // Fallback: documented standardised weight by class. Loud — unknown class
  // is not in the table → requireWeight throws → caller treats as unresolved.
  try {
    const pd = requireWeight(FALLBACK_PD_BY_CLASS, party.counterpartyClass, "CVA fallback PD");
    return { pd, source: "fallback-weight" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exposure derivation (the CVA exposure / EPE sub-model, model:cva-exposure-epe-v1)
// ---------------------------------------------------------------------------

interface PartyRef {
  partyId: string;
  name: string;
  role?: string;
  jurisdiction?: string;
}

/**
 * Derive the counterparty-level netted positive EAD over the live
 * uncollateralised OTC derivative book (IRS + FX forward/swap). Spot FX is
 * excluded (settlement, not term counterparty-credit risk). Settled / matured
 * trades are excluded. This is the CVA exposure / EPE sub-model
 * (model:cva-exposure-epe-v1): it maps the live OTC book to a per-counterparty
 * EAD = max(0, Σ current MTM) + Σ PFE add-on, a single netting set per
 * counterparty.
 */
export function deriveCounterpartyExposures(args: {
  readonly eventStore: EventStore;
  readonly asOf: string;
}): Map<string, { party: PartyRef; currentExposureZar: number; pfeAddonZar: number }> {
  const { eventStore, asOf } = args;

  // Closed trades (settled / matured) are excluded from open exposure.
  const closedTradeIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "SettlementConfirmed", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedTradeIds.add(p.tradeId);
  }
  for (const ev of eventStore.replay({ type: "TradeMatured", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedTradeIds.add(p.tradeId);
  }

  // Per-counterparty accumulators.
  const byParty = new Map<
    string,
    { party: PartyRef; currentExposureZar: number; pfeAddonZar: number }
  >();
  const accFor = (party: PartyRef) => {
    let acc = byParty.get(party.partyId);
    if (!acc) {
      acc = { party, currentExposureZar: 0, pfeAddonZar: 0 };
      byParty.set(party.partyId, acc);
    }
    return acc;
  };

  // ---- IRS book ------------------------------------------------------------
  // Trade → counterparty + notional; latest revaluation → current MTM.
  const irsByTradeId = new Map<string, IrsTradeBookedPayload>();
  for (const ev of eventStore.replay({ type: "IrsTradeBooked", asOf })) {
    const p = ev.payload as unknown as IrsTradeBookedPayload;
    irsByTradeId.set(p.tradeId.value, p);
  }
  // Current MTM is sourced from the accounting IrdSwapPositionRevalued family —
  // the single canonical revaluation fact post D-IRS-FAMILY-CONVERGE-ACCOUNTING.
  // npvClosingMinor is the signed mark-to-market (positive = net asset to bank).
  const irsLatestMtm = new Map<string, number>();
  for (const ev of eventStore.replay({ type: "IrdSwapPositionRevalued", asOf })) {
    const p = ev.payload as unknown as IrdSwapPositionRevaluedPayload;
    // Append-order replay → last write wins for the latest MTM.
    irsLatestMtm.set(p.tradeId, p.npvClosingMinor);
  }
  for (const [tradeId, irs] of irsByTradeId) {
    if (closedTradeIds.has(tradeId)) continue;
    const party: PartyRef = {
      partyId: irs.counterparty.partyId,
      name: irs.counterparty.name,
      role: irs.counterparty.role,
      ...(irs.counterparty.jurisdiction !== undefined
        ? { jurisdiction: irs.counterparty.jurisdiction }
        : {}),
    };
    const acc = accFor(party);
    // Current exposure: positive MTM only (CVA is on the bank's positive
    // exposure to the counterparty). Minor → major ZAR.
    const mtmMinor = irsLatestMtm.get(tradeId) ?? 0;
    if (mtmMinor > 0) acc.currentExposureZar += mtmMinor / 100;
    // PFE add-on: documented fraction of notional (proxy for SA-CCR add-on).
    // Notional is in the fixed-leg currency; build-phase IRS book is ZAR.
    acc.pfeAddonZar += (irs.notional.amountMinor / 100) * IRS_PFE_ADDON_FRACTION;
  }

  // ---- FX forward / swap book ----------------------------------------------
  // Spot is excluded (settlement risk, not term CVA). Exposure is the positive
  // net ZAR value of the unsettled term legs; PFE add-on on |notional|.
  for (const ev of eventStore.replay({ type: "FxTradeExecuted", asOf })) {
    const fx = ev.payload as unknown as FxTradeExecutedPayload;
    if (fx.productTaxonomy === "FX-spot") continue; // term products only
    if (closedTradeIds.has(fx.tradeId.value)) continue;
    const party: PartyRef = {
      partyId: fx.counterparty.partyId,
      name: fx.counterparty.name,
      role: fx.counterparty.role,
      ...(fx.counterparty.jurisdiction !== undefined
        ? { jurisdiction: fx.counterparty.jurisdiction }
        : {}),
    };
    const acc = accFor(party);
    // ZAR notional: the leg whose currency is ZAR (notional or counterNotional).
    // Build-phase OTC FX is ZAR-vs-foreign, so a ZAR leg exists.
    let zarNotionalMinor = 0;
    for (const leg of fx.legs) {
      if (leg.notional.currency === "ZAR") {
        zarNotionalMinor = Math.max(zarNotionalMinor, Math.abs(leg.notional.amountMinor));
      }
      if (leg.counterNotional.currency === "ZAR") {
        zarNotionalMinor = Math.max(zarNotionalMinor, Math.abs(leg.counterNotional.amountMinor));
      }
    }
    const zarNotional = zarNotionalMinor / 100;
    // Current exposure proxy: term FX has no booked MTM stream in the build
    // phase, so current exposure is taken as the PFE add-on alone (a forward
    // at inception has ~zero current exposure; the add-on captures the
    // potential future move). This is conservative and documented.
    acc.pfeAddonZar += zarNotional * FX_PFE_ADDON_FRACTION;
  }

  return byParty;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute the standardised CVA over the live uncollateralised OTC derivative
 * book. Pure read — no appends. NO SILENT ZEROS: the figure is `present` only
 * when there is genuine uncollateralised OTC exposure AND a resolvable PD for
 * every exposed counterparty; otherwise the report carries a loud `status` +
 * `absent` figure.
 */
export function computeCva(args: {
  readonly eventStore: EventStore;
  readonly marketData: MarketDataStore;
  readonly asOf: string;
}): CvaReport {
  const { eventStore, marketData, asOf } = args;
  const exposureMap = deriveCounterpartyExposures({ eventStore, asOf });

  // Build the per-counterparty breakdown, resolving PD for each exposed party.
  const counterparties: CounterpartyExposure[] = [];
  let anyExposure = false;
  let anyUnresolvedPd = false;

  for (const { party, currentExposureZar, pfeAddonZar } of exposureMap.values()) {
    const eadZar = Math.max(0, currentExposureZar) + Math.max(0, pfeAddonZar);
    if (eadZar <= 0) continue; // no positive uncollateralised exposure → skip
    anyExposure = true;
    const cls = counterpartyClass(party);
    const pdResult = resolvePd(
      marketData,
      { counterpartyId: party.partyId, counterpartyClass: cls },
      asOf,
    );
    if (!pdResult) {
      anyUnresolvedPd = true;
      counterparties.push({
        counterpartyId: party.partyId,
        counterpartyName: party.name,
        counterpartyClass: cls,
        eadZar,
        pd: null,
        pdSource: null,
        cvaZar: null,
      });
      continue;
    }
    const cvaZar = CVA_LGD_DEFAULT * eadZar * pdResult.pd * CVA_DISCOUNT_FACTOR;
    counterparties.push({
      counterpartyId: party.partyId,
      counterpartyName: party.name,
      counterpartyClass: cls,
      eadZar,
      pd: pdResult.pd,
      pdSource: pdResult.source,
      cvaZar,
    });
  }

  const exposedCounterparties = counterparties.length;

  // ---- No uncollateralised OTC exposure: CVA is 0 by absence, surfaced loud.
  if (!anyExposure) {
    const reason =
      "OTC derivative book carries no uncollateralised positive exposure — no open IRS / FX-forward / FX-swap positions, or every position is net-negative MTM to the bank";
    const exp =
      "live OTC book (deriveCounterpartyExposures over IrsTradeBooked / IrdSwapPositionRevalued / FxTradeExecuted, spot excluded)";
    return {
      asOf,
      currency: "ZAR",
      status: "no-otc-exposure",
      counterparties,
      exposedCounterparties,
      cva: absent(reason, exp),
    };
  }

  // ---- Exposure but a counterparty PD is unresolvable: degraded, never 0. --
  if (anyUnresolvedPd) {
    const missing = counterparties
      .filter((c) => c.pd === null)
      .map((c) => `${c.counterpartyName} (${c.counterpartyId})`)
      .join(", ");
    const reason = `uncollateralised OTC exposure exists but the probability of default could not be resolved for ${missing} — neither a live credit spread nor a documented fallback weight resolved. A CVA derived from a missing PD would silently under-state counterparty credit risk.`;
    const exp =
      "counterparty credit spread (Ravi — market-data infrastructure: credit-spread:<partyId> / cds:<partyId>) or the documented FALLBACK_PD_BY_CLASS standardised weight";
    return {
      asOf,
      currency: "ZAR",
      status: "insufficient-credit-inputs",
      counterparties,
      exposedCounterparties,
      cva: absent(reason, exp),
    };
  }

  // ---- Genuine exposure + resolvable PD for every counterparty: compute. ---
  const totalCvaZar = counterparties.reduce((s, c) => s + (c.cvaZar ?? 0), 0);
  const lineage = `standardised CVA (Σ LGD × EAD × PD × discount) over ${exposedCounterparties} counterparties; LGD ${CVA_LGD_DEFAULT}, discount ${CVA_DISCOUNT_FACTOR}, horizon ${CVA_EXPOSURE_HORIZON_YEARS}y`;
  return {
    asOf,
    currency: "ZAR",
    status: "computed",
    counterparties,
    exposedCounterparties,
    cva: present(totalCvaZar, lineage),
  };
}
