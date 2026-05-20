// prototype/scripts/decisions/helena-mr-proc-v11-approve.ts
//
// CRO approval of v1.1 amendments to PROC-RISK-FRTB-SA-01 + PROC-RISK-MRL-01.
// Bea v1.1 verdict READY FOR HELENA SIGN-OFF (PR #615 comment 4498070129).
// Brief: brief:helena:cro-decision-on-v1-1-amendments-pr-615:2026-05-20
// AgentBriefIssued eventId: 60309aa7-bde2-4079-8cda-948ad8a51654
//
// Author: Helena (Chief Risk Officer, governance)
import { clock } from "../../platform/composition";
import { recordDecision } from "../../runtime/decisions/record";

const result = recordDecision(
  {
    decisionId: "D-MR-PROC-S8-2-V11-APPROVE",
    phase: "approved",
    authority: "CRO",
    authorityRef: "helena@bank",
    title: "Approve v1.1 amendments to PROC-RISK-FRTB-SA-01 + PROC-RISK-MRL-01 (PR #615)",
    category: "risk",
    recommendation:
      "Approve v1.1 amendments addressing Bea's three FRTB-SA observations and one MRL naming observation. Merge PR #615.",
    rationale:
      "Bea (Independent Validation engineer, engineering) issued READY FOR HELENA SIGN-OFF on the v1.1 amendments (PR #615 comment 4498070129); all four v1.0 observations resolved structurally. FRTB-SA Gap 1 (three-correlation-scenarios at Step 7a with max-inside-class-before-summation) closes the systematic SA SBM under-statement against BCBS d457. Gap 2 (DRC net-JTD per obligor + HBR-scaled bucket capital at Step 11.1–11.4 with zero cross-bucket diversification) is the canonical d457 DRC reading. Gap 3 (SA-CVA SBM-like expansion at Steps 13.1–13.6 with delta + vega per CVA risk class, CVA-CCS/CVA-RCS correctly delta-only per d507, three-scenarios pass inside SA-CVA, BA-CVA fallback, and daily-monitoring vs monthly-reportable split preventing BA-325 double-counting) is structurally complete and respects Principle 2 by deferring the CVA RW table to Mira's `Regulations/cva-sa-weights.json` rather than inventing values. On the MRL procedure, Path A (procedure-side restructure: MR-5 = no-prop attribution matching policy §3 verbatim; MR-6 = stress scenario loss sourced from PROC-RISK-ST-01) is the right call — it preserves the policy without amendment while fixing the naming mismatch Vera would otherwise flag, and the three-state `attributionState` enum captures the hedge-programme-expiry case correctly. Numerical-parameter [citation: TBC] markers remain pending Imani + external counsel ratification per Principle 2 — expected, not a blocker. The single-line stale render at Policies/market-risk-policy-v1.md line 266 will be corrected in the next policy housekeeping pass; no Decision required.",
    sourceDocHashes: [
      "blake3:1954c317ffaacbef12a3a64c181ba3a77c7b7f9e594087d19dfa9632045d28c1",
      "blake3:426f499281be0c3a0dd7163fcf55f0c8bf743e60fa71635088be80fafbc091e2",
      "blake3:971e7c474d6b74bc4aff1097e09ea791f29afaaa49d78d08b5c49962be051566",
    ],
    citations: ["urn:policy:bank:market-risk:v1", "urn:decision:bank:D-MR-PROC-S8-2-APPROVE"],
    recordedVia: "scrooge:session-delegation:helena-cro-procedure-approval",
  },
  clock.now(),
);

console.log(JSON.stringify(result, null, 2));
