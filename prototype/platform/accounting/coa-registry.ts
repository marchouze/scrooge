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

import { z } from "zod";

import type { AccountLiquidityClassification, HqlaLevel } from "../reporting/ba-300-lcr";
import type { AccountCapitalClassification, CapitalTier } from "../reporting/ba-700-capital";

// ---------------------------------------------------------------------------
// TypeScript type
// ---------------------------------------------------------------------------

/**
 * A single account entry in the chart of accounts.
 *
 * The `hqlaLevel` field is the key addition in G-4. It marks which Basel III
 * HQLA tier an account contributes to, enabling the BA 110 generator to derive
 * its classification map directly from the COA rather than a separate lookup.
 *
 * Citations:
 *   D-HQLA-COA-CLASSIFICATION; BCBS D295 §II.A; SARB BA 110; Reg 26(7).
 */
export interface CoaAccountEntry {
  /** Stable GL account identifier. Convention: ACC-<TYPE><CATEGORY>-<NNN>. */
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly side: "debit" | "credit";
  /**
   * The account's designated ISO-4217 currency.
   *
   * Currency is a SEPARATE DIMENSION — it is NEVER part of the account `name`
   * (D-COA-CURRENCY-DECOUPLING, CEO-approved 2026-05-30). Account names such as
   * "Nostro — USD" or "FX Trading Receivable — ZAR" were defects: they embedded
   * currency into the human-readable name. Names are now currency-free; the
   * currency lives here.
   *
   * The AUTHORITATIVE per-balance currency is the currency dimension carried on
   * each ledger entry (`SubLedgerLeg.currency`), not this field. This field is
   * the account's *designated* currency: the single currency a single-currency
   * account is expected to hold. It is the COA-level declaration of intent; the
   * ledger entry is the source of truth for any actual balance.
   *
   * OMITTED only for genuinely multi-currency pool accounts (e.g. the "FCY"
   * FX-trading pool accounts ACC-2100-002 / ACC-2100-004) where per-entry
   * currency is authoritative and no single designated currency applies. An
   * omitted `currency` on such a pool account is CORRECT, not a gap.
   *
   * ZAR is the bank's operational reporting/base currency, which is why renders
   * carry ZAR-equivalent columns — but that is presentation, not data
   * (Principle 5: reporting currency is presentation, not data). From a COA
   * perspective ZAR is just another currency account.
   *
   * Authority: D-COA-CURRENCY-DECOUPLING (CEO-approved 2026-05-30).
   * Citations: Principle 5 (multi-currency from day one).
   */
  readonly currency?: string;
  /**
   * HQLA tier per BCBS D295 §49–§54 / Reg 26(7).
   * Absent = not HQLA-eligible; excluded from BA 110 HQLA stock scan.
   *
   * - "level-1"  → 0% haircut (central-bank reserves, 0%-RW sovereign)
   * - "level-2a" → 15% haircut (qualifying sovereign/covered bonds/corporates)
   * - "level-2b" → 25–50% haircut (qualifying equities / RMBS / corporates)
   *
   * Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §II.A (Jan 2013);
   *            SARB BA 110; Regulations Relating to Banks Reg 26(7).
   */
  readonly hqlaLevel?: HqlaLevel;
  /**
   * Sub-category label for BA 110 line rendering.
   * Only meaningful when `hqlaLevel` is set.
   * Example: "level-1.central-bank-reserves".
   * Authority: D-HQLA-COA-CLASSIFICATION; SARB BA 110.
   */
  readonly hqlaSubCategory?: string;
  /**
   * Per-asset haircut factor for level-2b accounts per BCBS D295 §54.
   * Minimum 0.50 for equities/non-RMBS; 0.25 for RMBS.
   * Unset defaults to 0.50 in the BA 110 generator.
   * Only meaningful when `hqlaLevel === "level-2b"`.
   * Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §54.
   */
  readonly hqlaAssetSpecificFactor?: number;
  /**
   * Basel III capital tier per Reg 38(8) / BCBS Basel III §50–§57.
   * Only set for accounts that form part of the regulatory capital stack.
   *
   * - "cet1" → Common Equity Tier 1 (paid-up shares, retained earnings, OCI)
   * - "at1"  → Additional Tier 1 (perpetual AT1 instruments, contingent capital)
   * - "t2"   → Tier 2 (subordinated debt ≥5yr, qualifying general provisions)
   *
   * Absent = not a capital-stack account; excluded from BA 100 capital fold.
   *
   * Citation: D-DATA-QUALITY-CROSS-DOMAIN-V1; Reg 38(8); BCBS Basel III §50–§57.
   * Placeholder entries added per D-DATA-QUALITY-CROSS-DOMAIN-V1 pending
   * Mira's WS-INSTRUMENT-ANALYSES capital-stack mapping.
   */
  readonly capitalTier?: CapitalTier;
  /**
   * Sub-category label for BA 100 line rendering.
   * Only meaningful when `capitalTier` is set.
   * Example: "t2.subordinated-debt", "cet1.paid-up-ordinary-shares".
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1; SARB BA 100.
   */
  readonly capitalSubCategory?: string;
  /**
   * ISIN of the security held in this GL account.
   *
   * When present, the BA 110 generator will look up this ISIN in the
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
   * BA 110 HQLA stock calculations unchanged.
   *
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
   * Citations: BA-110-LCR; BCBS-LCR-2013.
   */
  readonly isin?: string;
  /**
   * Party URN of the custodian holding the cash in this account.
   *
   * Only meaningful for cash-nature accounts (`category === "asset-cash"`).
   * The custodian — not a hand-typed `hqlaLevel` tag — is the SOURCE FACT that
   * determines whether cash held here is HQLA and at which tier: cash at the
   * central bank (custodian Party classified `central-bank`) is Level-1
   * (Reg 26(7)(a)(i)); cash at a correspondent commercial bank is generally
   * not HQLA. The BA 110 cash-HQLA fold (`computeCashHqlaFromCustodian`)
   * derives the tier by looking the custodian up in the event-sourced Party
   * register — never from an authored tag on this row. This removes the
   * authored-tag failure mode (Principle 1: risk derives its figures from the
   * source, not from stored classification state).
   *
   * Authority: custodian-derived HQLA rework (CEO-approved 2026-05-29);
   * supersedes the authored `hqlaLevel` tag previously carried on the SARB
   * cash account.
   * Citations: BCBS D295 §50(a); Reg 26(7)(a)(i); D-PARTY-REGISTER.
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
  // D-COA-CURRENCY-DECOUPLING (2026-05-30): the account's designated currency,
  // as a first-class dimension. Currency is NEVER part of `name`. Omitted only
  // for genuinely multi-currency pool accounts (per-entry currency authoritative).
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  hqlaLevel: z.enum(["level-1", "level-2a", "level-2b"]).optional(),
  hqlaSubCategory: z.string().optional(),
  hqlaAssetSpecificFactor: z.number().min(0).max(1).optional(),
  // D-FINANCIAL-INSTRUMENT-ENTITY Slice 9: ISIN bridge to SecurityMaster override map.
  isin: z.string().optional(),
  // Custodian-derived HQLA (2026-05-29): cash-account custodian Party URN.
  custodianPartyId: z.string().optional(),
  // D-DATA-QUALITY-CROSS-DOMAIN-V1: capital tier for BA 100 capital fold.
  capitalTier: z.enum(["cet1", "at1", "t2"]).optional(),
  capitalSubCategory: z.string().optional(),
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
 * Citations: BCBS D295 §II.A; SARB BA 110; Reg 26(7).
 */
export const COA_ACCOUNTS: readonly CoaAccountEntry[] = [
  // ------------------------------------------------------------------
  // 1100 — Central-bank reserve, settlement suspense, deprecated nostros
  //
  // D-COA-CURRENCY-DECOUPLING (2026-05-30):
  //   - ACC-1100-001 is REPURPOSED as the Central Bank Reserve Account (held
  //     AT the SARB). It is NOT a nostro. Currency and the SARB identity are
  //     both separate fields (`currency`, `custodianPartyId`) — never in the
  //     name.
  //   - ACC-1100-002 / ACC-1100-003 (USD / EUR correspondent nostros) are
  //     DEPRECATED: they duplicated ACC-1200-002 / ACC-1200-003 and are merged
  //     into the 1200 range. Kept resolvable so historical ledger entries still
  //     render a sensible name; new postings must target the 1200 ids.
  // ------------------------------------------------------------------
  {
    id: "ACC-1100-001",
    // Central-bank reserve / settlement balance held AT the SARB — a reserve
    // sub-type of asset-cash, NOT a nostro. The SARB identity lives in
    // `custodianPartyId` (separate field), never in the name; the currency
    // lives in `currency` (separate field), never in the name.
    name: "Central Bank Reserve Account",
    category: "asset-cash",
    currency: "ZAR",
    side: "debit",
    // HQLA tier is DERIVED from the custodian, not authored here. This account
    // holds the bank's reserve/settlement balance at the SARB; the SARB Party
    // is classified `central-bank`, so the BA 110 cash-HQLA fold derives
    // Level-1 (Reg 26(7)(a)(i); BCBS D295 §50(a)). The previous authored
    // `hqlaLevel: "level-1"` tag was removed in the custodian-derived rework
    // (2026-05-29) — risk must derive its figures from the source (Principle 1).
    // NOTE: this is NOT the FX settlement account for ZAR. ZAR settles through
    // the correspondent nostro ACC-1200-001. The reserve account is funded /
    // swept separately.
    custodianPartyId: "urn:party:legal-entity:sarb",
  },
  {
    id: "ACC-1100-002",
    // DEPRECATED — merged into ACC-1200-002 (D-COA-CURRENCY-DECOUPLING,
    // 2026-05-30). USD/EUR 1100 nostros duplicated the 1200 correspondent
    // nostros. New postings MUST target ACC-1200-002. Kept resolvable (clean,
    // currency-free name + `currency` field) so historical ledger entries still
    // render a sensible name. Events are immutable — history is never rewritten.
    name: "Nostro",
    category: "asset-cash",
    currency: "USD",
    side: "debit",
  },
  {
    id: "ACC-1100-003",
    // DEPRECATED — merged into ACC-1200-003 (D-COA-CURRENCY-DECOUPLING,
    // 2026-05-30). See ACC-1100-002 rationale. New postings MUST target
    // ACC-1200-003.
    name: "Nostro",
    category: "asset-cash",
    currency: "EUR",
    side: "debit",
  },
  {
    id: "ACC-1100-004",
    name: "FX Settlement Suspense",
    category: "asset-suspense",
    currency: "ZAR",
    side: "debit",
    // Settlement suspense: transient; not HQLA-eligible. Suspense, NOT a nostro.
  },
  {
    id: "ACC-1100-005",
    name: "FX Settlement Suspense",
    category: "asset-suspense",
    currency: "USD",
    side: "debit",
    // Settlement suspense: transient; not HQLA-eligible. Suspense, NOT a nostro.
  },

  // ------------------------------------------------------------------
  // 1200 — Correspondent bank nostros
  // ------------------------------------------------------------------
  {
    id: "ACC-1200-001",
    name: "Nostro",
    category: "asset-cash",
    currency: "ZAR",
    side: "debit",
    // The everyday ZAR correspondent nostro and the FX settlement target for
    // ZAR. NOT central-bank reserves (that is ACC-1100-001) — correspondent
    // custodian, so NOT Level-1 HQLA. No ZAR correspondent Party is registered
    // in the Party register yet, so `custodianPartyId` is left unset; populate
    // it when the ZAR correspondent is onboarded as a Party.
  },
  {
    id: "ACC-1200-002",
    name: "Nostro",
    category: "asset-cash",
    currency: "USD",
    side: "debit",
    // Correspondent-bank nostro in USD (canonical; ACC-1100-002 merged here).
  },
  {
    id: "ACC-1200-003",
    name: "Nostro",
    category: "asset-cash",
    currency: "EUR",
    side: "debit",
    // Correspondent-bank nostro in EUR (canonical; ACC-1100-003 merged here).
  },
  // Per-currency correspondent nostros for the remaining actively-traded
  // currencies (GBP/JPY/CHF/AUD). Provisioned under
  // D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (CEO build-phase, 2026-06-08): the
  // earlier 15-account trading-block provisioning (D-SLA-FX-PER-CURRENCY-
  // ACCOUNT-PROVISIONING) covered the FX trading receivable/payable/unrealised-
  // P&L accounts only, NOT the ACC-1200 correspondent-settlement nostros. A
  // GBP/JPY/CHF/AUD FX trade's principal-payment (PR-FX-PRIN) NOSTRO leg
  // therefore still account-resolution-missed to the FX suspense (ACC-2100-007)
  // until now. These four nostros close that hole; the supported settlement set
  // (ZAR/USD/EUR/GBP/JPY/CHF/AUD) now mirrors the supported FX trading set and
  // the TwelveData live feed universe (TWELVE_DATA_TARGET_PAIRS). Currency is a
  // separate field, never in the name (D-COA-CURRENCY-DECOUPLING).
  {
    id: "ACC-1200-004",
    name: "Nostro",
    category: "asset-cash",
    currency: "GBP",
    side: "debit",
    // Correspondent-bank nostro in GBP (FX settlement target for GBP).
  },
  {
    id: "ACC-1200-005",
    name: "Nostro",
    category: "asset-cash",
    currency: "JPY",
    side: "debit",
    // Correspondent-bank nostro in JPY (zero-minor-unit currency; amounts are
    // minor-unit per minorFactor 1).
  },
  {
    id: "ACC-1200-006",
    name: "Nostro",
    category: "asset-cash",
    currency: "CHF",
    side: "debit",
    // Correspondent-bank nostro in CHF (FX settlement target for CHF).
  },
  {
    id: "ACC-1200-007",
    name: "Nostro",
    category: "asset-cash",
    currency: "AUD",
    side: "debit",
    // Correspondent-bank nostro in AUD (FX settlement target for AUD).
  },

  // ------------------------------------------------------------------
  // 2100 — FX trading receivables / payables / P&L
  // ------------------------------------------------------------------
  {
    id: "ACC-2100-001",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
    // Trading receivable: not HQLA (not a qualifying liquid asset).
  },
  {
    id: "ACC-2100-002",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    // USD-ONLY trading receivable. This account is NOT a multi-currency FCY
    // pool — the "FCY pool" framing was rejected by the CEO
    // (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE, 2026-06-05). USD = USD; foreign
    // currency must never be parked here. A non-ZAR/USD FX leg whose currency
    // has no dedicated trading receivable resolves to the FX unresolved-currency
    // suspense account (ACC-2100-007) + a high-severity urgent-correction alert,
    // never silently to this USD slot.
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
    // USD-ONLY trading payable. Mirror of ACC-2100-002: NOT an FCY pool
    // (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE, 2026-06-05). USD = USD; a
    // non-ZAR/USD FX payable leg with no dedicated account resolves to the FX
    // unresolved-currency suspense account (ACC-2100-007) + urgent-correction
    // alert, never silently to this USD slot.
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
    // Dedicated BALANCING suspense for FX legs whose currency has no dedicated
    // trading account in the COA (e.g. EUR, GBP, JPY today). Authority:
    // D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05). When the
    // SLA resolver finds no per-currency receivable/payable account for a leg,
    // the interpreter routes that leg HERE so the entry still balances (double-
    // entry integrity preserved) and raises a high-severity urgent-correction
    // SubstrateAlert{alertClass:"integrity"} so the unresolved item is glaringly
    // visible and tracked for prompt correction — NEVER a silent USD fallback,
    // NEVER a dropped posting.
    //
    // `currency` is intentionally OMITTED: this account holds whatever
    // unresolved currencies arrive, and the AUTHORITATIVE currency is carried on
    // each SubLedgerLeg.currency (per the unresolved leg). This is NOT a defect
    // (D-COA-CURRENCY-DECOUPLING) and NOT a re-introduction of the rejected FCY
    // pool — a pool is a permanent home; this is a loud, transient holding pen
    // every entry to which raises an urgent-correction alert. Both the
    // receivable-side (debit) and payable-side (credit) unresolved legs route
    // here, so DR == CR nets within this account per unresolved currency.
    //
    // Suspense: transient; not HQLA-eligible. Designated side `debit` (asset
    // suspense), but legitimately carries both debit and credit legs.
    side: "debit",
  },

  // ------------------------------------------------------------------
  // 2100 — Per-currency FX-spot trading accounts (GBP/EUR/CHF/AUD/JPY)
  //
  // Authority: D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING (CFO-approved by
  //   Camille (Chief Financial Officer, finance), 2026-06-05). The CFO memo
  //   (record:documents:camille:cfo-sla-decisions-memo:2026-06-05) is the
  //   authoritative provisioning spec.
  //
  // The bank actively trades GBP/EUR/CHF/AUD/JPY but the COA carried dedicated
  // FX-spot trading accounts for ZAR (ACC-2100-001/003/005) and USD
  // (ACC-2100-002/004) only, so every leg in those five currencies routed to
  // the ACC-2100-007 unresolved-currency suspense + a high-severity alert.
  // These 15 leaf accounts give each traded currency its own trading
  // receivable / payable / unrealised-FVTPL-P&L home, mirroring the ZAR/USD
  // structure exactly. ACC-2100-007 suspense remains the permanent last-resort
  // safety net for any FURTHER unprovisioned currency
  // (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
  //
  // Account NAMES carry no currency (D-COA-CURRENCY-DECOUPLING /
  // recon:coa-name-no-currency); the authoritative currency is the per-account
  // `currency` field plus each `SubLedgerLeg.currency`. Realised FX P&L stays
  // consolidated at ACC-2100-006 (ZAR presentation) — per-currency realised
  // P&L is out of scope for this provisioning (CFO memo §4 notes).
  //
  // ID NOTE: the CFO memo's authoritative table enumerated ACC-2100-008..022,
  // assuming the FX block ended at ACC-2100-007. ACC-2100-009 is, however,
  // already in active use as the "FX Sub-Ledger Build-Phase Remediation
  // Suspense" (chart-of-accounts.json + fx-subledger-trade-reconciliation.ts
  // FX_REMEDIATION_SUSPENSE, live since PR #958, 2026-06-01) — predating and
  // unknown to the memo. Overwriting a live account would be a Principle-1
  // integrity breach, so the 15-account block is provisioned CONTIGUOUSLY at
  // ACC-2100-010..024, clearing the occupied ACC-2100-009 (and the now-vacant
  // ACC-2100-008 left as a documented gap immediately before it). The CFO
  // POLICY (15 dedicated per-currency accounts, three per currency, mirroring
  // ZAR/USD) is unchanged; only the numeric ids shift to avoid the collision.
  // Flagged to the CFO for awareness.
  // ------------------------------------------------------------------
  // GBP
  {
    id: "ACC-2100-010",
    name: "FX Trading Receivable",
    category: "asset-receivable",
    currency: "GBP",
    side: "debit",
    // GBP trading receivable. Mirror of ACC-2100-002 (USD); currency-free name.
  },
  {
    id: "ACC-2100-011",
    name: "FX Trading Payable",
    category: "liability-payable",
    currency: "GBP",
    side: "credit",
    // GBP trading payable. Mirror of ACC-2100-004 (USD).
  },
  {
    id: "ACC-2100-012",
    name: "Unrealised FX P&L — FVTPL",
    category: "income-trading",
    currency: "GBP",
    side: "credit",
    // GBP unrealised FX P&L (FVTPL, IFRS 9 §5.7.1). Mirror of ACC-2100-005.
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
  // JPY — zero-minor-unit currency (ISO-4217 minor unit 0). Amounts are held in
  // minor units per the currency's minorFactor (1 for JPY), so no special-casing
  // beyond correct `currency` tagging is required (CFO memo §4 notes).
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

  // ------------------------------------------------------------------
  // 2105 — FX sub-ledger build-phase write-off P&L
  //
  // Authority: D-FX-SUBLEDGER-WRITEOFF-CFO (CFO authority — Bea (Chief Financial
  //   Officer, governance), 2026-06-07).
  //
  // Dedicated write-off line for the build-phase residue swept out of the FX
  // remediation suspense (ACC-2100-009). Deliberately sits OUTSIDE the ACC-2100-*
  // trading sub-ledger range so the legacy-account reconciliation engine
  // (fx-subledger-legacy-reconciliation.ts, which scans the `ACC-2100-` prefix)
  // never treats the write-off charge as orphaned trading gross to re-sweep. The
  // residue is build-phase SYNTHETIC corruption; the write-off is substrate
  // hygiene (the GL must end clean), NOT a real financial loss. Kept distinct
  // from Realised FX P&L (ACC-2100-006) so genuine trading P&L is not polluted by
  // a one-off build-phase cleanup. Currency-free name (D-COA-CURRENCY-DECOUPLING);
  // the residue is written off in the currency in which it was stranded (each
  // SubLedgerLeg.currency), ZAR is the presentation currency.
  // ------------------------------------------------------------------
  {
    id: "ACC-2105-001",
    name: "FX Sub-Ledger Build-Phase Write-Off",
    category: "income-trading",
    currency: "ZAR",
    side: "debit",
  },

  // ------------------------------------------------------------------
  // 2200 — Customer payables
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 2300 — Settlement-failed receivables / ECL
  // ------------------------------------------------------------------
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
  // Per-currency settlement-failed (defaulted-claim, amortised-cost) receivables
  // for the remaining supported FX currencies (EUR/GBP/JPY/CHF/AUD). Provisioned
  // under D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (CEO build-phase, 2026-06-08).
  // PR-FX-005 reclassifies a defaulted receive-leg from the FVTPL trading
  // receivable to the amortised-cost defaulted-claim sub-ledger per IFRS 9
  // §4.4.1; previously only ZAR/USD had a per-currency account, so a
  // EUR/GBP/JPY/CHF/AUD Herstatt failure reclassified to the FX suspense
  // (ACC-2100-007) + alert. These five accounts close that hole so the
  // settlement-failed sub-ledger mirrors the supported FX trading set. The ECL
  // allowance (ACC-2300-003) and credit-loss expense (ACC-2300-004) remain ZAR
  // functional-currency only (IAS 21 §23 — the bank's exposure is measured in
  // its functional currency). Currency is a separate field (D-COA-CURRENCY-
  // DECOUPLING).
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
    // "Settlement-Failed" is a descriptor of what the allowance is against, not
    // a currency token — retained. The allowance is carried in ZAR (functional
    // currency) per IAS 21 §23.
    name: "ECL Allowance — Settlement-Failed",
    category: "asset-other",
    currency: "ZAR",
    side: "credit",
  },
  {
    id: "ACC-2300-004",
    // "FX Settlement" is a descriptor (the expense relates to FX settlement
    // failures), not a currency token — retained.
    name: "Credit Loss Expense — FX Settlement",
    category: "expense-impairment",
    currency: "ZAR",
    side: "debit",
  },

  // ------------------------------------------------------------------
  // 2400 — Payment suspense
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 3100 — Bond assets
  // ------------------------------------------------------------------
  {
    id: "ACC-3100-001",
    // Non-currency parenthetical "(Amortised Cost)" retained — IFRS classification.
    name: "Bond Asset — Banking Book (Amortised Cost)",
    category: "asset-investment",
    currency: "ZAR",
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
    currency: "ZAR",
    side: "debit",
    // Level 1 HQLA at build phase: same assumption as ACC-3100-001.
    // Trading-book government bonds qualify per BCBS D295 §49(c).
    // Authority: D-HQLA-COA-CLASSIFICATION; BCBS D295 §49(c); Reg 26(7)(a)(ii).
    hqlaLevel: "level-1",
    hqlaSubCategory: "level-1.government-securities",
  },
  {
    id: "ACC-3100-003",
    // "— Bonds" is an instrument-class descriptor, not a currency token.
    name: "Accrued Interest Receivable — Bonds",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
    // Accrued interest: a receivable, not a liquid asset. Not HQLA.
  },
  {
    id: "ACC-3100-004",
    name: "Bond Discount/Premium Unamortised",
    category: "asset-other",
    currency: "ZAR",
    side: "debit",
    // Discount/premium adjustment account. Not HQLA.
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

  // ------------------------------------------------------------------
  // 3200 — Equity assets
  // ------------------------------------------------------------------
  {
    id: "ACC-3200-001",
    name: "Equity Asset — FVTPL",
    category: "asset-trading",
    currency: "ZAR",
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
    currency: "ZAR",
    side: "debit",
    // Same as ACC-3200-001. Untagged at build phase.
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

  // ------------------------------------------------------------------
  // 3300 — IRD swap assets / liabilities
  // ------------------------------------------------------------------
  {
    id: "ACC-3300-001",
    name: "Swap Asset — FVTPL (Positive NPV)",
    category: "asset-derivative",
    currency: "ZAR",
    side: "debit",
    // Derivative (swap): not a qualifying liquid asset under BCBS D295.
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

  // ------------------------------------------------------------------
  // 4100 — Settlement receivables
  // ------------------------------------------------------------------
  {
    id: "ACC-4100-001",
    name: "Settlement Receivable",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
    // Settlement receivable: not a liquid asset (contingent on counterparty). Not HQLA.
  },
  {
    id: "ACC-4100-002",
    name: "Settlement Receivable",
    category: "asset-receivable",
    currency: "USD",
    side: "debit",
  },

  // ------------------------------------------------------------------
  // 1000 — Bank/cash accounts
  // ------------------------------------------------------------------
  {
    id: "ACC-1000-001",
    name: "Bank",
    category: "asset-cash",
    currency: "ZAR",
    side: "debit",
    // Internal bank account. Not central-bank reserves — not HQLA.
  },

  // ------------------------------------------------------------------
  // 5000 — Equity / CET1 accounts
  // ------------------------------------------------------------------
  {
    id: "ACC-5000-001",
    name: "Share Capital",
    category: "equity",
    currency: "ZAR",
    side: "credit",
    // CET1 per BCBS Basel III §52(a): paid-up ordinary shares / common equity.
    // Citation: D-DATA-QUALITY-CROSS-DOMAIN-V1; Reg 38(8); BCBS Basel III §52(a).
    capitalTier: "cet1" as const,
    capitalSubCategory: "cet1.paid-up-ordinary-shares",
  },
  {
    id: "ACC-5000-002",
    name: "Retained Earnings",
    category: "equity",
    currency: "ZAR",
    side: "credit",
    // CET1 per BCBS Basel III §52(c): retained earnings.
    // Citation: D-DATA-QUALITY-CROSS-DOMAIN-V1; Reg 38(8); BCBS Basel III §52(c).
    capitalTier: "cet1" as const,
    capitalSubCategory: "cet1.retained-earnings",
  },

  // ------------------------------------------------------------------
  // 5200 — Tier 2 capital accounts
  //
  // Placeholder entries per D-DATA-QUALITY-CROSS-DOMAIN-V1.
  // These accounts are provisioned at build-phase to represent the
  // principal T2 instruments expected at licence-day:
  //   (a) Subordinated debt with remaining maturity ≥ 5 years
  //       (BCBS Basel III §58; Reg 38(8)(b))
  //   (b) Qualifying general provisions (IFRS 9 Stage-1 + Stage-2 ECL
  //       allowances, capped at 1.25% of credit RWA per BCBS §60)
  //
  // No real T2 instruments are outstanding in the build phase.
  // Posting rules fire against these account IDs when T2 instruments
  // are issued or general-provision balances are determined.
  //
  // Substrate gap (D-DATA-QUALITY-CROSS-DOMAIN-V1): posting rules for
  // T2 instrument issuance and general-provision accumulation are not
  // yet implemented. The BA 100 fold will return zero T2 capital until
  // those rules land and produce SubLedgerPostingEmitted credits to
  // these accounts. This is expected and non-blocking.
  // ------------------------------------------------------------------
  {
    id: "ACC-5200-001",
    // Non-currency parenthetical "(≥5yr remaining maturity)" retained — maturity descriptor.
    name: "Subordinated Debt — Tier 2 (≥5yr remaining maturity)",
    category: "liability-t2-capital",
    currency: "ZAR",
    side: "credit",
    // T2 per BCBS Basel III §58; Reg 38(8)(b).
    // Subordinated debt with remaining contractual maturity ≥ 5 years.
    // Citation: D-DATA-QUALITY-CROSS-DOMAIN-V1; Reg 38(8)(b); BCBS §58.
    capitalTier: "t2" as const,
    capitalSubCategory: "t2.subordinated-debt",
  },
  {
    id: "ACC-5200-002",
    name: "General Provisions — Qualifying Tier 2 (IFRS 9 Stage-1/2)",
    category: "liability-t2-capital",
    currency: "ZAR",
    side: "credit",
    // T2 per BCBS Basel III §60: qualifying general provisions (Stage-1 + Stage-2
    // ECL allowances under IFRS 9) capped at 1.25% of credit RWA.
    // Citation: D-DATA-QUALITY-CROSS-DOMAIN-V1; Reg 38(8)(c); BCBS §60;
    //           IFRS 9 §5.5.3 (Stage-1 / Stage-2 ECL provisioning).
    capitalTier: "t2" as const,
    capitalSubCategory: "t2.qualifying-general-provisions",
  },

  // ------------------------------------------------------------------
  // 5100 — Repo (secured borrowing) sub-ledger
  //
  // These leaves already existed in chart-of-accounts.json and were used by
  // the legacy posting-rule functions (repo-mmd-ibl.ts) as string literals.
  // They are now registered in COA_ACCOUNTS so the generated `AccountId` union
  // (sla:codegen) covers them and the SLA resolver can resolve to them with the
  // no-silent-fallback discipline. Authority: D-SLA-ENGINE-RULES-AS-DATA
  // (full-retirement Batch 1, CEO-approved 2026-06-05); WS1-PR1a; IAS 39 §27.
  // ------------------------------------------------------------------
  {
    id: "ACC-5100-001",
    name: "Repo Asset (Secured Lending Receivable)",
    category: "asset-receivable",
    currency: "ZAR",
    side: "debit",
    // Secured-borrowing carrying amount (bank as cash borrower). Not HQLA.
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

  // ------------------------------------------------------------------
  // 6100 — Money-Market-Deposit (MMD) liabilities + interest
  // (BA 110 Table 1 LCR categories). WS1-PR1a; IFRS 9 §4.2.1.
  // ------------------------------------------------------------------
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
    category: "expense-impairment",
    currency: "ZAR",
    side: "debit",
    // Interest-expense P&L for deposit liabilities (the only "expense-*" category
    // available in the COA vocabulary). Not an impairment despite the category
    // label — the label is the generic expense bucket.
  },

  // ------------------------------------------------------------------
  // 7100 — Interbank-Loan (IBL, bank as lender) assets + interest
  // WS1-PR1a; IFRS 9 §4.1.2 (amortised cost); BA 120 (NSFR).
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 9000 — SARB FX Net-Open-Position (NOP) memorandum accounts
  // ------------------------------------------------------------------
  //
  // FORM ATTRIBUTION (D-FX-NOP-SLA-CITATION-D5-MIGRATION, CEO 2026-06-07): the FX
  // effective NOP attestation is carried on form BA 325 under reg 29(3) (RRB reg
  // 29; D5/2025 §2.1.14), NOT BA 350. Earlier "BA-350" labels here were a form-
  // number error; the human-facing comments are corrected to BA 325 (reg 29(3)).
  //
  // These accounts belong to the SARB-BA-RETURN secondary accounting
  // representation, NOT to the IFRS primary books. They are REGULATORY
  // MEMORANDUM accounts: the SARB BA 325 (reg 29(3) — daily trading/treasury
  // selected-risk return; effective net-open-position attestation)
  // classifies an FX-spot booking by the gross open position it creates
  // (long vs short by currency), independent of the IFRS trading
  // receivable/payable split. They never touch the IFRS balance sheet or P&L —
  // they form the parallel regulatory NOP basis (Phase-0 spec §2.2 / §3.2).
  //
  // A fresh 9000 range (distinct from every IFRS trading range) keeps the two
  // representations physically un-confusable: an IFRS trial-balance scan can
  // never accidentally fold a regulatory NOP memo, and vice-versa.
  //
  // Account names are CURRENCY-FREE (D-COA-CURRENCY-DECOUPLING); the per-leg
  // currency is carried on each SubLedgerLeg.currency, and the NOP memo balances
  // per currency (long == short within a currency). `currency` is omitted on the
  // two memo accounts because they are designed to hold ANY traded currency —
  // exactly like a multi-currency pool — with the authoritative currency on each
  // entry; this is the documented omission case for currency-decoupling.
  //
  // Provisioned within Camille (Chief Financial Officer, finance)'s authority
  // D-SLA-FIRST-REPRESENTATION-SARB-BA (SARB-BA-RETURN is the first secondary
  // representation). The "NOP long / short memorandum" structure is the minimal
  // BA 325 (reg 29(3)) NOP shape needed for the FX worked example; any richer NOP
  // line decomposition (per-maturity buckets, structural vs trading split) is a
  // deeper CFO accounting-policy call flagged in the Phase-4a deliverable.
  //
  // NOT ACTIVATED IN PRODUCTION. The production GL posting engine emits ONLY the
  // IFRS representation; these accounts receive postings only via the SLA
  // interpreter dry-run / preview + tests until CFO + Owen jointly approve
  // SARB-BA-RETURN activation (the Phase-4c approval workflow).
  //
  // Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4, CEO-approved 2026-06-06);
  //            D-SLA-FIRST-REPRESENTATION-SARB-BA (CFO Camille);
  //            D-FX-NOP-SLA-CITATION-D5-MIGRATION (form re-label BA 350 → BA 325).
  // Citations: SARB BA 325 (reg 29(3) — daily NOP attestation); Banks Act 94 of 1990;
  //            Regulations Relating to Banks; Principle 5 (multi-currency).
  {
    id: "ACC-9000-001",
    name: "Net Open Position Memorandum — Long",
    category: "memorandum-regulatory-nop",
    side: "debit",
    // No `currency` — multi-currency NOP memo (per-entry currency authoritative).
  },
  {
    id: "ACC-9000-002",
    name: "Net Open Position Memorandum — Short",
    category: "memorandum-regulatory-nop",
    side: "credit",
    // No `currency` — multi-currency NOP memo (per-entry currency authoritative).
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
 * passing directly to `generateBa110Lcr` as the `classifications` input.
 *
 * This replaces the hard-coded `BUILD_PHASE_DEFAULT_CLASSIFICATIONS` in the
 * render script and makes the BA 110 generator dynamically driven by COA data.
 *
 * Basel III haircut application is handled inside `generateBa110Lcr`; this
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
