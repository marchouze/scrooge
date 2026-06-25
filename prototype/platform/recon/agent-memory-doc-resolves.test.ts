// platform/recon/agent-memory-doc-resolves.test.ts
//
// Sabotage-proof tests for recon:agent-memory-doc-resolves. The gate's reason
// for existing is P1: every AgentMemoryCommitted's bodyDocumentHash resolves to
// bytes. The negative test points at an empty store and proves the gate FAILS;
// the legacy-tier test proves a present-in-legacy blob is a `warn`, not a `fail`.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 1.

import { describe, expect, it } from "bun:test";

import type { DocumentHash, DocumentStore } from "../document-store/types";
import type { Event } from "../event-store/types";
import { assertDocResolves } from "./agent-memory-doc-resolves";

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

  it("blob present only in legacy store → warn, not fail", () => {
    const ev = memoryEvent("memory:legacy", HASH);
    const r = assertDocResolves([ev], stubStore(new Set()), stubStore(new Set([HASH])));
    expect(r.violations.some((v) => v.severity === "warn")).toBe(true);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(false);
  });

  it("empty store + zero memories → ok, asserted 0", () => {
    const r = assertDocResolves([], stubStore(new Set()), null);
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(0);
  });
});
