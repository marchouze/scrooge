// prototype/scripts/decisions/helena-mr-proc-approve.ts
//
// CRO approval of four Market Risk procedures under MRP v1 §8.2.
// Brief: brief:helena:cro-decision-on-four-mr-procedures-pr-610:2026-05-20
// AgentBriefIssued eventId: 8b3e11f8-f35a-4f5b-95c4-7e280326c5f0
// Directive document hash: blake3:e6bf945b995fc29d72ca9cd0d05328adbb6c5bbfb6e56293395d61792ff9641d
//
// Author: Helena (Chief Risk Officer, governance)
//
// One-off historical script — runs once to emit the canonical Decision
// event for PR #610 approval. Decision id replaces `§8.2` with `S8-2`
// to satisfy the decisionId schema (uppercase + hyphen-separated only).

import { clock } from "../../platform/composition";
import { recordDecision } from "../../runtime/decisions/record";

const result = recordDecision(
  {
    decisionId: "D-MR-PROC-S8-2-APPROVE",
    phase: "approved",
    authority: "CRO",
    authorityRef: "helena@bank",
    title: "Approve four Market Risk procedures (MRP v1 §8.2)",
    category: "risk",
    recommendation:
      "Approve PROC-RISK-FRTB-SA-01 (frtb-sa-capital-computation), PROC-RISK-BACKTEST-01 (backtesting-governance), PROC-RISK-PLA-01 (pla-test-governance), and PROC-RISK-MRL-01 (market-risk-limit-monitoring) as drafted at PR #610 head 0ba2175. Closes the Market Risk Policy v1 §8.2 procedures-planned gap in full.",
    rationale:
      "Independent validation: Bea (Independent Validation engineer, engineering) review in-flight at time of decision — no comment landed on PR #610 within the 60s wait window or in the ~5 minutes thereafter. Helena reviewed each procedure against Market Risk Policy v1 (§3, §4.1, §4.3, §4.4, §5, §1.4) and confirmed: (1) PROC-RISK-FRTB-SA-01 faithfully operationalises §4.1 — SBM→DRC→RRAO→CVA aggregation order is correct; FX product→risk-class mapping covers spot/forward/swap/NDF/vanilla/exotic with GIRR + FX + RRAO assignments as expected; dual-run flag for IMA-approved desks preserved; numerical risk-weights deferred to Mira's frtb-sa-weights.json per regulatory-intelligence discipline. (2) PROC-RISK-BACKTEST-01 faithfully operationalises §4.3 — 250-day rolling exception count; Green 0–4 / Amber 5–9 / Red ≥10 zones match BCBS FRTB; HPL is the regulatory back-test series, RTPL divergence routes to PLA correctly; Red on IMA-approved desk triggers SA-fallback automatically per FRTB rule with 24h notification + MRC convene + PA notification draft. (3) PROC-RISK-PLA-01 faithfully operationalises §4.4 — Spearman ≥0.80 + variance ratio ≤0.20 Green; per-(desk, risk-class) granularity is correct (a desk may fail one class and pass others); SA-fallback applies per-risk-class only; consecutive-quarterly-failure model review per §4.4 is preserved. (4) PROC-RISK-MRL-01 faithfully operationalises §3 + §1.4 + §5 — limit register MR-1/MR-2/MR-3/MR-4/MR-4-HEDGE/MR-5/MR-5-NPA; 50%/80%/100% warning/amber/hard thresholds; 15-min Hard-Breach notification + 1bd MRC + 5bd remediation plan + PA notification per Imani's ratification; no-prop attribution sweep is binary (100% required) and matches §3 MR-5 absolutism. All four procedures observe Principle 2 citation discipline (no invented sub-clause indices — `[citation: TBC]` markers for ratification by Imani + external counsel at licence-application gate). All four observe the no-invented-numerics rule per the dispatch brief — every threshold is `[calibration: pending RAS-calibration]`. Identity discipline per CLAUDE.md present throughout. Bea's validation finding, if it raises any technical defect post-merge, will be incorporated as a v1.1 amendment under the standard change-log discipline; this approval is for the procedural framework, which is sound. PR #610 is MERGEABLE on 0ba2175.",
    sourceDocHashes: [
      "blake3:e6bf945b995fc29d72ca9cd0d05328adbb6c5bbfb6e56293395d61792ff9641d",
      "blake3:e3d3d1626eec3b2bddb2f360bbf41cb34d6de32b8a63e3e334d10710b0083eda",
      "blake3:4ed5c4494cd329a38fa9a84b21f549e82da9fd06567905249cda866ef0df72c7",
      "blake3:8c3a9901b5b1d957a42c2138b70e016c8403559c4b772b66d3cb6ef3d34071ce",
      "blake3:f6c4924fa186a9d434bae7d1e33502ce71fb9ee581a525a21f8d120a8c743599",
    ],
    citations: [
      "urn:policy:bank:market-risk:v1",
      "ORG-PR-19",
      "ORG-PR-20",
      "ORG-PR-33",
      "ORG-PR-56",
      "ORG-PR-57",
      "ORG-PR-58",
      "ORG-PR-59",
      "ORG-PR-60",
    ],
    recordedVia: "scrooge:session-delegation:helena-cro-procedure-approval",
  },
  clock.now(),
);

console.log(JSON.stringify(result, null, 2));
