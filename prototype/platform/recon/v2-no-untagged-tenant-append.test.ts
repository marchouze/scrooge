// platform/recon/v2-no-untagged-tenant-append.test.ts
//
// Regression test for the no-untagged-tenant-append gate
// (D-EVENT-ENVELOPE-TENANT-COLUMN). Asserts the classifier flags a violating
// INSERT and passes a compliant one — so the gate is load-bearing, not vacuous.

import { describe, expect, it } from "bun:test";
import { classifyContent, run } from "./v2-no-untagged-tenant-append";

describe("recon:v2-no-untagged-tenant-append", () => {
  it("flags an INSERT INTO v2_events that omits tenant_id", () => {
    const offending = `db.query(\`INSERT OR IGNORE INTO v2_events
      (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`)`;
    const problems = classifyContent(offending);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain("tenant_id");
  });

  it("flags an INSERT INTO v2_events with no explicit column list", () => {
    const offending = "INSERT INTO v2_events VALUES (?, ?, ?)";
    const problems = classifyContent(offending);
    expect(problems.length).toBeGreaterThan(0);
  });

  it("passes an INSERT INTO v2_events that includes tenant_id", () => {
    const compliant = `INSERT OR IGNORE INTO v2_events
      (event_id, type, as_of, entity, actor_type, actor_id, citations, payload, tenant_id, schema_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    expect(classifyContent(compliant)).toEqual([]);
  });

  it("the live tree is clean (every v2_events INSERT tags tenant_id)", () => {
    const result = run();
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });
});
