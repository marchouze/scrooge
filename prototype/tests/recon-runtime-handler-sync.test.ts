// tests/recon-runtime-handler-sync.test.ts
//
// Unit tests for Vera Wave-4 #11 — runtime handler-sync integrity.
//
// Smoke: pipeline runs green over current state.
// Drift: synthetic metadata/callable/persona/script mismatches each
// raise a fail-severity violation as designed.
//
// Author: Vera

import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { run as runtimeHandlerSync } from "../platform/recon/runtime-handler-sync";

function freshTeamDir(personas: string[]): string {
  const tmp = mkdtempSync(join(tmpdir(), "bank-handler-sync-team-"));
  for (const p of personas) {
    writeFileSync(resolve(tmp, `${p}.md`), `# ${p}\n`);
  }
  return tmp;
}

function freshPackageJson(scripts: Record<string, string>): string {
  const tmp = mkdtempSync(join(tmpdir(), "bank-handler-sync-pkg-"));
  const path = resolve(tmp, "package.json");
  writeFileSync(path, JSON.stringify({ name: "test", scripts }));
  return path;
}

describe("runtime handler-sync pipeline (Vera Wave-4 #11)", () => {
  it("runs green over the live runtime registry", () => {
    const r = runtimeHandlerSync();
    expect(r.pipeline).toBe("runtime-handler-sync-integrity");
    const fails = r.violations.filter((v) => v.severity === "fail");
    if (fails.length > 0) {
      // Surface the first failure for diagnostics.
      console.error("First failure:", fails[0]);
    }
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThan(0);
  });

  it("detects metadata-without-callable drift", () => {
    const teamDir = freshTeamDir(["Yael"]);
    const packageJsonPath = freshPackageJson({
      "agent:yael-tax-snapshot": "echo yael",
    });
    const r = runtimeHandlerSync({
      metadata: [{ key: "yael:tax-snapshot", agent: "Yael", trigger: "tax-snapshot" }],
      callableKeys: [],
      teamDir,
      packageJsonPath,
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "yael:tax-snapshot" &&
          v.message.includes("HANDLER_CALLABLES has no entry"),
      ),
    ).toBe(true);
  });

  it("detects callable-without-metadata drift", () => {
    const teamDir = freshTeamDir(["Yael"]);
    const packageJsonPath = freshPackageJson({});
    const r = runtimeHandlerSync({
      metadata: [],
      callableKeys: ["yael:orphan-callable"],
      teamDir,
      packageJsonPath,
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "yael:orphan-callable" &&
          v.message.includes("no row"),
      ),
    ).toBe(true);
  });

  it("detects metadata referencing a non-existent persona", () => {
    const teamDir = freshTeamDir([]); // No personas
    const packageJsonPath = freshPackageJson({
      "agent:phantom-task": "echo phantom",
    });
    const r = runtimeHandlerSync({
      metadata: [{ key: "phantom:task", agent: "Phantom", trigger: "task" }],
      callableKeys: ["phantom:task"],
      teamDir,
      packageJsonPath,
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "phantom:task" &&
          v.message.includes("no persona file"),
      ),
    ).toBe(true);
  });

  it("detects metadata with no matching npm script", () => {
    const teamDir = freshTeamDir(["Yael"]);
    const packageJsonPath = freshPackageJson({}); // No scripts at all
    const r = runtimeHandlerSync({
      metadata: [{ key: "yael:tax-snapshot", agent: "Yael", trigger: "tax-snapshot" }],
      callableKeys: ["yael:tax-snapshot"],
      teamDir,
      packageJsonPath,
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.subject === "yael:tax-snapshot" &&
          v.message.includes('"agent:yael-tax-snapshot" script'),
      ),
    ).toBe(true);
  });

  it("returns ok when synthetic metadata, callable, persona, and script all align", () => {
    const teamDir = freshTeamDir(["Yael"]);
    const packageJsonPath = freshPackageJson({
      "agent:yael-tax-snapshot": "bun run runtime/run.ts --agent Yael --trigger tax-snapshot",
    });
    const r = runtimeHandlerSync({
      metadata: [{ key: "yael:tax-snapshot", agent: "Yael", trigger: "tax-snapshot" }],
      callableKeys: ["yael:tax-snapshot"],
      teamDir,
      packageJsonPath,
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.asserted).toBe(4); // one of each assertion class
  });
});
