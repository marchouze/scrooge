// v2-core/applicability/applicability.test.ts
//
// Unit tests for the V2 S8 applicability-assessment lifecycle: the pure engine
// (assessApplicability / deriveVerdict), the register projection (fold +
// queries + orphan-violation surfacing), and the event payload schemas.
//
// Pure, no v1 dependency (the v2-core package is self-contained by construction).
//
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { describe, expect, it } from "bun:test";
import type { AppliesToScope } from "../posture";
import {
  type AssessedContext,
  applicabilityAssessmentConcludedPayloadSchema,
  applicabilityAssessmentRequestedPayloadSchema,
  assessApplicability,
  deriveVerdict,
  emptyAssessmentRegister,
  foldAssessmentRegister,
} from "./index";

// FX-VaR posture scope: ZA ∧ RT-MK ∧ fil:type:fx:* (matches S3 seed).
const FX_VAR_SCOPE: AppliesToScope = {
  kind: "and",
  conditions: [
    { kind: "jurisdiction", jurisdiction: "ZA" },
    { kind: "risk-class", riskClass: "RT-MK" },
    { kind: "product-scope", filTaxonomyScope: "fil:type:fx:*" },
  ],
};

const FX_CTX: AssessedContext = {
  contextRef: "product:fx",
  context: {
    jurisdiction: "ZA",
    riskClass: "RT-MK",
    filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
  },
};
const IRS_CTX: AssessedContext = {
  contextRef: "product:irs",
  context: {
    jurisdiction: "ZA",
    riskClass: "RT-MK",
    filTaxonomyScope: "fil:type:ir:swap.vanilla:zar-jibar@1.0",
  },
};
const BOND_CTX: AssessedContext = {
  contextRef: "product:bond",
  context: {
    jurisdiction: "ZA",
    riskClass: "RT-MK",
    filTaxonomyScope: "fil:type:ir:bond.govt:sagb@1.0",
  },
};

describe("deriveVerdict", () => {
  it("all matched → applies", () => {
    expect(deriveVerdict(3, 3)).toBe("applies");
  });
  it("none matched → does-not-apply", () => {
    expect(deriveVerdict(0, 3)).toBe("does-not-apply");
  });
  it("some matched → partially-applies", () => {
    expect(deriveVerdict(1, 3)).toBe("partially-applies");
  });
  it("empty candidate set → does-not-apply (vacuous)", () => {
    expect(deriveVerdict(0, 0)).toBe("does-not-apply");
  });
});

describe("assessApplicability", () => {
  it("FX-VaR posture partially applies to {FX, IRS, bond} — only FX binds", () => {
    const r = assessApplicability(FX_VAR_SCOPE, [FX_CTX, IRS_CTX, BOND_CTX]);
    expect(r.verdict).toBe("partially-applies");
    expect(r.matches).toEqual(["product:fx"]);
    expect(r.rationale).toContain("1 of 3");
  });

  it("applies when every candidate matches", () => {
    const r = assessApplicability(FX_VAR_SCOPE, [FX_CTX]);
    expect(r.verdict).toBe("applies");
    expect(r.matches).toEqual(["product:fx"]);
  });

  it("does-not-apply when no candidate matches", () => {
    const r = assessApplicability(FX_VAR_SCOPE, [IRS_CTX, BOND_CTX]);
    expect(r.verdict).toBe("does-not-apply");
    expect(r.matches).toEqual([]);
  });

  it("is pure — preserves candidate order in matches", () => {
    const r = assessApplicability(
      { kind: "jurisdiction", jurisdiction: "ZA" },
      [BOND_CTX, FX_CTX, IRS_CTX],
    );
    expect(r.matches).toEqual(["product:bond", "product:fx", "product:irs"]);
  });
});

describe("AssessmentRegister projection", () => {
  it("empty register has no assessments", () => {
    const reg = emptyAssessmentRegister();
    expect(reg.listAssessments()).toEqual([]);
    expect(reg.getAssessment("x")).toBeNull();
    expect(reg.eventCount).toBe(0);
  });

  it("folds the full lifecycle Requested → Performed → Concluded", () => {
    const r = assessApplicability(FX_VAR_SCOPE, [FX_CTX, IRS_CTX, BOND_CTX]);
    const reg = foldAssessmentRegister([
      {
        kind: "ApplicabilityAssessmentRequested",
        assessmentId: "a1",
        subjectRef: "posture:risk-appetite:fx-var",
        subjectKind: "posture",
        appliesToScope: FX_VAR_SCOPE,
        requestedBy: "Mira",
        citations: ["D-W8-POSTURE-REGISTER-SLICE-1"],
      },
      {
        kind: "ApplicabilityAssessmentPerformed",
        assessmentId: "a1",
        contextsEvaluated: [FX_CTX, IRS_CTX, BOND_CTX],
        matches: r.matches,
        performedBy: "agent:mira",
      },
      {
        kind: "ApplicabilityAssessmentConcluded",
        assessmentId: "a1",
        verdict: r.verdict,
        appliesToContexts: r.matches,
        rationale: r.rationale,
        concludedBy: "Mira",
        citations: ["D-W8-POSTURE-REGISTER-SLICE-1"],
      },
    ]);

    const a = reg.getAssessment("a1");
    expect(a).not.toBeNull();
    expect(a?.stage).toBe("concluded");
    expect(a?.verdict).toBe("partially-applies");
    expect(a?.appliesToContexts).toEqual(["product:fx"]);
    expect(a?.contextsEvaluated?.length).toBe(3);
    expect(reg.violations).toEqual([]);
    expect(reg.eventCount).toBe(3);
  });

  it("assessmentsForSubject filters by subjectRef", () => {
    const reg = foldAssessmentRegister([
      {
        kind: "ApplicabilityAssessmentRequested",
        assessmentId: "a1",
        subjectRef: "posture:fx-var",
        subjectKind: "posture",
        appliesToScope: FX_VAR_SCOPE,
        requestedBy: "Mira",
        citations: ["X"],
      },
      {
        kind: "ApplicabilityAssessmentRequested",
        assessmentId: "a2",
        subjectRef: "posture:lcr-floor",
        subjectKind: "posture",
        appliesToScope: { kind: "jurisdiction", jurisdiction: "ZA" },
        requestedBy: "Mira",
        citations: ["X"],
      },
    ]);
    expect(reg.assessmentsForSubject("posture:fx-var").map((a) => a.assessmentId)).toEqual(["a1"]);
    expect(reg.listAssessments().length).toBe(2);
  });

  it("surfaces orphan Concluded (no matching Requested) as a violation", () => {
    const reg = foldAssessmentRegister([
      {
        kind: "ApplicabilityAssessmentConcluded",
        assessmentId: "orphan",
        verdict: "applies",
        appliesToContexts: [],
        rationale: "x",
        concludedBy: "Mira",
        citations: ["X"],
      },
    ]);
    expect(reg.violations.length).toBe(1);
    expect(reg.violations[0]?.kind).toBe("orphan-concluded");
    expect(reg.getAssessment("orphan")).toBeNull();
  });

  it("surfaces orphan Performed as a violation", () => {
    const reg = foldAssessmentRegister([
      {
        kind: "ApplicabilityAssessmentPerformed",
        assessmentId: "orphan",
        contextsEvaluated: [FX_CTX],
        matches: ["product:fx"],
        performedBy: "agent:mira",
      },
    ]);
    expect(reg.violations.length).toBe(1);
    expect(reg.violations[0]?.kind).toBe("orphan-performed");
  });
});

describe("event payload schemas", () => {
  it("Requested schema accepts a well-formed payload", () => {
    const parsed = applicabilityAssessmentRequestedPayloadSchema.parse({
      assessmentId: "a1",
      subjectRef: "posture:fx-var",
      subjectKind: "posture",
      appliesToScope: FX_VAR_SCOPE,
      requestedBy: "Mira",
      citations: ["D-W8-POSTURE-REGISTER-SLICE-1"],
    });
    expect(parsed.assessmentId).toBe("a1");
  });

  it("Concluded schema rejects an unknown verdict", () => {
    expect(() =>
      applicabilityAssessmentConcludedPayloadSchema.parse({
        assessmentId: "a1",
        verdict: "maybe",
        appliesToContexts: [],
        rationale: "x",
        concludedBy: "Mira",
        concludedAt: "2026-06-13T00:00:00.000Z",
        citations: ["X"],
      }),
    ).toThrow();
  });
});
