// scripts/run-fx-privacy-attestation.ts
//
// One-shot Information-Officer privacy-dimension attestation driver for
// prd:bank:fx:otc-vanilla.
//
// Sequence (each idempotent):
//   1. GATE A — DSAR lifecycle event types (DSARReceived / DSARClosed /
//      DSARExtended) are REGISTERED in EVENT_TYPE_REGISTRY with typed payload
//      schemas (F-032: an unregistered event type is not substrate).
//   2. GATE B — the DSAR SLA state on the canonical store is clean: the
//      register projection folds and 0 open DSARs are past their POPIA s.23 /
//      PAIA s.25 deadline (a breached statutory clock must be remediated, not
//      attested over). The watchdog emit runs as part of the gate so any gap
//      would also be LOUD (SubstrateAlert{integrity}).
//   3. GATE C — the POPIA s.11 lawful-basis control has fired on the live
//      flow: ≥1 LawfulProcessingRegistered or PopiaConsentRecorded event
//      exists on the canonical store.
//   4. Promote privacy → implementation-attested with tracked deferred gaps.
//
// Over-attestation is the failure mode: if any gate fails, the privacy
// dimension is NOT promoted and the driver exits non-zero with the reason.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/run-fx-privacy-attestation.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; POPIA 4/2013 ss.11, 23–25, 72.
// Author: Iris (Information Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { EVENT_TYPE_REGISTRY } from "../platform/event-store/registry";
import { runFxPrivacyAttestation } from "../platform/markets/products/npa-fx-privacy-attestation";
import { foldDsarRegister } from "../platform/privacy/dsar-register";
import { emitDsarSlaAlerts } from "../platform/privacy/dsar-sla-watchdog";

function countEvents(type: string): number {
  let n = 0;
  for (const _ of eventStore.replay({ type })) n += 1;
  return n;
}

if (import.meta.main) {
  const asOf = clock.now();

  // GATE A — registration (F-032).
  const required = ["DSARReceived", "DSARClosed", "DSARExtended"] as const;
  const missingRegistration = required.filter((t) => {
    const row = EVENT_TYPE_REGISTRY.find((r) => r.type === t);
    return !row || !row.payloadSchema;
  });

  // GATE B — SLA state on the canonical store (and loud watchdog pass).
  const register = foldDsarRegister(eventStore, asOf);
  const breached = register.filter((e) => e.status === "open" && e.slaState === "breached");
  const watchdog = emitDsarSlaAlerts(eventStore, asOf);

  // GATE C — lawful-basis control evidence (POPIA s.11).
  const lawfulProcessing = countEvents("LawfulProcessingRegistered");
  const popiaConsent = countEvents("PopiaConsentRecorded");
  const lawfulBasisEvidence = lawfulProcessing + popiaConsent;

  const gateFailures: string[] = [];
  if (missingRegistration.length > 0) {
    gateFailures.push(
      `GATE A failed — unregistered / schema-less DSAR event types: ${missingRegistration.join(", ")} (F-032)`,
    );
  }
  if (breached.length > 0) {
    gateFailures.push(
      `GATE B failed — ${breached.length} open DSAR(s) past the statutory deadline: ${breached.map((e) => e.dsarId).join(", ")} — remediate, do not attest over a breached clock`,
    );
  }
  if (lawfulBasisEvidence === 0) {
    gateFailures.push(
      "GATE C failed — no LawfulProcessingRegistered or PopiaConsentRecorded event on the canonical store; the s.11 lawful-basis control has never fired on the live flow",
    );
  }

  if (gateFailures.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason:
            "privacy attestation GATE failed — NOT promoting (over-attestation is the failure mode)",
          gateFailures,
          dsarRegister: { total: register.length, breached: breached.length },
          lawfulBasisEvidence: { lawfulProcessing, popiaConsent },
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const attestation = runFxPrivacyAttestation(eventStore);

  console.log(
    JSON.stringify(
      {
        ok: true,
        asOf,
        gates: {
          a_registration: { required: [...required], missing: [] },
          b_dsarSla: {
            registerSize: register.length,
            openBreached: 0,
            watchdogEmitted: watchdog.emitted,
            watchdogSkipped: watchdog.skipped,
          },
          c_lawfulBasis: { lawfulProcessing, popiaConsent },
        },
        attestation: {
          privacyPromoted: attestation.promoted,
          privacySkippedIdempotent: attestation.skipped,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
