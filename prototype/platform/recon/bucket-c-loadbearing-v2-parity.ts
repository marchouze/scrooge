// platform/recon/bucket-c-loadbearing-v2-parity.ts
//
// recon:bucket-c-loadbearing-v2-parity — Bucket C FINAL load-bearing parity
// gate (D-V1-REMOVAL-BUCKET-C-LOAD-BEARING-FLIP; D-BANK-WIDE-V2-MIGRATION).
//
// PURPOSE
// -------
// Proves byte-equivalence of the 14 (FINAL) LOAD-BEARING bucket-C substrate
// types — the dispatch / run-lifecycle / RMS set: AgentBriefIssued, RecordFiled,
// DecisionRequested, Feedback, BriefSuperseded, Decision, DocumentRegistered,
// AgentRunStarted, AgentRunCompleted, AgentRunFailed, WorkstreamRegistered,
// WorkstreamStarted, WorkstreamCompleted, ReconResult (sourced from
// BUCKET_C_LOADBEARING_TYPES) — between:
//   - the authoritative V1 event store (where the dispatch CLIs keep writing), and
//   - the v2 control-plane store (the W0 general event host),
// populated by the generic store-tee + generic backfill. Direct continuation of
// recon:bucket-c-batch4-v2-parity (#1411); identical comparable shape + harness.
//
// THE COMPARABLE SHAPE — a VERBATIM {event_id, type, payload} TUPLE FOLD.
// This gate folds, on each side, the sorted-by-event_id list of {event_id, type,
// payload} tuples scoped to the batch type set. Because the tee mirrors VERBATIM
// and reuses the V1 event_id, a byte-clean result is the expected steady state —
// any drop (gap), spurious mirror (excess), or payload byte-divergence surfaces
// as a parity fail. Same harness (`runParityCheck`, stable-key JSON) and the
// same v1→v2 read direction as the posture pilot, the agent-performance pilot,
// the money-free batches, and bucket-C batches 1–4.
//
// ★CRITICAL INVARIANT — THE DISPATCH CLIs STAY V1-AUTHORITATIVE.
// This gate reads the v2 MIRROR (read-side) against the V1 authoritative store.
// It does NOT change where the dispatch CLIs write or read. The CLIs keep
// emitting V1; `open-brief` keeps replaying V1 AgentBriefIssued for dedup. The
// RMS / dispatch gates (recon:rms-briefs-parity, recon:rms-documents-parity,
// recon:dispatch-sync-integrity) read the V1 shape unchanged and are the
// standing proof the CLIs are unaffected by this flip.
//
// ★SELF-REFERENCE HAZARD — `ReconResult` — ANALYSED, NOT A HAZARD.
// `ReconResult` is appended to the AUTHORITATIVE V1 store ONLY by the standing
// `vera-overnight-recon` agent run; this gate (and run-recon-suite) compute
// ReconResult objects in memory and NEVER append one. The tee mirrors each V1
// ReconResult to v2 once (idempotent on V1 event_id). No recon-feedback loop;
// ReconResult is included (14/14).
//
// STATUS
// ------
// ENFORCING (bucket-C load-bearing flip, 2026-06-17). All 14 types flipped
// v1-only → v2-replaced on ORDINARY dual-write + byte-clean parity basis
// (D-V1-REMOVAL-FLIP-BASIS-RBC): V1 remains emittable (the dispatch CLIs keep
// writing it) and this gate is the standing evidence. A byte-diff, a harness
// self-test failure, or a fold error is fail-severity and blocks CI.
//
// CLEAN-STORE / PASS-ON-EMPTY BEHAVIOUR: on a fresh store with no batch events
// (the CI store — ci:migrate self-seeds a minimal store), BOTH sides fold to an
// empty tuple list → byte-equal → pass (vacuously). On the HOME store these are
// HIGH-population types (real dispatch / decision / run history), so the gate is
// expected NON-VACUOUS byte-clean — that large real population is the safety
// proof. Because the codec is verbatim (identity), the flip is safe regardless.
// Per scope §5.1 the empty-population (CI) case is recorded as ONE batch-level
// tracked gap (Vera re-asserts at first real append in CI-shaped stores).
//
// ARCHITECTURE NOTE: v1-side recon infra; imports the v2 store + the batch type
// list via the permitted v1→v2 direction (`recon:v2-no-v1-import` forbids only
// the reverse).
//
// Authority: D-V1-REMOVAL-BUCKET-C-LOAD-BEARING-FLIP (CEO-approved 2026-06-17);
//   D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-PHASE-1 (parity-harness lineage).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-loadbearing-final:2026-06-17.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { BUCKET_C_LOADBEARING_TYPES } from "../../v2-core/bucket-c-loadbearing";
import type { CpEvent } from "../../v2-core/control-plane/store";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";
import { v2StoreProjectionReader } from "./v2-store-parity-adapter";

const PIPELINE = "bucket-c-loadbearing-v2-parity";

const TYPE_SET: ReadonlySet<string> = new Set<string>(BUCKET_C_LOADBEARING_TYPES);

/** One verbatim tuple in the comparable fold. */
interface VerbatimTuple {
  readonly event_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/**
 * The comparable shape: the sorted-by-event_id list of {event_id, type,
 * payload} tuples, scoped to the batch type set. Sorting makes the fold
 * insertion-order-independent so the V1 replay order and the v2 store order
 * cannot produce a false diff.
 */
function foldVerbatimTuples(
  events: Iterable<{ event_id: string; type: string; payload: Record<string, unknown> }>,
): readonly VerbatimTuple[] {
  const tuples: VerbatimTuple[] = [];
  for (const e of events) {
    if (!TYPE_SET.has(e.type)) continue;
    tuples.push({ event_id: e.event_id, type: e.type, payload: e.payload });
  }
  return tuples.sort((a, b) => a.event_id.localeCompare(b.event_id));
}

// ---------------------------------------------------------------------------
// V1 side — replay each migrated type from the authoritative V1 event store and
// fold the verbatim tuple list.
// ---------------------------------------------------------------------------

function readV1Tuples(): readonly VerbatimTuple[] {
  const rows: { event_id: string; type: string; payload: Record<string, unknown> }[] = [];
  for (const type of BUCKET_C_LOADBEARING_TYPES) {
    for (const ev of eventStore.replay({ type })) {
      const e = ev as { event_id: string; type: string; payload: Record<string, unknown> };
      rows.push({ event_id: e.event_id, type: e.type, payload: e.payload });
    }
  }
  return foldVerbatimTuples(rows);
}

// ---------------------------------------------------------------------------
// V2 side — fold the verbatim tuple list from the v2 control-plane store via the
// W0 v2StoreProjectionReader adapter. The adapter replays the full store; we
// scope to the migrated type set inside the fold.
// ---------------------------------------------------------------------------

function foldV2(events: readonly CpEvent[]): readonly VerbatimTuple[] {
  return foldVerbatimTuples(
    events.map((ev) => ({ event_id: ev.event_id, type: ev.type, payload: ev.payload })),
  );
}

export function run(overridePath?: string): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — the vacuous (empty == empty) parity must pass.
  result.asserted += 1;
  const vacuous = runParityCheck<readonly VerbatimTuple[]>({
    label: "bucket-c-loadbearing-v2-parity:structural-check",
    readV1: () => [],
    readV2: () => [],
  });
  if (vacuous.length > 0) {
    violations.push({
      subject: "bucket-c-loadbearing-v2-parity:harness-structural-check",
      message:
        "The parity harness vacuous self-test failed (empty != empty). This is a harness bug, not a domain divergence. Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) The byte-equivalence check itself.
  result.asserted += 1;
  const readV2 = v2StoreProjectionReader<readonly VerbatimTuple[]>({
    fold: (events) => foldV2(events),
    ...(overridePath !== undefined ? { dbPath: overridePath } : {}),
  });

  let v1Count = 0;
  let v2Count = 0;
  try {
    const v1Snap = readV1Tuples();
    const v2Snap = readV2();
    v1Count = v1Snap.length;
    v2Count = v2Snap.length;

    const parity = runParityCheck<readonly VerbatimTuple[]>({
      label: "bucket-c-loadbearing-verbatim-tuples",
      readV1: () => v1Snap,
      readV2: () => v2Snap,
    });
    for (const v of parity) {
      violations.push(v);
    }
  } catch (err) {
    violations.push({
      subject: "bucket-c-loadbearing-v2-parity:fold-error",
      message: `bucket-c load-bearing verbatim tuple fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the V1 store and the v2 control-plane store for malformed events.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  // ENFORCING gate: ok = false on any fail-severity (byte-diff / harness / fold).
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const byteClean = failCount === 0;
  result.asOf =
    `bucket-c-loadbearing-v2-parity [ENFORCING]: ${BUCKET_C_LOADBEARING_TYPES.length} type(s); ` +
    `V1 tuples=${v1Count}, v2 tuples=${v2Count}; ` +
    `${byteClean ? "BYTE-CLEAN (V1 == v2)" : `DIVERGENT (${failCount} fail)`}. ` +
    `Harness self-test: ${vacuous.length === 0 ? "OK" : "FAILED"}.`;
  return result;
}

if (import.meta.main) {
  const overridePath = process.env.BANK_V2_CONTROL_PLANE_DB;
  const r = run(overridePath);
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK" : "FAIL";
  process.stdout.write(`\nrecon:${PIPELINE} ${label}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
