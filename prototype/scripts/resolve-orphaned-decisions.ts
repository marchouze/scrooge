// prototype/scripts/resolve-orphaned-decisions.ts
//
// One-shot script: emit terminal `Decision` events for 8 orphaned open
// decisions that were created as backfill placeholders during
// D-DECISIONS-FRAMEWORK-REDESIGN and have no terminal event.
//
// Classification (confirmed from event-history audit):
//   D-PARTY-REGISTER            → approved  (CEO-approved 2026-05-11)
//   D-T-01-PERMISSION-GATE-SECURE-DEFAULT → approved (T-01 fixed PRs #432-434)
//   D-OWNER-INBOX-AUTO-ARCHIVE  → approved  (archiver built and operational)
//   D-FX-CLS-MEMBERSHIP         → deferred  (indirect-participant posture)
//   D-GROUP-STRUCTURE           → deferred  (single-entity; formal group at capital-raise)
//   D-REGULATORY-PERIMETER      → deferred  (deferred to licence-application)
//   D-LICENCE-TYPE              → deferred  (deferred to licence-application)
//   D-AZURE-COST-BUDGET         → deferred  (Azure migration not started)
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN; recordedVia: scrooge:session-delegation
// Author: Scrooge (Chief of Staff)

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-05-17T12:00:00.000Z";

const resolutions: Array<{
  decisionId: string;
  phase: "approved" | "deferred";
  title: string;
  recommendation: string;
  rationale: string;
}> = [
  {
    decisionId: "D-PARTY-REGISTER",
    phase: "approved",
    title: "Establish Party Register as unified identity substrate",
    recommendation:
      "Implement Party register as the single canonical identity axis for all actor kinds (natural-person, legal-entity, counterparty, agent).",
    rationale:
      "CEO-approved 2026-05-11. Party substrate landed in PRs #1-3 of 5 (session 2026-05-11). Register is live and operational. Founding CEO seat (Marc) registered as first natural-person Party.",
  },
  {
    decisionId: "D-T-01-PERMISSION-GATE-SECURE-DEFAULT",
    phase: "approved",
    title: "T-01 permission gate — secure-default configuration",
    recommendation:
      "Configure T-01 permission gate with secure defaults: all capabilities require explicit grants; no implicit allow paths.",
    rationale:
      "T-01 permission-gate work completed in PRs #432–434 (session 2026-05-16). 41 Vera recon warns reduced to 0. Secure-default posture confirmed via recon gate.",
  },
  {
    decisionId: "D-OWNER-INBOX-AUTO-ARCHIVE",
    phase: "approved",
    title: "Auto-archive Owner Inbox decision records on action",
    recommendation:
      "Scrooge auto-moves actioned Owner Inbox items to actioned/ subdirectory without prompting from Marc.",
    rationale:
      "scrooge-owner-inbox-archiver built and operational. Auto-archive pattern confirmed in feedback_team_inbox_hygiene.md. 35 legacy decision briefs archived in PR #405 (2026-05-15).",
  },
  {
    decisionId: "D-FX-CLS-MEMBERSHIP",
    phase: "deferred",
    title: "FX CLS direct membership decision",
    recommendation:
      "Defer CLS direct membership; adopt indirect-participant posture via correspondent bank.",
    rationale:
      "Bank confirmed as indirect NPS participant (project_indirect_participant_posture.md, set 2026-05-07). All FX settlement routes via correspondent bank. CLS direct membership re-evaluated at licence-application if regulatory posture changes.",
  },
  {
    decisionId: "D-GROUP-STRUCTURE",
    phase: "deferred",
    title: "Formal group structure and legal-entity tree configuration",
    recommendation:
      "Defer formal group structure to capital-raise phase; operate as single-entity SA bank during build phase.",
    rationale:
      "Bank is a single SA-branch institution during build phase. Formal legal-entity tree and group structure (holding co, subsidiaries) are licence-day and capital-raise concerns. Deferred per project_strategic_foundation.md.",
  },
  {
    decisionId: "D-REGULATORY-PERIMETER",
    phase: "deferred",
    title: "Final regulatory perimeter mapping and applicability determination",
    recommendation:
      "Defer final regulatory perimeter sign-off to licence-application stage when full product scope is confirmed.",
    rationale:
      "Regulatory knowledge graph substrate live (664 nodes, 373 edges, PR #424-426). Applicability status layer implemented. Final perimeter sign-off deferred to licence-application per project_rules_bind_at_commencement.md.",
  },
  {
    decisionId: "D-LICENCE-TYPE",
    phase: "deferred",
    title: "Licence type selection under Banks Act 94 of 1990",
    recommendation:
      "Defer licence-type final selection to licence-application stage; operate as de novo bank applicant under Section 13 of Banks Act.",
    rationale:
      "Strategic foundation: institutional global-markets trading bank (project_strategic_foundation.md). Licence-type implications noted in indirect-participant posture (project_indirect_participant_posture.md). Deferred to licence-application for SARB engagement.",
  },
  {
    decisionId: "D-AZURE-COST-BUDGET",
    phase: "deferred",
    title: "Azure cloud cost budget and spend governance",
    recommendation:
      "Defer Azure cost budget and CapEx governance to Azure migration phase; current spend is Anthropic API only.",
    rationale:
      "Azure migration not started (project_cloud_target_azure.md). Current largest cost is Anthropic API token spend. Azure budget governance activates when cloud migration begins per Principle 3 roadmap.",
  },
];

let resolved = 0;
let failed = 0;

for (const r of resolutions) {
  try {
    const result = recordDecision(
      {
        decisionId: r.decisionId,
        phase: r.phase,
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: r.title,
        category: "governance",
        recommendation: r.recommendation,
        rationale: r.rationale,
        sourceDocHashes: [],
        citations: ["D-DECISIONS-FRAMEWORK-REDESIGN", "GOV-FRAMEWORK-CEO-RESERVED"],
        recordedVia: "scrooge:session-delegation",
        actor: { type: "human", id: "marc@tgv.co.za" },
      },
      AS_OF,
    );
    console.log(`✓ ${r.decisionId} → ${r.phase}  (eventId: ${result.eventId})`);
    resolved++;
  } catch (err) {
    console.error(`✗ ${r.decisionId}: ${err}`);
    failed++;
  }
}

console.log(`\nDone: ${resolved} resolved, ${failed} failed.`);
