// runtime/agents/metadata/ravi.ts
// Per-agent handler metadata for Ravi (Treasury / ALM Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const RAVI_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Ravi", "alm-readiness", "scheduled", {
    cadenceHours: 24,
    cronExpression: "37 5 * * *",
  }),
  // Ravi: FTP curve publication — daily morning run.
  // Authority: D-MARKETS-SCHEMA-FOUNDATION.
  entry("Ravi", "ftp-curve-publish", "scheduled", {
    cadenceHours: 24,
    cronExpression: "45 5 * * *",
  }),
  // Ravi: FTP attribution — event-driven on trade/loan booking events.
  // Authority: D-MARKETS-SCHEMA-FOUNDATION.
  entry("Ravi", "ftp-attribution", "event-driven", {
    subscribesTo: [
      "FtpCurvePublished",
      "TradeBooked",
      "LoanBooked",
      "DepositReceived",
      "FundingDrawnDown",
    ],
  }),
  // Ravi: daily ALM run — repricing gap, ΔEVE, ΔNII sensitivities.
  // Authority: D-TREASURY-GAPS-WAVE1; BCBS d365.
  entry("Ravi", "alm-run", "scheduled", {
    cadenceHours: 24,
    cronExpression: "50 5 * * *",
  }),
  // ravi:goal-loop — cohort-3 (on-request only).
  entry("Ravi", "goal-loop", "on-request"),
  entry("Ravi", "event-triage", "event-driven", {
    subscribesTo: [
      "TradePosted",
      "FundingDrawn",
      "DepositReceived",
      "SAMOSFundingShortfall",
      "HQLACompositionDrift",
      "IRRBBExcursion",
      "FXPositionBreach",
      "HedgeIneffective",
    ],
  }),
];
