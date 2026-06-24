// platform/accounting/posting-rules-v2/capital-fold.test.ts
//
// Tests for the CAPITAL trial-balance fold-through (D-V2-UI-VISIBILITY-REMEDIATION).
//
// Proves the coherence seam is closed:
//   1. BALANCE TEST — after the simulated R300m CET1 injection, the V2 trial
//      balance shows Cr ACC-5000-001 (Share Capital) = 30,000,000,000 minor
//      (R300,000,000) under the +Sim lens, AND the trial balance balances
//      (ΣDr = ΣCr).
//   2. PROD LENS — under `production-only` the simulated injection is excluded
//      (the honest empty state pre-licence: no real capital).
//   3. GL ⇿ BA-700 COHERENCE — the GL Share Capital credit balance EQUALS the
//      BA-700 capital-composition CET1 paid-up-ordinary-shares figure under the
//      same (+Sim) lens.
//   4. ENTRY-LEVEL — the capital legs appear in computeGlEntriesV2 with their
//      source FIL event + posting-rule id (the drill-through detail).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import type { FilInstrumentCreatedPayload } from "../../../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../../../v2-core/fil-models/capital/types/capital-type-definitions";
import { makeFilInstrumentCreated } from "../../event-store/event-types/fil-instances";
import { simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { computeCapitalComposition } from "../../projections/ba700-capital-composition";
import {
  computeGlEntriesV2Uncached,
  computeTrialBalanceV2Uncached,
} from "../../projections/gl-projection-v2";
import { foldCapitalContributionLegs } from "./capital-fold";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "system", id: "atlas:capital-fold-test" };
const CITES = ["D-V2-UI-VISIBILITY-REMEDIATION", "D-CAPITAL-ASSET-CLASS-V1"];
const AS_OF = "2026-06-21T00:00:00.000Z";
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";

const SHARE_CAPITAL_ACCOUNT = "ACC-5000-001"; // CET1 paid-up ordinary shares
const ZAR_NOSTRO_ACCOUNT = "ACC-1200-001"; // settlement cash
const R300M_MINOR = 30_000_000_000; // R300,000,000 in minor units

const SIM_PROVENANCE = simulatedTag({
  scenario: "capital-injection-cet1-300m-v2",
  sourceLineage: "atlas:capital-fold-test",
  tags: ["manual-simulation", "capital-raise", "cet1"],
});

/** Append the R300m CET1 paid-up-ordinary-shares injection (simulated). */
function seedCapitalInjection(store: EventStore, amount = "300000000"): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: "cap-cet1-300m-test" });
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: {
      eventType: "CapitalSubscriptionConfirmed",
      eventId: "CAP-V2-SIM-CET1-300M-TEST",
    },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "capital" as const,
      notional: { currency: "ZAR", amount },
      direction: "long" as const,
      counterpartyId: "urn:party:capital-provider:founding-subscription",
      nettingSetId: "NS-CAPITAL-CET1-ZAR",
      currency: "ZAR",
      settlementDate: "2026-06-21",
      qualifyingCapital: {
        tier: "cet1" as const,
        subCategory: "cet1.paid-up-ordinary-shares" as const,
      },
    },
  };
  const event = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: SIM_PROVENANCE,
    // The maker re-parses the payload through its schema (branding the URN /
    // instant fields); the plain literal is the schema's input shape.
    payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
      typeof makeFilInstrumentCreated
    >[0]["payload"],
  });
  store.append(event);
}

describe("capital fold-through — closing the GL ⇿ BA-700 coherence seam", () => {
  test("the fold produces a balanced Dr nostro / Cr share-capital pair", () => {
    const store = new EventStore(":memory:");
    seedCapitalInjection(store);

    const { legs } = foldCapitalContributionLegs({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter: { mode: "combined" },
    });

    expect(legs.length).toBe(2);
    const credit = legs.find((l) => l.creditDebit === "credit");
    const debit = legs.find((l) => l.creditDebit === "debit");
    expect(credit?.accountCode).toBe(SHARE_CAPITAL_ACCOUNT);
    expect(credit?.amount.amount).toBe("300000000");
    expect(debit?.accountCode).toBe(ZAR_NOSTRO_ACCOUNT);
    expect(debit?.amount.amount).toBe("300000000");
  });

  test("BALANCE TEST: trial balance Cr Share Capital = R300,000,000 and ΣDr = ΣCr (+Sim)", () => {
    const store = new EventStore(":memory:");
    seedCapitalInjection(store);

    const tb = computeTrialBalanceV2Uncached({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter: { mode: "combined" },
    });

    // Cr Share Capital = R300,000,000 (negative net = credit balance).
    const shareCapital = tb.rows.find((r) => r.leafAccountId === SHARE_CAPITAL_ACCOUNT);
    expect(shareCapital).toBeDefined();
    expect(shareCapital?.amountMinor).toBe(-R300M_MINOR);

    // Dr settlement-cash nostro = R300,000,000 (positive net = debit balance).
    const nostro = tb.rows.find((r) => r.leafAccountId === ZAR_NOSTRO_ACCOUNT);
    expect(nostro?.amountMinor).toBe(R300M_MINOR);

    // ΣDr = ΣCr — the double-entry invariant holds.
    const zar = tb.perCurrencyTotals.find((t) => t.currency === "ZAR");
    expect(zar?.debitMinor).toBe(R300M_MINOR);
    expect(zar?.creditMinor).toBe(R300M_MINOR);
    expect(zar?.debitMinor).toBe(zar?.creditMinor);
  });

  test("PROD LENS: the simulated injection is excluded (honest empty pre-licence)", () => {
    const store = new EventStore(":memory:");
    seedCapitalInjection(store);

    const tb = computeTrialBalanceV2Uncached({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter: { mode: "production-only" },
    });

    expect(tb.rows.find((r) => r.leafAccountId === SHARE_CAPITAL_ACCOUNT)).toBeUndefined();
    expect(tb.rows.length).toBe(0);
  });

  test("GL ⇿ BA-700 COHERENCE: GL Share Capital balance = BA-700 CET1 numerator (+Sim)", () => {
    const store = new EventStore(":memory:");
    seedCapitalInjection(store);

    const tb = computeTrialBalanceV2Uncached({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter: { mode: "combined" },
    });
    const glShareCapitalCreditMinor = -(
      tb.rows.find((r) => r.leafAccountId === SHARE_CAPITAL_ACCOUNT)?.amountMinor ?? 0
    );

    const composition = computeCapitalComposition({
      eventStore: store,
      entity: ENTITY,
      asOf: PERIOD_END,
      functionalCurrency: "ZAR",
      filter: { mode: "combined" },
    });

    // The GL Share Capital credit balance must equal the BA-700 CET1 own-funds
    // numerator (both derive the same R300m fact from the SAME capital FIL event).
    expect(glShareCapitalCreditMinor).toBe(composition.cet1Minor);
    expect(glShareCapitalCreditMinor).toBe(R300M_MINOR);

    // And the single CET1 line is the paid-up-ordinary-shares sub-category.
    const cet1Line = composition.lines.find(
      (l) => l.subCategory === "cet1.paid-up-ordinary-shares",
    );
    expect(cet1Line?.amountMinor).toBe(R300M_MINOR);
  });

  test("ENTRY-LEVEL: capital legs surface in computeGlEntriesV2 with source + posting rule", () => {
    const store = new EventStore(":memory:");
    seedCapitalInjection(store);

    const entries = computeGlEntriesV2Uncached({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      filter: { mode: "combined" },
    });

    const capitalEntries = entries.filter((e) => e.postingRuleId?.startsWith("PR-CAP-"));
    expect(capitalEntries.length).toBe(2);
    const credit = capitalEntries.find((e) => e.debitCredit === "credit");
    expect(credit?.accountId).toBe(SHARE_CAPITAL_ACCOUNT);
    expect(credit?.postingRuleId).toBe("PR-CAP-ISSUE-001-V2");
    expect(credit?.sourceEventId).toContain("cap-cet1-300m-test");
  });
});
