// platform/recon/agent-memory-citation-integrity.test.ts
//
// Sabotage-proof tests for recon:agent-memory-citation-integrity. The gate's
// reason for existing is P2: every AgentMemoryCommitted carries ≥1 citation. The
// negative test plants a citation-less memory and proves the gate FAILS.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 1.

import { describe, expect, it } from "bun:test";

import type { Event } from "../event-store/types";
import { assertCitationIntegrity, run } from "./agent-memory-citation-integrity";

function memoryEvent(opts: {
  memoryId: string;
  envelopeCitations: string[];
  payloadCitations: string[];
}): Event {
  // Built by hand (NOT via the schema factory) so the negative test can plant a
  // citation-less row the factory would have rejected — proving the standing
  // gate is a real second line, not a restatement of the constructor.
  return {
    event_id: `ev:${opts.memoryId}`,
    type: "AgentMemoryCommitted",
    as_of: "2026-06-25T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:atlas" },
    citations: opts.envelopeCitations,
    payload: {
      memoryId: opts.memoryId,
      domains: ["engineering"],
      producedByAgent: { name: "Atlas", position: "Core banking platform architect" },
      producedByRunId: "run:x",
      title: "t",
      bodyDocumentHash: `blake3:${"0".repeat(64)}`,
      citations: opts.payloadCitations,
    },
  } as unknown as Event;
}

describe("assertCitationIntegrity", () => {
  it("a fully-cited memory → zero violations, one asserted", () => {
    const ev = memoryEvent({
      memoryId: "memory:ok",
      envelopeCitations: ["D-AGENT-MEMORY-PERSISTENCE"],
      payloadCitations: ["D-AGENT-MEMORY-PERSISTENCE"],
    });
    const r = assertCitationIntegrity([ev], "fail");
    expect(r.violations.length).toBe(0);
    expect(r.asserted).toBe(1);
  });

  it("BITES on an empty envelope citation set", () => {
    const ev = memoryEvent({
      memoryId: "memory:no-env",
      envelopeCitations: [],
      payloadCitations: ["D-AGENT-MEMORY-PERSISTENCE"],
    });
    const r = assertCitationIntegrity([ev], "fail");
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("BITES on an empty payload citation set (the federation-facing copy)", () => {
    const ev = memoryEvent({
      memoryId: "memory:no-payload",
      envelopeCitations: ["D-AGENT-MEMORY-PERSISTENCE"],
      payloadCitations: [],
    });
    const r = assertCitationIntegrity([ev], "fail");
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("ignores non-family events", () => {
    const other = {
      ...memoryEvent({ memoryId: "x", envelopeCitations: [], payloadCitations: [] }),
      type: "SomethingElse",
    } as Event;
    const r = assertCitationIntegrity([other], "fail");
    expect(r.asserted).toBe(0);
    expect(r.violations.length).toBe(0);
  });
});

describe("recon:agent-memory-citation-integrity empty-state", () => {
  it("zero memories → ok, asserted 0", () => {
    const result = run({ memoryEvents: [] });
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(0);
  });
});
