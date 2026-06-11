// platform/regulatory/obligation-linker.test.ts
//
// Citation-normaliser coverage — in particular the SARB PA instrument
// patterns (Directives / Circulars / Guidance Notes) added under
// WS-PA-REMEDIATION Phase 3 to close the obligationsLinked=0 gap for the
// 150 ORG-PA-* obligations (PR #1238 follow-on).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  extractSectionIdsFromCitation,
  normaliseCitationToSectionId,
  normaliseInstrumentId,
  normaliseSectionRef,
} from "./obligation-linker";

describe("normaliseInstrumentId", () => {
  it("maps the fixed Act patterns", () => {
    expect(normaliseInstrumentId("FAIS Act 37/2002")).toBe("FAIS-ACT-37-2002");
    expect(normaliseInstrumentId("Banks Act 94/1990")).toBe("BANKS-ACT-94-1990");
    expect(normaliseInstrumentId("FIC Act 38/2001")).toBe("FIC-ACT-38-2001");
  });

  it("maps SARB PA Directives to BANKS-D{n}-{year}", () => {
    expect(normaliseInstrumentId("SARB PA Directive D1/2008")).toBe("BANKS-D1-2008");
    expect(normaliseInstrumentId("Directive D5/2025")).toBe("BANKS-D5-2025");
    expect(normaliseInstrumentId("SARB PA Directive D14/2026")).toBe("BANKS-D14-2026");
  });

  it("maps SARB PA Circulars to BANKS-C{n}-{year}", () => {
    expect(normaliseInstrumentId("SARB PA Circular C2/2014")).toBe("BANKS-C2-2014");
    expect(normaliseInstrumentId("Circular C1/2026")).toBe("BANKS-C1-2026");
  });

  it("maps SARB PA Guidance Notes to BANKS-GN{n}-{year}", () => {
    expect(normaliseInstrumentId("Guidance Note 1 of 2024")).toBe("BANKS-GN1-2024");
    expect(normaliseInstrumentId("SARB PA Guidance Note G3/2015")).toBe("BANKS-GN3-2015");
  });

  it("maps Regulations Relating to Banks to RRB", () => {
    expect(normaliseInstrumentId("Regulations Relating to Banks")).toBe("RRB");
    expect(normaliseInstrumentId("Regulations Relating to Banks (RRB)")).toBe("RRB");
  });
});

describe("normaliseSectionRef", () => {
  it("normalises plain and nested section refs", () => {
    expect(normaliseSectionRef("s.7")).toBe("s7");
    expect(normaliseSectionRef("s.7(1)(a)")).toBe("s7");
    expect(normaliseSectionRef("s.13A")).toBe("s13A");
    expect(normaliseSectionRef("§ 8")).toBe("s8");
  });
});

describe("normaliseCitationToSectionId", () => {
  it("handles the classic Act + section form", () => {
    expect(normaliseCitationToSectionId("FAIS Act 37/2002 s.7")).toBe("FAIS-ACT-37-2002:s7");
    expect(normaliseCitationToSectionId("Banks Act 94/1990 s.60(1)")).toBe("BANKS-ACT-94-1990:s60");
  });

  it("tolerates an em-dash title tail after the section ref", () => {
    expect(
      normaliseCitationToSectionId(
        "Banks Act 94 of 1990 s.11 — Conducting the business of a bank requires registration",
      ),
    ).toBe("BANKS-ACT-94-1990:s11");
    expect(normaliseCitationToSectionId("Banks Act 94 of 1990 s.60 — Financial statements")).toBe(
      "BANKS-ACT-94-1990:s60",
    );
  });

  it("handles 3-level subsection nesting", () => {
    expect(normaliseCitationToSectionId("FAIS Act 37/2002 s.2.1.3")).toBe(
      "FAIS-ACT-37-2002:s2.1.3",
    );
  });

  it("maps whole-instrument PA Directive citations to :doc", () => {
    expect(
      normaliseCitationToSectionId(
        "SARB PA Directive D1/2008 (Banks Act 94/1990 s.6(6)(a)) — Use of divisional names",
      ),
    ).toBe("BANKS-D1-2008:doc");
  });

  it("maps whole-instrument PA Circular citations to :doc", () => {
    expect(
      normaliseCitationToSectionId(
        "SARB PA Circular C2/2014 (Banks Act 94/1990 s.6(4)) — Some circular title",
      ),
    ).toBe("BANKS-C2-2014:doc");
  });

  it("maps PA Directive citations with an explicit directive-section ref", () => {
    expect(normaliseCitationToSectionId("SARB PA Directive D5/2025 §2.1.3")).toBe(
      "BANKS-D5-2025:s2.1.3",
    );
  });

  it("does NOT treat the parenthetical enabling-Act section as the directive section", () => {
    // s.6(6)(a) inside parens is the Banks Act enabling provision, not a
    // section of the directive — the directive maps to :doc.
    const id = normaliseCitationToSectionId(
      "SARB PA Directive D3/2017 (Banks Act 94/1990 s.6(6)(a))",
    );
    expect(id).toBe("BANKS-D3-2017:doc");
  });

  it("maps Guidance Note citations", () => {
    expect(
      normaliseCitationToSectionId(
        "SARB PA Guidance Note 1 of 2024 (climate-related prudential framework) — Title",
      ),
    ).toBe("BANKS-GN1-2024:doc");
  });

  it("maps RRB Regulation NN citations", () => {
    expect(
      normaliseCitationToSectionId(
        "Regulations Relating to Banks (RRB) Regulation 39 — Process of corporate governance",
      ),
    ).toBe("RRB:s39");
  });

  it("returns null for unparseable citations", () => {
    expect(normaliseCitationToSectionId("some random prose")).toBeNull();
  });
});

describe("extractSectionIdsFromCitation", () => {
  it("splits on + separators and normalises each part", () => {
    const ids = extractSectionIdsFromCitation("FAIS Act 37/2002 s.7 + FAIS Act 37/2002 s.13A");
    expect(ids).toEqual(["FAIS-ACT-37-2002:s7", "FAIS-ACT-37-2002:s13A"]);
  });

  it("extracts a PA directive citation despite the embedded parenthetical Act ref", () => {
    const ids = extractSectionIdsFromCitation(
      "SARB PA Directive D1/2015 (Banks Act 94/1990 s.6(6)(a)) — Minimum requirements for recovery plans",
    );
    expect(ids).toEqual(["BANKS-D1-2015:doc"]);
  });
});
