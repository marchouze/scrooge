// scripts/migrate/migrate-document-store-blobs-to-shared.test.ts
//
// Tests for the in-repo → shared document-store blob migration:
//   - copies all source blobs, hash-verified;
//   - idempotent (second run copies 0);
//   - re-runnable against a moving source (a blob added between runs —
//     the parallel-Vera-writer case — is picked up by the next run);
//   - corruption is reported and never propagated;
//   - the source store is NEVER mutated.
//
// Author: Atlas (Core banking platform architect, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { LocalFsDocumentStore } from "../../platform/document-store/local-fs";
import type { DocumentHash } from "../../platform/document-store/types";
import { migrateDocumentStoreBlobs } from "./migrate-document-store-blobs-to-shared";

let sourceRoot: string;
let destRoot: string;
let sourceStore: LocalFsDocumentStore;

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

beforeEach(() => {
  sourceRoot = mkdtempSync(join(tmpdir(), "doc-migrate-src-"));
  destRoot = mkdtempSync(join(tmpdir(), "doc-migrate-dst-"));
  sourceStore = new LocalFsDocumentStore({ root: sourceRoot });
});

afterEach(() => {
  rmSync(sourceRoot, { recursive: true, force: true });
  rmSync(destRoot, { recursive: true, force: true });
});

describe("migrateDocumentStoreBlobs", () => {
  it("copies every source blob into the destination, hash-verified", () => {
    const a = sourceStore.put("alpha document body");
    const b = sourceStore.put("bravo document body");
    const c = sourceStore.put(new Uint8Array([0, 1, 2, 3, 255]));

    const summary = migrateDocumentStoreBlobs({ sourceRoot, destRoot });

    expect(summary.scanned).toBe(3);
    expect(summary.copied).toBe(3);
    expect(summary.alreadyPresent).toBe(0);
    expect(summary.issues).toHaveLength(0);
    expect(summary.ok).toBe(true);

    const destStore = new LocalFsDocumentStore({ root: destRoot });
    for (const put of [a, b, c]) {
      expect(destStore.exists(put.hash)).toBe(true);
      // verifyOnRead is on by default — a successful get proves integrity.
      expect(destStore.get(put.hash).length).toBeGreaterThan(0);
    }
  });

  it("is idempotent — a second run copies nothing", () => {
    sourceStore.put("first");
    sourceStore.put("second");

    const first = migrateDocumentStoreBlobs({ sourceRoot, destRoot });
    expect(first.copied).toBe(2);

    const second = migrateDocumentStoreBlobs({ sourceRoot, destRoot });
    expect(second.scanned).toBe(2);
    expect(second.copied).toBe(0);
    expect(second.alreadyPresent).toBe(2);
    expect(second.ok).toBe(true);
  });

  it("picks up blobs written into the source between runs (parallel-writer case)", () => {
    sourceStore.put("pre-existing blob");
    const first = migrateDocumentStoreBlobs({ sourceRoot, destRoot });
    expect(first.copied).toBe(1);

    // Vera's rescue run writes a new blob into the in-repo store after
    // the first migration pass.
    const late = sourceStore.put("blob rescued mid-flight");

    const second = migrateDocumentStoreBlobs({ sourceRoot, destRoot });
    expect(second.copied).toBe(1);
    expect(second.alreadyPresent).toBe(1);
    expect(new LocalFsDocumentStore({ root: destRoot }).exists(late.hash)).toBe(true);
  });

  it("never mutates the source store", () => {
    sourceStore.put("untouchable one");
    sourceStore.put("untouchable two");

    const before = listFilesRecursive(sourceRoot)
      .sort()
      .map((p) => ({ p, bytes: readFileSync(p).toString("hex") }));

    migrateDocumentStoreBlobs({ sourceRoot, destRoot });
    migrateDocumentStoreBlobs({ sourceRoot, destRoot });

    const after = listFilesRecursive(sourceRoot)
      .sort()
      .map((p) => ({ p, bytes: readFileSync(p).toString("hex") }));

    expect(after).toEqual(before);
  });

  it("reports corrupt source blobs and refuses to copy them", () => {
    const good = sourceStore.put("good blob");
    const bad = sourceStore.put("will be corrupted");
    // Corrupt the second blob in place (simulates bit-rot or a parallel
    // writer's half-written file).
    writeFileSync(sourceStore.pathFor(bad.hash), "tampered bytes");

    const summary = migrateDocumentStoreBlobs({ sourceRoot, destRoot });

    expect(summary.copied).toBe(1);
    expect(summary.issues).toHaveLength(1);
    expect(summary.issues[0]?.kind).toBe("corrupt-source");
    expect(summary.issues[0]?.hash).toBe(bad.hash);
    expect(summary.ok).toBe(false);

    const destStore = new LocalFsDocumentStore({ root: destRoot });
    expect(destStore.exists(good.hash)).toBe(true);
    expect(destStore.exists(bad.hash)).toBe(false);
  });

  it("reports a corrupt destination blob and does not overwrite it", () => {
    const put = sourceStore.put("canonical bytes");
    // Pre-seed the destination with WRONG bytes at the same hash path.
    const destStore = new LocalFsDocumentStore({ root: destRoot });
    const destPath = destStore.pathFor(put.hash);
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, "imposter bytes");

    const summary = migrateDocumentStoreBlobs({ sourceRoot, destRoot });

    expect(summary.copied).toBe(0);
    expect(summary.issues).toHaveLength(1);
    expect(summary.issues[0]?.kind).toBe("corrupt-dest");
    expect(summary.ok).toBe(false);
    // Not overwritten — surfaced for investigation instead.
    expect(readFileSync(destPath, "utf-8")).toBe("imposter bytes");
  });

  it("ignores non-blob files (e.g. .gitkeep, temp droppings)", () => {
    sourceStore.put("real blob");
    writeFileSync(join(sourceRoot, ".gitkeep"), "");

    const summary = migrateDocumentStoreBlobs({ sourceRoot, destRoot });
    expect(summary.scanned).toBe(1);
    expect(summary.copied).toBe(1);
    expect(summary.ignored).toBeGreaterThanOrEqual(1);
    expect(summary.ok).toBe(true);
  });

  it("handles a missing source root as an empty migration", () => {
    const summary = migrateDocumentStoreBlobs({
      sourceRoot: join(sourceRoot, "does-not-exist"),
      destRoot,
    });
    expect(summary.scanned).toBe(0);
    expect(summary.copied).toBe(0);
    expect(summary.ok).toBe(true);
  });

  it("refuses to run when source and destination are the same root", () => {
    expect(() => migrateDocumentStoreBlobs({ sourceRoot, destRoot: sourceRoot })).toThrow(
      /same root/,
    );
  });

  it("round-trips bytes exactly (binary-safe)", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const put = sourceStore.put(bytes);

    migrateDocumentStoreBlobs({ sourceRoot, destRoot });

    const destStore = new LocalFsDocumentStore({ root: destRoot });
    const out = destStore.get(put.hash as DocumentHash);
    expect(Array.from(out)).toEqual(Array.from(bytes));
  });
});
