// tests/vera-codebase-quality-review.test.ts
//
// Tests for the `vera:codebase-quality-review` weekly handler.
//
// Authority: D-AGENT-RUNTIME-AUTHORIZE (S8 / fleet-rollout slice).
//
// What this asserts:
//   1. Handler is registered in handlers-metadata.ts + handler-callables.ts
//      (recon:runtime-handler-sync covers the live drift; this test just
//      confirms the handler is reachable via the callable map).
//   2. Each recon emits at least one AuditFinding when run on a fixture
//      file containing the smell.
//   3. Deliverable markdown is created at the expected path.
//   4. Idempotent on a second run: running twice over the same fixtures
//      produces a second deliverable (same path, overwritten) and emits
//      events again — but the per-run substrate-runner-lifecycle pair
//      (Started/Completed) is what guards the audit trail; AuditFinding
//      events are append-only by design.
//   5. The recon citation pattern is correct (every emitted AuditFinding
//      carries typed citations including the principle file).
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { run as runAnyDensity } from "../platform/recon/code-quality/any-density";
import { run as runLegacyBypassWatch } from "../platform/recon/code-quality/legacy-bypass-watch";
import { run as runSwallowedErrors } from "../platform/recon/code-quality/swallowed-errors";
import veraCodebaseQualityReview from "../runtime/agents/vera-codebase-quality-review";
import { HANDLER_CALLABLES } from "../runtime/handler-callables";
import { HANDLERS_METADATA } from "../runtime/handlers-metadata";
import type { AgentRunContext } from "../runtime/types";

const HANDLER_KEY = "vera:codebase-quality-review";

// Persist sequence-pointer style queries for AuditFinding emission asserts.
function countAuditFindingsFromHandler(): number {
  let n = 0;
  for (const e of eventStore.replay()) {
    if (e.type !== "AuditFinding") continue;
    if (e.actor.id === "agent:vera:codebase-quality-review") n++;
  }
  return n;
}

function lastAuditFindingFromHandler() {
  let last: ReturnType<typeof eventStore.replay> extends Iterable<infer T> ? T : never;
  let found: typeof last | undefined;
  for (const e of eventStore.replay()) {
    if (e.type !== "AuditFinding") continue;
    if (e.actor.id !== "agent:vera:codebase-quality-review") continue;
    found = e as typeof found;
  }
  if (!found) throw new Error("no AuditFinding from handler in store");
  return found;
}

let fixtureRoot: string;
let ownerInboxDir: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "vera-cqr-"));
  ownerInboxDir = resolve(fixtureRoot, "Owner Inbox");
  mkdirSync(ownerInboxDir, { recursive: true });
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function writeFixture(relativePath: string, contents: string): string {
  const path = resolve(fixtureRoot, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, contents, "utf8");
  return path;
}

function makeContext(overrides: Partial<AgentRunContext> = {}): AgentRunContext {
  return {
    agent: "Vera",
    runId: "run:vera:test:0000",
    trigger: { kind: "scheduled", id: "codebase-quality-review" },
    asOf: "2026-05-10T03:00:00.000Z",
    repoRoot: fixtureRoot,
    ownerInboxDir,
    dryRun: false,
    ...overrides,
  };
}

describe("registration", () => {
  it("is registered in HANDLERS_METADATA at weekly cadence", () => {
    const meta = HANDLERS_METADATA.find((h) => h.key === HANDLER_KEY);
    expect(meta).toBeDefined();
    expect(meta?.kind).toBe("scheduled");
    expect(meta?.cadenceHours).toBe(24 * 7);
  });

  it("is registered in HANDLER_CALLABLES", () => {
    expect(HANDLER_CALLABLES[HANDLER_KEY]).toBeDefined();
    expect(typeof HANDLER_CALLABLES[HANDLER_KEY]).toBe("function");
  });
});

describe("any-density recon", () => {
  it("flags a file above the threshold", () => {
    // Plant a fixture with five `: any` occurrences — well above default 3.
    writeFixture(
      "platform/foo.ts",
      [
        "export interface X {",
        "  a: any;",
        "  b: any;",
        "  c: any;",
        "}",
        "export function f(x: any): any {",
        "  return x as any;",
        "}",
        "",
      ].join("\n"),
    );
    const r = runAnyDensity({ rootDir: fixtureRoot });
    const warnings = r.violations.filter((v) => v.severity === "warn");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((v) => v.subject.endsWith("platform/foo.ts"))).toBe(true);
  });

  it("does not flag a clean file below threshold", () => {
    writeFixture("platform/clean.ts", "export const x: number = 1;\n");
    const r = runAnyDensity({ rootDir: fixtureRoot });
    const warnings = r.violations.filter((v) => v.severity === "warn");
    expect(warnings.length).toBe(0);
  });

  it("strips comments before counting", () => {
    writeFixture(
      "platform/comment.ts",
      [
        "// a: any b: any c: any d: any",
        "/* a: any b: any c: any d: any */",
        "export const x: number = 1;",
      ].join("\n"),
    );
    const r = runAnyDensity({ rootDir: fixtureRoot });
    const warnings = r.violations.filter((v) => v.severity === "warn");
    expect(warnings.length).toBe(0);
  });
});

describe("swallowed-errors recon", () => {
  it("flags an empty catch block", () => {
    writeFixture(
      "runtime/foo.ts",
      ["export function f() {", "  try { JSON.parse('x'); }", "  catch (err) {}", "}", ""].join(
        "\n",
      ),
    );
    const r = runSwallowedErrors({ rootDir: fixtureRoot });
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations[0]?.message).toMatch(/Swallowed error/);
  });

  it("flags a comment-only catch body", () => {
    writeFixture(
      "runtime/bar.ts",
      [
        "export function g() {",
        "  try { JSON.parse('x'); }",
        "  catch { /* best-effort */ }",
        "}",
        "",
      ].join("\n"),
    );
    const r = runSwallowedErrors({ rootDir: fixtureRoot });
    expect(r.violations.length).toBe(1);
  });

  it("does NOT flag a catch with a real statement", () => {
    writeFixture(
      "runtime/ok.ts",
      [
        "export function h() {",
        "  try { JSON.parse('x'); }",
        "  catch (err) { console.error(err); }",
        "}",
        "",
      ].join("\n"),
    );
    const r = runSwallowedErrors({ rootDir: fixtureRoot });
    expect(r.violations.length).toBe(0);
  });
});

describe("legacy-bypass-watch recon", () => {
  it("flags a count above baseline", () => {
    const path = resolve(fixtureRoot, "permission-gate.ts");
    writeFileSync(
      path,
      [
        "export const LEGACY_PRE_A1_EVENT_TYPES: ReadonlySet<string> = new Set([",
        '  "Foo",',
        '  "Bar",',
        '  "Baz",',
        '  "Quux",',
        "]);",
      ].join("\n"),
      "utf8",
    );
    const r = runLegacyBypassWatch({ permissionGatePath: path, baseline: 3 });
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns.length).toBe(1);
    expect(warns[0]?.message).toMatch(/4 entries/);
  });

  it("notes progress when below baseline", () => {
    const path = resolve(fixtureRoot, "permission-gate.ts");
    writeFileSync(
      path,
      [
        "export const LEGACY_PRE_A1_EVENT_TYPES: ReadonlySet<string> = new Set([",
        '  "Foo",',
        '  "Bar",',
        "]);",
      ].join("\n"),
      "utf8",
    );
    const r = runLegacyBypassWatch({ permissionGatePath: path, baseline: 5 });
    const infos = r.violations.filter((v) => v.severity === "info");
    expect(infos.length).toBe(1);
    expect(infos[0]?.message).toMatch(/Progress/);
  });

  it("notes baseline-stable when matching", () => {
    const path = resolve(fixtureRoot, "permission-gate.ts");
    writeFileSync(
      path,
      [
        "export const LEGACY_PRE_A1_EVENT_TYPES: ReadonlySet<string> = new Set([",
        '  "Foo",',
        '  "Bar",',
        "]);",
      ].join("\n"),
      "utf8",
    );
    const r = runLegacyBypassWatch({ permissionGatePath: path, baseline: 2 });
    const infos = r.violations.filter((v) => v.severity === "info");
    expect(infos.length).toBe(1);
    expect(infos[0]?.message).toMatch(/at baseline/);
  });
});

describe("handler integration", () => {
  it("writes the deliverable + emits at least one AuditFinding", async () => {
    // Plant fixtures under the fixture's prototype/ tree so the handler's
    // recons (which scan ctx.repoRoot/prototype/) find them.
    writeFixture(
      "prototype/platform/erosion.ts",
      [
        "export interface X {",
        "  a: any;",
        "  b: any;",
        "  c: any;",
        "  d: any;",
        "}",
        "export function f() {",
        "  try { JSON.parse('x'); } catch {}",
        "  try { JSON.parse('y'); } catch (e) {}",
        "}",
        "",
      ].join("\n"),
    );
    // Plant a permission-gate.ts at the path the legacy-bypass-watch
    // recon defaults to. The recon resolves from its own module location,
    // so for the integration test we accept it scans the live repo's
    // permission-gate.ts and just emits the heartbeat. The any-density
    // and swallowed-errors recons scan ctx.repoRoot/prototype/ — those
    // are the ones our fixture exercises.

    const before = countAuditFindingsFromHandler();
    const ctx = makeContext();
    const result = await veraCodebaseQualityReview(ctx);

    expect(result.ok).toBe(true);
    expect(result.deliverable).toBe("Owner Inbox/2026-05-10_vera_codebase-quality-review.md");

    const path = resolve(ownerInboxDir, "2026-05-10_vera_codebase-quality-review.md");
    expect(existsSync(path)).toBe(true);
    const md = readFileSync(path, "utf8");
    expect(md).toMatch(/title: Codebase quality review/);
    expect(md).toMatch(/authority: GOV-FRAMEWORK-CAE-INDEPENDENCE/);
    expect(md).toMatch(/Substrate gaps surfaced/);
    expect(md).toMatch(/LLM-judgment findings remain Scrooge-coordinated/);

    // At least one warn-severity AuditFinding emitted (the planted fixtures
    // exercise both any-density and swallowed-errors).
    const after = countAuditFindingsFromHandler();
    expect(after).toBeGreaterThan(before);

    // The most recent AuditFinding from this handler carries the typed
    // citations (Principle 2 — citation discipline).
    const f = lastAuditFindingFromHandler();
    expect(f.citations).toContain("GOV-FRAMEWORK-CAE-INDEPENDENCE");
    expect(f.citations).toContain("D-AGENT-RUNTIME-AUTHORIZE");
    // Whichever recon emitted last, it must cite a principle
    expect(
      f.citations.some(
        (c) => c === "PRINCIPLE-1-EVENTS-AS-TRUTH" || c === "PRINCIPLE-4-SECURITY-DESIGNED-IN",
      ),
    ).toBe(true);
  });

  it("dry-run does not write deliverable or emit events", async () => {
    writeFixture(
      "prototype/platform/dry.ts",
      ["export function f() { try {} catch {} }", ""].join("\n"),
    );

    const before = countAuditFindingsFromHandler();
    const ctx = makeContext({ dryRun: true });
    const result = await veraCodebaseQualityReview(ctx);

    expect(result.ok).toBe(true);
    expect(result.deliverable).toBeUndefined();
    expect(result.eventsEmitted).toBe(0);
    expect(countAuditFindingsFromHandler()).toBe(before);
  });

  it("re-running overwrites the deliverable; AuditFinding events are append-only", async () => {
    writeFixture(
      "prototype/platform/repeat.ts",
      ["export function f() {", "  try { JSON.parse('x'); } catch {}", "}", ""].join("\n"),
    );

    const ctx1 = makeContext();
    await veraCodebaseQualityReview(ctx1);
    const path = resolve(ownerInboxDir, "2026-05-10_vera_codebase-quality-review.md");
    expect(existsSync(path)).toBe(true);
    const before = countAuditFindingsFromHandler();

    const ctx2 = makeContext();
    await veraCodebaseQualityReview(ctx2);
    expect(existsSync(path)).toBe(true);
    const after = countAuditFindingsFromHandler();
    // Each run emits its own AuditFinding events (append-only audit
    // trail per event-store/registry.ts AUDIT_EVENT_TYPES). The test
    // documents that this is intentional.
    expect(after).toBeGreaterThan(before);
  });
});
