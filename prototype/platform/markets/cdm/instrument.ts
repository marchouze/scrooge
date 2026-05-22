// platform/markets/cdm/instrument.ts
//
// FinancialInstrument entity schema — the unified superset covering all
// things the bank trades, holds, or owes.
//
// This module defines four lifecycle events:
//   - FinancialInstrumentDefined       — master record creation for any
//     instrument admitted to the bank's universe (bonds, equities, FX
//     positions, deposits, reserves).
//   - FinancialInstrumentClassified    — regulatory/accounting classification
//     overlay (HQLA tier, Basel risk-weight, IFRS 9 category, SA-CCR asset
//     class). Separate from definition because classification can be revised
//     without re-creating the instrument.
//   - FinancialInstrumentDecomposed    — strip of a decomposable instrument
//     (e.g. a bond → coupon strips + principal strip). Each child becomes an
//     independently-tradeable instrument with its own FinancialInstrumentDefined
//     event.
//   - FinancialInstrumentReconstituted — inverse of decomposition: child strips
//     are surrendered and the parent instrument is reconstituted.
//
// Design follows the ACTUS Financial Research Foundation contract-type taxonomy
// for the `actusContractType` discriminator, which ensures the contractTerms
// payload is interpretable by a conformant ACTUS engine (Slice 5 will add
// per-type contractTerms validation).
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY — CEO-approved 2026-05-22; authority for
//     this entity schema and the four event shapes below.
//   IFRS-9 — IFRS 9 Financial Instruments (2014, as adopted SA): classification
//     into amortised-cost / FVTOCI / FVTPL drives measurement and GL posting
//     rules authored by Bea.
//   ACTUS — ACTUS Financial Research Foundation contract-type standard v1.1;
//     https://www.actusfrf.org/techspecs; PAM/STK/IRS/FXOUT/CLM/CSH/ZCB/CMP
//     are the contract types in scope for this bank's opening product set.
//   Principles/1-events-are-truth.md — instrument master record lives here,
//     not in a mutable database row.
//   Principles/2-single-graph-discipline.md — productRef cites the NPA product
//     record; issuerLei cites the Party register.
//   Principles/5-multi-currency-entity-country.md — currency is typed; no
//     implicit ZAR default.
//
// Author: Kai (Trading Systems Engineer, engineering) per
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { deterministicAggregateId, makeAggregateLabel } from "../../event-store/aggregate";
import { type Actor, type Event, eventSchema } from "../../event-store/types";
import { cdmDateSchema } from "./primitives";

// Re-export for downstream consumers that need the date type.
export type { CdmDate } from "./primitives";

// ---------------------------------------------------------------------------
// ACTUS contract-type discriminator
// ---------------------------------------------------------------------------

/**
 * ACTUS contract-type codes supported by this bank's opening product set.
 *
 * Each code maps to a well-defined ACTUS contract algorithm; the code on a
 * FinancialInstrumentDefined event determines which ACTUS engine module is
 * invoked to project cash-flows and generate accounting events.
 *
 * References: ACTUS Financial Research Foundation technical specifications v1.1.
 *   PAM  — Principal at Maturity (bonds, fixed deposits)
 *   STK  — Stock (listed equities)
 *   IRS  — Interest Rate Swap (compositional)
 *   FXOUT— FX Outright (spot and forwards)
 *   CLM  — Call Money (nostro accounts, demand deposits)
 *   CSH  — Cash (central bank reserves, vault)
 *   ZCB  — Zero Coupon Bond (bond strips created by decomposition)
 *   CMP  — Composite (structured instruments; internal structure not independently tradeable)
 */
export const actusContractTypeSchema = z.enum([
  "PAM", // Principal at Maturity — bonds, fixed deposits
  "STK", // Stock — equities
  "IRS", // Interest Rate Swap — compositional
  "FXOUT", // FX Outright — spot and forwards
  "CLM", // Call Money — nostro accounts, demand deposits
  "CSH", // Cash — central bank reserves
  "ZCB", // Zero Coupon Bond — bond strips
  "CMP", // Composite — structured instruments
]);

/** ACTUS contract type code. See {@link actusContractTypeSchema}. */
export type ActusContractType = z.infer<typeof actusContractTypeSchema>;

// ---------------------------------------------------------------------------
// Instrument subtype discriminator
// ---------------------------------------------------------------------------

/**
 * Structural subtype of a FinancialInstrument.
 *
 *   atomic         — a single ACTUS contract; self-contained and independently
 *                    tradeable. Most instruments are atomic (bonds, equities,
 *                    FX outright positions, deposits).
 *   decomposable   — can be stripped into independently-tradeable children
 *                    (e.g. a coupon-bearing bond → coupon strips + principal
 *                    strip). A FinancialInstrumentDecomposed event records the
 *                    split; each child receives its own FinancialInstrumentDefined.
 *   compositional  — has internal structure but components are NOT independently
 *                    tradeable (e.g. an IRS whose fixed and floating legs only
 *                    make sense as a pair). Maps to ACTUS CMP and IRS contract types.
 */
export const instrumentSubtypeSchema = z.enum([
  "atomic", // single ACTUS contract, self-contained
  "decomposable", // can be stripped into independently-tradeable children
  "compositional", // internal structure only; components not independently tradeable
]);

/** Instrument subtype. See {@link instrumentSubtypeSchema}. */
export type InstrumentSubtype = z.infer<typeof instrumentSubtypeSchema>;

// ---------------------------------------------------------------------------
// FinancialInstrumentDefined
// ---------------------------------------------------------------------------

/**
 * Payload schema for FinancialInstrumentDefined.
 *
 * Emitted once per instrument when it is admitted to the bank's instrument
 * universe. The event is the master record — downstream projections (position
 * books, GL classification, HQLA buffer) derive from this plus the paired
 * FinancialInstrumentClassified event.
 */
export const financialInstrumentDefinedPayloadSchema = z.object({
  /**
   * Bank-internal instrument identifier.
   * Convention: `"fi:<assetClass>:<naturalKey>"`.
   * Examples: `"fi:bond:ZAG000149017"`, `"fi:equity:JSE:SOL"`,
   *           `"fi:csh:ZAR"`, `"fi:clm:NOSTRO-ZAR-001"`.
   */
  instrumentId: z.string().min(1),

  /** Structural subtype — determines decomposition eligibility. */
  instrumentSubtype: instrumentSubtypeSchema,

  /**
   * ACTUS contract type — routes to the correct pricing/accrual/cash-flow
   * algorithm in the ACTUS engine. Drives the shape expected in `contractTerms`.
   */
  actusContractType: actusContractTypeSchema,

  /**
   * Optional reference to the authorising Product NPA record in the product
   * register (Principle 2 upward citation). Absent for Cash (CSH contract
   * type) which has no associated product approval gate.
   */
  productRef: z.string().min(1).optional(),

  /**
   * International Securities Identification Number (ISO 6166, 12 characters).
   * Present for listed equities, listed bonds, and ETFs; absent for OTC / FX /
   * deposit instruments that do not have an ISIN.
   */
  isin: z.string().length(12).optional(),

  /**
   * Classification of Financial Instruments code (ISO 10962, 6 characters).
   * Provides a standardised instrument taxonomy for regulatory reporting.
   */
  cfiCode: z.string().length(6).optional(),

  /**
   * Legal Entity Identifier (LEI, 20 characters) of the instrument issuer.
   * Present for bonds and equities; absent for FX outrights, deposits, and
   * cash instruments that have no issuer in the conventional sense.
   */
  issuerLei: z.string().min(1).optional(),

  /**
   * Native currency of the instrument (ISO 4217, 3 uppercase letters).
   * Per Principle 5, no default currency — always explicit.
   */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),

  /**
   * Maturity date (ISO-8601 YYYY-MM-DD). Absent for perpetual instruments
   * (equities, open-ended funds) and for cash / demand-deposit instruments.
   */
  maturityDate: z.string().optional(),

  /**
   * ACTUS-aligned contract terms. The shape is intentionally open (`record`)
   * at Slice 1; Slice 5 will add per-contractType refinements via `.superRefine`
   * that enforce the mandatory ACTUS fields for each contract type (e.g. PAM
   * requires `nominalInterestRate`, `dayCountConvention`; IRS requires
   * `receivePaySchema`, `floatingLegReferenceRate`).
   */
  contractTerms: z.record(z.unknown()),

  /** Jurisdiction of issuance / primary listing (ISO-3166-1 alpha-2). */
  jurisdiction: z.string().length(2),

  /**
   * Legal entity ID of the bank entity that holds / issues this instrument.
   * Required for multi-entity reporting (Principle 5).
   */
  legalEntityId: z.string().min(1),
});

/** Payload type for FinancialInstrumentDefined. */
export type FinancialInstrumentDefinedPayload = z.infer<
  typeof financialInstrumentDefinedPayloadSchema
>;

/**
 * Factory for FinancialInstrumentDefined events.
 *
 * Sets `aggregateId` + `aggregateLabel` on the envelope so that
 * `recon:aggregate-id-coverage` can assert full coverage.
 * Aggregate label convention: `"financial-instrument:<instrumentId>"`.
 */
export function makeFinancialInstrumentDefined(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FinancialInstrumentDefinedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("financial-instrument", args.payload.instrumentId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FinancialInstrumentDefined",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: financialInstrumentDefinedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// FinancialInstrumentClassified
// ---------------------------------------------------------------------------

/**
 * Payload schema for FinancialInstrumentClassified.
 *
 * A classification overlay applied to an existing instrument. Can be revised
 * (new event with updated fields) without modifying the Definition event —
 * the most-recent FinancialInstrumentClassified event for a given instrumentId
 * is the authoritative classification.
 *
 * Classification dimensions:
 *   hqlaLevel       — LCR / NSFR HQLA tiering (BA 325 / Basel III §42–§54).
 *   baselRiskWeight — SA standardised approach risk weight (RRB Regulation 23).
 *   ifrs9Category   — IFRS 9 §4.1 measurement category.
 *   saCcrAssetClass — SA-CCR asset class for derivative EAD calculation
 *                     (BCBS 279 / RRB Regulation 23 Appendix I).
 */
export const financialInstrumentClassifiedPayloadSchema = z.object({
  /** Instrument being classified. Must match an existing FinancialInstrumentDefined.instrumentId. */
  instrumentId: z.string().min(1),

  /**
   * HQLA (High-Quality Liquid Asset) tier under Basel III / BA 325.
   *   level-1   — central bank reserves, sovereign bonds (0% RW), Level-1 qualifying criteria
   *   level-2a  — high-grade covered bonds, sovereign bonds (20% RW)
   *   level-2b  — RMBS, corporate bonds (≥BBB-), equities meeting LCR criteria
   *   non-hqla  — all instruments not qualifying for HQLA inclusion
   */
  hqlaLevel: z.enum(["level-1", "level-2a", "level-2b", "non-hqla"]),

  /**
   * Basel standardised-approach risk weight.
   * Drives RWA calculation for capital adequacy (Banks Act Regulation 38).
   */
  baselRiskWeight: z.enum(["0pct", "20pct", "50pct", "100pct", "150pct", "deducted"]),

  /**
   * IFRS 9 measurement category (IFRS 9 §4.1).
   *   amortised-cost — held-to-collect; EIR amortisation; no MTM P&L
   *   fvtoci         — hold-to-collect-and-sell; MTM in OCI; recycled on sale
   *   fvtpl          — fair-value-through-P&L; MTM hits income statement each period
   *   n-a            — not applicable (e.g. own-issued liabilities, CSH instrument)
   */
  ifrs9Category: z.enum(["amortised-cost", "fvtoci", "fvtpl", "n-a"]),

  /**
   * SA-CCR asset class for derivative exposure-at-default calculation
   * (BCBS 279 §6 / RRB Regulation 23 Appendix I).
   * n-a for non-derivative instruments.
   */
  saCcrAssetClass: z.enum(["interest-rate", "fx", "credit", "equity", "commodity", "n-a"]),

  /** Agent or system that produced this classification (name + position). */
  classifiedBy: z.string().min(1),

  /** ISO-8601 date from which this classification is effective (YYYY-MM-DD). */
  effectiveDate: z.string(),

  /** Human-readable rationale for the classification decisions made above. */
  rationale: z.string().min(1),
});

/** Payload type for FinancialInstrumentClassified. */
export type FinancialInstrumentClassifiedPayload = z.infer<
  typeof financialInstrumentClassifiedPayloadSchema
>;

/**
 * Factory for FinancialInstrumentClassified events.
 *
 * Shares the aggregate (`financial-instrument:<instrumentId>`) with
 * FinancialInstrumentDefined so all events for the same instrument are
 * grouped under one aggregate root.
 */
export function makeFinancialInstrumentClassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FinancialInstrumentClassifiedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("financial-instrument", args.payload.instrumentId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FinancialInstrumentClassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: financialInstrumentClassifiedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// FinancialInstrumentDecomposed
// ---------------------------------------------------------------------------

/**
 * Payload schema for FinancialInstrumentDecomposed.
 *
 * Emitted when a decomposable instrument (instrumentSubtype = "decomposable")
 * is stripped into independently-tradeable child instruments. The canonical
 * use-case is bond stripping: a coupon-bearing bond is stripped into a set of
 * ZCB coupon strips plus a ZCB principal strip.
 *
 * After decomposition:
 *   - The parent instrument is ineligible for further trading.
 *   - Each child is registered via its own FinancialInstrumentDefined event
 *     (actusContractType = "ZCB").
 *   - Positions previously held in the parent are reclassified into children
 *     by a subsequent accounting event authored by Bea.
 *
 * Reconstitution (inverse operation) is recorded via FinancialInstrumentReconstituted.
 */
export const financialInstrumentDecomposedPayloadSchema = z.object({
  /** Instrument being stripped. Must match an existing FinancialInstrumentDefined with instrumentSubtype = "decomposable". */
  parentInstrumentId: z.string().min(1),

  /**
   * Stable identifiers of the child instruments created by this decomposition.
   * Each child must receive its own FinancialInstrumentDefined event.
   * Minimum two children (otherwise it is not a decomposition).
   */
  childInstrumentIds: z.array(z.string().min(1)).min(2),

  /**
   * Decomposition mechanism. Currently only "bond-strip" is supported.
   * Future values (e.g. "structured-note-tranche") will be added via schema
   * evolution when the product set expands.
   */
  decompositionType: z.literal("bond-strip"),

  /** ISO-8601 date on which the decomposition takes effect (YYYY-MM-DD). */
  effectiveDate: z.string(),
});

/** Payload type for FinancialInstrumentDecomposed. */
export type FinancialInstrumentDecomposedPayload = z.infer<
  typeof financialInstrumentDecomposedPayloadSchema
>;

/**
 * Factory for FinancialInstrumentDecomposed events.
 *
 * Aggregate root is the parent instrument so the full decomposition lifecycle
 * (define → decompose → reconstitute) is grouped under one aggregate.
 */
export function makeFinancialInstrumentDecomposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FinancialInstrumentDecomposedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel(
    "financial-instrument",
    args.payload.parentInstrumentId,
  );
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FinancialInstrumentDecomposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: financialInstrumentDecomposedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// FinancialInstrumentReconstituted
// ---------------------------------------------------------------------------

/**
 * Payload schema for FinancialInstrumentReconstituted.
 *
 * Emitted when previously-decomposed child strips are surrendered and the
 * parent instrument is reconstituted (the inverse of FinancialInstrumentDecomposed).
 *
 * All child instruments listed in `childInstrumentIds` must be the complete
 * set of children from the original FinancialInstrumentDecomposed event.
 * Partial reconstitution is not permitted; a new parent can only be created
 * by assembling all strips.
 *
 * After reconstitution:
 *   - The child instruments are retired (ineligible for further trading).
 *   - The parent instrument becomes tradeable again.
 *   - Accounting reversals are authored by Bea in response to this event.
 */
export const financialInstrumentReconstitutedPayloadSchema = z.object({
  /** Parent instrument being reconstituted. Must match an existing FinancialInstrumentDefined. */
  parentInstrumentId: z.string().min(1),

  /**
   * Complete set of child instrument IDs being surrendered.
   * Must be the full set from the original FinancialInstrumentDecomposed event.
   * Minimum two children mirrors the decomposition minimum.
   */
  childInstrumentIds: z.array(z.string().min(1)).min(2),

  /** ISO-8601 date on which the reconstitution takes effect (YYYY-MM-DD). */
  reconstitutionDate: z.string(),
});

/** Payload type for FinancialInstrumentReconstituted. */
export type FinancialInstrumentReconstitutedPayload = z.infer<
  typeof financialInstrumentReconstitutedPayloadSchema
>;

/**
 * Factory for FinancialInstrumentReconstituted events.
 *
 * Aggregate root is the parent instrument, mirroring the decomposition event
 * aggregate assignment.
 */
export function makeFinancialInstrumentReconstituted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FinancialInstrumentReconstitutedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel(
    "financial-instrument",
    args.payload.parentInstrumentId,
  );
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FinancialInstrumentReconstituted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: financialInstrumentReconstitutedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// FinancialInstrument event-type registry
// ---------------------------------------------------------------------------

/**
 * Canonical list of all FinancialInstrument event type strings.
 * Used for runtime registration into the event store and for
 * `recon:aggregate-id-coverage` assertions.
 */
export const FINANCIAL_INSTRUMENT_EVENT_TYPES = [
  "FinancialInstrumentDefined",
  "FinancialInstrumentClassified",
  "FinancialInstrumentDecomposed",
  "FinancialInstrumentReconstituted",
] as const;

/** Union of all FinancialInstrument event type string literals. */
export type FinancialInstrumentEventType = (typeof FINANCIAL_INSTRUMENT_EVENT_TYPES)[number];

// Re-export primitives used in factories so downstream consumers have one import point.
export { cdmDateSchema };
