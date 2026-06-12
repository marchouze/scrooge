// platform/governance/decision-distillation/classifications.test.ts
//
// Dataset invariants: deterministic (sorted by decisionId), unique
// decisionIds, count constants consistent, every rationale non-empty.
//
// Author: Owen (Company Secretary, governance).

import { describe, expect, it } from "bun:test";

import {
  DECISION_CLASSIFICATIONS,
  DECISION_CLASSIFICATION_COUNT,
  DECISION_CLASSIFICATION_COUNTS,
} from "./classifications";

describe("decision-distillation classifications dataset", () => {
  it("matches the snapshot count constant", () => {
    expect(DECISION_CLASSIFICATIONS).toHaveLength(DECISION_CLASSIFICATION_COUNT);
  });

  it("is sorted by decisionId and has no duplicates", () => {
    const ids = DECISION_CLASSIFICATIONS.map((c) => c.decisionId);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("per-class counts add up and match the constants", () => {
    const counts = { foundational: 0, directional: 0, obsolete: 0 };
    for (const c of DECISION_CLASSIFICATIONS) counts[c.class] += 1;
    expect(counts).toEqual({ ...DECISION_CLASSIFICATION_COUNTS });
    expect(counts.foundational + counts.directional + counts.obsolete).toBe(
      DECISION_CLASSIFICATION_COUNT,
    );
  });

  it("every entry carries a substantive rationale", () => {
    for (const c of DECISION_CLASSIFICATIONS) {
      expect(c.rationale.length).toBeGreaterThan(20);
    }
  });
});
