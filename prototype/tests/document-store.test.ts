// tests/document-store.test.ts
//
// Unit tests for RMS Phase 1 Slice 1 — content-addressed document store.
//
// Spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §4–§5
// Slice: D-RMS-PHASE-1-SLICE-1.
//
// Asserts:
//   - put / get round-trip for text + binary
//   - put is idempotent (same content → same hash → isNew: false on re-put)
//   - hash determinism across runs (known BLAKE3 test vector)
//   - exists returns boolean and never throws
//   - integrity-on-read catches on-disk corruption
//   - parseHash / pathFor reject malformed hashes
//   - sharded layout: <root>/blake3/<first-2>/<rest>
//
// Author: Atlas (Core banking platform architect, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  type DocumentHash,
  DocumentIntegrityError,
  DocumentStoreMissError,
  LocalFsDocumentStore,
  hashContent,
  parseHash,
} from "../platform/document-store";

let tmpRoot: string;
let store: LocalFsDocumentStore;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "rms-doc-store-"));
  store = new LocalFsDocumentStore({ root: tmpRoot });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("LocalFsDocumentStore", () => {
  describe("put / get round-trip", () => {
    it("round-trips a text payload", () => {
      const content = "# Hello, RMS\n\nA short markdown document.\n";
      const result = store.put(content);
      expect(result.isNew).toBe(true);
      expect(result.size).toBe(new TextEncoder().encode(content).length);
      expect(result.algo).toBe("blake3");
      expect(result.hash).toMatch(/^blake3:[0-9a-f]{64}$/);

      const bytes = store.get(result.hash);
      expect(new TextDecoder().decode(bytes)).toBe(content);
    });

    it("round-trips a binary payload", () => {
      const bin = new Uint8Array(256);
      for (let i = 0; i < 256; i++) bin[i] = i;
      const result = store.put(bin);
      expect(result.isNew).toBe(true);
      const got = store.get(result.hash);
      expect(got.length).toBe(256);
      for (let i = 0; i < 256; i++) expect(got[i]).toBe(i);
    });

    it("encodes strings as UTF-8 (matches explicit-bytes hash)", () => {
      const s = "héllo — RMS";
      const bytes = new TextEncoder().encode(s);
      const fromString = store.put(s);
      const fromBytes = store.put(bytes);
      expect(fromString.hash).toBe(fromBytes.hash);
      expect(fromBytes.isNew).toBe(false); // already there from the string put
    });
  });

  describe("idempotency", () => {
    it("re-put of identical content returns same hash and isNew=false", () => {
      const content = "idempotency probe";
      const first = store.put(content);
      const second = store.put(content);
      expect(first.hash).toBe(second.hash);
      expect(first.path).toBe(second.path);
      expect(first.isNew).toBe(true);
      expect(second.isNew).toBe(false);
    });

    it("different content produces different hashes", () => {
      const a = store.put("alpha");
      const b = store.put("beta");
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe("hash determinism (BLAKE3)", () => {
    it("matches the known BLAKE3 test vector for 'hello'", () => {
      // BLAKE3-256 of UTF-8 bytes of "hello":
      //   ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f
      const hash = hashContent("hello");
      expect(hash).toBe(
        "blake3:ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f" as DocumentHash,
      );
    });

    it("hash is stable across separate store instances", () => {
      const s1 = new LocalFsDocumentStore({ root: tmpRoot });
      const s2 = new LocalFsDocumentStore({ root: tmpRoot });
      const h1 = s1.put("stability check").hash;
      const h2 = s2.put("stability check").hash;
      expect(h1).toBe(h2);
    });
  });

  describe("exists", () => {
    it("returns true for stored hash, false for absent hash", () => {
      const { hash } = store.put("present");
      const absent =
        "blake3:0000000000000000000000000000000000000000000000000000000000000000" as DocumentHash;
      expect(store.exists(hash)).toBe(true);
      expect(store.exists(absent)).toBe(false);
    });

    it("never throws on malformed hash — returns false", () => {
      expect(store.exists("not-a-hash" as DocumentHash)).toBe(false);
      expect(store.exists("blake3:zz" as DocumentHash)).toBe(false);
    });
  });

  describe("metadata", () => {
    it("returns size, algo, hash, path, firstSeenAt", () => {
      const content = "metadata probe";
      const { hash, size } = store.put(content);
      const meta = store.metadata(hash);
      expect(meta.hash).toBe(hash);
      expect(meta.size).toBe(size);
      expect(meta.algo).toBe("blake3");
      expect(meta.path).toContain(tmpRoot);
      expect(typeof meta.firstSeenAt).toBe("string");
      expect(meta.firstSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("throws DocumentStoreMissError on absent hash", () => {
      const absent =
        "blake3:0000000000000000000000000000000000000000000000000000000000000000" as DocumentHash;
      expect(() => store.metadata(absent)).toThrow(DocumentStoreMissError);
    });
  });

  describe("get error paths", () => {
    it("throws DocumentStoreMissError on cache miss", () => {
      const absent =
        "blake3:1111111111111111111111111111111111111111111111111111111111111111" as DocumentHash;
      try {
        store.get(absent);
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(DocumentStoreMissError);
        expect((err as DocumentStoreMissError).hash).toBe(absent);
      }
    });

    it("integrity check catches on-disk corruption (verifyOnRead default)", () => {
      const { hash, path } = store.put("integrity probe");
      // Tamper with the file directly.
      writeFileSync(path, "tampered");
      try {
        store.get(hash);
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(DocumentIntegrityError);
        const e = err as DocumentIntegrityError;
        expect(e.expected).toBe(hash);
        expect(e.actual).not.toBe(hash);
      }
    });

    it("verifyOnRead=false skips integrity check", () => {
      const lax = new LocalFsDocumentStore({ root: tmpRoot, verifyOnRead: false });
      const { hash, path } = lax.put("lax probe");
      writeFileSync(path, "tampered");
      // Does not throw — integrity check skipped.
      const got = lax.get(hash);
      expect(new TextDecoder().decode(got)).toBe("tampered");
    });
  });

  describe("path layout", () => {
    it("shards into <root>/<algo>/<first-2>/<rest>", () => {
      const { hash, path } = store.put("layout probe");
      const { algo, hex } = parseHash(hash);
      const expected = join(tmpRoot, algo, hex.slice(0, 2), hex.slice(2));
      expect(path).toBe(expected);
    });
  });

  describe("parseHash validation", () => {
    it("accepts well-formed blake3 hash", () => {
      const valid = "blake3:ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f";
      expect(parseHash(valid)).toEqual({
        algo: "blake3",
        hex: "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f",
      });
    });

    it("rejects missing algo prefix", () => {
      expect(() =>
        parseHash("ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f"),
      ).toThrow();
    });

    it("rejects unsupported algo", () => {
      expect(() => parseHash("md5:abc123")).toThrow(/unsupported hash algo/);
    });

    it("rejects non-hex characters", () => {
      expect(() => parseHash("blake3:zzzz")).toThrow(/malformed hash hex/);
    });

    it("rejects wrong-length blake3 hex", () => {
      expect(() => parseHash("blake3:abcd")).toThrow(/expected 64 hex chars/);
    });
  });

  describe("default-root resolution (regression: prototype/prototype/ leak)", () => {
    // The bug: `LocalFsDocumentStore` previously resolved its default
    // root via `resolve(process.cwd(), "prototype/data/documents")`. From
    // a `bun test` invocation whose cwd is already `prototype/`, that
    // produces `<cwd>/prototype/data/documents/` — i.e. a stray
    // `prototype/prototype/...` tree in the worktree root. The fix
    // anchors the default on the repo root (CLAUDE.md walk-up).
    //
    // This test asserts the default-root path:
    //   (a) is absolute,
    //   (b) ends with exactly `/prototype/data/documents` — not
    //       `/prototype/prototype/data/documents`,
    //   (c) does not start with `<cwd>/prototype` when cwd is already
    //       inside a `prototype/` directory,
    //   (d) instantiating the default store and resolving a path does
    //       NOT create a `prototype/prototype/` directory in cwd.
    it("default root is repo-root-anchored, not cwd-relative", () => {
      const previous = process.env.BANK_DOCUMENT_STORE_PATH;
      try {
        process.env.BANK_DOCUMENT_STORE_PATH = undefined;
        const def = new LocalFsDocumentStore();
        const root = def.rootPath();

        // (a) absolute
        expect(root.startsWith("/")).toBe(true);

        // (b) ends with the expected suffix exactly once
        expect(root.endsWith("/prototype/data/documents")).toBe(true);
        expect(root.includes("/prototype/prototype/")).toBe(false);

        // (c) does not double the prototype segment when cwd is
        //     `prototype/` (which is the canonical bun test cwd)
        const cwd = process.cwd();
        if (cwd.endsWith("/prototype")) {
          expect(root).not.toBe(`${cwd}/prototype/data/documents`);
        }
      } finally {
        if (previous === undefined) {
          process.env.BANK_DOCUMENT_STORE_PATH = undefined;
        } else {
          process.env.BANK_DOCUMENT_STORE_PATH = previous;
        }
      }
    });

    it("constructing the default store does not create a prototype/prototype/ tree in cwd", () => {
      // Tripwire — even if `rootPath()` lies, an actual put would have
      // expressed the leak. We don't `put` here (that would touch the
      // real shared store); we only assert that no `prototype/prototype/`
      // segment exists in cwd after construction. Pre-existing artefacts
      // would already have been cleaned by the e2e suite's afterAll.
      const previous = process.env.BANK_DOCUMENT_STORE_PATH;
      try {
        process.env.BANK_DOCUMENT_STORE_PATH = undefined;
        // Construction is the riskiest step (could `mkdirSync` early on
        // a buggy implementation).
        new LocalFsDocumentStore();
        const leakRoot = resolve(process.cwd(), "prototype", "data", "documents");
        // Only flag if cwd ends in `prototype/` AND the doubled path was
        // newly created. The check guards against false positives in
        // alternative invocation cwds.
        if (process.cwd().endsWith("/prototype")) {
          expect(existsSync(leakRoot)).toBe(false);
        }
      } finally {
        if (previous === undefined) {
          process.env.BANK_DOCUMENT_STORE_PATH = undefined;
        } else {
          process.env.BANK_DOCUMENT_STORE_PATH = previous;
        }
      }
    });
  });

  describe("env-var configuration", () => {
    it("BANK_DOCUMENT_STORE_PATH overrides default root", () => {
      const previous = process.env.BANK_DOCUMENT_STORE_PATH;
      const envRoot = mkdtempSync(join(tmpdir(), "rms-doc-store-env-"));
      try {
        process.env.BANK_DOCUMENT_STORE_PATH = envRoot;
        const fromEnv = new LocalFsDocumentStore();
        expect(fromEnv.rootPath()).toBe(envRoot);
        const { path } = fromEnv.put("env probe");
        expect(path.startsWith(envRoot)).toBe(true);
      } finally {
        if (previous === undefined) {
          process.env.BANK_DOCUMENT_STORE_PATH = undefined;
        } else {
          process.env.BANK_DOCUMENT_STORE_PATH = previous;
        }
        rmSync(envRoot, { recursive: true, force: true });
      }
    });

    it("explicit opts.root overrides env var", () => {
      const previous = process.env.BANK_DOCUMENT_STORE_PATH;
      const envRoot = "/tmp/should-not-win";
      const explicitRoot = mkdtempSync(join(tmpdir(), "rms-doc-store-explicit-"));
      try {
        process.env.BANK_DOCUMENT_STORE_PATH = envRoot;
        const explicit = new LocalFsDocumentStore({ root: explicitRoot });
        expect(explicit.rootPath()).toBe(explicitRoot);
      } finally {
        if (previous === undefined) {
          process.env.BANK_DOCUMENT_STORE_PATH = undefined;
        } else {
          process.env.BANK_DOCUMENT_STORE_PATH = previous;
        }
        rmSync(explicitRoot, { recursive: true, force: true });
      }
    });
  });
});
