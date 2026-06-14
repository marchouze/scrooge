// platform/recon/domain-ownership-coherence.test.ts
import { describe, expect, test } from "bun:test";

import { run } from "./domain-ownership-coherence";

describe("domain-ownership-coherence", () => {
  const result = run();

  test("C1 — every authored obligation classifies (0 orphans)", () => {
    expect(result.summary.orphans).toBe(0);
  });

  test("C2 — no FAIL-severity violations (every seat resolves to an active agent)", () => {
    expect(result.violations.filter((v) => v.severity === "fail")).toEqual([]);
  });

  test("C3 — every top-level domain has an accountable agent", () => {
    expect(result.summary.uncoveredTopLevels).toBe(0);
  });

  test("advisory mode keeps the gate green while drift drains", () => {
    expect(result.summary.mode).toBe("advisory");
    expect(result.ok).toBe(true);
  });

  test("C4 drift is surfaced as warn-severity findings", () => {
    const driftWarns = result.violations.filter((v) => v.severity === "warn");
    expect(driftWarns.length).toBe(result.summary.drift);
  });
});
