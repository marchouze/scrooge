// platform/recon/fx-leg-structure-matches-rules.test.ts
//
// Proves the FX leg-structure drift gate (recon:fx-leg-structure-matches-rules):
//   1. PASSES on the REAL declaration (it currently matches the rules).
//   2. BITES — fails — when a single declaration leg is mutated (wrong direction,
//      wrong role, dropped leg, extra leg, or an undeclared driven rule). This is
//      the lessons-to-gate guarantee: the declaration can no longer silently drift
//      from the posting rules (D-AGENT-DOMAIN-COMPETENCE; Engineering Charter cmd 3).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { FxAccountRole, FxLifecycleStageId } from "../../v2-core/posting-rules/fx-lifecycle-leg-structure";
import {
  actualLegsForTest,
  assertDeclarationMatchesRules,
  run,
} from "./fx-leg-structure-matches-rules";

const { actualByStage, codeToRole, realDeclaration } = actualLegsForTest();

/** A mutable copy of a (rule, stage) declaration entry for the negative tests. */
interface MutableEntry {
  postingRuleId: string;
  stage: FxLifecycleStageId;
  legs: { role: FxAccountRole; drCr: "debit" | "credit" }[];
}

/** Deep-clone the real declaration so a mutation cannot leak across tests. */
function cloneDeclaration(): MutableEntry[] {
  return realDeclaration.map((d) => ({
    postingRuleId: d.postingRuleId,
    stage: d.stage,
    legs: d.legs.map((l) => ({ role: l.role, drCr: l.drCr })),
  }));
}

const failCount = (vs: { severity: string }[]) => vs.filter((v) => v.severity === "fail").length;

describe("recon:fx-leg-structure-matches-rules", () => {
  it("PASSES on the real declaration — it matches the pure rule functions", () => {
    const r = run();
    expect(r.ok).toBe(true);
    expect(failCount(r.violations)).toBe(0);
    // 11 declared (rule, stage) + 11 driven = 22 assertions.
    expect(r.asserted).toBe(22);
  });

  it("BITES when a leg's DIRECTION is flipped (the drift the gate exists to catch)", () => {
    const decl = cloneDeclaration();
    // The Initiation OBS first leg is `debit obs-bought-commitment`; flip it.
    const init = decl.find((d) => d.postingRuleId === "PR-FX-001-V2" && d.stage === "a");
    expect(init).toBeDefined();
    if (!init) return;
    const leg0 = init.legs[0];
    if (!leg0) throw new Error("PR-FX-001-V2:a has no legs");
    init.legs = [
      { role: leg0.role, drCr: leg0.drCr === "debit" ? "credit" : "debit" },
      ...init.legs.slice(1),
    ];

    const vs = assertDeclarationMatchesRules(decl, actualByStage, codeToRole);
    expect(failCount(vs)).toBeGreaterThan(0);
    expect(vs.some((v) => v.subject.includes("PR-FX-001-V2:a:leg-0"))).toBe(true);
  });

  it("BITES when a leg's ROLE is changed (the stale receivable/payable drift)", () => {
    const decl = cloneDeclaration();
    // Reintroduce the OLD stale model: Initiation = Dr receivable (the bug #1534
    // removed). The actual rule now emits the OBS bought-commitment role.
    const init = decl.find((d) => d.postingRuleId === "PR-FX-001-V2" && d.stage === "a");
    if (!init) throw new Error("missing PR-FX-001-V2:a");
    init.legs = [{ role: "receivable", drCr: "debit" }, ...init.legs.slice(1)];

    const vs = assertDeclarationMatchesRules(decl, actualByStage, codeToRole);
    expect(failCount(vs)).toBeGreaterThan(0);
    expect(vs.some((v) => v.subject.includes("PR-FX-001-V2:a:leg-0"))).toBe(true);
    expect(vs.some((v) => v.message.includes("receivable"))).toBe(true);
  });

  it("BITES when a declared leg is DROPPED (leg-count mismatch)", () => {
    const decl = cloneDeclaration();
    const init = decl.find((d) => d.postingRuleId === "PR-FX-001-V2" && d.stage === "a");
    if (!init) throw new Error("missing PR-FX-001-V2:a");
    init.legs = init.legs.slice(1); // drop the first OBS leg

    const vs = assertDeclarationMatchesRules(decl, actualByStage, codeToRole);
    expect(failCount(vs)).toBeGreaterThan(0);
    expect(vs.some((v) => v.subject.includes("PR-FX-001-V2:a:leg-count"))).toBe(true);
  });

  it("BITES when a driven rule is UNDECLARED (silent NPA-page omission)", () => {
    const decl = cloneDeclaration().filter(
      (d) => !(d.postingRuleId === "PR-FX-OBS-RELEASE-V2" && d.stage === "d"),
    );
    const vs = assertDeclarationMatchesRules(decl, actualByStage, codeToRole);
    expect(failCount(vs)).toBeGreaterThan(0);
    expect(vs.some((v) => v.subject.includes("PR-FX-OBS-RELEASE-V2:d:undeclared"))).toBe(true);
  });

  it("BITES when the declaration names a rule the gate cannot drive (no-driver)", () => {
    const decl = cloneDeclaration();
    decl.push({
      postingRuleId: "PR-FX-FABRICATED-V2",
      stage: "a",
      legs: [{ role: "receivable", drCr: "debit" }],
    });
    const vs = assertDeclarationMatchesRules(decl, actualByStage, codeToRole);
    expect(failCount(vs)).toBeGreaterThan(0);
    expect(vs.some((v) => v.subject.includes("PR-FX-FABRICATED-V2:a:no-driver"))).toBe(true);
  });
});
