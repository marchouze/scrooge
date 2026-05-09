// tests/recon-retention-citation-coverage.test.ts
//
// Tests for the retention-citation-coverage recon (Vera Wave-4 #14).
//
// The pipeline asserts that every event-type registry row carries
// retention metadata whose `citationRef` resolves into the obligations
// register — either as an ORG-* register-row ID, an external-anchor URN
// token (BCBS-/JSE-/IFRS-/…), or a structured "[register: route to
// Mira — …]" marker. Class-consistency rule: markets-class trade events
// must carry a retention floor of ≥ MARKETS_RETENTION_FLOOR_YEARS (5y).
//
// Smoke test: runs over the live registry + on-disk obligations
// register and confirms the pipeline returns a typed `ReconResult` with
// `ok: true` (warn-severity findings do not red-line the run; the
// route-markers are expected today and gated on Mira's URN-population
// follow-on).
//
// Synthetic tests: feed the assertion synthetic registry rows + a
// controlled register set and assert the violation classification is
// what the design intends (resolve / route-marker / unresolved /
// malformed / class-mismatch).
//
// Author: Vera (Internal audit / continuous-assurance engineer)

import { describe, expect, it } from "bun:test";

import {
  assertRetentionCitationCoverage,
  isRouteMarker,
  looksLikeExternalAnchor,
  looksLikeOrgId,
  parseObligationsRegister,
  run as retentionRun,
} from "../platform/recon/retention-citation-coverage";
import type { EventTypeMetadata } from "../platform/event-store/registry";

// Minimal synthetic event-type row constructor — avoids depending on the
// runtime registry contents (which drift) and keeps the test self-
// contained per the standing fixture-discipline rule.
function syntheticRow(args: {
  type: string;
  cls?: EventTypeMetadata["class"];
  citationRef: string;
  minimumYears?: number;
  archivalTier?: EventTypeMetadata["retention"]["archivalTier"];
}): EventTypeMetadata {
  return {
    type: args.type,
    class: args.cls ?? "runtime",
    issuer: "any-agent",
    subscribers: ["Vera"],
    replay: "append-only-audit",
    retention: {
      minimumYears: args.minimumYears ?? 7,
      archivalTier: args.archivalTier ?? "hot-cool-archive",
      citationRef: args.citationRef,
    },
    source: "synthetic test fixture",
  };
}

describe("retention-citation-coverage pipeline", () => {
  it("runs over the live registry and returns a typed result", () => {
    const r = retentionRun();
    expect(r.pipeline).toBe("retention-citation-coverage");
    expect(typeof r.asserted).toBe("number");
    // The registry has many tens of event-types today (runtime + model
    // registry + markets + governance + audit + legal-entity + product
    // lifecycle). Assert a conservative lower bound rather than a
    // brittle exact count.
    expect(r.asserted).toBeGreaterThanOrEqual(40);
    expect(Array.isArray(r.violations)).toBe(true);
    // Live state: warn-severity findings only — `ok` must remain true.
    // Today's registry uses route-markers on the GOVERNANCE/JSE/RUNTIME
    // retention classes pending Mira's URN-population follow-on; the
    // recon surfaces them as `warn` so the AC digest tracks the
    // inventory without red-lining CI.
    expect(r.ok).toBe(true);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
  });
});

describe("retention-citation-coverage — synthetic resolution cases", () => {
  // Common knobs — the tests declare exactly which register entries
  // should resolve.
  const orgIds = new Set(["ORG-FC-05", "ORG-CS3-009", "ORG-AC-09"]);
  const externalAnchors = new Set([
    "BCBS-D457-FRTB-2019",
    "JSE-EQUITIES-RULES-2024",
    "JOINT-STANDARD-1-2024-CYBER",
  ]);

  it("passes when an event-type carries a resolvable ORG-* citation", () => {
    const r = assertRetentionCitationCoverage({
      registry: [syntheticRow({ type: "FicEventOk", citationRef: "ORG-FC-05" })],
      orgIds,
      externalAnchors,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.asserted).toBe(1);
  });

  it("passes when an event-type carries a resolvable external-anchor URN", () => {
    const r = assertRetentionCitationCoverage({
      registry: [
        syntheticRow({
          type: "BcbsFrtbEvent",
          citationRef: "BCBS-D457-FRTB-2019",
        }),
      ],
      orgIds,
      externalAnchors,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("flags an event-type whose citation looks like an ORG-* but doesn't resolve", () => {
    const r = assertRetentionCitationCoverage({
      registry: [
        syntheticRow({ type: "GhostEvent", citationRef: "ORG-XX-99" }),
      ],
      orgIds,
      externalAnchors,
    });
    expect(r.ok).toBe(true); // warn, not fail
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("ORG-XX-99");
    expect(r.violations[0]?.message).toContain("does not resolve");
  });

  it("flags an event-type whose citation looks like an external-anchor URN but doesn't resolve", () => {
    const r = assertRetentionCitationCoverage({
      registry: [
        syntheticRow({
          type: "PhantomBcbsEvent",
          citationRef: "BCBS-D999-IMAGINARY-2099",
        }),
      ],
      orgIds,
      externalAnchors,
    });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("BCBS-D999-IMAGINARY-2099");
    expect(r.violations[0]?.message).toContain("Domain N");
  });

  it("surfaces a route-marker citation as a finding (Mira follow-on inventory)", () => {
    const r = assertRetentionCitationCoverage({
      registry: [
        syntheticRow({
          type: "GovernanceEvent",
          citationRef:
            "[register: route to Mira — Companies Act 71/2008 director-decision retention; BCBS 239 audit-trail expectations]",
        }),
      ],
      orgIds,
      externalAnchors,
    });
    expect(r.ok).toBe(true); // warn, not fail
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("route-marker");
  });

  it("flags a malformed citation that matches no recognised form", () => {
    const r = assertRetentionCitationCoverage({
      registry: [
        syntheticRow({
          type: "TypoCitationEvent",
          citationRef: "some-arbitrary-string",
        }),
      ],
      orgIds,
      externalAnchors,
    });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("does not match any recognised citation form");
  });

  it("flags an empty citationRef as a missing-citation finding", () => {
    const r = assertRetentionCitationCoverage({
      registry: [syntheticRow({ type: "EmptyCitationEvent", citationRef: "" })],
      orgIds,
      externalAnchors,
    });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("missing or empty");
  });

  it("flags a markets-class event with a sub-5y retention floor (class misclassification)", () => {
    const r = assertRetentionCitationCoverage({
      registry: [
        syntheticRow({
          type: "BadMarketsTrade",
          cls: "markets",
          citationRef: "ORG-CS3-009",
          minimumYears: 1,
          archivalTier: "hot-cool",
        }),
      ],
      orgIds,
      externalAnchors,
    });
    // Citation resolves (no citation-side finding) but class-consistency
    // fires.
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("markets-class retention floor");
    expect(r.violations[0]?.message).toContain("MARKETS_RETENTION_FLOOR_YEARS");
  });

  it("does not flag a markets-class event whose retention floor meets the markets norm", () => {
    const r = assertRetentionCitationCoverage({
      registry: [
        syntheticRow({
          type: "GoodMarketsTrade",
          cls: "markets",
          citationRef: "JSE-EQUITIES-RULES-2024",
          minimumYears: 7,
        }),
      ],
      orgIds,
      externalAnchors,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });
});

describe("retention-citation-coverage — citation-form helpers", () => {
  it("isRouteMarker recognises the canonical route-marker form", () => {
    expect(
      isRouteMarker("[register: route to Mira — Companies Act 71/2008 retention]"),
    ).toBe(true);
    expect(isRouteMarker("ORG-FC-05")).toBe(false);
    expect(isRouteMarker("[register: route elsewhere]")).toBe(false);
  });

  it("looksLikeOrgId recognises the ORG-<DOMAIN>-<n> form", () => {
    expect(looksLikeOrgId("ORG-FC-05")).toBe(true);
    expect(looksLikeOrgId("ORG-BNK-CYBER-CONS")).toBe(true);
    expect(looksLikeOrgId("BCBS-239-2013")).toBe(false);
    expect(looksLikeOrgId("[register: route to Mira — …]")).toBe(false);
  });

  it("looksLikeExternalAnchor recognises canonical regulator prefixes", () => {
    expect(looksLikeExternalAnchor("BCBS-D457-FRTB-2019")).toBe(true);
    expect(looksLikeExternalAnchor("JSE-EQUITIES-RULES-2024")).toBe(true);
    expect(looksLikeExternalAnchor("BANKS-ACT-94-1990")).toBe(true);
    expect(looksLikeExternalAnchor("COMPANIES-ACT-71-2008-S24")).toBe(true);
    expect(looksLikeExternalAnchor("FIC-ACT-38-2001")).toBe(true);
    expect(looksLikeExternalAnchor("JOINT-STANDARD-1-2024-CYBER")).toBe(true);
    expect(looksLikeExternalAnchor("POPIA-S71-AUTOMATED-DECISIONING")).toBe(true);
    expect(looksLikeExternalAnchor("ORG-FC-05")).toBe(false);
    expect(looksLikeExternalAnchor("some-arbitrary-string")).toBe(false);
  });
});

describe("retention-citation-coverage — register parser", () => {
  it("extracts ORG-* row IDs from a register-shaped table", () => {
    const fixture = [
      "| ID | Citation | Requirement |",
      "|---|---|---|",
      "| ORG-FC-05 | FIC Act s.22 | Retain ≥5y |",
      "| ORG-AC-09 | IAS 12 | Income taxes |",
      "| not-a-row | should be ignored | |",
    ].join("\n");
    const { orgIds } = parseObligationsRegister(fixture);
    expect(orgIds.has("ORG-FC-05")).toBe(true);
    expect(orgIds.has("ORG-AC-09")).toBe(true);
    expect(orgIds.has("NOT-A-ROW")).toBe(false);
  });

  it("extracts external-anchor URN tokens from Domain N rows", () => {
    const fixture = [
      "| Anchor | URN | Description |",
      "|---|---|---|",
      "| `BCBS-D457-FRTB-2019` | `urn:obligation:bank:m1:prudential:bcbs-d457-frtb-2019:v1` | FRTB |",
      "| `JSE-EQUITIES-RULES-2024` | `urn:...` | JSE rules |",
    ].join("\n");
    const { externalAnchors } = parseObligationsRegister(fixture);
    expect(externalAnchors.has("BCBS-D457-FRTB-2019")).toBe(true);
    expect(externalAnchors.has("JSE-EQUITIES-RULES-2024")).toBe(true);
  });
});
