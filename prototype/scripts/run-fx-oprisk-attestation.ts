// scripts/run-fx-oprisk-attestation.ts
//
// One-shot operational-risk-dimension attestation driver for
// prd:bank:fx:otc-vanilla (Tomas, Operations & payments engineer, engineering;
// governance owner Devon, Chief Operating Officer, governance; op-risk seat).
//
// Sequence:
//   1. GATE 1 (loss capture, isolated probe): the OperationalLossEvent type is
//      registered (F-032) and a captured loss round-trips into the projection.
//   2. GATE 2 (identity enforces, isolated probe): a non-party-of-record
//      counterparty REJECTS at the gateway identity check; a KYC-accepted party
//      of record APPROVES. Runs against THROWAWAY tmp stores (no fabricated
//      events on the canonical log).
//   3. COVERAGE (canonical store): every authorised FX counterparty has an
//      identity-of-record (party-of-record + KYC acceptance), so the live RFQ
//      path still functions after the identity gate is enforced. If any are
//      uncovered, the driver instructs the operator to run
//      scripts/register-sim-fx-counterparty-identity.ts and exits non-zero.
//   4. Promote operational-risk → implementation-attested with tracked deferred
//      gaps (op-RWA gross-income block + loss-distribution model + real
//      onboarding).
//   5. Close Rashida's infosec gap fx-gateway-identity-check-enforcement
//      (re-emit infosec attestation without it; other gaps verbatim).
//
// Over-attestation is the failure mode: if Gate 1 or Gate 2 fails, the
// operational-risk dimension is NOT promoted and the driver exits non-zero.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/run-fx-oprisk-attestation.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; Basel II Annex 9 / BCBS D196 §644; Reg 33.

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { checkCounterpartyIdentityOfRecord } from "../platform/markets/identity/counterparty-identity-gate";
import { runFxInfosecGapClosure } from "../platform/markets/products/npa-fx-infosec-gap-closure";
import { runFxOpRiskAttestation } from "../platform/markets/products/npa-fx-oprisk-attestation";
import {
  isOperationalLossEventRegistered,
  probeIdentityEnforcement,
} from "../platform/markets/products/oprisk-attestation-gates";

/** The authorised FX counterparty population on the canonical store. */
function fxCounterparties(): string[] {
  const out = new Set<string>();
  for (const ev of eventStore.replay({ type: "ISDACSAAssessmentCompleted" })) {
    const p = ev.payload as { counterpartyId?: string };
    if (p.counterpartyId) out.add(p.counterpartyId);
  }
  for (const ev of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = ev.payload as { counterparty?: { partyId?: string } };
    if (p.counterparty?.partyId) out.add(p.counterparty.partyId);
  }
  return [...out].sort();
}

if (import.meta.main) {
  const asOf = clock.now();

  // GATE 1 — loss-capture substrate stands.
  const lossCaptureStands = isOperationalLossEventRegistered();
  // GATE 2 — identity check genuinely enforces.
  const identityProbe = probeIdentityEnforcement();

  if (!lossCaptureStands || !identityProbe.ok) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason:
            "operational-risk attestation GATE failed — loss capture and/or identity enforcement does not genuinely stand; NOT promoting (over-attestation is the failure mode)",
          lossCaptureStands,
          identityProbe,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  // COVERAGE — every authorised FX counterparty must be a KYC-accepted party of
  // record so the live RFQ path still functions after identity enforcement.
  const population = fxCounterparties();
  const uncovered = population.filter(
    (cp) => !checkCounterpartyIdentityOfRecord(eventStore, cp).ok,
  );
  if (population.length > 0 && uncovered.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason:
            "operational-risk attestation COVERAGE failed — authorised FX counterparties lack identity-of-record (run scripts/register-sim-fx-counterparty-identity.ts first); NOT promoting",
          population: population.length,
          uncovered,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const attestation = runFxOpRiskAttestation(eventStore);
  const infosecClosure = runFxInfosecGapClosure(eventStore);

  console.log(
    JSON.stringify(
      {
        ok: true,
        asOf,
        gate1LossCapture: { stands: lossCaptureStands },
        gate2Identity: { enforces: identityProbe.ok, detail: identityProbe.detail ?? null },
        coverage: { population: population.length, uncovered: uncovered.length },
        attestation: {
          operationalRiskPromoted: attestation.promoted,
          operationalRiskSkippedIdempotent: attestation.skipped,
          blockedReason: attestation.blockedReason ?? null,
        },
        infosecGapClosure: {
          closed: infosecClosure.closed,
          skipped: infosecClosure.skipped,
          gapsBefore: infosecClosure.gapsBefore ?? null,
          gapsAfter: infosecClosure.gapsAfter ?? null,
          blockedReason: infosecClosure.blockedReason ?? null,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
