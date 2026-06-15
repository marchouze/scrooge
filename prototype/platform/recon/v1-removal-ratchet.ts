// platform/recon/v1-removal-ratchet.ts
//
// recon:v1-removal-ratchet — enforcing, HARDEN-ONLY gate.
//
// Counts event types tagged `"v1-only"` in the current registry and compares
// against a committed baseline in `v1-removal-ratchet.json`. Fails if the
// current count EXCEEDS the baseline — that would mean new v1-only types
// were added without a recorded Decision, widening the retirement gap.
// Passes if the count is equal (ground held) or lower (ground gained).
//
// HARDEN-ONLY CONTRACT: the baseline count in v1-removal-ratchet.json may
// only decrease over time. Do not increase the KNOWN_VIOLATIONS_SNAPSHOT
// (v1OnlyCount) without a CEO-approved Decision that explicitly authorises
// adding a new event type to the V1-only estate. Any such Decision must
// be recorded via `recordDecision` with category "engineering" and must
// update the JSON alongside the new event type row. Authority for the
// ratchet: D-V1-REMOVAL-PHASE-1 (CEO-approved 2026-06-15).
//
// KNOWN_VIOLATIONS_SNAPSHOT baseline: 585 v1-only types as of 2026-06-15
// (Phase 1 initial tagging). Every domain flip that promotes a type from
// v1-only → v2-parallel → v2-replaced reduces this count. The ratchet
// baseline is updated (downward only) in the same PR that records the flip.
//
// This is an ENFORCING gate (exits 1 on fail-severity violation).
// Author: Atlas (Substrate Architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v1-removal-ratchet";

function findReconDir(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, "platform/recon/v1-removal-ratchet.json");
    if (existsSync(candidate)) return resolve(dir, "platform/recon");
    dir = resolve(dir, "..");
  }
  throw new Error(`Cannot locate platform/recon/ from ${start}`);
}

interface RatchetBaseline {
  readonly v1OnlyCount: number;
  readonly asOf: string;
  readonly authority: string;
}

export interface RunOpts {
  readonly ratchetJsonPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Load baseline.
  let baseline: RatchetBaseline;
  try {
    const jsonPath =
      opts.ratchetJsonPath ?? resolve(findReconDir(import.meta.dir), "v1-removal-ratchet.json");
    const raw = readFileSync(jsonPath, "utf8");
    baseline = JSON.parse(raw) as RatchetBaseline;
  } catch (e) {
    violations.push({
      subject: "ratchet-baseline-missing",
      message: `Could not load v1-removal-ratchet.json: ${(e as Error).message}. The ratchet baseline must be committed alongside the Phase 1 landing. Authority: D-V1-REMOVAL-PHASE-1.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    result.asserted = 1;
    return result;
  }

  // Count current v1-only types.
  const currentV1Only = EVENT_TYPE_REGISTRY.filter((e) => e.v2Status === "v1-only").length;
  const currentV2Parallel = EVENT_TYPE_REGISTRY.filter((e) => e.v2Status === "v2-parallel").length;
  const currentV2Replaced = EVENT_TYPE_REGISTRY.filter((e) => e.v2Status === "v2-replaced").length;

  result.asserted = 2; // (1) baseline loads; (2) count does not exceed baseline.

  if (currentV1Only > baseline.v1OnlyCount) {
    violations.push({
      subject: "v1-only-count-increased",
      message: `v1-only count increased: current=${currentV1Only} > baseline=${baseline.v1OnlyCount} (set ${baseline.asOf}, authority ${baseline.authority}). Adding new event types tagged v1-only without a CEO-approved Decision widens the V1 retirement gap. Either tag the new type v2-parallel (if a V2 path already exists) or record a Decision to authorise the expansion and update the baseline in the same PR. Harden-only: the baseline may only decrease.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf =
    `v1-removal-ratchet: v1-only=${currentV1Only} | baseline=${baseline.v1OnlyCount} | ` +
    `v2-parallel=${currentV2Parallel} | v2-replaced=${currentV2Replaced}; ` +
    `${currentV1Only <= baseline.v1OnlyCount ? "HELD (≤ baseline)" : "BREACH (> baseline)"}. ` +
    `Baseline set ${baseline.asOf} (${baseline.authority}).`;
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
        ? "v1-removal-ratchet OK — v1-only count held or decreased vs baseline"
        : "v1-removal-ratchet FAILED — v1-only count exceeds baseline (see violations)",
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
