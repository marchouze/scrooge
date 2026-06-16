// platform/recon/v2-store-tee-coverage.ts
//
// recon:v2-store-tee-coverage — Wave 2 infra coverage gate (D-BANK-WIDE-V2-MIGRATION).
//
// PURPOSE
// -------
// The generic V1→v2 store-tee (`platform/event-store/v2-store-tee.ts`) mirrors
// every tee-enabled type's V1 appends into the v2 control-plane store, and the
// generic backfill (`scripts/backfill-v2-store-tee.ts`) replays history. This
// gate is the standing evidence that the mechanism actually covers what the
// registry says it should:
//
//   (A) EVERY type whose v2 registry row carries a `tee` declaration is actually
//       mirrored — the type appears in the v2 control-plane store with a count
//       that matches the V1 source count (tee wired + backfilled, no gap).
//   (B) NO mirrored type DIVERGES — the v2 count never EXCEEDS the V1 count
//       (a v2 row with no V1 source would mean a spurious or orphaned mirror).
//
// A count GAP (v2 < V1) is the loud divergence signal the decoupled-write
// failure design produces when a mirror fails: the V1 write committed but the
// v2 mirror did not. This gate catches it independently of the per-event
// SubstrateAlert. A count EXCESS (v2 > V1) means the v2 store holds a mirror with
// no live V1 source — an integrity problem in the other direction.
//
// SEVERITY: advisory (per the brief). On a clean CI store with the ci:migrate
// chain run, posture is the only tee-enabled type and its counts match byte-for-
// byte (the enforcing recon:posture-v2-parity is the hard backstop). This gate
// is the BROAD coverage lens across ALL tee-enabled types — it flips enforcing
// once the rollout stabilises and every tee type carries its own parity gate.
//
// CLEAN-STORE BEHAVIOUR: with no events of a tee type, both counts are 0 → match
// → pass (vacuously). The gate becomes load-bearing once the seeds + backfill
// have populated the stores (the ci:migrate chain does exactly that).
//
// ARCHITECTURE NOTE: v1-side recon infra; imports the v2 store + registry via the
// permitted v1→v2 direction (`recon:v2-no-v1-import` forbids only the reverse).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-infra-generic-v1-v2-store-tee:2026-06-16.
// Principle 1 (events are truth); Principle 2 (single-graph discipline).
// Author: Atlas (Core banking platform architect, engineering).

import { defaultControlPlanePath, openControlPlaneStore } from "../../v2-core/control-plane/store";
import { teeEnabledV2EventTypes } from "../../v2-core/registry";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-store-tee-coverage";

/** Count V1 events of `type` in the authoritative V1 store. */
function v1CountByType(type: string): number {
  let n = 0;
  for (const _ of eventStore.replay({ type })) n += 1;
  return n;
}

/** Count v2 control-plane events of `type`. */
function v2CountByType(store: ReturnType<typeof openControlPlaneStore>, type: string): number {
  let n = 0;
  for (const _ of store.replay({ type })) n += 1;
  return n;
}

export function run(overridePath?: string): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const teeTypes = teeEnabledV2EventTypes();
  const store = openControlPlaneStore(overridePath ?? defaultControlPlanePath());

  const perType: Array<{ type: string; v1: number; v2: number }> = [];
  try {
    for (const type of teeTypes) {
      result.asserted += 1;
      const v1 = v1CountByType(type);
      const v2 = v2CountByType(store, type);
      perType.push({ type, v1, v2 });

      if (v2 < v1) {
        // (A) GAP — the tee/backfill did not mirror every V1 event. This is the
        // loud-divergence signal the decoupled-write design surfaces.
        violations.push({
          subject: `v2-store-tee-coverage:gap:${type}`,
          message: `Tee-enabled type "${type}" is UNDER-mirrored: V1 has ${v1} event(s) but the v2 control-plane store has ${v2}. ${v1 - v2} event(s) failed to mirror or were never backfilled. Re-run "bun run backfill:v2-store-tee" and check for a SubstrateAlert{integrity} from the tee. The V1 store stays authoritative.`,
          severity: "warn",
        });
      } else if (v2 > v1) {
        // (B) EXCESS — a v2 mirror with no live V1 source.
        violations.push({
          subject: `v2-store-tee-coverage:excess:${type}`,
          message: `Tee-enabled type "${type}" is OVER-mirrored: the v2 control-plane store has ${v2} event(s) but V1 has only ${v1}. ${v2 - v1} v2 row(s) have no live V1 source — a spurious or orphaned mirror. Inspect the v2 store for events whose bank:v1-source lineage tag points at a missing V1 event.`,
          severity: "warn",
        });
      }
    }
  } finally {
    store.close();
  }

  result.violations = violations;
  // Advisory gate: ok stays true regardless of warn-severity findings (no
  // fail-severity emitted here). It surfaces coverage gaps without blocking CI.
  result.ok = violations.every((v) => v.severity !== "fail");

  const gaps = violations.length;
  const summary = perType.map((p) => `${p.type}(V1=${p.v1},v2=${p.v2})`).join(", ");
  result.asOf =
    `v2-store-tee-coverage [ADVISORY]: ${teeTypes.length} tee-enabled type(s); ` +
    `${gaps === 0 ? "ALL MIRRORED (no gap, no excess)" : `${gaps} divergence(s)`}. ` +
    `${summary || "(no tee-enabled types)"}.`;
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
