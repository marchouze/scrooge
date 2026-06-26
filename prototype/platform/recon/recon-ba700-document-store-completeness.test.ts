// platform/recon/recon-ba700-document-store-completeness.test.ts
//
// Sabotage-proof tests for recon:ba700-document-store-completeness. The gate's
// reason for existing (Principle 1): every BA 700 return-of-record has its full
// rendered SARB XML envelope filed in the RMS document store AND the filed blob
// resolves in the store the regulator-reproduction / dashboard read path reads.
//
//   - PASS-on-match: a return with a filed record whose blob resolves → 0 viol.
//   - BITES (fail) when the filing is MISSING (no RecordFiled for the return).
//   - BITES (fail) when the blob resolves in NO store (cited bytes gone).
//   - BITES (fail) when the blob resolves ONLY in the per-worktree store — the
//     writer→reader divergence the naive `excludeHomeDefault` gate is blind to.
//   - Read-path-resolution tests prove the gate resolves its primary store the
//     home-default-ENABLED way (like the reader), never the per-worktree singleton.
//   - Empty state → asserted 0, ok=true.
//
// Authority: D-BA-RETURN-OF-RECORD-DOCUMENT-STORE; D-RMS-PHASE-1; Engineering
//   Charter cmd 2 (fail-closed).

import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

import {
  inRepoDocumentStoreRoot,
  resolveDocumentStoreRoot,
} from "../document-store/resolve-document-store";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import { ba700ArtefactRecordId } from "../returns/ba700/report-of-record";
import {
  type Ba700ReturnRow,
  assertBa700ArtefactsFiled,
  readPathDocumentStoreRoot,
} from "./recon-ba700-document-store-completeness";

const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD = "period:hoz-bank:month:2026-05";
const HASH = `blake3:${"b".repeat(64)}` as DocumentHash;

const RETURN: Ba700ReturnRow = { entity: ENTITY, reportingPeriod: PERIOD };

function filedRecord(documentHash: string) {
  return { recordId: ba700ArtefactRecordId(ENTITY, PERIOD), documentHash };
}

/** A stub store whose `exists` returns true only for the seeded hashes. */
function stubStore(present: Set<string>): DocumentStore {
  return {
    put: () => {
      throw new Error("not used");
    },
    get: () => {
      throw new Error("not used");
    },
    exists: (h: DocumentHash) => present.has(h),
    metadata: () => {
      throw new Error("not used");
    },
  };
}

describe("assertBa700ArtefactsFiled", () => {
  it("filed record present + blob resolves in read-path store → zero violations, one asserted", () => {
    const r = assertBa700ArtefactsFiled(
      [RETURN],
      [filedRecord(HASH)],
      stubStore(new Set([HASH])),
      null,
    );
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(1);
  });

  it("BITES (fail) when NO RecordFiled exists for the return", () => {
    const r = assertBa700ArtefactsFiled([RETURN], [], stubStore(new Set()), null);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations[0]?.message).toContain("NO filed rendered artefact");
  });

  it("BITES (fail) when the filed blob resolves in NO store", () => {
    const r = assertBa700ArtefactsFiled(
      [RETURN],
      [filedRecord(HASH)],
      stubStore(new Set()),
      null,
    );
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations[0]?.message).toContain("resolves in NO document store");
  });

  it("BITES (fail) when the blob resolves ONLY in the per-worktree store — writer→reader divergence", () => {
    // read-path store EMPTY, per-worktree store HAS the blob → the handler filed
    // per-worktree while the reader reads the shared store. Fail-closed, not warn.
    const r = assertBa700ArtefactsFiled(
      [RETURN],
      [filedRecord(HASH)],
      stubStore(new Set()),
      stubStore(new Set([HASH])),
    );
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.severity === "warn")).toBe(false);
    expect(r.violations[0]?.message).toContain("DIVERGENCE");
  });

  it("empty store + zero returns → ok, asserted 0", () => {
    const r = assertBa700ArtefactsFiled([], [], stubStore(new Set()), null);
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(0);
  });
});

describe("readPathDocumentStoreRoot — models the reader read path, not the per-worktree singleton", () => {
  it("honors BANK_DOCUMENT_STORE (the env tier the read-path boot shim sets)", () => {
    const saved = process.env.BANK_DOCUMENT_STORE;
    try {
      process.env.BANK_DOCUMENT_STORE = "/tmp/ba700-read-path-docs";
      expect(readPathDocumentStoreRoot()).toBe(resolve("/tmp/ba700-read-path-docs"));
    } finally {
      if (saved === undefined) {
        // biome-ignore lint/performance/noDelete: env-var cleanup needs delete for true absence
        delete process.env.BANK_DOCUMENT_STORE;
      } else {
        process.env.BANK_DOCUMENT_STORE = saved;
      }
    }
  });

  it("is home-default-ENABLED: the read-path root diverges from the excludeHomeDefault singleton when no env is set", () => {
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
