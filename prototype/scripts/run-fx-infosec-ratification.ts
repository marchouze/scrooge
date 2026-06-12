// scripts/run-fx-infosec-ratification.ts
//
// One-shot CISO infosec-dimension ratification + attestation driver for
// prd:bank:fx:otc-vanilla.
//
// Sequence (each idempotent, each fail-closed):
//   1. Ratify the M1 trading-stack threat model as a ThreatModelGateDecision
//      event-of-record (approved-with-conditions) — REFUSED unless all four
//      registered dimensions + the M2 gate are present in the store.
//   2. Promote infosec → implementation-attested with tracked deferred gaps —
//      REFUSED unless the ratification stands. If either step blocks, the
//      driver exits non-zero with the grounded reason and the dimension HOLDS
//      design-attested (over-attestation is the failure mode).
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/run-fx-infosec-ratification.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; PA/FSCA Joint Standard 2 of 2024.
// Author: Rashida (Chief Information Security Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  runFxInfosecAttestation,
  runFxThreatModelRatification,
} from "../platform/markets/products/npa-fx-infosec-attestation";

if (import.meta.main) {
  const asOf = clock.now();

  const ratification = runFxThreatModelRatification(eventStore);

  if (!ratification.ratified && !ratification.skipped) {
    console.error(
      JSON.stringify(
        { ok: false, step: "ratification", reason: ratification.blockedReason, ratification },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const attestation = runFxInfosecAttestation(eventStore);

  if (!attestation.promoted && !attestation.skipped) {
    console.error(
      JSON.stringify(
        { ok: false, step: "attestation", reason: attestation.blockedReason, attestation },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        asOf,
        ratification: {
          emitted: ratification.ratified,
          skippedIdempotent: ratification.skipped,
          gatePresent: ratification.gatePresent,
          dimensionsFound: ratification.dimensionsFound,
        },
        attestation: {
          infosecPromoted: attestation.promoted,
          infosecSkippedIdempotent: attestation.skipped,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
