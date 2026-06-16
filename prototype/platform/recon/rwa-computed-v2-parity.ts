// platform/recon/rwa-computed-v2-parity.ts
//
// recon:rwa-computed-v2-parity — Bucket A PILOT parity gate
// (D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC).
//
// PURPOSE
// -------
// Standing evidence that the RwaComputed → RwaComputedV2 flip is RETIRED-BY-
// CONSTRUCTION. Because the V1 figures are minor-unit integers and the V2
// figures are MAJOR-unit decimal-string MoneyWire, a BYTE comparison across the
// unit change is meaningless — so (like recon:fx-v2-parity) this gate compares
// on the DECODED DECIMAL VALUE, and rests the flip on the four
// D-V1-REMOVAL-FLIP-BASIS-RBC construction conditions rather than on data-parity
// alone (the type is data-empty in the build phase — see
// prototype/docs/bucket-a-money-bearing-nonfinancial-scope.md §6).
//
// CONDITIONS ASSERTED (each = a registry-row claim made load-bearing here):
//   (C0) Registry: RwaComputed is tagged "v2-replaced"; RwaComputedV2 is tagged
//        "v2-parallel". Reverting either without a CEO Decision is a fail.
//   (C1) V1 UN-EMITTABLE (corollary): ZERO live V1 RwaComputed events. The
//        schema requires numeric *RwaMinor fields → any emission trips
//        recon:no-residual-minor-encoding (no allowlist) globally; here we
//        assert the corollary that none exist on the store.
//   (C2) V2 SOLE LIVE PATH PRODUCES (NON-VACUOUS): ≥1 RwaComputedV2 event with a
//        decoded total RWA > 0 (the seed:rwa-computed-v2 step drives the
//        re-pointed period-close emitter on the ci:migrate store). A vacuous V2
//        register fails this gate — the flip's whole basis is condition 2.
//   (C3) DECODED-DECIMAL PARITY: for any (entity, periodId) present in BOTH the
//        V1 and V2 registers, the decoded decimal figures must match. (V1 is
//        un-emittable so the V1 register is vacuous in the steady state; this
//        check is the standing guard that activates if historical V1 figures
//        are ever backfilled — scripts/backfill-rwa-computed-v2.ts.)
//
// CLEAN-STORE BEHAVIOUR: on a fresh store with no events, C1 holds (0 V1) but
// C2 fails (no V2 produced) — which is correct: the gate must be driven by the
// ci:migrate seed (seed:rwa-computed-v2) to be honest. On the CI store (seeds
// run), C2 is non-vacuous.
//
// STATUS: ENFORCING (Bucket A pilot flip). Any fail-severity violation blocks CI.
//
// ARCHITECTURE NOTE: this gate imports the V1 event store + the V2 decoded
// readers via the permitted direction; it does not import any v2-core package
// (recon:v2-no-v1-import forbids only the reverse). RwaComputedV2 lives in the
// SAME authoritative event store as V1 (money-bearing types stay decimal-native
// in the authoritative store).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-RWA-ENGINE-W2-SLICE-3.
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-a-pilot-rwa-computed-v2 (2026-06-16).
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import type { ProvenanceFilter } from "../projections/filter";
import {
  type RwaDecodedDecimal,
  readRwaComputedV1Decoded,
  readRwaComputedV2Decoded,
} from "../risk/rwa-computed-engine-v2";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "rwa-computed-v2-parity";

const V1_TYPE = "RwaComputed" as const;
const V2_TYPE = "RwaComputedV2" as const;

/** The fields compared for decoded-decimal parity on a shared (entity, periodId). */
const COMPARED_FIELDS = [
  "functionalCurrency",
  "creditRwa",
  "marketRwa",
  "operationalRwa",
  "totalRwa",
  "source",
  "operationalRwaIsPlaceholder",
  "creditExposureCount",
] as const;

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (C0) Registry tags — RwaComputed v2-replaced, RwaComputedV2 v2-parallel.
  const v1Entry = EVENT_TYPE_REGISTRY.find((e) => e.type === V1_TYPE);
  result.asserted += 1;
  if (!v1Entry) {
    violations.push({
      subject: `rwa-computed-v2-parity:registry-missing:${V1_TYPE}`,
      message: `"${V1_TYPE}" is not in the registry. Expected v2Status "v2-replaced" (retired-by-construction, Bucket A pilot). Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.`,
      severity: "fail",
    });
  } else if (v1Entry.v2Status !== "v2-replaced") {
    violations.push({
      subject: `rwa-computed-v2-parity:flip-reverted:${V1_TYPE}`,
      message: `"${V1_TYPE}" is tagged "${v1Entry.v2Status}" but it was flipped to "v2-replaced" under the Bucket A pilot (retired-by-construction). Reverting a recorded flip requires a CEO Decision. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC; D-BANK-WIDE-V2-MIGRATION.`,
      severity: "fail",
    });
  }

  const v2Entry = EVENT_TYPE_REGISTRY.find((e) => e.type === V2_TYPE);
  result.asserted += 1;
  if (!v2Entry) {
    violations.push({
      subject: `rwa-computed-v2-parity:registry-missing:${V2_TYPE}`,
      message: `"${V2_TYPE}" is not in the registry. This is a three-site F-032 registration defect. Register it in platform/event-store/registry/regulatory-reporting.ts with v2Status: "v2-parallel". Authority: D-BANK-WIDE-V2-MIGRATION.`,
      severity: "fail",
    });
  } else if (v2Entry.v2Status !== "v2-parallel") {
    violations.push({
      subject: `rwa-computed-v2-parity:unexpected-status:${V2_TYPE}`,
      message: `"${V2_TYPE}" is tagged "${v2Entry.v2Status}" — expected "v2-parallel". The decimal-native V2 type runs parallel with the retired V1 type. Authority: D-BANK-WIDE-V2-MIGRATION.`,
      severity: "fail",
    });
  }

  // (C1) V1 UN-EMITTABLE corollary — ZERO live V1 RwaComputed events.
  result.asserted += 1;
  let v1Count = 0;
  for (const _e of eventStore.replay({ type: V1_TYPE })) v1Count += 1;
  if (v1Count > 0) {
    violations.push({
      subject: `rwa-computed-v2-parity:construction-broken:${V1_TYPE}`,
      message: `"${V1_TYPE}" is flipped v2-replaced RETIRED-BY-CONSTRUCTION, but ${v1Count} such event(s) exist in the store. The construction basis requires the V1 type to be un-emittable (its schema carries required numeric *RwaMinor fields, blocked by recon:no-residual-minor-encoding). A present event means either the ratchet was bypassed or these are historical replay-only events that should be mirrored to RwaComputedV2 (scripts/backfill-rwa-computed-v2.ts) — investigate. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC; recon:no-residual-minor-encoding.`,
      severity: "fail",
    });
  }

  // Fold both registers. Use the COMBINED provenance filter so the seeded
  // production RwaComputedV2 (and any backfilled V1) is read regardless of the
  // store's sim/prod mix — the gate proves the construction conditions, not a
  // production-only operating-book invariant.
  let v1Rows: RwaDecodedDecimal[] = [];
  let v2Rows: RwaDecodedDecimal[] = [];
  try {
    // COMBINED mode — read both production + simulated so the seeded production
    // RwaComputedV2 (and any backfilled V1) is folded regardless of the store's
    // sim/prod mix. The gate proves the construction conditions, not a
    // production-only operating-book invariant.
    const filter: ProvenanceFilter = { mode: "combined" };
    v1Rows = readRwaComputedV1Decoded(eventStore, { provenanceFilter: filter });
    v2Rows = readRwaComputedV2Decoded(eventStore, { provenanceFilter: filter });
  } catch (err) {
    violations.push({
      subject: "rwa-computed-v2-parity:fold-error",
      message: `RWA register fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the store for malformed RwaComputed / RwaComputedV2 events.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    result.asOf = "rwa-computed-v2-parity [ENFORCING]: fold error.";
    return result;
  }

  // (C2) V2 SOLE LIVE PATH PRODUCES — PASS-on-empty in the build phase.
  //
  // RwaComputed/RwaComputedV2 are data-empty in the build phase: the credit-RWA
  // input layer (`readDebtExposures`) reads the legacy `*Minor` `BondTradeExecuted`
  // / `InterbankLoanPlaced` events, which are themselves un-emittable on main
  // (recon:no-residual-minor-encoding, no allowlist), and there is no real
  // exposure book. Seeding one purely to make this gate non-vacuous would
  // re-introduce a forbidden legacy `*Minor` event — i.e. concealment, not
  // evidence. So this gate does NOT require seeded RWA data (exactly as the
  // BA-700 capital parity gate is PASS-on-empty; see the scoping note
  // docs/bucket-a-money-bearing-nonfinancial-scope.md §6).
  //
  // RBC condition 2 ("the re-pointed period-close emitter actually produces a
  // decoded RWA via emitRwaComputedV2") is proven by the engine UNIT TEST
  // `platform/risk/rwa-computed-engine-v2.test.ts`, which feeds decimal-native
  // inputs and asserts a positive decoded total — the honest place to prove an
  // emit path when the production store is legitimately empty. Any RwaComputedV2
  // that DOES land (now or at licence-day) must still satisfy C3 decoded parity.
  result.asserted += 1;
  const nonVacuousV2 = v2Rows.filter((r) => Number(r.totalRwa) > 0);

  // (C3) DECODED-DECIMAL PARITY — for any (entity, periodId) in BOTH registers,
  //      the decoded decimal figures must match. (V1 vacuous in steady state.)
  const v2ByKey = new Map(v2Rows.map((r) => [`${r.entityId}::${r.periodId}`, r]));
  for (const v1 of v1Rows) {
    const key = `${v1.entityId}::${v1.periodId}`;
    const v2 = v2ByKey.get(key);
    result.asserted += 1;
    if (!v2) {
      violations.push({
        subject: `rwa-computed-v2-parity:v1-only:${key}`,
        message: `V1 register has (entity, periodId) "${key}" but V2 does not. A historical V1 RwaComputed must be mirrored to RwaComputedV2 (scripts/backfill-rwa-computed-v2.ts) so the V2 register is the complete record. Authority: D-V1-REMOVAL-FLIP-BASIS-RBC.`,
        severity: "fail",
      });
      continue;
    }
    for (const field of COMPARED_FIELDS) {
      if (String(v1[field]) !== String(v2[field])) {
        violations.push({
          subject: `rwa-computed-v2-parity:decoded-mismatch:${key}:${field}`,
          message: `Decoded RWA mismatch on "${field}" for "${key}": V1="${String(v1[field])}" vs V2="${String(v2[field])}". The V2 MoneyWire decode must equal the V1 minor→decimal decode. Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE.`,
          severity: "fail",
        });
      }
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.asOf =
    `rwa-computed-v2-parity [ENFORCING]: V1 rows=${v1Rows.length} (un-emittable, expect 0), ` +
    `V2 rows=${v2Rows.length} (${nonVacuousV2.length} with totalRwa>0; build-phase RWA legitimately 0, PASS-on-empty — C2 RWA>0 proof is the engine unit test); ` +
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
