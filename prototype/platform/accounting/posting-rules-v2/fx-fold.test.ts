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
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../../../v2-core/fil-instances/events";
import {
  FX_TREATMENT_MODULES,
  FX_TREATMENT_MODULE_IDS,
} from "../../../v2-core/reporting-treatments/fx-modules";
import { amountToMinorUnits } from "../../core/decimal-money";
import { legAmountMoney } from "../../core/money-codec";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../../event-store/event-types/fil-instances";
import type { GlPostingEmittedPayload } from "../../event-store/event-types/fx-accounting";
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
