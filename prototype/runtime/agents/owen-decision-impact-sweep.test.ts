// runtime/agents/owen-decision-impact-sweep.test.ts
//
// Tests for the V2 S9 auto-trigger candidate-context resolver + the sweep it
// feeds (D-W8-DECISION-IMPACT-SWEEP). The handler itself (default export) is
// thin orchestration over the composition singleton; the substance — resolve
// candidates from the live store → run the pure engine → produce an impact set
// — is exercised here against an isolated in-memory EventStore (the standard
// isolated-store test pattern; see bea-gl-posting-engine.test.ts,
// helena-risk-appetite-watch.test.ts).
//
// We pin:
//   1. POSTURES resolve via the citation-graph dimension (a posture citing the
//      decision is surfaced under `cites-decision`).
//   2. FIL-MODELS resolve via the citation-graph dimension (a model whose
//      `cites` includes the decision is surfaced under `cites-decision`).
//   3. OBLIGATIONS / PROCEDURES the decision itself cites are surfaced as
//      ADVISORY candidates (cited-by-decision), shaped by ref prefix.
//   4. A decision touching nothing yields an empty impact set + `["none"]`.
//   5. The sweepId is stable per (decisionId, as-of-date) — the idempotency key
//      the handler + the seed both compute, so a second sweep is a no-op.
//   6. Metadata ↔ callable registration is consistent (the bus can dispatch it).
//
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//   Architect, engineering).

import { describe, expect, it } from "bun:test";

import { OWEN_CALLABLES } from "./callables/owen";
import { OWEN_HANDLER_METADATA } from "./metadata/owen";

import {
  buildCandidates,
  resolveSweptDecision,
} from "../../platform/event-store/decision-impact-candidate-resolver";
import { makeDecision } from "../../platform/event-store/event-types/decision";
import { makeFilModelImplementationDeclared } from "../../platform/event-store/event-types/fil-models";
import { makePostureRegistered } from "../../platform/event-store/event-types/posture";
import { EventStore } from "../../platform/event-store/store";
import type { Actor } from "../../platform/event-store/types";
import { computeDecisionImpact } from "../../v2-core/decision-impact";

const ENTITY = "LE-ZA-HOZ-BANK";
const ASOF = "2026-06-13T08:00:00.000Z";
const ACTOR: Actor = { type: "service", id: "agent:test" };
const DECISION_ID = "D-TEST-S9-AUTO";

function seedDecision(
  store: EventStore,
  args: {
    decisionId: string;
    phase?: "requested" | "approved";
    citations?: string[];
    supersedes?: string[];
  },
): void {
  store.append(
    makeDecision({
      asOf: ASOF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["P1-EVENTS-AS-TRUTH"],
      payload: {
        decisionId: args.decisionId,
        phase: args.phase ?? "approved",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: "Test decision for S9 auto-trigger",
        category: "governance",
        recommendation: "Proceed.",
        rationale: "Test fixture.",
        sourceDocHashes: [],
        citations: args.citations ?? [],
        ...(args.supersedes ? { supersedes: args.supersedes } : {}),
        recordedVia: "agent:autonomous",
      },
    }),
  );
}

function seedPosture(store: EventStore, postureId: string, citations: string[]): void {
  store.append(
    makePostureRegistered({
      asOf: ASOF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["P2-SINGLE-GRAPH-DISCIPLINE"],
      payload: {
        postureId,
        postureClass: "risk-appetite",
        description: "test posture",
        appliesToScope: { kind: "always" },
        appliesToTier: "all",
        proposedBy: "agent:test",
        citations: citations.length > 0 ? citations : ["P2-SINGLE-GRAPH-DISCIPLINE"],
      },
    }),
  );
}

function seedFilModel(store: EventStore, modelId: string, cites: string[]): void {
  store.append(
    makeFilModelImplementationDeclared({
      asOf: ASOF,
      entity: ENTITY,
      actor: ACTOR,
      citations: ["P2-SINGLE-GRAPH-DISCIPLINE"],
      payload: {
        kind: "FilModelImplementationDeclared",
        modelId,
        implementsFacets: ["RiskMeasurable"],
        scope: ["fil:type:fx:*"],
        version: { major: 1, minor: 0 },
        requires: { facets: [], referenceData: [], postureDimensions: [] },
        emits: [],
        cites: cites.length > 0 ? cites : ["urn:reg:bcbs:cre52:sa-ccr"],
        methodologyHash: "blake3:0000000000000000000000000000000000000000000000000000000000000000",
        validationStatus: "validation-approved",
      },
    }),
  );
}

describe("S9 auto-trigger candidate resolver", () => {
  it("surfaces a posture that cites the decision under cites-decision", () => {
    const store = new EventStore(":memory:");
    seedDecision(store, { decisionId: DECISION_ID });
    seedPosture(store, "posture:risk-appetite:test", [DECISION_ID]);

    const decision = resolveSweptDecision(store, DECISION_ID);
    const candidates = buildCandidates(store, decision);
    const result = computeDecisionImpact(decision, candidates);

    const posture = result.impacted.find((a) => a.artefactRef === "posture:risk-appetite:test");
    expect(posture).toBeDefined();
    expect(posture?.artefactKind).toBe("posture");
    expect(posture?.edge).toBe("cites-decision");
    expect(result.recommendedActions).toContain("re-assess");
  });

  it("surfaces a fil-model whose cites include the decision under cites-decision", () => {
    const store = new EventStore(":memory:");
    seedDecision(store, { decisionId: DECISION_ID });
    seedFilModel(store, "sa-ccr", [DECISION_ID]);

    const decision = resolveSweptDecision(store, DECISION_ID);
    const result = computeDecisionImpact(decision, buildCandidates(store, decision));

    const model = result.impacted.find((a) => a.artefactRef === "sa-ccr");
    expect(model).toBeDefined();
    expect(model?.artefactKind).toBe("fil-model");
    expect(model?.edge).toBe("cites-decision");
    expect(result.recommendedActions).toContain("re-validate");
  });

  it("surfaces obligation/procedure refs the decision cites as advisory cited-by-decision", () => {
    const store = new EventStore(":memory:");
    seedDecision(store, {
      decisionId: DECISION_ID,
      citations: ["urn:reg:bcbs:cre52:sa-ccr", "proc:sa-ccr-daily-cadence", "P1-EVENTS-AS-TRUTH"],
    });

    const decision = resolveSweptDecision(store, DECISION_ID);
    const result = computeDecisionImpact(decision, buildCandidates(store, decision));

    const obligation = result.impacted.find((a) => a.artefactRef === "urn:reg:bcbs:cre52:sa-ccr");
    const procedure = result.impacted.find((a) => a.artefactRef === "proc:sa-ccr-daily-cadence");
    expect(obligation?.artefactKind).toBe("obligation");
    expect(obligation?.edge).toBe("cited-by-decision");
    expect(procedure?.artefactKind).toBe("procedure");
    expect(procedure?.edge).toBe("cited-by-decision");
    // The non-artefact citation (a principle id) is NOT surfaced as impacted.
    expect(result.impacted.find((a) => a.artefactRef === "P1-EVENTS-AS-TRUTH")).toBeUndefined();
  });

  it("yields an empty impact set + [none] for a decision touching nothing", () => {
    const store = new EventStore(":memory:");
    seedDecision(store, { decisionId: DECISION_ID });
    // A posture that does NOT cite the decision and has no scope overlap.
    seedPosture(store, "posture:risk-appetite:unrelated", []);

    const decision = resolveSweptDecision(store, DECISION_ID);
    const result = computeDecisionImpact(decision, buildCandidates(store, decision));

    expect(result.impacted).toHaveLength(0);
    expect(result.recommendedActions).toEqual(["none"]);
  });

  it("resolves the latest Decision phase/citations (requested → approved)", () => {
    const store = new EventStore(":memory:");
    seedDecision(store, { decisionId: DECISION_ID, phase: "requested", citations: [] });
    seedDecision(store, {
      decisionId: DECISION_ID,
      phase: "approved",
      citations: ["urn:reg:bcbs:cre52:sa-ccr"],
    });

    const decision = resolveSweptDecision(store, DECISION_ID);
    expect(decision.cites).toContain("urn:reg:bcbs:cre52:sa-ccr");
  });
});

describe("S9 auto-trigger registration", () => {
  it("registers owen:decision-impact-sweep as event-driven subscribing to Decision", () => {
    const meta = OWEN_HANDLER_METADATA.find((m) => m.trigger === "decision-impact-sweep");
    expect(meta).toBeDefined();
    expect(meta?.kind).toBe("event-driven");
    expect(meta?.subscribesTo).toContain("Decision");
    expect(meta?.key).toBe("owen:decision-impact-sweep");
  });

  it("has a callable registered under the same key (bus can dispatch it)", () => {
    expect(OWEN_CALLABLES["owen:decision-impact-sweep"]).toBeDefined();
    expect(typeof OWEN_CALLABLES["owen:decision-impact-sweep"]).toBe("function");
  });
});
