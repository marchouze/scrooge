// scripts/provenance-backfill.ts
//
// D-DATA-PROVENANCE-SUBSTRATE — Slice 6 (one-shot backfill).
//
// Tags every event in the local event store that lacks a `provenance`
// field. Idempotent — no-ops when every event is already tagged.
//
// Tag rules (per pack §3, §7 #6, §9 Q-PROV-NEW-2; Marc's adopted carve-outs):
//   - CeoDecision        → kind: 'production', sourceLineage: 'ceo-decision-record'
//   - AgentBriefIssued   → kind: 'production', sourceLineage: 'agent-brief'
//   - everything else    → kind: 'simulated',
//                          scenario: 'pre-substrate-build-phase',
//                          sourceLineage: 'pre-substrate-backfill'
//
// In practice the soft-tagger inside `EventStore`'s constructor performs
// the same work on every store-open (auto-heal). This script is the
// explicit entry point for operators who want to:
//   - Run it under an explicit BANK_EVENT_DB pointer (shared store).
//   - See the tagged-count summary printed.
//   - Confirm the backfill happened before flipping the substrate-active
//     flag for downstream consumers.
//
// Usage:
//   bun run provenance:backfill
//
// Exit codes: 0 always. The script reports the tagged count + per-kind
// breakdown via the substrate logger; it is impossible for it to "fail"
// in any non-disk-error sense (every untagged row gets a default tag).
//
// Author: Atlas (Core banking platform architect, engineering — substrate)

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";

function main(): number {
  const beforeCounts = eventStore.countByProvenanceKind();
  logger.info(
    {
      ...beforeCounts,
      total: beforeCounts.production + beforeCounts.simulated + beforeCounts.untagged,
    },
    "provenance-backfill — pre-tag counts",
  );

  // The composition-root EventStore constructor already invokes the
  // soft-tagger, so by the time we reach this point the store is healed.
  // Calling it again is idempotent (zero-untagged ⇒ no-op) and yields
  // the count actually applied since the last full audit.
  const result = eventStore.softTagUntaggedEvents();
  const afterCounts = eventStore.countByProvenanceKind();

  logger.info(
    {
      taggedThisRun: result.tagged,
      thisRunByKind: result.byKind,
      ...afterCounts,
      total: afterCounts.production + afterCounts.simulated + afterCounts.untagged,
    },
    result.tagged > 0
      ? "provenance-backfill — tagged untagged events"
      : "provenance-backfill — already tagged (no-op)",
  );

  if (afterCounts.untagged > 0) {
    logger.error(
      { untagged: afterCounts.untagged },
      "provenance-backfill — events remain untagged after pass; investigate",
    );
    return 1;
  }
  return 0;
}

process.exit(main());
