// platform/event-store/registry/v2-eval.ts
//
// Registry rows (F-032) for the V2 S13 eval-harness event family:
//   ExamSetRegistered — a named exam-set enters the assurance corpus
//   EvalRunCompleted  — an eval run's typed verdict-of-record
//
// The exam-set register + eval-run register are projections over these events
// (`v2-core/eval/*`, folded by `recon:v2-eval-harness-integrity`). LATEST
// exam-set per examSetId wins (P1); eval runs are append-only records.
//
// Retention: governance-7y — eval verdicts are governance assurance records
// tracing directly to the model methodology + the authorising decision
// (Principle 2 upward citations).
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-W4-MODEL-LIBRARY-PILOT;
//   D-W8-POSTURE-REGISTER-SLICE-1. F-032 (event-type registration).
// Author: Vera (Internal Audit Engineer, governance).

import type { z } from "zod";
import {
  evalRunCompletedPayloadSchema,
  examSetRegisteredPayloadSchema,
} from "../event-types/v2-eval";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

const CITATIONS = [
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "D-W4-MODEL-LIBRARY-PILOT",
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

export const V2_EVAL_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ExamSetRegistered",
    class: "governance",
    issuer: "Vera",
    subscribers: ["Vera", "Nadia", "Rohan", "Sade", "Atlas", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: examSetRegisteredPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/v2-eval.ts",
  },
  {
    type: "EvalRunCompleted",
    class: "governance",
    issuer: "Vera",
    subscribers: ["Vera", "Nadia", "Rohan", "Sade", "Atlas", "Scrooge"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: evalRunCompletedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/v2-eval.ts",
  },
];
