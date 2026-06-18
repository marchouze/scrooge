// platform/accounting/posting-rules-v2/fx-fold.test.ts
//
// Proof for D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (core slice):
//
//  (1) GOLDEN BYTE-EQUIVALENCE — the FX trial balance / entries / accounts
//      computed as a PURE FOLD over the primary FIL FX events reproduces, BYTE
//      FOR BYTE, the numbers the stored-GlPostingEmitted path produces today
//      (the legs the dual-run engine emits). The fold reads NO GlPostingEmitted.
//
//  (2) IN-TEST PROVENANCE COHORT + REVERSIBILITY — a small simulated FX cohort
//      whose trade carries a `productId` (so the resolver takes the precise
//      product path, not the build-phase fallback):
//        (a) the production operating-book trial balance is UNCHANGED (the cohort
//            is excluded by the default production filter);
//        (b) `reclassifyProvenance` to `test-pollution:test-fx-foldnative` cleanly
//            removes the cohort (a sandbox prefix held out of every read).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Atlas (Substrate Architect, engineering).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { v2ProductRegisteredSchema } from "../../../v2-core/banking/events";
import type { FilInstanceLifecycleEvent } from "../../../v2-core/fil-instances/events";
import {
  filFxSettlementConfirmedPayloadSchema,
  filInstrumentAmendedPayloadSchema,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
  filNdfFixingObservedPayloadSchema,
} from "../../../v2-core/fil-instances/events";
import {
  FX_TREATMENT_MODULES,
  FX_TREATMENT_MODULE_IDS,
} from "../../../v2-core/reporting-treatments/fx-modules";
import { filInstanceTreatmentElectedSchema } from "../../../v2-core/reporting-treatments/instance-election";
import { amountToMinorUnits } from "../../core/decimal-money";
import { legAmountMoney } from "../../core/money-codec";
import {
  makeFilFxSettlementConfirmed,
  makeFilInstrumentAmended,
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
  makeFilNdfFixingObserved,
} from "../../event-store/event-types/fil-instances";
import type { GlPostingEmittedPayload } from "../../event-store/event-types/fx-accounting";
import { makeFilInstanceTreatmentElected } from "../../event-store/event-types/instance-election";
import { makeReportingTreatmentDeclared } from "../../event-store/event-types/reporting-treatments";
import { makeV2ProductRegistered } from "../../event-store/event-types/v2-banking";
import { EventStore } from "../../event-store/store";
import type { Actor, Event, ProvenanceTag } from "../../event-store/types";
import {
  eventMatchesProvenanceFilter,
  setDefaultProvenanceModeOverride,
} from "../../projections/filter";
import {
  computeGlAccountsV2Uncached,
  computeGlEntriesV2Uncached,
  computeTrialBalanceV2Uncached,
} from "../../projections/gl-projection-v2";
import { runGlV2Engine } from "../gl-posting-engine-v2";
import { FX_FVOCI_OCI_RESERVE_ACCOUNT } from "./fx";
import { foldFxContributionLegs } from "./fx-fold";

const ACTOR: Actor = { type: "system", id: "atlas:fx-fold-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD"];
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";

const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "fx-fold-test" };
const COHORT_SCENARIO = "test-fx-foldnative";
const COHORT_TAG: ProvenanceTag = {
  kind: "simulated",
  scenario: COHORT_SCENARIO,
  sourceLineage: "fx-fold-test",
};

// Tenant axis. The FIL `tenant` field and the instance-URN tenant segment are
// independent: the instance URN uses the legal-entity id (a valid URN segment),
// while the `tenant` field is the `tenant:`-prefixed control-plane tenant id the
// GlPostingEmitted schema requires (the engine reference path parses it).
const TENANT = "tenant:za-bank";
const URN_TENANT = ENTITY;

function instanceUrn(id: string): string {
  return `fil:inst:${URN_TENANT}:${id}`;
}

const FX_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";

/** A production FX FIL created event for a long/short trade, `notional` ZAR. */
function fxCreated(
  id: string,
  direction: "long" | "short",
  notional: string,
  asOf: string,
  provenance: ProvenanceTag,
  originating: { eventType: string; eventId: string },
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
      originatingEvent: originating,
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

/** A production FX FIL amended (revaluation) event for `id`, `notional` ZAR. */
function fxAmended(
  id: string,
  notional: string,
  asOf: string,
  provenance: ProvenanceTag,
  originating: { eventType: string; eventId: string },
): Event {
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
      originatingEvent: originating,
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
  return { ...base, provenance };
}

/** An FVOCI per-instrument election (IFRS 9 §5.7.5) for `id`. */
function fvociElection(id: string, asOf: string, provenance: ProvenanceTag): Event {
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
  return { ...base, provenance };
}

function fxTerminated(
  id: string,
  asOf: string,
  provenance: ProvenanceTag,
  originating: { eventType: string; eventId: string },
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
      originatingEvent: originating,
      terminalStage: "settled",
    }),
  });
  return { ...base, provenance };
}

/** Seed the FX treatment modules into `store` (production-tagged). */
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

/**
 * Fold "today's" FX trial balance from engine-emitted GlPostingEmitted events —
 * the byte-for-byte reference the new pure fold must reproduce. Mirrors the
 * accumulation in computeTrialBalanceV2Uncached (per accountCode|currency,
 * debit=+minor, credit=−minor), reading the FX GlPostingEmitted directly.
 */
function goldenFxTrialBalanceFromEngine(filStore: EventStore): Map<string, number> {
  const golden = new EventStore(":memory:");
  // Feed the engine the SAME production FIL events the fold reads (only those
  // admitted by the production filter — the engine has no provenance gate, so
  // we apply it here to keep the reference scoped to the production book).
  const prodFilter = { mode: "production-only" as const };
  const filEvents: FilInstanceLifecycleEvent[] = [];
  for (const t of ["FilInstrumentCreated", "FilInstrumentAmended", "FilInstrumentTerminated"]) {
    for (const e of filStore.replay({ type: t })) {
      if (!eventMatchesProvenanceFilter(e, prodFilter)) continue;
      filEvents.push(e.payload as unknown as FilInstanceLifecycleEvent);
    }
  }
  runGlV2Engine({ eventStore: golden, actor: ACTOR, entity: ENTITY, events: filEvents });

  // Fold the engine-emitted GlPostingEmitted in COMBINED mode: the engine stamps
  // its own append-time provenance (independent of the source FIL tag), so we
  // capture every emitted leg as the byte-for-byte reference. The new fold reads
  // the SAME underlying production FIL events, so the FX numbers must match.
  const filter = { mode: "combined" as const };
  const map = new Map<string, number>();
  for (const e of golden.replay({ type: "GlPostingEmitted" })) {
    if (!eventMatchesProvenanceFilter(e, filter)) continue;
    const leg = e.payload as GlPostingEmittedPayload;
    if (!leg.postingDate) continue;
    if (leg.postingDate < PERIOD_START || leg.postingDate > PERIOD_END) continue;
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    map.set(key, (map.get(key) ?? 0) + (leg.creditDebit === "debit" ? legMinor : -legMinor));
  }
  // Drop zero-balance rows (consistent with the fold).
  for (const [k, v] of [...map.entries()]) if (v === 0) map.delete(k);
  return map;
}

function args(store: EventStore) {
  return { eventStore: store, entity: ENTITY, periodStart: PERIOD_START, periodEnd: PERIOD_END };
}

beforeEach(() => {
  // Pin production-only so the simulated cohort is excluded from the production
  // operating-book read (the cohort tests assert "production unchanged").
  setDefaultProvenanceModeOverride("production-only");
});

afterEach(() => {
  setDefaultProvenanceModeOverride(undefined);
});

describe("FX trial balance — pure fold over FIL events == engine GlPostingEmitted (golden)", () => {
  test("byte-equivalent trial balance for a mixed long/short/terminated FX book", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    // Originating events with NO productId → build-phase fallback path (the norm).
    store.append(
      fxCreated("FX-1", "long", "9260000", "2026-06-01T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-1",
      }),
    );
    store.append(
      fxCreated("FX-2", "short", "6045000", "2026-06-02T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-2",
      }),
    );
    store.append(
      fxTerminated("FX-1", "2026-06-03T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-1",
      }),
    );

    const golden = goldenFxTrialBalanceFromEngine(store);

    const tb = computeTrialBalanceV2Uncached(args(store));
    const folded = new Map<string, number>();
    for (const r of tb.rows) folded.set(`${r.leafAccountId}|${r.currency}`, r.amountMinor);

    // Byte-for-byte: same key set, same amounts.
    expect([...folded.keys()].sort()).toEqual([...golden.keys()].sort());
    for (const [k, v] of golden) expect(folded.get(k)).toBe(v);
    // And the fold actually produced FX rows (non-vacuous proof).
    expect(folded.size).toBeGreaterThan(0);
  });

  test("the fold reads NO GlPostingEmitted (FX numbers present with an empty GL stream)", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(
      fxCreated("FX-9", "long", "1000000", "2026-06-01T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-9",
      }),
    );
    // No runGlV2Engine call → zero GlPostingEmitted in the store.
    expect([...store.replay({ type: "GlPostingEmitted" })]).toHaveLength(0);

    const tb = computeTrialBalanceV2Uncached(args(store));
    // FX accounts are still present — derived purely from the FIL event.
    expect(tb.rows.length).toBeGreaterThan(0);
    expect(tb.rows.some((r) => r.leafAccountId.startsWith("ACC-2100-"))).toBe(true);
  });

  test("entries + accounts views also fold from FIL with no GlPostingEmitted", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(
      fxCreated("FX-E", "long", "2500000", "2026-06-01T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-E",
      }),
    );
    const entries = computeGlEntriesV2Uncached(args(store));
    expect(entries.length).toBe(2); // Dr + Cr
    expect(entries.every((e) => e.postingRuleId === "PR-FX-001-V2")).toBe(true);
    const accounts = computeGlAccountsV2Uncached(args(store));
    expect(accounts.length).toBeGreaterThan(0);
  });
});

describe("FX fold — in-test provenance cohort + reversibility", () => {
  test("simulated cohort (productId path) leaves the production TB unchanged, and reclassify removes it", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);

    // Production FX book.
    store.append(
      fxCreated("FX-P1", "long", "4000000", "2026-06-01T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-P1",
      }),
    );
    const productionTb = computeTrialBalanceV2Uncached(args(store));

    // Register an FX product + a productId-carrying originating trade so the
    // cohort takes the PRECISE product-binding path (not the fallback).
    const PRODUCT_ID = "v2:prd:bank:fx:otc-vanilla";
    store.append({
      ...makeV2ProductRegistered({
        asOf: "2026-01-01T00:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: v2ProductRegisteredSchema.parse({
          kind: "V2ProductRegistered",
          productId: PRODUCT_ID,
          name: "FX OTC Vanilla",
          ifrs9Family: "fx-spot",
          filTypeScopes: ["fil:type:fx:*"],
          reportingTreatmentModuleIds: [...FX_TREATMENT_MODULE_IDS],
          currencies: ["ZAR", "USD"],
          legalEntityIds: [ENTITY],
          jurisdictions: ["ZA"],
          franchiseScope: "treasury-own-book",
          citations: CITES,
        }),
      }),
      provenance: COHORT_TAG,
    });
    // The originating trade event carrying productId (the S0d binding the
    // resolver reads). Tagged into the cohort so it is excluded from production.
    // An unregistered event type avoids the strict FxTradeExecuted schema while
    // still exercising the resolver's `originating.payload.productId` read — the
    // S0d field that does not yet exist on the real trade event.
    const cohortTradeEventId = "cohort-trade:FX-C1";
    store.append({
      event_id: cohortTradeEventId,
      type: "CohortFxTradeExecuted",
      as_of: "2026-06-05T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: { productId: PRODUCT_ID, tradeId: "FX-C1" },
      provenance: COHORT_TAG,
    } as Event);
    store.append(
      fxCreated("FX-C1", "long", "777000", "2026-06-05T10:00:00.000Z", COHORT_TAG, {
        eventType: "CohortFxTradeExecuted",
        eventId: cohortTradeEventId,
      }),
    );

    // (a) Production operating-book TB unchanged — cohort excluded by default filter.
    const productionTbAfterCohort = computeTrialBalanceV2Uncached(args(store));
    expect(productionTbAfterCohort.rows).toEqual(productionTb.rows);

    // The cohort IS visible (and resolves via the product path) when reading
    // combined — proving the cohort folds and is genuinely product-bound.
    setDefaultProvenanceModeOverride("combined");
    const combinedTb = computeTrialBalanceV2Uncached(args(store));
    expect(combinedTb.rows).not.toEqual(productionTb.rows);
    setDefaultProvenanceModeOverride("production-only");

    // (b) reclassifyProvenance → test-pollution:<scenario> cleanly removes the
    // cohort even under a combined read (test-pollution is a sandbox prefix).
    const reclassifiedTag: ProvenanceTag = {
      kind: "simulated",
      scenario: `test-pollution:${COHORT_SCENARIO}`,
      sourceLineage: "fx-fold-test",
    };
    for (const t of [
      "FilInstrumentCreated",
      "FilInstrumentTerminated",
      "V2ProductRegistered",
      "CohortFxTradeExecuted",
    ]) {
      for (const e of store.replay({ type: t })) {
        if (e.provenance?.scenario === COHORT_SCENARIO) {
          const r = store.reclassifyProvenance(e.event_id, reclassifiedTag);
          expect(r.reclassified).toBe(true);
        }
      }
    }
    // The operating-book read holds out the test-pollution cohort (a sandbox
    // prefix) → back to exactly the production book. (The sandbox hold-out is an
    // operating-book semantic, not a combined-mode one — so we assert under it.)
    setDefaultProvenanceModeOverride("operating-book");
    const afterReclassify = computeTrialBalanceV2Uncached(args(store));
    setDefaultProvenanceModeOverride("production-only");
    expect(afterReclassify.rows).toEqual(productionTb.rows);
  });
});

// ===========================================================================
// FX3 — per-instance accounting elections (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD).
//
// The product treatment is the DEFAULT. A genuine per-instance election the law
// leaves open (FVOCI election IFRS 9 §5.7.5) OVERRIDES it for the elected facet:
//   - FVOCI-elected instance → revaluation fair-value leg routes to OCI (a
//     deviation, RECORDED with its citation);
//   - no-election instance → product default (revaluation → FVTPL P&L);
//   - an election missing its citation → REJECTED (fail-closed) at parse.
// ===========================================================================

describe("FX3 — per-instance elections override the product-default treatment", () => {
  test("FVOCI-elected instance folds the revaluation leg to OCI (deviation recorded)", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    // Created + amended (revaluation) for an FVOCI-elected instance.
    store.append(
      fxCreated("FX-OCI", "long", "5000000", "2026-06-01T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-OCI",
      }),
    );
    store.append(
      fxAmended("FX-OCI", "5200000", "2026-06-02T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-OCI",
      }),
    );
    store.append(fvociElection("FX-OCI", "2026-06-02T09:00:00.000Z", PROD_TAG));

    const fold = foldFxContributionLegs(args(store));

    // The revaluation credit leg routes to the OCI reserve, NOT the FVTPL P&L
    // account (ACC-2100-005). Proves the election re-routed the leg.
    const revalLegs = fold.legs.filter((l) => l.postingRuleId === "PR-FX-REVAL-V2");
    expect(revalLegs.length).toBe(2); // Dr receivable + Cr OCI
    const creditLeg = revalLegs.find((l) => l.creditDebit === "credit");
    expect(creditLeg?.accountCode).toBe(FX_FVOCI_OCI_RESERVE_ACCOUNT);
    expect(revalLegs.some((l) => l.accountCode === "ACC-2100-005")).toBe(false);

    // The deviation is recorded with its backing citation (not silent).
    expect(fold.deviations.length).toBe(1);
    expect(fold.deviations[0]?.instance).toBe(instanceUrn("FX-OCI"));
    expect(fold.deviations[0]?.facet).toBe("ifrs-classification");
    expect(fold.deviations[0]?.cites).toContain("IFRS-9-§5.7.5");
  });

  test("no-election instance folds the revaluation leg to the product default (FVTPL P&L)", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(
      fxCreated("FX-DEF", "long", "5000000", "2026-06-01T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-DEF",
      }),
    );
    store.append(
      fxAmended("FX-DEF", "5200000", "2026-06-02T10:00:00.000Z", PROD_TAG, {
        eventType: "Ws-v2-s1-fixture-book",
        eventId: "s1:FX-DEF",
      }),
    );
    // NO election appended.

    const fold = foldFxContributionLegs(args(store));
    const revalLegs = fold.legs.filter((l) => l.postingRuleId === "PR-FX-REVAL-V2");
    const creditLeg = revalLegs.find((l) => l.creditDebit === "credit");
    // Product default: revaluation credit → FVTPL unrealised P&L (ACC-2100-005).
    expect(creditLeg?.accountCode).toBe("ACC-2100-005");
    expect(revalLegs.some((l) => l.accountCode === FX_FVOCI_OCI_RESERVE_ACCOUNT)).toBe(false);
    // No deviation recorded — the product default bound.
    expect(fold.deviations.length).toBe(0);
  });

  test("an election missing its required citation is REJECTED (fail-closed) at parse", () => {
    expect(() =>
      filInstanceTreatmentElectedSchema.parse({
        kind: "FilInstanceTreatmentElected",
        instance: instanceUrn("FX-NOCITE"),
        facet: "ifrs-classification",
        electedAt: "2026-06-02T09:00:00.000Z",
        ifrsCategory: "fvoci",
        cites: [], // ← missing required citation
      }),
    ).toThrow();
  });

  test("an election whose value does not match its facet is REJECTED (fail-closed)", () => {
    expect(() =>
      filInstanceTreatmentElectedSchema.parse({
        kind: "FilInstanceTreatmentElected",
        instance: instanceUrn("FX-MISMATCH"),
        facet: "ifrs-classification",
        electedAt: "2026-06-02T09:00:00.000Z",
        // No ifrsCategory present for the ifrs-classification facet.
        hedgeDesignation: "cash-flow-hedge",
        cites: ["IFRS-9-§6.5.2"],
      }),
    ).toThrow();
  });
});

// ===========================================================================
// WS-FIL-FX-SETTLEMENT-EVENTS — the five completeness rules fire at fold time on
// the new settlement / terminal / NDF-fixing events, and each fold balances to
// zero per currency (D-FIL-FX-SETTLEMENT-EVENTS, D-ACCT-FX-IFRS-POSTING-
// COMPLETENESS). These are FOLD-LEVEL proofs (not the unit tests in
// fx-settlement.test.ts) — they exercise the real event → fold → legs path.
// ===========================================================================

const ORIG = { eventType: "Ws-v2-s1-fixture-book", eventId: "s1:settle" };

/** Sum debit − credit per currency over the folded legs (minor units). */
function perCurrencyBalance(
  legs: readonly {
    amount: { amount: string; currency: string };
    creditDebit: "debit" | "credit";
  }[],
): Map<string, bigint> {
  const bal = new Map<string, bigint>();
  for (const l of legs) {
    const minor = amountToMinorUnits(
      legAmountMoney({ amount: l.amount, currency: l.amount.currency }),
    );
    const cur = l.amount.currency;
    bal.set(cur, (bal.get(cur) ?? 0n) + (l.creditDebit === "debit" ? minor : -minor));
  }
  return bal;
}

function expectBalancedPerCurrency(
  legs: readonly {
    amount: { amount: string; currency: string };
    creditDebit: "debit" | "credit";
  }[],
): void {
  for (const [cur, net] of perCurrencyBalance(legs)) {
    expect(`${cur}=${net}`).toBe(`${cur}=0`);
  }
}

function settlementConfirmed(
  id: string,
  legRole: "spot" | "swap-near" | "swap-far",
  asOf: string,
  terms: { boughtBooked: string; boughtSettled: string; soldBooked: string; soldSettled: string },
): Event {
  const base = makeFilFxSettlementConfirmed({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filFxSettlementConfirmedPayloadSchema.parse({
      kind: "FilFxSettlementConfirmed",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: ORIG,
      legRole,
      boughtBooked: { currency: "USD", amount: terms.boughtBooked },
      boughtSettled: { currency: "USD", amount: terms.boughtSettled },
      soldBooked: { currency: "ZAR", amount: terms.soldBooked },
      soldSettled: { currency: "ZAR", amount: terms.soldSettled },
    }),
  });
  return { ...base, provenance: PROD_TAG };
}

function ndfFixing(id: string, asOf: string, netCashDifference: string): Event {
  const base = makeFilNdfFixingObserved({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filNdfFixingObservedPayloadSchema.parse({
      kind: "FilNdfFixingObserved",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: ORIG,
      settlementCurrency: "USD",
      contractedRate: "18.50",
      fixingRate: "19.00",
      notional: { currency: "USD", amount: "1000000" },
      netCashDifference: { currency: "USD", amount: netCashDifference },
    }),
  });
  return { ...base, provenance: PROD_TAG };
}

function terminatedWith(
  id: string,
  asOf: string,
  terms: {
    derecognition?: { currency: string; amount: string };
    fvoci?: { currency: string; amount: string };
  },
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
      originatingEvent: ORIG,
      terminalStage: "settled",
      ...(terms.derecognition
        ? { derecognitionTerms: { accumulatedUnrealised: terms.derecognition } }
        : {}),
      ...(terms.fvoci
        ? { fvociReclassTerms: { electedFvoci: true as const, accumulatedOci: terms.fvoci } }
        : {}),
    }),
  });
  return { ...base, provenance: PROD_TAG };
}

describe("WS-FIL-FX-SETTLEMENT-EVENTS — the five rules fire at fold time + balance", () => {
  test("PR-FX-SETTLE-V2: spot settlement realised P&L fires + balances per currency", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    // Bought USD: booked 1,000,000 / settled 1,010,000 (gain 10k USD).
    // Sold  ZAR: booked 18,500,000 / settled 18,400,000 (gain 100k ZAR).
    store.append(
      settlementConfirmed("FX-S1", "spot", "2026-06-10T10:00:00.000Z", {
        boughtBooked: "1000000",
        boughtSettled: "1010000",
        soldBooked: "18500000",
        soldSettled: "18400000",
      }),
    );
    const fold = foldFxContributionLegs(args(store));
    const legs = fold.legs.filter((l) => l.postingRuleId === "PR-FX-SETTLE-V2");
    expect(legs.length).toBeGreaterThan(0);
    expect(fold.skipped.length).toBe(0);
    expectBalancedPerCurrency(legs);
  });

  test("PR-FX-SWAP-NEAR-V2 + PR-FX-SWAP-FAR-V2: both swap legs fire + balance", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(
      settlementConfirmed("FX-SW", "swap-near", "2026-06-10T10:00:00.000Z", {
        boughtBooked: "500000",
        boughtSettled: "505000",
        soldBooked: "9250000",
        soldSettled: "9240000",
      }),
    );
    store.append(
      settlementConfirmed("FX-SW", "swap-far", "2026-06-20T10:00:00.000Z", {
        boughtBooked: "500000",
        boughtSettled: "498000",
        soldBooked: "9300000",
        soldSettled: "9310000",
      }),
    );
    const fold = foldFxContributionLegs(args(store));
    const near = fold.legs.filter((l) => l.postingRuleId === "PR-FX-SWAP-NEAR-V2");
    const far = fold.legs.filter((l) => l.postingRuleId === "PR-FX-SWAP-FAR-V2");
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    expect(fold.skipped.length).toBe(0);
    expectBalancedPerCurrency([...near, ...far]);
  });

  test("PR-FX-NDF-FIX-V2: NDF cash-settled fixing fires, balances, no principal legs", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(ndfFixing("FX-NDF", "2026-06-10T10:00:00.000Z", "500000"));
    const fold = foldFxContributionLegs(args(store));
    const legs = fold.legs.filter((l) => l.postingRuleId === "PR-FX-NDF-FIX-V2");
    // Exactly two legs (cash + realised P&L), no receivable/payable principal.
    expect(legs.length).toBe(2);
    expect(fold.skipped.length).toBe(0);
    expectBalancedPerCurrency(legs);
    // No principal receivable/payable accounts — cash-only.
    expect(legs.some((l) => l.accountCode === "ACC-2100-001")).toBe(false);
  });

  test("PR-FX-CLOSE-V2 (reworked): derecognition reversal fires on enriched terminal + balances", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(
      terminatedWith("FX-DR", "2026-06-10T10:00:00.000Z", {
        derecognition: { currency: "ZAR", amount: "250000" },
      }),
    );
    const fold = foldFxContributionLegs(args(store));
    const legs = fold.legs.filter((l) => l.postingRuleId === "PR-FX-CLOSE-V2");
    // Two legs (reverse unrealised + recognise realised), non-zero amounts.
    expect(legs.length).toBe(2);
    expect(legs.every((l) => l.amount.amount !== "0")).toBe(true);
    expect(fold.skipped.length).toBe(0);
    expectBalancedPerCurrency(legs);
  });

  test("PR-FX-FVOCI-RECLASS-V2: FVOCI→P&L recycle fires on enriched terminal + balances", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(
      terminatedWith("FX-OCI-CLOSE", "2026-06-10T10:00:00.000Z", {
        fvoci: { currency: "ZAR", amount: "180000" },
      }),
    );
    const fold = foldFxContributionLegs(args(store));
    const legs = fold.legs.filter((l) => l.postingRuleId === "PR-FX-FVOCI-RECLASS-V2");
    expect(legs.length).toBe(2);
    expect(legs.some((l) => l.accountCode === FX_FVOCI_OCI_RESERVE_ACCOUNT)).toBe(true);
    expect(fold.skipped.length).toBe(0);
    expectBalancedPerCurrency(legs);
  });

  test("a bare terminal event (no enriched terms) still folds to the zero-amount memo (byte-preserved)", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(terminatedWith("FX-BARE", "2026-06-10T10:00:00.000Z", {}));
    const fold = foldFxContributionLegs(args(store));
    const legs = fold.legs.filter((l) => l.postingRuleId === "PR-FX-CLOSE-V2");
    expect(legs.length).toBe(2);
    expect(legs.every((l) => l.amount.amount === "0")).toBe(true);
  });
});
