// platform/recon/agent-memory-citation-integrity.ts
//
// recon:agent-memory-citation-integrity — every `AgentMemoryCommitted` carries
// ≥1 citation (Principle 2, fail-closed).
//
// THE INVARIANT: a federated agent memory must be traceable — it carries at
// least one citation, mirroring the P2 discipline every other RMS event obeys.
// The payload schema already enforces `citations.min(1)` at construction, and
// the `--memory` close-run parser fails-closed before the doc-store put; this
// gate is the standing assertion over the LIVE store so a memory that reached
// the log by any path (replay, manifest, future writer) is re-checked.
//
// HOW IT RUNS: replay every `AgentMemoryCommitted` event; FAIL on any whose
// `citations` is missing/empty (envelope OR payload — the payload `citations`
// is the federation-facing copy and must also be non-empty).
//
// SEVERITY: ENFORCING from the start — the only writers (the schema factory +
// the close-run parser) require ≥1 citation, so a clean store passes; a citation-
// less memory is a real P2 breach.
//
// EMPTY-STATE CORRECTNESS: zero memories → asserted=0, ok=true.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 1. Principle 2 (single-graph — every node carries a citation).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { AGENT_MEMORY_COMMITTED } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-memory-citation-integrity";
const ENFORCING = true;

export interface CitationIntegrityDeps {
  /** Injected events (tests). Default: composition replay of the family. */
  readonly memoryEvents?: readonly Event[];
}

/**
 * Pure assertion core (exercised sabotage-proof in the test). Returns one
 * violation per memory that lacks a non-empty citation set (envelope or the
 * federation-facing payload copy).
 */
export function assertCitationIntegrity(
  events: readonly Event[],
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const e of events) {
    if (e.type !== AGENT_MEMORY_COMMITTED) continue;
    asserted++;
    const payload = e.payload as Record<string, unknown>;
    const memoryId =
      typeof payload.memoryId === "string" ? payload.memoryId : "(no memoryId)";

    const envelopeOk = Array.isArray(e.citations) && e.citations.length > 0;
    const payloadCitations = payload.citations;
    const payloadOk = Array.isArray(payloadCitations) && payloadCitations.length > 0;

    if (!envelopeOk || !payloadOk) {
      violations.push({
        subject: `agent-memory:${memoryId}`,
        severity,
        message: `${AGENT_MEMORY_COMMITTED} \`${memoryId}\` has no citation (envelope.citations=${envelopeOk ? "ok" : "EMPTY"}, payload.citations=${payloadOk ? "ok" : "EMPTY"}). Every memory must carry ≥1 citation (Principle 2; D-AGENT-MEMORY-PERSISTENCE).`,
      });
    }
  }

  return { asserted, violations };
}

export function run(deps: CitationIntegrityDeps = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  const events: Event[] =
    deps.memoryEvents !== undefined
      ? [...deps.memoryEvents]
      : [...eventStore.replay({ type: AGENT_MEMORY_COMMITTED })];

  const { asserted, violations } = assertCitationIntegrity(events, severity);
  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : ENFORCING ? "FAIL" : "ADVISORY";
  console.log(`recon:agent-memory-citation-integrity [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
