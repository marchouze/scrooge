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

import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import {
  type SettledCashLeg,
  buildFxTerminatedPayload,
  buildSettledCashPayloads,
  buildTradeSettlementPayloads,
} from "../../../v2-core/fil-instances/cash-materialisation";
import type { ProvenanceTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import { type CashSink, EventStoreCashSink } from "./cash-sink";

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = ENTITY;
const CITATIONS = [
  "D-FX-V2-SIMULATOR-FIRST",
  "D-CASH-ASSET-CLASS-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
];
const SETTLEMENT_CITATIONS = [
  "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL",
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
  /**
   * Count of NEW `TradeSettlementExecuted` settlement-of-record events emitted
   * (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 2). FX spot ⇒ 2 (received + paid).
   */
  readonly settlementsExecuted: number;
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
  /**
   * OPTIONAL explicit provenance for the materialised cash legs + FX termination.
   * Defaults to the active category policy (the normal SUT/production path). The
   * LIVE simulator passes a `simulated` tag so the cash it materialises is
   * provenance-segregated in the shared store (V1 `provenanceMode` parity).
   */
  readonly provenance?: ProvenanceTag;
}): SettleFxResult {
  const { store, scenarioId, reporting, tradeId, provenance } = args;

  // Gate: the trade must have a confirmed settlement (external fact).
  const confirmed = [...store.replay({ type: "FxSimSettlementConfirmed" })].find(
    (e) => (e.payload as { tradeId?: string }).tradeId === tradeId,
  );
  if (!confirmed) {
    return {
      settled: false,
      cashInstancesMaterialised: 0,
      fxTerminated: false,
      settlementsExecuted: 0,
    };
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
  const sink: CashSink = new EventStoreCashSink(store, undefined, provenance);

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

  // Resolve the bookType from the originating FxTradeExecuted (Approach A:
  // source-don't-hardcode, Charter cmd 4). The settled cash IS a trading- or
  // banking-book position depending on the originating trade's desk. Fail-closed:
  // if the FxTradeExecuted event is absent (should not happen for a settled trade)
  // or carries no bookType (pre-M4 event), the field is omitted and the BA 100
  // fold will place on C0040 only + emit a loud gap (never a guessed column).
  // Authority: D-FX-BOOK-BOUNDARY; D-FRTB-TRADING-DESK-STRUCTURE.
  const fxTrade = [...store.replay({ type: "FxTradeExecuted" })].find(
    (e) => (e.payload as { tradeId?: string }).tradeId === tradeId,
  );
  const resolvedBookType = (
    fxTrade?.payload as { bookType?: "trading" | "banking-treasury" } | undefined
  )?.bookType;

  const materialisationInput = {
    tradeId,
    tenant: TENANT,
    reporting,
    counterpartyId: c.counterpartyId,
    nettingSetId,
    settledAsOf,
    fxInstance,
    legs,
    originatingEvent,
    // FX spot settlement is routed via a correspondent / sponsor bank (indirect-
    // participant model — no direct CLS/SAMOS). The settled nostro cash balance
    // is therefore a "bank" counterparty-class position (Reg 26), which places it
    // on BA 100 R0120 (primary) + R0910 / R1050 (memo). If the settlement-agent
    // identity is ever resolved to SARB directly, upgrade to "central-bank".
    // Authority: D-BA-RETURN-CAPABILITY-FIRST; D-BA-RETURN-PER-PRODUCT-RICHNESS.
    counterpartyClass: "bank" as const,
    // Propagate bookType from the FxTradeExecuted so the settled cash instrument
    // carries the FRTB book designation and the BA 100 fold can split C0010/C0020.
    // Omitted (undefined) when the trade event is absent or pre-dates M4 — the
    // fold then places on C0040 only + flags (fail-closed, Charter cmd 2).
    ...(resolvedBookType !== undefined ? { bookType: resolvedBookType } : {}),
  };
  const builtLegs = buildSettledCashPayloads(materialisationInput);

  // Slice 2 (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL): emit the born-V2 single-asset
  // `TradeSettlementExecuted` settlement-of-record FIRST (one per settled leg —
  // spot ⇒ 2), then materialise the holding-at-cost via `buildSettledCashPayloads`.
  // Both are built from ONE grammar (the shared materialisation input), idempotent
  // on the deterministic holding URN. The settlement event is the explicit recorded
  // fact (Principle 1); the GL fold derives its legs from it (dual-read with the
  // historical FilFxSettlementConfirmed).
  let settlementsExecuted = 0;
  for (const settle of buildTradeSettlementPayloads(materialisationInput)) {
    if (sink.hasSettlement(settle.instance)) continue;
    sink.appendSettlement({
      asOf: settledAsOf,
      entity: ENTITY,
      citations: SETTLEMENT_CITATIONS,
      eventId: `${scenarioId}:${tradeId}:settle-${sideOf(settle.instance)}`,
      payload: settle.payload,
    });
    settlementsExecuted += 1;
  }

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

  return {
    settled: true,
    cashInstancesMaterialised: materialised,
    fxTerminated,
    settlementsExecuted,
  };
}

/** Recover the `received`/`paid` side suffix from a cash-instance URN for the
 * deterministic, replay-stable scenario event-id. */
function sideOf(cashInstanceUrn: string): "received" | "paid" {
  return cashInstanceUrn.endsWith("-received") ? "received" : "paid";
}
