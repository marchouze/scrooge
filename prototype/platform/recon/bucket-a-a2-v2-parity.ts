// platform/recon/bucket-a-a2-v2-parity.ts
//
// recon:bucket-a-a2-v2-parity — Wave 2 Bucket-A batch-A2 parity gate
// (D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC).
//
// PURPOSE
// -------
// Standing decoded-decimal evidence that the nine EMITTABLE numeric-money,
// non-financial types (ClimateScenarioRun, FeeDisclosureEvent,
// CorrespondentSettlementInstructionSent, NostroStatementReceived,
// CounterpartyExposureCalculated, STRCandidate, RelatedPartyTransactionProposed,
// InterEntityTransactionProposed, PAIARequest) dual-write correctly into the v2
// control-plane store via the generic store-tee + per-type MoneyWire codec.
//
// Unlike the money-FREE batches (verbatim byte-parity), these types lift a plain
// numeric / minor-int money field into decimal-native MoneyWire on the v2 mirror,
// so a BYTE comparison across the unit change is meaningless. Instead this gate
// folds the comparable register with the V1 side run THROUGH the same codec the
// tee applies (`foldBucketAA2Register(..., applyCodec=true)`), and the v2 side
// as-stored (`applyCodec=false`). The invariant asserted is therefore exactly:
//
//   v2-store payload  ==  codec(v1 payload)      (joined on the shared event_id)
//
// A dropped mirror surfaces as a V1-only row, a spurious mirror as a v2-only row,
// and any codec / decimal divergence as a payload byte-diff on the codec-applied
// shape. Same harness (`runParityCheck`) and v1→v2 read direction as the
// money-free batches.
//
// CLEAN-STORE / BUILD-PHASE BEHAVIOUR (PASS-on-empty): all nine types are
// data-empty in the build phase (0 live events — see
// prototype/docs/bucket-a-money-bearing-nonfinancial-scope.md §6). On an empty
// population both sides fold to an empty register → byte-equal → pass
// (vacuously). The gate becomes load-bearing the moment any batch-A2 event lands
// (live emit + tee mirror, or the generic backfill on historical events). The
// codec's MAJOR/MINOR-unit + currency-source correctness is independently proven
// by the unit test `v2-core/bucket-a-a2/codec.test.ts` (the honest place to prove
// a transform when the production store is legitimately empty).
//
// STATUS: ENFORCING (Bucket-A batch-A2 flip, 2026-06-16). All nine flipped
// v1-only → v2-replaced on ORDINARY dual-write + decoded-parity basis
// (D-V1-REMOVAL-FLIP-BASIS-RBC): V1 remains emittable and this gate is the
// standing evidence. A byte-diff, a harness self-test failure, or a fold error
// is fail-severity and blocks CI.
//
// ARCHITECTURE NOTE: v1-side recon infra; imports the v2 store + projection via
// the permitted v1→v2 direction (`recon:v2-no-v1-import` forbids only the
// reverse).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-V1-REMOVAL-PHASE-1 (parity-harness lineage).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-a-a2-emittable-numeric-money-types:2026-06-16.
// Principle 1 (events are truth); Principle 5 (multi-currency at the type level).
// Author: Atlas (Core banking platform architect, engineering).

import {
  BUCKET_A_A2_TYPES,
  type BucketAA2EventView,
  type BucketAA2Register,
  foldBucketAA2Register,
} from "../../v2-core/bucket-a-a2";
import type { CpEvent } from "../../v2-core/control-plane/store";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";
import { v2StoreProjectionReader } from "./v2-store-parity-adapter";

const PIPELINE = "bucket-a-a2-v2-parity";

const BATCH_TYPE_SET: ReadonlySet<string> = new Set<string>(BUCKET_A_A2_TYPES);

// ---------------------------------------------------------------------------
// V1 side — replay each batch type from the authoritative V1 event store and
// fold the register with the codec APPLIED, yielding the EXPECTED v2 payload.
// ---------------------------------------------------------------------------

function readV1Register(): BucketAA2Register {
  const views: BucketAA2EventView[] = [];
  for (const type of BUCKET_A_A2_TYPES) {
    for (const ev of eventStore.replay({ type })) {
      const e = ev as { event_id: string; type: string; payload: Record<string, unknown> };
      views.push({ event_id: e.event_id, type: e.type, payload: e.payload });
    }
  }
  return foldBucketAA2Register(views, BATCH_TYPE_SET, /* applyCodec */ true);
}

// ---------------------------------------------------------------------------
// V2 side — fold the register from the v2 control-plane store AS STORED (the
// tee already applied the codec on append; folding it again would double-apply).
// ---------------------------------------------------------------------------

function foldV2(events: readonly CpEvent[]): BucketAA2Register {
  const views: BucketAA2EventView[] = events.map((ev) => ({
    event_id: ev.event_id,
    type: ev.type,
    payload: ev.payload,
  }));
  return foldBucketAA2Register(views, BATCH_TYPE_SET, /* applyCodec */ false);
}

export function run(overridePath?: string): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — the vacuous (empty == empty) parity must pass.
  result.asserted += 1;
  const vacuous = runParityCheck({
    label: "bucket-a-a2-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  if (vacuous.length > 0) {
    violations.push({
      subject: "bucket-a-a2-v2-parity:harness-structural-check",
      message:
        "The parity harness vacuous self-test failed (empty != empty). This is a harness bug, not a domain divergence. Inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) The decoded-decimal equivalence check (v2 payload == codec(v1 payload)).
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
      label: "bucket-a-a2-register",
      readV1: () => v1Snap,
      readV2: () => v2Snap,
    });
    for (const v of parity) {
      violations.push(v);
    }
  } catch (err) {
    violations.push({
      subject: "bucket-a-a2-v2-parity:fold-error",
      message: `bucket-a-a2 register fold threw: ${err instanceof Error ? err.message : String(err)}. Inspect the V1 store and the v2 control-plane store for malformed batch-A2 events (e.g. a missing currency field the codec requires).`,
      severity: "fail",
    });
  }

  result.violations = violations;
  // ENFORCING gate: ok = false on any fail-severity (byte-diff / harness / fold).
  result.ok = violations.every((v) => v.severity !== "fail");

  const failCount = violations.filter((v) => v.severity === "fail").length;
  const warnCount = violations.filter((v) => v.severity === "warn").length;
  const clean = warnCount === 0 && failCount === 0;
  result.asOf =
    `bucket-a-a2-v2-parity [ENFORCING]: ${BUCKET_A_A2_TYPES.length} type(s); ` +
    `V1 register events=${v1Count} (codec-applied), v2 register events=${v2Count} (as-stored); ` +
    `${clean ? "DECODED-CLEAN (v2 == codec(V1)); build-phase data-empty → PASS-on-empty (codec correctness proven by unit test)" : `DIVERGENT (${warnCount} warn, ${failCount} fail)`}. ` +
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
