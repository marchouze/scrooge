// tests/recon-agent-spec-cross-link.test.ts
//
// Tests for the agent-spec-cross-link recon (Vera Wave-4 #10 — graph layer).
//
// The pipeline asserts the cross-link integrity of §10 / §12 / §13 in
// every persona file: escalation targets resolve to a recognised
// overseer; capability paths resolve under prototype/platform/; procedure
// paths resolve under /Procedures/. Roadmap markers ("(planned)",
// "[substrate-gap: ...]", "(gated on ...)") exempt a bullet from
// resolution.
//
// Smoke test: runs over the live /Team/ directory and confirms the
// pipeline returns a typed `ReconResult` with `ok: true` (warn-severity
// findings do not red-line the run; the structural recon is the prior
// gate).
//
// Synthetic tests: feed the assertion known specs with controlled
// procedure / capability indices and assert the violation set matches
// what the design intends (resolve / fail / exempt / chained-overseer).
//
// Author: Vera

import { describe, expect, it } from "bun:test";

import { assertCrossLinks, run as crossLinkRun } from "../platform/recon/agent-spec-cross-link";

describe("agent-spec-cross-link pipeline", () => {
  it("runs over the live /Team/ directory and returns a typed result", () => {
    const r = crossLinkRun();
    expect(r.pipeline).toBe("agent-spec-cross-link");
    expect(typeof r.asserted).toBe("number");
    expect(r.asserted).toBeGreaterThanOrEqual(27);
    expect(Array.isArray(r.violations)).toBe(true);
    // Live state: warn-severity findings only — `ok` must remain true.
    // Today's persona corpus pre-dates strict resolution discipline;
    // surfacing the warn count is the controls signal, not blocking CI.
    expect(r.ok).toBe(true);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    // Every violation is warn-severity until the corpus is groomed and
    // the pipeline lifts to fail at Wave-4 #10 closure.
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
  });
});

const VALID_SPEC_TEMPLATE = (
  procPath: string,
  capPath: string,
  overseer: string,
) => `# Test — Test role

## 1. Identity

- **Name:** Test
- **Role:** Test role
- **Reports to:** CEO
- **Coordinated by:** Scrooge

## 2. Persona

A test persona.

## 3. Mandate

Owns nothing in production.

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
| Pass the test | recon returns ok | n/a |

## 10. Decisions that escalate

| Decision | Escalation criterion | Target overseer | Channel | Deadline |
|---|---|---|---|---|
| Test failure | any | ${overseer} | event | immediate |

## 11. Outputs

- **Events emitted:** none.
- **Registers maintained:** none.
- **Deliverables:** none.

## 12. System capabilities called

- \`${capPath}\` — test capability reference.

## 13. Procedures owned

- \`${procPath}\` — owner.

## 14. Data contracts

- **Produces:** nothing.
- **Consumes:** nothing.

## 15. Independence / conflicts

Pure test fixture.

## 16. Substrate gaps (current state)

- None — synthetic.

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-09 | Vera | Initial fixture. |
`;

describe("agent-spec-cross-link — synthetic resolution cases", () => {
  // Common knobs used across the synthetic cases. The procedure index
  // and capability resolver are the test's ground truth — they declare
  // exactly which references should resolve and which should not.
  const procedureIndex = new Set(["Procedures/by-policy/known-procedure.md"]);
  const capabilityResolves = (ref: string) => ref === "@platform/known-cap";
  const teamRoster = new Set(["thandiwe", "owen", "marc", "scrooge"]);

  it("passes when §10 / §12 / §13 all resolve cleanly", () => {
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/known-procedure.md",
      "@platform/known-cap",
      "Thandiwe (CAE)",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.asserted).toBe(1);
  });

  it("flags an unresolved §13 procedure path with no roadmap marker", () => {
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/missing-procedure.md",
      "@platform/known-cap",
      "Thandiwe",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    expect(r.ok).toBe(true); // warn-severity, not fail
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("§ 13");
    expect(r.violations[0]?.message).toContain("missing-procedure.md");
  });

  it("exempts a §13 procedure bullet flagged (planned)", () => {
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/missing-procedure.md` — owner (planned)",
      "@platform/known-cap",
      "Thandiwe",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    // Exempt — no §13 finding.
    expect(r.violations.filter((v) => v.message.includes("§ 13"))).toEqual([]);
  });

  it("flags an unresolved §12 capability with no roadmap marker", () => {
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/known-procedure.md",
      "@platform/missing-cap",
      "Thandiwe",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("§ 12");
    expect(r.violations[0]?.message).toContain("@platform/missing-cap");
  });

  it("exempts a §12 capability bullet flagged [substrate-gap: ...]", () => {
    // Inject the marker directly into the bullet line.
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/known-procedure.md",
      "@platform/missing-cap` — [substrate-gap: M2",
      "Thandiwe",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    expect(r.violations.filter((v) => v.message.includes("§ 12"))).toEqual([]);
  });

  it("resolves a §10 escalation that names Marc (CEO)", () => {
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/known-procedure.md",
      "@platform/known-cap",
      "Marc (CEO)",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    expect(r.violations.filter((v) => v.message.includes("§ 10"))).toEqual([]);
  });

  it("resolves a §10 escalation with prose annotations alongside a known name", () => {
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/known-procedure.md",
      "@platform/known-cap",
      "Thandiwe (CAE) — independent review; PA path lit if regulatory",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    expect(r.violations.filter((v) => v.message.includes("§ 10"))).toEqual([]);
  });

  it("flags a §10 escalation with no resolvable overseer", () => {
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/known-procedure.md",
      "@platform/known-cap",
      "external counsel via partner",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.message).toContain("§ 10");
    expect(r.violations[0]?.message).toContain("external counsel via partner");
  });

  it("resolves a §10 escalation that names a recognised corporate body (Board)", () => {
    const spec = VALID_SPEC_TEMPLATE(
      "Procedures/by-policy/known-procedure.md",
      "@platform/known-cap",
      "Board (when constituted)",
    );
    const r = assertCrossLinks({
      specs: [["/tmp/Test.md", spec]],
      procedureIndex,
      capabilityResolves,
      teamRoster,
    });
    expect(r.violations.filter((v) => v.message.includes("§ 10"))).toEqual([]);
  });
});
