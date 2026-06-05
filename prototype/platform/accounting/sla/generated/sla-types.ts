// platform/accounting/sla/generated/sla-types.ts
//
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by `platform/accounting/sla/codegen.ts` from:
//   - platform/accounting/sla/rule.schema.json (rule contract)
//   - platform/accounting/coa-registry.ts      (COA leaf IDs)
//
// Regenerate with `bun run sla:codegen`. The CI recon
// `recon:sla-codegen-drift` fails if this file is stale.
//
// This is the type-safety mitigation for rules-as-data (Phase-0 spec §11.4):
// `AccountId` is the string-literal union of the REAL chart-of-accounts leaf
// IDs, so a rule (or resolver row) that resolves to a non-existent account
// fails at `tsc --noEmit` / CI — never in production.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

/**
 * The string-literal union of every real chart-of-accounts leaf ID
 * (`ACC-NNNN-NNN`), generated from `COA_ACCOUNTS`. The resolver's value
 * type and every physical account a rule can resolve to is typed as this
 * union — referencing an unknown account is a compile error.
 */
export type AccountId =
  | "ACC-1000-001"
  | "ACC-1100-001"
  | "ACC-1100-002"
  | "ACC-1100-003"
  | "ACC-1100-004"
  | "ACC-1100-005"
  | "ACC-1200-001"
  | "ACC-1200-002"
  | "ACC-1200-003"
  | "ACC-2100-001"
  | "ACC-2100-002"
  | "ACC-2100-003"
  | "ACC-2100-004"
  | "ACC-2100-005"
  | "ACC-2100-006"
  | "ACC-2100-007"
  | "ACC-2100-010"
  | "ACC-2100-011"
  | "ACC-2100-012"
  | "ACC-2100-013"
  | "ACC-2100-014"
  | "ACC-2100-015"
  | "ACC-2100-016"
  | "ACC-2100-017"
  | "ACC-2100-018"
  | "ACC-2100-019"
  | "ACC-2100-020"
  | "ACC-2100-021"
  | "ACC-2100-022"
  | "ACC-2100-023"
  | "ACC-2100-024"
  | "ACC-2200-001"
  | "ACC-2200-002"
  | "ACC-2300-001"
  | "ACC-2300-002"
  | "ACC-2300-003"
  | "ACC-2300-004"
  | "ACC-2400-001"
  | "ACC-2400-002"
  | "ACC-3100-001"
  | "ACC-3100-002"
  | "ACC-3100-003"
  | "ACC-3100-004"
  | "ACC-3100-005"
  | "ACC-3100-006"
  | "ACC-3200-001"
  | "ACC-3200-002"
  | "ACC-3200-003"
  | "ACC-3200-004"
  | "ACC-3200-005"
  | "ACC-3200-006"
  | "ACC-3200-007"
  | "ACC-3300-001"
  | "ACC-3300-002"
  | "ACC-3300-003"
  | "ACC-4100-001"
  | "ACC-4100-002"
  | "ACC-4101-001"
  | "ACC-5000-001"
  | "ACC-5000-002"
  | "ACC-5200-001"
  | "ACC-5200-002";

/** All account IDs as a runtime-checkable readonly tuple (same order as the type). */
export const ACCOUNT_IDS = [
  "ACC-1000-001",
  "ACC-1100-001",
  "ACC-1100-002",
  "ACC-1100-003",
  "ACC-1100-004",
  "ACC-1100-005",
  "ACC-1200-001",
  "ACC-1200-002",
  "ACC-1200-003",
  "ACC-2100-001",
  "ACC-2100-002",
  "ACC-2100-003",
  "ACC-2100-004",
  "ACC-2100-005",
  "ACC-2100-006",
  "ACC-2100-007",
  "ACC-2100-010",
  "ACC-2100-011",
  "ACC-2100-012",
  "ACC-2100-013",
  "ACC-2100-014",
  "ACC-2100-015",
  "ACC-2100-016",
  "ACC-2100-017",
  "ACC-2100-018",
  "ACC-2100-019",
  "ACC-2100-020",
  "ACC-2100-021",
  "ACC-2100-022",
  "ACC-2100-023",
  "ACC-2100-024",
  "ACC-2200-001",
  "ACC-2200-002",
  "ACC-2300-001",
  "ACC-2300-002",
  "ACC-2300-003",
  "ACC-2300-004",
  "ACC-2400-001",
  "ACC-2400-002",
  "ACC-3100-001",
  "ACC-3100-002",
  "ACC-3100-003",
  "ACC-3100-004",
  "ACC-3100-005",
  "ACC-3100-006",
  "ACC-3200-001",
  "ACC-3200-002",
  "ACC-3200-003",
  "ACC-3200-004",
  "ACC-3200-005",
  "ACC-3200-006",
  "ACC-3200-007",
  "ACC-3300-001",
  "ACC-3300-002",
  "ACC-3300-003",
  "ACC-4100-001",
  "ACC-4100-002",
  "ACC-4101-001",
  "ACC-5000-001",
  "ACC-5000-002",
  "ACC-5200-001",
  "ACC-5200-002",
] as const;

/** Runtime membership guard for `AccountId`. */
export function isAccountId(value: string): value is AccountId {
  return (ACCOUNT_IDS as readonly string[]).includes(value);
}

/** Accounting representation (basis). Phase 1 ships IFRS only. */
export type Representation = "IFRS" | "SARB-BA-RETURN" | "ZA-TAX";

/** Posting side. */
export type PostingSide = "debit" | "credit";

/** A context-vector match value: a single literal or a set (membership). */
export type ContextMatch = string | readonly string[];

/** Context-vector match expression (Mechanism A). `event_type` is required. */
export interface AppliesTo {
  readonly event_type: string;
  readonly instrument_type?: ContextMatch;
  readonly entity?: ContextMatch;
  readonly jurisdiction?: ContextMatch;
  readonly regulatory_regime?: ContextMatch;
  readonly product_variant?: ContextMatch;
  readonly counterparty_classification?: ContextMatch;
}

/** When a posting is expected (ported from the legacy registry conditions). */
export interface RuleCondition {
  readonly kind: "always" | "non-zero-delta" | "non-zero-pnl" | "intentional-no-impact";
  readonly detail?: string;
  /** Event/context path gating non-zero-delta / non-zero-pnl conditions. */
  readonly delta_path?: string;
}

/**
 * Logical account reference resolved to a physical `AccountId` by the
 * resolver (spec §5), keyed on the context vector + representation + currency.
 */
export interface AccountResolverRef {
  readonly logical: string;
  /** Product key override for resolution; defaults to the matched instrument_type. */
  readonly product?: string;
  /** Currency source: a fixed ISO-4217 code or an event/context path. */
  readonly currency?: string;
}

/** A single journal-template line. */
export interface RuleLine {
  readonly account: AccountResolverRef;
  readonly side: PostingSide;
  /** Optional path (e.g. `item.debitCredit`) overriding `side` at eval time. */
  readonly side_path?: string;
  /** Sandboxed amount expression over event/context/item paths (spec §4). */
  readonly amount: string;
  /** Explicit currency source: fixed ISO-4217 code or event/context/item path. */
  readonly currency?: string;
  /** Optional per-line predicate; the line fires only when it is true. */
  readonly when?: string;
  /** Optional declarative iteration: a path to an enrichment array; the line
   *  expands once per element with the element bound as the `item` scope root. */
  readonly for_each?: string;
  /** When true on a for_each line, `account.logical` is a path to a physical
   *  ACC-id, bypassing the logical→physical resolver. */
  readonly use_physical_account?: boolean;
}

/** A complete rules-as-data posting rule (spec §3). */
export interface SlaRule {
  readonly rule_id: string;
  readonly representation: Representation;
  readonly version: number;
  readonly effective_from: string;
  readonly effective_to?: string | null;
  readonly applies_to: AppliesTo;
  readonly condition: RuleCondition;
  readonly lines: readonly RuleLine[];
  readonly balancing: "assert_zero";
  readonly cites: readonly string[];
  readonly supersedes?: string;
  readonly notes?: string;
}
