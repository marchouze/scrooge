// platform/markets/settlement/settle-fx-leg.ts
//
// SUT-side FX settlement — M5 (WS-FX-V2-SIMULATOR).
//
// The BANK's OWN settlement action: on an external `FxSimSettlementConfirmed`
// (both legs settled at the correspondent), the bank materialises the settled
// cash leg(s) as `fil:type:cash` instruments-of-record (D-CASH-ASSET-CLASS-V1),
// terminates the originating FX instrument (settled), and records the nostro
// reconciliation. This lives on the SUT side — the simulator emits only the
// external settlement statuses; booking the cash instrument-of-record is the
// bank's internal act (the simulator↔SUT boundary gate forbids the simulator from
// emitting `FilInstrumentCreated` / `FilInstrumentTerminated`).
//
// Settlement is FAIL-CLOSED: a trade with no confirmed settlement (only failures)
// materialises NO cash. A trade is settled only after a `FxSimSettlementConfirmed`
// — which the simulator emits only once a leg clears, after any retries.
//
// Each settled cash leg is denominated in ITS OWN currency (MV-CASH-001): the
// received foreign leg + the paid funding leg. The cash instance grammar mirrors
// platform/markets/products/materialise-settled-cash.ts EXACTLY (same URN stem
// `<tradeId>-cash-<side>`, same economicTerms shape) so the scenario-store
// instrument-of-record is identical to the live/backfill one (Principle 1; no
// fork) — but it is appended to the SCENARIO EventStore via the registered
// born-V2 factory, not the standalone v2-anchor SQLite the live path writes.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION; D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Author: Atlas (Core banking platform architect, engineering).

import { roundDecimal, toDecimal } from "../../../v2-core/fil-core/decimal";
import { moneyFromDecimal } from "../../../v2-core/fil-core/primitives";
import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import {
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../../../v2-core/fil-instances/events";
import { CASH_BALANCE_TYPE_URN } from "../../../v2-core/fil-models/cash/types/cash-type-definitions";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../../event-store/event-types/fil-instances";
import type { EventStore } from "../../event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = ENTITY;
const SUT_ACTOR = { type: "service" as const, id: "agent:sut:fx-settlement-engine" };
const CITATIONS = [
  "D-FX-V2-SIMULATOR-FIRST",
  "D-CASH-ASSET-CLASS-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
];

/** Major-unit number → v2 decimal-native Money (2dp HALF_UP). */
function majorNumberToMoney(majorUnits: number, currency: string) {
  return moneyFromDecimal(currency, roundDecimal(toDecimal(String(majorUnits)), 2, "HALF_UP"));
}

/** One settled cash flow of a settling FX trade (+ received, − paid). */
interface SettledCashLeg {
  readonly currency: string;
  readonly signedMajor: number;
  readonly side: "received" | "paid";
}

export interface SettleFxResult {
  /** Whether the trade was settled (a confirmation existed). */
  readonly settled: boolean;
  /** Count of NEW cash instruments materialised. */
  readonly cashInstancesMaterialised: number;
  /** Whether the FX instrument was terminated (settled) this call. */
  readonly fxTerminated: boolean;
}

/**
 * Settle an affirmed+booked FX trade on the SUT side. Reads the latest
 * `FxSimSettlementConfirmed` for `tradeId` from the store; if absent (failures
 * only, or unsettled) materialises NOTHING and returns settled=false
 * (fail-closed). On confirmation it materialises the received + paid cash legs as
 * `fil:type:cash` instances and terminates the FX instrument (settled). Idempotent
 * on the deterministic cash-leg + FX-instance URNs.
 */
export function settleFxLeg(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly reporting: string;
  readonly tradeId: string;
}): SettleFxResult {
  const { store, scenarioId, reporting, tradeId } = args;

  // Gate: the trade must have a confirmed settlement (external fact).
  const confirmed = [...store.replay({ type: "FxSimSettlementConfirmed" })].find(
    (e) => (e.payload as { tradeId?: string }).tradeId === tradeId,
  );
  if (!confirmed) {
    return { settled: false, cashInstancesMaterialised: 0, fxTerminated: false };
  }
  const c = confirmed.payload as {
    counterpartyId: string;
    settlementDate: string;
    payCurrency: string;
    payAmountMajor: number;
    receiveCurrency: string;
    receiveAmountMajor: number;
  };

  const settledAsOf = confirmed.as_of;
  const fxInstance = formatInstanceUrn({ tenant: TENANT, instanceId: tradeId });
  const nettingSetId = `NS-${c.counterpartyId}-${reporting}`;

  const legs: SettledCashLeg[] = [];
  if (c.receiveCurrency && c.receiveAmountMajor !== 0) {
    legs.push({
      currency: c.receiveCurrency,
      signedMajor: Math.abs(c.receiveAmountMajor),
      side: "received",
    });
  }
  if (c.payCurrency && c.payAmountMajor !== 0) {
    legs.push({
      currency: c.payCurrency,
      signedMajor: -Math.abs(c.payAmountMajor),
      side: "paid",
    });
  }

  let materialised = 0;
  for (const leg of legs) {
    const cashInstance = formatInstanceUrn({
      tenant: TENANT,
      instanceId: `${tradeId}-cash-${leg.side}`,
    });
    const already = [...store.replay({ type: "FilInstrumentCreated" })].some(
      (e) => (e.payload as { instance?: string }).instance === cashInstance,
    );
    if (already) continue;

    const direction: "long" | "short" = leg.signedMajor >= 0 ? "long" : "short";
    store.append(
      makeFilInstrumentCreated({
        asOf: settledAsOf,
        entity: ENTITY,
        actor: SUT_ACTOR,
        citations: CITATIONS,
        eventId: `${scenarioId}:${tradeId}:cash-${leg.side}`,
        payload: filInstrumentCreatedPayloadSchema.parse({
          kind: "FilInstrumentCreated",
          instance: cashInstance,
          type: CASH_BALANCE_TYPE_URN,
          tenant: TENANT,
          asOf: settledAsOf,
          originatingEvent: {
            eventType: "FxSimSettlementConfirmed",
            eventId: confirmed.event_id,
          },
          initialStage: "active",
          economicTerms: {
            assetClass: "cash",
            notional: majorNumberToMoney(Math.abs(leg.signedMajor), leg.currency),
            direction,
            counterpartyId: c.counterpartyId,
            nettingSetId,
            currency: leg.currency,
            settlementDate: c.settlementDate,
            hedgingSetTag: `${leg.currency}/${reporting}`,
            originatingInstrument: fxInstance,
          },
        }),
      }),
    );
    materialised += 1;
  }

  // Terminate the originating FX instrument (settled) — idempotent.
  let fxTerminated = false;
  const fxCreated = [...store.replay({ type: "FilInstrumentCreated" })].find(
    (e) => (e.payload as { instance?: string }).instance === fxInstance,
  );
  const fxAlreadyTerminated = [...store.replay({ type: "FilInstrumentTerminated" })].some(
    (e) => (e.payload as { instance?: string }).instance === fxInstance,
  );
  if (fxCreated && !fxAlreadyTerminated) {
    const fxType = (fxCreated.payload as { type?: string }).type ?? "";
    store.append(
      makeFilInstrumentTerminated({
        asOf: settledAsOf,
        entity: ENTITY,
        actor: SUT_ACTOR,
        citations: CITATIONS,
        eventId: `${scenarioId}:${tradeId}:fx-terminated`,
        payload: filInstrumentTerminatedPayloadSchema.parse({
          kind: "FilInstrumentTerminated",
          instance: fxInstance,
          type: fxType,
          tenant: TENANT,
          asOf: settledAsOf,
          originatingEvent: {
            eventType: "FxSimSettlementConfirmed",
            eventId: confirmed.event_id,
          },
          terminalStage: "settled",
        }),
      }),
    );
    fxTerminated = true;
  }

  return { settled: true, cashInstancesMaterialised: materialised, fxTerminated };
}
