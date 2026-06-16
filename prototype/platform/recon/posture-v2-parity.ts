// platform/recon/posture-v2-parity.ts
//
// recon:posture-v2-parity — Wave 2 PILOT parity gate (D-BANK-WIDE-V2-MIGRATION).
//
// PURPOSE
// -------
// Proves byte-equivalence of the posture register folded from the V1 event store
// (the authoritative source) against the SAME register folded from the v2
// control-plane store (the W0 general event host). This is the pattern-proof for
// migrating non-financial reference-data domains: same projection
// (`foldPostureRegister`), two stores, byte-compared.
//
// The v2 side is populated by `scripts/backfill-posture-v2-dual-run.ts`, which
// mirrors every V1 posture event into the control-plane store (idempotent,
// keyed on the V1 event id). Both scripts run in the `ci:migrate` chain, so on a
// clean CI store the V1 seeds emit → the backfill mirrors → this gate folds both
// sides and compares.
//
// STATUS
// ------
// ADVISORY at landing (warn-severity only; ok:true). Flips ENFORCING in the SAME
// PR once parity is byte-clean (the flip cites the byte-clean parity as the
// evidence for moving the V1 posture types to v2-replaced — ordinary dual-write
// flip basis, NOT retired-by-construction; D-V1-REMOVAL-FLIP-BASIS-RBC).
//
// COMPARISON SHAPE
// ----------------
// We compare the full posture register as a stable, sorted-by-id snapshot of
// every posture record's projected fields (postureId, class, description, scope,
// tier, proposedBy, citations, parameters, active, activation/deactivation
// metadata). The harness's default `stableJson` serialiser sorts object keys
// recursively, so insertion-order differences between the two stores never
// produce a false diff. The fold is deterministic and the payloads are copied
// verbatim by the mirror, so a byte-clean result is the expected steady state.
//
// CLEAN-STORE BEHAVIOUR: on a fresh store with no posture events, BOTH sides fold
// to an empty register → byte-equal → pass (vacuously). The gate becomes load-
// bearing once the posture seeds + backfill have run (the ci:migrate chain does
// exactly that).
//
// ARCHITECTURE NOTE: this gate is v1-side recon infra. It imports the v2 store +
// projection via the permitted v1→v2 direction (`recon:v2-no-v1-import` forbids
// only the reverse).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-PHASE-1 (parity-harness lineage).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-pilot-migrate-posture-domain-to-v2-core-p:2026-06-16.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import type { CpEvent } from "../../v2-core/control-plane/store";
import { type Posture, type PostureRegister, foldPostureRegister } from "../../v2-core/posture/projection";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";
import { v2StoreProjectionReader } from "./v2-store-parity-adapter";

const PIPELINE = "posture-v2-parity";

const POSTURE_EVENT_TYPES = [
  "PostureRegistered",
  "PostureActivated",
  "PostureDeactivated",
  "PostureRevised",
] as const;

// ---------------------------------------------------------------------------
// Comparable snapshot — a deterministic, store-independent view of the register.
//
// We project to a sorted array of plain records so the two sides serialise
// identically regardless of insertion order or Map iteration order. The
// harness's stableJson additionally key-sorts nested objects.
// ---------------------------------------------------------------------------

interface PostureSnapshotRow {
  readonly postureId: string;
  readonly postureClass: string;
  readonly description: string;
  readonly appliesToScope: unknown;
  readonly appliesToTier: string;
  readonly proposedBy: string;
  readonly citations: readonly string[];
  readonly parameters: Readonly<Record<string, unknown>> | null;
  readonly active: boolean;
  readonly activatedScope: unknown;
  readonly activatedAt: string | null;
  readonly authority: string | null;
  readonly deactivationReason: string | null;
}

function rowFromPosture(p: Posture): PostureSnapshotRow {
  return {
    postureId: p.postureId,
    postureClass: p.postureClass,
    description: p.description,
    appliesToScope: p.appliesToScope,
    appliesToTier: p.appliesToTier,
    proposedBy: p.proposedBy,
    citations: [...p.citations],
    parameters: p.parameters ?? null,
    active: p.active,
    activatedScope: p.activatedScope ?? null,
    activatedAt: p.activatedAt ?? null,
    authority: p.authority ?? null,
    deactivationReason: p.deactivationReason ?? null,
  };
}

function snapshot(register: PostureRegister): {
  readonly rows: PostureSnapshotRow[];
  readonly eventCount: number;
} {
  const rows = register
    .listPostures()
    .map(rowFromPosture)
    .sort((a, b) => a.postureId.localeCompare(b.postureId));
  return { rows, eventCount: register.eventCount };
}

// ---------------------------------------------------------------------------
// V1 side — fold the posture register from the authoritative V1 event store.
// Mirrors the read shape of recon:v2-posture-register-integrity so the two
// gates agree on how the V1 register is built.
// ---------------------------------------------------------------------------

function readV1Register(): PostureRegister {
  const payloads: unknown[] = [];
  for (const type of POSTURE_EVENT_TYPES) {
    for (const ev of eventStore.replay({ type })) {
      payloads.push({
        kind: type,
        ...(ev as { payload: Record<string, unknown> }).payload,
      });
    }
  }
  return foldPostureRegister(payloads);
}

// ---------------------------------------------------------------------------
// V2 side — fold the posture register from the v2 control-plane store via the
// W0 v2StoreProjectionReader adapter. We replay ALL posture types (the adapter's
// single `replay` filter cannot scope to four types at once, so we filter the
// fold input by type set).
// ---------------------------------------------------------------------------

function foldV2(events: readonly CpEvent[]): PostureRegister {
  const postureTypeSet = new Set<string>(POSTURE_EVENT_TYPES);
  const payloads: unknown[] = [];
  for (const ev of events) {
    if (!postureTypeSet.has(ev.type)) continue;
    payloads.push({ kind: ev.type, ...ev.payload });
  }
  return foldPostureRegister(payloads);
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

export function run(overridePath?: string): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — the vacuous (empty == empty) parity must pass.
  result.asserted += 1;
  const vacuous = runParityCheck({
    label: "posture-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  if (vacuous.length > 0) {
    violations.push({
      subject: "posture-v2-parity:harness-structural-check",
      message:
        "The parity harness vacuous self-test failed (empty != empty). This is a harness bug, not a domain divergence. Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) The byte-equivalence check itself.
  result.asserted += 1;
  const readV2 = v2StoreProjectionReader({
    fold: (events) => snapshot(foldV2(events)),
    ...(overridePath !== undefined ? { dbPath: overridePath } : {}),
  });

  let v1Count = 0;
  let v2Count = 0;
  try {
    const v1Snap = snapshot(readV1Register());
    const v2Snap = readV2();
    v1Count = v1Snap.eventCount;
    v2Count = v2Snap.eventCount;

    const parity = runParityCheck({
      label: "posture-register",
      readV1: () => v1Snap,
      readV2: () => v2Snap,
    });
    for (const v of parity) {
      // ADVISORY at landing: surface the divergence as warn. The flip to
      // ENFORCING (severity fail) happens in the same PR once byte-clean.
      violations.push({ ...v, severity: "warn" });
    }
  } catch (err) {
    violations.push({
      subject: "posture-v2-parity:fold-error",
      message: `posture register fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the V1 store and the v2 control-plane store for malformed posture events.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  // ADVISORY gate: ok = true unless a fail-severity (harness/fold) violation.
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  const byteClean = warnCount === 0 && failCount === 0;
  result.asOf =
    `posture-v2-parity [ADVISORY]: V1 register events=${v1Count}, v2 register events=${v2Count}; ` +
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
