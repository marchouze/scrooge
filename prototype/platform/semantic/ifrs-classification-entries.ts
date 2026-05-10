// platform/semantic/ifrs-classification-entries.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — IFRS-statement
// semantic entries. Extends the Slice 1 (`entries.ts`), Slice 3
// (`liquidity-entries.ts`, `risk-weight-entries.ts`), and Slice 4
// (`capital-entries.ts`) registries with the minimum vocabulary the IFRS
// AFS-skeleton renderer needs to produce the five primary statements per
// IAS 1 + IAS 7:
//
//   TotalAssets               — sum of asset balances per IAS 1 §54.
//   TotalLiabilities          — sum of liability balances per IAS 1 §54.
//   TotalEquity               — TotalAssets − TotalLiabilities per IAS 1 §54.
//   ProfitOrLoss              — net P&L for the period per IAS 1 §82.
//   OtherComprehensiveIncome  — OCI items not recycled to P&L per IAS 1 §82A.
//   TotalComprehensiveIncome  — P&L + OCI per IAS 1 §82.
//   NetCashFromOperating      — IAS 7 §10 indirect-method operating cash flow.
//   NetCashFromInvesting      — IAS 7 §16 investing cash flow.
//   NetCashFromFinancing      — IAS 7 §17 financing cash flow.
//
// Per pack §6 Slice 6 + Marc's Q1 default (rehearsal-grade with
// placeholders), each entry carries:
//   - one resolved citation chain (IAS 1 / IAS 7 / Companies Act 71 of 2008
//     §§28–30) and
//   - a `[citation: TBC]` marker pointing at Camille's accounting-policy
//     adoption choices (per `Owner Inbox/2026-05-06_core-policies-finance.md`
//     §§1–3) which will refine sub-line presentation choices once the
//     policy adoption set is finalised.
//
// Hoz Bank only at v0 — Hoz Securities Limited has its own IFRS-solo set
// (FAIS-related) and Hoz Group consolidated lands at a downstream slice
// once the consolidation projection is built per `D-REGULATORY-PERIMETER`.
// Each entry scopes to `urn:legal-entity:hoz:hoz-bank:v1` per
// `Regulations/_legal-entity-tree.md`.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; IFRS line-mapping owner)
//   + Atlas (Core banking platform architect, engineering — substrate
//   consult; semantic-layer integration contract)
//   + Camille (Chief Financial Officer, governance — reports to CEO;
//   accountable signer for AFS outputs).

import type { SemanticEntry } from "./types";

const HOZ_BANK = "urn:legal-entity:hoz:hoz-bank:v1";

const FIRST_AUTHORED = "2026-05-10T00:00:00.000Z";

/**
 * `TotalAssets` — sum of all asset-side balances per IAS 1 §54. Includes
 * cash, financial assets at FVTPL / FVOCI / amortised cost, loans &
 * advances, derivatives with positive replacement cost, intangibles, PPE,
 * deferred-tax assets.
 */
export const totalAssets: SemanticEntry = {
  id: "TotalAssets",
  version: "v0.1",
  description:
    "Total assets per IAS 1 §54. Sum of all leaf-account balances classified as asset (financial + non-financial). Reported in functional currency at the as-of date.",
  units: "money-minor",
  dimensions: ["currency", "ifrsClassification"],
  projection: "ifrs-balance-sheet",
  formula:
    "sum(Balance where {entity, accountClass='asset', asOf=asOfQuery, currency=functionalCurrency})",
  ifrsLines: [
    {
      statement: "SoFP",
      line: "Total assets",
      side: "positive",
      note: "IAS 1 §54 — exit total of the asset section.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §54",
      note: "Statement of financial position — minimum line items for the asset section.",
    },
    {
      type: "statute",
      statuteRef: "Companies Act 71 of 2008 §§28–30",
      note: "Books-of-account stewardship; financial-statement preparation.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Camille's accounting-policy adoption choices on asset-class sub-line presentation per Owner Inbox/2026-05-06_core-policies-finance.md §1]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["amortised-cost", "fvoci-debt", "fvoci-equity", "fvtpl", "non-financial"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: synthetic balances populate the trial balance; live numbers populate at licence-day. Comparative-period support is a downstream slice (Slice 7-8 in the build proposal); v0 emits the current period only.",
};

/**
 * `TotalLiabilities` — sum of all liability-side balances per IAS 1 §54.
 * Includes deposits, financial liabilities at FVTPL / amortised cost,
 * derivatives with negative replacement cost, provisions, lease liabilities,
 * deferred-tax liabilities, current-tax liabilities.
 */
export const totalLiabilities: SemanticEntry = {
  id: "TotalLiabilities",
  version: "v0.1",
  description:
    "Total liabilities per IAS 1 §54. Sum of all leaf-account balances classified as liability. Reported in functional currency at the as-of date.",
  units: "money-minor",
  dimensions: ["currency", "ifrsClassification"],
  projection: "ifrs-balance-sheet",
  formula:
    "sum(Balance where {entity, accountClass='liability', asOf=asOfQuery, currency=functionalCurrency})",
  ifrsLines: [
    {
      statement: "SoFP",
      line: "Total liabilities",
      side: "positive",
      note: "IAS 1 §54 — exit total of the liability section.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §54",
      note: "Statement of financial position — minimum line items for the liability section.",
    },
    {
      type: "ifrs",
      ifrsRef: "IFRS 9",
      note: "Classification + measurement of financial liabilities.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Camille's accounting-policy adoption choices on liability-class sub-line presentation per Owner Inbox/2026-05-06_core-policies-finance.md §2]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["amortised-cost", "fvtpl", "non-financial"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: synthetic balances populate the trial balance; live numbers populate at licence-day. Sub-classification by maturity bucket (current vs non-current per IAS 1 §60) is a downstream slice once Mira's WS-INSTRUMENT-ANALYSES finalises the chart-of-accounts maturity-bucket field.",
};

/**
 * `TotalEquity` — total equity per IAS 1 §54 — derived as
 * TotalAssets − TotalLiabilities (the accounting equation). Decomposed by
 * the Statement of Changes in Equity into share capital, retained earnings,
 * accumulated OCI, other reserves.
 */
export const totalEquity: SemanticEntry = {
  id: "TotalEquity",
  version: "v0.1",
  description:
    "Total equity per IAS 1 §54. Derived as TotalAssets − TotalLiabilities (the accounting equation). Decomposition into share capital, retained earnings, accumulated OCI, other reserves appears on the SoCE.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "ifrs-balance-sheet",
  formula: "TotalAssets − TotalLiabilities",
  ifrsLines: [
    {
      statement: "SoFP",
      line: "Total equity",
      side: "positive",
      note: "IAS 1 §54 — exit total of the equity section. Ties to the SoCE closing balance.",
    },
    {
      statement: "SoCE",
      line: "Closing balance — total equity",
      side: "positive",
      note: "IAS 1 §106 — closing balance of the SoCE.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §54",
      note: "Statement of financial position — equity section.",
    },
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §106",
      note: "Statement of changes in equity — required reconciliation of opening to closing balance.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Camille's accounting-policy adoption choices on equity-component sub-line presentation per Owner Inbox/2026-05-06_core-policies-finance.md §3]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["equity"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Forms the bridge between SoFP and SoCE. The SoCE closing balance MUST equal the SoFP equity section per IAS 1 §106; the recon harness asserts this tie on every render.",
};

/**
 * `ProfitOrLoss` — net P&L for the period per IAS 1 §82. The income-
 * statement bottom line below the OCI partition.
 */
export const profitOrLoss: SemanticEntry = {
  id: "ProfitOrLoss",
  version: "v0.1",
  description:
    "Profit or loss for the period per IAS 1 §82. Income − expense, before OCI items. Closes to retained earnings on the SoCE.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "ifrs-income-statement",
  formula:
    "sum(Income where {entity, period, asOf=periodEnd}) - sum(Expense where {entity, period, asOf=periodEnd})",
  ifrsLines: [
    {
      statement: "P&L",
      line: "Profit (loss) for the period",
      side: "positive",
      note: "IAS 1 §82(f) — net P&L line.",
    },
    {
      statement: "SoCE",
      line: "Profit (loss) for the period — movement in retained earnings",
      side: "positive",
      note: "IAS 1 §106(d)(i) — total comprehensive income decomposed in the SoCE; P&L moves retained earnings.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §82",
      note: "Statement of profit or loss and other comprehensive income — required line items.",
    },
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §106",
      note: "Statement of changes in equity — P&L flows to retained earnings.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Camille's accounting-policy adoption choices on income/expense classification per nature vs by function per IAS 1 §99]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: tax line is a placeholder pending Yael's tax engine (IAS 12 current + deferred). Per pack §8.2: engine doesn't block on tax — placeholder + [citation: TBC] until Yael's CIT slice activates.",
};

/**
 * `OtherComprehensiveIncome` — OCI items per IAS 1 §82A. FVOCI debt
 * revaluation, FVOCI equity revaluation, FX-translation reserve, cash-
 * flow-hedge reserve, defined-benefit-plan remeasurement.
 */
export const otherComprehensiveIncome: SemanticEntry = {
  id: "OtherComprehensiveIncome",
  version: "v0.1",
  description:
    "Other Comprehensive Income for the period per IAS 1 §82A. Items not recycled to P&L (FVOCI equity, DB-plan remeasurement) + items that may be recycled (FVOCI debt revaluation, FX-translation, cash-flow-hedge).",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "ifrs-income-statement",
  formula:
    "sum(OciItem where {entity, period, asOf=periodEnd}) — split into recycled-eligible vs not by IFRS classification",
  ifrsLines: [
    {
      statement: "OCI",
      line: "Total other comprehensive income for the period",
      side: "positive",
      note: "IAS 1 §82A — exit total of the OCI section.",
    },
    {
      statement: "SoCE",
      line: "Other comprehensive income — movement in OCI reserves",
      side: "positive",
      note: "IAS 1 §106(d)(i) — OCI flows to dedicated OCI reserves on the SoCE.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §82A",
      note: "Statement of profit or loss and other comprehensive income — OCI line items.",
    },
    {
      type: "ifrs",
      ifrsRef: "IFRS 9",
      note: "Classification + measurement — drives FVOCI debt vs FVOCI equity recycling.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Camille's accounting-policy adoption choices on OCI presentation single-statement vs two-statement per IAS 1 §10A]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["fvoci-debt", "fvoci-equity"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0 build-phase: Hoz Bank holds no FVOCI positions yet so OCI = 0; the entry exists so the AFS structure is complete from day one. Populates as FVOCI book is established at licence-day.",
};

/**
 * `TotalComprehensiveIncome` — P&L + OCI per IAS 1 §82. Total movement in
 * equity attributable to the period's activity (excluding owner
 * transactions like dividends, share issuance).
 */
export const totalComprehensiveIncome: SemanticEntry = {
  id: "TotalComprehensiveIncome",
  version: "v0.1",
  description:
    "Total comprehensive income = ProfitOrLoss + OtherComprehensiveIncome per IAS 1 §82. Total movement in equity from period activity (excluding owner transactions).",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "ifrs-income-statement",
  formula: "ProfitOrLoss + OtherComprehensiveIncome",
  ifrsLines: [
    {
      statement: "P&L",
      line: "Total comprehensive income for the period",
      side: "positive",
      note: "IAS 1 §81A — exit line of the combined P&L + OCI statement (single-statement presentation).",
    },
    {
      statement: "SoCE",
      line: "Total comprehensive income for the period",
      side: "positive",
      note: "IAS 1 §106(a) — required SoCE line.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §81A",
      note: "Statement of profit or loss and other comprehensive income — single-statement presentation.",
    },
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §106",
      note: "Statement of changes in equity — TCI flows to equity components.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Camille's accounting-policy adoption choices on single-statement vs two-statement IAS 1 §10A presentation]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
};

/**
 * `NetCashFromOperating` — IAS 7 §10 indirect-method operating cash flow.
 * Starts from P&L and adjusts for non-cash items + working-capital
 * movements.
 */
export const netCashFromOperating: SemanticEntry = {
  id: "NetCashFromOperating",
  version: "v0.1",
  description:
    "Net cash flow from operating activities per IAS 7 §10. Indirect-method derivation: P&L adjusted for non-cash items (depreciation, amortisation, impairment, share-based-payment expense) + working-capital movements.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "ifrs-cash-flow",
  formula:
    "ProfitOrLoss + nonCashAdjustments + workingCapitalMovements (indirect method per IAS 7 §18(b))",
  ifrsLines: [
    {
      statement: "SCF",
      line: "Net cash from operating activities",
      side: "positive",
      note: "IAS 7 §10 — operating activities exit line.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 7 §10",
      note: "Cash-flow statement — operating activities section.",
    },
    {
      type: "ifrs",
      ifrsRef: "IAS 7 §18(b)",
      note: "Indirect-method derivation from P&L.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Camille's accounting-policy adoption choices on direct vs indirect method per IAS 7 §18; bank-specific operating-cash-flow classification of interest received/paid + dividend received per IAS 7 §31–§34]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0 rehearsal-grade: indirect-method formula approximated from period P&L + change in working capital. Bank-specific classification choices (interest received/paid as operating vs investing/financing per IAS 7 §33) tracked as TBC pending Camille's policy adoption.",
};

/**
 * `NetCashFromInvesting` — IAS 7 §16 investing cash flow. Capex,
 * acquisitions, disposals of PPE / intangibles / investments.
 */
export const netCashFromInvesting: SemanticEntry = {
  id: "NetCashFromInvesting",
  version: "v0.1",
  description:
    "Net cash flow from investing activities per IAS 7 §16. Acquisitions + disposals of PPE, intangibles, financial investments not held for trading.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "ifrs-cash-flow",
  formula:
    "sum(InvestingActivityCashMovement where {entity, period, asOf=periodEnd}) — IAS 7 §16(a)–(h)",
  ifrsLines: [
    {
      statement: "SCF",
      line: "Net cash from investing activities",
      side: "positive",
      note: "IAS 7 §16 — investing activities exit line.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 7 §16",
      note: "Cash-flow statement — investing activities section.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — chart-of-accounts cash-flow-classification field for each leaf account; v0 derives from account name patterns]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0 rehearsal-grade: zero in build-phase (no capex). Populates as PPE / intangibles / investment activity begins.",
};

/**
 * `NetCashFromFinancing` — IAS 7 §17 financing cash flow. Capital raises,
 * debt issuance/repayment, dividends paid, lease principal payments.
 */
export const netCashFromFinancing: SemanticEntry = {
  id: "NetCashFromFinancing",
  version: "v0.1",
  description:
    "Net cash flow from financing activities per IAS 7 §17. Equity issuance + redemption + dividends, debt issuance + repayment, lease-principal payments.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "ifrs-cash-flow",
  formula: "sum(FinancingActivityCashMovement where {entity, period, asOf=periodEnd}) — IAS 7 §17",
  ifrsLines: [
    {
      statement: "SCF",
      line: "Net cash from financing activities",
      side: "positive",
      note: "IAS 7 §17 — financing activities exit line.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IAS 7 §17",
      note: "Cash-flow statement — financing activities section.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — chart-of-accounts cash-flow-classification field for each leaf account; v0 derives from account name patterns]",
    },
  ],
  signers: ["Camille", "Bea"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase financing flows: rehearsal share capital injections from synthetic events. Real capital flows populate at licence-day capital-call per project_ai_driven_bank.",
};

/**
 * Slice-6 IFRS-statement entries, exported as a single array for ease of
 * registry construction in tests and downstream consumers (the AFS-skeleton
 * generator, the M3 prudential-return suite, and BRC-pack queries).
 */
export const SLICE_6_IFRS_ENTRIES: readonly SemanticEntry[] = [
  totalAssets,
  totalLiabilities,
  totalEquity,
  profitOrLoss,
  otherComprehensiveIncome,
  totalComprehensiveIncome,
  netCashFromOperating,
  netCashFromInvesting,
  netCashFromFinancing,
] as const;
