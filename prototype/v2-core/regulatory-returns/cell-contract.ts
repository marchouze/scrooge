// v2-core/regulatory-returns/cell-contract.ts
//
// THE FRAMEWORK — a Zod-typed, per-cell data-requirement contract for SARB
// BA-return forms, reusable across ALL ~27 returns. BA 100 (Balance Sheet) is
// the pilot instance (`ba100-contract.ts`); the remaining returns are authored
// against THIS schema.
//
// WHAT PROBLEM THIS SOLVES (Marc's goal)
// --------------------------------------
//   "Define the data requirements for every cell in every return, fully, so a
//    product (when created) or other functions can know what information it
//    needs to have available for the return(s) to be populated."
//
// Each return form is a grid of cells. Every cell has a regulatory meaning, a
// value type, a derivation, and — crucially — a set of DATA REQUIREMENTS: the
// product attributes, event fields, GL accounts, projections or reference data
// that must exist for the cell to be populated. The inverse of that set
// (`product → cells fed → data to capture`) is what the New-Product-Approval
// (NPA) process consumes so a new product is gated on capturing the data its
// return cells need (see `inverse-index.ts`, L3).
//
// PRINCIPLE BINDINGS
// ------------------
//   P1 (events-are-truth): this contract is REFERENCE DATA (Plane A) — it
//      describes WHAT data a cell needs and HOW it is derived; it NEVER stores
//      a cell VALUE. Cell values are projections folded from events at
//      report-generation time (L1 procedure). No money lives in this file.
//   P2 (single-graph): every cell carries `citations[]` upward to its
//      obligation id + regulation/Basel clause. No orphan cell. The recon gate
//      (`recon:ba-return-cell-contract`) asserts every citation resolves.
//   P5 (multi-currency): a monetary cell declares its `currencyDimension`
//      (functional | by-currency | reporting). ZAR is NEVER hard-coded as the
//      cell currency — it is the bank's functional/reporting currency by
//      configuration, expressed through the dimension, not baked in.
//
// HONEST GAPS (Engineering Charter cmd 3 + 5 — no green by concealment, no
// silent deferral): a cell whose regulatory definition is counsel-gated, or
// whose data is only real at licence-day, carries an explicit `status` other
// than `sourced` plus a `statusReason`. Cells are NEVER fabricated, zero-
// filled, or omitted. Completeness is machine-checked: a contract entry for
// EVERY cell in the form's XSD.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation), Phase B. Builds on Phase A numbering remediation (PR #1451).
// Citations: ORG-PR-RETURNS-002 (BA 100 Balance Sheet obligation); SARB PA
//   Directive D5/2025 §2.1.3; Regulations relating to Banks; the canonical
//   register `Regulations/SARB-PA/ba-returns/_canonical-register.md`.
// Author: Bea (Accounting and financial reporting engineer, engineering —
//   reports to Camille (Chief Financial Officer)).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Canonical form identity.
// ---------------------------------------------------------------------------

/**
 * Canonical SARB BA-return form numbers (Excel A1 names — the authoritative
 * schedule per `_canonical-register.md` §1). The contract is keyed by this so
 * a mis-numbered form (the fabricated-scheme hazard `recon:ba-form-numbering`
 * guards) cannot enter the contract.
 */
export const ReturnFormSchema = z.enum([
  "BA100", // Balance Sheet
  "BA110", // Off-Balance-Sheet Activities
  "BA120", // Income Statement
  "BA125", // Return regarding shareholders
  "BA130", // Restriction on investments, loans and advances
  "BA200", // Credit Risk
  "BA210", // Credit Concentration Risk / Large Exposures (LEX)
  "BA220", // Credit Risk: Assets bought-in
  "BA300", // Liquidity Risk (incl. LCR)
  "BA310", // Minimum Liquid Reserve Balance and Liquid Assets (HQLA)
  "BA320", // Market Risk
  "BA325", // Selected Risk Exposure Arising from Trading and Treasury Activities
  "BA330", // Interest Rate Risk: Banking Book (IRRBB)
  "BA340", // Equity Risk in the Banking Book
  "BA350", // Derivatives Instruments
  "BA400", // Operational Risk
  "BA410", // Operational Risk: Quarterly Losses
  "BA420", // 12-Months Rolling Losses
  "BA500", // Securitisation Schemes
  "BA501", // Special-purpose institutions schemes
  "BA600", // Consolidated Return
  "BA610", // Foreign Operations of South African Banks
  "BA700", // Capital Adequacy and Leverage and TLAC
  "BA701", // Regulatory vs Economic Capital
  "BA900", // Economic statistics — DI returns
  "BA920", // Analysis of instalment-sale credit, leasing finance
  "BA930", // Weighted-average interest rates on loans and deposits
]);
export type ReturnForm = z.infer<typeof ReturnFormSchema>;

// ---------------------------------------------------------------------------
// Cell identity — the XSD/xlsx coordinate.
// ---------------------------------------------------------------------------

/**
 * The cell's coordinate identity. For BA 100 this is the (row, column) grid
 * coordinate from the SARB Excel form plus the XSD element name (the
 * `BAxxxxxxxx` 8-digit code that carries the cell in the upload schema). For
 * form-level meta cells (FirmID, ReportingEndDate, ...) the grid coordinates
 * are absent and `xsdElement` carries the element name.
 */
export const CellRefSchema = z.object({
  /** The XSD element name — the upload-schema identity (e.g. "BA01000002"). */
  xsdElement: z.string().min(1),
  /** Grid row coordinate (e.g. "R0010"). Absent for meta cells. */
  row: z
    .string()
    .regex(/^R\d{4}$/)
    .optional(),
  /** Official line-item label for the row (xlsx "Row Description"). */
  rowLabel: z.string().optional(),
  /** Grid column coordinate (e.g. "C0030"). Absent for meta cells. */
  column: z
    .string()
    .regex(/^C\d{4}$/)
    .optional(),
  /** Official column label (xlsx "Column Description", e.g. "Banking"). */
  columnLabel: z.string().optional(),
});
export type CellRef = z.infer<typeof CellRefSchema>;

// ---------------------------------------------------------------------------
// Value typing + currency dimension (P5).
// ---------------------------------------------------------------------------

export const ValueTypeSchema = z.enum([
  "money", // a monetary amount (carries currencyDimension)
  "ratio", // a percentage / ratio
  "count", // an integer count
  "date", // a date value
  "text", // free text
  "enum", // a constrained code/category
  "hashtotal", // a control hash-total over a cell range (form integrity)
]);
export type ValueType = z.infer<typeof ValueTypeSchema>;

/**
 * P5 currency dimension for a monetary cell. NEVER a hard-coded currency.
 *   - functional: reported in the bank's functional currency (ZAR by config,
 *     not by literal) — the BA 100 default; SARB returns are functional-ZAR.
 *   - by-currency: the cell is reported per-currency (a currency-analysis cell).
 *   - reporting: reported in the group reporting currency (presentation axis).
 */
export const CurrencyDimensionSchema = z.enum(["functional", "by-currency", "reporting"]);
export type CurrencyDimension = z.infer<typeof CurrencyDimensionSchema>;

// ---------------------------------------------------------------------------
// Derivation — how the cell value is computed.
// ---------------------------------------------------------------------------

export const DerivationKindSchema = z.enum([
  "direct", // a directly-captured / directly-folded value (leaf input)
  "sum", // a sum over other cells / GL accounts
  "formula", // an arithmetic expression over other cells (cellA − cellB, ...)
  "lookup", // a value looked up from reference data
  "constant", // a fixed reference constant (e.g. a regulatory factor)
]);
export type DerivationKind = z.infer<typeof DerivationKindSchema>;

export const DerivationSchema = z.object({
  kind: DerivationKindSchema,
  /**
   * Human-readable derivation expression. For `sum`/`formula` this is the
   * cell-coordinate expression transcribed verbatim from the SARB Excel form's
   * "Calculation Definition" column (e.g. "[BA100,R0020,C0010]+[BA100,R0050,
   * C0010]"). For `direct` it names the source fold. Empty only for leaf
   * inputs with no in-form expression.
   */
  expression: z.string(),
});
export type Derivation = z.infer<typeof DerivationSchema>;

// ---------------------------------------------------------------------------
// Data requirements — THE HEART.
// ---------------------------------------------------------------------------

/**
 * Where a piece of cell-feeding data comes from. This is the vocabulary the
 * inverse index (L3) walks to answer "what must a product capture?".
 *   - product-attribute: an attribute a product definition must carry
 *     (e.g. `prd:bank:treasury:mmd-deposit` → counterparty-sector).
 *   - event-field: a field on a domain event (e.g. DepositTaken.amount).
 *   - gl-account: a chart-of-accounts account whose balance folds into the cell
 *     (e.g. ACC-1000-001 Bank).
 *   - projection: a derived register/projection that supplies the value
 *     (e.g. the GL trial-balance fold, the ALM positions register).
 *   - reference-data: static reference data (CoA category mapping, party
 *     register, currency table).
 *   - counsel-TBC: the precise source is counsel-gated and not yet resolvable
 *     (an honest gap; pairs with cell status counsel-gated-TBC).
 */
export const SourceKindSchema = z.enum([
  "product-attribute",
  "event-field",
  "gl-account",
  "projection",
  "reference-data",
  "counsel-TBC",
]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const DataRequirementSchema = z.object({
  sourceKind: SourceKindSchema,
  /**
   * The concrete reference into the named source kind. For `gl-account` this
   * is an `ACC-xxxx-xxx` id; for `product-attribute` a `prd:...` id + attr; for
   * `event-field` an `EventType.field`; for `projection` the projection name;
   * for `reference-data` the dataset name; for `counsel-TBC` a placeholder
   * marker.
   */
  ref: z.string().min(1),
  /** Plain-language description of what this datum is and why the cell needs it. */
  description: z.string().min(1),
  /** Whether the cell cannot be populated at all without this datum. */
  required: z.boolean(),
});
export type DataRequirement = z.infer<typeof DataRequirementSchema>;

// ---------------------------------------------------------------------------
// Applicability — when is the cell in scope.
// ---------------------------------------------------------------------------

/**
 * A coarse applicability predicate. The contract is authored at the bank
 * (LE-BANK-SA) entity scope; these axes let a cell be narrowed (e.g. a
 * consolidation-only column applies only when consolidated subsidiaries exist).
 */
export const ApplicabilitySchema = z.object({
  /** Entity scope the cell applies to (e.g. "bank", "consolidated"). */
  entityScope: z.enum(["bank", "consolidated", "controlling-company", "foreign-branch"]),
  /** Jurisdiction the cell applies to (ISO-3166 alpha-2; "ZA" for SARB returns). */
  jurisdiction: z.string().regex(/^[A-Z]{2}$/),
  /**
   * Product scope: "universal" if the cell aggregates across all products, or
   * a list of product-family prefixes the cell is fed by (e.g. ["deposit",
   * "loan"]). Informational — the authoritative product linkage is via
   * dataRequirements `product-attribute` refs.
   */
  productScope: z.union([z.literal("universal"), z.array(z.string().min(1))]),
});
export type Applicability = z.infer<typeof ApplicabilitySchema>;

// ---------------------------------------------------------------------------
// Cell status — honest gaps.
// ---------------------------------------------------------------------------

/**
 *   - sourced: every required dataRequirement points to a real existing source
 *     (a GL account / event type / product / projection that exists). The cell
 *     can be populated from the bank's current substrate (once data lands).
 *   - counsel-gated-TBC: the cell's regulatory definition or its precise source
 *     mapping is counsel-gated and not yet resolvable. Carries ≥1 counsel-TBC
 *     dataRequirement and a statusReason.
 *   - licence-day-data: the cell is fully defined and sourced, but the DATA
 *     that fills it only exists at licence-day (no real positions/customers in
 *     the build phase). statusReason names the licence-day dependency.
 */
export const CellStatusSchema = z.enum(["sourced", "counsel-gated-TBC", "licence-day-data"]);
export type CellStatus = z.infer<typeof CellStatusSchema>;

// ---------------------------------------------------------------------------
// The cell-contract entry — one per form cell.
// ---------------------------------------------------------------------------

export const CitationSchema = z.object({
  /** The adopted-obligation id this cell traces to (P2 upward link). */
  obligationId: z.string().min(1),
  /** The regulation / Basel clause text (verbatim or precise reference). */
  clause: z.string().min(1),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ReturnCellContractSchema = z
  .object({
    returnForm: ReturnFormSchema,
    cellRef: CellRefSchema,
    /** Official cell label (line + column composed, human-readable). */
    label: z.string().min(1),
    /** What the cell means — its regulatory definition (verbatim from the XSD). */
    regulatoryDefinition: z.string().min(1),
    citations: z.array(CitationSchema).min(1), // P2 — no orphan cell.
    valueType: ValueTypeSchema,
    /** Present iff valueType === "money". P5 — never a hard-coded currency. */
    currencyDimension: CurrencyDimensionSchema.optional(),
    /** Reporting unit (e.g. "ZAR-thousands" for Monetary1000 cells, "ratio"). */
    unit: z.string().min(1),
    derivation: DerivationSchema,
    dataRequirements: z.array(DataRequirementSchema), // may be empty for pure subtotals fed by other cells
    applicability: ApplicabilitySchema,
    status: CellStatusSchema,
    /** Required when status !== "sourced". The honest reason for the gap. */
    statusReason: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    // Monetary cells MUST declare a currency dimension (P5).
    if (c.valueType === "money" && c.currencyDimension === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `money cell ${c.cellRef.xsdElement} must declare currencyDimension (P5)`,
        path: ["currencyDimension"],
      });
    }
    // Non-money cells MUST NOT declare a currency dimension.
    if (c.valueType !== "money" && c.currencyDimension !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `non-money cell ${c.cellRef.xsdElement} must not declare currencyDimension`,
        path: ["currencyDimension"],
      });
    }
    // Non-sourced cells MUST carry an honest reason (no silent gaps; cmd 5).
    if (c.status !== "sourced" && (c.statusReason === undefined || c.statusReason.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `cell ${c.cellRef.xsdElement} with status ${c.status} must carry a statusReason`,
        path: ["statusReason"],
      });
    }
    // counsel-gated-TBC cells MUST carry ≥1 counsel-TBC dataRequirement.
    if (
      c.status === "counsel-gated-TBC" &&
      !c.dataRequirements.some((d) => d.sourceKind === "counsel-TBC")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `counsel-gated cell ${c.cellRef.xsdElement} must carry a counsel-TBC dataRequirement`,
        path: ["dataRequirements"],
      });
    }
  });
export type ReturnCellContract = z.infer<typeof ReturnCellContractSchema>;

// ---------------------------------------------------------------------------
// A whole-form contract — the set of cell contracts for one return.
// ---------------------------------------------------------------------------

export const ReturnContractSchema = z.object({
  returnForm: ReturnFormSchema,
  /** Official form name (Excel A1). */
  formName: z.string().min(1),
  /** The obligation that mandates this return (the form-level P2 anchor). */
  obligationId: z.string().min(1),
  /** Provenance of the cell set — the XSD/xlsx the contract was sourced from. */
  schemaSource: z.string().min(1),
  cells: z.array(ReturnCellContractSchema),
});
export type ReturnContract = z.infer<typeof ReturnContractSchema>;

/**
 * Parse + validate a whole-form contract. Throws (fail-closed, Charter cmd 2)
 * on any schema violation — the contract is never half-valid.
 */
export function parseReturnContract(raw: unknown): ReturnContract {
  return ReturnContractSchema.parse(raw);
}
