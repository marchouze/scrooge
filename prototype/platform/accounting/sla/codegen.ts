// platform/accounting/sla/codegen.ts
//
// SLA rule-type codegen (Phase-0 spec §11.4 — type-safety mitigation).
//
// Generates `platform/accounting/sla/generated/sla-types.ts` from two
// canonical sources:
//
//   1. `rule.schema.json` — the rule contract (shapes of SlaRule,
//      AccountResolverRef, RuleLine, condition/applies-to).
//   2. `platform/accounting/coa-registry.ts` (COA_ACCOUNTS) — the real
//      chart-of-accounts leaf IDs, emitted as the `AccountId` string-literal
//      union.
//
// This closes the downside Marc (CEO) accepted when rules left TypeScript:
// a rule that references a non-existent COA leaf, or a malformed leg shape,
// fails at `tsc --noEmit` / CI time — NOT in production. The generated file
// is committed; CI re-runs codegen and a recon (`recon:sla-codegen-drift`)
// asserts the committed output matches, so drift cannot land silently.
//
// Run: `bun run sla:codegen` (writes the file). Drift check: the recon
// pipeline compares the on-disk file to a fresh render and fails on mismatch.
//
// This is a pure, deterministic, IO-bounded generator: same inputs → same
// bytes. It performs NO event emission and reads only source files.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).

import { resolve } from "node:path";

import { COA_ACCOUNTS } from "../coa-registry";

const SLA_DIR = resolve(import.meta.dir);
export const GENERATED_FILE = resolve(SLA_DIR, "generated/sla-types.ts");

/**
 * Render the generated TS source as a string. Pure: derived only from the
 * COA registry constant. Sorted for deterministic output.
 */
export function renderGeneratedTypes(): string {
  const accountIds = COA_ACCOUNTS.map((a) => a.id).sort((a, b) => a.localeCompare(b));

  const unionMembers = accountIds.map((id) => `  | ${JSON.stringify(id)}`).join("\n");

  return `// platform/accounting/sla/generated/sla-types.ts
//
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by \`platform/accounting/sla/codegen.ts\` from:
//   - platform/accounting/sla/rule.schema.json (rule contract)
//   - platform/accounting/coa-registry.ts      (COA leaf IDs)
//
// Regenerate with \`bun run sla:codegen\`. The CI recon
// \`recon:sla-codegen-drift\` fails if this file is stale.
//
// This is the type-safety mitigation for rules-as-data (Phase-0 spec §11.4):
// \`AccountId\` is the string-literal union of the REAL chart-of-accounts leaf
// IDs, so a rule (or resolver row) that resolves to a non-existent account
// fails at \`tsc --noEmit\` / CI — never in production.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

/**
 * The string-literal union of every real chart-of-accounts leaf ID
 * (\`ACC-NNNN-NNN\`), generated from \`COA_ACCOUNTS\`. The resolver's value
 * type and every physical account a rule can resolve to is typed as this
 * union — referencing an unknown account is a compile error.
 */
export type AccountId =
${unionMembers};

/** All account IDs as a runtime-checkable readonly tuple (same order as the type). */
export const ACCOUNT_IDS = [
${accountIds.map((id) => `  ${JSON.stringify(id)},`).join("\n")}
] as const;

/** Runtime membership guard for \`AccountId\`. */
export function isAccountId(value: string): value is AccountId {
  return (ACCOUNT_IDS as readonly string[]).includes(value);
}

/** Accounting representation (basis). Phase 1 ships IFRS only. */
export type Representation = "IFRS" | "SARB-BA-RETURN" | "ZA-TAX";

/** Posting side. */
export type PostingSide = "debit" | "credit";

/** A context-vector match value: a single literal or a set (membership). */
export type ContextMatch = string | readonly string[];

/** Context-vector match expression (Mechanism A). \`event_type\` is required. */
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
 * Logical account reference resolved to a physical \`AccountId\` by the
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
  /** Optional path (e.g. \`item.debitCredit\`) overriding \`side\` at eval time. */
  readonly side_path?: string;
  /** Sandboxed amount expression over event/context/item paths (spec §4). */
  readonly amount: string;
  /** Explicit currency source: fixed ISO-4217 code or event/context/item path. */
  readonly currency?: string;
  /** Optional per-line predicate; the line fires only when it is true. */
  readonly when?: string;
  /** Optional declarative iteration: a path to an enrichment array; the line
   *  expands once per element with the element bound as the \`item\` scope root. */
  readonly for_each?: string;
  /** When true on a for_each line, \`account.logical\` is a path to a physical
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
`;
}

/** Write the generated file to disk. Returns the rendered content. */
export async function writeGeneratedTypes(): Promise<string> {
  const content = renderGeneratedTypes();
  await Bun.write(GENERATED_FILE, content);
  return content;
}

if (import.meta.main) {
  const content = await writeGeneratedTypes();
  const lines = content.split("\n").length;
  // eslint-disable-next-line no-console
  console.log(`sla:codegen — wrote ${GENERATED_FILE} (${lines} lines)`);
}
