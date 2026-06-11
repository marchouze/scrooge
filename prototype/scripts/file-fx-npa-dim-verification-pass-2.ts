// scripts/file-fx-npa-dim-verification-pass-2.ts
//
// RMS Phase 3 filing for the FX OTC umbrella NPA per-dimension verification
// pass v2. The record body is INLINE (no tree render to sweep later — the
// document store is the canonical home per D-RMS-PHASE-4).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Run against the SHARED canonical store (resolve-event-db-boot shim):
//   bun run scripts/file-fx-npa-dim-verification-pass-2.ts
//
// Authority: D-FX-NPA-VERIFICATION-PASS-2-DISPATCH (CEO session-delegation
//            2026-06-11); D-RMS-PHASE-3 (active).
// Author: Saskia (Head of Global Markets, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:saskia:fx-npa-dim-verification-pass-2:2026-06-11";

const body = `# FX OTC umbrella NPA — per-dimension verification pass v2

**Product:** \`prd:bank:fx:otc-vanilla\` v1.0.1 (OTC · spot/forward/swap · 7-currency set · institutional/professional only)
**Author:** Saskia (Head of Global Markets, governance)
**Dispatched by:** Scrooge (Chief of Staff), brief \`brief:saskia:otc-vanilla-fx-per-dimension-verification-pass-v:2026-06-11\`
**Authority:** D-FX-NPA-VERIFICATION-PASS-2-DISPATCH (CEO session-delegation 2026-06-11); D-FX-OTC-NPA-SCOPE-EXPANSION; D-NEW-PRODUCT-APPROVAL-POLICY §5
**Method:** re-verify each design-attested dimension at code level (file-level evidence, canonical-store queries); promote only where the institutional-scope substrate genuinely enforces. The v1 pass (PR #1170) correctly promoted nothing; this pass re-grounds every verdict.

## Headline: the v1 gateway blocker is closed

The sync pre-trade gateway (\`dashboard/markets-fx-gateway.ts\`) now ENFORCES five of
its seven checks (v1: one of seven):

| Check | Status | Evidence |
|---|---|---|
| counterparty-eligibility | enforced (since v1) | \`isCounterpartyEligible\` → \`CounterpartyEligibilityScreened\` family, institutional-eligible AND not breached (FAIS s.45 Posture A chain) |
| sanctions | **enforced, fail-on-hit** | \`screenCounterpartySanctions\` screens raw id + synthetic LEI against the blocked list (#1174; ORG-FC-13) |
| credit-limit | **enforced, FAIL-CLOSED** | \`checkHeadroom\` — no loaded limit / exhausted / expired / stale all REJECT (#1177; D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED) |
| capital-impact | **enforced, fail-closed** | \`evaluateCapitalImpact\` vs CRO-ratified pro-forma RWA ceiling; unknown instrument class REJECTS; current RWA read live from \`RwaComputed\` event-of-record (#1188; D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS) |
| funding | **enforced, fail-closed** | \`evaluateFundingImpact\` vs RAS \`appetite:liquidity:lcr\` red boundary (110%) sourced live from the RAS register; non-ZAR-projectable orders REJECT (#1188) |
| identity | still approve-always stub | — |
| suitability | still approve-always stub | — |

\`recon:fx-gateway-threshold-enforcement\` stands guard against regression to
approve-always while D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS is approved.

## Promotions this pass (6) — emitted by \`scripts/run-fx-npa-dim-verification-pass-2.ts\`

| Dimension | Code evidence (verified) | Tracked deferred gaps |
|---|---|---|
| **market-risk** | EOD MTM spot (\`fx-revaluation.ts\`) + forward/swap/NDF (\`fx-forward-revaluation.ts\`); multi-pair historical-simulation VaR/SVaR/ES over the whole live FX book (\`var-engine.ts\` is risk-factor-generic, operating-book-filtered, cancellation-aware, no silent zeros) on a daily 18:30 UTC cadence (\`rohan-market-risk-measure\`) + \`mr-1-fx-var-measure\` staleness watchdog; NOP via BA310 period close; RAS B2 feeders. v1's "multi-pair VaR design-only" no longer holds. | \`fx-forward-curve-live-feed\` (Ravi — live curve feed); \`fx-ois-discounting\` (Ravi — OIS discounting replaces flat-discount) |
| **credit-risk** | Pre-trade credit-limit FAIL-CLOSED in the gateway via \`checkHeadroom\` reading the same store it writes; SA-CCR (RC+PFE+α→EAD) production driver live → 2 \`CcrEadComputed\` in the canonical store (2026-06-11); EAD FX-converted before CreditRWA (D-FX-EAD-FX-CONVERSION); classification reader \`counterparty-classification.ts\` with prudent corporate-non-ig 100% interim fallback (D-FX-CCR-INTERIM-CONSERVATIVE-RWA) | \`fx-counterparty-basel-class-values\` (Helena, CRO — value-assignment run in flight, parallel brief); \`fx-sa-ccr-daily-cadence\` (Rohan — register the EOD driver as a scheduled handler) |
| **liquidity-risk** | Funding gateway check enforced vs RAS red boundary sourced live from the RAS register, sanity-checked ≥ BCBS 238 100%; BA300 LCR period close wired with FX-rate enrichment (D-BA300-LCR-FX-ENRICHMENT, #1180) | \`fx-gateway-live-lcr-observation\` (Ravi → Eitan — gateway currently evaluates the build-phase baseline LCR constant, \`currentLcrPct: null\`) |
| **capital** | Capital-impact gateway check enforced vs ratified ceiling ((R300m − R100m) / 12.0%), fail-closed; current RWA from \`RwaComputed\` event-of-record (\`latestRwaComputedTotalMinor\`); credit RWA = Σ EAD×CRE20 off SA-CCR EAD; market RWA = BA320×12.5; BA700 reads the event-of-record; \`recon:rwa-computed-sourcing\` standing | \`fx-op-rwa-gross-income\` (Camille, CFO + Bea — bank-wide op-RWA placeholder pending revenue-start gross income) |
| **aml** | Sanctions pre-trade check live + fail-on-hit (raw id + LEI), alongside the fail-closed institutional-eligibility screen; licence-day live-feed integration already named in code with authority (ORG-FC-13) | \`fx-live-sanctions-feeds\` (Zara, CCO + Mira — UN/OFAC/EU/HMT/POCDATARA via D-SANCTIONS-SCREENING-SUBSTRATE at licence-day); \`fx-edd-str-substrate\` (Zara, CCO — EDD/STR/CTR/TPR bind at licence-day FIC registration) |
| **model-risk** | Spot = live quotes, no model (SR 11-7 definition not met — same basis as the equity/repo precedent). \`model:fx-forward-irp-v1\` carries \`ModelValidationApproved\` (Nadia, Independent-validation engineer, second line; 2026-05-27, canonical store) — the v1 blocker is factually closed. VaR/SVaR/ES suite validated 2026-05-30 (\`model:market-risk-var-hs-v1\`/\`-svar-\`/\`-es-\`); \`pnl-attribution-fx-v1\` validated. Options = M5, out of approved scope. | \`fx-forward-model-revalidation-live-curve\` (Nadia — revalidate on the input-regime change when the live curve replaces the static seed) |

## Held design-attested (6) — grounded reasons

| Dimension | Why NOT promoted |
|---|---|
| **conduct** | The gateway \`suitability\` check is still an approve-always stub. The conduct surveillance handler (\`rohan-conduct-risk-events\`) is registered but materially INERT in production: the canonical store holds 54 \`ConflictOfInterestDisclosed\` yet ZERO \`BestExecutionVerified\`/\`Breached\` and ZERO \`FaisClassificationSuitabilityChecked\` events — best-execution never fired (probable rate-extraction defect; reference rate also defaults to the executed rate → structurally zero spread), and FAIS suitability cannot fire with zero \`CounterpartyFaisClassified\` events in the store. Institutional eligibility IS enforced (D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL), but promoting on one live control while the surveillance layer is inert would be over-attestation. Needs: best-ex fire-path fix + benchmark reference feed, FAIS classification population, and Zara (Chief Compliance Officer, governance) conduct-posture sign-off that eligibility subsumes suitability for institutional-only scope. |
| **legal** | No change since v1: \`LegalDocumentationSigned\` / \`JurisdictionalOpinionRefreshed\` exist as event types but no legal-doc (ISDA) gate is wired into the order path; opinion-refresh SLA unenforced; FAIS s.45 professional-classification citation pending external counsel (licence-application moment). Owner of the unlock: Imani (Legal-as-code engineer, engineering). |
| **operational-risk** | No change since v1: no loss-distribution / BIC engine; no op-risk pre-trade or post-trade gate; the gateway \`identity\` check is an approve-always stub. Settlement/confirmation machinery is real but the dimension's risk-quantification and KRI substrate is absent. |
| **infosec** | \`senna-m1-trading-stack-threat-model\` registers four \`ThreatModelDimensionRegistered\` dimensions + a \`SecurityGateRegistered\` M2 gate, but ratification escalates to Rashida (Chief Information Security Officer, governance) by design — the threat-model gate is a CISO seat-owned decision (decision-authority routing table), not Global Markets'. Zero-trust posture remains unenforced on the trading path. Needs the Rashida ratification decision before promotion. |
| **privacy** | Weekly POPIA s.19–22 snapshot is visibility only; no enforcement gate, no DSAR SLA. POPIA covers juristic persons, so institutional-only scope does not void the dimension. Owner of the unlock: Iris (Information Officer, governance). |
| **tax** | Institutional precedent holds: tax is deferred to revenue-start (Yael, Tax engineer — mandate paused) across ALL five existing products; none is tax implementation-attested. Promoting FX alone would be incoherent. |

## Attestation-state movement

- Before (canonical store, 2026-06-11): **2 / 14** implementation-attested (accounting; operational-readiness) · tracked deferrals: 1
- After this pass: **8 / 14** implementation-attested (+ market-risk, credit-risk, liquidity-risk, capital, aml, model-risk) · tracked deferrals: 10 (1 prior + 9 new)
- Recon: \`recon:npa-deferred-gap-tracking\` inventories every gap (owner + trigger + citations enforced at write-time); \`recon:npa-coverage\` advisory axes unchanged by attestation events.

## Residual worklist surfaced by this pass (not NPA deferrals)

1. Conduct surveillance inert-control finding: best-execution events never emitted despite the handler running (rate-extraction path) — engineering defect candidate for Rohan (Risk engineer, engineering) / Kai (Trading systems engineer, engineering).
2. Gateway \`identity\` + \`suitability\` stubs — the two remaining approve-always checks.
3. \`CounterpartyFaisClassified\` population — prerequisite for the FAIS suitability check ever firing.
`;

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (import.meta.main) {
  if (alreadyFiled) {
    console.log(`[file-fx-npa-dim-verification-pass-2] ${RECORD_ID} already filed — skipping.`);
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
        "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
        "D-FX-OTC-NPA-SCOPE-EXPANSION",
        "D-NEW-PRODUCT-APPROVAL-POLICY",
        "D-RMS-PHASE-3",
      ],
      actor: { type: "service", id: "agent:saskia:head-of-global-markets" },
      entity: "LE-ZA-HOZ-BANK",
      metadata: {
        title: "FX OTC umbrella NPA — per-dimension verification pass v2 (6 promotions, 6 held)",
        path: "2026-06-11_saskia_fx-npa-dim-verification-pass-2.md",
        category: "npa-dimension-verification",
        author: "Saskia (Head of Global Markets, governance)",
        date: "2026-06-11",
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
