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
  FilDepositCategory,
  FilDepositCounterpartySector,
} from "../../../v2-core/fil-instances/events";
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

const CAPITAL_FIL_EVENT_TYPES = ["FilInstrumentCreated", "FilInstrumentTerminated"] as const;
const DEPOSIT_FIL_EVENT_TYPES = ["FilInstrumentCreated", "FilInstrumentTerminated"] as const;

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
 * Read the underlying capital + deposit FIL events for the entity under the active
 * provenance lens, resolve each posting leg, classify it to its BA 100 row, and
 * emit the per-(row, C0040) leaf cell value as a decimal-native major-unit string.
 * Capital legs classify by CoA account; deposit liability legs classify by the
 * instance's typed depositTerms (sibling-fold discipline — the dimension is on the
 * event, Principle 1).
 */
export function foldBa100LeafValues(ctx: LeafFoldContext): LeafCellValues {
  const provenanceFilter = defaultProvenanceFilter();
  const byCell = new Map<string, RowAccumulator>();

  foldCapitalLegs(ctx, provenanceFilter, byCell);
  foldDepositLegs(ctx, provenanceFilter, byCell);

  const out = new Map<string, string>();
  for (const [key, acc] of byCell) {
    out.set(key, decimalToString(acc.total));
  }
  return out;
}

registerLeafFold("BA100", foldBa100LeafValues);
