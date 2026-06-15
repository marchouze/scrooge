// platform/event-store/registry/decision-distillation.ts
//
// Registry row for the WS-V2-BBAAS W1 decision-distillation event family:
//   - DecisionDistilled — classifies an existing Decision as foundational /
//     directional / obsolete along the BBaaS shared-core seam.
//
// The core-knowledge-base register is a projection over these events
// (platform/governance/decision-distillation/register.ts); latest event per
// decisionId wins.
//
// Author: Owen (Company Secretary, governance).

import { decisionDistilledPayloadSchema } from "../event-types/decision-distillation";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS = [
  "D-V2-BBAAS-W1-DECISION-DISTILLATION",
  "D-V2-BBAAS-ANALYSIS-LAUNCH",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

export const DECISION_DISTILLATION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "DecisionDistilled",
    class: "governance",
    issuer: "Owen",
    subscribers: ["Owen", "Scrooge", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: decisionDistilledPayloadSchema,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/decision-distillation.ts",
    v2Status: "v1-only",
  },
];
