// platform/event-store/registry/model-risk.ts
//
// F-021 (Atlas, 2026-05-12): model-risk event-type registry rows.
//
// Covers the model-registry event family: ModelSubmitted, ModelTierClassified,
// ModelValidationApproved, ModelValidationWithheld, ValidationFindingRaised,
// ValidationFindingClosed, BacktestRequested, BacktestRun,
// ValidationMethodologyPublished, BacktestBreachDisposed, ModelDriftDetected,
// ProductionUseRequested, MethodologyChangeRequested.
//
// Domain owners: Rohan (Quantitative analyst & model builder, engineering)
// and Nadia (Model risk & validation engineer, engineering).

import {
  backtestBreachDisposedPayloadSchema,
  backtestRequestedPayloadSchema,
  backtestRunPayloadSchema,
  methodologyChangeRequestedPayloadSchema,
  modelDriftDetectedPayloadSchema,
  modelSubmittedPayloadSchema,
  modelTierClassifiedPayloadSchema,
  modelValidationApprovedPayloadSchema,
  modelValidationWithheldPayloadSchema,
  productionUseRequestedPayloadSchema,
  validationFindingClosedPayloadSchema,
  validationFindingRaisedPayloadSchema,
  validationMethodologyPublishedPayloadSchema,
} from "../event-types";
import { RETENTION_GOVERNANCE_7Y, type EventTypeMetadata } from "./types";

// Model-registry event types. The skeleton lives in
// `platform/model-registry/registry.ts`; co-curated by Rohan (submits)
// and Nadia (validates). See `Team/Nadia.md` §11 / §12 / §15 for the
// independence boundary; `Team/Rohan.md` §11 for the model-builder side.
export const MODEL_REGISTRY_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "ModelSubmitted",
    class: "runtime",
    payloadSchema: modelSubmittedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7"],
    // Model-risk lineage events: governance retention 7y per
    // SR 11-7 / SS 1/23 + Companies Act decision-trail norms.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §11; Team/Rohan.md §11; platform/model-registry/registry.ts",
  },
  {
    type: "ModelTierClassified",
    class: "runtime",
    payloadSchema: modelTierClassifiedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ModelValidationApproved",
    class: "runtime",
    payloadSchema: modelValidationApprovedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera", "Camille"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ModelValidationWithheld",
    class: "runtime",
    payloadSchema: modelValidationWithheldPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["RAS-B7", "SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ValidationFindingRaised",
    class: "runtime",
    payloadSchema: validationFindingRaisedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "cumulative-fold",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  {
    type: "ValidationFindingClosed",
    class: "runtime",
    payloadSchema: validationFindingClosedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §9; platform/model-registry/registry.ts",
  },
  // Backtest family — gates Rohan's S7-Targeted #4 backtest harness.
  // Co-evolved with Nadia's validation-event family; BacktestRun is the
  // input to BacktestBreachDisposed.
  {
    type: "BacktestRequested",
    class: "runtime",
    payloadSchema: backtestRequestedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["SR-11-7", "SS-1-23", "BANKS-ACT-94-1990"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md §4.1; Team/Rohan.md §11",
  },
  {
    type: "BacktestRun",
    class: "runtime",
    payloadSchema: backtestRunPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["SR-11-7", "SS-1-23", "BCBS-VAR-BACKTEST-1996"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md §4.2; Team/Rohan.md §11",
  },
  // Validation methodology family — gates Nadia's S7-Targeted #3
  // methodology library. Per Nadia §5.3 + §6 #3/#5 and Team/Nadia.md §11.
  {
    type: "ValidationMethodologyPublished",
    class: "runtime",
    payloadSchema: validationMethodologyPublishedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["SR-11-7", "SS-1-23", "RAS-B7"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md §5.3; Team/Nadia.md §11",
  },
  {
    type: "BacktestBreachDisposed",
    class: "runtime",
    payloadSchema: backtestBreachDisposedPayloadSchema,
    issuer: "Nadia",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-09_rohan_backtest-harness-v0-scoping.md §7 Q3+Q5; Team/Nadia.md §9, §11",
  },
  {
    type: "ModelDriftDetected",
    class: "runtime",
    payloadSchema: modelDriftDetectedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Nadia", "Rohan", "Helena", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §11",
  },
  {
    type: "ProductionUseRequested",
    class: "runtime",
    payloadSchema: productionUseRequestedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Nadia", "Helena", "Vera", "Kai"],
    replay: "latest-wins-per-key",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §11, §16",
  },
  {
    type: "MethodologyChangeRequested",
    class: "runtime",
    payloadSchema: methodologyChangeRequestedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Nadia", "Helena", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["SR-11-7", "SS-1-23"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Nadia.md §11",
  },
];
