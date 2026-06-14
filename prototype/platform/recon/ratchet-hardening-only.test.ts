// platform/recon/ratchet-hardening-only.test.ts
//
// Unit tests for the ratchet-hardening-only meta-gate (advisory).
// Authority: D-ENGINEERING-INTEGRITY-CHARTER.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { run } from "./ratchet-hardening-only";

const SNAP = "KNOWN_VIOLATIONS_SNAPSHOT";
const COMPLETE = `// Harden-only ratchet. Do NOT increase without a CEO-approved Decision.\n// Authority: D-ENGINEERING-INTEGRITY-CHARTER.\nconst ${SNAP} = 3;\n`;
const NO_CONTRACT = `// just a counter\n// Authority: D-ENGINEERING-INTEGRITY-CHARTER.\nconst ${SNAP} = 3;\n`;
const NO_CITATION = `// Harden-only ratchet. Do NOT increase without a Decision.\nconst ${SNAP} = 3;\n`;

let tmpDirs: string[] = [];

function makeProto(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "charter-ratchet-"));
  tmpDirs.push(dir);
  writeFileSync(join(dir, "CLAUDE.md"), "fixture", "utf8");
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
});

describe("ratchet-hardening-only meta-gate", () => {
  it("a complete ratchet file → no violation", () => {
    const dir = makeProto({ "platform/recon/good.ts": COMPLETE });
    const r = run({ prototypeDir: dir });
    expect(r.ratchetFiles).toBe(1);
    expect(r.violations.length).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("a non-ratchet file is ignored", () => {
    const dir = makeProto({ "platform/recon/plain.ts": "export const x = 1;\n" });
    const r = run({ prototypeDir: dir });
    expect(r.ratchetFiles).toBe(0);
    expect(r.violations.length).toBe(0);
  });

  it("missing contract clause → advisory warn (never fail)", () => {
    const dir = makeProto({ "platform/recon/bad.ts": NO_CONTRACT });
    const r = run({ prototypeDir: dir });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.ok).toBe(true); // advisory — never blocks CI
  });

  it("missing Decision citation → advisory warn", () => {
    const dir = makeProto({ "platform/recon/bad.ts": NO_CITATION });
    const r = run({ prototypeDir: dir });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.ok).toBe(true);
  });

  it("never emits a fail severity (advisory contract)", () => {
    const dir = makeProto({
      "platform/recon/bad.ts": NO_CONTRACT,
      "platform/recon/good.ts": COMPLETE,
    });
    const r = run({ prototypeDir: dir });
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });
});
