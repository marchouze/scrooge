// platform/recon/risk-taxonomy-coverage.test.ts
//
// Tests for the Vera Wave-5 `risk-taxonomy-coverage` recon (enforcing v2).
//
// Coverage:
//   (a) recognises a valid `riskTaxonomy` code in a fixture markdown
//       frontmatter — no finding emitted.
//   (b) flags a missing `riskTaxonomy` field as a `fail`-severity finding
//       (enforcing mode — ok flips to false).
//   (c) flags an invalid code (`RT-NONEXISTENT`) as a `fail`-severity finding.
//   (d) enforcing mode — live corpus has 0 violations, ok=true.
//
// Two ancillary tests cover the obligations-row scope and the RAS
// line scope so the three scopes are not silently regressed when
// the recon is touched.
//
// Author: Vera (Internal audit engineer, engineering — functionally to
//         Thandiwe (Chief Audit Executive, governance)).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { run } from "./risk-taxonomy-coverage";

function repoRoot(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("repo root not found");
}

const REPO = repoRoot();
const OBLIGATIONS_PATH = resolve(REPO, "Regulations/_obligations-register.md");
const RAS_PATH = resolve(
  REPO,
  "archive/owner-inbox/2026-05-06_risk-appetite-statement-and-framework.md",
);

/** Build a synthetic policy file path under `archive/owner-inbox/` for fixtures (Phase 4). */
function policyPath(name: string): string {
  return resolve(REPO, "archive", "owner-inbox", name);
}

describe("risk-taxonomy-coverage recon (Vera Wave-5, enforcing v2)", () => {
  it("(a) recognises a valid riskTaxonomy code in a policy frontmatter", () => {
    const path = policyPath("__fixture-valid-policy.md");
    const content = [
      "---",
      "title: Liquidity Risk Management Policy v1",
      "author: Camille",
      "date: 2026-05-11",
      "riskTaxonomy: RT-LQ",
      "decision-required: false",
      "---",
      "",
      "# body",
    ].join("\n");
    const r = run({
      fileOverrides: new Map([[path, content]]),
      scopes: ["policies"],
      policyDirOverride: resolve(REPO, "archive", "owner-inbox"),
    });
    expect(r.pipeline).toBe("risk-taxonomy-coverage");
    expect(r.asserted).toBe(1);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("(a-ii) accepts a multi-code array form in frontmatter", () => {
    const path = policyPath("__fixture-multi-policy.md");
    const content = [
      "---",
      "title: Trading Mandate v1",
      "riskTaxonomy: [RT-MK, RT-CR, RT-OP]",
      "---",
      "",
      "# body",
    ].join("\n");
    const r = run({
      fileOverrides: new Map([[path, content]]),
      scopes: ["policies"],
      policyDirOverride: resolve(REPO, "archive", "owner-inbox"),
    });
    expect(r.asserted).toBe(1);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("(b) flags a missing riskTaxonomy field on a policy as fail-severity", () => {
    const path = policyPath("__fixture-missing-policy.md");
    const content = [
      "---",
      "title: Capital Management Policy v1",
      "author: Camille",
      "---",
      "",
      "# body",
    ].join("\n");
    const r = run({
      fileOverrides: new Map([[path, content]]),
      scopes: ["policies"],
      policyDirOverride: resolve(REPO, "archive", "owner-inbox"),
    });
    expect(r.asserted).toBe(1);
    expect(r.violations.length).toBe(1);
    const v = r.violations[0];
    // Enforcing mode: missing riskTaxonomy is fail severity.
    expect(v?.severity).toBe("fail");
    expect(v?.message).toMatch(/missing the `riskTaxonomy` field/);
    // Enforcing mode: ok flips to false on fail-severity.
    expect(r.ok).toBe(false);
  });

  it("(c) flags an invalid code (RT-NONEXISTENT) as fail-severity finding", () => {
    const path = policyPath("__fixture-invalid-policy.md");
    const content = [
      "---",
      "title: AML/CFT Policy v1",
      "riskTaxonomy: RT-NONEXISTENT",
      "---",
      "",
      "# body",
    ].join("\n");
    const r = run({
      fileOverrides: new Map([[path, content]]),
      scopes: ["policies"],
      policyDirOverride: resolve(REPO, "archive", "owner-inbox"),
    });
    expect(r.asserted).toBe(1);
    expect(r.violations.length).toBe(1);
    const v = r.violations[0];
    // Enforcing mode: invalid code is fail severity.
    expect(v?.severity).toBe("fail");
    expect(v?.message).toMatch(/code not in canonical register/);
    expect(v?.message).toContain("RT-NONEXISTENT");
    expect(r.ok).toBe(false);
  });

  it("(c-ii) flags an invalid code embedded in a multi-code array", () => {
    const path = policyPath("__fixture-mixed-policy.md");
    const content = [
      "---",
      "title: POPIA Privacy Policy v1",
      "riskTaxonomy: [RT-OP, RT-FAKE-CODE]",
      "---",
    ].join("\n");
    const r = run({
      fileOverrides: new Map([[path, content]]),
      scopes: ["policies"],
      policyDirOverride: resolve(REPO, "archive", "owner-inbox"),
    });
    expect(r.asserted).toBe(1);
    // Only the invalid code emits a finding; the valid one is silent.
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("RT-FAKE-CODE");
    // Enforcing mode: ok flips to false on fail-severity.
    expect(r.ok).toBe(false);
  });

  it("(d) enforcing mode — live corpus has 0 violations, ok=true", () => {
    // Smoke-run against the real repo. v2 enforcing: all three backfills
    // have landed (obligations, RAS Part-B, policy frontmatter). Full
    // coverage — any new artefact missing riskTaxonomy will fail this test
    // (and CI) until annotated.
    const r = run();
    expect(r.pipeline).toBe("risk-taxonomy-coverage");
    expect(r.asserted).toBeGreaterThan(0);
    // Enforcing mode: no violations tolerated.
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("scope=obligations alone walks the obligations register with 0 violations", () => {
    // All obligation rows now carry a valid riskTaxonomy annotation.
    if (!existsSync(OBLIGATIONS_PATH)) return; // skip if register absent
    const r = run({ scopes: ["obligations"] });
    expect(r.asserted).toBeGreaterThan(0);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("scope=ras alone walks the RAS document Part-B lines with 0 violations", () => {
    // All Part-B sections now carry a valid riskTaxonomy annotation.
    if (!existsSync(RAS_PATH)) return;
    const r = run({ scopes: ["ras"] });
    expect(r.asserted).toBeGreaterThan(0);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("obligations scope detects valid codes inline on a row", () => {
    const path = OBLIGATIONS_PATH;
    if (!existsSync(path)) return;
    const original = readFileSync(path, "utf8");
    // Append a single fully-annotated synthetic row + verify it's
    // accepted (asserted++, no finding for that row).
    const fixtureRow =
      "| ORG-FIX-TEST | [TBD] | Test | Test | Test | Test | DRAFTING | bank | entity-only | riskTaxonomy: RT-CR |";
    const synthetic = `${original}\n${fixtureRow}\n`;
    const r = run({
      fileOverrides: new Map([[path, synthetic]]),
      scopes: ["obligations"],
    });
    // The new row is asserted and carries a valid code — no finding for it.
    const findingsForFixture = r.violations.filter((v) => v.subject.includes("ORG-FIX-TEST"));
    expect(findingsForFixture).toEqual([]);
  });
});
