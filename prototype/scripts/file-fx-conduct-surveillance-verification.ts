// scripts/file-fx-conduct-surveillance-verification.ts
//
// RMS Phase 3 filing for the FX OTC umbrella NPA conduct-dimension verification
// + surveillance-wiring record. The record body is INLINE (document store is the
// canonical home per D-RMS-PHASE-4).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Run against the SHARED canonical store:
//   bun run scripts/file-fx-conduct-surveillance-verification.ts
//
// Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
//   delegation 2026-06-11); D-RMS-PHASE-3 (active).
// Author: Zara (Chief Compliance Officer, governance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:zara:fx-conduct-surveillance-verification:2026-06-11";

const body = `# FX OTC umbrella NPA — conduct dimension: surveillance wiring + attestation

**Product:** \`prd:bank:fx:otc-vanilla\` v1.0.1 (OTC · spot/forward/swap · 7-currency set · institutional / professional only)
**Author:** Zara (Chief Compliance Officer, governance)
**Engineering partner:** Rohan (Markets risk/quant engineer, engineering) — authored the conduct-risk evaluation logic
**Dispatched by:** Scrooge (Chief of Staff), brief \`brief:zara:otc-vanilla-fx-conduct-dimension-wire-inert-cond:2026-06-11\`
**Authority:** D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-delegation 2026-06-11); D-MARKET-CONDUCT; D-FX-OTC-NPA-SCOPE-EXPANSION; D-NEW-PRODUCT-APPROVAL-POLICY §5; FAIS Act 37/2002 §§16–17, §8D, §4

## Root cause (grounded at code level against the canonical store)

The per-dimension verification pass v2 (#1213) correctly HELD conduct design-attested.
Pass-2 speculated a "probable rate-extraction defect". That hypothesis was **wrong**.
The real cause is a **dispatch gap**, not an evaluation defect:

- The conduct handler \`rohan:conduct-risk-events\` is event-driven on \`FxTradeExecuted\`.
- Event-driven handlers are dispatched by the bus, which the runtime ticks **only over events appended inside an agent run** (the run-coupled tick in \`runtime/run.ts\` walks the run's own sequence window), plus the standalone \`bus:tick\` (per-worktree cursor).
- The 44 FX trades were all booked by the **operator / pre-trade-gateway path** (\`dashboard/markets-fx-trade.ts → store.append\`, \`actor: operator\`) — NOT an agent run — so the run-coupled tick never saw them. The standalone cursor advanced over exactly ONE of the 44 (seq 422027, 2026-06-01); the other 43 were never considered.
- Net before fix: 44 \`FxTradeExecuted\`, **0 \`BestExecutionVerified\` / 0 \`BestExecutionBreached\` / 0 \`FaisClassificationSuitabilityChecked\`**. The 54 \`ConflictOfInterestDisclosed\` were all \`CONDUCT-TEST-*\` / \`agent:test:*\` synthetics — NONE tied to a real booked trade. And 0 \`CounterpartyFaisClassified\` in the store, so the FAIS-suitability leg could never fire even when dispatched.

This is the same shape the BA310/BA300 returns solved: those fire reliably because their trigger event (\`AccountingPeriodClosed\`) is emitted *inside* an agent run. The conduct handler's trigger is not.

## Remediation (events-first; no hardcoded verdicts)

1. **Store-scanning surveillance sweep** — \`platform/conduct/fx-conduct-surveillance-sweep.ts\`, dispatched by the scheduled handler \`rohan:conduct-surveillance-sweep\` (daily 18:45 UTC, 15 min after the market-risk measure). It scans for every \`FxTradeExecuted\` lacking a surveillance outcome and evaluates it — decoupling surveillance from bus fan-out timing. The per-trade evaluation was extracted into \`platform/conduct/fx-trade-conduct-evaluation.ts\`, shared by both the event-driven handler and the sweep, so the verdicts cannot drift. Idempotent per (tradeId, checkKind).
2. **Counterparty FAIS classification (CCO decision)** — every FX counterparty on the book is a SARB- or foreign-regulated bank; interbank dealing is a FAIS **market-counterparty** relationship (the lightest appropriateness tier). I classified all 19 as market-counterparty (\`platform/conduct/fx-counterparty-fais-classification.ts\`), recorded as \`CounterpartyFaisClassified\` events. This unlocks the §8D suitability surveillance and the pre-trade suitability gateway admission.
3. **Historical backfill (CCO basis)** — the FAIS §16 best-execution / TCF duty and §8D suitability bound at each trade's execution; a forward-only surveillance layer would leave 44 institutional trades permanently un-surveilled. Best execution is reconstructible from the executed event (the rate is on the trade), so the backfill is a faithful as-of replay. The surveillance events are stamped with the date the control ran (Principle 1: record WHEN the control ran, not a back-dated pretence), each referencing the original tradeId.

## Conduct posture — gateway suitability check (CCO decision)

The sync pre-trade gateway's \`suitability\` check was an **approve-always stub**. I set the posture to **ENFORCE**, not document-around:

- The check now consults the counterparty's FAIS classification. A **retail-client** (which must never appear at an institutional-only venue) is **rejected** as a conduct finding; an **unclassified** counterparty is **rejected fail-closed** (a trade cannot pass suitability without a FAIS category of record).
- Suitability now runs **after** \`counterparty-eligibility\` in the check order: a counterparty not even eligible to trade with the bank should reject at eligibility, not be evaluated for product suitability.
- Institutional / professional scope keeps appropriateness **light** (a market-counterparty / professional-client can transact every in-scope FX product) while the FAIS §16 / TCF **best-execution duty binds on every trade** regardless of category. The positive post-trade \`FaisClassificationSuitabilityChecked\` event-of-record is the durable discharge — a recorded control, not a silent approve.
- Basis: FAIS Act 37/2002 §8D; D-FAIS-SCOPE; D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL; D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH.

## What now fires (canonical store, after backfill — 2026-06-11)

| Surveillance event | Before | After (tied to real booked trades) |
|---|---|---|
| \`FxTradeExecuted\` | 44 | 44 |
| \`CounterpartyFaisClassified\` | 0 | 19 |
| \`BestExecutionVerified\` | 0 | **44** |
| \`BestExecutionBreached\` | 0 | 0 (all in tolerance) |
| \`FaisClassificationSuitabilityChecked\` | 0 | **44** (all suitable — market-counterparty) |
| \`ConflictOfInterestDisclosed\` (real trades) | 0 | **44** |

Best-execution spread is 0 bps for every trade because the build-phase reference rate defaults to the executed rate (single price source) — verified, in-tolerance, but unable to detect off-market execution until an independent benchmark feed lands (tracked deferred gap \`fx-best-execution-reference-benchmark\`).

## Conduct attestation — PROMOTED to implementation-attested

\`ProductDimensionAttested{productId: prd:bank:fx:otc-vanilla, dimension: conduct, result: implementation-attested}\` emitted (\`platform/markets/products/npa-fx-conduct-attestation.ts\`). The attestation driver \`scripts/run-fx-conduct-attestation.ts\` **gates** on surveillance genuinely firing on real booked trades — over-attestation is the failure mode, so promotion is refused (exit non-zero) if best-execution + FAIS-suitability are not actually present on the book. The gate passed (44/44 each).

### Tracked deferred gaps (owner + trigger + citations enforced at write-time)

| gapId | owner | targetTrigger |
|---|---|---|
| \`fx-best-execution-policy-schedule\` | Zara (Chief Compliance Officer, governance) | conduct committee publishes a BestExecutionPolicySchedule event of record |
| \`fx-best-execution-reference-benchmark\` | Rohan (Markets risk/quant engineer, engineering) | independent FX benchmark / mid-rate feed wired as the best-execution reference |
| \`fx-edd-str-substrate\` | Zara (Chief Compliance Officer, governance) | licence-day FIC registration + real-counterparty onboarding |

## Recon

- \`recon:npa-deferred-gap-tracking\`: OK (advisory) — 0 malformed deferrals (the 3 new gaps all carry owner + trigger + citations).
- \`recon:npa-coverage\`: OK (advisory) — unchanged by attestation events.
- \`recon:runtime-handler-sync\`: OK — the new scheduled handler is wired in metadata, callables, package.json script, and a GitHub Actions workflow.
`;

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (import.meta.main) {
  if (alreadyFiled) {
    console.log(
      `[file-fx-conduct-surveillance-verification] ${RECORD_ID} already filed — skipping.`,
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
        "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
        "D-MARKET-CONDUCT",
        "D-FX-OTC-NPA-SCOPE-EXPANSION",
        "D-NEW-PRODUCT-APPROVAL-POLICY",
        "D-RMS-PHASE-3",
      ],
      actor: { type: "service", id: "agent:zara:chief-compliance-officer" },
      entity: "LE-ZA-HOZ-BANK",
      metadata: {
        title:
          "FX OTC umbrella NPA — conduct dimension: surveillance wiring + attestation (PROMOTED implementation-attested, 3 deferred gaps)",
        path: "2026-06-11_zara_fx-conduct-surveillance-verification.md",
        category: "npa-dimension-verification",
        author: "Zara (Chief Compliance Officer, governance)",
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
