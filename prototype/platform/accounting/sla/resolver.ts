// platform/accounting/sla/resolver.ts
//
// Account resolver — the localisation layer (Phase-0 spec §5, Principle 5).
//
// Maps a LOGICAL account reference to a PHYSICAL chart-of-accounts leaf:
//
//   key   = (entity, product, currency, jurisdiction, representation, logical)
//   value = ACC-NNNN-NNN  (typed as the generated `AccountId` union)
//
// Resolver rows are data, validated against `coa-registry.ts` at module load
// (every physical target MUST be a real COA leaf — `isAccountId`).
//
// Lookup precedence (spec §5.2, as corrected by
// D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE, CEO-approved 2026-06-05):
//   1. PER-CURRENCY exact match on
//      (entity, product, currency, jurisdiction, representation, logical).
//      Each currency resolves to its OWN account. There is NO currency-wildcard
//      "pool" precedence — the FCY-pool framing was rejected: the USD account
//      (ACC-2100-002 / ACC-2100-004) is USD-ONLY, not a multi-currency pool.
//   2. On an account-resolution MISS — the (entity, product, jurisdiction,
//      representation, logical) axes are valid but no row covers the leg's
//      currency — the resolver returns a typed `unresolved-currency` outcome.
//      The interpreter turns this into a BALANCING posting to the FX
//      unresolved-currency suspense account (ACC-2100-007) PLUS a high-severity
//      urgent-correction SubstrateAlert. It is NEVER a silent USD fallback and
//      NEVER a dropped posting.
//   3. When there is no candidate row AT ALL for the logical/product/entity
//      axes (an unknown logical account, product, or entity — a genuine rule /
//      config bug), the resolver returns `no-matching-row`, which the
//      interpreter surfaces as the loud `SubLedgerPostingRejected` reject. This
//      is distinct from the currency miss in (2): a rule-shape bug must be
//      fixed by the rule author, not parked in suspense.
//
// Note on per-currency account routing (spec §3.2): the resolver books each
// currency to its OWN dedicated COA account where one exists. ZAR and USD always
// have dedicated FX trading accounts; the per-currency provisioning programme
// (D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING) added GBP/EUR/CHF/AUD/JPY. Any
// currency WITHOUT a dedicated account routes to suspense + a high-severity
// urgent-correction alert — never a silent `default → USD` fallback (the latent
// defect this resolver was designed to prevent).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05);
//            D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05).
// Citations: Principles/5-multi-currency-entity-country.md.

import { type AccountId, isAccountId } from "./generated/sla-types";

// ---------------------------------------------------------------------------
// Row + key types
// ---------------------------------------------------------------------------

/**
 * A single resolver row. Each row is PER-CURRENCY — there is no currency
 * wildcard. (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE removed the `currency: "*"`
 * pool row.)
 */
export interface ResolverRow {
  readonly entity: string;
  readonly product: string;
  /** ISO-4217 code. */
  readonly currency: string;
  readonly jurisdiction: string;
  readonly representation: string;
  readonly logical: string;
  readonly physical: AccountId;
  /** Free-text note. */
  readonly note?: string;
}

export interface ResolverKey {
  readonly entity: string;
  readonly product: string;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly representation: string;
  readonly logical: string;
}

export type ResolveOutcome =
  | { ok: true; physical: AccountId; via: "exact" }
  /**
   * Account-resolution miss: the (entity, product, jurisdiction,
   * representation, logical) axes ARE valid (at least one candidate row), but
   * no row covers `key.currency`. The interpreter routes this leg to the FX
   * unresolved-currency suspense account + raises an urgent-correction alert.
   * NOT a hard reject — the posting must still balance.
   */
  | { ok: false; reason: "unresolved-currency"; key: ResolverKey; candidates: number }
  /**
   * No candidate row at all for the logical/product/entity axes — an unknown
   * logical account / product / entity. A genuine rule/config bug: the
   * interpreter surfaces the loud `SubLedgerPostingRejected`. (NOT suspense.)
   */
  | { ok: false; reason: "no-matching-row"; key: ResolverKey; candidates: 0 };

// ---------------------------------------------------------------------------
// Resolver table (IFRS representation only — Phase 1)
//
// FX-spot IFRS account map, PER-CURRENCY (no pool rows):
//   fx.receivable     ZAR→001 USD→002 GBP→010 EUR→013 CHF→016 AUD→019 JPY→022
//   fx.payable        ZAR→003 USD→004 GBP→011 EUR→014 CHF→017 AUD→020 JPY→023
//   fx.unrealised_pnl ZAR→005 GBP→012 EUR→015 CHF→018 AUD→021 JPY→024
// ACC-2100-002 / -004 are USD-ONLY (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
// GBP/EUR/CHF/AUD/JPY now have DEDICATED per-currency trading accounts
// (ACC-2100-010..024, D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING, CFO-approved
// 2026-06-05) and resolve to their own account. Any OTHER currency (e.g.
// SGD/NOK) still account-resolution-misses → suspense (ACC-2100-007) +
// urgent-correction alert — the permanent last-resort safety net.
// ---------------------------------------------------------------------------

export const IFRS_FX_SPOT_RESOLVER_ROWS: readonly ResolverRow[] = [
  // ── fx.receivable (per currency; USD=USD, no pool) ──
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-001",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "USD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-002",
    note: "USD-only trading receivable (NOT an FCY pool).",
  },
  // ── fx.payable (per currency; USD=USD, no pool) ──
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-003",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "USD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-004",
    note: "USD-only trading payable (NOT an FCY pool).",
  },
  // ── Per-currency FX-spot trading accounts (GBP/EUR/CHF/AUD/JPY) ──
  // Authority: D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING (CFO-approved by
  // Camille (Chief Financial Officer, finance), 2026-06-05). These five
  // currencies now resolve to their OWN dedicated trading accounts
  // (ACC-2100-010..024), no longer account-resolution-missing to suspense.
  // ACC-2100-007 suspense remains the last-resort for any FURTHER unprovisioned
  // currency. ID note: the memo enumerated ACC-2100-008..022; the block was
  // provisioned at 010..024 to clear the live, occupied ACC-2100-009 (FX
  // remediation suspense) — see coa-registry.ts header for the full rationale.
  // fx.receivable
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "GBP",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-010",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "EUR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-013",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "CHF",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-016",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "AUD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-019",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "JPY",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-022",
    note: "JPY is a zero-minor-unit currency (ISO-4217 minor unit 0); amounts are minor-unit per minorFactor (1).",
  },
  // fx.payable
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "GBP",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-011",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "EUR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-014",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "CHF",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-017",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "AUD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-020",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "JPY",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-023",
  },
  // fx.unrealised_pnl (per-currency FVTPL trading P&L; IFRS 9 §5.7.1)
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "GBP",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.unrealised_pnl",
    physical: "ACC-2100-012",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "EUR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.unrealised_pnl",
    physical: "ACC-2100-015",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "CHF",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.unrealised_pnl",
    physical: "ACC-2100-018",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "AUD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.unrealised_pnl",
    physical: "ACC-2100-021",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "JPY",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.unrealised_pnl",
    physical: "ACC-2100-024",
  },
  // ── ZAR functional-currency P&L + correspondent-nostro accounts ──
  // Revaluation (PR-FX-002), realised-P&L residual (PR-FX-LIFECYCLE-CLOSE),
  // and cancellation P&L-reversal (PR-FX-CANCEL) all post in ZAR (functional
  // currency) only — these logicals have a single ZAR row each.
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.unrealised_pnl",
    physical: "ACC-2100-005",
    note: "Unrealised FX P&L — FVTPL (ZAR functional currency, IFRS 9 §5.7.1).",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.realised_pnl",
    physical: "ACC-2100-006",
    note: "Realised FX P&L (ZAR functional currency, IAS 21 §28).",
  },
  // fx.nostro — correspondent settlement accounts (D-COA-CURRENCY-DECOUPLING:
  // the 1200 range). Per-currency; the full supported FX set
  // (ZAR/USD/EUR/GBP/JPY/CHF/AUD) now has a dedicated nostro
  // (D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS, CEO build-phase 2026-06-08). Any
  // OTHER currency account-resolution-misses → suspense + urgent-correction
  // alert.
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.nostro",
    physical: "ACC-1200-001",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "USD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.nostro",
    physical: "ACC-1200-002",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "EUR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.nostro",
    physical: "ACC-1200-003",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "GBP",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.nostro",
    physical: "ACC-1200-004",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "JPY",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.nostro",
    physical: "ACC-1200-005",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "CHF",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.nostro",
    physical: "ACC-1200-006",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "AUD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.nostro",
    physical: "ACC-1200-007",
  },
  // ── Settlement-failed receivable sub-ledger + Stage-3 ECL (PR-FX-005) ──
  // The defaulted receivable is reclassified per-currency (FVTPL trading →
  // amortised-cost defaulted claim). The full supported FX set
  // (ZAR/USD/EUR/GBP/JPY/CHF/AUD) now has a dedicated account
  // (D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS); any OTHER currency
  // account-resolution-misses → suspense + urgent-correction alert. The ECL
  // allowance + credit-loss expense remain ZAR functional-currency only.
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.settlement_failed_receivable",
    physical: "ACC-2300-001",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "USD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.settlement_failed_receivable",
    physical: "ACC-2300-002",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "EUR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.settlement_failed_receivable",
    physical: "ACC-2300-005",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "GBP",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.settlement_failed_receivable",
    physical: "ACC-2300-006",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "JPY",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.settlement_failed_receivable",
    physical: "ACC-2300-007",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "CHF",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.settlement_failed_receivable",
    physical: "ACC-2300-008",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "AUD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.settlement_failed_receivable",
    physical: "ACC-2300-009",
  },
  // ECL allowance + credit-loss expense — ZAR functional currency only.
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.ecl_allowance_settlement_failed",
    physical: "ACC-2300-003",
    note: "Contra-asset; lifetime Stage-3 ECL allowance (ZAR, IAS 21 §23).",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.credit_loss_expense",
    physical: "ACC-2300-004",
    note: "P&L credit-loss expense — FX settlement failures (ZAR, IAS 1 §82(ba)).",
  },
];

// ---------------------------------------------------------------------------
// Treasury money-market resolver rows (IFRS, full-retirement Batch 1)
//
// The deposit (MMD), funding-line, interbank-loan (IBL) and repo families. All
// ZAR (predominantly ZAR per the brief; any non-ZAR leg follows the FX suspense
// discipline via the shared no-silent-fallback resolver). These rows are the
// canonical COA mapping for the treasury money-market families.
//
//   MMD / FUNDING — Nostro ACC-1200-001; liability ACC-6100-001..004 (by LCR
//     category); accrued interest ACC-6100-005; interest expense ACC-6100-006.
//     (Funding reuses the wholesale-non-operational liability ACC-6100-004 and
//      the same Nostro.)
//   IBL — Nostro ACC-1200-001; due-from-banks call ACC-7100-001 / fixed
//     ACC-7100-002; accrued interest ACC-7100-003; interest income ACC-7100-004.
//   REPO — Nostro ACC-1200-001; repo asset ACC-5100-001; accrued interest
//     ACC-5100-004; interest P&L ACC-5100-005.
//
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 1, CEO-approved
// 2026-06-05). Cites: IAS 39 §27; IFRS 9 §3.1.1/§3.2.3/§4.1.2/§4.2.1/B5.4.1;
// BA 110 Table 1/2 (LCR categories).
// ---------------------------------------------------------------------------

function zarRow(product: string, logical: string, physical: AccountId, note?: string): ResolverRow {
  return {
    entity: "LE-ZA-HOZ-BANK",
    product,
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical,
    physical,
    ...(note ? { note } : {}),
  };
}

export const IFRS_TREASURY_RESOLVER_ROWS: readonly ResolverRow[] = [
  // ── MMD / deposit ──
  zarRow("MMD", "deposit.nostro", "ACC-1200-001"),
  zarRow("MMD", "deposit.liability_retail_stable", "ACC-6100-001"),
  zarRow("MMD", "deposit.liability_retail_less_stable", "ACC-6100-002"),
  zarRow("MMD", "deposit.liability_wholesale_operational", "ACC-6100-003"),
  zarRow("MMD", "deposit.liability_wholesale_non_operational", "ACC-6100-004"),
  zarRow("MMD", "deposit.accrued_interest", "ACC-6100-005"),
  zarRow("MMD", "deposit.interest_expense", "ACC-6100-006"),
  // ── Funding line (reuses the wholesale-non-op deposit liability + Nostro) ──
  zarRow("FUNDING", "funding.nostro", "ACC-1200-001"),
  zarRow(
    "FUNDING",
    "funding.liability_wholesale_non_operational",
    "ACC-6100-004",
    "Wholesale non-operational funding liability (BA 110 Table 2, 100% outflow) — shared with the deposit family.",
  ),
  // ── Interbank loan (bank as lender) ──
  zarRow("IBL", "ibl.nostro", "ACC-1200-001"),
  zarRow("IBL", "ibl.due_from_banks_call", "ACC-7100-001"),
  zarRow("IBL", "ibl.due_from_banks_fixed", "ACC-7100-002"),
  zarRow("IBL", "ibl.accrued_interest", "ACC-7100-003"),
  zarRow("IBL", "ibl.interest_income", "ACC-7100-004"),
  // ── Repo (bank as cash borrower / secured borrowing) ──
  zarRow("REPO", "repo.nostro", "ACC-1200-001"),
  zarRow("REPO", "repo.asset", "ACC-5100-001"),
  zarRow("REPO", "repo.accrued_interest", "ACC-5100-004"),
  zarRow("REPO", "repo.interest_pnl", "ACC-5100-005"),
];

// ---------------------------------------------------------------------------
// Securities resolver rows (IFRS, full-retirement Batch 2)
//
// The bond and equity families. These rows are the canonical COA mapping for
// the securities families. JSE bonds + equities are ZAR; any non-ZAR leg
// follows the shared no-silent-fallback suspense discipline.
//
//   BOND — Nostro ACC-1200-001; asset banking ACC-3100-001 / trading
//     ACC-3100-002; accrued-interest receivable ACC-3100-003; unrealised P&L
//     ACC-3100-005; realised P&L ACC-3100-006; interest income (EIR)
//     ACC-4101-001. (Discount/premium ACC-3100-004 is not touched by any of the
//     ported posting rules — the legacy functions never emit a leg to it.)
//   EQUITY — Nostro ACC-1200-001; asset FVTPL ACC-3200-001 / FVOCI ACC-3200-002;
//     unrealised P&L FVTPL ACC-3200-003; OCI reserve FVOCI ACC-3200-004;
//     dividend receivable ACC-3200-005; dividend income ACC-3200-006;
//     withholding-tax payable ACC-3200-007; retained earnings ACC-5000-002.
//
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 2, CEO-approved
// 2026-06-05). Cites: IFRS 9 §3.1.1/§3.2.3/§5.1.1/§5.4.1/§5.7.1/§5.7.1A/§5.7.5;
// IAS 32 §35.
// ---------------------------------------------------------------------------

export const IFRS_SECURITIES_RESOLVER_ROWS: readonly ResolverRow[] = [
  // ── Bond ──
  zarRow("BOND", "bond.nostro", "ACC-1200-001"),
  zarRow(
    "BOND",
    "bond.asset_banking",
    "ACC-3100-001",
    "Bond asset — banking book (amortised cost).",
  ),
  zarRow("BOND", "bond.asset_trading", "ACC-3100-002", "Bond asset — trading book (FVTPL)."),
  zarRow("BOND", "bond.accrued_interest_receivable", "ACC-3100-003"),
  zarRow("BOND", "bond.unrealised_pnl", "ACC-3100-005", "Unrealised P&L — bonds (FVTPL)."),
  zarRow("BOND", "bond.realised_pnl", "ACC-3100-006"),
  zarRow("BOND", "bond.interest_income_eir", "ACC-4101-001", "Interest income (EIR)."),
  // ── Equity ──
  zarRow("EQUITY", "equity.nostro", "ACC-1200-001"),
  zarRow("EQUITY", "equity.asset_fvtpl", "ACC-3200-001"),
  zarRow("EQUITY", "equity.asset_fvoci", "ACC-3200-002"),
  zarRow("EQUITY", "equity.unrealised_pnl_fvtpl", "ACC-3200-003"),
  zarRow("EQUITY", "equity.oci_reserve_fvoci", "ACC-3200-004", "OCI reserve — equities (FVOCI)."),
  zarRow("EQUITY", "equity.dividend_receivable", "ACC-3200-005"),
  zarRow("EQUITY", "equity.dividend_income", "ACC-3200-006"),
  zarRow("EQUITY", "equity.withholding_tax_payable", "ACC-3200-007"),
  zarRow("EQUITY", "equity.retained_earnings", "ACC-5000-002"),
];

// ---------------------------------------------------------------------------
// IRD-swap resolver rows (IFRS, full-retirement Batch 3)
//
// The OTC interest-rate / IRD swap family. These rows are the canonical COA
// mapping for the IRD-swap family. Domestic OTC swaps are ZAR; any non-ZAR leg
// follows the shared no-silent-fallback suspense discipline via the resolver's
// per-currency miss → ACC-2100-007 + alert.
//
//   IRD — Nostro ACC-1200-001 (ZAR correspondent settlement cash); swap asset
//     FVTPL (positive NPV) ACC-3300-001; swap liability FVTPL (negative NPV)
//     ACC-3300-002; unrealised P&L — IRD (FVTPL) ACC-3300-003.
//
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 3, CEO-approved
// 2026-06-05). Cites: IFRS 9 §3.2.3/§4.1.4/§5.7.1.
// ---------------------------------------------------------------------------

export const IFRS_IRD_RESOLVER_ROWS: readonly ResolverRow[] = [
  zarRow("IRD", "ird.nostro", "ACC-1200-001", "ZAR correspondent settlement cash (IRD swaps)."),
  zarRow(
    "IRD",
    "ird.swap_asset_fvtpl",
    "ACC-3300-001",
    "Swap Asset — FVTPL (positive NPV; IFRS 9 §4.1.4).",
  ),
  zarRow(
    "IRD",
    "ird.swap_liability_fvtpl",
    "ACC-3300-002",
    "Swap Liability — FVTPL (negative NPV; IFRS 9 §4.1.4).",
  ),
  zarRow(
    "IRD",
    "ird.unrealised_pnl",
    "ACC-3300-003",
    "Unrealised P&L — IRD (FVTPL; IFRS 9 §5.7.1).",
  ),
];

// ---------------------------------------------------------------------------
// Payment / settlement resolver rows (IFRS, full-retirement Batch 4 — LAST)
//
// The payment-in-flight / settlement family. These rows (PAYMENT_ACCOUNTS) are
// the canonical per-currency COA mapping for the payment family.
//
// Per-currency support:
//   payment.nostro                ZAR→ACC-1200-001 USD→ACC-1200-002 EUR→ACC-1200-003
//   payment.suspense              ZAR→ACC-2400-001 USD→ACC-2400-002
//   payment.customer_payable      ZAR→ACC-2200-001 USD→ACC-2200-002
//   payment.settlement_receivable ZAR→ACC-4100-001 USD→ACC-4100-002
//
// Any other currency routes an unmapped-currency leg to the FX
// unresolved-currency suspense (ACC-2100-007) + urgent-correction alert — the
// no-silent-fallback discipline shared with the FX / treasury / securities / IRD
// families (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
//
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 4, CEO-approved
// 2026-06-05). Cites: IFRS 9 §3.1.1; IAS 32 §11; PROC-PAY-RBH-01.
// ---------------------------------------------------------------------------

function payRow(
  currency: string,
  logical: string,
  physical: AccountId,
  note?: string,
): ResolverRow {
  return {
    entity: "LE-ZA-HOZ-BANK",
    product: "PAY",
    currency,
    jurisdiction: "ZA",
    representation: "IFRS",
    logical,
    physical,
    ...(note ? { note } : {}),
  };
}

export const IFRS_PAYMENTS_RESOLVER_ROWS: readonly ResolverRow[] = [
  // ── payment.nostro (correspondent settlement cash; ZAR/USD/EUR) ──
  payRow("ZAR", "payment.nostro", "ACC-1200-001"),
  payRow("USD", "payment.nostro", "ACC-1200-002"),
  payRow("EUR", "payment.nostro", "ACC-1200-003"),
  // ── payment.suspense (payment-in-flight; ZAR/USD) ──
  payRow("ZAR", "payment.suspense", "ACC-2400-001"),
  payRow("USD", "payment.suspense", "ACC-2400-002"),
  // ── payment.customer_payable (obligation to customer; ZAR/USD) ──
  payRow("ZAR", "payment.customer_payable", "ACC-2200-001"),
  payRow("USD", "payment.customer_payable", "ACC-2200-002"),
  // ── payment.settlement_receivable (right to receive funds; ZAR/USD) ──
  payRow("ZAR", "payment.settlement_receivable", "ACC-4100-001"),
  payRow("USD", "payment.settlement_receivable", "ACC-4100-002"),
];

// ---------------------------------------------------------------------------
// SARB-BA-RETURN resolver rows (the FIRST SECONDARY representation)
//
// The SARB BA 325 (reg 29(3)) net-open-position (NOP) memorandum (form re-labelled
// from "BA 350" per D-FX-NOP-SLA-CITATION-D5-MIGRATION). Distinct from every IFRS
// row by the `representation: "SARB-BA-RETURN"` axis, so the resolver partitions the
// two representations cleanly — an IFRS lookup can never reach a NOP memo account
// and vice-versa (spec §5.3 per-representation physical mapping).
//
//   reg.nop_long  → ACC-9000-001 (NOP Memorandum — Long, debit)
//   reg.nop_short → ACC-9000-002 (NOP Memorandum — Short, credit)
//
// Both NOP memo accounts are MULTI-CURRENCY (the memo balances per currency:
// long == short within a traded currency). A row is authored per traded currency
// so each resolves to its own NOP memo account; any UNprovisioned currency
// follows the SAME no-silent-fallback discipline as IFRS — it
// account-resolution-misses to the FX unresolved-currency suspense
// (ACC-2100-007) + a high-severity urgent-correction alert
// (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE). The provisioned set mirrors the IFRS
// FX-spot currencies (ZAR/USD/GBP/EUR/CHF/AUD/JPY).
//
// NOT ACTIVATED IN PRODUCTION: these rows are reachable only when the SLA
// interpreter is run with `["IFRS", "SARB-BA-RETURN"]` (the dry-run preview +
// tests). The production resolver (`defaultResolver`) below DOES include them —
// inertly — because a resolver row carries no behaviour on its own: a SARB row
// is only ever consulted when a SARB rule fires, and no SARB rule fires in the
// production path (the engine calls `interpret(..., ["IFRS"], ...)`). Including
// the rows in the single resolver keeps the preview and any future activation
// using the exact same resolver state — no second resolver to drift.
//
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4, CEO-approved 2026-06-06);
//            D-SLA-FIRST-REPRESENTATION-SARB-BA (CFO Camille).
// Cites: SARB BA 325 (reg 29(3) — daily NOP attestation); Banks Act 94 of 1990.
// ---------------------------------------------------------------------------

const SARB_BA_NOP_CURRENCIES: readonly string[] = ["ZAR", "USD", "GBP", "EUR", "CHF", "AUD", "JPY"];

function sarbNopRows(logical: string, physical: AccountId): ResolverRow[] {
  return SARB_BA_NOP_CURRENCIES.map((currency) => ({
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency,
    jurisdiction: "ZA",
    representation: "SARB-BA-RETURN",
    logical,
    physical,
    note: "SARB BA 325 (reg 29(3)) NOP memorandum (multi-currency; balances per currency).",
  }));
}

export const SARB_BA_FX_RESOLVER_ROWS: readonly ResolverRow[] = [
  ...sarbNopRows("reg.nop_long", "ACC-9000-001"),
  ...sarbNopRows("reg.nop_short", "ACC-9000-002"),
];

/**
 * The dedicated FX unresolved-currency suspense account
 * (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE). The interpreter posts an
 * account-resolution-miss leg here so the entry still balances, then raises a
 * high-severity urgent-correction alert. NOT a silent fallback: every posting
 * to this account is accompanied by a loud alert + recon finding.
 *
 * The treasury family is predominantly ZAR; a (rare) non-ZAR treasury leg with
 * no per-currency row account-resolution-misses here exactly as an FX leg does.
 */
export const FX_UNRESOLVED_CURRENCY_SUSPENSE: AccountId = "ACC-2100-007";

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export class AccountResolver {
  private readonly rows: readonly ResolverRow[];

  constructor(rows: readonly ResolverRow[]) {
    // Validate every physical target is a real COA leaf at construction —
    // a typo or a retired account ID fails loudly here (and `physical` is
    // already typed `AccountId`, so the literal is also tsc-checked).
    for (const row of rows) {
      if (!isAccountId(row.physical)) {
        throw new Error(
          `AccountResolver: row (${row.logical}, ${row.currency}, ${row.representation}) ` +
            `targets unknown COA account '${row.physical}'`,
        );
      }
    }
    this.rows = rows;
  }

  /**
   * Resolve a logical account ref to a physical COA leaf. PER-CURRENCY only:
   *   - exact (entity, product, currency, jurisdiction, representation, logical)
   *     → ok.
   *   - valid axes but unmapped currency → `unresolved-currency` (interpreter
   *     routes to suspense + urgent-correction alert).
   *   - no candidate row for the axes at all → `no-matching-row` (loud reject).
   * NEVER returns a silent default; the USD account is reachable for USD only.
   */
  resolve(key: ResolverKey): ResolveOutcome {
    const sameAxes = (r: ResolverRow): boolean =>
      r.entity === key.entity &&
      r.product === key.product &&
      r.jurisdiction === key.jurisdiction &&
      r.representation === key.representation &&
      r.logical === key.logical;

    // 1. per-currency exact match
    const exact = this.rows.find((r) => sameAxes(r) && r.currency === key.currency);
    if (exact) return { ok: true, physical: exact.physical, via: "exact" };

    // 2./3. miss — classify by whether the logical/product/entity axes are valid
    const candidates = this.rows.filter(sameAxes).length;
    if (candidates > 0) {
      // valid axes, unmapped currency → account-resolution miss → suspense
      return { ok: false, reason: "unresolved-currency", key, candidates };
    }
    // unknown logical / product / entity → genuine rule/config bug → reject
    return { ok: false, reason: "no-matching-row", key, candidates: 0 };
  }
}

/**
 * The default resolver. IFRS FX-spot rows (Phase 1) PLUS the treasury
 * money-market rows (full-retirement Batch 1 — deposit / funding / IBL / repo).
 * Both families key per-currency on distinct product axes, so there is no
 * collision; the combined table is the single production resolver.
 */
export const defaultResolver = new AccountResolver([
  ...IFRS_FX_SPOT_RESOLVER_ROWS,
  ...IFRS_TREASURY_RESOLVER_ROWS,
  ...IFRS_SECURITIES_RESOLVER_ROWS,
  ...IFRS_IRD_RESOLVER_ROWS,
  ...IFRS_PAYMENTS_RESOLVER_ROWS,
  // SARB-BA-RETURN NOP memo rows (the first secondary representation). Inert in
  // the production path — only consulted when a SARB rule fires, and no SARB
  // rule fires in production (engine evaluates ["IFRS"] only). Keeps the preview
  // + any future activation on the exact same resolver state.
  ...SARB_BA_FX_RESOLVER_ROWS,
]);
