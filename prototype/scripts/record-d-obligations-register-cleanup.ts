// Records D-OBLIGATIONS-REGISTER-CLEANUP (CEO session-delegation, 2026-06-09).
//
// Marc approved (in-session) the phased cleanup of the bank obligations
// register: every obligation drills into its source text (BCBS parity), has a
// reviewed requirement summary, clean owner + domain, a deterministic URN, and
// every SA↔BCBS overlap carries a same-outcome / divergent verdict with a recon
// gate. Policy-mapping is the explicit next phase. Plan:
// ~/.claude/plans/plan-for-a-cleanup-eager-kazoo.md
//
// Idempotent: skips if the Decision event already exists. Run against the
// SHARED store so the canonical log (the dashboard reads it) receives it:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-obligations-register-cleanup.ts
//
// Recording instrument: Scrooge (Chief of Staff). Authorising principal: Marc (CEO).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-OBLIGATIONS-REGISTER-CLEANUP";

function main(): number {
  for (const e of eventStore.replay({ type: "Decision" })) {
    if ((e.payload as Record<string, unknown>).decisionId === DECISION_ID) {
      logger.info({ decisionId: DECISION_ID }, "skipped (event already exists)");
      return 0;
    }
  }

  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Obligations register cleanup — source-text drill-down, requirement summaries, clean owner/domain/URN, and SA↔BCBS same-outcome/divergent classification (D-OBLIGATIONS-REGISTER-CLEANUP)",
      category: "engineering",
      recommendation:
        "Run a five-phase, event-sourced cleanup of the ~454-obligation register. P1 (Atlas): wire SA (ORG-*) source-text drill-down to BCBS parity from graph Provision nodes, with an explicit image-only state. P2+P3 (Mira/Atlas): payload-aware backfill skip-logic + one corrected ObligationAdopted per ID minting deterministic urn:reg:za URNs from citation prose, assigning owner (seat vocab) and clean A..J domain, plus a recon:obligation-urn-coverage gate. P4 (Mira, standing): Mira authors reviewed requirement summaries batched by domain via ObligationReviewCompleted. P5 (Mira/Atlas, standing): a new ObligationEquivalenceClassified event folding into EQUIVALENT_TO/CONFLICTS_WITH edges with full pairwise SA↔BCBS verdicts and a recon:obligation-divergence gate. Policy-mapping is the next, separate phase.",
      rationale:
        "Three reviews this session established the shortfalls: source-text drill-down works for BCBS only; 222/454 obligations carry [TBD]/empty URN (all with real citation prose — a deterministic backfill, not re-sourcing); owner is empty on the ~36 BCBS-imported obligations and inconsistent on the SA set; domain is a re-derived markdown heading; and same-outcome-vs-divergent between local and international obligations is never asserted though the graph ontology already defines EQUIVALENT_TO/CONFLICTS_WITH. Granularity stays chapter/section-level, summaries are Mira-authored (not a bulk LLM pass), and equivalence/divergence is a full pairwise classification with a gate — all per Marc's in-session decisions.",
      supersedes: [],
      citations: [],
      sourceDocHashes: [],
      recordedVia: "scrooge:session-delegation",
    },
    "2026-06-09T15:30:00.000Z",
  );
  logger.info({ decisionId: DECISION_ID }, "Decision event emitted (approved)");
  return 0;
}

process.exit(main());
