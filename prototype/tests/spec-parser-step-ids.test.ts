// tests/spec-parser-step-ids.test.ts
//
// Unit tests for the §13 step-ID extension to the spec-parser.
//
// Coverage:
//   - `makeStepId`: slug derivation from procedure paths and anchor IDs.
//   - Inline parsing: a procedure file with anchors returns correct step IDs.
//   - Pre-backfill: a procedure file with no anchors returns `stepIds: []`.
//   - Missing file: a procedure path pointing to a non-existent file returns
//     `stepIds: []` without crashing.
//   - Duplicate anchors: deduplicated in input order.
//   - `parseSpecContent`: `procedureSteps` aligns 1-to-1 with `proceduresOwned`.
//   - `ProcedureCitation`: exported interface — shape-check via TypeScript compile.
//
// Per `Procedures/_step-id-convention.md` (D-AGENT-AUTONOMY-OPERATIONAL
// Slice 3 prerequisite): step IDs have the form `<slug>:<step-key>` where
// `<slug>` is the procedure basename without `.md`.
//
// Author: Atlas (Core banking platform architect)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type ProcedureCitation,
  makeStepId,
  parseSpecContent,
} from "../platform/agent-runtime/spec-parser";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid persona spec for use in parseSpecContent tests. */
function makeValidSpec(procedurePaths: string[]): string {
  const proceduresBullets =
    procedurePaths.length === 0 ? "- none." : procedurePaths.map((p) => `- \`${p}\``).join("\n");

  return `# Test — Step-ID test persona

## 1. Identity

- **Name:** Test
- **Role:** Step-ID test persona
- **Reports to:** CEO
- **Coordinated by:** Scrooge

## 2. Persona

Synthetic persona used by spec-parser-step-ids.test.ts.

## 3. Mandate

Owns nothing in production; exists only to exercise step-ID extraction.

## 4. Areas of expertise

- Step-ID extraction.

## 5. Working style

- Deterministic.

## 6. Cadence

- **Mode:** Scheduled.
- **Schedule:** Never (test fixture).
- **Inactivity SLA:** Nil.

## 7. Triggers

| Trigger | Source | Response SLA |
|---|---|---|
| \`StepIdTest\` | test harness | nil |

## 8. Inputs

- **Authoritative:** none.
- **Derived:** none.
- **External:** none.

## 9. Decisions in scope

| Decision | Criteria | Output |
|---|---|---|
| Pass | anchors parsed | n/a |

## 10. Decisions that escalate

| Decision | Escalation criterion | Target | Channel | Deadline |
|---|---|---|---|---|
| Test failure | any | Vera | event | immediate |

## 11. Outputs

- **Events emitted:** none.
- **Registers maintained:** none.
- **Deliverables:** none.

## 12. System capabilities called

- \`@platform/agent-runtime/spec-parser.ts\` — under test.

## 13. Procedures owned

${proceduresBullets}

## 14. Data contracts

- **Produces:** nothing.
- **Consumes:** nothing.

## 15. Independence / conflicts

None.

## 16. Substrate gaps (current state)

None applicable.

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-11 | Atlas (Core banking platform architect) | Initial test fixture for step-ID extraction. |
`;
}

/** Procedure file content WITH step anchors in §5. */
const PROCEDURE_WITH_ANCHORS = `# Kyc Onboarding

## 1. Purpose

Test procedure with step anchors.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| <a id="step-1">1</a> | Receive application | \`agent\` | \`@platform/event-store\` | Trigger point. |
| <a id="step-2">2</a> | Screen identity | \`agent\` | \`@platform/kyc\` | AML gate. |
| <a id="step-3">3</a> | Approve or reject | \`agent\` | \`@platform/decisions\` | Binary outcome. |
| <a id="step-8a">8a</a> | Accept path | \`agent\` | \`@platform/event-store\` | Branch: accept. |
| <a id="step-8b">8b</a> | Reject path | \`agent\` | \`@platform/event-store\` | Branch: reject. |
`;

/** Procedure file content WITHOUT any step anchors (pre-backfill). */
const PROCEDURE_WITHOUT_ANCHORS = `# Capital Ratio Monitoring

## 1. Purpose

Test procedure without step anchors (pre-backfill).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Check ratio | \`agent\` | \`@platform/ba-100\` | Daily check. |
| 2 | Alert if breached | \`agent\` | \`@platform/escalation\` | Threshold alert. |
`;

/** Procedure file content with duplicate anchor IDs (invalid, but must be handled). */
const PROCEDURE_WITH_DUPLICATE_ANCHORS = `# Duplicate Test

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| <a id="step-1">1</a> | First step | \`agent\` | \`@platform/x\` | |
| <a id="step-1">1</a> | Duplicate step | \`agent\` | \`@platform/x\` | duplicate id. |
| <a id="step-2">2</a> | Second step | \`agent\` | \`@platform/x\` | |
`;

// ---------------------------------------------------------------------------
// Temp-directory scaffolding
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "spec-parser-step-id-test-"));
  // Create directory structure that mimics a real repo layout:
  //   <tmpRoot>/Team/         ← persona spec files live here
  //   <tmpRoot>/Procedures/by-policy/  ← procedure files
  mkdirSync(join(tmpRoot, "Team"));
  mkdirSync(join(tmpRoot, "Procedures", "by-policy"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

/** Write a procedure file into the temp tree and return the repo-relative path. */
function writeProcedure(filename: string, content: string): string {
  const relPath = `Procedures/by-policy/${filename}`;
  writeFileSync(join(tmpRoot, relPath), content, "utf8");
  return relPath;
}

/** Derive the synthetic `sourcePath` for a persona spec (Team/<Name>.md). */
function specPath(name: string): string {
  return join(tmpRoot, "Team", `${name}.md`);
}

// ---------------------------------------------------------------------------
// makeStepId — unit tests
// ---------------------------------------------------------------------------

describe("makeStepId", () => {
  it("strips directory prefix and .md extension, then concatenates slug:step-key", () => {
    expect(makeStepId("Procedures/by-policy/kyc-onboarding.md", "step-3")).toBe(
      "kyc-onboarding:step-3",
    );
  });

  it("handles a top-level procedure path (no subdirectory)", () => {
    expect(makeStepId("Procedures/margin-im.md", "step-reconcile")).toBe(
      "margin-im:step-reconcile",
    );
  });

  it("handles deeply nested path", () => {
    expect(makeStepId("Procedures/by-policy/nested/party-registration.md", "step-5")).toBe(
      "party-registration:step-5",
    );
  });

  it("handles branching step key (slug form)", () => {
    expect(makeStepId("Procedures/by-policy/kyc-onboarding.md", "step-8a")).toBe(
      "kyc-onboarding:step-8a",
    );
  });
});

// ---------------------------------------------------------------------------
// parseSpecContent — procedureSteps extraction
// ---------------------------------------------------------------------------

describe("parseSpecContent — procedureSteps", () => {
  it("returns stepIds for a procedure file with inline anchors", () => {
    const procPath = writeProcedure("kyc-onboarding.md", PROCEDURE_WITH_ANCHORS);
    const spec = makeValidSpec([procPath]);
    const result = parseSpecContent("Test", spec, specPath("Test"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.spec.proceduresOwned).toEqual([procPath]);
    expect(result.spec.procedureSteps).toHaveLength(1);

    const entry = result.spec.procedureSteps[0];
    expect(entry?.procedurePath).toBe(procPath);
    expect(entry?.stepIds).toEqual([
      "kyc-onboarding:step-1",
      "kyc-onboarding:step-2",
      "kyc-onboarding:step-3",
      "kyc-onboarding:step-8a",
      "kyc-onboarding:step-8b",
    ]);
  });

  it("returns stepIds: [] for a procedure file with no anchors (pre-backfill)", () => {
    const procPath = writeProcedure("capital-ratio-monitoring.md", PROCEDURE_WITHOUT_ANCHORS);
    const spec = makeValidSpec([procPath]);
    const result = parseSpecContent("Test", spec, specPath("Test"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = result.spec.procedureSteps[0];
    expect(entry?.stepIds).toEqual([]);
  });

  it("returns stepIds: [] for a missing procedure file (no crash)", () => {
    // Reference a procedure path that doesn't exist on disk.
    const procPath = "Procedures/by-policy/does-not-exist.md";
    const spec = makeValidSpec([procPath]);
    const result = parseSpecContent("Test", spec, specPath("Test"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.spec.procedureSteps).toHaveLength(1);
    const entry = result.spec.procedureSteps[0];
    expect(entry?.procedurePath).toBe(procPath);
    expect(entry?.stepIds).toEqual([]);
  });

  it("deduplicates duplicate anchor IDs in input order", () => {
    const procPath = writeProcedure("duplicate-test.md", PROCEDURE_WITH_DUPLICATE_ANCHORS);
    const spec = makeValidSpec([procPath]);
    const result = parseSpecContent("Test", spec, specPath("Test"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = result.spec.procedureSteps[0];
    // step-1 appeared twice; deduplicated to one entry.
    expect(entry?.stepIds).toEqual(["duplicate-test:step-1", "duplicate-test:step-2"]);
  });

  it("procedureSteps aligns 1-to-1 with proceduresOwned", () => {
    const path1 = writeProcedure("kyc-onboarding.md", PROCEDURE_WITH_ANCHORS);
    const path2 = writeProcedure("capital-ratio-monitoring.md", PROCEDURE_WITHOUT_ANCHORS);
    const spec = makeValidSpec([path1, path2]);
    const result = parseSpecContent("Test", spec, specPath("Test"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.spec.proceduresOwned).toEqual([path1, path2]);
    expect(result.spec.procedureSteps).toHaveLength(2);
    expect(result.spec.procedureSteps[0]?.procedurePath).toBe(path1);
    expect(result.spec.procedureSteps[1]?.procedurePath).toBe(path2);

    // First procedure has anchors; second does not.
    expect(result.spec.procedureSteps[0]?.stepIds.length).toBeGreaterThan(0);
    expect(result.spec.procedureSteps[1]?.stepIds).toEqual([]);
  });

  it("returns empty procedureSteps when §13 declares no procedures", () => {
    const spec = makeValidSpec([]);
    const result = parseSpecContent("Test", spec, specPath("Test"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.spec.proceduresOwned).toEqual([]);
    expect(result.spec.procedureSteps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ProcedureCitation — TypeScript type shape check (compile-time only)
// ---------------------------------------------------------------------------

// This block exists to confirm the exported interface shape matches the
// convention in `Procedures/_step-id-convention.md §4`. If the interface
// changes incompatibly, the typecheck step in `bun run ci` will catch it.

describe("ProcedureCitation interface", () => {
  it("accepts a full citation with optional stepId", () => {
    const citation: ProcedureCitation = {
      procedurePath: "Procedures/by-policy/kyc-onboarding.md",
      stepId: "kyc-onboarding:step-3",
      procedureHash: "a3f8c2deadbeef",
    };
    expect(citation.procedurePath).toBe("Procedures/by-policy/kyc-onboarding.md");
    expect(citation.stepId).toBe("kyc-onboarding:step-3");
  });

  it("accepts a citation without stepId (coverage-gap state)", () => {
    const citation: ProcedureCitation = {
      procedurePath: "Procedures/by-policy/capital-ratio-monitoring.md",
      procedureHash: "cafebabe",
    };
    expect(citation.stepId).toBeUndefined();
  });
});
