// tests/sla-rule-schema.test.ts
//
// Asserts: (1) the rule JSON-Schema is well-formed; (2) the PR-FX-001 JSON
// mirror conforms to the schema's required/enum shape; (3) the TS rule
// (pr-fx-001.ts) and the JSON mirror are in lock-step (no drift between the
// human-readable artefact and the executed data).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { PR_FX_001 } from "../platform/accounting/sla/rules/pr-fx-001";

const SLA_DIR = resolve(import.meta.dir, "../platform/accounting/sla");

function loadJson(rel: string): unknown {
  return JSON.parse(readFileSync(resolve(SLA_DIR, rel), "utf8"));
}

describe("rule JSON-Schema", () => {
  it("is well-formed JSON-Schema (draft-07)", () => {
    const schema = loadJson("rule.schema.json") as Record<string, unknown>;
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.type).toBe("object");
    expect(Array.isArray(schema.required)).toBe(true);
    expect(schema.required).toContain("rule_id");
    expect(schema.required).toContain("representation");
    expect(schema.required).toContain("lines");
    expect(schema.additionalProperties).toBe(false);
  });

  it("constrains representation to the three known bases", () => {
    const schema = loadJson("rule.schema.json") as {
      properties: { representation: { enum: string[] } };
    };
    expect(schema.properties.representation.enum).toEqual(["IFRS", "SARB-BA-RETURN", "ZA-TAX"]);
  });
});

describe("PR-FX-001 JSON mirror", () => {
  const json = loadJson("rules/pr-fx-001.rule.json") as Record<string, unknown>;

  it("carries all schema-required fields", () => {
    for (const field of [
      "rule_id",
      "representation",
      "version",
      "effective_from",
      "applies_to",
      "condition",
      "lines",
      "balancing",
      "cites",
    ]) {
      expect(json[field]).toBeDefined();
    }
  });

  it("matches the executed TS rule field-for-field (ignoring notes)", () => {
    const { notes: _jsonNotes, ...jsonNoNotes } = json as Record<string, unknown>;
    const tsAsJson = JSON.parse(JSON.stringify(PR_FX_001));
    expect(jsonNoNotes).toEqual(tsAsJson);
  });
});
