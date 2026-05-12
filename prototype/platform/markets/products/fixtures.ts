// platform/markets/products/fixtures.ts
//
// M1, M2, and M4 realistic Product fixtures used by the type round-trip
// test (Slice 1) and by the composition runtime test (Slice 3).
// Realistic JSE equity-cash data; field values are coherent with
// `prototype/platform/markets/cdm/primitives.ts` + `cdm/equity.ts`.
// M4 FX Spot fixture added per D-PRODUCT-CONSTRUCTION-SUBSTRATE +
// D-NEW-PRODUCT-APPROVAL-POLICY (CEO approved 2026-05-10).
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10).
// Source brief §3.1 — M1 listed-equity worked example; §4.1 — M4 FX Spot.
//
// Author: Atlas + Kai (trading systems engineer, engineering) +
//         Saskia (Head of Global Markets, governance) [M4 co-authors].

import type { Product } from "./types";

/**
 * M1 — JSE listed equity (cash). The first product the substrate
 * supports end-to-end. `productId` URN matches the source brief §3.1.
 */
export const M1_JSE_EQUITY_CASH_FIXTURE: Product = {
  productId: "prd:bank:equity:jse-equity-cash",
  family: "listed-equity",
  version: "1.0.0",
  name: "JSE Listed Equity (cash)",
  description:
    "Cash-settled JSE-listed equity. Trading + settlement covers JSE-listed ordinary shares including ETFs. Strate is the central securities depository; T+3 settlement convention; ZAR-denominated.",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "instrumentSchema",
        role: "the listed equity instrument (class: listed-equity)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "identifierSchema",
        role: "ISIN identifier (JSE primary listing)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "trade date + settlement date (T+3, JIHCAL)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "priceSchema",
        role: "execution price per share (ZAR)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "quantitySchema",
        role: "quantity in shares",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "consideration in ZAR (price × quantity, before fees)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "partySchema",
        role: "counterparty + custodian (Strate as CSD)",
      },
      {
        module: "@platform/markets/cdm/equity",
        symbol: "equitySettlementInstructedPayloadSchema",
        role: "Strate physical-settlement leg",
      },
    ],
    extensions: [
      {
        name: "JSE corporate-actions",
        module: "@platform/markets/cdm/equity",
        citationUrn: "JSE-RULES-EQUITIES",
      },
    ],
    compositionRule:
      "Asset(equity) + Identification(ISIN) + Schedule(T+3, JIHCAL) + Cashflow(consideration + commission) + Settlement(Strate, physical) + corporate-action extensions. Lifecycle: EquityTradeBooked -> EquityCorporateActionApplied -> EquitySettlementInstructed.",
  },
  lifecycleEventFamily: [
    "EquityTradeBooked",
    "EquityCorporateActionApplied",
    "EquitySettlementInstructed",
  ],
  riskProfile: {
    marketRiskDimensions: ["delta"],
    creditRiskShape: "principal-on-settlement",
    liquidityClassification: "non-hqla",
    fundingProfile: "cash-funded",
    modelRiskTier: "tier-2",
  },
  accountingClassification: {
    ifrs9Family: "fvtpl",
    ifrs13FairValueHierarchy: "level-1",
    ias21FxTreatment: "n/a",
    baReturnLineMapping: ["BA100.line.34", "BA200.line.18"],
  },
  legalDocumentation: {
    masterAgreement: "none-listed",
    ectaExecutionPath: "electronic-default",
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    settlementPath: "Strate T+3",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "M1-exit",
  },
  securityProfile: {
    threatModelRef: "ORG-CY-01",
    hsmCustodyRequired: false,
    zeroTrustPosture: "default",
  },
  policyAttestations: [],
  lifecycle: "conceptualised",
  citations: [
    "D-MARKETS-SCHEMA-FOUNDATION",
    "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    "JSE-RULES-EQUITIES",
    "FMA-S5",
    "ORG-AC-01",
  ],
};

/**
 * M2 — vanilla fixed-coupon SAGB bond (design fixture; primitives that
 * land at M2 in `cdm/bond.ts` are referenced by name today). Used by
 * Slice 3's composition runtime to assert that a single canonical path
 * composes both M1 and M2 products deterministically (Q1 resolution).
 */
export const M2_SAGB_FIXED_COUPON_FIXTURE: Product = {
  productId: "prd:bank:bond:sagb-fixed-coupon",
  family: "listed-bond",
  version: "1.0.0",
  name: "SAGB fixed-coupon bond",
  description:
    "South African government bond, fixed coupon. Semi-annual coupon, ACT/365 day-count (SA convention), Strate-bond settlement. Tradeable across primary auction and secondary market; eligible for repo (M2 repo product references this asset).",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "instrumentSchema",
        role: "the bond (class: listed-bond)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "identifierSchema",
        role: "SAGB ISIN",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "coupon schedule (semi-annual) + maturity dates",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "priceSchema",
        role: "clean / dirty price",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "consideration in ZAR",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "quantitySchema",
        role: "face-value held (unit: bond-face)",
      },
      {
        // M2 deliverable in cdm/bond.ts. Composition runtime tolerates
        // forward references; the composeProduct() validator only
        // asserts the role + module path are well-formed.
        module: "@platform/markets/cdm/bond",
        symbol: "couponScheduleSchema",
        role: "coupon + redemption schedule (planned M2 in cdm/bond.ts)",
      },
      {
        module: "@platform/markets/cdm/bond",
        symbol: "fixedCashflowSchema",
        role: "fixed coupon + redemption cashflows (planned M2 in cdm/bond.ts)",
      },
    ],
    extensions: [
      {
        name: "ACT/365 SA day-count",
        module: "@platform/markets/cdm/bond",
        citationUrn: "urn:obligation:bank:mk:jse-debt-listing-rules:v1",
      },
    ],
    compositionRule:
      "Asset(bond) + Identification(ISIN) + Schedule(coupon + maturity) + Cashflow(fixed-coupon + redemption) + Settlement(Strate-bond). Lifecycle: BondTradeBooked -> BondCouponPaid x N -> BondRedeemed -> BondSettlementInstructed.",
  },
  lifecycleEventFamily: [
    "BondTradeBooked",
    "BondCouponPaid",
    "BondRedeemed",
    "BondSettlementInstructed",
  ],
  riskProfile: {
    marketRiskDimensions: ["curve", "basis"],
    creditRiskShape: "principal-on-settlement",
    liquidityClassification: "hqla-eligible-l1",
    fundingProfile: "repo-funded",
    modelRiskTier: "tier-2",
  },
  accountingClassification: {
    ifrs9Family: "fvoci",
    ifrs13FairValueHierarchy: "level-2",
    ias21FxTreatment: "n/a",
    baReturnLineMapping: ["BA100.line.31", "BA325.line.10"],
  },
  legalDocumentation: {
    masterAgreement: "none-listed",
    ectaExecutionPath: "electronic-default",
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    settlementPath: "Strate-bond T+3",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "M2-exit",
  },
  securityProfile: {
    threatModelRef: "ORG-CY-01",
    hsmCustodyRequired: false,
    zeroTrustPosture: "default",
  },
  policyAttestations: [],
  lifecycle: "conceptualised",
  citations: [
    "D-MARKETS-SCHEMA-FOUNDATION",
    "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    "urn:obligation:bank:mk:jse-debt-listing-rules:v1",
    "FMA-S5",
    "ORG-AC-01",
  ],
};

/**
 * M4 — FX Spot (ZAR/USD). The first FX product the substrate supports.
 * `productId` URN matches the source brief §4.1 (FX product-family proposal).
 *
 * CDM composition per §4.1:
 *   Asset(currency pair ZAR/USD) + Cashflow×2 (client pays ZAR; bank pays USD) +
 *   Schedule(T+2, ZA+US calendar intersection) +
 *   Settlement(physical, PvP via correspondent per D-FX-CLS-MEMBERSHIP) +
 *   Identification(counterparty LEI, bank entity, ZA jurisdiction, FinSurv category)
 *
 * NPA gates cleared (design-attestation, lifecycle: "conceptualised"):
 *   trading-mandate-alignment, cdm-composition-complete, lifecycle-event-family-named,
 *   risk-profile-populated, accounting-classification, regulatory-capital-approach,
 *   finsurv-category-declared, settlement-path-declared.
 *
 * Five pre-go-live gates deferred to commencement-of-trading per
 * project_product_lifecycle_npa_vs_engineering.md:
 *   model-risk (Nadia), security (Senna), legal-documentation (Imani),
 *   operational-readiness (Devon), conduct-aml (Zara).
 *
 * Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE · D-NEW-PRODUCT-APPROVAL-POLICY ·
 *            D-MARKETS-SCHEMA-FOUNDATION · D-FX-BOOK-BOUNDARY · D-FX-CLS-MEMBERSHIP ·
 *            D-FX-AD-STATUS · ORG-EXCON-ODP-001 · ORG-MK-08
 *
 * Authors: Kai (trading systems engineer, engineering) +
 *          Saskia (Head of Global Markets, governance) — M4 Slice 1.
 */
export const M4_FX_SPOT_FIXTURE: Product = {
  productId: "prd:bank:fx:fx-spot-zar-usd",
  family: "fx",
  version: "1.0.0",
  name: "FX Spot (ZAR/USD)",
  description:
    "Deliverable (physical) ZAR/USD FX Spot for institutional counterparties. The bank sells or buys USD against ZAR at the prevailing spot rate, settling T+2 against the ZA+US holiday-calendar intersection. Settlement routes via the bank's CLS-member correspondent bank (PvP path per D-FX-CLS-MEMBERSHIP), eliminating Herstatt risk on the settled leg. Every cross-border ZAR flow is FinSurv-reportable under the bank's full Authorised Dealer status (D-FX-AD-STATUS); the SARB ZAR Fixing Rate (ORG-MK-08) is the primary observable for mark-to-market. Franchise scope is institutional-only, consistent with the strategic foundation (JSE-listed institutions, corporate treasuries, NBFIs).",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/fx",
        symbol: "fxTradeExecutedPayloadSchema",
        role: "Asset primitive: currency pair ZAR/USD — the traded instrument at the type level (Principle 5: currency pair is multi-currency at the type level, no implicit home currency)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "Cashflow primitive (leg 1): client pays ZAR — notional in ZAR flowing from counterparty to bank",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "Cashflow primitive (leg 2): bank pays USD — counter-notional in USD flowing from bank to counterparty",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "Schedule primitive: T+2 settlement date using the ZA+US joint holiday-calendar intersection (JIHCAL)",
      },
      {
        module: "@platform/markets/cdm/fx",
        symbol: "fxSettlementInstructedPayloadSchema",
        role: "Settlement primitive: physical PvP delivery via CLS-member correspondent bank (SWIFT MT202 / pacs.009 path per D-FX-CLS-MEMBERSHIP)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "partySchema",
        role: "Identification primitive: counterparty LEI, bank legal entity (LE-BANK-SA), ZA jurisdiction, FinSurv category per ORG-EXCON-ODP-001",
      },
    ],
    extensions: [
      {
        name: "SA FinSurv category (Excon AD rules)",
        module: "@platform/markets/cdm/fx",
        citationUrn: "ORG-EXCON-ODP-001",
      },
      {
        name: "SARB ZAR Fixing Rate observable",
        module: "@platform/markets/cdm/fx",
        citationUrn: "ORG-MK-08",
      },
    ],
    compositionRule:
      "Asset(currency-pair ZAR/USD) + Cashflow×2(client-pays-ZAR; bank-pays-USD) + Schedule(T+2, ZA+US calendar intersection, JIHCAL) + Settlement(physical, PvP via correspondent per D-FX-CLS-MEMBERSHIP) + Identification(counterparty LEI + bank entity LE-BANK-SA + ZA jurisdiction + FinSurv category ORG-EXCON-ODP-001). Lifecycle: FxTradeExecuted(productTaxonomy='FX-spot') → PrincipalPayment×2 → FxSettlementInstructed×2 → SettlementConfirmed×2 → TradeReportSubmitted{regulator:'SARB-FinSurv'} → TradeMatured.",
  },
  lifecycleEventFamily: [
    "FxTradeExecuted",
    "PrincipalPayment",
    "FxSettlementInstructed",
    "SettlementConfirmed",
    "TradeReportSubmitted",
    "TradeMatured",
  ],
  riskProfile: {
    // FX Spot: FX delta only — no gamma/vega (no optionality in spot).
    marketRiskDimensions: ["delta"],
    // Herstatt risk on the unsettled leg; PvP via correspondent mitigates but
    // does not eliminate the intra-day gap between instruction and settlement.
    creditRiskShape: "principal-on-settlement",
    // FX cash is not HQLA; ZAR spot positions are non-qualifying liquid assets.
    liquidityClassification: "non-hqla",
    fundingProfile: "cash-funded",
    // Tier-1: spot FX uses live quoted market rate (SARB fixing, Reuters);
    // no model complexity — Nadia methodology tier-1 confirmed.
    modelRiskTier: "tier-1",
  },
  accountingClassification: {
    // FX spot in trading book: FVTPL (IFRS 9 §4.1.4 — held for trading).
    ifrs9Family: "fvtpl",
    // Level-1: live quoted market rate (SARB fixing, Reuters spot).
    ifrs13FairValueHierarchy: "level-1",
    // FX monetary item — IAS 21 §23: retranslate at closing rate each period.
    ias21FxTreatment: "monetary",
    // BA-return line mapping: BA350 (market risk) + BA700 (capital adequacy).
    baReturnLineMapping: ["BA350.line.fx-open-position", "BA700.line.rwa-fx"],
  },
  legalDocumentation: {
    // ISDA 2002 master agreement (FX confirmation under ISDA FX definitions).
    masterAgreement: "isda-2002",
    // Electronic execution default (ECTA s.11 — electronic contracts valid).
    ectaExecutionPath: "electronic-default",
    // ZA jurisdiction only (bank is SA-incorporated; counterparties institutional SA).
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    // Physical settlement via correspondent (PvP) on T+2; correspondent routes
    // SWIFT MT202 / pacs.009. Per D-FX-CLS-MEMBERSHIP.
    settlementPath: "correspondent-bank T+2 (PvP per D-FX-CLS-MEMBERSHIP)",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "M4-exit",
  },
  securityProfile: {
    threatModelRef: "ORG-CY-01",
    // FX spot: no HSM custody required at design stage (no private-key signing
    // on the trade leg; SWIFT messaging uses the correspondent's HSM).
    hsmCustodyRequired: false,
    zeroTrustPosture: "default",
  },
  policyAttestations: [
    {
      policy: "D-NEW-PRODUCT-APPROVAL-POLICY",
      version: "1.0.0",
      attestedAt: "2026-05-12T00:00:00.000Z",
      attestedBy: "Kai (trading systems engineer) + Saskia (Head of Global Markets)",
      gatesCleared: [
        "trading-mandate-alignment",
        "cdm-composition-complete",
        "lifecycle-event-family-named",
        "risk-profile-populated",
        "accounting-classification",
        "regulatory-capital-approach",
        "finsurv-category-declared",
        "settlement-path-declared",
      ],
      conditions: [
        "Nadia (model-risk engineer) model-risk gate: Tier-1 confirmed by riskProfile.modelRiskTier; formal attestation event deferred to pre-go-live",
        "Senna (security engineer) security gate: deferred to pre-go-live; ORG-CY-01 threat-model reference held",
        "Imani (legal engineer) legal-documentation gate: ISDA FX definitions + FinSurv mandate letter deferred to pre-go-live",
        "Devon (COO) operational-readiness gate: deferred to pre-go-live; correspondent selection and runbook owned by Devon + Tomas",
        "Zara (AML engineer) conduct/AML gate: deferred to pre-go-live; FinSurv category declared (ORG-EXCON-ODP-001) as design anchor",
      ],
    },
    {
      policy: "D-NEW-PRODUCT-APPROVAL-POLICY",
      version: "1.0.0",
      attestedAt: "2026-05-12T00:00:00.000Z",
      attestedBy: "agent:Nadia,agent:Imani,agent:Devon",
      gatesCleared: ["model-risk", "legal-documentation", "operational-readiness"],
      conditions: [
        "Execute ISDA Master Agreement with each institutional counterparty before first trade",
        "Obtain AD mandate letter from SARB before intermediating on own account",
        "Configure FinSurv per-trade reporting pipeline",
        "Execute CSA with each counterparty where IM/VM obligations apply",
        "Deploy SWIFT integration for correspondent settlement",
        "Integrate live market data feed (Reuters/Bloomberg) for FX rate sourcing",
        "Finalise BCP runbook covering FX Spot trading and settlement",
        "Confirm DTCC/SAFE reporting obligations and deploy pipeline",
        "Execute correspondent bank agreements with Standard Bank (primary) and FirstRand/RMB (backup)",
      ],
    },
  ],
  // Pre-go-live attestations landed (Nadia model-risk, Imani legal-documentation,
  // Devon operational-readiness — 2026-05-12). Remaining gates: Senna security,
  // Zara conduct/AML. Advances to "due-diligence" when all gates are cleared.
  lifecycle: "conceptualised",
  citations: [
    "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    "D-NEW-PRODUCT-APPROVAL-POLICY",
    "D-MARKETS-SCHEMA-FOUNDATION",
    "D-FX-BOOK-BOUNDARY",
    "D-FX-CLS-MEMBERSHIP",
    "D-FX-AD-STATUS",
    "ORG-EXCON-ODP-001",
    "ORG-MK-08",
  ],
};
