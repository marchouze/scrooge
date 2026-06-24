// platform/simulation-v2/sim-modules/post-settlement-advice-v2.ts
//
// Born-V2 post-settlement external advices — the V2 analogue of the V1 hub's
// nostro-statement + correspondent-advice sub-simulators. After a leg settles, the
// outside world (the correspondent bank) sends the bank two external facts:
//   · CorrespondentSettlementStatusReceived (pacs.002 ACSC — funds settled), and
//   · NostroStatementReceived (camt.053 — the nostro account's closing balance).
//
// Both are EXTERNAL-party events (the correspondent acting on the bank) tagged via
// the `agent:env:*` actor ids, reusing the already-registered born-V2 factories in
// event-types/correspondent-settlement.ts. The bank's OWN reconciliation of these
// against its books is SUT-internal and out of scope here (the simulator emits only
// the inbound advice).
//
// REPLAY-SAFETY (recon:fx-v2-sim-boundary Rule C): no Math.random / Date.now /
// no-arg new Date(); everything derives from the injected `asOf` + the trade.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).

import {
  makeCorrespondentSettlementStatusReceived,
  makeNostroStatementReceived,
} from "../../event-store/event-types/correspondent-settlement";
import type { EventStore } from "../../event-store/store";
import type { ScenarioTradeAction } from "../scenario-manifest";

const ENTITY = "LE-ZA-HOZ-BANK";
const CORR_ACTOR = { type: "service" as const, id: "agent:env:correspondent-advice-sim" };
const NOSTRO_ACTOR = { type: "service" as const, id: "agent:env:nostro-statement-sim" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

/** The base currency of a `<base>/<quote>` pair. */
function baseOf(pair: string): string {
  const slash = pair.indexOf("/");
  return slash > 0 ? pair.slice(0, slash) : pair;
}

/**
 * Emit the two external post-settlement advices for a settled trade. Idempotent on
 * the deterministic event ids (a re-run appends nothing). Returns the count emitted.
 */
export function emitPostSettlementAdvice(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly trade: ScenarioTradeAction;
}): number {
  const { store, scenarioId, asOf, trade } = args;
  const corrId = `${scenarioId}:${trade.tradeId}:corr-status`;
  const nostroId = `${scenarioId}:${trade.tradeId}:nostro-stmt`;

  const already = (eventId: string): boolean =>
    [...store.replay({ type: "CorrespondentSettlementStatusReceived" })].some(
      (e) => e.event_id === eventId,
    );
  if (already(corrId)) return 0;

  const base = baseOf(trade.pair);
  // Statement closing balance in MINOR units of the base account. baseNotionalMajor
  // is an integer major unit (lot-aligned by the generator) — no Money-typed float.
  const closing = trade.baseNotionalMajor * 100;

  store.append(
    makeCorrespondentSettlementStatusReceived({
      asOf,
      entity: ENTITY,
      actor: CORR_ACTOR,
      citations: CITATIONS,
      eventId: corrId,
      payload: {
        originalMsgId: `${trade.tradeId}-pacs009`,
        txStatus: "ACSC",
      },
    }),
  );
  store.append(
    makeNostroStatementReceived({
      asOf,
      entity: ENTITY,
      actor: NOSTRO_ACTOR,
      citations: CITATIONS,
      eventId: nostroId,
      payload: {
        accountId: `NOSTRO-${base}-CORRESPONDENT-001`,
        asOf: asOf.slice(0, 10),
        closingBalance: closing,
        currency: base,
        entryCount: 1,
      },
    }),
  );
  return 2;
}
