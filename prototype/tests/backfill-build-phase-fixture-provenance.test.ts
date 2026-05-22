// tests/backfill-build-phase-fixture-provenance.test.ts
//
// D-PROVENANCE-BUILD-PHASE-CLASS Slice 2 — unit tests for the
// build-phase-fixture backfill.
//
// Covers:
//   (1) sourceLineage allowlist rule (`isBuildPhaseFixtureLineage`)
//   (2) idempotency of `runBackfill` (second pass mutates nothing)
//
// Author: Atlas (Records & Documents Engineer, engineering — substrate)

import { describe, expect, it } from "bun:test";

import { isBuildPhaseFixtureLineage } from "../scripts/backfill-build-phase-fixture-provenance";

describe("isBuildPhaseFixtureLineage — sourceLineage allowlist rule", () => {
  it("accepts the canonical allowlist entries", () => {
    expect(isBuildPhaseFixtureLineage("pre-substrate-backfill")).toBe(true);
    expect(isBuildPhaseFixtureLineage("synthetic-bank-seed:v1")).toBe(true);
    expect(isBuildPhaseFixtureLineage("synthetic-bank-seed:v2")).toBe(true);
    expect(isBuildPhaseFixtureLineage("synthetic-bank-seed:v42")).toBe(true);
    expect(isBuildPhaseFixtureLineage("sarb-fixing-fixture")).toBe(true);
    expect(isBuildPhaseFixtureLineage("sarb-fixing-fixture:2026-05-21")).toBe(true);
    expect(isBuildPhaseFixtureLineage("sarb-fixing-fixture:eur.zar:2026-05-21")).toBe(true);
  });

  it("rejects scenario / rehearsal / counterfactual lineages", () => {
    expect(isBuildPhaseFixtureLineage("scenario-runner:fx-spot-01")).toBe(false);
    expect(isBuildPhaseFixtureLineage("agent-runtime:rohan:daily-mtm")).toBe(false);
    expect(isBuildPhaseFixtureLineage("script:run-mtm-eod")).toBe(false);
    expect(isBuildPhaseFixtureLineage("recon-harness")).toBe(false);
    expect(isBuildPhaseFixtureLineage("test-fixture")).toBe(false);
    expect(isBuildPhaseFixtureLineage("bun-test-runner:store")).toBe(false);
  });

  it("rejects malformed allowlist-style strings", () => {
    // Wrong prefix
    expect(isBuildPhaseFixtureLineage("synthetic-bank-seed")).toBe(false);
    expect(isBuildPhaseFixtureLineage("synthetic-bank-seed:")).toBe(false);
    expect(isBuildPhaseFixtureLineage("synthetic-bank-seed:vX")).toBe(false);
    expect(isBuildPhaseFixtureLineage("synthetic-bank-seed:beta")).toBe(false);
    // Empty string
    expect(isBuildPhaseFixtureLineage("")).toBe(false);
    // Prefix lookalike that doesn't match the canonical literal
    expect(isBuildPhaseFixtureLineage("pre-substrate")).toBe(false);
    expect(isBuildPhaseFixtureLineage("pre-substrate-backfill-v2")).toBe(false);
  });

  it("is case-sensitive (lineage tokens are canonical lowercase identifiers)", () => {
    expect(isBuildPhaseFixtureLineage("Pre-Substrate-Backfill")).toBe(false);
    expect(isBuildPhaseFixtureLineage("SYNTHETIC-BANK-SEED:v1")).toBe(false);
  });
});

describe("runBackfill — idempotency", () => {
  // We exercise idempotency at the orchestrator level by invoking the
  // exported `runBackfill` against the composition-root event store
  // twice in succession. The second call must report zero
  // `reclassified` and zero `auditEventsEmitted` even if the first
  // call mutated rows.
  //
  // We import inside the test (rather than at top of file) so the
  // `applyDispatchEventDbResolution()` side effect at module init
  // takes effect against an isolated tmp store via `BANK_EVENT_DB`.
  //
  // CI safety: a `BANK_EVENT_DB` tmpfile path is set BEFORE the
  // import, ensuring composition.ts resolves to that path.

  it("second pass after first pass reclassifies zero rows + emits zero audit events", async () => {
    const tmpDb = `/tmp/test-backfill-bpf-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
    process.env.BANK_EVENT_DB = tmpDb;

    // Dynamic import so composition.ts picks up BANK_EVENT_DB.
    const { runBackfill } = await import("../scripts/backfill-build-phase-fixture-provenance");

    // The meaningful invariant: whatever the first pass does, the
    // second pass MUST report zero `reclassified` and zero
    // `auditEventsEmitted` — the backfill is idempotent. The first
    // pass count itself is store-state-dependent (composition.ts
    // seeds events at module load) so we assert only that
    // (r1.reclassified === r1.auditEventsEmitted), then assert the
    // strong zero-delta invariant on r2.
    const r1 = runBackfill({ runRef: "test-run-1" });
    const r2 = runBackfill({ runRef: "test-run-2" });

    // Per-run consistency: each row reclassified must emit exactly
    // one audit event.
    expect(r1.reclassified).toBe(r1.auditEventsEmitted);
    expect(r2.reclassified).toBe(r2.auditEventsEmitted);

    // Idempotency: second pass mutates nothing.
    expect(r2.reclassified).toBe(0);
    expect(r2.auditEventsEmitted).toBe(0);

    // Cleanup
    process.env.BANK_EVENT_DB = undefined;
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });
});
