// platform/agent-spec/bounded-write.test.ts
//
// Tests for @platform/agent-spec/bounded-write.
//
// Coverage:
//   (a) boundedWrite succeeds for a valid section (6–17) in dry-run mode.
//   (b) boundedWrite rejects section < 6.
//   (c) boundedWrite rejects section > 17.
//   (d) boundedWrite rejects an agent whose Team file does not exist.
//   (e) File content is correctly updated: target section replaced, others preserved.
//
// Author: Atlas (Core Banking Platform Architect, engineering)

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { boundedWrite } from "./bounded-write";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal well-formed agent spec that includes sections 1–17. */
function buildMinimalSpec(): string {
  const sections: string[] = [];

  sections.push("# Test Agent\n\nA minimal fixture spec.\n");

  for (let n = 1; n <= 17; n++) {
    sections.push(`## ${n}. Section ${n}\n\nOriginal content for section ${n}.\n`);
  }

  return sections.join("\n");
}

/** Locate the repo root by walking up from this file's directory. */
function findRepoRoot(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find repo root (no CLAUDE.md found in ancestors)");
}

// ---------------------------------------------------------------------------
// Fixtures — temporary Team directory
// ---------------------------------------------------------------------------

let tmpTeamDir: string;
let mockRepoRoot: string;

beforeEach(() => {
  // Create a temp directory that mimics <repoRoot>/Team/ so tests never touch
  // the real Team files.
  const base = resolve(import.meta.dir, `__tmp-bounded-write-${Date.now()}`);
  mkdirSync(resolve(base, "Team"), { recursive: true });
  // Also need prototype/.local for the event store initialised by composition
  mkdirSync(resolve(base, "prototype", ".local"), { recursive: true });
  tmpTeamDir = resolve(base, "Team");
  mockRepoRoot = base;
});

afterEach(() => {
  if (existsSync(mockRepoRoot)) {
    rmSync(mockRepoRoot, { recursive: true, force: true });
  }
});

/** Write a fixture spec file for `agent` inside the temp Team dir. */
function writeFixtureSpec(agent: string): string {
  const name = agent.charAt(0).toUpperCase() + agent.slice(1);
  const path = resolve(tmpTeamDir, `${name}.md`);
  writeFileSync(path, buildMinimalSpec(), "utf8");
  return path;
}

// ---------------------------------------------------------------------------
// Shared request factory
// ---------------------------------------------------------------------------

function makeRequest(
  overrides: Partial<Parameters<typeof boundedWrite>[0]> = {},
): Parameters<typeof boundedWrite>[0] {
  return {
    agent: "fixture",
    section: 12,
    content: "Updated content for section 12.\n",
    linkedAdvisoryId: "ADV-FIXTURE-001",
    summary: "Test optimisation summary.",
    changeType: "prompt",
    expectedSavingPct: 15,
    runId: "run-test-001",
    actorAgent: "sade",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("boundedWrite", () => {
  test("(a) dry-run succeeds for valid section 12", async () => {
    writeFixtureSpec("fixture");

    const result = await boundedWrite(makeRequest({ dryRun: true }), {
      repoRoot: mockRepoRoot,
    });

    expect(result.ok).toBe(true);
    expect(result.section).toBe(12);
    expect(result.eventId).toBeUndefined();
    // File should NOT have been changed in dry-run
    const content = readFileSync(resolve(tmpTeamDir, "Fixture.md"), "utf8");
    expect(content).toContain("Original content for section 12.");
  });

  test("(b) rejects section < 6", async () => {
    writeFixtureSpec("fixture");

    const result = await boundedWrite(makeRequest({ section: 5 }), {
      repoRoot: mockRepoRoot,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/out of bounds/);
    expect(result.section).toBe(5);
  });

  test("(c) rejects section > 17", async () => {
    writeFixtureSpec("fixture");

    const result = await boundedWrite(makeRequest({ section: 18 }), {
      repoRoot: mockRepoRoot,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/out of bounds/);
    expect(result.section).toBe(18);
  });

  test("(d) rejects agent with no Team file", async () => {
    // No spec file written for "phantom"
    const result = await boundedWrite(makeRequest({ agent: "phantom" }), {
      repoRoot: mockRepoRoot,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Team file not found/);
  });

  test("(e) file content is correctly updated — target section replaced, others preserved", async () => {
    writeFixtureSpec("fixture");

    const newSectionContent = "Replaced content for section 9 (cadence).\n";

    const result = await boundedWrite(
      makeRequest({ section: 9, content: newSectionContent, dryRun: false }),
      { repoRoot: mockRepoRoot },
    );

    expect(result.ok).toBe(true);
    expect(result.section).toBe(9);

    const updated = readFileSync(resolve(tmpTeamDir, "Fixture.md"), "utf8");

    // Target section should have new content
    expect(updated).toContain(newSectionContent.trim());

    // Section 9's original content should be gone
    expect(updated).not.toContain("Original content for section 9.");

    // Adjacent sections must remain intact
    expect(updated).toContain("Original content for section 8.");
    expect(updated).toContain("Original content for section 10.");

    // All other sections must be present
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17]) {
      expect(updated).toContain(`Section ${n}`);
    }
  });

  test("(f) live dry-run against real Sade spec — valid section 12", async () => {
    const repoRoot = findRepoRoot();
    const result = await boundedWrite(
      makeRequest({
        agent: "Sade",
        section: 12,
        dryRun: true,
      }),
      { repoRoot },
    );

    expect(result.ok).toBe(true);
    expect(result.section).toBe(12);
    expect(result.eventId).toBeUndefined();
  });
});
