// platform/projections/gl-projection-v2-fx-cutover-byte-stability.test.ts
//
// Step C of D-FIL-CONSUMER-SURFACE-ARCHITECTURE — BYTE-STABILITY PROOF FOR THE
// FX CUTOVER.
//
// `gl-projection-v2.ts` now sources its FX contribution from the STATE-driven
// `deriveFxInstanceLegs` (the FIL instance register) instead of the raw-event
// fold `foldFxContributionLegs`. The two are proven byte-equivalent at the
// leg-net level by `fx-instance-fold.test.ts` + `recon:gl-v2-fold-equivalence-fx`.
//
// This suite proves the CUTOVER itself is byte-stable at the TRIAL-BALANCE level:
// `computeTrialBalanceV2Uncached` (the live production path — now state-driven)
// produces a TrialBalance byte-identical to a REFERENCE trial balance whose FX
// contribution is sourced from the OLD event fold, with every other source
// (GlPostingEmitted, capital) identical. The two TBs must agree exactly — rows,
// per-currency totals, and uptoSequence — under BOTH provenance lenses
// (production-only and combined) on the same fixture book. Any drift would be a
// real cutover regression, not a hidden one.
//
// The reference TB is built by re-running the projection's exact accumulation
// algorithm but with `foldFxContributionLegs` as the FX source — so the only
// variable between the production path and the reference is event-fold vs
// state-derivation. Equal TBs ⇒ the cutover is a no-op on the bytes.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   D-ENGINEERING-INTEGRITY-CHARTER (no green by concealment; replay-safe).
//   Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../../v2-core/fil-instances/events";
import { FX_TREATMENT_MODULES } from "../../v2-core/reporting-treatments/fx-modules";
import type { TrialBalance } from "../accounting/period-close";
import { foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
import { amountToMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../event-store/event-types/fil-instances";
import { makeReportingTreatmentDeclared } from "../event-store/event-types/reporting-treatments";
import { EventStore } from "../event-store/store";
import type { Actor, Event, ProvenanceTag } from "../event-store/types";
import {
  type ProvenanceFilter,
  type ProvenanceMode,
  setDefaultProvenanceModeOverride,
} from "./filter";
import { computeTrialBalanceV2Uncached } from "./gl-projection-v2";

const ACTOR: Actor = { type: "system", id: "atlas:fx-cutover-byte-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["D-FIL-CONSUMER-SURFACE-ARCHITECTURE"];
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";
const TENANT = "tenant:za-bank";
const FX_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";

const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "fx-cutover-byte-test" };
const SIM_TAG: ProvenanceTag = {
  kind: "simulated",
  scenario: "fx-cutover-byte-test",
  sourceLineage: "fx-cutover-byte-test-sim",
};

function instanceUrn(id: string): string {
  return `fil:inst:${ENTITY}:${id}`;
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
    provenance,
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
        // D-FX-INSTRUMENT-BUYSELL-QUAD: USD/ZAR ⇒ base=USD, quote=ZAR. long ⇒
        // bought USD (base), sold ZAR; short ⇒ bought ZAR, sold USD. The ZAR leg
        // magnitude == notional (the instrument-currency leg).
        fxAgreement:
          direction === "long"
            ? {
                buy: { currency: "USD", amount: notional },
                sell: { currency: "ZAR", amount: notional },
              }
            : {
                buy: { currency: "ZAR", amount: notional },
                sell: { currency: "USD", amount: notional },
              },
      },
    }),
  });
  return { ...base, provenance };
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
    provenance,
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

// ---------------------------------------------------------------------------
// Reference trial balance — the projection's EXACT accumulation, but with the
// OLD event fold (`foldFxContributionLegs`) as the FX source. Mirrors
// computeTrialBalanceV2Uncached's GlPostingEmitted-skip + FX-fold + balance
// accumulation byte-for-byte; the ONLY variable vs the live path is the FX
// source. The fixtures here carry no GlPostingEmitted and no capital events, so
// the FX fold is the sole contributor — exactly the surface the cutover touched.
// ---------------------------------------------------------------------------

interface RefRow {
  account: string;
  currency: string;
  amount: number;
}

function referenceTrialBalanceFromEventFold(
  store: EventStore,
  filter: ProvenanceFilter,
): TrialBalance {
  const balances = new Map<string, RefRow>();
  let uptoSequence = 0;

  const fxFold = foldFxContributionLegs({
    eventStore: store,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    filter,
  });
  for (const leg of fxFold.legs) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    const row = balances.get(key) ?? {
      account: leg.accountCode,
      currency: leg.amount.currency,
      amount: 0,
    };
    row.amount += leg.creditDebit === "debit" ? legMinor : -legMinor;
    balances.set(key, row);
    uptoSequence += 1;
  }

  // Build sorted rows (drop zero-balance entries) and per-currency totals using
  // the projection's EXACT algorithm — TrialBalanceSnapshotRow shape is
  // { leafAccountId, currency, amountMinor } with amountMinor signed (positive =
  // debit balance, negative = credit balance).
  const rows = [...balances.values()]
    .filter((r) => r.amount !== 0)
    .map((r) => ({ leafAccountId: r.account, currency: r.currency, amountMinor: r.amount }));
  rows.sort((a, b) => {
    if (a.leafAccountId < b.leafAccountId) return -1;
    if (a.leafAccountId > b.leafAccountId) return 1;
    return a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0;
  });

  const totalsByCurrency = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const t = totalsByCurrency.get(row.currency) ?? { debit: 0, credit: 0 };
    if (row.amountMinor >= 0) t.debit += row.amountMinor;
    else t.credit += -row.amountMinor;
    totalsByCurrency.set(row.currency, t);
  }
  const perCurrencyTotals = [...totalsByCurrency.entries()]
    .map(([currency, t]) => ({ currency, debitMinor: t.debit, creditMinor: t.credit }))
    .sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));

  return { rows, perCurrencyTotals, uptoSequence };
}

/** A canonical JSON projection so byte-identity is asserted, not deep-eq leniency.
 *  Mirrors the TrialBalanceSnapshotRow / perCurrencyTotals / uptoSequence shape. */
function canonical(tb: TrialBalance): string {
  return JSON.stringify({
    rows: [...tb.rows]
      .map((r) => ({
        leafAccountId: r.leafAccountId,
        currency: r.currency,
        amountMinor: r.amountMinor,
      }))
      .sort((a, b) =>
        a.leafAccountId === b.leafAccountId
          ? a.currency.localeCompare(b.currency)
          : a.leafAccountId.localeCompare(b.leafAccountId),
      ),
    perCurrencyTotals: [...tb.perCurrencyTotals].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    uptoSequence: tb.uptoSequence,
  });
}

/** Seed a mixed FX book exercising every lifecycle shape + a cross-lens
 *  (production creation / simulated cancellation) instance. */
function seedMixedFxBook(store: EventStore): void {
  seedTreatmentModules(store);
  // Standing recognitions (long + short, production).
  store.append(fxCreated("FX-A", "long", "9260000", "2026-06-01T10:00:00.000Z"));
  store.append(fxCreated("FX-B", "short", "6045000", "2026-06-02T10:00:00.000Z"));
  // A settled (bare close memo) instance — keeps its standing position.
  store.append(fxCreated("FX-C", "long", "3000000", "2026-06-03T10:00:00.000Z"));
  store.append(fxTerminated("FX-C", "2026-06-04T10:00:00.000Z", "settled"));
  // A bare-cancelled instance — opening reversed to zero (state stage === cancelled).
  store.append(fxCreated("FX-D", "long", "4680000", "2026-06-05T10:00:00.000Z"));
  store.append(fxTerminated("FX-D", "2026-06-22T10:00:00.000Z", "cancelled"));
  // A simulated-provenance recognition — admitted under combined, held out under
  // production-only (so the two lenses produce structurally distinct TBs, and
  // BOTH must still agree between event-fold and state-derivation).
  store.append(fxCreated("FX-SIM", "long", "1500000", "2026-06-06T10:00:00.000Z", SIM_TAG));
  // Cross-lens: production creation cancelled by a simulated cancellation. Under
  // production-only the cancellation is lens-filtered but the register state reads
  // `cancelled`, so the production opening is still reversed — the provenance-
  // decoupled net the event fold also produces.
  store.append(fxCreated("FX-XLENS", "long", "2222000", "2026-06-07T10:00:00.000Z", PROD_TAG));
  store.append(fxTerminated("FX-XLENS", "2026-06-23T10:00:00.000Z", "cancelled", SIM_TAG));
}

const LENSES: ReadonlyArray<{ name: string; mode: ProvenanceMode }> = [
  { name: "production-only", mode: "production-only" },
  { name: "combined", mode: "combined" },
];

beforeEach(() => {
  setDefaultProvenanceModeOverride("production-only");
});

afterEach(() => {
  setDefaultProvenanceModeOverride(undefined);
});

describe("FX cutover byte-stability — state-derived TB == event-fold TB", () => {
  for (const lens of LENSES) {
    test(`mixed FX book is byte-identical pre/post cutover under the ${lens.name} lens`, () => {
      const store = new EventStore(":memory:");
      seedMixedFxBook(store);
      const filter: ProvenanceFilter = { mode: lens.mode };

      // Live production path — now sources FX from deriveFxInstanceLegs (STATE).
      const live = computeTrialBalanceV2Uncached({
        eventStore: store,
        entity: ENTITY,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        filter,
      });
      // Reference — same accumulation, FX from foldFxContributionLegs (EVENTS).
      const reference = referenceTrialBalanceFromEventFold(store, filter);

      // Byte-identical: rows, per-currency totals, AND uptoSequence (leg count).
      expect(canonical(live)).toBe(canonical(reference));
      // Non-vacuous: the book actually produced standing FX balances.
      expect(live.rows.length).toBeGreaterThan(0);
    });
  }

  test("the two lenses produce structurally DISTINCT TBs (the test is discriminating)", () => {
    const store = new EventStore(":memory:");
    seedMixedFxBook(store);
    const prodTb = computeTrialBalanceV2Uncached({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter: { mode: "production-only" },
    });
    const combinedTb = computeTrialBalanceV2Uncached({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter: { mode: "combined" },
    });
    // The simulated recognition (FX-SIM) is admitted only under combined, so the
    // two lenses MUST differ — proving the byte-identity above is a real match
    // under each lens, not a degenerate "both empty" pass.
    expect(canonical(prodTb)).not.toBe(canonical(combinedTb));
  });
});
