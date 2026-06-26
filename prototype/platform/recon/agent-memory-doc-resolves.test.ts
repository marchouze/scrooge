// platform/recon/agent-memory-doc-resolves.test.ts
//
// Sabotage-proof tests for recon:agent-memory-doc-resolves. The gate's reason
// for existing is P1: every AgentMemoryCommitted's bodyDocumentHash resolves to
// bytes IN THE STORE dispatch:recall reads. The negative test points at an empty
// store and proves the gate FAILS; the divergence test proves a body present
// ONLY in the per-worktree in-repo store (but not the read-path store recall
// reads) is a fail-closed `fail` — the backfill→recall divergence in the
// shared-home topology. The read-path-resolution tests prove the gate resolves
// its primary store the home-default-ENABLED way (like recall), never the
// per-worktree `excludeHomeDefault` singleton.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 1; Engineering
//   Charter cmd 2 (fail-closed).

import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

import {
  inRepoDocumentStoreRoot,
  resolveDocumentStoreRoot,
} from "../document-store/resolve-document-store";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import type { Event } from "../event-store/types";
import { assertDocResolves, readPathDocumentStoreRoot } from "./agent-memory-doc-resolves";

const HASH = `blake3:${"a".repeat(64)}` as DocumentHash;

function memoryEvent(memoryId: string, hash: string): Event {
  return {
    event_id: `ev:${memoryId}`,
    type: "AgentMemoryCommitted",
    as_of: "2026-06-25T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:atlas" },
    citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    payload: {
      memoryId,
      domains: ["engineering"],
      producedByAgent: { name: "Atlas", position: "Core banking platform architect" },
      producedByRunId: "run:x",
      title: "t",
      bodyDocumentHash: hash,
      citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    },
  } as unknown as Event;
}

/** A stub store whose `exists` returns true only for the hashes it was seeded with. */
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

describe("assertDocResolves", () => {
  it("blob present in resolved store → zero violations, one asserted", () => {
    const ev = memoryEvent("memory:ok", HASH);
    const r = assertDocResolves([ev], stubStore(new Set([HASH])), null);
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(1);
  });

  it("BITES (fail) when the blob resolves in NO store", () => {
    const ev = memoryEvent("memory:gone", HASH);
    const r = assertDocResolves([ev], stubStore(new Set()), null);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("BITES (fail) when the blob resolves ONLY in the per-worktree store — backfill→recall divergence", () => {
    const ev = memoryEvent("memory:diverged", HASH);
    // read-path store EMPTY, per-worktree store HAS the blob → the writer wrote
    // per-worktree while recall reads the shared store. Fail-closed, not warn.
    const r = assertDocResolves([ev], stubStore(new Set()), stubStore(new Set([HASH])));
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.severity === "warn")).toBe(false);
    expect(r.violations[0]?.message).toContain("DIVERGENCE");
  });

  it("empty store + zero memories → ok, asserted 0", () => {
    const r = assertDocResolves([], stubStore(new Set()), null);
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(0);
  });
});

describe("readPathDocumentStoreRoot — models the recall read path, not the per-worktree singleton", () => {
  it("honors BANK_DOCUMENT_STORE (the env tier the recall boot shim sets)", () => {
    const saved = process.env.BANK_DOCUMENT_STORE;
    try {
      process.env.BANK_DOCUMENT_STORE = "/tmp/recall-read-path-docs";
      expect(readPathDocumentStoreRoot()).toBe(resolve("/tmp/recall-read-path-docs"));
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
    // The crux the gate depends on: with no doc-store env set, the READ path
    // (recall / this gate's primary store) resolves to the shared HOME store,
    // while the per-worktree `excludeHomeDefault` singleton resolves to the
    // in-repo fallback. If the gate used the singleton it would be BLIND to a
    // backfill that wrote per-worktree while recall reads the shared store.
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
