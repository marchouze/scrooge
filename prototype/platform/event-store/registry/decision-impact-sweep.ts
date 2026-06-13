// platform/event-store/registry/decision-impact-sweep.ts
//
// Registry rows (F-032) for the V2 S9 decision-impact sweep event family:
//   DecisionImpactSweepRequested — a Decision triggers a sweep
//   DecisionImpactAssessed       — the computed impact set + recommended actions
//
// The sweep register is a projection over these events
// (`v2-core/decision-impact/projection.ts`, folded by
// `recon:v2-decision-impact-sweep-coverage`). The two events fold by sweepId;
// Assessed supersedes per key (latest-wins-per-key, P1).
//
// Retention: governance-7y — a decision-impact sweep is a real governance
// record: it asserts (typed, citable, replayable) which downstream artefacts a
// board/seat decision touches and what must be re-validated / re-distilled /
// re-assessed. It is the structured replacement for the prose follow-on list
// (Principle 2 — no implicit linkage).
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// F-032 (event-type registration).
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//         Architect, engineering).

import type { z } from "zod";
import {
  decisionImpactAssessedPayloadSchema,
  decisionImpactSweepRequestedPayloadSchema,
} from "../event-types/decision-impact-sweep";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

const CITATIONS = [
  "D-W8-DECISION-IMPACT-SWEEP",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P6-AUTONOMOUS-BY-DEFAULT",
] as const;

const SUBSCRIBERS = ["Owen", "Atlas", "Mira", "Vera", "Helena", "Scrooge"];

export const DECISION_IMPACT_SWEEP_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "DecisionImpactSweepRequested",
    class: "governance",
    issuer: "Owen",
    subscribers: SUBSCRIBERS,
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: decisionImpactSweepRequestedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/decision-impact-sweep.ts",
  },
  {
    type: "DecisionImpactAssessed",
    class: "governance",
    issuer: "Owen",
    subscribers: SUBSCRIBERS,
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: decisionImpactAssessedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/decision-impact-sweep.ts",
  },
];
