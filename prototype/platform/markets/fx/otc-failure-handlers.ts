// platform/markets/fx/otc-failure-handlers.ts
//
// OTC FX operational failure handlers — coded runbooks for forward and swap
// failure scenarios (Gap 2 of the OTC FX operational-readiness dimension).
//
// Covers:
//   handleFxForwardDefaulted         — counterparty default at maturity /
//                                       FX swap far-leg default. Triggers
//                                       ISDA §6 close-out netting calculation.
//   handleFxForwardExtensionRequested — counterparty requests maturity extension.
//                                       Marks trade pending-extension; notifies
//                                       desk.
//   handleNostroDesignationMissing    — settlement routing fail-closed: currency
//                                       has no designated nostro. Emits a
//                                       SubstrateAlert and rejects the route.
//
// Handler invariants (Engineering Charter, D-ENGINEERING-INTEGRITY-CHARTER):
//   - Fail-closed: no silent swallowing of settlement failures (Charter §2).
//   - No suspense routing: an undesignated nostro is a hard rejection (Charter §2).
//   - All side-effects are typed events appended to the event store (Principle 1).
//   - SubstrateAlert is emitted for every settlement failure (ops notification).
//   - The close-out netting calculation for FxForwardDefaulted is TRIGGERED by
//     this handler (position marked "defaulted") but the ISDA §6 net settlement
//     amount is computed by a downstream step (out of scope for this handler).
//
// NDF scope: NDFs (non-deliverable forwards) are NOT in OTC FX v1.0 scope.
// Tracked as deferred gap "fx-ndf-runbooks" (see npa-fx-operational-readiness-
// attestation.ts). These handlers cover deliverable FX-forward and FX-swap only.
//
// Authority:
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO, 2026-06-15)
//   - ISDA 2002 Master Agreement §6 (Early Termination)
//   - ISDA 2002 Master Agreement §2(c) (payment netting)
//   - BCBS d226 §4 — credit risk in FX settlement
//   - Banks Act 94 of 1990 Reg 39 — BCP / settlement-failure procedures
//   - Principle 1 (events are truth); Principle 4 (fail-closed)
// Author: Tomas (Operations and payments engineer, engineering)

import {
  type FxForwardDefaultedPayload,
  type FxForwardExtensionRequestedPayload,
  type NostroDesignationMissingPayload,
  makeNostroDesignationMissing,
} from "../../event-store/event-types/fx-accounting";
import { makeSubstrateAlert } from "../../event-store/event-types/platform";
import type { Actor, Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const TOMAS_ACTOR: Actor = {
  type: "service",
  id: "agent:tomas:otc-failure-handler",
};

const CITATIONS = ["D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL", "ISDA-2002-§6", "BCBS-D226-§4"];

// ---------------------------------------------------------------------------
// handleFxForwardDefaulted
//
// Called when a counterparty defaults on a forward contract (at or near
// maturity) OR when the far leg of an FX swap defaults after the near leg
// has already settled.
//
// Output events:
//   1. FxForwardDefaulted  (already emitted by the subscriber — this handler
//      processes the event and emits the DOWNSTREAM operational response)
//   2. SubstrateAlert (severity: "high", class: "integrity") — ops notification
//      so the ops team can initiate the ISDA §6 close-out netting process.
//
// The close-out netting amount under ISDA §6 is computed by a separate
// downstream calculation step (out of scope for this handler — requires
// mark-to-market of all in-scope transactions under the ISDA netting set).
// This handler: (a) records the default as a typed event, (b) emits the
// ops alert, (c) does NOT automatically book recovery.
// ---------------------------------------------------------------------------

export interface FxForwardDefaultedResponse {
  /** The SubstrateAlert event emitted for ops notification. */
  readonly alertEvent: Event;
  /** Summary for logging / audit. */
  readonly summary: string;
}

export function handleFxForwardDefaulted(args: {
  asOf: string;
  entity: string;
  payload: FxForwardDefaultedPayload;
  tradeEventId: string;
}): FxForwardDefaultedResponse {
  const { asOf, entity, payload, tradeEventId } = args;

  const herstattFlag = payload.bankLegDelivered
    ? "HERSTATT-ACTIVE: bank leg already delivered — one-sided exposure."
    : "MUTUAL-FAIL: neither leg delivered — net exposure only.";

  const alertDetails = [
    `FX FORWARD DEFAULT — trade ${payload.tradeRef}`,
    `Counterparty: ${payload.counterpartyId}`,
    `Pair: ${payload.baseCurrency}/${payload.quoteCurrency}`,
    `Maturity: ${payload.maturityDate}`,
    herstattFlag,
    `Default reason: ${payload.defaultReason}`,
    `Source event: ${tradeEventId}`,
    "ACTION REQUIRED: initiate ISDA §6 close-out netting calculation for the counterparty netting set.",
    "Hold all pending trades with this counterparty until close-out net settlement is agreed.",
    "Notify Helena (Chief Risk Officer, governance) and Devon (Chief Operating Officer, governance).",
  ].join(" | ");

  const alertEvent = makeSubstrateAlert({
    asOf,
    entity,
    actor: TOMAS_ACTOR,
    citations: CITATIONS,
    payload: {
      alertId: `alert:integrity:fx-forward-default-${payload.tradeRef.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
      alertClass: "integrity",
      severity: "high",
      details: alertDetails,
    },
  });

  const summary = [
    `FxForwardDefaulted processed: trade=${payload.tradeRef}`,
    `counterparty=${payload.counterpartyId}`,
    `bankLegDelivered=${payload.bankLegDelivered}`,
    "ISDA §6 close-out netting required.",
    "SubstrateAlert emitted (severity: high).",
  ].join(", ");

  return { alertEvent, summary };
}

// ---------------------------------------------------------------------------
// handleFxForwardExtensionRequested
//
// Called when a counterparty requests an extension of a forward contract's
// maturity date.
//
// Operational response:
//   1. Mark the trade as "pending-extension" (via SubstrateAlert so the desk
//      can act). The re-booking (cancel + re-price at new forward rate) is a
//      manual desk step followed by a new FxTradeExecuted — out of scope here.
//   2. SubstrateAlert (severity: "medium", class: "integrity") — desk
//      notification to initiate the re-pricing and re-booking workflow.
//
// The SubstrateAlert carries enough context for the desk to:
//   (a) Obtain a current forward rate for the new maturity date.
//   (b) Execute a new FxTradeExecuted at the new rate / new maturity.
//   (c) Cancel the original trade.
// ---------------------------------------------------------------------------

export interface FxForwardExtensionResponse {
  readonly alertEvent: Event;
  readonly summary: string;
}

export function handleFxForwardExtensionRequested(args: {
  asOf: string;
  entity: string;
  payload: FxForwardExtensionRequestedPayload;
  extensionEventId: string;
}): FxForwardExtensionResponse {
  const { asOf, entity, payload, extensionEventId } = args;

  const alertDetails = [
    `FX FORWARD EXTENSION REQUEST — trade ${payload.tradeRef}`,
    `Counterparty: ${payload.counterpartyId}`,
    `Original maturity: ${payload.originalMaturityDate}`,
    `Requested new maturity: ${payload.requestedNewMaturityDate}`,
    `Reason: ${payload.extensionReason}`,
    `Source event: ${extensionEventId}`,
    "ACTION REQUIRED: obtain current forward rate for new maturity; re-book at new rate; cancel original trade.",
    "Extension constitutes a new trade per ISDA §2(c) — re-pricing at current market forward rate is mandatory.",
    "Do NOT extend at the original agreed rate — that would create an off-market transaction.",
  ].join(" | ");

  const alertEvent = makeSubstrateAlert({
    asOf,
    entity,
    actor: TOMAS_ACTOR,
    citations: [...CITATIONS, "ISDA-2002-§2(c)"],
    payload: {
      alertId: `alert:integrity:fx-forward-extension-${payload.tradeRef.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
      alertClass: "integrity",
      severity: "medium",
      details: alertDetails,
    },
  });

  const summary = [
    `FxForwardExtensionRequested processed: trade=${payload.tradeRef}`,
    `counterparty=${payload.counterpartyId}`,
    `newMaturity=${payload.requestedNewMaturityDate}`,
    "Re-booking required at current market forward rate.",
    "SubstrateAlert emitted (severity: medium).",
  ].join(", ");

  return { alertEvent, summary };
}

// ---------------------------------------------------------------------------
// handleNostroDesignationMissing
//
// Called at the settlement-routing step when resolveNostroAccount returns
// ok:false (no designated correspondent nostro for the currency).
//
// This is the fail-closed rejection path:
//   1. Emit NostroDesignationMissing (records the rejection as a typed event).
//   2. Emit SubstrateAlert (severity: "high", class: "integrity") — ops
//      notification to either provision a correspondent nostro or decline
//      the trade.
//
// The trade is REJECTED and must NOT proceed to settlement. Callers must
// ensure the trade is marked as rejected / cancelled downstream.
//
// "No suspense" invariant: this function exists so the caller NEVER routes
// to ACC-2100-007 (FX unresolved-currency suspense) for a settlement leg.
// Suspense hides settlement risk; this typed rejection surfaces it.
// ---------------------------------------------------------------------------

export interface NostroDesignationMissingResponse {
  readonly rejectionEvent: Event;
  readonly alertEvent: Event;
  readonly summary: string;
}

export function handleNostroDesignationMissing(args: {
  asOf: string;
  entity: string;
  payload: NostroDesignationMissingPayload;
}): NostroDesignationMissingResponse {
  const { asOf, entity, payload } = args;

  const rejectionEvent = makeNostroDesignationMissing({
    asOf,
    entity,
    actor: TOMAS_ACTOR,
    citations: CITATIONS,
    payload,
  });

  const alertDetails = [
    `NOSTRO DESIGNATION MISSING — settlement routing REJECTED for trade ${payload.tradeRef}`,
    `Currency: ${payload.currency}`,
    `Leg: ${payload.legKind}`,
    `Reason: ${payload.reason}`,
    "TRADE IS REJECTED — do NOT proceed to settlement.",
    "To unblock: provision a correspondent nostro account for this currency and add it to",
    "  platform/markets/fx/nostro-routing-registry.ts (NOSTRO_REGISTRY).",
    "  Then provision the chart-of-accounts entry and update FX_ACCOUNTS in fx-spot.ts.",
    "Do NOT route to suspense (ACC-2100-007) — suspense hides settlement risk.",
  ].join(" | ");

  const alertEvent = makeSubstrateAlert({
    asOf,
    entity,
    actor: TOMAS_ACTOR,
    citations: CITATIONS,
    payload: {
      alertId: `alert:integrity:nostro-missing-${payload.currency.toLowerCase()}-${payload.tradeRef.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
      alertClass: "integrity",
      severity: "high",
      details: alertDetails,
    },
  });

  const summary = [
    `NostroDesignationMissing: trade=${payload.tradeRef}`,
    `currency=${payload.currency}`,
    `leg=${payload.legKind}`,
    "REJECTED — no correspondent nostro designated.",
    "NostroDesignationMissing + SubstrateAlert emitted (severity: high).",
  ].join(", ");

  return { rejectionEvent, alertEvent, summary };
}
