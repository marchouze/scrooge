// platform/recon/procedure-event-name-coherence.test.ts
//
// Unit tests for the procedure-event-name-coherence recon pipeline.
//
// Author: Atlas (Core banking platform architect, engineering)
// Co-author: Owen (Company Secretary, governance)

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run } from "./procedure-event-name-coherence";

const FIXTURE_ROOT = join(tmpdir(), `proc-event-coherence-${Date.now()}`);

function writeFixture(rel: string, body: string): string {
  const full = join(FIXTURE_ROOT, rel);
  const segs = full.split("/");
  segs.pop();
  mkdirSync(segs.join("/"), { recursive: true });
  writeFileSync(full, body, "utf8");
  return full;
}

beforeAll(() => {
  mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("procedure-event-name-coherence — extraction shape", () => {
  it("returns ok=true and asserts zero when no procedure files are provided", () => {
    const r = run({ procedureFiles: [] });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
  });

  it("resolves canonical Product* event references with payload braces", () => {
    const f = writeFixture(
      "resolved.md",
      [
        "# Resolved",
        "",
        "Emit `ProductApproved { productId, version, conditions, approvedBy }`.",
        "Emit `ProductWithheld { productId, version, reason }`.",
        "Emit `ProductDimensionAttested { productId, dimension, result, citationChain }`.",
      ].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    expect(r.asserted).toBeGreaterThanOrEqual(3);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("ignores PascalCase tokens that are not in an event context", () => {
    const f = writeFixture(
      "non-event.md",
      [
        "# Non-event tokens",
        "",
        "Status: `POPULATED`",
        "Status: `STUB`",
        "Owner: `Atlas`",
        "Reference: `BLAKE3` content hash",
      ].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });
});

describe("procedure-event-name-coherence — strict-scope (npa-gate.md)", () => {
  it("flags an unresolved event reference in the strict-scope file as fail", () => {
    const f = writeFixture(
      "Procedures/by-policy/npa-gate.md",
      [
        "# Procedure — NPA Gate (synthetic)",
        "",
        "Emit `NPAGateConvened { productId, participants }`.",
      ].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    // `NPAGateConvened` is not in the canonical typed family and the line
    // carries no retirement marker → fail.
    expect(r.ok).toBe(false);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails.length).toBeGreaterThanOrEqual(1);
    const first = fails[0];
    if (first === undefined) throw new Error("expected at least one fail violation");
    expect(first.message).toContain("`NPAGateConvened`");
  });

  it("allows an unresolved event mention if the line is retirement-context", () => {
    const f = writeFixture(
      "Procedures/by-policy/npa-gate.md",
      [
        "# Procedure — NPA Gate (synthetic)",
        "",
        "**Event-name vocabulary.** The earlier `NPAGateConvened` event vocabulary is retired; see change log.",
      ].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("resolves canonical references in the strict-scope file", () => {
    const f = writeFixture(
      "Procedures/by-policy/npa-gate.md",
      [
        "# Procedure — NPA Gate (synthetic)",
        "",
        "Emit `ProductApproved { productId, version, conditions, approvedBy }`.",
        "On withhold, emit `ProductWithheld { productId, version, reason }`.",
        "On launch, emit `ProductLaunched { productId, version, controlledLaunchLimits, launchedAt }`.",
      ].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.asserted).toBeGreaterThanOrEqual(3);
  });
});

describe("procedure-event-name-coherence — warn-tier (outside strict scope)", () => {
  it("emits warn-severity violations for unresolved refs in non-strict files", () => {
    const f = writeFixture(
      "Procedures/by-policy/some-other-procedure.md",
      ["# Some other procedure", "", "Emit `SomeFutureEventName { foo }`."].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    expect(r.ok).toBe(true); // warns do not block ok
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.length).toBeGreaterThanOrEqual(1);
    const firstWarn = warns[0];
    if (firstWarn === undefined) throw new Error("expected at least one warn violation");
    expect(firstWarn.subject).toContain("some-other-procedure.md");
  });
});

describe("procedure-event-name-coherence — event-context heuristics", () => {
  it("recognises 'emitted' as an event-context verb", () => {
    const f = writeFixture(
      "Procedures/by-policy/npa-gate.md",
      ["When `BogusEventOne` is emitted, halt."].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    expect(r.violations.some((v) => v.message.includes("`BogusEventOne`"))).toBe(true);
  });

  it("recognises 'event' noun following the token within ~25 chars", () => {
    const f = writeFixture(
      "Procedures/by-policy/npa-gate.md",
      ["The `BogusEventTwo` event must exist."].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    expect(r.violations.some((v) => v.message.includes("`BogusEventTwo`"))).toBe(true);
  });

  it("does NOT treat a bare PascalCase token as an event ref", () => {
    const f = writeFixture(
      "Procedures/by-policy/npa-gate.md",
      ["Owner: `SaskiaHeadOfMarkets`."].join("\n"),
    );
    const r = run({ procedureFiles: [f] });
    expect(r.violations).toHaveLength(0);
  });
});
