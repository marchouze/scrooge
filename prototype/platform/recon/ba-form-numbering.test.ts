// platform/recon/ba-form-numbering.test.ts
//
// Tests for the ba-form-numbering recon gate: it must FAIL on a fabricated
// (form, meaning) co-location, PASS when allowlisted (warn), and FAIL on a stale
// allowlist entry. Canonical map authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL.

import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { runBaFormNumberingRecon } from "./ba-form-numbering";

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ba-form-recon-"));
  mkdirSync(resolve(root, "Policies"), { recursive: true });
  mkdirSync(resolve(root, "Procedures"), { recursive: true });
  mkdirSync(resolve(root, "Regulations/SARB-PA/ba-returns"), { recursive: true });
  // CLAUDE.md sentinel so findRepoRoot resolves the synthetic tree (default-scan tests).
  writeFileSync(resolve(root, "CLAUDE.md"), "# test root\n");
  // Wrong: BA 110 co-located with LCR (BA 110 = off-balance-sheet; LCR is BA 300).
  writeFileSync(
    resolve(root, "Policies/wrong.md"),
    "---\nstatus: IN FORCE\n---\nThe bank files the BA 110 LCR return monthly.\n",
  );
  // Correct: BA 700 = capital adequacy (the real form).
  writeFileSync(
    resolve(root, "Policies/right.md"),
    "---\nstatus: IN FORCE\n---\nThe BA 700 capital adequacy and leverage return is filed quarterly.\n",
  );
  // Phase A widening fixtures (D-BA-RETURN-DATA-CONTRACT):
  // a conflicting reference-layer file under Regulations/SARB-PA/ba-returns/.
  writeFileSync(
    resolve(root, "Regulations/SARB-PA/ba-returns/ba-ref-wrong.md"),
    "# Ref\nForm BA 100 is the capital-adequacy return.\n",
  );
  // The canonical register: deliberately co-locates fabricated pairs as corrections —
  // must be EXEMPT (scanned but never flagged).
  writeFileSync(
    resolve(root, "Regulations/SARB-PA/ba-returns/_canonical-register.md"),
    "# Register\n| BA 100 ↔ capital-adequacy | BA 700 (BA 100 = balance sheet) |\n",
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

test("fails on a fabricated (form, meaning) co-location", () => {
  const r = runBaFormNumberingRecon({
    repoRootOverride: root,
    pathsOverride: ["Policies/wrong.md", "Policies/right.md"],
    allowlistOverride: new Set(),
  });
  expect(r.ok).toBe(false);
  const fails = r.violations.filter((v) => v.severity === "fail");
  expect(fails.length).toBe(1);
  expect(fails[0]?.subject).toContain("Policies/wrong.md");
});

test("does not flag a correct BA 700 = capital-adequacy co-location", () => {
  const r = runBaFormNumberingRecon({
    repoRootOverride: root,
    pathsOverride: ["Policies/right.md"],
    allowlistOverride: new Set(),
  });
  expect(r.ok).toBe(true);
  expect(r.violations.length).toBe(0);
});

test("allowlisted file passes as warn, not fail", () => {
  const r = runBaFormNumberingRecon({
    repoRootOverride: root,
    pathsOverride: ["Policies/wrong.md"],
    allowlistOverride: new Set(["Policies/wrong.md"]),
  });
  expect(r.ok).toBe(true);
  expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
});

test("stale allowlist entry (no longer conflicting) fails", () => {
  const r = runBaFormNumberingRecon({
    repoRootOverride: root,
    pathsOverride: ["Policies/right.md"],
    allowlistOverride: new Set(["Policies/right.md"]),
  });
  expect(r.ok).toBe(false);
  expect(r.violations.some((v) => v.message.includes("Stale PENDING_REMEDIATION"))).toBe(true);
});

// Phase A widening (D-BA-RETURN-DATA-CONTRACT): the default scan now also walks
// Regulations/SARB-PA/ba-returns/, and the canonical register is exempt.
test("default scan includes Regulations/SARB-PA/ba-returns/ (widened scope)", () => {
  const r = runBaFormNumberingRecon({
    repoRootOverride: root,
    allowlistOverride: new Set(),
  });
  expect(r.ok).toBe(false);
  const fails = r.violations.filter((v) => v.severity === "fail");
  // The conflicting reference-layer file is flagged...
  expect(fails.some((v) => v.subject.includes("ba-returns/ba-ref-wrong.md"))).toBe(true);
  // ...and the existing Policies/ conflict is still flagged (scopes are additive).
  expect(fails.some((v) => v.subject.includes("Policies/wrong.md"))).toBe(true);
});

test("the canonical register is exempt — never flagged despite documenting forbidden pairs", () => {
  const r = runBaFormNumberingRecon({
    repoRootOverride: root,
    allowlistOverride: new Set(),
  });
  expect(r.violations.every((v) => !v.subject.includes("_canonical-register.md"))).toBe(true);
});
