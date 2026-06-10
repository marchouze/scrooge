// scripts/build2-fx-forwards-trading-fvtpl.ts
//
// Build-2 of the FX OTC umbrella attestation-completion roadmap
// (D-FX-OTC-NPA-SCOPE-EXPANSION §1, accounting dimension).
//
// CEO-ratified treatment (this session): the umbrella's FX forwards/swaps are
// held for TRADING (FVTPL), not hedge-designated. Two consequences for the
// accounting dimension's tracked deferred gaps:
//
//   1. `fx-forward-points-accrual` (IAS 21 §28 time-value vs intrinsic split)
//      is CLOSED as N/A-for-trading: a trading FVTPL forward is marked in full
//      (intrinsic + forward points) through P&L by the daily revaluation
//      (FxPositionRevalued → PR-FX-002). The time-value/intrinsic split is only
//      required for HEDGE-DESIGNATED forwards (IFRS 9 §6.5.16 cost-of-hedging),
//      which this product is not.
//
//   2. `fx-swap-far-leg-posting` is REPLACED by a sharper, code-grounded gap.
//      Investigation found that ALL three FX accounting rules — PR-FX-002
//      (revaluation), PR-FX-PRIN (principal settlement) and
//      PR-FX-LIFECYCLE-CLOSE (realised close) — are gated `instrument_type:
//      "FX-spot"`. So forward/swap accounting is absent across the board, not
//      just at booking. Under FVTPL a forward/swap is a derivative (no gross
//      booking at trade date); the fix is to WIDEN those three rules to cover
//      FX-forward/FX-swap (with the rule version ceremony) — a Bea/CFO build,
//      not improvised here.
//
// Records the treatment decision and re-attests the accounting dimension
// (implementation-attested) carrying the single sharpened deferred gap.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/build2-fx-forwards-trading-fvtpl.ts
//
// Authority: D-FX-FORWARDS-TRADING-FVTPL (CEO session-delegation 2026-06-10);
//            D-FX-OTC-NPA-SCOPE-EXPANSION; D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Scrooge-coordinated session for marc@tgv.co.za · Bea (Accounting policy engineer, finance).

import { clock, eventStore } from "../platform/composition";
import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const DIMENSION = "accounting";
// Later than the build-1 accounting upgrade (T12:00:00 same day) so latest-wins
// folds (which keep the earlier event on ties) pick up this re-attestation.
const AS_OF = "2026-06-10T18:00:00.000Z";
const DECISION_ID = "D-FX-FORWARDS-TRADING-FVTPL";

// 1. Record the CEO-ratified accounting treatment (session-delegation).
recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "FX forwards/swaps on prd:bank:fx:otc-vanilla are trading (FVTPL), not hedge-designated",
    category: "finance",
    recommendation:
      "Treat the umbrella's FX forwards/swaps as held-for-trading at FVTPL. The full forward (intrinsic + forward points) marks through P&L via daily revaluation; no IAS 21 §28 / IFRS 9 §6.5.16 time-value-vs-intrinsic split is required (that applies only to hedge-designated forwards, which this product is not). Close the fx-forward-points-accrual deferred gap as N/A-for-trading. The residual accounting gap is that PR-FX-002 / PR-FX-PRIN / PR-FX-LIFECYCLE-CLOSE are FX-spot-only and must be widened to FX-forward/FX-swap (FVTPL derivative MTM + settlement) under the rule version ceremony.",
    rationale:
      "Institutional FX trading book. FVTPL is the default IFRS 9 classification (held for trading). Forward-points separation is a cost-of-hedging concept that does not apply absent hedge designation. Surfacing the precise residual (all FX posting rules are spot-gated) corrects the earlier vague 'swap far-leg' framing.",
    citations: [DECISION_ID, "D-FX-OTC-NPA-SCOPE-EXPANSION", "IFRS-9", "IAS-21"],
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

// 2. Sharpened residual deferred gap (replaces fx-forward-points-accrual + the
//    vague fx-swap-far-leg-posting).
const DEFERRED_GAPS: ProductDeferredGap[] = [
  {
    gapId: "fx-forward-swap-fvtpl-posting-rules",
    title:
      "Widen FX posting rules PR-FX-002 (reval) / PR-FX-PRIN (settlement) / PR-FX-LIFECYCLE-CLOSE (realised close) from FX-spot-only to FX-forward/FX-swap (FVTPL derivative MTM + settlement cash); rule version ceremony",
    owner: "Bea (Accounting policy engineer, finance)",
    targetTrigger: "forward/swap go-live (first FX-forward or FX-swap trade booked)",
    citations: ["D-FX-FORWARDS-TRADING-FVTPL", "D-FX-OTC-NPA-SCOPE-EXPANSION", "IFRS-9", "IAS-21"],
  },
];

const provenance = buildPhaseFixtureTag({
  sourceLineage: "platform:npa-attestation-runner",
  variant: `npa-dimension-upgrade:${PRODUCT_ID}:${DIMENSION}:fvtpl`,
  tags: ["npa-gate", "dimension-upgrade", "deferred-gaps", "fvtpl", PRODUCT_ID],
});

eventStore.append({
  ...makeProductDimensionAttested({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:bea:accounting" },
    citations: [
      "D-FX-FORWARDS-TRADING-FVTPL",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "dimension:accounting",
    ],
    payload: {
      productId: PRODUCT_ID,
      dimension: DIMENSION,
      result: "implementation-attested",
      citationChain: [
        "D-FX-FORWARDS-TRADING-FVTPL",
        "D-FX-OTC-NPA-SCOPE-EXPANSION",
        "Policies/accounting-policy-v1.md",
        "IAS-21",
        "IFRS-9",
      ],
      deferredGaps: DEFERRED_GAPS,
    },
  }),
  provenance,
});

logger.info(
  {
    decision: DECISION_ID,
    productId: PRODUCT_ID,
    dimension: DIMENSION,
    closedGap: "fx-forward-points-accrual (N/A for trading/FVTPL)",
    residualGap: DEFERRED_GAPS.map((g) => g.gapId),
    at: clock.now(),
  },
  "build-2: recorded trading/FVTPL treatment; closed forward-points gap; sharpened residual to forward/swap FVTPL posting-rule widening",
);
process.exit(0);
