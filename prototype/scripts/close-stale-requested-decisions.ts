// scripts/close-stale-requested-decisions.ts
//
// One-shot closure script.
//
// CEO-approved 2026-05-26 via Scrooge session delegation:
//   Five decisions have been implemented (PRs merged) but their
//   Decision(approved) event was never emitted. One was superseded.
//   This script emits the terminal events idempotently.
//
// Decisions:
//   D-G2-ENTITY-ID-BACKFILL         → approved  (PR #735 merged 2026-05-22)
//   D-PROVENANCE-BUILD-PHASE-CLASS   → approved  (PRs #727+#732 merged 2026-05-22)
//   D-CORRECT-DUPLICATE-MTM-REVERSALS→ approved  (PR #717 merged 2026-05-21)
//   D-RMS-PHASE-1-SLICE-3            → approved  (RMS Phase 1 complete, CLAUDE.md)
//   D-RAS-LEVERAGE-RATIO-THRESHOLDS  → approved  (PR #699 + CEO in-session 2026-05-26)
//   D-MR-1-FX-IPV-TOLERANCES-V2      → withdrawn (superseded by D-IPV-TOLERANCE-SCHEDULE-FX-SPOT / PR #721)
//
// Authority: CEO (marc@tgv.co.za), recordedVia: scrooge:session-delegation
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/close-stale-requested-decisions.ts

import { eventStore } from "../platform/composition";
import { DECISION_TERMINAL_PHASES } from "../platform/event-store/event-types/decision";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const TERMINAL = new Set(DECISION_TERMINAL_PHASES);
const AS_OF = "2026-05-26T00:00:00.000Z";

const CLOSURES: Array<{
  decisionId: string;
  phase: "approved" | "withdrawn";
  title: string;
  recommendation: string;
  rationale: string;
  supersedes?: string[];
}> = [
  {
    decisionId: "D-G2-ENTITY-ID-BACKFILL",
    phase: "approved",
    title:
      "G-2: backfill deprecated BANK-ZA-001 entity-id to LE-ZA-HOZ-BANK on all affected events",
    recommendation: "Backfill all events using BANK-ZA-001 entity-id to LE-ZA-HOZ-BANK.",
    rationale:
      "PR #735 (feat(substrate): G-2 — backfill entity-id BANK-ZA-001 → LE-ZA-HOZ-BANK) merged 2026-05-22. Work complete; approval event was not emitted at merge time. CEO approved via session delegation 2026-05-26.",
  },
  {
    decisionId: "D-PROVENANCE-BUILD-PHASE-CLASS",
    phase: "approved",
    title: "Build-phase provenance class — introduce third ProvenanceKind value",
    recommendation: "Introduce build-phase-fixture as a third ProvenanceKind value.",
    rationale:
      "PR #727 (Slice 1) and PR #732 (Slice 2) both merged 2026-05-22. Work complete; approval event was not emitted at merge time. CEO approved via session delegation 2026-05-26.",
  },
  {
    decisionId: "D-CORRECT-DUPLICATE-MTM-REVERSALS",
    phase: "approved",
    title: "Correct duplicate 2026-05-21 MTM reversal postings on ACC-2100-005",
    recommendation: "Fix duplicate MTM reversal and stale revaluation postings on ACC-2100-005.",
    rationale:
      "PR #717 (fix(gl): correct duplicate MTM reversal and stale revaluation postings on ACC-2100-005) merged 2026-05-21. Work complete; approval event was not emitted at merge time. CEO approved via session delegation 2026-05-26.",
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-3",
    phase: "approved",
    title: "RMS Phase 1 Slice 3 — projection runtime + 7 RMS register projections",
    recommendation:
      "Build projection runtime and seven RMS register projections as Phase 1 Slice 3.",
    rationale:
      "RMS Phase 1 is marked complete in CLAUDE.md ('Phase 1 ✅ complete'). Slice 3 projection runtime and seven register projections shipped as part of the Phase 1 deliverable. Approval event was not emitted. CEO approved via session delegation 2026-05-26.",
  },
  {
    decisionId: "D-RAS-LEVERAGE-RATIO-THRESHOLDS",
    phase: "approved",
    title: "Leverage-ratio appetite-line thresholds (LR-1)",
    recommendation:
      "Adopt LR-1 RAS appetite-line thresholds as implemented in PR #699 (Helena's recommendation).",
    rationale:
      "PR #699 (feat(capital): leverage ratio module + LR-1 RAS appetite line) wired the leverage-ratio module with Helena's recommended thresholds. CEO explicitly approved the threshold values via session delegation 2026-05-26.",
  },
  {
    decisionId: "D-MR-1-FX-IPV-TOLERANCES-V2",
    phase: "withdrawn",
    title: "MR-1-FX IPV tolerance recalibration v2 — post D-FX-QUOTING-CONVENTION calculator fix",
    recommendation: "Superseded — see D-IPV-TOLERANCE-SCHEDULE-FX-SPOT.",
    rationale:
      "The v2 recalibration (PR #718) was immediately superseded by the two-tier tolerance schedule in PR #721 under decision D-IPV-TOLERANCE-SCHEDULE-FX-SPOT. The substance of this decision was folded into that successor. CEO approved withdrawal via session delegation 2026-05-26.",
    supersedes: ["D-IPV-TOLERANCE-SCHEDULE-FX-SPOT"],
  },
];

function hasTerminal(decisionId: string): boolean {
  for (const e of eventStore.replay({ type: "Decision" })) {
    const p = e.payload as { decisionId?: string; phase?: string };
    if (p.decisionId === decisionId && p.phase && TERMINAL.has(p.phase)) {
      return true;
    }
  }
  return false;
}

function main(): number {
  let emitted = 0;
  let skipped = 0;

  for (const c of CLOSURES) {
    if (hasTerminal(c.decisionId)) {
      logger.info(
        { decisionId: c.decisionId },
        "close-stale — already has terminal phase, skipping",
      );
      skipped++;
      continue;
    }

    recordDecision(
      {
        decisionId: c.decisionId,
        phase: c.phase,
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: c.title,
        category: "governance",
        recommendation: c.recommendation,
        rationale: c.rationale,
        sourceDocHashes: [],
        citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
        ...(c.supersedes ? { supersedes: c.supersedes } : {}),
        recordedVia: "scrooge:session-delegation",
      },
      AS_OF,
    );

    logger.info(
      { decisionId: c.decisionId, phase: c.phase },
      "close-stale — terminal event emitted",
    );
    emitted++;
  }

  logger.info({ emitted, skipped }, "close-stale-requested-decisions — done");
  return 0;
}

process.exit(main());
