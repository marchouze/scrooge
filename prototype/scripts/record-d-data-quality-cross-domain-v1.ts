// One-shot backfill: record the missing D-DATA-QUALITY-CROSS-DOMAIN-V1 Decision
// event. This decision is heavily cited as Authority across the accounting +
// reporting + event-store code (period-close, coa-registry capital-tier mapping,
// BA-100/300/320/700 adapters, store.ts snapshot-consistent reads) but its
// Decision event was never recorded — the W1 distillation (#1266) classified it
// foundational from a source list, producing a DecisionDistilled with no backing
// Decision (the `dangling-classification` finding in recon:decision-distillation-
// coverage). This backfill records the event so the classification is live.
//
// Authority: CEO session-delegation (Marc, build-phase engineering norm).
// Run with: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-data-quality-cross-domain-v1.ts

import { recordDecision } from "../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-DATA-QUALITY-CROSS-DOMAIN-V1",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Cross-domain data-quality consistency: snapshot-consistent multi-subscriber reads, capital-tier CoA mapping for the BA-100 capital fold, and a data-quality recon architecture over the shared event log spanning Risk, Accounting, Liquidity and Ops",
    category: "engineering",
    recommendation:
      "Adopt a cross-domain data-quality programme over the single shared event log: (1) snapshot-consistent reads — a projection that fans out to multiple subscribers reads them all against the same event set (the `untilSequence` cap in the event store) so no subscriber sees events that appended between the first and last read, preventing cross-domain divergence; (2) capital-stack CoA enrichment — chart-of-accounts entries carry `capitalTier` (cet1/at1/t2) + `capitalSubCategory` so the BA-100 capital fold is derived from typed account metadata rather than hand-maintained lists (cited to Reg 38(8) + BCBS Basel III §50–§57); (3) a standing data-quality recon architecture that asserts consistency of the same fact across the Risk, Accounting, Liquidity and Ops projections, all derived from the one event log (Principle 1).",
    rationale:
      "The bank derives every domain view — risk, accounting, liquidity, ops — from the one shared event log (Principle 1). Without explicit cross-domain data-quality controls, the same underlying fact can render differently across domains: a projection reading subscribers at different sequence points sees an inconsistent snapshot; a capital figure folded from a hand-maintained account list drifts from the CoA; a balance reconciled in one domain disagrees with another. This decision establishes the controls that keep the domains coherent: snapshot-consistent reads, typed capital-tier CoA metadata feeding the BA-100 fold, and recon gates asserting cross-domain agreement. The decision is already load-bearing — it is cited as Authority across period-close, the CoA registry, the BA-100/300/320/700 reporting adapters, and the event-store snapshot-read path — but its Decision event had never been recorded; this backfill makes the long-standing, heavily-cited decision a live record so its DecisionDistilled classification (foundational) is no longer dangling. Generalises to any tenant on the shared platform.",
    sourceDocHashes: [],
    citations: ["P1-EVENTS-AS-TRUTH", "P2-SINGLE-GRAPH-DISCIPLINE"],
    recordedVia: "scrooge:session-delegation",
  },
  "2026-06-14T00:00:00.000Z",
);

console.log(JSON.stringify(result, null, 2));
