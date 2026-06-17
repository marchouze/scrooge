// platform/recon/bucket-c-batch1-v2-parity.ts
//
// recon:bucket-c-batch1-v2-parity — Bucket C bulk batch-1 parity gate
// (D-BANK-WIDE-V2-MIGRATION).
//
// PURPOSE
// -------
// Proves byte-equivalence of the 57 non-load-bearing bucket-C substrate types
// (agent-lifecycle + governance-process + HR; sourced from
// BUCKET_C_BATCH1_TYPES) between:
//   - the authoritative V1 event store, and
//   - the v2 control-plane store (the W0 general event host),
// populated by the generic store-tee + generic backfill.
//
// THE COMPARABLE SHAPE — a VERBATIM {event_id, type, payload} TUPLE FOLD.
// This gate deliberately does NOT reuse a lossy per-domain register projection.
// It folds, on each side, the sorted-by-event_id list of {event_id, type,
// payload} tuples scoped to the batch type set. Because the tee mirrors VERBATIM
// and reuses the V1 event_id, a byte-clean result is the expected steady state —
// any drop (gap), spurious mirror (excess), or payload byte-divergence surfaces
// as a parity fail. Same harness (`runParityCheck`, stable-key JSON) and the
// same v1→v2 read direction as the posture pilot, the agent-performance pilot,
// and the money-free batches.
//
// STATUS
// ------
// ENFORCING (bucket-C batch-1 flip, 2026-06-17). All 57 types flipped
// v1-only → v2-replaced on ORDINARY dual-write + byte-clean parity basis
// (D-V1-REMOVAL-FLIP-BASIS-RBC): V1 remains emittable and this gate is the
// standing evidence. A byte-diff, a harness self-test failure, or a fold error
// is fail-severity and blocks CI.
//
// CLEAN-STORE / PASS-ON-EMPTY BEHAVIOUR: on a fresh store with no batch events
// (the CI store — ci:migrate self-seeds a minimal store), BOTH sides fold to an
// empty tuple list → byte-equal → pass (vacuously). The gate becomes
// load-bearing the moment any batch event lands and is mirrored (the home store,
// where real governance/agent-lifecycle/HR populations live). Because the codec
// is verbatim (identity), the empty-store flip is safe — there is no codec to
// get wrong on real data; the wiring is what CI proves, the byte-equivalence is
// proven the moment data exists. Per scope §5.1 the empty-population flips are
// recorded as ONE batch-level tracked gap (Vera re-asserts at first real append).
//
// ARCHITECTURE NOTE: v1-side recon infra; imports the v2 store + the batch type
// list via the permitted v1→v2 direction (`recon:v2-no-v1-import` forbids only
// the reverse).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-PHASE-1 (parity-harness lineage).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-batch1-non-load-bearing-substrate-types:2026-06-17.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { BUCKET_C_BATCH1_TYPES } from "../../v2-core/bucket-c-batch1";
import type { CpEvent } from "../../v2-core/control-plane/store";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";
import { v2StoreProjectionReader } from "./v2-store-parity-adapter";

const PIPELINE = "bucket-c-batch1-v2-parity";

const TYPE_SET: ReadonlySet<string> = new Set<string>(BUCKET_C_BATCH1_TYPES);

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
  for (const type of BUCKET_C_BATCH1_TYPES) {
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
    label: "bucket-c-batch1-v2-parity:structural-check",
    readV1: () => [],
    readV2: () => [],
  });
  if (vacuous.length > 0) {
    violations.push({
      subject: "bucket-c-batch1-v2-parity:harness-structural-check",
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
      label: "bucket-c-batch1-verbatim-tuples",
      readV1: () => v1Snap,
      readV2: () => v2Snap,
    });
    for (const v of parity) {
      violations.push(v);
    }
  } catch (err) {
    violations.push({
      subject: "bucket-c-batch1-v2-parity:fold-error",
      message: `bucket-c batch-1 verbatim tuple fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the V1 store and the v2 control-plane store for malformed events.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  // ENFORCING gate: ok = false on any fail-severity (byte-diff / harness / fold).
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const byteClean = failCount === 0;
  result.asOf =
    `bucket-c-batch1-v2-parity [ENFORCING]: ${BUCKET_C_BATCH1_TYPES.length} type(s); ` +
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
