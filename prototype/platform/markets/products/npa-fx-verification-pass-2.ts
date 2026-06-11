// platform/markets/products/npa-fx-verification-pass-2.ts
//
// FX OTC umbrella NPA — per-dimension verification pass v2 promotion set
// (side-effect-free platform module; the one-shot driver is
// scripts/run-fx-npa-dim-verification-pass-2.ts, and the grounded evidence map
// is the verification record filed by scripts/file-fx-npa-dim-verification-pass-2.ts).
//
// The v1 pass (PR #1170, filed 2026-06-10) promoted NOTHING because the sync
// pre-trade gateway enforced only counterparty-eligibility. Since then the
// blocker closed at code level (verified this pass):
//
//   - sanctions wired fail-on-hit (#1174, screenCounterpartySanctions)
//   - credit-limit FAIL-CLOSED via checkHeadroom (#1177,
//     D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED)
//   - capital-impact + funding enforced against the CRO-ratified threshold
//     schedule (#1188, D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS; fail-closed)
//   - SA-CCR production driver live over the FX book → CcrEadComputed (#1175)
//   - counterparty Basel-classification substrate (#1176; CRO value-assignment
//     runs in parallel — interim conservative 100% RWA stands,
//     D-FX-CCR-INTERIM-CONSERVATIVE-RWA)
//   - EAD FX-conversion before CreditRWA (#1178); BA300 LCR period close
//     wired (#1180, D-BA300-LCR-FX-ENRICHMENT)
//   - model:fx-forward-irp-v1 + the VaR/SVaR/ES model suite carry
//     ModelValidationApproved events from Nadia (Independent-validation
//     engineer, second line) in the canonical store
//
// PROMOTED (6): market-risk, credit-risk, liquidity-risk, capital, aml,
// model-risk — each with explicit tracked ProductDeferredGap entries where a
// sub-item is deferred (never hollow: the write-time schema enforces owner +
// trigger + citations).
//
// HELD design-attested (6): conduct, legal, operational-risk, infosec,
// privacy, tax — grounded reasons in the filed verification record. No
// promotion is a valid outcome; over-attestation is the failure mode.
//
// Authority: D-FX-NPA-VERIFICATION-PASS-2-DISPATCH (CEO session-delegation
//            2026-06-11); D-FX-OTC-NPA-SCOPE-EXPANSION;
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Brief: brief:saskia:otc-vanilla-fx-per-dimension-verification-pass-v:2026-06-11
// Author: Saskia (Head of Global Markets, governance).

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const PASS2_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than build-4's operational-readiness re-attestation (2026-06-10T22:00)
// so latest-wins folds pick these up.
export const PASS2_AS_OF = "2026-06-11T18:00:00.000Z";

const PASS2_ACTOR = { type: "service" as const, id: "agent:saskia:npa-dimension-verification" };

const PASS_CITATIONS = [
  "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

export interface Pass2Promotion {
  readonly dimension: string;
  readonly citationChain: readonly string[];
  readonly deferredGaps?: readonly ProductDeferredGap[];
}

/** Dimensions deliberately HELD design-attested this pass (record has reasons). */
export const PASS2_HELD_DIMENSIONS = [
  "conduct",
  "legal",
  "operational-risk",
  "infosec",
  "privacy",
  "tax",
] as const;

/**
 * The six promotions, each grounded in code verified this pass (evidence map
 * in the filed verification record). Deferred gaps carry owner + trigger +
 * citations per the write-time schema (D-FX-OTC-NPA-SCOPE-EXPANSION
 * deferred-gap tracking; recon:npa-deferred-gap-tracking inventories them).
 */
export const PASS2_PROMOTIONS: readonly Pass2Promotion[] = [
  {
    // EOD MTM: spot (fx-revaluation.ts) + forward/swap/NDF
    // (fx-forward-revaluation.ts). Multi-pair historical-simulation
    // VaR/SVaR/ES over the whole live FX book (var-engine.ts is risk-factor
    // generic; no silent zeros), on a daily 18:30 UTC cadence
    // (rohan-market-risk-measure) with the mr-1-fx-var-measure staleness
    // watchdog. NOP via BA310 period close; RAS B2 feeders wired;
    // recon:fx-gateway-threshold-enforcement standing.
    dimension: "market-risk",
    citationChain: [
      ...PASS_CITATIONS,
      "D-FX-FORWARDS-TRADING-FVTPL",
      "D-B3-5",
      "ORG-PR-19",
      "platform/market-risk/var-engine.ts",
      "platform/markets/eod/fx-forward-revaluation.ts",
      "runtime/agents/rohan-market-risk-measure.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-forward-curve-live-feed",
        title:
          "Forward-rate curve is a static build-phase seed (GAP-FWD-1, forward-rate-seed.ts); production replaces ForwardRateSource with a live curve feed from the ALM / yield-curve substrate.",
        owner: "Ravi (Treasury / ALM engineer, engineering)",
        targetTrigger: "ALM yield-curve substrate delivers a live forward-curve feed",
        citations: ["D-FX-FORWARDS-TRADING-FVTPL", "platform/markets/eod/forward-rate-seed.ts"],
      },
      {
        gapId: "fx-ois-discounting",
        title:
          "Forward/swap MtM uses the flat-discount approximation (GAP-FWD-2); production valuation discounts with currency-specific OIS factors from the ALM substrate.",
        owner: "Ravi (Treasury / ALM engineer, engineering)",
        targetTrigger: "ALM substrate delivers currency-specific OIS discount factors",
        citations: [
          "D-FX-FORWARDS-TRADING-FVTPL",
          "platform/markets/eod/fx-forward-revaluation.ts",
        ],
      },
    ],
  },
  {
    // Pre-trade credit-limit FAIL-CLOSED in the sync gateway via checkHeadroom
    // (no loaded limit / exhausted / expired / stale all REJECT). SA-CCR
    // (RC + PFE + alpha→EAD) production driver live over the FX book →
    // CcrEadComputed in the canonical store; EAD FX-converted before
    // CreditRWA; classification substrate resolves CounterpartyBaselClass-
    // Assigned events with the prudent corporate-non-ig 100% interim fallback.
    dimension: "credit-risk",
    citationChain: [
      ...PASS_CITATIONS,
      "D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED",
      "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION",
      "D-FX-EAD-FX-CONVERSION",
      "D-FX-CCR-INTERIM-CONSERVATIVE-RWA",
      "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION",
      "ORG-PR-09",
      "dashboard/markets-fx-gateway.ts",
      "platform/risk/sa-ccr/compute-and-emit.ts",
      "platform/projections/rwa-from-positions.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-counterparty-basel-class-values",
        title:
          "Authoritative counterparty Basel-class value-assignment (CounterpartyBaselClassAssigned events) pending the CRO classification run; until it lands the prudent corporate-non-ig 100% interim RWA stands.",
        owner: "Helena (Chief Risk Officer, governance)",
        targetTrigger:
          "CRO counterparty Basel-classification run lands CounterpartyBaselClassAssigned events (parallel brief, D-FX-NPA-VERIFICATION-PASS-2-DISPATCH)",
        citations: ["D-FX-CCR-INTERIM-CONSERVATIVE-RWA", "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION"],
      },
      {
        gapId: "fx-sa-ccr-daily-cadence",
        title:
          "SA-CCR over the FX book runs via the on-demand production driver (scripts/run-sa-ccr-fx-eod.ts); register it as a scheduled EOD handler (pattern: rohan-market-risk-measure cron) so CcrEadComputed refreshes daily without operator action.",
        owner: "Rohan (Risk engineer, engineering)",
        targetTrigger:
          "SA-CCR EOD run registered in runtime/handlers-metadata.ts on the daily scheduled cadence",
        citations: ["D-FX-SA-CCR-BUILD-PHASE-ACTIVATION", "scripts/run-sa-ccr-fx-eod.ts"],
      },
    ],
  },
  {
    // Funding/LCR gateway check enforced against the RAS appetite:liquidity:lcr
    // red boundary (110%) sourced LIVE from the RAS register, sanity-checked
    // against the BCBS 238 100% minimum; fail-closed on non-ZAR-projectable
    // orders. BA300 LCR period close wired with FX-rate enrichment.
    dimension: "liquidity-risk",
    citationChain: [
      ...PASS_CITATIONS,
      "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
      "D-BA300-LCR-FX-ENRICHMENT",
      "ORG-PR-01",
      "platform/risk/fx-gateway-thresholds.ts",
      "runtime/agents/bea-ba300-lcr-period-close.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-gateway-live-lcr-observation",
        title:
          "The gateway funding check evaluates against the build-phase baseline LCR constant (routeOrderToGateway passes currentLcrPct: null → lcr.gateway.build-phase-baseline-pct); wire the live LCR observation chain into the gateway so post-trade LCR is estimated off the latest computed ratio.",
        owner: "Ravi (Treasury / ALM engineer, engineering) → Eitan (Treasurer, finance)",
        targetTrigger:
          "WS-RETURNS-SUBMISSION-WIRING live LCR observation chain feeds the gateway funding evaluator",
        citations: ["D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS", "D-BA300-LCR-FX-ENRICHMENT"],
      },
    ],
  },
  {
    // Capital-impact gateway check enforced against the CRO-ratified pro-forma
    // RWA ceiling ((R300m − R100m) / 12.0%), fail-closed on unknown instrument
    // classes; current RWA read from the RwaComputed event-of-record (live
    // gateway read via latestRwaComputedTotalMinor). Credit RWA = Σ EAD×CRE20
    // off SA-CCR EAD (FX-converted); market RWA = BA320×12.5; BA700 reads the
    // event-of-record. recon:fx-gateway-threshold-enforcement +
    // recon:rwa-computed-sourcing standing.
    dimension: "capital",
    citationChain: [
      ...PASS_CITATIONS,
      "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
      "D-RWA-ENGINE-W2-SLICE-3",
      "D-FX-EAD-FX-CONVERSION",
      "Reg38-CRE20",
      "platform/risk/fx-gateway-thresholds.ts",
      "platform/risk/rwa-computed-engine.ts",
      "runtime/agents/bea-ba700-period-close.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-op-rwa-gross-income",
        title:
          "Operational-risk RWA remains the bank-wide placeholder pending gross-income data (D-RWA-ENGINE-W2-SLICE-3 op-RWA leg); the FX product's capital stack inherits it.",
        owner:
          "Camille (Chief Financial Officer, governance) with Bea (Accounting & financial reporting engineer, engineering)",
        targetTrigger: "revenue-start gross-income data enables the BIA/SA op-RWA computation",
        citations: ["D-RWA-ENGINE-W2-SLICE-3"],
      },
    ],
  },
  {
    // Sanctions pre-trade check live + fail-on-hit in the sync gateway
    // (screenCounterpartySanctions screens raw counterparty id AND synthetic
    // LEI; ORG-FC-13), alongside the fail-closed institutional-eligibility
    // screen (CounterpartyEligibilityScreened family). Build-phase list is the
    // local stub; live feeds integrate at licence-day (named in code).
    dimension: "aml",
    citationChain: [
      ...PASS_CITATIONS,
      "ORG-FC-13",
      "ORG-FC-02",
      "platform/markets/regulatory/sanctions-screen.ts",
      "dashboard/markets-fx-gateway.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-live-sanctions-feeds",
        title:
          "Sanctions screen matches against the local stub blocked list (sanctions-list-stub.json, exact-match on synthetic IDs); the live UN/OFAC/EU/HMT/POCDATARA feeds integrate via the Sanctions Screening Platform (D-SANCTIONS-SCREENING-SUBSTRATE, not yet built).",
        owner:
          "Zara (Chief Compliance Officer, governance) with Mira (Compliance / RegTech engineer, engineering)",
        targetTrigger:
          "licence-day Sanctions Screening Platform build (D-SANCTIONS-SCREENING-SUBSTRATE)",
        citations: ["ORG-FC-13", "platform/markets/regulatory/sanctions-screen.ts"],
      },
      {
        gapId: "fx-edd-str-substrate",
        title:
          "EDD workflow and STR/CTR/TPR filing substrate are design-only; they bind when real customers exist and FIC registration is live.",
        owner: "Zara (Chief Compliance Officer, governance)",
        targetTrigger: "licence-day FIC registration + real-counterparty onboarding",
        citations: ["ORG-FC-02", "ORG-FC-08"],
      },
    ],
  },
  {
    // Spot prices off live quotes (no pricing model — SR 11-7 model definition
    // not met; same basis as the equity/repo precedent). The forward/swap
    // pricing model model:fx-forward-irp-v1 AND the market-risk model suite
    // (model:market-risk-var-hs-v1 / -svar- / -es-) carry
    // ModelValidationApproved events from Nadia (Independent-validation
    // engineer, second line) in the canonical store — the v1 blocker
    // ("no ModelValidationApproved for model:fx-forward-irp-v1") is closed.
    // FX options are M5, outside the approved scope.
    dimension: "model-risk",
    citationChain: [
      ...PASS_CITATIONS,
      "ModelValidationApproved:model:fx-forward-irp-v1",
      "ModelValidationApproved:model:market-risk-var-hs-v1",
      "D-TRUSTED-FIGURES-PROGRAM-V1",
      "platform/market-risk/var-engine.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-forward-model-revalidation-live-curve",
        title:
          "model:fx-forward-irp-v1 was validated on the build-phase static-curve usage; revalidate when the live forward-curve feed replaces the static seed (input-regime change).",
        owner: "Nadia (Independent-validation engineer, second line)",
        targetTrigger: "live forward-curve feed integration (closes fx-forward-curve-live-feed)",
        citations: ["D-TRUSTED-FIGURES-PROGRAM-V1", "platform/markets/eod/forward-rate-seed.ts"],
      },
    ],
  },
];

export interface Pass2RunResult {
  readonly promoted: string[];
  readonly skipped: string[];
}

/**
 * Emit the pass-2 promotions into `store`. Idempotent: skips any dimension
 * that already has an implementation-attested event at or after PASS2_AS_OF
 * for the product.
 */
export function runFxNpaDimVerificationPass2(store: EventStore): Pass2RunResult {
  const alreadyPromoted = new Set<string>();
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === PASS2_PRODUCT_ID &&
      p.dimension !== undefined &&
      p.result === "implementation-attested" &&
      ev.as_of >= PASS2_AS_OF
    ) {
      alreadyPromoted.add(p.dimension);
    }
  }

  const promoted: string[] = [];
  const skipped: string[] = [];

  for (const promo of PASS2_PROMOTIONS) {
    if (alreadyPromoted.has(promo.dimension)) {
      skipped.push(promo.dimension);
      continue;
    }
    const provenance = buildPhaseFixtureTag({
      sourceLineage: "platform:npa-attestation-runner",
      variant: `npa-dimension-upgrade:${PASS2_PRODUCT_ID}:${promo.dimension}:verification-pass-2`,
      tags: ["npa-gate", "dimension-upgrade", "verification-pass-2", PASS2_PRODUCT_ID],
    });
    store.append({
      ...makeProductDimensionAttested({
        asOf: PASS2_AS_OF,
        entity: "LE-ZA-HOZ-BANK",
        actor: PASS2_ACTOR,
        citations: [...PASS_CITATIONS, `dimension:${promo.dimension}`],
        payload: {
          productId: PASS2_PRODUCT_ID,
          dimension: promo.dimension,
          result: "implementation-attested",
          citationChain: [...promo.citationChain],
          ...(promo.deferredGaps && promo.deferredGaps.length > 0
            ? {
                deferredGaps: promo.deferredGaps.map((g) => ({
                  ...g,
                  citations: [...g.citations],
                })),
              }
            : {}),
        },
      }),
      provenance,
    });
    promoted.push(promo.dimension);
  }

  return { promoted, skipped };
}
