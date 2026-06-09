// platform/recon/ba-form-numbering.test.ts
//
// Tests for the ba-form-numbering recon gate: it must FAIL on a known-wrong
// (form, meaning) co-location, PASS when that file is allowlisted (warn), and
// FAIL on a stale allowlist entry. Authority: D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION.

import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { runBaFormNumberingRecon } from "./ba-form-numbering";

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ba-form-recon-"));
  mkdirSync(resolve(root, "Policies"), { recursive: true });
  // Wrong: BA 325 co-located with LCR (legacy GG-2012 — canonical is BA 110).
  writeFileSync(
    resolve(root, "Policies/wrong.md"),
    "---\nstatus: IN FORCE\n---\nThe bank files the BA 325 LCR return monthly.\n",
  );
  // Correct: BA 325 co-located with FRTB is fine (BA 325 = FRTB under D5/2025).
  writeFileSync(
    resolve(root, "Policies/right.md"),
    "---\nstatus: IN FORCE\n---\nThe BA 325 FRTB market-risk capital return is filed quarterly.\n",
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

test("fails on a wrong (form, meaning) co-location", () => {
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

test("does not flag a correct BA 325 = FRTB co-location", () => {
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
