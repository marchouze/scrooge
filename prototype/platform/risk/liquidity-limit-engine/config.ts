// platform/risk/liquidity-limit-engine/config.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — default tier-threshold configuration.
//
// The values below are sourced from the RAS B3-family (Owner Inbox/
// 2026-05-06_risk-appetite-statement-and-framework.md §B3) + the LRM
// Policy v1 §§ 2.1 + 2.5 + 3.1 + 4.3 + 9.1. They are the build-phase
// thresholds the engine ships with; in production the configuration is
// reloaded from `RasLineCalibrated` events emitted by Helena (Chief Risk
// Officer, governance) when the RAS is recalibrated.
//
// Standing authority: D-RAS; LRM Policy v1.
//
// Author: Ravi (Treasury and ALM engineer, engineering).

import type { LiquidityLimitConfig } from "./types";

// ---------------------------------------------------------------------------
// DEFAULT_LIMIT_CONFIGS — tier-by-line threshold table.
//
//   tier-1 — PA minimum / RAS Tier-1 hard floor.  Breach = critical.
//   tier-2 — internal floor (PA minimum + management buffer). Breach = high.
//   tier-3 — early-warning threshold (internal floor + early-warning band).
//            Breach = medium.
// ---------------------------------------------------------------------------

export const DEFAULT_LIMIT_CONFIGS: readonly LiquidityLimitConfig[] = [
  // -------------------------------------------------------------------------
  // LCR — LRM Policy v1 §2.1 (PA minimum 100%) + §2.5 (internal floor +20pp).
  // -------------------------------------------------------------------------
  {
    tier: "tier-1",
    line: "lcr-ratio",
    threshold: 100,
    direction: "floor",
    severity: "critical",
    currentUnit: "percent",
  },
  {
    tier: "tier-2",
    line: "lcr-ratio",
    threshold: 120,
    direction: "floor",
    severity: "high",
    currentUnit: "percent",
  },
  {
    tier: "tier-3",
    line: "lcr-ratio",
    threshold: 130,
    direction: "floor",
    severity: "medium",
    currentUnit: "percent",
  },
  // -------------------------------------------------------------------------
  // NSFR — LRM Policy v1 §3.1 (PA minimum 100%; internal floor +15pp).
  // -------------------------------------------------------------------------
  {
    tier: "tier-1",
    line: "nsfr-ratio",
    threshold: 100,
    direction: "floor",
    severity: "critical",
    currentUnit: "percent",
  },
  {
    tier: "tier-2",
    line: "nsfr-ratio",
    threshold: 115,
    direction: "floor",
    severity: "high",
    currentUnit: "percent",
  },
  {
    tier: "tier-3",
    line: "nsfr-ratio",
    threshold: 125,
    direction: "floor",
    severity: "medium",
    currentUnit: "percent",
  },
  // -------------------------------------------------------------------------
  // Intraday liquidity — LRM Policy v1 §4.3. Buffer must be >= ZAR X.
  // Build-phase placeholder: ZAR 0 (no balance sheet); production value
  // sourced from RAS calibration.
  // -------------------------------------------------------------------------
  {
    tier: "tier-1",
    line: "intraday-liquidity-buffer",
    threshold: 0,
    direction: "floor",
    severity: "critical",
    currentUnit: "zar-minor",
  },
  // -------------------------------------------------------------------------
  // Funding concentration — LRM Policy v1 §9.1: single-counterparty
  // funding concentration >= 15% is High.
  // -------------------------------------------------------------------------
  {
    tier: "tier-1",
    line: "funding-concentration-counterparty",
    threshold: 25,
    direction: "ceiling",
    severity: "critical",
    currentUnit: "percent",
  },
  {
    tier: "tier-2",
    line: "funding-concentration-counterparty",
    threshold: 15,
    direction: "ceiling",
    severity: "high",
    currentUnit: "percent",
  },
  {
    tier: "tier-2",
    line: "funding-concentration-depositor",
    threshold: 15,
    direction: "ceiling",
    severity: "high",
    currentUnit: "percent",
  },
  {
    tier: "tier-2",
    line: "funding-concentration-tenor",
    threshold: 25,
    direction: "ceiling",
    severity: "high",
    currentUnit: "percent",
  },
  // -------------------------------------------------------------------------
  // HQLA concentration — LRM Policy v1 §2.2.
  //   L2B total cap 15%; single issuer (L2A or L2B) 10%; L2A + L2B combined 40%.
  // The engine accepts a single concentration metric (the max single-issuer
  // share or category share, whichever ALCO-pack input carries); the tier-1
  // cap aligns with the L2-combined cap (40%).
  // -------------------------------------------------------------------------
  {
    tier: "tier-1",
    line: "hqla-concentration",
    threshold: 40,
    direction: "ceiling",
    severity: "critical",
    currentUnit: "percent",
  },
  {
    tier: "tier-2",
    line: "hqla-concentration",
    threshold: 15,
    direction: "ceiling",
    severity: "high",
    currentUnit: "percent",
  },
];
