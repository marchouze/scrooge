// platform/returns/ba300/period-close-subscriber.ts
//
// M2 Slice 3 — AccountingPeriodClosed subscriber that triggers BA 110 (LCR)
// generation when an accounting period closes for a bank-licence entity.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 3.
//
// ## Design
//
// The subscriber wires the BA 110 generator to the period-close event stream.
// When `AccountingPeriodClosed` fires for `LE-ZA-HOZ-BANK`, the subscriber:
//   1. Reads the trial-balance rows from the event payload's referenced
//      `TrialBalanceSnapshotted` event_id (persisted in the event store).
//   2. Folds the unified-position and security-master projections to compute
//      instrument-level HQLA stock (`computeHqlaStockFromPositions`).
//   3. Derives the additive cash HQLA contribution from each cash account's
//      custodian Party classification (`computeCashHqlaFromCustodian`): cash
//      held with a `central-bank`-classified custodian (the SARB) is Level-1
//      (Reg 26(7)(a)(i); BCBS D295 §50(a)). The tier is a query over the
//      event-sourced Party register, never an authored COA tag.
//   4. Calls `generateBa300Lcr` with the event store, trial balance, the
//      instrument-level `hqlaStock`, and the custodian-derived `cashHqlaLines`.
//   5. Returns the typed `Ba300LcrOutput` for the caller to render / store.
//
// ## Principle 1 compliance
//
// Cash flows (LCR denominator) are folded directly from
// `FxSettlementInstructed` and `TradeMatured` events inside
// `generateBa300Lcr` — not from GL account balances. HQLA stock (numerator)
// is instrument-level (SecurityMaster × unified-position) plus the
// custodian-derived cash residual — both queries over the event log, not
// stored classification state. This is the Principle 1 compliant architecture
// per `Principles/1-events-are-truth.md` (updated 2026-05-12).
//
// ## Custodian-derived cash HQLA
//
// Cash has no ISIN, so it cannot be classified per-security. Its HQLA
// eligibility flows from *who holds it*: the cash account's custodian Party.
// The COA registry records each cash account's `custodianPartyId`
// (e.g. ACC-1100-001 → `urn:party:legal-entity:sarb`); the Party register
// records the custodian's classification (`central-bank`). The tier is
// derived from the two — never from a hand-typed `hqlaLevel` tag on the
// account. This removes the prior authored-tag failure mode (the tier was
// stored state, not a query over a source fact).
//
// Citation: Principles/1-events-are-truth.md; D-MARKETS-SCHEMA-FOUNDATION;
//           D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//           D-FINANCIAL-INSTRUMENT-ENTITY;
//           D-HQLA-CASH-CUSTODIAN-DERIVED (CEO-approved 2026-05-29);
//           BCBS D295 §50; Reg 26(7)(a)(i).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping + subscriber owner)
//   + Eitan (Treasury & liquidity engineer, engineering — LCR methodology
//   owner)
//   + Anya (Projection Engineer, engineering — semantic-layer integration).

import { COA_ACCOUNTS, coaToHqlaClassifications } from "../../accounting/coa-registry";
import type {
  AccountingPeriodClosedPayload,
  TrialBalanceSnapshottedPayload,
} from "../../event-store/event-types";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { buildPartyProjection } from "../../identity/party-projection";
import {
  securityMasterInitial,
  securityMasterProjection,
  unifiedPositionInitial,
  unifiedPositionProjection,
} from "../../projections/markets";
import {
  type AccountLiquidityClassification,
  BA_300_LCR_BANK_ENTITIES,
  type Ba300LcrOutput,
  generateBa300Lcr,
} from "../../reporting/ba-300-lcr";
import {
  type CashHqlaCustodianAccount,
  type HqlaStockInput,
  computeCashHqlaFromCustodian,
} from "../../reporting/hqla-stock";

// ---------------------------------------------------------------------------
// Functional currency (build-phase scope)
// ---------------------------------------------------------------------------

// TODO: read from AccountingPeriodOpened.functionalCurrency (Slice 6+). Until
// then the bank's single licensed entity reports in ZAR (Principle 5: FX
// positions are excluded from the functional-currency LCR until conversion
// lands).
const FUNCTIONAL_CURRENCY = "ZAR";

// ---------------------------------------------------------------------------
// Cash-nature accounts with a custodian (HQLA tier derived from the custodian)
// ---------------------------------------------------------------------------

/**
 * Cash-nature GL accounts that carry a custodian Party. The HQLA tier of each
 * balance is *derived* from the custodian's Party classification at report
 * time (`central-bank` → Level-1), never from an authored COA tag. Securities
 * accounts MUST NOT appear here — the instrument-level path
 * (`computeHqlaStockFromPositions`) owns those.
 *
 * Sourced from the COA registry (`category === "asset-cash"` with a
 * `custodianPartyId`). This is the same derivation the rehearsal CLI
 * (`scripts/render-ba-110.ts`) uses, kept in lock-step so the two BA 110
 * code paths agree.
 *
 * Authority: D-HQLA-CASH-CUSTODIAN-DERIVED (CEO-approved 2026-05-29);
 * BCBS D295 §50; Reg 26(7)(a)(i).
 */
const CASH_CUSTODIAN_ACCOUNTS: readonly CashHqlaCustodianAccount[] = COA_ACCOUNTS.filter(
  (a): a is typeof a & { custodianPartyId: string } =>
    a.category === "asset-cash" && a.custodianPartyId !== undefined,
).map((a) => ({ leafAccountId: a.id, custodianPartyId: a.custodianPartyId }));

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → BA 110 subscriber.
 */
export interface Ba300LcrPeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `BA_300_LCR_BANK_ENTITIES`. */
  readonly entity: string;
  /**
   * Event store — provides access to:
   *   (a) `TrialBalanceSnapshotted` event rows (cash HQLA base);
   *   (b) unified-position / security-master projections (instrument HQLA);
   *   (c) the Party register (custodian → classification lookup);
   *   (d) `FxSettlementInstructed` / `TradeMatured` events (cash flows).
   */
  readonly eventStore: EventStore;
  /** Actor running the subscriber (typically the Bea agent). */
  readonly actor: Actor;
  /**
   * Optional override liquidity classifications. Defaults to the COA-registry
   * derived securities classifications (`coaToHqlaClassifications()`). With the
   * instrument-level `hqlaStock` path active (always, here) this feeds only the
   * generator's `classificationsFingerprint` metadata — HQLA stock is computed
   * instrument-level + custodian-derived-cash, not from these account tags.
   */
  readonly classifications?: readonly AccountLiquidityClassification[];
  /**
   * ISO 8601 — start of the 30-day stress window for cash-flow folding.
   * Per BCBS D295 §31 the window is the 30 calendar days from the
   * reporting date. Convention: `AccountingPeriodOpened.periodStart`.
   */
  readonly periodStart: string;
}

/**
 * Result of the `AccountingPeriodClosed` → BA 110 subscriber.
 */
export interface Ba300LcrPeriodCloseSubscriberResult {
  /** The generated BA 110 projection. Caller renders + stores this. */
  readonly ba300LcrOutput: Ba300LcrOutput;
  /** The trial-balance rows used as the cash HQLA base. */
  readonly trialBalanceRows: readonly {
    leafAccountId: string;
    currency: string;
    amountMinor: number;
  }[];
  /**
   * True if the entity was not in `BA_300_LCR_BANK_ENTITIES` and the subscriber
   * skipped generation. The caller can route non-bank-entity closes to other
   * subscribers without raising an error.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Projection fold — unified-position + security-master for instrument HQLA
// ---------------------------------------------------------------------------

function foldPositionProjections(
  eventStore: EventStore,
  entity: string,
  untilSequence: number | undefined,
): { positions: typeof unifiedPositionInitial; securityMaster: typeof securityMasterInitial } {
  let positions = unifiedPositionInitial;
  let securityMaster = securityMasterInitial;
  // Bound the fold by the AccountingPeriodClosed frozen cursor (if present) so
  // it cannot diverge from concurrent appends — matches the trial-balance and
  // cash-flow folds. Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
  for (const event of eventStore.replay({
    entity,
    ...(untilSequence !== undefined ? { untilSequence } : {}),
  })) {
    if (unifiedPositionProjection.accepts(event)) {
      positions = unifiedPositionProjection.reduce(positions, event);
    }
    if (securityMasterProjection.accepts(event)) {
      securityMaster = securityMasterProjection.reduce(securityMaster, event);
    }
  }
  return { positions, securityMaster };
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for BA 110 (LCR) generation.
 *
 * Triggered by `AccountingPeriodClosed` events for bank-licence entities.
 * Non-bank entities (e.g. `LE-ZA-HOZ-SECURITIES`, `LE-ZA-HOZ-GROUP`) are
 * silently skipped (`result.skipped = true`).
 *
 * **Principle 1 compliance**: this subscriber does NOT derive cash flows
 * from the trial balance. Cash flows (LCR denominator) are folded directly
 * from settlement events inside `generateBa300Lcr`.
 *
 * **HQLA stock**: instrument-level (SecurityMaster × unified-position) plus an
 * additive custodian-derived cash residual. Each cash account's tier is a
 * query over the event-sourced Party register (`central-bank` → Level-1), not
 * an authored COA tag — Principle 1 (events as truth) and Principle 2
 * (single-graph discipline: regulation → policy → custodian classification →
 * account → BA 110 cell).
 *
 * Citations:
 *   Principles/1-events-are-truth.md (updated 2026-05-12);
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10);
 *   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22);
 *   D-HQLA-CASH-CUSTODIAN-DERIVED (CEO-approved 2026-05-29);
 *   D-MARKETS-SCHEMA-FOUNDATION;
 *   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 26;
 *   BCBS D295.
 */
export function ba300LcrPeriodCloseSubscriber(
  input: Ba300LcrPeriodCloseSubscriberInput,
): Ba300LcrPeriodCloseSubscriberResult {
  // Guard: only bank-licence entities generate BA 110.
  if (!BA_300_LCR_BANK_ENTITIES.includes(input.entity)) {
    return {
      ba300LcrOutput: null as unknown as Ba300LcrOutput,
      trialBalanceRows: [],
      skipped: true,
      skipReason: `entity '${input.entity}' is not in BA_300_LCR_BANK_ENTITIES (${BA_300_LCR_BANK_ENTITIES.join(", ")}); BA 110 not generated`,
    };
  }

  // Resolve trial-balance rows from the TrialBalanceSnapshotted event.
  const tbEventId = input.closedPayload.trialBalanceSnapshotEventId;
  let trialBalanceRows: readonly {
    leafAccountId: string;
    currency: string;
    amountMinor: number;
  }[] = [];

  if (tbEventId) {
    // Replay all events for the entity and find the TrialBalanceSnapshotted event
    // with this event_id. The trial-balance rows are carried in the event payload.
    // Use the frozen cursor from the AccountingPeriodClosed event (if present) to
    // prevent divergence when new events append concurrently.
    // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
    const untilSequence = input.closedPayload.eventSequence;
    for (const event of input.eventStore.replay({
      entity: input.entity,
      ...(untilSequence !== undefined ? { untilSequence } : {}),
    })) {
      if (event.event_id === tbEventId && event.type === "TrialBalanceSnapshotted") {
        const payload = event.payload as TrialBalanceSnapshottedPayload;
        trialBalanceRows = payload.rows;
        break;
      }
    }
  }

  const classifications = input.classifications ?? coaToHqlaClassifications();
  const periodEnd = input.closedPayload.closedAt;
  const untilSequence = input.closedPayload.eventSequence;

  // Instrument-level HQLA stock (SecurityMaster × unified-position).
  const { positions, securityMaster } = foldPositionProjections(
    input.eventStore,
    input.entity,
    untilSequence,
  );
  const hqlaStock: HqlaStockInput = {
    positions,
    securityMaster,
    functionalCurrency: FUNCTIONAL_CURRENCY,
  };

  // Additive cash HQLA — tier DERIVED from the custodian Party classification.
  // Fold the Party register so the custodian → classification lookup is a query
  // over events (Principle 1), not a hard-coded tag. positive-balance and
  // functional-currency rules live inside computeCashHqlaFromCustodian.
  const partyProjection = buildPartyProjection(input.eventStore, periodEnd);
  const custodianClassifications = (custodianPartyId: string): ReadonlySet<string> => {
    const party = partyProjection.parties.get(custodianPartyId as never);
    return new Set(party?.classifications ?? []);
  };
  const cashHqlaLines = computeCashHqlaFromCustodian({
    trialBalance: trialBalanceRows,
    cashAccounts: CASH_CUSTODIAN_ACCOUNTS,
    custodianClassifications,
    functionalCurrency: FUNCTIONAL_CURRENCY,
  });

  const ba300LcrOutput = generateBa300Lcr({
    entity: input.entity,
    asOf: periodEnd,
    periodId: input.closedPayload.periodId,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    eventStore: input.eventStore,
    periodStart: input.periodStart,
    periodEnd,
    trialBalance: trialBalanceRows,
    classifications,
    // Preferred path: instrument-level HQLA stock from SecurityMaster × position.
    hqlaStock,
    // Additive cash HQLA — tier derived from the custodian Party classification.
    cashHqlaLines,
    trialBalanceSnapshotEventId: tbEventId,
    // Thread the frozen cursor so the settlement cash-flow fold is bounded.
    // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
    ...(untilSequence !== undefined ? { untilSequence } : {}),
  });

  return {
    ba300LcrOutput,
    trialBalanceRows,
    skipped: false,
  };
}
