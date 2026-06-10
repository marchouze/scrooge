// platform/document-store/resolve-document-store.test.ts
//
// Tests for the shared document-store resolver — the blob-root twin of
// `platform/event-store/resolve-event-db.test.ts`. The precedence matrix
// mirrors the event store's ladder with the extra legacy-alias tier.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { inRepoDocumentStoreRoot, resolveDocumentStoreRoot } from "./resolve-document-store";

// Inputs that fully bypass env defaults — every channel set to a known
// value (string for set, empty-string for not-set). Same base pattern as
// resolve-event-db.test.ts: keeps `process.env` out of the assertions.
const NO_ENV = {
  explicit: "",
  envBankDocumentStore: "",
  envBankDocumentStorePath: "",
  envBankHomeDocumentStore: "",
  home: "",
} as const;

describe("resolveDocumentStoreRoot — precedence chain", () => {
  test("explicit override wins over everything else", () => {
    const r = resolveDocumentStoreRoot({
      ...NO_ENV,
      explicit: "/tmp/custom-docs",
      envBankDocumentStore: "/tmp/env-docs",
      envBankDocumentStorePath: "/tmp/legacy-docs",
      envBankHomeDocumentStore: "/tmp/home-env-docs",
      home: "/Users/x",
    });
    expect(r.source).toBe("explicit");
    expect(r.root).toBe(resolve("/tmp/custom-docs"));
    expect(r.shared).toBe(false);
  });

  test("BANK_DOCUMENT_STORE env wins when no explicit override", () => {
    const r = resolveDocumentStoreRoot({
      ...NO_ENV,
      envBankDocumentStore: "/tmp/env-docs",
      envBankDocumentStorePath: "/tmp/legacy-docs",
      envBankHomeDocumentStore: "/tmp/home-env-docs",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-document-store");
    expect(r.root).toBe(resolve("/tmp/env-docs"));
    // Conservatively non-shared — caller knows what they set.
    expect(r.shared).toBe(false);
  });

  test("legacy BANK_DOCUMENT_STORE_PATH wins below the primary env", () => {
    const r = resolveDocumentStoreRoot({
      ...NO_ENV,
      envBankDocumentStorePath: "/tmp/legacy-docs",
      envBankHomeDocumentStore: "/tmp/home-env-docs",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-document-store-path");
    expect(r.root).toBe(resolve("/tmp/legacy-docs"));
    expect(r.shared).toBe(false);
  });

  test("BANK_HOME_DOCUMENT_STORE env wins over home-default", () => {
    const r = resolveDocumentStoreRoot({
      ...NO_ENV,
      envBankHomeDocumentStore: "/custom/home/documents",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-home-document-store");
    expect(r.root).toBe(resolve("/custom/home/documents"));
    expect(r.shared).toBe(true);
  });

  test("home-default fires when only $HOME is known", () => {
    const r = resolveDocumentStoreRoot({ ...NO_ENV, home: "/Users/marc" });
    expect(r.source).toBe("home-default");
    expect(r.root).toBe(resolve("/Users/marc/.local/share/bank/documents"));
    expect(r.shared).toBe(true);
  });

  test("excludeHomeDefault skips the home tier and lands on the in-repo fallback", () => {
    const r = resolveDocumentStoreRoot({
      ...NO_ENV,
      home: "/Users/marc",
      excludeHomeDefault: true,
    });
    expect(r.source).toBe("fallback");
    expect(r.root).toBe(inRepoDocumentStoreRoot());
    expect(r.shared).toBe(false);
  });

  test("fallback fires when no channel resolves", () => {
    const r = resolveDocumentStoreRoot(NO_ENV);
    expect(r.source).toBe("fallback");
    expect(r.root).toBe(inRepoDocumentStoreRoot());
    expect(r.shared).toBe(false);
  });

  test("fallback root is injectable for tests", () => {
    const r = resolveDocumentStoreRoot({ ...NO_ENV, fallbackRoot: "/tmp/test-fallback" });
    expect(r.source).toBe("fallback");
    expect(r.root).toBe(resolve("/tmp/test-fallback"));
  });

  test("empty / whitespace explicit override is treated as not-supplied", () => {
    const r = resolveDocumentStoreRoot({
      ...NO_ENV,
      explicit: "   ",
      envBankDocumentStore: "/tmp/env-docs",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-document-store");
  });

  test("empty / whitespace env-vars are treated as not-supplied", () => {
    const r = resolveDocumentStoreRoot({
      ...NO_ENV,
      envBankDocumentStore: "",
      envBankDocumentStorePath: "  ",
      envBankHomeDocumentStore: "  ",
      home: "/Users/x",
    });
    expect(r.source).toBe("home-default");
  });

  test("precedence order is stable across all combinations", () => {
    // explicit > BANK_DOCUMENT_STORE > BANK_DOCUMENT_STORE_PATH >
    // BANK_HOME_DOCUMENT_STORE > home-default > fallback
    expect(
      resolveDocumentStoreRoot({
        ...NO_ENV,
        explicit: "/a",
        envBankDocumentStore: "/b",
        envBankDocumentStorePath: "/c",
        envBankHomeDocumentStore: "/d",
        home: "/e",
      }).source,
    ).toBe("explicit");

    expect(
      resolveDocumentStoreRoot({
        ...NO_ENV,
        envBankDocumentStore: "/b",
        envBankDocumentStorePath: "/c",
        envBankHomeDocumentStore: "/d",
        home: "/e",
      }).source,
    ).toBe("env-bank-document-store");

    expect(
      resolveDocumentStoreRoot({
        ...NO_ENV,
        envBankDocumentStorePath: "/c",
        envBankHomeDocumentStore: "/d",
        home: "/e",
      }).source,
    ).toBe("env-bank-document-store-path");

    expect(
      resolveDocumentStoreRoot({
        ...NO_ENV,
        envBankHomeDocumentStore: "/d",
        home: "/e",
      }).source,
    ).toBe("env-bank-home-document-store");

    expect(resolveDocumentStoreRoot({ ...NO_ENV, home: "/e" }).source).toBe("home-default");

    expect(resolveDocumentStoreRoot(NO_ENV).source).toBe("fallback");
  });

  test("paths are resolved to absolute (not bare relative strings)", () => {
    const r = resolveDocumentStoreRoot({ ...NO_ENV, explicit: "relative/docs" });
    expect(r.root.startsWith("/")).toBe(true);
    expect(r.root.endsWith("relative/docs")).toBe(true);
  });

  test("in-repo fallback is repo-root-anchored, never cwd-doubled", () => {
    const root = inRepoDocumentStoreRoot();
    expect(root.startsWith("/")).toBe(true);
    expect(root.endsWith("/prototype/data/documents")).toBe(true);
    expect(root.includes("/prototype/prototype/")).toBe(false);
  });
});

describe("resolveDocumentStoreRoot — env-default reads (no injected inputs)", () => {
  // Snapshot/restore ambient env. Empty string is treated as "not set" by
  // the helper (see `nonEmpty`), so we overwrite with `""` rather than
  // `delete process.env.X` (Biome lint/performance/noDelete).

  interface EnvSnap {
    primary: string | undefined;
    legacy: string | undefined;
    home: string | undefined;
  }

  function snapshotEnv(): EnvSnap {
    return {
      primary: process.env.BANK_DOCUMENT_STORE,
      legacy: process.env.BANK_DOCUMENT_STORE_PATH,
      home: process.env.BANK_HOME_DOCUMENT_STORE,
    };
  }

  function restoreEnv(snap: EnvSnap): void {
    process.env.BANK_DOCUMENT_STORE = snap.primary ?? "";
    process.env.BANK_DOCUMENT_STORE_PATH = snap.legacy ?? "";
    process.env.BANK_HOME_DOCUMENT_STORE = snap.home ?? "";
  }

  test("reads BANK_DOCUMENT_STORE from process.env when not injected", () => {
    const snap = snapshotEnv();
    try {
      process.env.BANK_DOCUMENT_STORE = "/tmp/from-process-env-docs";
      process.env.BANK_DOCUMENT_STORE_PATH = "";
      process.env.BANK_HOME_DOCUMENT_STORE = "";
      const r = resolveDocumentStoreRoot();
      expect(r.source).toBe("env-bank-document-store");
      expect(r.root).toBe(resolve("/tmp/from-process-env-docs"));
    } finally {
      restoreEnv(snap);
    }
  });

  test("reads legacy BANK_DOCUMENT_STORE_PATH from process.env when not injected", () => {
    const snap = snapshotEnv();
    try {
      process.env.BANK_DOCUMENT_STORE = "";
      process.env.BANK_DOCUMENT_STORE_PATH = "/tmp/from-legacy-env-docs";
      process.env.BANK_HOME_DOCUMENT_STORE = "";
      const r = resolveDocumentStoreRoot();
      expect(r.source).toBe("env-bank-document-store-path");
      expect(r.root).toBe(resolve("/tmp/from-legacy-env-docs"));
    } finally {
      restoreEnv(snap);
    }
  });

  test("reads BANK_HOME_DOCUMENT_STORE from process.env when not injected", () => {
    const snap = snapshotEnv();
    try {
      process.env.BANK_DOCUMENT_STORE = "";
      process.env.BANK_DOCUMENT_STORE_PATH = "";
      process.env.BANK_HOME_DOCUMENT_STORE = "/tmp/from-home-env-docs";
      const r = resolveDocumentStoreRoot();
      expect(r.source).toBe("env-bank-home-document-store");
      expect(r.root).toBe(resolve("/tmp/from-home-env-docs"));
    } finally {
      restoreEnv(snap);
    }
  });
});
