// platform/accounting/posting-rules-v2/capital-instance-fold.test.ts
//
// D-FIL-CONSUMER-SURFACE-ARCHITECTURE (capital sub-step) — STATE-DRIVEN CAPITAL
// derivation byte-equivalence proof.
//
// Proves `deriveCapitalInstanceLegs` (reads the FIL STATE register) reproduces
// `foldCapitalContributionLegs` (replays the raw capital FIL events) byte-for-byte
// at the NET per-(accountCode,currency) level, over a non-vacuous fixture book:
//   1. the R300m CET1 paid-up-ordinary-shares injection (issuance), AND
//   2. a cancelled-capital instance (FilInstrumentTerminated terminalStage
//      "cancelled") — which posts a zero-amount terminal memo, NOT a reversal
//      (the capital redemption rule's documented behaviour).
//
// Same build-phase fixture pattern as fx-instance-fold.test.ts: raw
// EventStore(":memory:") seeds FIL capital events (production + simulated cohort);
// not a production access path. T-01 carve-out. F-031.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import type {
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../../../v2-core/fil-models/capital/types/capital-type-definitions";
import { amountToMinorUnits } from "../../core/decimal-money";
import { legAmountMoney } from "../../core/money-codec";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../../event-store/event-types/fil-instances";
import { simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { type CapitalFoldLeg, foldCapitalContributionLegs } from "./capital-fold";
import { deriveCapitalInstanceLegs } from "./capital-instance-fold";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "system", id: "atlas:capital-instance-fold-test" };
const CITES = ["D-FIL-CONSUMER-SURFACE-ARCHITECTURE", "D-CAPITAL-ASSET-CLASS-V1"];
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";

const SHARE_CAPITAL_ACCOUNT = "ACC-5000-001";
const ZAR_NOSTRO_ACCOUNT = "ACC-1200-001";
const R300M_MINOR = 30_000_000_000;

const SIM_PROVENANCE = simulatedTag({
  scenario: "capital-instance-fold-test",
  sourceLineage: "atlas:capital-instance-fold-test",
  tags: ["manual-simulation", "capital-raise"],
});

/** Seed one CET1 capital issuance (created). Simulated provenance by default. */
function seedCapitalCreated(
  store: EventStore,
  instanceId: string,
  amount: string,
  asOf: string,
): string {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId });
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf,
    originatingEvent: {
      eventType: "CapitalSubscriptionConfirmed",
      eventId: `CAP-V2-SIM-${instanceId}`,
    },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "capital" as const,
      notional: { currency: "ZAR", amount },
      direction: "long" as const,
      counterpartyId: "urn:party:capital-provider:founding-subscription",
      nettingSetId: "NS-CAPITAL-CET1-ZAR",
      currency: "ZAR",
      settlementDate: asOf.slice(0, 10),
      qualifyingCapital: {
        tier: "cet1" as const,
        subCategory: "cet1.paid-up-ordinary-shares" as const,
      },
    },
  };
  const event = makeFilInstrumentCreated({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
      typeof makeFilInstrumentCreated
    >[0]["payload"],
  });
  event.provenance = SIM_PROVENANCE;
  store.append(event);
  return instance;
}

/** Terminate a capital instance (e.g. a cancellation). */
function seedCapitalTerminated(
  store: EventStore,
  instanceId: string,
  asOf: string,
  terminalStage: "settled" | "matured" | "cancelled" | "terminated",
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId });
  const payload = {
    kind: "FilInstrumentTerminated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf,
    originatingEvent: {
      eventType: "CapitalRedemptionConfirmed",
      eventId: `CAP-V2-SIM-${instanceId}-term`,
    },
    terminalStage,
  };
  const event = makeFilInstrumentTerminated({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: payload as unknown as FilInstrumentTerminatedPayload as Parameters<
      typeof makeFilInstrumentTerminated
    >[0]["payload"],
  });
  event.provenance = SIM_PROVENANCE;
  store.append(event);
}

/** Net per-(accountCode|currency) signed-minor balance over a set of folded legs. */
function netBalances(legs: readonly CapitalFoldLeg[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const leg of legs) {
    if (!leg.postingDate) continue;
    if (leg.postingDate < PERIOD_START || leg.postingDate > PERIOD_END) continue;
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    map.set(key, (map.get(key) ?? 0) + (leg.creditDebit === "debit" ? legMinor : -legMinor));
  }
  for (const [k, v] of [...map.entries()]) if (v === 0) map.delete(k);
  return map;
}

/** Both folds, under the +Sim (combined) lens, over the same store. */
function bothFolds(store: EventStore): {
  event: Map<string, number>;
  state: Map<string, number>;
} {
  const filter = { mode: "combined" as const };
  const event = netBalances(
    foldCapitalContributionLegs({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter,
    }).legs,
  );
  const state = netBalances(
    deriveCapitalInstanceLegs({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter,
    }).legs,
  );
  return { event, state };
}

describe("state-driven capital derivation == event fold (byte-equivalent net)", () => {
  test("R300m CET1 injection: state net == event net (non-vacuous)", () => {
    const store = new EventStore(":memory:");
    seedCapitalCreated(store, "cap-cet1-300m", "300000000", "2026-06-21T00:00:00.000Z");

    const { event, state } = bothFolds(store);

    // Non-vacuous: the R300m pair is present.
    expect(event.get(`${SHARE_CAPITAL_ACCOUNT}|ZAR`)).toBe(-R300M_MINOR);
    expect(event.get(`${ZAR_NOSTRO_ACCOUNT}|ZAR`)).toBe(R300M_MINOR);

    // Byte-equal: same key set, same amounts.
    expect([...state.keys()].sort()).toEqual([...event.keys()].sort());
    for (const k of event.keys()) expect(state.get(k)).toBe(event.get(k));
  });

  test("cancelled capital instance: terminal memo nets to zero, state net == event net", () => {
    const store = new EventStore(":memory:");
    // A standing issuance kept open.
    seedCapitalCreated(store, "cap-keep", "100000000", "2026-06-01T00:00:00.000Z");
    // A capital issuance then CANCELLED — the terminal memo posts zero (no reversal).
    seedCapitalCreated(store, "cap-cancel", "50000000", "2026-06-02T00:00:00.000Z");
    seedCapitalTerminated(store, "cap-cancel", "2026-06-10T00:00:00.000Z", "cancelled");

    const { event, state } = bothFolds(store);

    // Non-vacuous: the kept issuance (R100m) AND the cancelled issuance (R50m) BOTH
    // still stand — a cancellation does NOT reverse capital (zero memo only), so the
    // share-capital credit is R150m total, proving the terminal memo nets to zero.
    expect(event.get(`${SHARE_CAPITAL_ACCOUNT}|ZAR`)).toBe(-15_000_000_000);
    expect(event.get(`${ZAR_NOSTRO_ACCOUNT}|ZAR`)).toBe(15_000_000_000);

    // Byte-equal: the state derivation reproduces the event fold exactly.
    expect([...state.keys()].sort()).toEqual([...event.keys()].sort());
    for (const k of event.keys()) expect(state.get(k)).toBe(event.get(k));
  });

  test("empty store: both folds empty (vacuous-pass guard)", () => {
    const store = new EventStore(":memory:");
    const { event, state } = bothFolds(store);
    expect(event.size).toBe(0);
    expect(state.size).toBe(0);
  });
});
