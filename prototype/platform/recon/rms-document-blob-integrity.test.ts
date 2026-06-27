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
import { join, resolve } from "node:path";

import { migrateDocumentStoreBlobs } from "../../scripts/migrate/migrate-document-store-blobs-to-shared";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import {
  inRepoDocumentStoreRoot,
  resolveDocumentStoreRoot,
} from "../document-store/resolve-document-store";
import { makeRecordFiled } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import { loadAllowlistKeys, readPathDocumentStoreRoot, run } from "./rms-document-blob-integrity";

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

/** Composite allowlist key — mirrors `allowKey` in the gate (recordId + " " + hash). */
function key(recordId: string, documentHash: string): string {
  return `${recordId} ${documentHash}`;
}

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

  // The injected-`recordFiledEvents` + injected-store cases above prove the
  // assertion CORE. The read-path block below proves the gate's PRIMARY-store
  // DEFAULT resolution models the store the reader (dashboard / RecordFiled
  // consumers) reads — not the `excludeHomeDefault` per-worktree singleton.
  // This is the blind spot that made the live sweep report ~3,268 false
  // dangling records (shared event store audited against the empty
  // per-worktree document store) instead of the true ~1,867 the home store
  // carries; it cannot regress while these assertions hold. Mirrors the
  // `agent-memory-doc-resolves` read-path regression (2026-06-25).
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

describe("readPathDocumentStoreRoot — models the reader's store, not the per-worktree singleton", () => {
  it("honors BANK_DOCUMENT_STORE (the env tier the boot shim / CI pin sets)", () => {
    const saved = process.env.BANK_DOCUMENT_STORE;
    try {
      process.env.BANK_DOCUMENT_STORE = "/tmp/rms-blob-read-path-docs";
      expect(readPathDocumentStoreRoot()).toBe(resolve("/tmp/rms-blob-read-path-docs"));
    } finally {
      if (saved === undefined) {
        // biome-ignore lint/performance/noDelete: env-var cleanup needs delete for true absence (undefined-assignment coerces to the string "undefined")
        delete process.env.BANK_DOCUMENT_STORE;
      } else {
        process.env.BANK_DOCUMENT_STORE = saved;
      }
    }
  });

  it("is home-default-ENABLED: the read-path root diverges from the excludeHomeDefault singleton when no env is set", () => {
    // The crux the gate's read-path fix depends on: with no doc-store env set,
    // the READ path (this gate's primary store, paired to the event store's
    // live home resolution) resolves to the shared HOME store, while the
    // per-worktree `excludeHomeDefault` singleton resolves to the empty
    // in-repo fallback. If the gate used the singleton (as it did before this
    // fix) it would audit the SHARED event store against the EMPTY
    // per-worktree document store and report every RecordFiled as dangling.
    const NO_ENV = {
      explicit: "",
      envBankDocumentStore: "",
      envBankDocumentStorePath: "",
      envBankHomeDocumentStore: "",
      home: "/tmp/fake-home",
    } as const;
    const readPath = resolveDocumentStoreRoot({ ...NO_ENV });
    const singleton = resolveDocumentStoreRoot({
      ...NO_ENV,
      excludeHomeDefault: true,
      fallbackRoot: inRepoDocumentStoreRoot(),
    });
    expect(readPath.source).toBe("home-default");
    expect(readPath.root).toBe(resolve("/tmp/fake-home", ".local", "share", "bank", "documents"));
    expect(singleton.source).toBe("fallback");
    expect(readPath.root).not.toBe(singleton.root);
  });
});

// FROZEN HISTORICAL-LOSS ALLOWLIST (D-RMS-BLOB-HISTORICAL-LOSS-ALLOWLIST,
// CEO-approved 2026-06-27; Phase 2 of the RMS blob-integrity remediation;
// basis Vera census PR #1590). The allowlist downgrades EXACTLY the
// enumerated (recordId, documentHash) pairs to a non-failing acknowledged
// `warn`; the fail-direction is provably intact for any NEW dangling record.
// These are the load-bearing tests Charter command 3 requires: a frozen,
// Decision-backed allowlist is acceptable only because the fail-direction
// survives — proven here, not asserted.
describe("frozen historical-loss allowlist — fail-direction provably intact", () => {
  const ALLOWED_ID = "rec:historical-loss";
  const ALLOWED_KEYS: ReadonlySet<string> = new Set([key(ALLOWED_ID, MISSING_HASH)]);

  it("an allowlisted post-enforcement dangling record does NOT fail (downgraded to acknowledged warn)", () => {
    const r = run({
      recordFiledEvents: [recordFiledEvent(ALLOWED_ID, MISSING_HASH, POST_ENFORCEMENT_AS_OF)],
      resolvedStore,
      legacyStore: null,
      enforcementDate: ENFORCEMENT,
      allowlistKeys: ALLOWED_KEYS,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("Acknowledged historical loss");
    expect(r.violations[0]?.message).toContain("D-RMS-BLOB-HISTORICAL-LOSS-ALLOWLIST");
    expect(r.violations[0]?.message).toContain("#1590");
  });

  it("a synthetic NEW dangling record (hash NOT on the allowlist) STILL FAILS — fail-direction survives", () => {
    const NEW_DANGLE_HASH = `blake3:${"cd".repeat(32)}`;
    expect(ALLOWED_KEYS.has(key("rec:brand-new", NEW_DANGLE_HASH))).toBe(false);
    const r = run({
      recordFiledEvents: [
        recordFiledEvent("rec:brand-new", NEW_DANGLE_HASH, POST_ENFORCEMENT_AS_OF),
      ],
      resolvedStore,
      legacyStore: null,
      enforcementDate: ENFORCEMENT,
      allowlistKeys: ALLOWED_KEYS,
    });
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.message).toContain("DANGLING RECORD");
  });

  it("the SAME recordId with a DIFFERENT hash is NOT excused — the allowlist is keyed on the exact pair", () => {
    const OTHER_HASH = `blake3:${"ef".repeat(32)}`;
    const r = run({
      recordFiledEvents: [recordFiledEvent(ALLOWED_ID, OTHER_HASH, POST_ENFORCEMENT_AS_OF)],
      resolvedStore,
      legacyStore: null,
      enforcementDate: ENFORCEMENT,
      allowlistKeys: ALLOWED_KEYS,
    });
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.severity).toBe("fail");
  });

  it("removing the entry from the allowlist makes the SAME record fail again", () => {
    const events = [recordFiledEvent(ALLOWED_ID, MISSING_HASH, POST_ENFORCEMENT_AS_OF)];
    const withEntry = run({
      recordFiledEvents: events,
      resolvedStore,
      legacyStore: null,
      enforcementDate: ENFORCEMENT,
      allowlistKeys: ALLOWED_KEYS,
    });
    expect(withEntry.ok).toBe(true);

    const withoutEntry = run({
      recordFiledEvents: events,
      resolvedStore,
      legacyStore: null,
      enforcementDate: ENFORCEMENT,
      allowlistKeys: new Set(), // entry removed
    });
    expect(withoutEntry.ok).toBe(false);
    expect(withoutEntry.violations[0]?.severity).toBe("fail");
  });

  it("the allowlist never rescues a PRE-enforcement record into the acknowledged class (it stays a historical warn)", () => {
    // Pre-enforcement records are already non-failing warns; the allowlist
    // only consults the fail-direction. A pre-enforcement record on the list
    // keeps the historical-warn message, not the acknowledged-allowlist one.
    const r = run({
      recordFiledEvents: [recordFiledEvent(ALLOWED_ID, MISSING_HASH, PRE_ENFORCEMENT_AS_OF)],
      resolvedStore,
      legacyStore: null,
      enforcementDate: ENFORCEMENT,
      allowlistKeys: ALLOWED_KEYS,
    });
    expect(r.ok).toBe(true);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("historical");
  });
});

describe("the committed frozen allowlist artefact", () => {
  it("loads the committed rms-blob-historical-loss-allowlist.json and is non-empty + keyed exact", () => {
    const keys = loadAllowlistKeys();
    expect(keys.size).toBeGreaterThan(0);
    // Every key is the exact `${recordId} ${documentHash}` composite — a
    // blake3 hash is always present, so every key contains the prefix.
    for (const k of keys) {
      expect(k).toContain(" blake3:");
    }
  });
});
