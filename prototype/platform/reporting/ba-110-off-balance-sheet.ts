// platform/reporting/ba-110-off-balance-sheet.ts
//
// WS-BA-RETURNS-P1-SOURCING Phase 4 — BA 110 (Off-Balance-Sheet Activities)
// generator, events-first.
//
// Form-number authority: the SARB Excel form set — BA 110 = "Off-Balance-Sheet
// Activities" (workbook tab A1 header). Re-numbered forward-only under
// D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO 2026-06-09); see
// Regulations/SARB-PA/ba-returns/_canonical-register.md.
//
// This is a *new* generator: there was no BA 110 off-balance-sheet form
// generator before Phase 4. The legacy `platform/reporting/off-balance-sheet.ts`
// module is a pure projection over caller-supplied entries + forward
// obligations; this module instead folds primary trade events directly from
// the event store under Principle 1 (events are the only source of truth).
//
// Pipeline (Principle 1 — events are truth):
//
//   EVENT LOG          (sole truth)
//      → REPLAY (provenance-filtered, sequence-bounded)
//            IrdSwapTradeExecuted  (less IrdSwapTerminated)   — derivative notionals
//            RepoTradeOpened       (less RepoEndLegSettled /
//                                   RepoTradeTerminatedEarly) — SFT collateral
//            FundingLineCommitmentRecorded
//                                  (less FundingLineDrawn)    — committed-undrawn
//      → BA 110 PROJECTION   — this module — pure fold over the replayed events
//      → RENDER + STORE      — `ba-110-render.ts` + RMS doc store
//      → BA 700 leverage     — CCF-weighted OBS total feeds the leverage exposure
//
// Treatment per the Phase-4 brief:
//
//   Derivative notional — gross notional reported with a documented build-phase
//     CCF (1.00). SA-CCR add-ons / current-exposure-method land downstream;
//     until then the gross notional is the conservative rehearsal posture.
//   SFT collateral      — gross collateral value (face value of posted
//     collateral) for open repos.
//   Committed-undrawn   — (committedAmountMinor − Σ drawnAmountZar) × CCF, where
//     the CCF is taken from the originating FundingLineCommitmentRecorded event.
//
// The CCF-weighted total (`ccfWeightedTotalMinor`) is what feeds the BA 700
// leverage-ratio exposure measure (BCBS §165 — OBS items reported post-CCF).
//
// Per-entity: LE-ZA-HOZ-BANK only at v0 (mirrors the other BA generators'
// solo-entity caveat). Group-consolidated BA 110 deferred under
// D-REGULATORY-PERIMETER.
//
// Authority:
//   - D-BA-RETURNS-P1-SOURCING-WORKSTREAM
//   - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO-approved 2026-06-09)
//   - Principles/1-events-are-truth.md
//   - Banks Act 94 of 1990 §13 (off-balance-sheet obligations disclosure)
//   - Regulations Relating to Banks Reg 23 (off-balance-sheet activities return)
//   - BCBS Basel III §165 (off-balance-sheet credit conversion factors)
//
// Author: Mira (Regulatory reporting engineer, engineering — reports to
//   Camille CFO; BA-returns sourcing).

import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import type { LeverageExposureDecomposition } from "./ba-700-leverage-ratio";

// ---------------------------------------------------------------------------
// Build-phase CCF for derivative notionals.
//
// SA-CCR add-ons / current-exposure-method are not yet wired into a periodic
// projection. Until then, BA 110 reports gross derivative notional with a
// documented conservative CCF of 1.00 (no haircut) so the off-balance-sheet
// exposure is never understated during the build phase.
// ---------------------------------------------------------------------------
export const BA_110_DERIVATIVE_BUILD_PHASE_CCF = 1.0;

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

/**
 * Bank-licence-bound entity short-ids in scope for BA 110. Only Hoz Bank
 * (LE-ZA-HOZ-BANK) at v0 per `Regulations/_legal-entity-tree.md`.
 * Group-consolidated BA 110 deferred under `D-REGULATORY-PERIMETER`.
 */
export const BA_300_LCR_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

export class Ba110OffBalanceSheetGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba110OffBalanceSheetGeneratorError";
  }
}

function assertBankEntity(entity: string): void {
  if (!BA_300_LCR_BANK_ENTITIES.includes(entity)) {
    throw new Ba110OffBalanceSheetGeneratorError(
      `BA 110 (Off-Balance-Sheet Activities) is bank-licence-bound; entity '${entity}' is not in BA_300_LCR_BANK_ENTITIES (${BA_300_LCR_BANK_ENTITIES.join(
        ", ",
      )}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER. Group-consolidated BA 110 deferred under D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** One BA 110 off-balance-sheet line item, post fold. */
export interface Ba110ObsLineItem {
  /** Stable line identifier (`derivatives.<tradeId>`, etc). */
  readonly lineId: string;
  /** Free-form line label for the BA 110 form. */
  readonly lineLabel: string;
  /** Gross (pre-CCF) notional / nominal in minor currency units. */
  readonly grossAmountMinor: number;
  /** Credit conversion factor applied to this line (decimal in [0,1]). */
  readonly creditConversionFactor: number;
  /** CCF-weighted exposure in minor currency units (`grossAmountMinor × CCF`, rounded). */
  readonly ccfWeightedAmountMinor: number;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** Source reference (tradeId / facilityId) for forensic chain-of-custody. */
  readonly sourceRef: string;
  /** Optional note (e.g. build-phase CCF documentation). */
  readonly note?: string;
}

/** A BA 110 section — derivatives, securities-financing, or commitments. */
export interface Ba110ObsSection {
  readonly section: "derivatives" | "securities-financing" | "committed-undrawn";
  readonly lineItems: readonly Ba110ObsLineItem[];
  /** Σ gross amounts across the section's line items (minor units). */
  readonly grossTotalMinor: number;
  /** Σ CCF-weighted amounts across the section's line items (minor units). */
  readonly ccfWeightedTotalMinor: number;
}

/** The full BA 110 generator output. */
export interface Ba110OffBalanceSheet {
  readonly meta: {
    readonly form: "BA 110";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
  };
  readonly derivatives: Ba110ObsSection;
  readonly securitiesFinancing: Ba110ObsSection;
  readonly committedUndrawn: Ba110ObsSection;
  /** Σ gross across all three sections (minor units). */
  readonly grossTotalMinor: number;
  /** Σ CCF-weighted across all three sections (minor units) — feeds BA 700 leverage. */
  readonly ccfWeightedTotalMinor: number;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Event payload shapes (narrow — we only read what we fold)
// ---------------------------------------------------------------------------

interface IrdSwapTradeExecutedShape {
  tradeId?: string;
  notionalMinor?: number;
  currency?: string;
}
interface IrdSwapTerminatedShape {
  tradeId?: string;
}
interface RepoTradeOpenedShape {
  tradeId?: string;
  collateralFaceValue?: number;
}
interface RepoTerminalShape {
  tradeId?: string;
}
interface FundingLineCommitmentRecordedShape {
  facilityId?: string;
  committedAmountMinor?: number;
  currency?: string;
  creditConversionFactor?: number;
}
interface FundingLineDrawnShape {
  fundingLineId?: string;
  drawnAmountZar?: number;
}

// ---------------------------------------------------------------------------
// Replay helper — collect the open / live trade IDs and their first event.
// ---------------------------------------------------------------------------

interface ReplayContext {
  readonly store: EventStore;
  readonly entity: string;
  readonly asOf: string;
  readonly untilSequence: number | undefined;
}

function replayOptsFor(
  ctx: ReplayContext,
  type: string,
): {
  entity: string;
  type: string;
  asOf: string;
  untilSequence?: number;
} {
  return {
    entity: ctx.entity,
    type,
    asOf: ctx.asOf,
    ...(ctx.untilSequence !== undefined ? { untilSequence: ctx.untilSequence } : {}),
  };
}

// ---------------------------------------------------------------------------
// Section folds
// ---------------------------------------------------------------------------

/**
 * Derivative section — IrdSwapTradeExecuted notionals for swaps that have NOT
 * been terminated. Build-phase: gross notional with a documented CCF of 1.00.
 */
function foldDerivativesSection(ctx: ReplayContext, functionalCurrency: string): Ba110ObsSection {
  const provenanceFilter = defaultProvenanceFilter();

  // First pass: collect terminated trade IDs so we exclude them.
  const terminated = new Set<string>();
  for (const ev of ctx.store.replay(replayOptsFor(ctx, "IrdSwapTerminated"))) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as IrdSwapTerminatedShape;
    if (p.tradeId) terminated.add(p.tradeId);
  }

  const lineItems: Ba110ObsLineItem[] = [];
  for (const ev of ctx.store.replay(replayOptsFor(ctx, "IrdSwapTradeExecuted"))) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as IrdSwapTradeExecutedShape;
    const tradeId = p.tradeId;
    const notionalMinor = p.notionalMinor;
    const currency = p.currency;
    if (!tradeId || notionalMinor === undefined || !currency) continue;
    if (terminated.has(tradeId)) continue;
    if (currency !== functionalCurrency) continue; // multi-currency at a later slice
    const gross = Math.abs(notionalMinor);
    const ccf = BA_110_DERIVATIVE_BUILD_PHASE_CCF;
    lineItems.push({
      lineId: `derivatives.${tradeId}`,
      lineLabel: "OTC derivative notional",
      grossAmountMinor: gross,
      creditConversionFactor: ccf,
      ccfWeightedAmountMinor: Math.round(gross * ccf),
      currency,
      sourceRef: tradeId,
      note: `build-phase: gross notional reported with documented CCF ${ccf.toFixed(2)} pending SA-CCR add-on projection`,
    });
  }

  lineItems.sort((a, b) => (a.sourceRef < b.sourceRef ? -1 : a.sourceRef > b.sourceRef ? 1 : 0));
  return makeSection("derivatives", lineItems);
}

/**
 * Securities-financing section — RepoTradeOpened gross collateral for repos
 * that have neither end-leg-settled nor terminated early.
 */
function foldSecuritiesFinancingSection(
  ctx: ReplayContext,
  functionalCurrency: string,
): Ba110ObsSection {
  const provenanceFilter = defaultProvenanceFilter();

  const closed = new Set<string>();
  for (const type of ["RepoEndLegSettled", "RepoTradeTerminatedEarly"]) {
    for (const ev of ctx.store.replay(replayOptsFor(ctx, type))) {
      if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
      const p = ev.payload as RepoTerminalShape;
      if (p.tradeId) closed.add(p.tradeId);
    }
  }

  const lineItems: Ba110ObsLineItem[] = [];
  for (const ev of ctx.store.replay(replayOptsFor(ctx, "RepoTradeOpened"))) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as RepoTradeOpenedShape;
    const tradeId = p.tradeId;
    const collateral = p.collateralFaceValue;
    if (!tradeId || collateral === undefined) continue;
    if (closed.has(tradeId)) continue;
    const gross = Math.abs(collateral);
    // SFT collateral is reported gross (no CCF — BCBS §164 SFT exposure is the
    // gross collateral value; CCF banding applies to undrawn commitments, not SFT).
    const ccf = 1.0;
    lineItems.push({
      lineId: `securities-financing.${tradeId}`,
      lineLabel: "Securities-financing collateral (repo)",
      grossAmountMinor: gross,
      creditConversionFactor: ccf,
      ccfWeightedAmountMinor: gross,
      currency: functionalCurrency, // repo collateral face value is ZAR minor units
      sourceRef: tradeId,
    });
  }

  lineItems.sort((a, b) => (a.sourceRef < b.sourceRef ? -1 : a.sourceRef > b.sourceRef ? 1 : 0));
  return makeSection("securities-financing", lineItems);
}

/**
 * Committed-undrawn section — per facility:
 *   undrawn = committedAmountMinor − Σ(FundingLineDrawn.drawnAmountZar)
 *   exposure = undrawn × creditConversionFactor (from the commitment event)
 *
 * Empty case (no commitments seeded) → empty section, zero totals.
 * A facility whose draws meet or exceed the commitment ceiling has zero
 * undrawn exposure and is omitted from the line items.
 */
function foldCommittedUndrawnSection(ctx: ReplayContext): Ba110ObsSection {
  const provenanceFilter = defaultProvenanceFilter();

  // Sum drawdowns per fundingLineId (== commitment facilityId).
  const drawnByFacility = new Map<string, number>();
  for (const ev of ctx.store.replay(replayOptsFor(ctx, "FundingLineDrawn"))) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as FundingLineDrawnShape;
    const id = p.fundingLineId;
    const amt = p.drawnAmountZar;
    if (!id || amt === undefined) continue;
    drawnByFacility.set(id, (drawnByFacility.get(id) ?? 0) + amt);
  }

  // Latest commitment per facilityId — amendments emit a fresh
  // FundingLineCommitmentRecorded with updated terms; the last one wins.
  const commitmentByFacility = new Map<string, FundingLineCommitmentRecordedShape>();
  for (const ev of ctx.store.replay(replayOptsFor(ctx, "FundingLineCommitmentRecorded"))) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as FundingLineCommitmentRecordedShape;
    if (!p.facilityId) continue;
    commitmentByFacility.set(p.facilityId, p);
  }

  const lineItems: Ba110ObsLineItem[] = [];
  for (const [facilityId, c] of commitmentByFacility) {
    const committed = c.committedAmountMinor;
    const ccf = c.creditConversionFactor;
    const currency = c.currency;
    if (committed === undefined || ccf === undefined || !currency) continue;
    const drawn = drawnByFacility.get(facilityId) ?? 0;
    const undrawn = committed - drawn;
    if (undrawn <= 0) continue; // fully drawn → no undrawn exposure
    lineItems.push({
      lineId: `committed-undrawn.${facilityId}`,
      lineLabel: "Committed-undrawn funding facility",
      grossAmountMinor: undrawn,
      creditConversionFactor: ccf,
      ccfWeightedAmountMinor: Math.round(undrawn * ccf),
      currency,
      sourceRef: facilityId,
    });
  }

  lineItems.sort((a, b) => (a.sourceRef < b.sourceRef ? -1 : a.sourceRef > b.sourceRef ? 1 : 0));
  return makeSection("committed-undrawn", lineItems);
}

function makeSection(
  section: Ba110ObsSection["section"],
  lineItems: Ba110ObsLineItem[],
): Ba110ObsSection {
  const grossTotalMinor = lineItems.reduce((s, l) => s + l.grossAmountMinor, 0);
  const ccfWeightedTotalMinor = lineItems.reduce((s, l) => s + l.ccfWeightedAmountMinor, 0);
  return { section, lineItems, grossTotalMinor, ccfWeightedTotalMinor };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 110 (Off-Balance-Sheet Activities) projection by folding
 * primary trade events directly from the event store. Events-first per
 * Principle 1; deterministic for a fixed store + asOf.
 *
 * @param store               The event store to replay.
 * @param asOf                ISO 8601 period-end as-of bound (inclusive).
 * @param entity              Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank.
 * @param functionalCurrency  ISO 4217 functional currency (e.g. "ZAR").
 * @param untilSequence       Optional frozen-cursor upper bound on the event sequence.
 */
export function generateBa110OffBalanceSheetFromEvents(
  store: EventStore,
  asOf: string,
  entity: string,
  functionalCurrency: string,
  untilSequence?: number,
): Ba110OffBalanceSheet {
  assertBankEntity(entity);
  if (!functionalCurrency || functionalCurrency.length !== 3) {
    throw new Ba110OffBalanceSheetGeneratorError(
      `BA 110 generator: functionalCurrency must be ISO-4217 (3 chars), got '${functionalCurrency}'`,
    );
  }

  const ctx: ReplayContext = { store, entity, asOf, untilSequence };

  const derivatives = foldDerivativesSection(ctx, functionalCurrency);
  const securitiesFinancing = foldSecuritiesFinancingSection(ctx, functionalCurrency);
  const committedUndrawn = foldCommittedUndrawnSection(ctx);

  const grossTotalMinor =
    derivatives.grossTotalMinor +
    securitiesFinancing.grossTotalMinor +
    committedUndrawn.grossTotalMinor;
  const ccfWeightedTotalMinor =
    derivatives.ccfWeightedTotalMinor +
    securitiesFinancing.ccfWeightedTotalMinor +
    committedUndrawn.ccfWeightedTotalMinor;

  const placeholders: string[] = [
    "[citation: TBC — derivative notionals reported gross with a build-phase CCF of 1.00 pending the SA-CCR add-on projection (D-CREDIT-LIMIT-ENGINE-BUILD)]",
    "[citation: TBC — securities-financing exposure uses gross collateral face value; bilateral netting under a master-netting-agreement (BCBS §165(g)) deferred]",
    "[citation: TBC — exact SARB BA 110 line-numbering pending the published-schema mapping]",
  ];

  return {
    meta: {
      form: "BA 110",
      formVersion: "v0.1-rehearsal",
      entity,
      asOf,
      functionalCurrency,
      generatorVersion: "v0.1",
    },
    derivatives,
    securitiesFinancing,
    committedUndrawn,
    grossTotalMinor,
    ccfWeightedTotalMinor,
    citations: [
      "D-BA-RETURNS-P1-SOURCING-WORKSTREAM",
      "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
      "Banks Act 94 of 1990 §13",
      "Regulations Relating to Banks Reg 23",
      "BCBS Basel III §165",
    ],
    placeholders,
  };
}

// ---------------------------------------------------------------------------
// BA 700 leverage bridge
// ---------------------------------------------------------------------------

/**
 * Build a partial `LeverageExposureDecomposition` from a BA 110 output. The
 * CCF-weighted off-balance-sheet total feeds the BA 700 leverage exposure
 * measure (`offBalanceSheetExposurePostCcfMinor`). The other components
 * (on-balance-sheet, derivative SA-CCR EAD, SFT) are composed by the BA 700
 * caller; this helper supplies only the OBS slot from primary events.
 */
export function ba110ToLeverageOffBalanceSheetExposure(
  obs: Ba110OffBalanceSheet,
): Pick<LeverageExposureDecomposition, "offBalanceSheetExposurePostCcfMinor"> {
  return { offBalanceSheetExposurePostCcfMinor: obs.ccfWeightedTotalMinor };
}
