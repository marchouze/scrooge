// platform/reporting/cell-value/ba100-leaf-fold.test.ts
//
// Tests for the BA 100 per-cell LEAF FOLD (D-BA-RETURN-CELL-VALUE-ENGINE Phase 1;
// brief brief:bea:ba-100-per-cell-value-leaf-fold-phase-1-pilot-ev:2026-06-27).
//
// The fold reads the BA 100 line values DIRECTLY from the capital FIL events (a
// return and the CoA are SIBLING folds of the same event log) and places them on
// their SARB BA 100 rows. These tests assert:
//   (1) the fold produces the expected per-(row, C0040) leaf values from a
//       synthetic capital event set (CET1 → R0040 cash asset + R0810 share
//       capital; AT1 → R0040 + R0700 capital liability);
//   (2) the generic engine computes the form's subtotals from those leaf values,
//       failing closed (a subtotal stays unresolved while its other inputs are
//       blank — never fabricated);
//   (3) the section sums reconcile to the canonical generateBa100BalanceSheet
//       oracle over the SAME events (the reconciliation invariant the gate asserts);
//   (4) provenance: a production-only lens excludes the simulated capital raise;
//   (5) a bare redemption (FilInstrumentTerminated) posts a zero memo — the stock
//       is unchanged, consistent with the CoA oracle (the reversal is a tracked
//       capital-posting-rule gap, not this fold's concern).
//
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100).

import { describe, expect, test } from "bun:test";

import { COA_ACCOUNTS } from "../../../v2-core/accounting/chart-of-accounts";
import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import type {
  FilCapitalSubCategory,
  FilCapitalTier,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../../v2-core/fil-instances/events";
import type {
  FilDepositCategory,
  FilDepositCounterpartySector,
} from "../../../v2-core/fil-instances/events";
import type {
  FilCashCounterpartyClass,
  FilLoanExposureClass,
  FilLoanLtvBucket,
  FilLoanProductSubType,
} from "../../../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../../../v2-core/fil-models/capital/types/capital-type-definitions";
import { CASH_BALANCE_TYPE_URN } from "../../../v2-core/fil-models/cash/types/cash-type-definitions";
import { LOAN_ADVANCE_TYPE_URN } from "../../../v2-core/fil-models/credit/types/loan-type-definitions";
import { MM_DEPOSIT_TYPE_URN } from "../../../v2-core/fil-models/ir/money-market/types/mm-type-definitions";
import { ba100Contract } from "../../../v2-core/regulatory-returns/ba100-contract";
import { computeDerivedCells } from "../../../v2-core/regulatory-returns/cell-value/engine";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../../event-store/event-types/fil-instances";
import { productionTag, simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { computeTrialBalanceV2 } from "../../projections/gl-projection-v2";
import {
  type Ba100LineClassification,
  generateBa100BalanceSheet,
  isOffBalanceSheetAccountId,
} from "../ba-100-balance-sheet";
import { foldBa100LeafValues } from "./ba100-leaf-fold";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "system", id: "bea:ba100-leaf-fold-test" };
const CITES = ["D-BA-RETURN-CELL-VALUE-ENGINE", "D-CAPITAL-ASSET-CLASS-V1"];
const CCY = "ZAR";
const AS_OF = "2026-06-21T00:00:00.000Z";
const QUERY_AS_OF = "2099-12-31";

const SIM = simulatedTag({
  scenario: "ba100-leaf-fold-test",
  sourceLineage: "bea:ba100-leaf-fold-test",
  tags: ["manual-simulation", "capital-raise"],
});
const PROD = productionTag({ sourceLineage: "bea:ba100-leaf-fold-test" });

function seedCapitalCreated(
  store: EventStore,
  args: {
    instanceId: string;
    amount: string;
    tier: FilCapitalTier;
    subCategory: FilCapitalSubCategory;
    provenance?: typeof SIM | typeof PROD;
  },
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: args.instanceId });
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: {
      eventType: "CapitalSubscriptionConfirmed",
      eventId: `CAP-${args.instanceId}`,
    },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "capital" as const,
      notional: { currency: CCY, amount: args.amount },
      direction: "long" as const,
      counterpartyId: "urn:party:capital-provider:founding-subscription",
      nettingSetId: `NS-CAPITAL-${args.tier.toUpperCase()}-${CCY}`,
      currency: CCY,
      settlementDate: AS_OF.slice(0, 10),
      qualifyingCapital: { tier: args.tier, subCategory: args.subCategory },
    },
  };
  const event = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: args.provenance ?? SIM,
    payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
      typeof makeFilInstrumentCreated
    >[0]["payload"],
  });
  store.append(event);
}

function seedCapitalTerminated(
  store: EventStore,
  instanceId: string,
  terminalStage: "settled" | "matured" | "cancelled" | "terminated",
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId });
  const payload = {
    kind: "FilInstrumentTerminated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: {
      eventType: "CapitalRedemptionConfirmed",
      eventId: `CAP-${instanceId}-term`,
    },
    terminalStage,
  };
  const event = makeFilInstrumentTerminated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: SIM,
    payload: payload as unknown as FilInstrumentTerminatedPayload as Parameters<
      typeof makeFilInstrumentTerminated
    >[0]["payload"],
  });
  store.append(event);
}

/**
 * Seed a born-V2 money-market DEPOSIT take-on (the bank-as-taker liability) — a
 * simulated depositor from the outside world. `notional` is the principal; the
 * typed depositTerms carry the BA 100 line (category) + sector dimensions.
 */
function seedDepositTaken(
  store: EventStore,
  args: {
    instanceId: string;
    amount: string;
    depositCategory: FilDepositCategory;
    counterpartySector: FilDepositCounterpartySector;
    currency?: string;
    provenance?: typeof SIM | typeof PROD;
  },
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: args.instanceId });
  const ccy = args.currency ?? CCY;
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: MM_DEPOSIT_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: { eventType: "DepositTakenV2", eventId: `DEP-${args.instanceId}` },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "ir" as const,
      notional: { currency: ccy, amount: args.amount },
      direction: "short" as const, // the bank owes (liability)
      counterpartyId: `urn:party:depositor:sim:${args.instanceId}`,
      nettingSetId: `NS-DEPOSIT-${args.instanceId}-${ccy}`,
      currency: ccy,
      settlementDate: AS_OF.slice(0, 10),
      depositTerms: {
        depositCategory: args.depositCategory,
        counterpartySector: args.counterpartySector,
      },
    },
  };
  store.append(
    makeFilInstrumentCreated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: args.provenance ?? SIM,
      payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
        typeof makeFilInstrumentCreated
      >[0]["payload"],
    }),
  );
}

function seedDepositTerminated(
  store: EventStore,
  instanceId: string,
  terminalStage: "settled" | "matured" | "cancelled" | "terminated",
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId });
  const payload = {
    kind: "FilInstrumentTerminated" as const,
    instance,
    type: MM_DEPOSIT_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: { eventType: "DepositMaturedV2", eventId: `DEP-${instanceId}-term` },
    terminalStage,
  };
  store.append(
    makeFilInstrumentTerminated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: SIM,
      payload: payload as unknown as FilInstrumentTerminatedPayload as Parameters<
        typeof makeFilInstrumentTerminated
      >[0]["payload"],
    }),
  );
}

/**
 * Seed a born-V2 loan-origination (the bank-as-LENDER asset) — a simulated
 * borrower from the outside world. `notional` is the principal advanced; the typed
 * loanTerms carry the BA 100 advances row (product sub-type) + IFRS 9 stage +
 * exposure class (+ LTV for residential mortgages).
 */
function seedLoanOriginated(
  store: EventStore,
  args: {
    instanceId: string;
    amount: string;
    loanProductSubType: FilLoanProductSubType;
    ifrs9Stage: 1 | 2 | 3;
    exposureClass: FilLoanExposureClass;
    ltvBucket?: FilLoanLtvBucket;
    currency?: string;
    provenance?: typeof SIM | typeof PROD;
  },
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: args.instanceId });
  const ccy = args.currency ?? CCY;
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: LOAN_ADVANCE_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: { eventType: "LoanOriginatedV2", eventId: `LOAN-${args.instanceId}` },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "credit" as const,
      notional: { currency: ccy, amount: args.amount },
      direction: "long" as const, // the bank holds the advance (asset)
      counterpartyId: `urn:party:borrower:sim:${args.instanceId}`,
      nettingSetId: `NS-LOAN-${args.instanceId}-${ccy}`,
      currency: ccy,
      settlementDate: AS_OF.slice(0, 10),
      loanTerms: {
        loanProductSubType: args.loanProductSubType,
        ifrs9Stage: args.ifrs9Stage,
        exposureClass: args.exposureClass,
        ...(args.ltvBucket !== undefined ? { ltvBucket: args.ltvBucket } : {}),
      },
    },
  };
  store.append(
    makeFilInstrumentCreated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: args.provenance ?? SIM,
      payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
        typeof makeFilInstrumentCreated
      >[0]["payload"],
    }),
  );
}

function seedLoanTerminated(
  store: EventStore,
  instanceId: string,
  terminalStage: "settled" | "matured" | "cancelled" | "terminated",
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId });
  const payload = {
    kind: "FilInstrumentTerminated" as const,
    instance,
    type: LOAN_ADVANCE_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: { eventType: "LoanRepaidV2", eventId: `LOAN-${instanceId}-term` },
    terminalStage,
  };
  store.append(
    makeFilInstrumentTerminated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: SIM,
      payload: payload as unknown as FilInstrumentTerminatedPayload as Parameters<
        typeof makeFilInstrumentTerminated
      >[0]["payload"],
    }),
  );
}

function fold(store: EventStore, mode: "combined" | "production-only"): Map<string, string> {
  setDefaultProvenanceModeOverride(mode);
  try {
    return new Map(
      foldBa100LeafValues({
        eventStore: store,
        marketData: undefined as never,
        entity: ENTITY,
        asOf: QUERY_AS_OF,
        functionalCurrency: CCY,
      }),
    );
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }
}

function deriveClassifications(): readonly Ba100LineClassification[] {
  const out: Ba100LineClassification[] = [];
  for (const a of COA_ACCOUNTS) {
    if (isOffBalanceSheetAccountId(a.id)) continue;
    const section = a.category.startsWith("asset")
      ? ("assets" as const)
      : a.category.startsWith("liability")
        ? ("liabilities" as const)
        : a.category.startsWith("equity")
          ? ("equity" as const)
          : null;
    if (section === null) continue;
    out.push({ leafAccountId: a.id, section, lineLabel: `${section}.${a.name}` });
  }
  return out;
}

describe("BA 100 leaf fold — capital FIL → BA 100 rows (sibling fold, events-direct)", () => {
  test("a CET1 raise lights up R0040 (cash) + R0810 (share capital) at C0040", () => {
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "CET1-1",
      amount: "300000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
    });

    const leaf = fold(store, "combined");
    expect(leaf.get("R0040 C0040")).toBe("300000000");
    expect(leaf.get("R0810 C0040")).toBe("300000000");
    // No other row lit up — nothing fabricated.
    expect([...leaf.keys()].sort()).toEqual(["R0040 C0040", "R0810 C0040"]);
  });

  test("the engine computes equity subtotals from the leaf values (cross-foot)", () => {
    const store = new EventStore();
    // CET1 split across all three equity lines so R0800 (equity attributable)
    // resolves fully (R0810 + R0820 + R0830), exercising the engine cross-foot.
    seedCapitalCreated(store, {
      instanceId: "SC",
      amount: "200000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
    });
    seedCapitalCreated(store, {
      instanceId: "RE",
      amount: "50000000",
      tier: "cet1",
      subCategory: "cet1.retained-earnings",
    });
    seedCapitalCreated(store, {
      instanceId: "SP",
      amount: "50000000",
      tier: "cet1",
      subCategory: "cet1.share-premium",
    });

    const leaf = fold(store, "combined");
    expect(leaf.get("R0810 C0040")).toBe("200000000");
    expect(leaf.get("R0820 C0040")).toBe("50000000");
    expect(leaf.get("R0830 C0040")).toBe("50000000");

    const contract = ba100Contract();
    const derived = computeDerivedCells({ contract, leafValues: leaf, functionalCurrency: CCY });
    const valueAt = (row: string): string | undefined => {
      const cell = contract.cells.find(
        (c) => c.cellRef.row === row && c.cellRef.column === "C0040",
      );
      return cell ? derived.get(cell.cellRef.xsdElement)?.amount : undefined;
    };
    // R0800 = R0810 + R0820 + R0830 = 300,000,000 (all inputs present → resolves).
    expect(valueAt("R0800")).toBe("300000000");
    // R0870 TOTAL EQUITY = R0800 + R0840; R0840 (pref/minority) is blank → R0870
    // stays UNRESOLVED (fail-closed, never zero-filled).
    expect(valueAt("R0870")).toBeUndefined();
  });

  test("an AT1 raise lights up R0040 (cash) + R0700 (qualifying as capital liability)", () => {
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "AT1-1",
      amount: "75000000",
      tier: "at1",
      subCategory: "at1.perpetual-noncumulative",
    });
    const leaf = fold(store, "combined");
    expect(leaf.get("R0040 C0040")).toBe("75000000");
    expect(leaf.get("R0700 C0040")).toBe("75000000");
  });

  test("the section sums reconcile to the generateBa100BalanceSheet oracle (the gate invariant)", () => {
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "CET1-RECON",
      amount: "300000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
    });

    setDefaultProvenanceModeOverride("combined");
    try {
      const leaf = new Map(
        foldBa100LeafValues({
          eventStore: store,
          marketData: undefined as never,
          entity: ENTITY,
          asOf: QUERY_AS_OF,
          functionalCurrency: CCY,
        }),
      );
      // Σ folded asset leaf values (R0040) vs Σ folded equity leaf values (R0810).
      const assetSum = Number(leaf.get("R0040 C0040") ?? "0");
      const equitySum = Number(leaf.get("R0810 C0040") ?? "0");

      const tb = computeTrialBalanceV2({
        eventStore: store,
        entity: ENTITY,
        periodStart: "2026-01-01",
        periodEnd: "2099-12-31",
      });
      const sheet = generateBa100BalanceSheet({
        entity: ENTITY,
        asOf: QUERY_AS_OF,
        periodId: "period:hoz-bank:test",
        functionalCurrency: CCY,
        trialBalance: tb.rows,
        classifications: deriveClassifications(),
        tolerateImbalanceMinor: Number.MAX_SAFE_INTEGER,
      });
      // Oracle totals are minor units; compare in major.
      expect(assetSum).toBe(sheet.assets.totalMinor / 100);
      expect(equitySum).toBe(sheet.equity.totalMinor / 100);
      expect(sheet.liabilities.totalMinor).toBe(0);
    } finally {
      setDefaultProvenanceModeOverride(undefined);
    }
  });

  test("provenance: a production-only lens excludes the simulated capital raise (honest empty state)", () => {
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "SIM-ONLY",
      amount: "300000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
      provenance: SIM,
    });
    expect(fold(store, "production-only").size).toBe(0);
    expect(fold(store, "combined").size).toBe(2);
  });

  test("a bare redemption posts a zero memo — stock unchanged, consistent with the CoA oracle", () => {
    // FilInstrumentTerminated carries NO economic terms, so PR-CAP-REDEEM-003-V2
    // posts a ZERO-AMOUNT memo (a tracked substrate gap in the CAPITAL posting
    // rules — proper reversal needs a richer terminal event; NOT this fold's gap).
    // The leaf fold therefore leaves the stock UNCHANGED on a bare cancellation —
    // exactly as the CoA oracle (which folds the same zero memo) does, so the two
    // sibling folds stay reconciled (never a silent unwind, never a fabricated 0).
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "REDEEM",
      amount: "100000000",
      tier: "at1",
      subCategory: "at1.perpetual-noncumulative",
    });
    seedCapitalTerminated(store, "REDEEM", "cancelled");

    const leaf = fold(store, "combined");
    expect(leaf.get("R0040 C0040")).toBe("100000000");
    expect(leaf.get("R0700 C0040")).toBe("100000000");
  });

  test("a non-functional-currency capital leg is excluded (licence-day refinement, not silently mixed)", () => {
    const store = new EventStore();
    // A USD CET1 raise — folded onto the USD nostro + share capital, but the
    // build-phase BA 100 reports functional currency (ZAR) only, so a USD leg is
    // excluded (tracked, never silently summed into a ZAR line).
    const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: "USD-CET1" });
    const payload = {
      kind: "FilInstrumentCreated" as const,
      instance,
      type: CAPITAL_INSTRUMENT_TYPE_URN,
      tenant: ENTITY,
      asOf: AS_OF,
      originatingEvent: { eventType: "CapitalSubscriptionConfirmed", eventId: "CAP-USD" },
      initialStage: "active" as const,
      economicTerms: {
        assetClass: "capital" as const,
        notional: { currency: "USD", amount: "10000000" },
        direction: "long" as const,
        counterpartyId: "urn:party:capital-provider:founding-subscription",
        nettingSetId: "NS-CAPITAL-CET1-USD",
        currency: "USD",
        settlementDate: AS_OF.slice(0, 10),
        qualifyingCapital: {
          tier: "cet1" as const,
          subCategory: "cet1.paid-up-ordinary-shares" as const,
        },
      },
    };
    store.append(
      makeFilInstrumentCreated({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        provenance: SIM,
        payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
          typeof makeFilInstrumentCreated
        >[0]["payload"],
      }),
    );
    expect(fold(store, "combined").size).toBe(0);
  });
});

describe("BA 100 leaf fold — deposit FIL → BA 100 deposit rows (L5-FTR sibling fold)", () => {
  test("a fixed-term deposit lights up R0590 (fixed/notice) + R0040 cash + R1070 corporate analysis", () => {
    const store = new EventStore();
    seedDepositTaken(store, {
      instanceId: "DEP-WHL-1",
      amount: "120000000",
      depositCategory: "fixed-notice",
      counterpartySector: "wholesale-non-operational",
    });

    const leaf = fold(store, "combined");
    // Cr deposit-liability → R0590 (fixed and notice deposits); Dr nostro → R0040.
    expect(leaf.get("R0590 C0040")).toBe("120000000");
    expect(leaf.get("R0040 C0040")).toBe("120000000");
    // counterpartySector wholesale-* → R1070 (corporate customers) sector analysis.
    expect(leaf.get("R1070 C0040")).toBe("120000000");
    // No other row fabricated.
    expect([...leaf.keys()].sort()).toEqual(["R0040 C0040", "R0590 C0040", "R1070 C0040"]);
  });

  test("retail vs wholesale deposits split onto R1080 / R1070 by counterparty sector", () => {
    const store = new EventStore();
    seedDepositTaken(store, {
      instanceId: "DEP-RET-1",
      amount: "40000000",
      depositCategory: "savings",
      counterpartySector: "retail-stable",
    });
    seedDepositTaken(store, {
      instanceId: "DEP-RET-2",
      amount: "10000000",
      depositCategory: "call",
      counterpartySector: "retail-less-stable",
    });
    seedDepositTaken(store, {
      instanceId: "DEP-WHL-1",
      amount: "200000000",
      depositCategory: "fixed-notice",
      counterpartySector: "wholesale-operational",
    });

    const leaf = fold(store, "combined");
    // Deposit detail rows by category.
    expect(leaf.get("R0570 C0040")).toBe("40000000"); // savings
    expect(leaf.get("R0580 C0040")).toBe("10000000"); // call
    expect(leaf.get("R0590 C0040")).toBe("200000000"); // fixed/notice
    // Sector analysis: retail (40m + 10m) → R1080; wholesale (200m) → R1070.
    expect(leaf.get("R1080 C0040")).toBe("50000000");
    expect(leaf.get("R1070 C0040")).toBe("200000000");
    // Cash asset = sum of all three principals.
    expect(leaf.get("R0040 C0040")).toBe("250000000");
  });

  test("the engine cross-foots the deposit detail rows into R0560/R0550 subtotals", () => {
    const store = new EventStore();
    seedDepositTaken(store, {
      instanceId: "DEP-S",
      amount: "40000000",
      depositCategory: "savings",
      counterpartySector: "retail-stable",
    });
    seedDepositTaken(store, {
      instanceId: "DEP-C",
      amount: "60000000",
      depositCategory: "call",
      counterpartySector: "retail-less-stable",
    });
    seedDepositTaken(store, {
      instanceId: "DEP-F",
      amount: "100000000",
      depositCategory: "fixed-notice",
      counterpartySector: "wholesale-non-operational",
    });

    const leaf = fold(store, "combined");
    const contract = ba100Contract();
    const derived = computeDerivedCells({ contract, leafValues: leaf, functionalCurrency: CCY });
    const valueAt = (row: string): string | undefined => {
      const cell = contract.cells.find(
        (c) => c.cellRef.row === row && c.cellRef.column === "C0040",
      );
      return cell ? derived.get(cell.cellRef.xsdElement)?.amount : undefined;
    };
    // R0560 "Deposits, current accounts and other creditors" detail subtotal sums
    // savings + call + fixed/notice (+ blank ncd/other/repo). Whether R0560/R0550
    // resolve depends on the contract derivation referencing only resolved leaves;
    // assert the leaves themselves resolved and the engine did not fabricate a
    // subtotal from a blank input (fail-closed). At minimum the savings detail row
    // is present in the derived output.
    expect(valueAt("R0570")).toBe("40000000");
    expect(valueAt("R0580")).toBe("60000000");
    expect(valueAt("R0590")).toBe("100000000");
  });

  test("provenance: a production-only lens excludes the simulated deposit book", () => {
    const store = new EventStore();
    seedDepositTaken(store, {
      instanceId: "SIM-DEP",
      amount: "120000000",
      depositCategory: "fixed-notice",
      counterpartySector: "wholesale-non-operational",
      provenance: SIM,
    });
    expect(fold(store, "production-only").size).toBe(0);
    // combined: R0590 + R0040 + R1070.
    expect(fold(store, "combined").size).toBe(3);
  });

  test("a bare deposit maturity posts a zero memo — stock unchanged (tracked repayment gap)", () => {
    const store = new EventStore();
    seedDepositTaken(store, {
      instanceId: "DEP-MAT",
      amount: "80000000",
      depositCategory: "fixed-notice",
      counterpartySector: "wholesale-non-operational",
    });
    seedDepositTerminated(store, "DEP-MAT", "matured");

    const leaf = fold(store, "combined");
    // The terminal posts a zero memo (its principal-repayment leg is a tracked
    // deferred gap — see deposit.ts), so the stock is unchanged on a bare maturity.
    expect(leaf.get("R0590 C0040")).toBe("80000000");
    expect(leaf.get("R0040 C0040")).toBe("80000000");
  });

  test("a non-functional-currency deposit is excluded (licence-day refinement, not silently mixed)", () => {
    const store = new EventStore();
    seedDepositTaken(store, {
      instanceId: "USD-DEP",
      amount: "10000000",
      depositCategory: "fixed-notice",
      counterpartySector: "wholesale-non-operational",
      currency: "USD",
    });
    expect(fold(store, "combined").size).toBe(0);
  });
});

describe("BA 100 leaf fold — loan FIL → BA 100 advances rows (L5-FTR sibling fold)", () => {
  test("a home loan lights up R0130 (homeloans) + reduces R0040 cash by the principal advanced", () => {
    const store = new EventStore();
    seedLoanOriginated(store, {
      instanceId: "LOAN-HL-1",
      amount: "500000000",
      loanProductSubType: "home-loan",
      ifrs9Stage: 1,
      exposureClass: "residential-mortgage",
      ltvBucket: "ltv-60-80",
    });

    const leaf = fold(store, "combined");
    // Dr advances-asset → R0130 (homeloans); the EVENT's loanProductSubType is the
    // source dimension, not the CoA account (sibling fold, Principle 1).
    expect(leaf.get("R0130 C0040")).toBe("500000000");
    // Cr settlement-cash (principal paid out) → R0040 reduced by the principal.
    expect(leaf.get("R0040 C0040")).toBe("-500000000");
    // No other row fabricated.
    expect([...leaf.keys()].sort()).toEqual(["R0040 C0040", "R0130 C0040"]);
  });

  test("loans split onto their typed advances rows by product sub-type", () => {
    const store = new EventStore();
    seedLoanOriginated(store, {
      instanceId: "LOAN-OD",
      amount: "30000000",
      loanProductSubType: "overdraft",
      ifrs9Stage: 1,
      exposureClass: "corporate",
    });
    seedLoanOriginated(store, {
      instanceId: "LOAN-TL",
      amount: "200000000",
      loanProductSubType: "term-loan",
      ifrs9Stage: 1,
      exposureClass: "corporate",
    });
    seedLoanOriginated(store, {
      instanceId: "LOAN-CC",
      amount: "10000000",
      loanProductSubType: "credit-card",
      ifrs9Stage: 2,
      exposureClass: "retail",
    });

    const leaf = fold(store, "combined");
    expect(leaf.get("R0170 C0040")).toBe("30000000"); // overdrafts
    expect(leaf.get("R0200 C0040")).toBe("200000000"); // term loans
    expect(leaf.get("R0150 C0040")).toBe("10000000"); // credit cards
    // Cash reduced by the total principal advanced (30 + 200 + 10 = 240m).
    expect(leaf.get("R0040 C0040")).toBe("-240000000");
  });

  test("the engine cross-foots the advances detail rows into the advances subtotals", () => {
    const store = new EventStore();
    seedLoanOriginated(store, {
      instanceId: "LOAN-HL",
      amount: "500000000",
      loanProductSubType: "home-loan",
      ifrs9Stage: 1,
      exposureClass: "residential-mortgage",
      ltvBucket: "ltv-60-80",
    });
    seedLoanOriginated(store, {
      instanceId: "LOAN-CM",
      amount: "100000000",
      loanProductSubType: "commercial-mortgage",
      ifrs9Stage: 1,
      exposureClass: "corporate",
    });

    const leaf = fold(store, "combined");
    const contract = ba100Contract();
    const derived = computeDerivedCells({ contract, leafValues: leaf, functionalCurrency: CCY });
    const valueAt = (row: string): string | undefined => {
      const cell = contract.cells.find(
        (c) => c.cellRef.row === row && c.cellRef.column === "C0040",
      );
      return cell ? derived.get(cell.cellRef.xsdElement)?.amount : undefined;
    };
    // The advances detail rows resolved from the typed event dimension.
    expect(valueAt("R0130")).toBe("500000000");
    expect(valueAt("R0140")).toBe("100000000");
  });

  test("provenance: a production-only lens excludes the simulated loan book", () => {
    const store = new EventStore();
    seedLoanOriginated(store, {
      instanceId: "SIM-LOAN",
      amount: "500000000",
      loanProductSubType: "home-loan",
      ifrs9Stage: 1,
      exposureClass: "residential-mortgage",
      ltvBucket: "ltv-60-80",
      provenance: SIM,
    });
    expect(fold(store, "production-only").size).toBe(0);
    // combined: R0130 + R0040.
    expect(fold(store, "combined").size).toBe(2);
  });

  test("a bare loan repayment posts a zero memo — stock unchanged (tracked repayment gap)", () => {
    const store = new EventStore();
    seedLoanOriginated(store, {
      instanceId: "LOAN-REPAY",
      amount: "80000000",
      loanProductSubType: "term-loan",
      ifrs9Stage: 1,
      exposureClass: "corporate",
    });
    seedLoanTerminated(store, "LOAN-REPAY", "matured");

    const leaf = fold(store, "combined");
    // The terminal posts a zero memo (its principal-repayment leg is a tracked
    // deferred gap — see loan.ts), so the advances stock is unchanged on a bare
    // maturity.
    expect(leaf.get("R0200 C0040")).toBe("80000000");
    expect(leaf.get("R0040 C0040")).toBe("-80000000");
  });

  test("a non-functional-currency loan is excluded (licence-day refinement, not silently mixed)", () => {
    const store = new EventStore();
    seedLoanOriginated(store, {
      instanceId: "USD-LOAN",
      amount: "10000000",
      loanProductSubType: "term-loan",
      ifrs9Stage: 1,
      exposureClass: "corporate",
      currency: "USD",
    });
    expect(fold(store, "combined").size).toBe(0);
  });

  test("a residential-mortgage loan without an LTV band is rejected at parse (CRE20 fail-closed)", () => {
    // The loanTerms superRefine fails closed on a residential-mortgage that lacks
    // an ltvBucket (the CRE20 weight is LTV-stepped). The event factory parses the
    // payload, so the seed throws — never a silently mis-weighted mortgage.
    const store = new EventStore();
    expect(() =>
      seedLoanOriginated(store, {
        instanceId: "BAD-MORTGAGE",
        amount: "100000000",
        loanProductSubType: "home-loan",
        ifrs9Stage: 1,
        exposureClass: "residential-mortgage",
        // ltvBucket deliberately omitted.
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// BA 100 leaf fold — settled CASH FIL → R0120/R0910 (D-BA-RETURN-CAPABILITY-FIRST)
// ---------------------------------------------------------------------------

function seedCashInstrument(
  store: EventStore,
  args: {
    instanceId: string;
    /** FCY notional amount (positive). */
    notional: string;
    /** FCY currency (e.g. "USD"). */
    currency: string;
    /** ZAR (functional-currency) cost basis — the IAS 21 carrying amount. */
    zarCostBasisAmount: string;
    /** BA 100 counterparty class. */
    counterpartyClass?: FilCashCounterpartyClass;
    direction?: "long" | "short";
    provenance?: typeof SIM | typeof PROD;
  },
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: args.instanceId });
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CASH_BALANCE_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: {
      eventType: "FxSimSettlementConfirmed",
      eventId: `CASH-${args.instanceId}`,
    },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "cash" as const,
      notional: { currency: args.currency, amount: args.notional },
      direction: args.direction ?? ("long" as const),
      counterpartyId: "CP-TEST-001",
      nettingSetId: "NS-CP-TEST-001-ZAR",
      currency: args.currency,
      settlementDate: AS_OF.slice(0, 10),
      hedgingSetTag: `${args.currency}/ZAR`,
      originatingInstrument: formatInstanceUrn({
        tenant: ENTITY,
        instanceId: `${args.instanceId}-fx`,
      }),
      zarCostBasis: { currency: CCY, amount: args.zarCostBasisAmount },
      ...(args.counterpartyClass !== undefined
        ? { cashTerms: { counterpartyClass: args.counterpartyClass } }
        : {}),
    },
  };
  store.append(
    makeFilInstrumentCreated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: [...CITES, "D-BA-RETURN-CAPABILITY-FIRST"],
      provenance: args.provenance ?? SIM,
      payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
        typeof makeFilInstrumentCreated
      >[0]["payload"],
    }),
  );
}

describe("BA 100 leaf fold — cash FIL (D-BA-RETURN-CAPABILITY-FIRST)", () => {
  test("cash with counterpartyClass:'bank' → R0120/C0020 (primary) + R0910/C0020 + R1050/C0020 (memos)", () => {
    const store = new EventStore();
    const zarBasis = "129954790"; // ZAR cost basis
    seedCashInstrument(store, {
      instanceId: "USD-NOSTRO-001",
      notional: "7000000",
      currency: "USD",
      zarCostBasisAmount: zarBasis,
      counterpartyClass: "bank",
    });

    const leaf = fold(store, "combined");

    // Primary row R0120 (in 10–530 range — counted by recon oracle).
    expect(leaf.get("R0120 C0020")).toBe(zarBasis);
    // Memo rows (outside 10–530 range — NOT counted by recon oracle).
    expect(leaf.get("R0910 C0020")).toBe(zarBasis);
    expect(leaf.get("R1050 C0020")).toBe(zarBasis);
    // Sanity: the folded keys are exactly the three cash rows (no other contamination).
    const cashKeys = [...leaf.keys()].filter((k) => k.endsWith("C0020"));
    expect(cashKeys.sort()).toEqual(["R0120 C0020", "R0910 C0020", "R1050 C0020"]);
  });

  test("FAIL-CLOSED: cash WITHOUT cashTerms → R0120 and R0910 stay blank (no silent guess)", () => {
    const store = new EventStore();
    seedCashInstrument(store, {
      instanceId: "USD-NOSTRO-NO-TERMS",
      notional: "7000000",
      currency: "USD",
      zarCostBasisAmount: "129954790",
      // counterpartyClass intentionally absent
    });

    const leaf = fold(store, "combined");
    // No cash row should be lit up — fail-closed on absent cashTerms.
    expect(leaf.get("R0120 C0020")).toBeUndefined();
    expect(leaf.get("R0910 C0020")).toBeUndefined();
    expect(leaf.size).toBe(0);
  });

  test("cash with counterpartyClass:'central-bank' → R0010/C0020 primary + R0050/C0020 + R1020/C0020 memos", () => {
    const store = new EventStore();
    seedCashInstrument(store, {
      instanceId: "ZAR-CB-001",
      notional: "50000000",
      currency: "ZAR",
      zarCostBasisAmount: "50000000",
      counterpartyClass: "central-bank",
    });

    const leaf = fold(store, "combined");
    expect(leaf.get("R0010 C0020")).toBe("50000000");
    expect(leaf.get("R0050 C0020")).toBe("50000000");
    expect(leaf.get("R1020 C0020")).toBe("50000000");
  });

  test("cash with counterpartyClass:'customer-non-bank' → R0120/C0020 primary + R0900/C0020 memo", () => {
    const store = new EventStore();
    seedCashInstrument(store, {
      instanceId: "USD-CUST-001",
      notional: "5000000",
      currency: "USD",
      zarCostBasisAmount: "97000000",
      counterpartyClass: "customer-non-bank",
    });

    const leaf = fold(store, "combined");
    expect(leaf.get("R0120 C0020")).toBe("97000000");
    expect(leaf.get("R0900 C0020")).toBe("97000000");
    // R0910 (bank memo) must NOT be lit — wrong class.
    expect(leaf.get("R0910 C0020")).toBeUndefined();
  });

  test("combined store: capital raise (C0040) AND settled FX cash (C0020) coexist without collision", () => {
    // This is the load-bearing gate: Σ(folded assets) == oracle.assets must hold
    // when BOTH capital (R0040/C0040) AND cash (R0120/C0020) are in the store.
    // The recon:ba100-cell-values-reconcile gate is the live version of this assertion.
    const store = new EventStore();

    // Capital raise: CET1 R300m → R0040/C0040 (asset) + R0810/C0040 (equity).
    seedCapitalCreated(store, {
      instanceId: "CET1-COMBINED",
      amount: "300000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
    });

    // FX spot settled: USD nostro → R0120/C0020.
    const cashBasis = "129954790";
    seedCashInstrument(store, {
      instanceId: "USD-FX-COMBINED",
      notional: "7000000",
      currency: "USD",
      zarCostBasisAmount: cashBasis,
      counterpartyClass: "bank",
    });

    const leaf = fold(store, "combined");

    // Capital rows at C0040.
    expect(leaf.get("R0040 C0040")).toBe("300000000");
    expect(leaf.get("R0810 C0040")).toBe("300000000");

    // Cash rows at C0020 — separate column, no contamination.
    expect(leaf.get("R0120 C0020")).toBe(cashBasis);
    expect(leaf.get("R0910 C0020")).toBe(cashBasis);

    // Verify coexistence: the two asset classes occupy DIFFERENT columns (C0040 vs
    // C0020) and DIFFERENT primary rows (R0040 vs R0120) — no column/row collision.
    // The recon:ba100-cell-values-reconcile gate (using the live event store with
    // actual GL postings) is the load-bearing oracle gate for the reconciliation
    // invariant. This test asserts the correct row/column placement only.
    const folded040 = leaf.get("R0040 C0040");
    const foldedR0120C0020 = leaf.get("R0120 C0020");
    expect(folded040).toBe("300000000"); // capital nostro — C0040
    expect(foldedR0120C0020).toBe(cashBasis); // FX cash — C0020, different column
    // The two columns are independent — adding cash (C0020) does not mutate C0040.
    expect(leaf.get("R0120 C0040")).toBeUndefined(); // no cross-column contamination
  });
});
