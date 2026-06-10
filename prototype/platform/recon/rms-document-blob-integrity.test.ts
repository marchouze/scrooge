// platform/recon/rms-document-blob-integrity.test.ts
//
// Golden cases for the dangling-record detector:
//   - blob present in the resolved store → clean;
//   - blob only in the legacy in-repo store → warn (pending migration);
//   - blob nowhere, event pre-enforcement → warn (historical gap);
//   - blob nowhere, event post-enforcement → FAIL (the Vera PR #1194
//     pruned-worktree case);
//   - migration flips a legacy-warn store to fully clean.
//
// Author: Atlas (Core banking platform architect, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { migrateDocumentStoreBlobs } from "../../scripts/migrate/migrate-document-store-blobs-to-shared";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import { makeRecordFiled } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import { run } from "./rms-document-blob-integrity";

const ENFORCEMENT = "2026-06-11";
const PRE_ENFORCEMENT_AS_OF = "2026-06-01T10:00:00.000Z";
const POST_ENFORCEMENT_AS_OF = "2026-06-12T10:00:00.000Z";

let resolvedRoot: string;
let legacyRoot: string;
let resolvedStore: LocalFsDocumentStore;
let legacyStore: LocalFsDocumentStore;

beforeEach(() => {
  resolvedRoot = mkdtempSync(join(tmpdir(), "blob-recon-resolved-"));
  legacyRoot = mkdtempSync(join(tmpdir(), "blob-recon-legacy-"));
  resolvedStore = new LocalFsDocumentStore({ root: resolvedRoot });
  legacyStore = new LocalFsDocumentStore({ root: legacyRoot });
});

afterEach(() => {
  rmSync(resolvedRoot, { recursive: true, force: true });
  rmSync(legacyRoot, { recursive: true, force: true });
});

function recordFiledEvent(recordId: string, documentHash: string, asOf: string): Event {
  return makeRecordFiled({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "test:rms-document-blob-integrity" },
    citations: ["D-CROSS-WORKTREE-EVENT-STORE-SYNC"],
    payload: {
      recordId,
      registerKey: "documents",
      documentHash,
      classification: "engineering-seat",
      retention: {
        citationRef: "BANKS-ACT-94-1990",
        minimumYears: 5,
        archivalTier: "cool",
      },
    },
  });
}

const MISSING_HASH = `blake3:${"ab".repeat(32)}`;

describe("recon:rms-document-blob-integrity", () => {
  it("passes when every RecordFiled documentHash resolves in the resolved store", () => {
    const put = resolvedStore.put("resolved deliverable body");
    const r = run({
      recordFiledEvents: [recordFiledEvent("rec:clean", put.hash, POST_ENFORCEMENT_AS_OF)],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
  });

  it("warns (not fails) when the blob exists only in the legacy in-repo store", () => {
    const put = legacyStore.put("legacy-only deliverable body");
    const r = run({
      recordFiledEvents: [recordFiledEvent("rec:legacy", put.hash, POST_ENFORCEMENT_AS_OF)],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("migrate:document-store-blobs");
  });

  it("warns on a pre-enforcement dangling record (historical gap)", () => {
    const r = run({
      recordFiledEvents: [recordFiledEvent("rec:old-dangle", MISSING_HASH, PRE_ENFORCEMENT_AS_OF)],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("historical");
  });

  it("FAILS on a post-enforcement dangling record (pruned-worktree case)", () => {
    const r = run({
      recordFiledEvents: [recordFiledEvent("rec:dangle", MISSING_HASH, POST_ENFORCEMENT_AS_OF)],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
    });
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.message).toContain("DANGLING RECORD");
    expect(r.violations[0]?.subject).toContain("rec:dangle");
  });

  it("fails even when no legacy store is mounted (legacyStore: null)", () => {
    const r = run({
      recordFiledEvents: [recordFiledEvent("rec:dangle2", MISSING_HASH, POST_ENFORCEMENT_AS_OF)],
      resolvedStore,
      legacyStore: null,
      enforcementDate: ENFORCEMENT,
    });
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.severity).toBe("fail");
  });

  it("running the migration flips a legacy-warn store to fully clean", () => {
    const put = legacyStore.put("body awaiting migration");
    const events = [recordFiledEvent("rec:migrate-me", put.hash, POST_ENFORCEMENT_AS_OF)];

    const before = run({
      recordFiledEvents: events,
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
    });
    expect(before.violations).toHaveLength(1);
    expect(before.violations[0]?.severity).toBe("warn");

    const summary = migrateDocumentStoreBlobs({ sourceRoot: legacyRoot, destRoot: resolvedRoot });
    expect(summary.copied).toBe(1);

    const after = run({
      recordFiledEvents: events,
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
    });
    expect(after.ok).toBe(true);
    expect(after.violations).toHaveLength(0);
  });

  it("asserts a mixed population with per-event severities", () => {
    const clean = resolvedStore.put("clean body");
    const legacy = legacyStore.put("legacy body");
    const r = run({
      recordFiledEvents: [
        recordFiledEvent("rec:clean", clean.hash, POST_ENFORCEMENT_AS_OF),
        recordFiledEvent("rec:legacy", legacy.hash, POST_ENFORCEMENT_AS_OF),
        recordFiledEvent("rec:old-dangle", MISSING_HASH, PRE_ENFORCEMENT_AS_OF),
        recordFiledEvent("rec:new-dangle", MISSING_HASH, POST_ENFORCEMENT_AS_OF),
      ],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
    });
    expect(r.asserted).toBe(4);
    expect(r.ok).toBe(false);
    const bySeverity = r.violations.map((v) => v.severity).sort();
    expect(bySeverity).toEqual(["fail", "warn", "warn"]);
  });
});
