// tests/recon-agent-spec.test.ts
//
// Tests for the agent-spec-integrity recon (Vera Wave-4 #10).
//
// Smoke test: run the pipeline against the live `/Team/` and assert that
// it returns a typed `ReconResult` shape — and reports the integrity
// state (which must be `ok` once all 28 personas are upgraded; the
// pipeline is the operational signal if any backslide).
//
// Synthetic tests: feed the assertion known-malformed specs (missing
// §10, missing §17) and assert the violations list contains the
// expected per-section findings.
//
// Author: Vera

import { describe, expect, it } from "bun:test";

import { run as agentSpecRun, assertSpecs } from "../platform/recon/agent-spec";

describe("agent-spec-integrity pipeline", () => {
  it("runs over the live /Team/ directory and returns a typed result", () => {
    const r = agentSpecRun();
    expect(r.pipeline).toBe("agent-spec-integrity");
    expect(typeof r.asserted).toBe("number");
    expect(r.asserted).toBeGreaterThanOrEqual(27);
    expect(Array.isArray(r.violations)).toBe(true);
    // The live state must be green per Principle 7 ("persona files default
    // to agent-spec form"). If this assertion fails it is a *real* finding
    // — investigate the persona file rather than weaken the test.
    expect(r.ok).toBe(true);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
  });
});

const VALID_SPEC = `# Test — Test role

## 1. Identity

- **Name:** Test
- **Role:** Test role
- **Reports to:** CEO
- **Coordinated by:** Scrooge

## 2. Persona

A test persona used by recon-agent-spec.test.ts.

## 3. Mandate

Owns nothing in production; exists only to exercise the recon pipeline.

## 4. Areas of expertise

- Recon-pipeline test fixtures.

## 5. Working style

- Deterministic.

## 6. Cadence

- **Mode:** Scheduled.
- **Schedule:** Never (test fixture).
- **Inactivity SLA:** Nil.

## 7. Triggers

| Trigger | Source | Response SLA |
|---|---|---|
| \`SyntheticTest\` | test harness | nil |

## 8. Inputs

- **Authoritative:** none.
- **Derived:** none.
- **External:** none.

## 9. Decisions in scope

| Decision | Criteria | Output |
|---|---|---|
| Pass the test | \`assertSpecs\` returns ok | n/a |

## 10. Decisions that escalate

| Decision | Escalation criterion | Target | Channel | Deadline |
|---|---|---|---|---|
| Test failure | any | Vera | event | immediate |

## 11. Outputs

- **Events emitted:** none.
- **Registers maintained:** none.
- **Deliverables:** none.

## 12. System capabilities called

- \`@platform/recon/agent-spec.ts\` — exercised by this fixture.

## 13. Procedures owned

- none — this fixture is purely synthetic and owns no real procedures.

## 14. Data contracts

- **Produces:** nothing — fixture only exists to exercise the recon assertions.
- **Consumes:** nothing — pure synthetic spec under \`/tmp\`, never registered.

## 15. Independence / conflicts

Pure test fixture; no real-world conflicts. Used exclusively by the
\`recon-agent-spec.test.ts\` smoke and synthetic-malformation suites.

## 16. Substrate gaps (current state)

- No real substrate is invoked; this fixture exists only inside the
  bun-test harness and never reaches the runtime registry.

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-08 | Vera | Initial fixture. |
`;

/** Strip a section by its numbered heading (§N) and its body. */
function stripSection(content: string, num: number): string {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let skipping = false;
  const headerRe = new RegExp(`^##\\s+${num}\\.\\s+`);
  for (const line of lines) {
    if (skipping) {
      if (/^##\s/.test(line) && !headerRe.test(line)) {
        skipping = false;
      } else {
        continue;
      }
    }
    if (headerRe.test(line)) {
      skipping = true;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

describe("agent-spec-integrity — synthetic malformations", () => {
  it("flags a missing § 10 (Decisions that escalate)", () => {
    const malformed = stripSection(VALID_SPEC, 10);
    const r = assertSpecs({ specs: [["/tmp/Test.md", malformed]] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" && v.message.includes("missing § 10 (Decisions that escalate)"),
      ),
    ).toBe(true);
  });

  it("flags a missing § 17 (Change log)", () => {
    const malformed = stripSection(VALID_SPEC, 17);
    const r = assertSpecs({ specs: [["/tmp/Test.md", malformed]] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.message.includes("missing § 17 (Change log)"),
      ),
    ).toBe(true);
  });

  it("passes the valid synthetic spec end-to-end", () => {
    const r = assertSpecs({ specs: [["/tmp/Test.md", VALID_SPEC]] });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.asserted).toBe(1);
  });

  it("flags an empty change-log table even when the heading is present", () => {
    // Replace the change-log data row with just the header + separator.
    const noRows = VALID_SPEC.replace(
      /\| v1\.0 \| 2026-05-08 \| Vera \| Initial fixture\. \|\n/,
      "",
    );
    const r = assertSpecs({ specs: [["/tmp/Test.md", noRows]] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.message.includes("§ 17 (Change log) has no data rows"),
      ),
    ).toBe(true);
  });

  it("flags an H1 that does not match the filename stem", () => {
    const wrongH1 = VALID_SPEC.replace(/^# Test — Test role/, "# WrongName — Test role");
    const r = assertSpecs({ specs: [["/tmp/Test.md", wrongH1]] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.message.includes("does not match filename stem"),
      ),
    ).toBe(true);
  });

  it("flags § 1 Identity with no parseable Reports to", () => {
    const noReportsTo = VALID_SPEC.replace(/- \*\*Reports to:\*\* CEO\n/, "");
    const r = assertSpecs({ specs: [["/tmp/Test.md", noReportsTo]] });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "fail" &&
          v.message.includes("§ 1 Identity has no parseable **Reports to:** bullet"),
      ),
    ).toBe(true);
  });

  it("tolerates annotated section labels (e.g. Scrooge-style elaborations)", () => {
    // Replace `## 10. Decisions that escalate` with the elaborated form
    // Scrooge.md uses in production.
    const annotated = VALID_SPEC.replace(
      /^## 10\. Decisions that escalate$/m,
      "## 10. Decisions that escalate (to CEO)",
    );
    const r = assertSpecs({ specs: [["/tmp/Test.md", annotated]] });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });
});
