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
import {
  type InterpreterEvent,
  interpret,
  urgentCorrectionToSubstrateAlert,
} from "../platform/accounting/sla/interpreter";
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

describe("account resolver — per-currency (USD=USD; no FCY pool)", () => {
  // D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE: each currency resolves to its OWN
  // account; the USD account is reachable ONLY for USD; the currency-wildcard
  // pool precedence was removed.
  it("exact ZAR receivable → ACC-2100-001", () => {
    const r = defaultResolver.resolve({ ...KEY_BASE, currency: "ZAR", logical: "fx.receivable" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.physical).toBe("ACC-2100-001");
      expect(r.via).toBe("exact");
    }
  });

  it("exact USD receivable → ACC-2100-002 (USD-only, NOT a pool)", () => {
    const r = defaultResolver.resolve({ ...KEY_BASE, currency: "USD", logical: "fx.receivable" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.physical).toBe("ACC-2100-002");
      expect(r.via).toBe("exact");
    }
  });

  it("the USD account is UNREACHABLE for a non-USD currency (no pool fallback)", () => {
    for (const ccy of ["EUR", "GBP", "JPY", "CHF", "AUD"]) {
      const r = defaultResolver.resolve({ ...KEY_BASE, currency: ccy, logical: "fx.receivable" });
      // valid axes, unmapped currency → account-resolution miss → suspense,
      // NEVER silently the USD slot (ACC-2100-002).
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe("unresolved-currency");
        expect(r.candidates).toBeGreaterThan(0); // axes valid; only currency missing
      }
    }
  });

  it("payable resolves per-currency (ZAR → 003, USD → 004; EUR → unresolved)", () => {
    const zar = defaultResolver.resolve({ ...KEY_BASE, currency: "ZAR", logical: "fx.payable" });
    const usd = defaultResolver.resolve({ ...KEY_BASE, currency: "USD", logical: "fx.payable" });
    const eur = defaultResolver.resolve({ ...KEY_BASE, currency: "EUR", logical: "fx.payable" });
    expect(zar.ok && zar.physical).toBe("ACC-2100-003");
    expect(usd.ok && usd.physical).toBe("ACC-2100-004");
    expect(eur.ok).toBe(false);
    if (!eur.ok) expect(eur.reason).toBe("unresolved-currency");
  });
});

describe("account resolver — reject loudly (NO silent default)", () => {
  // A genuine rule/config bug (unknown logical/product/entity → ZERO candidate
  // rows) is `no-matching-row` → loud reject, distinct from an unmapped-currency
  // `unresolved-currency` → suspense (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
  it("rejects an unknown logical account (no-matching-row, 0 candidates)", () => {
    const r = defaultResolver.resolve({ ...KEY_BASE, currency: "ZAR", logical: "fx.nonexistent" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("no-matching-row");
      expect(r.candidates).toBe(0);
    }
  });

  it("rejects an unknown product (no-matching-row, NOT suspense)", () => {
    const r = defaultResolver.resolve({
      ...KEY_BASE,
      product: "bond",
      currency: "ZAR",
      logical: "fx.receivable",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-matching-row");
  });

  it("rejects an unknown entity (no-matching-row, NOT suspense)", () => {
    const r = defaultResolver.resolve({
      ...KEY_BASE,
      entity: "LE-GB-LONDON-BRANCH",
      currency: "ZAR",
      logical: "fx.receivable",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-matching-row");
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

describe("interpreter — unresolved currency → suspense + urgent-correction alert", () => {
  // D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE: a non-ZAR/USD FX leg with no
  // dedicated account does NOT silently fall back to USD and is NOT dropped —
  // it posts to the FX unresolved-currency suspense account, the entry still
  // balances, and a high-severity urgent-correction alert is raised.
  function eurEvent(): InterpreterEvent {
    return fxEvent({
      payload: {
        productTaxonomy: "FX-spot",
        currencyPair: { base: "EUR", quote: "ZAR" },
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "EUR",
            notional: { currency: "ZAR", amountMinor: 2_050_000_000 },
            counterNotional: { currency: "EUR", amountMinor: 100_000_000 },
          },
        ],
      },
    });
  }

  it("routes the EUR leg to ACC-2100-007 suspense and STILL balances", () => {
    const results = interpret(eurEvent(), [PR_FX_001], ["IFRS"], "2026-06-05T10:00:00.000Z");
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r?.outcome).toBe("post");
    if (r?.outcome !== "post") return;

    // ZAR legs resolve normally; EUR legs go to the suspense account.
    const eurLegs = r.legs.filter((l) => l.currency === "EUR");
    expect(eurLegs.length).toBeGreaterThan(0);
    for (const leg of eurLegs) expect(leg.accountId).toBe("ACC-2100-007");
    // the USD account must NOT appear for a EUR trade (no silent USD fallback)
    expect(r.legs.some((l) => l.accountId === "ACC-2100-002")).toBe(false);
    expect(r.legs.some((l) => l.accountId === "ACC-2100-004")).toBe(false);

    // per-currency DR == CR still holds (EUR nets to zero within suspense)
    const byCcy = new Map<string, number>();
    for (const leg of r.legs) {
      const signed = leg.debitCredit === "debit" ? Number(leg.amountMinor) : -Number(leg.amountMinor);
      byCcy.set(leg.currency, (byCcy.get(leg.currency) ?? 0) + signed);
    }
    for (const [, net] of byCcy) expect(net).toBe(0);
  });

  it("raises a high-severity urgent-correction signal for the EUR legs", () => {
    const results = interpret(eurEvent(), [PR_FX_001], ["IFRS"], "2026-06-05T10:00:00.000Z");
    const r = results[0];
    if (r?.outcome !== "post") throw new Error("expected post");
    expect(r.urgentCorrections.length).toBeGreaterThan(0);
    for (const c of r.urgentCorrections) {
      expect(c.currency).toBe("EUR");
      expect(c.suspenseAccount).toBe("ACC-2100-007");
      expect(c.alertId).toBe("alert:integrity:sla-unresolved-currency-eur");
    }
    // and the bridge produces a real high-severity integrity SubstrateAlert
    const correction = r.urgentCorrections[0];
    if (!correction) throw new Error("expected a correction");
    const alert = urgentCorrectionToSubstrateAlert(correction, {
      asOf: "2026-06-05T10:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:bea:sla-interpreter" },
    });
    expect(alert.type).toBe("SubstrateAlert");
    const payload = alert.payload as { alertClass: string; severity: string };
    expect(payload.alertClass).toBe("integrity");
    expect(payload.severity).toBe("high");
  });

  it("a wholly-unknown currency (JPY) also routes to suspense + raises the alert", () => {
    const jpyEvent = fxEvent({
      payload: {
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "JPY" },
        legs: [
          {
            legKind: "near",
            payCurrency: "USD",
            receiveCurrency: "JPY",
            notional: { currency: "USD", amountMinor: 1_000_000 },
            counterNotional: { currency: "JPY", amountMinor: 155_000_000 },
          },
        ],
      },
    });
    const results = interpret(jpyEvent, [PR_FX_001], ["IFRS"], "2026-06-05T10:00:00.000Z");
    const r = results[0];
    expect(r?.outcome).toBe("post");
    if (r?.outcome !== "post") return;
    // USD legs resolve to the USD account; JPY legs go to suspense.
    expect(r.legs.some((l) => l.currency === "USD" && l.accountId === "ACC-2100-002")).toBe(true);
    const jpyLegs = r.legs.filter((l) => l.currency === "JPY");
    for (const leg of jpyLegs) expect(leg.accountId).toBe("ACC-2100-007");
    expect(
      r.urgentCorrections.some(
        (c) => c.currency === "JPY" && c.alertId === "alert:integrity:sla-unresolved-currency-jpy",
      ),
    ).toBe(true);
  });

  it("a fully-resolvable trade (USD/ZAR) raises NO urgent corrections", () => {
    const results = interpret(fxEvent(), [PR_FX_001], ["IFRS"], "2026-06-05T10:00:00.000Z");
    const r = results[0];
    if (r?.outcome !== "post") throw new Error("expected post");
    expect(r.urgentCorrections).toHaveLength(0);
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
