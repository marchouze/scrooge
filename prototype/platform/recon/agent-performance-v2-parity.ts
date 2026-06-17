// platform/recon/agent-performance-v2-parity.ts
//
// recon:agent-performance-v2-parity — Bucket C PILOT parity gate
// (D-BANK-WIDE-V2-MIGRATION).
//
// PURPOSE
// -------
// Proves byte-equivalence of the agent-performance domain (2 types:
// AgentPerformanceEvaluated, AgentFeedbackIssued) between:
//   - the authoritative V1 event store, and
//   - the v2 control-plane store (the W0 general event host),
// populated by the generic store-tee + generic backfill.
//
// The comparable shape is the event-list register (`foldAgentPerformanceRegister`):
// the sorted-by-event_id set of {event_id, type, payload} tuples scoped to the
// two migrated types. Because the tee mirrors VERBATIM and reuses the V1
// event_id, a byte-clean result is the expected steady state — any drop (gap),
// spurious mirror (excess), or payload byte-divergence surfaces as a parity fail.
// Same harness (`runParityCheck`) and the same v1→v2 read direction as the
// posture pilot and the money-free batches.
//
// STATUS
// ------
// ENFORCING (bucket-C pilot flip, 2026-06-17). Both types flipped
// v1-only → v2-replaced on ORDINARY dual-write + byte-clean parity basis
// (D-V1-REMOVAL-FLIP-BASIS-RBC): V1 remains emittable and this gate is the
// standing evidence. A byte-diff, a harness self-test failure, or a fold error
// is fail-severity and blocks CI.
//
// CLEAN-STORE / PASS-ON-EMPTY BEHAVIOUR: on a fresh store with no agent-
// performance events (the CI store — no performance seed runs in ci:migrate),
// BOTH sides fold to an empty register → byte-equal → pass (vacuously). The gate
// becomes load-bearing the moment any AgentPerformanceEvaluated / AgentFeedback-
// Issued event lands and is mirrored (the home store, where the real evaluation
// population lives). Because the codec is verbatim (identity), the empty-store
// flip is safe — there is no codec to get wrong on real data; the wiring is what
// is proven on CI, the byte-equivalence is proven the moment data exists.
//
// ARCHITECTURE NOTE: v1-side recon infra; imports the v2 store + projection via
// the permitted v1→v2 direction (`recon:v2-no-v1-import` forbids only the
// reverse).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-PHASE-1 (parity-harness lineage).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-pilot-agent-performance-domain-to-v2:2026-06-17.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import {
  AGENT_PERFORMANCE_TYPES,
  type AgentPerformanceEventView,
  type AgentPerformanceRegister,
  foldAgentPerformanceRegister,
} from "../../v2-core/agent-performance";
import type { CpEvent } from "../../v2-core/control-plane/store";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";
import { v2StoreProjectionReader } from "./v2-store-parity-adapter";

const PIPELINE = "agent-performance-v2-parity";

const TYPE_SET: ReadonlySet<string> = new Set<string>(AGENT_PERFORMANCE_TYPES);

// ---------------------------------------------------------------------------
// V1 side — replay each migrated type from the authoritative V1 event store and
// fold the event-list register.
// ---------------------------------------------------------------------------

function readV1Register(): AgentPerformanceRegister {
  const views: AgentPerformanceEventView[] = [];
  for (const type of AGENT_PERFORMANCE_TYPES) {
    for (const ev of eventStore.replay({ type })) {
      const e = ev as { event_id: string; type: string; payload: Record<string, unknown> };
      views.push({ event_id: e.event_id, type: e.type, payload: e.payload });
    }
  }
  return foldAgentPerformanceRegister(views, TYPE_SET);
}

// ---------------------------------------------------------------------------
// V2 side — fold the event-list register from the v2 control-plane store via the
// W0 v2StoreProjectionReader adapter. The adapter replays the full store; we
// scope to the migrated type set inside the fold.
// ---------------------------------------------------------------------------

function foldV2(events: readonly CpEvent[]): AgentPerformanceRegister {
  const views: AgentPerformanceEventView[] = events.map((ev) => ({
    event_id: ev.event_id,
    type: ev.type,
    payload: ev.payload,
  }));
  return foldAgentPerformanceRegister(views, TYPE_SET);
}

export function run(overridePath?: string): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — the vacuous (empty == empty) parity must pass.
  result.asserted += 1;
  const vacuous = runParityCheck({
    label: "agent-performance-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  if (vacuous.length > 0) {
    violations.push({
      subject: "agent-performance-v2-parity:harness-structural-check",
      message:
        "The parity harness vacuous self-test failed (empty != empty). This is a harness bug, not a domain divergence. Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) The byte-equivalence check itself.
  result.asserted += 1;
  const readV2 = v2StoreProjectionReader({
    fold: (events) => foldV2(events),
    ...(overridePath !== undefined ? { dbPath: overridePath } : {}),
  });

  let v1Count = 0;
  let v2Count = 0;
  try {
    const v1Snap = readV1Register();
    const v2Snap = readV2();
    v1Count = v1Snap.eventCount;
    v2Count = v2Snap.eventCount;

    const parity = runParityCheck({
      label: "agent-performance-register",
      readV1: () => v1Snap,
      readV2: () => v2Snap,
    });
    for (const v of parity) {
      violations.push(v);
    }
  } catch (err) {
    violations.push({
      subject: "agent-performance-v2-parity:fold-error",
      message: `agent-performance register fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the V1 store and the v2 control-plane store for malformed agent-performance events.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  // ENFORCING gate: ok = false on any fail-severity (byte-diff / harness / fold).
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  const byteClean = warnCount === 0 && failCount === 0;
  result.asOf =
    `agent-performance-v2-parity [ENFORCING]: ${AGENT_PERFORMANCE_TYPES.length} type(s); ` +
    `V1 register events=${v1Count}, v2 register events=${v2Count}; ` +
    `${byteClean ? "BYTE-CLEAN (V1 == v2)" : `DIVERGENT (${warnCount} warn, ${failCount} fail)`}. ` +
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
