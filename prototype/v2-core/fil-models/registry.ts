// v2-core/fil-models/registry.ts
//
// FIL-Models registry — the projection-derived register of model
// implementations keyed by (facet, taxonomy scope, version)
// (D-FIL-FRAMEWORK-UNIFICATION §3).
//
// Rows are FOLDED from `FilModelImplementationDeclared`-class events
// (Principle 1: the register is a query; the events are canonical). This module
// is a PURE FOLD over plain event payloads — it imports NO v1 event store (the
// no-v1-import boundary). A v1-side adapter feeds it the replayed events; in S0
// the register starts EMPTY because no model has been declared yet.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (FIL-Models, §3).
// Author: Atlas (Core banking platform architect, engineering).

import { formatVersion } from "../fil-core/urn";
import {
  type FilModelImplementationDeclared,
  filModelImplementationDeclaredSchema,
  type FilModelRegistryKey,
  registryKeyString,
} from "./declaration";

/** A folded FIL-Models register row — one implementation version. */
export interface FilModelRegistryRow {
  readonly key: FilModelRegistryKey;
  readonly modelId: string;
  readonly implementsFacets: readonly string[];
  readonly scope: readonly string[];
  readonly version: string;
  readonly requires: FilModelImplementationDeclared["requires"];
  readonly emits: readonly string[];
  readonly cites: readonly string[];
  readonly methodologyHash: string;
  readonly validationStatus: FilModelImplementationDeclared["validationStatus"];
}

/** A registry-conflict finding (overlapping scope for same facet+version; §3). */
export interface FilModelRegistryConflict {
  readonly key: string;
  readonly modelIds: readonly string[];
  readonly message: string;
}

export interface FilModelsRegister {
  readonly rows: readonly FilModelRegistryRow[];
  readonly conflicts: readonly FilModelRegistryConflict[];
}

/** The empty register — the S0 steady state (no models declared yet). */
export const EMPTY_FIL_MODELS_REGISTER: FilModelsRegister = Object.freeze({
  rows: [],
  conflicts: [],
});

function rowFrom(decl: FilModelImplementationDeclared): FilModelRegistryRow[] {
  const version = formatVersion(decl.version);
  // One declaration may implement several facets → one registry row per
  // (facet, scope-set, version). Scope is kept as the declared pattern array;
  // the key uses the canonical joined scope for conflict detection.
  const scopeKey = [...decl.scope].sort().join(",");
  return decl.implementsFacets.map((facet) => ({
    key: { facet, scope: scopeKey, version },
    modelId: decl.modelId,
    implementsFacets: decl.implementsFacets,
    scope: decl.scope,
    version,
    requires: decl.requires,
    emits: decl.emits,
    cites: decl.cites,
    methodologyHash: decl.methodologyHash,
    validationStatus: decl.validationStatus,
  }));
}

/**
 * Fold a stream of declaration payloads into the register. Latest declaration
 * per (modelId, facet, scope, version) wins. Overlapping scope for the same
 * (facet, version) across DIFFERENT models is surfaced as a conflict (§3) —
 * the OO rule that a class has one implementation per interface method.
 */
export function foldFilModelsRegister(
  payloads: Iterable<unknown>,
): FilModelsRegister {
  const byKey = new Map<string, FilModelRegistryRow>();
  const ownersByFacetVersion = new Map<string, Map<string, Set<string>>>();

  for (const raw of payloads) {
    const decl = filModelImplementationDeclaredSchema.parse(raw);
    for (const row of rowFrom(decl)) {
      byKey.set(registryKeyString(row.key), row);
      const fv = `${row.key.facet}::${row.version}`;
      const scopeOwners = ownersByFacetVersion.get(fv) ?? new Map<string, Set<string>>();
      const owners = scopeOwners.get(row.key.scope) ?? new Set<string>();
      owners.add(row.modelId);
      scopeOwners.set(row.key.scope, owners);
      ownersByFacetVersion.set(fv, scopeOwners);
    }
  }

  const conflicts: FilModelRegistryConflict[] = [];
  for (const [fv, scopeOwners] of ownersByFacetVersion) {
    for (const [scope, owners] of scopeOwners) {
      if (owners.size > 1) {
        conflicts.push({
          key: `${fv}::${scope}`,
          modelIds: [...owners].sort(),
          message: `multiple models claim facet+version ${fv} over scope ${scope}`,
        });
      }
    }
  }

  return {
    rows: [...byKey.values()].sort((a, b) =>
      registryKeyString(a.key).localeCompare(registryKeyString(b.key)),
    ),
    conflicts,
  };
}
