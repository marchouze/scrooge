// tests/ba-600-balance-sheet.test.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — exit-criterion tests for the BA 600
// (Balance Sheet) generator + JSON renderer.
//
// Asserts:
//   1. Per-entity isolation — Hoz Securities + Hoz Group rejected.
//   2. End-to-end: synthetic SubLedgerPostingEmitted events
//        → openPeriod → closePeriod (Slice 2)
//        → generateBa600BalanceSheet
//        → renderBa600ToJson
//   3. Balance invariant — assets = liabilities + equity (strict).
//   4. Strict mode throws on imbalance; tolerance mode surfaces as placeholder.
//   5. Sign-convention warnings for credit-balance assets / debit-balance
//      liabilities + equity.
//   6. Classification gaps surface (not fatal).
//   7. Determinism — same generator output ⇒ byte-identical canonical JSON.
//   8. Schema validation — rendered output validates against Ba600RenderSchema.
//   9. Provenance passthrough — TrialBalanceSnapshotted.event_id flows
//      into Ba600BalanceSheet.meta.trialBalanceSnapshotEventId.
//  10. Generator boundary errors — duplicate classifications; bad currency.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
//   2026-05-10) extended 2026-05-17 by Marc's directive
//   (WS-FINANCE-BA-RETURNS-QUINTET).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Anya (Data / analytics engineer,
//   engineering — reports to Devon COO).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  BA_600_BANK_ENTITIES,
  BA_600_SCHEMA_URL,
  Ba600GeneratorError,
  type Ba600LineClassification,
  Ba600RenderSchema,
  canonicaliseBa600,
  generateBa600BalanceSheet,
  renderBa600Canonical,
  renderBa600ToJson,
} from "../platform/reporting";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ENTITY_GROUP = "LE-ZA-HOZ-GROUP";

const ACTOR = { type: "service" as const, id: "agent:Bea" };
const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "WS-FINANCE-BA-RETURNS-QUINTET"];

const PERIOD_OPEN = {
  periodId: "period:hoz-bank:month:2026-05",
  periodKind: "month" as const,
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-05-31T23:59:59.999Z",
  openedAt: "2026-05-01T00:00:00.000Z",
  functionalCurrency: "ZAR",
};

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
    citations: CITATIONS,
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: args.legs.map((l) => ({ ...l, memo: "test" })),
      asOfDate: args.asOf,
      citations: CITATIONS,
    },
  });
}

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// 1. Per-entity isolation.
// ---------------------------------------------------------------------------

describe("BA 600 — per-entity isolation", () => {
  it("BA_600_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_600_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES", () => {
    expect(() =>
      generateBa600BalanceSheet({
        entity: ENTITY_SECURITIES,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(Ba600GeneratorError);
  });

  it("rejects LE-ZA-HOZ-GROUP (consolidated lands at downstream slice)", () => {
    expect(() =>
      generateBa600BalanceSheet({
        entity: ENTITY_GROUP,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(Ba600GeneratorError);
  });

  it("rejects invalid functional currency", () => {
    expect(() =>
      generateBa600BalanceSheet({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZARS",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(/ISO-4217/);
  });
});

// ---------------------------------------------------------------------------
// 2. End-to-end events → close → BA 600.
// ---------------------------------------------------------------------------

describe("BA 600 — end-to-end (events → close → BA 600)", () => {
  function setupClose(): {
    store: EventStore;
    trialBalanceSnapshotEventId: string;
    rows: ReadonlyArray<{ leafAccountId: string; currency: string; amountMinor: number }>;
  } {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: PERIOD_OPEN,
    });
    // Capital injection: R2,500,000 cash debit / equity credit.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-02T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-1100-001",
          credit: "ACC-equity-position-stub",
          currency: "ZAR",
          amountMinor: 250_000_000,
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

  it("produces a balanced BA 600 from synthetic events", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const classifications: Ba600LineClassification[] = [
      {
        leafAccountId: "ACC-1100-001",
        section: "assets",
        lineLabel: "assets.cash-and-balances-at-sarb",
      },
      {
        leafAccountId: "ACC-equity-position-stub",
        section: "equity",
        lineLabel: "equity.share-capital",
      },
    ];
    const out = generateBa600BalanceSheet({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications,
      trialBalanceSnapshotEventId,
    });

    expect(out.assets.totalMinor).toBe(250_000_000);
    expect(out.liabilities.totalMinor).toBe(0);
    expect(out.equity.totalMinor).toBe(250_000_000);
    expect(out.balanceCheck.balanced).toBe(true);
    expect(out.balanceCheck.differenceMinor).toBe(0);
    expect(out.classificationGaps).toEqual([]);
    expect(out.meta.trialBalanceSnapshotEventId).toBe(trialBalanceSnapshotEventId);
    expect(out.citations).toContain("Banks Act 94 of 1990 §75");
    expect(out.citations).toContain("IAS 1 — Presentation of Financial Statements");
  });

  it("renders to canonical JSON validating against Ba600RenderSchema", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const out = generateBa600BalanceSheet({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: [
        {
          leafAccountId: "ACC-1100-001",
          section: "assets",
          lineLabel: "assets.cash-and-balances-at-sarb",
        },
        {
          leafAccountId: "ACC-equity-position-stub",
          section: "equity",
          lineLabel: "equity.share-capital",
        },
      ],
      trialBalanceSnapshotEventId,
    });
    const renderedAt = "2026-05-17T15:00:00.000Z";
    const render = renderBa600ToJson(out, { renderedAt });
    expect(() => Ba600RenderSchema.parse(render)).not.toThrow();
    expect(render.$schema).toBe(BA_600_SCHEMA_URL);
    expect(render.meta.rendererVersion).toBe("v0.1");
    expect(render.meta.renderedAt).toBe(renderedAt);
    expect(render.assets.section).toBe("assets");
    expect(render.balanceCheck.balanced).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Strict-mode imbalance throws; tolerance surfaces as placeholder.
// ---------------------------------------------------------------------------

describe("BA 600 — balance invariant", () => {
  const unbalanced = {
    entity: ENTITY_BANK,
    asOf: "2026-05-31T23:59:59.999Z",
    periodId: "x",
    functionalCurrency: "ZAR",
    trialBalance: [
      { leafAccountId: "ACC-asset", currency: "ZAR", amountMinor: 100_000 },
      { leafAccountId: "ACC-equity", currency: "ZAR", amountMinor: -50_000 },
    ],
    classifications: [
      {
        leafAccountId: "ACC-asset",
        section: "assets" as const,
        lineLabel: "assets.cash",
      },
      {
        leafAccountId: "ACC-equity",
        section: "equity" as const,
        lineLabel: "equity.share-capital",
      },
    ],
  };

  it("strict mode (default) throws on imbalance", () => {
    expect(() => generateBa600BalanceSheet(unbalanced)).toThrow(/invariant violated/);
  });

  it("tolerateImbalanceMinor surfaces imbalance as placeholder, no throw", () => {
    const out = generateBa600BalanceSheet({
      ...unbalanced,
      tolerateImbalanceMinor: 100_000,
    });
    expect(out.balanceCheck.balanced).toBe(true); // within tolerance
    expect(out.balanceCheck.differenceMinor).toBe(50_000);
  });

  it("tolerance smaller than imbalance still throws", () => {
    expect(() =>
      generateBa600BalanceSheet({
        ...unbalanced,
        tolerateImbalanceMinor: 0,
      }),
    ).toThrow(/invariant violated/);
  });

  it("negative tolerance is rejected", () => {
    expect(() =>
      generateBa600BalanceSheet({
        ...unbalanced,
        tolerateImbalanceMinor: -1,
      }),
    ).toThrow(/non-negative/);
  });
});

// ---------------------------------------------------------------------------
// 4. Sign-convention warnings + classification gaps.
// ---------------------------------------------------------------------------

describe("BA 600 — sign-convention warnings + classification gaps", () => {
  it("flags asset accounts with credit balances", () => {
    const out = generateBa600BalanceSheet({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-weird-asset", currency: "ZAR", amountMinor: -50_000 },
        { leafAccountId: "ACC-eq", currency: "ZAR", amountMinor: -50_000 },
      ],
      classifications: [
        { leafAccountId: "ACC-weird-asset", section: "assets", lineLabel: "assets.cash" },
        { leafAccountId: "ACC-eq", section: "equity", lineLabel: "equity.share-capital" },
      ],
    });
    const assetLine = out.assets.lineItems.find((l) => l.lineId === "assets.ACC-weird-asset");
    expect(assetLine?.note).toContain("sign convention violated");
  });

  it("classification gaps surface for unmapped rows", () => {
    const out = generateBa600BalanceSheet({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-mapped", currency: "ZAR", amountMinor: 100 },
        { leafAccountId: "ACC-unmapped", currency: "ZAR", amountMinor: 50 },
        { leafAccountId: "ACC-eq", currency: "ZAR", amountMinor: -100 },
      ],
      classifications: [
        { leafAccountId: "ACC-mapped", section: "assets", lineLabel: "assets.cash" },
        { leafAccountId: "ACC-eq", section: "equity", lineLabel: "equity.share-capital" },
      ],
      tolerateImbalanceMinor: 1_000_000,
    });
    expect(out.classificationGaps.length).toBe(1);
    expect(out.classificationGaps[0]?.leafAccountId).toBe("ACC-unmapped");
    expect(out.placeholders.some((p) => p.includes("no line classification"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Determinism.
// ---------------------------------------------------------------------------

describe("BA 600 — canonicaliser determinism", () => {
  it("identical inputs ⇒ identical bytes", () => {
    const input = {
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-a", currency: "ZAR", amountMinor: 100 },
        { leafAccountId: "ACC-eq", currency: "ZAR", amountMinor: -100 },
      ],
      classifications: [
        { leafAccountId: "ACC-a", section: "assets" as const, lineLabel: "assets.cash" },
        {
          leafAccountId: "ACC-eq",
          section: "equity" as const,
          lineLabel: "equity.share-capital",
        },
      ],
    };
    const a = renderBa600Canonical(generateBa600BalanceSheet(input), {
      renderedAt: "2026-05-17T15:00:00.000Z",
    });
    const b = renderBa600Canonical(generateBa600BalanceSheet(input), {
      renderedAt: "2026-05-17T15:00:00.000Z",
    });
    expect(a.canonicalJson).toBe(b.canonicalJson);
    expect(a.canonicalBytes.length).toBe(b.canonicalBytes.length);

    // Top-level: $schema first.
    const lines = a.canonicalJson.split("\n");
    expect(lines[1]?.trim().startsWith('"$schema"')).toBe(true);
  });

  it("canonicaliseBa600 is idempotent on already-rendered output", () => {
    const out = generateBa600BalanceSheet({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-a", currency: "ZAR", amountMinor: 100 },
        { leafAccountId: "ACC-eq", currency: "ZAR", amountMinor: -100 },
      ],
      classifications: [
        { leafAccountId: "ACC-a", section: "assets", lineLabel: "assets.cash" },
        { leafAccountId: "ACC-eq", section: "equity", lineLabel: "equity.share-capital" },
      ],
    });
    const r = renderBa600ToJson(out, { renderedAt: "2026-05-17T15:00:00.000Z" });
    expect(canonicaliseBa600(r)).toBe(canonicaliseBa600(r));
  });
});

// ---------------------------------------------------------------------------
// 6. Generator boundary errors.
// ---------------------------------------------------------------------------

describe("BA 600 — boundary errors", () => {
  it("rejects duplicate classifications", () => {
    expect(() =>
      generateBa600BalanceSheet({
        entity: ENTITY_BANK,
        asOf: "2026-05-31T23:59:59.999Z",
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [
          { leafAccountId: "ACC-X", section: "assets", lineLabel: "x" },
          { leafAccountId: "ACC-X", section: "liabilities", lineLabel: "x" },
        ],
      }),
    ).toThrow(/duplicate classification/);
  });
});

// ---------------------------------------------------------------------------
// 8. Counterparty-sector decomposition (SARB BA 100 per-line requirement).
// ---------------------------------------------------------------------------

describe("BA 600 — counterparty-sector decomposition", () => {
  // Synthetic balance sheet spanning all four mappable sectors plus `other`:
  //   - ACC-7100-001 "Due from Banks" (IBL placement) ............. bank
  //   - ACC-3100-001 government bond asset ........................ sovereign
  //   - ACC-1100-001 SARB reserve (central-bank custodian) ........ sovereign
  //   - ACC-6100-001 retail deposit liability ..................... retail
  //   - ACC-6100-003 wholesale deposit liability .................. corporate
  //   - ACC-2100-001 FX trading receivable (own-book) ............. other
  //   - ACC-equity-position-stub equity capital .................... other (not in COA)
  const ENTITY = ENTITY_BANK;
  const COMMON = {
    entity: ENTITY,
    asOf: "2026-05-31T23:59:59.999Z",
    periodId: "x",
    functionalCurrency: "ZAR",
  } as const;

  function sectorInput() {
    return {
      ...COMMON,
      trialBalance: [
        // Assets
        { leafAccountId: "ACC-7100-001", currency: "ZAR", amountMinor: 100_000 }, // bank
        { leafAccountId: "ACC-3100-001", currency: "ZAR", amountMinor: 60_000 }, // sovereign
        { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 40_000 }, // sovereign
        { leafAccountId: "ACC-2100-001", currency: "ZAR", amountMinor: 30_000 }, // other (own-book FX)
        // Liabilities (credit balances → negative)
        { leafAccountId: "ACC-6100-001", currency: "ZAR", amountMinor: -120_000 }, // retail
        { leafAccountId: "ACC-6100-003", currency: "ZAR", amountMinor: -80_000 }, // corporate
        // Equity (credit balance → negative)
        { leafAccountId: "ACC-equity-position-stub", currency: "ZAR", amountMinor: -30_000 }, // other
      ],
      classifications: [
        {
          leafAccountId: "ACC-7100-001",
          section: "assets" as const,
          lineLabel: "assets.due-from-banks",
        },
        {
          leafAccountId: "ACC-3100-001",
          section: "assets" as const,
          lineLabel: "assets.investment-securities",
        },
        {
          leafAccountId: "ACC-1100-001",
          section: "assets" as const,
          lineLabel: "assets.cash-and-balances-at-sarb",
        },
        {
          leafAccountId: "ACC-2100-001",
          section: "assets" as const,
          lineLabel: "assets.trading-assets",
        },
        {
          leafAccountId: "ACC-6100-001",
          section: "liabilities" as const,
          lineLabel: "liabilities.deposits",
        },
        {
          leafAccountId: "ACC-6100-003",
          section: "liabilities" as const,
          lineLabel: "liabilities.deposits",
        },
        {
          leafAccountId: "ACC-equity-position-stub",
          section: "equity" as const,
          lineLabel: "equity.share-capital",
        },
      ],
    };
  }

  it("decomposes each line by counterparty sector (IBL=bank, bond/SARB=sovereign, deposits=retail/corporate)", () => {
    const out = generateBa600BalanceSheet(sectorInput());
    const byLine = new Map(out.sectorBreakdown.lines.map((l) => [l.lineId, l.bySector]));

    expect(byLine.get("assets.ACC-7100-001")?.bank).toBe(100_000);
    expect(byLine.get("assets.ACC-3100-001")?.sovereign).toBe(60_000);
    expect(byLine.get("assets.ACC-1100-001")?.sovereign).toBe(40_000);
    expect(byLine.get("assets.ACC-2100-001")?.other).toBe(30_000);
    expect(byLine.get("liabilities.ACC-6100-001")?.retail).toBe(120_000);
    expect(byLine.get("liabilities.ACC-6100-003")?.corporate).toBe(80_000);
    expect(byLine.get("equity.ACC-equity-position-stub")?.other).toBe(30_000);
  });

  it("section sector splits reconcile exactly to section totals", () => {
    const out = generateBa600BalanceSheet(sectorInput());
    const { sectionTotals } = out.sectorBreakdown;

    const sumSplit = (s: {
      bank: number;
      corporate: number;
      sovereign: number;
      retail: number;
      other: number;
    }) => s.bank + s.corporate + s.sovereign + s.retail + s.other;

    expect(sumSplit(sectionTotals.assets)).toBe(out.assets.totalMinor);
    expect(sumSplit(sectionTotals.liabilities)).toBe(out.liabilities.totalMinor);
    expect(sumSplit(sectionTotals.equity)).toBe(out.equity.totalMinor);
    expect(out.sectorBreakdown.reconciled).toBe(true);

    // Assets: bank 100k + sovereign 100k + other 30k = 230k.
    expect(sectionTotals.assets.bank).toBe(100_000);
    expect(sectionTotals.assets.sovereign).toBe(100_000);
    expect(sectionTotals.assets.other).toBe(30_000);
    // Liabilities: retail 120k + corporate 80k = 200k.
    expect(sectionTotals.liabilities.retail).toBe(120_000);
    expect(sectionTotals.liabilities.corporate).toBe(80_000);
  });

  it("form total reconciles to assets + liabilities + equity magnitudes", () => {
    const out = generateBa600BalanceSheet(sectorInput());
    const ft = out.sectorBreakdown.formTotal;
    const total = ft.bank + ft.corporate + ft.sovereign + ft.retail + ft.other;
    expect(total).toBe(out.assets.totalMinor + out.liabilities.totalMinor + out.equity.totalMinor);
  });

  it("unmappable accounts surface in `other`, never hidden", () => {
    const out = generateBa600BalanceSheet({
      ...COMMON,
      trialBalance: [
        { leafAccountId: "ACC-unknown-account", currency: "ZAR", amountMinor: 100 },
        { leafAccountId: "ACC-eq", currency: "ZAR", amountMinor: -100 },
      ],
      classifications: [
        {
          leafAccountId: "ACC-unknown-account",
          section: "assets" as const,
          lineLabel: "assets.cash",
        },
        { leafAccountId: "ACC-eq", section: "equity" as const, lineLabel: "equity.share-capital" },
      ],
    });
    const unknownLine = out.sectorBreakdown.lines.find(
      (l) => l.lineId === "assets.ACC-unknown-account",
    );
    expect(unknownLine?.bySector.other).toBe(100);
    expect(out.sectorBreakdown.sectionTotals.assets.other).toBe(100);
  });

  it("sectorBreakdown carries through the canonical render + schema", () => {
    const out = generateBa600BalanceSheet(sectorInput());
    const render = renderBa600ToJson(out, { renderedAt: "2026-05-31T15:00:00.000Z" });
    expect(() => Ba600RenderSchema.parse(render)).not.toThrow();
    expect(render.sectorBreakdown.reconciled).toBe(true);
    expect(render.sectorBreakdown.sectionTotals.assets.bank).toBe(100_000);
  });
});

// ---------------------------------------------------------------------------
// 7. Per-currency totals.
// ---------------------------------------------------------------------------

describe("BA 600 — per-currency totals", () => {
  it("rolls up assets/liabilities/equity per currency across all rows", () => {
    const out = generateBa600BalanceSheet({
      entity: ENTITY_BANK,
      asOf: "2026-05-31T23:59:59.999Z",
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [
        { leafAccountId: "ACC-zar-asset", currency: "ZAR", amountMinor: 100 },
        { leafAccountId: "ACC-zar-eq", currency: "ZAR", amountMinor: -100 },
        { leafAccountId: "ACC-usd-asset", currency: "USD", amountMinor: 200 },
        { leafAccountId: "ACC-usd-eq", currency: "USD", amountMinor: -200 },
      ],
      classifications: [
        { leafAccountId: "ACC-zar-asset", section: "assets", lineLabel: "assets.cash" },
        {
          leafAccountId: "ACC-zar-eq",
          section: "equity",
          lineLabel: "equity.share-capital",
        },
        { leafAccountId: "ACC-usd-asset", section: "assets", lineLabel: "assets.cash" },
        {
          leafAccountId: "ACC-usd-eq",
          section: "equity",
          lineLabel: "equity.share-capital",
        },
      ],
    });
    expect(out.perCurrencyTotals.length).toBe(2);
    const zar = out.perCurrencyTotals.find((t) => t.currency === "ZAR");
    const usd = out.perCurrencyTotals.find((t) => t.currency === "USD");
    expect(zar?.assetsMinor).toBe(100);
    expect(zar?.equityMinor).toBe(100);
    expect(usd?.assetsMinor).toBe(200);
    expect(usd?.equityMinor).toBe(200);
  });
});
