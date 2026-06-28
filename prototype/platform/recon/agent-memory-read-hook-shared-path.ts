// platform/recon/agent-memory-read-hook-shared-path.ts
//
// recon:agent-memory-read-hook-shared-path — the NO-DRIFT gate for the
// autonomous agent-memory read-hook (L3-AGENTS).
//
// THE INVARIANT (fail-closed): the federated agent-memory slice an agent loads
// is read through exactly ONE code path — `readMyMemory`
// (`platform/agent-runtime/read-my-memory.ts`) — and BOTH consumers route
// through it:
//   (a) the AUTONOMOUS runtime read-hook — `WorldStateSnapshot.myMemory`,
//       populated once per iteration by `LocalAgentWorldStateReader.buildMyMemory`
//       (`platform/agent-runtime/world-state.ts`), and
//   (b) the MANUAL stand-in — `dispatch:recall` (`scripts/dispatch/recall.ts`),
//       which Scrooge runs and pastes into briefs until the autonomous runtime
//       is the live substrate.
//
// WHY THIS GATE EXISTS: the whole point of the read-hook
// (D-SCROOGE-RECALL-BEFORE-DISPATCH, under D-AGENT-MEMORY-PERSISTENCE) is that
// the manual recall and the autonomous read CANNOT DRIFT — because they are the
// SAME function, not two implementations that happen to agree today. The
// recall-determinism gate proves `readMyMemory` is deterministic and
// mandate-correct, but it does NOT prove the two CALL SITES actually route
// through it. A future refactor could fork `buildMyMemory` into a bespoke
// in-runtime read (or stub it to `[]`), and nothing would catch the silent
// divergence. THIS gate catches it.
//
// HOW IT RUNS (behavioural + structural, not mere string-grep):
//   1. BEHAVIOURAL EQUIVALENCE — construct a real in-memory event store + doc
//      store seeded with a memory in the probe agent's mandate, take a real
//      `LocalAgentWorldStateReader.snapshot(agent).myMemory`, and a direct
//      `readMyMemory(agentId, …)` over the SAME store/agent. The two MUST be
//      byte-identical. If `buildMyMemory` ever forks to a divergent read, the
//      rows differ → FAIL.
//   2. RUNTIME-PATH LIVENESS — the snapshot's `myMemory` MUST be non-empty for
//      the seeded in-mandate memory. Catches a regression that stubs the
//      read-hook to `[]` (which would still be byte-equal to a broken direct
//      call only if BOTH broke — assertion 1 alone can't see a both-empty stub,
//      so this asserts the runtime side is genuinely live).
//   3. STRUCTURAL SINGLE-SYMBOL — both `world-state.ts` and
//      `scripts/dispatch/recall.ts` MUST import `readMyMemory` from the one
//      canonical module `agent-runtime/read-my-memory`. Catches a copy-pasted
//      fork that returns identical bytes on this probe but diverges elsewhere
//      (a behavioural probe alone cannot see a second implementation that
//      coincidentally agrees on the probe input).
//
// NEGATIVE TEST (sabotage-proof, in the .test): the pure assertion core flags a
// runtime slice that diverges from the direct read, an empty runtime slice when
// the direct read is non-empty, and a missing canonical import in either
// consumer.
//
// SEVERITY: ENFORCING — both consumers ship through the shared path on a clean
// tree, so a clean tree passes; any future fork is a real break.
//
// Authority: D-SCROOGE-RECALL-BEFORE-DISPATCH (CEO-approved 2026-06-27, under
//   D-AGENT-MEMORY-PERSISTENCE); WS-AGENT-MEMORY read-hook. Engineering Charter
//   cmd 2 (fail-closed), cmd 1 (root-cause: close the real drift risk, not a
//   wrapper). Principle 1 (events canonical); Principle 6 (the manual recall is
//   the tracked stand-in for the autonomous read — both one path).
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type AgentMemoryRow, readMyMemory } from "../agent-runtime/read-my-memory";
import { LocalAgentWorldStateReader } from "../agent-runtime/world-state";
import type { DocumentHash, DocumentMetadata, DocumentStore } from "../document-store/types";
import {
  type AgentMemoryCommittedPayload,
  makeAgentMemoryCommitted,
} from "../event-store/event-types";
import { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-memory-read-hook-shared-path";
const ENFORCING = true;
const ENTITY = "LE-ZA-HOZ-BANK";

/** The canonical read-path module both consumers MUST import `readMyMemory` from. */
const CANONICAL_READ_MODULE = "read-my-memory";

/** The two consumer source files, repo-root-relative (from `prototype/`). */
const CONSUMERS: ReadonlyArray<{ readonly label: string; readonly path: string }> = [
  {
    label: "autonomous runtime read-hook (world-state.ts)",
    path: join("platform", "agent-runtime", "world-state.ts"),
  },
  {
    label: "manual recall CLI (dispatch/recall.ts)",
    path: join("scripts", "dispatch", "recall.ts"),
  },
];

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
    // The probe pre-seeds bodies; the read-path only reads. `put` is intentionally
    // unused (fail loud if a future change relies on it).
    void content;
    throw new Error("InMemoryDocStore.put is not used by the read-hook-shared-path probe");
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
    producedByRunId: "run:read-hook-shared-path-probe",
    title: `probe ${args.memoryId}`,
    bodyDocumentHash: args.hash as DocumentHash,
    citations: ["D-SCROOGE-RECALL-BEFORE-DISPATCH"],
  };
  return makeAgentMemoryCommitted({
    asOf: args.asOf,
    entity: ENTITY,
    actor: { type: "service", id: "agent:atlas" },
    citations: ["D-SCROOGE-RECALL-BEFORE-DISPATCH"],
    payload,
  });
}

/**
 * Pure assertion core (exercised sabotage-proof in the .test). Given the runtime
 * read-hook slice (`WorldStateSnapshot.myMemory`), the direct `readMyMemory`
 * slice over the same store/agent, and the per-consumer canonical-import facts,
 * produce violations for any broken invariant.
 */
export function assertSharedPath(
  runtimeSlice: readonly AgentMemoryRow[],
  directSlice: readonly AgentMemoryRow[],
  consumerImportsCanonical: ReadonlyArray<{ label: string; imports: boolean }>,
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];

  // Assertion 1 — behavioural equivalence: the autonomous runtime read-hook and
  // the direct `readMyMemory` call return byte-identical slices. This is the
  // no-drift heart: a forked `buildMyMemory` produces different rows here.
  if (JSON.stringify(runtimeSlice) !== JSON.stringify(directSlice)) {
    violations.push({
      subject: "read-hook:runtime-vs-direct",
      message:
        "WorldStateSnapshot.myMemory (the autonomous runtime read-hook) diverged from a direct readMyMemory call over the SAME store and agent — the runtime read no longer routes through the single shared readMyMemory path, so the autonomous read and the manual dispatch:recall CAN drift. D-SCROOGE-RECALL-BEFORE-DISPATCH.",
      severity,
    });
  }

  // Assertion 2 — runtime-path liveness: the runtime slice is non-empty for the
  // seeded in-mandate memory. Catches a read-hook stubbed to `[]` (which would
  // pass assertion 1 only if BOTH sides broke; the direct call is the live
  // oracle, so a non-empty direct slice with an empty runtime slice is a fork).
  if (directSlice.length > 0 && runtimeSlice.length === 0) {
    violations.push({
      subject: "read-hook:runtime-liveness",
      message:
        "WorldStateSnapshot.myMemory was EMPTY while a direct readMyMemory call returned the seeded in-mandate memory — the autonomous read-hook is not actually populating the slice (stubbed or unwired). D-SCROOGE-RECALL-BEFORE-DISPATCH.",
      severity,
    });
  }

  // Assertion 3 — structural single-symbol: each consumer imports `readMyMemory`
  // from the one canonical module. Catches a copy-pasted second implementation
  // that coincidentally agrees on the probe input.
  for (const c of consumerImportsCanonical) {
    if (!c.imports) {
      violations.push({
        subject: `read-hook:canonical-import:${c.label}`,
        message: `${c.label} does NOT import readMyMemory from the canonical module "${CANONICAL_READ_MODULE}" — a forked/duplicated read implementation can drift from the shared path even when it agrees on a probe input. D-SCROOGE-RECALL-BEFORE-DISPATCH.`,
        severity,
      });
    }
  }

  // 1 equivalence + 1 liveness + one per consumer.
  return { asserted: 2 + consumerImportsCanonical.length, violations };
}

/**
 * Structural probe: does `source` import the symbol `readMyMemory` from a module
 * specifier ending in the canonical read module? Tolerant of import ordering and
 * other co-imported symbols; strict on the symbol + module pairing.
 */
export function importsCanonicalReadMyMemory(source: string): boolean {
  // Match `import { … readMyMemory … } from "…read-my-memory"` (and the
  // `type`-qualified / multi-line forms). The `[\s\S]` spans line breaks.
  const importBlocks = source.matchAll(/import\s+(?:type\s+)?\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g);
  for (const m of importBlocks) {
    const names = m[1] ?? "";
    const moduleSpecifier = m[2] ?? "";
    if (!moduleSpecifier.endsWith(CANONICAL_READ_MODULE)) continue;
    // The named-imports list contains `readMyMemory` as a whole symbol (allow a
    // leading `type ` qualifier on the individual specifier).
    const hasSymbol = names
      .split(",")
      .map((s) => s.trim().replace(/^type\s+/, ""))
      .some((s) => s === "readMyMemory");
    if (hasSymbol) return true;
  }
  return false;
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  // --- Behavioural probe: build a real store + doc store, one in-mandate memory.
  // agent:atlas mandateDomains include "platform"; the seeded memory is tagged
  // "platform" so it is in-mandate for the probe agent.
  const hashInMandate = `blake3:${"1".repeat(64)}`;
  const docStore = new InMemoryDocStore();
  docStore.putBody(hashInMandate, "in-mandate read-hook probe body");

  const ev = memoryEvent({
    memoryId: "memory:read-hook-probe:in-mandate",
    domains: ["platform"],
    hash: hashInMandate,
    asOf: "2026-06-27T00:00:01.000Z",
  });

  const store = new EventStore(":memory:");
  store.append(ev);

  // (a) the AUTONOMOUS runtime read-hook — WorldStateSnapshot.myMemory.
  const reader = new LocalAgentWorldStateReader({
    eventStore: store,
    entity: ENTITY,
    documentStore: docStore,
  });
  const runtimeSlice = reader.snapshot("agent:atlas").myMemory;

  // (b) the DIRECT shared-path call — the same function dispatch:recall calls.
  const directSlice = readMyMemory("agent:atlas", { events: [ev], documentStore: docStore });

  // --- Structural probe: both consumers import readMyMemory from the canonical
  // module. Resolved relative to the prototype root (recon runs from prototype/).
  const consumerImportsCanonical = CONSUMERS.map((c) => {
    let imports = false;
    try {
      imports = importsCanonicalReadMyMemory(readFileSync(c.path, "utf8"));
    } catch {
      // A consumer file that cannot be read is itself a structural break — treat
      // as a missing canonical import (fail-closed, never swallow as "ok").
      imports = false;
    }
    return { label: c.label, imports };
  });

  const { asserted, violations } = assertSharedPath(
    runtimeSlice,
    directSlice,
    consumerImportsCanonical,
    severity,
  );
  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : result.ok ? "ADVISORY" : "FAIL";
  console.log(`recon:agent-memory-read-hook-shared-path [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
