// platform/agent-runtime/world-state-my-memory.test.ts
//
// L3-AGENTS — autonomous agent-memory read-hook, live end-to-end.
//
// Proves the wiring that makes `WorldStateSnapshot.myMemory` populate from the
// paired document store at runtime (the documentStore injected into
// `LocalAgentWorldStateReader`), and that the autonomous read and the manual
// `dispatch:recall` cannot diverge — both go through the single `readMyMemory`
// path.
//
// Assertions:
//   1. WIRED: a snapshot built WITH a doc store surfaces the agent's
//      mandate∪shared memory slice (non-empty given seeded memories), and NOT
//      another mandate's memory (the federation filter holds end-to-end).
//   2. PARITY: `snapshot.myMemory` byte-equals `readMyMemory(agentUrn, …)` over
//      the same events + doc store — the autonomous read === the manual recall.
//   3. SURFACED: the snapshotHash incorporates the loaded memory ids (the slice
//      is part of the materialised iteration state, not a side read).
//   4. FAIL-CLOSED DISTINCTION: a snapshot built WITHOUT a doc store yields an
//      empty slice (read-at-dispatch off) — distinguishable from "legitimately
//      no memories", and the rest of the snapshot is unaffected.
//   5. GOAL-LOOP TRACE: a goal-loop iteration emits AgentGoalEvaluated carrying
//      `myMemoryCount` equal to the loaded slice size — the typed record that
//      the memory was surfaced into the iteration's reasoning context.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25);
//   D-SCROOGE-RECALL-BEFORE-DISPATCH; D-CROSS-WORKTREE-EVENT-STORE-SYNC.
//   Engineering Charter cmd 2 (fail-closed). Principle 1 (events canonical).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import type { DocumentHash, DocumentMetadata, DocumentStore } from "../document-store/types";
import { makeAgentMemoryCommitted } from "../event-store/event-types";
import { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import {
  type GoalDeriver,
  LocalAgentGoalLoopRunner,
  type RunWithGoalArgs,
} from "./goal-loop";
import { readMyMemory } from "./read-my-memory";
import { parseSpecFile } from "./spec-parser";
import { LocalAgentWorldStateReader } from "./world-state";

import { resolve } from "node:path";

const ATLAS_SPEC_PATH = resolve(import.meta.dir, "..", "..", "..", "Team", "Atlas.md");

const ENTITY = "LE-ZA-HOZ-BANK";

/** In-memory doc store — no FS, deterministic, clean-store green by construction. */
class StubStore implements DocumentStore {
  private readonly bodies = new Map<string, string>();
  seed(hash: string, body: string): this {
    this.bodies.set(hash, body);
    return this;
  }
  put(): never {
    throw new Error("not used in this test");
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
    return { hash, path: `mem://${hash}`, size: 0, algo: "blake3", firstSeenAt: "2026-06-28T00:00:00.000Z" };
  }
}

function memoryEvent(memoryId: string, domains: string[], hash: string, asOf: string): Event {
  return makeAgentMemoryCommitted({
    asOf,
    entity: ENTITY,
    actor: { type: "service", id: "agent:atlas" },
    citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    payload: {
      memoryId,
      domains,
      producedByAgent: {
        name: "Atlas",
        position: "Core banking platform architect",
        agentId: "agent:atlas",
      },
      producedByRunId: "run:seed",
      title: memoryId,
      bodyDocumentHash: hash as DocumentHash,
      citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    },
  });
}

const H_PLATFORM = `blake3:${"a".repeat(64)}`;
const H_SHARED = `blake3:${"b".repeat(64)}`;
const H_CREDIT = `blake3:${"c".repeat(64)}`;

// agent:atlas mandateDomains = ["data","platform","security"] ∪ {shared}.
function seededStore(): { store: EventStore; docStore: StubStore } {
  const store = new EventStore(":memory:");
  store.append(memoryEvent("m:platform", ["platform"], H_PLATFORM, "2026-06-28T00:00:01.000Z"));
  store.append(memoryEvent("m:shared", ["shared"], H_SHARED, "2026-06-28T00:00:02.000Z"));
  store.append(memoryEvent("m:credit", ["credit-risk"], H_CREDIT, "2026-06-28T00:00:03.000Z"));
  const docStore = new StubStore()
    .seed(H_PLATFORM, "platform lesson body")
    .seed(H_SHARED, "shared common-core body")
    .seed(H_CREDIT, "credit-risk body");
  return { store, docStore };
}

describe("WorldStateSnapshot.myMemory — autonomous read-hook live", () => {
  it("populates the mandate∪shared slice when a doc store is wired (gap (a) closed)", () => {
    const { store, docStore } = seededStore();
    const reader = new LocalAgentWorldStateReader({
      eventStore: store,
      entity: ENTITY,
      documentStore: docStore,
    });

    const snapshot = reader.snapshot("agent:atlas");
    const ids = snapshot.myMemory.map((m) => m.memoryId);

    expect(snapshot.myMemory.length).toBeGreaterThan(0);
    expect(ids).toContain("m:platform"); // in-mandate
    expect(ids).toContain("m:shared"); // reserved shared tier
    expect(ids).not.toContain("m:credit"); // another mandate — federation filter holds
    // bodies resolved honestly from the paired store
    const platformRow = snapshot.myMemory.find((m) => m.memoryId === "m:platform");
    expect(platformRow?.bodyResolved).toBe(true);
    expect(platformRow?.body).toBe("platform lesson body");
  });

  it("PARITY: snapshot.myMemory equals readMyMemory over the same events + store (single shared path)", () => {
    const { store, docStore } = seededStore();
    const reader = new LocalAgentWorldStateReader({
      eventStore: store,
      entity: ENTITY,
      documentStore: docStore,
    });

    const snapshotSlice = reader.snapshot("agent:atlas").myMemory;
    // The MANUAL recall path: readMyMemory directly (this is what dispatch:recall calls).
    const events = [...store.replay({ entity: ENTITY })];
    const manualSlice = readMyMemory("agent:atlas", { events, documentStore: docStore });

    // Byte-identical — the autonomous read and the manual recall cannot diverge.
    expect(JSON.stringify(snapshotSlice)).toBe(JSON.stringify(manualSlice));
  });

  it("SURFACED: the loaded memory ids feed the single snapshotHash", () => {
    const { store, docStore } = seededStore();
    const wired = new LocalAgentWorldStateReader({
      eventStore: store,
      entity: ENTITY,
      documentStore: docStore,
    }).snapshot("agent:atlas");
    const bare = new LocalAgentWorldStateReader({ eventStore: store, entity: ENTITY }).snapshot(
      "agent:atlas",
    );
    // A snapshot WITH a non-empty memory slice hashes differently from one with
    // no slice — the slice is part of the materialised iteration state.
    expect(wired.snapshotHash).not.toBe(bare.snapshotHash);
  });

  it("FAIL-CLOSED DISTINCTION: no doc store wired → empty slice (read-at-dispatch off), not a crash", () => {
    const { store } = seededStore();
    const reader = new LocalAgentWorldStateReader({ eventStore: store, entity: ENTITY });
    const snapshot = reader.snapshot("agent:atlas");
    // Empty slice — distinguishable from "legitimately no memories" by the
    // presence of AgentMemoryCommitted events the reader DID observe.
    expect(snapshot.myMemory).toEqual([]);
    expect(snapshot.recentEvents.some((e) => e.type === "AgentMemoryCommitted")).toBe(true);
  });

  it("GOAL-LOOP TRACE: an iteration emits AgentGoalEvaluated with myMemoryCount = loaded slice size", async () => {
    const { store, docStore } = seededStore();
    const reader = new LocalAgentWorldStateReader({
      eventStore: store,
      entity: ENTITY,
      documentStore: docStore,
    });
    const worldState = reader.snapshot("agent:atlas");
    expect(worldState.myMemory.length).toBeGreaterThan(0);

    // Parse Atlas's real operating spec (the runtime path does the same); the
    // deriver returns null (defers) so we exercise only the AgentGoalEvaluated
    // emission path — which is where myMemoryCount is recorded.
    const parsed = parseSpecFile(ATLAS_SPEC_PATH);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    const { spec } = parsed;

    const runner = new LocalAgentGoalLoopRunner({ eventStore: store, entity: ENTITY });
    const args: RunWithGoalArgs = {
      agent: { urn: "agent:atlas", publicKeyVersion: 1 },
      spec,
      worldState,
      recentRuns: [],
    };
    const deriver: GoalDeriver = async () => null;
    await runner.runWithGoal(args, deriver);

    const evaluated = [...store.replay({ type: "AgentGoalEvaluated", entity: ENTITY })];
    expect(evaluated.length).toBeGreaterThan(0);
    const last = evaluated[evaluated.length - 1];
    const payload = last?.payload as Record<string, unknown>;
    expect(payload.myMemoryCount).toBe(worldState.myMemory.length);
  });
});
