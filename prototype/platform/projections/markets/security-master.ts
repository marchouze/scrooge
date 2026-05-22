// platform/projections/markets/security-master.ts
//
// SecurityMaster projection — folds FinancialInstrument lifecycle events into
// a queryable instrument register (the bank's security master file).
//
// The projection is a pure fold over four event types authored by Kai:
//   FinancialInstrumentDefined       — creates the master row.
//   FinancialInstrumentClassified    — overlays regulatory/accounting classification.
//   FinancialInstrumentDecomposed    — records decomposition linkage on parent.
//   FinancialInstrumentReconstituted — clears decomposition linkage on parent.
//
// Design notes:
//   - Latest-wins: a second FinancialInstrumentClassified for the same
//     instrumentId fully overwrites the first classification fields.
//   - Classification before definition is invalid: a FinancialInstrumentClassified
//     event whose instrumentId has no matching row is silently ignored.
//   - Per-type contractTerms validation (ACTUS §4+ fields) lands in Slice 5;
//     contractTerms is open `Record<string, unknown>` at this slice.
//
// P1  — projection is a derivation of the event log; never authoritative.
// P2  — isinToInstrumentId index enables upward citation from a legacy ISIN
//       string to the canonical instrumentId aggregate.
// P5  — currency, jurisdiction, legalEntityId travel on every row; no implicit
//       ZAR default per Principle 5.
//
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
// Author: Anya (Data / Analytics Engineer, engineering)
//   per brief:anya:d-financial-instrument-entity-slice-3-securityma:2026-05-22

import type { Projection } from "../types";
import type {
  ActusContractType,
  InstrumentSubtype,
} from "../../markets/cdm/instrument";
import { FINANCIAL_INSTRUMENT_EVENT_TYPES } from "../../markets/cdm/instrument";
import type { Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export interface SecurityMasterRow {
  readonly instrumentId: string;
  readonly actusContractType: ActusContractType;
  readonly instrumentSubtype: InstrumentSubtype;
  readonly productRef: string | undefined;
  readonly isin: string | undefined;
  readonly cfiCode: string | undefined;
  readonly issuerLei: string | undefined;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly legalEntityId: string;
  readonly maturityDate: string | undefined;
  /** ACTUS-aligned contract terms. Per-type validation lands in Slice 5. */
  readonly contractTerms: Record<string, unknown>;
  // Classification — undefined until FinancialInstrumentClassified fires
  readonly hqlaLevel: string | undefined;
  readonly baselRiskWeight: string | undefined;
  readonly ifrs9Category: string | undefined;
  readonly saCcrAssetClass: string | undefined;
  readonly classificationEffectiveDate: string | undefined;
  // Decomposition linkage
  /** Populated after FinancialInstrumentDecomposed; cleared after FinancialInstrumentReconstituted. */
  readonly decomposedIntoChildIds: readonly string[] | undefined;
  /** Set on child instruments when their parent fires FinancialInstrumentDecomposed. */
  readonly parentInstrumentId: string | undefined;
  /** Number of FinancialInstrument events folded into this row (audit aid). */
  readonly eventCount: number;
}

export interface SecurityMasterState {
  readonly instruments: ReadonlyMap<string, SecurityMasterRow>;
  /** Derived index: isin → instrumentId (for legacy lookup by ISIN string). */
  readonly isinToInstrumentId: ReadonlyMap<string, string>;
}

// ---------------------------------------------------------------------------
// Union of the four event payload shapes this projection cares about.
// We type-narrow via event.type in the reducer rather than importing heavy
// payload types — the event store carries the full payload as `unknown`,
// so we cast safely after the type guard.
// ---------------------------------------------------------------------------

type FinancialInstrumentEventType = (typeof FINANCIAL_INSTRUMENT_EVENT_TYPES)[number];

interface FinancialInstrumentEvent extends Event {
  type: FinancialInstrumentEventType;
}

function isFinancialInstrumentEvent(e: Event): e is FinancialInstrumentEvent {
  return (FINANCIAL_INSTRUMENT_EVENT_TYPES as readonly string[]).includes(e.type);
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const securityMasterInitial: SecurityMasterState = {
  instruments: new Map(),
  isinToInstrumentId: new Map(),
};

// ---------------------------------------------------------------------------
// Reducer helpers
// ---------------------------------------------------------------------------

function applyDefined(
  state: SecurityMasterState,
  event: FinancialInstrumentEvent,
): SecurityMasterState {
  const p = event.payload as {
    instrumentId: string;
    actusContractType: ActusContractType;
    instrumentSubtype: InstrumentSubtype;
    productRef?: string;
    isin?: string;
    cfiCode?: string;
    issuerLei?: string;
    currency: string;
    jurisdiction: string;
    legalEntityId: string;
    maturityDate?: string;
    contractTerms: Record<string, unknown>;
  };

  const row: SecurityMasterRow = {
    instrumentId: p.instrumentId,
    actusContractType: p.actusContractType,
    instrumentSubtype: p.instrumentSubtype,
    productRef: p.productRef,
    isin: p.isin,
    cfiCode: p.cfiCode,
    issuerLei: p.issuerLei,
    currency: p.currency,
    jurisdiction: p.jurisdiction,
    legalEntityId: p.legalEntityId,
    maturityDate: p.maturityDate,
    contractTerms: p.contractTerms,
    hqlaLevel: undefined,
    baselRiskWeight: undefined,
    ifrs9Category: undefined,
    saCcrAssetClass: undefined,
    classificationEffectiveDate: undefined,
    decomposedIntoChildIds: undefined,
    parentInstrumentId: undefined,
    eventCount: 1,
  };

  const nextInstruments = new Map(state.instruments);
  nextInstruments.set(p.instrumentId, row);

  const nextIsin = new Map(state.isinToInstrumentId);
  if (p.isin) {
    nextIsin.set(p.isin, p.instrumentId);
  }

  return { instruments: nextInstruments, isinToInstrumentId: nextIsin };
}

function applyClassified(
  state: SecurityMasterState,
  event: FinancialInstrumentEvent,
): SecurityMasterState {
  const p = event.payload as {
    instrumentId: string;
    hqlaLevel: string;
    baselRiskWeight: string;
    ifrs9Category: string;
    saCcrAssetClass: string;
    effectiveDate: string;
  };

  const existing = state.instruments.get(p.instrumentId);
  // Classification before definition is invalid — silently ignore.
  if (!existing) return state;

  const nextInstruments = new Map(state.instruments);
  nextInstruments.set(p.instrumentId, {
    ...existing,
    hqlaLevel: p.hqlaLevel,
    baselRiskWeight: p.baselRiskWeight,
    ifrs9Category: p.ifrs9Category,
    saCcrAssetClass: p.saCcrAssetClass,
    classificationEffectiveDate: p.effectiveDate,
    eventCount: existing.eventCount + 1,
  });

  return { instruments: nextInstruments, isinToInstrumentId: state.isinToInstrumentId };
}

function applyDecomposed(
  state: SecurityMasterState,
  event: FinancialInstrumentEvent,
): SecurityMasterState {
  const p = event.payload as {
    parentInstrumentId: string;
    childInstrumentIds: string[];
  };

  const existing = state.instruments.get(p.parentInstrumentId);
  if (!existing) return state;

  const nextInstruments = new Map(state.instruments);
  nextInstruments.set(p.parentInstrumentId, {
    ...existing,
    decomposedIntoChildIds: p.childInstrumentIds,
    eventCount: existing.eventCount + 1,
  });

  return { instruments: nextInstruments, isinToInstrumentId: state.isinToInstrumentId };
}

function applyReconstituted(
  state: SecurityMasterState,
  event: FinancialInstrumentEvent,
): SecurityMasterState {
  const p = event.payload as {
    parentInstrumentId: string;
  };

  const existing = state.instruments.get(p.parentInstrumentId);
  if (!existing) return state;

  const nextInstruments = new Map(state.instruments);
  nextInstruments.set(p.parentInstrumentId, {
    ...existing,
    decomposedIntoChildIds: undefined,
    eventCount: existing.eventCount + 1,
  });

  return { instruments: nextInstruments, isinToInstrumentId: state.isinToInstrumentId };
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export const securityMasterProjection: Projection<
  SecurityMasterState,
  FinancialInstrumentEvent
> = {
  name: "markets.security-master",
  initial: securityMasterInitial,
  accepts: (e): e is FinancialInstrumentEvent => isFinancialInstrumentEvent(e),
  reduce(state, event) {
    switch (event.type) {
      case "FinancialInstrumentDefined":
        return applyDefined(state, event);
      case "FinancialInstrumentClassified":
        return applyClassified(state, event);
      case "FinancialInstrumentDecomposed":
        return applyDecomposed(state, event);
      case "FinancialInstrumentReconstituted":
        return applyReconstituted(state, event);
      default:
        return state;
    }
  },
};
