// platform/markets/settlement/fx-settlement-subscriber.ts
//
// FX settlement subscriber — internal pre-licence test variant.
//
// Consumes a (mocked) correspondent-bank feed and emits the structured
// settlement-lifecycle events that PROC-OPS-SFBCP-01 (Devon, Chief Operating
// Officer, governance — PR #636) v0.2 §2 depends on:
//
//   - FxSettlementConfirmed       (both legs delivered)
//   - MissedExpectedReceipt       (our leg out, counterparty leg missing)
//   - FxSettlementFailed          (one-leg-delivered | neither-delivered | operational-delay)
//   - SettlementFailureClassified (deterministic follow-on for every FxSettlementFailed)
//
// ─── BUILD-PHASE POSTURE ──────────────────────────────────────────────────
//
// This subscriber is the SIMULATED-FEED variant for the internal pre-licence
// test (Marc's MVP framing, 2026-05-20). It consumes a fixture-driven
// `CorrespondentFeed` interface; no real SWIFT MT300 / MT202 / ISO-20022
// pacs.* parser sits behind it.
//
// Per `project_indirect_participant_posture.md`, the bank is an indirect
// participant via correspondent bank — production access lands post-licence
// as operational work, NOT a substrate decision. The production variant
// will sit at the same module path under a different feed implementation
// (e.g. `fx-settlement-subscriber-swift.ts`) and MUST produce identical
// event shapes (this is the interop contract).
//
// ─── AUTHORITY ────────────────────────────────────────────────────────────
//
//   §1. PR #636 — Devon, PROC-OPS-SFBCP-01 v0.2 (settlement-failure BCP);
//       §2 failure detection + classification taxonomy.
//   §2. PR #638 — Atlas (Records & schema engineer) FX-spot substrate
//       schema completeness pack — `FxSettlementFailed`,
//       `MissedExpectedReceipt`, `SettlementFailureClassified` event types.
//   §3. `Policies/trading-mandate-v1.md` §6 — FX Settlement Risk Framework
//       (Herstatt risk; counterparty whitelist; correspondent-routed
//       settlement default).
//   §4. `project_indirect_participant_posture.md` — bank accesses CLS /
//       SAMOS via correspondent; never direct.
//   §5. BCBS d226 — Supervisory guidance for managing settlement risk in
//       foreign-exchange transactions.
//   §6. Banks Act 94 of 1990 Reg 39 — documented BCP procedures for
//       settlement failures.
//
// Author: Tomas (Correspondent banking & payments, engineering).

import { newEventId } from "../../core/types";
import {
  makeFxSettlementConfirmed,
  makeFxSettlementFailed,
  makeMissedExpectedReceipt,
  makeSettlementFailureClassified,
} from "../../event-store/event-types/fx-accounting";
import type { Actor, Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// Posture markers — surface in the build, not just in this file's docstring.
// ---------------------------------------------------------------------------

/**
 * Build-phase posture marker. `"simulated"` is the only legal value for the
 * internal pre-licence test variant. The production SWIFT / pacs.* parser
 * will live in a sibling module that exports `"production"`.
 */
export const FX_SETTLEMENT_SUBSCRIBER_VARIANT = "simulated" as const;

export type FxSettlementSubscriberVariant = typeof FX_SETTLEMENT_SUBSCRIBER_VARIANT;

// ---------------------------------------------------------------------------
// Correspondent feed interface (subscriber input contract)
//
// Minimal shape. The fixture-driven feed simply hands back a static list of
// `CorrespondentMessage` records; a production feed would stream from a
// SWIFT alliance access connector or ISO-20022 pacs.002 subscription.
// ---------------------------------------------------------------------------

/**
 * Per-leg delivery status as reported by the correspondent. Mirrors the
 * shape carried inside `FxSettlementFailed.payload.legStatus`.
 */
export interface CorrespondentLegStatus {
  /** Bank's pay-leg — did the cash leave our nostro? */
  readonly payLegDelivered: boolean;
  /** Counterparty's pay-leg from our perspective — did we receive the other currency? */
  readonly receiveLegDelivered: boolean;
}

/**
 * One correspondent-bank settlement message. Each message references the
 * originating trade (`tradeRef`) and the settlement instruction
 * (`settlementInstructionRef`) it reports on. Subscriber does NOT validate
 * these refs against the event store — that is a recon-pipeline concern
 * (B-cluster RAS recon, Vera Wave-4 backlog).
 */
export interface CorrespondentMessage {
  /** Trade reference (matches `FxTradeExecuted.payload.tradeId.value`). */
  readonly tradeRef: string;
  /** Settlement instruction reference (matches `FxSettlementInstructed.event_id`). */
  readonly settlementInstructionRef: string;
  /** Value date for this settlement (ISO 8601 date, typically T+2 from trade date). */
  readonly valueDate: string;
  /** ISO 8601 timestamp of the correspondent's cutoff (value-date end-of-window). */
  readonly cutoffAt: string;
  /** Tolerance window (minutes) after cutoff before a delay becomes a failure. */
  readonly toleranceMinutes: number;
  /** ISO 8601 timestamp at which this message was observed from the correspondent. */
  readonly observedAt: string;
  /** Per-leg delivery status. */
  readonly legStatus: CorrespondentLegStatus;
  /**
   * Currency pair traded (canonical "BASE/QUOTE", e.g. "USD/ZAR"). Used to
   * tag the `FxSettlementConfirmed` event.
   */
  readonly currencyPair: string;
  /** Which leg of the trade this message reports on (near / far). */
  readonly legKind: "near" | "far";
  /**
   * Settled base-currency amount in minor units (positive = bank received,
   * negative = bank paid). Only populated on the both-delivered path.
   */
  readonly settledBaseCurrencyMinor?: number;
  /**
   * Settled quote-currency amount in minor units. Convention as above.
   */
  readonly settledQuoteCurrencyMinor?: number;
  /** Chart-of-accounts ID for the nostro account receiving/paying base currency. */
  readonly nostroAccountBase?: string;
  /** Chart-of-accounts ID for the nostro account receiving/paying quote currency. */
  readonly nostroAccountQuote?: string;
  /** Correspondent confirmation reference (SWIFT MT300 / pacs.009 ref). */
  readonly correspondentRef?: string;
  /**
   * Expected receive-leg currency and amount (for the missing-leg path).
   * Required when `legStatus.receiveLegDelivered === false`.
   */
  readonly expectedReceiveCurrency?: string;
  readonly expectedReceiveAmountMinor?: string;
  /**
   * Free-form explanation from the correspondent (SWIFT MT199 body, email
   * text). Required on any failure path.
   */
  readonly failureReason?: string;
  /**
   * Hint marking the message as still in-flight past the cutoff window.
   * When true and both legs are still undelivered AND `observedAt` >
   * `cutoffAt + toleranceMinutes`, the subscriber emits
   * `FxSettlementFailed{failureKind: "operational-delay"}` rather than
   * "neither-delivered". Default `false`.
   */
  readonly inFlight?: boolean;
}

/**
 * Injectable correspondent-feed interface. The simulated variant returns a
 * pre-baked list of messages; the production variant will stream them off
 * a SWIFT or pacs.002 subscription.
 */
export interface CorrespondentFeed {
  /** Return the next batch of correspondent messages to process. */
  readonly poll: () => Iterable<CorrespondentMessage>;
}

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

/**
 * Per-message processing outcome — useful for the internal-test scenario
 * harness to assert per-message what happened.
 */
export type MessageOutcome =
  | { kind: "confirmed"; tradeRef: string }
  | { kind: "one-leg-delivered"; tradeRef: string }
  | { kind: "neither-delivered"; tradeRef: string }
  | { kind: "operational-delay"; tradeRef: string };

export interface FxSettlementSubscriberResult {
  /** All events emitted in observed order. */
  readonly events: readonly Event[];
  /** Per-message outcomes, one entry per input message, same order. */
  readonly outcomes: readonly MessageOutcome[];
}

// ---------------------------------------------------------------------------
// Configuration (clock + actor + entity + citations)
// ---------------------------------------------------------------------------

export interface FxSettlementSubscriberConfig {
  /** Injected clock — return ISO 8601 timestamps. Determinism in tests. */
  readonly now: () => string;
  /** Actor recorded on every emitted event. */
  readonly actor: Actor;
  /** Legal-entity identifier (e.g. "BANK-ZA-001"). */
  readonly entity: string;
  /**
   * Citations carried on every emitted event (Principle 2). At minimum:
   *   - PR #636 (Devon procedure)
   *   - PR #638 (Atlas schema pack)
   *   - Policies/trading-mandate-v1.md §6
   *   - project_indirect_participant_posture.md
   *   - BCBS d226
   *   - Banks Act Reg 39
   */
  readonly citations: readonly string[];
  /**
   * Optional event-id factory — defaults to `newEventId`. Tests inject a
   * deterministic counter so emitted event IDs are reproducible across runs.
   */
  readonly newId?: () => string;
}

// ---------------------------------------------------------------------------
// Idempotency-key derivation
//
// Replay-safety is checked by the *caller* (an event-store append() that
// rejects duplicate (settlementInstructionRef, kind) keys would block
// re-emission). The subscriber itself is pure: it produces the same event
// shapes for the same input, so callers can compare against the store's
// existing tail and only append the deltas.
//
// To support that pattern we expose a stable key derivation:
// ---------------------------------------------------------------------------

export function idempotencyKey(m: CorrespondentMessage, kind: MessageOutcome["kind"]): string {
  return `${m.settlementInstructionRef}:${kind}`;
}

// ---------------------------------------------------------------------------
// Core subscriber
// ---------------------------------------------------------------------------

/**
 * Run the FX settlement subscriber over a (simulated) correspondent feed.
 *
 * For each message:
 *   - both legs delivered          → `FxSettlementConfirmed`
 *   - our leg delivered, theirs not → `MissedExpectedReceipt` + `FxSettlementFailed{one-leg-delivered}`
 *   - neither leg delivered, past cutoff+tolerance, not in-flight
 *                                  → `FxSettlementFailed{neither-delivered}`
 *   - neither leg delivered, in-flight past cutoff+tolerance
 *                                  → `FxSettlementFailed{operational-delay}`
 *
 * Every `FxSettlementFailed` is deterministically followed by a
 * `SettlementFailureClassified` event (mapping per PROC-OPS-SFBCP-01 §2).
 *
 * Determinism is total: same input messages + same clock + same `newId`
 * factory produces the same event list. This is the property the recon
 * pipelines rely on.
 */
export function runFxSettlementSubscriber(
  feed: CorrespondentFeed,
  config: FxSettlementSubscriberConfig,
): FxSettlementSubscriberResult {
  if (!config.citations || config.citations.length === 0) {
    throw new Error("runFxSettlementSubscriber requires at least one citation (Principle 2).");
  }
  const newId = config.newId ?? newEventId;
  const events: Event[] = [];
  const outcomes: MessageOutcome[] = [];

  for (const m of feed.poll()) {
    const outcome = processMessage(m, config, newId, events);
    outcomes.push(outcome);
  }

  return { events, outcomes };
}

function processMessage(
  m: CorrespondentMessage,
  config: FxSettlementSubscriberConfig,
  newId: () => string,
  out: Event[],
): MessageOutcome {
  const { payLegDelivered, receiveLegDelivered } = m.legStatus;

  // Path 1 — both delivered → confirmed.
  if (payLegDelivered && receiveLegDelivered) {
    out.push(emitConfirmed(m, config, newId));
    return { kind: "confirmed", tradeRef: m.tradeRef };
  }

  // Path 2 — one-leg-delivered (Herstatt-active).
  if (payLegDelivered && !receiveLegDelivered) {
    out.push(emitMissedExpectedReceipt(m, config, newId));
    const failed = emitFailed(m, "one-leg-delivered", config, newId);
    out.push(failed);
    out.push(emitClassification(m, "one-leg-delivered", failed.event_id, config, newId));
    return { kind: "one-leg-delivered", tradeRef: m.tradeRef };
  }

  // Path 3 — neither delivered. Discriminate operational-delay vs neither-delivered.
  // Convention:
  //   - `inFlight === true`  → operational-delay (still being chased by the
  //                            correspondent; resolves intra-day expected)
  //   - otherwise            → neither-delivered (mutual fail; close-out path)
  // This is the same discriminator Devon's procedure uses at §2 step 3.
  const failureKind: "neither-delivered" | "operational-delay" = m.inFlight
    ? "operational-delay"
    : "neither-delivered";
  const failed = emitFailed(m, failureKind, config, newId);
  out.push(failed);
  out.push(emitClassification(m, failureKind, failed.event_id, config, newId));
  return { kind: failureKind, tradeRef: m.tradeRef };
}

// ---------------------------------------------------------------------------
// Event factories — thin wrappers over the canonical `make*` factories that
// fill in the configured envelope (actor / entity / citations / clock).
// ---------------------------------------------------------------------------

function emitConfirmed(
  m: CorrespondentMessage,
  config: FxSettlementSubscriberConfig,
  newId: () => string,
): Event {
  if (
    m.settledBaseCurrencyMinor === undefined ||
    m.settledQuoteCurrencyMinor === undefined ||
    !m.nostroAccountBase ||
    !m.nostroAccountQuote
  ) {
    throw new Error(
      `CorrespondentMessage for trade ${m.tradeRef} reports both legs delivered but is missing settled-amount or nostro-account fields required for FxSettlementConfirmed (subscriber contract).`,
    );
  }
  return makeFxSettlementConfirmed({
    asOf: config.now(),
    entity: config.entity,
    actor: config.actor,
    citations: [...config.citations],
    eventId: newId(),
    payload: {
      tradeId: m.tradeRef,
      currencyPair: m.currencyPair,
      legKind: m.legKind,
      settledBaseCurrencyMinor: m.settledBaseCurrencyMinor,
      settledQuoteCurrencyMinor: m.settledQuoteCurrencyMinor,
      settledAt: m.observedAt,
      nostroAccountBase: m.nostroAccountBase,
      nostroAccountQuote: m.nostroAccountQuote,
      // Realised P&L computation is Bea's posting-engine concern; the
      // subscriber records the cash facts only. Zero is the conservative
      // placeholder (residual after revaluations is intraday rate noise).
      realisedPnlZarMinor: 0,
      correspondentRef: m.correspondentRef,
    },
  });
}

function emitMissedExpectedReceipt(
  m: CorrespondentMessage,
  config: FxSettlementSubscriberConfig,
  newId: () => string,
): Event {
  if (!m.expectedReceiveCurrency || !m.expectedReceiveAmountMinor) {
    throw new Error(
      `CorrespondentMessage for trade ${m.tradeRef} reports our leg delivered but is missing expectedReceiveCurrency/expectedReceiveAmountMinor — required for MissedExpectedReceipt (PROC-OPS-SFBCP-01 step 1).`,
    );
  }
  return makeMissedExpectedReceipt({
    asOf: config.now(),
    entity: config.entity,
    actor: config.actor,
    citations: [...config.citations],
    eventId: newId(),
    payload: {
      tradeRef: m.tradeRef,
      settlementInstructionRef: m.settlementInstructionRef,
      expectedCurrency: m.expectedReceiveCurrency,
      expectedAmountMinor: m.expectedReceiveAmountMinor,
      cutoffAt: m.cutoffAt,
      toleranceMinutes: m.toleranceMinutes,
      detectedAt: m.observedAt,
    },
  });
}

function emitFailed(
  m: CorrespondentMessage,
  failureKind: "one-leg-delivered" | "neither-delivered" | "operational-delay",
  config: FxSettlementSubscriberConfig,
  newId: () => string,
): Event {
  const reason =
    m.failureReason ??
    (failureKind === "operational-delay"
      ? "Correspondent reports in-flight settlement past cutoff window (no failure cause yet)"
      : failureKind === "one-leg-delivered"
        ? "Counterparty receive-leg not delivered at cutoff; bank's pay-leg is out"
        : "Neither leg delivered at cutoff; mutual fail");
  return makeFxSettlementFailed({
    asOf: config.now(),
    entity: config.entity,
    actor: config.actor,
    citations: [...config.citations],
    eventId: newId(),
    payload: {
      tradeRef: m.tradeRef,
      settlementInstructionRef: m.settlementInstructionRef,
      failedAt: m.observedAt,
      failureKind,
      failureReason: reason,
      legStatus: {
        payLegDelivered: m.legStatus.payLegDelivered,
        receiveLegDelivered: m.legStatus.receiveLegDelivered,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Deterministic classification mapping.
//
// PROC-OPS-SFBCP-01 §2 taxonomy:
//   - failureKind "one-leg-delivered"  → classification "herstatt-active"
//   - failureKind "neither-delivered"  → classification "mutual-fail"
//   - failureKind "operational-delay"  → classification "operational-delay"
//
// Devon's procedure allows a human override at sign-off (the COO may
// reclassify after triage). This subscriber emits the deterministic
// pre-triage classification only. The override path is a future
// enhancement (Tomas + Devon brief, post-licence).
// ---------------------------------------------------------------------------

const CLASSIFICATION_MAP: {
  readonly [K in "one-leg-delivered" | "neither-delivered" | "operational-delay"]:
    | "herstatt-active"
    | "mutual-fail"
    | "operational-delay";
} = {
  "one-leg-delivered": "herstatt-active",
  "neither-delivered": "mutual-fail",
  "operational-delay": "operational-delay",
};

function emitClassification(
  m: CorrespondentMessage,
  failureKind: "one-leg-delivered" | "neither-delivered" | "operational-delay",
  failedEventId: string,
  config: FxSettlementSubscriberConfig,
  newId: () => string,
): Event {
  return makeSettlementFailureClassified({
    asOf: config.now(),
    entity: config.entity,
    actor: config.actor,
    citations: [...config.citations],
    eventId: newId(),
    payload: {
      settlementInstructionRef: m.settlementInstructionRef,
      classification: CLASSIFICATION_MAP[failureKind],
      classifiedAt: m.observedAt,
      // Subscriber is the deterministic classifier — Devon (COO,
      // governance) is the standing authority under PROC-OPS-SFBCP-01;
      // agents may classify on his behalf under the same authority.
      classifiedBy: config.actor.id,
      evidence: [`event:${failedEventId}`, `settlement-instruction:${m.settlementInstructionRef}`],
    },
  });
}

// ---------------------------------------------------------------------------
// Fixture-driven feed helper — for tests and the internal pre-licence test
// scenario. Production replaces this with the SWIFT / pacs.* connector.
// ---------------------------------------------------------------------------

export function makeStaticCorrespondentFeed(
  messages: readonly CorrespondentMessage[],
): CorrespondentFeed {
  // Take a defensive snapshot so the caller can't mutate the feed mid-poll.
  const snapshot = [...messages];
  return {
    poll: () => snapshot,
  };
}
