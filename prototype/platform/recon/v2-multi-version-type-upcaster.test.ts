// platform/recon/v2-multi-version-type-upcaster.test.ts
//
// Regression test for the multi-version-type-upcaster gate
// (D-EVENT-ENVELOPE-SCHEMA-VERSION). Asserts the live tree is clean AND that the
// version-explicit upcaster dispatch behaves correctly (legacy fallback +
// explicit version), so the gate + dispatch are load-bearing.

import { describe, expect, it } from "bun:test";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import {
  UPCASTER_REGISTRY,
  resolveEffectiveVersion,
  upcastCcrEadComputed,
} from "../event-store/upcaster-registry";
import { run } from "./v2-multi-version-type-upcaster";

describe("recon:v2-multi-version-type-upcaster", () => {
  it("the live tree is clean (every multi-version type has a complete chain)", () => {
    const result = run();
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("CcrEadComputed declares schemaVersion 2 with a declared v1→2 upcaster", () => {
    const meta = EVENT_TYPE_REGISTRY.find((m) => m.type === "CcrEadComputed");
    expect(meta?.schemaVersion).toBe(2);
    const decl = UPCASTER_REGISTRY.get("CcrEadComputed");
    expect(decl?.currentVersion).toBe(2);
    expect(decl?.steps.has(1)).toBe(true);
  });

  it("legacy un-stamped CcrEadComputed (numeric ead) sniffs to version 1 and upcasts", () => {
    const legacy = { ead: 1234, rc: 1000, pfe: 234, currency: "ZAR" } as Record<string, unknown>;
    // No explicit version -> the retained shape-sniff classifies it as v1.
    expect(resolveEffectiveVersion("CcrEadComputed", legacy)).toBe(1);
    const upcast = upcastCcrEadComputed(legacy);
    // V2 carries MoneyWire (object), not a bare number.
    expect(typeof upcast.ead).toBe("object");
  });

  it("explicit schemaVersion is authoritative over the shape-sniff", () => {
    // A payload whose shape looks legacy but is stamped current passes through.
    const stampedCurrent = { ead: { currency: "ZAR", amount: "12.34" } } as Record<string, unknown>;
    expect(resolveEffectiveVersion("CcrEadComputed", stampedCurrent, 2)).toBe(2);
    // And an explicit v1 forces the upcast even if shape were ambiguous.
    const stampedLegacy = { ead: 1234, rc: 1000, pfe: 234, currency: "ZAR" } as Record<
      string,
      unknown
    >;
    expect(resolveEffectiveVersion("CcrEadComputed", stampedLegacy, 1)).toBe(1);
  });
});
