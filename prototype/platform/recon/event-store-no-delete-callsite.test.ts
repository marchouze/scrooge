// platform/recon/event-store-no-delete-callsite.test.ts
//
// Unit tests for the event-store-no-delete-callsite static recon.
//
// Coverage:
//   1. Clean prototype dir → ok=true, no violations.
//   2. File with `DELETE FROM events` → fail violation emitted.
//   3. `.exec("DELETE FROM events …")` pattern → fail violation emitted.
//   4. `.run("DELETE FROM events …")` pattern → fail violation emitted.
//   5. Comment-only mention of DELETE → not flagged.
//   6. Allowlisted red-team test path → not flagged.
//   7. Multiple violations in one file → all reported.
//   8. DELETE in a string assigned to a variable (not SQL execution) → not flagged
//      (heuristic: inside double-quoted string).
//
// Author: Vera (Internal audit engineer, engineering)

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { run } from "./event-store-no-delete-callsite";

// ---------------------------------------------------------------------------
// Test helper — build a minimal synthetic prototype directory with controlled
// TypeScript files so we can assert the scanner behaviour without touching the
// real codebase.
// ---------------------------------------------------------------------------

let tmpDirs: string[] = [];

function makeSyntheticProto(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "vera-no-delete-"));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/")), {
      recursive: true,
    });
    writeFileSync(full, content, "utf8");
  }
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) {
    rmSync(d, { recursive: true, force: true });
  }
  tmpDirs = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("event-store-no-delete-callsite recon", () => {
  it("clean directory → ok=true, zero violations", () => {
    const dir = makeSyntheticProto({
      "platform/foo.ts": `
        const x = 1;
        // No SQL here.
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.callsites).toHaveLength(0);
  });

  it("DELETE FROM events in non-allowlisted file → fail violation", () => {
    const dir = makeSyntheticProto({
      "platform/dangerous.ts": `
        import { Database } from "bun:sqlite";
        const db = new Database(path);
        db.exec("DELETE FROM events WHERE sequence = 1");
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.message).toContain("Principle 1");
    expect(r.callsites).toHaveLength(1);
    expect(r.callsites[0]?.file).toBe("platform/dangerous.ts");
  });

  it(".exec(`DELETE …`) template-literal pattern → fail", () => {
    const dir = makeSyntheticProto({
      "scripts/bad-migration.ts": "db.exec(`DELETE FROM events WHERE id = '${id}'`);",
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(false);
    expect(r.callsites).toHaveLength(1);
    expect(r.callsites[0]?.file).toBe("scripts/bad-migration.ts");
  });

  it(".run('DELETE …') pattern → fail", () => {
    const dir = makeSyntheticProto({
      "runtime/bad.ts": `db.run('DELETE FROM events WHERE event_id = ?', [id]);`,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(false);
    expect(r.callsites).toHaveLength(1);
  });

  it("comment-only line with DELETE FROM events → not flagged", () => {
    const dir = makeSyntheticProto({
      "platform/docs.ts": `
        // DELETE FROM events is forbidden per Principle 1.
        // Never run DELETE FROM events against the shared store.
        const x = 1;
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.callsites).toHaveLength(0);
  });

  it("allowlisted red-team test file → not flagged", () => {
    // The allowlist contains platform/recon/event-store-append-only.test.ts.
    // Simulate that exact path in a synthetic proto dir.
    const dir = makeSyntheticProto({
      "platform/recon/event-store-append-only.test.ts": `
        // Red-team: inject DELETE to prove recon detects it.
        sideband.exec("DELETE FROM events WHERE sequence IN (50, 51, 52)");
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.callsites).toHaveLength(0);
  });

  it("allowlisted bus regression test → not flagged", () => {
    const dir = makeSyntheticProto({
      "tests/event-trigger-bus.test.ts": `
        sideband.exec("DELETE FROM events WHERE sequence IN (3, 4)");
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.callsites).toHaveLength(0);
  });

  it("multiple violations in one file → all reported, single violation entry", () => {
    const dir = makeSyntheticProto({
      "platform/multi.ts": [
        `db.exec("DELETE FROM events WHERE sequence = 1");`,
        `db.run("DELETE FROM events WHERE sequence = 2");`,
      ].join("\n"),
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(false);
    // Both callsites reported.
    expect(r.callsites).toHaveLength(2);
    // Single consolidated violation entry (all callsites rolled into one message).
    expect(r.violations).toHaveLength(1);
  });

  it("violations across two files → all reported", () => {
    const dir = makeSyntheticProto({
      "platform/a.ts": `db.exec("DELETE FROM events WHERE x = 1");`,
      "platform/b.ts": `db.run("DELETE FROM events WHERE y = 2");`,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(false);
    expect(r.callsites).toHaveLength(2);
    const files = r.callsites.map((c) => c.file).sort();
    expect(files).toEqual(["platform/a.ts", "platform/b.ts"]);
  });
});
