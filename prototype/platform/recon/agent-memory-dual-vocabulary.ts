// platform/recon/agent-memory-dual-vocabulary.ts
//
// recon:agent-memory-dual-vocabulary — the ONE subtle must-have for
// WS-AGENT-MEMORY Slice 1.
//
// THE FOOTGUN: the bank reads agent events through TWO vocabularies:
//   (a) the `Substrate*`-prefixed world-state read surface
//       (`platform/agent-runtime/world-state.ts` — `readEventsSince` surfaces a
//       fixed substrate-lifecycle allow-list), and
//   (b) the UN-PREFIXED RMS register surface
//       (`platform/rms-registers/agent-runs.ts` reads `AgentRunStarted/Completed`
//       with NO `Substrate` prefix).
// A new agent event that is visible to one but not the other is a silent
// half-wired family — the exact two-vocabulary trap this gate exists to catch.
//
// THE INVARIANT: `AgentMemoryCommitted` MUST be visible to BOTH read surfaces.
//   (a) world-state surface — `readEventsSince` surfaces an AgentMemoryCommitted
//       event to an agent (it is in the substrate-lifecycle allow-list).
//   (b) un-prefixed RMS register surface — the sibling `agentMemoryRegisterProjection`
//       (in the SAME rms-registers package as agent-runs, the un-prefixed
//       vocabulary) `accepts` the event AND folds it into a live head.
// Plus: the type is registered in `EVENT_TYPE_REGISTRY` (the canonical registry
// both vocabularies ultimately validate against).
//
// HOW IT RUNS: behavioural, not string-grep. It constructs a real in-memory
// event store, appends a real `AgentMemoryCommitted` event, and asserts each
// surface actually observes it. A regression that drops the type from EITHER
// surface flips the corresponding assertion to a FAIL.
//
// SEVERITY: ENFORCING from the start — both surfaces are wired in this slice, so
// a clean tree passes; any future un-wiring is a real break.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 1; brief:atlas:ws-agent-memory-slice-0-1-agentid-born-v2-agentm:2026-06-25.
//   Engineering Charter cmd 2 (fail-closed); Principle 2 (single-graph — one type,
//   visible across both read vocabularies).
// Author: Atlas (Core banking platform architect, engineering).

import { LocalAgentWorldStateReader } from "../agent-runtime/world-state";
import type { DocumentHash } from "../document-store/types";
import { EventStore } from "../event-store/store";
import { AGENT_MEMORY_COMMITTED, makeAgentMemoryCommitted } from "../event-store/event-types";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry";
import type { Event } from "../event-store/types";
import { agentMemoryRegisterProjection, liveHeads } from "../rms-registers/agent-memory";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-memory-dual-vocabulary";
const ENFORCING = true;
const ENTITY = "LE-ZA-HOZ-BANK";

/** A synthetic, well-formed AgentMemoryCommitted event for the probes. */
function probeEvent(): Event {
  return makeAgentMemoryCommitted({
    asOf: "2026-06-25T00:00:00.000Z",
    entity: ENTITY,
    actor: { type: "service", id: "agent:atlas" },
    citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    payload: {
      memoryId: "memory:probe:0",
      domains: ["engineering"],
      producedByAgent: { name: "Atlas", position: "Core banking platform architect", agentId: "agent:atlas" },
      producedByRunId: "run:probe",
      title: "dual-vocabulary probe",
      bodyDocumentHash: `blake3:${"0".repeat(64)}` as DocumentHash,
      citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    },
  });
}

/**
 * Pure assertion core (exercised sabotage-proof in the test): given the three
 * observability facts, produce violations for any surface that does NOT observe
 * the type.
 */
export function assertDualVocabulary(
  facts: {
    registered: boolean;
    worldStateSurfaced: boolean;
    rmsRegisterAccepts: boolean;
    rmsRegisterFolds: boolean;
  },
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];

  if (!facts.registered) {
    violations.push({
      subject: `event-type:${AGENT_MEMORY_COMMITTED}`,
      severity,
      message: `${AGENT_MEMORY_COMMITTED} is not in EVENT_TYPE_REGISTRY — the canonical registry both read vocabularies validate against (D-AGENT-MEMORY-PERSISTENCE).`,
    });
  }
  if (!facts.worldStateSurfaced) {
    violations.push({
      subject: "read-vocabulary:world-state(Substrate*)",
      severity,
      message: `${AGENT_MEMORY_COMMITTED} is NOT surfaced by the world-state read surface (readEventsSince substrate-lifecycle allow-list). Half-wired family — visible to the un-prefixed register but invisible to the Substrate* vocabulary (the two-vocabulary footgun).`,
    });
  }
  if (!facts.rmsRegisterAccepts || !facts.rmsRegisterFolds) {
    violations.push({
      subject: "read-vocabulary:rms-register(un-prefixed)",
      severity,
      message: `${AGENT_MEMORY_COMMITTED} is NOT observed by the un-prefixed RMS register surface (agentMemoryRegisterProjection accepts=${facts.rmsRegisterAccepts}, folds-to-head=${facts.rmsRegisterFolds}). Half-wired family — visible to the Substrate* vocabulary but invisible to the un-prefixed register (the two-vocabulary footgun).`,
    });
  }

  // Three assertions: registry membership + each of the two read surfaces.
  return { asserted: 3, violations };
}

/** Probe (a): the un-prefixed RMS register surface observes the type. */
function probeRmsRegister(ev: Event): { accepts: boolean; folds: boolean } {
  const accepts = agentMemoryRegisterProjection.accepts(ev);
  let folds = false;
  if (accepts) {
    const state = agentMemoryRegisterProjection.reduce(
      agentMemoryRegisterProjection.initial,
      ev,
    );
    folds = liveHeads(state).some((r) => r.memoryId === "memory:probe:0");
  }
  return { accepts, folds };
}

/** Probe (b): the world-state read surface surfaces the type. */
function probeWorldState(ev: Event): boolean {
  const store = new EventStore(":memory:");
  store.append(ev);
  const reader = new LocalAgentWorldStateReader({ eventStore: store, entity: ENTITY });
  // `readEventsSince` returns substrate-lifecycle events all agents observe;
  // query as an unrelated agent so the only reason this event surfaces is the
  // substrate-lifecycle allow-list (not a name-match on "atlas").
  const surfaced = reader.readEventsSince("agent:vera", undefined);
  return surfaced.some((e) => e.type === AGENT_MEMORY_COMMITTED);
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  const ev = probeEvent();
  const registered = EVENT_TYPE_REGISTRY.some((r) => r.type === AGENT_MEMORY_COMMITTED);
  const { accepts, folds } = probeRmsRegister(ev);
  const worldStateSurfaced = probeWorldState(ev);

  const { asserted, violations } = assertDualVocabulary(
    {
      registered,
      worldStateSurfaced,
      rmsRegisterAccepts: accepts,
      rmsRegisterFolds: folds,
    },
    severity,
  );

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : ENFORCING ? "FAIL" : "ADVISORY";
  console.log(`recon:agent-memory-dual-vocabulary [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
