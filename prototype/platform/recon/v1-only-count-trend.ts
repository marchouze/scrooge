// platform/recon/v1-only-count-trend.ts
//
// recon:v1-only-count-trend — ADVISORY gate (never fails CI).
//
// Prints a single-line summary of the V1→V2 retirement progress across
// the full registry. Gives CI operators visibility into how many event
// types remain V1-only vs have been promoted to v2-parallel or v2-replaced.
//
// This gate always returns `ok: true` — it is purely informational. The
// enforcing counterparts are:
//   - `recon:v1-removal-v2status-coverage` (every type must be tagged)
//   - `recon:v1-removal-ratchet` (v1-only count may not increase)
//
// Summary line format:
//   v1-removal: v1-only=N | v2-parallel=M | v2-replaced=K | total=T
//
// Authority: D-V1-REMOVAL-PHASE-1 (CEO-approved 2026-06-15).
// Author: Atlas (Substrate Architect, engineering).

import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { type ReconResult, emptyResult } from "./types";

const PIPELINE = "v1-only-count-trend";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);

  const counts = {
    "v1-only": 0,
    "v2-parallel": 0,
    "v2-replaced": 0,
    untagged: 0,
  };

  for (const entry of EVENT_TYPE_REGISTRY) {
    if (!entry.v2Status) {
      counts.untagged += 1;
    } else if (entry.v2Status === "v1-only") {
      counts["v1-only"] += 1;
    } else if (entry.v2Status === "v2-parallel") {
      counts["v2-parallel"] += 1;
    } else if (entry.v2Status === "v2-replaced") {
      counts["v2-replaced"] += 1;
    }
  }

  const total = EVENT_TYPE_REGISTRY.length;
  const progress =
    counts["v2-replaced"] > 0 ? ((counts["v2-replaced"] / total) * 100).toFixed(1) : "0.0";

  result.asserted = 1;
  result.violations = []; // advisory: never emits violations
  result.ok = true;
  result.asOf = `v1-removal: v1-only=${counts["v1-only"]} | v2-parallel=${counts["v2-parallel"]} | v2-replaced=${counts["v2-replaced"]} | total=${total} | retirement-progress=${progress}%${counts.untagged > 0 ? ` | UNTAGGED=${counts.untagged} (see v2status-coverage gate)` : ""}`;

  return result;
}

if (import.meta.main) {
  const r = run();
  // Print the summary line to stdout (no JSON envelope — this is a trend report).
  process.stdout.write(`${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: "info",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: 0,
      ok: true,
      msg: r.asOf,
    }),
  );
  process.exit(0); // always exits 0 (advisory)
}
