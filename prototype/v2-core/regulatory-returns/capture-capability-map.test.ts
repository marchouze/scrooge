// v2-core/regulatory-returns/capture-capability-map.test.ts
//
// Unit tests for the C engine — derive-from-composition. Pure: feeds composition
// fixtures, asserts the derived attribute set. Includes the REGRESSION PIN that
// fixes the derived set for seeded composition shapes: a capability-map edit
// that flips a past derivation is a loud failure here (append-only-by-convention,
// replay-safety).
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { CAPTURE_CAPABILITY_MAP, deriveCapturedAttributes } from "./capture-capability-map";

function derived(filTypeScopes: string[], regulatoryApproach: string | undefined): string[] {
  return [
    ...deriveCapturedAttributes({
      filTypeScopes,
      resolved: { regulatoryApproach, unresolvedModuleIds: [] },
    }).attributes,
  ].sort();
}

describe("deriveCapturedAttributes", () => {
  it("standardised-credit-risk → regulatoryApproach + exposureClass", () => {
    expect(derived(["fil:type:credit:loan"], "standardised-credit-risk")).toEqual([
      "exposureClass",
      "regulatoryApproach",
    ]);
  });

  it("sa-ccr → regulatoryApproach only (counterparty/EAD are per-instance, not claimed)", () => {
    expect(derived([], "sa-ccr")).toEqual(["regulatoryApproach"]);
  });

  it("no treatment composed → empty", () => {
    expect(derived(["fil:type:credit:loan"], undefined)).toEqual([]);
  });

  it("empty composition → empty", () => {
    expect(derived([], undefined)).toEqual([]);
  });

  it("an approach with no capability row (irb) → empty + surfaced as unmatched", () => {
    const d = deriveCapturedAttributes({
      filTypeScopes: [],
      resolved: { regulatoryApproach: "irb", unresolvedModuleIds: [] },
    });
    expect([...d.attributes]).toEqual([]);
    expect(d.unmatchedComposition).toContain("treatment-prudential-approach:irb");
  });

  it("FAIL-CLOSED: an unresolved treatment pick derives NOTHING and flags it", () => {
    const d = deriveCapturedAttributes({
      filTypeScopes: ["fil:type:credit:loan"],
      resolved: { regulatoryApproach: "standardised-credit-risk", unresolvedModuleIds: ["x"] },
    });
    expect([...d.attributes]).toEqual([]);
    expect(d.compositionUnresolved).toBe(true);
  });

  it("provenance records which row derived each attribute", () => {
    const d = deriveCapturedAttributes({
      filTypeScopes: [],
      resolved: { regulatoryApproach: "standardised-credit-risk", unresolvedModuleIds: [] },
    });
    const ec = d.provenance.find((p) => p.attribute === "exposureClass");
    expect(ec?.rowIds).toEqual(["standardised-credit-regulatory-approach"]);
  });
});

// ---------------------------------------------------------------------------
// REGRESSION PIN — the derived set for the seeded composition shapes is FIXED.
// A capability-map edit that changes any of these is a loud failure (a map row
// flips a past approval). Append-only-by-convention; widen only with a recorded
// Decision + an explicit update here.
// ---------------------------------------------------------------------------

describe("capture-capability-map — regression pin (replay-safety)", () => {
  it("the seeded derivation set is pinned", () => {
    expect(derived(["fil:type:credit:loan"], "standardised-credit-risk")).toEqual([
      "exposureClass",
      "regulatoryApproach",
    ]);
    expect(derived([], "sa-ccr")).toEqual(["regulatoryApproach"]);
    expect(derived(["fil:type:fx:spot"], undefined)).toEqual([]);
  });

  it("the capability map has exactly the two grounded rows (no fabricated growth)", () => {
    expect(CAPTURE_CAPABILITY_MAP.map((r) => r.id).sort()).toEqual([
      "sa-ccr-regulatory-approach",
      "standardised-credit-regulatory-approach",
    ]);
  });

  it("every capability-row attribute is type/treatment-grounded (never per-instance)", () => {
    // Defence: these per-instance/per-obligor attributes must NEVER appear in a
    // capability-map row (they are the D-path / gap concern). Catches an over-
    // reaching map edit.
    const forbidden = new Set(["pdEstimate", "lgdEstimate", "counterpartyIdentity", "hqlaLevel"]);
    for (const row of CAPTURE_CAPABILITY_MAP) {
      for (const attr of row.attributes) {
        expect(forbidden.has(attr)).toBe(false);
      }
    }
  });
});
