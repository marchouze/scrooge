// platform/recon/agent-mandate-domains-coverage.test.ts
//
// Sabotage-proof tests for recon:agent-mandate-domains-coverage. The clean roster
// passes; a persona with empty/absent mandateDomains FAILS; an off-vocabulary tag
// FAILS; a vocabulary missing the reserved `shared` tag FAILS. Also runs the gate
// against the REAL roster on disk and asserts it is green (all 31 personas tagged).
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 2.

import { describe, expect, it } from "bun:test";

import {
  type RosterForCoverage,
  assertMandateDomainsCoverage,
  run,
} from "./agent-mandate-domains-coverage";

function roster(
  personas: Array<{ name?: string; mandateDomains?: unknown }>,
  vocab: { tags?: unknown; shared?: unknown } = {
    tags: ["shared", "platform", "accounting"],
    shared: "shared",
  },
): RosterForCoverage {
  return { personas, vocabulary: vocab };
}

describe("assertMandateDomainsCoverage", () => {
  it("clean roster → zero fail violations", () => {
    const r = assertMandateDomainsCoverage(
      roster([
        { name: "Atlas", mandateDomains: ["platform"] },
        { name: "Bea", mandateDomains: ["accounting"] },
      ]),
      "fail",
    );
    expect(r.violations.filter((v) => v.severity === "fail").length).toBe(0);
    // 1 vocab assertion + 2 personas
    expect(r.asserted).toBe(3);
  });

  it("NEGATIVE — a persona with EMPTY mandateDomains FAILS", () => {
    const r = assertMandateDomainsCoverage(roster([{ name: "Atlas", mandateDomains: [] }]), "fail");
    expect(r.violations.some((v) => v.severity === "fail" && v.subject.includes("Atlas"))).toBe(
      true,
    );
  });

  it("NEGATIVE — a persona with ABSENT mandateDomains FAILS", () => {
    const r = assertMandateDomainsCoverage(roster([{ name: "Atlas" }]), "fail");
    expect(r.violations.some((v) => v.severity === "fail" && v.subject.includes("Atlas"))).toBe(
      true,
    );
  });

  it("NEGATIVE — an off-vocabulary tag FAILS", () => {
    const r = assertMandateDomainsCoverage(
      roster([{ name: "Atlas", mandateDomains: ["not-a-real-domain"] }]),
      "fail",
    );
    expect(
      r.violations.some((v) => v.severity === "fail" && v.message.includes("not-a-real-domain")),
    ).toBe(true);
  });

  it("NEGATIVE — vocabulary missing the reserved `shared` tag FAILS", () => {
    const r = assertMandateDomainsCoverage(
      roster([{ name: "Atlas", mandateDomains: ["platform"] }], {
        tags: ["platform"],
        shared: "shared",
      }),
      "fail",
    );
    expect(
      r.violations.some((v) => v.subject === "mandateDomainVocabulary" && v.severity === "fail"),
    ).toBe(true);
  });
});

describe("run() against the real roster", () => {
  it("the on-disk roster passes (all personas explicitly tagged, all in-vocabulary)", () => {
    const result = run();
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail").length).toBe(0);
    // The real roster has 31 personas + the 1 vocabulary assertion.
    expect(result.asserted).toBe(32);
  });
});
