// dashboard/products-detail.ts
//
// Per-product detail assembler for the /products page. Joins:
//   - the canonical Product record (fixture or proposal-synthesised),
//   - the 14 NPA dimension cards (owner + artefact + fail rule + citation
//     + latest attestation status + latest agent-authored narrative),
//   - a worked-journal-entry preview per lifecycle event in the product's
//     `lifecycleEventFamily` (joined against a static posting-rule index).
//
// Surface: GET /api/products/:productId (wired in server.ts).
//
// Authority chain (Principle 2 upward):
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10) §5 — 14 dimensions.
//
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { resolve as resolvePath } from "node:path";

import type { EventStore } from "../platform/event-store/store";
import type { Product } from "../platform/markets/products";

import { type DimensionPolicyChain, resolveDimensionChain } from "./products-policy-chain";
import { NPA_DIMENSIONS, type NpaDimension, resolveProduct } from "./products-view";

// ---------------------------------------------------------------------------
// NPA dimension metadata — canonical source of truth: NPA Policy v1.0 §5.
// Each row pairs the dimension with: human label, owning agent (name +
// position per identity discipline), required artefact, fail rule, citation
// chain. All fields verbatim from the policy table.
// ---------------------------------------------------------------------------

export interface DimensionMetadata {
  dimension: NpaDimension;
  label: string;
  owner: { name: string; position: string };
  artefactRequired: string;
  failRule: string;
  citationChain: readonly string[];
  /** Helps the page render onboarding implications next to conduct / AML / legal. */
  surfacesClientOnboarding: boolean;
  /**
   * Anchor policies for this dimension — file basenames under
   * `/Policies/`. The policy-chain resolver expands these into the full
   * Policy → Procedure → Function chain at request time. Empty array =
   * no policy chain rendered (used for the engineering-only
   * `operational-readiness` substrate dimension).
   */
  policyHints: readonly string[];
}

export const DIMENSION_METADATA: readonly DimensionMetadata[] = [
  {
    dimension: "market-risk",
    label: "Market risk",
    owner: { name: "Helena", position: "Chief Risk Officer (governance)" },
    artefactRequired:
      "Sensitivity profile (delta, gamma, vega, basis where relevant); RAS § B-market envelope check; pricing-model Tier-classification per Nadia methodology.",
    failRule:
      "Pricing model not validated at appropriate Tier; OR sensitivity profile exceeds RAS § B-market envelope at expected book size; OR the product introduces a non-modellable risk factor (FRTB NMRF) without an interim treatment.",
    citationChain: ["BCBS-d352", "BCBS-d457", "RAS § B-market", "ORG-PR-19"],
    surfacesClientOnboarding: false,
    policyHints: ["market-risk-policy-v1.md"],
  },
  {
    dimension: "credit-risk",
    label: "Credit risk",
    owner: { name: "Helena", position: "Chief Risk Officer (governance)" },
    artefactRequired:
      "SA-CCR computation for the product class; counterparty-rating coverage check; concentration impact at expected book size against ORG-PR-09 ceiling.",
    failRule:
      "Pre-deal credit engine returns withhold at expected book size; OR breach of pre-deal envelope; OR counterparty class lacks rating coverage and no interim treatment.",
    citationChain: ["BCBS-Large-Exposures", "Banks-Act-94-1990", "ORG-PR-09", "ORG-PR-16"],
    surfacesClientOnboarding: false,
    policyHints: ["credit-risk-policy-v1.md", "counterparty-onboarding-policy-v1.md"],
  },
  {
    dimension: "liquidity-funding",
    label: "Liquidity / funding",
    owner: { name: "Eitan", position: "Head of Treasury (governance)" },
    artefactRequired:
      "LCR / NSFR contribution computation; HQLA classification of any held collateral; FTP attribution methodology.",
    failRule:
      "Net LCR or NSFR effect breaches RAS § B-liquidity envelope at expected book size; OR FTP contribution unattributable under the FTP methodology; OR HQLA classification ambiguous.",
    citationChain: ["BCBS-d295", "BCBS-d335", "ORG-PR-06", "ORG-PR-07", "ORG-PR-08"],
    surfacesClientOnboarding: false,
    policyHints: ["liquidity-risk-management-policy-v1.md", "irrbb-policy-v1.md"],
  },
  {
    dimension: "operational-risk",
    label: "Operational risk",
    owner: { name: "Devon", position: "Chief Operating Officer (governance)" },
    artefactRequired:
      "Process-readiness checklist; severe-but-plausible scenario set; vendor-concentration analysis; intersection with Important Business Services per Operational Resilience Policy.",
    failRule:
      "Critical operational dependency without backup or rehearsed recovery; OR resilience gap unmitigated at launch; OR process-readiness checklist incomplete.",
    citationChain: ["BCBS-OpRisk-2021", "BCBS-OpResilience-2021", "ORG-PR-17", "ORG-PR-18"],
    surfacesClientOnboarding: false,
    policyHints: ["operational-risk-policy-v1.md", "operational-resilience-policy-v1.md"],
  },
  {
    dimension: "operational-readiness",
    label: "Operational readiness (substrate)",
    owner: { name: "Tomas", position: "Settlements engineer (engineering)" },
    artefactRequired:
      "Substrate-completeness attestation: all required event types registered; settlement path live (or simulator-equivalent in build phase); reconciliation harness covers the new product class; lifecycle handlers complete.",
    failRule:
      "Any required substrate component is not yet built; OR reconciliation harness does not cover the product's lifecycle events; OR settlement path absent and no simulator coverage.",
    citationChain: ["CLAUDE.md-P1", "CLAUDE.md-P3", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    surfacesClientOnboarding: false,
    // Engineering substrate dimension — no governance policy anchors;
    // chain rendering is skipped (the Operational Readiness story is
    // covered by Tomas's procedures + the lifecycle-event journal block
    // already on the page).
    policyHints: [],
  },
  {
    dimension: "accounting",
    label: "Accounting classification",
    owner: { name: "Bea", position: "Accounting & financial reporting engineer (engineering)" },
    artefactRequired:
      "IFRS 9 SPPI test result + business-model classification (amortised cost / FVOCI / FVTPL); IFRS 13 fair-value-hierarchy assignment (Level 1 / 2 / 3); IAS 21 FX treatment; sub-ledger posting map; BA-return cell mapping.",
    failRule:
      "Classification ambiguous between IFRS 9 categories; OR fair-value level cannot be determined from the pricing model; OR sub-ledger postings undefined for any lifecycle event.",
    citationChain: ["IFRS-9", "IFRS-13", "IAS-21", "ORG-AC-15"],
    surfacesClientOnboarding: false,
    policyHints: [
      "accounting-policies-ifrs-v1.md",
      "hedge-accounting-policy-v1.md",
      "ifrs9-ecl-provisioning-policy-v1.md",
    ],
  },
  {
    dimension: "capital",
    label: "Capital impact",
    owner: { name: "Camille", position: "Chief Financial Officer (governance)" },
    artefactRequired:
      "Pre-deal RWA delta engine output for the product class at expected book size; capital-headroom check against RAS § B-capital; Pillar 2A add-on consideration.",
    failRule:
      "Estimated capital headroom breach at expected book size; OR RWA model uncalibrated for the product class; OR Pillar 2A add-on indicated and not provisioned.",
    citationChain: ["Banks-Act-Reg-39", "Basel-III-IV", "ORG-PR-02", "ORG-PR-03", "ORG-PR-05"],
    surfacesClientOnboarding: false,
    policyHints: ["capital-management-policy-v1.md"],
  },
  {
    dimension: "conduct-suitability",
    label: "Conduct / suitability",
    owner: { name: "Zara", position: "Chief Compliance Officer (governance)" },
    artefactRequired:
      "FAIS conduct treatment determination; FSCA Conduct Standard 1–3 of 2018 mapping; TCF posture for institutional-only flow.",
    failRule:
      "Client class outside institutional-only without strategic-foundation amendment; OR conduct posture inconsistent with FSCA Conduct Standard 3/2018; OR FAIS-exemption assumption invalid for any counterparty class targeted.",
    citationChain: [
      "FAIS-Act-37-2002",
      "FSCA-Conduct-Standard-1-2018",
      "FSCA-Conduct-Standard-2-2018",
      "FSCA-Conduct-Standard-3-2018",
      "ORG-CD-01",
      "ORG-CS3-001",
    ],
    surfacesClientOnboarding: true,
    policyHints: ["conduct-of-business-tcf-policy-v1.md", "fais-compliance-policy-v1.md"],
  },
  {
    dimension: "aml-sanctions-pep",
    label: "AML / sanctions / PEP",
    owner: { name: "Mira", position: "AML & sanctions engineer (engineering)" },
    artefactRequired:
      "Counterparty CDD pathway extension; sanctions-screening service coverage for any new counterparty class or jurisdiction; PEP-detection gate; STR / CTR pathway for any new transaction shape.",
    failRule:
      "CDD pathway absent for any in-scope counterparty class; OR sanctions service does not extend to the new product's counterparty universe; OR transaction-monitoring rule set has no coverage for the new product's transaction shape.",
    citationChain: ["FIC-Act-38-2001", "UN-OFAC-EU-UK-HMT", "ORG-AML", "ORG-SAN"],
    surfacesClientOnboarding: true,
    policyHints: ["aml-cft-policy-v1.md"],
  },
  {
    dimension: "model-risk",
    label: "Model risk",
    owner: { name: "Nadia", position: "Model risk engineer (engineering)" },
    artefactRequired:
      "Tier-classification of every new pricing, risk, or classification model under the Nadia methodology library; deferral pointer to RAS § B7 examples until Helena's Model Risk Policy lands.",
    failRule:
      "Model not validated at appropriate Tier (Tier-1 fully validated; Tier-2 limited; Tier-3 challenger / shadow); OR Tier-classification disagreement between first line and Nadia unresolved.",
    citationChain: ["SR-11-7", "SS-1-23", "BCBS-CG-Principles", "RAS § B7"],
    surfacesClientOnboarding: false,
    policyHints: ["model-risk-policy-v1.md"],
  },
  {
    dimension: "legal-documentation",
    label: "Legal documentation",
    owner: { name: "Imani", position: "Legal documentation engineer (engineering)" },
    artefactRequired:
      "Master-agreement coverage attestation (ISDA Master + ZA Schedule + CSA for OTC IRD; GMRA + SA Schedule for repo; GMSLA for sec-lend; trading agreement for listed cash); ECTA execution path; dispute-resolution procedure; jurisdiction matrix.",
    failRule:
      "Master agreement absent for any in-scope counterparty class; OR ECTA execution path unverified; OR dispute-resolution procedure not in place pre-trade per Conduct Standard 3/2018 §6.",
    citationChain: ["ECTA-25-2002", "ISDA-Master", "GMRA", "GMSLA", "ORG-MK-06", "ORG-CS3-001"],
    surfacesClientOnboarding: true,
    policyHints: ["document-execution-policy-v1.md"],
  },
  {
    dimension: "information-security",
    label: "Information security",
    owner: { name: "Senna", position: "Security engineer (engineering)" },
    artefactRequired:
      "Threat model covering the new product's wire path (FIX, RFQ, confirmation, settlement instruction); HSM key custody where the product introduces signing; zero-trust posture for any new external integration; impact on Important Business Services per Cyber Resilience Policy.",
    failRule:
      "Threat-model gate not closed; OR new external integration introduced without zero-trust pattern; OR HSM key custody not specified for any product-signing path.",
    citationChain: ["Joint-Standard-1-2024", "POPIA-s19-22", "CLAUDE.md-P4", "ORG-CY"],
    surfacesClientOnboarding: false,
    policyHints: ["information-security-it-governance-policy-v1.md"],
  },
  {
    dimension: "privacy",
    label: "Privacy",
    owner: { name: "Iris", position: "Information Officer (governance)" },
    artefactRequired:
      "POPIA classification of any personal data the product touches; cross-border transfer determination; retention-schedule mapping.",
    failRule:
      "POPIA classification missing for any personal-data field; OR cross-border transfer pathway not assessed against POPIA s.72.",
    citationChain: ["POPIA-4-2013", "SARB-Directive-3-2018", "ORG-PR-PRIV"],
    surfacesClientOnboarding: false,
    policyHints: ["popia-privacy-policy-v1.md"],
  },
  {
    dimension: "tax",
    label: "Tax",
    owner: { name: "Yael", position: "Tax engineer (engineering)" },
    artefactRequired:
      "VAT classification; STT classification where listed-equity transfers involved; FATCA / CRS classification of new counterparty class / jurisdiction; transfer-pricing implications for any inter-entity flow; section-24J implications for debt instruments.",
    failRule:
      "Tax classification ambiguous for any cashflow type; OR FATCA/CRS classification not determinable for any counterparty class targeted; OR transfer-pricing methodology absent for inter-entity flows.",
    citationChain: ["Income-Tax-Act", "VAT-Act", "STT-Act", "FATCA-IGA", "CRS"],
    surfacesClientOnboarding: false,
    policyHints: ["tax-policy-v1.md"],
  },
];

// ---------------------------------------------------------------------------
// Posting-rule index — static metadata mapping product-lifecycle event types
// to the implementing posting-rule module + Dr/Cr leg shapes. Mirrors
// platform/accounting/posting-rules/* without invoking them (which requires
// runtime trade inputs). "Missing" rows surface as substrate gaps on the page.
// ---------------------------------------------------------------------------

export interface PostingRuleSummary {
  /** Stable rule ID (e.g. "PR-FX-001"). */
  ruleId: string;
  /** Module path the rule lives in. */
  module: string;
  /** Human-readable legs description — pulled from the rule's docstring. */
  legs: string;
}

const POSTING_RULE_INDEX: Record<string, PostingRuleSummary> = {
  // FX
  FxTradeExecuted: {
    ruleId: "PR-FX-001",
    module: "platform/accounting/posting-rules/fx-spot.ts",
    legs: "Dr FX Trading Receivable (bought ccy) · Cr FX Trading Payable (sold ccy). Balances per currency.",
  },
  FxPositionRevalued: {
    ruleId: "PR-FX-002",
    module: "platform/accounting/posting-rules/fx-spot.ts",
    legs: "Dr/Cr Unrealised FX P&L (FVTPL) · Cr/Dr FX Trading Receivable revaluation. Daily mark.",
  },
  FxSettlementConfirmed: {
    ruleId: "PR-FX-003",
    module: "platform/accounting/posting-rules/fx-spot.ts",
    legs: "DEPRECATED 2026-05-20 — production lifecycle never emitted this event. Superseded by PR-FX-PRIN (per-leg cash) + PR-FX-LIFECYCLE-CLOSE (realised P&L). Kept for back-compat with legacy test fixtures.",
  },
  FxSettlementInstructed: {
    ruleId: "PR-FX-INSTRUCT",
    module: "platform/accounting/posting-rules/fx-spot.ts",
    legs: "Memorandum — instruction issued (MT202 / pacs.009); no cash moved, no GL impact.",
  },
  PrincipalPayment: {
    ruleId: "PR-FX-PRIN",
    module: "platform/accounting/posting-rules/fx-spot.ts",
    legs: "Dr Nostro / Cr FX Receivable (receive leg); Dr FX Payable / Cr Nostro (deliver leg). Per-leg cash at correspondent confirmation.",
  },
  SettlementConfirmed: {
    ruleId: "PR-FX-LIFECYCLE-CLOSE",
    module: "platform/accounting/posting-rules/fx-spot.ts",
    legs: "Realised FX P&L residual: Dr Nostro ZAR / Cr Realised FX P&L (gain); Dr Realised FX P&L / Cr Nostro ZAR (loss). Closes the trade.",
  },
  TradeReportSubmitted: {
    ruleId: "PR-FX-REGREPORT",
    module: "platform/accounting/posting-rules/fx-spot.ts",
    legs: "Memorandum — regulatory dispatch (SARB FinSurv / DTCC); no GL impact.",
  },
  // Equities
  EquityTradeBooked: {
    ruleId: "PR-EQ-001",
    module: "platform/accounting/posting-rules/equities.ts",
    legs: "Dr Equity Trading Asset (FVTPL) · Cr Equity Trading Settlement Payable. T+3 booking.",
  },
  EquitySettlementInstructed: {
    ruleId: "PR-EQ-003",
    module: "platform/accounting/posting-rules/equities.ts",
    legs: "Dr Equity Trading Settlement Payable · Cr Nostro (cash leg). Settlement on T+3.",
  },
  EquityCorporateActionApplied: {
    ruleId: "PR-EQ-CA",
    module: "platform/accounting/posting-rules/equities.ts",
    legs: "Varies by action type: dividend (Dr Cash Receivable / Cr P&L), stock split (memo only).",
  },
  // Bonds
  BondTradeBooked: {
    ruleId: "PR-BOND-001",
    module: "platform/accounting/posting-rules/bonds.ts",
    legs: "Dr Bond Asset (FVOCI for banking book; FVTPL for trading) · Cr Trading Settlement Payable.",
  },
  BondCouponPaid: {
    ruleId: "PR-BOND-EIR",
    module: "platform/accounting/posting-rules/bonds.ts",
    legs: "Dr Cash · Cr Interest Income (EIR for amortised cost; coupon for trading).",
  },
  BondRedeemed: {
    ruleId: "PR-BOND-MAT",
    module: "platform/accounting/posting-rules/bonds.ts",
    legs: "Dr Cash (redemption proceeds) · Cr Bond Asset (carrying amount).",
  },
  BondSettlementInstructed: {
    ruleId: "PR-BOND-SETTLE",
    module: "platform/accounting/posting-rules/bonds.ts",
    legs: "Dr Trading Settlement Payable · Cr Nostro (cash leg). Settlement on T+3.",
  },
  // Lifecycle / lifecycle-shared events with no Bea posting rule today.
  // Returned as "missing" by the lookup below.
  // The four FX lifecycle gaps surfaced by Marc on 2026-05-20 (PR #608, Bea):
  //   - PrincipalPayment            → PR-FX-PRIN          (GL-significant)
  //   - SettlementConfirmed (CDM)   → PR-FX-LIFECYCLE-CLOSE (GL-significant)
  //   - FxSettlementInstructed      → PR-FX-INSTRUCT      (memorandum)
  //   - TradeReportSubmitted        → PR-FX-REGREPORT     (memorandum)
  // are all registered above. PR-FX-003 is retained but deprecated.
};

// ---------------------------------------------------------------------------
// Public view types.
// ---------------------------------------------------------------------------

export interface DimensionCard {
  dimension: NpaDimension;
  label: string;
  owner: { name: string; position: string };
  artefactRequired: string;
  failRule: string;
  citationChain: readonly string[];
  surfacesClientOnboarding: boolean;
  /** Latest ProductDimensionAttested for (productId, dimension). */
  attestation: {
    status: "pending" | "design-attested" | "implementation-attested" | "failed";
    attestedAt?: string;
    attestedBy?: string;
    citationChain?: readonly string[];
  };
  /** Latest ProductDimensionNarrativeRecorded for (productId, dimension). */
  narrative: {
    text: string;
    authorAgentName: string;
    authorAgentPosition: string;
    recordedAt: string;
    citationChain: readonly string[];
  } | null;
  /** Whether a narrative has been requested but not yet recorded. */
  narrativeRequested: boolean;
  /**
   * Policy → Procedure → Function chain applicable to this dimension,
   * resolved at request time from `/Policies/*.md` + `/Procedures/**\/*.md`
   * frontmatter. The dimension's `policyHints` anchor the chain; the
   * resolver expands. Empty `policies` array = no governance-anchored
   * chain for this dimension (e.g. operational-readiness substrate).
   */
  chain: DimensionPolicyChain;
}

export interface LifecycleEventJournalRow {
  eventType: string;
  /** "present" if a Bea posting rule maps this event; "missing" otherwise (substrate gap). */
  status: "present" | "missing";
  rule?: PostingRuleSummary;
}

export interface ProductDetailView {
  product: Product;
  dimensions: DimensionCard[];
  journalEntries: LifecycleEventJournalRow[];
  asOf: string;
}

// ---------------------------------------------------------------------------
// Detail builder.
// ---------------------------------------------------------------------------

export function buildProductDetailView(
  productId: string,
  store: Pick<EventStore, "replay">,
  nowIso: string,
): ProductDetailView | null {
  const product = resolveProduct(productId, store);
  if (!product) return null;

  // Fold attestations and narratives per dimension.
  const attestationFold = new Map<
    NpaDimension,
    {
      status: DimensionCard["attestation"]["status"];
      asOf: string;
      attestedBy: string;
      citationChain: string[];
    }
  >();
  const narrativeFold = new Map<
    NpaDimension,
    {
      text: string;
      authorAgentName: string;
      authorAgentPosition: string;
      asOf: string;
      citationChain: string[];
    }
  >();
  const narrativeRequestFold = new Map<NpaDimension, { asOf: string }>();

  for (const ev of store.replay()) {
    if (ev.type === "ProductDimensionAttested") {
      const p = ev.payload as Record<string, unknown>;
      if (String(p.productId ?? "") !== productId) continue;
      const dimension = String(p.dimension ?? "") as NpaDimension;
      if (!NPA_DIMENSIONS.includes(dimension)) continue;
      const prev = attestationFold.get(dimension);
      if (prev && prev.asOf >= ev.as_of) continue;
      attestationFold.set(dimension, {
        status: String(p.result ?? "pending") as DimensionCard["attestation"]["status"],
        asOf: ev.as_of,
        attestedBy: ev.actor.id ?? "",
        citationChain: Array.isArray(p.citationChain) ? (p.citationChain as string[]) : [],
      });
      continue;
    }
    if (ev.type === "ProductDimensionNarrativeRecorded") {
      const p = ev.payload as Record<string, unknown>;
      if (String(p.productId ?? "") !== productId) continue;
      const dimension = String(p.dimension ?? "") as NpaDimension;
      if (!NPA_DIMENSIONS.includes(dimension)) continue;
      const prev = narrativeFold.get(dimension);
      if (prev && prev.asOf >= ev.as_of) continue;
      narrativeFold.set(dimension, {
        text: String(p.narrative ?? ""),
        authorAgentName: String(p.authorAgentName ?? ""),
        authorAgentPosition: String(p.authorAgentPosition ?? ""),
        asOf: ev.as_of,
        citationChain: Array.isArray(p.citationChain) ? (p.citationChain as string[]) : [],
      });
      continue;
    }
    if (ev.type === "ProductDimensionNarrativeRequested") {
      const p = ev.payload as Record<string, unknown>;
      if (String(p.productId ?? "") !== productId) continue;
      const dimension = String(p.dimension ?? "") as NpaDimension;
      if (!NPA_DIMENSIONS.includes(dimension)) continue;
      const prev = narrativeRequestFold.get(dimension);
      if (prev && prev.asOf >= ev.as_of) continue;
      narrativeRequestFold.set(dimension, { asOf: ev.as_of });
    }
  }

  const repoRoot = resolvePath(import.meta.dir, "..", "..");
  const dimensions: DimensionCard[] = DIMENSION_METADATA.map((meta) => {
    const att = attestationFold.get(meta.dimension);
    const nar = narrativeFold.get(meta.dimension);
    const req = narrativeRequestFold.get(meta.dimension);
    const chain = resolveDimensionChain({ repoRoot, policyHints: meta.policyHints });
    // If the latest recorded narrative is more recent than the latest request,
    // the "pending request" state is cleared.
    const narrativeRequested = req !== undefined && (!nar || nar.asOf < req.asOf);
    return {
      dimension: meta.dimension,
      label: meta.label,
      owner: meta.owner,
      artefactRequired: meta.artefactRequired,
      failRule: meta.failRule,
      citationChain: meta.citationChain,
      surfacesClientOnboarding: meta.surfacesClientOnboarding,
      attestation: att
        ? {
            status: att.status,
            attestedAt: att.asOf,
            attestedBy: att.attestedBy,
            citationChain: att.citationChain,
          }
        : { status: "pending" },
      narrative: nar
        ? {
            text: nar.text,
            authorAgentName: nar.authorAgentName,
            authorAgentPosition: nar.authorAgentPosition,
            recordedAt: nar.asOf,
            citationChain: nar.citationChain,
          }
        : null,
      narrativeRequested,
      chain,
    };
  });

  const journalEntries: LifecycleEventJournalRow[] = product.lifecycleEventFamily.map(
    (eventType) => {
      const rule = POSTING_RULE_INDEX[eventType];
      if (rule) return { eventType, status: "present", rule };
      return { eventType, status: "missing" };
    },
  );

  return {
    product,
    dimensions,
    journalEntries,
    asOf: nowIso,
  };
}
