// tests/npa-fx-infosec-attestation.test.ts
//
// CISO infosec ratification + attestation
// (platform/markets/products/npa-fx-infosec-attestation.ts):
//   - ratification REFUSES against a store missing the registered model
//     (fail-closed; a rubber stamp must be structurally impossible);
//   - ratification emits a ThreatModelGateDecision (approved-with-conditions)
//     when all four dimensions + the M2 gate stand, and is idempotent;
//   - attestation REFUSES without a standing ratification (the dimension
//     HOLDS design-attested);
//   - attestation promotes with the four tracked deferred gaps once the
//     ratification stands, parses the write-time schema, and is idempotent.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP; D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Rashida (Chief Information Security Officer, governance).

import { describe, expect, it } from "bun:test";

import { productDimensionAttestedPayloadSchema } from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import {
  INFOSEC_DEFERRED_GAPS,
  INFOSEC_PRODUCT_ID,
  RATIFICATION_DECISION_ID,
  RATIFIED_DIMENSION_IDS,
  RATIFIED_GATE_ID,
  runFxInfosecAttestation,
  runFxThreatModelRatification,
} from "../platform/markets/products/npa-fx-infosec-attestation";

const ENTITY = "LE-ZA-HOZ-BANK";
const SEED_ACTOR = { type: "service" as const, id: "agent:senna:m1-trading-stack-threat-model" };
const SEED_AS_OF = "2026-05-08T00:00:00.500Z";

let seedSeq = 0;
function seedEventId(): string {
  seedSeq += 1;
  return `00000000-0000-4000-8000-${String(seedSeq).padStart(12, "0")}`;
}

function seedDimension(store: EventStore, dimensionId: string): void {
  store.append({
    event_id: seedEventId(),
    type: "ThreatModelDimensionRegistered",
    as_of: SEED_AS_OF,
    entity: ENTITY,
    actor: SEED_ACTOR,
    citations: ["ORG-CY-03"],
    payload: { dimensionId, surface: "test", framework: "STRIDE" },
  });
}

function seedGate(store: EventStore): void {
  store.append({
    event_id: seedEventId(),
    type: "SecurityGateRegistered",
    as_of: SEED_AS_OF,
    entity: ENTITY,
    actor: SEED_ACTOR,
    citations: ["ORG-CY-03"],
    payload: {
      gateId: RATIFIED_GATE_ID,
      gateKind: "m2-precondition",
      gatedDimensionIds: [...RATIFIED_DIMENSION_IDS],
    },
  });
}

function seedFullModel(store: EventStore): void {
  for (const d of RATIFIED_DIMENSION_IDS) seedDimension(store, d);
  seedGate(store);
}

function gateDecisions(store: EventStore) {
  return [...store.replay({ type: "ThreatModelGateDecision" })];
}

function infosecAttestations(store: EventStore) {
  return [...store.replay({ type: "ProductDimensionAttested" })].filter((e) => {
    const p = e.payload as { productId?: string; dimension?: string };
    return p.productId === INFOSEC_PRODUCT_ID && p.dimension === "infosec";
  });
}

describe("runFxThreatModelRatification", () => {
  it("refuses against an empty store (no registered model — no rubber stamp)", () => {
    const store = new EventStore();
    const res = runFxThreatModelRatification(store);
    expect(res.ratified).toBe(false);
    expect(res.skipped).toBe(false);
    expect(res.missingDimensionIds.length).toBe(4);
    expect(res.gatePresent).toBe(false);
    expect(res.blockedReason).toContain("rubber stamp");
    expect(gateDecisions(store).length).toBe(0);
  });

  it("refuses when a dimension is missing even if the gate stands", () => {
    const store = new EventStore();
    for (const d of RATIFIED_DIMENSION_IDS.slice(0, 3)) seedDimension(store, d);
    seedGate(store);
    const res = runFxThreatModelRatification(store);
    expect(res.ratified).toBe(false);
    expect(res.missingDimensionIds).toEqual([RATIFIED_DIMENSION_IDS[3]]);
    expect(gateDecisions(store).length).toBe(0);
  });

  it("emits approved-with-conditions when the full model stands, and is idempotent", () => {
    const store = new EventStore();
    seedFullModel(store);

    const first = runFxThreatModelRatification(store);
    expect(first.ratified).toBe(true);
    expect(first.skipped).toBe(false);

    const decisions = gateDecisions(store);
    expect(decisions.length).toBe(1);
    const p = decisions[0]?.payload as {
      decisionId?: string;
      threatModelRef?: string;
      outcome?: string;
      decidedBy?: string;
      conditions?: string;
    };
    expect(p.decisionId).toBe(RATIFICATION_DECISION_ID);
    expect(p.threatModelRef).toBe(RATIFIED_GATE_ID);
    expect(p.outcome).toBe("approved-with-conditions");
    expect(p.decidedBy).toContain("Rashida");
    expect(p.conditions).toContain("identity");
    expect(p.conditions).toContain("HSM");

    const second = runFxThreatModelRatification(store);
    expect(second.ratified).toBe(false);
    expect(second.skipped).toBe(true);
    expect(gateDecisions(store).length).toBe(1);
  });
});

describe("runFxInfosecAttestation", () => {
  it("refuses without a standing ratification — the dimension HOLDS", () => {
    const store = new EventStore();
    seedFullModel(store);
    const res = runFxInfosecAttestation(store);
    expect(res.promoted).toBe(false);
    expect(res.skipped).toBe(false);
    expect(res.blockedReason).toContain("HOLDS design-attested");
    expect(infosecAttestations(store).length).toBe(0);
  });

  it("promotes with the four tracked deferred gaps once the ratification stands, idempotently", () => {
    const store = new EventStore();
    seedFullModel(store);
    expect(runFxThreatModelRatification(store).ratified).toBe(true);

    const first = runFxInfosecAttestation(store);
    expect(first.promoted).toBe(true);

    const attested = infosecAttestations(store);
    expect(attested.length).toBe(1);
    const payload = productDimensionAttestedPayloadSchema.parse(attested[0]?.payload);
    expect(payload.result).toBe("implementation-attested");
    expect(payload.deferredGaps?.length).toBe(4);
    expect(payload.deferredGaps?.map((g) => g.gapId).sort()).toEqual(
      [...INFOSEC_DEFERRED_GAPS.map((g) => g.gapId)].sort(),
    );

    const second = runFxInfosecAttestation(store);
    expect(second.promoted).toBe(false);
    expect(second.skipped).toBe(true);
    expect(infosecAttestations(store).length).toBe(1);
  });

  it("every deferred gap carries owner + trigger + citations (write-time discipline)", () => {
    for (const gap of INFOSEC_DEFERRED_GAPS) {
      expect(gap.gapId.length).toBeGreaterThan(0);
      expect(gap.title.length).toBeGreaterThan(0);
      expect(gap.owner).toMatch(/\(.+\)/); // name + position
      expect(gap.targetTrigger.length).toBeGreaterThan(0);
      expect(gap.citations.length).toBeGreaterThan(0);
    }
  });
});
