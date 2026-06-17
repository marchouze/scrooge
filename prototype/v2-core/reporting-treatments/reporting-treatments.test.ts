// v2-core/reporting-treatments/reporting-treatments.test.ts
//
// Unit tests for the reporting-treatment menu registry fold + conflict
// detection. Pure, no v1 dependency (the package is self-contained by
// construction).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17).
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";
import {
  EMPTY_REPORTING_TREATMENT_REGISTER,
  findTreatmentById,
  foldReportingTreatmentRegister,
} from "./registry";

// Build declaration payloads as PLAIN objects (the fold parses them through the
// schema). Using `Record<string, unknown>` keeps the test fixtures free of the
// branded `FilScopePattern` type while the fold re-validates fail-closed.
function decl(over: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: "ReportingTreatmentDeclared",
    treatmentId: "ifrs-classification:fx-fvtpl",
    category: "ifrs-classification",
    scope: ["fil:type:fx"],
    version: { major: 1, minor: 0 },
    ifrsCategory: "fvtpl",
    applicablePostingRuleIds: [],
    cites: ["IFRS9-4.1.4"],
    ...over,
  };
}

describe("foldReportingTreatmentRegister", () => {
  it("the empty register is frozen and has no rows or conflicts", () => {
    expect(EMPTY_REPORTING_TREATMENT_REGISTER.rows).toHaveLength(0);
    expect(EMPTY_REPORTING_TREATMENT_REGISTER.conflicts).toHaveLength(0);
    expect(Object.isFrozen(EMPTY_REPORTING_TREATMENT_REGISTER)).toBe(true);
  });

  it("folds an empty payload stream into an empty register", () => {
    const reg = foldReportingTreatmentRegister([]);
    expect(reg.rows).toHaveLength(0);
    expect(reg.conflicts).toHaveLength(0);
  });

  it("folds a clean register with disjoint scopes and detects NO conflict", () => {
    const reg = foldReportingTreatmentRegister([
      decl({ treatmentId: "ifrs-classification:fx-fvtpl", scope: ["fil:type:fx"] }),
      decl({ treatmentId: "ifrs-classification:ir-amc", scope: ["fil:type:ir"] }),
      decl({
        treatmentId: "posting-rules:fx-spot",
        category: "posting-rules",
        scope: ["fil:type:fx:spot"],
        ifrsCategory: undefined,
        applicablePostingRuleIds: ["PR-FX-001-V2", "PR-FX-REVAL-V2"],
      }),
    ]);
    expect(reg.rows).toHaveLength(3);
    expect(reg.conflicts).toHaveLength(0);

    const postingRow = reg.rows.find((r) => r.treatmentId === "posting-rules:fx-spot");
    expect(postingRow?.applicablePostingRuleIds).toEqual(["PR-FX-001-V2", "PR-FX-REVAL-V2"]);

    const fxRow = reg.rows.find((r) => r.treatmentId === "ifrs-classification:fx-fvtpl");
    expect(fxRow?.ifrsCategory).toBe("fvtpl");
  });

  it("detects a conflict: two modules, same category+version, overlapping scope", () => {
    const reg = foldReportingTreatmentRegister([
      decl({ treatmentId: "ifrs-classification:fx-fvtpl", scope: ["fil:type:fx"] }),
      decl({
        treatmentId: "ifrs-classification:fx-fvoci",
        scope: ["fil:type:fx"],
        ifrsCategory: "fvoci",
      }),
    ]);
    // Two rows folded (distinct treatmentIds), but the (category, scope, version)
    // is claimed by two different modules → exactly one conflict.
    expect(reg.conflicts).toHaveLength(1);
    const conflict = reg.conflicts[0];
    if (conflict === undefined) throw new Error("expected one conflict");
    expect(conflict.treatmentIds).toEqual([
      "ifrs-classification:fx-fvoci",
      "ifrs-classification:fx-fvtpl",
    ]);
    expect(conflict.message).toContain("ifrs-classification::1.0");
  });

  it("does NOT flag a conflict for the same category+scope at DIFFERENT versions", () => {
    const reg = foldReportingTreatmentRegister([
      decl({
        treatmentId: "ifrs-classification:fx-fvtpl",
        scope: ["fil:type:fx"],
        version: { major: 1, minor: 0 },
      }),
      decl({
        treatmentId: "ifrs-classification:fx-fvtpl-v2",
        scope: ["fil:type:fx"],
        version: { major: 2, minor: 0 },
      }),
    ]);
    expect(reg.conflicts).toHaveLength(0);
  });

  it("treats scope as order-insensitive (sorted canonical key)", () => {
    const reg = foldReportingTreatmentRegister([
      decl({ treatmentId: "a", scope: ["fil:type:fx", "fil:type:ir"] }),
      decl({ treatmentId: "b", scope: ["fil:type:ir", "fil:type:fx"], ifrsCategory: "fvoci" }),
    ]);
    expect(reg.conflicts).toHaveLength(1);
  });

  it("a malformed declaration throws inside the fold (fail-closed)", () => {
    // cites must be ≥1; an empty cites array fails the schema.
    expect(() => foldReportingTreatmentRegister([decl({ cites: [] })])).toThrow();
  });

  it("rejects an invalid scope pattern (fail-closed)", () => {
    expect(() => foldReportingTreatmentRegister([decl({ scope: ["not-a-scope"] })])).toThrow();
  });
});

describe("findTreatmentById", () => {
  it("returns undefined for an unknown id", () => {
    const reg = foldReportingTreatmentRegister([decl({})]);
    expect(findTreatmentById(reg, "does-not-exist")).toBeUndefined();
  });

  it("finds a module by id and returns the latest version", () => {
    const reg = foldReportingTreatmentRegister([
      decl({ treatmentId: "ifrs-classification:fx-fvtpl", version: { major: 1, minor: 0 } }),
      decl({ treatmentId: "ifrs-classification:fx-fvtpl", version: { major: 1, minor: 3 } }),
    ]);
    const row = findTreatmentById(reg, "ifrs-classification:fx-fvtpl");
    expect(row?.version).toBe("1.3");
  });
});
