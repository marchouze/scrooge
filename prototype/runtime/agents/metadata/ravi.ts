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
  // Ravi: intraday HQLA-stress projection — BCBS 248, 4 SAMOS windows.
  // Authority: D-TREASURY-GAPS-WAVE1; BCBS 248.
  entry("Ravi", "intraday-stress", "scheduled", {
    cadenceHours: 24,
    cronExpression: "55 5 * * *",
  }),
  // Ravi: JIBAR 3M fixing ingest — build-phase fixture, on-request.
  // Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8; D-MARKETS-SCHEMA-FOUNDATION.
  entry("Ravi", "jibar-fixing-ingest", "on-request"),
  // Ravi: JIBAR swap curve ingest — build-phase fixture, on-request.
  // Closes GAP-IRS-1: wires MarketDataStore swap-curve ticks into IrsRateSource.
  // Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8; D-MARKETS-SCHEMA-FOUNDATION.
  entry("Ravi", "jibar-swap-curve-ingest", "on-request"),
  // Ravi: SARB repo + prime rate ingest — build-phase fixture, on-request.
  // Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8; D-MARKETS-SCHEMA-FOUNDATION.
  entry("Ravi", "repo-rate-ingest", "on-request"),
  // ravi:goal-loop — daily 06:23 UTC; autonomous promotion (risk/treasury pilot),
  // placed after ravi:alm-readiness (05:37) so a same-day ALMReadinessSnapshot exists.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3; D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
  entry("Ravi", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "23 6 * * *",
  }),
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
