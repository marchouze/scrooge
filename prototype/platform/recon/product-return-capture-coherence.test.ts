// platform/recon/product-return-capture-coherence.test.ts
//
// Unit tests for the capture-model coherence recon (clauses a-e). Pure: feeds
// synthetic in-memory events + a synthetic contract, asserts the violation set.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { v2ProductRegisteredSchema } from "../../v2-core/banking/events";
import type { ReturnContract } from "../../v2-core/regulatory-returns/cell-contract";
import { reportingTreatmentDeclaredSchema } from "../../v2-core/reporting-treatments/declaration";
import {
  makeProductApproved,
  makeProductReturnDataCaptureDeclared,
} from "../event-store/event-types/product";
import { makeReportingTreatmentDeclared } from "../event-store/event-types/reporting-treatments";
import { makeV2ProductRegistered } from "../event-store/event-types/v2-banking";
import type { Actor, Event } from "../event-store/types";
import { runOnEvents } from "./product-return-capture-coherence";

const ACTOR: Actor = { type: "service", id: "atlas" };
const V1_ID = "prd:bank:credit:loan";
const V2_ID = "prd-v2:bank:credit:loan";

/**
 * A synthetic contract that needs, from `prd:bank:credit:loan`:
 *   - `regulatoryApproach` (required, enum) — C-derivable from standardised-credit
 *   - `hqlaLevel` (required, enum) — NOT C-derivable (the D/honesty-ceiling case)
 */
function contract(): ReturnContract {
  return {
    returnForm: "BA200",
    formName: "Credit Risk",
    obligationId: "ORG-PR-RETURNS-TEST",
    schemaSource: "test",
    cells: [
      {
        returnForm: "BA200",
        cellRef: { xsdElement: "BA20000001" },
        label: "regulatory approach cell",
        regulatoryDefinition: "the regulatory approach",
        citations: [{ obligationId: "ORG-PR-RETURNS-TEST", clause: "test" }],
        valueType: "enum",
        unit: "code",
        derivation: { kind: "direct", expression: "" },
        dataRequirements: [
          {
            sourceKind: "product-attribute",
            ref: `${V1_ID}#regulatoryApproach`,
            description: "the regulatory approach the product is measured under",
            required: true,
          },
        ],
        applicability: { entityScope: "bank", jurisdiction: "ZA", productScope: ["credit"] },
        status: "sourced",
      },
      {
        // Grounds the `exposureClass` capability-row attribute (so clause (c)
        // does not flag the real CAPTURE_CAPABILITY_MAP against this synthetic
        // contract). Optional (required:false) so it is not itself enforced.
        returnForm: "BA200",
        cellRef: { xsdElement: "BA20000003" },
        label: "exposure class cell",
        regulatoryDefinition: "the regulatory exposure class",
        citations: [{ obligationId: "ORG-PR-RETURNS-TEST", clause: "test" }],
        valueType: "enum",
        unit: "code",
        derivation: { kind: "direct", expression: "" },
        dataRequirements: [
          {
            sourceKind: "product-attribute",
            ref: `${V1_ID}#exposureClass`,
            description: "the regulatory exposure class",
            required: false,
          },
        ],
        applicability: { entityScope: "bank", jurisdiction: "ZA", productScope: ["credit"] },
        status: "sourced",
      },
      {
        returnForm: "BA200",
        cellRef: { xsdElement: "BA20000002" },
        label: "hqla level cell",
        regulatoryDefinition: "the HQLA level",
        citations: [{ obligationId: "ORG-PR-RETURNS-TEST", clause: "test" }],
        valueType: "enum",
        unit: "code",
        derivation: { kind: "direct", expression: "" },
        dataRequirements: [
          {
            sourceKind: "product-attribute",
            ref: `${V1_ID}#hqlaLevel`,
            description: "the HQLA level of the held asset",
            required: true,
          },
        ],
        applicability: { entityScope: "bank", jurisdiction: "ZA", productScope: ["credit"] },
        status: "sourced",
      },
    ],
  };
}

function approve(): Event {
  return makeProductApproved({
    asOf: "2026-06-19T00:00:00.000Z",
    entity: "LE-BANK-SA",
    actor: ACTOR,
    citations: ["D-BA-RETURN-DATA-CONTRACT"],
    payload: { productId: V1_ID, version: "1.0.0", conditions: [], approvedBy: "ceo" },
  });
}

function v2Register(): Event {
  return makeV2ProductRegistered({
    asOf: "2026-06-19T00:00:00.000Z",
    entity: "LE-BANK-SA",
    actor: ACTOR,
    citations: ["D-BA-RETURN-DATA-CONTRACT"],
    payload: v2ProductRegisteredSchema.parse({
      kind: "V2ProductRegistered",
      productId: V2_ID,
      name: "Vanilla credit loan",
      ifrs9Family: "interbank-loan",
      filTypeScopes: ["fil:type:credit:loan"],
      reportingTreatmentModuleIds: ["prudential:credit-standardised"],
      v1ProductId: V1_ID,
      currencies: ["ZAR"],
      legalEntityIds: ["LE-BANK-SA"],
      jurisdictions: ["ZA"],
      franchiseScope: "institutional",
      citations: ["D-BA-RETURN-DATA-CONTRACT"],
    }),
  });
}

function treatmentDeclared(): Event {
  return makeReportingTreatmentDeclared({
    asOf: "2026-06-19T00:00:00.000Z",
    entity: "LE-BANK-SA",
    actor: ACTOR,
    citations: ["D-BA-RETURN-DATA-CONTRACT"],
    payload: reportingTreatmentDeclaredSchema.parse({
      kind: "ReportingTreatmentDeclared",
      treatmentId: "prudential:credit-standardised",
      category: "prudential-treatment",
      scope: ["fil:type:credit:*"],
      version: { major: 1, minor: 0 },
      prudential: {
        bankingTradingBook: "banking-book",
        regulatoryApproach: "standardised-credit-risk",
      },
      applicablePostingRuleIds: [],
      cites: ["D-BA-RETURN-DATA-CONTRACT"],
    }),
  });
}

function declareCapture(
  captures: Parameters<typeof makeProductReturnDataCaptureDeclared>[0]["payload"]["captures"],
): Event {
  return makeProductReturnDataCaptureDeclared({
    asOf: "2026-06-19T01:00:00.000Z",
    entity: "LE-BANK-SA",
    actor: ACTOR,
    citations: ["D-BA-RETURN-DATA-CONTRACT"],
    payload: {
      productId: V1_ID,
      captures,
      declaredByName: "Atlas",
      declaredByPosition: "Core banking platform architect",
    },
  });
}

const fails = (events: Event[]): string[] =>
  runOnEvents(events, [contract()])
    .violations.filter((v) => v.severity === "fail")
    .map((v) => v.message);

describe("recon:product-return-capture-coherence", () => {
  it("GREEN: regulatoryApproach derived + hqlaLevel validly declared → no fails", () => {
    const events = [
      approve(),
      v2Register(),
      treatmentDeclared(),
      declareCapture([
        {
          attributeKey: "hqlaLevel",
          valueShape: "enum",
          source: "gl-account",
          ref: "chart-of-accounts#hqlaLevel",
          outOfCompositionJustification:
            "CoA classification of the held asset; not type-determined",
          citations: ["D-BA-RETURN-DATA-CONTRACT"],
        },
      ]),
    ];
    expect(fails(events)).toEqual([]);
  });

  it("clause (a) ungrounded declaration: declaring an attribute no contract needs → fail", () => {
    const events = [
      approve(),
      v2Register(),
      treatmentDeclared(),
      declareCapture([
        {
          attributeKey: "notARealReturnAttribute",
          valueShape: "enum",
          source: "gl-account",
          ref: "chart-of-accounts#x",
          outOfCompositionJustification: "fabricated",
          citations: ["D-BA-RETURN-DATA-CONTRACT"],
        },
      ]),
    ];
    expect(fails(events).some((m) => m.includes("ungrounded declaration"))).toBe(true);
    // hqlaLevel is still required + undeclared → clause (d) also fails (missing).
  });

  it("clause (b) redundant override: declaring a C-derivable attribute → fail", () => {
    const events = [
      approve(),
      v2Register(),
      treatmentDeclared(),
      declareCapture([
        {
          attributeKey: "regulatoryApproach", // already C-derivable from standardised-credit
          valueShape: "enum",
          source: "product-attribute",
          ref: "instance#regulatoryApproach",
          outOfCompositionJustification: "redundant — already composed",
          citations: ["D-BA-RETURN-DATA-CONTRACT"],
        },
        {
          attributeKey: "hqlaLevel",
          valueShape: "enum",
          source: "gl-account",
          ref: "chart-of-accounts#hqlaLevel",
          outOfCompositionJustification: "CoA classification; not type-determined",
          citations: ["D-BA-RETURN-DATA-CONTRACT"],
        },
      ]),
    ];
    expect(fails(events).some((m) => m.includes("redundant override"))).toBe(true);
  });

  it("clause (d) coverage: a required attribute neither derived/declared/gap-tracked → fail", () => {
    // hqlaLevel left undeclared, no gap → clause (d) missing.
    const events = [approve(), v2Register(), treatmentDeclared()];
    expect(fails(events).some((m) => m.includes("not capture-coherent"))).toBe(true);
    expect(fails(events).some((m) => m.includes("hqlaLevel"))).toBe(true);
  });

  it("clause (e) cross-stream: an effective product owing required attrs but no V2 registration → fail", () => {
    // No v2Register() → composition cannot resolve; the product owes required attrs.
    const events = [
      approve(),
      declareCapture([
        {
          attributeKey: "hqlaLevel",
          valueShape: "enum",
          source: "gl-account",
          ref: "chart-of-accounts#hqlaLevel",
          outOfCompositionJustification: "CoA classification; not type-determined",
          citations: ["D-BA-RETURN-DATA-CONTRACT"],
        },
      ]),
    ];
    expect(fails(events).some((m) => m.includes("cross-stream join incoherent"))).toBe(true);
  });
});
