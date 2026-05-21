// scripts/approve-d-oprisk-engineer-role.ts
//
// Scrooge session-delegation — record CEO approval of D-OPRISK-ENGINEER-ROLE
// Option B (subsume into existing roster: Rohan + Vera + Devon + Bea, sponsored
// by Helena).
//
// Triggered by Marc (CEO)'s explicit in-session approval of Owen (Company
// Secretary, governance)'s decision card at 2026-05-21T08:30Z via Scrooge's
// AskUserQuestion presentation. Per CLAUDE.md "Session delegation": Marc's
// "y"/"yes"/equivalent in-session constitutes CEO authorization; Scrooge emits
// Decision{phase:"approved"} with actor marc@tgv.co.za + recordedVia
// scrooge:session-delegation.
//
// Authority: CLAUDE.md "Decision authority routing" — CRO bench staffing is
// a CEO-category decision in the build phase under Principle 6.
//
// Author: Scrooge (Chief of Staff, orchestrator) — recording instrument for the CEO.

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-OPRISK-ENGINEER-ROLE";

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Operational-risk engineering: subsume into existing roster (Option B)",
    category: "people",
    recommendation:
      "Subsume operational-risk engineering into the existing bench: Rohan (Risk engineer, engineering) owns the operational-risk module of the risk engine; Vera (Internal audit engineer, engineering) provides third-line continuous assurance; Devon (Chief Operating Officer, governance) holds the executive operational-resilience accountability; Bea (Finance & IFRS, engineering) generates the Risk Return §3 and Pillar 3 §3.6 outputs; Helena (Chief Risk Officer, governance) sponsors from the CRO seat. Update the two policy files to drop the 'operational risk engineer' TBC label and name the actual contributors. Open D-OPRISK-ENGINEER-ROLE-LICENCE-DAY for re-examination at the pre-licence go-live readiness gate.",
    rationale:
      "Principle 6 (agent-minimalism) and the build-phase operating-model rule 'no real employees beyond statutory minimum' both push against a new bench seat. Each of the six operational-risk substrate items (loss-event taxonomy, RCSA cycle, KRI framework, Risk Return §3 generator, Pillar 3 §3.6 renderer, SMA RWA engine) has a natural owner on the existing bench without stretching any declared scope. Build-phase workload is zero live loss events, so a dedicated agent would be over-allocated. Op-risk applying the same Helena-governs/Rohan-measures/Bea-reports/Vera-assures shape as market and credit risk is a coherence win, not a special case. The licence-day re-examination is the right cadence to ask the hire question — actual workload signal will be visible then.",
    sourceDocHashes: ["blake3:45b450c902d8a53fe2c18848b3299840e17240b2db19c50137904c14f7e74d42"],
    citations: [
      "Policies/regulatory-reporting-policy-v1.md",
      "Policies/pillar-3-disclosure-policy-v1.md",
      "Team/_team-roster.json",
      "Principles/6-autonomous-by-default.md",
      "PR #666",
      "PR #660",
      "CLAUDE.md#decision-authority-routing",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(JSON.stringify({ ok: true, decisionId: DECISION_ID, result }, null, 2));
