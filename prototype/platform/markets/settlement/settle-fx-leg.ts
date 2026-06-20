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
// received foreign leg + the paid funding leg. The cash-instance + FX-termination
// GRAMMAR is now the ONE shared store-agnostic builder
// (`v2-core/fil-instances/cash-materialisation.ts`, Slice 0), so the scenario-
// store instrument-of-record is byte-identical to the live/backfill one
// (Principle 1; no fork). This seam routes the built payloads to an
// `EventStoreCashSink` (the scenario EventStore via the registered born-V2
// factory); the production path routes the SAME payloads to an `AnchorDbCashSink`.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION; D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type SettledCashLeg,
  buildFxTerminatedPayload,
  buildSettledCashPayloads,
} from "../../../v2-core/fil-instances/cash-materialisation";
import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import type { EventStore } from "../../event-store/store";
import { type CashSink, EventStoreCashSink } from "./cash-sink";

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = ENTITY;
const CITATIONS = [
  "D-FX-V2-SIMULATOR-FIRST",
  "D-CASH-ASSET-CLASS-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
];

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
  const originatingEvent = {
    eventType: "FxSimSettlementConfirmed" as const,
    eventId: confirmed.event_id,
  };

  // The scenario routes the SHARED grammar's payloads to an EventStore sink. The
  // production path routes the SAME payloads to an AnchorDbCashSink (Slice 0).
  const sink: CashSink = new EventStoreCashSink(store);

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

  const builtLegs = buildSettledCashPayloads({
    tradeId,
    tenant: TENANT,
    reporting,
    counterpartyId: c.counterpartyId,
    nettingSetId,
    settledAsOf,
    fxInstance,
    legs,
    originatingEvent,
  });

  let materialised = 0;
  for (const built of builtLegs) {
    if (sink.hasCreated(built.instance)) continue;
    sink.appendCreated({
      asOf: settledAsOf,
      entity: ENTITY,
      citations: CITATIONS,
      // Replay-stable scenario event-id keyed on the leg side (in the URN suffix).
      eventId: `${scenarioId}:${tradeId}:cash-${sideOf(built.instance)}`,
      payload: built.payload,
    });
    materialised += 1;
  }

  // Terminate the originating FX instrument (settled) — idempotent via the sink.
  let fxTerminated = false;
  const fxCreated = [...store.replay({ type: "FilInstrumentCreated" })].find(
    (e) => (e.payload as { instance?: string }).instance === fxInstance,
  );
  if (fxCreated && !sink.hasTerminated(fxInstance)) {
    const fxType = (fxCreated.payload as { type?: string }).type ?? "";
    sink.appendTerminated({
      asOf: settledAsOf,
      entity: ENTITY,
      citations: CITATIONS,
      eventId: `${scenarioId}:${tradeId}:fx-terminated`,
      payload: buildFxTerminatedPayload({
        fxInstance,
        fxTypeUrn: fxType,
        tenant: TENANT,
        settledAsOf,
        originatingEvent,
      }),
    });
    fxTerminated = true;
  }

  return { settled: true, cashInstancesMaterialised: materialised, fxTerminated };
}

/** Recover the `received`/`paid` side suffix from a cash-instance URN for the
 * deterministic, replay-stable scenario event-id. */
function sideOf(cashInstanceUrn: string): "received" | "paid" {
  return cashInstanceUrn.endsWith("-received") ? "received" : "paid";
}
