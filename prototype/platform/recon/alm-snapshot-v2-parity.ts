// platform/recon/alm-snapshot-v2-parity.ts
//
// recon:alm-snapshot-v2-parity — ADVISORY gate (WS-V2-AUTHORITATIVE S6).
//
// Structural-compares the V1 `getALMPositionSnapshot()` against the V2
// `getALMPositionSnapshotV2()` over the recorded money-market population, for
// the anchor bank entity. Where `recon:ba300-v2-parity` (Phase 3b) compares only
// the LCR *ratio denominator*, this gate compares the *snapshot SHAPE* the
// dashboard ALM / LCR / NSFR route actually reads (HQLA / funding / ASF / RSF
// arrays), so a dual-read wired under `useV2Store` is provably shape-equivalent.
//
// ADVISORY (Charter cmd 3 — no green by concealment, but a parallel shadow with
// no V2 events yet is correctly a PASS, not a fail): in build phase the V2
// money-market shadow has no live events, so the V2 snapshot's position arrays
// are empty while the V1 snapshot may carry positions from live V1 events. That
// expected V1-populated / V2-vacuous divergence is a WARN, not a FAIL — the gate
// returns ok:true. It hardens to enforcing when the V2 money-market path is the
// authoritative source (a later phase + Decision). A structural-compare ERROR
// (compute throw) is a FAIL — that is a wiring defect, not an expected gap.
//
// The comparison ignores the prose-only fields (`note`, `gaps`, `buildPhase`),
// which legitimately differ between the V1 and V2 derivations, and compares the
// numeric position arrays — the load-bearing snapshot content — via the
// structural parity harness `runParityCheck`.
//
// CURRENCY-AGNOSTIC: both snapshots value into the holding entity's functional
// currency (resolved from the entity tree — no hardcoded ZAR). The V2 projection
// reads each MoneyWire's own currency and surfaces any cross-currency position as
// a gap rather than silently FX-converting it (WS-MULTI-BASE-CURRENCY).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//            D-V1-REMOVAL-PHASE-3B (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import type { EventStore } from "../event-store/store";
import { type ALMPositionSnapshot, getALMPositionSnapshot } from "../projections/alm-positions";
import { getALMPositionSnapshotV2 } from "../projections/alm-positions-v2";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "alm-snapshot-v2-parity";

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";
// Broad as-of so the build-phase population is captured.
const AS_OF = "2099-12-31";
const HORIZON_DAYS = 30;

/**
 * The numeric, load-bearing slice of an ALM snapshot — the four position arrays
 * the dashboard route reads to compute LCR / NSFR. The prose fields (`note`,
 * `gaps`, `buildPhase`) legitimately differ between the V1 and V2 derivations
 * and are NOT part of the structural compare.
 */
function comparableShape(snap: ALMPositionSnapshot) {
  // Sort each array deterministically so a fold-order difference between V1 and
  // V2 (same multiset, different emit order) is not a false divergence.
  const sortPositions = <T extends { amountZar: number }>(arr: readonly T[]): T[] =>
    [...arr].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    horizonDays: snap.horizonDays,
    hqlaPositions: sortPositions(snap.hqlaPositions),
    fundingPositions: sortPositions(snap.fundingPositions),
    asfItems: sortPositions(snap.asfItems),
    rsfItems: sortPositions(snap.rsfItems),
  };
}

export function run(store: EventStore = eventStore): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — the vacuous parity harness must still pass.
  const vacuous = runParityCheck({
    label: "alm-snapshot-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  if (vacuous.length > 0) {
    violations.push({
      subject: "alm-snapshot-v2-parity:harness-structural-check",
      message:
        "The parity harness structural check failed (vacuous empty==empty did not pass). " +
        "Harness bug, not a domain divergence — inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) Snapshot-shape parity — V1 getALMPositionSnapshot vs V2 getALMPositionSnapshotV2.
  // ADVISORY: a shape divergence is a WARN at S6 (the V2 money-market shadow may
  // have no events yet — a vacuous-V2 / populated-V1 difference is expected and
  // correct). A compute throw is a FAIL (wiring defect, not an expected gap).
  result.asserted += 1;
  try {
    const v1 = getALMPositionSnapshot(store, AS_OF, HORIZON_DAYS, ANCHOR_ENTITY);
    const v2 = getALMPositionSnapshotV2(store, AS_OF, HORIZON_DAYS, ANCHOR_ENTITY);

    const shapeViolations = runParityCheck({
      label: "alm-snapshot-v2-parity:snapshot-shape",
      readV1: () => comparableShape(v1),
      readV2: () => comparableShape(v2),
    });

    if (shapeViolations.length > 0) {
      const v1Count =
        v1.hqlaPositions.length +
        v1.fundingPositions.length +
        v1.asfItems.length +
        v1.rsfItems.length;
      const v2Count =
        v2.hqlaPositions.length +
        v2.fundingPositions.length +
        v2.asfItems.length +
        v2.rsfItems.length;
      violations.push({
        subject: "alm-snapshot-v2-parity:snapshot-shape-gap",
        message: `ALM snapshot shape differs between V1 and V2 paths: V1 has ${v1Count} position(s) [HQLA ${v1.hqlaPositions.length} / funding ${v1.fundingPositions.length} / ASF ${v1.asfItems.length} / RSF ${v1.rsfItems.length}], V2 has ${v2Count} position(s) [HQLA ${v2.hqlaPositions.length} / funding ${v2.fundingPositions.length} / ASF ${v2.asfItems.length} / RSF ${v2.rsfItems.length}]. Expected at S6 while the V2 money-market path is a shadow with no/partial events. Hardens to enforcing when the V2 path is authoritative (later phase + Decision). Authority: D-V1-REMOVAL-PHASE-3B.`,
        severity: "warn",
      });
    }
  } catch (e) {
    violations.push({
      subject: "alm-snapshot-v2-parity:snapshot-compute-error",
      message: `Could not compute the ALM snapshot shape parity: ${(e as Error).message}. This is a substrate/wiring defect, not an expected gap. Authority: D-V1-REMOVAL-PHASE-3B.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  // ADVISORY contract: ok unless a fail-severity violation is present.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "alm-snapshot-v2-parity OK (advisory) — no fail-severity violations; warns surface V1↔V2 ALM-snapshot-shape gaps"
        : "alm-snapshot-v2-parity FAILED — fail-severity violation (see above)",
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
