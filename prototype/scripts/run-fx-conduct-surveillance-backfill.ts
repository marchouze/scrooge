// scripts/run-fx-conduct-surveillance-backfill.ts
//
// One-shot backfill driver — classifies the FX counterparties on the live book
// (CCO market-counterparty classification) and runs the conduct surveillance
// sweep over every historical FxTradeExecuted, so best-execution + FAIS-
// suitability + conflict surveillance covers the 44 trades booked before the
// sweep was wired.
//
// CCO basis for backfilling history (Zara, Chief Compliance Officer, governance):
// the FAIS §16 best-execution / TCF duty and §8D suitability obligation bound at
// the moment each trade executed; a surveillance layer that only looks forward
// would leave 44 institutional trades permanently un-surveilled. Best execution
// is reconstructible from the executed event (the rate is on the trade), so the
// backfill is a faithful as-of replay, not a fabrication. The surveillance
// events are stamped with the backfill as-of (the date the control was run),
// while each references the original tradeId — Principle 1: we record WHEN the
// control ran, not a back-dated pretence that it ran at trade time.
//
// Idempotent: re-running classifies/surveils nothing already covered.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/run-fx-conduct-surveillance-backfill.ts
//
// Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
//   delegation 2026-06-11); D-MARKET-CONDUCT; FAIS Act 37/2002 §§16–17, §8D, §4.
// Author: Zara (Chief Compliance Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { sweepFxConductSurveillance } from "../platform/conduct/fx-conduct-surveillance-sweep";
import { classifyFxCounterparties } from "../platform/conduct/fx-counterparty-fais-classification";

if (import.meta.main) {
  const asOf = clock.now();

  const classification = classifyFxCounterparties(eventStore, { asOf, dryRun: false });
  const sweep = sweepFxConductSurveillance(eventStore, { asOf, dryRun: false });

  console.log(
    JSON.stringify(
      {
        ok: true,
        asOf,
        classification: {
          classified: classification.classified.length,
          skipped: classification.skipped.length,
        },
        sweep: {
          tradesScanned: sweep.tradesScanned,
          tradesProcessed: sweep.tradesProcessed,
          tradesAlreadyCovered: sweep.tradesAlreadyCovered,
          eventsEmitted: sweep.eventsEmitted,
          faisUnclassifiedTradeIds: sweep.faisUnclassifiedTradeIds,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
