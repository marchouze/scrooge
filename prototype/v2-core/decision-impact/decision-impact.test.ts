// v2-core/decision-impact/decision-impact.test.ts
//
// Unit tests for the V2 S9 decision-impact sweep: the pure engine
// (computeDecisionImpact / deriveRecommendedActions / recommendedActionForKind),
// the register projection (fold + queries + orphan-violation surfacing), and
// the event payload schemas.
//
// Pure, no v1 dependency (the v2-core package is self-contained by construction).
//
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//         Architect, engineering).

import { describe, expect, it } from "bun:test";
import type { AppliesToScope } from "../posture";
import {
  type CandidateArtefact,
  type SweptDecision,
  computeDecisionImpact,
  decisionImpactAssessedPayloadSchema,
  decisionImpactSweepRequestedPayloadSchema,
  deriveRecommendedActions,
  emptySweepRegister,
  foldSweepRegister,
  recommendedActionForKind,
} from "./index";

const DEC = "D-SACCR-V2-CUTOVER-ACCELERATE";

const FX_SCOPE: AppliesToScope = {
  kind: "and",
  conditions: [
    { kind: "jurisdiction", jurisdiction: "ZA" },
    { kind: "risk-class", riskClass: "RT-MK" },
    { kind: "product-scope", filTaxonomyScope: "fil:type:fx:*" },
  ],
};

describe("recommendedActionForKind", () => {
  it("maps each kind deterministically", () => {
    expect(recommendedActionForKind("fil-model")).toBe("re-validate");
    expect(recommendedActionForKind("obligation")).toBe("re-distill");
    expect(recommendedActionForKind("posture")).toBe("re-assess");
    expect(recommendedActionForKind("procedure")).toBe("re-assess");
  });
});

describe("computeDecisionImpact — citation graph", () => {
  it("surfaces artefacts that cite the decision (cites-decision edge)", () => {
    const decision: SweptDecision = { decisionId: DEC, cites: [], supersedes: [] };
    const candidates: CandidateArtefact[] = [
      {
        artefactKind: "fil-model",
        artefactRef: "fil:model:sa-ccr@1.0",
        citations: [DEC],
      },
      {
        artefactKind: "obligation",
        artefactRef: "urn:reg:za:unrelated",
        citations: ["D-OTHER"],
      },
    ];
    const result = computeDecisionImpact(decision, candidates);
    expect(result.impacted).toHaveLength(1);
    expect(result.impacted[0]?.artefactRef).toBe("fil:model:sa-ccr@1.0");
    expect(result.impacted[0]?.edge).toBe("cites-decision");
    expect(result.recommendedActions).toEqual(["re-validate"]);
  });

  it("surfaces artefacts the decision cites (cited-by-decision edge)", () => {
    const decision: SweptDecision = {
      decisionId: DEC,
      cites: ["urn:reg:za:saccr-obligation"],
      supersedes: [],
    };
    const candidates: CandidateArtefact[] = [
      {
        artefactKind: "obligation",
        artefactRef: "urn:reg:za:saccr-obligation",
        citations: [],
      },
    ];
    const result = computeDecisionImpact(decision, candidates);
    expect(result.impacted).toHaveLength(1);
    expect(result.impacted[0]?.edge).toBe("cited-by-decision");
    expect(result.recommendedActions).toEqual(["re-distill"]);
  });

  it("surfaces artefacts citing a superseded decision (supersedes edge)", () => {
    const decision: SweptDecision = {
      decisionId: DEC,
      cites: [],
      supersedes: ["D-OLD-SACCR"],
    };
    const candidates: CandidateArtefact[] = [
      {
        artefactKind: "procedure",
        artefactRef: "proc:saccr-daily",
        citations: ["D-OLD-SACCR"],
      },
    ];
    const result = computeDecisionImpact(decision, candidates);
    expect(result.impacted).toHaveLength(1);
    expect(result.impacted[0]?.edge).toBe("supersedes");
    expect(result.recommendedActions).toEqual(["re-assess"]);
  });
});

describe("computeDecisionImpact — scope overlap", () => {
  it("surfaces a posture whose scope binds the decision's subject context", () => {
    const decision: SweptDecision = {
      decisionId: DEC,
      cites: [],
      supersedes: [],
      subjectContext: {
        jurisdiction: "ZA",
        riskClass: "RT-MK",
        filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
      },
    };
    const candidates: CandidateArtefact[] = [
      {
        artefactKind: "posture",
        artefactRef: "posture:risk-appetite:fx-var",
        citations: [],
        appliesToScope: FX_SCOPE,
      },
    ];
    const result = computeDecisionImpact(decision, candidates);
    expect(result.impacted).toHaveLength(1);
    expect(result.impacted[0]?.edge).toBe("scope-overlap");
  });

  it("surfaces a posture with a structurally-equal scope", () => {
    const decision: SweptDecision = {
      decisionId: DEC,
      cites: [],
      supersedes: [],
      subjectScope: FX_SCOPE,
    };
    const candidates: CandidateArtefact[] = [
      {
        artefactKind: "posture",
        artefactRef: "posture:risk-appetite:fx-var",
        citations: [],
        appliesToScope: FX_SCOPE,
      },
    ];
    const result = computeDecisionImpact(decision, candidates);
    expect(result.impacted).toHaveLength(1);
    expect(result.impacted[0]?.edge).toBe("scope-overlap");
  });

  it("does not surface scope overlap when neither side supplies data", () => {
    const decision: SweptDecision = { decisionId: DEC, cites: [], supersedes: [] };
    const candidates: CandidateArtefact[] = [
      {
        artefactKind: "posture",
        artefactRef: "posture:unrelated",
        citations: [],
        appliesToScope: { kind: "jurisdiction", jurisdiction: "GB" },
      },
    ];
    const result = computeDecisionImpact(decision, candidates);
    expect(result.impacted).toHaveLength(0);
    expect(result.recommendedActions).toEqual(["none"]);
  });
});

describe("computeDecisionImpact — precedence + determinism", () => {
  it("records the most-direct edge when an artefact matches multiple", () => {
    // Artefact both cites the decision AND has an overlapping scope. The
    // cites-decision edge (most direct) must win.
    const decision: SweptDecision = {
      decisionId: DEC,
      cites: [],
      supersedes: [],
      subjectScope: FX_SCOPE,
    };
    const candidates: CandidateArtefact[] = [
      {
        artefactKind: "posture",
        artefactRef: "posture:risk-appetite:fx-var",
        citations: [DEC],
        appliesToScope: FX_SCOPE,
      },
    ];
    const result = computeDecisionImpact(decision, candidates);
    expect(result.impacted).toHaveLength(1);
    expect(result.impacted[0]?.edge).toBe("cites-decision");
  });

  it("is idempotent: same input → identical output", () => {
    const decision: SweptDecision = { decisionId: DEC, cites: [], supersedes: [] };
    const candidates: CandidateArtefact[] = [
      { artefactKind: "fil-model", artefactRef: "fil:model:sa-ccr@1.0", citations: [DEC] },
      { artefactKind: "obligation", artefactRef: "urn:x", citations: [DEC] },
    ];
    const a = computeDecisionImpact(decision, candidates);
    const b = computeDecisionImpact(decision, candidates);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("deriveRecommendedActions", () => {
  it("returns ['none'] for an empty impact set", () => {
    expect(deriveRecommendedActions([])).toEqual(["none"]);
  });

  it("dedups and orders the action union", () => {
    const actions = deriveRecommendedActions([
      { artefactKind: "procedure", artefactRef: "p1", reason: "r", edge: "scope-overlap" },
      { artefactKind: "fil-model", artefactRef: "m1", reason: "r", edge: "cites-decision" },
      { artefactKind: "posture", artefactRef: "po1", reason: "r", edge: "scope-overlap" },
      { artefactKind: "obligation", artefactRef: "o1", reason: "r", edge: "cited-by-decision" },
    ]);
    expect(actions).toEqual(["re-validate", "re-distill", "re-assess"]);
  });
});

describe("SweepRegister projection", () => {
  const requested = {
    kind: "DecisionImpactSweepRequested",
    sweepId: "sweep:D-SACCR-V2-CUTOVER-ACCELERATE:2026-06-13",
    decisionId: DEC,
    triggeredBy: "seed:owen",
    citations: ["D-W8-DECISION-IMPACT-SWEEP"],
  };
  const assessed = {
    kind: "DecisionImpactAssessed",
    sweepId: "sweep:D-SACCR-V2-CUTOVER-ACCELERATE:2026-06-13",
    decisionId: DEC,
    impacted: [
      {
        artefactKind: "fil-model",
        artefactRef: "fil:model:sa-ccr@1.0",
        reason: "cites decision",
        edge: "cites-decision",
      },
    ],
    recommendedActions: ["re-validate"],
    assessedBy: "agent:owen",
    rationale: "1 artefact",
    citations: ["D-W8-DECISION-IMPACT-SWEEP"],
  };

  it("folds requested then assessed into one sweep", () => {
    const reg = foldSweepRegister([requested, assessed]);
    expect(reg.eventCount).toBe(2);
    const sweep = reg.getSweep(requested.sweepId);
    expect(sweep?.stage).toBe("assessed");
    expect(sweep?.impacted).toHaveLength(1);
    expect(reg.listSweeps()).toHaveLength(1);
    expect(reg.sweepsForDecision(DEC)).toHaveLength(1);
    expect(reg.impactsForDecision(DEC)).toHaveLength(1);
    expect(reg.violations).toHaveLength(0);
  });

  it("surfaces an orphan Assessed (no matching Requested)", () => {
    const reg = foldSweepRegister([assessed]);
    expect(reg.violations).toHaveLength(1);
    expect(reg.violations[0]?.kind).toBe("orphan-assessed");
  });

  it("impactsForDecision is empty for an un-assessed sweep", () => {
    const reg = foldSweepRegister([requested]);
    expect(reg.impactsForDecision(DEC)).toHaveLength(0);
  });

  it("empty register has no sweeps", () => {
    expect(emptySweepRegister().listSweeps()).toHaveLength(0);
  });

  it("re-folding the same events is idempotent (latest-wins-per-key)", () => {
    const reg = foldSweepRegister([requested, assessed, requested, assessed]);
    expect(reg.listSweeps()).toHaveLength(1);
    expect(reg.getSweep(requested.sweepId)?.stage).toBe("assessed");
  });
});

describe("event payload schemas", () => {
  it("accepts a well-formed Requested payload", () => {
    expect(() =>
      decisionImpactSweepRequestedPayloadSchema.parse({
        sweepId: "sweep:x:2026-06-13",
        decisionId: DEC,
        sweptAt: "2026-06-13T00:00:00.000Z",
        triggeredBy: "seed:owen",
        citations: ["D-W8-DECISION-IMPACT-SWEEP"],
      }),
    ).not.toThrow();
  });

  it("accepts a well-formed Assessed payload", () => {
    expect(() =>
      decisionImpactAssessedPayloadSchema.parse({
        sweepId: "sweep:x:2026-06-13",
        decisionId: DEC,
        impacted: [
          {
            artefactKind: "fil-model",
            artefactRef: "fil:model:sa-ccr@1.0",
            reason: "cites decision",
            edge: "cites-decision",
          },
        ],
        recommendedActions: ["re-validate"],
        assessedBy: "agent:owen",
        assessedAt: "2026-06-13T00:00:00.000Z",
        rationale: "1 artefact",
        citations: ["D-W8-DECISION-IMPACT-SWEEP"],
      }),
    ).not.toThrow();
  });

  it("rejects a bad recommendedAction", () => {
    expect(() =>
      decisionImpactAssessedPayloadSchema.parse({
        sweepId: "sweep:x:2026-06-13",
        decisionId: DEC,
        impacted: [],
        recommendedActions: ["nuke"],
        assessedBy: "agent:owen",
        assessedAt: "2026-06-13T00:00:00.000Z",
        rationale: "none",
        citations: ["D-W8-DECISION-IMPACT-SWEEP"],
      }),
    ).toThrow();
  });
});
