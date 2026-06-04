// platform/regulatory/resolve-applicable-rule.test.ts
//
// Tests the Basel "baseline, superseded by local" resolution primitive.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, test } from "bun:test";

import { ADOPTION_EDGES, BASEL_PROVISIONS } from "./basel-adoption";
import { isResolved, resolveApplicableRule } from "./resolve-applicable-rule";

describe("resolveApplicableRule", () => {
  test("ZA + LCR minimum resolves to the local SARB adoption (Reg 26)", () => {
    const r = resolveApplicableRule("za", "urn:reg:bcbs:lcr:20.1", "2026-06-04");
    expect(isResolved(r)).toBe(true);
    if (!isResolved(r)) return;
    expect(r.source).toBe("local");
    expect(r.localInstrument).toBe("urn:reg:za:regs-relating-to-banks:reg26");
    expect(r.adoptionType).toBe("ADOPTS");
    expect(r.baseline.value).toBe(1.0);
  });

  test("unmapped jurisdiction falls back to the Basel baseline (the operating base)", () => {
    const r = resolveApplicableRule("kw", "urn:reg:bcbs:lcr:20.1", "2026-06-04");
    expect(isResolved(r)).toBe(true);
    if (!isResolved(r)) return;
    expect(r.source).toBe("basel-baseline");
    expect(r.citation).toBe("urn:reg:bcbs:lcr:20.1");
    expect(r.baseline.value).toBe(1.0);
  });

  test("date-scoped: before the SA adoption effectiveFrom, Basel governs", () => {
    // SA adopts the LCR minimum from 2015-01-01.
    const before = resolveApplicableRule("za", "urn:reg:bcbs:lcr:20.1", "2014-06-30");
    expect(isResolved(before)).toBe(true);
    if (!isResolved(before)) return;
    expect(before.source).toBe("basel-baseline");

    const after = resolveApplicableRule("za", "urn:reg:bcbs:lcr:20.1", "2015-06-30");
    expect(isResolved(after)).toBe(true);
    if (!isResolved(after)) return;
    expect(after.source).toBe("local");
  });

  test("GOLD_PLATES surfaces the stricter-than-Basel delta (ZA leverage RAS)", () => {
    const r = resolveApplicableRule("za", "urn:reg:bcbs:lev:20.1", "2026-06-04");
    expect(isResolved(r)).toBe(true);
    if (!isResolved(r)) return;
    expect(r.source).toBe("local");
    expect(r.adoptionType).toBe("GOLD_PLATES");
    expect(r.stricter).toBe(true);
    expect(r.baseline.value).toBe(0.03);
  });

  test("malformed URN returns an error", () => {
    const r = resolveApplicableRule("za", "not-a-urn", "2026-06-04");
    expect(isResolved(r)).toBe(false);
  });

  test("non-Basel URN is rejected", () => {
    const r = resolveApplicableRule("za", "urn:reg:za:banks-act-94-1990:s.70", "2026-06-04");
    expect(isResolved(r)).toBe(false);
  });

  test("uncatalogued Basel provision returns an error", () => {
    const r = resolveApplicableRule("za", "urn:reg:bcbs:lcr:99.99", "2026-06-04");
    expect(isResolved(r)).toBe(false);
  });

  test("every adoption edge points at a catalogued Basel provision", () => {
    const known = new Set(BASEL_PROVISIONS.map((p) => p.urn));
    for (const e of ADOPTION_EDGES) {
      expect(known.has(e.baselProvision)).toBe(true);
    }
  });
});
