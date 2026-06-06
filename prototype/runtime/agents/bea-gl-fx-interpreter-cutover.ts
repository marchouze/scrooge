// runtime/agents/bea-gl-fx-interpreter-cutover.ts
//
// SLA Phase 3 — FX-lifecycle cutover bridge (strangler-fig).
//
// This module is the SINGLE production seam where the FX-lifecycle branch of
// Bea's universal GL posting engine (`bea-gl-posting-engine.ts`) stops calling
// the hand-coded posting-rule functions (`platform/accounting/posting-rules/
// fx-spot.ts`) and starts calling the rules-as-data SLA interpreter
// (`platform/accounting/sla/interpreter.ts`) with the IFRS rule set.
//
// SCOPE (D-SLA-ENGINE-RULES-AS-DATA Phase 3; brief deliverable 1): FX-ONLY.
// The eight FX-lifecycle event types below post via the interpreter. Every
// non-FX product family (bond, equity, IRS, repo, deposit, funding, interbank,
// payments) stays on the legacy dispatch in `bea-gl-posting-engine.ts`,
// untouched. Full dispatcher retirement across every product is a FUTURE series.
//
//   FxTradeExecuted        → PR-FX-001            (trade-booking)
//   FxPositionRevalued     → PR-FX-002            (revaluation)
//   PrincipalPayment       → PR-FX-PRIN           (fx-principal-payment)
//   SettlementConfirmed    → PR-FX-LIFECYCLE-CLOSE (fx-lifecycle-close)
//   FxSettlementFailed     → PR-FX-005            (settlement)        [enrichment]
//   FxTradeCancelled       → PR-FX-CANCEL         (cancellation)      [enrichment]
//   FxSettlementInstructed → PR-FX-INSTRUCT       (memo; no GL)
//   TradeReportSubmitted   → PR-FX-REGREPORT      (memo; no GL)
//
// ─── BYTE-FOR-BYTE PARITY (brief deliverable 2) ─────────────────────────────
// The interpreter's output is proven byte-for-byte equal to the legacy
// posting-rule functions by the permanent parallel-run regression
// (`tests/sla-fx-lifecycle-parallel-run.test.ts` +
// `tests/sla-pr-fx-001-parallel-run.test.ts`). The cutover is only safe because
// that guard is green. The legacy `fx-spot.ts` functions are RETAINED as the
// parity reference (deprecated-for-production, not deleted).
//
// ─── ENRICHMENT (brief deliverable 2; spec §2.3) ────────────────────────────
// Two FX rules price off PRIOR-EVENT facts the triggering event does not carry:
//   - PR-FX-005 (FxSettlementFailed, one-leg-delivered) needs the originating
//     trade's RECEIVE LEG (currency / amount / ZAR-equivalent). The same
//     `resolveFailedReceiveLeg` reconstruction the legacy test-only engine uses
//     (`platform/accounting/gl-posting-engine.ts`) is reused here, then handed
//     to the interpreter as `event.enrichment.failedReceiveLeg`.
//   - PR-FX-CANCEL (cancellation) needs the trade's PRIOR BOOKING LEGS and
//     CUMULATIVE unrealised P&L — reconstructed from prior
//     `SubLedgerPostingEmitted` events (the production engine's cancellation
//     index), passed as `event.enrichment.reversalBookingLegs` (ALREADY FLIPPED)
//     + `event.enrichment.cumulativeUnrealisedPnlZarMinor`.
// The interpreter STAYS PURE — enrichment is computed by the caller and handed
// in as data; the interpreter never reads the event store.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 3, CEO-approved 2026-06-05).
// Citations: Principles/1-events-are-truth.md, Principles/5-multi-currency-entity-country.md.

import type { SubLedgerLeg } from "../../platform/accounting/fx-accounting-types";
import {
  type InterpreterApprovalGate,
  PRODUCTION_REPRESENTATIONS,
  approvalGate as buildApprovalGate,
  computeEligibility,
} from "../../platform/accounting/sla/approval";
import { loadApprovalCorpus } from "../../platform/accounting/sla/approval-loader";
import type { Representation } from "../../platform/accounting/sla/generated/sla-types";
import {
  type InterpretResult,
  type ProposedPosting,
  type UrgentCorrection,
  interpret,
} from "../../platform/accounting/sla/interpreter";
import { FX_ALL_REPRESENTATION_RULES, FX_IFRS_RULES } from "../../platform/accounting/sla/rules";
import { logger } from "../../platform/composition";
import type { FxSettlementFailedPayload } from "../../platform/event-store/event-types/fx-accounting";
import type { Event } from "../../platform/event-store/types";
import type { FxTradeExecutedPayload } from "../../platform/markets/cdm/fx";

// ---------------------------------------------------------------------------
// Event-type → SubLedgerPostingEmitted.postingType — the idempotency-key
// component. These strings MUST be IDENTICAL to the legacy engine's
// `postingType` for each event type so the `${sourceEventId}:${postingType}`
// idempotency key is unchanged (no double-post on replay).
// ---------------------------------------------------------------------------

export type FxPostingType =
  | "trade-booking"
  | "revaluation"
  | "fx-principal-payment"
  | "fx-lifecycle-close"
  | "settlement"
  | "cancellation";

const FX_POSTING_TYPE: Readonly<Record<string, FxPostingType>> = {
  FxTradeExecuted: "trade-booking",
  FxPositionRevalued: "revaluation",
  PrincipalPayment: "fx-principal-payment",
  SettlementConfirmed: "fx-lifecycle-close",
  // PR-FX-005 legacy postingType is "settlement" (see gl-posting-engine.ts
  // SETTLEMENT_FAILED dispatch). The production engine does not currently
  // subscribe FxSettlementFailed; the cutover adds it.
  FxSettlementFailed: "settlement",
  FxTradeCancelled: "cancellation",
};

/** The FX-lifecycle event types the interpreter now owns in production. */
export const FX_INTERPRETER_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  "FxTradeExecuted",
  "FxPositionRevalued",
  "PrincipalPayment",
  "SettlementConfirmed",
  "FxSettlementFailed",
  "FxTradeCancelled",
  "FxSettlementInstructed",
  "TradeReportSubmitted",
]);

// ---------------------------------------------------------------------------
// Enrichment builders — the same prior-event reconstruction the legacy engine
// uses, reused so the interpreter and legacy price off identical facts.
// ---------------------------------------------------------------------------

/** The receive-leg booking context for a one-leg-delivered settlement failure. */
export interface FailedReceiveLeg {
  readonly currency: string;
  readonly amountMinor: number;
  readonly zarEquivalentMinor: number;
}

function findFxTradeExecuted(events: ReadonlyArray<Event>, tradeRef: string): Event | undefined {
  for (const e of events) {
    if (e.type !== "FxTradeExecuted") continue;
    const p = e.payload as Partial<FxTradeExecutedPayload>;
    const id = p.tradeId as { value?: string } | string | undefined;
    const matchValue = typeof id === "string" ? id : id?.value;
    if (matchValue === tradeRef) return e;
  }
  return undefined;
}

/**
 * Resolve the failed-receive-leg booking context for a
 * `FxSettlementFailed{one-leg-delivered}` event. Mirrors the legacy
 * `resolveFailedReceiveLeg` in `platform/accounting/gl-posting-engine.ts` so the
 * interpreter prices off the same prior-event facts. Returns `undefined` when
 * the originating trade or its near leg cannot be found (the caller treats that
 * as a skip, exactly as the legacy engine does).
 */
export function resolveFailedReceiveLeg(
  events: ReadonlyArray<Event>,
  failedPayload: FxSettlementFailedPayload,
): FailedReceiveLeg | undefined {
  const trade = findFxTradeExecuted(events, failedPayload.tradeRef);
  if (!trade) return undefined;

  const payload = trade.payload as FxTradeExecutedPayload;
  const nearLeg = payload.legs.find((l) => l.legKind === "near");
  if (!nearLeg) return undefined;

  const currency = nearLeg.receiveCurrency;
  const amountMinor = Math.abs(nearLeg.counterNotional.amountMinor);

  let zarEquivalentMinor: number;
  if (nearLeg.payCurrency === "ZAR") {
    zarEquivalentMinor = Math.abs(nearLeg.notional.amountMinor);
  } else if (nearLeg.receiveCurrency === "ZAR") {
    zarEquivalentMinor = amountMinor;
  } else {
    zarEquivalentMinor = Math.round(amountMinor * nearLeg.rate.amount);
  }

  return { currency, amountMinor, zarEquivalentMinor };
}

/** A single already-flipped reversal leg for PR-FX-CANCEL `for_each`. */
export interface ReversalBookingLeg {
  readonly accountId: string;
  readonly debitCredit: "debit" | "credit";
  readonly amountMinor: number;
  readonly currency: string;
}

/** Enrichment payload for PR-FX-CANCEL. */
export interface CancelEnrichment {
  readonly reversalBookingLegs: readonly ReversalBookingLeg[];
  readonly cumulativeUnrealisedPnlZarMinor: number;
}

/**
 * Build the cancellation enrichment from the trade's prior booking legs +
 * cumulative unrealised P&L. The caller (the production engine) reconstructs
 * these via its cancellation index exactly as it did for the legacy
 * `fxCancellationJournals` input; this helper turns them into the
 * interpreter's enrichment shape by FLIPPING each booking leg's side (the
 * reversal direction) — the `for_each` line then expands one reversal leg per
 * element with `use_physical_account` (lands on the EXACT prior account).
 */
export function buildCancelEnrichment(args: {
  bookingLegs: ReadonlyArray<SubLedgerLeg>;
  cumulativeUnrealisedPnlZarMinor: number;
}): CancelEnrichment {
  return {
    reversalBookingLegs: args.bookingLegs.map((l) => ({
      accountId: l.accountId,
      debitCredit: l.debitCredit === "debit" ? "credit" : "debit",
      amountMinor: l.amountMinor,
      currency: l.currency,
    })),
    cumulativeUnrealisedPnlZarMinor: args.cumulativeUnrealisedPnlZarMinor,
  };
}

// ---------------------------------------------------------------------------
// NOP-reversal enrichment (PR-FX-CANCEL-BA — SARB-BA-RETURN) — the 4a gap.
// ---------------------------------------------------------------------------

/** The SARB BA-350 NOP reversal context for a cancelled FX-spot trade. */
export interface NopReversal {
  /** The original receive-leg (bought) currency the NOP memo was opened on. */
  readonly currency: string;
  /** |original receive-leg counterNotional| (magnitude, minor units). */
  readonly amountMinor: number;
}

/** Enrichment payload for PR-FX-CANCEL-BA, exposed as `event.enrichment.nopReversal`. */
export interface NopCancelEnrichment {
  readonly nopReversal: NopReversal;
}

/**
 * Build the SARB BA-350 NOP-reversal enrichment for an `FxTradeCancelled` event.
 *
 * PR-FX-001-BA opened the NOP memo on the trade's RECEIVE-leg (bought) currency,
 * magnitude = |near.counterNotional.amountMinor| (the bought-currency notional).
 * PR-FX-CANCEL-BA must unwind exactly that memo, so the reversal prices off the
 * SAME receive-leg facts — reconstructed from the originating `FxTradeExecuted`
 * (the cancellation event does not carry them). Mirrors the receive-leg
 * reconstruction `resolveFailedReceiveLeg` performs for PR-FX-005, so the open
 * and the unwind price off identical prior-event facts (the memo nets to zero).
 *
 * Returns `undefined` when the originating trade or its near leg cannot be found
 * — the caller supplies NO enrichment, so PR-FX-CANCEL-BA's `for_each`-free
 * reversal lines read an absent path and the rule rejects loudly (never a silent
 * skip; a cancellation with no resolvable booking is a genuine integrity signal).
 */
export function buildNopReversalEnrichment(
  events: ReadonlyArray<Event>,
  cancelledTradeId: string,
): NopCancelEnrichment | undefined {
  const trade = findFxTradeExecuted(events, cancelledTradeId);
  if (!trade) return undefined;

  const payload = trade.payload as FxTradeExecutedPayload;
  const nearLeg = payload.legs.find((l) => l.legKind === "near");
  if (!nearLeg) return undefined;

  return {
    nopReversal: {
      currency: nearLeg.receiveCurrency,
      amountMinor: Math.abs(nearLeg.counterNotional.amountMinor),
    },
  };
}

// ---------------------------------------------------------------------------
// interpretFxEvent — the production cutover seam.
// ---------------------------------------------------------------------------

export type FxInterpretOutcome =
  | {
      readonly kind: "post";
      readonly postingType: FxPostingType;
      readonly legs: SubLedgerLeg[];
      readonly urgentCorrections: readonly UrgentCorrection[];
      // SLA rule lineage carried onto the SubLedgerPostingEmitted (spec §8.1;
      // versioning recon §6.3). The interpreter ran exactly one IFRS rule
      // version (effective-date selection); we stamp it so the posting is
      // reproducible from the cited version.
      readonly representation: Representation;
      readonly ruleId: string;
      readonly ruleVersion: number;
    }
  | { readonly kind: "no-gl"; readonly detail: string }
  | { readonly kind: "reject"; readonly detail: string };

/** Convert an interpreter `ProposedPosting` leg back to a `SubLedgerLeg`
 *  (string minor → number). The parity test asserts these are numerically
 *  equal to the legacy `SubLedgerLeg[]`. */
function toSubLedgerLegs(post: ProposedPosting): SubLedgerLeg[] {
  return post.legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: Number(l.amountMinor),
    currency: l.currency,
  }));
}

/**
 * Map ONE interpreter `InterpretResult` (a single representation's outcome) to
 * the production engine's outcome shape. Shared by the IFRS-only seam and the
 * multi-representation fan-out so both representations are mapped identically.
 *
 *   - "post"                  → emit SubLedgerPostingEmitted + any urgent
 *                               corrections (suspense legs).
 *   - "intentional-no-impact" → no GL (memo rules; zero-delta reval; zero-pnl
 *                               close; every NOP-neutral SARB lifecycle rule).
 *   - "rejected" / "ambiguous" → loud reject (the caller logs + records an
 *                               error; never silent).
 */
function mapResultToOutcome(eventType: string, r: InterpretResult): FxInterpretOutcome {
  if (r.outcome === "intentional-no-impact") {
    return { kind: "no-gl", detail: r.detail };
  }
  if (r.outcome === "rejected") {
    return { kind: "reject", detail: `${r.representation} ${r.reason}: ${r.detail}` };
  }
  if (r.outcome === "ambiguous") {
    return {
      kind: "reject",
      detail: `${r.representation} ambiguous rule selection: ${r.candidateRuleIds.join(", ")} — ${r.detail}`,
    };
  }

  // outcome === "post"
  const legs = toSubLedgerLegs(r);
  if (legs.length === 0) {
    // A balanced posting with zero legs is the no-GL case (e.g. settlement
    // failure no-GL branch) — matches the legacy `legs.length === 0` skip.
    return { kind: "no-gl", detail: `${r.ruleId}: zero legs` };
  }

  const postingType = FX_POSTING_TYPE[eventType];
  if (!postingType) {
    return {
      kind: "reject",
      detail: `no postingType mapped for FX event ${eventType}`,
    };
  }

  return {
    kind: "post",
    postingType,
    legs,
    urgentCorrections: r.urgentCorrections,
    representation: r.representation as Representation,
    ruleId: r.ruleId,
    ruleVersion: r.ruleVersion,
  };
}

/**
 * Run the IFRS-ONLY SLA interpreter for a single FX-lifecycle source event and
 * map the result to the production engine's outcome shape. RETAINED for the
 * parity / dry-run callers that evaluate the IFRS basis alone; the production
 * engine now uses `interpretFxEventAll` to fan out across the activated
 * representations. The IFRS outcome this returns is byte-for-byte identical to
 * the IFRS element of `interpretFxEventAll` (same rules, same enrichment,
 * representations partitioned — additivity, spec §2.2).
 *
 * `enrichment` is the pre-resolved prior-event context (cancel reversal legs /
 * failed-receive-leg) the caller computed; omit for events that need none.
 */
export function interpretFxEvent(
  event: Event,
  asOf: string,
  enrichment?: unknown,
  approvalGate?: InterpreterApprovalGate,
): FxInterpretOutcome {
  const results: InterpretResult[] = interpret(
    {
      type: event.type,
      entity: event.entity ?? "LE-ZA-HOZ-BANK",
      as_of: event.as_of,
      payload: event.payload,
      enrichment,
    },
    FX_IFRS_RULES,
    ["IFRS"],
    asOf,
    approvalGate ? { approvalGate } : {},
  );

  const r = results.find((x) => x.representation === "IFRS");
  if (!r) {
    return {
      kind: "reject",
      detail: `interpreter produced no IFRS result for ${event.type}`,
    };
  }
  return mapResultToOutcome(event.type, r);
}

/** One activated representation's outcome for an FX-lifecycle event. */
export interface FxRepresentationOutcome {
  readonly representation: Representation;
  readonly outcome: FxInterpretOutcome;
}

/**
 * Run the SLA interpreter for a single FX-lifecycle source event across ALL the
 * activated production representations (`PRODUCTION_REPRESENTATIONS`), mapping
 * each representation's result to the engine's outcome shape. The production
 * cutover seam (SARB activation Round 3 — the flip): one FX event now yields one
 * IFRS posting AND one SARB-BA-RETURN posting (the NOP memo), each rule set
 * partitioned by `representation` inside the interpreter, each balanced
 * independently per currency. The IFRS outcome is byte-for-byte unchanged from
 * the IFRS-only path (additivity, spec §2.2) — adding SARB rules cannot alter
 * IFRS rule selection because the interpreter filters rules by representation.
 *
 * `enrichment` is the pre-resolved prior-event context. For a cancellation it
 * carries BOTH the IFRS reversal legs (`reversalBookingLegs`, read by
 * PR-FX-CANCEL) AND the SARB NOP reversal (`nopReversal`, read by
 * PR-FX-CANCEL-BA) — non-overlapping enrichment keys, so one merged object
 * serves both representations' rules.
 *
 * Returns one `FxRepresentationOutcome` per activated representation, in the
 * `PRODUCTION_REPRESENTATIONS` order. A representation with no eligible rule for
 * the event yields a loud `reject` outcome (never silent).
 */
export function interpretFxEventAll(
  event: Event,
  asOf: string,
  enrichment?: unknown,
  approvalGate?: InterpreterApprovalGate,
): FxRepresentationOutcome[] {
  const results: InterpretResult[] = interpret(
    {
      type: event.type,
      entity: event.entity ?? "LE-ZA-HOZ-BANK",
      as_of: event.as_of,
      payload: event.payload,
      enrichment,
    },
    FX_ALL_REPRESENTATION_RULES,
    PRODUCTION_REPRESENTATIONS,
    asOf,
    approvalGate ? { approvalGate } : {},
  );

  return PRODUCTION_REPRESENTATIONS.map((representation) => {
    const r = results.find((x) => x.representation === representation);
    const outcome: FxInterpretOutcome = r
      ? mapResultToOutcome(event.type, r)
      : {
          kind: "reject",
          detail: `interpreter produced no ${representation} result for ${event.type}`,
        };
    return { representation: representation as Representation, outcome };
  });
}

// ---------------------------------------------------------------------------
// Production approval gate (Phase 4c)
// ---------------------------------------------------------------------------

/**
 * Build the Phase-4c approval-eligibility gate for the production FX path from
 * the approval event stream. The engine calls this ONCE per run (replaying the
 * three approval event types) and passes the result to every `interpretFxEvent`
 * call, so a published-but-unapproved (or withheld) FX rule version never posts.
 *
 * Grandfathered in-force rules carry a seeded build-phase grandfather approval
 * (see `scripts/seed-sla-grandfather-approvals.ts`), so they remain eligible and
 * production posting is unchanged. If the grandfather seed has NOT run yet (e.g.
 * a fresh store), the eligible set is empty and FX postings would all reject
 * loudly — the deliberately LOUD non-regression signal, never a silent skip.
 *
 * Defects (self-approval / dangling approval) are logged loudly, never silenced.
 */
export function buildFxApprovalGate(approvalEvents: readonly Event[]): InterpreterApprovalGate {
  const corpus = loadApprovalCorpus(approvalEvents);
  const { eligible, defects } = computeEligibility(corpus);
  if (defects.length > 0) {
    logger.error(
      { defects },
      "bea:sla-approval — rejected approval(s) (self-approval / no matching publish) — NOT eligible",
    );
  }
  return buildApprovalGate(eligible);
}
