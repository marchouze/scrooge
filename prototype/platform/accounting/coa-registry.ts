// platform/accounting/coa-registry.ts
//
// G-4 — HQLA COA classification field + typed COA registry.
//
// Authority: D-HQLA-COA-CLASSIFICATION (CEO-approved 2026-05-22)
// Citations:
//   BCBS D295 (Basel III LCR standard, Jan 2013) §II.A — HQLA tiers
//   SARB BA 325 — Liquidity Coverage Ratio return
//   Regulations Relating to Banks Reg 26 — LCR
//   Principle 2 — single-graph discipline (policy → procedure → system capability)
//
// ## Purpose
//
// Moves the HQLA account classification from the BA 325 generator's hard-coded
// lookup into a first-class COA attribute. Each account entry carries an optional
// `hqlaLevel` field ("level-1" | "level-2a" | "level-2b") that the BA 325
// generator reads dynamically, applying Basel III haircuts by level:
//   - level-1:  0% haircut  (100% contribution)
//   - level-2a: 15% haircut (85% contribution)  per BCBS D295 §52 / Reg 26(7)(b)
//   - level-2b: 25–50% haircut (75–50% contribution) per BCBS D295 §54 / Reg 26(7)(c)
//
// ## Design
//
// This file is the SINGLE CANONICAL SOURCE for:
//   (a) the TypeScript type for a COA account entry (`CoaAccountEntry`),
//   (b) the Zod schema for runtime validation (`CoaAccountEntrySchema`),
//   (c) the typed account registry (`COA_ACCOUNTS`).
//
// Downstream consumers (BA 325 generator, BA 100, reporting) import from here.
// The `chart-of-accounts.json` flat file is the simplified seed used by some
// GL modules; the typed registry here is the authoritative form.
//
// ## HQLA account tagging rationale
//
// Per BCBS D295 §49–§54 and Reg 26(7):
//
//   Level 1 (0% haircut, no cap):
//     - Coins and banknotes (cash)
//     - SARB reserves / central-bank deposits (Reg 26(7)(a)(i))
//     - SA government and SARB securities with 0% RW (Reg 26(7)(a)(ii))
//     → ACC-1100-001: Nostro — ZAR (SARB operational) — central-bank reserves
//     → ACC-3100-001: Bond Asset — Banking Book (Amortised Cost) — qualifies as
//       Level 1 where the bonds are SA government (0% RW); tagged level-1.
//       NOTE: if the bond portfolio holds non-0%-RW bonds this should be level-2a.
//       Build-phase assumption: banking-book bonds are SA government bonds (R186/R2030).
//     → ACC-3100-002: Bond Asset — Trading Book (FVTPL) — same assumption as banking book.
//
//   Level 2A (15% haircut, ≤ 40% of HQLA stock):
//     - Non-0%-RW sovereign / central-bank securities, covered bonds (20% RW), qualifying
//       corporate bonds rated AA- or above, qualifying equity per Reg 26(7)(b).
//     → No accounts tagged level-2a at build phase (all bond holdings assumed SA gov 0% RW).
//       This annotation point is preserved for licence-day parameterisation.
//
//   Level 2B (25–50% haircut, ≤ 15% of HQLA stock):
//     - Qualifying RMBS, equities, corporate bonds rated A+/A per BCBS D295 §54.
//     → No accounts tagged level-2b at build phase.
//
//   NOT HQLA (no tag):
//     - FX settlement suspense, trading receivables/payables, settlement-failed
//       receivables, payment suspense, IRD derivatives, P&L accounts — none qualify.
//
// Authors: Bea (General Ledger Engineer, engineering)
//   + Anya (Data / analytics engineer, engineering) — `isin` field added for
//     D-FINANCIAL-INSTRUMENT-ENTITY Slice 9 SecurityMaster HQLA override bridge.

import { z } from "zod";

import type { AccountLiquidityClassification, HqlaLevel } from "../reporting/ba-325-lcr";

// ---------------------------------------------------------------------------
// TypeScript type
// ---------------------------------------------------------------------------

/**
 * A single account entry in the chart of accounts.
 *
 * The `hqlaLevel` field is the key addition in G-4. It marks which Basel III
 * HQLA tier an account contributes to, enabling the BA 325 generator to derive
 * its classification map directly from the COA rather than a separate lookup.
 *
 * Citations:
 *   D-HQLA-COA-CLASSIFICATION; BCBS D295 §II.A; SARB BA 325; Reg 26(7).
 */
export interface CoaAccountEntry {
  /** Stable GL account identifier. Convention: ACC-<TYPE><CATEGORY>-<NNN>. */
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly side: "debit" | "credit";
  /**
   * HQLA tier per BCBS D295 §49–§54 / Reg 26(7).
   * Absent = not HQLA-eligible; excluded from BA 325 HQLA stock scan.
   *
   * - "level-1"  → 0% haircut (central-bank reserves, 0%-RW sovereign)
   * - "level-2a" → 15% haircut (qualifying sovereign/covered bonds/corporates)
   * - "level-2b" → 25–50% haircut (qualifying equities / RMBS / corporates)
   *
   * Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §II.A (Jan 2013);
   *            SARB BA 325; Regulations Relating to Banks Reg 26(7).
   */
  readonly hqlaLevel?: HqlaLevel;
  /**
   * Sub-category label for BA 325 line rendering.
   * Only meaningful when `hqlaLevel` is set.
   * Example: "level-1.central-bank-reserves".
   * Authority: D-HQLA-COA-CLASSIFICATION; SARB BA 325.
   */
  readonly hqlaSubCategory?: string;
  /**
   * Per-asset haircut factor for level-2b accounts per BCBS D295 §54.
   * Minimum 0.50 for equities/non-RMBS; 0.25 for RMBS.
   * Unset defaults to 0.50 in the BA 325 generator.
   * Only meaningful when `hqlaLevel === "level-2b"`.
   * Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §54.
   */
  readonly hqlaAssetSpecificFactor?: number;
  /**
   * ISIN of the security held in this GL account.
   *
   * When present, the BA 325 generator will look up this ISIN in the
   * SecurityMaster override map (`opts.hqlaOverrides`) and use the
   * instrument-level HQLA classification in preference to the COA `hqlaLevel`
   * tag. This enables per-instrument HQLA tier accuracy for bond / equity
   * accounts that hold a single identifiable security.
   *
   * For accounts that aggregate multiple securities (e.g. a general bond
   * portfolio account) do NOT set this field — the COA `hqlaLevel` tag
   * applies uniformly and the override cannot disambiguate individual ISINs.
   *
   * Bridge note (D-FINANCIAL-INSTRUMENT-ENTITY Slice 9):
   * No accounts currently carry an ISIN — the COA models GL positions, not
   * individual securities. This field will be populated when bond seeds land
   * (Slice 10) and bond-booking events pair instrumentId ↔ leafAccountId.
   * Until then the override map is empty and the COA fallback drives all
   * BA 325 HQLA stock calculations unchanged.
   *
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
   * Citations: BA-325-LCR; BCBS-LCR-2013.
   */
  readonly isin?: string;
}

// ---------------------------------------------------------------------------
// Zod schema for runtime validation
// ---------------------------------------------------------------------------

export const CoaAccountEntrySchema = z.object({
  id: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/),
  name: z.string().min(1),
  category: z.string().min(1),
  side: z.enum(["debit", "credit"]),
  hqlaLevel: z.enum(["level-1", "level-2a", "level-2b"]).optional(),
  hqlaSubCategory: z.string().optional(),
  hqlaAssetSpecificFactor: z.number().min(0).max(1).optional(),
  // D-FINANCIAL-INSTRUMENT-ENTITY Slice 9: ISIN bridge to SecurityMaster override map.
  isin: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Typed account registry
// ---------------------------------------------------------------------------

/**
 * All general-ledger accounts in the chart of accounts with HQLA tags.
 *
 * This is the single canonical source for COA account definitions.
 * HQLA-eligible accounts carry `hqlaLevel` (and optionally `hqlaSubCategory`).
 * All other accounts are unannotated.
 *
 * HQLA tagging authority: D-HQLA-COA-CLASSIFICATION (CEO-approved 2026-05-22).
 * Citations: BCBS D295 §II.A; SARB BA 325; Reg 26(7).
 */
export const COA_ACCOUNTS: readonly CoaAccountEntry[] = [
  // ------------------------------------------------------------------
  // 1100 — SARB operational & nostro accounts
  // ------------------------------------------------------------------
  {
    id: "ACC-1100-001",
    name: "Nostro — ZAR (SARB operational)",
    category: "asset-cash",
    side: "debit",
    // Level 1 HQLA: central-bank reserves per BCBS D295 §49(b) / Reg 26(7)(a)(i).
    // The SARB operational account represents balances at the central bank.
    // Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §49; Reg 26(7)(a)(i).
    hqlaLevel: "level-1",
    hqlaSubCategory: "level-1.central-bank-reserves",
  },
  {
    id: "ACC-1100-002",
    name: "Nostro — USD (correspondent)",
    category: "asset-cash",
    side: "debit",
    // Correspondent-bank nostro in USD. NOT central-bank reserves; does not
    // qualify as Level-1. May qualify for Level-2A/2B depending on
    // counterparty credit quality, but build-phase scope is ZAR LCR only.
    // Leave untagged until Mira's WS-INSTRUMENT-ANALYSES lands the mapping.
  },
  {
    id: "ACC-1100-003",
    name: "Nostro — EUR (correspondent)",
    category: "asset-cash",
    side: "debit",
    // Same rationale as ACC-1100-002. Untagged.
  },
  {
    id: "ACC-1100-004",
    name: "FX Settlement Suspense — ZAR",
    category: "asset-suspense",
    side: "debit",
    // Settlement suspense: transient; not HQLA-eligible.
  },
  {
    id: "ACC-1100-005",
    name: "FX Settlement Suspense — USD",
    category: "asset-suspense",
    side: "debit",
    // Settlement suspense: transient; not HQLA-eligible.
  },

  // ------------------------------------------------------------------
  // 1200 — Correspondent bank nostros
  // ------------------------------------------------------------------
  {
    id: "ACC-1200-001",
    name: "Nostro — ZAR (correspondent)",
    category: "asset-cash",
    side: "debit",
    // Correspondent-bank nostro in ZAR. NOT central-bank reserves.
    // Not tagged as HQLA at build phase; see ACC-1100-002 rationale.
  },
  {
    id: "ACC-1200-002",
    name: "Nostro — USD (correspondent)",
    category: "asset-cash",
    side: "debit",
  },
  {
    id: "ACC-1200-003",
    name: "Nostro — EUR (correspondent)",
    category: "asset-cash",
    side: "debit",
  },

  // ------------------------------------------------------------------
  // 2100 — FX trading receivables / payables / P&L
  // ------------------------------------------------------------------
  {
    id: "ACC-2100-001",
    name: "FX Trading Receivable — ZAR",
    category: "asset-receivable",
    side: "debit",
    // Trading receivable: not HQLA (not a qualifying liquid asset).
  },
  {
    id: "ACC-2100-002",
    name: "FX Trading Receivable — FCY",
    category: "asset-receivable",
    side: "debit",
  },
  {
    id: "ACC-2100-003",
    name: "FX Trading Payable — ZAR",
    category: "liability-payable",
    side: "credit",
  },
  {
    id: "ACC-2100-004",
    name: "FX Trading Payable — FCY",
    category: "liability-payable",
    side: "credit",
  },
  {
    id: "ACC-2100-005",
    name: "Unrealised FX P&L — FVTPL",
    category: "income-trading",
    side: "credit",
  },
  {
    id: "ACC-2100-006",
    name: "Realised FX P&L",
    category: "income-trading",
    side: "credit",
  },

  // ------------------------------------------------------------------
  // 2200 — Customer payables
  // ------------------------------------------------------------------
  {
    id: "ACC-2200-001",
    name: "Customer Payables — ZAR",
    category: "liability-payable",
    side: "credit",
  },
  {
    id: "ACC-2200-002",
    name: "Customer Payables — USD",
    category: "liability-payable",
    side: "credit",
  },

  // ------------------------------------------------------------------
  // 2300 — Settlement-failed receivables / ECL
  // ------------------------------------------------------------------
  {
    id: "ACC-2300-001",
    name: "Settlement-Failed Receivable — ZAR",
    category: "asset-receivable",
    side: "debit",
  },
  {
    id: "ACC-2300-002",
    name: "Settlement-Failed Receivable — USD",
    category: "asset-receivable",
    side: "debit",
  },
  {
    id: "ACC-2300-003",
    name: "ECL Allowance — Settlement-Failed",
    category: "asset-other",
    side: "credit",
  },
  {
    id: "ACC-2300-004",
    name: "Credit Loss Expense — FX Settlement",
    category: "expense-impairment",
    side: "debit",
  },

  // ------------------------------------------------------------------
  // 2400 — Payment suspense
  // ------------------------------------------------------------------
  {
    id: "ACC-2400-001",
    name: "Payment Suspense — ZAR",
    category: "asset-suspense",
    side: "debit",
  },
  {
    id: "ACC-2400-002",
    name: "Payment Suspense — USD",
    category: "asset-suspense",
    side: "debit",
  },

  // ------------------------------------------------------------------
  // 3100 — Bond assets
  // ------------------------------------------------------------------
  {
    id: "ACC-3100-001",
    name: "Bond Asset — Banking Book (Amortised Cost)",
    category: "asset-investment",
    side: "debit",
    // Level 1 HQLA at build phase: banking-book bonds assumed to be SA government
    // bonds (R186 / R2030) with 0% SARB risk weight per BCBS D295 §49(c) /
    // Reg 26(7)(a)(ii). If non-0%-RW bonds are added at licence-day, reclassify
    // to level-2a. Build-phase assumption documented in coa-registry.ts header.
    // Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §49(c); Reg 26(7)(a)(ii).
    hqlaLevel: "level-1",
    hqlaSubCategory: "level-1.government-securities",
  },
  {
    id: "ACC-3100-002",
    name: "Bond Asset — Trading Book (FVTPL)",
    category: "asset-trading",
    side: "debit",
    // Level 1 HQLA at build phase: same assumption as ACC-3100-001.
    // Trading-book government bonds qualify per BCBS D295 §49(c).
    // Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §49(c); Reg 26(7)(a)(ii).
    hqlaLevel: "level-1",
    hqlaSubCategory: "level-1.government-securities",
  },
  {
    id: "ACC-3100-003",
    name: "Accrued Interest Receivable — Bonds",
    category: "asset-receivable",
    side: "debit",
    // Accrued interest: a receivable, not a liquid asset. Not HQLA.
  },
  {
    id: "ACC-3100-004",
    name: "Bond Discount/Premium Unamortised",
    category: "asset-other",
    side: "debit",
    // Discount/premium adjustment account. Not HQLA.
  },
  {
    id: "ACC-3100-005",
    name: "Unrealised P&L — Bonds (FVTPL)",
    category: "income-trading",
    side: "credit",
  },
  {
    id: "ACC-3100-006",
    name: "Realised P&L — Bonds",
    category: "income-trading",
    side: "credit",
  },
  {
    id: "ACC-4101-001",
    name: "Interest Income (EIR) — Bonds",
    category: "income-interest",
    side: "credit",
  },

  // ------------------------------------------------------------------
  // 3200 — Equity assets
  // ------------------------------------------------------------------
  {
    id: "ACC-3200-001",
    name: "Equity Asset — FVTPL",
    category: "asset-trading",
    side: "debit",
    // Equities: potentially Level-2B if they meet BCBS D295 §54 criteria
    // (included in major stock index, traded on recognised exchange, not issued
    // by the bank itself). Build phase: not tagged — qualification review pending.
    // Mira's WS-INSTRUMENT-ANALYSES will determine per-instrument eligibility.
  },
  {
    id: "ACC-3200-002",
    name: "Equity Asset — FVOCI",
    category: "asset-investment",
    side: "debit",
    // Same as ACC-3200-001. Untagged at build phase.
  },
  {
    id: "ACC-3200-003",
    name: "Unrealised P&L — Equities (FVTPL)",
    category: "income-trading",
    side: "credit",
  },
  {
    id: "ACC-3200-004",
    name: "OCI Reserve — Equities (FVOCI)",
    category: "equity",
    side: "credit",
  },
  {
    id: "ACC-3200-005",
    name: "Dividend Receivable",
    category: "asset-receivable",
    side: "debit",
  },
  {
    id: "ACC-3200-006",
    name: "Dividend Income",
    category: "income-other",
    side: "credit",
  },
  {
    id: "ACC-3200-007",
    name: "Withholding Tax Payable — Dividends",
    category: "liability-other",
    side: "credit",
  },

  // ------------------------------------------------------------------
  // 3300 — IRD swap assets / liabilities
  // ------------------------------------------------------------------
  {
    id: "ACC-3300-001",
    name: "Swap Asset — FVTPL (Positive NPV)",
    category: "asset-derivative",
    side: "debit",
    // Derivative (swap): not a qualifying liquid asset under BCBS D295.
  },
  {
    id: "ACC-3300-002",
    name: "Swap Liability — FVTPL (Negative NPV)",
    category: "liability-derivative",
    side: "credit",
  },
  {
    id: "ACC-3300-003",
    name: "Unrealised P&L — IRD (FVTPL)",
    category: "income-trading",
    side: "credit",
  },

  // ------------------------------------------------------------------
  // 4100 — Settlement receivables
  // ------------------------------------------------------------------
  {
    id: "ACC-4100-001",
    name: "Settlement Receivable — ZAR",
    category: "asset-receivable",
    side: "debit",
    // Settlement receivable: not a liquid asset (contingent on counterparty). Not HQLA.
  },
  {
    id: "ACC-4100-002",
    name: "Settlement Receivable — USD",
    category: "asset-receivable",
    side: "debit",
  },

  // ------------------------------------------------------------------
  // 1000 — Bank/cash accounts
  // ------------------------------------------------------------------
  {
    id: "ACC-1000-001",
    name: "Bank — ZAR",
    category: "asset-cash",
    side: "debit",
    // Internal bank account. Not central-bank reserves — not HQLA.
  },

  // ------------------------------------------------------------------
  // 5000 — Equity accounts
  // ------------------------------------------------------------------
  {
    id: "ACC-5000-001",
    name: "Share Capital",
    category: "equity",
    side: "credit",
  },
  {
    id: "ACC-5000-002",
    name: "Retained Earnings",
    category: "equity",
    side: "credit",
  },
];

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/**
 * Index of all COA accounts by ID for O(1) lookup.
 * Authority: D-HQLA-COA-CLASSIFICATION.
 */
export const COA_BY_ID: ReadonlyMap<string, CoaAccountEntry> = new Map(
  COA_ACCOUNTS.map((a) => [a.id, a]),
);

/**
 * Derive a `AccountLiquidityClassification[]` from the COA registry.
 *
 * Scans all accounts in `COA_ACCOUNTS` for those with an `hqlaLevel` set,
 * and maps them to `AccountLiquidityClassification` entries suitable for
 * passing directly to `generateBa325Lcr` as the `classifications` input.
 *
 * This replaces the hard-coded `BUILD_PHASE_DEFAULT_CLASSIFICATIONS` in the
 * render script and makes the BA 325 generator dynamically driven by COA data.
 *
 * Basel III haircut application is handled inside `generateBa325Lcr`; this
 * function only constructs the typed mapping.
 *
 * Authority: D-HQLA-COA-CLASSIFICATION (CEO-approved 2026-05-22).
 * Citations: BCBS D295 §II.A; SARB BA 325; Reg 26(7).
 */
export function coaToHqlaClassifications(): readonly AccountLiquidityClassification[] {
  return COA_ACCOUNTS.filter(
    (a): a is CoaAccountEntry & { hqlaLevel: HqlaLevel } => a.hqlaLevel !== undefined,
  ).map((a) => ({
    leafAccountId: a.id,
    hqlaLevel: a.hqlaLevel,
    ...(a.hqlaSubCategory ? { subCategory: a.hqlaSubCategory } : {}),
    ...(a.hqlaAssetSpecificFactor !== undefined
      ? { assetSpecificFactor: a.hqlaAssetSpecificFactor }
      : {}),
    // D-FINANCIAL-INSTRUMENT-ENTITY Slice 9: carry ISIN forward so the
    // BA 325 generator can resolve SecurityMaster HQLA overrides per account.
    ...(a.isin ? { isin: a.isin } : {}),
  }));
}
