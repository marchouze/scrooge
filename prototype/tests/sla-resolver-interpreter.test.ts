// tests/sla-resolver-interpreter.test.ts
//
// Unit tests for the SLA account resolver (reject-loudly, no silent default)
// and the interpreter's reject-loudly outcomes (no-eligible-rule, ambiguous,
// resolver-miss, unbalanced, intentional-no-impact) + specificity precedence.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { isAccountId } from "../platform/accounting/sla/generated/sla-types";
import type { SlaRule } from "../platform/accounting/sla/generated/sla-types";
import { type InterpreterEvent, interpret } from "../platform/accounting/sla/interpreter";
import {
  AccountResolver,
  IFRS_FX_SPOT_RESOLVER_ROWS,
  defaultResolver,
} from "../platform/accounting/sla/resolver";
import { PR_FX_001 } from "../platform/accounting/sla/rules/pr-fx-001";

const KEY_BASE = {
  entity: "LE-ZA-HOZ-BANK",
  product: "FX-spot",
  jurisdiction: "ZA",
  representation: "IFRS",
};

describe("account resolver — precedence", () => {
  it("exact currency wins (ZAR → ACC-2100-001)", () => {
    const r = defaultResolver.resolve({ ...KEY_BASE, currency: "ZAR", logical: "fx.receivable" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.physical).toBe("ACC-2100-001");
      expect(r.via).toBe("exact");
    }
  });

  it("currency-pool ('*') resolves any non-exact currency to the FCY pool", () => {
    for (const ccy of ["USD", "EUR", "GBP", "JPY"]) {
      const r = defaultResolver.resolve({ ...KEY_BASE, currency: ccy, logical: "fx.receivable" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.physical).toBe("ACC-2100-002");
        expect(r.via).toBe("currency-pool");
      }
    }
  });

  it("payable resolves to its own accounts (ZAR → 003, pool → 004)", () => {
    const zar = defaultResolver.resolve({ ...KEY_BASE, currency: "ZAR", logical: "fx.payable" });
    const usd = defaultResolver.resolve({ ...KEY_BASE, currency: "USD", logical: "fx.payable" });
    expect(zar.ok && zar.physical).toBe("ACC-2100-003");
    expect(usd.ok && usd.physical).toBe("ACC-2100-004");
  });
});

describe("account resolver — reject loudly (NO silent default)", () => {
  it("rejects an unknown logical account", () => {
    const r = defaultResolver.resolve({ ...KEY_BASE, currency: "ZAR", logical: "fx.nonexistent" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("no-matching-row");
      expect(r.candidates).toBe(0);
    }
  });

  it("rejects an unknown product (no covering pool row)", () => {
    const r = defaultResolver.resolve({
      ...KEY_BASE,
      product: "bond",
      currency: "ZAR",
      logical: "fx.receivable",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown entity", () => {
    const r = defaultResolver.resolve({
      ...KEY_BASE,
      entity: "LE-GB-LONDON-BRANCH",
      currency: "ZAR",
      logical: "fx.receivable",
    });
    expect(r.ok).toBe(false);
  });

  it("constructor rejects a row targeting a non-existent COA account", () => {
    expect(
      () =>
        new AccountResolver([
          {
            entity: "LE-ZA-HOZ-BANK",
            product: "FX-spot",
            currency: "ZAR",
            jurisdiction: "ZA",
            representation: "IFRS",
            logical: "fx.bogus",
            // @ts-expect-error — intentionally invalid AccountId to prove the guard.
            physical: "ACC-9999-999",
          },
        ]),
    ).toThrow();
  });

  it("every default resolver row targets a real COA leaf", () => {
    for (const row of IFRS_FX_SPOT_RESOLVER_ROWS) {
      expect(isAccountId(row.physical)).toBe(true);
    }
  });
});

function fxEvent(overrides: Partial<InterpreterEvent> = {}): InterpreterEvent {
  return {
    type: "FxTradeExecuted",
    entity: "LE-ZA-HOZ-BANK",
    as_of: "2026-06-05T10:00:00.000Z",
    payload: {
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: 1_900_000_000 },
          counterNotional: { currency: "USD", amountMinor: 100_000_000 },
        },
      ],
    },
    ...overrides,
  };
}

describe("interpreter — happy path", () => {
  it("posts PR-FX-001 for an in-scope FX-spot trade", () => {
    const results = interpret(fxEvent(), [PR_FX_001], ["IFRS"], "2026-06-05T10:00:00.000Z");
    expect(results).toHaveLength(1);
    expect(results[0]?.outcome).toBe("post");
  });
});

describe("interpreter — reject loudly", () => {
  it("no-eligible-rule when nothing matches the representation", () => {
    const results = interpret(fxEvent(), [PR_FX_001], ["IFRS"], "2026-06-05T10:00:00.000Z");
    // wrong entity → context entity mismatch → no rule matches
    const wrongEntity = interpret(
      fxEvent({ entity: "LE-GB-LONDON-BRANCH" }),
      [PR_FX_001],
      ["IFRS"],
      "2026-06-05T10:00:00.000Z",
    );
    expect(results[0]?.outcome).toBe("post");
    expect(wrongEntity[0]?.outcome).toBe("rejected");
    if (wrongEntity[0]?.outcome === "rejected") {
      expect(wrongEntity[0].reason).toBe("no-eligible-rule");
    }
  });

  it("rejects when the effective-date window excludes the event", () => {
    const results = interpret(
      fxEvent({ as_of: "2025-12-31T10:00:00.000Z" }),
      [PR_FX_001],
      ["IFRS"],
      "2025-12-31T10:00:00.000Z",
    );
    expect(results[0]?.outcome).toBe("rejected");
  });

  it("flags ambiguity on an equal-specificity tie", () => {
    const twin: SlaRule = { ...PR_FX_001, rule_id: "PR-FX-001B", cites: [...PR_FX_001.cites] };
    const results = interpret(fxEvent(), [PR_FX_001, twin], ["IFRS"], "2026-06-05T10:00:00.000Z");
    expect(results[0]?.outcome).toBe("ambiguous");
    if (results[0]?.outcome === "ambiguous") {
      expect(results[0].candidateRuleIds.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns resolver-miss when a rule references an unresolvable account", () => {
    const badRule: SlaRule = {
      ...PR_FX_001,
      rule_id: "PR-FX-BAD",
      lines: [
        {
          account: { logical: "fx.does_not_exist", currency: "event.near.payCurrency" },
          side: "debit",
          amount: "abs(event.near.notional.amountMinor)",
          currency: "event.near.payCurrency",
        },
      ],
    };
    const results = interpret(fxEvent(), [badRule], ["IFRS"], "2026-06-05T10:00:00.000Z");
    expect(results[0]?.outcome).toBe("rejected");
    if (results[0]?.outcome === "rejected") {
      expect(results[0].reason).toBe("resolver-miss");
    }
  });

  it("rejects an unbalanced rule (DR != CR per currency)", () => {
    const unbalanced: SlaRule = {
      ...PR_FX_001,
      rule_id: "PR-FX-UNBAL",
      lines: [
        {
          account: { logical: "fx.receivable", currency: "event.near.payCurrency" },
          side: "debit",
          amount: "abs(event.near.notional.amountMinor)",
          currency: "event.near.payCurrency",
        },
        // missing the offsetting credit → ZAR does not net to zero
      ],
    };
    const results = interpret(fxEvent(), [unbalanced], ["IFRS"], "2026-06-05T10:00:00.000Z");
    expect(results[0]?.outcome).toBe("rejected");
    if (results[0]?.outcome === "rejected") {
      expect(results[0].reason).toBe("unbalanced");
    }
  });

  it("treats intentional-no-impact as the only legitimate non-posting", () => {
    const memo: SlaRule = {
      ...PR_FX_001,
      rule_id: "PR-FX-MEMO",
      condition: { kind: "intentional-no-impact", detail: "memo only" },
      lines: [],
    };
    const results = interpret(fxEvent(), [memo], ["IFRS"], "2026-06-05T10:00:00.000Z");
    expect(results[0]?.outcome).toBe("intentional-no-impact");
  });
});

describe("interpreter — dry-run purity", () => {
  it("emits nothing and is referentially transparent", () => {
    const a = interpret(fxEvent(), [PR_FX_001], ["IFRS"], "2026-06-05T10:00:00.000Z");
    const b = interpret(fxEvent(), [PR_FX_001], ["IFRS"], "2026-06-05T10:00:00.000Z");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("interpreter — representation partitioning", () => {
  it("an IFRS rule does not fire for a non-active representation", () => {
    // Only SARB-BA-RETURN active → no IFRS rule eligible → rejected per rep.
    const results = interpret(
      fxEvent(),
      [PR_FX_001],
      ["SARB-BA-RETURN"],
      "2026-06-05T10:00:00.000Z",
    );
    expect(results[0]?.outcome).toBe("rejected");
  });
});
