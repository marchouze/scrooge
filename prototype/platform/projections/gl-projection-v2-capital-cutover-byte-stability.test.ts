// platform/projections/gl-projection-v2-capital-cutover-byte-stability.test.ts
//
// D-FIL-CONSUMER-SURFACE-ARCHITECTURE (capital sub-step) — BYTE-STABILITY PROOF
// FOR THE CAPITAL CUTOVER.
//
// `gl-projection-v2.ts` now sources its CAPITAL contribution from the STATE-driven
// `deriveCapitalInstanceLegs` (the FIL instance register) instead of the raw-event
// fold `foldCapitalContributionLegs`. The two are proven byte-equivalent at the
// leg-net level by `capital-instance-fold.test.ts`.
//
// This suite proves the CUTOVER itself is byte-stable at the TRIAL-BALANCE level:
// `computeTrialBalanceV2Uncached` (the live production path — now capital
// state-driven) produces a TrialBalance byte-identical to a REFERENCE trial
// balance whose capital contribution is sourced from the OLD event fold, with
// every other source identical. The two TBs must agree exactly — rows,
// per-currency totals, and uptoSequence — under BOTH provenance lenses
// (production-only and combined) on the same fixture book. Any drift would be a
// real cutover regression.
//
// The reference TB re-runs the projection's exact capital accumulation but with
// `foldCapitalContributionLegs` as the capital source — so the only variable
// between the production path and the reference is event-fold vs state-derivation.
//
// Same build-phase fixture pattern as fx-cutover-byte-stability.test.ts: raw
// EventStore(":memory:") seeds FIL capital events (production + simulated cohort);
// not a production access path. T-01 carve-out. F-031.
//
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import type {
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../../v2-core/fil-models/capital/types/capital-type-definitions";
import type { TrialBalance } from "../accounting/period-close";
import { foldCapitalContributionLegs } from "../accounting/posting-rules-v2/capital-fold";
import { amountToMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../event-store/event-types/fil-instances";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import {
  type ProvenanceFilter,
  type ProvenanceMode,
  setDefaultProvenanceModeOverride,
} from "./filter";
import { computeTrialBalanceV2Uncached } from "./gl-projection-v2";

const ACTOR: Actor = { type: "system", id: "atlas:capital-cutover-byte-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["D-FIL-CONSUMER-SURFACE-ARCHITECTURE"];
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";

const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "capital-cutover-byte-test" };
const SIM_TAG: ProvenanceTag = {
  kind: "simulated",
  scenario: "capital-cutover-byte-test",
  sourceLineage: "capital-cutover-byte-test-sim",
};

function capCreated(
  id: string,
  amount: string,
  asOf: string,
  provenance: ProvenanceTag = PROD_TAG,
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: id });
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf,
    originatingEvent: { eventType: "CapitalSubscriptionConfirmed", eventId: `cap:${id}` },
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
  const base = makeFilInstrumentCreated({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance,
    payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
      typeof makeFilInstrumentCreated
    >[0]["payload"],
  });
  globalStore.append({ ...base, provenance });
}

function capTerminated(
  id: string,
  asOf: string,
  terminalStage: "settled" | "matured" | "cancelled" | "terminated",
  provenance: ProvenanceTag = PROD_TAG,
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: id });
  const payload = {
    kind: "FilInstrumentTerminated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf,
    originatingEvent: { eventType: "CapitalRedemptionConfirmed", eventId: `cap:${id}:term` },
    terminalStage,
  };
  const base = makeFilInstrumentTerminated({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance,
    payload: payload as unknown as FilInstrumentTerminatedPayload as Parameters<
      typeof makeFilInstrumentTerminated
    >[0]["payload"],
  });
  globalStore.append({ ...base, provenance });
}

// The per-test store, set in each test body (capCreated/capTerminated append to it).
let globalStore: EventStore;

// ---------------------------------------------------------------------------
// Reference trial balance — the projection's EXACT capital accumulation, but with
// the OLD event fold (`foldCapitalContributionLegs`) as the capital source. The
// fixtures carry no GlPostingEmitted / FX events, so capital is the sole
// contributor — exactly the surface the cutover touched.
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

  const capitalFold = foldCapitalContributionLegs({
    eventStore: store,
    entity: ENTITY,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    filter,
  });
  for (const leg of capitalFold.legs) {
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

/** A mixed capital book: production issuance + a cancelled instance + a simulated
 *  injection (admitted only under combined). */
function seedMixedCapitalBook(store: EventStore): void {
  globalStore = store;
  // Production CET1 issuance (R100m) — stands.
  capCreated("CAP-A", "100000000", "2026-06-01T00:00:00.000Z");
  // Production issuance then CANCELLED — zero memo, position stands (no reversal).
  capCreated("CAP-B", "50000000", "2026-06-02T00:00:00.000Z");
  capTerminated("CAP-B", "2026-06-10T00:00:00.000Z", "cancelled");
  // Simulated R300m injection — admitted under combined, held out under production.
  capCreated("CAP-SIM", "300000000", "2026-06-21T00:00:00.000Z", SIM_TAG);
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

describe("capital cutover byte-stability — state-derived TB == event-fold TB", () => {
  for (const lens of LENSES) {
    test(`mixed capital book is byte-identical pre/post cutover under the ${lens.name} lens`, () => {
      const store = new EventStore(":memory:");
      seedMixedCapitalBook(store);
      const filter: ProvenanceFilter = { mode: lens.mode };

      // Live production path — now sources capital from deriveCapitalInstanceLegs.
      const live = computeTrialBalanceV2Uncached({
        eventStore: store,
        entity: ENTITY,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        filter,
      });
      // Reference — same accumulation, capital from foldCapitalContributionLegs.
      const reference = referenceTrialBalanceFromEventFold(store, filter);

      expect(canonical(live)).toBe(canonical(reference));
      // Non-vacuous: the book produced standing capital balances.
      expect(live.rows.length).toBeGreaterThan(0);
    });
  }

  test("the two lenses produce structurally DISTINCT TBs (the test is discriminating)", () => {
    const store = new EventStore(":memory:");
    seedMixedCapitalBook(store);
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
    // The simulated R300m injection (CAP-SIM) is admitted only under combined, so
    // the two lenses MUST differ — proving byte-identity above is a real match,
    // not a degenerate "both empty" pass.
    expect(canonical(prodTb)).not.toBe(canonical(combinedTb));
  });

  test("R300m invariant: combined TB shows Cr Share Capital / Dr nostro = R300m+", () => {
    const store = new EventStore(":memory:");
    seedMixedCapitalBook(store);
    const tb = computeTrialBalanceV2Uncached({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter: { mode: "combined" },
    });
    // Production (R100m + R50m) + simulated R300m = R450m total under combined.
    const shareCapital = tb.rows.find((r) => r.leafAccountId === "ACC-5000-001");
    const nostro = tb.rows.find((r) => r.leafAccountId === "ACC-1200-001");
    expect(shareCapital?.amountMinor).toBe(-45_000_000_000);
    expect(nostro?.amountMinor).toBe(45_000_000_000);
  });
});
