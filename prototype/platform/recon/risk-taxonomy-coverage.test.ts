// platform/recon/risk-taxonomy-coverage.test.ts
//
// Tests for the Vera Wave-5 `risk-taxonomy-coverage` recon (advisory v1).
//
// Coverage:
//   (a) recognises a valid `riskTaxonomy` code in a fixture markdown
//       frontmatter — no finding emitted.
//   (b) flags a missing `riskTaxonomy` field as a finding.
//   (c) flags an invalid code (`RT-NONEXISTENT`) as a finding.
//   (d) returns `ok: true` in advisory mode even when findings exist
//       (advisory means warn-severity; only fail-severity flips ok).
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
const RAS_PATH = resolve(REPO, "Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md");

/** Build a synthetic policy file path under `Owner Inbox/` for fixtures. */
function policyPath(name: string): string {
  return resolve(REPO, "Owner Inbox", name);
}

describe("risk-taxonomy-coverage recon (Vera Wave-5, advisory v1)", () => {
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
      policyDirOverride: resolve(REPO, "Owner Inbox"),
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
      policyDirOverride: resolve(REPO, "Owner Inbox"),
    });
    expect(r.asserted).toBe(1);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("(b) flags a missing riskTaxonomy field on a policy", () => {
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
      policyDirOverride: resolve(REPO, "Owner Inbox"),
    });
    expect(r.asserted).toBe(1);
    expect(r.violations.length).toBe(1);
    const v = r.violations[0];
    expect(v?.severity).toBe("warn");
    expect(v?.message).toMatch(/missing the `riskTaxonomy` field/);
    // (d): advisory mode — ok stays true.
    expect(r.ok).toBe(true);
  });

  it("(c) flags an invalid code (RT-NONEXISTENT) as a finding", () => {
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
      policyDirOverride: resolve(REPO, "Owner Inbox"),
    });
    expect(r.asserted).toBe(1);
    expect(r.violations.length).toBe(1);
    const v = r.violations[0];
    expect(v?.severity).toBe("warn");
    expect(v?.message).toMatch(/code not in canonical register/);
    expect(v?.message).toContain("RT-NONEXISTENT");
    expect(r.ok).toBe(true);
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
      policyDirOverride: resolve(REPO, "Owner Inbox"),
    });
    expect(r.asserted).toBe(1);
    // Only the invalid code emits a finding; the valid one is silent.
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("RT-FAKE-CODE");
    expect(r.ok).toBe(true);
  });

  it("(d) advisory mode — ok=true even with many warn findings on the live corpus", () => {
    // Smoke-run against the real repo. v1 expects high finding count;
    // this test pins the invariant: ok stays true while findings are
    // emitted at warn severity. When backfill PRs land, the finding
    // count drops; only the final v2 flip (warn → fail) would change
    // this invariant.
    const r = run();
    expect(r.pipeline).toBe("risk-taxonomy-coverage");
    expect(r.asserted).toBeGreaterThan(0);
    // No fail-severity findings in v1.
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("scope=obligations alone walks the obligations register", () => {
    // Confirm the obligations scanner finds rows and emits findings on
    // the live register (every row currently lacks `riskTaxonomy`).
    if (!existsSync(OBLIGATIONS_PATH)) return; // skip if register absent
    const r = run({ scopes: ["obligations"] });
    expect(r.asserted).toBeGreaterThan(0);
    // Every assertion is a row; every row currently lacks the field;
    // so violations.length === asserted in v1 steady-state.
    expect(r.violations.length).toBe(r.asserted);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("scope=ras alone walks the RAS document Part-B lines", () => {
    if (!existsSync(RAS_PATH)) return;
    const r = run({ scopes: ["ras"] });
    expect(r.asserted).toBeGreaterThan(0);
    // Most B-lines lack the annotation; some may be backfilled over time.
    // Assert at least one finding exists and the count never exceeds total.
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations.length).toBeLessThanOrEqual(r.asserted);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
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
