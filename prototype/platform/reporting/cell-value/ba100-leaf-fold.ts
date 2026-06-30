// platform/reporting/cell-value/ba100-leaf-fold.ts
//
// BA 100 (Balance Sheet) per-cell LEAF FOLD — Phase 1 pilot of the per-cell
// value engine (D-BA-RETURN-CELL-VALUE-ENGINE, CEO-approved 2026-06-27).
//
// THE CORRECTED PREMISE (confirmed against the SARB BA 100 domain authority — §18
// — before building). A BA 100 return and the chart-of-accounts trial balance are
// two SIBLING folds of the same event log (Principle 1) — neither derives from the
// other. So BA 100 line granularity is read DIRECTLY from the underlying events /
// FIL instruments, with whatever dimensions they carry — INDEPENDENT of how the
// CoA buckets them. This fold does NOT route line values through the CoA trial
// balance. The trial-balance fold is the RECONCILIATION ORACLE only
// (recon:ba100-cell-values-reconcile), never the source.
//
// WHAT LIGHTS UP (honest build-phase coverage). With the sparse build-phase
// instrument set, only a few BA 100 lines carry a sound, event-sourced value:
//
//   - CAPITAL FIL instances (`assetClass:"capital"`, D-CAPITAL-ASSET-CLASS-V1).
//     A capital raise is a self-describing instrument-of-record: its issuance
//     recognises BOTH legs of the double entry (IAS 32 §22 / IFRS 9 §4.2.1) —
//       Dr settlement-cash (nostro)   → an ASSET (BA 100 R0040 local & foreign ccy)
//       Cr own-funds (per tier)       → EQUITY (CET1) or a capital LIABILITY (AT1/T2)
//     The same `postCapitalIssuanceLegs` / `postCapitalRedemptionLegs` pure
//     functions the BA-700 / BA-100 capital-composition fold already uses
//     (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST)
//     give us the legs directly from the FIL events — no stored GlPostingEmitted in
//     the read path. We classify each leg to its BA 100 row by the leg's CoA
//     account (the account IS the event's economic dimension — own-funds tier vs
//     nostro), and aggregate per (row, C0040 "Total bank"). This reconciles to the
//     oracle BY CONSTRUCTION: the oracle reads the SAME capital legs into its trial
//     balance, so Σ(asset leaf values) == oracle.assets, etc.
//
// WHAT STAYS BLANK (tracked event/product-schema gaps — never fabricated). FX
// spot, settled `cash` FX legs, deposits, loans, securities etc. do NOT yet carry
// the dimensions a granular BA 100 line needs, OR are not yet on-balance-sheet GL-
// posted in the build phase. We leave those cells UNRESOLVED and surface the
// missing event/product field as a tracked substrate-gap entry
// (ba100-leaf-fold-instrument-coverage) — NEVER folded from a coarser proxy, never
// a guessed number (Engineering Charter cmd 2 fail-closed / cmd 4 source-don't-
// fabricate). The engine then leaves the leaf cell empty and computes only the
// subtotals whose inputs resolved.
//
// PROVENANCE. The caller (dashboard/v2-finance-returns-view.ts) pins the active
// Prod / +Sim lens via `withProvenance(...)` BEFORE invoking this fold, so reading
// under `defaultProvenanceFilter()` transparently yields the production-only view
// (no R300m injection — the honest pre-licence empty state) or the +Sim view (the
// simulated R300m CET1 raise shows). We read events with `eventMatchesProvenance-
// Filter` exactly as the sibling BA-320 / capital-composition folds do.
//
// BOUNDARY: V1-side platform module — MAY import from v2-core (the permitted
// v1→v2 direction). The generic arithmetic stays pure in v2-core/.../engine.ts.
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-CAPITAL-ASSET-CLASS-V1;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; brief
//   brief:bea:ba-100-per-cell-value-leaf-fold-phase-1-pilot-ev:2026-06-27;
//   SARB PA Directive D5/2025 §2.1.3 (form BA 100 — Balance Sheet); Banks Act 94
//   of 1990 §75; Reg 32; IAS 32 §22 / §33; IFRS 9 §4.2.1; Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100).

import { addD, decimalToString, toDecimal } from "../../../v2-core/fil-core/decimal";
import type { FilInstrumentCreatedPayload } from "../../../v2-core/fil-instances/events";
import type { FilInstrumentTerminatedPayload } from "../../../v2-core/fil-instances/events";
import type {
  FilCashCounterpartyClass,
  FilDepositCategory,
  FilDepositCounterpartySector,
} from "../../../v2-core/fil-instances/events";
import type { FilLoanProductSubType } from "../../../v2-core/fil-instances/events";
import {
  type CapitalPostingLeg,
  isCapitalPostingInstance,
  postCapitalIssuanceLegs,
  postCapitalRedemptionLegs,
} from "../../../v2-core/posting-rules/capital";
import {
  type DepositPostingLeg,
  isDepositPostingInstance,
  postDepositRepaymentLegs,
  postDepositTakeOnLegs,
  requireDepositTerms,
} from "../../../v2-core/posting-rules/deposit";
import {
  type LoanPostingLeg,
  isLoanPostingInstance,
  postLoanOriginationLegs,
  postLoanRepaymentLegs,
  requireLoanTerms,
} from "../../../v2-core/posting-rules/loan";
import type { LeafCellValues } from "../../../v2-core/regulatory-returns/cell-value/engine";
import { COA_BY_ID } from "../../accounting/coa-registry";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../../projections/filter";
import { type LeafFoldContext, registerLeafFold } from "./leaf-fold-registry";

// ---------------------------------------------------------------------------
// BA 100 column — the book-agnostic "Total bank" column the brief scopes Phase 1
// to. C0010 (Banking) / C0020 (Trading) require a per-leg banking-vs-trading-book
// designation that the capital legs do not carry; the capital raise is a banking-
// book own-funds recognition, but emitting C0010 specifically would assert a book
// split the leg does not yet carry, so Phase 1 reports the consolidated C0040.
// ---------------------------------------------------------------------------

const TOTAL_BANK_COLUMN = "C0040";

// ---------------------------------------------------------------------------
// CoA-account → BA 100 SARB ROW classification, validated against the BA 100 form
// definition (the contract cell `rowLabel` + the published form). The account IS
// the event's economic dimension here (the capital posting rule resolves the
// own-funds tier / nostro account from the FIL instance's qualifyingCapital block
// + settlement currency); we read the BA 100 row off it, NOT off a GL balance.
//
// SOURCE, don't hardcode the labels (Charter cmd 4): only the (account, row)
// coordinate is asserted; the gate cross-checks each emitted row's contract
// rowLabel keyword so a contract edit that moves a line drops the value rather than
// mis-placing it (fail-safe). The keyword is the drift guard, documented here.
//   - asset-cash nostro     → R0040 "Local and foreign currency" (a balance with /
//                              held in cash; under R0010 Cash and balances w/ CB).
//   - equity share capital  → R0810 "Share capital".
//   - equity retained earn. → R0820 "Retained earnings".
//   - equity other reserves → R0830 "Other reserves" (share premium + OCI reserve).
//   - capital liability      → R0700 "Qualifying as capital" (term debt instruments
//     (AT1 / Tier 2)           qualifying as regulatory capital — under R0690).
// ---------------------------------------------------------------------------

interface RowMapping {
  /** BA 100 grid row coordinate. */
  readonly row: string;
  /** Lowercased keyword the target cell's contract rowLabel MUST contain (drift guard). */
  readonly keyword: string;
}

/**
 * Resolve the BA 100 row for a capital posting leg by its CoA account. Returns
 * `undefined` for an account we cannot yet place onto a BA 100 line — the caller
 * then leaves the value unresolved + surfaces a tracked gap (fail-closed; no
 * silent default — Charter cmd 2).
 */
function ba100RowForAccount(accountId: string): RowMapping | undefined {
  const coa = COA_BY_ID.get(accountId);
  if (coa === undefined) return undefined;
  switch (coa.category) {
    case "asset-cash":
      // Cash held at / with a correspondent (nostro) — BA 100 R0040, the cash-and-
      // balances detail line (local and foreign currency).
      return { row: "R0040", keyword: "local and foreign currency" };
    case "equity": {
      // Own-funds equity — split by sub-category onto the equity detail rows.
      if (coa.capitalSubCategory === "cet1.paid-up-ordinary-shares") {
        return { row: "R0810", keyword: "share capital" };
      }
      if (coa.capitalSubCategory === "cet1.retained-earnings") {
        return { row: "R0820", keyword: "retained earnings" };
      }
      if (
        coa.capitalSubCategory === "cet1.share-premium" ||
        coa.capitalSubCategory === "cet1.oci-reserve"
      ) {
        return { row: "R0830", keyword: "other reserves" };
      }
      // An equity own-funds account with no mapped sub-category (e.g. a non-capital
      // OCI reserve) — not yet placeable; surface as a gap rather than guess.
      return undefined;
    }
    case "liability-at1-capital":
    case "liability-t2-capital":
      // AT1 / Tier 2 instruments qualifying as regulatory capital — BA 100 R0700
      // (term debt instruments: qualifying as capital), under R0690.
      return { row: "R0700", keyword: "qualifying as capital" };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Fold one capital posting leg into the per-(row, C0040) accumulator. The leg
// amount is signed by side relative to the line's natural balance:
//   - an asset / equity / liability line carries a STOCK magnitude (the BA 100
//     form presents positive stock); a CREDIT to an own-funds / liability account
//     increases the stock, a DEBIT to a cash (asset) account increases the asset
//     stock. We accumulate the magnitude on the natural side so a redemption
//     (which reverses the legs) nets the stock down.
// The decimal-native major-unit amount comes straight off the leg's MoneyWire.
// ---------------------------------------------------------------------------

interface RowAccumulator {
  /** Signed decimal-string running total for the (row, C0040) cell. */
  total: ReturnType<typeof toDecimal>;
}

function naturalSignedAmount(leg: CapitalPostingLeg): ReturnType<typeof toDecimal> {
  const coa = COA_BY_ID.get(leg.accountCode);
  const magnitude = toDecimal(leg.amount.amount);
  if (coa === undefined) return magnitude;
  const isAsset = coa.category.startsWith("asset");
  // Asset lines are debit-natural (a debit increases the stock); equity / liability
  // lines are credit-natural (a credit increases the stock). The capital issuance
  // posts Dr nostro (asset↑) + Cr own-funds (equity/liability↑); a redemption posts
  // the reverse, netting both stocks down.
  if (isAsset) {
    return leg.creditDebit === "debit" ? magnitude : magnitude.negated();
  }
  return leg.creditDebit === "credit" ? magnitude : magnitude.negated();
}

// ---------------------------------------------------------------------------
// The BA 100 leaf fold.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DEPOSIT classification (L5-FTR deposit-instrument slice). A deposit FIL instance
// is the bank-as-taker liability whose BA 100 line is determined by the instance's
// TYPED `depositTerms.depositCategory` (the SARB R0570–R0620 deposit detail rows)
// and whose R1010 sector-analysis line is determined by `counterpartySector` — the
// dimension comes from the EVENT, not the (single, sector-split-only) CoA account
// (sibling-fold discipline, Principle 1). The deposit's Dr nostro leg lands on the
// SAME R0040 cash row the capital cash leg uses (account-classified, below).
// ---------------------------------------------------------------------------

/** depositCategory → BA 100 deposit detail row (R0570–R0620). */
const DEPOSIT_CATEGORY_ROW: Readonly<Record<FilDepositCategory, RowMapping>> = {
  savings: { row: "R0570", keyword: "savings deposits" },
  call: { row: "R0580", keyword: "call deposits" },
  "fixed-notice": { row: "R0590", keyword: "fixed and notice deposits" },
  "negotiable-cert": { row: "R0600", keyword: "negotiable certificates of deposit" },
  other: { row: "R0610", keyword: "other deposits" },
  repo: { row: "R0620", keyword: "repurchase agreements" },
};

/**
 * counterpartySector → BA 100 R1010 sector-analysis row. The LCR retail/wholesale
 * partition maps onto the BA 100 deposit sector-analysis taxonomy: retail → R1080
 * (Retail customers); wholesale → R1070 (Corporate customers). This is a faithful
 * placement of the build-phase simulated book — never a fabricated split.
 */
const DEPOSIT_SECTOR_ANALYSIS_ROW: Readonly<Record<FilDepositCounterpartySector, RowMapping>> = {
  "retail-stable": { row: "R1080", keyword: "retail customers" },
  "retail-less-stable": { row: "R1080", keyword: "retail customers" },
  "wholesale-operational": { row: "R1070", keyword: "corporate customers" },
  "wholesale-non-operational": { row: "R1070", keyword: "corporate customers" },
};

// ---------------------------------------------------------------------------
// LOAN classification (L5-FTR loan-origination slice; DISCOVERY backlog item #2).
// A born-V2 loan-origination FIL instance is the bank-as-LENDER asset whose BA 100
// advances line is determined by the instance's TYPED `loanTerms.loanProductSubType`
// (the SARB R0130–R0230 loans-and-advances detail rows) — the dimension comes from
// the EVENT, not the (single) CoA account (sibling-fold discipline, Principle 1).
// The loan's Cr nostro (cash-out) leg lands on the SAME R0040 cash row the capital /
// deposit cash legs use (account-classified, below); the Dr advances leg lands on
// the typed advances detail row. SARB BA 100 Excel form labels are the canonical
// source for the (sub-type → row) coordinate.
// ---------------------------------------------------------------------------

/** loanProductSubType → BA 100 loans-and-advances detail row (R0130–R0230). */
const LOAN_PRODUCT_ROW: Readonly<Record<FilLoanProductSubType, RowMapping>> = {
  "home-loan": { row: "R0130", keyword: "homeloans" },
  "commercial-mortgage": { row: "R0140", keyword: "commercial mortgages" },
  "credit-card": { row: "R0150", keyword: "credit cards" },
  "lease-instalment": { row: "R0160", keyword: "lease and instalment debtors" },
  overdraft: { row: "R0170", keyword: "overdrafts" },
  "term-loan": { row: "R0200", keyword: "term loans" },
  other: { row: "R0230", keyword: "other loans" },
};

const CAPITAL_FIL_EVENT_TYPES = ["FilInstrumentCreated", "FilInstrumentTerminated"] as const;
const DEPOSIT_FIL_EVENT_TYPES = ["FilInstrumentCreated", "FilInstrumentTerminated"] as const;
const LOAN_FIL_EVENT_TYPES = ["FilInstrumentCreated", "FilInstrumentTerminated"] as const;

/** Add a natural-signed amount into the (row, C0040) accumulator. */
function addToCell(
  byCell: Map<string, RowAccumulator>,
  row: string,
  amount: ReturnType<typeof toDecimal>,
): void {
  const key = `${row} ${TOTAL_BANK_COLUMN}`;
  const acc = byCell.get(key) ?? { total: toDecimal("0") };
  acc.total = addD(acc.total, amount);
  byCell.set(key, acc);
}

/**
 * Add a natural-signed amount into an EXPLICIT (row, column) accumulator.
 * Used by the CASH fold where FX cash is a trading-book position and must land
 * on C0020 (Trading book), not the default C0040 (Total bank). Capital /
 * deposit / loan legs continue to use addToCell (C0040).
 */
function addToCellCol(
  byCell: Map<string, RowAccumulator>,
  row: string,
  column: string,
  amount: ReturnType<typeof toDecimal>,
): void {
  const key = `${row} ${column}`;
  const acc = byCell.get(key) ?? { total: toDecimal("0") };
  acc.total = addD(acc.total, amount);
  byCell.set(key, acc);
}

// ---------------------------------------------------------------------------
// CASH classification (D-BA-RETURN-CAPABILITY-FIRST; D-BA-RETURN-PER-PRODUCT-
// RICHNESS; FAIL-SAFE rework per D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE). A
// settled cash FIL instance is a post-FX-settlement nostro balance — the bank's
// cash position AFTER an FX spot settles. The BA 100 row placement is resolved
// in THREE TIERS so a settled, resolvable cash amount is NEVER dropped from the
// balance sheet (money on a balance sheet must never disappear). The fold uses
// C0020 (Trading book) because an FX spot settlement cash balance is part of the
// FX trading book (the same book the FX OTC NPA designates).
//
//   TIER 1 — GRANULAR (preferred). The cash instrument carries a typed
//     `cashTerms.counterpartyClass` (Reg 26 / Banks Act counterparty-sector
//     taxonomy, on the event). Place by that explicit class.
//
//   TIER 2 — DERIVED GRANULAR (the immediate ~R490m fix). `counterpartyClass`
//     is ABSENT, but the instrument is a SETTLED FX cash leg — it back-references
//     an FX instance-of-record (`economicTerms.originatingInstrument`) AND its
//     `originatingEvent` is an FX settlement confirmation. The bank is an
//     INDIRECT participant (no direct CLS/SAMOS — project_indirect_participant_
//     posture), so every FX settlement clears through a correspondent / sponsor
//     bank: the settled cash IS, BY THE BANK'S OPERATING STRUCTURE, a balance
//     held AT A BANK (a nostro). We therefore DERIVE counterpartyClass="bank"
//     from the trade structure + the posture — a genuine, CITED structural
//     derivation, NOT a blanket "assume bank" (Charter cmd 2 / cmd 4). Place as
//     a "bank" nostro (R0120 + R0910/R1050 memos).
//
//   TIER 3 — RESIDUAL HEADLINE + LOUD FLAG (the honest general fail-safe).
//     Neither an explicit class NOR a derivable FX nostro, but the amount IS
//     resolvable (a settled cash balance with a ZAR cost basis). DO NOT BLANK
//     it. Place the resolved ZAR value on R0120 (a clearly-labelled balances-
//     with-banks asset line — IN the recon-counted 10–530 range so the detail
//     still reconciles to the oracle TOTAL ASSETS) AND emit a prominent
//     `residual-cash-awaiting-counterparty-granularity` backlog item carrying
//     the ZAR amount + the missing dimension. The headline value stands; only
//     the banks-vs-customers SUB-ALLOCATION is deferred, flagged immediately.
//     "Fail-closed" means never FABRICATE a granular allocation you cannot
//     support — it does NOT license dropping a total you can.
//
// PRIMARY rows (counted in the BA 100 assets section R0010–R0530, included in
// recon:ba100-cell-values-reconcile):
//   "bank"             → R0120 (Balances with other banks and similar institutions)
//   "central-bank"     → R0010 (Cash and balances with central bank)
//   "customer-non-bank"→ R0120 (same primary row as "bank")
//   residual (Tier 3)  → R0120 (resolvable headline placement, in-range)
//
// MEMO rows (n > 530, EXCLUDED from recon range — memorandum analyses only):
//   "bank"             → R0910 (memo: due from banks) + R1050 (inter-bank analysis)
//   "central-bank"     → R0050 (memo: central bank balances) + R1020 (CB analysis)
//   "customer-non-bank"→ R0900 (memo: due from customers)
//   residual (Tier 3)  → R0910 (memo: due from banks — provisional, flagged)
//
// CRITICAL DESIGN: the recon gate sums ONLY rows in the 10–530 range. Memo rows
// (R0900, R0910, R1020, R1050 etc.) are outside this range and are NOT included
// in the reconciliation oracle. So addToCellCol on a memo row does NOT cause
// double-counting — memo rows are supplementary analyses, not balance-sheet lines.
//
// MAGNITUDE: zarCostBasis (the IAS 21 §21 settlement-date ZAR carrying amount)
// is the fold magnitude — the same ZAR value the GL settlement posting carries.
// The FCY notional is NOT the BA 100 line value; the functional-currency cost
// basis is. A long cash position (received) is a positive asset stock; a short
// (paid) is a reduction. A cash instrument WITHOUT a resolvable ZAR cost basis
// is still skipped — there is no resolved amount to place (that is not a dropped
// total, it is the genuine absence of one; the IAS 21 cost-basis fail-closed at
// materialisation prevents an FCY monetary item from ever lacking it).
//
// Authority: D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE (CEO-approved 2026-06-30);
//   D-BA-RETURN-CAPABILITY-FIRST; D-BA-RETURN-PER-PRODUCT-RICHNESS;
//   D-CASH-ASSET-CLASS-V1; SARB BA 100 form (D5/2025 §2.1.3); IAS 21 §28;
//   project_indirect_participant_posture; D-ENGINEERING-INTEGRITY-CHARTER
//   (cmd 2 fail-closed-not-blank; cmd 4 source-don't-hardcode; cmd 5
//   no-silent-deferral). Principle 1 (dimension from event).
// ---------------------------------------------------------------------------

// TRADING_BOOK_COLUMN removed (Phase 2 — D-BA-RETURN-CELL-VALUE-ENGINE). The
// column is now derived from `cashTerms.bookType` at fold time: "trading" →
// C0020, "banking-treasury" → C0010, absent → C0040 only + loud gap. No
// hardcoded column constant (Charter cmd 4 source-don't-hardcode; D-FX-BOOK-BOUNDARY).

interface CashRowMapping {
  readonly primary: string;
  readonly memos: readonly string[];
}

const CASH_CLASS_ROW: Readonly<Record<FilCashCounterpartyClass, CashRowMapping>> = {
  bank: {
    primary: "R0120", // R0120 in 10–530 range — counted by recon oracle. CRITICAL.
    memos: ["R0910", "R1050"], // memorandum rows — outside recon range.
  },
  "central-bank": {
    primary: "R0010", // R0010 in 10–530 range — counted by recon oracle.
    memos: ["R0050", "R1020"], // memorandum rows — outside recon range.
  },
  "customer-non-bank": {
    primary: "R0120", // R0120 in 10–530 range — counted by recon oracle.
    memos: ["R0900"], // memorandum row — outside recon range.
  },
} as const;

/**
 * TIER-3 RESIDUAL placement — a resolvable settled-cash amount we cannot yet
 * classify to a counterparty class (no explicit class, not a derivable FX
 * nostro). The amount is placed on R0120 (IN the 10–530 recon range, so the
 * detail still reconciles to the oracle TOTAL ASSETS) + the R0910 memo, and a
 * loud capability-backlog item is emitted carrying the ZAR amount + the missing
 * dimension. This is the honest fail-SAFE: the headline value stands; only the
 * banks-vs-customers sub-allocation is deferred, flagged immediately.
 */
const CASH_RESIDUAL_ROW: CashRowMapping = {
  primary: "R0120", // resolvable headline placement, in recon range.
  memos: ["R0910"], // provisional memo (due-from-banks); flagged, not asserted.
} as const;

/**
 * FX-settlement `originatingEvent.eventType` markers (Tier-2 detection). A
 * settled cash FIL instance materialised by the FX settlement seam stamps one of
 * these as its originating event:
 *   - `FxSimSettlementConfirmed`  — the simulator settlement path
 *     (platform/markets/settlement/settle-fx-leg.ts).
 *   - `SettlementConfirmed`       — the production materialise-settled-cash path
 *     (platform/markets/products/materialise-settled-cash.ts).
 *   - `FilFxSettlementConfirmed`  — the born-V2 FIL FX settlement confirmation
 *     (v2-core/fil-instances/events.ts) — included so the marker tracks the
 *     canonical event family, not just the two current emit paths.
 * Sourced from the settlement seams + the FIL event schema, not invented: a cash
 * leg carrying one of these AND an `originatingInstrument` IS a settled FX nostro
 * by construction. New FX settlement event types must be added here when the seam
 * adds them (the gate's Tier-2 fixture guards the contract).
 */
const FX_SETTLEMENT_ORIGINATING_EVENT_TYPES: ReadonlySet<string> = new Set([
  "FxSimSettlementConfirmed",
  "SettlementConfirmed",
  "FilFxSettlementConfirmed",
]);

/**
 * Is this settled cash instrument a DERIVABLE FX nostro (Tier-2)? TRUE when it
 * back-references an FX instance-of-record (`originatingInstrument` present) AND
 * its `originatingEvent` is an FX settlement confirmation. For an indirect
 * participant (no direct CLS/SAMOS), such a balance is held at a correspondent /
 * sponsor bank → counterpartyClass "bank" by structural derivation. This is a
 * genuine sourced derivation (from the trade structure + the posture), never a
 * blanket assumption — a cash leg with neither marker is NOT auto-classed.
 */
function isDerivableFxNostro(
  originatingInstrument: string | undefined,
  originatingEventType: string | undefined,
): boolean {
  if (originatingInstrument === undefined || originatingInstrument === "") return false;
  if (originatingEventType === undefined) return false;
  return FX_SETTLEMENT_ORIGINATING_EVENT_TYPES.has(originatingEventType);
}

/**
 * CAPITAL fold pass — resolve each capital issuance / redemption posting leg,
 * classify it to its BA 100 row by the leg's CoA account (the account IS the
 * economic dimension), and accumulate the natural-signed amount. Only the
 * functional-currency legs are summed (cross-currency own-funds translation is a
 * tracked licence-day refinement, never silently mixed; build-phase anchor = ZAR).
 */
function foldCapitalLegs(
  ctx: LeafFoldContext,
  provenanceFilter: ProvenanceFilter,
  byCell: Map<string, RowAccumulator>,
): void {
  for (const type of CAPITAL_FIL_EVENT_TYPES) {
    for (const ev of ctx.eventStore.replay({ entity: ctx.entity, type, asOf: ctx.asOf })) {
      if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

      let legs: CapitalPostingLeg[];
      if (type === "FilInstrumentCreated") {
        const created = ev.payload as FilInstrumentCreatedPayload;
        if (typeof created.type !== "string" || !isCapitalPostingInstance(created.type)) continue;
        legs = postCapitalIssuanceLegs(created);
      } else {
        const terminated = ev.payload as FilInstrumentTerminatedPayload;
        if (typeof terminated.type !== "string" || !isCapitalPostingInstance(terminated.type)) {
          continue;
        }
        legs = postCapitalRedemptionLegs(terminated);
      }

      for (const leg of legs) {
        if (leg.amount.currency !== ctx.functionalCurrency) continue;
        const mapping = ba100RowForAccount(leg.accountCode);
        // An unmapped account is left UNRESOLVED — surfaced as a substrate gap by
        // the registration, never folded from a coarser proxy (Charter cmd 2).
        if (mapping === undefined) continue;
        addToCell(byCell, mapping.row, naturalSignedAmount(leg));
      }
    }
  }
}

/**
 * DEPOSIT fold pass (L5-FTR slice) — resolve each deposit take-on / repayment
 * posting leg, then classify it onto its BA 100 line:
 *   - the Dr nostro (asset) leg → R0040 cash row, by its CoA account (same cash
 *     row the capital cash leg uses) — account-classified via naturalSignedAmount.
 *   - the Cr deposit-liability (credit) leg → the DEPOSIT DETAIL row R0570–R0620
 *     by the instance's TYPED `depositTerms.depositCategory` (the dimension comes
 *     from the EVENT, not the sector-split-only CoA liability account), AND the
 *     R1010 sector-analysis row by `counterpartySector`.
 * The credit-natural liability magnitude is accumulated positive on its detail row
 * (BA 100 presents a positive deposit stock); a repayment terminal posts a zero
 * memo (its principal-repayment leg is a tracked deferred gap — see deposit.ts).
 * Only functional-currency legs are summed.
 */
function foldDepositLegs(
  ctx: LeafFoldContext,
  provenanceFilter: ProvenanceFilter,
  byCell: Map<string, RowAccumulator>,
): void {
  for (const type of DEPOSIT_FIL_EVENT_TYPES) {
    for (const ev of ctx.eventStore.replay({ entity: ctx.entity, type, asOf: ctx.asOf })) {
      if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

      let legs: DepositPostingLeg[];
      let depositCategory: FilDepositCategory | undefined;
      if (type === "FilInstrumentCreated") {
        const created = ev.payload as FilInstrumentCreatedPayload;
        if (typeof created.type !== "string" || !isDepositPostingInstance(created.type)) continue;
        legs = postDepositTakeOnLegs(created);
        depositCategory = requireDepositTerms(created, "ba100-leaf-fold").depositCategory;
      } else {
        const terminated = ev.payload as FilInstrumentTerminatedPayload;
        if (typeof terminated.type !== "string" || !isDepositPostingInstance(terminated.type)) {
          continue;
        }
        legs = postDepositRepaymentLegs(terminated);
        // The terminal memo posts zero (deferred-gap); no detail-row contribution.
        depositCategory = undefined;
      }

      for (const leg of legs) {
        if (leg.amount.currency !== ctx.functionalCurrency) continue;
        const coa = COA_BY_ID.get(leg.accountCode);
        if (coa === undefined) continue;
        const magnitude = toDecimal(leg.amount.amount);

        if (coa.category.startsWith("asset")) {
          // Dr nostro — the cash leg lands on R0040 (local and foreign currency),
          // exactly as the capital cash leg does (debit increases the asset stock).
          const mapping = ba100RowForAccount(leg.accountCode);
          if (mapping === undefined) continue;
          addToCell(
            byCell,
            mapping.row,
            leg.creditDebit === "debit" ? magnitude : magnitude.negated(),
          );
          continue;
        }

        // The deposit-LIABILITY leg — classify by the TYPED depositCategory onto
        // the deposit detail row + by counterpartySector onto the R1010 analysis.
        // A credit increases the liability stock (presented positive on BA 100).
        const signed = leg.creditDebit === "credit" ? magnitude : magnitude.negated();
        if (depositCategory !== undefined) {
          const detail = DEPOSIT_CATEGORY_ROW[depositCategory];
          addToCell(byCell, detail.row, signed);
          const sector = DEPOSIT_SECTOR_ANALYSIS_ROW[leg.counterpartySector];
          addToCell(byCell, sector.row, signed);
        }
      }
    }
  }
}

/**
 * LOAN fold pass (L5-FTR loan-origination slice) — resolve each loan origination /
 * repayment posting leg, then classify it onto its BA 100 line:
 *   - the Dr advances-asset (debit) leg → the LOANS-AND-ADVANCES DETAIL row
 *     R0130–R0230 by the instance's TYPED `loanTerms.loanProductSubType` (the
 *     dimension comes from the EVENT, not the per-sub-type CoA account — the two
 *     agree by construction, but the EVENT is the source per Principle 1).
 *   - the Cr settlement-cash (credit) leg → R0040 cash row, by its CoA account
 *     (same cash row the capital / deposit cash legs use) — account-classified.
 * The debit-natural advances magnitude is accumulated positive on its detail row
 * (BA 100 presents a positive advances stock); the cash-out leg is a CREDIT to the
 * nostro, reducing the cash stock (the bank pays the principal out). A repayment
 * terminal posts a zero memo (its principal-repayment leg is a tracked deferred gap
 * — see loan.ts). Only functional-currency legs are summed.
 */
function foldLoanLegs(
  ctx: LeafFoldContext,
  provenanceFilter: ProvenanceFilter,
  byCell: Map<string, RowAccumulator>,
): void {
  for (const type of LOAN_FIL_EVENT_TYPES) {
    for (const ev of ctx.eventStore.replay({ entity: ctx.entity, type, asOf: ctx.asOf })) {
      if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

      let legs: LoanPostingLeg[];
      let productSubType: FilLoanProductSubType | undefined;
      if (type === "FilInstrumentCreated") {
        const created = ev.payload as FilInstrumentCreatedPayload;
        if (typeof created.type !== "string" || !isLoanPostingInstance(created.type)) continue;
        legs = postLoanOriginationLegs(created);
        productSubType = requireLoanTerms(created, "ba100-leaf-fold").loanProductSubType;
      } else {
        const terminated = ev.payload as FilInstrumentTerminatedPayload;
        if (typeof terminated.type !== "string" || !isLoanPostingInstance(terminated.type)) {
          continue;
        }
        legs = postLoanRepaymentLegs(terminated);
        // The terminal memo posts zero (deferred-gap); no detail-row contribution.
        productSubType = undefined;
      }

      for (const leg of legs) {
        if (leg.amount.currency !== ctx.functionalCurrency) continue;
        const coa = COA_BY_ID.get(leg.accountCode);
        if (coa === undefined) continue;
        const magnitude = toDecimal(leg.amount.amount);

        if (coa.category.startsWith("asset") && coa.category !== "asset-cash") {
          // Dr advances-asset — classify by the TYPED loanProductSubType onto the
          // loans-and-advances detail row. A debit increases the advances stock.
          if (productSubType === undefined) continue;
          const detail = LOAN_PRODUCT_ROW[productSubType];
          addToCell(
            byCell,
            detail.row,
            leg.creditDebit === "debit" ? magnitude : magnitude.negated(),
          );
          continue;
        }

        // The settlement-cash (nostro) leg → R0040 cash row, account-classified. A
        // credit (cash paid out to the borrower) reduces the cash stock.
        const mapping = ba100RowForAccount(leg.accountCode);
        if (mapping === undefined) continue;
        addToCell(
          byCell,
          mapping.row,
          leg.creditDebit === "debit" ? magnitude : magnitude.negated(),
        );
      }
    }
  }
}

/**
 * The placement tier a settled-cash leg resolved through — surfaced on the
 * residual collector so the dashboard / recon can distinguish a derived "bank"
 * nostro (Tier 2, sound) from an unclassified residual (Tier 3, flagged).
 */
export type CashPlacementTier =
  | "tier1-explicit-class"
  | "tier2-derived-fx-nostro"
  | "tier3-residual";

/**
 * The classification of ONE settled-cash FIL instance for BA 100 placement —
 * the shared resolution both the leaf fold and the residual collector use (one
 * grammar, Charter cmd 4 source-don't-fork). `mapping` is the row placement;
 * `tier` records HOW it resolved; `residualReason` is the loud-flag text when
 * the placement is a Tier-3 residual.
 */
interface CashPlacement {
  readonly mapping: CashRowMapping;
  readonly tier: CashPlacementTier;
  readonly derivedClass: FilCashCounterpartyClass | null;
  readonly residualReason: string | null;
}

/** The economicTerms shape the cash fold reads (narrowed, never `any`). */
interface CashEconomicTerms {
  readonly assetClass?: string;
  readonly direction?: string;
  readonly zarCostBasis?: { readonly currency: string; readonly amount: string };
  readonly cashTerms?: {
    readonly counterpartyClass?: string;
    /** FRTB book designation — drives BA 100 C0010/C0020 column split (Phase 2). */
    readonly bookType?: "trading" | "banking-treasury";
  };
  readonly originatingInstrument?: string;
}

/**
 * Resolve the BA 100 placement of a settled-cash instrument through the three
 * fail-SAFE tiers (D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE). Returns `null` ONLY
 * when there is genuinely no resolved amount to place (not a cash instrument, or
 * no resolvable ZAR cost basis) — never to drop a resolvable total.
 */
function classifyCashPlacement(
  terms: CashEconomicTerms,
  originatingEventType: string | undefined,
): CashPlacement | null {
  if (terms.assetClass !== "cash") return null;

  // TIER 1 — explicit typed counterpartyClass.
  const explicit = terms.cashTerms?.counterpartyClass;
  if (explicit !== undefined) {
    const mapping = CASH_CLASS_ROW[explicit as FilCashCounterpartyClass];
    if (mapping !== undefined) {
      return {
        mapping,
        tier: "tier1-explicit-class",
        derivedClass: explicit as FilCashCounterpartyClass,
        residualReason: null,
      };
    }
    // An explicit but UNKNOWN class string — fall through to the residual tier
    // (still resolvable as an amount; only the granular class is unrecognised).
  }

  // TIER 2 — DERIVED granular: a settled FX cash leg is a correspondent-bank
  // nostro for an indirect participant. Genuine structural derivation, cited.
  if (isDerivableFxNostro(terms.originatingInstrument, originatingEventType)) {
    return {
      mapping: CASH_CLASS_ROW.bank,
      tier: "tier2-derived-fx-nostro",
      derivedClass: "bank",
      residualReason: null,
    };
  }

  // TIER 3 — RESIDUAL headline + loud flag. Resolvable amount, unclassifiable
  // counterparty. NEVER blank: place on R0120 (in recon range) + flag.
  return {
    mapping: CASH_RESIDUAL_ROW,
    tier: "tier3-residual",
    derivedClass: null,
    residualReason:
      "Settled cash with a resolvable ZAR value but no counterpartyClass and no derivable FX-settlement origin — placed at the resolvable headline (R0120) pending banks-vs-customers sub-allocation. Missing dimension: cashTerms.counterpartyClass (Reg 26).",
  };
}

/** The resolved ZAR magnitude (signed asset stock) of a settled-cash leg, or null. */
function resolveCashSignedAmount(
  terms: CashEconomicTerms,
  functionalCurrency: string,
): ReturnType<typeof toDecimal> | null {
  // Magnitude: zarCostBasis (IAS 21 functional-currency cost — the ZAR value the
  // GL settlement posting carries). Only ZAR (functional currency) amounts.
  const zarBasis = terms.zarCostBasis;
  if (zarBasis === undefined || zarBasis.currency !== functionalCurrency) return null;
  const magnitude = toDecimal(zarBasis.amount);
  // long (received) → positive asset stock; short (paid) → negative.
  return terms.direction === "long" ? magnitude : magnitude.negated();
}

/**
 * One Tier-3 residual settled-cash placement — surfaced as a loud capability
 * flag carrying the ZAR amount + the missing dimension. The headline value is
 * already placed on R0120 by the fold; this records the deferred sub-allocation.
 */
export interface ResidualCashPlacement {
  /** The settled-cash FIL instance URN. */
  readonly instance: string;
  /** The resolved (signed) ZAR carrying amount placed at the headline. */
  readonly zarAmount: string;
  /** The BA 100 row the residual was placed on (the resolvable headline). */
  readonly placedRow: string;
  /** The missing dimension + why it could not be classified granularly. */
  readonly reason: string;
}

/**
 * One no-bookType settled-cash placement — surfaced as a loud capability flag
 * when a settled cash instrument reaches the fold without a `cashTerms.bookType`
 * (the settlement seam did not propagate the FRTB book designation). The ZAR
 * headline amount IS placed on C0040 (Total bank — never dropped); only the
 * C0010/C0020 banking/trading split is deferred. Charter cmd 5: gap flagged
 * immediately, never silently deferred. Authority: D-FX-BOOK-BOUNDARY.
 */
export interface NoBookTypePlacement {
  /** The settled-cash FIL instance URN. */
  readonly instance: string;
  /** The resolved (signed) ZAR carrying amount placed on C0040. */
  readonly zarAmount: string;
  /** The BA 100 row the amount was placed on (C0040 only). */
  readonly placedRow: string;
  /** Why the book split could not be performed (missing dimension + fix hint). */
  readonly reason: string;
}

/**
 * CASH fold pass (FAIL-SAFE rework, D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE;
 * Phase 2 banking/trading book split, D-BA-RETURN-CELL-VALUE-ENGINE) — resolve
 * each settled cash FIL instance and place its ZAR cost basis (the IAS 21 §21
 * functional-currency carrying amount) onto the BA 100 grid through the three
 * fail-SAFE tiers: Tier 1 explicit class; Tier 2 derived FX-nostro "bank"; Tier 3
 * resolvable residual on R0120 + a loud flag. A settled, resolvable amount is
 * NEVER dropped (money on a balance sheet must not disappear).
 *
 * BANKING/TRADING BOOK SPLIT (Phase 2). The column (C0010 / C0020) is read from
 * `cashTerms.bookType` propagated by the settlement seam from the originating FX
 * trade's `bookType` (Approach A: source-don't-hardcode, Charter cmd 4):
 *   "trading"          → C0020 (Trading book; rows R0010–R0530 asset section)
 *   "banking-treasury" → C0010 (Banking book; same rows, same asset section)
 *   absent/unknown     → C0040 only (Total bank; loud ResidualBookPlacement gap)
 * C0040 ALWAYS receives the amount (it is the Total Bank column — the running sum
 * regardless of book split). The C0010/C0020 split is ADDITIVE, not replacing.
 *
 * `residualSink`, when supplied, collects Tier-3 residuals (counterparty class)
 * AND no-book-type gaps. `bookGapSink`, when supplied, collects the no-bookType
 * cash instruments (present on C0040, not yet split). Both are capability flags.
 */
function foldCashLegs(
  ctx: LeafFoldContext,
  provenanceFilter: ProvenanceFilter,
  byCell: Map<string, RowAccumulator>,
  residualSink?: ResidualCashPlacement[],
  bookGapSink?: NoBookTypePlacement[],
): void {
  for (const ev of ctx.eventStore.replay({
    entity: ctx.entity,
    type: "FilInstrumentCreated",
    asOf: ctx.asOf,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

    // The cash fold reads FilInstrumentCreated events (the instrument's initial
    // balance). Termination events carry no economicTerms; the position netdown
    // happens when the replacement events land (the FX settlement reverses via
    // the GL ledger).
    const payload = ev.payload as FilInstrumentCreatedPayload;
    const terms = payload.economicTerms as CashEconomicTerms;
    if (terms.assetClass !== "cash") continue;

    // Resolve the amount FIRST: no resolvable ZAR cost basis ⇒ there is no total
    // to place (this is the genuine absence of a value, not a dropped total —
    // the IAS 21 materialisation fail-closed prevents an FCY item lacking it).
    const signedAmount = resolveCashSignedAmount(terms, ctx.functionalCurrency);
    if (signedAmount === null) continue;

    const originatingEventType = payload.originatingEvent?.eventType;
    const placement = classifyCashPlacement(terms, originatingEventType);
    if (placement === null) continue; // not a cash instrument (already filtered).

    // BANKING/TRADING BOOK SPLIT — read bookType from cashTerms (Phase 2).
    // "trading" → C0020; "banking-treasury" → C0010; absent → no split column.
    // C0040 ALWAYS receives the amount (Total Bank = Σ C0010 + Σ C0020).
    const cashBookType = terms.cashTerms?.bookType;
    const bookColumn: string | null =
      cashBookType === "trading" ? "C0020" : cashBookType === "banking-treasury" ? "C0010" : null; // absent → C0040 only; loud gap emitted below (fail-closed, Charter cmd 2)

    // Primary row — in the 10–530 recon range: counted by the reconciliation
    // oracle (recon:ba100-cell-values-reconcile). CRITICAL placement. Tier 3
    // lands on R0120 too, so the detail reconciles to the oracle TOTAL ASSETS.
    // C0040 is ALWAYS added (Total Bank column — the running Σ regardless of split).
    addToCellCol(byCell, placement.mapping.primary, TOTAL_BANK_COLUMN, signedAmount);
    // Add to the book-specific column when the book designation is known.
    if (bookColumn !== null) {
      addToCellCol(byCell, placement.mapping.primary, bookColumn, signedAmount);
    } else {
      // No book designation — loud gap. The headline amount IS placed on C0040
      // (never dropped — fail-safe); only the C0010/C0020 sub-allocation is
      // deferred. Record the gap for the capability flag (Charter cmd 5).
      if (bookGapSink !== undefined) {
        bookGapSink.push({
          instance: payload.instance,
          zarAmount: decimalToString(signedAmount),
          placedRow: placement.mapping.primary,
          reason:
            "Settled cash instrument has no bookType on cashTerms — " +
            "placed on C0040 (Total bank) only. Banking/trading book split deferred. " +
            "Missing dimension: cashTerms.bookType (D-FX-BOOK-BOUNDARY). " +
            "Ensure the settlement seam propagates bookType from FxTradeExecuted.",
        });
      }
    }

    // Memo rows — outside the 10–530 range: NOT counted by the recon oracle.
    // Memos mirror the same book split as the primary row: a trading-book nostro
    // analysis row belongs in C0020 alongside the primary (the SARB form produces
    // the same book-split schedule on both primary and memo lines). C0040 is
    // always added (Total bank); the book column is added when known.
    for (const memoRow of placement.mapping.memos) {
      addToCellCol(byCell, memoRow, TOTAL_BANK_COLUMN, signedAmount);
      if (bookColumn !== null) {
        addToCellCol(byCell, memoRow, bookColumn, signedAmount);
      }
    }

    // Tier-3 residual — record the loud flag (amount placed, sub-allocation deferred).
    if (placement.tier === "tier3-residual" && residualSink !== undefined) {
      residualSink.push({
        instance: payload.instance,
        zarAmount: decimalToString(signedAmount),
        placedRow: placement.mapping.primary,
        reason: placement.residualReason ?? "unclassified settled cash",
      });
    }
  }
}

/**
 * Collect the Tier-3 RESIDUAL settled-cash placements for the BA 100 capability
 * flag (D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE). Pure read over the same events
 * the leaf fold reads, under the same provenance lens — so the loud flag and the
 * placed headline value cannot drift. Returns the residuals whose amount was
 * placed on the balance sheet but whose banks-vs-customers sub-allocation is
 * deferred (flagged immediately, never hidden).
 */
export function collectBa100ResidualCash(ctx: LeafFoldContext): readonly ResidualCashPlacement[] {
  const provenanceFilter = defaultProvenanceFilter();
  const residuals: ResidualCashPlacement[] = [];
  // A throwaway accumulator — we only want the residual sink here, not the cells.
  foldCashLegs(ctx, provenanceFilter, new Map<string, RowAccumulator>(), residuals);
  return residuals;
}

/**
 * Collect the NO-BOOK-TYPE settled-cash placements for the BA 100 capability
 * flag (Phase 2, D-BA-RETURN-CELL-VALUE-ENGINE). Pure read — one grammar, no
 * drift between the flag and the placed C0040 value. Returns instruments that
 * were placed on C0040 (Total bank) only because `cashTerms.bookType` was absent.
 */
export function collectBa100BookGaps(ctx: LeafFoldContext): readonly NoBookTypePlacement[] {
  const provenanceFilter = defaultProvenanceFilter();
  const gaps: NoBookTypePlacement[] = [];
  foldCashLegs(ctx, provenanceFilter, new Map<string, RowAccumulator>(), undefined, gaps);
  return gaps;
}

/**
 * Read the underlying capital + deposit + loan + cash FIL events for the entity
 * under the active provenance lens, resolve each posting leg / balance, classify
 * it to its BA 100 row, and emit the per-(row, column) leaf cell value as a
 * decimal-native major-unit string. Capital legs classify by CoA account; deposit
 * liability legs by typed depositTerms; loan advances legs by typed loanTerms;
 * cash legs by typed cashTerms (sibling-fold discipline — the dimension is on the
 * event, Principle 1). Authority: D-BA-RETURN-CAPABILITY-FIRST.
 */
export function foldBa100LeafValues(ctx: LeafFoldContext): LeafCellValues {
  const provenanceFilter = defaultProvenanceFilter();
  const byCell = new Map<string, RowAccumulator>();

  foldCapitalLegs(ctx, provenanceFilter, byCell);
  foldDepositLegs(ctx, provenanceFilter, byCell);
  foldLoanLegs(ctx, provenanceFilter, byCell);
  foldCashLegs(ctx, provenanceFilter, byCell);

  const out = new Map<string, string>();
  for (const [key, acc] of byCell) {
    out.set(key, decimalToString(acc.total));
  }
  return out;
}

registerLeafFold("BA100", foldBa100LeafValues);
