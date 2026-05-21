// scripts/request-d-ras-leverage-ratio-thresholds.ts
//
// File a Decision(requested) for the proposed RAS §B3 numeric thresholds
// of the new `appetite:capital:leverage-ratio` Tier-1 appetite line.
//
// Brief: brief:helena:leverage-ratio-module-and-lr-1-ras-appetite-line:2026-05-21
// Authority: D-RAS · D-MARKETS-CAPITAL-TIME-SHAPE · Banks Act §70 ·
//   RRTB Reg 38 · BCBS Basel III §147–§165.
// Authors: Helena (Chief Risk Officer, governance) · Rohan (Market risk
//   quantitative engineer, engineering).

import { requestDecision } from "../runtime/decisions/record";

const result = requestDecision({
  decisionId: "D-RAS-LEVERAGE-RATIO-THRESHOLDS",
  authority: "CEO",
  authorityRef: "marc@tgv.co.za",
  title: "Approve RAS §B3 numeric thresholds for the Basel III leverage-ratio appetite line",
  category: "risk",
  recommendation:
    "Approve the following numeric thresholds for the new `appetite:capital:leverage-ratio` Tier-1 appetite line (RAS §B3): " +
    "green ≥ 4.5%; amber 4.0% ≤ ratio < 4.5%; red 3.5% ≤ ratio < 4.0%; critical sub-status (status red, critical:true) ratio < 3.5%. " +
    "BCBS regulatory minimum is 3% (BCBS §147 + RRTB Reg 38); the proposed appetite floor of 3.5% gives a 0.5pp management-action buffer over the hard floor, with full green at 1.5pp over the floor. " +
    "Measurement owner: Bea (Accounting & financial reporting engineer, engineering) → Camille (CFO, finance) joint with Helena (CRO, governance). " +
    "Production calibration of these numbers is a follow-on Helena (CRO) run after first BRC cycle once live exposure-measure projections (SA-CCR + commitment + SFT) are emitting.",
  rationale:
    "Three drivers for these specific numbers. (1) The BCBS §147 regulatory floor is 3%; a management-action floor must sit above it so the bank can act before it breaches the regulatory limit — a 0.5pp gap (3.5% critical) gives Helena one BRC cycle of warning before the floor. " +
    "(2) The 1.5pp green-to-floor buffer mirrors the CET1 appetite line's 1.5pp PA-min buffer (RAS §B3) so the capital-tier appetite framework is internally consistent across the risk-based and leverage views. " +
    "(3) The build-phase has no live positions yet — the leverage ratio is structurally Infinity against the R300m Tier-1 envelope until first trade settles. Numeric calibration must land before commencement-of-trading, not after. " +
    "Subject to BRC challenge at next cycle and Board approval at first post-launch review.",
  citations: [
    "D-RAS",
    "D-MARKETS-CAPITAL-TIME-SHAPE",
    "Banks Act 94 of 1990 §70",
    "Regulations Relating to Banks Reg 38",
    "BCBS Basel III §147–§165",
  ],
  followOnDispatch: [
    {
      route: "agent:helena",
      note: "Re-calibrate after first BRC cycle once live SA-CCR + commitment projections are emitting exposure-measure events.",
    },
    {
      route: "agent:rohan",
      note: "Stand up periodic SA-CCR + commitment-snapshot projections so `computeLeverageRatioMetrics` exits build-phase mode.",
    },
  ],
  recordedVia: "scrooge:session-delegation:propose-decision",
});

console.log(
  JSON.stringify({
    ok: true,
    decisionId: "D-RAS-LEVERAGE-RATIO-THRESHOLDS",
    eventId: result.eventId,
    phase: "requested",
  }),
);
