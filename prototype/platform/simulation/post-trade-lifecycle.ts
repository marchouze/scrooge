// platform/simulation/post-trade-lifecycle.ts
//
// Post-trade event chain for FX sim trades.
//
// After a simulated FxTradeExecuted fires, this module emits the full
// production-equivalent event chain:
//   1. FxSettlementInstructed (pay leg)
//   2. FxSettlementInstructed (receive leg)
//   3. PrincipalPayment (deliver leg)
//   4. PrincipalPayment (receive leg)
//   5. SettlementConfirmed
//   6. OutboundMessageDispatched (MT300)
//   7. InboundMessageReceived + MessageCorrelated (inbound messages)
//
// CEO directive: sim trades must fire every event a production trade would fire.
//
// Authority: D-FX-CLS-MEMBERSHIP; D-MARKETS-SCHEMA-FOUNDATION; D-FX-AD-STATUS;
//   D-FX-MESSAGE-EVENTS.
// Author: Devon (Chief Operating Officer, engineering)

import { newEventId, nowUtc } from "../core/types";
import type { OfficialMarkAdoptedPayload } from "../event-store/event-types/valuation";
import { makeInboundMessageReceived } from "../event-store/event-types/payments";
import type { EventStore } from "../event-store/store";
import {
  makeFxSettlementInstructed,
  makePrincipalPayment,
  makeSettlementConfirmed,
} from "../markets/cdm/fx";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { baseAmountMinor } from "../markets/cdm/fx-helpers";
import { simulateInboundMessages } from "../payments/inbound-simulator";
import { generateAndEmitMt300 } from "../payments/swift-mt/mt300";
import type { CounterpartyBehaviorProfile } from "./env-sim/counterparty-profiles";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CITATIONS = ["D-FX-CLS-MEMBERSHIP", "D-MARKETS-SCHEMA-FOUNDATION", "D-FX-AD-STATUS"];
const ACTOR = { type: "service" as const, id: "agent:devon:fx-sim-engine" };
const ENTITY = "LE-ZA-HOZ-BANK";

const SIM_CORRESPONDENT = {
  partyId: "CORRESPONDENT-BANK-001",
  name: "SimulatedCorrespondent Bank",
  role: "settlement-agent" as const,
  jurisdiction: "ZA",
};

// ---------------------------------------------------------------------------
// runPostTradeLifecycle
// ---------------------------------------------------------------------------

/**
 * Emit the full post-trade production event chain for a sim trade.
 *
 * This is the canonical production chain for FX Spot: 2x FxSettlementInstructed
 * + 2x PrincipalPayment + 1x SettlementConfirmed + outbound MT300 + inbound
 * message set.
 *
 * @param store                       The event store to append events to.
 * @param trade                       The FxTradeExecutedPayload from the sim trade.
 * @param asOf                        ISO 8601 timestamp for all emitted events.
 * @param bankBic                     The bank's own SWIFT BIC (e.g. "BANKZAJJXXX").
 * @param counterpartyBic             The counterparty's SWIFT BIC.
 * @param profileForCounterparty      Optional callback returning the behavior profile for a given partyId.
 * @param rng                         Optional seeded PRNG. Defaults to Math.random.
 */
export function runPostTradeLifecycle(
  store: EventStore,
  trade: FxTradeExecutedPayload,
  asOf: string,
  bankBic: string,
  counterpartyBic: string,
  profileForCounterparty?: (partyId: string) => CounterpartyBehaviorProfile | undefined,
  rng?: () => number,
): void {
  const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
  if (!nearLeg) {
    throw new Error("[post-trade-lifecycle] trade has no legs");
  }

  const payCurrency = nearLeg.payCurrency;
  const receiveCurrency = nearLeg.receiveCurrency;
  const payNotionalMinor = -Math.abs(nearLeg.notional.amountMinor);
  const receiveNotionalMinor = Math.abs(nearLeg.counterNotional.amountMinor);
  const currencyPairStr = `${trade.currencyPair.base}/${trade.currencyPair.quote}`;
  const tradeIdValue = trade.tradeId.value;

  // Resolve stochastic parameters.
  const rand = rng ?? Math.random;
  const profile = profileForCounterparty?.(trade.counterparty.partyId);

  // T+2 settlement date + optional delay days from profile.
  const baseSettlementIso = nearLeg.settlementDate?.iso ?? addTwoCalendarDays(trade.tradeDate.iso);
  const delayDays = profile?.settlementDelayDays ?? 0;
  const settlementDateIso =
    delayDays > 0 ? addCalendarDays(baseSettlementIso, delayDays) : baseSettlementIso;

  // Stochastic rejection branch: skip PrincipalPayments + SettlementConfirmed.
  const isRejected = rand() < (profile?.rejectionProbability ?? 0);
  if (isRejected) {
    store.append(
      makeInboundMessageReceived({
        asOf,
        entity: ENTITY,
        actor: { type: "service" as const, id: "agent:env:counterparty-sim" },
        citations: CITATIONS,
        payload: {
          tradeId: tradeIdValue,
          messageId: `REJECTION-${tradeIdValue.slice(-12)}-${nowUtc()}`,
          messageStandard: "REJECTION",
          direction: "inbound",
          serialisedMessage: `Trade confirmation rejected by counterparty for trade ${tradeIdValue}`,
          senderBic: counterpartyBic,
          receivedAt: asOf,
          citations: CITATIONS,
        },
      }),
    );
    // Still emit settlement instructions but no payment/confirmation events.
  }

  // Stochastic settlement failure: checked later after PrincipalPayments.
  const isSettlementFailed = !isRejected && rand() < (profile?.settlementFailureProbability ?? 0);

  // -------------------------------------------------------------------------
  // 1. FxSettlementInstructed — pay leg (bank delivers payCurrency)
  // -------------------------------------------------------------------------
  store.append(
    makeFxSettlementInstructed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: trade.tradeId,
        legKind: "near",
        settlementId: { scheme: "INTERNAL", value: `STL-SIM-${tradeIdValue}-PAY` },
        settlementPath: "correspondent",
        settlementForm: "physical",
        correspondent: SIM_CORRESPONDENT,
        counterparty: trade.counterparty,
        netCash: { currency: payCurrency, amountMinor: payNotionalMinor },
        settlementDate: { iso: settlementDateIso, calendar: "JIHCAL" },
        messageStandard: "ISO-20022-pacs.009",
      },
      eventId: newEventId(),
    }),
  );

  // -------------------------------------------------------------------------
  // 2. FxSettlementInstructed — receive leg (bank receives receiveCurrency)
  // -------------------------------------------------------------------------
  store.append(
    makeFxSettlementInstructed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: trade.tradeId,
        legKind: "near",
        settlementId: { scheme: "INTERNAL", value: `STL-SIM-${tradeIdValue}-RCV` },
        settlementPath: "correspondent",
        settlementForm: "physical",
        correspondent: SIM_CORRESPONDENT,
        counterparty: trade.counterparty,
        netCash: { currency: receiveCurrency, amountMinor: receiveNotionalMinor },
        settlementDate: { iso: settlementDateIso, calendar: "JIHCAL" },
        messageStandard: "ISO-20022-pacs.009",
      },
      eventId: newEventId(),
    }),
  );

  // -------------------------------------------------------------------------
  // 3. PrincipalPayment — deliver leg (bank pays payCurrency)
  // Skip if trade was rejected by counterparty.
  // -------------------------------------------------------------------------
  if (!isRejected) {
    store.append(
      makePrincipalPayment({
        asOf: settlementDateIso,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: tradeIdValue,
          legKind: "deliver",
          currencyPair: currencyPairStr,
          currency: payCurrency,
          netCash: payNotionalMinor,
          settlementDate: settlementDateIso,
          settlementPath: "correspondent",
          correspondent: {
            name: SIM_CORRESPONDENT.name,
            bic: counterpartyBic,
          },
          settlementConfirmationRef: `CONF-SIM-${tradeIdValue}-DEL`,
          citations: CITATIONS,
        },
        eventId: newEventId(),
      }),
    );

    // -------------------------------------------------------------------------
    // 4. PrincipalPayment — receive leg (bank receives receiveCurrency)
    // -------------------------------------------------------------------------
    store.append(
      makePrincipalPayment({
        asOf: settlementDateIso,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: tradeIdValue,
          legKind: "receive",
          currencyPair: currencyPairStr,
          currency: receiveCurrency,
          netCash: receiveNotionalMinor,
          settlementDate: settlementDateIso,
          settlementPath: "correspondent",
          correspondent: {
            name: SIM_CORRESPONDENT.name,
            bic: counterpartyBic,
          },
          settlementConfirmationRef: `CONF-SIM-${tradeIdValue}-RCV`,
          citations: CITATIONS,
        },
        eventId: newEventId(),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // 5. SettlementConfirmed or SettlementFailed (stochastic)
  // -------------------------------------------------------------------------
  if (!isRejected && isSettlementFailed) {
    store.append(
      makeInboundMessageReceived({
        asOf: settlementDateIso,
        entity: ENTITY,
        actor: { type: "service" as const, id: "agent:env:counterparty-sim" },
        citations: CITATIONS,
        payload: {
          tradeId: tradeIdValue,
          messageId: `SETTLEMENT-FAILED-${tradeIdValue.slice(-12)}`,
          messageStandard: "SETTLEMENT-FAILED",
          direction: "inbound",
          serialisedMessage: `Settlement failed — counterparty did not deliver for trade ${tradeIdValue}`,
          senderBic: counterpartyBic,
          receivedAt: settlementDateIso,
          citations: CITATIONS,
        },
      }),
    );
  } else if (!isRejected) {
    // -------------------------------------------------------------------------
    // Compute realised P&L per IAS 21 §28: (r_settle − r_book) × N_base_minor.
    // Settlement rate: look for the latest OfficialMarkAdopted for the pair on
    // the settlement date; fall back to book rate (zero P&L) with a substrate
    // warning if no mark is available.
    //
    // Authority: IAS 21 §28; PR-FX-LIFECYCLE-CLOSE; D-FX-QUOTING-CONVENTION.
    // -------------------------------------------------------------------------
    const nearLegForPnl = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
    const bookRate = nearLegForPnl?.rate.amount ?? 0;
    const notionalBaseMinor = nearLegForPnl ? baseAmountMinor(nearLegForPnl, trade.currencyPair) : 0;

    // Look up the latest OfficialMarkAdopted for this pair on/before the settlement date.
    let settlementRate = bookRate;
    let latestMarkAsOf = "";
    try {
      for (const e of store.replay({ type: "OfficialMarkAdopted" })) {
        const m = e.payload as unknown as OfficialMarkAdoptedPayload;
        if (
          m.markType === "fx-rate" &&
          m.instrumentKey === currencyPairStr &&
          m.markAsOf.slice(0, 10) <= settlementDateIso
        ) {
          if (m.markAsOf > latestMarkAsOf) {
            latestMarkAsOf = m.markAsOf;
            settlementRate = parseFloat(m.mark);
          }
        }
      }
    } catch {
      // OfficialMarkAdopted not yet in store — fall back to book rate.
    }

    if (!latestMarkAsOf) {
      // No official mark found — substrate gap; log and use zero P&L.
      console.warn(
        `[post-trade-lifecycle] No OfficialMarkAdopted found for ${currencyPairStr} on/before ${settlementDateIso}; realisedPnlDelta=0 (book-rate fallback, IAS 21 §28).`,
      );
    }

    // IAS 21 §28: bank long base (buy) gains when settlement rate > book rate.
    const isBuy = trade.side === "buy";
    const rateDelta = settlementRate - bookRate;
    const realisedPnlDelta = Math.round((isBuy ? 1 : -1) * rateDelta * Math.abs(notionalBaseMinor));

    store.append(
      makeSettlementConfirmed({
        asOf: settlementDateIso,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: tradeIdValue,
          currencyPair: currencyPairStr,
          settledDate: settlementDateIso,
          realisedPnlDelta,
          settlementRef: `SWIFT-CONF-SIM-${tradeIdValue.slice(-12)}`,
          citations: CITATIONS,
        },
        eventId: newEventId(),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // 6. Outbound MT300 — bank sends FX confirmation to counterparty
  // -------------------------------------------------------------------------
  const outboundMt300 = generateAndEmitMt300(store, trade, bankBic, counterpartyBic, asOf);
  const outboundMessageId =
    outboundMt300.block4.find((f) => f.tag === "20")?.value ?? tradeIdValue.slice(-16);

  // -------------------------------------------------------------------------
  // 7. Inbound messages — correspondent/counterparty messages back
  // -------------------------------------------------------------------------
  const settlementDateObj = new Date(settlementDateIso);
  const nostroBalance = BigInt(Math.abs(nearLeg.counterNotional.amountMinor)) + 10_000_000_00n;

  simulateInboundMessages(
    trade,
    settlementDateObj,
    nostroBalance,
    counterpartyBic,
    undefined,
    undefined,
    {
      store,
      asOf,
      outboundMessageId,
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Add 2 calendar days to an ISO date string (YYYY-MM-DD). */
function addTwoCalendarDays(isoDate: string): string {
  return addCalendarDays(isoDate, 2);
}

/** Add N calendar days to an ISO date string (YYYY-MM-DD). */
function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
