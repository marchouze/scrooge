// tests/urn-parser.test.ts
//
// Unit tests for the canonical URN parser at platform/citation/urn.ts.
// Authority: D-URN-CANONICAL-VOCABULARY (CEO-approved 2026-05-22 via session
// delegation; event `3a3deae9-4274-46b0-9d0b-5208fbdb84a1`). Register at
// `Regulations/_urn-vocabulary.md` is the canonical source of slug rules.
//
// Author: Owen (Company Secretary, governance).

import { describe, expect, it } from "bun:test";

import { URN_CLASSES, isUrn, parseUrn } from "../platform/citation/urn";

describe("parseUrn — accepts canonical examples from _urn-vocabulary.md", () => {
  const cases: Array<{ urn: string; expectedClass: (typeof URN_CLASSES)[number] }> = [
    { urn: "urn:reg:za:banks-act-94-1990:s.60", expectedClass: "reg" },
    { urn: "urn:reg:bcbs:bcbs-239", expectedClass: "reg" },
    {
      urn: "urn:obligation:bank:m1:operational-cyber:joint-standard-2-2024-cyber:v1",
      expectedClass: "obligation",
    },
    {
      urn: "urn:obligation:bank:risk:b-cluster-fx-settlement-concentration:v1",
      expectedClass: "obligation",
    },
    { urn: "urn:policy:bank:capital-management:v1", expectedClass: "policy" },
    { urn: "urn:policy:bank:fx.market-conduct:v1", expectedClass: "policy" },
    { urn: "urn:procedure:bank:proc-mk-plg-01", expectedClass: "procedure" },
    { urn: "urn:decision:bank:D-RMS-PHASE-1", expectedClass: "decision" },
    {
      urn: "urn:decision:bank:D-URN-CANONICAL-VOCABULARY",
      expectedClass: "decision",
    },
    {
      urn: "urn:capability:bank:platform/gl/post-journal",
      expectedClass: "capability",
    },
    { urn: "urn:party:natural-person:marc-houze", expectedClass: "party" },
    { urn: "urn:party:legal-entity:hoz-bank-limited", expectedClass: "party" },
    { urn: "urn:party:counterparty:standard-bank-johannesburg", expectedClass: "party" },
    { urn: "urn:party:agent:owen", expectedClass: "party" },
    { urn: "urn:activity:bank:ACT-TRADE-OTC-IRD", expectedClass: "activity" },
    { urn: "urn:activity:bank:ACT-REPORT-PRUDENTIAL", expectedClass: "activity" },
    { urn: "urn:product:bank:fx-spot", expectedClass: "product" },
    { urn: "urn:product:bank:otc-ird.irs", expectedClass: "product" },
    { urn: "urn:risk:bank:RT-CR.CC", expectedClass: "risk" },
    { urn: "urn:risk:bank:RT-LQ.FN", expectedClass: "risk" },
    { urn: "urn:event:bank:AgentBriefIssued", expectedClass: "event" },
    { urn: "urn:event:bank:Decision", expectedClass: "event" },
  ];

  for (const c of cases) {
    it(`parses ${c.urn}`, () => {
      const r = parseUrn(c.urn);
      expect(r.kind).toBe("ref");
      if (r.kind === "ref") {
        expect(r.urnClass).toBe(c.expectedClass);
        expect(r.raw).toBe(c.urn);
      }
      expect(isUrn(c.urn)).toBe(true);
    });
  }
});

describe("parseUrn — rejects malformed input", () => {
  const cases: Array<{ urn: string; reasonContains: string }> = [
    { urn: "", reasonContains: "empty" },
    { urn: "not-a-urn", reasonContains: "must start with `urn:`" },
    { urn: "urn:", reasonContains: "three colon-separated" },
    {
      urn: "urn:notaclass:bank:something",
      reasonContains: "Unknown URN class",
    },
    // Missing version suffix on policy:
    { urn: "urn:policy:bank:capital-management", reasonContains: "policy" },
    // Uppercase in slug where lowercase required:
    { urn: "urn:procedure:bank:Proc-Mk-Plg-01", reasonContains: "procedure" },
    // Decision slug missing D- prefix:
    {
      urn: "urn:decision:bank:RMS-PHASE-1",
      reasonContains: "D-<SLUG>",
    },
    // Activity slug lowercase (must be uppercase):
    { urn: "urn:activity:bank:act-trade-otc-ird", reasonContains: "ACT-" },
    // Risk slug lowercase (must be uppercase):
    { urn: "urn:risk:bank:rt-cr.cc", reasonContains: "RT-" },
    // Event slug not PascalCase:
    { urn: "urn:event:bank:agentBriefIssued", reasonContains: "PascalCase" },
    // Party kind unknown:
    {
      urn: "urn:party:robot:wall-e",
      reasonContains: "natural-person",
    },
  ];

  for (const c of cases) {
    it(`rejects ${JSON.stringify(c.urn)}`, () => {
      const r = parseUrn(c.urn);
      expect(r.kind).toBe("error");
      if (r.kind === "error") {
        expect(r.reason.toLowerCase()).toContain(c.reasonContains.toLowerCase());
      }
      expect(isUrn(c.urn)).toBe(false);
    });
  }
});

describe("URN_CLASSES — registered classes", () => {
  it("includes the eleven canonical classes from v1.0", () => {
    const expected: string[] = [
      "activity",
      "capability",
      "decision",
      "event",
      "obligation",
      "party",
      "policy",
      "procedure",
      "product",
      "reg",
      "risk",
    ];
    const actual: string[] = [...URN_CLASSES];
    expect(actual.slice().sort()).toEqual(expected.slice().sort());
  });
});
