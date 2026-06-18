// v2-core/accounting/chart-of-accounts.ts
//
// CANONICAL HOME of the chart-of-accounts schema + data (WS-ACCT-FX-COMPLETENESS
// Slice 1, D-ACCT-SCHEMA-CANONICAL-HOME).
//
// WHY THIS FILE EXISTS
// --------------------
// The chart of accounts was DUAL-SOURCED: a typed Zod registry
// (`platform/accounting/coa-registry.ts`) and a flat seed
// (`platform/accounting/chart-of-accounts.json`) that drifted (three JSON-only
// accounts; the FVOCI OCI-reserve account used by the FX posting code lived in
// the JSON but NOT the typed registry). D-ACCT-SCHEMA-CANONICAL-HOME names the
// single canonical home for the accounting schema: the Zod schemas live in
// `v2-core`, the v1 side only re-exports them.
//
// This module is that single source for:
//   (a) the TypeScript type for a COA account entry (`CoaAccountEntry`),
//   (b) the Zod schema for runtime validation (`CoaAccountEntrySchema`),
//   (c) the typed account registry (`COA_ACCOUNTS`) + id index (`COA_BY_ID`).
//
// The v1 `chart-of-accounts.json` flat seed is GENERATED from `COA_ACCOUNTS`
// (`scripts/generate-chart-of-accounts-json.ts`) and recon-asserted identical by
// `recon:accounting-schema-home` (assertion b). It is no longer an independent
// list. The v1 `coa-registry.ts` RE-EXPORTS everything here and keeps only the
// v1-reporting-coupled derivation helpers (`coaToHqlaClassifications`,
// `coaToCapitalClassifications`, sector helpers) that depend on `platform/`
// reporting types and so cannot live in `v2-core`.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — NO imports from `platform/`,
// `runtime/`, `domains/` (enforced by `recon:v2-no-v1-import`). The HQLA-tier
// and capital-tier string-union types are re-declared here (not imported from
// `platform/reporting`) so the canonical schema is self-contained; the v1
// reporting modules' identically-shaped unions remain structurally compatible.
//
// SEMANTICS PRESERVED (do not change without a Decision):
//   - D-COA-CURRENCY-DECOUPLING (2026-05-30): currency is a first-class FIELD,
//     never embedded in `name`; omitted only for genuine multi-currency pools.
//   - D-HQLA-COA-CLASSIFICATION (2026-05-22): `hqlaLevel` + custodian-derived
//     cash HQLA.
//   - The full account header documentation lives unchanged below.
//
// Authority: D-ACCT-SCHEMA-CANONICAL-HOME (CEO-approved 2026-06-18);
//   D-HQLA-COA-CLASSIFICATION; D-COA-CURRENCY-DECOUPLING;
//   D-DATA-QUALITY-CROSS-DOMAIN-V1; Principle 1; Principle 2; Principle 5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { z } from "zod";

// ---------------------------------------------------------------------------
// HQLA tier + capital tier — string-union types, re-declared here so the
// canonical schema is self-contained (v2-core cannot import platform/reporting).
// These are byte-identical to `platform/reporting/ba-300-lcr.HqlaLevel` and
// `platform/reporting/ba-700-capital.CapitalTier`; structural compatibility is
// preserved so the v1 reporting consumers continue to type-check.
// ---------------------------------------------------------------------------

/** Basel III HQLA tier per BCBS D295 §49–§54 / Reg 26(7). */
export type CoaHqlaLevel = "level-1" | "level-2a" | "level-2b";

/** Basel III capital tier per Reg 38(8) / BCBS Basel III §50–§57. */
export type CoaCapitalTier = "cet1" | "at1" | "t2";

// ---------------------------------------------------------------------------
// TypeScript type
// ---------------------------------------------------------------------------

/**
 * A single account entry in the chart of accounts. See the module header and the
 * per-field doc comments for the full semantics (HQLA tagging, custodian-derived
 * HQLA, currency decoupling, capital tiers).
 *
 * Citations: D-HQLA-COA-CLASSIFICATION; BCBS D295 §II.A; SARB BA 110; Reg 26(7);
 *            D-COA-CURRENCY-DECOUPLING; D-DATA-QUALITY-CROSS-DOMAIN-V1.
 */
export interface CoaAccountEntry {
  /** Stable GL account identifier. Convention: ACC-<TYPE><CATEGORY>-<NNN>. */
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly side: "debit" | "credit";
  /**
   * The account's designated ISO-4217 currency — a SEPARATE DIMENSION, never
   * part of `name` (D-COA-CURRENCY-DECOUPLING). Omitted only for genuinely
   * multi-currency pool accounts (per-entry `SubLedgerLeg.currency`
   * authoritative). ZAR is the reporting/base currency — presentation, not data.
   */
  readonly currency?: string;
  /**
   * HQLA tier per BCBS D295 §49–§54 / Reg 26(7). Absent = not HQLA-eligible.
   * Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §II.A; SARB BA 110; Reg 26(7).
   */
  readonly hqlaLevel?: CoaHqlaLevel;
  /** Sub-category label for BA 110 line rendering. Only meaningful with `hqlaLevel`. */
  readonly hqlaSubCategory?: string;
  /** Per-asset haircut factor for level-2b accounts (BCBS D295 §54). */
  readonly hqlaAssetSpecificFactor?: number;
  /** Basel III capital tier per Reg 38(8) / BCBS Basel III §50–§57. */
  readonly capitalTier?: CoaCapitalTier;
  /** Sub-category label for BA 100 line rendering. Only meaningful with `capitalTier`. */
  readonly capitalSubCategory?: string;
  /** ISIN of the security held in this GL account (SecurityMaster HQLA override bridge). */
  readonly isin?: string;
  /**
   * Party URN of the custodian holding the cash in this account. The custodian —
   * not a hand-typed `hqlaLevel` tag — is the SOURCE FACT that determines HQLA
   * tier for cash-nature accounts (Principle 1).
   */
  readonly custodianPartyId?: string;
}

// ---------------------------------------------------------------------------
// Zod schema for runtime validation
// ---------------------------------------------------------------------------

export const CoaAccountEntrySchema = z.object({
  id: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/),
  name: z.string().min(1),
  category: z.string().min(1),
  side: z.enum(["debit", "credit"]),
  // D-COA-CURRENCY-DECOUPLING (2026-05-30): designated currency, first-class.
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  hqlaLevel: z.enum(["level-1", "level-2a", "level-2b"]).optional(),
  hqlaSubCategory: z.string().optional(),
  hqlaAssetSpecificFactor: z.number().min(0).max(1).optional(),
  isin: z.string().optional(),
  custodianPartyId: z.string().optional(),
  // D-DATA-QUALITY-CROSS-DOMAIN-V1: capital tier for BA 100 capital fold.
  capitalTier: z.enum(["cet1", "at1", "t2"]).optional(),
  capitalSubCategory: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Typed account registry — the single canonical CoA source.
// ---------------------------------------------------------------------------

export const COA_ACCOUNTS: readonly CoaAccountEntry[] = [
  // 1000 — Bank/cash
  { id: "ACC-1000-001", name: "Bank", category: "asset-cash", currency: "ZAR", side: "debit" },

  // 1100 — Central-bank reserve, settlement suspense, deprecated nostros
  {
    id: "ACC-1100-001",
    name: "Central Bank Reserve Account",
    category: "asset-cash",
    currency: "ZAR",
    side: "debit",
    // HQLA tier DERIVED from the custodian (central-bank → Level-1), never authored.
    custodianPartyId: "urn:party:legal-entity:sarb",
  },
  // DEPRECATED — merged into ACC-1200-002 / ACC-1200-003 (D-COA-CURRENCY-DECOUPLING).
  { id: "ACC-1100-002", name: "Nostro", category: "asset-cash", currency: "USD", side: "debit" },
  { id: "ACC-1100-003", name: "Nostro", category: "asset-cash", currency: "EUR", side: "debit" },
  {
    id: "ACC-1100-004",
    name: "FX Settlement Suspense",
    category: "asset-suspense",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-1100-005",
    name: "FX Settlement Suspense",
    category: "asset-suspense",
    currency: "USD",
    side: "debit",
  },

  // 1200 — Correspondent bank nostros (ZAR/USD/EUR/GBP/JPY/CHF/AUD)
  { id: "ACC-1200-001", name: "Nostro", category: "asset-cash", currency: "ZAR", side: "debit" },
  { id: "ACC-1200-002", name: "Nostro", category: "asset-cash", currency: "USD", side: "debit" },
  { id: "ACC-1200-003", name: "Nostro", category: "asset-cash", currency: "EUR", side: "debit" },
  { id: "ACC-1200-004", name: "Nostro", category: "asset-cash", currency: "GBP", side: "debit" },
  { id: "ACC-1200-005", name: "Nostro", category: "asset-cash", currency: "JPY", side: "debit" },
  { id: "ACC-1200-006", name: "Nostro", category: "asset-cash", currency: "CHF", side: "debit" },
  { id: "ACC-1200-007", name: "Nostro", category: "asset-cash", currency: "AUD", side: "debit" },

  // 2100 — FX trading receivables / payables / P&L (ZAR + USD pool)
  {
    id: "ACC-2100-001",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-2100-002",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "USD",
    side: "debit",
  },
  {
    id: "ACC-2100-003",
    name: "FX Trading Payable",
    category: "liability-payable",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-2100-004",
    name: "FX Trading Payable",
    category: "liability-payable",
    currency: "USD",
    side: "credit",
  },
  {
    id: "ACC-2100-005",
    name: "Unrealised FX P&L — FVTPL",
    category: "income-trading",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-2100-006",
    name: "Realised FX P&L",
    category: "income-trading",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-2100-007",
    name: "FX Unresolved-Currency Suspense",
    category: "asset-suspense",
    // Currency intentionally OMITTED — loud transient holding pen for unresolved
    // currencies (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE). Per-leg currency
    // authoritative. Designated side debit; legitimately carries both sides.
    side: "debit",
  },
  // ACC-2100-008 — OCI Reserve — FX (FVOCI election, IFRS 9 §5.7.5).
  // RECONCILED into the canonical registry (WS-ACCT-FX-COMPLETENESS Slice 1):
  // this account is the FVOCI OCI-reserve target referenced by the FX posting
  // code (`FX_FVOCI_OCI_RESERVE_ACCOUNT = "ACC-2100-008"` in posting-rules-v2/
  // fx.ts) but previously existed ONLY in chart-of-accounts.json — the exact
  // dual-source drift D-ACCT-SCHEMA-CANONICAL-HOME closes. It is `equity`
  // (an OCI reserve component of equity), credit side, ZAR presentation.
  {
    id: "ACC-2100-008",
    name: "OCI Reserve — FX (FVOCI election, IFRS 9 §5.7.5)",
    category: "equity",
    currency: "ZAR",
    side: "credit",
  },
  // ACC-2100-009 — FX Sub-Ledger Build-Phase Remediation Suspense.
  // RECONCILED into the canonical registry (Slice 1): live since PR #958
  // (fx-subledger-trade-reconciliation.ts FX_REMEDIATION_SUSPENSE) but JSON-only.
  {
    id: "ACC-2100-009",
    name: "FX Sub-Ledger Build-Phase Remediation Suspense",
    category: "asset-suspense",
    currency: "ZAR",
    side: "debit",
  },

  // 2100-010..024 — Per-currency FX-spot trading accounts (GBP/EUR/CHF/AUD/JPY)
  // GBP
  {
    id: "ACC-2100-010",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "GBP",
    side: "debit",
  },
  {
    id: "ACC-2100-011",
    name: "FX Trading Payable",
    category: "liability-payable",
    currency: "GBP",
    side: "credit",
  },
  {
    id: "ACC-2100-012",
    name: "Unrealised FX P&L — FVTPL",
    category: "income-trading",
    currency: "GBP",
    side: "credit",
  },
  // EUR
  {
    id: "ACC-2100-013",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "EUR",
    side: "debit",
  },
  {
    id: "ACC-2100-014",
    name: "FX Trading Payable",
    category: "liability-payable",
    currency: "EUR",
    side: "credit",
  },
  {
    id: "ACC-2100-015",
    name: "Unrealised FX P&L — FVTPL",
    category: "income-trading",
    currency: "EUR",
    side: "credit",
  },
  // CHF
  {
    id: "ACC-2100-016",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "CHF",
    side: "debit",
  },
  {
    id: "ACC-2100-017",
    name: "FX Trading Payable",
    category: "liability-payable",
    currency: "CHF",
    side: "credit",
  },
  {
    id: "ACC-2100-018",
    name: "Unrealised FX P&L — FVTPL",
    category: "income-trading",
    currency: "CHF",
    side: "credit",
  },
  // AUD
  {
    id: "ACC-2100-019",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "AUD",
    side: "debit",
  },
  {
    id: "ACC-2100-020",
    name: "FX Trading Payable",
    category: "liability-payable",
    currency: "AUD",
    side: "credit",
  },
  {
    id: "ACC-2100-021",
    name: "Unrealised FX P&L — FVTPL",
    category: "income-trading",
    currency: "AUD",
    side: "credit",
  },
  // JPY
  {
    id: "ACC-2100-022",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "JPY",
    side: "debit",
  },
  {
    id: "ACC-2100-023",
    name: "FX Trading Payable",
    category: "liability-payable",
    currency: "JPY",
    side: "credit",
  },
  {
    id: "ACC-2100-024",
    name: "Unrealised FX P&L — FVTPL",
    category: "income-trading",
    currency: "JPY",
    side: "credit",
  },

  // 2100-025/026 — IAS 21 §28 forward-points deferred income/expense
  {
    id: "ACC-2100-025",
    name: "FX Forward-Points Deferred Income",
    category: "liability-payable",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-2100-026",
    name: "FX Forward-Points Deferred Expense",
    category: "asset-trading",
    currency: "ZAR",
    side: "debit",
  },

  // 2105 — FX sub-ledger build-phase write-off P&L (multi-currency by design)
  {
    id: "ACC-2105-001",
    name: "FX Sub-Ledger Build-Phase Write-Off",
    category: "income-trading",
    side: "debit",
  },

  // 2200 — Customer payables
  {
    id: "ACC-2200-001",
    name: "Customer Payables",
    category: "liability-payable",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-2200-002",
    name: "Customer Payables",
    category: "liability-payable",
    currency: "USD",
    side: "credit",
  },

  // 2300 — Settlement-failed receivables / ECL
  {
    id: "ACC-2300-001",
    name: "Settlement-Failed Receivable",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-2300-002",
    name: "Settlement-Failed Receivable",
    category: "asset-receivable",
    currency: "USD",
    side: "debit",
  },
  {
    id: "ACC-2300-005",
    name: "Settlement-Failed Receivable",
    category: "asset-receivable",
    currency: "EUR",
    side: "debit",
  },
  {
    id: "ACC-2300-006",
    name: "Settlement-Failed Receivable",
    category: "asset-receivable",
    currency: "GBP",
    side: "debit",
  },
  {
    id: "ACC-2300-007",
    name: "Settlement-Failed Receivable",
    category: "asset-receivable",
    currency: "JPY",
    side: "debit",
  },
  {
    id: "ACC-2300-008",
    name: "Settlement-Failed Receivable",
    category: "asset-receivable",
    currency: "CHF",
    side: "debit",
  },
  {
    id: "ACC-2300-009",
    name: "Settlement-Failed Receivable",
    category: "asset-receivable",
    currency: "AUD",
    side: "debit",
  },
  {
    id: "ACC-2300-003",
    name: "ECL Allowance — Settlement-Failed",
    category: "asset-other",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-2300-004",
    name: "Credit Loss Expense — FX Settlement",
    category: "expense-impairment",
    currency: "ZAR",
    side: "debit",
  },

  // 2400 — Payment suspense
  {
    id: "ACC-2400-001",
    name: "Payment Suspense",
    category: "asset-suspense",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-2400-002",
    name: "Payment Suspense",
    category: "asset-suspense",
    currency: "USD",
    side: "debit",
  },

  // 3100 — Bond assets
  {
    id: "ACC-3100-001",
    name: "Bond Asset — Banking Book (Amortised Cost)",
    category: "asset-investment",
    currency: "ZAR",
    side: "debit",
    hqlaLevel: "level-1",
    hqlaSubCategory: "level-1.government-securities",
  },
  {
    id: "ACC-3100-002",
    name: "Bond Asset — Trading Book (FVTPL)",
    category: "asset-trading",
    currency: "ZAR",
    side: "debit",
    hqlaLevel: "level-1",
    hqlaSubCategory: "level-1.government-securities",
  },
  {
    id: "ACC-3100-003",
    name: "Accrued Interest Receivable — Bonds",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-3100-004",
    name: "Bond Discount/Premium Unamortised",
    category: "asset-other",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-3100-005",
    name: "Unrealised P&L — Bonds (FVTPL)",
    category: "income-trading",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-3100-006",
    name: "Realised P&L — Bonds",
    category: "income-trading",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-4101-001",
    name: "Interest Income (EIR) — Bonds",
    category: "income-interest",
    currency: "ZAR",
    side: "credit",
  },

  // 3200 — Equity assets
  {
    id: "ACC-3200-001",
    name: "Equity Asset — FVTPL",
    category: "asset-trading",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-3200-002",
    name: "Equity Asset — FVOCI",
    category: "asset-investment",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-3200-003",
    name: "Unrealised P&L — Equities (FVTPL)",
    category: "income-trading",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-3200-004",
    name: "OCI Reserve — Equities (FVOCI)",
    category: "equity",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-3200-005",
    name: "Dividend Receivable",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-3200-006",
    name: "Dividend Income",
    category: "income-other",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-3200-007",
    name: "Withholding Tax Payable — Dividends",
    category: "liability-other",
    currency: "ZAR",
    side: "credit",
  },
  // ACC-3200-008 — Equity Trade Settlement Suspense. RECONCILED into the
  // canonical registry (Slice 1): previously JSON-only.
  {
    id: "ACC-3200-008",
    name: "Equity Trade Settlement Suspense (Pending Settlement)",
    category: "liability-payable",
    currency: "ZAR",
    side: "credit",
  },

  // 3300 — IRD swap assets / liabilities
  {
    id: "ACC-3300-001",
    name: "Swap Asset — FVTPL (Positive NPV)",
    category: "asset-derivative",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-3300-002",
    name: "Swap Liability — FVTPL (Negative NPV)",
    category: "liability-derivative",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-3300-003",
    name: "Unrealised P&L — IRD (FVTPL)",
    category: "income-trading",
    currency: "ZAR",
    side: "credit",
  },

  // 4100 — Settlement receivables
  {
    id: "ACC-4100-001",
    name: "Settlement Receivable",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-4100-002",
    name: "Settlement Receivable",
    category: "asset-receivable",
    currency: "USD",
    side: "debit",
  },

  // 5000 — Equity / CET1 accounts
  {
    id: "ACC-5000-001",
    name: "Share Capital",
    category: "equity",
    currency: "ZAR",
    side: "credit",
    capitalTier: "cet1",
    capitalSubCategory: "cet1.paid-up-ordinary-shares",
  },
  {
    id: "ACC-5000-002",
    name: "Retained Earnings",
    category: "equity",
    currency: "ZAR",
    side: "credit",
    capitalTier: "cet1",
    capitalSubCategory: "cet1.retained-earnings",
  },

  // 5100 — Repo (secured borrowing) sub-ledger
  {
    id: "ACC-5100-001",
    name: "Repo Asset (Secured Lending Receivable)",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-5100-002",
    name: "Repo Liability (Secured Borrowing Payable)",
    category: "liability-payable",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-5100-003",
    name: "Repo Collateral Memo (Off-Balance-Sheet)",
    category: "asset-other",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-5100-004",
    name: "Repo Accrued Interest",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-5100-005",
    name: "Repo Interest Income / Expense",
    category: "income-interest",
    currency: "ZAR",
    side: "credit",
  },

  // 5200 — Tier 2 capital accounts (placeholder per D-DATA-QUALITY-CROSS-DOMAIN-V1)
  {
    id: "ACC-5200-001",
    name: "Subordinated Debt — Tier 2 (≥5yr remaining maturity)",
    category: "liability-t2-capital",
    currency: "ZAR",
    side: "credit",
    capitalTier: "t2",
    capitalSubCategory: "t2.subordinated-debt",
  },
  {
    id: "ACC-5200-002",
    name: "General Provisions — Qualifying Tier 2 (IFRS 9 Stage-1/2)",
    category: "liability-t2-capital",
    currency: "ZAR",
    side: "credit",
    capitalTier: "t2",
    capitalSubCategory: "t2.qualifying-general-provisions",
  },

  // 6100 — Money-Market-Deposit (MMD) liabilities + interest
  {
    id: "ACC-6100-001",
    name: "Deposit Liability — Retail Stable",
    category: "liability-other",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-6100-002",
    name: "Deposit Liability — Retail Less-Stable",
    category: "liability-other",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-6100-003",
    name: "Deposit Liability — Wholesale Operational",
    category: "liability-other",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-6100-004",
    name: "Deposit Liability — Wholesale Non-Operational",
    category: "liability-other",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-6100-005",
    name: "Deposit Accrued Interest Payable",
    category: "liability-other",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-6100-006",
    name: "Deposit Interest Expense",
    category: "expense-interest",
    currency: "ZAR",
    side: "debit",
  },

  // 7100 — Interbank-Loan (IBL, bank as lender) assets + interest
  {
    id: "ACC-7100-001",
    name: "Due from Banks — Call Placements",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-7100-002",
    name: "Due from Banks — Fixed-Term Placements",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-7100-003",
    name: "IBL Accrued Interest Receivable",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
  },
  {
    id: "ACC-7100-004",
    name: "IBL Interest Income",
    category: "income-interest",
    currency: "ZAR",
    side: "credit",
  },

  // 9000 — SARB FX Net-Open-Position (NOP) memorandum accounts (regulatory only)
  {
    id: "ACC-9000-001",
    name: "Net Open Position Memorandum — Long",
    category: "memorandum-regulatory-nop",
    side: "debit",
  },
  {
    id: "ACC-9000-002",
    name: "Net Open Position Memorandum — Short",
    category: "memorandum-regulatory-nop",
    side: "credit",
  },
];

// ---------------------------------------------------------------------------
// Id index — O(1) lookup.
// ---------------------------------------------------------------------------

export const COA_BY_ID: ReadonlyMap<string, CoaAccountEntry> = new Map(
  COA_ACCOUNTS.map((a) => [a.id, a]),
);
