// scripts/build4-fx-supported-currency-set.ts
//
// "Any pair" workstream (D-FX-OTC-NPA-SCOPE-EXPANSION roadmap §2) — FORMALIZE-ONLY
// outcome (CEO-ratified this session): keep the supported FX currency set at 7;
// do not expand the substrate now.
//
// FINDING (grounded in code): the FX substrate already handles "any pair" SAFELY.
// `deriveSupportedCurrencies()` reads the market-data universe (TWELVE_DATA_TARGET_PAIRS
// + SEED_MID_RATES) → 7 currencies (ZAR/USD/EUR/GBP/JPY/CHF/AUD), each with
// dedicated per-currency receivable/payable/nostro COA accounts. Any pair whose
// currency is outside the set account-resolution-misses → FX unresolved-currency
// suspense (ACC-2100-007) + a HIGH-SEVERITY urgent-correction alert, NEVER a
// silent error. `recon:fx-supported-currency-no-suspense` enforces (A) every
// supported currency resolves to a dedicated account and (B) zero stranded
// suspense balance for supported currencies. "Supported" is correctly bounded by
// having a rate source (you cannot MTM a pair with no rate).
//
// So "any pair" is bounded per currency by: rate source + provisioned GL accounts
// + (operationally) a real correspondent nostro relationship. The first two are
// in place for the 7; expansion is gated on correspondent onboarding — a
// licence-day Treasury reality. Decision: keep the set at 7 + the recon-enforced
// suspense/alert fallback; expand as correspondents are onboarded.
//
// Records the decision and attests operational-readiness as implementation-attested
// with the currency-set expansion carried as one tracked deferred gap (owner Eitan).
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/build4-fx-supported-currency-set.ts
//
// Authority: D-FX-SUPPORTED-CURRENCY-SET-V1 (CEO session-delegation 2026-06-10);
//            D-FX-OTC-NPA-SCOPE-EXPANSION; Principles/5-multi-currency-entity-country.md.
// Author: Scrooge-coordinated session for marc@tgv.co.za · Eitan (Treasurer, finance).

import { clock, eventStore } from "../platform/composition";
import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const PRODUCT_ID = "prd:bank:fx:otc-vanilla";
const DIMENSION = "operational-readiness";
const AS_OF = "2026-06-10T22:00:00.000Z";
const DECISION_ID = "D-FX-SUPPORTED-CURRENCY-SET-V1";

const SUPPORTED = "ZAR/USD/EUR/GBP/JPY/CHF/AUD";

recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "FX supported-currency set v1 = 7 majors; pairs beyond route to suspense+alert (formalize, do not expand)",
    category: "product",
    recommendation: `Keep the supported FX currency set at 7 (${SUPPORTED}). Each has a market-data rate source and dedicated per-currency receivable/payable/nostro accounts. Any pair whose currency is outside the set routes to the FX unresolved-currency suspense (ACC-2100-007) + a high-severity alert by design (recon:fx-supported-currency-no-suspense), never a silent error. Do not expand the substrate now; expand the set as correspondent nostro relationships are onboarded (Treasury, licence-day). The umbrella product's currencyPairs:'any' scope is realised as 'any supported pair settles to dedicated accounts; unsupported pairs are flagged for onboarding'.`,
    rationale:
      "'Any pair' cannot mean all ~180 ISO currencies: each requires a rate source AND a real correspondent nostro relationship (Treasury cost/risk). The substrate already handles any pair safely (supported set + recon-enforced suspense/alert fallback). Formalizing the set + fallback is the honest treatment; expansion is a licence-day correspondent-onboarding decision, not build-phase substrate.",
    citations: [
      DECISION_ID,
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "Principles/5-multi-currency-entity-country.md",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

const DEFERRED_GAPS: ProductDeferredGap[] = [
  {
    gapId: "fx-supported-currency-set-expansion",
    title: `FX supported-currency set = 7 (${SUPPORTED}); pairs beyond route to suspense + high-severity alert by design (recon:fx-supported-currency-no-suspense). Expand the set as correspondent nostro relationships are onboarded.`,
    owner: "Eitan (Treasurer, finance)",
    targetTrigger: "licence-day correspondent nostro onboarding (per added currency)",
    citations: [
      "D-FX-SUPPORTED-CURRENCY-SET-V1",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "Principles/5-multi-currency-entity-country.md",
    ],
  },
];

const provenance = buildPhaseFixtureTag({
  sourceLineage: "platform:npa-attestation-runner",
  variant: `npa-dimension-upgrade:${PRODUCT_ID}:${DIMENSION}`,
  tags: ["npa-gate", "dimension-upgrade", "deferred-gaps", "any-pair", PRODUCT_ID],
});

eventStore.append({
  ...makeProductDimensionAttested({
    asOf: AS_OF,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:eitan:treasurer" },
    citations: [
      "D-FX-SUPPORTED-CURRENCY-SET-V1",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "dimension:operational-readiness",
    ],
    payload: {
      productId: PRODUCT_ID,
      dimension: DIMENSION,
      result: "implementation-attested",
      citationChain: [
        "D-FX-SUPPORTED-CURRENCY-SET-V1",
        "D-FX-OTC-NPA-SCOPE-EXPANSION",
        "PROC-OPS-SFBCP-01",
        "Principles/5-multi-currency-entity-country.md",
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
    supportedCurrencies: SUPPORTED,
    deferredGaps: DEFERRED_GAPS.map((g) => g.gapId),
    at: clock.now(),
  },
  "build-4 (any-pair, formalize-only): recorded supported-currency-set v1; operational-readiness → implementation-attested with the correspondent-expansion deferred gap (Eitan, licence-day)",
);
process.exit(0);
