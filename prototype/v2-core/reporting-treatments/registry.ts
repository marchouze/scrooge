// v2-core/reporting-treatments/registry.ts
//
// Reporting-treatment registry — the projection-derived register of treatment
// modules keyed by (category, taxonomy scope, version), modelled on the
// FIL-Models registry (`v2-core/fil-models/registry.ts`).
//
// Rows are FOLDED from `ReportingTreatmentDeclared`-class events (Principle 1:
// the register is a query; the events are canonical). This module is a PURE FOLD
// over plain event payloads — it imports NO v1 event store (the no-v1-import
// boundary). A v1-side adapter feeds it the replayed events.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17).
// Author: Atlas (Substrate Architect, engineering).

import { formatVersion } from "../fil-core/urn";
import {
  type ReportingTreatmentDeclared,
  type ReportingTreatmentRegistryKey,
  reportingTreatmentDeclaredSchema,
  treatmentRegistryKeyString,
} from "./declaration";

/** A folded reporting-treatment register row — one module version. */
export interface ReportingTreatmentRegistryRow {
  readonly key: ReportingTreatmentRegistryKey;
  readonly treatmentId: string;
  readonly category: ReportingTreatmentDeclared["category"];
  readonly scope: readonly string[];
  readonly version: string;
  readonly ifrsCategory?: ReportingTreatmentDeclared["ifrsCategory"];
  readonly fairValueHierarchy?: ReportingTreatmentDeclared["fairValueHierarchy"];
  readonly businessModel?: ReportingTreatmentDeclared["businessModel"];
  readonly prudential?: ReportingTreatmentDeclared["prudential"];
  readonly tax?: ReportingTreatmentDeclared["tax"];
  readonly applicablePostingRuleIds: readonly string[];
  readonly cites: readonly string[];
}

/** A registry-conflict finding (overlapping scope for same category+version). */
export interface ReportingTreatmentRegistryConflict {
  readonly key: string;
  readonly treatmentIds: readonly string[];
  readonly message: string;
}

export interface ReportingTreatmentRegister {
  readonly rows: readonly ReportingTreatmentRegistryRow[];
  readonly conflicts: readonly ReportingTreatmentRegistryConflict[];
}

/** The empty register — the steady state before any module is declared. */
export const EMPTY_REPORTING_TREATMENT_REGISTER: ReportingTreatmentRegister = Object.freeze({
  rows: [],
  conflicts: [],
});

function rowFrom(decl: ReportingTreatmentDeclared): ReportingTreatmentRegistryRow {
  const version = formatVersion(decl.version);
  // Scope is kept as the declared pattern array; the key uses the canonical
  // joined scope for conflict detection (sorted so order is not significant).
  const scopeKey = [...decl.scope].sort().join(",");
  return {
    key: { category: decl.category, scope: scopeKey, version },
    treatmentId: decl.treatmentId,
    category: decl.category,
    scope: decl.scope,
    version,
    ifrsCategory: decl.ifrsCategory,
    fairValueHierarchy: decl.fairValueHierarchy,
    businessModel: decl.businessModel,
    prudential: decl.prudential,
    tax: decl.tax,
    applicablePostingRuleIds: decl.applicablePostingRuleIds,
    cites: decl.cites,
  };
}

/**
 * Fold a stream of declaration payloads into the register. Latest declaration
 * per (treatmentId, category, scope, version) wins. Overlapping scope for the
 * same (category, version) across DIFFERENT modules is surfaced as a conflict —
 * the OO rule that one treatment dimension has one authoritative module per
 * scope+version (mirrored from FIL-Models §3).
 */
export function foldReportingTreatmentRegister(
  payloads: Iterable<unknown>,
): ReportingTreatmentRegister {
  const byKey = new Map<string, ReportingTreatmentRegistryRow>();
  // (category::version) → scope → set-of-treatmentIds claiming it.
  const ownersByCategoryVersion = new Map<string, Map<string, Set<string>>>();

  for (const raw of payloads) {
    const decl = reportingTreatmentDeclaredSchema.parse(raw);
    const row = rowFrom(decl);
    byKey.set(treatmentRegistryKeyString(row.key), row);
    const cv = `${row.key.category}::${row.version}`;
    const scopeOwners = ownersByCategoryVersion.get(cv) ?? new Map<string, Set<string>>();
    const owners = scopeOwners.get(row.key.scope) ?? new Set<string>();
    owners.add(row.treatmentId);
    scopeOwners.set(row.key.scope, owners);
    ownersByCategoryVersion.set(cv, scopeOwners);
  }

  const conflicts: ReportingTreatmentRegistryConflict[] = [];
  for (const [cv, scopeOwners] of ownersByCategoryVersion) {
    for (const [scope, owners] of scopeOwners) {
      if (owners.size > 1) {
        conflicts.push({
          key: `${cv}::${scope}`,
          treatmentIds: [...owners].sort(),
          message: `multiple treatment modules claim category+version ${cv} over scope ${scope}`,
        });
      }
    }
  }

  return {
    rows: [...byKey.values()].sort((a, b) =>
      treatmentRegistryKeyString(a.key).localeCompare(treatmentRegistryKeyString(b.key)),
    ),
    conflicts,
  };
}

/** Look up a single module row by its stable `treatmentId` (latest version wins). */
export function findTreatmentById(
  register: ReportingTreatmentRegister,
  treatmentId: string,
): ReportingTreatmentRegistryRow | undefined {
  const matches = register.rows.filter((r) => r.treatmentId === treatmentId);
  if (matches.length === 0) return undefined;
  // Latest version wins (rows are sorted by key string; version is the trailing
  // segment, so sort the matches by version descending explicitly).
  return [...matches].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
}
