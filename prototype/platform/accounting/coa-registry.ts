// platform/accounting/coa-registry.ts
//
// G-4 — HQLA COA classification field + typed COA registry.
//
// Authority: D-HQLA-COA-CLASSIFICATION (CEO-approved 2026-05-22)
// Citations:
//   BCBS D295 (Basel III LCR standard, Jan 2013) §II.A — HQLA tiers
//   SARB BA 110 — Liquidity Coverage Ratio return
//   Regulations Relating to Banks Reg 26 — LCR
//   Principle 2 — single-graph discipline (policy → procedure → system capability)
//
// ## Purpose
//
// Moves the HQLA account classification from the BA 110 generator's hard-coded
// lookup into a first-class COA attribute. Each account entry carries an optional
// `hqlaLevel` field ("level-1" | "level-2a" | "level-2b") that the BA 110
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
// Downstream consumers (BA 110 generator, BA 600, reporting) import from here.
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
//     → ACC-1100-001: Central Bank Reserve Account — reserve/settlement
//       balance held AT the SARB; custodian-derived Level-1 (currency and the
//       SARB identity are both separate fields, never in the name).
//       (D-COA-CURRENCY-DECOUPLING, 2026-05-30.)
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
// ## Currency-decoupling (D-COA-CURRENCY-DECOUPLING, CEO-approved 2026-05-30)
//
// Account names are currency-free. Currency is a first-class FIELD (`currency`),
// never embedded in `name`. The authoritative per-balance currency is the
// currency dimension on each ledger entry (`SubLedgerLeg.currency`); the
// account-level `currency` field is the account's *designated* currency
// (omitted only for genuinely multi-currency pool accounts). ZAR is just
// another currency account; its role as the bank's reporting/base currency is
// presentation, not data (Principle 5).
//
// Key consequences of this rework:
//   - ACC-1100-001 repurposed as the Central Bank Reserve Account (held AT the
//     SARB; NOT a nostro). The SARB identity lives in `custodianPartyId`, the
//     currency in `currency` — never in the name. Level-1 cash HQLA is PRESERVED
//     (custodian-derived: central-bank custodian → Level-1).
//   - ACC-1200-001 is the everyday ZAR correspondent nostro and the FX
//     settlement target for ZAR (correspondent custodian → NOT Level-1).
//   - ACC-1100-002 (USD) / ACC-1100-003 (EUR) were duplicate correspondent
//     nostros; merged into ACC-1200-002 / ACC-1200-003. The 1100 ids stay
//     resolvable (clean, currency-free `Nostro` name + `currency` field) so
//     historical ledger entries still render a sensible name; new postings
//     target the 1200 ids. Events are immutable — history is never rewritten.
//
// No code keys account lookups by `name` — everything keys by `id` — so the
// several accounts now sharing the name "Nostro" (differing by id + currency)
// is intended and safe.
//
// Authors: Bea (General Ledger Engineer, engineering)
//   + Anya (Data / analytics engineer, engineering) — `isin` field added for
//     D-FINANCIAL-INSTRUMENT-ENTITY Slice 9 SecurityMaster HQLA override bridge.

// CANONICAL HOME: the CoA schema + data now live in
// `v2-core/accounting/chart-of-accounts.ts` (D-ACCT-SCHEMA-CANONICAL-HOME,
// WS-ACCT-FX-COMPLETENESS Slice 1). This v1 module RE-EXPORTS them — it no
// longer hand-declares the schema — and keeps only the v1-reporting-coupled
// derivation helpers (`coaToHqlaClassifications`, `coaToCapitalClassifications`,
// the BA-100 sector helpers) that import `platform/reporting` types and so
// cannot live inside `v2-core` (the v1→v2 import direction is one-way). The
// `recon:accounting-schema-home` gate enforces that the schema is not
// re-declared here. The `chart-of-accounts.json` flat seed is GENERATED from
// the canonical `COA_ACCOUNTS` (`scripts/generate-chart-of-accounts-json.ts`).
import type { AccountLiquidityClassification, HqlaLevel } from "../reporting/ba-300-lcr";
import type { AccountCapitalClassification, CapitalTier } from "../reporting/ba-700-capital";

// Re-export the canonical schema + data from v2-core. Importers that did
// `import { CoaAccountEntry, COA_ACCOUNTS, ... } from "./coa-registry"` keep
// working unchanged.
export {
  type CoaAccountEntry,
  CoaAccountEntrySchema,
  COA_ACCOUNTS,
  COA_BY_ID,
} from "../../v2-core/accounting/chart-of-accounts";

import { COA_ACCOUNTS } from "../../v2-core/accounting/chart-of-accounts";
import type { CoaAccountEntry } from "../../v2-core/accounting/chart-of-accounts";

// ---------------------------------------------------------------------------
// Derived helpers (v1-reporting-coupled — stay on the v1 side).
// ---------------------------------------------------------------------------

/**
 * Derive an `AccountCapitalClassification[]` from the COA registry.
 *
 * Scans all accounts in `COA_ACCOUNTS` for those with a `capitalTier` set,
 * and maps them to `AccountCapitalClassification` entries suitable for
 * passing directly to `generateBa100CapitalFromEvents` as the `classifications`
 * input.
 *
 * This provides the canonical T2 (and CET1/AT1) account set for the BA 100
 * generator without requiring callers to hard-code account IDs.
 *
 * Substrate gap (D-DATA-QUALITY-CROSS-DOMAIN-V1): T2 accounts (ACC-5200-001,
 * ACC-5200-002) are placeholder entries. No real T2 instruments are outstanding
 * at build-phase; the BA 100 tier2Capital will be 0 until posting rules for
 * T2 instrument issuance and general-provision accumulation are implemented.
 *
 * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
 * Citations: Reg 38(8); BCBS Basel III §50–§60; SARB BA 100.
 */
export function coaToCapitalClassifications(): readonly AccountCapitalClassification[] {
  return COA_ACCOUNTS.filter(
    (a): a is CoaAccountEntry & { capitalTier: CapitalTier } => a.capitalTier !== undefined,
  ).map((a) => ({
    leafAccountId: a.id,
    capitalTier: a.capitalTier,
    ...(a.capitalSubCategory ? { subCategory: a.capitalSubCategory } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Counterparty-sector decomposition (SARB BA 100 per-line requirement)
// ---------------------------------------------------------------------------

/**
 * Counterparty sector for SARB BA 100 per-line decomposition.
 *
 * SARB BA 100 (Balance Sheet) requires each material balance-sheet line to be
 * disaggregated by the sector of the counterparty the exposure / obligation is
 * against (bank, corporate, sovereign, retail). Unmappable accounts fall to
 * `other` — surfaced, never hidden.
 *
 *   - "bank"       → exposures to / from other banks (interbank placements,
 *                    correspondent nostros, deposits from banks).
 *   - "corporate"  → exposures to / from corporate / wholesale non-bank
 *                    counterparties (wholesale deposits, customer payables).
 *   - "sovereign"  → exposures to / from the sovereign / central bank
 *                    (central-bank reserves, government securities).
 *   - "retail"     → exposures to / from retail customers (retail deposits).
 *   - "other"      → no clean counterparty-sector mapping (suspense, own-book
 *                    trading positions, P&L, equity capital, derivatives whose
 *                    counterparty sector is not encoded at the GL-account level).
 *
 * Authority: D-BA-RETURNS-FOLLOWON-BATCH. Citation: SARB BA 100 (Balance Sheet);
 * Banks Act 94 of 1990 §75; Regulations Relating to Banks Reg 32.
 */
export type CounterpartySector = "bank" | "corporate" | "sovereign" | "retail" | "other";

/** All counterparty sectors, in canonical render order. */
export const COUNTERPARTY_SECTORS: readonly CounterpartySector[] = [
  "bank",
  "corporate",
  "sovereign",
  "retail",
  "other",
];

/**
 * Derive the counterparty sector for a single COA account.
 *
 * The mapping is driven entirely by the COA registry (account id range +
 * `category` + `custodianPartyId` + `name`) — no posting-event read and no
 * schema change. Where the COA does not unambiguously encode the counterparty
 * sector (own-book trading positions, suspense, P&L, capital, derivatives), the
 * account maps to `other` so the residual is surfaced rather than mis-attributed.
 *
 * Mapping rationale (account-id ranges from `COA_ACCOUNTS`):
 *   - 7100 "Due from Banks" (interbank placements) ............... bank
 *   - 1200 / deprecated 1100-002/003 correspondent nostros ....... bank
 *   - 6100-003/004 "Wholesale" deposits .......................... corporate
 *   - 2200 "Customer Payables" (wholesale/corporate clients) ..... corporate
 *   - 6100-001/002 "Retail" deposits ............................. retail
 *   - central-bank-custodied cash (custodian = central-bank) ..... sovereign
 *   - 3100-001/002 government bond assets (level-1 sovereign) .... sovereign
 *   - everything else ............................................ other
 *
 * Authority: D-BA-RETURNS-FOLLOWON-BATCH. Citation: SARB BA 100.
 */
export function sectorForAccount(account: CoaAccountEntry): CounterpartySector {
  const id = account.id;

  // --- bank: interbank placements + correspondent nostros ---
  // 7100-* "Due from Banks" / IBL interest are interbank exposures.
  if (id.startsWith("ACC-7100-")) return "bank";
  // 1200-* correspondent nostros are balances held at other (commercial) banks.
  // The deprecated 1100-002 / 1100-003 nostros (merged into 1200) are too.
  if (id.startsWith("ACC-1200-")) return "bank";
  if (id === "ACC-1100-002" || id === "ACC-1100-003") return "bank";

  // --- sovereign: central-bank cash + government securities ---
  // Central-bank-custodied cash (the SARB reserve account) is a sovereign /
  // central-bank exposure. Derive from the custodian, never the name.
  if (
    account.category === "asset-cash" &&
    account.custodianPartyId !== undefined &&
    account.custodianPartyId.includes("sarb")
  ) {
    return "sovereign";
  }
  // Government bond assets (banking + trading book) — build-phase assumption is
  // SA-government 0%-RW paper (see coa-registry header / hqlaSubCategory
  // "level-1.government-securities").
  if (id === "ACC-3100-001" || id === "ACC-3100-002") return "sovereign";

  // --- retail: retail deposit liabilities ---
  if (id === "ACC-6100-001" || id === "ACC-6100-002") return "retail";

  // --- corporate / wholesale non-bank ---
  // Wholesale (operational + non-operational) deposit liabilities.
  if (id === "ACC-6100-003" || id === "ACC-6100-004") return "corporate";
  // Customer payables — non-bank corporate / wholesale client obligations.
  if (id.startsWith("ACC-2200-")) return "corporate";

  // --- other: no clean counterparty-sector mapping ---
  // FX trading positions, suspense, settlement, derivatives, equity capital,
  // P&L, repo, bond accruals etc. are own-book or sector-ambiguous at the GL
  // level. Surfaced as `other`, not mis-attributed.
  return "other";
}

/**
 * Sector lookup by account id, derived from `COA_ACCOUNTS`.
 *
 * Accounts NOT in the COA registry (synthetic test stubs, accounts only present
 * in the trial balance) are absent from this map; callers should treat a missing
 * entry as `other`. Authority: D-BA-RETURNS-FOLLOWON-BATCH; SARB BA 100.
 */
export const COA_SECTOR_BY_ID: ReadonlyMap<string, CounterpartySector> = new Map(
  COA_ACCOUNTS.map((a) => [a.id, sectorForAccount(a)]),
);

/**
 * Resolve the counterparty sector for an account id, defaulting unknown ids to
 * `other`. The single resolver consumed by the BA 100 sector decomposition so
 * the default-to-`other` rule lives in exactly one place.
 *
 * Authority: D-BA-RETURNS-FOLLOWON-BATCH; SARB BA 100.
 */
export function sectorForAccountId(accountId: string): CounterpartySector {
  return COA_SECTOR_BY_ID.get(accountId) ?? "other";
}

/**
 * Derive a `AccountLiquidityClassification[]` from the COA registry.
 *
 * Scans all accounts in `COA_ACCOUNTS` for those with an `hqlaLevel` set,
 * and maps them to `AccountLiquidityClassification` entries suitable for
 * passing directly to `generateBa300Lcr` as the `classifications` input.
 *
 * This replaces the hard-coded `BUILD_PHASE_DEFAULT_CLASSIFICATIONS` in the
 * render script and makes the BA 110 generator dynamically driven by COA data.
 *
 * Basel III haircut application is handled inside `generateBa300Lcr`; this
 * function only constructs the typed mapping.
 *
 * Authority: D-HQLA-COA-CLASSIFICATION (CEO-approved 2026-05-22).
 * Citations: BCBS D295 §II.A; SARB BA 110; Reg 26(7).
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
    // BA 110 generator can resolve SecurityMaster HQLA overrides per account.
    ...(a.isin ? { isin: a.isin } : {}),
  }));
}
