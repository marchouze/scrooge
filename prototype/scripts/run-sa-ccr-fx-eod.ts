// scripts/run-sa-ccr-fx-eod.ts
//
// Production driver: runs SA-CCR over the live FX book and emits CcrEadComputed
// per netting set. Idempotent per (nettingSetId, computationDate). Requires
// registered netting sets (scripts/register-sim-fx-netting-sets.ts in build-phase).
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/run-sa-ccr-fx-eod.ts
// Authority: D-FX-OTC-NPA-SCOPE-EXPANSION; BCBS-SA-CCR-CRE52.

import { clock, eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { runSaCcrForFxPositions } from "../platform/risk/sa-ccr/positions-to-summaries";

const AS_OF = "2026-06-11T17:00:00.000Z";
const r = runSaCcrForFxPositions(eventStore, AS_OF);
logger.info(
  {
    emitted: r.emitted.length,
    skippedNoNettingSet: r.skippedNoNettingSet.length,
    skippedAlreadyComputed: r.skippedAlreadyComputed.length,
    at: clock.now(),
  },
  "SA-CCR FX EOD run complete",
);
process.exit(0);
