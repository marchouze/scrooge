// platform/accounting/sla/interpreter.ts
//
// Entry-generation engine (interpreter core) — Phase-0 spec §7.
//
//   interpret(event, activeRepresentations, asOf) -> InterpretResult[]
//
// PURE. Events in → proposed balanced entries out, per representation. No
// side effects, no event emission, no I/O — proposal only (dry-run is the
// only mode in Phase 1, spec §9.1). One source event yields zero or more
// ProposedPostings (one per representation that matched a posting-producing
// rule), or a typed reject-loudly outcome.
//
// Algorithm (spec §7.2), per event, per active representation:
//   1. Build the context vector (§1.2).
//   2. Filter the representation's rules to those eligible by applies_to
//      match + effective-date window (§2.1).
//   3. Resolve by specificity precedence with the fixed tie-break order.
//      Zero → reject; ambiguous → flag; intentional-no-impact → explicit skip.
//   4. Evaluate condition.kind + each line's `when`; resolve accounts +
//      evaluate amounts.
//   5. Assert DR == CR per currency over the lines that fired.
//   6. Emit a ProposedPosting { representation, ruleId, ruleVersion, legs,
//      resolverDecisions, cites }.
//
// Reject-loudly outcomes (SubLedgerPostingRejected / SubLedgerPostingAmbiguous)
// are returned as FIRST-CLASS typed results (spec §7.3) — never silent.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Citations: Principles/1-events-are-truth.md, Principles/5-multi-currency-entity-country.md.

import { makeSubstrateAlert } from "../../event-store/event-types/platform";
import type { Actor, Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// Product-to-Basel-business-line map (BCBS d188 §§652-654 / BA 400 Op-Risk)
//
// Maps the interpreter's `instrument_type` context dimension (= the product
// string supplied to `makeFlatProductContextBuilder`) to the BCBS Op-Risk
// business-line taxonomy. Used to stamp `baselBusinessLine` on every
// ProposedPosting so the GL posting engine can forward it to the
// SubLedgerPostingEmitted event for BA 400 sourcing.
//
// Authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO-approved 2026-06-09);
//            BCBS d188 §§652-654 (Basel II Op-Risk business lines).
// ---------------------------------------------------------------------------
const PRODUCT_TO_BUSINESS_LINE: Record<string, string> = {
  MMD: "commercial-banking",
  IBL: "commercial-banking",
  FUNDING: "commercial-banking",
  REPO: "trading-and-sales",
  BOND: "trading-and-sales",
  IRD: "trading-and-sales",
  // FX is keyed by the CDM `productTaxonomy` discriminator
  // (`fxProductTaxonomySchema`), NOT a bare "FX": fxTradeExecutedContextBuilder
  // stamps `instrument_type = payload.productTaxonomy` and the flat FX builder
  // fixes it to "FX-spot". There is no `instrument_type === "FX"` anywhere.
  "FX-spot": "trading-and-sales",
  "FX-forward": "trading-and-sales",
  "FX-swap": "trading-and-sales",
  NDF: "trading-and-sales",
  EQUITY: "trading-and-sales",
  PAY: "payment-and-settlement",
};
import {
  type EvalScope,
  evaluateAmount,
  evaluatePredicate,
  evaluateString,
  parseExpression,
} from "./expression";
import type { AccountId, AppliesTo, ContextMatch, RuleLine, SlaRule } from "./generated/sla-types";
import { isAccountId } from "./generated/sla-types";
import {
  type AccountResolver,
  FX_UNRESOLVED_CURRENCY_SUSPENSE,
  type ResolverKey,
  defaultResolver,
} from "./resolver";
import { withinEffectiveWindow } from "./versioning";

// ---------------------------------------------------------------------------
// Context vector (spec §1.2 / §2.1)
// ---------------------------------------------------------------------------

export interface ContextVector {
  readonly instrument_type?: string;
  readonly event_type: string;
  readonly entity: string;
  readonly jurisdiction?: string;
  readonly regulatory_regime?: string;
  readonly product_variant?: string;
  readonly counterparty_classification?: string;
  /** ISO date — event.as_of. */
  readonly effective_date: string;
}

/** The minimal event envelope the interpreter reads. */
export interface InterpreterEvent {
  readonly type: string;
  readonly entity?: string;
  readonly as_of: string;
  readonly payload: unknown;
  /**
   * Pre-resolved prior-event CONTEXT (context-enrichment, spec §2.3 / brief
   * deliverable 2). Some FX lifecycle rules price amounts off facts that do
   * NOT live on the triggering event itself — they live on a PRIOR event:
   *
   *   - `PR-FX-005` (FxSettlementFailed, one-leg-delivered) needs the
   *     originating trade's RECEIVE LEG (currency, amount, ZAR-equivalent) —
   *     that lives on the originating `FxTradeExecuted`, not on the failure
   *     event.
   *   - `PR-FX-CANCEL` (cancellation) needs the trade's PRIOR BOOKING LEGS and
   *     CUMULATIVE unrealised P&L — derived from prior `SubLedgerPostingEmitted`
   *     events.
   *
   * CHOSEN ENRICHMENT MODEL (brief deliverable 2): a PRE-RESOLVED CONTEXT OBJECT
   * passed in as an INPUT, NOT an event-store lookup performed inside the
   * tree-walker. Rationale:
   *   1. The interpreter stays PURE — `interpret(...)` remains a pure function
   *      of (event + enrichment + rules). No I/O, no `eventStore` import inside
   *      the interpreter; it cannot read the clock, the network, or the store.
   *      Dry-run (spec §9.1) and replay stay deterministic.
   *   2. The enrichment is an AUDITABLE, TYPED step done by the CALLER (the GL
   *      posting engine, which already has the event stream in hand — see
   *      `resolveFailedReceiveLeg` in gl-posting-engine.ts), then handed in.
   *      The same enrichment functions the legacy engine already uses are
   *      reused, so the interpreter and the legacy engine price off identical
   *      prior-event facts (byte-for-byte parity is preserved).
   *   3. It mirrors Principle 1: events are truth; a derived projection (the
   *      enrichment) is computed once by the caller and passed as data.
   *
   * Exposed to the sandbox as `event.enrichment.*` so rule amount-expressions
   * can read it exactly like any other event path. Absent for events that need
   * no enrichment (booking, reval, principal, close).
   */
  readonly enrichment?: unknown;
}

// ---------------------------------------------------------------------------
// Proposed posting + outcomes (spec §7.3 / §8)
// ---------------------------------------------------------------------------

export interface ProposedLeg {
  readonly accountId: AccountId;
  readonly debitCredit: "debit" | "credit";
  /** Minor units, always positive (matches SubLedgerLeg). Stored as string
   *  to survive >2^53 BigInt magnitudes losslessly; the leg-construction
   *  helpers (e.g. fx-spot.ts) use `number`. */
  readonly amountMinor: string;
  readonly currency: string;
}

export interface ResolverDecision {
  readonly logical: string;
  readonly key: ResolverKey;
  readonly physical: AccountId;
  /**
   * How the account was resolved:
   *   - "exact"    → a per-currency resolver row matched.
   *   - "suspense" → an account-resolution miss (valid axes, unmapped currency)
   *     was routed to the FX unresolved-currency suspense account
   *     (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE). Always paired with an
   *     `UrgentCorrection` on the ProposedPosting + a SubstrateAlert from the
   *     caller. (The "currency-pool" via was removed — the FCY-pool framing was
   *     rejected; the USD account is USD-only.)
   */
  readonly via: "exact" | "suspense";
}

/**
 * A single account-resolution miss that was routed to the FX unresolved-currency
 * suspense account. The interpreter is PURE — it does not emit; it RETURNS these
 * so the caller emits one high-severity urgent-correction `SubstrateAlert`
 * { alertClass: "integrity", severity: "high" } per correction. This is the
 * "never a silent fallback" guarantee in data: a suspense routing is impossible
 * without a paired urgent-correction signal.
 */
export interface UrgentCorrection {
  readonly logical: string;
  readonly currency: string;
  readonly suspenseAccount: AccountId;
  readonly ruleId: string;
  readonly representation: string;
  /** Stable alertId for the SubstrateAlert the caller emits (alert:integrity:…). */
  readonly alertId: string;
  readonly detail: string;
}

export interface ProposedPosting {
  readonly outcome: "post";
  readonly representation: string;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly legs: readonly ProposedLeg[];
  readonly resolverDecisions: readonly ResolverDecision[];
  readonly cites: readonly string[];
  /**
   * Non-empty iff one or more legs were routed to the FX unresolved-currency
   * suspense account. Each entry MUST be turned into a high-severity
   * urgent-correction SubstrateAlert by the caller. A `post` with a non-empty
   * `urgentCorrections` is a BALANCED-BUT-LOUD posting (the entry still
   * balances; the unresolved item is glaringly flagged), never a silent skip.
   */
  readonly urgentCorrections: readonly UrgentCorrection[];
  /**
   * Basel III business-line classification for this posting (BCBS d188 §§652-654).
   * Derived from the event's `instrument_type` context dimension via
   * `PRODUCT_TO_BUSINESS_LINE`. Absent when the product has no mapped business
   * line (e.g. unknown or future product types). Forwarded to the
   * SubLedgerPostingEmitted event payload for BA 400 Op-Risk sourcing.
   * Authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL.
   */
  readonly baselBusinessLine?: string;
}

export type InterpretResult =
  | ProposedPosting
  | {
      readonly outcome: "rejected";
      readonly representation: string;
      readonly reason: "no-eligible-rule" | "resolver-miss" | "unbalanced" | "evaluation-error";
      readonly detail: string;
      readonly context: ContextVector;
    }
  | {
      readonly outcome: "ambiguous";
      readonly representation: string;
      readonly candidateRuleIds: readonly string[];
      readonly detail: string;
      readonly context: ContextVector;
    }
  | {
      readonly outcome: "intentional-no-impact";
      readonly representation: string;
      readonly ruleId: string;
      readonly detail: string;
    };

// ---------------------------------------------------------------------------
// Context-builder registry — maps an event type to a context vector + the
// expression scope. FX-spot is the only Phase-1 builder; the registry is the
// extension point for Phase 2 product families.
// ---------------------------------------------------------------------------

export interface BuiltContext {
  readonly context: ContextVector;
  /** The `event` root exposed to the expression sandbox. */
  readonly eventScope: unknown;
  /** The `context` root exposed to the expression sandbox. */
  readonly contextScope: unknown;
}

export type ContextBuilder = (event: InterpreterEvent) => BuiltContext;

interface FxLegLike {
  legKind: string;
  payCurrency: string;
  receiveCurrency: string;
  notional: { amountMinor: number; currency: string };
  counterNotional: { amountMinor: number; currency: string };
}

interface FxTradeExecutedLike {
  productTaxonomy?: string;
  currencyPair?: { base: string; quote: string };
  legs: FxLegLike[];
}

/**
 * FX-spot context builder. Exposes the near leg as `event.near` so rules can
 * write `event.near.notional.amountMinor` etc. (spec §3.2 worked example).
 */
export const fxTradeExecutedContextBuilder: ContextBuilder = (event) => {
  const payload = event.payload as FxTradeExecutedLike;
  const nearLeg = payload.legs.find((l) => l.legKind === "near");

  const instrumentType = payload.productTaxonomy;
  const eventScope = { ...(payload as object), near: nearLeg ?? null };

  return {
    context: fxContextVector(event, instrumentType),
    eventScope: withEnrichment(eventScope, event.enrichment),
    contextScope: {},
  };
};

/**
 * Generic FX context builder for the lifecycle events whose payloads are flat
 * (no `legs` array): FxPositionRevalued, PrincipalPayment, SettlementConfirmed,
 * FxSettlementFailed, FxTradeCancelled, FxSettlementInstructed,
 * TradeReportSubmitted. The raw payload is exposed directly as the `event`
 * scope (so a rule reads e.g. `event.unrealisedPnlZarMinor`, `event.netCash`),
 * augmented with `event.enrichment.*` for the rules that need prior-event
 * context (PR-FX-005, PR-FX-CANCEL). `instrument_type` is fixed to "FX-spot" for
 * ALL FX lifecycle events ON PURPOSE: it is the SLA *dispatch + resolution* axis,
 * and FX posting rules (PR-FX-002 etc.) + the resolver's account rows are
 * per-CURRENCY, instrument-agnostic (an FX-forward revaluation books to the same
 * ZAR receivable / unrealised-P&L accounts as spot). Driving instrument-level
 * values (FX-forward/FX-swap/NDF) through this axis would force every FX rule to
 * be widened AND every resolver row to be duplicated per instrument, for no
 * accounting difference — verified to break dispatch (no-eligible-rule) and
 * resolution (resolver-miss). Instrument-LEVEL attribution for split reporting
 * (P&L by instrument, BA-return instrument splits) is carried instead on the
 * event payload's `productTaxonomy` field (FxPositionRevalued.productTaxonomy,
 * stamped by the revaluation engines), which projections/reports read directly —
 * NOT this dispatch axis. Authority: D-FX-OTC-NPA-SCOPE-EXPANSION.
 */
function makeFlatFxContextBuilder(): ContextBuilder {
  return (event) => ({
    context: fxContextVector(event, "FX-spot"),
    eventScope: withEnrichment({ ...(event.payload as object) }, event.enrichment),
    contextScope: {},
  });
}

/** Common context-vector assembly for every FX-spot lifecycle event. */
function fxContextVector(
  event: InterpreterEvent,
  instrumentType: string | undefined,
): ContextVector {
  const jurisdiction = deriveJurisdiction(event.entity);
  const regulatoryRegime = deriveRegulatoryRegime(jurisdiction);
  return {
    event_type: event.type,
    entity: event.entity ?? "UNKNOWN",
    effective_date: isoDate(event.as_of),
    ...(instrumentType !== undefined ? { instrument_type: instrumentType } : {}),
    ...(jurisdiction !== undefined ? { jurisdiction } : {}),
    ...(regulatoryRegime !== undefined ? { regulatory_regime: regulatoryRegime } : {}),
  };
}

/** Attach the pre-resolved enrichment object under `event.enrichment` (or {}). */
function withEnrichment(scope: object, enrichment: unknown): object {
  return { ...scope, enrichment: enrichment ?? {} };
}

/**
 * Generic flat-payload context builder for a fixed `instrument_type` (product).
 * The treasury money-market families (deposit / funding / IBL / repo) all carry
 * flat payloads — the raw payload is exposed directly as the `event` scope (so a
 * rule reads e.g. `event.principalZar`, `event.accruedInterestZar`), augmented
 * with `event.enrichment.*` for the rules that price off prior-event context
 * (deposit/IBL maturity category & opening principal, repo early-unwind cash).
 * `instrument_type` is fixed to the supplied product so rule `applies_to`
 * matching and the resolver's product axis both bind correctly.
 */
function makeFlatProductContextBuilder(product: string): ContextBuilder {
  return (event) => ({
    context: makeProductContextVector(event, product),
    eventScope: withEnrichment({ ...(event.payload as object) }, event.enrichment),
    contextScope: {},
  });
}

/** Common context-vector assembly for a flat-payload product lifecycle event. */
function makeProductContextVector(event: InterpreterEvent, product: string): ContextVector {
  const jurisdiction = deriveJurisdiction(event.entity);
  const regulatoryRegime = deriveRegulatoryRegime(jurisdiction);
  return {
    event_type: event.type,
    entity: event.entity ?? "UNKNOWN",
    effective_date: isoDate(event.as_of),
    instrument_type: product,
    ...(jurisdiction !== undefined ? { jurisdiction } : {}),
    ...(regulatoryRegime !== undefined ? { regulatory_regime: regulatoryRegime } : {}),
  };
}

const CONTEXT_BUILDERS: Readonly<Record<string, ContextBuilder>> = {
  FxTradeExecuted: fxTradeExecutedContextBuilder,
  FxPositionRevalued: makeFlatFxContextBuilder(),
  PrincipalPayment: makeFlatFxContextBuilder(),
  SettlementConfirmed: makeFlatFxContextBuilder(),
  FxSettlementFailed: makeFlatFxContextBuilder(),
  FxTradeCancelled: makeFlatFxContextBuilder(),
  TradeCancelled: makeFlatFxContextBuilder(),
  FxSettlementInstructed: makeFlatFxContextBuilder(),
  TradeReportSubmitted: makeFlatFxContextBuilder(),
  // A4 — RealisedPnlRecognised replaces SettlementConfirmed as the realised-P&L
  // trigger (PR-FX-REALISED-PNL). Uses the same flat-FX context builder as the
  // other FX lifecycle events (instrument_type = "FX-spot" as dispatch axis;
  // the rule leaves instrument_type unconstrained so it matches as a wildcard).
  // Authority: D-FIL-BOOK-COMPOSITE-VALUATION; IAS 21 §28; IFRS 9 §5.7.1.
  RealisedPnlRecognised: makeFlatFxContextBuilder(),
  // Treasury money-market family (full-retirement Batch 1) — flat payloads, one
  // product (instrument_type) per lifecycle. Enrichment is supplied by the
  // caller for the prior-event-dependent rules (maturity/recall/early-unwind).
  DepositTaken: makeFlatProductContextBuilder("MMD"),
  DepositInterestAccrued: makeFlatProductContextBuilder("MMD"),
  DepositMatured: makeFlatProductContextBuilder("MMD"),
  DepositWithdrawnEarly: makeFlatProductContextBuilder("MMD"),
  FundingLineDrawn: makeFlatProductContextBuilder("FUNDING"),
  FundingLineRepaid: makeFlatProductContextBuilder("FUNDING"),
  InterbankLoanPlaced: makeFlatProductContextBuilder("IBL"),
  InterbankLoanInterestAccrued: makeFlatProductContextBuilder("IBL"),
  InterbankLoanMatured: makeFlatProductContextBuilder("IBL"),
  InterbankLoanRecalledEarly: makeFlatProductContextBuilder("IBL"),
  RepoTradeOpened: makeFlatProductContextBuilder("REPO"),
  RepoStartLegSettled: makeFlatProductContextBuilder("REPO"),
  RepoInterestAccrued: makeFlatProductContextBuilder("REPO"),
  RepoEndLegSettled: makeFlatProductContextBuilder("REPO"),
  RepoTradeTerminatedEarly: makeFlatProductContextBuilder("REPO"),
  // Securities family (full-retirement Batch 2) — bond + equity. Bond payloads
  // are flat (one product per lifecycle); equity CDM payloads carry nested Money
  // objects (consideration / unrealisedPnl) which a flat builder still exposes
  // directly as nested event paths. Enrichment is supplied by the caller for the
  // bond booking (pre-computed dirty-price amount) and bond maturity/sale
  // (portfolio resolved from the originating trade).
  BondTradeExecuted: makeFlatProductContextBuilder("BOND"),
  BondInterestAccrued: makeFlatProductContextBuilder("BOND"),
  BondPositionRevalued: makeFlatProductContextBuilder("BOND"),
  BondMatured: makeFlatProductContextBuilder("BOND"),
  BondSold: makeFlatProductContextBuilder("BOND"),
  EquityTradeExecuted: makeFlatProductContextBuilder("EQUITY"),
  EquityPositionRevalued: makeFlatProductContextBuilder("EQUITY"),
  EquityDividendAccrued: makeFlatProductContextBuilder("EQUITY"),
  EquitySettlementInstructed: makeFlatProductContextBuilder("EQUITY"),
  EquitySold: makeFlatProductContextBuilder("EQUITY"),
  // IRD-swap family (full-retirement Batch 3) — OTC interest-rate / IRD swaps.
  // Flat payloads (one product per lifecycle); every amount (npvMinor,
  // npvDeltaMinor, netCashMinor, terminationPaymentMinor, carryingNpv,
  // realisedPnl) is an integer minor-unit field read directly off the event, so
  // no enrichment is required. The two `Irs*` memos (schedule / instruction) are
  // intentional-no-impact rules. The canonical termination event is
  // IrdSwapTerminated (the old IrsSwapTerminated registry typo never fired).
  IrdSwapTradeExecuted: makeFlatProductContextBuilder("IRD"),
  IrdSwapPositionRevalued: makeFlatProductContextBuilder("IRD"),
  IrdSwapCouponSettled: makeFlatProductContextBuilder("IRD"),
  IrdSwapTerminated: makeFlatProductContextBuilder("IRD"),
  IrsCouponScheduleGenerated: makeFlatProductContextBuilder("IRD"),
  IrsCouponPaymentInstructed: makeFlatProductContextBuilder("IRD"),
  // Payment / settlement family (full-retirement Batch 4 — the LAST family).
  // Flat payloads; each rule prices off the single integer `netCash` field read
  // directly off the event, so no enrichment is required. Three lifecycle event
  // types, one product (PAY).
  PaymentInitiated: makeFlatProductContextBuilder("PAY"),
  PaymentSettled: makeFlatProductContextBuilder("PAY"),
  SettlementInstructionReceived: makeFlatProductContextBuilder("PAY"),
};

function deriveJurisdiction(entity: string | undefined): string | undefined {
  if (!entity) return undefined;
  // LE-<JURIS>-... convention (e.g. LE-ZA-HOZ-BANK → ZA).
  const parts = entity.split("-");
  return parts.length >= 2 ? parts[1] : undefined;
}

/**
 * Map a jurisdiction to its prudential regulatory regime. This is an ADDITIVE
 * context dimension — IFRS rules do not constrain `regulatory_regime`, so adding
 * it leaves their matching (and therefore their postings) byte-for-byte
 * unchanged (the additivity guarantee, spec §2.2). The SARB-BA-RETURN rules,
 * which classify by SARB regulatory return, constrain
 * `regulatory_regime: "SARB-banks-act"`, so they only match ZA-entity events —
 * exactly the spec §3.2 context vector. ZA → SARB-banks-act; other jurisdictions
 * carry no regime yet (their regulatory representations are future work).
 */
function deriveRegulatoryRegime(jurisdiction: string | undefined): string | undefined {
  if (jurisdiction === "ZA") return "SARB-banks-act";
  return undefined;
}

function isoDate(asOf: string): string {
  // event.as_of is an ISO-8601 timestamp; the effective date is its date part.
  return asOf.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Rule matching + specificity (spec §2.1)
// ---------------------------------------------------------------------------

const TIE_BREAK_ORDER: readonly (keyof AppliesTo)[] = [
  "entity",
  "jurisdiction",
  "product_variant",
  "counterparty_classification",
  "regulatory_regime",
  "instrument_type",
  "event_type",
];

/** Does a single context-match constraint match the context value? */
function constraintMatches(constraint: ContextMatch, value: string | undefined): boolean {
  if (value === undefined) return false;
  if (typeof constraint === "string") return constraint === value;
  return constraint.includes(value);
}

const CONTEXT_DIMENSIONS: readonly (keyof AppliesTo)[] = [
  "event_type",
  "instrument_type",
  "entity",
  "jurisdiction",
  "regulatory_regime",
  "product_variant",
  "counterparty_classification",
];

function contextValueFor(ctx: ContextVector, dim: keyof AppliesTo): string | undefined {
  switch (dim) {
    case "event_type":
      return ctx.event_type;
    case "instrument_type":
      return ctx.instrument_type;
    case "entity":
      return ctx.entity;
    case "jurisdiction":
      return ctx.jurisdiction;
    case "regulatory_regime":
      return ctx.regulatory_regime;
    case "product_variant":
      return ctx.product_variant;
    case "counterparty_classification":
      return ctx.counterparty_classification;
  }
}

/** Whether the rule's applies_to matches the context (all constrained dims). */
function ruleMatches(rule: SlaRule, ctx: ContextVector): boolean {
  const a = rule.applies_to;
  for (const dim of CONTEXT_DIMENSIONS) {
    const constraint = a[dim];
    if (constraint === undefined) continue; // wildcard
    if (!constraintMatches(constraint, contextValueFor(ctx, dim))) return false;
  }
  return true;
}

/** Specificity score: exact (string) = 2, set-membership (array) = 1, wildcard = 0. */
function specificityScore(rule: SlaRule): number {
  const a = rule.applies_to;
  let score = 0;
  for (const dim of CONTEXT_DIMENSIONS) {
    const c = a[dim];
    if (c === undefined) continue;
    score += typeof c === "string" ? 2 : 1;
  }
  return score;
}

// Effective-date window matching (left-closed, right-open `[from, to)`) is the
// shared single source of truth in ./versioning (spec §6.3) — the interpreter
// (selection) and the versioning recon (window-integrity) read the SAME
// predicate, so they cannot drift.

type RuleSelection =
  | { kind: "none" }
  | { kind: "winner"; winner: SlaRule }
  | { kind: "ambiguous"; ambiguous: readonly SlaRule[] };

/**
 * The Phase-4c approval-eligibility gate. When supplied, a rule/version is only
 * a candidate if its `approvalKey` is in this set — i.e. it carries a four-eyes
 * SlaRuleApproved (approver ≠ publisher) that is not currently withheld. When
 * `undefined`, the gate is OFF (the preview / dry-run / parity callers that
 * inspect rules without the governance gate). The PRODUCTION cutover seam ALWAYS
 * passes it (populated from the approval event stream incl. grandfathers), so a
 * published-but-unapproved rule never posts.
 */
export interface ApprovalGate {
  readonly eligibleKeys: ReadonlySet<string>;
  /** Compose the approvalKey for a rule (kept identical to approval.ts). */
  readonly keyOf: (rule: SlaRule) => string;
}

/** Select the winning rule by specificity + tie-break order. */
function selectRule(
  rules: readonly SlaRule[],
  ctx: ContextVector,
  approvalGate?: ApprovalGate,
): RuleSelection {
  const eligible = rules
    .filter((r) => ruleMatches(r, ctx))
    .filter((r) => withinEffectiveWindow(r, ctx.effective_date))
    .filter((r) => approvalGate == null || approvalGate.eligibleKeys.has(approvalGate.keyOf(r)));

  if (eligible.length === 0) return { kind: "none" };
  if (eligible.length === 1) return { kind: "winner", winner: eligible[0] as SlaRule };

  // highest specificity score
  const maxScore = Math.max(...eligible.map(specificityScore));
  let top = eligible.filter((r) => specificityScore(r) === maxScore);
  if (top.length === 1) return { kind: "winner", winner: top[0] as SlaRule };

  // tie-break: a rule constraining a higher-priority dimension wins
  for (const dim of TIE_BREAK_ORDER) {
    const constrains = top.filter((r) => r.applies_to[dim] !== undefined);
    if (constrains.length > 0 && constrains.length < top.length) {
      top = constrains;
      if (top.length === 1) return { kind: "winner", winner: top[0] as SlaRule };
    }
  }

  // genuine ambiguity — flag, never pick
  return { kind: "ambiguous", ambiguous: top };
}

// ---------------------------------------------------------------------------
// Amount + balance helpers
// ---------------------------------------------------------------------------

/** Sum of debits minus credits per currency must be zero (assert_zero). */
function assertBalanced(
  legs: readonly ProposedLeg[],
): { balanced: true } | { balanced: false; detail: string } {
  const byCcy = new Map<string, bigint>();
  for (const leg of legs) {
    const amt = BigInt(leg.amountMinor);
    const signed = leg.debitCredit === "debit" ? amt : -amt;
    byCcy.set(leg.currency, (byCcy.get(leg.currency) ?? 0n) + signed);
  }
  const offenders = [...byCcy.entries()].filter(([, v]) => v !== 0n);
  if (offenders.length === 0) return { balanced: true };
  return {
    balanced: false,
    detail: offenders.map(([c, v]) => `${c}: net ${v.toString()}`).join("; "),
  };
}

// ---------------------------------------------------------------------------
// interpret()
// ---------------------------------------------------------------------------

export interface InterpretOptions {
  readonly resolver?: AccountResolver;
  readonly contextBuilders?: Readonly<Record<string, ContextBuilder>>;
  /**
   * Phase-4c approval-eligibility gate (spec §9.3). When provided, only
   * rule/versions whose `approvalKey` is in `eligibleKeys` are candidates — the
   * governance gate that requires a four-eyes SlaRuleApproved. Omit to run the
   * engine WITHOUT the gate (preview / parity / dry-run callers). The production
   * cutover seam always provides it. A published-but-unapproved (or withheld)
   * rule is therefore not selected and the event falls through to a loud
   * `no-eligible-rule` reject (or the prior approved version, if its window also
   * contains the date).
   */
  readonly approvalGate?: ApprovalGate;
}

/**
 * Pure interpreter. Returns one InterpretResult per active representation
 * that produced an outcome (post / rejected / ambiguous / intentional-no-impact).
 * Representations with no eligible rule produce a `rejected: no-eligible-rule`
 * result so the absence is loud, never silent.
 */
export function interpret(
  event: InterpreterEvent,
  rules: readonly SlaRule[],
  activeRepresentations: readonly string[],
  _asOf: string,
  options: InterpretOptions = {},
): InterpretResult[] {
  const resolver = options.resolver ?? defaultResolver;
  const builders = options.contextBuilders ?? CONTEXT_BUILDERS;

  const builder = builders[event.type];
  if (!builder) {
    // No context builder for this event type — not in scope for the engine.
    // Phase 1 only wires FxTradeExecuted; other event types simply produce
    // no results (the legacy engine still owns them). This is NOT a silent
    // accounting skip — it is "this engine does not handle this type yet".
    return [];
  }

  const { context, eventScope, contextScope } = builder(event);
  const scope = { event: eventScope, context: contextScope };
  const results: InterpretResult[] = [];

  for (const representation of activeRepresentations) {
    const repRules = rules.filter((r) => r.representation === representation);
    const ctxForRep: ContextVector = { ...context };

    const selection = selectRule(repRules, ctxForRep, options.approvalGate);

    if (selection.kind === "ambiguous") {
      results.push({
        outcome: "ambiguous",
        representation,
        candidateRuleIds: selection.ambiguous.map((r) => `${r.rule_id}@v${r.version}`),
        detail: "equal-specificity tie; rule author must add a discriminating constraint",
        context: ctxForRep,
      });
      continue;
    }

    if (selection.kind === "none") {
      results.push({
        outcome: "rejected",
        representation,
        reason: "no-eligible-rule",
        detail: `no ${representation} rule matches context for ${event.type}`,
        context: ctxForRep,
      });
      continue;
    }

    const rule = selection.winner;

    // intentional-no-impact — the only legitimate non-posting outcome.
    if (rule.condition.kind === "intentional-no-impact") {
      results.push({
        outcome: "intentional-no-impact",
        representation,
        ruleId: `${rule.rule_id}@v${rule.version}`,
        detail: rule.condition.detail ?? "intentional no GL impact",
      });
      continue;
    }

    try {
      const outcome = applyRule(rule, ctxForRep, scope, resolver, representation);
      results.push(outcome);
    } catch (err) {
      results.push({
        outcome: "rejected",
        representation,
        reason: "evaluation-error",
        detail: err instanceof Error ? err.message : String(err),
        context: ctxForRep,
      });
    }
  }

  return results;
}

function applyRule(
  rule: SlaRule,
  ctx: ContextVector,
  scope: EvalScope,
  resolver: AccountResolver,
  representation: string,
): InterpretResult {
  // condition gate (non-zero-delta / non-zero-pnl)
  if (rule.condition.kind === "non-zero-delta" || rule.condition.kind === "non-zero-pnl") {
    const path = rule.condition.delta_path;
    if (!path) {
      return {
        outcome: "rejected",
        representation,
        reason: "evaluation-error",
        detail: `${rule.rule_id}: condition '${rule.condition.kind}' requires a delta_path`,
        context: ctx,
      };
    }
    const value = evaluateAmount(path, scope);
    if (value === 0n) {
      // condition not met — explicit zero, modelled as intentional skip.
      return {
        outcome: "intentional-no-impact",
        representation,
        ruleId: `${rule.rule_id}@v${rule.version}`,
        detail: `${rule.condition.kind}: ${path} is zero`,
      };
    }
  }

  const legs: ProposedLeg[] = [];
  const resolverDecisions: ResolverDecision[] = [];
  const urgentCorrections: UrgentCorrection[] = [];

  for (const line of rule.lines) {
    if (line.for_each) {
      // Declarative iteration: expand one leg per element of an enrichment
      // array (spec §3.1 extension). The array is read once from the scope
      // (a pre-resolved enrichment input — interpreter stays pure); each
      // element is bound as the `item` scope root.
      const arr = readArrayPath(line.for_each, scope);
      for (const element of arr) {
        const itemScope: EvalScope = { ...scope, item: element };
        const r = emitLine(line, rule, ctx, itemScope, resolver, representation);
        if ("reject" in r) return r.reject;
        legs.push(r.leg);
        resolverDecisions.push(r.decision);
        if (r.urgent) urgentCorrections.push(r.urgent);
      }
      continue;
    }

    // per-line predicate
    if (line.when && !evaluatePredicate(line.when, scope)) continue;

    const r = emitLine(line, rule, ctx, scope, resolver, representation);
    if ("reject" in r) return r.reject;
    legs.push(r.leg);
    resolverDecisions.push(r.decision);
    if (r.urgent) urgentCorrections.push(r.urgent);
  }

  // balance assertion (assert_zero per currency)
  const balance = assertBalanced(legs);
  if (!balance.balanced) {
    return {
      outcome: "rejected",
      representation,
      reason: "unbalanced",
      detail: `${rule.rule_id}: DR != CR — ${balance.detail}`,
      context: ctx,
    };
  }

  const baselBusinessLine = ctx.instrument_type
    ? PRODUCT_TO_BUSINESS_LINE[ctx.instrument_type]
    : undefined;
  return {
    outcome: "post",
    representation,
    ruleId: rule.rule_id,
    ruleVersion: rule.version,
    legs,
    resolverDecisions,
    cites: rule.cites,
    urgentCorrections,
    ...(baselBusinessLine !== undefined ? { baselBusinessLine } : {}),
  };
}

/**
 * Process a single template line into one ProposedLeg (+ resolver decision,
 * + optional urgent-correction). For `for_each` lines the caller binds
 * `scope.item` before calling. Returns either the leg/decision or a `reject`
 * outcome (no-matching-row resolver miss).
 */
function emitLine(
  line: RuleLine,
  rule: SlaRule,
  ctx: ContextVector,
  scope: EvalScope,
  resolver: AccountResolver,
  representation: string,
):
  | { leg: ProposedLeg; decision: ResolverDecision; urgent?: UrgentCorrection }
  | { reject: Extract<InterpretResult, { outcome: "rejected" }> } {
  // currency source: line.currency || account.currency || (none → error)
  const currencySource = line.currency ?? line.account.currency;
  if (!currencySource) {
    throw new Error(
      `${rule.rule_id}: line for '${line.account.logical}' has no currency source (set line.currency or account.currency)`,
    );
  }
  const currency = resolveCurrency(currencySource, scope);

  // The line side: an explicit `side_path` (e.g. for_each `item.debitCredit`)
  // overrides the static `side`. This keeps the data-form of a variable
  // reversal (each prior leg carries its own already-flipped side) auditable.
  const side: "debit" | "credit" = line.side_path
    ? resolveSide(line.side_path, scope, rule.rule_id)
    : line.side;

  // ── Physical-account-bypass (for_each reversal of exact prior postings) ──
  // When `use_physical_account` is set, `account.logical` is a path resolving
  // DIRECTLY to a physical ACC-id (the exact account the original posting used,
  // carried on the enrichment). This makes a cancellation reverse precisely the
  // accounts the booking touched — including any suspense account — rather than
  // re-resolving (which could diverge if the resolver table changed since).
  if (line.use_physical_account) {
    const physicalRaw = evaluateString(line.account.logical, scope);
    if (!isAccountId(physicalRaw)) {
      return {
        reject: {
          outcome: "rejected",
          representation,
          reason: "resolver-miss",
          detail: `${rule.rule_id}: for_each physical account '${physicalRaw}' is not a COA leaf`,
          context: ctx,
        },
      };
    }
    const physical = physicalRaw as AccountId;
    const magnitude = absMinor(evaluateAmount(line.amount, scope));
    return {
      leg: { accountId: physical, debitCredit: side, amountMinor: magnitude.toString(), currency },
      decision: {
        logical: line.account.logical,
        key: {
          entity: ctx.entity,
          product: line.account.product ?? ctx.instrument_type ?? "",
          currency,
          jurisdiction: ctx.jurisdiction ?? "",
          representation: rule.representation,
          logical: physical,
        },
        physical,
        via: "exact",
      },
    };
  }

  // resolve account (logical → physical, per-currency)
  const product = line.account.product ?? ctx.instrument_type;
  if (!product) {
    throw new Error(`${rule.rule_id}: cannot resolve product for '${line.account.logical}'`);
  }
  const key: ResolverKey = {
    entity: ctx.entity,
    product,
    currency,
    jurisdiction: ctx.jurisdiction ?? "",
    representation: rule.representation,
    logical: line.account.logical,
  };
  const resolved = resolver.resolve(key);

  // Distinguish the two miss kinds (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE):
  //   - no-matching-row  → genuine rule/config bug (unknown logical/product/
  //     entity). LOUD REJECT — the rule author must fix it; never park in
  //     suspense.
  //   - unresolved-currency → valid axes, unmapped currency. Route the leg to
  //     the FX unresolved-currency suspense account so the entry still
  //     BALANCES, and record an UrgentCorrection so the caller raises a
  //     high-severity alert. NEVER a silent USD fallback, NEVER a dropped leg.
  if (!resolved.ok && resolved.reason === "no-matching-row") {
    return {
      reject: {
        outcome: "rejected",
        representation,
        reason: "resolver-miss",
        detail:
          `no account row for (${key.entity}, ${key.product}, ${key.jurisdiction}, ` +
          `${key.representation}, ${key.logical}) — 0 candidate row(s); rule/config bug`,
        context: ctx,
      },
    };
  }

  let physical: AccountId;
  let via: ResolverDecision["via"];
  let urgent: UrgentCorrection | undefined;
  if (resolved.ok) {
    physical = resolved.physical;
    via = resolved.via;
  } else {
    // unresolved-currency → balancing suspense + urgent-correction alert
    physical = FX_UNRESOLVED_CURRENCY_SUSPENSE;
    via = "suspense";
    urgent = {
      logical: line.account.logical,
      currency,
      suspenseAccount: FX_UNRESOLVED_CURRENCY_SUSPENSE,
      ruleId: rule.rule_id,
      representation,
      alertId: `alert:integrity:sla-unresolved-currency-${currency.toLowerCase()}`,
      detail: `SLA account-resolution miss: no ${rule.representation} ${line.account.logical} account for currency ${currency} (entity ${key.entity}, product ${key.product}) — routed to FX unresolved-currency suspense ${FX_UNRESOLVED_CURRENCY_SUSPENSE}. URGENT CORRECTION: add a dedicated per-currency account and re-book; the USD account is USD-only (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).`,
    };
  }

  const magnitude = absMinor(evaluateAmount(line.amount, scope));
  return {
    leg: { accountId: physical, debitCredit: side, amountMinor: magnitude.toString(), currency },
    decision: { logical: line.account.logical, key, physical, via },
    ...(urgent ? { urgent } : {}),
  };
}

/** Minor-unit magnitude (always non-negative; sign is carried by side). */
function absMinor(raw: bigint): bigint {
  return raw < 0n ? -raw : raw;
}

/** Resolve a `side_path` to the literal "debit" | "credit", rejecting anything else. */
function resolveSide(path: string, scope: EvalScope, ruleId: string): "debit" | "credit" {
  const v = evaluateString(path, scope);
  if (v === "debit" || v === "credit") return v;
  throw new Error(
    `${ruleId}: side_path '${path}' resolved to '${v}' (expected 'debit' | 'credit')`,
  );
}

/** Read an enrichment array path for a `for_each` line. Empty/absent → []. */
function readArrayPath(path: string, scope: EvalScope): unknown[] {
  // Reuse the expression sandbox's path reader by evaluating membership via a
  // tiny dedicated walk. We parse the path AST and resolve it directly so the
  // result can be a non-scalar array (the expression evaluator coerces scalars;
  // here we want the raw array).
  const ast = parseExpression(path);
  if (ast.kind !== "path") {
    throw new Error(`for_each '${path}' must be a plain event/context path`);
  }
  const [root, ...rest] = ast.segments;
  let current: unknown =
    root === "event" ? scope.event : root === "context" ? scope.context : scope.item;
  for (const seg of rest) {
    if (current === null || current === undefined || typeof current !== "object") {
      // Absent enrichment array → no reversal legs (legitimate: a trade with
      // no prior postings). Treat as empty rather than throwing.
      return [];
    }
    current = (current as Record<string, unknown>)[seg];
  }
  if (current === undefined || current === null) return [];
  if (!Array.isArray(current)) {
    throw new Error(`for_each '${path}' did not resolve to an array`);
  }
  return current;
}

/** A currency source is either a fixed ISO-4217 code or an event/context/item path. */
function resolveCurrency(source: string, scope: EvalScope): string {
  if (/^[A-Z]{3}$/.test(source)) return source; // fixed code
  return evaluateString(source, scope); // path
}

// ---------------------------------------------------------------------------
// Urgent-correction alert bridge (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE)
// ---------------------------------------------------------------------------

/**
 * Build the high-severity urgent-correction `SubstrateAlert`
 * { alertClass: "integrity", severity: "high" } that MUST accompany every
 * suspense routing. The interpreter stays pure (it returns `UrgentCorrection`
 * data); the production caller calls this to turn each correction into the
 * actual event to emit. Keeping the builder here makes the data → event mapping
 * single-sourced and impossible to forget: a suspense leg without this alert is
 * a recon violation, not a silent fallback.
 */
export function urgentCorrectionToSubstrateAlert(
  correction: UrgentCorrection,
  args: { asOf: string; entity: string; actor: Actor; citations?: string[] },
): Event {
  return makeSubstrateAlert({
    asOf: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations ?? [
      "D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE",
      "Principles/5-multi-currency-entity-country.md",
    ],
    payload: {
      alertId: correction.alertId,
      alertClass: "integrity",
      severity: "high",
      details: correction.detail,
    },
  });
}
