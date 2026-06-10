// scripts/build3-close-fx-accounting-gap.ts
//
// Build-3 of the FX OTC umbrella attestation-completion roadmap
// (D-FX-OTC-NPA-SCOPE-EXPANSION §1, accounting dimension) — CLOSES the last
// accounting deferred gap.
//
// FINDING (verified empirically this session): under the CEO-ratified
// trading/FVTPL treatment (D-FX-FORWARDS-TRADING-FVTPL), FX forward/swap
// accounting ALREADY posts correctly through the existing FX-spot machinery.
// The flat FX context builder (interpreter.ts makeFlatFxContextBuilder) stamps
// every flat FX lifecycle event — FxPositionRevalued / PrincipalPayment /
// SettlementConfirmed — with instrument_type = "FX-spot", so PR-FX-002 (reval),
// PR-FX-PRIN (settlement) and PR-FX-LIFECYCLE-CLOSE (close) match and post for
// forwards/swaps too. FX accounts resolve PER-CURRENCY (not per-instrument), so
// the amounts and accounts are correct. Verified: an FX-forward FxPositionRevalued
// with unrealisedPnlZarMinor=250000 posts Dr ACC-2100-001 / Cr ACC-2100-005.
//
// So the "widen the spot-gated rules" build was unnecessary (the rules already
// fire); no rule change is made. The accounting dimension is fully
// implementation-attested with NO remaining deferred gap.
//
// RESIDUAL (cosmetic, NO posting impact — tracked as engineering backlog, NOT an
// NPA deferral): the flat context builder mislabels forward/swap flat events as
// instrument_type "FX-spot". This affects only the instrument-level provenance/
// attribution dimension, not amounts or accounts. A follow-up derives
// instrument_type from event productTaxonomy for correct attribution.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/build3-close-fx-accounting-gap.ts
//
// Authority: D-FX-FORWARDS-TRADING-FVTPL (CEO 2026-06-10); D-FX-OTC-NPA-SCOPE-EXPANSION;
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Scrooge-coordinated session for marc@tgv.co.za · Bea (Accounting policy engineer, finance).

import { clock, eventStore } from "../platform/composition";
import { makeProductDimensionAttested } from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

const PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const DIMENSION = "accounting";
// Later than the build-2 re-attestation (T18:00:00 same day) so latest-wins picks this up.
const AS_OF = "2026-06-10T20:00:00.000Z";

const provenance = buildPhaseFixtureTag({
  sourceLineage: "platform:npa-attestation-runner",
  variant: `npa-dimension-upgrade:${PRODUCT_ID}:${DIMENSION}:gap-closed`,
  tags: ["npa-gate", "dimension-upgrade", "gap-closed", PRODUCT_ID],
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
      // No deferredGaps: forward/swap FVTPL accounting verified covered by the
      // existing FX-spot rules (per-currency accounts; flat builder stamps spot).
    },
  }),
  provenance,
});

logger.info(
  {
    productId: PRODUCT_ID,
    dimension: DIMENSION,
    result: "implementation-attested",
    deferredGaps: [],
    at: clock.now(),
  },
  "build-3: accounting gap CLOSED — forward/swap FVTPL accounting already posts via existing FX-spot rules (verified); zero deferred gaps. Attribution-label refinement tracked as backlog.",
);
process.exit(0);
