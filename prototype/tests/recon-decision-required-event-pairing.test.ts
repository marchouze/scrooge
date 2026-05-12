// tests/recon-decision-required-event-pairing.test.ts
//
// Unit tests for the F-033 decision-required → CeoDecision event
// pairing recon (platform/recon/decision-required-event-pairing.ts).
//
// F-033: every Owner Inbox/actioned/ file with decision-required: true
// and a decision-id frontmatter field must have a terminal CeoDecision
// event (action ∈ {approve, reject}) in the event store.
//
// Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
// Author: Vera (Internal audit engineer, third-line)

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run } from "../platform/recon/decision-required-event-pairing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshInbox(): string {
  return mkdtempSync(join(tmpdir(), "bank-recon-drep-"));
}

/**
 * Write a markdown file with YAML frontmatter.
 * `decisionRequired` and `decisionId` match the F-033 frontmatter convention.
 */
function writeSpec(
  dir: string,
  filename: string,
  opts: {
    decisionRequired?: boolean;
    decisionId?: string;
    extraFrontmatter?: string;
  } = {},
): void {
  const { decisionRequired = true, decisionId, extraFrontmatter = "" } = opts;
  const lines: string[] = [
    "---",
    `title: Test spec — ${filename}`,
    `decision-required: ${decisionRequired}`,
  ];
  if (decisionId !== undefined) {
    lines.push(`decision-id: ${decisionId}`);
  }
  if (extraFrontmatter) {
    lines.push(extraFrontmatter);
  }
  lines.push("---", "", "# Body");
  writeFileSync(join(dir, filename), lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("decision-required → CeoDecision event pairing recon (F-033)", () => {
  it("passes with info only on a fresh runner (empty store, forceEmptyStore)", () => {
    const dir = freshInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeSpec(actionedDir, "2026-05-09_owen_spec.md", {
      decisionRequired: true,
      decisionId: "D-TEST-FRESH",
    });
    const r = run({
      ownerInboxDir: dir,
      forceEmptyStore: true,
    });
    expect(r.pipeline).toBe("decision-required-event-pairing");
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("info");
    expect(r.violations[0]?.subject).toBe("decision-required-event-pairing:store-empty");
  });

  it("fails when an actioned file has decision-required+decision-id but no terminal event", () => {
    const dir = freshInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeSpec(actionedDir, "2026-05-09_owen_no-event.md", {
      decisionRequired: true,
      decisionId: "D-MISSING-EVENT",
    });
    // terminalIds has an unrelated ID so store is treated as non-empty.
    const r = run({
      ownerInboxDir: dir,
      terminalIds: new Set(["D-OTHER"]),
    });
    expect(r.ok).toBe(false);
    const fail = r.violations.find((v) => v.severity === "fail" && v.subject === "D-MISSING-EVENT");
    expect(fail).toBeDefined();
    expect(fail?.message).toContain("actioned");
    expect(fail?.message).toContain("terminal");
  });

  it("passes when an actioned file has a matching terminal event (approve)", () => {
    const dir = freshInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeSpec(actionedDir, "2026-05-09_owen_approved.md", {
      decisionRequired: true,
      decisionId: "D-APPROVED",
    });
    const r = run({
      ownerInboxDir: dir,
      terminalIds: new Set(["D-APPROVED"]),
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("passes when an actioned file has a matching terminal event (reject)", () => {
    const dir = freshInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeSpec(actionedDir, "2026-05-09_owen_rejected.md", {
      decisionRequired: true,
      decisionId: "D-REJECTED",
    });
    const r = run({
      ownerInboxDir: dir,
      terminalIds: new Set(["D-REJECTED"]),
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("emits advisory (info) for actioned file with decision-required but no decision-id", () => {
    const dir = freshInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeSpec(actionedDir, "2026-05-06_old-format.md", {
      decisionRequired: true,
      // no decisionId — older file that predates the convention
    });
    const r = run({
      ownerInboxDir: dir,
      terminalIds: new Set(["D-SOMETHING-ELSE"]),
    });
    // Should not be a fail — advisory only.
    expect(r.ok).toBe(true);
    const advisory = r.violations.find(
      (v) => v.severity === "info" && v.subject === "2026-05-06_old-format.md",
    );
    expect(advisory).toBeDefined();
    expect(advisory?.message).toContain("no `decision-id`");
  });

  it("does NOT flag files with decision-required: false", () => {
    const dir = freshInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeSpec(actionedDir, "2026-05-09_not-required.md", {
      decisionRequired: false,
      decisionId: "D-NOT-REQUIRED",
    });
    const r = run({
      ownerInboxDir: dir,
      terminalIds: new Set(), // no terminal events
      forceEmptyStore: false,
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("surfaces open Owner Inbox/ files as INFO (not fail)", () => {
    const dir = freshInbox();
    // Open file in root (not actioned/)
    writeSpec(dir, "2026-05-12_open-spec.md", {
      decisionRequired: true,
      decisionId: "D-OPEN",
    });
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    const r = run({
      ownerInboxDir: dir,
      terminalIds: new Set(["D-OTHER"]), // store non-empty, D-OPEN not in it
    });
    // Open decisions are NOT violations.
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    const info = r.violations.find((v) => v.severity === "info" && v.subject === "D-OPEN");
    expect(info).toBeDefined();
    expect(info?.message).toContain("OPEN decision");
  });

  it("handles multiple actioned files: passes all, fails some", () => {
    const dir = freshInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeSpec(actionedDir, "2026-05-09_one.md", {
      decisionRequired: true,
      decisionId: "D-ONE",
    });
    writeSpec(actionedDir, "2026-05-09_two.md", {
      decisionRequired: true,
      decisionId: "D-TWO",
    });
    writeSpec(actionedDir, "2026-05-09_three.md", {
      decisionRequired: true,
      decisionId: "D-THREE",
    });
    // D-ONE and D-THREE have terminal events; D-TWO does not.
    const r = run({
      ownerInboxDir: dir,
      terminalIds: new Set(["D-ONE", "D-THREE"]),
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(1);
    expect(fails[0]?.subject).toBe("D-TWO");
  });

  it("correctly counts asserted decisions (excludes no-decision-id advisories)", () => {
    const dir = freshInbox();
    const actionedDir = join(dir, "actioned");
    mkdirSync(actionedDir);
    writeSpec(actionedDir, "2026-05-09_with-id.md", {
      decisionRequired: true,
      decisionId: "D-WITH-ID",
    });
    writeSpec(actionedDir, "2026-05-06_without-id.md", {
      decisionRequired: true,
      // no decisionId
    });
    const r = run({
      ownerInboxDir: dir,
      terminalIds: new Set(["D-WITH-ID"]),
    });
    expect(r.ok).toBe(true);
    // Only the file with a decision-id increments asserted.
    expect(r.asserted).toBe(1);
  });
});
