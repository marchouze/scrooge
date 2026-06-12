// scripts/file-fx-privacy-dsar-verification.ts
//
// RMS Phase 3 filing for the FX OTC umbrella NPA privacy-dimension verification
// + DSAR-substrate record. The record body is INLINE (document store is the
// canonical home per D-RMS-PHASE-4).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Run against the SHARED canonical store:
//   bun run scripts/file-fx-privacy-dsar-verification.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-RMS-PHASE-3 (active).
// Author: Iris (Information Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:iris:fx-privacy-dsar-verification:2026-06-12";

const body = `# FX OTC umbrella NPA — privacy dimension: DSAR substrate + attestation

**Product:** \`prd:bank:fx:otc-vanilla\` v1.0.1 (OTC · spot/forward/swap · 7-currency set · institutional / professional only)
**Author:** Iris (Information Officer, governance)
**Dispatched by:** Scrooge (Chief of Staff), brief \`brief:iris:otc-vanilla-fx-privacy-dsar-substrate-sla-watchd:2026-06-12\`
**Authority:** D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11); D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-FX-OTC-NPA-SCOPE-EXPANSION; D-NEW-PRODUCT-APPROVAL-POLICY §5; POPIA 4/2013 ss.1, 11, 23–25, 72; PAIA 2/2000 ss.25–26

## Starting state (grounded at code level against the canonical store)

The per-dimension verification pass v2 (#1213) correctly HELD privacy design-attested: "POPIA snapshot visibility only, no DSAR SLA". Exploration confirmed — with one correction to the brief:

- \`PopiaConsentRecorded\` is code-live (\`domains/customer/onboarding.ts\`, phase-8 popia-recorded gate) but has emitted **zero events on the canonical store**; the live KYC path evidences the POPIA s.11 lawful-basis control via \`LawfulProcessingRegistered\` (**26** on the canonical store). Recorded as tracked deferred gap \`fx-popia-consent-phase-gate-activation\`, not papered over.
- A **partial DSAR family already existed**: \`DSARReceived\` was typed + registered, and the Iris goal-loop (\`runtime/agents/iris-goal-loop.ts\`) plans — and the weekly POPIA controls snapshot counts — a \`DSARClosed\` event that was **never defined nor registered** (recurring F-032 shape; the goal-loop three-way-coherence failure mode).
- No projection of open DSARs, no SLA watchdog, no recon gate.

## Build decision — converge, don't fork

The brief proposed \`DataSubjectAccessRequested\` + \`DsarFulfilled\`. Building those alongside \`DSARReceived\`/\`DSARClosed\` would have created a second parallel DSAR event family (the IRS-event-families defect shape). Seat decision: **converge on the existing family** — define and register the types the substrate already references.

## What was built

1. **\`DSARClosed\`** (\`platform/event-store/event-types/aml-popia-extended.ts\`) — the disposition of record. Outcomes \`fulfilled\` / \`partially-fulfilled\` (s.23(5) severability) / \`refused\`; \`refusalGrounds\` (PAIA Ch.4 grounds via POPIA s.23(4)(a)) is **enforced at write-time** for refused/partial outcomes — a refusal without recorded grounds cannot enter the store.
2. **\`DSARExtended\`** — the one-time response-window extension (POPIA s.25 → PAIA s.26: up to 30 further days on a recorded ground). The SLA grades against the extended deadline (latest-wins).
3. **Both REGISTERED** in \`platform/event-store/registry/missing-types.ts\` with typed payload schemas (F-032), issuer Iris, alongside the existing \`DSARReceived\` row.
4. **DSAR register projection** (\`platform/privacy/dsar-register.ts\`) — pure fold of DSARReceived → DSARExtended* → DSARClosed; grades every open request: \`ok\` / \`approaching\` (≤5 days to deadline) / \`breached\`; closed requests carry \`closedWithinSla\` so a late answer stays visible. Replay-compatible with the goal-loop's legacy \`dsarEventId\` pairing. Malformed/missing deadline on an open request grades \`breached\` (fail-closed).
5. **30-day SLA watchdog** (\`platform/privacy/dsar-sla-watchdog.ts\`) — the expected-event-watchdog pattern (PR #1102), deadline-shaped: each breached open DSAR raises \`SubstrateAlert{alertClass:"integrity", severity:"high"}\`; approaching raises \`severity:"medium"\`; idempotent on alertId. **Proven firing + idempotent in \`tests/dsar-sla-watchdog.test.ts\` (12 tests).**
6. **\`recon:dsar-sla\`** (\`platform/recon/dsar-sla.ts\`, advisory) — read-side inventory: WARN per open-over-SLA, INFO per approaching / late-closed. Wired into \`ci:recon:domain\`.

## Institutional posture (Information Officer)

POPIA s.1 defines "person" to include an existing juristic person: the bank's institutional FX counterparties **are data subjects** and their information **is personal information**. "Institutional-only" is not a privacy exemption. The DSAR right (s.23), correction right (s.24) and the s.72 cross-border transfer conditions bind on this product. The institutional SLA adopted is the PAIA s.25(1) 30-calendar-day decision window (applied via POPIA s.25), extensible once per PAIA s.26 with a recorded ground.

## Privacy attestation — PROMOTED to implementation-attested

\`ProductDimensionAttested{productId: prd:bank:fx:otc-vanilla, dimension: privacy, result: implementation-attested}\` emitted at as_of 2026-06-12T08:00:00.000Z (\`platform/markets/products/npa-fx-privacy-attestation.ts\`). The driver \`scripts/run-fx-privacy-attestation.ts\` **gates** before promoting (over-attestation is the failure mode; exit non-zero on any gate failure):

- **GATE A** — DSARReceived / DSARClosed / DSARExtended all registered with typed schemas: PASSED (missing: []).
- **GATE B** — DSAR SLA state on the canonical store: PASSED (register 0, open-breached 0; watchdog pass ran loud).
- **GATE C** — s.11 lawful-basis control fired on the live flow: PASSED (LawfulProcessingRegistered 26; PopiaConsentRecorded 0 — the zero is why gap 3 below exists).

### Tracked deferred gaps (owner + trigger + citations enforced at write-time)

| gapId | owner | targetTrigger |
|---|---|---|
| \`fx-popia-s72-cross-border-assessment\` | Iris (Information Officer, governance) | licence-day onboarding of real cross-border counterparties (first actual transfer of personal information outside SA) |
| \`fx-dsar-intake-channel-paia-manual\` | Iris (Information Officer, governance) | licence-day (real data subjects; PAIA manual publication obligation activates) |
| \`fx-popia-consent-phase-gate-activation\` | Iris (Information Officer, governance) | 21-phase onboarding orchestrator runs over the live counterparty flow, or a deliberate convergence decision retires one family |

## Recon (before → after, canonical store)

- \`recon:npa-deferred-gap-tracking\`: OK (advisory) — tracked-deferrals **17 → 20** (the 3 privacy gaps), malformed **0 → 0**.
- \`recon:npa-coverage\`: OK (advisory) — fx-obls=51, unimplemented-fx=9, objective-gaps=2, orphan-proc=77, orphan-cap=1 (unchanged by attestation events, as designed).
- \`recon:dsar-sla\`: OK — 0 DSAR(s) on the register, 0 open-over-SLA (new gate, green at birth; on a live breach it WARNs and the watchdog alerts).

## Residual risk statement

With this promotion the FX umbrella privacy dimension rests on a real lifecycle substrate: a DSAR arriving tomorrow lands as \`DSARReceived\`, is visible on the register with its statutory clock, alerts loudly at 5 days out and at breach, and can only close with a lawful recorded disposition. What does NOT yet exist is the public intake mouth (licence-day) and the s.72 per-transfer assessment (activates with real counterparties) — both tracked, neither hidden.
`;

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (import.meta.main) {
  if (alreadyFiled) {
    console.log(`[file-fx-privacy-dsar-verification] ${RECORD_ID} already filed — skipping.`);
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
      ],
      actor: { type: "service", id: "agent:iris:information-officer" },
      entity: "LE-ZA-HOZ-BANK",
      metadata: {
        title:
          "FX OTC umbrella NPA — privacy dimension: DSAR substrate + attestation (PROMOTED implementation-attested, 3 deferred gaps)",
        path: "2026-06-12_iris_fx-privacy-dsar-verification.md",
        category: "npa-dimension-verification",
        author: "Iris (Information Officer, governance)",
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
