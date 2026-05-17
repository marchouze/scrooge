// platform/recon/decision-record-event-symmetry.test.ts
//
// Tests for the Vera Wave-6 `decision-record-event-symmetry` recon pipeline
// (advisory mode).
//
// Coverage:
//   (a) Closed decision record WITH a backing event → no finding.
//   (b) Closed decision record WITHOUT a backing event → warn finding (advisory).
//   (c) Open decision record (decision-required: true) → info note, no warn/fail.
//   (d) File with no `decision-required` field → ignored (not a decision record).
//   (e) Decision ID extracted from frontmatter `decisionId:` field.
//   (f) Decision ID extracted from body text.
//   (g) Advisory mode always returns ok: true.
//   (h) Enforcing mode returns ok: false when a missing event is found.
//   (i) Fresh-runner / empty-store posture → info only, ok: true.
//   (j) Live-corpus smoke test: asserted > 0, ok: true.
//
// Author: Vera (Internal audit engineer, third-line — functionally to
//         Thandiwe (Chief Audit Executive, governance); administratively
//         through the CEO).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { run } from "./decision-record-event-symmetry";

// ---------------------------------------------------------------------------
// Test fixture helpers.
// ---------------------------------------------------------------------------

/** Temporary inbox directory created per test and cleaned up after. */
let tmpDir: string;

beforeEach(() => {
  tmpDir = resolve(import.meta.dir, `__tmp-inbox-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

function writeInboxFile(name: string, content: string): void {
  writeFileSync(join(tmpDir, name), content, "utf8");
}

function closedRecord(id: string): string {
  return [
    "---",
    `title: CEO Decision Record ${id}`,
    "author: Scrooge",
    "date: 2026-05-12",
    "decision-required: false",
    "---",
    "",
    `# ${id}`,
    "",
    `The decision **${id}** was approved by the CEO.`,
  ].join("\n");
}

function openRecord(id: string): string {
  return [
    "---",
    `title: CEO Decision Record ${id}`,
    "author: Scrooge",
    "date: 2026-05-12",
    "decision-required: true",
    "---",
    "",
    `# ${id}`,
  ].join("\n");
}

function noDecisionField(): string {
  return [
    "---",
    "title: Some Agent Deliverable",
    "author: Atlas",
    "date: 2026-05-12",
    "---",
    "",
    "# body",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe("decision-record-event-symmetry recon (Vera Wave-6, advisory mode)", () => {
  it("(a) closed record with backing event → no finding", () => {
    writeInboxFile("2026-05-12_test_decision.md", closedRecord("D-TEST-ALPHA"));
    const r = run({
      ownerInboxDir: tmpDir,
      eventDecisionIds: new Set(["D-TEST-ALPHA"]),
    });
    expect(r.pipeline).toBe("decision-record-event-symmetry");
    expect(r.asserted).toBe(1);
    const warnsFails = r.violations.filter((v) => v.severity === "warn" || v.severity === "fail");
    expect(warnsFails).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("(b) closed record WITHOUT backing event → warn finding in advisory mode", () => {
    writeInboxFile("2026-05-12_test_decision.md", closedRecord("D-TEST-BETA"));
    // Provide a non-empty event store (a different decision ID) so the pipeline
    // does not take the empty-store / fresh-runner path. D-TEST-BETA is absent.
    const r = run({
      ownerInboxDir: tmpDir,
      eventDecisionIds: new Set(["D-SOME-OTHER-DECISION"]),
    });
    expect(r.asserted).toBe(1);
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.length).toBe(1);
    expect(warns[0]?.message).toContain("D-TEST-BETA");
    expect(warns[0]?.message).toContain("no backing `Decision` (or legacy `CeoDecision`) event");
    expect(r.ok).toBe(true); // advisory — ok stays true
  });

  it("(c) open record → info note, no warn/fail", () => {
    writeInboxFile("2026-05-12_open_decision.md", openRecord("D-TEST-GAMMA"));
    const r = run({
      ownerInboxDir: tmpDir,
      eventDecisionIds: new Set(["D-SOMETHING-ELSE"]),
    });
    expect(r.asserted).toBe(1);
    const warnsFails = r.violations.filter((v) => v.severity === "warn" || v.severity === "fail");
    expect(warnsFails).toEqual([]);
    const infos = r.violations.filter((v) => v.severity === "info");
    expect(infos.length).toBe(1);
    expect(infos[0]?.message).toContain("D-TEST-GAMMA");
    expect(infos[0]?.message).toContain("still open");
    expect(r.ok).toBe(true);
  });

  it("(d) file with no decision-required field → ignored", () => {
    writeInboxFile("2026-05-12_agent-output.md", noDecisionField());
    const r = run({
      ownerInboxDir: tmpDir,
      eventDecisionIds: new Set(),
    });
    expect(r.asserted).toBe(0);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("(e) decision ID extracted from frontmatter decisionId: field", () => {
    const content = [
      "---",
      "title: CEO Decision",
      "author: Scrooge",
      "decision-required: false",
      "decisionId: D-FROM-FRONTMATTER",
      "---",
      "",
      "# body without explicit ID in text",
    ].join("\n");
    writeInboxFile("2026-05-12_frontmatter-id.md", content);
    const r = run({
      ownerInboxDir: tmpDir,
      eventDecisionIds: new Set(["D-FROM-FRONTMATTER"]),
    });
    expect(r.asserted).toBe(1);
    const warnsFails = r.violations.filter((v) => v.severity !== "info");
    expect(warnsFails).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("(f) decision ID extracted from body text when not in frontmatter", () => {
    const content = [
      "---",
      "title: CEO Decision",
      "author: Scrooge",
      "decision-required: false",
      "---",
      "",
      "# CEO decision record: D-FROM-BODY",
      "",
      "The decision D-FROM-BODY was approved.",
    ].join("\n");
    writeInboxFile("2026-05-12_body-id.md", content);
    const r = run({
      ownerInboxDir: tmpDir,
      eventDecisionIds: new Set(["D-FROM-BODY"]),
    });
    expect(r.asserted).toBe(1);
    const warnsFails = r.violations.filter((v) => v.severity !== "info");
    expect(warnsFails).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("(g) advisory mode always returns ok: true even with warn findings", () => {
    writeInboxFile("2026-05-12_missing-event.md", closedRecord("D-TEST-DELTA"));
    const r = run({
      ownerInboxDir: tmpDir,
      eventDecisionIds: new Set(["D-UNRELATED"]),
      mode: "advisory",
    });
    expect(r.ok).toBe(true);
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.length).toBe(1);
  });

  it("(h) enforcing mode returns ok: false when missing event found", () => {
    writeInboxFile("2026-05-12_missing-event.md", closedRecord("D-TEST-EPSILON"));
    const r = run({
      ownerInboxDir: tmpDir,
      eventDecisionIds: new Set(["D-UNRELATED"]),
      mode: "enforcing",
    });
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.length).toBe(1);
    expect(fails[0]?.message).toContain("D-TEST-EPSILON");
  });

  it("(i) fresh-runner / empty-store posture → info only, ok: true", () => {
    writeInboxFile("2026-05-12_closed.md", closedRecord("D-TEST-ZETA"));
    const r = run({
      ownerInboxDir: tmpDir,
      forceEmptyStore: true,
    });
    expect(r.asserted).toBe(1);
    const warnsFails = r.violations.filter((v) => v.severity === "warn" || v.severity === "fail");
    expect(warnsFails).toEqual([]);
    const infos = r.violations.filter((v) => v.severity === "info");
    expect(infos.length).toBe(1);
    expect(infos[0]?.message).toContain("fresh-runner");
    expect(r.ok).toBe(true);
  });

  it("(j) live-corpus smoke test: asserted > 0, ok: true (advisory mode)", () => {
    // Run against the real Owner Inbox. The event store may or may not be
    // present (CI / fresh runner). Advisory mode guarantees ok: true.
    const r = run();
    console.log(
      `decision-record-event-symmetry live run: asserted=${r.asserted} ` +
        `violations=${r.violations.length} ` +
        `(warns=${r.violations.filter((v) => v.severity === "warn").length}, ` +
        `infos=${r.violations.filter((v) => v.severity === "info").length})`,
    );
    expect(r.pipeline).toBe("decision-record-event-symmetry");
    expect(r.asserted).toBeGreaterThan(0);
    // No fail-severity findings in advisory mode.
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
