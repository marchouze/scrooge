// prototype/scripts/decisions/scrooge-ontology-phase-1-dispatch.ts
//
// CEO authorisation (Marc, in-session 2026-05-21 via Scrooge session
// delegation) for Phase 1 of ontology population — regulations only, with
// parallel URN normalisation and obligation review substrate.
//
// Records three Decision events covering the three parallel briefs in the
// approved plan:
//   1. D-ONTOLOGY-REG-EXTRACTION-PHASE-1   → Mira
//   2. D-URN-CANONICAL-VOCABULARY          → Owen
//   3. D-OBLIGATION-REVIEW-SUBSTRATE       → Atlas
//
// Authority chain: CEO build-phase authority over engineering / substrate
// decisions per CLAUDE.md "Decision authority routing" table. Marc's plan
// approval in-session via ExitPlanMode = session delegation per CLAUDE.md
// "Scrooge session delegation" rule.
//
// Spec: /Users/marc/.claude/plans/i-m-not-happy-with-idempotent-tide.md
//
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.

import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const COMMON_CITATIONS = [
  "urn:decision:bank:D-KG-GRAPHITI-ADOPT",
  "urn:decision:bank:D-PRINCIPLES-P2-P6-MERGE",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

const results = [
  recordDecision(
    {
      decisionId: "D-ONTOLOGY-REG-EXTRACTION-PHASE-1",
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Operationalise Mira's regulatory concept extractor across all 13 instruments (Phase 1)",
      category: "engineering",
      recommendation:
        "Mira (Compliance / RegTech engineer, engineering) generalises prototype/scripts/pilot-fais-act-extraction.ts into prototype/scripts/extract-regulations.ts, extends the prototype/platform/regulatory/concept-extractor.ts system prompt to (a) cover the four foundational node types currently absent (Regulator, Jurisdiction, Framework, RiskCategory) and (b) maximise product/activity/threshold edge granularity per the asymmetric-coupling model (reg→ontology must be maximally tight; one Obligation per duty with multiple APPLIES_TO_ACTIVITY / APPLIES_TO / SETS edges, not one Obligation per section). Runs the full corpus extraction (~13 instruments × ~30-50 sections × claude-haiku-4-5 ≈ $2.50). Mira's pipeline emits ObligationReviewMatched / Conflict / CandidateProposed events against the existing register without mutating any existing row. Adds recon:regulatory-extraction-coverage (blocking) and recon:obligation-policy-coverage (advisory). Verification: 5 specific reg clauses (Banks Act §78, FAIS GCC §3, FIC Act §29, JS-2, Excon) each resolve to ≥2 activity edges + ≥1 product edge.",
      rationale:
        "Mira's extraction substrate is fully built (concept-extractor.ts, claude.ts SDK wrapper with prompt-caching, ontology-schema.ts Zod validator, seed-projection.ts:469 consumer) but has never been driven across the corpus — zero RegulatoryConceptExtracted events exist in the event store. Pilot was FAIS-only and gated by the missing Anthropic key (now fixed at ~/.config/bank/.env). The 11 empty node types + 18 empty edge types in the existing /graph substrate are filled by running what's already built. Asymmetric coupling: reg→ontology is the maximally-tight axis (granular product/activity edges); reg↔policy is loose-informational (obligations may persist without policies); policy→procedure→event is the tight operational chain enforced in Phase 2/3.",
      sourceDocHashes: [],
      citations: COMMON_CITATIONS,
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  ),
  recordDecision(
    {
      decisionId: "D-URN-CANONICAL-VOCABULARY",
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Owen lands canonical URN vocabulary + parser + advisory recon (parallel to Mira's Phase 1 extraction)",
      category: "governance",
      recommendation:
        "Owen (Company Secretary, governance) authors Regulations/_urn-vocabulary.md as the canonical register of URN classes (urn:reg:, urn:policy:, urn:procedure:, urn:decision:, urn:capability:, urn:obligation:, urn:party:, etc.) — one row per class with prefix, slug rule, example, authority, status. Builds prototype/platform/citation/urn.ts as the parser/validator (Zod-backed). Adds recon:urn-shape (advisory, non-blocking) scanning every artefact frontmatter + every event's citations array, reporting prose-where-URN-expected violations. Wires URN normalisation into Mira's extractor output (post-extraction lookup pass converting prose citations to URN shape). Also owns: obligations-register schema extension (review-status + review-author + review-date + review-event-id columns; backfill legacy-unreviewed on existing ~200 rows) + review-queue routing rules by domain (per Decision authority routing table).",
      rationale:
        "Citation fragmentation is Marc's #1 pain (set during D-KG-GRAPHITI-ADOPT review). The corpus carries prose ('Banks Act 94 of 1990'), URNs ('urn:obligation:bank:m1:...'), obligation IDs ('ORG-MK-09'), paths, and markdown links interchangeably. Locking a canonical vocabulary is the precondition for the tight policy→procedure→event chain that Phase 2/3 will enforce. Advisory-first (not blocking) avoids bricking CI on the backfill scope; flips to blocking in Phase 4 once backfill completes. Schema extension on obligations register lands as part of this brief because Owen owns governance register hygiene and the obligation-review substrate hangs off the same columns.",
      sourceDocHashes: [],
      citations: COMMON_CITATIONS,
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  ),
  recordDecision(
    {
      decisionId: "D-OBLIGATION-REVIEW-SUBSTRATE",
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Atlas builds obligation-review event substrate + advisory recon (parallel to Owen + Mira)",
      category: "engineering",
      recommendation:
        "Atlas (Core banking platform architect, engineering) adds four new event types at prototype/platform/event-store/event-types/obligation-review.ts: ObligationReviewMatched, ObligationReviewConflict, ObligationCandidateProposed, ObligationReviewCompleted. Each carries the source instrument citation, the existing-row reference (if any), the LLM-extracted candidate (if any), and the recommended action. Adds recon:obligation-policy-coverage (advisory) reporting % of reviewed obligations CLOSED_BY a policy, grouped by domain. Adds recon:obligation-review-status (advisory) reporting review-queue depth by status / domain / age. Adds a dashboard tile rendering the review-debt snapshot.",
      rationale:
        "Marc has flagged that the existing ~200 rows in Regulations/_obligations-register.md cannot be trusted by default; they need systematic review before downstream binding (Phase 2 policies citing them). Discarding loses audit trail; tag-for-review preserves history. The event substrate makes this possible: Mira's pipeline emits review events without mutating existing rows; the review queue is event-derived; reviewers (governance seats by domain) emit ObligationReviewCompleted events that update status. This is the substrate-level precondition for the systematic-review pass that follows Phase 1.",
      sourceDocHashes: [],
      citations: COMMON_CITATIONS,
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  ),
];

for (const r of results) {
  console.log(JSON.stringify({ eventId: r.eventId, decisionId: r.event.payload.decisionId }));
}
