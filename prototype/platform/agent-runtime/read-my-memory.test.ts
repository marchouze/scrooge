// platform/agent-runtime/read-my-memory.test.ts
//
// Unit tests for the read-at-dispatch core (WS-AGENT-MEMORY Slice 2):
//   - mandate∪shared filter (in-mandate + shared returned, unrelated not),
//   - --domains override (no auto-shared),
//   - deterministic sort independent of event order,
//   - honest body resolution (resolved + unresolved),
//   - fail-closed on an unknown agent (no opts.domains override).
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 2.

import { describe, expect, it } from "bun:test";

import type { DocumentHash, DocumentMetadata, DocumentStore } from "../document-store/types";
import { makeAgentMemoryCommitted } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import { readMyMemory, selectMyMemory } from "./read-my-memory";

class StubStore implements DocumentStore {
  private readonly bodies = new Map<string, string>();
  seed(hash: string, body: string): this {
    this.bodies.set(hash, body);
    return this;
  }
  put(): never {
    throw new Error("not used");
  }
  get(hash: DocumentHash): Uint8Array {
    const b = this.bodies.get(hash);
    if (b === undefined) throw new Error(`miss ${hash}`);
    return new TextEncoder().encode(b);
  }
  exists(hash: DocumentHash): boolean {
    return this.bodies.has(hash);
  }
  metadata(hash: DocumentHash): DocumentMetadata {
    return { hash, path: `mem://${hash}`, size: 0, algo: "blake3", firstSeenAt: "2026-06-25T00:00:00.000Z" };
  }
}

function ev(memoryId: string, domains: string[], hash: string, asOf: string): Event {
  return makeAgentMemoryCommitted({
    asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:atlas" },
    citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    payload: {
      memoryId,
      domains,
      producedByAgent: { name: "Atlas", position: "Core banking platform architect", agentId: "agent:atlas" },
      producedByRunId: "run:x",
      title: memoryId,
      bodyDocumentHash: hash as DocumentHash,
      citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    },
  });
}

const H1 = `blake3:${"1".repeat(64)}`;
const H2 = `blake3:${"2".repeat(64)}`;
const H3 = `blake3:${"3".repeat(64)}`;

describe("readMyMemory — mandate∪shared filter", () => {
  it("agent:atlas (mandate platform) gets in-mandate + shared, NOT unrelated", () => {
    const store = new StubStore().seed(H1, "in").seed(H2, "sh").seed(H3, "un");
    const events = [
      ev("m:platform", ["platform"], H1, "2026-06-25T00:00:01.000Z"),
      ev("m:shared", ["shared"], H2, "2026-06-25T00:00:02.000Z"),
      ev("m:credit", ["credit-risk"], H3, "2026-06-25T00:00:03.000Z"),
    ];
    const rows = readMyMemory("agent:atlas", { events, documentStore: store });
    const ids = rows.map((r) => r.memoryId);
    expect(ids).toContain("m:platform");
    expect(ids).toContain("m:shared");
    expect(ids).not.toContain("m:credit");
  });

  it("--domains override uses exactly those domains (no auto-shared)", () => {
    const store = new StubStore().seed(H1, "in").seed(H2, "sh");
    const events = [
      ev("m:platform", ["platform"], H1, "2026-06-25T00:00:01.000Z"),
      ev("m:shared", ["shared"], H2, "2026-06-25T00:00:02.000Z"),
    ];
    const rows = readMyMemory("agent:atlas", { events, documentStore: store }, { domains: ["platform"] });
    const ids = rows.map((r) => r.memoryId);
    expect(ids).toEqual(["m:platform"]); // shared NOT auto-added in override mode
  });

  it("deterministic sort — same rows regardless of event order", () => {
    const store = new StubStore().seed(H1, "a").seed(H2, "b");
    const a = [ev("m:a", ["platform"], H1, "2026-06-25T00:00:01.000Z"), ev("m:b", ["shared"], H2, "2026-06-25T00:00:02.000Z")];
    const r1 = readMyMemory("agent:atlas", { events: a, documentStore: store });
    const r2 = readMyMemory("agent:atlas", { events: [...a].reverse(), documentStore: store });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("body resolution is honest — resolved when present, null/false when missing", () => {
    const store = new StubStore().seed(H1, "present body"); // H2 deliberately not seeded
    const rows = selectMyMemory(
      ["platform", "shared"],
      [
        // synthetic heads
        { memoryId: "m:ok", title: "t", domains: ["platform"], citations: ["c"], producedByAgent: { name: "Atlas", position: "p", agentId: "agent:atlas" }, producedByRunId: "r", bodyDocumentHash: H1, supersedes: null, supersededBy: null, committedAt: "2026-06-25T00:00:01.000Z", committedEventId: "e1" },
        { memoryId: "m:gone", title: "t", domains: ["shared"], citations: ["c"], producedByAgent: { name: "Atlas", position: "p", agentId: "agent:atlas" }, producedByRunId: "r", bodyDocumentHash: H2, supersedes: null, supersededBy: null, committedAt: "2026-06-25T00:00:02.000Z", committedEventId: "e2" },
      ],
      store,
    );
    const ok = rows.find((r) => r.memoryId === "m:ok");
    const gone = rows.find((r) => r.memoryId === "m:gone");
    expect(ok?.bodyResolved).toBe(true);
    expect(ok?.body).toBe("present body");
    expect(gone?.bodyResolved).toBe(false);
    expect(gone?.body).toBe(null);
  });

  it("fail-closed — unknown agent with no opts.domains throws", () => {
    const store = new StubStore();
    expect(() => readMyMemory("agent:does-not-exist", { events: [], documentStore: store })).toThrow();
  });

  it("unknown agent WITH opts.domains does NOT throw (off-roster lens)", () => {
    const store = new StubStore().seed(H1, "x");
    const events = [ev("m:x", ["platform"], H1, "2026-06-25T00:00:01.000Z")];
    const rows = readMyMemory("agent:does-not-exist", { events, documentStore: store }, { domains: ["platform"] });
    expect(rows.map((r) => r.memoryId)).toEqual(["m:x"]);
  });
});
