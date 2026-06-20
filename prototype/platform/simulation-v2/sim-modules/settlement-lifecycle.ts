// platform/simulation-v2/sim-modules/settlement-lifecycle.ts
//
// M5 — settlement-lifecycle seam (SIMULATOR side). Models the outside world's
// settlement behaviour for an affirmed FX trade: the correspondent/counterparty
// acting on the bank's settlement instruction, with explicit failure/retry
// branching driven by a deterministic counterparty behaviour profile.
//
// This module emits ONLY the EXTERNAL party's settlement statuses
// (`FxSimSettlementInstructed`, `FxSimSettlementFailed`, `FxSimSettlementConfirmed`),
// tagged `simulated`, born V2, scenario-bound. The bank's OWN settlement action —
// materialising the settled cash leg as a `fil:type:cash` instrument-of-record,
// terminating the FX instrument, nostro reconciliation — is SUT-internal and
// lives in platform/markets/settlement/settle-fx-leg.ts.
//
// DETERMINISM: the fail/retry draw is taken from the scenario's SeededRng (never
// Math.random — recon:fx-v2-sim-boundary enforces). The behaviour profile
// selects the per-attempt failure probability; the simulator retries until a leg
// clears or the retry budget is exhausted (a fully-failed trade emits no
// confirmation, so the SUT materialises no cash — fail-closed).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1; D-MARKETS-SCHEMA-FOUNDATION (counterparty profiles).
// Author: Atlas (Core banking platform architect, engineering).

import {
  makeFxSimSettlementConfirmed,
  makeFxSimSettlementFailed,
  makeFxSimSettlementInstructed,
} from "../../event-store/event-types/fx-settlement-lifecycle";
import { simulatedTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { SeededRng } from "../prng";
import type { CounterpartyBehaviourProfileId, ScenarioTradeAction } from "../scenario-manifest";

const ENTITY = "LE-ZA-HOZ-BANK";
const SIM_ACTOR = { type: "service" as const, id: "agent:env:fx-settlement-sim" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST", "D-CASH-ASSET-CLASS-V1"];

/** Max settlement attempts before the trade is abandoned (fail-closed). */
const MAX_SETTLEMENT_ATTEMPTS = 4;

/**
 * Per-attempt settlement-failure probability for each behaviour profile. Mirrors
 * the env-sim counterparty profiles (platform/simulation/env-sim/
 * counterparty-profiles.ts): reliable=0, slow=0, occasional-fail=0.05,
 * unreliable=0.10. Sourced here so the V2 simulator and the V1 env-sim agree.
 */
const FAILURE_PROBABILITY: Readonly<Record<CounterpartyBehaviourProfileId, number>> = {
  reliable: 0,
  slow: 0,
  "occasional-fail": 0.05,
  unreliable: 0.1,
};

function simProvenance(scenarioId: string) {
  return simulatedTag({
    scenario: scenarioId,
    sourceLineage: "simulation-v2:settlement-lifecycle",
  });
}

/** The pay/receive legs of a trade from the BANK's perspective. */
export interface FxSettlementLegs {
  readonly payCurrency: string;
  readonly payAmountMajor: number;
  readonly receiveCurrency: string;
  readonly receiveAmountMajor: number;
}

/**
 * Derive the bank's settled cash legs for a trade. A BUY of base at rate R: the
 * bank RECEIVES `baseNotional` of base, PAYS `baseNotional × R` of the quote
 * (reporting) currency. A SELL: opposite. The quote currency is the pair's quote
 * leg (reporting for a `<base>/<reporting>` pair).
 */
export function deriveSettlementLegs(
  trade: ScenarioTradeAction,
  reporting: string,
): FxSettlementLegs {
  const slash = trade.pair.indexOf("/");
  const base = slash > 0 ? trade.pair.slice(0, slash) : trade.pair;
  const quote = slash > 0 ? trade.pair.slice(slash + 1) : reporting;
  const quoteAmount = trade.baseNotionalMajor * trade.rate;
  if (trade.side === "buy") {
    return {
      receiveCurrency: base,
      receiveAmountMajor: trade.baseNotionalMajor,
      payCurrency: quote,
      payAmountMajor: quoteAmount,
    };
  }
  return {
    receiveCurrency: quote,
    receiveAmountMajor: quoteAmount,
    payCurrency: base,
    payAmountMajor: trade.baseNotionalMajor,
  };
}

export interface SettlementOutcome {
  readonly tradeId: string;
  /** Whether settlement was confirmed (false = abandoned after retries). */
  readonly confirmed: boolean;
  /** Number of failed attempts before confirmation (or abandonment). */
  readonly failedAttempts: number;
}

/**
 * SIMULATOR — drive the settlement lifecycle for one affirmed trade. Emits the
 * settlement instruction, then per attempt draws a failure from the SeededRng
 * against the profile's failure probability: a failure emits
 * `FxSimSettlementFailed` and retries; a success emits `FxSimSettlementConfirmed`
 * (with the settled legs) and stops. After MAX_SETTLEMENT_ATTEMPTS failures the
 * trade is abandoned (no confirmation — the SUT materialises no cash).
 *
 * `forceFirstFail` deterministically forces the FIRST attempt to fail (used to
 * guarantee the scenario exercises ≥1 fail-then-retry regardless of the draw).
 */
export function emitSettlementLifecycle(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly reporting: string;
  readonly trade: ScenarioTradeAction;
  readonly behaviourProfile: CounterpartyBehaviourProfileId;
  readonly rng: SeededRng;
  readonly forceFirstFail?: boolean;
}): SettlementOutcome {
  const { store, scenarioId, asOf, reporting, trade, behaviourProfile, rng, forceFirstFail } =
    args;
  const provenance = simProvenance(scenarioId);
  const base = {
    tradeId: trade.tradeId,
    counterpartyId: trade.counterpartyId,
    settlementDate: trade.settlementDate,
    channel: "MT202" as const,
  };

  // The bank issues the settlement instruction (external party's view of receipt).
  store.append(
    makeFxSimSettlementInstructed({
      asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      payload: base,
      eventId: `${scenarioId}:${trade.tradeId}:settle-instructed`,
      provenance,
    }),
  );

  const failProb = FAILURE_PROBABILITY[behaviourProfile];
  const legs = deriveSettlementLegs(trade, reporting);
  let failedAttempts = 0;

  for (let attempt = 0; attempt < MAX_SETTLEMENT_ATTEMPTS; attempt++) {
    const forcedFail = attempt === 0 && forceFirstFail === true;
    // Deterministic Bernoulli draw from the seeded RNG (never Math.random).
    const fails = forcedFail || rng.bernoulli(failProb);

    if (fails) {
      store.append(
        makeFxSimSettlementFailed({
          asOf,
          entity: ENTITY,
          actor: SIM_ACTOR,
          citations: CITATIONS,
          payload: {
            ...base,
            reason: forcedFail
              ? "correspondent-nostro-shortfall-forced"
              : "correspondent-settlement-fail",
            attempt,
          },
          eventId: `${scenarioId}:${trade.tradeId}:settle-failed-${attempt}`,
          provenance,
        }),
      );
      failedAttempts += 1;
      continue;
    }

    // Success — confirm settlement with the settled legs.
    store.append(
      makeFxSimSettlementConfirmed({
        asOf,
        entity: ENTITY,
        actor: SIM_ACTOR,
        citations: CITATIONS,
        payload: {
          ...base,
          attempt,
          payCurrency: legs.payCurrency,
          payAmountMajor: legs.payAmountMajor,
          receiveCurrency: legs.receiveCurrency,
          receiveAmountMajor: legs.receiveAmountMajor,
        },
        eventId: `${scenarioId}:${trade.tradeId}:settle-confirmed`,
        provenance,
      }),
    );
    return { tradeId: trade.tradeId, confirmed: true, failedAttempts };
  }

  // Exhausted the retry budget — abandoned (no confirmation).
  return { tradeId: trade.tradeId, confirmed: false, failedAttempts };
}
