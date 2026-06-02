// platform/records/brief-router.test.ts
//
// Unit tests for routeBlockedBrief — the follow-on brief auto-issue logic.
//
// Tests:
//   1. Blocked run with one code-pr followOnRoute → returns a valid briefId
//      matching Atlas slug pattern, alreadyExists: false.
//   2. Second call with same blockedRunId + route → alreadyExists: true (idempotency).
//   3. `agent` route with unresolvable target → no throw, alreadyExists: false.
//   4. `decision` route → skipped silently, alreadyExists: false.
//   5. `agent` route with known target (agent:bea) → briefId contains "bea".
//
// Note: The module uses the singleton eventStore from platform/composition for
// idempotency checks. The document-store dep is injected via RecordHelperDeps.
// We use a tmpdir-backed LocalFsDocumentStore to avoid FS side-effects leaking
// between test runs (matching the pattern in tests/rms-record-helpers.test.ts).
//
// Authority: D-AGENT-AUTONOMY-COHORT-2-PILOT.
// Author: Atlas (Core banking platform architect, engineering)

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { LocalFsDocumentStore } from "../document-store";
import { routeBlockedBrief } from "./brief-router";
import type { RouteBlockedBriefInput } from "./brief-router";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const BEA_REF = {
  name: "Bea",
  position: "Accounting and financial reporting engineer",
  agentId: "agent:bea",
};
const SCROOGE_REF = {
  name: "Scrooge",
  position: "Chief of Staff / Orchestrator",
  agentId: "agent:scrooge",
};

function makeTmpDocStore(): LocalFsDocumentStore {
  const root = mkdtempSync(join(tmpdir(), "brief-router-test-"));
  return new LocalFsDocumentStore({ root });
}

/**
 * Build a base RouteBlockedBriefInput. Callers can override specific fields.
 */
function baseInput(overrides: Partial<RouteBlockedBriefInput> = {}): RouteBlockedBriefInput {
  return {
    blockedRunId: "run:bea:goal-loop:iter-test-001",
    route: {
      kind: "code-pr",
      target: "engineering-execution-substrate",
      directive: "Implement the missing feature in the platform.",
    },
    parentBriefId: "brief:bea:some-parent:2026-06-02",
    parentBriefTitle: "Some parent brief title",
    issuedBy: BEA_REF,
    asOf: "2026-06-02T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("routeBlockedBrief", () => {
  it("code-pr route → issues brief addressed to Atlas (briefId contains 'atlas')", () => {
    const docStore = makeTmpDocStore();

    const result = routeBlockedBrief(
      baseInput({ blockedRunId: "run:bea:goal-loop:atlas-test-001" }),
      { documentStore: docStore },
    );

    expect(result.alreadyExists).toBe(false);
    // BriefId should contain "atlas" (the code-pr target slug)
    expect(result.briefId).toMatch(/^brief:atlas:route-[0-9a-f]{8}:2026-06-02$/);
  });

  it("second call with same blockedRunId + route → alreadyExists: true (idempotency)", () => {
    const docStore = makeTmpDocStore();
    const input = baseInput({
      blockedRunId: "run:bea:goal-loop:idempotency-test-999",
    });

    const first = routeBlockedBrief(input, { documentStore: docStore });
    expect(first.alreadyExists).toBe(false);

    const second = routeBlockedBrief(input, { documentStore: docStore });
    expect(second.alreadyExists).toBe(true);
    expect(second.briefId).toBe(first.briefId);
  });

  it("agent route with unresolvable target → no throw, alreadyExists: false", () => {
    const docStore = makeTmpDocStore();
    const input = baseInput({
      blockedRunId: "run:bea:goal-loop:unresolvable-test-999",
      route: {
        kind: "agent",
        target: "agent:nonexistent-xyzzy-9999",
        directive: "Do something with this unresolvable agent.",
      },
    });

    let threw = false;
    let result: ReturnType<typeof routeBlockedBrief> | undefined;
    try {
      result = routeBlockedBrief(input, { documentStore: docStore });
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result).toBeDefined();
    // Non-emit path: alreadyExists is false (no emit attempted)
    expect(result?.alreadyExists).toBe(false);
  });

  it("decision route → skipped silently, alreadyExists: false, no throw", () => {
    const docStore = makeTmpDocStore();
    const input = baseInput({
      blockedRunId: "run:bea:goal-loop:decision-route-test-999",
      route: {
        kind: "decision",
        target: "CEO",
        directive: "Approve the capital plan.",
      },
    });

    let threw = false;
    let result: ReturnType<typeof routeBlockedBrief> | undefined;
    try {
      result = routeBlockedBrief(input, { documentStore: docStore });
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    expect(result).toBeDefined();
    expect(result?.alreadyExists).toBe(false);
  });

  it("agent route with known target (agent:bea) → briefId contains 'bea'", () => {
    const docStore = makeTmpDocStore();
    const input = baseInput({
      blockedRunId: "run:rohan:goal-loop:agent-bea-test-999",
      route: {
        kind: "agent",
        target: "agent:bea",
        directive: "Review the accounting policy change for FX trades.",
      },
      issuedBy: SCROOGE_REF,
    });

    const result = routeBlockedBrief(input, { documentStore: docStore });

    expect(result.alreadyExists).toBe(false);
    // BriefId should contain "bea" (the resolved target slug)
    expect(result.briefId).toMatch(/^brief:bea:route-[0-9a-f]{8}:2026-06-02$/);
  });
});
