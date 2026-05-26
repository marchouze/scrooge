// platform/markets/products/npa-attestation-runner.ts
//
// Slice 4 — Reusable, idempotent NPA attestation orchestrator.
//
// Emits the full PROC-NPA-GATE-01 event sequence for a product definition.
// Idempotent: if ProductApproved already exists for the productId, returns
// skipped-already-approved without emitting any new events.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//
// Author: Atlas (Core banking platform architect, engineering)

import {
  makeProductApproved,
  makeProductConceptualised,
  makeProductDimensionAttested,
  makeProductDueDiligenceCompleted,
  makeProductProposalRegistered,
  makeProductWithheld,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

// The product event schema uses a restricted 6-value family enum (it predates
// the `money-market` and `interbank-loan` additions to ProductFamily in types.ts).
// NPA attestation only applies to the 6 NPA-eligible families.
type NpaProductFamily = "listed-equity" | "listed-bond" | "repo" | "otc-ird" | "fx" | "structured";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DimensionKey =
  | "market-risk"
  | "credit-risk"
  | "liquidity-risk"
  | "operational-risk"
  | "operational-readiness"
  | "accounting"
  | "capital"
  | "conduct"
  | "aml"
  | "model-risk"
  | "legal"
  | "infosec"
  | "privacy"
  | "tax";

export interface DimensionAssessment {
  result: "design-attested" | "implementation-attested" | "failed";
  /** At least one citation entry required (Principle 2). */
  citationChain: string[];
  notes?: string;
}

export interface ProductNpaDef {
  productId: string;
  family: NpaProductFamily;
  name: string;
  version: string;
  dimensions: Record<DimensionKey, DimensionAssessment>;
  proposedBy: string;
}

export interface NpaRunResult {
  productId: string;
  outcome: "approved" | "withheld" | "skipped-already-approved";
  /** Event type names of events emitted in this run. */
  eventsEmitted: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";

const ACTOR = {
  type: "service" as const,
  id: "agent:atlas:npa-attestation-runner",
};

const CITATIONS = [
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
] as const;

const ALL_DIMENSION_KEYS: DimensionKey[] = [
  "market-risk",
  "credit-risk",
  "liquidity-risk",
  "operational-risk",
  "operational-readiness",
  "accounting",
  "capital",
  "conduct",
  "aml",
  "model-risk",
  "legal",
  "infosec",
  "privacy",
  "tax",
];

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

function isProductAlreadyApproved(store: EventStore, productId: string): boolean {
  for (const ev of store.replay({ type: "ProductApproved" })) {
    const p = ev.payload as { productId?: string };
    if (p.productId === productId) return true;
  }
  return false;
}

function isProposalAlreadyEmitted(store: EventStore, productId: string): boolean {
  for (const ev of store.replay({ type: "ProductProposalRegistered" })) {
    const p = ev.payload as { productId?: string };
    if (p.productId === productId) return true;
  }
  return false;
}

function isConceptualisedAlreadyEmitted(store: EventStore, productId: string): boolean {
  for (const ev of store.replay({ type: "ProductConceptualised" })) {
    const p = ev.payload as { productId?: string };
    if (p.productId === productId) return true;
  }
  return false;
}

function isDimensionAlreadyAttested(
  store: EventStore,
  productId: string,
  dimension: string,
): boolean {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string };
    if (p.productId === productId && p.dimension === dimension) return true;
  }
  return false;
}

function isDueDiligenceAlreadyCompleted(store: EventStore, productId: string): boolean {
  for (const ev of store.replay({ type: "ProductDueDiligenceCompleted" })) {
    const p = ev.payload as { productId?: string };
    if (p.productId === productId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the NPA attestation pipeline for a product definition.
 *
 * Idempotent: if ProductApproved already exists for productId, returns
 * `{outcome: "skipped-already-approved", eventsEmitted: []}`.
 *
 * Otherwise emits, in order:
 *   1. ProductProposalRegistered
 *   2. ProductConceptualised
 *   3. 14 × ProductDimensionAttested (one per DimensionKey)
 *   4. ProductDueDiligenceCompleted
 *   5. ProductApproved OR ProductWithheld depending on gate results
 *
 * Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26).
 */
export function runNpaAttestation(
  store: EventStore,
  def: ProductNpaDef,
  asOf: string,
): NpaRunResult {
  const { productId, family, name, version, dimensions, proposedBy } = def;
  const eventsEmitted: string[] = [];

  // Step 0: Idempotency guard.
  if (isProductAlreadyApproved(store, productId)) {
    return { productId, outcome: "skipped-already-approved", eventsEmitted: [] };
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-attestation:${productId}`,
    tags: ["npa-gate", "product-approval", productId],
  });

  // Step 1: ProductProposalRegistered.
  if (!isProposalAlreadyEmitted(store, productId)) {
    const ev = {
      ...makeProductProposalRegistered({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: [...CITATIONS],
        payload: {
          productId,
          family,
          proposedBy,
          asOf,
        },
      }),
      provenance,
    };
    store.append(ev);
    eventsEmitted.push("ProductProposalRegistered");
  }

  // Step 2: ProductConceptualised.
  if (!isConceptualisedAlreadyEmitted(store, productId)) {
    const ev = {
      ...makeProductConceptualised({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: [...CITATIONS],
        payload: {
          productId,
          version,
          cdmComposition: {
            name,
            family,
            composedBy: "agent:atlas:npa-attestation-runner",
          },
          lifecycleEventFamily: ["ProductProposalRegistered", "ProductApproved"],
        },
      }),
      provenance,
    };
    store.append(ev);
    eventsEmitted.push("ProductConceptualised");
  }

  // Step 3: 14 × ProductDimensionAttested.
  for (const dimensionKey of ALL_DIMENSION_KEYS) {
    if (!isDimensionAlreadyAttested(store, productId, dimensionKey)) {
      const assessment = dimensions[dimensionKey];
      const ev = {
        ...makeProductDimensionAttested({
          asOf,
          entity: ENTITY,
          actor: ACTOR,
          citations: [...CITATIONS, `dimension:${dimensionKey}`],
          payload: {
            productId,
            dimension: dimensionKey,
            result: assessment.result,
            citationChain: [...assessment.citationChain],
          },
        }),
        provenance,
      };
      store.append(ev);
      eventsEmitted.push("ProductDimensionAttested");
    }
  }

  // Step 4: Compute gate results.
  const gatesCleared = ALL_DIMENSION_KEYS.filter(
    (k) => dimensions[k].result !== "failed",
  ) as string[];
  const gatesFailed = ALL_DIMENSION_KEYS.filter(
    (k) => dimensions[k].result === "failed",
  ) as string[];

  // Step 5: ProductDueDiligenceCompleted.
  if (!isDueDiligenceAlreadyCompleted(store, productId)) {
    const ev = {
      ...makeProductDueDiligenceCompleted({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: [...CITATIONS],
        payload: {
          productId,
          gatesCleared,
          gatesFailed,
        },
      }),
      provenance,
    };
    store.append(ev);
    eventsEmitted.push("ProductDueDiligenceCompleted");
  }

  // Step 6: ProductApproved or ProductWithheld.
  if (gatesFailed.length === 0) {
    const ev = {
      ...makeProductApproved({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: [...CITATIONS],
        payload: {
          productId,
          version,
          conditions: [],
          approvedBy: "agent:atlas:npa-attestation-runner",
        },
      }),
      provenance,
    };
    store.append(ev);
    eventsEmitted.push("ProductApproved");
    return { productId, outcome: "approved", eventsEmitted };
  }
  const ev = {
    ...makeProductWithheld({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: [...CITATIONS],
      payload: {
        productId,
        version,
        reason: `NPA gate failed on dimensions: ${gatesFailed.join(", ")}`,
      },
    }),
    provenance,
  };
  store.append(ev);
  eventsEmitted.push("ProductWithheld");
  return { productId, outcome: "withheld", eventsEmitted };
}
