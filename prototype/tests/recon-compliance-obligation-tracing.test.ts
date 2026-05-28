// tests/recon-compliance-obligation-tracing.test.ts
//
// Tests for the compliance-obligation-tracing recon pipeline (Vera Wave-4 #13).
//
// Smoke: missing register → graceful skip.
// Synthetic: controlled obligations + policy files to verify tracing logic.
//
// Author: Vera (Internal audit engineer, governance) — Wave-4 #13

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runComplianceObligationTracingRecon } from "../platform/recon/compliance-obligation-tracing";

const FAKE_REPO_ROOT = "/nonexistent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeObligationsContent(rows: Array<{ id: string; fulfilmentPolicy: string }>): string {
  const header = `
| ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Applies-at | Entity | Binding | Product | Activity | Risk | Review |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
`.trimStart();
  const rowLines = rows.map(
    (r) =>
      `| ${r.id} | urn:... | Reg text | Some requirement | ${r.fulfilmentPolicy} | Owner | Active | commencement | LE-ZA-HOZ-BANK | LICENCE-BIND | all | all | RT-FC | reviewed |`,
  );
  return `${header}${rowLines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Temp directory management for policy file tests
// ---------------------------------------------------------------------------

let tmpPoliciesDir = "";

beforeEach(() => {
  tmpPoliciesDir = mkdtempSync(join(tmpdir(), "recon-cot-test-"));
});

afterEach(() => {
  if (tmpPoliciesDir) rmSync(tmpPoliciesDir, { recursive: true, force: true });
});

function writePolicyFile(slug: string, content: string): void {
  writeFileSync(join(tmpPoliciesDir, `${slug}.md`), content);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("compliance-obligation-tracing: graceful skip", () => {
  it("returns ok: true with 0 assertions when register is absent", () => {
    const r = runComplianceObligationTracingRecon(FAKE_REPO_ROOT, {
      policiesDirOverride: "/nonexistent",
    });
    expect(r.pipeline).toBe("compliance-obligation-tracing");
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toEqual([]);
  });

  it("returns ok: true with 0 assertions when all obligations have empty policy", () => {
    const obligations = makeObligationsContent([
      { id: "ORG-PR-01", fulfilmentPolicy: "" },
      { id: "ORG-PR-02", fulfilmentPolicy: "—" },
    ]);
    const r = runComplianceObligationTracingRecon(FAKE_REPO_ROOT, {
      obligationsOverride: obligations,
      policiesDirOverride: tmpPoliciesDir,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toEqual([]);
  });
});

describe("compliance-obligation-tracing: policy file not found", () => {
  it("obligation names a policy but no matching file → warn violation", () => {
    const obligations = makeObligationsContent([
      {
        id: "ORG-FC-02",
        fulfilmentPolicy: "[AML/CFT Policy](../Policies/aml-cft-policy-v1.md)",
      },
    ]);
    // Policies dir is empty — no matching file

    const r = runComplianceObligationTracingRecon(FAKE_REPO_ROOT, {
      obligationsOverride: obligations,
      policiesDirOverride: tmpPoliciesDir, // empty dir
    });

    expect(r.asserted).toBe(1);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.subject).toContain("ORG-FC-02");
    // Advisory: ok remains true
    expect(r.ok).toBe(true);
  });
});

describe("compliance-obligation-tracing: policy file found, no back-reference", () => {
  it("policy exists but does not mention the obligation ID → warn violation", () => {
    const obligations = makeObligationsContent([
      {
        id: "ORG-FC-02",
        fulfilmentPolicy: "[AML/CFT Policy](../Policies/aml-cft-policy-v1.md)",
      },
    ]);

    // Write policy that does NOT mention ORG-FC-02
    writePolicyFile(
      "aml-cft-policy-v1",
      `---
title: AML/CFT Policy
---

# AML/CFT Policy

This policy covers various obligations.
`,
    );

    const r = runComplianceObligationTracingRecon(FAKE_REPO_ROOT, {
      obligationsOverride: obligations,
      policiesDirOverride: tmpPoliciesDir,
    });

    expect(r.asserted).toBe(1);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("ORG-FC-02");
    expect(r.ok).toBe(true);
  });
});

describe("compliance-obligation-tracing: fully traced obligation", () => {
  it("policy exists and back-references the obligation ID → no violation", () => {
    const obligations = makeObligationsContent([
      {
        id: "ORG-FC-02",
        fulfilmentPolicy: "[AML/CFT Policy](../Policies/aml-cft-policy-v1.md)",
      },
    ]);

    // Write policy that DOES mention ORG-FC-02
    writePolicyFile(
      "aml-cft-policy-v1",
      `---
title: AML/CFT Policy
---

# AML/CFT Policy

Obligations closed: ORG-FC-02 (CDD), ORG-FC-03 (EDD), ORG-FC-04 (beneficial ownership).
`,
    );

    const r = runComplianceObligationTracingRecon(FAKE_REPO_ROOT, {
      obligationsOverride: obligations,
      policiesDirOverride: tmpPoliciesDir,
    });

    expect(r.asserted).toBe(1);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("multiple obligations — some traced, some not — correct violation count", () => {
    const obligations = makeObligationsContent([
      {
        id: "ORG-FC-02",
        fulfilmentPolicy: "[AML/CFT Policy](../Policies/aml-cft-policy-v1.md)",
      },
      {
        id: "ORG-FC-09",
        fulfilmentPolicy: "[AML/CFT Policy](../Policies/aml-cft-policy-v1.md)",
      },
      {
        id: "ORG-FC-17",
        fulfilmentPolicy: "[Missing Policy](../Policies/missing-policy-v1.md)",
      },
    ]);

    // Write policy that mentions ORG-FC-02 but not ORG-FC-09
    writePolicyFile(
      "aml-cft-policy-v1",
      `---
title: AML/CFT Policy
---

# AML/CFT Policy

Obligations closed: ORG-FC-02.
`,
    );
    // missing-policy-v1.md does not exist → ORG-FC-17 gets "file not found" warn

    const r = runComplianceObligationTracingRecon(FAKE_REPO_ROOT, {
      obligationsOverride: obligations,
      policiesDirOverride: tmpPoliciesDir,
    });

    expect(r.asserted).toBe(3);
    // ORG-FC-02 → traced (no violation)
    // ORG-FC-09 → back-ref missing → warn
    // ORG-FC-17 → file not found → warn
    expect(r.violations.length).toBe(2);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
    expect(r.ok).toBe(true);
  });
});
