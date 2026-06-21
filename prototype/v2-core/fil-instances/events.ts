// v2-core/fil-instances/events.ts
//
// FIL instance lifecycle EVENT FAMILY (V2 WS-V2-BBAAS, FIL-instance
// materialisation slice).
//
// S0 (fil-core/lifecycle.ts) gave the kernel lifecycle SHAPES
// (`FilInstrumentCreated` / `FilInstrumentAmended` / `FilInstrumentTerminated`)
// — Zod shapes only, NOT registered event types, NOT projected. This module
// PROMOTES those shapes into a real, registered v2 event family by composing on
// the kernel base (instance URN + type URN + asOf) and adding the axes a
// materialised anchor-book record needs:
//
//   - `tenant`             — the tenant axis (S2). For the anchor book this is
//                            the anchor tenant id (LE-ZA-HOZ-BANK).
//   - `originatingEvent`   — a reference to the registered v1 event that carries
//                            the economic detail (the originating trade event,
//                            or the amendment-via event). Principle 1: the FIL
//                            instance record points back to the canonical event.
//   - `economicTerms`      — the SA-CCR-relevant economic terms a
//                            `RiskMeasurable` consumer reads off the instance:
//                            notional, currency, counterparty / netting set,
//                            asset class, direction, settlement date (the static
//                            term from which remaining-maturity is derived
//                            at-as-of), hedging-set tag. Carried on `Created`
//                            (and re-stamped on `Amended`) so the projection can
//                            answer the position query WITHOUT reaching back into
//                            v1 (D-MODEL-BINDING-CONTRACT-V1: facets are the sole
//                            data-access path).
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — NO imports from `platform/`,
// `runtime/`, `domains/` (enforced by `recon:v2-no-v1-import`). The v1-side
// registry wiring (`platform/event-store/event-types/fil-instances.ts` +
// `registry/fil-instances.ts`) imports FROM here, never vice-versa.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; Principle 1; Principle 2; Principle 5.
// Author: Atlas (Substrate Architect, engineering).

import { z } from "zod";
import {
  type FilLifecycleStage,
  filEventRefSchema,
  filLifecycleStageSchema,
} from "../fil-core/lifecycle";
import { instantSchema, moneySchema } from "../fil-core/primitives";
import { filInstanceUrnSchema, filTypeUrnSchema } from "../fil-core/urn";
import { bopCategoryTagSchema } from "../finsurv/bop-category";

// ---------------------------------------------------------------------------
// FIL economic-terms asset class — the FIL-native partition a RiskMeasurable /
// Valuable consumer keys on. Re-declared here (not imported from fil-facets) to
// keep the event family's grammar self-contained; the value set is the
// SA-CCR-quantifiable subset of the taxonomy asset classes PLUS `cash`. IR + FX
// are the SA-CCR-materialised scope; `cash` is the post-settlement member of the
// FX-trading book slice (D-CASH-ASSET-CLASS-V1) — a monetary cash balance that
// is NOT itself an SA-CCR derivative exposure but IS a real, event-sourced FIL
// instance (instrument-of-record) carrying its own Valuable. The wider union is
// admitted so later slices (credit/equity/commodity) extend without a schema
// change.
// ---------------------------------------------------------------------------

export const filSaCcrAssetClassSchema = z.enum([
  "ir",
  "fx",
  "cash",
  "credit",
  "equity",
  "commodity",
  // `capital` — the bank's OWN qualifying regulatory capital (D-CAPITAL-ASSET-
  // CLASS-V1). NOT itself an SA-CCR derivative exposure; it is the own-funds
  // instrument-of-record that sources the BA-700 / BA-100 capital numerator. It
  // is admitted into the FIL economic-terms asset-class union so a capital FIL
  // instance is a real, event-sourced instrument carrying its qualifying-capital
  // tier (read by the capital-composition fold), exactly as `cash` is admitted as
  // the post-settlement member without being an SA-CCR derivative.
  "capital",
]);

export type FilSaCcrAssetClass = z.infer<typeof filSaCcrAssetClassSchema>;

// ---------------------------------------------------------------------------
// Qualifying-capital dimension (D-CAPITAL-ASSET-CLASS-V1). A `capital`
// asset-class FIL instance carries the typed regulatory-capital tier the BA-700 /
// BA-100 composition fold sums on. The tier vocabulary is the Basel III / Reg 38
// three-tier partition (CET1 / AT1 / Tier 2); the sub-category names the specific
// own-funds component (paid-up ordinary shares, share premium, retained earnings,
// AT1 perpetual non-cumulative, Tier 2 subordinated debt, etc.).
//
// The tier values are byte-identical to `v2-core/accounting/chart-of-accounts.ts`
// `CoaCapitalTier` (`"cet1" | "at1" | "t2"`); re-declared here (not imported) to
// keep the event grammar self-contained, exactly as `filSaCcrAssetClassSchema`
// re-declares the SA-CCR asset-class subset. The composition fold cross-checks the
// instance tier against the CoA `capitalTier` of the resolved equity/liability
// account, so the two stay consistent (the recon gate fails closed on drift).
//
// SOURCE (Charter cmd 4 — source, don't hardcode): the tier partition is
// Reg 38(8) / BCBS RBC20.2 + CAP; the sub-categories are the CAP definition-of-
// capital components. Citations are carried on the Capital FIL model declaration
// and the posting rules, NOT magic numbers here — this is the typed vocabulary.
// ---------------------------------------------------------------------------

/** Basel III / Reg 38(8) qualifying-capital tier (aligned with CoaCapitalTier). */
export const filCapitalTierSchema = z.enum(["cet1", "at1", "t2"]);

export type FilCapitalTier = z.infer<typeof filCapitalTierSchema>;

/**
 * The own-funds sub-category — the specific CAP capital component within a tier.
 * A closed set so the composition fold can render BA-100 capital lines and the
 * recon gate can assert tier↔sub-category coherence (a `cet1.*` sub-category may
 * only sit under tier `cet1`, etc.). Fail-closed: an unknown sub-category is
 * rejected at parse, never silently bucketed.
 */
export const filCapitalSubCategorySchema = z.enum([
  // CET1 components (BCBS CAP; Reg 38(8); Banks Act §70 — paid-up share capital).
  "cet1.paid-up-ordinary-shares",
  "cet1.share-premium",
  "cet1.retained-earnings",
  "cet1.oci-reserve",
  // AT1 components (BCBS CAP — perpetual, non-cumulative, going-concern triggers).
  "at1.perpetual-noncumulative",
  // Tier 2 components (BCBS CAP — subordinated debt ≥5yr; qualifying provisions).
  "t2.subordinated-debt",
  "t2.qualifying-general-provisions",
]);

export type FilCapitalSubCategory = z.infer<typeof filCapitalSubCategorySchema>;

/**
 * The qualifying-capital dimension carried on a `capital` FIL instance's economic
 * terms. The tier is the composition axis; the sub-category names the CAP
 * component. The composition fold buckets the instrument by `tier`; the BA-100
 * line render keys on `subCategory`.
 */
export const filQualifyingCapitalSchema = z.object({
  /** The regulatory-capital tier (CET1 / AT1 / Tier 2). */
  tier: filCapitalTierSchema,
  /** The specific own-funds component within the tier (CAP definition of capital). */
  subCategory: filCapitalSubCategorySchema,
});

export type FilQualifyingCapital = z.infer<typeof filQualifyingCapitalSchema>;

/**
 * Tier↔sub-category coherence — `true` iff `subCategory` belongs to `tier` (the
 * sub-category string is prefixed with the tier). Pure, fail-closed-friendly:
 * the recon gate + the posting rules call this so a `cet1` instrument tagged
 * `t2.subordinated-debt` is caught, never silently summed into the wrong tier.
 */
export function capitalSubCategoryMatchesTier(
  tier: FilCapitalTier,
  subCategory: FilCapitalSubCategory,
): boolean {
  return subCategory.startsWith(`${tier}.`);
}

// ---------------------------------------------------------------------------
// A reference to the canonical v1 event of record that this lifecycle event
// derives from (Principle 1: the FIL instance is a render of the trade event).
// ---------------------------------------------------------------------------

export const filOriginatingEventRefSchema = z.object({
  /** The registered event type that carries the economic detail. */
  eventType: filEventRefSchema,
  /** The canonical event_id in the source (v1) store. */
  eventId: z.string().min(1),
});

export type FilOriginatingEventRef = z.infer<typeof filOriginatingEventRefSchema>;

// ---------------------------------------------------------------------------
// Economic terms — the SA-CCR-relevant fields a RiskMeasurable consumer reads
// off a materialised instance. These are the STATIC economic terms of the
// trade (notional, settlement date, direction, …); the as-of-sensitive
// remaining-maturity is DERIVED by the projection from `settlementDate` minus
// the query as_of, exactly as the v1 SA-CCR adapter does — so byte-parity
// holds without storing a stale maturity on the event.
// ---------------------------------------------------------------------------

export const filEconomicTermsSchema = z.object({
  /** SA-CCR asset class (`ir` | `fx` | …). */
  assetClass: filSaCcrAssetClassSchema,
  /** Notional, always positive — direction encoded separately. v2-native Money. */
  notional: moneySchema,
  /** Trade direction (long/short) for the supervisory delta. */
  direction: z.enum(["long", "short"]),
  /** Counterparty party id (the netting-set counterparty). */
  counterpartyId: z.string().min(1),
  /** Legally-enforceable netting set id (`NS-<counterpartyId>-<ccy>`). */
  nettingSetId: z.string().min(1),
  /** Netting-set / notional currency (ISO-4217 alpha-3). */
  currency: z.string().length(3),
  /**
   * Settlement / maturity date (ISO-8601 date or instant) of the driving leg.
   * Remaining-maturity is derived from this at the query as_of — NOT stored.
   */
  settlementDate: z.string().min(1),
  /** Hedging-set tag (FX pair, e.g. `EUR/ZAR`; IR currency/bucket). */
  hedgingSetTag: z.string().min(1).optional(),
  /**
   * Originating-instrument back-reference (D-CASH-ASSET-CLASS-V1). When a
   * settled trade MATERIALISES a successor instrument — an FX spot settling into
   * a `cash` asset (the FX OTC NPA declares the maturity→cash rule) — the
   * successor carries the FIL instance URN of the originating instrument here, so
   * the single-graph link from the cash holding back to the trade that produced
   * it is EXPLICIT (Principle 1 / Principle 2 — no orphan node). The Slice-3
   * recon gate fails closed on any `cash`-asset-class instance that lacks this
   * back-ref. Optional at the schema level because origin-less instruments (an
   * FX trade created directly from execution) legitimately have no predecessor.
   */
  originatingInstrument: filInstanceUrnSchema.optional(),
  /**
   * Booking-time PRODUCT BINDING (S0d, D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD).
   * The id of the NPA-approved `V2ProductRegistered` product the instance was
   * booked under (e.g. `v2:prd:bank:fx:otc-vanilla`). Stamped at booking time
   * (the `FilInstrumentCreated` emission) so the accounting fold can resolve the
   * instance's composed reporting treatment DIRECTLY from the bound product —
   * deterministically — instead of inferring it from a type-scope fallback. The
   * booking path stamps this ONLY when an approved product governs the instance's
   * FIL type (the NPA gate); an instance whose type has no approved governing
   * product carries no `productId` and the fold fails closed for it (no silent
   * default — Engineering Charter cmd 2). OPTIONAL + additive: legacy / un-migrated
   * instances that predate S0d carry no `productId` and continue to fold via the
   * documented fail-closed path, so existing events parse unchanged (replay-safe).
   */
  productId: z.string().min(1).optional(),
  /**
   * Qualifying-capital dimension (D-CAPITAL-ASSET-CLASS-V1). Carried on a
   * `capital` asset-class FIL instance — the typed regulatory-capital tier +
   * own-funds sub-category the BA-700 / BA-100 capital-composition fold sums on.
   * OPTIONAL + additive: only `capital` instances carry it; every existing
   * (ir/fx/cash/…) instance parses unchanged (replay-safe — Charter cmd 9). The
   * capital-materialisation recon gate fails closed on a `capital` instance that
   * lacks this block (no silent default — Charter cmd 2).
   */
  qualifyingCapital: filQualifyingCapitalSchema.optional(),
});

export type FilEconomicTerms = z.infer<typeof filEconomicTermsSchema>;

// ---------------------------------------------------------------------------
// The three registered lifecycle event payloads. Each composes the kernel base
// (instance + type + asOf) with the materialisation axes.
// ---------------------------------------------------------------------------

const instanceBaseShape = {
  /** `fil:inst:<tenant>:<instance-id>` — the instance identity (W9 §3.1). */
  instance: filInstanceUrnSchema,
  /** `fil:type:<asset-class>:<family>:<slug>@maj.min` — the taxonomy ref. */
  type: filTypeUrnSchema,
  /** The tenant axis (S2) — anchor tenant for the anchor book. */
  tenant: z.string().min(1),
  /** ISO-8601 instant the lifecycle transition takes effect. */
  asOf: instantSchema,
  /** The canonical v1 event this lifecycle event renders (Principle 1). */
  originatingEvent: filOriginatingEventRefSchema,
} as const;

/** Instrument created — the first lifecycle event for an instance (W9 §3.3). */
export const filInstrumentCreatedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentCreated"),
  ...instanceBaseShape,
  /** The lifecycle stage at creation (`active` for an executed trade). */
  initialStage: filLifecycleStageSchema,
  /** The economic terms the RiskMeasurable consumer needs. */
  economicTerms: filEconomicTermsSchema,
});

export type FilInstrumentCreatedPayload = z.infer<typeof filInstrumentCreatedPayloadSchema>;

/** Instrument amended — an in-life economic change (W9 §3.3). */
export const filInstrumentAmendedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentAmended"),
  ...instanceBaseShape,
  /** The registered event type that carries the economic amendment detail. */
  amendmentVia: filEventRefSchema,
  /** Re-stamped economic terms after the amendment (full snapshot — P1 latest-wins). */
  economicTerms: filEconomicTermsSchema,
});

export type FilInstrumentAmendedPayload = z.infer<typeof filInstrumentAmendedPayloadSchema>;

// ---------------------------------------------------------------------------
// Derecognition + FVOCI-reclass economic terms — OPTIONAL refinements carried on
// the terminal event so the FX derecognition (PR-FX-CLOSE-V2) and FVOCI→P&L
// reclassification (PR-FX-FVOCI-RECLASS-V2) rules can fire at fold time
// (WS-FIL-FX-SETTLEMENT-EVENTS, D-FIL-FX-SETTLEMENT-EVENTS).
//
// Append-only-safe: both blocks are OPTIONAL, so the existing terminal events
// (which carry neither) continue to parse and fold to the clean zero-amount
// derecognition memo exactly as before. A terminal event that DOES carry these
// terms drives the reversal/reclass postings.
// ---------------------------------------------------------------------------

/**
 * Derecognition economic terms (IFRS 9 §3.2.3): the accumulated unrealised
 * revaluation that sat in the FX unrealised-P&L account and must be reversed +
 * recognised as realised on derecognition. Signed Money: a positive `amount`
 * is an accumulated gain (credit balance) to reverse; the rule moves it to
 * realised P&L. The currency is the leg currency the reval accumulated in.
 */
export const filFxDerecognitionTermsSchema = z.object({
  /** Accumulated unrealised reval to reverse + realise. Signed major-unit Money. */
  accumulatedUnrealised: moneySchema,
});

export type FilFxDerecognitionTerms = z.infer<typeof filFxDerecognitionTermsSchema>;

/**
 * FVOCI-reclassification economic terms (IFRS 9 §5.7.10–11): when the instrument
 * was FVOCI-elected, the accumulated OCI reserve that recycles into P&L on
 * derecognition. Carried on the terminal event so the fold can fire the recycle.
 * `electedFvoci` makes the election EXPLICIT on the terminal event (the fold
 * does not have to re-derive it from a separate election stream at close time);
 * `accumulatedOci` is the signed reserve balance to recycle.
 */
export const filFxFvociReclassTermsSchema = z.object({
  /** True iff the instrument carried an FVOCI election (IFRS 9 §5.7.5). */
  electedFvoci: z.literal(true),
  /** Accumulated FVOCI reserve to recycle into P&L. Signed major-unit Money. */
  accumulatedOci: moneySchema,
});

export type FilFxFvociReclassTerms = z.infer<typeof filFxFvociReclassTermsSchema>;

/** Instrument terminated — a terminal transition (W9 §3.3). */
export const filInstrumentTerminatedPayloadSchema = z.object({
  kind: z.literal("FilInstrumentTerminated"),
  ...instanceBaseShape,
  /** The terminal stage reached (settled / matured / cancelled / terminated). */
  terminalStage: z.enum(["settled", "matured", "cancelled", "terminated"]),
  /**
   * Optional derecognition terms (accumulated unrealised reval). When present,
   * the fold fires PR-FX-CLOSE-V2's reversal; when absent it posts the clean
   * zero-amount memo (the pre-WS-FIL-FX-SETTLEMENT-EVENTS behaviour — preserved).
   */
  derecognitionTerms: filFxDerecognitionTermsSchema.optional(),
  /**
   * Optional FVOCI-reclassification terms (election + accumulated OCI). When
   * present, the fold fires PR-FX-FVOCI-RECLASS-V2's OCI→P&L recycle.
   */
  fvociReclassTerms: filFxFvociReclassTermsSchema.optional(),
});

export type FilInstrumentTerminatedPayload = z.infer<typeof filInstrumentTerminatedPayloadSchema>;

// ---------------------------------------------------------------------------
// FilFxSettlementConfirmed — the FX settlement event (WS-FIL-FX-SETTLEMENT-
// EVENTS, D-FIL-FX-SETTLEMENT-EVENTS). Carries the per-leg economic terms the
// settlement realised-P&L (PR-FX-SETTLE-V2) and swap near/far-leg
// (PR-FX-SWAP-NEAR-V2 / PR-FX-SWAP-FAR-V2) rules consume: bought/sold currency,
// the receivable/payable carrying amount at the BOOKED rate, and the actual cash
// at the SETTLEMENT rate. The realised FX P&L is the booked-vs-settled difference
// (IAS 21 §23, §28).
//
// LEG DISCRIMINATOR (`legRole`): ONE settlement event type with a leg
// discriminator (`spot` | `swap-near` | `swap-far`) rather than three parallel
// event types — the economic terms are IDENTICAL per leg (a swap is two physical
// settlements), so a single carrier with a role tag is the source-don't-duplicate
// choice (Engineering Charter cmd 4). The fold selects PR-FX-SETTLE-V2 for
// `spot`, PR-FX-SWAP-NEAR-V2 for `swap-near`, PR-FX-SWAP-FAR-V2 for `swap-far`.
// ---------------------------------------------------------------------------

export const filFxSettlementLegRoleSchema = z.enum(["spot", "swap-near", "swap-far"]);

export type FilFxSettlementLegRole = z.infer<typeof filFxSettlementLegRoleSchema>;

export const filFxSettlementConfirmedPayloadSchema = z.object({
  kind: z.literal("FilFxSettlementConfirmed"),
  ...instanceBaseShape,
  /** Which leg of the trade this settlement realises (spot / swap near / swap far). */
  legRole: filFxSettlementLegRoleSchema,
  /** Bought-currency leg: the receivable carrying amount at the BOOKED rate. */
  boughtBooked: moneySchema,
  /** Bought-currency leg: the cash actually received at the SETTLEMENT rate (same ccy). */
  boughtSettled: moneySchema,
  /** Sold-currency leg: the payable carrying amount at the BOOKED rate. */
  soldBooked: moneySchema,
  /** Sold-currency leg: the cash actually paid at the SETTLEMENT rate (same ccy). */
  soldSettled: moneySchema,
  /**
   * OPTIONAL BoP-category tag (FinSurv per-transaction reporting scaffold,
   * D-FX-OTC-CLOSURE-BACKLOG Phase C10). When a cross-border FX settlement is
   * tagged with its FinSurv economic class (ORG-FX-FIN-01..14) at settlement
   * time, the tag is carried here so the read-side FinSurv projection can fold
   * it WITHOUT reaching back into the trade. Append-only-safe: OPTIONAL, so
   * existing settlement events (which carry no tag) parse unchanged, and the FX
   * accounting fold — which reads only the booked/settled legs — is unaffected
   * (BoP is a regulatory-reporting axis, NOT an accounting one). The precise
   * BOPCUS code on the tag is licence-day-deferred (`null` in the build phase).
   * See `v2-core/finsurv/bop-category.ts` + PROC-FINSURV-BOP-01.
   */
  bopCategory: bopCategoryTagSchema.optional(),
});

export type FilFxSettlementConfirmedPayload = z.infer<typeof filFxSettlementConfirmedPayloadSchema>;

// ---------------------------------------------------------------------------
// FilNdfFixingObserved — the NDF fixing / cash-settlement event (WS-FIL-FX-
// SETTLEMENT-EVENTS). An NDF is cash-settled — principal NEVER exchanges — so
// this event carries ONLY the cash-settlement economic terms PR-FX-NDF-FIX-V2
// consumes: the settlement currency and the net cash difference
// `notional × (fixing − contracted)` (IFRS 9 §5.7.1 / IAS 21 §28).
//
// The fixing and contracted rates + notional are carried for traceability /
// audit; the net cash difference is carried PRE-COMPUTED (signed Money) because
// the multiplication `notional × (fixing − contracted)` is a markets-domain
// determination, not an accounting one — the posting rule consumes the settled
// cash amount, exactly as the markets desk computes it. No principal legs.
// ---------------------------------------------------------------------------

export const filNdfFixingObservedPayloadSchema = z.object({
  kind: z.literal("FilNdfFixingObserved"),
  ...instanceBaseShape,
  /** Settlement currency the net cash difference is paid/received in. */
  settlementCurrency: z.string().length(3),
  /** Contracted (strike) rate, decimal string (audit / traceability). */
  contractedRate: z.string().min(1),
  /** Observed fixing rate, decimal string (audit / traceability). */
  fixingRate: z.string().min(1),
  /** Notional the fixing applies to, in the (non-settlement) reference currency. */
  notional: moneySchema,
  /**
   * Net cash difference in the settlement currency = notional × (fixing −
   * contracted). Positive = gain (cash received); negative = loss (cash paid).
   * Signed major-unit Money.
   */
  netCashDifference: moneySchema,
  /**
   * OPTIONAL BoP-category tag (FinSurv per-transaction reporting scaffold,
   * D-FX-OTC-CLOSURE-BACKLOG Phase C10). An NDF cash-settlement is a
   * capital-account financial-derivative flow (ORG-FX-FIN-08); when tagged, the
   * class is carried here. Append-only-safe (OPTIONAL); the accounting fold reads
   * only `netCashDifference`, so it is unaffected. Precise BOPCUS code is
   * licence-day-deferred (`null` in the build phase). See
   * `v2-core/finsurv/bop-category.ts` + PROC-FINSURV-BOP-01.
   */
  bopCategory: bopCategoryTagSchema.optional(),
});

export type FilNdfFixingObservedPayload = z.infer<typeof filNdfFixingObservedPayloadSchema>;

// ---------------------------------------------------------------------------
// The discriminated union + the registered event kinds.
// ---------------------------------------------------------------------------

export const filInstanceLifecycleEventSchema = z.discriminatedUnion("kind", [
  filInstrumentCreatedPayloadSchema,
  filInstrumentAmendedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
  filFxSettlementConfirmedPayloadSchema,
  filNdfFixingObservedPayloadSchema,
]);

export type FilInstanceLifecycleEvent = z.infer<typeof filInstanceLifecycleEventSchema>;

export const FIL_INSTANCE_EVENT_KINDS = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
  "FilFxSettlementConfirmed",
  "FilNdfFixingObserved",
] as const;

export type FilInstanceEventKind = (typeof FIL_INSTANCE_EVENT_KINDS)[number];

/** The terminal-stage → kernel terminal mapping (re-export for projection use). */
export type FilTerminalStage = Extract<
  FilLifecycleStage,
  "settled" | "matured" | "cancelled" | "terminated"
>;
