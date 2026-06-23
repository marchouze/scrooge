// platform/accounting/posting-rules-v2/fx-instance-fold.test.ts
//
// Proof for D-FIL-CONSUMER-SURFACE-ARCHITECTURE Step B: the STATE-DRIVEN FX
// derivation (`deriveFxInstanceLegs`, folds the FIL register) produces the SAME
// NET per `(accountCode,currency)` as the EVENT fold (`foldFxContributionLegs`,
// replays `FilInstrument*`) — byte-for-byte — across every FX lifecycle shape the
// anchor book carries, INCLUDING the cancelled-parent (bare cancellation) case
// from #1510 and the cross-lens provenance-mismatch case.
//
// This is the dark-path safety net: it proves the register-driven derivation
// reproduces the event fold before Step C cuts the trial balance over to it.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  type FilFxSettlementConfirmedPayload,
  filFxSettlementConfirmedPayloadSchema,
  filInstrumentAmendedPayloadSchema,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../../../v2-core/fil-instances/events";
import { decomposeFxSettlementToTradeSettlements } from "../../../v2-core/posting-rules/trade-settlement";
import { FX_TREATMENT_MODULES } from "../../../v2-core/reporting-treatments/fx-modules";
import { filInstanceTreatmentElectedSchema } from "../../../v2-core/reporting-treatments/instance-election";
import { amountToMinorUnits } from "../../core/decimal-money";
import { legAmountMoney } from "../../core/money-codec";
import {
  makeFilFxSettlementConfirmed,
  makeFilInstrumentAmended,
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
  makeTradeSettlementExecuted,
} from "../../event-store/event-types/fil-instances";
import { makeFilInstanceTreatmentElected } from "../../event-store/event-types/instance-election";
import { makeReportingTreatmentDeclared } from "../../event-store/event-types/reporting-treatments";
import { EventStore } from "../../event-store/store";
import type { Actor, Event, ProvenanceTag } from "../../event-store/types";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import type { FxFoldLeg, FxFoldResult } from "./fx-fold";
import { foldFxContributionLegs } from "./fx-fold";
import { deriveFxInstanceLegs } from "./fx-instance-fold";

const ACTOR: Actor = { type: "system", id: "atlas:fx-instance-fold-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["D-FIL-CONSUMER-SURFACE-ARCHITECTURE"];
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";
const TENANT = "tenant:za-bank";
const FX_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";

const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "fx-instance-fold-test" };

function instanceUrn(id: string): string {
  return `fil:inst:${ENTITY}:${id}`;
}

function args(store: EventStore) {
  return { eventStore: store, periodStart: PERIOD_START, periodEnd: PERIOD_END };
}

function seedTreatmentModules(store: EventStore): void {
  for (const m of FX_TREATMENT_MODULES) {
    const ev = makeReportingTreatmentDeclared({
      asOf: "2026-01-01T00:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: m as Parameters<typeof makeReportingTreatmentDeclared>[0]["payload"],
    });
    store.append({ ...ev, provenance: PROD_TAG });
  }
}

function fxCreated(
  id: string,
  direction: "long" | "short",
  notional: string,
  asOf: string,
  provenance: ProvenanceTag = PROD_TAG,
): Event {
  const base = makeFilInstrumentCreated({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: { eventType: "Ws-v2-s1-fixture-book", eventId: `s1:${id}` },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "ZAR", amount: notional },
        direction,
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-test-ZAR",
        currency: "ZAR",
        settlementDate: asOf.slice(0, 10),
        hedgingSetTag: "USD/ZAR",
      },
    }),
  });
  return { ...base, provenance };
}

function fxAmended(id: string, notional: string, asOf: string): Event {
  const base = makeFilInstrumentAmended({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filInstrumentAmendedPayloadSchema.parse({
      kind: "FilInstrumentAmended",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: { eventType: "Ws-v2-s1-fixture-book", eventId: `s1:${id}` },
      amendmentVia: "FxPositionRevalued",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "ZAR", amount: notional },
        direction: "long",
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-test-ZAR",
        currency: "ZAR",
        settlementDate: asOf.slice(0, 10),
        hedgingSetTag: "USD/ZAR",
      },
    }),
  });
  return { ...base, provenance: PROD_TAG };
}

function fxTerminated(
  id: string,
  asOf: string,
  terminalStage: "settled" | "matured" | "cancelled" | "terminated",
  provenance: ProvenanceTag = PROD_TAG,
): Event {
  const base = makeFilInstrumentTerminated({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filInstrumentTerminatedPayloadSchema.parse({
      kind: "FilInstrumentTerminated",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: { eventType: "Ws-v2-s1-fixture-book", eventId: `s1:${id}` },
      terminalStage,
    }),
  });
  return { ...base, provenance };
}

function fvociElection(id: string, asOf: string): Event {
  const base = makeFilInstanceTreatmentElected({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filInstanceTreatmentElectedSchema.parse({
      kind: "FilInstanceTreatmentElected",
      instance: instanceUrn(id),
      facet: "ifrs-classification",
      electedAt: asOf,
      ifrsCategory: "fvoci",
      cites: ["IFRS-9-§5.7.5"],
    }),
  });
  return { ...base, provenance: PROD_TAG };
}

/** Accumulate the legs into a per-(accountCode|currency) minor-unit net map. */
function netByAccountCurrency(legs: readonly FxFoldLeg[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const leg of legs) {
    if (!leg.postingDate) continue;
    if (leg.postingDate < PERIOD_START || leg.postingDate > PERIOD_END) continue;
    const minor = Number(
      amountToMinorUnits(legAmountMoney({ amount: leg.amount, currency: leg.amount.currency })),
    );
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    map.set(key, (map.get(key) ?? 0) + (leg.creditDebit === "debit" ? minor : -minor));
  }
  for (const [k, v] of [...map.entries()]) if (v === 0) map.delete(k);
  return map;
}

/** Assert the state derivation's net == the event fold's net, byte-for-byte, on
 * the same store and lens. Returns both folds for further per-test assertions. */
function expectStateNetMatchesEventNet(store: EventStore): {
  stateFold: FxFoldResult;
  eventFold: FxFoldResult;
  stateNet: Map<string, number>;
  eventNet: Map<string, number>;
} {
  const eventFold = foldFxContributionLegs(args(store));
  const stateFold = deriveFxInstanceLegs(args(store));
  const eventNet = netByAccountCurrency(eventFold.legs);
  const stateNet = netByAccountCurrency(stateFold.legs);
  expect([...stateNet.keys()].sort()).toEqual([...eventNet.keys()].sort());
  for (const [k, v] of eventNet) expect(stateNet.get(k)).toBe(v);
  return { stateFold, eventFold, stateNet, eventNet };
}

beforeEach(() => {
  setDefaultProvenanceModeOverride("production-only");
});

afterEach(() => {
  setDefaultProvenanceModeOverride(undefined);
});

describe("deriveFxInstanceLegs — state-driven net == event-fold net (byte-equivalent)", () => {
  test("recognition only (active long + short)", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-1", "long", "9260000", "2026-06-01T10:00:00.000Z"));
    store.append(fxCreated("FX-2", "short", "6045000", "2026-06-02T10:00:00.000Z"));

    const { stateNet } = expectStateNetMatchesEventNet(store);
    expect(stateNet.size).toBeGreaterThan(0); // non-vacuous
  });

  test("settled (bare close memo) keeps the standing position — both nets equal", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-1", "long", "9260000", "2026-06-01T10:00:00.000Z"));
    store.append(fxCreated("FX-2", "short", "6045000", "2026-06-02T10:00:00.000Z"));
    store.append(fxTerminated("FX-1", "2026-06-03T10:00:00.000Z", "settled"));

    const { stateNet } = expectStateNetMatchesEventNet(store);
    expect(stateNet.size).toBeGreaterThan(0);
  });

  test("CANCELLED-PARENT (bare cancellation) nets the opening to ZERO — both folds", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-CANCEL", "long", "9260000", "2026-06-01T10:00:00.000Z"));
    store.append(fxTerminated("FX-CANCEL", "2026-06-22T10:00:00.000Z", "cancelled"));

    const { stateNet, stateFold } = expectStateNetMatchesEventNet(store);
    // The cancelled instance's opening is fully reversed → no standing FX net.
    expect(stateNet.size).toBe(0);
    // And the state derivation produced its reversal via the dedicated rule id.
    const reversal = stateFold.legs.filter((l) => l.postingRuleId === "PR-FX-CANCEL-REVERSAL-V2");
    expect(reversal.length).toBe(2); // the opening pair reversed once
    expect(reversal.every((l) => l.filEventId.endsWith("::cancellation-reversal"))).toBe(true);
  });

  test("cancellation reversal is idempotent across multiple cancellation events", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-IDEMP", "long", "6045000", "2026-06-01T10:00:00.000Z"));
    store.append(fxTerminated("FX-IDEMP", "2026-06-22T10:00:00.000Z", "cancelled"));
    store.append(fxTerminated("FX-IDEMP", "2026-06-23T10:00:00.000Z", "cancelled"));

    const { stateNet, stateFold } = expectStateNetMatchesEventNet(store);
    expect(stateNet.size).toBe(0);
    const reversal = stateFold.legs.filter((l) => l.postingRuleId === "PR-FX-CANCEL-REVERSAL-V2");
    // Reversed exactly once (2 legs), not over-reversed.
    expect(reversal.length).toBe(2);
  });

  test("amended (revaluation) — full-pair accumulation reproduced from FLOW", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-REV", "long", "5000000", "2026-06-01T10:00:00.000Z"));
    store.append(fxAmended("FX-REV", "5200000", "2026-06-02T10:00:00.000Z"));

    const { stateNet } = expectStateNetMatchesEventNet(store);
    expect(stateNet.size).toBeGreaterThan(0);
  });

  test("FVOCI-elected amendment — election override reproduced + deviation recorded", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-OCI", "long", "5000000", "2026-06-01T10:00:00.000Z"));
    store.append(fxAmended("FX-OCI", "5200000", "2026-06-02T10:00:00.000Z"));
    store.append(fvociElection("FX-OCI", "2026-06-02T09:00:00.000Z"));

    const { stateFold } = expectStateNetMatchesEventNet(store);
    // The OCI reserve account carries the revaluation credit (election applied).
    const ociCredit = stateFold.legs.find(
      (l) => l.postingRuleId === "PR-FX-REVAL-V2" && l.creditDebit === "credit",
    );
    expect(ociCredit?.accountCode).toBe("ACC-2100-008");
    // Deviation recorded once with its citation.
    expect(stateFold.deviations.length).toBe(1);
    expect(stateFold.deviations[0]?.cites).toContain("IFRS-9-§5.7.5");
  });

  test("fail-closed: an instance with no resolvable treatment is skipped in BOTH folds", () => {
    const store = new EventStore(":memory:");
    // No treatment modules seeded → no posting-rules module scopes the type → skip.
    store.append(fxCreated("FX-UNRES", "long", "1000000", "2026-06-01T10:00:00.000Z"));

    const eventFold = foldFxContributionLegs(args(store));
    const stateFold = deriveFxInstanceLegs(args(store));
    expect(eventFold.legs).toHaveLength(0);
    expect(stateFold.legs).toHaveLength(0);
    expect(stateFold.skipped.length).toBeGreaterThan(0);
    expect(stateFold.skipped[0]?.reason).toBe("treatment-unresolved");
  });

  test("mixed book — recognition + settled + cancelled together stays byte-equal", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-A", "long", "9260000", "2026-06-01T10:00:00.000Z"));
    store.append(fxCreated("FX-B", "short", "6045000", "2026-06-02T10:00:00.000Z"));
    store.append(fxCreated("FX-C", "long", "3000000", "2026-06-03T10:00:00.000Z"));
    store.append(fxTerminated("FX-B", "2026-06-04T10:00:00.000Z", "settled"));
    store.append(fxTerminated("FX-C", "2026-06-22T10:00:00.000Z", "cancelled"));

    const { stateNet } = expectStateNetMatchesEventNet(store);
    expect(stateNet.size).toBeGreaterThan(0);
  });
});

describe("deriveFxInstanceLegs — DUAL-READ settlement (Slice 2: TradeSettlementExecuted == FilFxSettlementConfirmed)", () => {
  const SETTLE_CITES = ["D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL"];

  function fxSettlementConfirmed(
    id: string,
    asOf: string,
    terms: {
      boughtBooked: string;
      boughtSettled: string;
      soldBooked: string;
      soldSettled: string;
    },
  ): FilFxSettlementConfirmedPayload {
    return filFxSettlementConfirmedPayloadSchema.parse({
      kind: "FilFxSettlementConfirmed",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: `settle:${id}` },
      legRole: "spot",
      boughtBooked: { currency: "USD", amount: terms.boughtBooked },
      boughtSettled: { currency: "USD", amount: terms.boughtSettled },
      soldBooked: { currency: "ZAR", amount: terms.soldBooked },
      soldSettled: { currency: "ZAR", amount: terms.soldSettled },
    });
  }

  /** Seed an FX trade create so the register carries the trade row + treatment
   * resolves, then settle it via the OLD (FilFxSettlementConfirmed) path. */
  function storeWithOldSettlement(id: string, s: FilFxSettlementConfirmedPayload): EventStore {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated(id, "long", "9260000", "2026-06-01T10:00:00.000Z"));
    store.append({
      ...makeFilFxSettlementConfirmed({
        asOf: s.asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: SETTLE_CITES,
        payload: s,
      }),
      provenance: PROD_TAG,
    });
    return store;
  }

  /** Same trade create, settled via the NEW (N TradeSettlementExecuted) path —
   * decomposed from the SAME FX settlement terms. */
  function storeWithNewSettlement(id: string, s: FilFxSettlementConfirmedPayload): EventStore {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated(id, "long", "9260000", "2026-06-01T10:00:00.000Z"));
    for (const settlement of decomposeFxSettlementToTradeSettlements({ settlement: s })) {
      store.append({
        ...makeTradeSettlementExecuted({
          asOf: settlement.asOf,
          entity: ENTITY,
          actor: ACTOR,
          citations: SETTLE_CITES,
          payload: settlement,
        }),
        provenance: PROD_TAG,
      });
    }
    return store;
  }

  test("no realised P&L: N TradeSettlementExecuted net == single FilFxSettlementConfirmed (state fold)", () => {
    const s = fxSettlementConfirmed("FX-SETTLE-A", "2026-06-10T10:00:00.000Z", {
      boughtBooked: "1000000",
      boughtSettled: "1000000",
      soldBooked: "18500000",
      soldSettled: "18500000",
    });
    const oldNet = netByAccountCurrency(
      deriveFxInstanceLegs(args(storeWithOldSettlement("FX-SETTLE-A", s))).legs,
    );
    const newNet = netByAccountCurrency(
      deriveFxInstanceLegs(args(storeWithNewSettlement("FX-SETTLE-A", s))).legs,
    );
    expect([...newNet.keys()].sort()).toEqual([...oldNet.keys()].sort());
    for (const [k, v] of oldNet) expect(newNet.get(k)).toBe(v);
    // Non-vacuity: settlement actually moved cash + extinguished the obligation.
    expect([...oldNet.keys()].some((k) => k.startsWith("ACC-1200-"))).toBe(true);
  });

  test("realised P&L (settled != booked both legs): N TradeSettlementExecuted net == single FilFxSettlementConfirmed", () => {
    const s = fxSettlementConfirmed("FX-SETTLE-B", "2026-06-10T10:00:00.000Z", {
      boughtBooked: "1000000",
      boughtSettled: "1010000",
      soldBooked: "18500000",
      soldSettled: "18400000",
    });
    const oldNet = netByAccountCurrency(
      deriveFxInstanceLegs(args(storeWithOldSettlement("FX-SETTLE-B", s))).legs,
    );
    const newNet = netByAccountCurrency(
      deriveFxInstanceLegs(args(storeWithNewSettlement("FX-SETTLE-B", s))).legs,
    );
    expect([...newNet.keys()].sort()).toEqual([...oldNet.keys()].sort());
    for (const [k, v] of oldNet) expect(newNet.get(k)).toBe(v);
    // Non-vacuity: realised P&L (ACC-2100-006) is carried by BOTH paths.
    expect(oldNet.has("ACC-2100-006|USD") || oldNet.has("ACC-2100-006|ZAR")).toBe(true);
  });

  test("the new-path settlement legs attach to the TRADE instance (grouping id), not the holding", () => {
    const s = fxSettlementConfirmed("FX-SETTLE-C", "2026-06-10T10:00:00.000Z", {
      boughtBooked: "1000000",
      boughtSettled: "1010000",
      soldBooked: "18500000",
      soldSettled: "18400000",
    });
    const fold = deriveFxInstanceLegs(args(storeWithNewSettlement("FX-SETTLE-C", s)));
    const settleLegs = fold.legs.filter((l) => l.postingRuleId === "PR-FX-SETTLE-V2");
    expect(settleLegs.length).toBeGreaterThan(0);
    // sourceEventId is the trade instance — the settlement is grouped under the trade.
    expect(settleLegs.every((l) => l.sourceEventId === instanceUrn("FX-SETTLE-C"))).toBe(true);
  });
});

describe("deriveFxInstanceLegs — cross-lens cancellation (provenance-decoupled)", () => {
  test("a PRODUCTION creation cancelled by a BUILD-PHASE-FIXTURE cancellation nets to zero under production lens", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-MISMATCH", "long", "4680000", "2026-06-01T10:00:00.000Z", PROD_TAG));
    const fixtureTag: ProvenanceTag = {
      kind: "build-phase-fixture",
      sourceLineage: "ws-v2-s1-fixture-remediation",
    };
    store.append(fxTerminated("FX-MISMATCH", "2026-06-22T10:00:00.000Z", "cancelled", fixtureTag));

    // Under production-only the fixture cancellation is lens-filtered, but the
    // register state (full stream) reads `cancelled`, so the production opening is
    // reversed — exactly as the event fold's provenance-decoupled scan does.
    const { stateNet } = expectStateNetMatchesEventNet(store);
    expect(stateNet.size).toBe(0);
  });
});
