// tests/product-types.test.ts
//
// D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 1 — exit-criterion test.
//
// Round-trips the M1 listed-equity fixture through Zod parse and
// asserts:
//   - The single canonical Product type accepts a realistic M1 fixture
//     (Q1 single-type discipline).
//   - Multi-X discipline is type-level enforced: missing legalEntityId
//     / currency / jurisdiction is rejected.
//   - URN form on productId is enforced.
//   - Citations are non-empty (Principle 2 anchor).
//   - M4 FX Spot fixture passes the full productSchema parse.
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10).
// Source brief: Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §2
// M4 authority: D-NEW-PRODUCT-APPROVAL-POLICY (CEO approved 2026-05-10).
//
// Author: Atlas + Kai (trading systems engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  M1_JSE_EQUITY_CASH_FIXTURE,
  M2_SAGB_FIXED_COUPON_FIXTURE,
  M4_FX_SPOT_FIXTURE,
} from "../platform/markets/products/fixtures";
import { parseProduct, productSchema } from "../platform/markets/products/types";

describe("D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 1 — typed Product layer", () => {
  it("M1 listed-equity fixture round-trips through Zod parse", () => {
    const parsed = parseProduct(M1_JSE_EQUITY_CASH_FIXTURE);
    expect(parsed.productId).toBe("prd:bank:equity:jse-equity-cash");
    expect(parsed.family).toBe("listed-equity");
    expect(parsed.legalEntityId).toBe("LE-BANK-SA");
    expect(parsed.currency).toBe("ZAR");
    expect(parsed.jurisdiction).toBe("ZA");
  });

  it("M2 SAGB-bond fixture also round-trips through the single canonical schema (Q1)", () => {
    // Q1 resolution: one canonical Product type, NOT one per family.
    // The same parser handles equity AND bond fixtures.
    const parsed = parseProduct(M2_SAGB_FIXED_COUPON_FIXTURE);
    expect(parsed.family).toBe("listed-bond");
    expect(parsed.cdmComposition.primitives.length).toBeGreaterThan(0);
  });

  it("rejects a Product missing legalEntityId (Principle 5)", () => {
    const broken = {
      ...M1_JSE_EQUITY_CASH_FIXTURE,
      legalEntityId: undefined,
    };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product missing currency (Principle 5)", () => {
    const broken = {
      ...M1_JSE_EQUITY_CASH_FIXTURE,
      currency: undefined,
    };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product missing jurisdiction (Principle 5)", () => {
    const broken = {
      ...M1_JSE_EQUITY_CASH_FIXTURE,
      jurisdiction: undefined,
    };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product whose currency is not 3-letter uppercase ISO 4217", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, currency: "zar" };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product whose jurisdiction is not 2-letter uppercase ISO-3166-1", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, jurisdiction: "RSA" };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a productId that does not match the URN form", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, productId: "not-a-urn" };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product with empty citations (Principle 2)", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, citations: [] };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product with non-semver version", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, version: "v1" };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("accepts a Product with empty policyAttestations at conceptualisation", () => {
    expect(() => parseProduct(M1_JSE_EQUITY_CASH_FIXTURE)).not.toThrow();
    expect(M1_JSE_EQUITY_CASH_FIXTURE.policyAttestations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// M4 FX Spot — product-type round-trip + NPA gate assertions.
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE · D-NEW-PRODUCT-APPROVAL-POLICY
// Author: Kai (trading systems engineer, engineering) +
//         Saskia (Head of Global Markets, governance).
// ---------------------------------------------------------------------------

describe("D-PRODUCT-CONSTRUCTION-SUBSTRATE M4 — FX Spot product type", () => {
  it("M4 FX Spot fixture passes productSchema Zod parse", () => {
    const parsed = parseProduct(M4_FX_SPOT_FIXTURE);
    expect(parsed.productId).toBe("prd:bank:fx:fx-spot-zar-usd");
    expect(parsed.family).toBe("fx");
    expect(parsed.lifecycle).toBe("conceptualised");
  });

  it("M4 fixture family is 'fx' (M4 phase placement per source brief §10)", () => {
    expect(M4_FX_SPOT_FIXTURE.family).toBe("fx");
  });

  it("M4 fixture lifecycle is 'conceptualised' (design-attestation only)", () => {
    // lifecycle advances to 'due-diligence' only when the five pre-go-live
    // NPA gates (Nadia, Senna, Imani, Devon, Zara) are cleared at
    // commencement-of-trading per project_product_lifecycle_npa_vs_engineering.md
    expect(M4_FX_SPOT_FIXTURE.lifecycle).toBe("conceptualised");
  });

  it("M4 fixture has exactly 6 CDM primitives per §4.1 FX Spot composition", () => {
    expect(M4_FX_SPOT_FIXTURE.cdmComposition.primitives.length).toBe(6);
  });

  it("M4 fixture has exactly 2 extensions (FinSurv category + SARB ZAR Fixing Rate)", () => {
    expect(M4_FX_SPOT_FIXTURE.cdmComposition.extensions.length).toBe(2);
    const urns = M4_FX_SPOT_FIXTURE.cdmComposition.extensions.map((e) => e.citationUrn);
    expect(urns).toContain("ORG-EXCON-ODP-001");
    expect(urns).toContain("ORG-MK-08");
  });

  it("M4 fixture lifecycle event family contains all 6 required FX Spot events", () => {
    const expected = [
      "FxTradeExecuted",
      "PrincipalPayment",
      "FxSettlementInstructed",
      "SettlementConfirmed",
      "TradeReportSubmitted",
      "TradeMatured",
    ];
    expect(M4_FX_SPOT_FIXTURE.lifecycleEventFamily).toEqual(expected);
  });

  it("M4 riskProfile is correct for FX Spot: delta-only, principal-on-settlement, tier-1", () => {
    const rp = M4_FX_SPOT_FIXTURE.riskProfile;
    expect(rp.marketRiskDimensions).toEqual(["delta"]);
    expect(rp.creditRiskShape).toBe("principal-on-settlement");
    expect(rp.liquidityClassification).toBe("non-hqla");
    expect(rp.modelRiskTier).toBe("tier-1");
  });

  it("M4 accountingClassification: FVTPL + level-2 + monetary IAS 21", () => {
    // Updated 2026-05-21 per Helena (Chief Risk Officer, governance) FX-spot
    // scope review §2.2 / §7 IPV — FX spot is a Level 2 instrument
    // (observable market data, not Level 1 exchange quote). Atlas's PR #643
    // close-out flagged the prior "level-1" fixture value as inconsistent
    // with the policy ruling. Kai (Markets engineering lead, engineering)
    // Wave-2 PR — fx-spot-internal-pre-licence-test scenario extension.
    const ac = M4_FX_SPOT_FIXTURE.accountingClassification;
    expect(ac.ifrs9Family).toBe("fvtpl");
    expect(ac.ifrs13FairValueHierarchy).toBe("level-2");
    expect(ac.ias21FxTreatment).toBe("monetary");
  });

  it("M4 policyAttestation clears 8 NPA gates (design-attestation)", () => {
    const att = M4_FX_SPOT_FIXTURE.policyAttestations[0];
    expect(att).toBeDefined();
    if (!att) return; // type narrowing
    expect(att.policy).toBe("D-NEW-PRODUCT-APPROVAL-POLICY");
    expect(att.gatesCleared.length).toBe(8);
    expect(att.gatesCleared).toContain("trading-mandate-alignment");
    expect(att.gatesCleared).toContain("finsurv-category-declared");
    expect(att.gatesCleared).toContain("settlement-path-declared");
  });

  it("M4 policyAttestation defers 5 pre-go-live gates", () => {
    const att = M4_FX_SPOT_FIXTURE.policyAttestations[0];
    expect(att).toBeDefined();
    if (!att) return; // type narrowing
    // 5 conditions = 5 deferred gates
    expect(att.conditions.length).toBe(5);
  });

  it("M4 citations carry all 8 authority references (Principle 2 chain)", () => {
    const required = [
      "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
      "D-NEW-PRODUCT-APPROVAL-POLICY",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "D-FX-BOOK-BOUNDARY",
      "D-FX-CLS-MEMBERSHIP",
      "D-FX-AD-STATUS",
      "ORG-EXCON-ODP-001",
      "ORG-MK-08",
    ];
    for (const cit of required) {
      expect(M4_FX_SPOT_FIXTURE.citations).toContain(cit);
    }
  });

  it("M4 fixture multi-X discipline: ZAR/ZA/LE-BANK-SA (Principle 5)", () => {
    expect(M4_FX_SPOT_FIXTURE.currency).toBe("ZAR");
    expect(M4_FX_SPOT_FIXTURE.jurisdiction).toBe("ZA");
    expect(M4_FX_SPOT_FIXTURE.legalEntityId).toBe("LE-BANK-SA");
  });

  it("M4 fixture round-trips through productSchema without mutation", () => {
    const parsed = productSchema.parse(M4_FX_SPOT_FIXTURE);
    expect(parsed.productId).toBe(M4_FX_SPOT_FIXTURE.productId);
    expect(parsed.version).toBe(M4_FX_SPOT_FIXTURE.version);
    expect(parsed.cdmComposition.primitives.length).toBe(
      M4_FX_SPOT_FIXTURE.cdmComposition.primitives.length,
    );
  });
});
