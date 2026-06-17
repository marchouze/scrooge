// platform/markets/products/npa-fx-treatment-module-enrichment.ts
//
// FX OTC umbrella NPA — treatment-module enrichment of the accounting (dim 6),
// capital/prudential (dim 7), and tax (dim 14) dimension attestations.
//
// WHY: those three dimensions predate the versioned modular reporting-treatment
// menu (`v2-core/reporting-treatments/fx-modules.ts`, seeded into the v2-anchor
// store by `scripts/seed-v2-anchor-bank-standing-data.ts`). Their existing
// `ProductDimensionAttested` events cite hardcoded inline determinations
// (IAS-21 / IFRS-9 literals, BCBS-SA-CCR, STT/VAT vocabulary) rather than the
// canonical, versioned module that is now the single source for the FX
// treatment. This module RE-EMITS each of the three attestations so its
// `citationChain` cites the matching treatment module by `treatmentId@version`
// AND its existing inline citations are retained (the module is the canonical
// SOURCE; the inline citations remain the upward Principle-2 anchors).
//
// WHAT IS PRESERVED (no downgrade, no invented gaps):
//   - accounting → implementation-attested, ZERO deferred gaps
//       (build-3 close: D-FX-FORWARDS-TRADING-FVTPL; forward/swap FVTPL posts via
//        the existing FX-spot rules — verified, no residual NPA deferral).
//   - capital    → implementation-attested, the SAME single deferred gap
//       (`fx-op-rwa-gross-income`) carried by verification-pass-2.
//   - tax        → implementation-attested, the SAME four deferred gaps
//       (`TAX_DEFERRED_GAPS`) carried by Yael's tax attestation.
//
// This does NOT re-approve the product. The umbrella stays `ProductWithheld`
// (2026-06-15) pending a separate re-gate. No `ProductApproved` is emitted.
//
// The cited module versions are SOURCED from the module declarations
// (`FX_TREATMENT_MODULES`) via `formatVersion`, never hardcoded — so a future
// module-version bump flows through to the citation automatically and the cited
// `treatmentId@version` always resolves in the registry.
//
// Governance owners (identity discipline — name + position on first mention):
//   - accounting → Bea (Financial Accountant, finance) / Camille (CFO)
//   - capital/prudential → Camille (Chief Financial Officer, governance) /
//     Helena (Chief Risk Officer, governance)
//   - tax → Yael (Tax engineer, engineering)
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17);
//            D-NPA-GATE-POLICY-REDESIGN; D-FX-OTC-NPA-SCOPE-EXPANSION;
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Bea (Financial Accountant, finance).

import { formatVersion } from "../../../v2-core/fil-core/urn";
import type { FxTreatmentModuleInput } from "../../../v2-core/reporting-treatments/fx-modules";
import { FX_TREATMENT_MODULES } from "../../../v2-core/reporting-treatments/fx-modules";
import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import { TAX_DEFERRED_GAPS } from "./npa-fx-tax-attestation";
import { PASS2_PROMOTIONS } from "./npa-fx-verification-pass-2";

export const ENRICH_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the last per-dimension attestation for the umbrella (tax at
// 2026-06-15T08:00:00Z) so latest-in-replay-order folds pick these enrichments
// up as the current attestation for each dimension.
export const ENRICH_AS_OF = "2026-06-17T10:00:00.000Z";

const ENRICH_ACTOR = {
  type: "service" as const,
  id: "agent:bea:npa-treatment-module-enrichment",
};

const ENRICH_CITATIONS = [
  "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
  "D-NPA-GATE-POLICY-REDESIGN",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

/**
 * Resolve a treatment module by id from the canonical FX module declarations
 * and render its `treatmentId@version` citation. Fail-closed: a missing module
 * id is a programming error (the four ids are fixed), so we throw rather than
 * emit an attestation that cites a non-resolving module.
 */
function moduleCitation(treatmentId: string): string {
  const decl: FxTreatmentModuleInput | undefined = FX_TREATMENT_MODULES.find(
    (m) => m.treatmentId === treatmentId,
  );
  if (!decl) {
    throw new Error(
      `FX treatment module "${treatmentId}" not found in FX_TREATMENT_MODULES — cannot enrich the NPA attestation with a non-resolving module citation.`,
    );
  }
  return `treatment-module:${decl.treatmentId}@${formatVersion(decl.version)}`;
}

/** The capital dimension's tracked deferred gaps, sourced from pass-2 (not re-authored). */
function capitalDeferredGaps(): readonly ProductDeferredGap[] {
  const capital = PASS2_PROMOTIONS.find((p) => p.dimension === "capital");
  if (!capital) {
    throw new Error(
      "capital promotion not found in PASS2_PROMOTIONS — cannot preserve its tracked deferred gaps.",
    );
  }
  return capital.deferredGaps ?? [];
}

export interface DimensionEnrichment {
  readonly dimension: string;
  /** Treatment-module id whose `@version` is cited (resolved from the declarations). */
  readonly treatmentModuleId: string;
  readonly result: "implementation-attested";
  /** The pre-existing inline citation chain, retained verbatim. */
  readonly priorCitations: readonly string[];
  /** Preserved tracked deferred gaps (empty array = none). */
  readonly deferredGaps: readonly ProductDeferredGap[];
  /** Governance-owner attribution narrative (identity discipline). */
  readonly ownerNarrative: string;
}

/**
 * The three enrichments. Each preserves its dimension's current `result` and
 * deferred gaps; the only change is the addition of the matching treatment
 * module's `treatmentId@version` to the head of the citation chain and the
 * owner-attribution narrative.
 */
export const FX_TREATMENT_MODULE_ENRICHMENTS: readonly DimensionEnrichment[] = [
  {
    dimension: "accounting",
    treatmentModuleId: "ifrs-classification:fx-fvtpl",
    result: "implementation-attested",
    // From build3-close-fx-accounting-gap.ts (the current accounting attestation).
    priorCitations: [
      "D-FX-FORWARDS-TRADING-FVTPL",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "Policies/accounting-policy-v1.md",
      "IAS-21",
      "IFRS-9",
    ],
    deferredGaps: [],
    ownerNarrative:
      "Accounting (dim 6) — Bea (Financial Accountant, finance) / Camille (CFO). FX FVTPL " +
      "classification, IAS 21 §23 closing-rate revaluation and IFRS 9 §5.7.1 FVTPL " +
      "re-measurement are now sourced from the versioned reporting-treatment module " +
      "ifrs-classification:fx-fvtpl (the canonical menu entry the FX product picks), " +
      "replacing the prior hardcoded inline determination. Implementation-attested with " +
      "zero deferred gaps: forward/swap FVTPL accounting posts via the existing FX-spot " +
      "posting rules (per-currency accounts), verified under D-FX-FORWARDS-TRADING-FVTPL.",
  },
  {
    dimension: "capital",
    treatmentModuleId: "prudential-treatment:fx-trading-book",
    result: "implementation-attested",
    // From the capital promotion in npa-fx-verification-pass-2.ts.
    priorCitations: (() => {
      const capital = PASS2_PROMOTIONS.find((p) => p.dimension === "capital");
      if (!capital) {
        throw new Error("capital promotion not found in PASS2_PROMOTIONS for citation chain.");
      }
      return capital.citationChain;
    })(),
    deferredGaps: capitalDeferredGaps(),
    ownerNarrative:
      "Capital / prudential (dim 7) — Camille (Chief Financial Officer, governance) / " +
      "Helena (Chief Risk Officer, governance). The trading-book classification and " +
      "standardised-market-risk regulatory approach (BA-320 / ORG-PR-19) are now sourced " +
      "from the versioned reporting-treatment module prudential-treatment:fx-trading-book, " +
      "the canonical prudential menu entry. Implementation-attested; the single tracked " +
      "deferred gap (operational-risk RWA pending gross-income data at revenue-start) is " +
      "preserved unchanged.",
  },
  {
    dimension: "tax",
    treatmentModuleId: "tax-treatment:fx",
    result: "implementation-attested",
    // From TAX_CITATION_CHAIN in npa-fx-tax-attestation.ts (the current tax attestation).
    priorCitations: [
      "D-FX-HELD-DIMS-SEAT-SWEEP",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-NEW-PRODUCT-APPROVAL-POLICY",
      "D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY",
      "urn:reg:za:stt-act-25-2007:s1",
      "urn:reg:za:stt-act-25-2007:s7",
      "urn:reg:za:vat-act-89-1991:s2(1)(f)",
      "urn:reg:za:vat-act-89-1991:sch1-item1(f)",
      "urn:reg:za:vat-act-89-1991:sch1-item1(g)",
      "SARS-VAT-419-GUIDE-FOR-BANKS",
      "urn:reg:za:income-tax-act-58-1962:s24j",
      "FATCA-IRC-S1471-1474",
      "SA-US-FATCA-IGA-2014",
      "urn:reg:za:income-tax-act-58-1962:s70",
      "OECD-CRS-2014",
      "SARS-BRS-CRS-2017",
    ],
    deferredGaps: TAX_DEFERRED_GAPS,
    ownerNarrative:
      "Tax (dim 14) — Yael (Tax engineer, engineering). The s24J income-tax accrual basis " +
      "and the VAT-exempt-financial-supply treatment are now sourced from the versioned " +
      "reporting-treatment module tax-treatment:fx, the canonical tax menu entry, " +
      "consolidating the prior inline STT/VAT/income-tax vocabulary. Implementation-attested; " +
      "the four tracked deferred gaps (SARS binding private ruling; s24J accrual engine at " +
      "revenue-start; FATCA W-8 collection; CRS classification — all licence-day-gated) are " +
      "preserved unchanged.",
  },
];

export interface EnrichmentRunResult {
  readonly enriched: string[];
  readonly skipped: string[];
}

/**
 * Emit the three enrichment attestations into `store`. Idempotent: skips any
 * dimension that already has an attestation at or after ENRICH_AS_OF for the
 * product (so re-running the driver does not append duplicates).
 *
 * Each emitted event keeps the dimension's current `result` and deferred gaps;
 * the citation chain gains the matching `treatment-module:<id>@<version>` head.
 */
export function runFxTreatmentModuleEnrichment(store: EventStore): EnrichmentRunResult {
  const alreadyEnriched = new Set<string>();
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string };
    if (
      p.productId === ENRICH_PRODUCT_ID &&
      typeof p.dimension === "string" &&
      ev.as_of >= ENRICH_AS_OF
    ) {
      alreadyEnriched.add(p.dimension);
    }
  }

  const enriched: string[] = [];
  const skipped: string[] = [];

  for (const e of FX_TREATMENT_MODULE_ENRICHMENTS) {
    if (alreadyEnriched.has(e.dimension)) {
      skipped.push(e.dimension);
      continue;
    }

    const provenance = buildPhaseFixtureTag({
      sourceLineage: "platform:npa-attestation-runner",
      variant: `npa-dimension-enrichment:${ENRICH_PRODUCT_ID}:${e.dimension}:treatment-module`,
      tags: ["npa-gate", "dimension-enrichment", "treatment-module", ENRICH_PRODUCT_ID],
    });

    const citationChain = [moduleCitation(e.treatmentModuleId), ...e.priorCitations];

    store.append({
      ...makeProductDimensionAttested({
        asOf: ENRICH_AS_OF,
        entity: "LE-ZA-HOZ-BANK",
        actor: ENRICH_ACTOR,
        citations: [...ENRICH_CITATIONS, `dimension:${e.dimension}`],
        payload: {
          productId: ENRICH_PRODUCT_ID,
          dimension: e.dimension,
          result: e.result,
          citationChain,
          ...(e.deferredGaps.length > 0
            ? { deferredGaps: e.deferredGaps.map((g) => ({ ...g, citations: [...g.citations] })) }
            : {}),
        },
      }),
      provenance,
    });
    enriched.push(e.dimension);
  }

  return { enriched, skipped };
}
