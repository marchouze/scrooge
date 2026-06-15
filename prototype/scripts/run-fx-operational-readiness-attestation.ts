// scripts/run-fx-operational-readiness-attestation.ts
//
// One-shot operational-readiness dimension attestation driver for
// prd:bank:fx:otc-vanilla (Tomas, Operations and payments engineer, engineering).
//
// Implements and gates both gaps identified in the operational-readiness
// design-attested hold:
//
//   GAP 1 — Any-pair nostro designation substrate (fail-closed):
//     Verifies the nostro routing registry resolves designated currencies and
//     fails-closed for undesignated ones. A trade in an undesignated currency
//     is REJECTED (NostroDesignationMissing event); never routed to suspense.
//
//   GAP 2 — Forward and swap far-leg runbooks (typed events + handlers):
//     Verifies NostroDesignationMissing, FxForwardDefaulted, and
//     FxForwardExtensionRequested are in the TYPED_EVENT_TYPES registry (F-032).
//     Handler functions in platform/markets/fx/otc-failure-handlers.ts are the
//     coded runbooks for each failure scenario.
//
//   NDF DEFERRED: NDFs are not in v1.0 scope. Tracked as "fx-ndf-runbooks".
//
// Run against the SHARED canonical store (BANK_EVENT_DB=$HOME/.local/share/bank/event.db):
//   bun run scripts/run-fx-operational-readiness-attestation.ts
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO, 2026-06-15);
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; PROC-OPS-SFBCP-01 v0.2.

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { runFxOpsReadinessAttestation } from "../platform/markets/products/npa-fx-operational-readiness-attestation";

if (import.meta.main) {
  const asOf = clock.now();

  const result = runFxOpsReadinessAttestation(eventStore);

  console.log(
    JSON.stringify(
      {
        ok: result.promoted || result.skipped,
        asOf,
        attestation: {
          operationalReadinessPromoted: result.promoted,
          operationalReadinessSkippedIdempotent: result.skipped,
          blockedReason: result.blockedReason ?? null,
        },
        gates: {
          gate1NostroCoverage: {
            ok: result.nostroCoverage.ok,
            designatedCount: result.nostroCoverage.designatedCount,
            failClosedWorks: result.nostroCoverage.failClosedWorks,
            detail: result.nostroCoverage.detail ?? null,
          },
          gate2FailureTypesRegistered: {
            ok: result.failureTypesRegistered.ok,
            detail: result.failureTypesRegistered.detail ?? null,
          },
        },
      },
      null,
      2,
    ),
  );

  if (!result.promoted && !result.skipped) {
    process.exit(1);
  }
  process.exit(0);
}
