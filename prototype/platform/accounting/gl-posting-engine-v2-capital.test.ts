// platform/accounting/gl-posting-engine-v2-capital.test.ts
//
// Unit tests for the WS-V2-AUTHORITATIVE S7 V2 capital GL posting engine. Proves
// balanced double-entry, the credit hits the contribution's COA capital account
// (so the BA-700 V2 capital fold byte-matches V1), decimal-native MoneyWire off
// the minor-encoded V1 trigger, currency-agnosticism, the zero-amount skip, the
// off-capital-account guard, and the fail-closed malformed-payload skip.
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-PHASE-3A.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { tenantIdSchema } from "../../v2-core/control-plane/tenant";
import type { GlPostingEmittedPayload } from "../event-store/event-types/fx-accounting";
import { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { runGlV2CapitalEngine } from "./gl-posting-engine-v2-capital";

const ACTOR: Actor = { type: "system", id: "atlas:gl-v2-capital-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = tenantIdSchema.parse("tenant:za-bank");
const ASOF = "2026-06-16T00:00:00.000Z";

/** Build a raw V1 CapitalContributionRecorded event (the S7 trigger). */
function capitalContribution(args: {
  accountId?: string;
  currency?: string;
  amountMinor?: number;
  basis?: string;
  eventId?: string;
}): Event {
  return {
    event_id: args.eventId ?? `CC-${Math.random().toString(36).slice(2)}`,
    type: "CapitalContributionRecorded",
    as_of: ASOF,
    entity: ENTITY,
    actor: ACTOR,
    citations: ["Banks-Act-94-1990-s70"],
    payload: {
      ...(args.accountId !== undefined ? { accountId: args.accountId } : {}),
      ...(args.currency !== undefined ? { currency: args.currency } : {}),
      ...(args.amountMinor !== undefined ? { amountMinor: args.amountMinor } : {}),
      ...(args.basis !== undefined ? { basis: args.basis } : {}),
    },
  };
}

function postings(store: EventStore): GlPostingEmittedPayload[] {
  return [...store.replay({ type: "GlPostingEmitted" })].map(
    (e) => e.payload as GlPostingEmittedPayload,
  );
}

describe("V2 capital GL engine — PR-CAP-001-V2 (CapitalContributionRecorded)", () => {
  test("R300m founding capital: Dr ACC-1200-001 / Cr ACC-5000-001, balanced, decimal-native", () => {
    const store = new EventStore(":memory:");
    // R300,000,000 in ZAR minor units (cents) = 30_000_000_000.
    store.append(
      capitalContribution({
        accountId: "ACC-5000-001",
        currency: "ZAR",
        amountMinor: 30_000_000_000,
        basis: "founding capital — ordinary share issuance",
      }),
    );

    const result = runGlV2CapitalEngine({
      eventStore: store,
      actor: ACTOR,
      entity: ENTITY,
      tenantId: TENANT,
    });

    expect(result.processed).toBe(1);
    expect(result.emitted).toBe(2);
    expect(result.capitalClassified).toBe(1);

    const legs = postings(store);
    expect(legs).toHaveLength(2);

    const debit = legs.find((l) => l.creditDebit === "debit");
    const credit = legs.find((l) => l.creditDebit === "credit");
    expect(debit?.accountCode).toBe("ACC-1200-001");
    expect(credit?.accountCode).toBe("ACC-5000-001");

    // Decimal-native MoneyWire — major units, currency carried (no minorUnits).
    expect(debit?.amount).toEqual({ __money: "v1", amount: "300000000", currency: "ZAR" });
    expect(credit?.amount).toEqual({ __money: "v1", amount: "300000000", currency: "ZAR" });

    // Balanced double-entry: Σdebit == Σcredit.
    expect(debit?.amount.amount).toBe(credit?.amount.amount);
    expect(credit?.postingRuleId).toBe("PR-CAP-001-V2");
  });

  test("T2 subordinated debt contribution credits the T2 account (ACC-5200-001)", () => {
    const store = new EventStore(":memory:");
    store.append(
      capitalContribution({
        accountId: "ACC-5200-001",
        currency: "ZAR",
        amountMinor: 5_000_000_00,
        basis: "subordinated debt issuance — T2",
      }),
    );
    const result = runGlV2CapitalEngine({
      eventStore: store,
      actor: ACTOR,
      entity: ENTITY,
      tenantId: TENANT,
    });
    expect(result.capitalClassified).toBe(1);
    const credit = postings(store).find((l) => l.creditDebit === "credit");
    expect(credit?.accountCode).toBe("ACC-5200-001");
  });

  test("currency-agnostic: a USD contribution carries USD on the leg (no hardcoded ZAR)", () => {
    const store = new EventStore(":memory:");
    store.append(
      capitalContribution({
        accountId: "ACC-5000-001",
        currency: "USD",
        amountMinor: 1_000_000_00,
      }),
    );
    runGlV2CapitalEngine({ eventStore: store, actor: ACTOR, entity: ENTITY, tenantId: TENANT });
    for (const l of postings(store)) expect(l.amount.currency).toBe("USD");
  });

  test("off-capital-account contribution still posts a balanced pair but is not capital-classified", () => {
    const store = new EventStore(":memory:");
    store.append(
      capitalContribution({ accountId: "ACC-9999-001", currency: "ZAR", amountMinor: 100_00 }),
    );
    const result = runGlV2CapitalEngine({
      eventStore: store,
      actor: ACTOR,
      entity: ENTITY,
      tenantId: TENANT,
    });
    expect(result.emitted).toBe(2); // balanced pair still emitted (event happened)
    expect(result.capitalClassified).toBe(0); // not in the capital fold
  });

  test("zero-amount contribution emits no posting (V1 non-zero-delta skip)", () => {
    const store = new EventStore(":memory:");
    store.append(
      capitalContribution({ accountId: "ACC-5000-001", currency: "ZAR", amountMinor: 0 }),
    );
    const result = runGlV2CapitalEngine({
      eventStore: store,
      actor: ACTOR,
      entity: ENTITY,
      tenantId: TENANT,
    });
    expect(result.emitted).toBe(0);
    expect(result.processed).toBe(1);
  });

  test("fail-closed: malformed contribution (missing currency) emits no posting", () => {
    const store = new EventStore(":memory:");
    store.append(capitalContribution({ accountId: "ACC-5000-001", amountMinor: 100_00 }));
    const result = runGlV2CapitalEngine({
      eventStore: store,
      actor: ACTOR,
      entity: ENTITY,
      tenantId: TENANT,
    });
    expect(result.emitted).toBe(0);
  });

  test("non-trigger events are ignored", () => {
    const store = new EventStore(":memory:");
    store.append({
      event_id: "X-1",
      type: "SomethingElse",
      as_of: ASOF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["x"],
      payload: {},
    });
    const result = runGlV2CapitalEngine({
      eventStore: store,
      actor: ACTOR,
      entity: ENTITY,
      tenantId: TENANT,
    });
    expect(result.processed).toBe(0);
    expect(result.emitted).toBe(0);
  });
});
