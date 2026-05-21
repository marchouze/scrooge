// platform/recon/policy-next-review.test.ts
//
// Tests for the policy-next-review recon pipeline.
//
// Author: Atlas (Core banking platform architect, engineering)

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { runPolicyNextReviewRecon } from "./policy-next-review";

function mkPoliciesDir(): string {
  return mkdtempSync(resolve(tmpdir(), "policies-recon-"));
}

function writePolicy(dir: string, name: string, frontmatter: Record<string, string | null>): void {
  const lines = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (v === null) continue;
    lines.push(`${k}: "${v}"`);
  }
  lines.push("---", "", "# body", "");
  writeFileSync(resolve(dir, name), lines.join("\n"));
}

describe("policy-next-review recon", () => {
  it("flags missing next-review as fail", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "missing-policy-v1.md", {
        "policy-id": "missing-policy",
        title: "Missing Policy v1",
        status: "IN FORCE",
        "effective-from": "2026-01-01",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(false);
      expect(result.asserted).toBe(1);
      expect(result.violations.length).toBe(1);
      expect(result.violations[0]?.severity).toBe("fail");
      expect(result.violations[0]?.message).toContain("missing mandatory `next-review`");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags unparseable next-review as fail", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "bad-date-policy-v1.md", {
        "policy-id": "bad-date-policy",
        title: "Bad Date Policy v1",
        status: "IN FORCE",
        "next-review": "next year",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(false);
      expect(result.violations[0]?.severity).toBe("fail");
      expect(result.violations[0]?.message).toContain("does not parse as ISO date");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid calendar dates (e.g. 2026-02-30)", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "feb-30-policy-v1.md", {
        "policy-id": "feb-30",
        title: "Feb 30 Policy v1",
        status: "IN FORCE",
        "next-review": "2026-02-30",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(false);
      expect(result.violations[0]?.severity).toBe("fail");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags IN FORCE policy past-due as fail", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "past-due-policy-v1.md", {
        "policy-id": "past-due-policy",
        title: "Past Due Policy v1",
        status: "IN FORCE",
        "effective-from": "2025-01-01",
        "next-review": "2026-01-01",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(false);
      expect(result.violations[0]?.severity).toBe("fail");
      expect(result.violations[0]?.message).toContain("IN FORCE policy past due");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags DRAFT policy past-due as warn (not fail)", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "draft-past-due-policy-v1.md", {
        "policy-id": "draft-past-due",
        title: "Draft Past Due Policy v1",
        status: "DRAFT",
        date: "2025-01-01",
        "next-review": "2026-01-01",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(true); // warn does not flip ok
      expect(result.violations.length).toBe(1);
      expect(result.violations[0]?.severity).toBe("warn");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats ACTIVE policy past-due as warn (same tier as DRAFT)", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "active-past-due-v1.md", {
        "policy-id": "active-past-due",
        title: "Active Past Due v1",
        status: "ACTIVE",
        date: "2025-01-01",
        "next-review": "2026-01-01",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(true);
      expect(result.violations[0]?.severity).toBe("warn");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exempts SUPERSEDED policies from past-due enforcement", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "superseded-policy-v1.md", {
        "policy-id": "superseded-policy",
        title: "Superseded Policy v1",
        status: "SUPERSEDED",
        "effective-from": "2024-01-01",
        "next-review": "2025-01-01",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(true);
      expect(result.violations.length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes a future-dated IN FORCE policy", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "future-policy-v1.md", {
        "policy-id": "future-policy",
        title: "Future Policy v1",
        status: "IN FORCE",
        "effective-from": "2026-05-13",
        "next-review": "2027-05-13",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(true);
      expect(result.violations.length).toBe(0);
      expect(result.asserted).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags a file with no frontmatter block", () => {
    const dir = mkPoliciesDir();
    try {
      writeFileSync(resolve(dir, "no-frontmatter-v1.md"), "# Just a body, no frontmatter\n");
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(false);
      expect(result.violations[0]?.message).toContain("no YAML frontmatter");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns on unknown lifecycle status when next-review is past-due", () => {
    const dir = mkPoliciesDir();
    try {
      writePolicy(dir, "weird-status-v1.md", {
        "policy-id": "weird-status",
        title: "Weird Status v1",
        status: "ARCHIVED",
        "effective-from": "2025-01-01",
        "next-review": "2026-01-01",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.ok).toBe(true);
      expect(result.violations[0]?.severity).toBe("warn");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips README.md from the scan", () => {
    const dir = mkPoliciesDir();
    try {
      writeFileSync(resolve(dir, "README.md"), "# Readme — no frontmatter\n");
      writePolicy(dir, "good-policy-v1.md", {
        "policy-id": "good-policy",
        title: "Good Policy v1",
        status: "IN FORCE",
        "effective-from": "2026-05-21",
        "next-review": "2027-05-21",
      });
      const result = runPolicyNextReviewRecon("/unused", {
        nowIso: "2026-05-21T00:00:00Z",
        policiesDirOverride: dir,
      });
      expect(result.asserted).toBe(1); // README skipped
      expect(result.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
