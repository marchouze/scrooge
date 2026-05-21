// prototype/scripts/record-d-mr-1-fx-ipv-tolerances-v2.ts
//
// Record Helena (Chief Risk Officer, governance) own-authority decision:
// MR-1-FX IPV tolerance recalibration v2 — post D-FX-QUOTING-CONVENTION
// calculator fix.
//
// Authority: brief:helena:ipv-tolerance-recalibration-on-mr-1-fx-after-fx-:2026-05-21
// CRO own-authority: risk-appetite calibration per CLAUDE.md decision-authority
// routing table.
//
// Run once from prototype/: bun run scripts/record-d-mr-1-fx-ipv-tolerances-v2.ts
// This script stays in the repo as an audit record.

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-MR-1-FX-IPV-TOLERANCES-V2",
    phase: "approved",
    authority: "CRO",
    authorityRef: "helena@bank.internal",
    title: "MR-1-FX IPV tolerance recalibration v2 — post D-FX-QUOTING-CONVENTION calculator fix",
    category: "risk",
    recommendation:
      "Recalibrate build-phase IPV tolerances: relative threshold 0.25% → 0.75%; " +
      "absolute ZAR threshold ZAR 50,000 → ZAR 200,000. " +
      "At commencement of trading, tighten back to 0.25% / ZAR 50,000 using a consolidated Level-1 " +
      "WM-Fix / Bloomberg BFIX primary source.",
    rationale:
      "The D-FX-QUOTING-CONVENTION fix (PRs #664/#675/#676/#677) corrected a ~18.5x P&L error on " +
      "BUY trades caused by the notional being on the quote side of major-first pairs. The previous " +
      "0.25% relative IPV tolerance was calibrated against these incorrect P&L numbers, and was " +
      "already too tight for the build-phase data environment: the two free-tier FX providers in use " +
      "(open-er-api and twelve-data) naturally diverge 0.20–0.40% due to different quote times, " +
      "bid/ask mid conventions, and CDN caching. This caused all USD/ZAR and GBP/ZAR positions " +
      "(4/6 total) to breach the IPV check on every MTM run, generating noise that masked genuine " +
      "mis-mark signals. " +
      "The recalibrated 0.75% relative / ZAR 200k absolute thresholds absorb normal inter-provider " +
      "spread noise while retaining sensitivity to genuine mis-marks (>3× the observed inter-provider " +
      "spread of 0.38%). The ZAR 200k absolute threshold is set to avoid spurious breaches on the " +
      "synthetic large-notional positions in the build-phase scenario set. " +
      "These thresholds are explicitly build-phase only and must be reviewed before commencement of " +
      "trading when production-grade Level-1 rate sources replace the free-tier feeds.",
    sourceDocHashes: [],
    citations: [
      "D-BRC-INTERIM-MR-1-FX",
      "D-FX-QUOTING-CONVENTION",
      "PRICING-POLICY-V1-S5-2",
      "BCBS-239-IPV",
      "IFRS-9-S5-7-1",
    ],
    recordedVia: "agent:autonomous",
    actor: {
      type: "service",
      id: "helena:cro-own-authority",
    },
  },
  clock.now(),
);

console.log(
  "[record-d-mr-1-fx-ipv-tolerances-v2] Decision D-MR-1-FX-IPV-TOLERANCES-V2 recorded (CRO own-authority).",
);
