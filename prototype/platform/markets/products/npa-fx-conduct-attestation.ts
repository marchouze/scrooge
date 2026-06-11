// platform/markets/products/npa-fx-conduct-attestation.ts
//
// FX OTC umbrella NPA — conduct dimension attestation (CCO verification).
//
// The per-dimension verification pass v2 (#1213) correctly HELD conduct
// design-attested: the markets conduct-surveillance handler was registered but
// materially inert (0 BestExecutionVerified / 0 FaisClassificationSuitability-
// Checked on 44 booked FX trades) and the gateway suitability check was an
// approve-always stub. This pass promotes conduct to implementation-attested
// ONLY after that gap is genuinely closed at code level:
//
//   1. Surveillance now fires reliably — the store-scanning sweep
//      rohan:conduct-surveillance-sweep (platform/conduct/fx-conduct-
//      surveillance-sweep.ts) is registered on a daily scheduled cadence and the
//      one-shot backfill driver covers the 44 historical trades, so best-
//      execution + FAIS-suitability + conflict surveillance are events of record
//      over the whole live book (verified by the canonical-store before/after).
//   2. FAIS-suitability genuinely fires — the FX counterparties are classified
//      market-counterparty (CCO, platform/conduct/fx-counterparty-fais-
//      classification.ts), so the §8D suitability check produces a positive
//      recorded control rather than skipping on an unclassified counterparty.
//   3. Conduct posture set — the gateway suitability check is now ENFORCED
//      (rejects retail-client + fail-closed on unclassified) rather than an
//      approve-always stub; institutional/professional scope keeps appropriate-
//      ness light while the FAIS §16 / TCF best-execution duty binds on every
//      trade.
//
// Residuals are tracked as ProductDeferredGap entries (owner + trigger +
// citations enforced at write-time; recon:npa-deferred-gap-tracking inventories
// them) — never hidden.
//
// Authority: D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
//   delegation 2026-06-11); D-MARKET-CONDUCT; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; FAIS Act 37/2002 §§16–17, §8D.
// Author: Zara (Chief Compliance Officer, governance).

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const CONDUCT_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the pass-2 conduct HOLD (2026-06-11T18:00) so latest-wins folds
// pick up the promotion.
export const CONDUCT_AS_OF = "2026-06-11T20:00:00.000Z";

const CONDUCT_ACTOR = {
  type: "service" as const,
  id: "agent:zara:npa-conduct-attestation",
};

const CONDUCT_CITATIONS = [
  "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

export const CONDUCT_CITATION_CHAIN: readonly string[] = [
  ...CONDUCT_CITATIONS,
  "D-MARKET-CONDUCT",
  "ORG-MK-01",
  "FAIS-ACT-37-2002-S16",
  "FAIS-ACT-37-2002-S8D",
  "platform/conduct/fx-conduct-surveillance-sweep.ts",
  "platform/conduct/fx-trade-conduct-evaluation.ts",
  "runtime/agents/rohan-conduct-surveillance-sweep.ts",
  "dashboard/markets-fx-gateway.ts",
];

export const CONDUCT_DEFERRED_GAPS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-best-execution-policy-schedule",
    title:
      "Best-execution tolerance bps are fixed build-phase constants (BE_TOLERANCE_BY_ASSET_CLASS); production drives them from a published BestExecutionPolicySchedule event so the conduct committee owns the thresholds.",
    owner: "Zara (Chief Compliance Officer, governance)",
    targetTrigger:
      "conduct committee publishes a BestExecutionPolicySchedule event of record",
    citations: ["D-MARKET-CONDUCT", "platform/conduct/fx-trade-conduct-evaluation.ts"],
  },
  {
    gapId: "fx-best-execution-reference-benchmark",
    title:
      "Best-execution spread is measured against the executed rate as reference (single price source → 0 bps) until an independent benchmark/FTP-curve feed lands; the verdict is structurally 'verified' for in-tolerance trades but cannot yet detect off-market execution.",
    owner: "Rohan (Markets risk/quant engineer, engineering)",
    targetTrigger:
      "independent FX benchmark / mid-rate feed wired as the best-execution reference (closes fx-forward-curve-live-feed dependency)",
    citations: ["FAIS-ACT-37-2002-S16", "platform/conduct/fx-trade-conduct-evaluation.ts"],
  },
  {
    gapId: "fx-edd-str-substrate",
    title:
      "EDD workflow and STR/CTR/TPR conduct-reporting substrate are design-only; they bind at licence-day when real counterparties exist and FIC registration is live.",
    owner: "Zara (Chief Compliance Officer, governance)",
    targetTrigger: "licence-day FIC registration + real-counterparty onboarding",
    citations: ["ORG-FC-02", "ORG-FC-08"],
  },
];

export interface ConductAttestationResult {
  readonly promoted: boolean;
  readonly skipped: boolean;
}

/**
 * Emit the conduct dimension promotion to implementation-attested with the
 * tracked deferred gaps. Idempotent: skips if a conduct implementation-attested
 * event at or after CONDUCT_AS_OF already exists for the product.
 */
export function runFxConductAttestation(store: EventStore): ConductAttestationResult {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === CONDUCT_PRODUCT_ID &&
      p.dimension === "conduct" &&
      p.result === "implementation-attested" &&
      ev.as_of >= CONDUCT_AS_OF
    ) {
      return { promoted: false, skipped: true };
    }
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${CONDUCT_PRODUCT_ID}:conduct:surveillance-wiring`,
    tags: ["npa-gate", "dimension-upgrade", "conduct", CONDUCT_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: CONDUCT_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: CONDUCT_ACTOR,
      citations: [...CONDUCT_CITATIONS, "dimension:conduct"],
      payload: {
        productId: CONDUCT_PRODUCT_ID,
        dimension: "conduct",
        result: "implementation-attested",
        citationChain: [...CONDUCT_CITATION_CHAIN],
        deferredGaps: CONDUCT_DEFERRED_GAPS.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return { promoted: true, skipped: false };
}
