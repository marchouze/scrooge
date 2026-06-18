// scripts/withdraw-legacy-superseded-products.ts
//
// Withdraw the 5 active non-compliant legacy products that were approved
// 2026-05-26..28 under the SUPERSEDED 14-dimension NPA gate policy (design-
// attested with no tracked deferred gaps, and missing the data-quality 15th
// dimension). Each is now non-compliant under the current 15-dimension standard
// and must be re-run through a clean NPA cycle when the substrate is ready.
//
// This is the legacy analogue of the FX precedent (fx-otc-vanilla-npa-cycle.ts
// + the fx-swap-usdzar ProductRetired): no historical event is mutated or
// deleted (Principle 1, append-only). A later `ProductWithheld` per product
// makes the withdrawn state the product's CURRENT EFFECTIVE lifecycle state,
// which the supersession-aware recon (product-approval-attestation-integrity.ts)
// then correctly treats as out-of-scope for re-judging.
//
// Idempotent in two layers:
//   1. The faithful legacy lifecycle (proposal + 14 attestations + approval) is
//      emitted ONLY when no `ProductApproved` already exists for the product —
//      so the real home store (which already holds the historical approvals
//      under their original event ids) is NOT re-seeded or duplicated, while a
//      clean CI store gets the faithful non-compliant state to withdraw.
//   2. The `ProductWithheld` is emitted ONLY when no supersession-citing
//      `ProductWithheld` already exists for the product.
//
// Wired into `ci:migrate` (after `npa:fx-otc-vanilla-cycle`) so the clean CI
// store reflects the withdrawn state and the supersession-aware recon passes on
// CI. ProductWithheld is a PRODUCT lifecycle event, not a Decision event — so
// wiring it into ci:migrate does not affect recon:decision-symmetry or
// recon:v2-decision-impact-sweep-coverage (no Decision is emitted here).
//
// Run against the shared home store for the canonical record:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/withdraw-legacy-superseded-products.ts
//
// Authority:
//   - D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION (CEO-approved 2026-06-18)
//   - D-NPA-GATE-POLICY-REDESIGN (CEO-approved 2026-06-15)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Author: Saskia (Head of Global Markets, governance)

import { eventStore } from "../platform/composition";
import {
  makeProductApproved,
  makeProductDimensionAttested,
  makeProductProposalRegistered,
  makeProductWithheld,
} from "../platform/event-store/event-types/product";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import type { EventStore } from "../platform/event-store/store";
import { logger } from "../platform/observability/logger";

const ENTITY = "LE-ZA-HOZ-BANK";

const CYCLE_ACTOR = {
  type: "service" as const,
  id: "agent:saskia:withdraw-legacy-superseded-products",
};

/** Base authority chain on every event emitted here (Principle 2). */
const BASE_CHAIN = [
  "D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION",
  "D-NPA-GATE-POLICY-REDESIGN",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
] as const;

/** Reason text on every ProductWithheld — mirrors the FX precedent. */
const WITHHELD_REASON =
  "Approved under the superseded gate policy (14-dimension, design-attested with no tracked deferred gaps); " +
  "non-compliant under the current 15-dimension standard; to be re-run through a clean NPA cycle when substrate ready. " +
  "Authority: D-NPA-GATE-POLICY-REDESIGN; D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION.";

type Family = "listed-equity" | "listed-bond" | "repo" | "otc-ird";
type DimResult = "design-attested" | "implementation-attested";

/**
 * Faithful snapshot of each legacy product's non-compliant lifecycle, extracted
 * verbatim from the home store on 2026-06-18 (14 dimensions, no data-quality).
 * Used to reproduce the non-compliant state on a clean CI store so the
 * supersession can be demonstrated end-to-end. On the home store these
 * lifecycles already exist, so the approval guard skips re-emission.
 */
interface LegacyProductDef {
  readonly productId: string;
  readonly family: Family;
  readonly approvedAsOf: string;
  readonly version: string;
  /** 14 dimensions (no data-quality) with their historical attestation result. */
  readonly dimensions: ReadonlyArray<readonly [string, DimResult]>;
}

const IMPL: DimResult = "implementation-attested";
const DSGN: DimResult = "design-attested";

/** The 14 legacy dimensions for the capital-markets products (all but tax = impl). */
const CAPMKT_DIMS: ReadonlyArray<readonly [string, DimResult]> = [
  ["market-risk", IMPL],
  ["credit-risk", IMPL],
  ["liquidity-risk", IMPL],
  ["operational-risk", IMPL],
  ["operational-readiness", IMPL],
  ["accounting", IMPL],
  ["capital", IMPL],
  ["conduct", IMPL],
  ["aml", IMPL],
  ["model-risk", IMPL],
  ["legal", IMPL],
  ["infosec", IMPL],
  ["privacy", IMPL],
  ["tax", DSGN],
];

/** The 14 legacy dimensions for M5 term repo (mostly design-attested). */
const REPO_DIMS: ReadonlyArray<readonly [string, DimResult]> = [
  ["market-risk", DSGN],
  ["credit-risk", DSGN],
  ["liquidity-risk", IMPL],
  ["operational-risk", DSGN],
  ["operational-readiness", DSGN],
  ["accounting", IMPL],
  ["capital", DSGN],
  ["conduct", DSGN],
  ["aml", DSGN],
  ["model-risk", DSGN],
  ["legal", DSGN],
  ["infosec", DSGN],
  ["privacy", DSGN],
  ["tax", DSGN],
];

const LEGACY_PRODUCTS: ReadonlyArray<LegacyProductDef> = [
  {
    productId: "prd:bank:equity:jse-equity-cash",
    family: "listed-equity",
    approvedAsOf: "2026-05-26T00:00:00.000Z",
    version: "1.0.0",
    dimensions: CAPMKT_DIMS,
  },
  {
    productId: "prd:bank:bond:sagb-fixed-coupon",
    family: "listed-bond",
    approvedAsOf: "2026-05-26T00:00:00.000Z",
    version: "1.0.0",
    dimensions: CAPMKT_DIMS,
  },
  {
    productId: "prd:bank:bond:open-repo-gmra",
    family: "repo",
    approvedAsOf: "2026-05-26T00:00:00.000Z",
    version: "1.0.0",
    dimensions: CAPMKT_DIMS,
  },
  {
    productId: "prd:bank:ird:vanilla-zar-fix-zaronia",
    family: "otc-ird",
    approvedAsOf: "2026-05-26T00:00:00.000Z",
    version: "1.0.0",
    dimensions: CAPMKT_DIMS,
  },
  {
    productId: "prd:bank:treasury:repo-sagb-term",
    family: "repo",
    approvedAsOf: "2026-05-28T00:00:00.000Z",
    version: "1.0.0",
    dimensions: REPO_DIMS,
  },
];

/**
 * The supersession instant. Strictly after every legacy approval as_of so the
 * ProductWithheld is the latest lifecycle event per product (latest-wins
 * supersession, no deletion).
 */
const WITHHELD_AS_OF = "2026-06-18T09:00:00.000Z";

function provenanceFor(productId: string, variant: string) {
  return buildPhaseFixtureTag({
    sourceLineage: "platform:withdraw-legacy-superseded-products",
    variant: `${variant}:${productId}`,
    tags: ["npa-gate", "legacy-supersession", "product-withheld", productId],
  });
}

function hasProductApproved(store: EventStore, productId: string): boolean {
  for (const ev of store.replay({ type: "ProductApproved" })) {
    if ((ev.payload as { productId?: string })?.productId === productId) return true;
  }
  return false;
}

function hasSupersessionWithheld(store: EventStore, productId: string): boolean {
  for (const ev of store.replay({ type: "ProductWithheld" })) {
    const p = ev.payload as { productId?: string };
    if (
      p?.productId === productId &&
      ev.citations.includes("D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Emit the faithful non-compliant legacy lifecycle (proposal + 14 attestations
 * + approval) ONLY when the product has no existing ProductApproved. This
 * reproduces the real historical state on a clean CI store while leaving the
 * home store's authoritative historical events untouched.
 */
function seedLegacyLifecycleIfAbsent(store: EventStore, def: LegacyProductDef): boolean {
  if (hasProductApproved(store, def.productId)) return false;

  store.append({
    ...makeProductProposalRegistered({
      asOf: def.approvedAsOf,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: [...BASE_CHAIN],
      payload: {
        productId: def.productId,
        family: def.family,
        proposedBy: CYCLE_ACTOR.id,
        asOf: def.approvedAsOf,
      },
    }),
    provenance: provenanceFor(def.productId, "legacy-proposal"),
  });

  for (const [dimension, result] of def.dimensions) {
    store.append({
      ...makeProductDimensionAttested({
        asOf: def.approvedAsOf,
        entity: ENTITY,
        actor: CYCLE_ACTOR,
        citations: [...BASE_CHAIN, `dimension:${dimension}`],
        payload: {
          productId: def.productId,
          dimension,
          result,
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
        },
      }),
      provenance: provenanceFor(def.productId, `legacy-attestation:${dimension}`),
    });
  }

  store.append({
    ...makeProductApproved({
      asOf: def.approvedAsOf,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: [...BASE_CHAIN],
      payload: {
        productId: def.productId,
        version: def.version,
        conditions: [],
        approvedBy: "agent:atlas:npa-attestation-runner",
      },
    }),
    provenance: provenanceFor(def.productId, "legacy-approval"),
  });

  return true;
}

function withdraw(store: EventStore): { seeded: number; withheld: number; skipped: number } {
  let seeded = 0;
  let withheld = 0;
  let skipped = 0;

  for (const def of LEGACY_PRODUCTS) {
    if (seedLegacyLifecycleIfAbsent(store, def)) {
      seeded++;
      logger.info(
        { productId: def.productId },
        "Seeded faithful legacy non-compliant lifecycle (clean store)",
      );
    }

    if (hasSupersessionWithheld(store, def.productId)) {
      skipped++;
      logger.info(
        { productId: def.productId },
        "ProductWithheld (supersession) already present — skipped (idempotent)",
      );
      continue;
    }

    store.append({
      ...makeProductWithheld({
        asOf: WITHHELD_AS_OF,
        entity: ENTITY,
        actor: CYCLE_ACTOR,
        citations: [...BASE_CHAIN],
        payload: {
          productId: def.productId,
          version: def.version,
          reason: WITHHELD_REASON,
        },
      }),
      provenance: provenanceFor(def.productId, "withheld"),
    });
    withheld++;
    logger.info({ productId: def.productId }, "Emitted ProductWithheld (legacy supersession)");
  }

  return { seeded, withheld, skipped };
}

if (import.meta.main) {
  const summary = withdraw(eventStore);
  logger.info(
    summary,
    `Legacy product supersession complete: ${summary.withheld} withheld, ${summary.seeded} legacy lifecycles seeded, ${summary.skipped} already withheld`,
  );
  process.exit(0);
}

export { withdraw, LEGACY_PRODUCTS, WITHHELD_AS_OF };
