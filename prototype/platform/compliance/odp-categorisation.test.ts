// platform/compliance/odp-categorisation.test.ts
//
// Unit tests for the ODP client/counterparty categorisation rules engine.
//
// CS 2/2018 §4 + ORG-ODP-COND-002
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";
import {
  type OdpCategoriationDecision,
  determineOdpCategory,
  makeOdpCategoriationDecision,
} from "./odp-categorisation";

// ---------------------------------------------------------------------------
// determineOdpCategory — rule-by-rule
// ---------------------------------------------------------------------------

describe("determineOdpCategory — CS 2/2018 §4 rules engine", () => {
  // -------------------------------------------------------------------------
  // R4: regulated financial institution entity types → counterparty
  // -------------------------------------------------------------------------

  it("R4: regulated bank entity type → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "bank",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: long-term insurer → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "long-term-insurer",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: short-term insurer → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "short-term-insurer",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: authorised FSP → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "fsp",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: CCP (central counterparty) → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "ccp",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: licensed exchange → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "exchange",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: sovereign → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "retail-client",
      entityType: "sovereign",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: central bank → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "retail-client",
      entityType: "central-bank",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: multilateral development bank → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "multilateral-development-bank",
    });
    expect(result).toBe("counterparty");
  });

  it("R4: entity type is case-insensitive (BANK → counterparty)", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "BANK",
    });
    expect(result).toBe("counterparty");
  });

  // -------------------------------------------------------------------------
  // R3: FAIS market-counterparty → counterparty
  // -------------------------------------------------------------------------

  it("R3: FAIS market-counterparty without entity type → counterparty", () => {
    const result = determineOdpCategory({
      faisCategory: "market-counterparty",
    });
    expect(result).toBe("counterparty");
  });

  it("R3: FAIS market-counterparty overrides unrecognised entity type", () => {
    const result = determineOdpCategory({
      faisCategory: "market-counterparty",
      entityType: "corporate",
    });
    expect(result).toBe("counterparty");
  });

  // -------------------------------------------------------------------------
  // R5: default → client
  // -------------------------------------------------------------------------

  it("R5: individual retail client → client", () => {
    const result = determineOdpCategory({
      faisCategory: "retail-client",
      entityType: "natural-person",
    });
    expect(result).toBe("client");
  });

  it("R5: corporate without financial licence → client", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
      entityType: "corporate",
    });
    expect(result).toBe("client");
  });

  it("R5: professional-client with no entity type → client", () => {
    const result = determineOdpCategory({
      faisCategory: "professional-client",
    });
    expect(result).toBe("client");
  });

  it("R5: unknown faisCategory + unknown entityType → client", () => {
    const result = determineOdpCategory({
      faisCategory: "retail-client",
      entityType: "ngo",
    });
    expect(result).toBe("client");
  });

  // -------------------------------------------------------------------------
  // R2: elected up-categorisation → counterparty
  // -------------------------------------------------------------------------

  it("R2: party that elected up-categorisation → counterparty (overrides retail-client faisCategory)", () => {
    const result = determineOdpCategory({
      faisCategory: "retail-client",
      entityType: "corporate",
      electedCounterparty: true,
    });
    expect(result).toBe("counterparty");
  });

  it("R2: electedCounterparty=false has no effect (retail-client stays client)", () => {
    const result = determineOdpCategory({
      faisCategory: "retail-client",
      entityType: "corporate",
      electedCounterparty: false,
    });
    expect(result).toBe("client");
  });

  // -------------------------------------------------------------------------
  // R1: re-categorised back to client — highest priority
  // -------------------------------------------------------------------------

  it("R1: counterparty re-categorised back to client → client (overrides bank entity type)", () => {
    const result = determineOdpCategory({
      faisCategory: "market-counterparty",
      entityType: "bank",
      recategorisedToClient: true,
    });
    expect(result).toBe("client");
  });

  it("R1: re-categorised back overrides electedCounterparty=true", () => {
    const result = determineOdpCategory({
      faisCategory: "market-counterparty",
      entityType: "bank",
      electedCounterparty: true,
      recategorisedToClient: true,
    });
    expect(result).toBe("client");
  });
});

// ---------------------------------------------------------------------------
// makeOdpCategoriationDecision — decision record shape
// ---------------------------------------------------------------------------

describe("makeOdpCategoriationDecision — decision record", () => {
  const NOW = "2026-05-29T09:00:00.000Z";

  it("bank party produces a well-formed counterparty decision", () => {
    const decision: OdpCategoriationDecision = makeOdpCategoriationDecision(
      "cp-001",
      { faisCategory: "professional-client", entityType: "bank" },
      NOW,
    );
    expect(decision.partyId).toBe("cp-001");
    expect(decision.category).toBe("counterparty");
    expect(decision.determinedAt).toBe(NOW);
    expect(decision.electedUpCategorisation).toBe(false);
    expect(decision.reason).toContain("CS 2/2018 §4");
    expect(decision.reason).toContain("bank");
  });

  it("retail individual produces a well-formed client decision", () => {
    const decision = makeOdpCategoriationDecision(
      "cl-001",
      { faisCategory: "retail-client", entityType: "natural-person" },
      NOW,
    );
    expect(decision.partyId).toBe("cl-001");
    expect(decision.category).toBe("client");
    expect(decision.electedUpCategorisation).toBe(false);
    expect(decision.reason).toContain("CS 2/2018 §4");
  });

  it("elected up-categorisation sets electedUpCategorisation=true in decision", () => {
    const decision = makeOdpCategoriationDecision(
      "cp-002",
      { faisCategory: "professional-client", entityType: "corporate", electedCounterparty: true },
      NOW,
    );
    expect(decision.category).toBe("counterparty");
    expect(decision.electedUpCategorisation).toBe(true);
    expect(decision.reason).toContain("§4(3)");
  });

  it("re-categorised back to client sets electedUpCategorisation=false", () => {
    const decision = makeOdpCategoriationDecision(
      "cp-003",
      {
        faisCategory: "market-counterparty",
        entityType: "bank",
        recategorisedToClient: true,
      },
      NOW,
    );
    expect(decision.category).toBe("client");
    expect(decision.electedUpCategorisation).toBe(false);
    expect(decision.reason).toContain("§4(4)");
  });

  it("FAIS market-counterparty reason contains §4(1)(b)", () => {
    const decision = makeOdpCategoriationDecision(
      "cp-004",
      { faisCategory: "market-counterparty" },
      NOW,
    );
    expect(decision.reason).toContain("§4(1)(b)");
  });
});
