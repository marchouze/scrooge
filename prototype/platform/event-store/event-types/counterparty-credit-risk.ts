// platform/event-store/event-types/counterparty-credit-risk.ts
//
// WS-CREDIT-LIMIT-ENGINE — SA-CCR / LEX computation typed event-payload
// schemas.
//
// Covers the daily measurement outputs feeding the credit-limit engine:
//   CcrReplacementCostComputed — SA-CCR replacement-cost per netting set
//     (Credit Risk Policy §3 line 129).
//   CcrEadComputed             — SA-CCR exposure-at-default per netting set
//     (Credit Risk Policy §3 line 131; BCBS d317 §10 EAD = α × (RC + PFE)).
//   LexUtilisationComputed     — large-exposure utilisation per counterparty
//     or connected group (Credit Risk Policy §2 line 107).
//   LexExceptionApproved       — sub-limit / cap exception register entry
//     (Credit Risk Policy §2 line 103).
//
// These are the measurement / governance siblings of the lifecycle events
// in `credit-limit.ts`. Splitting them out keeps the lifecycle (which is
// driven by PROC-RISK-CO-01) cleanly separate from the daily computation
// outputs (which are driven by the SA-CCR engine — follow-on slice).
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//
// Citations:
//   Banks Act 94 of 1990 §73;
//   RRB Regulation 23 (large exposures);
//   LEX Directive D3/2022 (Large Exposures);
//   BCBS 279 (SA-CCR — standardised approach for counterparty credit risk,
//     March 2014, rev. 2017);
//   BCBS 283 (large exposures framework, 2014);
//   Policies/credit-risk-policy-v1.md §2 + §3 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Authors: Rohan (Market risk quantitative engineer, engineering — SA-CCR
//   shapes) + Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { moneyWireSchema } from "../../core/money-codec";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// CcrReplacementCostComputed — Credit Risk Policy §3 line 129
//
// SA-CCR Replacement Cost (RC) is the larger of the current net mark-to-
// market of the netting set less collateral held, or zero. BCBS 279 §136.
//
//   RC = max(V − C ; 0)
//
// where V is the current MTM of the trades in the netting set and C is the
// market value of net collateral held (positive when collateral favours
// the bank). The PFE (potential-future-exposure) add-on lives on a
// separate event-type to keep concerns small (follow-on slice).
// ---------------------------------------------------------------------------

export const ccrReplacementCostComputedPayloadSchema = z.object({
  /**
   * Netting-set identifier. A netting set is the set of trades subject to
   * a single legally-enforceable netting agreement (typically a single
   * ISDA Master + CSA pair). Convention: `NS-<counterpartyId>-<ccy>`.
   */
  nettingSetId: z.string().min(1),

  /** Party register ID of the counterparty under measurement. */
  counterpartyId: z.string().min(1),

  /** Replacement cost (RC) in minor units of `currency`. Non-negative
   * integer — BCBS 279 §136 floors at zero. */
  rc: z.number().int().nonnegative(),

  /** ISO 4217 currency code of the rc / vMtm / collateralHeld figures. */
  currency: z.string().min(3).max(3),

  /** ISO 8601 — the as-of date of the measurement (T-0 close of business). */
  computationDate: z.string().min(1),

  /**
   * Methodology marker. SA-CCR is the only supported flavour at present;
   * the field is present so the event-type can carry a future IMM
   * (internal-model method) extension without a schema break.
   */
  methodology: z.literal("sa-ccr"),

  /**
   * Net mark-to-market of the netting set (in minor units). Signed integer —
   * positive when net favourable to the bank, negative when adverse. The
   * RC formula floors at zero but vMtm is preserved here for audit and
   * follow-on Vera recon (RC ≥ max(vMtm − collateralHeld, 0)).
   */
  vMtm: z.number().int(),

  /** Net collateral held against the netting set (minor units, non-negative). */
  collateralHeld: z.number().int().nonnegative(),
});

export type CcrReplacementCostComputedPayload = z.infer<
  typeof ccrReplacementCostComputedPayloadSchema
>;

export function makeCcrReplacementCostComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CcrReplacementCostComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CcrReplacementCostComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ccrReplacementCostComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CcrEadComputed — Credit Risk Policy §3 line 131
//
// SA-CCR Exposure-At-Default (EAD) composition over a netting set:
//
//   EAD = α × (RC + PFE)   with α = 1.4
//
// where RC is the Replacement Cost (per `CcrReplacementCostComputed`) and
// PFE is the aggregated potential-future-exposure add-on across the asset
// classes observed in the netting set. BCBS d317 §10 / CRE52 §52.5.
//
// This event is the canonical EAD figure the credit-limit engine reads.
// Before this event existed, `pre-deal-check` had to re-derive
// `α × (RC + PFE)` from the RC event on every call; with `CcrEadComputed`
// the engine can read the EAD directly (and fall back to RC-only as a
// degraded mode when no EAD event is observed).
//
// `sourceEvents` records the chain back to the inputs:
//   rcEventId      — event_id of the CcrReplacementCostComputed used as input.
//   pfeComponents  — count of AddOnComponent inputs aggregated into PFE
//     (zero is legitimate — netting set with no trades has PFE = 0).
// ---------------------------------------------------------------------------

export const ccrEadComputedPayloadSchema = z.object({
  /** Netting-set identifier. Convention: `NS-<counterpartyId>-<ccy>`. */
  nettingSetId: z.string().min(1),

  /** Party register ID of the counterparty under measurement. */
  counterpartyId: z.string().min(1),

  /** Replacement cost (RC) in minor units of `currency`. Non-negative —
   * BCBS d317 §136 floors at zero. Sourced from the input
   * `CcrReplacementCostComputed` event. */
  rc: z.number().int().nonnegative(),

  /** Aggregated PFE add-on in minor units of `currency`. Non-negative —
   * `Σ AddOnComponent.addOn` per BCBS d317 Table 2. */
  pfe: z.number().int().nonnegative(),

  /** BCBS d317 §10 regulatory multiplier α. Constant 1.4 — recorded so the
   * event is self-describing for audit. */
  alpha: z.literal(1.4),

  /** Exposure-at-default in minor units of `currency`. Non-negative integer.
   * Computed as `α × (RC + PFE)` with half-up rounding to minor units. */
  ead: z.number().int().nonnegative(),

  /** ISO 4217 currency code for `rc`, `pfe`, `ead`. */
  currency: z.string().min(3).max(3),

  /** ISO 8601 — the as-of date of the measurement (T-0 close of business). */
  computationDate: z.string().min(1),

  /** Methodology marker. SA-CCR only at present; future IMM extension would
   * be carried as a discriminated variant rather than overloading this
   * literal. */
  methodology: z.literal("sa-ccr"),

  /** Provenance chain back to the RC + PFE inputs that produced this EAD. */
  sourceEvents: z.object({
    /** event_id of the `CcrReplacementCostComputed` event whose RC fed this
     * EAD computation. Vera recon asserts the chain. */
    rcEventId: z.string().min(1),
    /** Count of `AddOnComponent` inputs aggregated into PFE. Zero is valid
     * (netting set with no live trades). */
    pfeComponents: z.number().int().nonnegative(),
  }),
});

export type CcrEadComputedPayload = z.infer<typeof ccrEadComputedPayloadSchema>;

/**
 * DECIMAL-MIGRATION (slice 2): V2 Zod schema for CcrEadComputed.
 * `rc`, `pfe`, `ead` are lifted from bare integer minor units to MoneyWire.
 * Rounding: HALF_UP (SA-CCR regulatory convention, BCBS d317 §10).
 * Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC (CEO-approved 2026-06-14).
 */
export const ccrEadComputedPayloadSchemaV2 = ccrEadComputedPayloadSchema
  .omit({ rc: true, pfe: true, ead: true })
  .extend({
    /** Replacement cost as MoneyWire (HALF_UP, SA-CCR). */
    rc: moneyWireSchema,
    /** Potential future exposure add-on as MoneyWire. */
    pfe: moneyWireSchema,
    /** EAD = α × (RC + PFE) as MoneyWire. */
    ead: moneyWireSchema,
  });

export type CcrEadComputedPayloadV2Type = z.infer<typeof ccrEadComputedPayloadSchemaV2>;

export function makeCcrEadComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CcrEadComputedPayloadV2Type;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CcrEadComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ccrEadComputedPayloadSchemaV2.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LexUtilisationComputed — Credit Risk Policy §2 line 107
//
// Daily large-exposure utilisation per counterparty (and, where present,
// the connected group). Utilisation = totalExposure / eligibleCapital.
// The 25% Tier-1 + Tier-2 LEX cap (RRB Reg 23, BCBS 283) is enforced by
// downstream Vera recon — this event-type only records the inputs and
// derived %.
// ---------------------------------------------------------------------------

export const lexUtilisationComputedPayloadSchema = z.object({
  /** Party register ID of the counterparty under measurement. */
  counterpartyId: z.string().min(1),

  /** When the counterparty is part of a recognised connected group, the
   * group identifier. BCBS 283 §15 defines "group of connected counterparties". */
  connectedGroupId: z.string().min(1).optional(),

  /** Total exposure across all exposure types (minor units). Non-negative
   * integer — the LEX denominator already nets where eligible. */
  totalExposure: z.number().int().nonnegative(),

  /** Bank's eligible LEX capital base (Tier-1 + eligible Tier-2) in minor
   * units. Recomputed at each measurement; sourced from the capital-
   * adequacy projection. */
  eligibleCapital: z.number().int().nonnegative(),

  /** ISO 4217 currency for totalExposure + eligibleCapital. Must match the
   * bank's reporting currency (ZAR). */
  currency: z.string().min(3).max(3),

  /** Utilisation as a percentage (0–100+). >25 indicates LEX breach. */
  utilisationPct: z.number(),

  computedAt: z.string().min(1),
});

export type LexUtilisationComputedPayload = z.infer<typeof lexUtilisationComputedPayloadSchema>;

export function makeLexUtilisationComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LexUtilisationComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LexUtilisationComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: lexUtilisationComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LexExceptionApproved — Credit Risk Policy §2 line 103
//
// Where the credit-risk governance route has authorised a deviation from
// the default LEX rule (either a sub-limit relaxation or a cap override),
// the approval is recorded here. CRC may approve sub-limit exceptions
// under tolerance; BRC and PA escalate at higher thresholds.
// ---------------------------------------------------------------------------

export const lexExceptionApprovedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),

  /**
   * Exception type. `sub-limit` is a relaxation within the overall cap;
   * `cap` is an override of the 25% Tier-1 + Tier-2 ceiling (only
   * legitimately approvable by the PA per RRB Reg 23(7)).
   */
  exceptionType: z.enum(["sub-limit", "cap"]),

  /** Party register ID / seat of the approver. */
  approver: z.string().min(1),

  /** Authority level of the approver. PA = Prudential Authority. */
  approverAuthority: z.enum(["CRC", "BRC", "PA"]),

  /** ISO 8601 — when the standing exception expires. */
  expiryDate: z.string().min(1),

  approvedAt: z.string().min(1),
});

export type LexExceptionApprovedPayload = z.infer<typeof lexExceptionApprovedPayloadSchema>;

export function makeLexExceptionApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LexExceptionApprovedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LexExceptionApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: lexExceptionApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SicrTriggered — IFRS 9 §5.5.3 Significant-Increase-in-Credit-Risk memo
//
// Records the Stage-1 → Stage-2 transition for a counterparty under the
// IFRS 9 ECL framework. The transition is *memorial* — Stage-2 widens the
// ECL horizon from 12-month to lifetime for in-scope (amortised-cost /
// FVOCI) instruments, but for FVTPL instruments (the bank's FX-spot book
// per IFRS 9 §5.5.1 and the IFRS 9 ECL Provisioning Policy v1 §51) no GL
// allowance is taken — fair value changes absorb credit risk. The event
// therefore does not produce journal entries; it carries the supervisory
// signal that a counterparty has crossed the SICR threshold and the
// watchlist / monitoring uplift is required.
//
// Sources of trigger (per credit-risk-policy-v1 §165):
//   - settlement-failure-neither-delivered — mutual fail on an FX-spot
//     trade. Both legs still on the books; no cash has moved; no default
//     event in the §5.5.1 sense, but the counterparty's operational /
//     credit deterioration is now observable. Captured here as a SICR
//     signal, not a GL movement.
//   - settlement-failure-repeated — repeated operational delay or near-
//     fail pattern over a configurable horizon (CRC review required).
//   - external-rating-downgrade — ≥ 2-notch external-rating downgrade
//     since initial recognition.
//   - watchlist-placement — qualitative CRC placement on the credit
//     watchlist independent of a quantitative trigger.
//   - lex-utilisation-threshold — counterparty EAD ≥ 80% of LEX sub-limit.
//   - manual — qualitative CRC override.
//
// Triggering pattern:
//   Posting rules in `platform/accounting/posting-rules/` stay pure (they
//   produce `SubLedgerLeg[]` for GL events only). The `SicrTriggered`
//   event is emitted by a separate subscriber at
//   `platform/credit-risk/sicr-subscriber.ts` that watches for the
//   trigger event types above and appends a `SicrTriggered` event to the
//   store. Idempotency is enforced via deterministic `event_id` derived
//   from `(triggerEventId, partyId)`.
//
// Recovery condition:
//   IFRS 9 §B5.5.7 contemplates reversal of a SICR classification once
//   credit risk no longer reflects a significant increase. The Bank's
//   credit-risk-policy-v1 §168 specifies the watchlist exit conditions;
//   the `recoveryCondition` field carries the prose description of what
//   needs to happen to revert to Stage-1. The reversal itself is a
//   separate event (SicrCleared — future slice; out of scope here).
//
// Citations:
//   IFRS 9 §5.5.1 (FVTPL out of ECL scope);
//   IFRS 9 §5.5.3 (SICR Stage 1 → Stage 2 transition);
//   IFRS 9 §5.5.13 (credit-impaired financial asset, Stage-3 measurement);
//   IFRS 9 §B5.5.7 (reversal of SICR classification);
//   Policies/credit-risk-policy-v1.md §165 (SICR triggers) + §166
//     (Stage 3 default triggers);
//   Policies/ifrs9-ecl-provisioning-policy-v1.md §51 (FVTPL out of scope);
//   PRs #608/#609/#616/#641 (FX-spot posting-rule pack);
//   Kai PR #645 (end-to-end FX-spot scenario that surfaced this gap);
//   Helena (Chief Risk Officer, governance) FX-spot-only market risk
//     scope review (2026-05-20);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// ---------------------------------------------------------------------------

export const ifrs9StageSchema = z.enum(["stage-1", "stage-2", "stage-3"]);
export type Ifrs9Stage = z.infer<typeof ifrs9StageSchema>;

export const sicrTriggerKindSchema = z.enum([
  "settlement-failure-neither-delivered",
  "settlement-failure-repeated",
  "external-rating-downgrade",
  "watchlist-placement",
  "lex-utilisation-threshold",
  "manual",
]);
export type SicrTriggerKind = z.infer<typeof sicrTriggerKindSchema>;

export const sicrTriggeredPayloadSchema = z
  .object({
    /** Party register ID of the counterparty entering SICR. */
    partyId: z.string().min(1),

    /** The kind of trigger that fired the SICR transition. */
    triggerKind: sicrTriggerKindSchema,

    /**
     * `event_id` of the source event that triggered this SICR (e.g.
     * the `FxSettlementFailed{neither-delivered}` event), or `null` when
     * the trigger is qualitative (manual CRC override / watchlist
     * placement with no single source event).
     */
    triggerEventId: z.string().min(1).nullable(),

    /** ISO 8601 timestamp when the SICR transition was recognised. */
    triggerDate: z.string().min(1),

    /** Prior IFRS-9 stage. Typical: "stage-1". */
    previousStage: ifrs9StageSchema,

    /** New IFRS-9 stage. Must differ from previousStage. */
    newStage: ifrs9StageSchema,

    /**
     * One or more citations / `event_id`s supporting the SICR trigger
     * (e.g. the chain of settlement-failures or rating-downgrade events
     * the CRC weighed). Minimum 1 to enforce auditability.
     */
    evidence: z.array(z.string().min(1)).min(1),

    /**
     * Prose description of the conditions required to revert to Stage-1
     * (IFRS 9 §B5.5.7; credit-risk-policy-v1 §168). Example:
     * "20 consecutive successful settlements without operational fail,
     * combined with no external rating downgrade for 6 months."
     */
    recoveryCondition: z.string().min(1),

    /**
     * Optional credit-impaired flag (IFRS 9 §5.5.13). When `true`, the
     * counterparty has also crossed the §5.5.13 default threshold and is
     * a Stage-3 candidate. When `triggerKind` is `manual` the CRC may
     * use this flag to short-circuit the staging staircase.
     */
    creditImpaired: z.boolean().optional(),

    /**
     * Optional watchlist assignment marker — the credit-watchlist tier
     * the counterparty is placed onto (e.g. "watch-tier-1"). Absent
     * when the SICR signal does not yet warrant watchlist enrolment.
     */
    watchlistTier: z.string().min(1).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.previousStage === p.newStage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `SicrTriggered requires previousStage (${p.previousStage}) !== newStage (${p.newStage}). A no-op staging transition is not a SICR event.`,
        path: ["newStage"],
      });
    }
    // Forward-direction only — Stage downgrade reversals (Stage-2 → Stage-1)
    // are handled by a separate `SicrCleared` event (future slice). This
    // refine guards against accidentally back-dating a reversal through
    // SicrTriggered.
    const order: Record<Ifrs9Stage, number> = {
      "stage-1": 1,
      "stage-2": 2,
      "stage-3": 3,
    };
    if (order[p.newStage] <= order[p.previousStage]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `SicrTriggered must move stages forward (e.g. stage-1 → stage-2). Reversals use SicrCleared. Got ${p.previousStage} → ${p.newStage}.`,
        path: ["newStage"],
      });
    }
  });

export type SicrTriggeredPayload = z.infer<typeof sicrTriggeredPayloadSchema>;

export function makeSicrTriggered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SicrTriggeredPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "SicrTriggered requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SicrTriggered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sicrTriggeredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CounterpartyBaselClassAssigned — authoritative Basel counterparty class
//
// The standardised-approach risk-weight a credit exposure attracts depends on
// the counterparty's Basel class (sovereign / bank / corporate-ig / corporate-
// non-ig / retail / …) per BCBS CRE20. That class is a CRO credit judgement,
// NOT something the RWA mapping code may invent. Before this event existed,
// `rwa-from-positions` hard-coded `corporate-non-ig` (100%) for every SA-CCR
// derivative exposure — a prudent floor, but the class lived in mapping code,
// decoupled from any authoritative register and invisible to the CRO.
//
// This event is the canonical, event-of-record assignment of a counterparty's
// Basel class, set by the credit-risk authority (CRC / CRO). The RWA projection
// resolves the latest-effective assignment per counterparty and applies the
// corresponding risk weight; a counterparty with NO assignment falls back to
// the prudent `corporate-non-ig` interim (over-states capital, refines down as
// classification lands) and is surfaced by `recon:counterparty-basel-
// classification-coverage` so the residual is visible, never silent.
//
// `baselClass` mirrors the `CounterpartyType` taxonomy in
// `platform/risk/rwa-engine.ts` (CRE20). The two are kept in lock-step by a
// compile-time assertion in `platform/risk/counterparty-classification.ts`
// (the reader) — this module does not import from the risk layer to keep the
// event-store layer dependency-free.
//
// Authority: D-FX-COUNTERPARTY-BASEL-CLASSIFICATION (CEO session-delegation);
//   BCBS CRE20 (standardised credit risk — counterparty taxonomy);
//   RRB Regulation 38; Policies/credit-risk-policy-v1.md §3.
// ---------------------------------------------------------------------------

export const baselCounterpartyClassSchema = z.enum([
  "sovereign-domestic-currency",
  "sovereign-foreign-currency",
  "mdb-zero-weight",
  "bank",
  "pse",
  "corporate-ig",
  "corporate-non-ig",
  "retail",
  "residential-mortgage",
  "commercial-real-estate",
  "past-due",
  "equity",
  "other",
]);
export type BaselCounterpartyClass = z.infer<typeof baselCounterpartyClassSchema>;

export const counterpartyBaselClassAssignedPayloadSchema = z.object({
  /** Party register ID of the counterparty being classified. */
  counterpartyId: z.string().min(1),

  /** Assigned Basel standardised-approach class (CRE20 taxonomy). */
  baselClass: baselCounterpartyClassSchema,

  /** External-rating bucket where assessed (CRE20 lookup). Optional. */
  ratingBucket: z.enum(["aaa-aa", "a", "bbb", "bb", "below-bb", "unrated"]).optional(),

  /** Residual-maturity bucket — relevant for `bank` exposures. Optional. */
  residualMaturity: z.enum(["short-term", "long-term"]).optional(),

  /** Seat / Party ID of the assigning authority (CRO / CRC). */
  assignedBy: z.string().min(1),

  /** Authority level. CRC = Credit Risk Committee; CRO = Chief Risk Officer. */
  approverAuthority: z.enum(["CRC", "CRO"]),

  /** Credit-assessment basis (prose) — why this class was assigned. */
  rationale: z.string().min(1),

  /** Pointer to the underlying credit-assessment / rating evidence. */
  evidenceRef: z.string().min(1),

  /** ISO 8601 — when this classification takes effect. */
  effectiveFrom: z.string().min(1),

  /** ISO 8601 — when the assignment was recorded. */
  assignedAt: z.string().min(1),
});

export type CounterpartyBaselClassAssignedPayload = z.infer<
  typeof counterpartyBaselClassAssignedPayloadSchema
>;

export function makeCounterpartyBaselClassAssigned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyBaselClassAssignedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "CounterpartyBaselClassAssigned requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyBaselClassAssigned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyBaselClassAssignedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES — registry of event types
// in this module.
//
// To add a new CCR / LEX event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a row to platform/event-store/registry/counterparty-credit-risk.ts,
//   (4) add a spread in event-types/index.ts.
// ---------------------------------------------------------------------------

export const COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES = [
  "CcrReplacementCostComputed",
  "CcrEadComputed",
  "LexUtilisationComputed",
  "LexExceptionApproved",
  "SicrTriggered",
  "CounterpartyBaselClassAssigned",
] as const;

export type CounterpartyCreditRiskEventType =
  (typeof COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// DECIMAL-MIGRATION: V2 MoneyWire payload types (slice 2)
//
// CcrEadComputed carries `rc`, `pfe`, `ead` as bare integers (no *Minor suffix,
// no MoneyWire) — this was an oversight in the original design. The *Minor gate
// CANNOT see these bare-numeric fields because they have no *Minor suffix.
// V2 lifts rc/pfe/ead to MoneyWire so the decimal-native gate covers them.
//
// Rounding policy: HALF_UP (SA-CCR — regulatory convention per BCBS d317).
//
// Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC (CEO-approved 2026-06-14, 9232352c).
// ---------------------------------------------------------------------------

import type { Money } from "../../core/decimal-money";
import type { MoneyWire } from "../../core/money-codec";
import { encodeMoney, moneyWireFromMinor } from "../../core/money-codec";

// ── CcrEadComputed V2 ────────────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by CcrEadComputedPayloadV2. */
export type CcrEadComputedPayloadLegacy = CcrEadComputedPayload;

/**
 * V2 CcrEadComputed payload: rc / pfe / ead are MoneyWire (decimal string,
 * HALF_UP rounding — SA-CCR regulatory convention per BCBS d317 §10).
 */
export interface CcrEadComputedPayloadV2 extends Omit<CcrEadComputedPayload, "rc" | "pfe" | "ead"> {
  /** Replacement cost as exact-decimal MoneyWire (HALF_UP rounding, SA-CCR). */
  readonly rc: MoneyWire;
  /** Potential future exposure add-on as MoneyWire. */
  readonly pfe: MoneyWire;
  /** Exposure-at-default = α × (RC + PFE) as MoneyWire. */
  readonly ead: MoneyWire;
}

/**
 * Encode a CcrEadComputedPayload to V2. `rcMoney`, `pfeMoney`, `eadMoney`
 * must be exact-decimal `Money` values computed via HALF_UP rounding.
 */
export function encodeCcrEadComputed(
  base: Omit<CcrEadComputedPayload, "rc" | "pfe" | "ead">,
  rcMoney: Money,
  pfeMoney: Money,
  eadMoney: Money,
): CcrEadComputedPayloadV2 {
  return {
    ...base,
    rc: encodeMoney(rcMoney),
    pfe: encodeMoney(pfeMoney),
    ead: encodeMoney(eadMoney),
  };
}

/**
 * Decode a legacy CcrEadComputedPayload (bare integer minor units) to V2.
 * Uses `moneyWireFromMinor` with the payload's `currency` field.
 */
export function decodeCcrEadComputed(raw: CcrEadComputedPayload): CcrEadComputedPayloadV2 {
  const { rc, pfe, ead, ...rest } = raw;
  return {
    ...rest,
    rc: moneyWireFromMinor(rc, raw.currency),
    pfe: moneyWireFromMinor(pfe, raw.currency),
    ead: moneyWireFromMinor(ead, raw.currency),
  };
}

/**
 * The PERMANENT legacy shape-sniff for `CcrEadComputed`: a legacy V1 event
 * carries `rc`/`pfe`/`ead` as bare integer MINOR units, so a numeric `ead`
 * discriminates the un-stamped V1 shape from a V2 (MoneyWire) payload.
 *
 * This sniff is RETAINED — but its role is now strictly bounded: it is the
 * fallback for pre-existing, UN-stamped legacy events in the immutable store
 * (events that pre-date the explicit `schema_version` envelope field). It is
 * NEVER the discriminator for a new, stamped version. The version-explicit
 * upcaster registry (`platform/event-store/upcaster-registry.ts`) references
 * THIS predicate as the `CcrEadComputed` declaration's `legacyShapeSniff`, so
 * the sniff lives in exactly one place. (D-EVENT-ENVELOPE-SCHEMA-VERSION.)
 */
export function isLegacyCcrEadShape(payload: unknown): boolean {
  return typeof (payload as { ead?: unknown }).ead === "number";
}

/**
 * Normalise a replayed `CcrEadComputed` payload to V2 (MoneyWire rc/pfe/ead).
 * The event store is mixed-version (events are immutable): legacy V1 events
 * carry rc/pfe/ead as integer minor units. This is the NO-EXPLICIT-VERSION
 * entry point — it applies the retained legacy shape-sniff
 * (`isLegacyCcrEadShape`); V2 payloads pass through. Every read-side consumer of
 * `CcrEadComputed` MUST funnel payloads through this (or, when it has the
 * envelope's explicit `schema_version`, through `upcastCcrEadComputed` in the
 * upcaster registry) — a raw V2 cast crashes on a legacy event
 * (`toDecimal(undefined)` on the integer `ead`). DECIMAL-MIGRATION
 * (D-DECIMAL-NATIVE-CONSUMER-MIGRATION); D-EVENT-ENVELOPE-SCHEMA-VERSION.
 */
export function normalizeCcrEadPayload(payload: unknown): CcrEadComputedPayloadV2Type {
  return (
    isLegacyCcrEadShape(payload)
      ? decodeCcrEadComputed(payload as CcrEadComputedPayload)
      : (payload as CcrEadComputedPayloadV2Type)
  ) as CcrEadComputedPayloadV2Type;
}

export { encodeMoney, moneyWireFromMinor };
