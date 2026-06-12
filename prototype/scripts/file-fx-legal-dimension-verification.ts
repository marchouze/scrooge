// scripts/file-fx-legal-dimension-verification.ts
//
// RMS Phase 3 filing for the FX OTC umbrella NPA legal-dimension verification
// record (documentation gate + opinion-refresh watchdog + attestation). The
// record body is INLINE (document store is the canonical home per
// D-RMS-PHASE-4).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Run against the SHARED canonical store:
//   bun run scripts/file-fx-legal-dimension-verification.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-RMS-PHASE-3 (active).
// Author: Imani (Legal-as-code engineer, engineering) — governance owner
//         Devon (COO, interim, pending future GC).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:imani:fx-legal-dimension-verification:2026-06-12";

const body = `# FX OTC umbrella NPA — legal dimension: documentation gate + opinion watchdog + attestation

**Product:** \`prd:bank:fx:otc-vanilla\` v1.0.1 (OTC · spot/forward/swap · 7-currency set · institutional / professional only)
**Author:** Imani (Legal-as-code engineer, engineering)
**Governance owner:** Devon (COO, interim, pending future GC)
**Dispatched by:** Scrooge (Chief of Staff), brief \`brief:imani:otc-vanilla-fx-legal-legaldocumentationsigned-pr:2026-06-12\`
**Authority:** D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11); D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-FX-OTC-NPA-SCOPE-EXPANSION; D-NEW-PRODUCT-APPROVAL-POLICY §5; ORG-CS3-001 (FSCA Conduct Standard 3/2018 §3)

## Held state this pass closes

The per-dimension verification pass v2 (#1213) correctly HELD legal design-attested: "no ISDA/legal-doc gate on order path; opinion-refresh SLA unenforced; FAIS s.45 pending counsel." Substrate existed ungated: \`LegalDocumentationSigned\` + \`JurisdictionalOpinionRefreshed\` event types (Imani G-9 schema completeness pack), the \`isdaTracker\` projection — but the sync pre-trade gateway had NO legal-documentation check, the canonical store had 0 \`LegalDocumentationSigned\` events against 19 sim netting sets, and nothing monitored the annual netting-opinion refresh.

## What was built (all code-level, this pass)

1. **Legal-documentation pre-trade gate — FAIL-CLOSED, ENFORCED.** New 8th gateway check \`documentation\` in \`dashboard/markets-fx-gateway.ts\` (after suitability, before credit-limit; first-rejection-wins order preserved), backed by \`platform/markets/legal/legal-documentation-gate.ts\`: a counterparty with no \`LegalDocumentationSigned\` of record for an ISDA Master (2002/2025) or FX-bilateral form is REJECTED. \`"none-listed"\` and custody/repo forms (GMRA/GMSLA) do NOT admit. This is the order-path enforcement of ORG-CS3-001 (written trading-relationship agreement BEFORE any OTC derivative transaction), mirroring the credit-limit (#1177) and suitability (#1221) fail-closed posture. No fail-open Decision was needed — the recommended fail-closed posture was implemented as-is.
2. **Build-phase fixture signings.** \`scripts/register-sim-fx-legal-documentation.ts\` emitted 19 \`LegalDocumentationSigned{agreementType:"isda-2002", csaPresent:false, nettingEnforceable:true}\` events (one per netting-set / live-book counterparty) on the canonical store, with \`build-phase-fixture\` provenance — the documentary counterpart of the simulated netting sets (D-FX-SA-CCR-BUILD-PHASE-ACTIVATION), SIMULATED and NOT a production legal claim. The RFQ path therefore still functions; real executions are the tracked gap \`fx-real-isda-execution\`.
3. **Opinion-refresh annual watchdog — MONITORING, not order-path.** \`platform/markets/legal/opinion-refresh-watchdog.ts\` (#1102 expected-event-watchdog pattern), wired into the dashboard derive cycle: every counterparty-with-ISDA must be covered by a \`JurisdictionalOpinionRefreshed\` whose opinionDate is within 12 months (class-level \`coversCounterparties: []\` opinions cover all). Missing/stale → \`SubstrateAlert{alertClass:"integrity", severity:"medium"}\` — deliberately MEDIUM so a monitoring SLA finding never trips the CEO-escalation (high+) channel and never blocks an order.

## Attestation gates (driver: scripts/run-fx-legal-attestation.ts, run 2026-06-12)

| Gate | Result |
|---|---|
| A — genuine enforcement (isolated tmp store; eligible + FAIS + credit-seeded probe) | without signing: **rejected at documentation**; with isda-2002 signing: **approved** |
| B — coverage (canonical store) | population 19 authorised FX counterparties, uncovered **0** |
| C — watchdog stands (canonical store) | 19 findings, all \`missing\` — the EXPECTED honest build-phase state (no opinion of record yet; tracked gap \`fx-jurisdictional-opinion-refresh\`) |

Test evidence (\`tests/markets-fx-gateway.test.ts\`, \`tests/fx-opinion-refresh-watchdog.test.ts\`): no signing → reject at \`documentation\` with ORG-CS3-001 reason; isda-2002 / fx-bilateral admit; none-listed / gmra-2011 do not; first-rejection-wins order intact (eligibility still rejects first when nothing is seeded); watchdog missing/stale/fresh/class-level/per-counterparty semantics + medium-severity idempotent alert emission.

## Legal dimension — PROMOTED to implementation-attested

\`ProductDimensionAttested{productId: prd:bank:fx:otc-vanilla, dimension: legal, result: implementation-attested}\` emitted at 2026-06-12T08:00:00.000Z (\`platform/markets/products/npa-fx-legal-attestation.ts\`). Over-attestation is the failure mode: the driver refuses promotion (exit non-zero) if Gate A or B fails.

### Tracked deferred gaps (owner + trigger + citations enforced at write-time)

| gapId | owner | targetTrigger |
|---|---|---|
| \`fx-fais-s45-counsel-opinion\` | Devon (COO, interim, pending future GC) — discharged via external counsel | licence-application external-counsel engagement (FAIS s.45 opinion delivered) |
| \`fx-real-isda-execution\` | Imani (Legal-as-code engineer, engineering) | licence-day counterparty legal onboarding (real ISDA Master + SA Schedule executions, documentHash mandatory) |
| \`fx-jurisdictional-opinion-refresh\` | Imani (Legal-as-code engineer, engineering) | licence-day ISDA opinion subscription — first JurisdictionalOpinionRefreshed filed with opinionDocumentHash |
| \`fx-csa-margin-mechanics\` | Imani (Legal-as-code engineer, engineering) | CSA execution wave at licence-day legal onboarding (Imani G-9 §3: CSA mandatory once forward/IRD margin binds) |

## Recon before/after (canonical store)

- \`recon:npa-deferred-gap-tracking\`: tracked-deferrals **20 → 24** (the 4 legal gaps above), malformed 0 → 0. OK (advisory).
- \`recon:npa-coverage\`: unchanged — OK (advisory), fx-obls=51, unimplemented-fx=9, objective-gaps=2, orphan-proc=77, orphan-cap=1 (92 gaps across axes a–e); the legal gate closes an ORDER-PATH gap, not a graph-axis gap.
- Canonical store: \`LegalDocumentationSigned\` 0 → **19**; FX umbrella dimensions implementation-attested **9 → 10** of 14.
`;

if (import.meta.main) {
  let exists = false;
  for (const ev of eventStore.replay({ type: "RecordFiled" })) {
    if ((ev.payload as { recordId?: string }).recordId === RECORD_ID) {
      exists = true;
      break;
    }
  }
  if (exists) {
    console.log(JSON.stringify({ ok: true, skipped: true, recordId: RECORD_ID }, null, 2));
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
        "ORG-CS3-001",
        "D-RMS-PHASE-3",
      ],
      actor: { type: "service", id: "agent:imani:legal" },
      entity: "LE-ZA-HOZ-BANK",
      metadata: {
        title:
          "FX OTC umbrella NPA — legal dimension: documentation gate + opinion watchdog (PROMOTED implementation-attested, 4 deferred gaps)",
        path: "2026-06-12_imani_fx-legal-dimension-verification.md",
        category: "npa-dimension-verification",
        author: "Imani (Legal-as-code engineer, engineering)",
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
