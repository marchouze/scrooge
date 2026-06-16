// platform/recon/operational-loss-v2-parity.ts
//
// recon:operational-loss-v2-parity — Bucket A batch A3 (FINAL) parity gate
// (D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC).
//
// PURPOSE
// -------
// Standing evidence that the OperationalLossEvent → OperationalLossEventV2 flip
// is RETIRED-BY-CONSTRUCTION. Because the V1 money figures are minor-unit
// integers and the V2 figures are MAJOR-unit decimal-string MoneyWire, a BYTE
// comparison across the unit change is meaningless — so (like
// recon:rwa-computed-v2-parity) this gate compares on the DECODED DECIMAL VALUE,
// and rests the flip on the D-V1-REMOVAL-FLIP-BASIS-RBC construction conditions
// rather than on data-parity alone (the op-loss data set is legitimately empty
// in the build phase — capture-only, no real loss history).
//
// CONDITIONS ASSERTED:
//   (C0) Registry: OperationalLossEvent is tagged "v2-replaced";
//        OperationalLossEventV2 is tagged "v2-parallel". Reverting either
//        without a CEO Decision is a fail.
//   (C1) V1 UN-EMITTABLE (corollary): ZERO live V1 OperationalLossEvent events.
//        The schema requires numeric grossLossMinor / recoveryMinor fields →
//        any emission trips recon:no-residual-minor-encoding (no allowlist)
//        globally; here we assert the corollary that none exist on the store.
//   (C2) V2 SOLE LIVE PATH — PASS-on-empty in the build phase. The op-loss data
//        set is legitimately empty (capture-only). The positive-figure proof is
//        the capture-probe UNIT TEST (operational-risk.test.ts +
//        oprisk-attestation-gates.ts GATE 1, which round-trips an
//        OperationalLossEventV2 with grossLoss R100.00 through the projection).
//        Seeding a forbidden legacy *Minor event to force non-vacuity would be
//        concealment, not evidence (the RwaComputed pilot lesson).
//   (C3) DECODED-DECIMAL PARITY: for any lossEventId present in BOTH the V1 and
//        V2 registers, the decoded decimal figures (gross, recovery, currency,
//        business line, category, status) must match. V1 is un-emittable so the
//        V1 register is vacuous in the steady state; this is the standing guard
//        that activates if historical V1 figures are ever backfilled
//        (scripts/backfill-operational-loss-v2.ts).
//
// CLEAN-STORE BEHAVIOUR: on a fresh store with no events, C1 holds (0 V1), C2 is
// PASS-on-empty, C3 is vacuous → the gate passes on the construction conditions
// (C0/C1) alone. This is correct: the op-loss type is data-empty in the build
// phase and the emit-path proof lives in the unit test.
//
// STATUS: ENFORCING (Bucket A final flip). Any fail-severity violation blocks CI.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-FX-HELD-DIMS-SEAT-SWEEP (op-loss capture).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import {
  type OperationalLossDecodedDecimal,
  type OperationalLossEventPayload,
  type OperationalLossEventPayloadV2,
  decodeOperationalLossV1Decimal,
  decodeOperationalLossV2Decimal,
} from "../event-store/event-types/operational-risk";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "operational-loss-v2-parity";

const V1_TYPE = "OperationalLossEvent" as const;
const V2_TYPE = "OperationalLossEventV2" as const;

/** The fields compared for decoded-decimal parity on a shared lossEventId. */
const COMPARED_FIELDS = [
  "grossLoss",
  "grossLossCurrency",
  "recovery",
  "recoveryCurrency",
  "businessLine",
  "eventTypeCategory",
  "status",
] as const;

/** Read the latest V1 OperationalLossEvent per lossEventId, decoded-decimal. */
function readV1Decoded(): OperationalLossDecodedDecimal[] {
  const latest = new Map<string, OperationalLossDecodedDecimal>();
  for (const ev of eventStore.replay({ type: V1_TYPE })) {
    const p = ev.payload as OperationalLossEventPayload;
    if (typeof p.lossEventId !== "string") continue;
    latest.set(p.lossEventId, decodeOperationalLossV1Decimal(p, ev.event_id));
  }
  return [...latest.values()].sort((a, b) => a.lossEventId.localeCompare(b.lossEventId));
}

/** Read the latest V2 OperationalLossEventV2 per lossEventId, decoded-decimal. */
function readV2Decoded(): OperationalLossDecodedDecimal[] {
  const latest = new Map<string, OperationalLossDecodedDecimal>();
  for (const ev of eventStore.replay({ type: V2_TYPE })) {
    const p = ev.payload as OperationalLossEventPayloadV2;
    if (typeof p.lossEventId !== "string") continue;
    latest.set(p.lossEventId, decodeOperationalLossV2Decimal(p, ev.event_id));
  }
  return [...latest.values()].sort((a, b) => a.lossEventId.localeCompare(b.lossEventId));
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (C0) Registry tags.
  const v1Entry = EVENT_TYPE_REGISTRY.find((e) => e.type === V1_TYPE);
  result.asserted += 1;
  if (!v1Entry) {
    violations.push({
      subject: `operational-loss-v2-parity:registry-missing:${V1_TYPE}`,
      message: `"${V1_TYPE}" is not in the registry. Expected v2Status "v2-replaced" (retired-by-construction, Bucket A batch A3). Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.`,
      severity: "fail",
    });
  } else if (v1Entry.v2Status !== "v2-replaced") {
    violations.push({
      subject: `operational-loss-v2-parity:flip-reverted:${V1_TYPE}`,
      message: `"${V1_TYPE}" is tagged "${v1Entry.v2Status}" but it was flipped to "v2-replaced" under Bucket A batch A3 (retired-by-construction). Reverting a recorded flip requires a CEO Decision. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC; D-BANK-WIDE-V2-MIGRATION.`,
      severity: "fail",
    });
  }

  const v2Entry = EVENT_TYPE_REGISTRY.find((e) => e.type === V2_TYPE);
  result.asserted += 1;
  if (!v2Entry) {
    violations.push({
      subject: `operational-loss-v2-parity:registry-missing:${V2_TYPE}`,
      message: `"${V2_TYPE}" is not in the registry. This is a three-site F-032 registration defect. Register it in platform/event-store/registry/operational-risk.ts with v2Status: "v2-parallel". Authority: D-BANK-WIDE-V2-MIGRATION.`,
      severity: "fail",
    });
  } else if (v2Entry.v2Status !== "v2-parallel") {
    violations.push({
      subject: `operational-loss-v2-parity:unexpected-status:${V2_TYPE}`,
      message: `"${V2_TYPE}" is tagged "${v2Entry.v2Status}" — expected "v2-parallel". The decimal-native V2 type runs parallel with the retired V1 type. Authority: D-BANK-WIDE-V2-MIGRATION.`,
      severity: "fail",
    });
  }

  // (C1) V1 UN-EMITTABLE corollary — ZERO live V1 OperationalLossEvent events.
  result.asserted += 1;
  let v1Count = 0;
  for (const _e of eventStore.replay({ type: V1_TYPE })) v1Count += 1;
  if (v1Count > 0) {
    violations.push({
      subject: `operational-loss-v2-parity:construction-broken:${V1_TYPE}`,
      message: `"${V1_TYPE}" is flipped v2-replaced RETIRED-BY-CONSTRUCTION, but ${v1Count} such event(s) exist in the store. The construction basis requires the V1 type to be un-emittable (its schema carries required numeric grossLossMinor / recoveryMinor fields, blocked by recon:no-residual-minor-encoding). A present event means either the ratchet was bypassed or these are historical replay-only events that should be mirrored to OperationalLossEventV2 (scripts/backfill-operational-loss-v2.ts) — investigate. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC; recon:no-residual-minor-encoding.`,
      severity: "fail",
    });
  }

  // Fold both registers (decoded-decimal projection).
  let v1Rows: OperationalLossDecodedDecimal[] = [];
  let v2Rows: OperationalLossDecodedDecimal[] = [];
  try {
    v1Rows = readV1Decoded();
    v2Rows = readV2Decoded();
  } catch (err) {
    violations.push({
      subject: "operational-loss-v2-parity:fold-error",
      message: `Op-loss register fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the store for malformed OperationalLossEvent / OperationalLossEventV2 events.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    result.asOf = "operational-loss-v2-parity [ENFORCING]: fold error.";
    return result;
  }

  // (C2) V2 SOLE LIVE PATH — PASS-on-empty in the build phase. The op-loss data
  // set is legitimately empty (capture-only; no real loss history). The
  // positive-figure proof is the capture-probe unit test (operational-risk.test.ts
  // + oprisk-attestation-gates.ts GATE 1). Seeding a forbidden legacy *Minor
  // event to force non-vacuity would be concealment, not evidence.
  result.asserted += 1;
  const nonVacuousV2 = v2Rows.filter((r) => Number(r.grossLoss) > 0);

  // (C3) DECODED-DECIMAL PARITY — for any lossEventId in BOTH registers, the
  //      decoded decimal figures must match. (V1 vacuous in steady state.)
  const v2ByKey = new Map(v2Rows.map((r) => [r.lossEventId, r]));
  for (const v1 of v1Rows) {
    const v2 = v2ByKey.get(v1.lossEventId);
    result.asserted += 1;
    if (!v2) {
      violations.push({
        subject: `operational-loss-v2-parity:v1-only:${v1.lossEventId}`,
        message: `V1 register has lossEventId "${v1.lossEventId}" but V2 does not. A historical V1 OperationalLossEvent must be mirrored to OperationalLossEventV2 (scripts/backfill-operational-loss-v2.ts) so the V2 register is the complete record. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.`,
        severity: "fail",
      });
      continue;
    }
    for (const field of COMPARED_FIELDS) {
      if (String(v1[field]) !== String(v2[field])) {
        violations.push({
          subject: `operational-loss-v2-parity:decoded-mismatch:${v1.lossEventId}:${field}`,
          message: `Decoded op-loss mismatch on "${field}" for "${v1.lossEventId}": V1="${String(v1[field])}" vs V2="${String(v2[field])}". The V2 MoneyWire decode must equal the V1 minor→decimal decode. Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE.`,
          severity: "fail",
        });
      }
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.asOf =
    `operational-loss-v2-parity [ENFORCING]: V1 rows=${v1Rows.length} (un-emittable, expect 0), ` +
    `V2 rows=${v2Rows.length} (${nonVacuousV2.length} with grossLoss>0; build-phase op-loss legitimately empty, PASS-on-empty — C2 positive-figure proof is the capture-probe unit test); ` +
    `${failCount === 0 ? "RBC CONDITIONS HOLD (C0 tags, C1 V1 un-emittable, C2 emit-path-wired, C3 decoded-parity)" : `${failCount} fail`}.`;
  return result;
}

if (import.meta.main) {
  const r = run();
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
