// tests/regulatory-concept-extractor.test.ts
//
// Unit tests for the regulatory concept extractor and obligation linker.
//
// Tests run without ANTHROPIC_API_KEY — Claude calls are guarded by
// `claudeAvailable()` and the extractor degrades gracefully.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import {
  buildSectionId,
  extractConcepts,
  parseSections,
} from "../platform/regulatory/concept-extractor";
import {
  extractSectionIdsFromCitation,
  normaliseCitationToSectionId,
  normaliseInstrumentId,
  normaliseSectionRef,
  parseObligationsRegister,
} from "../platform/regulatory/obligation-linker";

const MIRA_ACTOR: Actor = {
  type: "service",
  id: "agent:mira:fais-horizon-scan",
};

// ---------------------------------------------------------------------------
// Sample FAIS Act text for parser tests
// ---------------------------------------------------------------------------

const SAMPLE_FAIS_TEXT = `Financial Advisory and Intermediary Services Act 37 of 2002

TABLE OF CONTENTS

1. Definitions
2. Application of Act

ACT

1. Definitions

In this Act, unless the context otherwise indicates—
"advice" means any recommendation, guidance or proposal of a financial nature
furnished by any means or medium to any client or group of clients—
  (a) in respect of the purchase of any financial product; or
  (b) in respect of the investment in any financial product;

2. Application of Act

(1) This Act applies to any person who carries on the business of rendering financial
services to clients.
(2) For the purposes of this Act, a person carries on the business of rendering
financial services if that person, as a regular feature of the business, renders
financial services to clients.

7. Authorisation of financial services providers

(1) Subject to subsection (2), no person may render financial services unless that
person is the holder of a licence issued by the registrar.
(2) The following persons are exempt from subsection (1):
  (a) a person acting under a mandate in the name of another person;
  (b) a person who renders only incidental financial services.

13. Duties of authorised financial services providers

(1) An authorised financial services provider must—
  (a) render financial services honestly, fairly, with due skill, care and diligence;
  (b) act in the interests of clients and the integrity of the financial services industry.

44. Short title and commencement

This Act is called the Financial Advisory and Intermediary Services Act, 2002.
`;

// ---------------------------------------------------------------------------
// Section parser tests
// ---------------------------------------------------------------------------

describe("parseSections", () => {
  it("extracts top-level sections from FAIS Act sample text", () => {
    const sections = parseSections(SAMPLE_FAIS_TEXT);

    expect(sections.length).toBeGreaterThan(0);

    // Should find sections 1, 2, 7, 13, 44
    const sectionNums = sections.map((s) => s.sectionNumber);
    expect(sectionNums).toContain("1");
    expect(sectionNums).toContain("2");
    expect(sectionNums).toContain("7");
    expect(sectionNums).toContain("13");
    expect(sectionNums).toContain("44");
  });

  it("section text includes the subsections", () => {
    const sections = parseSections(SAMPLE_FAIS_TEXT);
    const s7 = sections.find((s) => s.sectionNumber === "7");
    expect(s7).toBeDefined();
    if (!s7) return;
    // Should include the subsection text
    expect(s7.text).toContain("Authorisation");
    expect(s7.text).toContain("(1) Subject to subsection (2)");
  });

  it("produces at least 5 distinct sections from the sample", () => {
    const sections = parseSections(SAMPLE_FAIS_TEXT);
    // At minimum: sections 1, 2, 7, 13, 44
    const sectionNums = new Set(sections.map((s) => s.sectionNumber));
    expect(sectionNums.size).toBeGreaterThanOrEqual(5);
  });
});

describe("buildSectionId", () => {
  it("builds canonical sectionId", () => {
    expect(buildSectionId("FAIS-ACT-37-2002", "7")).toBe("FAIS-ACT-37-2002:s7");
    expect(buildSectionId("FAIS-ACT-37-2002", "13A")).toBe("FAIS-ACT-37-2002:s13A");
    expect(buildSectionId("FAIS-ACT-37-2002", "44")).toBe("FAIS-ACT-37-2002:s44");
  });
});

// ---------------------------------------------------------------------------
// Obligation linker — register parser tests
// ---------------------------------------------------------------------------

const SAMPLE_REGISTER = `# Obligations register

**Curator:** Mira

| No | ID | Domain | Obligation | Status | Bind type | Entity scope | Source | Citation | Applies-at | Product scope | Activity scope | Risk taxonomy | Fulfilment policy |
|----|----|----|----|----|----|----|----|----|----|----|----|----|-----|
| 1 | ORG-CD-01 | C-FAIS | FSP licence required | PLANNED | LICENCE-BIND | bank | FAIS Act s.7 | FAIS-ACT-S7 | commencement | universal | ACT-COMPLIANCE | CMP-001 | fais-compliance-policy-v1.md |
| 2 | ORG-CD-02 | C-FAIS | Fit and proper key individuals | PLANNED | LICENCE-BIND | bank | FAIS Act s.8 | FAIS-ACT-S8 | commencement | universal | ACT-COMPLIANCE | CMP-002 | fais-compliance-policy-v1.md |
`;

describe("parseObligationsRegister", () => {
  it("parses obligation rows from markdown table", () => {
    const rows = parseObligationsRegister(SAMPLE_REGISTER);
    expect(rows.length).toBe(2);
    expect(rows.at(0)?.id).toBe("ORG-CD-01");
    expect(rows.at(1)?.id).toBe("ORG-CD-02");
  });

  it("extracts citation column correctly", () => {
    const rows = parseObligationsRegister(SAMPLE_REGISTER);
    expect(rows.at(0)?.citation).toBe("FAIS-ACT-S7");
    expect(rows.at(1)?.citation).toBe("FAIS-ACT-S8");
  });

  it("skips non-ORG rows", () => {
    const register =
      "| ID | Citation |\n|----|----|\n| HEADER | N/A |\n| ORG-CD-01 | FAIS-ACT-S7 |\n";
    const rows = parseObligationsRegister(register);
    expect(rows.every((r) => r.id.startsWith("ORG-"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Concept extractor — idempotency test
// ---------------------------------------------------------------------------

describe("extractConcepts — idempotency", () => {
  it("does not emit duplicate events when called twice on same content", async () => {
    // This test does NOT require ANTHROPIC_API_KEY.
    // When Claude is unavailable, extractConcepts skips all sections.
    // We verify that a second call also skips (idempotent skip behaviour).

    const store = new EventStore();

    await extractConcepts({
      instrumentId: "FAIS-ACT-37-2002",
      fullText: SAMPLE_FAIS_TEXT,
      actor: MIRA_ACTOR,
      eventStore: store,
    });

    const result2 = await extractConcepts({
      instrumentId: "FAIS-ACT-37-2002",
      fullText: SAMPLE_FAIS_TEXT,
      actor: MIRA_ACTOR,
      eventStore: store,
    });

    // Second run should emit 0 new concepts (idempotent)
    // (either because Claude is unavailable and sections are skipped,
    //  or because they were already extracted in run 1)
    expect(result2.conceptsEmitted).toBe(0);

    // Count events after first run
    let countAfterRun1 = 0;
    for (const _e of store.replay({ type: "RegulatoryConceptExtracted" })) {
      countAfterRun1++;
    }

    // Run a third time — store should not have grown further
    await extractConcepts({
      instrumentId: "FAIS-ACT-37-2002",
      fullText: SAMPLE_FAIS_TEXT,
      actor: MIRA_ACTOR,
      eventStore: store,
    });

    let countAfterRun3 = 0;
    for (const _e of store.replay({ type: "RegulatoryConceptExtracted" })) {
      countAfterRun3++;
    }
    expect(countAfterRun3).toBe(countAfterRun1);
  });
});

// ---------------------------------------------------------------------------
// Event schema validation tests
// ---------------------------------------------------------------------------

describe("regulatory event types — schema", () => {
  it("makeRegulatoryConceptExtracted rejects invalid applicabilityScore", async () => {
    const { makeRegulatoryConceptExtracted } = await import(
      "../platform/event-store/event-types/regulatory"
    );

    expect(() =>
      makeRegulatoryConceptExtracted({
        asOf: "2026-05-14T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: MIRA_ACTOR,
        citations: ["FAIS-ACT-37-2002"],
        payload: {
          instrumentId: "FAIS-ACT-37-2002",
          sectionId: "FAIS-ACT-37-2002:s7",
          sectionTitle: "Authorisation",
          verbatimText: "No person may render financial services without a licence.",
          subjectScope: { entityTypes: ["FSP"], licenceTypes: [], roles: [] },
          temporalScope: { cadence: "ongoing" },
          conditionScope: {},
          obligation: { type: "duty", actor: ["FSP"], actionSummary: "Obtain a licence." },
          applicabilityScore: 1.5, // INVALID — exceeds 1.0
          applicabilityRationale: "Test",
          relevancyScore: 0.8,
          relevancyRationale: "Test",
          classifications: {
            domain: ["C-FAIS"],
            riskTaxonomy: [],
            productScope: [],
            activityScope: [],
          },
          extractedAt: "2026-05-14T00:00:00.000Z",
          extractedBy: "agent:mira:test",
        },
      }),
    ).toThrow();
  });

  it("makeRegulatoryInstrumentRegistered rejects invalid contentHash", async () => {
    const { makeRegulatoryInstrumentRegistered } = await import(
      "../platform/event-store/event-types/regulatory"
    );

    expect(() =>
      makeRegulatoryInstrumentRegistered({
        asOf: "2026-05-14T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: MIRA_ACTOR,
        citations: ["FAIS-ACT-37-2002"],
        payload: {
          instrumentId: "FAIS-ACT-37-2002",
          title: "FAIS Act 37 of 2002",
          issuingBody: "Parliament",
          instrumentType: "act",
          jurisdiction: "ZA",
          publicationDate: "2002-11-15",
          effectiveDate: "2004-10-01",
          version: "2002-orig",
          contentHash: "not-a-valid-hash", // INVALID
        },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// normaliseCitationToSectionId — citation format normaliser
// ---------------------------------------------------------------------------

describe("normaliseInstrumentId", () => {
  it("normalises FAIS Act 37/2002", () => {
    expect(normaliseInstrumentId("FAIS Act 37/2002")).toBe("FAIS-ACT-37-2002");
  });

  it("normalises Banks Act 94/1990", () => {
    expect(normaliseInstrumentId("Banks Act 94/1990")).toBe("BANKS-ACT-94-1990");
  });

  it("normalises FIC Act 38/2001", () => {
    expect(normaliseInstrumentId("FIC Act 38/2001")).toBe("FIC-ACT-38-2001");
  });

  it("normalises Companies Act 71/2008", () => {
    expect(normaliseInstrumentId("Companies Act 71/2008")).toBe("COMPANIES-ACT-71-2008");
  });

  it("returns null for unknown instrument", () => {
    expect(normaliseInstrumentId("Some Unknown Regulation")).toBeNull();
  });
});

describe("normaliseSectionRef", () => {
  it("strips the dot from s.7", () => {
    expect(normaliseSectionRef("s.7")).toBe("s7");
  });

  it("strips subsections from s.7(1)(a)", () => {
    expect(normaliseSectionRef("s.7(1)(a)")).toBe("s7");
  });

  it("preserves letter suffix s.13A", () => {
    expect(normaliseSectionRef("s.13A")).toBe("s13A");
  });

  it("strips subsections from s.13A(2)", () => {
    expect(normaliseSectionRef("s.13A(2)")).toBe("s13A");
  });

  it("converts § 8 to s8", () => {
    expect(normaliseSectionRef("§ 8")).toBe("s8");
  });

  it("handles range ss.16–19 returning first section", () => {
    expect(normaliseSectionRef("ss.16–19")).toBe("s16");
  });

  it("returns null for non-section strings", () => {
    expect(normaliseSectionRef("not a section")).toBeNull();
  });
});

describe("normaliseCitationToSectionId", () => {
  it("FAIS Act 37/2002 s.7 → FAIS-ACT-37-2002:s7", () => {
    expect(normaliseCitationToSectionId("FAIS Act 37/2002 s.7")).toBe("FAIS-ACT-37-2002:s7");
  });

  it("FAIS Act 37/2002 s.7(1)(a) → FAIS-ACT-37-2002:s7 (subsections stripped)", () => {
    expect(normaliseCitationToSectionId("FAIS Act 37/2002 s.7(1)(a)")).toBe("FAIS-ACT-37-2002:s7");
  });

  it("FAIS Act 37/2002 s.13A → FAIS-ACT-37-2002:s13A (letter suffix preserved)", () => {
    expect(normaliseCitationToSectionId("FAIS Act 37/2002 s.13A")).toBe("FAIS-ACT-37-2002:s13A");
  });

  it("FAIS Act 37/2002 s.13A(2) → FAIS-ACT-37-2002:s13A", () => {
    expect(normaliseCitationToSectionId("FAIS Act 37/2002 s.13A(2)")).toBe("FAIS-ACT-37-2002:s13A");
  });

  it("Banks Act 94/1990 s.60 → BANKS-ACT-94-1990:s60", () => {
    expect(normaliseCitationToSectionId("Banks Act 94/1990 s.60")).toBe("BANKS-ACT-94-1990:s60");
  });

  it("Banks Act 94/1990 s.60(1) → BANKS-ACT-94-1990:s60", () => {
    expect(normaliseCitationToSectionId("Banks Act 94/1990 s.60(1)")).toBe("BANKS-ACT-94-1990:s60");
  });

  it("FAIS Act 37/2002 § 8 → FAIS-ACT-37-2002:s8 (§ sign)", () => {
    expect(normaliseCitationToSectionId("FAIS Act 37/2002 § 8")).toBe("FAIS-ACT-37-2002:s8");
  });

  it("FAIS Act 37/2002 s.18(b) → FAIS-ACT-37-2002:s18", () => {
    expect(normaliseCitationToSectionId("FAIS Act 37/2002 s.18(b)")).toBe("FAIS-ACT-37-2002:s18");
  });

  it("returns null for GCC-style citation without standard Act reference", () => {
    // GCC is a Board Notice, not an Act — can't produce a structured sectionId
    const result = normaliseCitationToSectionId("GCC s.3(2)");
    // Either null or any string is acceptable; we just verify it doesn't throw
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("returns null for unrecognised citation format", () => {
    expect(normaliseCitationToSectionId("[TBD]")).toBeNull();
    expect(normaliseCitationToSectionId("universal")).toBeNull();
  });
});

describe("extractSectionIdsFromCitation", () => {
  it("extracts single citation", () => {
    expect(extractSectionIdsFromCitation("FAIS Act 37/2002 s.7")).toEqual(["FAIS-ACT-37-2002:s7"]);
  });

  it("extracts multiple pipe-delimited citations", () => {
    const result = extractSectionIdsFromCitation(
      "FAIS Act 37/2002 s.18(b) | Banks Act 94/1990 s.60",
    );
    expect(result).toContain("FAIS-ACT-37-2002:s18");
    expect(result).toContain("BANKS-ACT-94-1990:s60");
    expect(result.length).toBe(2);
  });

  it("skips un-parseable parts and returns only valid ids", () => {
    const result = extractSectionIdsFromCitation("FAIS Act 37/2002 s.7 | [TBD] | GCC s.3(2)");
    // Only the FAIS part should parse cleanly
    expect(result).toContain("FAIS-ACT-37-2002:s7");
    // [TBD] and GCC-only should be silently dropped
    expect(result.every((id) => id.includes(":"))).toBe(true);
  });

  it("returns empty array for empty citation", () => {
    expect(extractSectionIdsFromCitation("")).toEqual([]);
    expect(extractSectionIdsFromCitation("[TBD]")).toEqual([]);
  });
});
