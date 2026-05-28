// tests/recon-procedure-actor.test.ts
//
// Tests for the procedure-actor recon pipeline (Vera Wave-4 #12).
//
// Smoke: run over missing directory → graceful skip.
// Synthetic: feed controlled procedure content and verify dangling actor
// detection logic.
//
// Author: Vera (Internal audit engineer, governance) — Wave-4 #12

import { describe, expect, it } from "bun:test";

import { runProcedureActorRecon } from "../platform/recon/procedure-actor";

const FAKE_REPO_ROOT = "/nonexistent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProc(content: string): ReadonlyArray<readonly [string, string]> {
  return [["/fake/Procedures/by-policy/test-procedure.md", content] as const];
}

function makeRosterEntries(entries: Array<{ name: string; role: string }>) {
  return entries;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("procedure-actor: smoke test (missing directory)", () => {
  it("returns ok: true and no violations when procedures dir is absent", () => {
    const r = runProcedureActorRecon(FAKE_REPO_ROOT, {
      procedureFiles: [],
      rosterEntries: [],
    });
    expect(r.pipeline).toBe("procedure-actor");
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });
});

describe("procedure-actor: frontmatter owner field", () => {
  it("known roster name in owner field produces no violation", () => {
    const content = `---
owner: Zara (Chief Compliance Officer, governance)
---

# Test Procedure
`;
    const r = runProcedureActorRecon(FAKE_REPO_ROOT, {
      procedureFiles: makeProc(content),
      rosterEntries: makeRosterEntries([{ name: "Zara", role: "Chief Compliance Officer" }]),
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("unknown actor in owner field produces a warn violation", () => {
    const content = `---
owner: Mxyzptlk (Unknown Role)
---

# Test Procedure
`;
    const r = runProcedureActorRecon(FAKE_REPO_ROOT, {
      procedureFiles: makeProc(content),
      rosterEntries: makeRosterEntries([{ name: "Zara", role: "Chief Compliance Officer" }]),
    });
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("Mxyzptlk");
    // Advisory: ok remains true with only warn violations
    expect(r.ok).toBe(true);
  });
});

describe("procedure-actor: step-table actor column", () => {
  it("known actor in step-table actor column produces no violation", () => {
    const content = `---
owner: Owen (Company Secretary)
---

# Steps

| Step | Description | Actor | Capability | Event |
|---|---|---|---|---|
| 1 | Do thing | Owen | cap:xyz | EventA |
| 2 | Review | CEO | cap:abc | EventB |
`;
    const r = runProcedureActorRecon(FAKE_REPO_ROOT, {
      procedureFiles: makeProc(content),
      rosterEntries: makeRosterEntries([{ name: "Owen", role: "Company Secretary" }]),
    });
    expect(r.ok).toBe(true);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
  });

  it("unknown actor in step-table produces a warn violation", () => {
    const content = `---
owner: Owen (Company Secretary)
---

# Steps

| Step | Description | Actor | Capability | Event |
|---|---|---|---|---|
| 1 | Do thing | Mxyzptlk | cap:xyz | EventA |
`;
    const r = runProcedureActorRecon(FAKE_REPO_ROOT, {
      procedureFiles: makeProc(content),
      rosterEntries: makeRosterEntries([{ name: "Owen", role: "Company Secretary" }]),
    });
    const mxyzViolations = r.violations.filter((v) => v.message.includes("Mxyzptlk"));
    expect(mxyzViolations.length).toBeGreaterThan(0);
    expect(mxyzViolations[0]?.severity).toBe("warn");
    expect(r.ok).toBe(true);
  });
});

describe("procedure-actor: position synonyms always resolve", () => {
  it("CEO, CFO, CRO resolve without roster entries", () => {
    const content = `---
owner: CEO
---

| Step | Description | Actor | Capability | Event |
|---|---|---|---|---|
| 1 | Sign off | CFO | cap:approve | DecisionApproved |
| 2 | Attest | CRO | cap:risk | RiskAttested |
`;
    const r = runProcedureActorRecon(FAKE_REPO_ROOT, {
      procedureFiles: makeProc(content),
      rosterEntries: [],
    });
    expect(r.ok).toBe(true);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
  });
});

describe("procedure-actor: procedure with no actor references", () => {
  it("procedure with no owner fields produces no violations", () => {
    const content = `# Untitled Procedure

This procedure has no owner fields or step tables yet.
`;
    const r = runProcedureActorRecon(FAKE_REPO_ROOT, {
      procedureFiles: makeProc(content),
      rosterEntries: [],
    });
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
