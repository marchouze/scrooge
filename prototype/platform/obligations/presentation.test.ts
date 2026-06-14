// platform/obligations/presentation.test.ts
import { describe, expect, test } from "bun:test";

import {
  deriveRegulator,
  domainDescription,
  obligationTitle,
  parseSection,
  resolveDomain,
} from "./presentation";

describe("domainDescription", () => {
  test("base letter resolves to its label", () => {
    expect(domainDescription("A")).toBe(
      "A — Prudential (capital, liquidity, large exposures, leverage)",
    );
    expect(domainDescription("H")).toBe("H — Tax");
  });

  test("strips a leading 'Domain ' prefix", () => {
    expect(domainDescription("Domain B")).toBe("B — Financial crime, AML / CFT, sanctions");
  });

  test("composite code inherits its base-letter description", () => {
    expect(domainDescription("A-SACCR")).toBe(
      "A-SACCR — Prudential (capital, liquidity, large exposures, leverage)",
    );
  });

  test("explicit extended code wins over base-letter fallback", () => {
    expect(domainDescription("RM")).toBe(
      "RM — Internal-policy citation handles (records management, retention)",
    );
    expect(domainDescription("FX")).toBe(
      "FX — FinSurv reporting (cross-border flows, Authorised Dealer)",
    );
  });

  test("unknown code renders bare; empty renders dash", () => {
    expect(domainDescription("ZZ")).toBe("ZZ");
    expect(domainDescription("")).toBe("—");
  });
});

describe("deriveRegulator — URN-prefix primary", () => {
  test("BCBS / IASB", () => {
    expect(deriveRegulator("urn:reg:bcbs:cre:20.2", "")).toBe("BCBS");
    expect(deriveRegulator("urn:reg:ifrs:ifrs-15", "")).toBe("IASB");
  });

  test("SARB PA family", () => {
    expect(deriveRegulator("urn:reg:za:banks-act-94-1990:s60", "")).toBe(
      "SARB Prudential Authority",
    );
    expect(deriveRegulator("urn:reg:za:banks-d7-2020:s2", "")).toBe("SARB Prudential Authority");
    expect(deriveRegulator("urn:reg:za:rrb:reg38", "")).toBe("SARB Prudential Authority");
  });

  test("Joint Standard before PA / FSCA", () => {
    expect(deriveRegulator("urn:reg:za:js-2-2020:s4", "")).toBe("PA/FSCA Joint Standard");
  });

  test("FSCA / FIC / Information Regulator", () => {
    expect(deriveRegulator("urn:reg:za:cs-1-2018:s3", "")).toBe("FSCA");
    expect(deriveRegulator("urn:reg:za:fais:s7", "")).toBe("FSCA");
    expect(deriveRegulator("urn:reg:za:fic-act:s29", "")).toBe("FIC");
    expect(deriveRegulator("urn:reg:za:popia:s19", "")).toBe("Information Regulator");
  });
});

describe("deriveRegulator — citation fallback for [TBD] urn", () => {
  test("falls back on unmatched/empty urn", () => {
    expect(deriveRegulator("[TBD]", "IFRS 15")).toBe("IASB");
    expect(deriveRegulator("", "FIC Act s.29")).toBe("FIC");
    expect(deriveRegulator("", "FAIS General Code of Conduct")).toBe("FSCA");
    expect(deriveRegulator("", "Banks Act s.60")).toBe("SARB Prudential Authority");
    expect(deriveRegulator("", "Currency and Exchanges Manual B.1")).toBe("SARB FinSurv");
  });

  test("slug citation resolves (tick-flow rows)", () => {
    expect(deriveRegulator("urn:obligation:bank:x", "banks-d7-2020")).toBe(
      "SARB Prudential Authority",
    );
  });

  test("field-swap: bcbs handle in citation, node id in urn", () => {
    // BCBS rows carry the node id in `urn` and the urn:reg handle in `citation`.
    expect(deriveRegulator("OBL-BCBS-CRE20", "urn:reg:bcbs:cre:20")).toBe("BCBS");
  });

  test("unmappable → Other / unmapped", () => {
    expect(deriveRegulator("[TBD]", "Some internal handle")).toBe("Other / unmapped");
  });
});

describe("parseSection / resolveDomain", () => {
  test("parseSection reads 'Domain G — label'", () => {
    expect(parseSection("Domain G — Accounting and financial reporting")).toEqual({
      code: "G",
      description: "G — Accounting and financial reporting",
    });
    expect(parseSection("## Domain M — OTC Derivative Provider (FMA / FSCA)")).toEqual({
      code: "M",
      description: "M — OTC Derivative Provider (FMA / FSCA)",
    });
  });

  test("parseSection returns null for non-headers", () => {
    expect(parseSection("")).toBeNull();
    expect(parseSection("not a section")).toBeNull();
  });

  test("resolveDomain prefers the authored section over the drifted code", () => {
    // ORG-AC-* accounting obligations carry event code "H" but are authored
    // under "Domain G — Accounting" — the section wins.
    expect(
      resolveDomain({ section: "Domain G — Accounting and financial reporting", domainCode: "H" }),
    ).toEqual({ code: "G", description: "G — Accounting and financial reporting" });
  });

  test("resolveDomain uses a descriptive BCBS code as-is when no section", () => {
    expect(resolveDomain({ domainCode: "Credit Risk" })).toEqual({
      code: "Credit Risk",
      description: "Credit Risk",
    });
  });

  test("resolveDomain falls back to the label map for a bare letter", () => {
    expect(resolveDomain({ domainCode: "A" })).toEqual({
      code: "A",
      description: "A — Prudential (capital, liquidity, large exposures, leverage)",
    });
  });

  test("resolveDomain renders dash for empty", () => {
    expect(resolveDomain({})).toEqual({ code: "", description: "—" });
  });
});

describe("obligationTitle", () => {
  test("tick-flow bank urn humanises the last segment", () => {
    expect(
      obligationTitle({
        id: "X",
        urn: "urn:obligation:bank:capital:derivative-exposure-calculation",
        citation: "",
      }),
    ).toBe("Derivative exposure calculation");
  });

  test("register citation em-dash tail", () => {
    expect(
      obligationTitle({
        id: "ORG-PR-01",
        urn: "[TBD]",
        citation: "Banks Act — Use of divisional names",
      }),
    ).toBe("Use of divisional names");
  });

  test("short citation used as-is", () => {
    expect(obligationTitle({ id: "ORG-AC-06", urn: "[TBD]", citation: "IFRS 15" })).toBe("IFRS 15");
  });

  test("a urn-form citation is not used as the title (BCBS rows)", () => {
    expect(
      obligationTitle({ id: "BCBS-CRE20", urn: "OBL-BCBS-CRE20", citation: "urn:reg:bcbs:cre:20" }),
    ).toBe("BCBS-CRE20");
  });

  test("falls back to bare id for long citation with no tail", () => {
    const long = "x".repeat(120);
    expect(obligationTitle({ id: "ORG-ZZ-99", urn: "", citation: long })).toBe("ORG-ZZ-99");
  });
});
