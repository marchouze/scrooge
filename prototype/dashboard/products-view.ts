// dashboard/products-view.ts
//
// Cross-family product-list projection for the /products page.
//
// Folds:
//   - Seven canonical fixtures (M1 JSE equity, M2 SAGB bond, M4 FX Spot,
//     M5 Repo, M6 MMD Deposit, M7 Funding Line, M8 IBL) as the always-present baseline.
//   - Any `ProductProposalRegistered` events as proposed-but-not-fixture
//     products. Latest-by-asOf wins per productId.
//   - Per-product, per-dimension attestation summary derived from
//     `ProductDimensionAttested` events (latest-by-asOf per dimension).
//   - Per-product approval status from `ProductApproved` / `ProductWithheld`.
//
// Surface: GET /api/products (wired in server.ts).
// Consumed by: /products dashboard page (the cross-family NPA review console).
//
// Authority chain (Principle 2 upward):
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10) §5 — 14 dimensions.
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) — Product type
//     + product-lifecycle event family.
//
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import {
  PRODUCT_TYPED_EVENT_TYPES,
  type ProductDeferredGap,
  type ProductScopeForEvent,
} from "../platform/event-store/event-types/product";
import type { EventStore } from "../platform/event-store/store";
import type { Product } from "../platform/markets/products";
import {
  M1_JSE_EQUITY_CASH_FIXTURE,
  M2_SAGB_FIXED_COUPON_FIXTURE,
  M4_FX_OTC_VANILLA_FIXTURE,
  M4_FX_SPOT_FIXTURE,
  M5_REPO_FIXTURE,
  M6_MMD_DEPOSIT_FIXTURE,
  M7_FUNDING_LINE_FIXTURE,
  M8_IBL_FIXTURE,
} from "../platform/markets/products/fixtures";
import { validateNpaGate } from "../platform/markets/products/npa-gate";
import {
  ALL_NPA_DIMENSION_KEYS,
  buildProductRegisterView,
} from "../platform/projections/products/product-register";

// ---------------------------------------------------------------------------
// The 14 NPA dimensions — source of truth: NPA Policy v1.0 §5.
// ---------------------------------------------------------------------------

export const NPA_DIMENSIONS = [
  "market-risk",
  "credit-risk",
  "liquidity-funding",
  "operational-risk",
  "operational-readiness",
  "accounting",
  "capital",
  "conduct-suitability",
  "aml-sanctions-pep",
  "model-risk",
  "legal-documentation",
  "information-security",
  "privacy",
  "tax",
] as const;
export type NpaDimension = (typeof NPA_DIMENSIONS)[number];

// ---------------------------------------------------------------------------
// Public view types.
// ---------------------------------------------------------------------------

export type DimensionStatus = "pending" | "design-attested" | "implementation-attested" | "failed";

export type ProductApprovalStatus = "pending" | "approved" | "withheld";

export interface ProductListEntry {
  productId: string;
  name: string;
  family: string;
  description: string;
  lifecycle: string;
  currency: string;
  jurisdiction: string;
  approval: {
    status: ProductApprovalStatus;
    approvedAt?: string;
    withheldAt?: string;
    withheldReason?: string;
  };
  /** Typed product scope (D-FX-OTC-NPA-SCOPE-EXPANSION), if declared. */
  scope?: ProductScopeForEvent;
  /** Per-dimension latest status — one row per NPA dimension. */
  dimensions: Record<NpaDimension, DimensionStatus>;
  /** Tracked deferred gaps across all dimensions (D-FX-OTC-NPA-SCOPE-EXPANSION) —
   *  "approved with tracked deferred gaps". Each carries its dimension. */
  deferredGaps: (ProductDeferredGap & { dimension: string })[];
  /** NPA gate summary derived from the product-register projection. */
  npaGateStatus: {
    ready: boolean;
    missing: string[];
    attestedCount: number;
    totalDimensions: 14;
  };
  /** Source: "fixture" (baseline) or "proposal" (registered via UI). */
  origin: "fixture" | "proposal";
}

export interface ProductListView {
  products: ProductListEntry[];
  asOf: string;
}

// ---------------------------------------------------------------------------
// Baseline fixtures.
// ---------------------------------------------------------------------------

const BASELINE_FIXTURES: readonly Product[] = [
  M1_JSE_EQUITY_CASH_FIXTURE,
  M2_SAGB_FIXED_COUPON_FIXTURE,
  M4_FX_OTC_VANILLA_FIXTURE,
  M4_FX_SPOT_FIXTURE,
  M5_REPO_FIXTURE,
  M6_MMD_DEPOSIT_FIXTURE,
  M7_FUNDING_LINE_FIXTURE,
  M8_IBL_FIXTURE,
];

interface ProposalRecord {
  productId: string;
  family: string;
  name: string;
  description: string;
  currency: string;
  jurisdiction: string;
  proposedAt: string;
}

// ---------------------------------------------------------------------------
// View builder.
// ---------------------------------------------------------------------------

export function buildProductListView(
  store: Pick<EventStore, "replay">,
  nowIso: string,
): ProductListView {
  const proposals = new Map<string, ProposalRecord>();
  const approvals = new Map<
    string,
    { status: ProductApprovalStatus; asOf: string; reason?: string }
  >();
  const dimensionFolds = new Map<
    string,
    Map<
      NpaDimension,
      { status: DimensionStatus; asOf: string; deferredGaps?: ProductDeferredGap[] }
    >
  >();

  // Build the product-register projection for NPA gate status.
  // We collect all events first, then build the register.
  const allEvents = Array.from(store.replay());
  const productEventTypeSet = new Set<string>(PRODUCT_TYPED_EVENT_TYPES);
  const productRegister = buildProductRegisterView(
    allEvents.filter((ev) => productEventTypeSet.has(ev.type)),
  );

  for (const ev of allEvents) {
    if (ev.type === "ProductProposalRegistered") {
      const p = ev.payload as Record<string, unknown>;
      const productId = String(p.productId ?? "");
      if (!productId) continue;
      const existing = proposals.get(productId);
      const proposedAt = ev.as_of;
      if (existing && existing.proposedAt >= proposedAt) continue;
      proposals.set(productId, {
        productId,
        family: String(p.family ?? "unknown"),
        name: String(p.name ?? productId),
        description: String(p.description ?? ""),
        currency: String(p.currency ?? "ZAR"),
        jurisdiction: String(p.jurisdiction ?? "ZA"),
        proposedAt,
      });
      continue;
    }
    if (ev.type === "ProductApproved" || ev.type === "ProductWithheld") {
      const p = ev.payload as Record<string, unknown>;
      const productId = String(p.productId ?? "");
      if (!productId) continue;
      const prev = approvals.get(productId);
      if (prev && prev.asOf >= ev.as_of) continue;
      if (ev.type === "ProductApproved") {
        approvals.set(productId, { status: "approved", asOf: ev.as_of });
      } else {
        const reason = typeof p.reason === "string" ? p.reason : undefined;
        approvals.set(productId, { status: "withheld", asOf: ev.as_of, reason });
      }
      continue;
    }
    if (ev.type === "ProductDimensionAttested") {
      const p = ev.payload as Record<string, unknown>;
      const productId = String(p.productId ?? "");
      const dimension = String(p.dimension ?? "") as NpaDimension;
      const result = String(p.result ?? "") as DimensionStatus;
      if (!productId || !NPA_DIMENSIONS.includes(dimension)) continue;
      let perProduct = dimensionFolds.get(productId);
      if (!perProduct) {
        perProduct = new Map();
        dimensionFolds.set(productId, perProduct);
      }
      const prev = perProduct.get(dimension);
      if (prev && prev.asOf >= ev.as_of) continue;
      const deferredGaps = Array.isArray(p.deferredGaps)
        ? (p.deferredGaps as ProductDeferredGap[])
        : undefined;
      perProduct.set(dimension, {
        status: result,
        asOf: ev.as_of,
        ...(deferredGaps && deferredGaps.length > 0 ? { deferredGaps } : {}),
      });
    }
  }

  // Compose entries — fixtures first, then proposals not already covered.
  const entries: ProductListEntry[] = [];

  for (const fx of BASELINE_FIXTURES) {
    entries.push(buildEntryFromFixture(fx, approvals, dimensionFolds, productRegister));
  }
  for (const proposal of proposals.values()) {
    if (entries.some((e) => e.productId === proposal.productId)) continue;
    entries.push(buildEntryFromProposal(proposal, approvals, dimensionFolds, productRegister));
  }

  // Stable ordering: family then name.
  entries.sort((a, b) => {
    if (a.family !== b.family) return a.family.localeCompare(b.family);
    return a.name.localeCompare(b.name);
  });

  return { products: entries, asOf: nowIso };
}

function emptyDimensionMap(): Record<NpaDimension, DimensionStatus> {
  const out = {} as Record<NpaDimension, DimensionStatus>;
  for (const d of NPA_DIMENSIONS) out[d] = "pending";
  return out;
}

type DimensionFold = Map<
  NpaDimension,
  { status: DimensionStatus; asOf: string; deferredGaps?: ProductDeferredGap[] }
>;

function applyDimensionFold(
  productId: string,
  base: Record<NpaDimension, DimensionStatus>,
  dimensionFolds: Map<string, DimensionFold>,
): Record<NpaDimension, DimensionStatus> {
  const fold = dimensionFolds.get(productId);
  if (!fold) return base;
  for (const [dim, value] of fold) base[dim] = value.status;
  return base;
}

/** Flatten the tracked deferred gaps across all dimensions of a product, each
 *  tagged with the dimension it sits under (D-FX-OTC-NPA-SCOPE-EXPANSION). */
function collectDeferredGaps(
  productId: string,
  dimensionFolds: Map<string, DimensionFold>,
): (ProductDeferredGap & { dimension: string })[] {
  const fold = dimensionFolds.get(productId);
  if (!fold) return [];
  const out: (ProductDeferredGap & { dimension: string })[] = [];
  for (const [dim, value] of fold) {
    for (const gap of value.deferredGaps ?? []) out.push({ ...gap, dimension: dim });
  }
  return out;
}

function buildNpaGateStatus(
  productId: string,
  productRegister: ReturnType<typeof buildProductRegisterView>,
): ProductListEntry["npaGateStatus"] {
  const row = productRegister.get(productId);
  if (!row) {
    // No lifecycle events yet — all 14 dimensions pending.
    return {
      ready: false,
      missing: [...ALL_NPA_DIMENSION_KEYS],
      attestedCount: 0,
      totalDimensions: 14,
    };
  }
  const gateResult = validateNpaGate(row);
  return {
    ready: gateResult.ready,
    missing: [...gateResult.missing],
    attestedCount: row.attestedDimensions.size,
    totalDimensions: 14,
  };
}

function buildEntryFromFixture(
  fx: Product,
  approvals: Map<string, { status: ProductApprovalStatus; asOf: string; reason?: string }>,
  dimensionFolds: Map<string, DimensionFold>,
  productRegister: ReturnType<typeof buildProductRegisterView>,
): ProductListEntry {
  const approval = approvals.get(fx.productId);
  const dimensions = applyDimensionFold(fx.productId, emptyDimensionMap(), dimensionFolds);
  const regRow = productRegister.get(fx.productId);
  const scope = (fx.scope ?? regRow?.scope) as ProductScopeForEvent | undefined;
  // A ProductRetired event in the register supersedes the fixture's static stage.
  const lifecycle = regRow?.lifecycleStage === "retired" ? "retired" : fx.lifecycle;
  return {
    productId: fx.productId,
    name: fx.name,
    family: fx.family,
    description: fx.description,
    lifecycle,
    currency: fx.currency,
    jurisdiction: fx.jurisdiction,
    ...(scope ? { scope } : {}),
    approval: approval
      ? {
          status: approval.status,
          ...(approval.status === "approved" ? { approvedAt: approval.asOf } : {}),
          ...(approval.status === "withheld"
            ? {
                withheldAt: approval.asOf,
                ...(approval.reason ? { withheldReason: approval.reason } : {}),
              }
            : {}),
        }
      : { status: "pending" },
    dimensions,
    deferredGaps: collectDeferredGaps(fx.productId, dimensionFolds),
    npaGateStatus: buildNpaGateStatus(fx.productId, productRegister),
    origin: "fixture",
  };
}

function buildEntryFromProposal(
  proposal: ProposalRecord,
  approvals: Map<string, { status: ProductApprovalStatus; asOf: string; reason?: string }>,
  dimensionFolds: Map<string, DimensionFold>,
  productRegister: ReturnType<typeof buildProductRegisterView>,
): ProductListEntry {
  const approval = approvals.get(proposal.productId);
  const dimensions = applyDimensionFold(proposal.productId, emptyDimensionMap(), dimensionFolds);
  const regRow = productRegister.get(proposal.productId);
  const scope = regRow?.scope;
  const lifecycle =
    regRow?.lifecycleStage === "retired"
      ? "retired"
      : approval?.status === "approved"
        ? "approved-conditional"
        : "proposed";
  return {
    productId: proposal.productId,
    name: proposal.name,
    family: proposal.family,
    description: proposal.description,
    lifecycle,
    currency: proposal.currency,
    jurisdiction: proposal.jurisdiction,
    ...(scope ? { scope } : {}),
    approval: approval
      ? {
          status: approval.status,
          ...(approval.status === "approved" ? { approvedAt: approval.asOf } : {}),
          ...(approval.status === "withheld"
            ? {
                withheldAt: approval.asOf,
                ...(approval.reason ? { withheldReason: approval.reason } : {}),
              }
            : {}),
        }
      : { status: "pending" },
    dimensions,
    deferredGaps: collectDeferredGaps(proposal.productId, dimensionFolds),
    npaGateStatus: buildNpaGateStatus(proposal.productId, productRegister),
    origin: "proposal",
  };
}

/** Helper for downstream views (products-detail.ts) — resolve the canonical
 *  Product record for a productId, returning the fixture if present or
 *  reconstructing a minimal Product from the latest proposal event. */
export function resolveProduct(
  productId: string,
  store: Pick<EventStore, "replay">,
): Product | null {
  for (const fx of BASELINE_FIXTURES) {
    if (fx.productId === productId) return fx;
  }
  let latest: ProposalRecord | null = null;
  for (const ev of store.replay()) {
    if (ev.type !== "ProductProposalRegistered") continue;
    const p = ev.payload as Record<string, unknown>;
    if (String(p.productId ?? "") !== productId) continue;
    if (latest && latest.proposedAt >= ev.as_of) continue;
    latest = {
      productId,
      family: String(p.family ?? "unknown"),
      name: String(p.name ?? productId),
      description: String(p.description ?? ""),
      currency: String(p.currency ?? "ZAR"),
      jurisdiction: String(p.jurisdiction ?? "ZA"),
      proposedAt: ev.as_of,
    };
  }
  if (!latest) return null;
  return synthesiseProductFromProposal(latest);
}

function synthesiseProductFromProposal(p: ProposalRecord): Product {
  // Minimal Product skeleton for proposed-only entries. Fields not yet
  // attested carry conservative defaults; the page surfaces these as
  // "pending" so the user can see exactly what is unfilled.
  return {
    productId: p.productId,
    family: p.family as Product["family"],
    version: "0.1.0",
    name: p.name,
    description: p.description,
    franchiseScope: "institutional",
    legalEntityId: "LE-BANK-SA",
    currency: p.currency,
    jurisdiction: p.jurisdiction,
    cdmComposition: {
      primitives: [
        {
          module: "@platform/markets/cdm/primitives",
          symbol: "instrumentSchema",
          role: "placeholder — composition not yet attested",
        },
      ],
      extensions: [],
      compositionRule: "TBD — composition not yet attested",
    },
    lifecycleEventFamily: [],
    riskProfile: {
      marketRiskDimensions: [],
      creditRiskShape: "no-counterparty",
      liquidityClassification: "non-hqla",
      fundingProfile: "cash-funded",
      modelRiskTier: "tier-3",
    },
    accountingClassification: {
      ifrs9Family: "fvtpl",
      ifrs13FairValueHierarchy: "level-3",
      ias21FxTreatment: "n/a",
      baReturnLineMapping: [],
    },
    legalDocumentation: {
      masterAgreement: "none-listed",
      ectaExecutionPath: "electronic-default",
      jurisdictionMatrix: [p.jurisdiction],
    },
    operationalReadiness: {
      settlementPath: "TBD",
      reconciliationCadence: "daily",
      substrateCompletenessGate: "TBD",
    },
    securityProfile: {
      threatModelRef: "ORG-CY-01",
      hsmCustodyRequired: false,
      zeroTrustPosture: "default",
    },
    policyAttestations: [],
    lifecycle: "proposed",
    citations: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
  };
}
