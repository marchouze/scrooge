// scripts/backfill-atlas-substrate-gap-reclassify.ts
//
// Migration (WS-RISK-REGISTER-CLOSURE,
// brief:atlas:risk-register-closure-substrate-substrate-status:2026-06-02).
//
// Atlas's substrate-state handler historically emitted one `RiskRaised` per
// substrate gap (riskIds `risk:atlas:substrate-gap-1..N`, re-raised every
// run). Substrate gaps are forward engineering work, NOT risk-register
// findings — they now ride on the SubstrateStateSnapshot `gaps[]` status
// inventory + per-gap WorkstreamRegistered events, and the handler no longer
// emits RiskRaised for them.
//
// This script reclassifies the legacy entries: for each distinct
// `risk:atlas:substrate-gap-*` riskId present in the store and not already
// closed, it emits one `RiskResolved{ resolutionType: "reclassified" }`.
// Closing a riskId clears every RiskRaised sharing it (pairing is by id), so
// the register reads clean regardless of the synthetic-provenance guard.
//
// Append-only (Principle 1): the historical RiskRaised events are NOT
// deleted; a forward closure event supersedes them.
//
// NOT part of `ci:migrate`: a clean CI store holds zero such events, and no
// recon asserts closure parity. This is a one-shot for live host stores.
//
// Idempotent: skips any riskId that already carries a closure event.
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/backfill-atlas-substrate-gap-reclassify.ts          # dry-run
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/backfill-atlas-substrate-gap-reclassify.ts --emit   # write
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import {
  RISK_CLOSURE_EVENT_TYPES,
  makeRiskResolved,
} from "../platform/event-store/event-types/risk";
import { logger } from "../platform/observability/logger";

const SUBSTRATE_GAP_RISK_ID_RE = /^risk:atlas:substrate-gap-/;
const ASOF = "2026-06-02T12:00:00.000Z";
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

function main(): void {
  const emit = process.argv.includes("--emit");

  // Distinct legacy substrate-gap riskIds present in the store.
  const legacyRiskIds = new Set<string>();
  for (const e of eventStore.replay({ type: "RiskRaised" })) {
    const riskId = String((e.payload as { riskId?: unknown }).riskId ?? "");
    if (SUBSTRATE_GAP_RISK_ID_RE.test(riskId)) legacyRiskIds.add(riskId);
  }

  // riskIds already closed by any closure event.
  const closedRiskIds = new Set<string>();
  for (const closureType of RISK_CLOSURE_EVENT_TYPES) {
    for (const e of eventStore.replay({ type: closureType })) {
      const riskId = String((e.payload as { riskId?: unknown }).riskId ?? "");
      if (riskId) closedRiskIds.add(riskId);
    }
  }

  const toClose = [...legacyRiskIds].filter((id) => !closedRiskIds.has(id)).sort();

  logger.info(
    {
      legacyCount: legacyRiskIds.size,
      alreadyClosed: [...legacyRiskIds].filter((id) => closedRiskIds.has(id)).length,
      toClose: toClose.length,
      emit,
    },
    "atlas substrate-gap reclassification — scan complete",
  );

  if (toClose.length === 0) {
    logger.info({}, "Nothing to reclassify — register already clean.");
    return;
  }

  if (!emit) {
    for (const riskId of toClose) logger.info({ riskId }, "[dry-run] would reclassify");
    logger.info({}, "Dry-run only. Re-run with --emit to write closure events.");
    return;
  }

  let emitted = 0;
  for (const riskId of toClose) {
    eventStore.append(
      makeRiskResolved({
        asOf: ASOF,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:atlas:substrate-state" },
        citations: CITATIONS,
        payload: {
          riskId,
          resolvedBy: "Atlas",
          resolutionType: "reclassified",
          resolution:
            "Substrate gap reclassified as substrate-status; now tracked on the " +
            "SubstrateStateSnapshot gaps[] inventory + WorkstreamRegistered, not as a " +
            "risk-register finding (WS-RISK-REGISTER-CLOSURE).",
          relatedTo: "Atlas substrate-gap inventory",
        },
        // Migration of build-phase synthetic records — keep off the production axis.
        provenance: {
          kind: "build-phase-fixture",
          sourceLineage: "backfill-atlas-substrate-gap-reclassify",
        },
      }),
    );
    emitted++;
    logger.info({ riskId }, "reclassified");
  }

  logger.info({ emitted }, "atlas substrate-gap reclassification — done");
}

main();
