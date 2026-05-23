// seeds/treasury/npa-approvals-seed.ts
//
// NPA pipeline seed payloads for 4 treasury products.
//
// Emits the PROC-NPA-GATE-01 attestation sequence per the NPA gate procedure
// for each treasury product. These events are prerequisites for all treasury
// trade seeds — the CI permission gate refuses trade execution events without
// a `ProductApproved` event in the store for the relevant product.
//
// Products covered:
//   REPO-ZAR-001      — Repo (sell/buy-back, GMRA 2011)
//   MMD-ZAR-001       — Money Market Deposit (bank as taker)
//   IBL-FT-ZAR-001    — Interbank Loan — Fixed Term
//   IBL-CALL-ZAR-001  — Interbank Loan — Call
//
// Sequence per product (PROC-NPA-GATE-01):
//   1. ProductProposalRegistered    — initiates the NPA pipeline
//   2. ProductDueDiligenceCompleted — gates cleared summary
//   3. ProductDimensionAttested ×5  — risk / finance / compliance / legal / operations
//   4. ProductApproved              — exco sign-off
//
// These payloads are exported as typed arrays. They do NOT emit events
// directly — the boot script (or seed runner) calls the factory functions
// from `platform/event-store/event-types/product.ts` with these payloads.
//
// All payloads pass the relevant Zod schemas in product.ts.
//
// Citations:
//   PROC-NPA-GATE-01              — NPA gate procedure (Procedures/by-policy/npa-gate.md)
//   D-NEW-PRODUCT-APPROVAL-POLICY — CEO-approved NPA policy
//   D-PRODUCT-CONSTRUCTION-SUBSTRATE — CEO-approved, Slice 2; authority for
//                                     the 14-event product-lifecycle family
//   brief:ravi:ws0-npa-pipeline-financialinstrumentdefined-seed:2026-05-23
//
// Author: Ravi (Treasury/ALM Engineer, engineering) per
//   brief:ravi:ws0-npa-pipeline-financialinstrumentdefined-seed:2026-05-23.

import type {
  ProductApprovedPayload,
  ProductDimensionAttestedPayload,
  ProductDueDiligenceCompletedPayload,
  ProductProposalRegisteredPayload,
} from "../../platform/event-store/event-types/product";

// ---------------------------------------------------------------------------
// Treasury product definitions
// ---------------------------------------------------------------------------

type TreasuryProductDef = {
  readonly productId: string;
  readonly name: string;
  readonly family: "repo" | "listed-bond" | "listed-equity" | "otc-ird" | "fx" | "structured";
};

const TREASURY_PRODUCTS: readonly TreasuryProductDef[] = [
  {
    productId: "REPO-ZAR-001",
    name: "Repo (sell/buy-back, GMRA 2011)",
    family: "repo",
  },
  {
    productId: "MMD-ZAR-001",
    name: "Money Market Deposit (bank as taker)",
    family: "repo",
  },
  {
    productId: "IBL-FT-ZAR-001",
    name: "Interbank Loan — Fixed Term",
    family: "repo",
  },
  {
    productId: "IBL-CALL-ZAR-001",
    name: "Interbank Loan — Call",
    family: "repo",
  },
] as const;

// ---------------------------------------------------------------------------
// Common citation chain — applies to all products in this seed
// ---------------------------------------------------------------------------

const BASE_CITATIONS: readonly string[] = [
  "PROC-NPA-GATE-01",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "brief:ravi:ws0-npa-pipeline-financialinstrumentdefined-seed:2026-05-23",
];

const AS_OF = "2026-05-23T08:00:00.000Z";

// ---------------------------------------------------------------------------
// 1. ProductProposalRegistered payloads
// ---------------------------------------------------------------------------

export const TREASURY_NPA_PROPOSAL_REGISTERED_PAYLOADS: ProductProposalRegisteredPayload[] =
  TREASURY_PRODUCTS.map((p) => ({
    productId: p.productId,
    family: p.family,
    proposedBy: "ravi",
    asOf: AS_OF,
  }));

// ---------------------------------------------------------------------------
// 2. ProductDueDiligenceCompleted payloads
// ---------------------------------------------------------------------------
//
// All 5 dimensions cleared for each product (design-attested level is
// sufficient for treasury seed activation at build-phase scope).

const DD_GATES_CLEARED = ["risk", "finance", "compliance", "legal", "operations"];

export const TREASURY_NPA_DUE_DILIGENCE_PAYLOADS: ProductDueDiligenceCompletedPayload[] =
  TREASURY_PRODUCTS.map((p) => ({
    productId: p.productId,
    gatesCleared: DD_GATES_CLEARED,
    gatesFailed: [],
  }));

// ---------------------------------------------------------------------------
// 3. ProductDimensionAttested payloads (5 per product)
// ---------------------------------------------------------------------------
//
// Attestors per dimension:
//   risk        — Helena (Chief Risk Officer, governance)
//   finance     — Camille (Chief Financial Officer, governance)
//   compliance  — Zara (Chief Compliance Officer, governance)
//   legal       — Imani (General Counsel, governance)
//   operations  — Saskia (Product Sponsor, governance)
//
// Result: "design-attested" — confirms the dimension is approved at design
// level for treasury products within the build-phase scope.

type DimensionAttestation = {
  readonly dimension: string;
  readonly attestorName: string;
  readonly attestorPosition: string;
};

const DIMENSION_ATTESTORS: readonly DimensionAttestation[] = [
  {
    dimension: "risk",
    attestorName: "Helena",
    attestorPosition: "Chief Risk Officer",
  },
  {
    dimension: "finance",
    attestorName: "Camille",
    attestorPosition: "Chief Financial Officer",
  },
  {
    dimension: "compliance",
    attestorName: "Zara",
    attestorPosition: "Chief Compliance Officer",
  },
  {
    dimension: "legal",
    attestorName: "Imani",
    attestorPosition: "General Counsel",
  },
  {
    dimension: "operations",
    attestorName: "Saskia",
    attestorPosition: "Product Sponsor",
  },
];

export const TREASURY_NPA_DIMENSION_ATTESTED_PAYLOADS: ProductDimensionAttestedPayload[] =
  TREASURY_PRODUCTS.flatMap((p) =>
    DIMENSION_ATTESTORS.map((d) => ({
      productId: p.productId,
      dimension: d.dimension,
      result: "design-attested" as const,
      citationChain: [
        ...BASE_CITATIONS,
        `dimension:${d.dimension}`,
        `attestor:${d.attestorName}:${d.attestorPosition}`,
      ],
    })),
  );

// ---------------------------------------------------------------------------
// 4. ProductApproved payloads
// ---------------------------------------------------------------------------
//
// Authority level: exco. No conditions imposed at build-phase seed level.
// Controlled-launch limits are captured in the NPA procedure record; the
// ProductApproved schema carries conditions[] and approvedBy only.

export const TREASURY_NPA_PRODUCT_APPROVED_PAYLOADS: ProductApprovedPayload[] =
  TREASURY_PRODUCTS.map((p) => ({
    productId: p.productId,
    version: "1.0",
    conditions: [],
    approvedBy: "exco",
  }));

// ---------------------------------------------------------------------------
// Re-export base citations for use by the seed runner
// ---------------------------------------------------------------------------

export { BASE_CITATIONS as TREASURY_NPA_BASE_CITATIONS, AS_OF as TREASURY_NPA_AS_OF };
export type { TreasuryProductDef };
export { TREASURY_PRODUCTS };
