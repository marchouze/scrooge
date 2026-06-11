// scripts/run-fx-conduct-attestation.ts
//
// One-shot CCO conduct-dimension attestation driver for prd:bank:fx:otc-vanilla.
//
// Sequence (each idempotent):
//   1. Classify the FX counterparties (CCO market-counterparty).
//   2. Sweep conduct surveillance over the whole FX book (backfill the 44).
//   3. GATE: verify surveillance genuinely fired — there must be at least one
//      BestExecutionVerified/Breached AND one FaisClassificationSuitabilityChecked
//      tied to a real booked FxTradeExecuted tradeId in the store. Over-
//      attestation is the failure mode: if the gate fails, the conduct dimension
//      is NOT promoted and the driver exits non-zero with the reason.
//   4. Promote conduct → implementation-attested with tracked deferred gaps.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/run-fx-conduct-attestation.ts
//
// Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
//   delegation 2026-06-11); D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Zara (Chief Compliance Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { sweepFxConductSurveillance } from "../platform/conduct/fx-conduct-surveillance-sweep";
import { classifyFxCounterparties } from "../platform/conduct/fx-counterparty-fais-classification";
import { runFxConductAttestation } from "../platform/markets/products/npa-fx-conduct-attestation";

/** Set of FxTradeExecuted tradeIds on the book. */
function bookedTradeIds(): Set<string> {
  const ids = new Set<string>();
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as { tradeId?: { value?: unknown; id?: unknown } };
    const id = p.tradeId?.value ?? p.tradeId?.id;
    if (typeof id === "string") ids.add(id);
  }
  return ids;
}

/** Count surveillance events of a type tied to a real booked tradeId. */
function realTradeOutputCount(type: string, booked: Set<string>): number {
  let n = 0;
  for (const e of eventStore.replay({ type })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string" && booked.has(p.tradeId)) n += 1;
  }
  return n;
}

if (import.meta.main) {
  const asOf = clock.now();

  const classification = classifyFxCounterparties(eventStore, { asOf, dryRun: false });
  const sweep = sweepFxConductSurveillance(eventStore, { asOf, dryRun: false });

  const booked = bookedTradeIds();
  const bestExVerified = realTradeOutputCount("BestExecutionVerified", booked);
  const bestExBreached = realTradeOutputCount("BestExecutionBreached", booked);
  const faisChecked = realTradeOutputCount("FaisClassificationSuitabilityChecked", booked);
  const conflict = realTradeOutputCount("ConflictOfInterestDisclosed", booked);

  const surveillanceFires =
    bestExVerified + bestExBreached > 0 && faisChecked > 0 && booked.size > 0;

  if (!surveillanceFires) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason:
            "conduct attestation GATE failed — surveillance did not genuinely fire on real booked trades; NOT promoting (over-attestation is the failure mode)",
          bookedTrades: booked.size,
          bestExVerified,
          bestExBreached,
          faisChecked,
          conflict,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const attestation = runFxConductAttestation(eventStore);

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
          faisUnclassified: sweep.faisUnclassifiedTradeIds.length,
        },
        surveillanceOnRealTrades: {
          bookedTrades: booked.size,
          bestExVerified,
          bestExBreached,
          faisChecked,
          conflict,
        },
        attestation: {
          conductPromoted: attestation.promoted,
          conductSkippedIdempotent: attestation.skipped,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
