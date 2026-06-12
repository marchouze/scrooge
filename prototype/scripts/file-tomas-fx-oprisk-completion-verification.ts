// scripts/file-tomas-fx-oprisk-completion-verification.ts
//
// File the operational-risk-dimension COMPLETION verification record for
// prd:bank:fx:otc-vanilla (RMS Phase 3 RecordFiled; registerKey "documents").
//
// This records the recovery/completion of the prior op-risk run that died
// mid-build (run:tomas:2026-06-12T07-16-49): the recovered substrate was
// verified sound (tsc 0 errors, 46/46 recovered tests pass), the attestation
// driver executed gate-driven against the shared canonical store, and the
// infosec gap fx-gateway-identity-check-enforcement was closed.
//
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-RMS-PHASE-3; D-NEW-PRODUCT-APPROVAL-POLICY §5.

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const body = `# FX OTC-vanilla — operational-risk dimension COMPLETION verification

**Product:** prd:bank:fx:otc-vanilla v1.0.1
**Dimension:** operational-risk (promoted design-attested → implementation-attested)
**Author:** Tomas (Operations & payments engineer, engineering)
**Governance owner:** Devon (Chief Operating Officer, governance; op-risk seat)
**Authority:** D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11)
**Recovery of:** run:tomas:2026-06-12T07-16-49 (died mid-build, closed blocked)

## Recovered substrate — verified sound

- \`platform/event-store/event-types/operational-risk.ts\` — OperationalLossEvent
  payload (Basel business line aligned to BA 400 β-line taxonomy via compile-time
  drift guard; BCBS D196 §644 seven loss-event-type classes; status lifecycle;
  recovery/net). REGISTERED (F-032): event-types/index.ts barrel + TYPED_EVENT_TYPES,
  registry/operational-risk.ts (RETENTION_GOVERNANCE_7Y) + registry/index.ts.
- \`platform/markets/identity/counterparty-identity-gate.ts\` — FAIL-CLOSED identity
  check: requires BOTH party-of-record (CounterpartyEligibilityScreened) AND
  KYC-acceptance (SanctionsClearancePassed or ClientAccepted). Either missing → reject.
- \`dashboard/markets-fx-gateway.ts\` — identity wired at position 1 (was approve-always
  stub), reads the threaded store, first-rejection-wins preserved, identity-specific
  citations on GatewayCheckCompleted.
- \`platform/reporting/operational-loss-projection.ts\` — pure event fold, latest-wins,
  open/closed + per-business-line + per-event-type aggregates, NO capital number.
- \`platform/markets/products/{npa-fx-oprisk-attestation,oprisk-attestation-gates}.ts\`
  + \`scripts/run-fx-oprisk-attestation.ts\` — gate-driven promotion (over-attestation
  is the failure mode); GATE 1 loss-capture round-trip, GATE 2 identity fail-closed +
  not-reject-always, COVERAGE every authorised FX counterparty identity-of-record.
- \`platform/markets/products/npa-fx-infosec-gap-closure.ts\` — reads latest infosec
  attestation of record, removes fx-gateway-identity-check-enforcement, carries other
  gaps verbatim.
- \`scripts/register-sim-fx-counterparty-identity.ts\` — build-phase-fixture identity-of-record.

## Stray-file resolution

\`scripts/run-fx-legal-attestation.ts\` (Imani, Legal-as-code engineer, #1261) carries a
+19-line edit in the recovery patch: seedAdmittableCounterparty now appends
SanctionsClearancePassed. This is NOT a rebase artefact — it is a load-bearing
consequence of enforcing the identity gate at position 1. Imani's Gate-A probe asserts
"without-signing rejects AT documentation; with-signing approves"; without the KYC seed,
both orders reject at identity FIRST (rejectingCheck = "identity", not "documentation"),
so Gate A would fail and Imani's already-merged legal-attestation script would exit 1.
The edit is KEPT and documented (reverting it breaks merged code).

## Verification evidence

- \`bunx tsc --noEmit\` (full project): 0 errors.
- Recovered tests: 46/46 pass across markets-fx-gateway.test.ts,
  npa-fx-oprisk-attestation.test.ts, operational-loss-projection.test.ts (236 expects).
- Identity now REJECTS: an order from a counterparty with no party-of-record / KYC
  acceptance rejects at "identity"; an onboarded KYC-accepted party of record approves.
- Driver executed against shared canonical store ($HOME/.local/share/bank/event.db):
  GATE 1 stands, GATE 2 enforces, coverage 19/19, op-risk PROMOTED implementation-attested
  (as_of 2026-06-12T09:00Z), infosec gap closure 4 → 3 gaps.

## Op-risk tracked deferred gaps (genuine, honest residuals)

1. fx-op-rwa-gross-income — owner Camille (CFO) + Bea; trigger revenue-start + three
   fiscal years audited gross income (op-RWA BIA/TSA genuinely gross-income-blocked).
2. fx-op-risk-loss-distribution — owner Tomas; trigger licence-day op-risk model build
   (LDA/SMA needs multi-year loss-data history; Helena CRO methodology owner).
3. fx-op-risk-real-counterparty-onboarding — owner Niko; trigger licence-day real KYC/CDD
   (identity records are SIMULATED build-phase fixtures).

## Infosec gap-closure outcome

Closed fx-gateway-identity-check-enforcement (Rashida, CISO, ratification condition 1) —
only valid because the identity gate now genuinely enforces. Infosec gaps before: 4
(fx-gateway-identity-check-enforcement, fx-threat-model-sync-gateway-refresh,
fx-hsm-key-custody, fx-runtime-detection-pipeline). After: 3 (the latter three, verbatim).

## Recon

- recon:npa-coverage — OK (advisory).
- recon:npa-deferred-gap-tracking — OK; against shared store 24 tracked-deferrals, 0 malformed.
- recon:runtime-handler-sync — OK (508 asserted, 0 violations; no handler metadata touched).
- recon:fx-gateway-threshold-enforcement — OK.
`;

const recordId = "record:documents:tomas:fx-oprisk-completion-verification:2026-06-12";

const result = recordFiled(
  {
    recordId,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-FX-HELD-DIMS-SEAT-SWEEP",
      "D-RMS-PHASE-3",
      "D-NEW-PRODUCT-APPROVAL-POLICY",
      "brief:tomas:otc-vanilla-fx-op-risk-completion-recover-dead-r:2026-06-12",
    ],
    actor: {
      type: "service",
      id: "agent:tomas:operations-payments",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "FX OTC-vanilla operational-risk dimension COMPLETION verification (recover + finish dead run)",
      path: "2026-06-12_tomas_fx-oprisk-completion-verification.md",
      category: "npa-dimension-verification",
      author: "Tomas (Operations & payments engineer, engineering)",
      date: "2026-06-12",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
