// scripts/file-fx-infosec-ratification-verification.ts
//
// RMS Phase 3 filing for the FX OTC umbrella NPA infosec-dimension
// verification record: CISO threat-model ratification + attestation. The
// record body is INLINE (document store is the canonical home per
// D-RMS-PHASE-4).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Run against the SHARED canonical store:
//   bun run scripts/file-fx-infosec-ratification-verification.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-RMS-PHASE-3 (active).
// Author: Rashida (Chief Information Security Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:rashida:fx-infosec-ratification-verification:2026-06-12";

const body = `# FX OTC umbrella NPA — infosec dimension: CISO threat-model ratification + attestation

**Product:** \`prd:bank:fx:otc-vanilla\` v1.0.1 (OTC · spot/forward/swap · institutional / professional only)
**Author:** Rashida (Chief Information Security Officer, governance) — engineering support: Senna (Security engineer, engineering)
**Dispatched by:** Scrooge (Chief of Staff), brief \`brief:rashida:otc-vanilla-fx-infosec-ciso-threat-model-ratific:2026-06-12\`
**Authority:** D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11); D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-NEW-PRODUCT-APPROVAL-POLICY §5; PA/FSCA Joint Standard 2 of 2024; CLAUDE.md Principle 4

## What was held, and why

The per-dimension verification pass v2 (#1213) correctly HELD infosec design-attested: the M1
trading-stack threat model was registered as events of record (four \`ThreatModelDimensionRegistered\`
dimensions + one \`SecurityGateRegistered\` M2 gate, emitted by \`senna-m1-trading-stack-threat-model\`
on 2026-05-08) but ratification is a CISO seat-owned decision (decision-authority routing table)
that had never been taken. The expected ratification event named in the handler's prose
(\`ThreatModelGateApproved\`) was never defined; the registered, ratification-shaped type
\`ThreatModelGateDecision\` (issuer Rashida, registry/missing-types.ts) existed unused — so no new
event type was needed (F-032 satisfied by reuse, not addition).

## Threat-model coverage review vs today's gateway (code level, canonical store)

The four registered dimensions still cover the right surfaces, but the trading path has GROWN
since registration (2026-05-08). Verified at code level on 2026-06-12:

| Dimension | Registered scope statement | Today | Verdict |
|---|---|---|---|
| \`tm:senna:trading-stack:fix-gateway-stride\` | "FIX-gateway implementation does not yet exist; forward-load anchor" | Still true — no FIX gateway; OTC order flow enters via the synchronous RFQ/pre-trade gateway | NOT stale; forward-load stands |
| \`tm:senna:trading-stack:gateway-zero-trust\` | "Slice-1 default-approve aggregator live (PR #26); zero-trust binds at slice 2" | **Stale in both directions.** The live path (\`dashboard/markets-fx-gateway.ts\`) now runs 7 sequential checks of which SIX enforce: sanctions fail-on-hit (#1174), suitability fail-closed + retail-reject (#1221, FAIS §8D), counterparty-eligibility, credit-limit FAIL-CLOSED (#1177), capital-impact + funding fail-closed vs CRO-ratified schedule (#1188). BUT the architecture diverged: the model assumes an async aggregator + check fan-out with per-check workload identity and capability tokens; the live path is a synchronous in-process pipeline where one gateway actor runs all checks as function calls. \`identity\` remains the sole approve-always stub. | Ratify WITH conditions (1) + (2) |
| \`tm:senna:trading-stack:hsm-order-signing\` | "HSM substrate not yet provisioned; placeholder keys wire-compatible" | Still true | Accepted-open, tracked (condition 3) |
| \`tm:senna:trading-stack:oms-ems-ops-security\` | "Detection pipeline (SIEM/EDR/XDR) + SOAR not yet built; posture only" | Still true; secure-SDLC gates (\`bun run ci\`: typecheck, lint, test, citation gate, recon harnesses) are live | Accepted-open, tracked (condition 4) |

Standing compensating substrate verified live: event-append permission gate ON by default
(T-01, D-T-01-PERMISSION-GATE-SECURE-DEFAULT; \`SecurityGateRegistered\` itself is
permission-controlled), append-only store with as-of replay (Principle 1 tamper evidence),
\`recon:fx-gateway-threshold-enforcement\` standing.

## Seat decision (event of record)

**\`ThreatModelGateDecision\` — outcome \`approved-with-conditions\`** — decisionId
\`TMGD-RASHIDA-TRADING-STACK-M1-2026-06-12\`, threatModelRef
\`gate:senna:m1-trading-stack-threat-model:m2-precondition\`, decidedBy Rashida (Chief Information
Security Officer, governance), as-of 2026-06-12T08:00Z, RUN against the shared canonical store.
Conditions:

1. Gateway \`identity\` check must enforce fail-closed — sole remaining approve-always stub on the order path.
2. Threat model refreshed against the AS-BUILT synchronous in-process gateway at the next quarterly threat-model gate (\`ThreatModelGateCompleted\` cadence) — the registered zero-trust dimension models an async fan-out that is not the live architecture.
3. HSM key custody accepted-open to licence-day / Azure cloud-lift (SARB PA Directive 3 of 2018; ORG-CY-06).
4. Runtime detection (SIEM/EDR/XDR + SOAR) accepted-open to the pre-licence detection substrate (ORG-CY-05 / ORG-CY-08).

The ratification emit is fail-closed in code: \`runFxThreatModelRatification\` refuses to emit
unless all four registered dimensions AND the M2 gate are present in the store the decision is
recorded against. This also discharges the M2 precondition gate ("M2 cannot start until the four
dimensions are reviewed and ratified by Rashida") — subject to the same four conditions.

## Infosec dimension attestation

**PROMOTED implementation-attested** (\`ProductDimensionAttested\`, as-of 2026-06-12T08:00Z),
gated in code on the ratification standing (\`runFxInfosecAttestation\` refuses without it — the
HOLD outcome remains structurally reachable; over-attestation is the failure mode). The four
accepted-open conditions are carried as tracked \`ProductDeferredGap\` entries (owner + trigger +
citations enforced at write-time):

| gapId | owner | trigger |
|---|---|---|
| \`fx-gateway-identity-check-enforcement\` | Kai (Trading systems engineer, engineering) | gateway identity slice enforces fail-closed |
| \`fx-threat-model-sync-gateway-refresh\` | Senna (Security engineer, engineering) | next quarterly threat-model gate |
| \`fx-hsm-key-custody\` | Atlas (Core banking platform architect, engineering) | licence-day / Azure cloud-lift HSM provisioning |
| \`fx-runtime-detection-pipeline\` | Senna (Security engineer, engineering) | pre-licence detection-pipeline substrate |

## Attestation-state movement + recon

- Before (canonical store, 2026-06-12): **9 / 14** implementation-attested · infosec design-attested · tracked deferrals: 13
- After: **10 / 14** implementation-attested (+ infosec) · tracked deferrals: **17** (13 + 4 new)
- \`recon:npa-deferred-gap-tracking\`: 13 → 17 tracked, **0 malformed** before and after
- \`recon:npa-coverage\`: 92 advisory gaps across axes a–e, unchanged (attestation events do not move its axes)

## Residual worklist surfaced (not NPA deferrals)

1. The senna handler prose names \`ThreatModelGateApproved\` as the expected ratification event; the seat decision landed as the registered \`ThreatModelGateDecision\` instead — the handler comment should be re-pointed when next touched.
2. Atlas's planned gate-check (block M2 dispatch until ratification) remains a planned Vera Wave-4 reconciliation; the ratification event it would consume now exists.
`;

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (import.meta.main) {
  if (alreadyFiled) {
    console.log(
      `[file-fx-infosec-ratification-verification] ${RECORD_ID} already filed — skipping.`,
    );
    process.exit(0);
  }

  const result = recordFiled(
    {
      recordId: RECORD_ID,
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
        "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
        "D-FX-OTC-NPA-SCOPE-EXPANSION",
        "D-NEW-PRODUCT-APPROVAL-POLICY",
        "D-RMS-PHASE-3",
        "ORG-CY-01",
        "ORG-CY-03",
      ],
      actor: { type: "service", id: "agent:rashida:chief-information-security-officer" },
      entity: "LE-ZA-HOZ-BANK",
      metadata: {
        title:
          "FX OTC umbrella NPA — infosec dimension: CISO threat-model ratification (approved-with-conditions) + attestation (PROMOTED implementation-attested, 4 deferred gaps)",
        path: "2026-06-12_rashida_fx-infosec-ratification-verification.md",
        category: "npa-dimension-verification",
        author: "Rashida (Chief Information Security Officer, governance)",
        date: "2026-06-12",
      },
    },
    clock.now(),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        recordId: RECORD_ID,
        eventId: result.eventId,
        documentHash: result.documentHash,
        isNewDocument: result.isNewDocument,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
