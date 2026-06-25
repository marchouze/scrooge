// platform/recon/agent-memory-recall-determinism.ts
//
// recon:agent-memory-recall-determinism — WS-AGENT-MEMORY Slice 2 read-path gate.
//
// THE INVARIANT (fail-closed): `readMyMemory` is the read-at-dispatch primitive
// (and the code path behind `WorldStateSnapshot.myMemory` AND `dispatch:recall`).
// It MUST be (a) DETERMINISTIC — same store, same rows, same order, every call —
// and (b) MANDATE-CORRECT — it returns exactly the live heads whose domains
// intersect the agent's `mandateDomains` ∪ `{shared}`, and NOTHING else. A
// non-deterministic recall makes the snapshotHash unstable; a leaky filter shows
// an agent another mandate's memory (a federation breach).
//
// HOW IT RUNS (behavioural, not string-grep): it constructs a deterministic
// in-memory event store + doc store seeded with three memories —
//   - one tagged the agent's mandate domain        → MUST be returned,
//   - one tagged ONLY the reserved `shared` tag     → MUST be returned,
//   - one tagged ONLY an unrelated domain (not shared, not in mandate)
//                                                   → MUST NOT be returned,
// then asserts:
//   1. two back-to-back `readMyMemory` calls return byte-identical results
//      (determinism — including a shuffled second event order yielding the same
//      sorted output),
//   2. the in-mandate memory IS present,
//   3. the shared-only memory IS present,
//   4. the unrelated memory is NOT present (the mandate∪shared filter holds).
//
// NEGATIVE TEST (sabotage-proof, in the .test): the pure assertion core flags a
// filter that leaks the unrelated memory, drops the in-mandate or shared memory,
// or returns a non-deterministic order.
//
// SEVERITY: ENFORCING — the read path ships this slice, so a clean tree passes;
// any regression in determinism or the filter is a real break.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 2; brief:atlas:ws-agent-memory-slice-2-read-at-dispatch-mandate:2026-06-25.
//   Engineering Charter cmd 2 (fail-closed). Principle 1 (events canonical).
// Author: Atlas (Core banking platform architect, engineering).

import { type AgentMemoryRow, readMyMemory } from "../agent-runtime/read-my-memory";
import type { DocumentHash, DocumentMetadata, DocumentStore } from "../document-store/types";
import {
  AGENT_MEMORY_COMMITTED,
  type AgentMemoryCommittedPayload,
  makeAgentMemoryCommitted,
} from "../event-store/event-types";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-memory-recall-determinism";
const ENFORCING = true;
const ENTITY = "LE-ZA-HOZ-BANK";

/**
 * A minimal deterministic in-memory document store for the probe — no FS, so the
 * gate is clean-store green by construction (it depends on nothing on disk).
 */
class InMemoryDocStore implements DocumentStore {
  private readonly bodies = new Map<string, Uint8Array>();

  putBody(hash: string, body: string): void {
    this.bodies.set(hash, new TextEncoder().encode(body));
  }

  put(content: Uint8Array | string): never {
    // The probe pre-seeds bodies; recall only reads. `put` is intentionally
    // unused here (fail loud if a future change relies on it).
    void content;
    throw new Error("InMemoryDocStore.put is not used by the recall-determinism probe");
  }

  get(hash: DocumentHash): Uint8Array {
    const b = this.bodies.get(hash);
    if (!b) throw new Error(`InMemoryDocStore miss: ${hash}`);
    return b;
  }

  exists(hash: DocumentHash): boolean {
    return this.bodies.has(hash);
  }

  metadata(hash: DocumentHash): DocumentMetadata {
    if (!this.bodies.has(hash)) throw new Error(`InMemoryDocStore miss: ${hash}`);
    return {
      hash,
      path: `mem://${hash}`,
      size: this.bodies.get(hash)?.length ?? 0,
      algo: "blake3",
      firstSeenAt: "2026-06-25T00:00:00.000Z",
    };
  }
}

function memoryEvent(args: {
  memoryId: string;
  domains: string[];
  hash: string;
  asOf: string;
}): Event {
  const payload: AgentMemoryCommittedPayload = {
    memoryId: args.memoryId,
    domains: args.domains,
    producedByAgent: {
      name: "Atlas",
      position: "Core banking platform architect",
      agentId: "agent:atlas",
    },
    producedByRunId: "run:recall-determinism-probe",
    title: `probe ${args.memoryId}`,
    bodyDocumentHash: args.hash as DocumentHash,
    citations: ["D-AGENT-MEMORY-PERSISTENCE"],
  };
  return makeAgentMemoryCommitted({
    asOf: args.asOf,
    entity: ENTITY,
    actor: { type: "service", id: "agent:atlas" },
    citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    payload,
  });
}

/**
 * Pure assertion core (exercised sabotage-proof in the test). Given two recall
 * outputs (same store, the second from a shuffled event order) and the three
 * probe memoryIds, produce violations for any broken invariant.
 */
export function assertRecallDeterminism(
  first: readonly AgentMemoryRow[],
  second: readonly AgentMemoryRow[],
  ids: { inMandate: string; sharedOnly: string; unrelated: string },
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];

  // Assertion 1 — determinism: byte-identical across calls / event orders.
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    violations.push({
      subject: "readMyMemory:determinism",
      message:
        "readMyMemory returned different results across two calls (or a shuffled event order) — the read is non-deterministic, which makes WorldStateSnapshot.myMemory and its snapshotHash unstable. D-AGENT-MEMORY-PERSISTENCE.",
      severity,
    });
  }

  const present = new Set(first.map((r) => r.memoryId));

  // Assertion 2 — the in-mandate memory IS present.
  if (!present.has(ids.inMandate)) {
    violations.push({
      subject: "readMyMemory:mandate-filter",
      message: `the in-mandate memory "${ids.inMandate}" was NOT returned — the mandate filter is dropping memories the agent should load. D-AGENT-MEMORY-PERSISTENCE.`,
      severity,
    });
  }

  // Assertion 3 — the shared-only memory IS present (the common-core tier).
  if (!present.has(ids.sharedOnly)) {
    violations.push({
      subject: "readMyMemory:shared-tier",
      message: `the shared-only memory "${ids.sharedOnly}" was NOT returned — the reserved bank-wide common-core tier is not being unioned into the agent's filter. D-AGENT-MEMORY-PERSISTENCE.`,
      severity,
    });
  }

  // Assertion 4 — the unrelated memory is NOT present (no leak).
  if (present.has(ids.unrelated)) {
    violations.push({
      subject: "readMyMemory:no-leak",
      message: `the unrelated memory "${ids.unrelated}" (a domain outside the agent's mandate and not shared) WAS returned — the federation filter leaks another mandate's memory. D-AGENT-MEMORY-PERSISTENCE.`,
      severity,
    });
  }

  // Four assertions exactly.
  return { asserted: 4, violations };
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  // agent:atlas mandateDomains include "platform"; "shared" is the reserved tier;
  // "credit-risk" is a real vocabulary tag NOT in Atlas's mandate → the leak probe.
  const inMandateDomain = "platform";
  const unrelatedDomain = "credit-risk";

  const hashInMandate = `blake3:${"1".repeat(64)}`;
  const hashShared = `blake3:${"2".repeat(64)}`;
  const hashUnrelated = `blake3:${"3".repeat(64)}`;

  const docStore = new InMemoryDocStore();
  docStore.putBody(hashInMandate, "in-mandate body");
  docStore.putBody(hashShared, "shared-only body");
  docStore.putBody(hashUnrelated, "unrelated body");

  const ids = {
    inMandate: "memory:recall-probe:in-mandate",
    sharedOnly: "memory:recall-probe:shared-only",
    unrelated: "memory:recall-probe:unrelated",
  };

  const events: Event[] = [
    memoryEvent({
      memoryId: ids.inMandate,
      domains: [inMandateDomain],
      hash: hashInMandate,
      asOf: "2026-06-25T00:00:01.000Z",
    }),
    memoryEvent({
      memoryId: ids.sharedOnly,
      domains: ["shared"],
      hash: hashShared,
      asOf: "2026-06-25T00:00:02.000Z",
    }),
    memoryEvent({
      memoryId: ids.unrelated,
      domains: [unrelatedDomain],
      hash: hashUnrelated,
      asOf: "2026-06-25T00:00:03.000Z",
    }),
  ];

  const deps = { events, documentStore: docStore };
  // Same store, called twice — and the second time over a REVERSED event order to
  // prove the deterministic sort is independent of input order.
  const first = readMyMemory("agent:atlas", deps);
  const second = readMyMemory("agent:atlas", {
    events: [...events].reverse(),
    documentStore: docStore,
  });

  // Defensive: the family literal is referenced so this gate trips if the type
  // string drifts under it (it folds only AGENT_MEMORY_COMMITTED events).
  void AGENT_MEMORY_COMMITTED;

  const { asserted, violations } = assertRecallDeterminism(first, second, ids, severity);
  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : result.ok ? "ADVISORY" : "FAIL";
  console.log(`recon:agent-memory-recall-determinism [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
