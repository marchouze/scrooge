// platform/recon/governance-attestation-v2-parity.ts
//
// recon:governance-attestation-v2-parity — Wave 2 batch-2 parity gate
// (D-BANK-WIDE-V2-MIGRATION).
//
// PURPOSE
// -------
// Proves byte-equivalence of the seven MONEY-FREE governance-attestation +
// money-free-risk domains migrated in Wave 2 batch-2 (kyc, cae-governance,
// ciso-governance, governance-seat-runs, obligation-lifecycle, policy-activation,
// decision-distillation — 35 event types) between:
//   - the authoritative V1 event store, and
//   - the v2 control-plane store (the W0 general event host),
// populated by the generic store-tee + generic backfill.
//
// The comparable shape is the event-list register
// (`foldGovernanceAttestationRegister`): the sorted-by-event_id set of
// {event_id, type, payload} tuples scoped to the batch's 35 types. Because the
// tee mirrors verbatim and reuses the V1 event_id, a byte-clean result is the
// expected steady state — any drop (gap), spurious mirror (excess), or payload
// byte-divergence surfaces as a parity fail. Same harness (`runParityCheck`) and
// the same v1→v2 read direction as the batch-1 reference-data gate.
//
// STATUS
// ------
// ENFORCING (Wave 2 batch-2 flip, 2026-06-16). All 35 types flipped
// v1-only → v2-replaced on ORDINARY dual-write + byte-clean parity basis
// (D-V1-REMOVAL-FLIP-BASIS-RBC): V1 remains emittable and this gate is the
// standing evidence. A byte-diff, a harness self-test failure, or a fold error
// is fail-severity and blocks CI.
//
// CLEAN-STORE BEHAVIOUR: on a fresh store with no batch-2 events, BOTH sides fold
// to an empty register → byte-equal → pass (vacuously). The gate becomes
// load-bearing once the V1 seeds + the generic backfill have run (the ci:migrate
// chain does exactly that).
//
// ARCHITECTURE NOTE: v1-side recon infra; imports the v2 store + projection via
// the permitted v1→v2 direction (`recon:v2-no-v1-import` forbids only the
// reverse).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-PHASE-1 (parity-harness lineage).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-4-batch-2-money-free-risk-governance-atte:2026-06-16.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import type { CpEvent } from "../../v2-core/control-plane/store";
import {
  GOVERNANCE_ATTESTATION_BATCH_2_TYPES,
  type GovernanceAttestationEventView,
  type GovernanceAttestationRegister,
  foldGovernanceAttestationRegister,
} from "../../v2-core/governance-attestation";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";
import { v2StoreProjectionReader } from "./v2-store-parity-adapter";

const PIPELINE = "governance-attestation-v2-parity";

const BATCH_TYPE_SET: ReadonlySet<string> = new Set<string>(GOVERNANCE_ATTESTATION_BATCH_2_TYPES);

// ---------------------------------------------------------------------------
// V1 side — replay each batch type from the authoritative V1 event store and
// fold the event-list register.
// ---------------------------------------------------------------------------

function readV1Register(): GovernanceAttestationRegister {
  const views: GovernanceAttestationEventView[] = [];
  for (const type of GOVERNANCE_ATTESTATION_BATCH_2_TYPES) {
    for (const ev of eventStore.replay({ type })) {
      const e = ev as { event_id: string; type: string; payload: Record<string, unknown> };
      views.push({ event_id: e.event_id, type: e.type, payload: e.payload });
    }
  }
  return foldGovernanceAttestationRegister(views, BATCH_TYPE_SET);
}

// ---------------------------------------------------------------------------
// V2 side — fold the event-list register from the v2 control-plane store via the
// W0 v2StoreProjectionReader adapter. The adapter replays the full store; we
// scope to the batch type set inside the fold.
// ---------------------------------------------------------------------------

function foldV2(events: readonly CpEvent[]): GovernanceAttestationRegister {
  const views: GovernanceAttestationEventView[] = events.map((ev) => ({
    event_id: ev.event_id,
    type: ev.type,
    payload: ev.payload,
  }));
  return foldGovernanceAttestationRegister(views, BATCH_TYPE_SET);
}

export function run(overridePath?: string): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — the vacuous (empty == empty) parity must pass.
  result.asserted += 1;
  const vacuous = runParityCheck({
    label: "governance-attestation-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  if (vacuous.length > 0) {
    violations.push({
      subject: "governance-attestation-v2-parity:harness-structural-check",
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
      label: "governance-attestation-register",
      readV1: () => v1Snap,
      readV2: () => v2Snap,
    });
    for (const v of parity) {
      violations.push(v);
    }
  } catch (err) {
    violations.push({
      subject: "governance-attestation-v2-parity:fold-error",
      message: `governance-attestation register fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the V1 store and the v2 control-plane store for malformed governance-attestation events.`,
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
    `governance-attestation-v2-parity [ENFORCING]: ${GOVERNANCE_ATTESTATION_BATCH_2_TYPES.length} type(s); ` +
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
