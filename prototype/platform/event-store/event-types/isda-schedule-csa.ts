// platform/event-store/event-types/isda-schedule-csa.ts
//
// ISDA Master Agreement Schedule + Credit Support Annex (CSA) election events.
//
// SCOPE:
//   WS-ODP-ISDA-ANNEXURES (ORG-ODP-COND-005 · Regulation: urn:regulation:odp:cs-2-2018)
//
// Three event types:
//   - IsdaScheduleElected     — records elected terms of the ISDA Master
//                               Agreement Schedule (governing law, termination
//                               currency, cross-default thresholds, calculation
//                               agent, credit-event-upon-merger election,
//                               automatic-early-termination election).
//   - IsdasCsaElected         — records elected CSA terms (thresholds, MTA,
//                               independent amount, eligible collateral
//                               schedules, valuation agent, valuation time,
//                               haircuts). Currency at type level (Principle 5).
//                               These elections are the CANONICAL INPUTS to the
//                               collateral-segregation engine (WS-ODP-COLLATERAL)
//                               and the portfolio-recon engine (WS-ODP-PORTFOLIO);
//                               those consumers read this event stream, not any
//                               secondary data store.
//   - IsdaCsaSuperseded       — audit trail event when a CSA is terminated or
//                               replaced (e.g. migrating from 1994-NY to 2016-VM
//                               ISDA CSA following EMIR/UMR reform).
//
// Authority:
//   ORG-ODP-COND-005 (Derivatives Counterparty obligation — ODP rule CS 2/2018)
//   urn:regulation:odp:cs-2-2018 — ODP Conduct Standard 2 of 2018 §§ 3, 7, 14
//   ISDA 2002 Master Agreement §§ 5–6 (Events of Default, Termination Events)
//   ISDA 1994 CSA (NY law) §§ 3, 4, 9  — eligible-collateral, thresholds, MTA
//   ISDA 2016 VM CSA §§ 3, 4            — variation-margin CSA elected terms
//   BCBS d317 (SA-CCR) §§ 5–7           — CSA terms consumed by SA-CCR RC
//   Policies/credit-risk-policy-v1.md §3 lines 121–140 (SA-CCR methodology)
//   Principle 1 (events-are-truth): every elected term is an event first
//   Principle 5 (multi-currency): all monetary thresholds carry currency
//
// Author: Imani (General Counsel, legal)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * MoneyAmount — ISO 4217 currency + minor-unit amount pair.
 * Per Principle 5 (multi-currency from day one) — no default currency.
 */
const moneyAmountSchema = z.object({
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  amountMinor: z.number().int(),
});
type MoneyAmount = z.infer<typeof moneyAmountSchema>;

/**
 * IsdaFormVersion — the ISDA master-agreement form version govering the
 * Schedule. The 2002 form is the controlled-launch standard; 2025 is the
 * post-LIBOR successor; 1992 legacy is representable for pre-migration
 * counterparties.
 */
const isdaFormVersionSchema = z.enum(["1992", "2002", "2025"]);
type IsdaFormVersion = z.infer<typeof isdaFormVersionSchema>;

/**
 * CsaFormType — the CSA form governing margin posting.
 *   "1994-NY"   — ISDA 1994 Credit Support Annex (NY law; title-transfer)
 *   "1995-DEED" — ISDA 1995 Credit Support Deed (English law; charge form)
 *   "1995-GA"   — ISDA 1995 Credit Support Annex (English law; title-transfer)
 *   "2016-VM"   — ISDA 2016 Credit Support Annex for VM (EMIR/UMR; VM-only)
 *   "2016-IM"   — ISDA 2016 Phase-One Credit Support Annex for IM (UMR Phase 1)
 *   "2018-IM"   — ISDA 2018 Credit Support Annex for IM (UMR SA standard)
 *
 * For SA/ODP purposes, 2016-VM is the primary form under CS 2/2018 §14
 * (variation margin); 2018-IM applies once UMR phase-in triggers IM obligations.
 */
const csaFormTypeSchema = z.enum([
  "1994-NY",
  "1995-DEED",
  "1995-GA",
  "2016-VM",
  "2016-IM",
  "2018-IM",
]);
type CsaFormType = z.infer<typeof csaFormTypeSchema>;

/**
 * GoverningLaw — the law elected in the ISDA Schedule §13 / Part 4.
 * SA-law is permitted per the ODP's own Schedule template; English law
 * is the ISDA Master standard.
 */
const governingLawSchema = z.enum(["English", "NY", "SA", "Japanese", "French", "German"]);
type GoverningLaw = z.infer<typeof governingLawSchema>;

// ---------------------------------------------------------------------------
// IsdaScheduleElected
//
// Emitted when the elected terms of an ISDA Master Agreement Schedule
// are recorded or updated for a counterparty. The events-first design
// means:
//   - the Schedule's elected terms ARE this event (no separate document
//     is canonical);
//   - downstream projections (netting-set register, SA-CCR, credit-limit
//     engine) fold this stream to derive counterparty-level parameters;
//   - any amendment to elected terms (e.g. changing Termination Currency)
//     emits a new IsdaScheduleElected event with the updated terms; the
//     prior event is superseded by the new one via `replacesScheduleId`.
// ---------------------------------------------------------------------------

export const isdaScheduleElectedPayloadSchema = z.object({
  // ---- Counterparty ----

  /** Party register URN of the counterparty (`party:<scheme>:<id>`). */
  counterpartyId: z.string().min(1),

  /** Legal-entity name of the counterparty (for display; not canonical). */
  counterpartyName: z.string().min(1),

  /** ISDA-form version (1992 / 2002 / 2025). */
  isdaFormVersion: isdaFormVersionSchema,

  // ---- Schedule execution ----

  /**
   * ISO 8601 date the Schedule was executed (both parties signed).
   * The Schedule comes into force on this date.
   */
  executionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /**
   * ISO 8601 date the Schedule was dated (the date appearing on the
   * front page — may differ from the execution date by convention).
   */
  scheduleDatedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  // ---- Part 1 — Termination provisions ----

  /**
   * Governing law elected in Part 4 (General) or Part 5 (Other
   * Provisions) of the Schedule. The default under ISDA 2002 is
   * English law; SA-law election permitted.
   *
   * ISDA 2002 MA §13: Governing Law and Jurisdiction.
   */
  governingLaw: governingLawSchema,

  /**
   * Jurisdiction for dispute resolution (typically the courts of the
   * elected governing-law jurisdiction; may differ for submission to
   * jurisdiction clause).
   */
  disputeResolutionJurisdiction: z.string().min(1),

  /**
   * Termination Currency elected in Part 1(g) of the Schedule.
   * Per ISDA 2002 §6(f)(ii), the Determining Party converts all Close-Out
   * Amounts to the Termination Currency. Per Principle 5 — mandatory
   * ISO 4217 three-letter code.
   */
  terminationCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),

  // ---- Cross-Default provisions ----

  /**
   * Cross-Default elected for Party A (the bank) in Part 1(b).
   * `null` means Cross-Default is NOT elected for this party.
   */
  crossDefaultPartyA: z
    .object({
      /**
       * Cross-Default Obligation type elected in Part 1(b)(ii) —
       * Specified Indebtedness, Borrowed Money, or a bespoke category.
       */
      obligationType: z.enum(["Specified-Indebtedness", "Borrowed-Money", "Bespoke"]),
      /** Free-form description when `obligationType === "Bespoke"`. */
      bespokeCategoryDescription: z.string().optional(),
      /**
       * Threshold amount in Termination Currency (minor units) above
       * which a default by Party A on other obligations cross-triggers.
       * Per Principle 5 — tagged to Termination Currency.
       */
      threshold: moneyAmountSchema,
    })
    .nullable(),

  /**
   * Cross-Default elected for Party B (the counterparty) in Part 1(b).
   * Mirror of partyA. `null` if not elected.
   */
  crossDefaultPartyB: z
    .object({
      obligationType: z.enum(["Specified-Indebtedness", "Borrowed-Money", "Bespoke"]),
      bespokeCategoryDescription: z.string().optional(),
      threshold: moneyAmountSchema,
    })
    .nullable(),

  // ---- Credit-Event-Upon-Merger ----

  /**
   * Whether the Credit-Event-Upon-Merger provision (ISDA 2002 §5(b)(iv))
   * applies to Party A (the bank). `true` = applicable; `false` = not
   * applicable (the default under the standard form).
   */
  creditEventOnMergerPartyA: z.boolean(),

  /** Mirror for Party B (counterparty). */
  creditEventOnMergerPartyB: z.boolean(),

  // ---- Automatic Early Termination ----

  /**
   * Automatic Early Termination (AET) elected under Part 1(h) for
   * Party A. AET is NOT elected by default in ISDA 2002; it may be
   * required in jurisdictions where a brief window for counterparty
   * set-off exists before insolvency proceedings commence.
   */
  automaticEarlyTerminationPartyA: z.boolean(),

  /** Mirror for Party B. */
  automaticEarlyTerminationPartyB: z.boolean(),

  // ---- Calculation Agent ----

  /**
   * Calculation Agent identity. Per ISDA 2002 §14 (Definitions),
   * the Calculation Agent is the party making determinations under
   * the Agreement (mark, breakage costs, close-out amounts).
   * Typically one of: "Party-A" (bank), "Party-B" (counterparty),
   * "Both" (not ISDA standard — means each party calculates for its
   * own Transactions), or a named third party.
   */
  calculationAgent: z.union([
    z.enum(["Party-A", "Party-B"]),
    z.object({ thirdParty: z.string().min(1) }),
  ]),

  // ---- Specified Transaction / Close-out Netting ----

  /**
   * Whether close-out netting is elected in the Schedule (Part 1 or
   * Part 4). When `true`, all Transactions are subject to the
   * single-agreement / netting-on-close-out mechanism of ISDA 2002 §6.
   * Must be `true` for the netting-set engine to recognise this
   * counterparty's Transactions as a single netting set.
   */
  closeOutNettingElected: z.boolean(),

  // ---- Amendment / supersession chain ----

  /**
   * Event-ID of the prior `IsdaScheduleElected` event this one
   * supersedes. `null` if this is the first Schedule for the
   * counterparty. Provides an immutable amendment chain.
   */
  replacesScheduleId: z.string().uuid().nullable(),

  // ---- Document anchor ----

  /**
   * BLAKE3 hash of the executed Schedule document in the RMS doc store
   * (`blake3:<hex>`). Optional during the build phase; required from
   * commencement-of-trading.
   */
  documentHash: z
    .string()
    .regex(/^blake3:[0-9a-f]{64}$/)
    .optional(),
});

export type IsdaScheduleElectedPayload = z.infer<typeof isdaScheduleElectedPayloadSchema>;

export function makeIsdaScheduleElected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IsdaScheduleElectedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "IsdaScheduleElected requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-005 and the relevant ISDA 2002 MA section.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IsdaScheduleElected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: isdaScheduleElectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IsdaCsaElected
//
// Emitted when the elected terms of a Credit Support Annex (CSA) are
// recorded for a counterparty. One CSA per counterparty (bilateral) at
// v1; multi-currency CSA support (ISDA 2016 VM allows a per-currency
// threshold matrix) is captured via `thresholdSchedule` (array of one
// per currency).
//
// These elections are the CANONICAL INPUTS that downstream engines consume:
//   - Collateral-segregation engine (WS-ODP-COLLATERAL): reads threshold,
//     MTA, eligibleCollateral, haircuts to determine margin calls and
//     portfolio HQLA composition.
//   - Portfolio-recon engine (WS-ODP-PORTFOLIO): reads valuationAgent,
//     valuationTime, MTA to determine when to dispute and when to pass.
//   - SA-CCR engine (platform/risk/sa-ccr/): reads threshold + MTA to
//     compute margined vs unmargined replacement cost branch.
//
// Currency at the type level (Principle 5): every monetary field is a
// MoneyAmount (currency + amountMinor); the `baseCurrency` field is the
// default currency for the CSA when no per-currency schedule is defined.
// ---------------------------------------------------------------------------

/**
 * EligibleCollateralItem — a single collateral category entry in the
 * CSA eligible-collateral schedule.
 *
 * Covers ISDA 1994 CSA Paragraph 13(b) (Eligible Collateral) and the
 * equivalent paragraph in ISDA 2016 VM Paragraph 13(c)(ii)
 * (Eligible Credit Support (VM)).
 */
export const eligibleCollateralItemSchema = z.object({
  /**
   * Collateral category code — a concise enum covering the main
   * asset types the ODP / SA schedule allows as eligible collateral.
   *
   *   "cash-ccy"        — cash in a specified currency
   *   "govt-bond-za"    — SA Government bond (SAGB)
   *   "govt-bond-g10"   — G10 sovereign bond (non-ZA)
   *   "corp-bond-ig"    — IG corporate bond
   *   "equity-index"    — equity satisfying an index-membership condition
   *   "gold"            — gold bullion
   *   "hqla-level1"     — HQLA Level 1 (Basel III definition)
   *   "hqla-level2a"    — HQLA Level 2A
   *   "hqla-level2b"    — HQLA Level 2B
   *   "bespoke"         — bespoke / non-standard (full description required)
   */
  category: z.enum([
    "cash-ccy",
    "govt-bond-za",
    "govt-bond-g10",
    "corp-bond-ig",
    "equity-index",
    "gold",
    "hqla-level1",
    "hqla-level2a",
    "hqla-level2b",
    "bespoke",
  ]),
  /** ISO 4217 currency that the collateral is denominated in (if "cash-ccy" category). */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .optional(),
  /**
   * Haircut as a decimal (0.00 = no haircut; 0.02 = 2% haircut).
   * Represents the percentage reduction applied to the market value of
   * collateral when counting toward the margin requirement.
   * Per ISDA 1994 CSA Para 13(b) / 2016 VM Para 13(c)(ii).
   */
  haircutDecimal: z.number().min(0).max(1),
  /**
   * Minimum denomination (minor units in the collateral currency).
   * Optional — omit when no minimum is specified.
   */
  minimumDenomination: moneyAmountSchema.optional(),
  /**
   * Free-form description. Required when `category === "bespoke"`.
   */
  description: z.string().optional(),
});
export type EligibleCollateralItem = z.infer<typeof eligibleCollateralItemSchema>;

/**
 * PerCurrencyThreshold — a threshold / MTA entry in the per-currency
 * schedule (used with ISDA 2016 VM CSA which allows different
 * thresholds for each settlement currency).
 */
export const perCurrencyThresholdSchema = z.object({
  /** ISO 4217 settlement currency this row applies to. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /**
   * Threshold (TH) for the bank's exposures in this currency.
   * Cash CSAs typically elect threshold = 0 (any exposure above zero
   * must be collateralised). Minor units in `currency`.
   */
  thresholdPartyA: moneyAmountSchema,
  /**
   * Threshold (TH) for the counterparty's exposures in this currency.
   */
  thresholdPartyB: moneyAmountSchema,
  /** Minimum Transfer Amount for the bank. Minor units in `currency`. */
  mtaPartyA: moneyAmountSchema,
  /** Minimum Transfer Amount for the counterparty. */
  mtaPartyB: moneyAmountSchema,
});
export type PerCurrencyThreshold = z.infer<typeof perCurrencyThresholdSchema>;

export const isdaCsaElectedPayloadSchema = z.object({
  // ---- Counterparty ----

  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),

  // ---- CSA form ----

  /** CSA form type — see `csaFormTypeSchema`. */
  csaFormType: csaFormTypeSchema,

  /** ISO 8601 date the CSA was executed. */
  executionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  // ---- Base currency ----

  /**
   * Base settlement currency for the CSA. Under ISDA 1994 and 2016 VM,
   * this is the currency in which margin is posted and returned unless
   * a per-currency schedule overrides.
   * Per Principle 5 — mandatory, no default.
   */
  baseCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),

  // ---- Threshold and MTA in base currency ----

  /**
   * Threshold (TH) for Party A (bank) in base currency.
   * For variation-margin CSAs under ODP CS 2/2018 § 14, the threshold
   * must be zero (ISDA 2016 VM Para 13(m): "Threshold means zero").
   */
  thresholdPartyA: moneyAmountSchema,

  /**
   * Threshold (TH) for Party B (counterparty) in base currency.
   */
  thresholdPartyB: moneyAmountSchema,

  /**
   * Minimum Transfer Amount (MTA) for Party A in base currency.
   * Per ODP CS 2/2018 §14(c): the MTA for VM must be small enough that
   * margin calls can be made within the MPOR horizon.
   */
  mtaPartyA: moneyAmountSchema,

  /** MTA for Party B in base currency. */
  mtaPartyB: moneyAmountSchema,

  /**
   * Independent Amount (IA) posted by Party A (bank) in base currency.
   * Represents initial margin posted by the bank. Per ISDA 1994 CSA
   * Para 13(l) and BCBS/IOSCO IM framework; zero for vanilla VM-only CSAs.
   */
  independentAmountPartyA: moneyAmountSchema,

  /**
   * Independent Amount posted by Party B (counterparty) in base currency.
   */
  independentAmountPartyB: moneyAmountSchema,

  // ---- Per-currency threshold schedule ----

  /**
   * Per-currency threshold / MTA schedule. For ISDA 2016 VM CSAs with
   * multiple settlement currencies. If non-empty, values in this array
   * override the base-currency threshold / MTA for the specified currency.
   * Empty array for single-currency / base-currency-only CSAs.
   */
  perCurrencyThresholds: z.array(perCurrencyThresholdSchema).default([]),

  // ---- Eligible collateral ----

  /**
   * Eligible collateral schedule for Party A posting collateral
   * (i.e. the categories of assets Party B will accept from Party A).
   */
  eligibleCollateralPartyA: z.array(eligibleCollateralItemSchema),

  /**
   * Eligible collateral schedule for Party B posting collateral.
   */
  eligibleCollateralPartyB: z.array(eligibleCollateralItemSchema),

  // ---- Valuation ----

  /**
   * Valuation Agent — the party that calculates the Value and the
   * Delivery Amount / Return Amount. Per ISDA 1994 CSA Para 13(k).
   *
   * "Party-A" = bank; "Party-B" = counterparty; "Both" means each
   * party calculates independently (per certain 2016 VM elections);
   * `thirdParty` for a named independent calculation agent.
   */
  valuationAgent: z.union([
    z.enum(["Party-A", "Party-B", "Both"]),
    z.object({ thirdParty: z.string().min(1) }),
  ]),

  /**
   * Valuation Time — the time at which the Valuation Agent determines
   * market values for collateral. Per ISDA 1994 CSA Para 13(k)(ii) and
   * 2016 VM Para 13(o).
   * Format: "HH:MM <TZ>" e.g. "12:00 London", "17:00 New York".
   */
  valuationTime: z.string().min(1),

  /**
   * Notification Time — the deadline by which a party must notify the
   * other of a margin call. Per ISDA 1994 CSA Para 4(b)(ii).
   * Format: "HH:MM <TZ>".
   */
  notificationTime: z.string().min(1),

  /**
   * Settlement Day Count — the number of local business days after
   * notification that a margin transfer must be made. Per ISDA 1994 CSA
   * Para 4(b); the standard is T+1 for ODP-regulated entities.
   */
  settlementDayCount: z.number().int().min(0).max(5),

  // ---- Segregation ----

  /**
   * Whether the counterparty's IM postings must be held in a
   * segregated account (Phase 1 UMR requirement). Only relevant for
   * `csaFormType === "2016-IM"` or `"2018-IM"`.
   */
  imSegregationRequired: z.boolean(),

  /**
   * Whether the bank's own IM postings are held in a segregated account
   * at the counterparty's custodian.
   */
  ownImSegregated: z.boolean(),

  // ---- Amendment / supersession chain ----

  /**
   * Event-ID of the prior `IsdaCsaElected` event this one supersedes.
   * `null` if this is the first CSA for the counterparty.
   */
  replacesCsaId: z.string().uuid().nullable(),

  // ---- Linked Schedule ----

  /**
   * Event-ID of the `IsdaScheduleElected` event for the ISDA MA under
   * which this CSA operates. Required — every CSA must be associated with
   * a Schedule event that establishes the governing ISDA MA.
   */
  linkedScheduleEventId: z.string().uuid(),

  // ---- Document anchor ----

  /**
   * BLAKE3 hash of the executed CSA document in the RMS doc store.
   * Optional during the build phase; required from commencement-of-trading.
   */
  documentHash: z
    .string()
    .regex(/^blake3:[0-9a-f]{64}$/)
    .optional(),
});

export type IsdaCsaElectedPayload = z.infer<typeof isdaCsaElectedPayloadSchema>;

export function makeIsdaCsaElected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IsdaCsaElectedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "IsdaCsaElected requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-COND-005 and the ODP CS 2/2018 section covering CSA elections.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IsdaCsaElected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: isdaCsaElectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IsdaCsaSuperseded
//
// Emitted when a CSA is terminated or superseded — e.g. on migration from
// a 1994-NY to a 2016-VM CSA following EMIR/UMR mandate, or when the
// counterparty relationship is terminated and the CSA is released.
//
// The superseded CSA's event-ID is recorded via `supersedesId` on the
// new `IsdaCsaElected` event; this companion event records the formal
// termination with a reason and the close-out date.
// ---------------------------------------------------------------------------

const csaSupersessionReasonSchema = z.enum([
  "replaced-by-new-form", // e.g. 1994-NY → 2016-VM migration
  "counterparty-terminated",
  "regulatory-mandate", // e.g. UMR phase-in
  "mutual-agreement",
  "default", // CSA terminated on Event of Default / ETD
]);
type CsaSupersessionReason = z.infer<typeof csaSupersessionReasonSchema>;

export const isdaCsaSupersededPayloadSchema = z.object({
  /** Party register URN of the counterparty. */
  counterpartyId: z.string().min(1),
  /**
   * Event-ID of the `IsdaCsaElected` event being superseded.
   * Provides an immutable chain: superseded-by → supersedes.
   */
  supersedesEventId: z.string().uuid(),
  /** ISO 8601 date the CSA was terminated / superseded. */
  supersessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Why the CSA was superseded. */
  reason: csaSupersessionReasonSchema,
  /** Free-form note (optional). */
  note: z.string().optional(),
  /**
   * Event-ID of the replacement `IsdaCsaElected` event when
   * `reason === "replaced-by-new-form"` or `"regulatory-mandate"`.
   * `null` when no replacement was entered simultaneously.
   */
  replacedByEventId: z.string().uuid().nullable(),
});

export type IsdaCsaSupersededPayload = z.infer<typeof isdaCsaSupersededPayloadSchema>;

export function makeIsdaCsaSuperseded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IsdaCsaSupersededPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("IsdaCsaSuperseded requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IsdaCsaSuperseded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: isdaCsaSupersededPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DECIMAL-MIGRATION: V2 MoneyWire payload types (slice 2)
//
// The `MoneyAmount` sub-type (currency + amountMinor) is used throughout this
// file for thresholds and MTAs. V2 provides a `MoneyAmountV2` that replaces
// `amountMinor: number` with a `MoneyWire`. A helper `decodeMoneyAmount`
// converts legacy minor-unit values to the canonical decimal wire format.
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION.
// ---------------------------------------------------------------------------

import type { MoneyWire } from "../../core/money-codec";
import { moneyWireFromMinor } from "../../core/money-codec";

/** V2 money amount: replaces `amountMinor: number` with `amount: MoneyWire`. */
export interface MoneyAmountV2 {
  readonly currency: string;
  readonly amount: MoneyWire;
}

/** Convert a legacy `MoneyAmount` to V2. */
export function decodeIsdaMoneyAmount(raw: MoneyAmount): MoneyAmountV2 {
  return { currency: raw.currency, amount: moneyWireFromMinor(raw.amountMinor, raw.currency) };
}

// ---------------------------------------------------------------------------
// Type registry
// ---------------------------------------------------------------------------

export const ISDA_SCHEDULE_CSA_TYPED_EVENT_TYPES = [
  "IsdaScheduleElected",
  "IsdaCsaElected",
  "IsdaCsaSuperseded",
] as const;

export type IsdaScheduleCsaEventType = (typeof ISDA_SCHEDULE_CSA_TYPED_EVENT_TYPES)[number];

// Re-export shape types for consumers
export type { MoneyAmount, IsdaFormVersion, CsaFormType, GoverningLaw, CsaSupersessionReason };
