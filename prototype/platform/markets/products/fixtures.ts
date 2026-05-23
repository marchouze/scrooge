// platform/markets/products/fixtures.ts
//
// M1, M2, M4 and treasury (M5–M8) product fixtures used by the type
// round-trip test (Slice 1) and by the composition runtime test (Slice 3).
// M4 FX Spot fixture added per D-PRODUCT-CONSTRUCTION-SUBSTRATE +
// D-NEW-PRODUCT-APPROVAL-POLICY (CEO approved 2026-05-10).
// M5–M8 treasury fixtures added per WS3-PR3b (PRs #763–#768).
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
    // Level-2: observable market data (SARB daily fixing, broker spot quotes),
    // not a quoted exchange price for the identical asset. Per Helena
    // (Chief Risk Officer, governance) 2026-05-20 FX-spot-only market-risk
    // scope review §2.2 ("§7 IPV: FX spot is a Level 2 instrument —
    // observable market data, not Level 1 exchange quote"). Atlas's PR #643
    // close-out flagged the prior `"level-1"` value as an inconsistency
    // with the policy ruling. Corrected here per Kai (Markets engineering
    // lead, engineering) Wave-2 scenario extension.
    ifrs13FairValueHierarchy: "level-2",
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

// ─── Treasury products (M5–M8) ────────────────────────────────────────────────
// Added per WS3-PR3b (PRs #763–#768): repo/MMD/IBL event types, lifecycle
// registry, GL posting rules, and ALM book data wired to the treasury
// dashboard. These fixtures make the products visible on the /products NPA
// review console.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION · D-PRODUCT-CONSTRUCTION-SUBSTRATE ·
//            WS1-PR1a (treasury event types + lifecycle + posting rules).

/**
 * M5 — SAGB-backed term repo (bank borrows cash, pledges SAGB collateral).
 * Lifecycle: RepoTradeOpened → RepoStartLegSettled → RepoInterestAccrued ×N
 *            → RepoEndLegSettled | RepoTradeTerminatedEarly.
 * IFRS 9 §3.2.3–3.2.4: collateral not derecognised; cash leg is secured borrowing.
 */
export const M5_REPO_FIXTURE: Product = {
  productId: "prd:bank:treasury:repo-sagb-term",
  family: "repo",
  version: "1.0.0",
  name: "SAGB-backed Term Repo",
  description:
    "Short-term secured borrowing collateralised by South African Government Bonds. The bank sells SAGB bonds to a counterparty under a repurchase agreement and buys them back at a fixed future date. Tenors up to 3 months; rate is agreed at trade inception (repo rate). Collateral remains on-balance-sheet (IAS 39 §27 — not derecognised). Eligible for use in SARB open-market operations and inter-dealer repo market via GMRA.",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "instrumentSchema",
        role: "underlying collateral instrument (SAGB bond)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "cash leg — cash received at start leg (secured borrowing principal)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "repurchase price — principal + accrued repo rate paid at end leg",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "start date + maturity date (term repo schedule)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "partySchema",
        role: "counterparty + bank entity (LE-BANK-SA)",
      },
    ],
    extensions: [
      {
        name: "GMRA 2011 (Global Master Repurchase Agreement)",
        module: "@platform/markets/cdm/repo",
        citationUrn: "D-MARKETS-SCHEMA-FOUNDATION",
      },
    ],
    compositionRule:
      "Asset(collateral:SAGB) + Cashflow×2(start-leg cash-in; end-leg repurchase-out) + Schedule(term, SA calendar) + Party(counterparty LEI + bank). Lifecycle: RepoTradeOpened → RepoStartLegSettled → RepoInterestAccrued×N → RepoEndLegSettled | RepoTradeTerminatedEarly.",
  },
  lifecycleEventFamily: [
    "RepoTradeOpened",
    "RepoStartLegSettled",
    "RepoInterestAccrued",
    "RepoMarginCallIssued",
    "RepoEndLegSettled",
    "RepoTradeTerminatedEarly",
  ],
  riskProfile: {
    marketRiskDimensions: ["curve"],
    creditRiskShape: "principal-on-settlement",
    liquidityClassification: "hqla-eligible-l1",
    fundingProfile: "repo-funded",
    modelRiskTier: "tier-2",
  },
  accountingClassification: {
    ifrs9Family: "amortised-cost",
    ifrs13FairValueHierarchy: "level-2",
    ias21FxTreatment: "n/a",
    baReturnLineMapping: ["BA100.line.repo-borrowing", "BA325.line.hqla-collateral"],
  },
  legalDocumentation: {
    masterAgreement: "gmra-2011",
    ectaExecutionPath: "electronic-default",
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    settlementPath: "Strate-bond T+0 (start leg) + T+0 (end leg)",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "WS1-exit",
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
    "WS1-PR1a",
  ],
};

/**
 * M6 — Money Market Deposit (bank as borrower; institutional depositor).
 * Lifecycle: DepositTaken → DepositRolledOver? → DepositInterestAccrued ×N
 *            → DepositMatured | DepositWithdrawnEarly.
 * IFRS 9 §4.2.1: financial liability at amortised cost.
 */
export const M6_MMD_DEPOSIT_FIXTURE: Product = {
  productId: "prd:bank:treasury:mmd-deposit",
  family: "money-market",
  version: "1.0.0",
  name: "Money Market Deposit",
  description:
    "Short-term ZAR deposit accepted from institutional counterparties (corporate treasuries, NBFIs, other banks). Fixed-term tenors from overnight to 12 months. The bank pays an agreed fixed or floating rate on the deposit principal. Recognised as a financial liability at amortised cost (IFRS 9 §4.2.1). Contributes to LCR outflow modelling (BA 325) and NSFR required stable funding (BA 326).",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "deposit principal — liability recognised at fair value (par) on receipt",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "value date + maturity date (fixed-term schedule)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "priceSchema",
        role: "deposit rate (fixed or floating, quoted as % p.a.)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "partySchema",
        role: "depositor LEI + bank entity (LE-BANK-SA)",
      },
    ],
    extensions: [],
    compositionRule:
      "Liability(deposit principal) + Rate(fixed/floating) + Schedule(term, SA calendar) + Party(depositor + bank). Lifecycle: DepositTaken → DepositInterestAccrued×N → DepositMatured | DepositWithdrawnEarly.",
  },
  lifecycleEventFamily: [
    "DepositTaken",
    "DepositRolledOver",
    "DepositInterestAccrued",
    "DepositMatured",
    "DepositWithdrawnEarly",
  ],
  riskProfile: {
    marketRiskDimensions: ["curve"],
    creditRiskShape: "no-counterparty",
    liquidityClassification: "non-hqla",
    fundingProfile: "cash-funded",
    modelRiskTier: "tier-3",
  },
  accountingClassification: {
    ifrs9Family: "amortised-cost",
    ifrs13FairValueHierarchy: "level-2",
    ias21FxTreatment: "n/a",
    baReturnLineMapping: ["BA100.line.deposits", "BA325.line.lcr-outflow-institutional"],
  },
  legalDocumentation: {
    masterAgreement: "none-listed",
    ectaExecutionPath: "electronic-default",
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    settlementPath: "SAMOS via correspondent T+0",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "WS1-exit",
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
    "WS1-PR1a",
  ],
};

/**
 * M7 — Committed Funding Line (bank draws on bilateral committed facility).
 * Lifecycle: FundingLineDrawn → FundingLineRepaid.
 * IFRS 9 §4.2.1: financial liability at amortised cost on drawdown.
 */
export const M7_FUNDING_LINE_FIXTURE: Product = {
  productId: "prd:bank:treasury:funding-line",
  family: "money-market",
  version: "1.0.0",
  name: "Committed Funding Line",
  description:
    "Bilateral committed credit facility where the bank draws cash from a facility provider (another bank or institutional investor). The bank recognises a financial liability on drawdown (IFRS 9 §4.2.1). Used for contingency liquidity management and to bridge settlement gaps. Classified as 100% LCR outflow (BA 325 Table 2) and required stable funding under NSFR (BA 326).",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "drawdown amount — liability recognised at fair value (par) on drawdown",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "drawdown date + maturity date",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "priceSchema",
        role: "facility rate (margin over JIBAR or fixed rate)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "partySchema",
        role: "facility provider LEI + bank entity (LE-BANK-SA)",
      },
    ],
    extensions: [],
    compositionRule:
      "Liability(drawdown) + Rate(margin over JIBAR) + Schedule(maturity) + Party(facility-provider + bank). Lifecycle: FundingLineDrawn → FundingLineRepaid.",
  },
  lifecycleEventFamily: ["FundingLineDrawn", "FundingLineRepaid"],
  riskProfile: {
    marketRiskDimensions: ["curve"],
    creditRiskShape: "no-counterparty",
    liquidityClassification: "non-hqla",
    fundingProfile: "cash-funded",
    modelRiskTier: "tier-3",
  },
  accountingClassification: {
    ifrs9Family: "amortised-cost",
    ifrs13FairValueHierarchy: "level-2",
    ias21FxTreatment: "n/a",
    baReturnLineMapping: ["BA100.line.funding-lines", "BA325.line.lcr-outflow-100pct"],
  },
  legalDocumentation: {
    masterAgreement: "none-listed",
    ectaExecutionPath: "electronic-default",
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    settlementPath: "SAMOS via correspondent T+0",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "WS1-exit",
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
    "WS1-PR1a",
  ],
};

/**
 * M8 — Interbank Loan Placement (bank as lender to other institutions).
 * Lifecycle: InterbankLoanPlaced → InterbankLoanInterestAccrued ×N
 *            → InterbankLoanMatured | InterbankLoanRecalledEarly.
 * IFRS 9 §4.1.2: financial asset measured at amortised cost (SPPI + HTC).
 */
export const M8_IBL_FIXTURE: Product = {
  productId: "prd:bank:treasury:ibl-placement",
  family: "interbank-loan",
  version: "1.0.0",
  name: "Interbank Loan Placement",
  description:
    "Short-term unsecured cash placement by the bank with another licensed bank. The bank is the lender; the counterparty bank is the borrower. Tenors typically overnight to 3 months. Interest accrues daily at the agreed fixed rate (JIBAR-referenced or fixed). Asset classified at amortised cost under IFRS 9 §4.1.2 (SPPI test passes; held-to-collect business model). Contributes to NSFR available stable funding (BA 326).",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "placement principal — asset recognised at amortised cost on placement date",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "placement date + maturity date",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "priceSchema",
        role: "placement rate (fixed % p.a., JIBAR-linked)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "partySchema",
        role: "borrowing bank LEI + bank entity as lender (LE-BANK-SA)",
      },
    ],
    extensions: [],
    compositionRule:
      "Asset(placement) + Rate(fixed/JIBAR) + Schedule(maturity) + Party(borrowing-bank + bank-as-lender). Lifecycle: InterbankLoanPlaced → InterbankLoanInterestAccrued×N → InterbankLoanMatured | InterbankLoanRecalledEarly.",
  },
  lifecycleEventFamily: [
    "InterbankLoanPlaced",
    "InterbankLoanInterestAccrued",
    "InterbankLoanMatured",
    "InterbankLoanRecalledEarly",
  ],
  riskProfile: {
    marketRiskDimensions: ["curve"],
    creditRiskShape: "principal-on-settlement",
    liquidityClassification: "non-hqla",
    fundingProfile: "cash-funded",
    modelRiskTier: "tier-3",
  },
  accountingClassification: {
    ifrs9Family: "amortised-cost",
    ifrs13FairValueHierarchy: "level-2",
    ias21FxTreatment: "n/a",
    baReturnLineMapping: ["BA100.line.interbank-placements", "BA326.line.nsfr-asf"],
  },
  legalDocumentation: {
    masterAgreement: "none-listed",
    ectaExecutionPath: "electronic-default",
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    settlementPath: "SAMOS via correspondent T+0",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "WS1-exit",
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
    "WS1-PR1a",
  ],
};
