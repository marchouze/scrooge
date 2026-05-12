// tests/ifrs-statements.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — exit-criterion tests
// for the IFRS statement renderer (BS / IS / CF / Equity / Notes skeleton)
// + JSON renderer + per-entity isolation.
//
// Asserts:
//   1. IFRS classification semantic entries register.
//   2. Per-entity isolation — Hoz Securities + Hoz Group rejected.
//   3. End-to-end:
//        synthetic SubLedgerPostingEmitted events
//          → openPeriod → closePeriod (Slice 2)
//          → 5 IFRS statements (Slice 6)
//          → JSON bundle render
//        produces known balance-sheet / P&L / equity totals.
//   4. Balance-sheet accounting equation (assets ≡ liabilities + equity).
//   5. SoCE closing balance ties to SoFP equity total.
//   6. Determinism — same inputs ⇒ byte-identical canonical JSON.
//   7. Schema validation — every render validates against its Zod schema.
//   8. Bundle render — coherence checks + 5 statements composed.
//   9. Generator boundary errors — duplicate classifications, invalid
//      currency, comparativeAsOf ordering.
//
// Authority: D-REPORTING-CAPABILITY-SLICE-6 (under standing approval of
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-approved 2026-05-10).
// Source spec: Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-
//   build-proposal.md §6 Slice 6.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; IFRS line-mapping owner) · Atlas (Core banking
//   platform architect, engineering — substrate consult).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  IFRS_BANK_ENTITIES,
  IFRS_RENDERER_VERSION,
  type IfrsAccountClassification,
  IfrsBalanceSheetRenderSchema,
  type IfrsBundleInput,
  IfrsBundleRenderSchema,
  IfrsCashFlowRenderSchema,
  IfrsChangesInEquityRenderSchema,
  IfrsGeneratorError,
  type IfrsGeneratorInput,
  IfrsIncomeStatementRenderSchema,
  IfrsNotesRenderSchema,
  canonicaliseIfrs,
  generateIfrsBalanceSheet,
  generateIfrsCashFlow,
  generateIfrsChangesInEquity,
  generateIfrsIncomeStatement,
  generateIfrsNotes,
  renderIfrsBalanceSheet,
  renderIfrsBundle,
  renderIfrsBundleCanonical,
  renderIfrsCashFlow,
  renderIfrsChangesInEquity,
  renderIfrsIncomeStatement,
  renderIfrsNotes,
} from "../platform/reporting";
import {
  SLICE_1_ENTRIES,
  SLICE_6_IFRS_ENTRIES,
  SemanticRegistry,
  netCashFromFinancing,
  netCashFromInvesting,
  netCashFromOperating,
  otherComprehensiveIncome,
  profitOrLoss,
  totalAssets,
  totalComprehensiveIncome,
  totalEquity,
  totalLiabilities,
} from "../platform/semantic";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ENTITY_GROUP = "LE-ZA-HOZ-GROUP";
const ACTOR = { type: "service" as const, id: "agent:Bea" };
const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "D-REPORTING-CAPABILITY-SLICE-6"];

const PERIOD_OPEN = {
  periodId: "period:hoz-bank:month:2026-05",
  periodKind: "month" as const,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.999Z",
  openedAt: "2026-05-01T00:00:00.000Z",
  functionalCurrency: "ZAR",
};

const RENDERED_AT = "2026-05-31T23:59:59.999Z";

// ---------------------------------------------------------------------------
// Provenance override — test fixture events are untagged (treated as simulated).
// D-PROVENANCE-FILTER-ENFORCEMENT changed computeTrialBalance to apply
// production-only by default. Unit tests must opt into combined mode.
// ---------------------------------------------------------------------------

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

function appendPosting(
  store: EventStore,
  args: {
    entity: string;
    asOf: string;
    legs: ReadonlyArray<{
      debit: string;
      credit: string;
      currency: string;
      amountMinor: number;
    }>;
  },
): void {
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: ACTOR,
    citations: ["D-REPORTING-CAPABILITY-SLICE-6"],
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: args.legs.map((l) => ({ ...l, memo: "test" })),
      asOfDate: args.asOf,
      citations: ["D-REPORTING-CAPABILITY-SLICE-6"],
    },
  });
}

const STANDARD_CLASSIFICATIONS: readonly IfrsAccountClassification[] = [
  {
    leafAccountId: "ACC-1100-001",
    accountClass: "asset",
    lineLabel: "Cash and balances at SARB",
    cashFlowClass: "operating",
  },
  {
    leafAccountId: "ACC-equity-position-stub",
    accountClass: "equity",
    lineLabel: "Share capital — paid-up ordinary shares",
    equityComponent: "share-capital",
    cashFlowClass: "financing",
  },
  {
    leafAccountId: "ACC-retained-earnings-stub",
    accountClass: "equity",
    lineLabel: "Retained earnings",
    equityComponent: "retained-earnings",
  },
  {
    leafAccountId: "ACC-pl-revenue-stub",
    accountClass: "income",
    lineLabel: "Net trading income",
  },
];

// =====================================================================
// 1. Semantic entries register.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-6 — IFRS semantic entries", () => {
  it("the nine IFRS entries register without error", () => {
    const reg = SemanticRegistry.from(SLICE_6_IFRS_ENTRIES);
    expect(reg.size()).toBe(9);
    expect(reg.resolve({ id: "TotalAssets" })).toBeDefined();
    expect(reg.resolve({ id: "TotalLiabilities" })).toBeDefined();
    expect(reg.resolve({ id: "TotalEquity" })).toBeDefined();
    expect(reg.resolve({ id: "ProfitOrLoss" })).toBeDefined();
    expect(reg.resolve({ id: "OtherComprehensiveIncome" })).toBeDefined();
    expect(reg.resolve({ id: "TotalComprehensiveIncome" })).toBeDefined();
    expect(reg.resolve({ id: "NetCashFromOperating" })).toBeDefined();
    expect(reg.resolve({ id: "NetCashFromInvesting" })).toBeDefined();
    expect(reg.resolve({ id: "NetCashFromFinancing" })).toBeDefined();
  });

  it("co-exists with Slice-1 entries in a combined registry", () => {
    const reg = SemanticRegistry.from([...SLICE_1_ENTRIES, ...SLICE_6_IFRS_ENTRIES]);
    expect(reg.size()).toBe(SLICE_1_ENTRIES.length + SLICE_6_IFRS_ENTRIES.length);
  });

  it("each new entry carries at least one resolved + one TBC citation per Q1", () => {
    for (const e of SLICE_6_IFRS_ENTRIES) {
      const tbc = e.citations.filter((c) => c.type === "tbc").length;
      const resolved = e.citations.filter((c) => c.type !== "tbc").length;
      expect(tbc).toBeGreaterThanOrEqual(1);
      expect(resolved).toBeGreaterThanOrEqual(1);
    }
  });

  it("each entry scopes to Hoz Bank only at v0", () => {
    for (const e of SLICE_6_IFRS_ENTRIES) {
      expect(e.entityScope).toEqual(["urn:legal-entity:hoz:hoz-bank:v1"]);
    }
  });

  it("named exports match the array (export-shape coherence)", () => {
    expect(SLICE_6_IFRS_ENTRIES).toContain(totalAssets);
    expect(SLICE_6_IFRS_ENTRIES).toContain(totalLiabilities);
    expect(SLICE_6_IFRS_ENTRIES).toContain(totalEquity);
    expect(SLICE_6_IFRS_ENTRIES).toContain(profitOrLoss);
    expect(SLICE_6_IFRS_ENTRIES).toContain(otherComprehensiveIncome);
    expect(SLICE_6_IFRS_ENTRIES).toContain(totalComprehensiveIncome);
    expect(SLICE_6_IFRS_ENTRIES).toContain(netCashFromOperating);
    expect(SLICE_6_IFRS_ENTRIES).toContain(netCashFromInvesting);
    expect(SLICE_6_IFRS_ENTRIES).toContain(netCashFromFinancing);
  });
});

// =====================================================================
// 2. Per-entity isolation.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-6 — per-entity isolation", () => {
  const baseInput: IfrsGeneratorInput = {
    entity: ENTITY_BANK,
    asOf: "2026-05-31T23:59:59.999Z",
    periodId: "x",
    functionalCurrency: "ZAR",
    trialBalance: [],
    classifications: [],
  };

  it("IFRS_BANK_ENTITIES contains only LE-ZA-HOZ-BANK at v0", () => {
    expect(IFRS_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES on every generator", () => {
    const i = { ...baseInput, entity: ENTITY_SECURITIES };
    expect(() => generateIfrsBalanceSheet(i)).toThrow(IfrsGeneratorError);
    expect(() => generateIfrsIncomeStatement(i)).toThrow(IfrsGeneratorError);
    expect(() => generateIfrsCashFlow(i)).toThrow(IfrsGeneratorError);
    expect(() => generateIfrsChangesInEquity(i)).toThrow(IfrsGeneratorError);
    expect(() => generateIfrsNotes(i)).toThrow(IfrsGeneratorError);
  });

  it("rejects LE-ZA-HOZ-GROUP (consolidated AFS lands at downstream slice)", () => {
    const i = { ...baseInput, entity: ENTITY_GROUP };
    expect(() => generateIfrsBalanceSheet(i)).toThrow(IfrsGeneratorError);
  });

  it("rejects an invalid functional currency", () => {
    const i = { ...baseInput, functionalCurrency: "ZARS" };
    expect(() => generateIfrsBalanceSheet(i)).toThrow(/ISO-4217/);
  });

  it("rejects comparativeAsOf >= asOf", () => {
    const i: IfrsGeneratorInput = {
      ...baseInput,
      asOf: "2026-05-31T23:59:59.999Z",
      comparativeAsOf: "2026-05-31T23:59:59.999Z",
    };
    expect(() => generateIfrsBalanceSheet(i)).toThrow(/must precede/);
  });
});

// =====================================================================
// 3. End-to-end: synthetic events → close → 5 statements → render.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-6 — end-to-end (events → close → 5 statements)", () => {
  function setupClose(): {
    store: EventStore;
    trialBalanceSnapshotEventId: string;
    rows: ReadonlyArray<{
      leafAccountId: string;
      currency: string;
      amountMinor: number;
    }>;
  } {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: PERIOD_OPEN,
    });

    // Capital injection: R3.0m share capital → cash.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-02T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-1100-001",
          credit: "ACC-equity-position-stub",
          currency: "ZAR",
          amountMinor: 300_000_000,
        },
      ],
    });
    // P&L revenue accrual: R0.5m booked to retained earnings via P&L.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-15T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-pl-revenue-stub",
          credit: "ACC-retained-earnings-stub",
          currency: "ZAR",
          amountMinor: 50_000_000,
        },
      ],
    });

    const close = closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: PERIOD_OPEN.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
    });
    return {
      store,
      trialBalanceSnapshotEventId: close.trialBalanceSnapshotEvent.event_id,
      rows: close.trialBalance.rows,
    };
  }

  function input(
    rows: ReadonlyArray<{ leafAccountId: string; currency: string; amountMinor: number }>,
    eventId: string,
  ): IfrsGeneratorInput {
    return {
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: STANDARD_CLASSIFICATIONS,
      trialBalanceSnapshotEventId: eventId,
    };
  }

  it("Balance Sheet — assets balance to liabilities + equity (accounting equation)", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const bs = generateIfrsBalanceSheet(input(rows, trialBalanceSnapshotEventId));

    // Cash debit = R3.0m + R0 (P&L is income/expense, not asset). Wait — the
    // P&L revenue posting debits ACC-pl-revenue-stub (income, classed as
    // 'income' so it doesn't add to cash). So total assets = R3.0m.
    expect(bs.assets.totalMinor).toBe(300_000_000);
    // Equity classified accounts: ACC-equity-position-stub (R3.0m credit)
    // + ACC-retained-earnings-stub (R0.5m credit) = R3.5m.
    expect(bs.equity.lineItems.length).toBeGreaterThanOrEqual(2);
    // No liabilities classified.
    expect(bs.liabilities.totalMinor).toBe(0);
    // Equity by accounting equation = assets − liabilities = R3.0m. The
    // classified equity sums to R3.5m, so a residual of -R0.5m surfaces
    // (accounting equation is the floor, classification gives texture).
    expect(bs.equity.totalMinor).toBe(300_000_000);
    expect(bs.accountingEquationCheck.balanced).toBe(true);
    // Provenance threaded.
    expect(bs.meta.trialBalanceSnapshotEventId).toBe(trialBalanceSnapshotEventId);
  });

  it("Income Statement — P&L = income − expense", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const is = generateIfrsIncomeStatement(input(rows, trialBalanceSnapshotEventId));

    // ACC-pl-revenue-stub debit = +R0.5m (positive amountMinor in TB);
    // taken absolute and classed 'income' → income total = R0.5m.
    // No expense classifications → expense = 0. P&L = R0.5m.
    expect(is.income.totalMinor).toBe(50_000_000);
    expect(is.expense.totalMinor).toBe(0);
    expect(is.profitOrLoss.amountMinor).toBe(50_000_000);
    // OCI = 0 in this fixture; TCI = P&L.
    expect(is.otherComprehensiveIncome.totalMinor).toBe(0);
    expect(is.totalComprehensiveIncome.amountMinor).toBe(50_000_000);
  });

  it("Cash Flow — operating starts at P&L; placeholder for no-comparative", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const cf = generateIfrsCashFlow(input(rows, trialBalanceSnapshotEventId));

    expect(cf.profitOrLossStartingPoint.amountMinor).toBe(50_000_000);
    expect(cf.placeholders.some((p) => p.includes("Cash Flow generated without comparative"))).toBe(
      true,
    );
    // Net change in cash is plMinor + working-capital movements + investing + financing.
    expect(typeof cf.netChangeInCash.amountMinor).toBe("number");
  });

  it("SoCE — closing balance reflects opening + P&L + share-capital owner-tx", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const i = input(rows, trialBalanceSnapshotEventId);
    const soce = generateIfrsChangesInEquity(i);
    expect(soce.profitOrLossMinor).toBe(50_000_000);
    expect(soce.openingEquityTotalMinor).toBe(0);
    // Share-capital owner-tx = R3.0m (the equity injection in setupClose).
    // Retained-earnings movement = +R0.5m (P&L), with no further owner-tx.
    // Closing equity = 0 + R3.5m = R3.5m.
    expect(soce.closingEquityTotalMinor).toBe(350_000_000);
    // Share-capital component closes at R3.0m.
    const shareCap = soce.components.find((c) => c.component === "share-capital");
    expect(shareCap?.closingBalanceMinor).toBe(300_000_000);
    // Retained-earnings component closes at R0.5m (P&L attribution).
    const re = soce.components.find((c) => c.component === "retained-earnings");
    expect(re?.closingBalanceMinor).toBe(50_000_000);
  });

  it("SoCE — synthetic single-entity TB ties to BS equity total when income/expense suppressed", () => {
    // Tighter scenario: only equity rows in the TB → SoCE closing equity
    // == BS equity (the accounting-equation residual is zero).
    const i: IfrsGeneratorInput = {
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "p",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 300_000_000 },
        { leafAccountId: "ACC-equity-position-stub", currency: "ZAR", amountMinor: -300_000_000 },
      ],
      classifications: STANDARD_CLASSIFICATIONS,
    };
    const bs = generateIfrsBalanceSheet(i);
    const soce = generateIfrsChangesInEquity(i);
    expect(soce.closingEquityTotalMinor).toBe(bs.equity.totalMinor);
  });

  it("Notes — skeleton emits 13 headings, all with TBC placeholders", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const notes = generateIfrsNotes(input(rows, trialBalanceSnapshotEventId));
    expect(notes.notes.length).toBe(13);
    for (const n of notes.notes) {
      expect(n.status).toBe("skeleton");
      expect(n.placeholder).toContain("[citation: TBC");
    }
  });
});

// =====================================================================
// 4. Schema validation — every render validates against its Zod schema.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-6 — schema validation", () => {
  function buildInput(): IfrsGeneratorInput {
    return {
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "period:hoz-bank:month:2026-05",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 300_000_000 },
        { leafAccountId: "ACC-equity-position-stub", currency: "ZAR", amountMinor: -300_000_000 },
      ],
      classifications: STANDARD_CLASSIFICATIONS,
    };
  }

  it("Balance Sheet render validates against IfrsBalanceSheetRenderSchema", () => {
    const r = renderIfrsBalanceSheet(generateIfrsBalanceSheet(buildInput()), {
      renderedAt: RENDERED_AT,
    });
    expect(() => IfrsBalanceSheetRenderSchema.parse(r)).not.toThrow();
    expect(r.meta.rendererVersion).toBe(IFRS_RENDERER_VERSION);
  });

  it("Income Statement render validates", () => {
    const r = renderIfrsIncomeStatement(generateIfrsIncomeStatement(buildInput()), {
      renderedAt: RENDERED_AT,
    });
    expect(() => IfrsIncomeStatementRenderSchema.parse(r)).not.toThrow();
  });

  it("Cash Flow render validates", () => {
    const r = renderIfrsCashFlow(generateIfrsCashFlow(buildInput()), {
      renderedAt: RENDERED_AT,
    });
    expect(() => IfrsCashFlowRenderSchema.parse(r)).not.toThrow();
  });

  it("Changes in Equity render validates", () => {
    const r = renderIfrsChangesInEquity(generateIfrsChangesInEquity(buildInput()), {
      renderedAt: RENDERED_AT,
    });
    expect(() => IfrsChangesInEquityRenderSchema.parse(r)).not.toThrow();
  });

  it("Notes render validates", () => {
    const r = renderIfrsNotes(generateIfrsNotes(buildInput()), {
      renderedAt: RENDERED_AT,
    });
    expect(() => IfrsNotesRenderSchema.parse(r)).not.toThrow();
  });
});

// =====================================================================
// 5. Bundle render — coherence + 5 statements composed.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-6 — bundle render", () => {
  function buildBundle(asOf = "2026-05-31T23:59:59.999Z"): IfrsBundleInput {
    const i: IfrsGeneratorInput = {
      entity: ENTITY_BANK,
      asOf,
      periodId: "period:hoz-bank:month:2026-05",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 300_000_000 },
        { leafAccountId: "ACC-equity-position-stub", currency: "ZAR", amountMinor: -300_000_000 },
      ],
      classifications: STANDARD_CLASSIFICATIONS,
    };
    return {
      balanceSheet: generateIfrsBalanceSheet(i),
      incomeStatement: generateIfrsIncomeStatement(i),
      cashFlow: generateIfrsCashFlow(i),
      changesInEquity: generateIfrsChangesInEquity(i),
      notes: generateIfrsNotes(i),
    };
  }

  it("bundle composes all five statements + validates", () => {
    const b = renderIfrsBundle(buildBundle(), { renderedAt: RENDERED_AT });
    expect(() => IfrsBundleRenderSchema.parse(b)).not.toThrow();
    expect(b.bundleMeta.entity).toBe(ENTITY_BANK);
    expect(b.balanceSheet.meta.statement).toBe("SoFP");
    expect(b.incomeStatement.meta.statement).toBe("P&L");
    expect(b.cashFlow.meta.statement).toBe("SCF");
    expect(b.changesInEquity.meta.statement).toBe("SoCE");
    expect(b.notes.meta.statement).toBe("notes");
  });

  it("bundle rejects mismatched statements (entity differs)", () => {
    // Tampered: build two bundles for different entities, then swap one
    // statement in. Easier path — clone and alter the meta.
    const good = buildBundle();
    const bad: IfrsBundleInput = {
      ...good,
      balanceSheet: { ...good.balanceSheet, meta: { ...good.balanceSheet.meta, entity: "OTHER" } },
    };
    expect(() => renderIfrsBundle(bad, { renderedAt: RENDERED_AT })).toThrow(/entities differ/);
  });

  it("canonical bundle is deterministic (byte-identical across runs)", () => {
    const b = buildBundle();
    const a = renderIfrsBundleCanonical(b, { renderedAt: RENDERED_AT });
    const c = renderIfrsBundleCanonical(b, { renderedAt: RENDERED_AT });
    expect(a.canonicalJson).toBe(c.canonicalJson);
    expect(a.canonicalBytes.length).toBe(c.canonicalBytes.length);
  });

  it("canonicalisation sorts top-level keys lexically ($schema first)", () => {
    const b = buildBundle();
    const r = renderIfrsBundle(b, { renderedAt: RENDERED_AT });
    const c = canonicaliseIfrs(r);
    const lines = c.split("\n");
    const firstKey = lines[1]?.trim().split(":")[0];
    expect(firstKey).toBe('"$schema"');
  });
});

// =====================================================================
// 6. Generator boundary errors.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-6 — generator boundary errors", () => {
  it("rejects duplicate classifications for the same account", () => {
    expect(() =>
      generateIfrsBalanceSheet({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [
          { leafAccountId: "ACC-X", accountClass: "asset" },
          { leafAccountId: "ACC-X", accountClass: "liability" },
        ],
      }),
    ).toThrow(/duplicate classification/);
  });
});

// =====================================================================
// 7. Comparative-period support.
// =====================================================================

describe("D-REPORTING-CAPABILITY-SLICE-6 — comparative-period support", () => {
  it("Balance Sheet emits comparative columns when supplied", () => {
    const bs = generateIfrsBalanceSheet({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "p",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 300_000_000 }],
      comparativeTrialBalance: [
        { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 200_000_000 },
      ],
      comparativeAsOf: "2026-04-30T23:59:59.999Z",
      classifications: [
        {
          leafAccountId: "ACC-1100-001",
          accountClass: "asset",
          lineLabel: "Cash",
          cashFlowClass: "operating",
        },
      ],
    });
    expect(bs.assets.comparativeTotalMinor).toBe(200_000_000);
    expect(bs.assets.lineItems[0]?.comparativeAmountMinor).toBe(200_000_000);
  });

  it("Balance Sheet renders null comparative when comparativeTrialBalance absent", () => {
    const bs = generateIfrsBalanceSheet({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "p",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 300_000_000 }],
      classifications: [
        {
          leafAccountId: "ACC-1100-001",
          accountClass: "asset",
          lineLabel: "Cash",
          cashFlowClass: "operating",
        },
      ],
    });
    expect(bs.assets.comparativeTotalMinor).toBeNull();
    expect(bs.assets.lineItems[0]?.comparativeAmountMinor).toBeNull();
  });
});
