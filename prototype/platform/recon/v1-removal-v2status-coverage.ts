// platform/recon/v1-removal-v2status-coverage.ts
//
// recon:v1-removal-v2status-coverage — enforcing gate.
//
// Every event type in the registry MUST carry a `v2Status` field
// ("v1-only" | "v2-parallel" | "v2-replaced"). This gate iterates
// every entry in EVENT_TYPE_REGISTRY and fails if any lacks the field.
//
// WHY THIS GATE EXISTS:
//   Phase 1 of V1 retirement adds `v2Status` as a required field on
//   EventTypeMetadata. TypeScript enforces this at compile time, but a
//   runtime gate catches any entry that sneaks through (e.g. via `as any`
//   casts or dynamically assembled entries). The gate is the runtime
//   counterpart of the type-system requirement.
//
// This is an ENFORCING gate (exits 1 on any `fail`-severity violation).
// Authority: D-V1-REMOVAL-PHASE-1 (CEO-approved 2026-06-15).
// Author: Atlas (Substrate Architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v1-removal-v2status-coverage";

const VALID_STATUSES = new Set(["v1-only", "v2-parallel", "v2-replaced"]);

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  result.asserted = EVENT_TYPE_REGISTRY.length;

  for (const entry of EVENT_TYPE_REGISTRY) {
    if (!entry.v2Status) {
      violations.push({
        subject: `v2status-missing:${entry.type}`,
        message: `Event type "${entry.type}" is missing the required \`v2Status\` field. Every registered event type must carry v2Status ("v1-only" | "v2-parallel" | "v2-replaced"). Add \`v2Status: "v1-only"\` as a conservative default until a V2 parallel path exists. Authority: D-V1-REMOVAL-PHASE-1.`,
        severity: "fail",
      });
    } else if (!VALID_STATUSES.has(entry.v2Status)) {
      violations.push({
        subject: `v2status-invalid:${entry.type}`,
        message: `Event type "${entry.type}" has an invalid \`v2Status\` value: "${entry.v2Status}". Valid values: "v1-only" | "v2-parallel" | "v2-replaced". Authority: D-V1-REMOVAL-PHASE-1.`,
        severity: "fail",
      });
    }
  }

  const byStatus = {
    "v1-only": 0,
    "v2-parallel": 0,
    "v2-replaced": 0,
  };
  for (const entry of EVENT_TYPE_REGISTRY) {
    if (entry.v2Status && entry.v2Status in byStatus) {
      byStatus[entry.v2Status] += 1;
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf =
    `v1-removal-v2status-coverage: ${EVENT_TYPE_REGISTRY.length} event types checked; ` +
    `v1-only=${byStatus["v1-only"]} | v2-parallel=${byStatus["v2-parallel"]} | v2-replaced=${byStatus["v2-replaced"]}; ` +
    `${violations.length} violation(s).`;
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
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "v1-removal-v2status-coverage OK — all event types carry v2Status"
        : "v1-removal-v2status-coverage FAILED — event types missing v2Status (see violations)",
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
