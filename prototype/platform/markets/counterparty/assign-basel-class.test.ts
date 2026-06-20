// platform/markets/counterparty/assign-basel-class.test.ts
//
// M6 — SUT Basel-class assignment from the external rating feed. Asserts the
// CRE20 rating→class mapping, the fail-closed conservative fallback when no
// rating is on the feed, and the downgrade→reclassification path.
//
// Authority: D-FX-V2-SIMULATOR-FIRST; BCBS CRE20. Author: Atlas.

import { describe, expect, test } from "bun:test";

import { EventStore } from "../../event-store/store";
import { emitExternalCreditRating } from "../../simulation-v2/sim-modules/credit-rating-feed";
import {
  CONSERVATIVE_FALLBACK_CLASS,
  assignBaselClassFromFeed,
  mapToBaselClass,
  ratingNotchToBucket,
} from "./assign-basel-class";

const SCENARIO = "m6-test";

describe("M6 — rating notch → CRE20 bucket", () => {
  test("notch buckets follow CRE20 thresholds", () => {
    expect(ratingNotchToBucket("AAA")).toBe("aaa-aa");
    expect(ratingNotchToBucket("AA-")).toBe("aaa-aa");
    expect(ratingNotchToBucket("A")).toBe("a");
    expect(ratingNotchToBucket("BBB-")).toBe("bbb");
    expect(ratingNotchToBucket("BB+")).toBe("bb");
    expect(ratingNotchToBucket("B")).toBe("below-bb");
    expect(ratingNotchToBucket("D")).toBe("below-bb");
  });
});

describe("M6 — (type, bucket) → Basel class", () => {
  test("a BBB bank maps to bank; a BBB corporate to corporate-ig; a BB corporate to non-ig", () => {
    expect(mapToBaselClass("bank", "bbb")).toBe("bank");
    expect(mapToBaselClass("corporate", "bbb")).toBe("corporate-ig");
    expect(mapToBaselClass("corporate", "a")).toBe("corporate-ig");
    expect(mapToBaselClass("corporate", "bb")).toBe("corporate-non-ig");
    expect(mapToBaselClass("corporate", "below-bb")).toBe("corporate-non-ig");
    expect(mapToBaselClass("sovereign-domestic-currency", "aaa-aa")).toBe(
      "sovereign-domestic-currency",
    );
  });
});

describe("M6 — assignBaselClassFromFeed (SUT)", () => {
  test("maps a rated counterparty from the feed", () => {
    const store = new EventStore(":memory:");
    emitExternalCreditRating({
      store,
      scenarioId: SCENARIO,
      asOf: "2026-02-02T08:00:00.000Z",
      counterpartyId: "CP-BANK-AA",
      rating: { agency: "S&P", rating: "AA-", counterpartyType: "bank" },
      action: "initial",
    });
    const r = assignBaselClassFromFeed({
      store,
      scenarioId: SCENARIO,
      counterpartyId: "CP-BANK-AA",
      asOf: "2026-02-02T17:00:00.000Z",
    });
    expect(r.assigned).toBe(true);
    expect(r.baselClass).toBe("bank");
    expect(r.usedFallback).toBe(false);
    const assignments = [...store.replay({ type: "CounterpartyBaselClassAssigned" })];
    expect(assignments.length).toBe(1);
    expect((assignments[0]?.payload as { ratingBucket?: string }).ratingBucket).toBe("aaa-aa");
    store.close();
  });

  test("FAIL-CLOSED: no rating on the feed → conservative corporate-non-ig", () => {
    const store = new EventStore(":memory:");
    const r = assignBaselClassFromFeed({
      store,
      scenarioId: SCENARIO,
      counterpartyId: "CP-UNRATED",
      asOf: "2026-02-02T17:00:00.000Z",
    });
    expect(r.assigned).toBe(true);
    expect(r.usedFallback).toBe(true);
    expect(r.baselClass).toBe(CONSERVATIVE_FALLBACK_CLASS);
    expect(r.baselClass).toBe("corporate-non-ig");
    store.close();
  });

  test("idempotent: re-assigning an unchanged rating emits nothing", () => {
    const store = new EventStore(":memory:");
    emitExternalCreditRating({
      store,
      scenarioId: SCENARIO,
      asOf: "2026-02-02T08:00:00.000Z",
      counterpartyId: "CP-CORP-A",
      rating: { agency: "Fitch", rating: "A", counterpartyType: "corporate" },
      action: "initial",
    });
    const first = assignBaselClassFromFeed({
      store,
      scenarioId: SCENARIO,
      counterpartyId: "CP-CORP-A",
      asOf: "2026-02-02T17:00:00.000Z",
    });
    expect(first.assigned).toBe(true);
    expect(first.baselClass).toBe("corporate-ig");
    const second = assignBaselClassFromFeed({
      store,
      scenarioId: SCENARIO,
      counterpartyId: "CP-CORP-A",
      asOf: "2026-02-03T17:00:00.000Z",
    });
    expect(second.assigned).toBe(false);
    expect([...store.replay({ type: "CounterpartyBaselClassAssigned" })].length).toBe(1);
    store.close();
  });

  test("downgrade: a mid-scenario revision reclassifies (IG → non-IG)", () => {
    const store = new EventStore(":memory:");
    emitExternalCreditRating({
      store,
      scenarioId: SCENARIO,
      asOf: "2026-02-02T08:00:00.000Z",
      counterpartyId: "CP-CORP-DG",
      rating: { agency: "S&P", rating: "BBB", counterpartyType: "corporate" },
      action: "initial",
    });
    const before = assignBaselClassFromFeed({
      store,
      scenarioId: SCENARIO,
      counterpartyId: "CP-CORP-DG",
      asOf: "2026-02-02T17:00:00.000Z",
    });
    expect(before.baselClass).toBe("corporate-ig");

    // Downgrade to BB+ mid-scenario.
    emitExternalCreditRating({
      store,
      scenarioId: SCENARIO,
      asOf: "2026-02-10T08:00:00.000Z",
      counterpartyId: "CP-CORP-DG",
      rating: { agency: "S&P", rating: "BB+", counterpartyType: "corporate" },
      action: "revision",
    });
    const after = assignBaselClassFromFeed({
      store,
      scenarioId: SCENARIO,
      counterpartyId: "CP-CORP-DG",
      asOf: "2026-02-10T17:00:00.000Z",
    });
    expect(after.assigned).toBe(true);
    expect(after.baselClass).toBe("corporate-non-ig");
    expect([...store.replay({ type: "CounterpartyBaselClassAssigned" })].length).toBe(2);
    store.close();
  });
});
